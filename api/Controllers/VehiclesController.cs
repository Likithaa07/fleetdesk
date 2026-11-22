using FleetDesk.Api.Data;
using FleetDesk.Api.Dtos;
using FleetDesk.Api.Models;
using System.Security.Claims;
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

    // GET /api/vehicles/5
    // Managers see every booking. Drivers only see their own bookings (BR6).
    [HttpGet("{id:int}")]
    public async Task<ActionResult<VehicleDetailsDto>> GetById(int id)
    {
        var vehicle = await _db.Vehicles.AsNoTracking().FirstOrDefaultAsync(v => v.Id == id);
        if (vehicle is null)
        {
            return NotFound(new { message = $"Vehicle {id} not found." });
        }

        var isManager = User.IsInRole("Manager");
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId);

        var bookingsQuery = _db.Bookings.AsNoTracking().Where(b => b.VehicleId == id);
        if (!isManager)
        {
            bookingsQuery = bookingsQuery.Where(b => b.UserId == userId);
        }

        var bookings = await bookingsQuery
            .OrderByDescending(b => b.StartDate)
            .Select(b => new BookingHistoryDto
            {
                Id = b.Id,
                StartDate = b.StartDate,
                EndDate = b.EndDate,
                Purpose = b.Purpose,
                Status = b.Status.ToString(),
                DriverName = b.User!.Name
            })
            .ToListAsync();

        var services = await _db.Services.AsNoTracking()
            .Where(s => s.VehicleId == id)
            .OrderByDescending(s => s.Date)
            .Select(s => new ServiceHistoryDto
            {
                Id = s.Id,
                Date = s.Date,
                OdometerKm = s.OdometerKm,
                Type = s.Type,
                Cost = s.Cost,
                Notes = s.Notes
            })
            .ToListAsync();

        return new VehicleDetailsDto
        {
            Id = vehicle.Id,
            Rego = vehicle.Rego,
            Make = vehicle.Make,
            Model = vehicle.Model,
            Year = vehicle.Year,
            Location = vehicle.Location,
            Status = vehicle.Status.ToString(),
            OdometerKm = vehicle.OdometerKm,
            RegoExpiry = vehicle.RegoExpiry,
            LeaseEnd = vehicle.LeaseEnd,
            NextServiceDue = vehicle.NextServiceDue,
            Bookings = bookings,
            Services = services
        };
    }
}
