namespace FleetDesk.Api.Models;

public class Vehicle
{
    public int Id { get; set; }
    public string Rego { get; set; } = string.Empty;
    public string Make { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public int Year { get; set; }
    public string Location { get; set; } = string.Empty;
    public VehicleStatus Status { get; set; } = VehicleStatus.Available;
    public int OdometerKm { get; set; }
    public DateOnly RegoExpiry { get; set; }
    public DateOnly LeaseEnd { get; set; }
    public DateOnly NextServiceDue { get; set; }

    public List<Booking> Bookings { get; set; } = new();
    public List<Service> Services { get; set; } = new();
}
