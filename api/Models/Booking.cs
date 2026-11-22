namespace FleetDesk.Api.Models;

public class Booking
{
    public int Id { get; set; }
    public int VehicleId { get; set; }
    public int UserId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Purpose { get; set; } = string.Empty;
    public BookingStatus Status { get; set; } = BookingStatus.Active;

    public Vehicle? Vehicle { get; set; }
    public User? User { get; set; }
}
