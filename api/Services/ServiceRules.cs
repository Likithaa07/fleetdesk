namespace FleetDesk.Api.Services;

public static class ServiceRules
{
    // BR4: logging a service sets NextServiceDue to the service date plus 6 months.
    public static DateOnly NextServiceDue(DateOnly serviceDate) => serviceDate.AddMonths(6);
}
