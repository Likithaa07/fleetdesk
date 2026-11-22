using FleetDesk.Api.Dtos;
using FleetDesk.Api.Models;

namespace FleetDesk.Api.Services;

public static class AlertTypes
{
    public const string ServiceOverdue = "ServiceOverdue";
    public const string RegoExpired = "RegoExpired";
    public const string RegoExpiring = "RegoExpiring";
    public const string LeaseEnding = "LeaseEnding";
}

public static class AlertRules
{
    public const int RegoWarningDays = 30;
    public const int LeaseWarningDays = 60;

    // BR5: service overdue, rego expiring within 30 days, lease ending within 60 days.
    // An already-expired rego gets its own, more urgent alert type.
    public static List<AlertDto> Build(IEnumerable<Vehicle> vehicles, DateOnly today)
    {
        var alerts = new List<AlertDto>();

        foreach (var v in vehicles)
        {
            var service = v.NextServiceDue.DayNumber - today.DayNumber;
            if (service < 0)
            {
                alerts.Add(Make(v, AlertTypes.ServiceOverdue, v.NextServiceDue, service,
                    $"Service was due {-service} day(s) ago."));
            }

            var rego = v.RegoExpiry.DayNumber - today.DayNumber;
            if (rego < 0)
            {
                alerts.Add(Make(v, AlertTypes.RegoExpired, v.RegoExpiry, rego,
                    $"Rego expired {-rego} day(s) ago."));
            }
            else if (rego <= RegoWarningDays)
            {
                alerts.Add(Make(v, AlertTypes.RegoExpiring, v.RegoExpiry, rego,
                    rego == 0 ? "Rego expires today." : $"Rego expires in {rego} day(s)."));
            }

            var lease = v.LeaseEnd.DayNumber - today.DayNumber;
            if (lease >= 0 && lease <= LeaseWarningDays)
            {
                alerts.Add(Make(v, AlertTypes.LeaseEnding, v.LeaseEnd, lease,
                    lease == 0 ? "Lease ends today." : $"Lease ends in {lease} day(s)."));
            }
        }

        // Most urgent first: overdue items have negative days.
        return alerts
            .OrderBy(a => a.DaysRemaining)
            .ThenBy(a => a.Rego, StringComparer.Ordinal)
            .ThenBy(a => a.Type, StringComparer.Ordinal)
            .ToList();
    }

    private static AlertDto Make(Vehicle v, string type, DateOnly due, int days, string message) => new()
    {
        VehicleId = v.Id,
        Rego = v.Rego,
        Make = v.Make,
        Model = v.Model,
        Type = type,
        Message = message,
        DueDate = due,
        DaysRemaining = days
    };
}
