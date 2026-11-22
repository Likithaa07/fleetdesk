using System.Security.Claims;
using FleetDesk.Api.Controllers;
using FleetDesk.Api.Data;
using FleetDesk.Api.Dtos;
using FleetDesk.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetDesk.Api.Tests;

public class BookingListCancelTests
{
    private static readonly DateOnly Today = new(2026, 11, 23);

    private sealed class FixedTime : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(2026, 11, 23, 9, 0, 0, TimeSpan.Zero);
    }

    private record Ctx(FleetDeskDbContext Db, int ManagerId, int DanId, int PriyaId, int ZedId,
        int V1, int A, int B, int C, int D);

    // A: Dan, vehicle 1, +5 to +9, active     B: Priya, vehicle 1, +5 to +9, cancelled
    // C: Priya, vehicle 2, +10 to +12, active  D: Dan, vehicle 1, -20 to -18, active (past)
    private static Ctx Setup()
    {
        var options = new DbContextOptionsBuilder<FleetDeskDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new FleetDeskDbContext(options);

        var manager = new User { Name = "Maria Manager", Email = "m@test", Role = UserRole.Manager };
        var dan = new User { Name = "Dan Driver", Email = "d@test", Role = UserRole.Driver };
        var priya = new User { Name = "Priya Driver", Email = "p@test", Role = UserRole.Driver };
        var zed = new User { Name = "Zed Driver", Email = "z@test", Role = UserRole.Driver };
        db.Users.AddRange(manager, dan, priya, zed);

        var v1 = new Vehicle { Rego = "AAA111", Make = "Toyota", Model = "Camry", Location = "Sydney", Status = VehicleStatus.Available, RegoExpiry = Today.AddDays(100) };
        var v2 = new Vehicle { Rego = "BBB222", Make = "Mazda", Model = "CX-5", Location = "Sydney", Status = VehicleStatus.Available, RegoExpiry = Today.AddDays(100) };
        db.Vehicles.AddRange(v1, v2);
        db.SaveChanges();

        var a = new Booking { VehicleId = v1.Id, UserId = dan.Id, StartDate = Today.AddDays(5), EndDate = Today.AddDays(9), Purpose = "A" };
        var b = new Booking { VehicleId = v1.Id, UserId = priya.Id, StartDate = Today.AddDays(5), EndDate = Today.AddDays(9), Purpose = "B", Status = BookingStatus.Cancelled };
        var c = new Booking { VehicleId = v2.Id, UserId = priya.Id, StartDate = Today.AddDays(10), EndDate = Today.AddDays(12), Purpose = "C" };
        var d = new Booking { VehicleId = v1.Id, UserId = dan.Id, StartDate = Today.AddDays(-20), EndDate = Today.AddDays(-18), Purpose = "D" };
        db.Bookings.AddRange(a, b, c, d);
        db.SaveChanges();

        return new Ctx(db, manager.Id, dan.Id, priya.Id, zed.Id, v1.Id, a.Id, b.Id, c.Id, d.Id);
    }

    private static BookingsController ControllerFor(FleetDeskDbContext db, int? userId, string role)
    {
        var claims = new List<Claim> { new(ClaimTypes.Role, role) };
        if (userId is not null)
        {
            claims.Add(new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString()));
        }

        return new BookingsController(db, new FixedTime())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
            }
        };
    }

    private static List<BookingDto> List(ActionResult<List<BookingDto>> r) => Assert.IsType<List<BookingDto>>(r.Value);

    private static string[] Purposes(ActionResult<List<BookingDto>> r) => List(r).Select(b => b.Purpose).ToArray();

    // ---------- list ----------

    [Fact]
    public async Task GetAll_Manager_SeesEveryBooking_NewestStartFirst()
    {
        var x = Setup();

        var result = await ControllerFor(x.Db, x.ManagerId, "Manager").GetAll();

        Assert.Equal(new[] { "C", "A", "B", "D" }, Purposes(result));
    }

    [Fact]
    public async Task GetAll_Manager_SeesRegoDriverNameAndStatus()
    {
        var x = Setup();

        var list = List(await ControllerFor(x.Db, x.ManagerId, "Manager").GetAll());

        var c = list.Single(b => b.Purpose == "C");
        Assert.Equal("BBB222", c.Rego);
        Assert.Equal("Priya Driver", c.DriverName);
        Assert.Equal("Active", c.Status);
        Assert.Contains(list, b => b.Purpose == "B" && b.Status == "Cancelled");
    }

    [Fact]
    public async Task GetAll_Driver_SeesOnlyTheirOwnBookings()
    {
        var x = Setup();

        var result = await ControllerFor(x.Db, x.DanId, "Driver").GetAll();

        Assert.Equal(new[] { "A", "D" }, Purposes(result));
    }

    [Fact]
    public async Task GetAll_OtherDriver_SeesOnlyTheirOwnBookings_IncludingCancelled()
    {
        var x = Setup();

        var result = await ControllerFor(x.Db, x.PriyaId, "Driver").GetAll();

        Assert.Equal(new[] { "C", "B" }, Purposes(result));
    }

    [Fact]
    public async Task GetAll_DriverWithNoBookings_GetsAnEmptyList()
    {
        var x = Setup();

        var result = await ControllerFor(x.Db, x.ZedId, "Driver").GetAll();

        Assert.Empty(List(result));
    }

    [Fact]
    public async Task GetAll_WithoutAUserId_ReturnsUnauthorized()
    {
        var x = Setup();

        var result = await ControllerFor(x.Db, null, "Driver").GetAll();

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    // ---------- cancel ----------

    [Fact]
    public async Task Cancel_OwnBooking_ReturnsNoContent_AndKeepsTheRow()
    {
        var x = Setup();

        var result = await ControllerFor(x.Db, x.DanId, "Driver").Cancel(x.A);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(BookingStatus.Cancelled, x.Db.Bookings.Single(b => b.Id == x.A).Status);
        Assert.Equal(4, x.Db.Bookings.Count());
    }

    [Fact]
    public async Task Cancel_SomeoneElsesBooking_ReturnsNotFound_AndChangesNothing()
    {
        var x = Setup();

        var result = await ControllerFor(x.Db, x.DanId, "Driver").Cancel(x.C);

        Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(BookingStatus.Active, x.Db.Bookings.Single(b => b.Id == x.C).Status);
    }

    [Fact]
    public async Task Cancel_Manager_CanCancelAnyBooking()
    {
        var x = Setup();

        var result = await ControllerFor(x.Db, x.ManagerId, "Manager").Cancel(x.C);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(BookingStatus.Cancelled, x.Db.Bookings.Single(b => b.Id == x.C).Status);
    }

    [Fact]
    public async Task Cancel_UnknownBooking_ReturnsNotFound()
    {
        var x = Setup();

        var result = await ControllerFor(x.Db, x.ManagerId, "Manager").Cancel(999);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task Cancel_AlreadyCancelled_ReturnsConflict()
    {
        var x = Setup();

        var result = await ControllerFor(x.Db, x.PriyaId, "Driver").Cancel(x.B);

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task Cancel_FreesTheDatesForAnotherBooking()
    {
        var x = Setup();
        var request = new CreateBookingRequest
        {
            VehicleId = x.V1,
            StartDate = Today.AddDays(5),
            EndDate = Today.AddDays(9),
            Purpose = "Retry"
        };

        var before = await ControllerFor(x.Db, x.PriyaId, "Driver").Create(request);
        await ControllerFor(x.Db, x.DanId, "Driver").Cancel(x.A);
        var after = await ControllerFor(x.Db, x.PriyaId, "Driver").Create(request);

        Assert.IsType<ConflictObjectResult>(before.Result);
        Assert.IsType<CreatedResult>(after.Result);
    }

    [Fact]
    public async Task Cancel_WritesAnAuditLogEntry()
    {
        var x = Setup();

        await ControllerFor(x.Db, x.DanId, "Driver").Cancel(x.A);

        var log = Assert.Single(x.Db.AuditLogs);
        Assert.Equal("Cancelled", log.Action);
        Assert.Equal("Booking", log.Entity);
        Assert.Equal(x.DanId, log.UserId);
        Assert.Equal(x.A, log.EntityId);
    }
}
