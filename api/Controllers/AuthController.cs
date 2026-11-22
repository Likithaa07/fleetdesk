using FleetDesk.Api.Data;
using FleetDesk.Api.Dtos;
using FleetDesk.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetDesk.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly FleetDeskDbContext _db;
    private readonly ITokenService _tokens;

    public AuthController(FleetDeskDbContext db, ITokenService tokens)
    {
        _db = db;
        _tokens = tokens;
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Same message for an unknown email and a wrong password.
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        return new LoginResponse
        {
            Token = _tokens.CreateToken(user),
            UserId = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role.ToString()
        };
    }
}
