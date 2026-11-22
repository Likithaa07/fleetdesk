using FleetDesk.Api.Data;
using FleetDesk.Api.Dtos;
using FleetDesk.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetDesk.Api.Controllers;

[ApiController]
[Route("api/fleet")]
[Authorize(Roles = "Manager")]
public class FleetController : ControllerBase
{
    private readonly FleetDeskDbContext _db;

    public FleetController(FleetDeskDbContext db)
    {
        _db = db;
    }

    // GET /api/fleet/summary (Manager only): counts by status for the dashboard.
    [HttpGet("summary")]
    public async Task<ActionResult<FleetSummaryDto>> Summary()
    {
        return new FleetSummaryDto
        {
            Total = await _db.Vehicles.CountAsync(),
            Available = await _db.Vehicles.CountAsync(v => v.Status == VehicleStatus.Available),
            InService = await _db.Vehicles.CountAsync(v => v.Status == VehicleStatus.InService)
        };
    }
}
