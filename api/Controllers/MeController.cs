using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FleetDesk.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class MeController : ControllerBase
{
    // Any logged-in user.
    [HttpGet("me")]
    public IActionResult Me()
    {
        return Ok(new
        {
            userId = User.FindFirstValue(ClaimTypes.NameIdentifier),
            name = User.FindFirstValue(ClaimTypes.Name),
            email = User.FindFirstValue(ClaimTypes.Email),
            role = User.FindFirstValue(ClaimTypes.Role)
        });
    }

    // Managers only. Drivers get 403.
    [HttpGet("manager-check")]
    [Authorize(Roles = "Manager")]
    public IActionResult ManagerCheck()
    {
        return Ok(new { message = "You are a manager." });
    }
}
