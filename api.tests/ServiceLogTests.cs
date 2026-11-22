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

public class ServiceLogTests
{
    private static readonly DateOnly Today = new(2026, 11, 23);
    private static readonly DateOnly V1Due = new(2027, 1, 1);
    private static readonly DateOnly V2Due = new(2027, 2, 2);

    private sealed class FixedTime : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(2026, 11, 23, 9, 0, 0, TimeSpan.Zero);
    }

    private record Ctx(ServicesController Controller, FleetDeskDbContext Db, int V1, int V2);

    private static Ctx Setup(int userId = 1)
    {
        var options = new DbContextOptionsBuilder<FleetDeskDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new FleetDeskDbContext(options);

        var v1 = new Vehicle { Rego = "AAA111", Make = "Toyota", Model = "Camry", Location = "Sydney", OdometerKm = 20000, NextServiceDue = V1Due };
        var v2 = new Vehicle { Rego = "BBB222", Make = "Mazda", Model = "CX-5", Location = "Sydney", OdometerKm = 30000, NextServiceDue = V2Due };
        db.Vehicles.AddRange(v1, v2);
        db.SaveChanges();

        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, "Manager")
        }, "TestAuth");

        var controller = new ServicesController(db, new FixedTime())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };

        return new Ctx(controller, db, v1.Id, v2.Id);
    }

    private static LogServiceRequest Req(DateOnly date, string type = "Logbook service", decimal cost = 450m, int odometer = 21000) => new()
    {
        Date = date,
        Type = type,
        Cost = cost,
        OdometerKm = odometer,
        Notes = "Oil and filter"
    };

    private static LogServiceResult Value(ActionResult<LogServiceResult> r)
    {
        var created = Assert.IsType<CreatedResult>(r.Result);
        return Assert.IsType<LogServiceResult>(created.Value);
    }

    [Fact]
    public async Task Log_Valid_SavesTheService()
    {
        var x = Setup();

        var result = await x.Controller.Log(x.V1, Req(Today.AddDays(-2)));

        Assert.IsType<CreatedResult>(result.Result);
        var saved = Assert.Single(x.Db.Services);
        Assert.Equal(x.V1, saved.VehicleId);
        Assert.Equal(Today.AddDays(-2), saved.Date);
        Assert.Equal(21000, saved.OdometerKm);
        Assert.Equal("Logbook service", saved.Type);
        Assert.Equal(450m, saved.Cost);
        Assert.Equal("Oil and filter", saved.Notes);
    }

    [Fact]
    public async Task Log_SetsNextServiceDueToSixMonthsAfterTheServiceDate()
    {
        var x = Setup();

        await x.Controller.Log(x.V1, Req(new DateOnly(2026, 11, 21)));

        Assert.Equal(new DateOnly(2027, 5, 21), x.Db.Vehicles.Single(v => v.Id == x.V1).NextServiceDue);
    }

    [Fact]
    public async Task Log_ReturnsTheNewNextServiceDue()
    {
        var x = Setup();

        var value = Value(await x.Controller.Log(x.V1, Req(new DateOnly(2026, 11, 21))));

        Assert.Equal(new DateOnly(2027, 5, 21), value.NextServiceDue);
        Assert.Equal("Logbook service", value.Service.Type);
    }

    [Fact]
    public async Task Log_ServiceDatedToday_IsAllowed()
    {
        var x = Setup();

        var result = await x.Controller.Log(x.V1, Req(Today));

        Assert.IsType<CreatedResult>(result.Result);
    }

    [Fact]
    public async Task Log_ServiceDatedTomorrow_IsAllowed_BecauseOfTimeZones()
    {
        var x = Setup();

        var result = await x.Controller.Log(x.V1, Req(Today.AddDays(1)));

        Assert.IsType<CreatedResult>(result.Result);
    }

    [Fact]
    public async Task Log_ServiceDatedTwoDaysAhead_ReturnsBadRequest_AndChangesNothing()
    {
        var x = Setup();

        var result = await x.Controller.Log(x.V1, Req(Today.AddDays(2)));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(x.Db.Services);
        Assert.Equal(V1Due, x.Db.Vehicles.Single(v => v.Id == x.V1).NextServiceDue);
    }

    [Fact]
    public async Task Log_MissingDate_ReturnsBadRequest()
    {
        var x = Setup();

        var result = await x.Controller.Log(x.V1, Req(default));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Log_BlankType_ReturnsBadRequest()
    {
        var x = Setup();

        var result = await x.Controller.Log(x.V1, Req(Today, type: "   "));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Log_NegativeCost_ReturnsBadRequest()
    {
        var x = Setup();

        var result = await x.Controller.Log(x.V1, Req(Today, cost: -1m));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Log_NegativeOdometer_ReturnsBadRequest()
    {
        var x = Setup();

        var result = await x.Controller.Log(x.V1, Req(Today, odometer: -5));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Log_UnknownVehicle_ReturnsNotFound()
    {
        var x = Setup();

        var result = await x.Controller.Log(999, Req(Today));

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task Log_WritesAnAuditLogEntry()
    {
        var x = Setup(userId: 8);

        await x.Controller.Log(x.V1, Req(Today));

        var log = Assert.Single(x.Db.AuditLogs);
        Assert.Equal("Logged", log.Action);
        Assert.Equal("Service", log.Entity);
        Assert.Equal(8, log.UserId);
        Assert.Equal(x.Db.Services.Single().Id, log.EntityId);
    }

    [Fact]
    public async Task Log_DoesNotTouchOtherVehicles()
    {
        var x = Setup();

        await x.Controller.Log(x.V1, Req(Today));

        Assert.Equal(V2Due, x.Db.Vehicles.Single(v => v.Id == x.V2).NextServiceDue);
    }

    [Fact]
    public async Task Log_TrimsTheServiceType()
    {
        var x = Setup();

        await x.Controller.Log(x.V1, Req(Today, type: "  Logbook service  "));

        Assert.Equal("Logbook service", x.Db.Services.Single().Type);
    }

    [Fact]
    public void ServicesController_IsRestrictedToManagers()
    {
        var attributes = typeof(ServicesController)
            .GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>();

        Assert.Contains(attributes, a => a.Roles == "Manager");
    }
}
