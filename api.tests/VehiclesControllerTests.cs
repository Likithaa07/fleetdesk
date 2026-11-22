using FleetDesk.Api.Controllers;
using FleetDesk.Api.Data;
using FleetDesk.Api.Dtos;
using FleetDesk.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetDesk.Api.Tests;

public class VehiclesControllerTests
{
    private static Vehicle V(string rego, string make, string model, string location, VehicleStatus status) => new()
    {
        Rego = rego,
        Make = make,
        Model = model,
        Location = location,
        Status = status,
        Year = 2022
    };

    // A fresh, empty in-memory database for every test. Vehicles are added out of order on purpose.
    private static VehiclesController CreateController()
    {
        var options = new DbContextOptionsBuilder<FleetDeskDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new FleetDeskDbContext(options);

        db.Vehicles.AddRange(
            V("GHI789", "Hyundai", "i30", "Sydney", VehicleStatus.Available),
            V("ABC123", "Toyota", "Camry", "Sydney", VehicleStatus.Available),
            V("PQR678", "Subaru", "Outback", "Melbourne", VehicleStatus.Available),
            V("DEF456", "Mazda", "CX-5", "Melbourne", VehicleStatus.InService),
            V("MNO345", "Kia", "Cerato", "Sydney", VehicleStatus.Available),
            V("JKL012", "Ford", "Ranger", "Brisbane", VehicleStatus.Available));
        db.SaveChanges();

        return new VehiclesController(db);
    }

    private static string[] Regos(ActionResult<List<VehicleDto>> result)
    {
        var list = Assert.IsType<List<VehicleDto>>(result.Value);
        return list.Select(v => v.Rego).ToArray();
    }

    [Fact]
    public async Task GetAll_NoFilters_ReturnsEveryVehicleSortedByRego()
    {
        var result = await CreateController().GetAll(null, null, null);

        Assert.Equal(new[] { "ABC123", "DEF456", "GHI789", "JKL012", "MNO345", "PQR678" }, Regos(result));
    }

    [Fact]
    public async Task GetAll_FilterByStatus_ReturnsOnlyThatStatus()
    {
        var result = await CreateController().GetAll("InService", null, null);

        Assert.Equal(new[] { "DEF456" }, Regos(result));
    }

    [Fact]
    public async Task GetAll_StatusFilter_IgnoresCase()
    {
        var result = await CreateController().GetAll("inservice", null, null);

        Assert.Equal(new[] { "DEF456" }, Regos(result));
    }

    [Fact]
    public async Task GetAll_UnknownStatus_ReturnsBadRequest()
    {
        var result = await CreateController().GetAll("Banana", null, null);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetAll_FilterByLocation_ReturnsOnlyThatLocation()
    {
        var result = await CreateController().GetAll(null, "Sydney", null);

        Assert.Equal(new[] { "ABC123", "GHI789", "MNO345" }, Regos(result));
    }

    [Theory]
    [InlineData("Toyota", "ABC123")]
    [InlineData("CX-5", "DEF456")]
    [InlineData("GHI", "GHI789")]
    [InlineData("Ranger", "JKL012")]
    public async Task GetAll_Search_MatchesRegoMakeOrModel(string term, string expectedRego)
    {
        var result = await CreateController().GetAll(null, null, term);

        Assert.Equal(new[] { expectedRego }, Regos(result));
    }

    [Fact]
    public async Task GetAll_CombinedFilters_MustAllMatch()
    {
        var result = await CreateController().GetAll("Available", "Melbourne", null);

        Assert.Equal(new[] { "PQR678" }, Regos(result));
    }

    [Fact]
    public async Task GetAll_NoMatches_ReturnsEmptyList()
    {
        var result = await CreateController().GetAll(null, "Perth", null);

        Assert.Empty(Regos(result));
    }

    [Fact]
    public async Task GetAll_BlankFilters_AreIgnored()
    {
        var result = await CreateController().GetAll("  ", "", " ");

        Assert.Equal(6, Regos(result).Length);
    }
}
