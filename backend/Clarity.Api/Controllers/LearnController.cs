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
[AllowAnonymous]   // public Learn is reachable without an account
public class LearnController(
    EmailService email,
    AppDbContext db,
    IConfiguration config,
    ILogger<LearnController> logger) : ControllerBase
{
    private static readonly string[] AllowedTypes =
        ["Question", "Topic Suggestion", "Comment", "Correction", "Other"];

    // POST /api/learn/submissions
    // Public visitors (and logged-in users) submit questions / topic suggestions /
    // comments / corrections. Routed to the configured support/content inbox.
    // No financial data is requested or stored. Submissions are NOT published —
    // they are emailed for manual review only.
    [HttpPost("submissions")]
    [EnableRateLimiting("learn")]   // 3/10min per IP (+ 10/24h per IP globally)
    public async Task<IActionResult> CreateSubmission([FromBody] LearnSubmissionRequest req)
    {
        // Honeypot: bots fill hidden fields. Pretend success, send nothing.
        if (!string.IsNullOrWhiteSpace(req.Website))
        {
            logger.LogInformation("[Learn] Honeypot triggered — dropping submission silently.");
            return Ok(new { success = true });
        }

        // ── Server-side validation ──────────────────────────────────────────
        var message = (req.Message ?? string.Empty).Trim();
        if (message.Length == 0)
            return BadRequest(new { error = "Please enter a message." });
        if (message.Length > 4000)
            return BadRequest(new { error = "Message is too long. Please keep it under 4,000 characters." });

        var type = (req.Type ?? string.Empty).Trim();
        if (!AllowedTypes.Contains(type))
            type = "Other";

        var name  = (req.Name ?? string.Empty).Trim();
        var emailAddr = (req.Email ?? string.Empty).Trim();
        if (name.Length > 120) name = name[..120];
        if (emailAddr.Length > 200) emailAddr = emailAddr[..200];
        // An invalid email must never break the submission — just ignore it (no
        // Reply-To). The frontend does friendly validation for the common case.
        if (emailAddr.Length > 0 && !new EmailAddressAttribute().IsValid(emailAddr))
            emailAddr = string.Empty;

        // Page/source is untrusted text — strip control chars and length-limit to 250.
        var page = new string((req.Page ?? string.Empty).Where(c => !char.IsControl(c)).ToArray()).Trim();
        if (page.Length > 250) page = page[..250];

        // ── Identity context for logged-in users (don't re-ask) ─────────────
        var rawId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        string userId = "Anonymous";
        if (int.TryParse(rawId, out var uid))
        {
            var user = await db.Users.FindAsync(uid);
            if (user is not null)
            {
                userId = user.Id.ToString();
                if (name.Length == 0)
                    name = string.IsNullOrWhiteSpace(user.FirstName) ? user.Username : user.FirstName;
                if (emailAddr.Length == 0)
                    emailAddr = user.Email ?? string.Empty;
            }
        }

        // Fallback chain: configured support inbox → admin notify → default gmail.
        var supportEmail = config["Support:Email"]
                        ?? config["Admin:NotifyEmail"]
                        ?? "clarityfinancialtools@gmail.com";

        // Reply-To = the visitor's (validated) email when present, so a reply goes
        // to them — the From stays the authenticated Clarity sending address.
        var replyTo = emailAddr.Length > 0 && new EmailAddressAttribute().IsValid(emailAddr)
            ? emailAddr
            : null;

        // Server-generated authoritative timestamp (frontend never supplies it).
        var sent = await email.SendLearnSubmissionAsync(
            toEmail:   supportEmail,
            type:      type,
            message:   message,
            name:      name.Length > 0 ? name : "(not provided)",
            emailAddr: emailAddr.Length > 0 ? emailAddr : "(not provided)",
            userId:    userId,
            page:      page.Length > 0 ? page : "(unknown)",
            timestamp: DateTime.UtcNow,
            replyTo:   replyTo
        );

        if (!sent)
        {
            // Generic logging — no message/name/email content.
            logger.LogError("[Learn] Failed to send Learn submission — type={Type} authed={Authed}", type, userId != "Anonymous");
            return StatusCode(500, new { error = "We couldn't send your submission. Please try again." });
        }

        logger.LogInformation("[Learn] Learn submission sent — type={Type} authed={Authed}", type, userId != "Anonymous");
        return Ok(new { success = true });
    }
}

public record LearnSubmissionRequest(
    string? Type,
    [Required][MaxLength(4000)] string? Message,
    string? Name,
    string? Email,
    string? Page,
    // Honeypot — must stay empty. Real users never see this field.
    string? Website
);
