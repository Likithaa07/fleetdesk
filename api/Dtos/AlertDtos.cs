namespace FleetDesk.Api.Dtos;

public class AlertDto
{
    public int VehicleId { get; set; }
    public string Rego { get; set; } = string.Empty;
    public string Make { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateOnly DueDate { get; set; }
    public int DaysRemaining { get; set; }
}

public class AlertsResponse
{
    public DateOnly AsOf { get; set; }
    public List<AlertDto> Alerts { get; set; } = new();
}

public class FleetSummaryDto
{
    public int Total { get; set; }
    public int Available { get; set; }
    public int InService { get; set; }
}
