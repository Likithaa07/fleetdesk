using FleetDesk.Api.Data;
using FleetDesk.Api.Dtos;
using FleetDesk.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetDesk.Api.Controllers;

[ApiController]
[Route("api/alerts")]
[Authorize(Roles = "Manager")]
public class AlertsController : ControllerBase
{
    private readonly FleetDeskDbContext _db;
    private readonly TimeProvider _time;

    public AlertsController(FleetDeskDbContext db, TimeProvider time)
    {
        _db = db;
        _time = time;
    }

    // GET /api/alerts (Manager only)
    [HttpGet]
    public async Task<ActionResult<AlertsResponse>> Get()
    {
        var today = DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);
        var vehicles = await _db.Vehicles.AsNoTracking().ToListAsync();

        return new AlertsResponse { AsOf = today, Alerts = AlertRules.Build(vehicles, today) };
    }
}
