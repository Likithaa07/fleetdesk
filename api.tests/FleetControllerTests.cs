using FleetDesk.Api.Controllers;
using FleetDesk.Api.Data;
using FleetDesk.Api.Dtos;
using FleetDesk.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace FleetDesk.Api.Tests;

public class FleetControllerTests
{
    private static FleetDeskDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<FleetDeskDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new FleetDeskDbContext(options);
    }

    private static Vehicle V(string rego, VehicleStatus status) => new()
    {
        Rego = rego,
        Make = "Toyota",
        Model = "Camry",
        Location = "Sydney",
        Status = status
    };

    [Fact]
    public async Task Summary_CountsVehiclesByStatus()
    {
        var db = NewDb();
        db.Vehicles.AddRange(
            V("A1", VehicleStatus.Available), V("A2", VehicleStatus.Available), V("A3", VehicleStatus.Available),
            V("S1", VehicleStatus.InService), V("S2", VehicleStatus.InService));
        db.SaveChanges();

        var result = await new FleetController(db).Summary();

        var summary = Assert.IsType<FleetSummaryDto>(result.Value);
        Assert.Equal(5, summary.Total);
        Assert.Equal(3, summary.Available);
        Assert.Equal(2, summary.InService);
    }

    [Fact]
    public async Task Summary_EmptyFleet_IsAllZero()
    {
        var result = await new FleetController(NewDb()).Summary();

        var summary = Assert.IsType<FleetSummaryDto>(result.Value);
        Assert.Equal(0, summary.Total);
        Assert.Equal(0, summary.Available);
        Assert.Equal(0, summary.InService);
    }

    [Fact]
    public void FleetController_IsRestrictedToManagers()
    {
        var attributes = typeof(FleetController)
            .GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>();

        Assert.Contains(attributes, a => a.Roles == "Manager");
    }
}
