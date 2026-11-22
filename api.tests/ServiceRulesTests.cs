using FleetDesk.Api.Services;

namespace FleetDesk.Api.Tests;

public class ServiceRulesTests
{
    [Theory]
    [InlineData(2026, 6, 1, 2026, 12, 1)]
    [InlineData(2026, 8, 31, 2027, 2, 28)]  // month end is clamped
    [InlineData(2027, 8, 31, 2028, 2, 29)]  // leap year
    public void NextServiceDue_IsSixMonthsAfterTheServiceDate(int y, int m, int d, int ey, int em, int ed)
    {
        var result = ServiceRules.NextServiceDue(new DateOnly(y, m, d));

        Assert.Equal(new DateOnly(ey, em, ed), result);
    }
}
