using System.ComponentModel.DataAnnotations;

namespace FleetDesk.Api.Dtos;

public class VehicleRequest
{
    [Required, StringLength(20)]
    public string Rego { get; set; } = string.Empty;

    [Required, StringLength(50)]
    public string Make { get; set; } = string.Empty;

    [Required, StringLength(50)]
    public string Model { get; set; } = string.Empty;

    [Range(1990, 2100)]
    public int Year { get; set; }

    [Required, StringLength(100)]
    public string Location { get; set; } = string.Empty;

    public string Status { get; set; } = "Available";

    [Range(0, 5000000)]
    public int OdometerKm { get; set; }

    public DateOnly RegoExpiry { get; set; }
    public DateOnly LeaseEnd { get; set; }
    public DateOnly NextServiceDue { get; set; }
}
