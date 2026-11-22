using FleetDesk.Api.Controllers;
using FleetDesk.Api.Data;
using FleetDesk.Api.Dtos;
using FleetDesk.Api.Models;
using FleetDesk.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace FleetDesk.Api.Tests;

public class AlertsControllerTests
{
    private static readonly DateOnly Today = new(2026, 11, 23);

    private sealed class FixedTime : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(2026, 11, 23, 9, 0, 0, TimeSpan.Zero);
    }

    private static (AlertsController Controller, FleetDeskDbContext Db) Setup()
    {
        var options = new DbContextOptionsBuilder<FleetDeskDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new FleetDeskDbContext(options);
        return (new AlertsController(db, new FixedTime()), db);
    }

    private static Vehicle V(string rego, int serviceDays) => new()
    {
        Rego = rego,
        Make = "Ford",
        Model = "Ranger",
        Location = "Sydney",
        NextServiceDue = Today.AddDays(serviceDays),
        RegoExpiry = Today.AddDays(100),
        LeaseEnd = Today.AddDays(300)
    };

    [Fact]
    public async Task Get_ReturnsTodaysDateAndTheAlerts()
    {
        var (controller, db) = Setup();
        db.Vehicles.AddRange(V("OLD001", serviceDays: -15), V("OK0001", serviceDays: 90));
        db.SaveChanges();

        var result = await controller.Get();

        var response = Assert.IsType<AlertsResponse>(result.Value);
        Assert.Equal(Today, response.AsOf);
        var alert = Assert.Single(response.Alerts);
        Assert.Equal("OLD001", alert.Rego);
        Assert.Equal(AlertTypes.ServiceOverdue, alert.Type);
    }

    [Fact]
    public async Task Get_WithNoVehicles_ReturnsAnEmptyList()
    {
        var (controller, _) = Setup();

        var result = await controller.Get();

        var response = Assert.IsType<AlertsResponse>(result.Value);
        Assert.Empty(response.Alerts);
    }

    [Fact]
    public void AlertsController_IsRestrictedToManagers()
    {
        var attributes = typeof(AlertsController)
            .GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>();

        Assert.Contains(attributes, a => a.Roles == "Manager");
    }
}
