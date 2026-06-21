using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Clarity.Api.Data;
using Clarity.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

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
    private const string Origin = "https://clarityfinancialtools.com";

    private static readonly string[] AllowedTypes =
        ["Question", "Topic Suggestion", "Comment", "Correction", "Other"];

    // ── Public article reads (published only; no auth) ──────────────────────────

    // GET /api/learn/articles — lightweight list for the public hub.
    [HttpGet("articles")]
    public async Task<IActionResult> GetArticles()
    {
        var list = await db.LearnArticles
            .Where(a => a.IsPublished)
            .OrderBy(a => a.SortOrder).ThenByDescending(a => a.PublishedAt)
            .Select(a => new
            {
                a.Slug, a.Title, a.Summary, a.Category, a.IsFeatured,
                a.ReadingTimeMinutes, a.FeaturedImageUrl,
            })
            .ToListAsync();
        return Ok(list);
    }

    // GET /api/learn/articles/{slug} — full published article.
    [HttpGet("articles/{slug}")]
    public async Task<IActionResult> GetArticle(string slug)
    {
        var a = await db.LearnArticles.FirstOrDefaultAsync(x => x.Slug == slug && x.IsPublished);
        if (a is null) return NotFound(new { error = "Article not found." });
        return Ok(ToPublicDto(a));
    }

    // GET /api/learn/sitemap.xml — dynamic sitemap so publish/unpublish takes
    // effect with no redeploy. Includes the static marketing routes + every
    // published article. Caddy maps /sitemap.xml to this.
    [HttpGet("sitemap.xml")]
    [Produces("application/xml")]
    public async Task<IActionResult> Sitemap()
    {
        var articles = await db.LearnArticles
            .Where(a => a.IsPublished)
            .Select(a => new { a.Slug, a.UpdatedAt })
            .ToListAsync();

        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var sb = new StringBuilder();
        sb.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        sb.AppendLine("""<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">""");
        void Url(string loc, string lastmod, string freq, string pri)
        {
            sb.AppendLine("  <url>");
            sb.AppendLine($"    <loc>{Origin}{loc}</loc>");
            sb.AppendLine($"    <lastmod>{lastmod}</lastmod>");
            sb.AppendLine($"    <changefreq>{freq}</changefreq>");
            sb.AppendLine($"    <priority>{pri}</priority>");
            sb.AppendLine("  </url>");
        }
        Url("/", today, "weekly", "1.0");
        Url("/features", today, "monthly", "0.8");
        Url("/pricing", today, "monthly", "0.8");
        Url("/learn", today, "weekly", "0.9");
        Url("/about", today, "monthly", "0.5");
        foreach (var a in articles)
            Url("/learn/" + a.Slug, a.UpdatedAt.ToString("yyyy-MM-dd"), "monthly", "0.7");
        sb.AppendLine("</urlset>");
        return Content(sb.ToString(), "application/xml", Encoding.UTF8);
    }

    internal static object ToPublicDto(Models.LearnArticle a) => new
    {
        a.Slug, a.Title, a.Summary, a.Category, a.Content,
        a.FeaturedImageUrl, a.SeoTitle, a.MetaDescription,
        a.DisclaimerType, a.IsFeatured, a.ReadingTimeMinutes, a.AuthorName,
        RelatedArticleIds = ParseSlugs(a.RelatedArticleIds),
        PublishedAt = a.PublishedAt, a.UpdatedAt,
    };

    internal static string[] ParseSlugs(string json)
    {
        try { return JsonSerializer.Deserialize<string[]>(json) ?? []; }
        catch { return []; }
    }

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
