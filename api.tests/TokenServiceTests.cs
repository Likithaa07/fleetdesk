using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FleetDesk.Api.Models;
using FleetDesk.Api.Services;
using Microsoft.Extensions.Configuration;

namespace FleetDesk.Api.Tests;

public class TokenServiceTests
{
    // Fake key for tests only. HS256 needs at least 32 bytes.
    private const string TestKey = "unit-test-signing-key-that-is-at-least-32-bytes-long!";

    private static TokenService CreateService(string? key = TestKey, string expiryMinutes = "30")
    {
        var settings = new Dictionary<string, string?>
        {
            ["Jwt:Issuer"] = "FleetDesk",
            ["Jwt:Audience"] = "FleetDeskUsers",
            ["Jwt:ExpiryMinutes"] = expiryMinutes,
            ["Jwt:Key"] = key
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        return new TokenService(config);
    }

    private static User CreateUser(UserRole role) => new()
    {
        Id = 7,
        Name = "Test User",
        Email = "test@fleetdesk.test",
        PasswordHash = "not-used",
        Role = role
    };

    private static string? GetClaim(JwtSecurityToken token, string longType, string shortType) =>
        token.Claims.FirstOrDefault(c => c.Type == longType || c.Type == shortType)?.Value;

    [Theory]
    [InlineData(UserRole.Manager, "Manager")]
    [InlineData(UserRole.Driver, "Driver")]
    public void CreateToken_ContainsTheUsersRole(UserRole role, string expected)
    {
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(CreateService().CreateToken(CreateUser(role)));

        Assert.Equal(expected, GetClaim(jwt, ClaimTypes.Role, "role"));
    }

    [Fact]
    public void CreateToken_ContainsIdNameAndEmail()
    {
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(CreateService().CreateToken(CreateUser(UserRole.Driver)));

        Assert.Equal("7", GetClaim(jwt, ClaimTypes.NameIdentifier, "nameid"));
        Assert.Equal("Test User", GetClaim(jwt, ClaimTypes.Name, "unique_name"));
        Assert.Equal("test@fleetdesk.test", GetClaim(jwt, ClaimTypes.Email, "email"));
    }

    [Fact]
    public void CreateToken_UsesConfiguredIssuerAndAudience()
    {
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(CreateService().CreateToken(CreateUser(UserRole.Driver)));

        Assert.Equal("FleetDesk", jwt.Issuer);
        Assert.Contains("FleetDeskUsers", jwt.Audiences);
    }

    [Fact]
    public void CreateToken_ExpiresAfterTheConfiguredMinutes()
    {
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(
            CreateService(expiryMinutes: "30").CreateToken(CreateUser(UserRole.Driver)));

        var minutesLeft = (jwt.ValidTo - DateTime.UtcNow).TotalMinutes;

        Assert.InRange(minutesLeft, 28, 30);
    }

    [Fact]
    public void CreateToken_WithoutASigningKey_Throws()
    {
        var service = CreateService(key: null);

        Assert.Throws<InvalidOperationException>(() => service.CreateToken(CreateUser(UserRole.Driver)));
    }
}
