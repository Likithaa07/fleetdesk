namespace FleetDesk.Api.Dtos;

public class LogServiceRequest
{
    public DateOnly Date { get; set; }
    public int OdometerKm { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal Cost { get; set; }
    public string? Notes { get; set; }
}

public class LogServiceResult
{
    public ServiceHistoryDto Service { get; set; } = new();
    public DateOnly NextServiceDue { get; set; }
}
