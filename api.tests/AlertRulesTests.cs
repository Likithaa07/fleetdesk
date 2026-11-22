using FleetDesk.Api.Dtos;
using FleetDesk.Api.Models;
using FleetDesk.Api.Services;

namespace FleetDesk.Api.Tests;

public class AlertRulesTests
{
    // The tests pretend today is 23 Nov 2026.
    private static readonly DateOnly Today = new(2026, 11, 23);

    // A healthy vehicle by default: service, rego and lease are all far away.
    private static Vehicle V(string rego = "AAA111", int serviceDays = 100, int regoDays = 100, int leaseDays = 300) => new()
    {
        Id = 1,
        Rego = rego,
        Make = "Toyota",
        Model = "Camry",
        NextServiceDue = Today.AddDays(serviceDays),
        RegoExpiry = Today.AddDays(regoDays),
        LeaseEnd = Today.AddDays(leaseDays)
    };

    private static List<AlertDto> Build(params Vehicle[] vehicles) => AlertRules.Build(vehicles, Today);

    [Fact]
    public void HealthyVehicle_HasNoAlerts()
    {
        Assert.Empty(Build(V()));
    }

    [Fact]
    public void ServiceDueYesterday_IsOverdue()
    {
        var alert = Assert.Single(Build(V(serviceDays: -1)));

        Assert.Equal(AlertTypes.ServiceOverdue, alert.Type);
        Assert.Equal(-1, alert.DaysRemaining);
    }

    [Fact]
    public void ServiceDueToday_IsNotYetOverdue()
    {
        Assert.Empty(Build(V(serviceDays: 0)));
    }

    [Fact]
    public void RegoExpiringIn30Days_RaisesAnAlert()
    {
        var alert = Assert.Single(Build(V(regoDays: 30)));

        Assert.Equal(AlertTypes.RegoExpiring, alert.Type);
        Assert.Equal(30, alert.DaysRemaining);
    }

    [Fact]
    public void RegoExpiringIn31Days_RaisesNoAlert()
    {
        Assert.Empty(Build(V(regoDays: 31)));
    }

    [Fact]
    public void RegoExpiringToday_IsStillRegoExpiring_NotExpired()
    {
        var alert = Assert.Single(Build(V(regoDays: 0)));

        Assert.Equal(AlertTypes.RegoExpiring, alert.Type);
        Assert.Equal(0, alert.DaysRemaining);
    }

    [Fact]
    public void RegoExpiredYesterday_RaisesOneRegoExpiredAlert()
    {
        var alert = Assert.Single(Build(V(regoDays: -1)));

        Assert.Equal(AlertTypes.RegoExpired, alert.Type);
        Assert.Equal(-1, alert.DaysRemaining);
    }

    [Fact]
    public void LeaseEndingIn60Days_RaisesAnAlert()
    {
        var alert = Assert.Single(Build(V(leaseDays: 60)));

        Assert.Equal(AlertTypes.LeaseEnding, alert.Type);
        Assert.Equal(60, alert.DaysRemaining);
    }

    [Fact]
    public void LeaseEndingIn61Days_RaisesNoAlert()
    {
        Assert.Empty(Build(V(leaseDays: 61)));
    }

    [Fact]
    public void LeaseThatEndedYesterday_RaisesNoAlert()
    {
        Assert.Empty(Build(V(leaseDays: -1)));
    }

    [Fact]
    public void VehicleWithTwoProblems_GetsTwoAlerts()
    {
        var alerts = Build(V(serviceDays: -3, leaseDays: 10));

        Assert.Equal(new[] { AlertTypes.ServiceOverdue, AlertTypes.LeaseEnding }, alerts.Select(a => a.Type).ToArray());
    }

    [Fact]
    public void Alerts_AreSortedMostUrgentFirst()
    {
        var alerts = Build(
            V("AAA111", regoDays: 10),
            V("BBB222", serviceDays: -5),
            V("CCC333", leaseDays: 40));

        Assert.Equal(new[] { "BBB222", "AAA111", "CCC333" }, alerts.Select(a => a.Rego).ToArray());
    }

    [Fact]
    public void Messages_SayHowLongAgoOrHowSoon()
    {
        Assert.Equal("Service was due 5 day(s) ago.", Assert.Single(Build(V(serviceDays: -5))).Message);
        Assert.Equal("Rego expires today.", Assert.Single(Build(V(regoDays: 0))).Message);
        Assert.Equal("Lease ends in 12 day(s).", Assert.Single(Build(V(leaseDays: 12))).Message);
    }

    [Fact]
    public void Alert_CarriesTheVehicleDetailsAndDueDate()
    {
        var v = V("XYZ999", regoDays: 5);
        v.Id = 7;

        var alert = Assert.Single(Build(v));

        Assert.Equal(7, alert.VehicleId);
        Assert.Equal("XYZ999", alert.Rego);
        Assert.Equal("Toyota", alert.Make);
        Assert.Equal("Camry", alert.Model);
        Assert.Equal(Today.AddDays(5), alert.DueDate);
    }

    [Fact]
    public void EmptyFleet_HasNoAlerts()
    {
        Assert.Empty(Build());
    }
}
