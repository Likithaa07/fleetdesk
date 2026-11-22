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
}
