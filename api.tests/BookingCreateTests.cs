using System.Security.Claims;
using FleetDesk.Api.Controllers;
using FleetDesk.Api.Data;
using FleetDesk.Api.Dtos;
using FleetDesk.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetDesk.Api.Tests;

public class BookingCreateTests
{
    // The tests pretend today is 23 Nov 2026.
    private static readonly DateOnly Today = new(2026, 11, 23);

    private sealed class FixedTime : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(2026, 11, 23, 9, 0, 0, TimeSpan.Zero);
    }

    private record Ctx(BookingsController Controller, FleetDeskDbContext Db,
        int Good, int InService, int Expired, int ExpiresToday, int Other);

    private static Ctx Setup(int userId = 3)
    {
        var options = new DbContextOptionsBuilder<FleetDeskDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new FleetDeskDbContext(options);

        var good = new Vehicle { Rego = "GOOD01", Make = "Toyota", Model = "Camry", Location = "Sydney", Status = VehicleStatus.Available, RegoExpiry = Today.AddDays(100) };
        var inService = new Vehicle { Rego = "SERV01", Make = "Mazda", Model = "CX-5", Location = "Sydney", Status = VehicleStatus.InService, RegoExpiry = Today.AddDays(100) };
        var expired = new Vehicle { Rego = "EXPD01", Make = "Hyundai", Model = "i30", Location = "Sydney", Status = VehicleStatus.Available, RegoExpiry = Today.AddDays(-1) };
        var expiresToday = new Vehicle { Rego = "TODY01", Make = "Kia", Model = "Cerato", Location = "Sydney", Status = VehicleStatus.Available, RegoExpiry = Today };
        var other = new Vehicle { Rego = "OTHR01", Make = "Ford", Model = "Ranger", Location = "Sydney", Status = VehicleStatus.Available, RegoExpiry = Today.AddDays(100) };
        db.Vehicles.AddRange(good, inService, expired, expiresToday, other);
        db.SaveChanges();

        // GOOD01 is booked on days +10 to +14 (active) and +20 to +24 (cancelled).
        db.Bookings.AddRange(
            new Booking { VehicleId = good.Id, UserId = 99, StartDate = Today.AddDays(10), EndDate = Today.AddDays(14), Purpose = "Existing", Status = BookingStatus.Active },
            new Booking { VehicleId = good.Id, UserId = 99, StartDate = Today.AddDays(20), EndDate = Today.AddDays(24), Purpose = "Cancelled", Status = BookingStatus.Cancelled });
        db.SaveChanges();

        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, "Driver")
        }, "TestAuth");

        var controller = new BookingsController(db, new FixedTime())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };

        return new Ctx(controller, db, good.Id, inService.Id, expired.Id, expiresToday.Id, other.Id);
    }

    private static CreateBookingRequest Req(int vehicleId, int startOffset, int endOffset, string purpose = "Test trip") => new()
    {
        VehicleId = vehicleId,
        StartDate = Today.AddDays(startOffset),
        EndDate = Today.AddDays(endOffset),
        Purpose = purpose
    };

    [Fact]
    public async Task Create_Valid_ReturnsCreated_AndSavesAnActiveBookingForTheLoggedInUser()
    {
        var c = Setup(userId: 3);

        var result = await c.Controller.Create(Req(c.Good, 1, 3));

        Assert.IsType<CreatedResult>(result.Result);
        var saved = c.Db.Bookings.Single(b => b.Purpose == "Test trip");
        Assert.Equal(3, saved.UserId);
        Assert.Equal(c.Good, saved.VehicleId);
        Assert.Equal(BookingStatus.Active, saved.Status);
    }

    [Fact]
    public async Task Create_EndBeforeStart_ReturnsBadRequest()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.Good, 5, 3));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_EndSameAsStart_ReturnsBadRequest()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.Good, 5, 5));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_StartInThePast_ReturnsBadRequest()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.Good, -1, 2));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_StartingToday_IsAllowed()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.Good, 0, 1));

        Assert.IsType<CreatedResult>(result.Result);
    }

    [Fact]
    public async Task Create_BlankPurpose_ReturnsBadRequest()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.Good, 1, 3, purpose: "   "));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_UnknownVehicle_ReturnsNotFound()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(999, 1, 3));

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_VehicleInService_ReturnsConflict()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.InService, 1, 3));

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_ExpiredRego_ReturnsConflict()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.Expired, 1, 3));

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_RegoExpiringToday_IsStillAllowed()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.ExpiresToday, 1, 3));

        Assert.IsType<CreatedResult>(result.Result);
    }

    [Fact]
    public async Task Create_SameDatesAsExistingBooking_ReturnsConflict()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.Good, 10, 14));

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_StartsDuringExistingBooking_ReturnsConflict()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.Good, 12, 16));

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_EndsDuringExistingBooking_ReturnsConflict()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.Good, 8, 11));

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_StartsOnTheDayAnotherBookingEnds_ReturnsConflict()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.Good, 14, 16));

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_StartsTheDayAfterAnotherBookingEnds_IsAllowed()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.Good, 15, 17));

        Assert.IsType<CreatedResult>(result.Result);
    }

    [Fact]
    public async Task Create_OverACancelledBooking_IsAllowed()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.Good, 20, 22));

        Assert.IsType<CreatedResult>(result.Result);
    }

    [Fact]
    public async Task Create_SameDatesOnADifferentVehicle_IsAllowed()
    {
        var c = Setup();

        var result = await c.Controller.Create(Req(c.Other, 10, 14));

        Assert.IsType<CreatedResult>(result.Result);
    }

    [Fact]
    public async Task Create_WritesAnAuditLogEntry()
    {
        var c = Setup(userId: 3);

        await c.Controller.Create(Req(c.Good, 1, 3));

        var log = Assert.Single(c.Db.AuditLogs);
        Assert.Equal("Created", log.Action);
        Assert.Equal("Booking", log.Entity);
        Assert.Equal(3, log.UserId);
        Assert.Equal(c.Db.Bookings.Single(b => b.Purpose == "Test trip").Id, log.EntityId);
    }

    [Fact]
    public void BookingsController_RequiresLogin()
    {
        var attributes = typeof(BookingsController).GetCustomAttributes(typeof(AuthorizeAttribute), true);

        Assert.NotEmpty(attributes);
    }
}
