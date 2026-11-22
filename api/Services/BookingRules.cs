using FleetDesk.Api.Models;

namespace FleetDesk.Api.Services;

public static class BookingRules
{
    // BR3: end date after start date, and no bookings in the past.
    public static string? ValidateDates(DateOnly start, DateOnly end, DateOnly today)
    {
        if (end <= start) return "The end date must be after the start date.";
        if (start < today) return "Bookings can't start in the past.";
        return null;
    }

    // BR2: can't book a car that is in service or whose rego has expired.
    public static string? CheckVehicleAvailable(Vehicle vehicle, DateOnly today)
    {
        if (vehicle.Status == VehicleStatus.InService) return "This vehicle is in service and can't be booked.";
        if (vehicle.RegoExpiry < today) return "This vehicle's rego has expired and it can't be booked.";
        return null;
    }
}
