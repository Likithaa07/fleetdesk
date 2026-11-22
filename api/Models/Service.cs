namespace FleetDesk.Api.Models;

public class Service
{
    public int Id { get; set; }
    public int VehicleId { get; set; }
    public DateOnly Date { get; set; }
    public int OdometerKm { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal Cost { get; set; }
    public string Notes { get; set; } = string.Empty;

    public Vehicle? Vehicle { get; set; }
}
