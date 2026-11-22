namespace FleetDesk.Api.Dtos;

public class BookingHistoryDto
{
    public int Id { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Purpose { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
}

public class ServiceHistoryDto
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }
    public int OdometerKm { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal Cost { get; set; }
    public string Notes { get; set; } = string.Empty;
}

public class VehicleDetailsDto : VehicleDto
{
    public List<BookingHistoryDto> Bookings { get; set; } = new();
    public List<ServiceHistoryDto> Services { get; set; } = new();
}
