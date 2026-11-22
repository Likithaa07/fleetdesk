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
[Route("api/bookings")]
[Authorize]
public class BookingsController : ControllerBase
{
    private readonly FleetDeskDbContext _db;
    private readonly TimeProvider _time;

    public BookingsController(FleetDeskDbContext db, TimeProvider time)
    {
        _db = db;
        _time = time;
    }

    // POST /api/bookings
    [HttpPost]
    public async Task<ActionResult<BookingDto>> Create(CreateBookingRequest request)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Unauthorized();
        }

        var today = DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);

        var dateError = BookingRules.ValidateDates(request.StartDate, request.EndDate, today);
        if (dateError is not null)
        {
            return BadRequest(new { message = dateError });
        }

        if (string.IsNullOrWhiteSpace(request.Purpose))
        {
            return BadRequest(new { message = "Please say what the booking is for." });
        }

        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == request.VehicleId);
        if (vehicle is null)
        {
            return NotFound(new { message = $"Vehicle {request.VehicleId} not found." });
        }

        var availabilityError = BookingRules.CheckVehicleAvailable(vehicle, today);
        if (availabilityError is not null)
        {
            return Conflict(new { message = availabilityError });
        }

        // BR1: no overlapping dates. Both end dates count as booked days.
        var overlaps = await _db.Bookings.AnyAsync(b =>
            b.VehicleId == vehicle.Id &&
            b.Status == BookingStatus.Active &&
            b.StartDate <= request.EndDate &&
            request.StartDate <= b.EndDate);
        if (overlaps)
        {
            return Conflict(new { message = "This vehicle is already booked for some of those dates." });
        }

        var booking = new Booking
        {
            VehicleId = vehicle.Id,
            UserId = userId,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Purpose = request.Purpose.Trim(),
            Status = BookingStatus.Active
        };
        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync();

        _db.AuditLogs.Add(new AuditLog { UserId = userId, Action = "Created", Entity = "Booking", EntityId = booking.Id });
        await _db.SaveChangesAsync();

        return Created($"/api/bookings/{booking.Id}", new BookingDto
        {
            Id = booking.Id,
            VehicleId = vehicle.Id,
            Rego = vehicle.Rego,
            StartDate = booking.StartDate,
            EndDate = booking.EndDate,
            Purpose = booking.Purpose,
            Status = booking.Status.ToString()
        });
    }

    // GET /api/bookings
    // Drivers see only their own bookings (BR6). Managers see every booking.
    [HttpGet]
    public async Task<ActionResult<List<BookingDto>>> GetAll()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Unauthorized();
        }

        var query = _db.Bookings.AsNoTracking().AsQueryable();
        if (!User.IsInRole("Manager"))
        {
            query = query.Where(b => b.UserId == userId);
        }

        var bookings = await query
            .OrderByDescending(b => b.StartDate)
            .ThenBy(b => b.Id)
            .Select(b => new BookingDto
            {
                Id = b.Id,
                VehicleId = b.VehicleId,
                Rego = b.Vehicle!.Rego,
                DriverName = b.User!.Name,
                StartDate = b.StartDate,
                EndDate = b.EndDate,
                Purpose = b.Purpose,
                Status = b.Status.ToString()
            })
            .ToListAsync();

        return bookings;
    }

    // DELETE /api/bookings/5
    // Cancels the booking (the row is kept as a record). Drivers can only cancel their own;
    // someone else's booking returns 404 so its existence isn't revealed. Managers can cancel any.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Cancel(int id)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Unauthorized();
        }

        var booking = await _db.Bookings.FirstOrDefaultAsync(b => b.Id == id);
        if (booking is null || (!User.IsInRole("Manager") && booking.UserId != userId))
        {
            return NotFound(new { message = $"Booking {id} not found." });
        }

        if (booking.Status == BookingStatus.Cancelled)
        {
            return Conflict(new { message = "This booking is already cancelled." });
        }

        booking.Status = BookingStatus.Cancelled;
        await _db.SaveChangesAsync();

        _db.AuditLogs.Add(new AuditLog { UserId = userId, Action = "Cancelled", Entity = "Booking", EntityId = booking.Id });
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
