using Microsoft.AspNetCore.Mvc;

namespace Clarity.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StatusController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() =>
        Ok(new { message = "Hello from Clarity API", timestamp = DateTime.UtcNow });
}
