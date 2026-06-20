using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Clarity.Api.Data;
using Clarity.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Clarity.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SupportController(
    EmailService email,
    AppDbContext db,
    IConfiguration config,
    ILogger<SupportController> logger) : ControllerBase
{
    // POST /api/support/message
    // Authenticated users only — sends message to configured support inbox.
    // No financial data is collected; only the user's typed message + identity.
    [HttpPost("message")]
    [EnableRateLimiting("auth")]   // reuse the 10-req/min auth limiter — spammers get 429
    public async Task<IActionResult> SendMessage([FromBody] SupportMessageRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Message))
            return BadRequest(new { error = "Message cannot be empty." });

        if (req.Message.Length > 2000)
            return BadRequest(new { error = "Message is too long. Please keep it under 2,000 characters." });

        // Load the logged-in user for identity context
        var rawId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Models.User? user = null;
        if (int.TryParse(rawId, out var uid))
            user = await db.Users.FindAsync(uid);

        var supportEmail = config["Support:Email"]
                        ?? config["Admin:NotifyEmail"]
                        ?? "clarityfinancialtools@gmail.com";

        // Reply-To = the user's account email (validated) so replies reach them;
        // the From header stays the authenticated Clarity sending address.
        var replyTo = !string.IsNullOrWhiteSpace(user?.Email)
                      && new EmailAddressAttribute().IsValid(user!.Email)
            ? user.Email
            : null;

        var sent = await email.SendSupportMessageAsync(
            toEmail:   supportEmail,
            message:   req.Message.Trim(),
            userName:  string.IsNullOrWhiteSpace(user?.FirstName) ? (user?.Username ?? "Unknown") : user.FirstName,
            userEmail: user?.Email ?? "Unknown",
            userId:    user?.Id.ToString() ?? rawId ?? "Unknown",
            timestamp: DateTime.UtcNow,
            replyTo:   replyTo
        );

        if (!sent)
        {
            logger.LogError("[Support] Failed to send support message — userId={UserId}", user?.Id);
            return StatusCode(500, new { error = "Failed to send your message. Please try again." });
        }

        logger.LogInformation("[Support] Support message sent — userId={UserId}", user?.Id);
        return Ok(new { success = true });
    }
}

public record SupportMessageRequest(
    [Required][MaxLength(2000)] string Message
);
