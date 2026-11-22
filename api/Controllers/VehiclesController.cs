using FleetDesk.Api.Data;
using FleetDesk.Api.Dtos;
using FleetDesk.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetDesk.Api.Controllers;

[ApiController]
[Route("api/vehicles")]
[Authorize]
public class VehiclesController : ControllerBase
{
    private readonly FleetDeskDbContext _db;

    public VehiclesController(FleetDeskDbContext db)
    {
        _db = db;
    }

    // GET /api/vehicles?status=Available&location=Sydney&search=toyota
    [HttpGet]
    public async Task<ActionResult<List<VehicleDto>>> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? location,
        [FromQuery] string? search)
    {
        var query = _db.Vehicles.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<VehicleStatus>(status, ignoreCase: true, out var parsed))
            {
                return BadRequest(new { message = $"Unknown status '{status}'. Use Available or InService." });
            }
            query = query.Where(v => v.Status == parsed);
        }

        if (!string.IsNullOrWhiteSpace(location))
        {
            var loc = location.Trim();
            query = query.Where(v => v.Location == loc);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(v =>
                v.Rego.Contains(term) || v.Make.Contains(term) || v.Model.Contains(term));
        }

        var vehicles = await query
            .OrderBy(v => v.Rego)
            .Select(v => new VehicleDto
            {
                Id = v.Id,
                Rego = v.Rego,
                Make = v.Make,
                Model = v.Model,
                Year = v.Year,
                Location = v.Location,
                Status = v.Status.ToString(),
                OdometerKm = v.OdometerKm,
                RegoExpiry = v.RegoExpiry,
                LeaseEnd = v.LeaseEnd,
                NextServiceDue = v.NextServiceDue
            })
            .ToListAsync();

        return vehicles;
    }
}
