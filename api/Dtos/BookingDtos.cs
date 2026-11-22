using System.ComponentModel.DataAnnotations;

namespace FleetDesk.Api.Dtos;

public class CreateBookingRequest
{
    public int VehicleId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    [Required, StringLength(200)]
    public string Purpose { get; set; } = string.Empty;
}

public class BookingDto
{
    public int Id { get; set; }
    public int VehicleId { get; set; }
    public string Rego { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Purpose { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}
