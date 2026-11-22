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

public class VehicleWriteTests
{
    private static FleetDeskDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<FleetDeskDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new FleetDeskDbContext(options);
        db.Vehicles.AddRange(
            new Vehicle { Rego = "ABC123", Make = "Toyota", Model = "Camry", Year = 2022, Location = "Sydney" },
            new Vehicle { Rego = "DEF456", Make = "Mazda", Model = "CX-5", Year = 2021, Location = "Melbourne" });
        db.SaveChanges();
        return db;
    }

    private static VehiclesController ControllerFor(FleetDeskDbContext db, int userId = 1)
    {
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, "Manager")
        }, "TestAuth");

        return new VehiclesController(db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }

    private static VehicleRequest Req(string rego = "zzz999") => new()
    {
        Rego = rego,
        Make = "Tesla",
        Model = "Model 3",
        Year = 2024,
        Location = "Sydney",
        Status = "Available",
        OdometerKm = 1000,
        RegoExpiry = new DateOnly(2027, 6, 1),
        LeaseEnd = new DateOnly(2028, 6, 1),
        NextServiceDue = new DateOnly(2027, 5, 1)
    };

    [Fact]
    public async Task Create_Valid_ReturnsCreated_AndSavesRegoInUpperCase()
    {
        var db = NewDb();

        var result = await ControllerFor(db).Create(Req("zzz999"));

        Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(3, db.Vehicles.Count());
        Assert.Contains(db.Vehicles, v => v.Rego == "ZZZ999");
    }

    [Fact]
    public async Task Create_DuplicateRego_IgnoresCase_ReturnsConflict()
    {
        var db = NewDb();

        var result = await ControllerFor(db).Create(Req("abc123"));

        Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Equal(2, db.Vehicles.Count());
    }

    [Fact]
    public async Task Create_UnknownStatus_ReturnsBadRequest()
    {
        var db = NewDb();
        var req = Req();
        req.Status = "Banana";

        var result = await ControllerFor(db).Create(req);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(2, db.Vehicles.Count());
    }

    [Fact]
    public async Task Create_BlankMake_ReturnsBadRequest()
    {
        var db = NewDb();
        var req = Req();
        req.Make = "   ";

        var result = await ControllerFor(db).Create(req);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_MissingDate_ReturnsBadRequest()
    {
        var db = NewDb();
        var req = Req();
        req.RegoExpiry = default;

        var result = await ControllerFor(db).Create(req);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_WritesAnAuditLogEntry()
    {
        var db = NewDb();

        await ControllerFor(db, userId: 42).Create(Req());

        var log = Assert.Single(db.AuditLogs);
        Assert.Equal("Created", log.Action);
        Assert.Equal("Vehicle", log.Entity);
        Assert.Equal(42, log.UserId);
        Assert.Equal(db.Vehicles.Single(v => v.Rego == "ZZZ999").Id, log.EntityId);
    }

    [Fact]
    public async Task Update_ChangesTheVehicle_AndKeepingItsOwnRegoIsAllowed()
    {
        var db = NewDb();
        var id = db.Vehicles.Single(v => v.Rego == "ABC123").Id;
        var req = Req("ABC123");
        req.Location = "Perth";

        var result = await ControllerFor(db).Update(id, req);

        var dto = Assert.IsType<VehicleDto>(result.Value);
        Assert.Equal("Perth", dto.Location);
        Assert.Equal("Tesla", db.Vehicles.Single(v => v.Id == id).Make);
    }

    [Fact]
    public async Task Update_UnknownVehicle_ReturnsNotFound()
    {
        var db = NewDb();

        var result = await ControllerFor(db).Update(999, Req());

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task Update_RegoBelongingToAnotherVehicle_ReturnsConflict()
    {
        var db = NewDb();
        var id = db.Vehicles.Single(v => v.Rego == "ABC123").Id;

        var result = await ControllerFor(db).Update(id, Req("def456"));

        Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Equal("ABC123", db.Vehicles.Single(v => v.Id == id).Rego);
    }

    [Fact]
    public async Task Update_WritesAnAuditLogEntry()
    {
        var db = NewDb();
        var id = db.Vehicles.Single(v => v.Rego == "ABC123").Id;

        await ControllerFor(db, userId: 5).Update(id, Req("ABC123"));

        var log = Assert.Single(db.AuditLogs);
        Assert.Equal("Updated", log.Action);
        Assert.Equal(5, log.UserId);
        Assert.Equal(id, log.EntityId);
    }

    [Theory]
    [InlineData("Create")]
    [InlineData("Update")]
    public void WriteEndpoints_AreRestrictedToManagers(string method)
    {
        var attributes = typeof(VehiclesController).GetMethod(method)!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>();

        Assert.Contains(attributes, a => a.Roles == "Manager");
    }
}
