using System.Security.Claims;
using FleetDesk.Api.Controllers;
using FleetDesk.Api.Data;
using FleetDesk.Api.Dtos;
using FleetDesk.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetDesk.Api.Tests;

public class VehicleDetailsTests
{
    private record Seed(FleetDeskDbContext Db, int ManagerId, int DanId, int PriyaId, int Vehicle1Id, int Vehicle2Id);

    // A fresh in-memory database for every test.
    private static Seed CreateSeed()
    {
        var options = new DbContextOptionsBuilder<FleetDeskDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new FleetDeskDbContext(options);

        var manager = new User { Name = "Maria Manager", Email = "m@test", Role = UserRole.Manager };
        var dan = new User { Name = "Dan Driver", Email = "d@test", Role = UserRole.Driver };
        var priya = new User { Name = "Priya Driver", Email = "p@test", Role = UserRole.Driver };
        db.Users.AddRange(manager, dan, priya);

        var v1 = new Vehicle { Rego = "ABC123", Make = "Toyota", Model = "Camry", Year = 2022, Location = "Sydney", OdometerKm = 24000 };
        var v2 = new Vehicle { Rego = "DEF456", Make = "Mazda", Model = "CX-5", Year = 2021, Location = "Melbourne" };
        db.Vehicles.AddRange(v1, v2);
        db.SaveChanges();

        db.Bookings.AddRange(
            new Booking { VehicleId = v1.Id, UserId = dan.Id, StartDate = new DateOnly(2026, 12, 10), EndDate = new DateOnly(2026, 12, 12), Purpose = "A" },
            new Booking { VehicleId = v1.Id, UserId = dan.Id, StartDate = new DateOnly(2026, 10, 1), EndDate = new DateOnly(2026, 10, 3), Purpose = "B" },
            new Booking { VehicleId = v1.Id, UserId = priya.Id, StartDate = new DateOnly(2026, 12, 20), EndDate = new DateOnly(2026, 12, 22), Purpose = "C", Status = BookingStatus.Cancelled },
            new Booking { VehicleId = v2.Id, UserId = dan.Id, StartDate = new DateOnly(2026, 11, 5), EndDate = new DateOnly(2026, 11, 6), Purpose = "D" });

        db.Services.AddRange(
            new Service { VehicleId = v1.Id, Date = new DateOnly(2026, 6, 1), OdometerKm = 20000, Type = "Logbook", Cost = 400m },
            new Service { VehicleId = v1.Id, Date = new DateOnly(2026, 9, 1), OdometerKm = 23000, Type = "Brakes", Cost = 250m },
            new Service { VehicleId = v2.Id, Date = new DateOnly(2026, 8, 1), OdometerKm = 10000, Type = "Logbook", Cost = 300m });
        db.SaveChanges();

        return new Seed(db, manager.Id, dan.Id, priya.Id, v1.Id, v2.Id);
    }

    // Builds a controller that behaves as if this user were logged in.
    private static VehiclesController ControllerFor(FleetDeskDbContext db, int userId, string role)
    {
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, role)
        }, "TestAuth");

        return new VehiclesController(db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }

    private static VehicleDetailsDto Details(ActionResult<VehicleDetailsDto> result) =>
        Assert.IsType<VehicleDetailsDto>(result.Value);

    [Fact]
    public async Task GetById_UnknownVehicle_ReturnsNotFound()
    {
        var s = CreateSeed();

        var result = await ControllerFor(s.Db, s.ManagerId, "Manager").GetById(999);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetById_ReturnsTheVehiclesFields()
    {
        var s = CreateSeed();

        var d = Details(await ControllerFor(s.Db, s.ManagerId, "Manager").GetById(s.Vehicle1Id));

        Assert.Equal("ABC123", d.Rego);
        Assert.Equal("Toyota", d.Make);
        Assert.Equal("Camry", d.Model);
        Assert.Equal(24000, d.OdometerKm);
    }

    [Fact]
    public async Task GetById_Manager_SeesAllBookings_NewestFirst()
    {
        var s = CreateSeed();

        var d = Details(await ControllerFor(s.Db, s.ManagerId, "Manager").GetById(s.Vehicle1Id));

        Assert.Equal(
            new[] { new DateOnly(2026, 12, 20), new DateOnly(2026, 12, 10), new DateOnly(2026, 10, 1) },
            d.Bookings.Select(b => b.StartDate).ToArray());
    }

    [Fact]
    public async Task GetById_Manager_SeesDriverNames()
    {
        var s = CreateSeed();

        var d = Details(await ControllerFor(s.Db, s.ManagerId, "Manager").GetById(s.Vehicle1Id));

        Assert.Equal("Priya Driver", d.Bookings.First(b => b.Purpose == "C").DriverName);
        Assert.Equal("Dan Driver", d.Bookings.First(b => b.Purpose == "A").DriverName);
    }

    [Fact]
    public async Task GetById_Driver_SeesOnlyTheirOwnBookings()
    {
        var s = CreateSeed();

        var d = Details(await ControllerFor(s.Db, s.DanId, "Driver").GetById(s.Vehicle1Id));

        Assert.Equal(new[] { "A", "B" }, d.Bookings.Select(b => b.Purpose).ToArray());
    }

    [Fact]
    public async Task GetById_OtherDriver_SeesOnlyTheirBooking()
    {
        var s = CreateSeed();

        var d = Details(await ControllerFor(s.Db, s.PriyaId, "Driver").GetById(s.Vehicle1Id));

        Assert.Equal(new[] { "C" }, d.Bookings.Select(b => b.Purpose).ToArray());
    }

    [Fact]
    public async Task GetById_DriverWithNoBookingsOnTheVehicle_SeesNoBookingsButStillSeesTheVehicle()
    {
        var s = CreateSeed();

        // Only Dan booked vehicle 2, so Priya must not see his booking.
        var d = Details(await ControllerFor(s.Db, s.PriyaId, "Driver").GetById(s.Vehicle2Id));

        Assert.Equal("DEF456", d.Rego);
        Assert.Empty(d.Bookings);
    }

    [Fact]
    public async Task GetById_ReturnsOnlyThatVehiclesServices_NewestFirst()
    {
        var s = CreateSeed();

        var d = Details(await ControllerFor(s.Db, s.ManagerId, "Manager").GetById(s.Vehicle1Id));

        Assert.Equal(new[] { "Brakes", "Logbook" }, d.Services.Select(x => x.Type).ToArray());
        Assert.Equal(new DateOnly(2026, 9, 1), d.Services[0].Date);
    }
}
