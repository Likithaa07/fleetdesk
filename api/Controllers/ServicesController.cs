using System.Security.Claims;
using FleetDesk.Api.Data;
using FleetDesk.Api.Dtos;
using FleetDesk.Api.Models;
using FleetDesk.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetDesk.Api.Controllers;

[ApiController]
[Route("api/vehicles/{vehicleId:int}/services")]
[Authorize(Roles = "Manager")]
public class ServicesController : ControllerBase
{
    private readonly FleetDeskDbContext _db;
    private readonly TimeProvider _time;

    public ServicesController(FleetDeskDbContext db, TimeProvider time)
    {
        _db = db;
        _time = time;
    }

    // POST /api/vehicles/5/services (Manager only)
    [HttpPost]
    public async Task<ActionResult<LogServiceResult>> Log(int vehicleId, LogServiceRequest request)
    {
        var today = DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);

        var error = Validate(request, today);
        if (error is not null)
        {
            return BadRequest(new { message = error });
        }

        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == vehicleId);
        if (vehicle is null)
        {
            return NotFound(new { message = $"Vehicle {vehicleId} not found." });
        }

        var service = new Service
        {
            VehicleId = vehicle.Id,
            Date = request.Date,
            OdometerKm = request.OdometerKm,
            Type = request.Type.Trim(),
            Cost = request.Cost,
            Notes = request.Notes?.Trim() ?? string.Empty
        };
        _db.Services.Add(service);

        // BR4
        vehicle.NextServiceDue = ServiceRules.NextServiceDue(request.Date);
        await _db.SaveChangesAsync();

        int? userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : null;
        _db.AuditLogs.Add(new AuditLog { UserId = userId, Action = "Logged", Entity = "Service", EntityId = service.Id });
        await _db.SaveChangesAsync();

        return Created($"/api/vehicles/{vehicle.Id}", new LogServiceResult
        {
            Service = new ServiceHistoryDto
            {
                Id = service.Id,
                Date = service.Date,
                OdometerKm = service.OdometerKm,
                Type = service.Type,
                Cost = service.Cost,
                Notes = service.Notes
            },
            NextServiceDue = vehicle.NextServiceDue
        });
    }

    private static string? Validate(LogServiceRequest r, DateOnly today)
    {
        if (r.Date == default) return "Please give the service date.";

        // One day of grace so a date typed in a time zone ahead of UTC (like Sydney) is accepted.
        if (r.Date > today.AddDays(1)) return "The service date can't be in the future.";

        if (string.IsNullOrWhiteSpace(r.Type)) return "Please say what type of service it was.";
        if (r.Type.Trim().Length > 50) return "The service type must be 50 characters or fewer.";
        if (r.Cost < 0 || r.Cost > 1_000_000) return "The cost must be between 0 and 1,000,000.";
        if (r.OdometerKm < 0 || r.OdometerKm > 5_000_000) return "The odometer reading must be between 0 and 5,000,000 km.";
        if (r.Notes is not null && r.Notes.Trim().Length > 500) return "Notes must be 500 characters or fewer.";

        return null;
    }
}
