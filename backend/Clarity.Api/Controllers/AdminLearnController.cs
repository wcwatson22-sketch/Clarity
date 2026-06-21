using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using Clarity.Api.Data;
using Clarity.Api.Models;
using Clarity.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Controllers;

/// <summary>
/// Admin-only Learn article management. Every endpoint requires the AdminOnly
/// policy (JWT role=admin claim), enforced server-side — the frontend cannot
/// bypass it. All mutations are audit-logged.
/// </summary>
[ApiController]
[Route("api/admin/learn/articles")]
[Authorize(Policy = "AdminOnly")]
public partial class AdminLearnController(
    AppDbContext db,
    ILogger<AdminLearnController> logger) : ControllerBase
{
    private static readonly string[] AllowedDisclaimers = ["none", "standard", "realestate", "retirement"];

    // GET /api/admin/learn/articles  (all, incl. drafts; supports filters)
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] string? category,
        [FromQuery] bool? featured, [FromQuery] string? q)
    {
        var query = db.LearnArticles.AsQueryable();
        if (status == "published")   query = query.Where(a => a.IsPublished);
        else if (status == "draft" || status == "unpublished") query = query.Where(a => !a.IsPublished);
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(a => a.Category == category);
        if (featured == true) query = query.Where(a => a.IsFeatured);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(a => a.Title.ToLower().Contains(term) || a.Slug.ToLower().Contains(term));
        }

        var rows = await query
            .OrderByDescending(a => a.UpdatedAt)
            .Select(a => new
            {
                a.Id, a.Title, a.Slug, a.Category, a.IsPublished, a.IsFeatured,
                a.PublishedAt, a.UpdatedAt, a.CreatedAt, a.DisclaimerType, a.ReadingTimeMinutes,
            })
            .ToListAsync();
        return Ok(rows);
    }

    // GET /api/admin/learn/articles/{id}  (full record for the editor)
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var a = await db.LearnArticles.FindAsync(id);
        if (a is null) return NotFound(new { error = "Article not found." });
        return Ok(ToAdminDto(a));
    }

    // POST /api/admin/learn/articles  (create draft by default)
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ArticleRequest req)
    {
        var err = Validate(req, out var slug);
        if (err is not null) return BadRequest(new { error = err });
        if (await db.LearnArticles.AnyAsync(a => a.Slug == slug))
            return Conflict(new { error = $"Slug '{slug}' is already in use." });

        var now = DateTime.UtcNow;
        var (uid, uname) = Actor();
        var a = new LearnArticle
        {
            Title = req.Title!.Trim(),
            Slug = slug,
            Summary = (req.Summary ?? "").Trim(),
            Category = (req.Category ?? "").Trim(),
            Content = HtmlSanitizer.Clean(req.Content),
            FeaturedImageUrl = (req.FeaturedImageUrl ?? "").Trim(),
            SeoTitle = (req.SeoTitle ?? "").Trim(),
            MetaDescription = (req.MetaDescription ?? "").Trim(),
            IsFeatured = req.IsFeatured ?? false,
            IsPublished = req.IsPublished ?? false,
            DisclaimerType = NormalizeDisclaimer(req.DisclaimerType),
            RelatedArticleIds = SerializeSlugs(req.RelatedArticleIds),
            SortOrder = req.SortOrder ?? 0,
            ReadingTimeMinutes = req.ReadingTimeMinutes ?? 3,
            AuthorName = string.IsNullOrWhiteSpace(req.AuthorName) ? "Clarity Financial Tools" : req.AuthorName!.Trim(),
            CreatedAt = now, UpdatedAt = now,
            CreatedByUserId = uid, UpdatedByUserId = uid,
            PublishedAt = (req.IsPublished ?? false) ? now : null,
        };
        db.LearnArticles.Add(a);
        await db.SaveChangesAsync();
        await Audit(uid, uname, "created", a);
        return Ok(ToAdminDto(a));
    }

    // PUT /api/admin/learn/articles/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] ArticleRequest req)
    {
        var a = await db.LearnArticles.FindAsync(id);
        if (a is null) return NotFound(new { error = "Article not found." });

        var err = Validate(req, out var slug);
        if (err is not null) return BadRequest(new { error = err });
        if (await db.LearnArticles.AnyAsync(x => x.Slug == slug && x.Id != id))
            return Conflict(new { error = $"Slug '{slug}' is already in use." });

        var (uid, uname) = Actor();
        a.Title = req.Title!.Trim();
        a.Slug = slug;
        a.Summary = (req.Summary ?? "").Trim();
        a.Category = (req.Category ?? "").Trim();
        a.Content = HtmlSanitizer.Clean(req.Content);
        a.FeaturedImageUrl = (req.FeaturedImageUrl ?? "").Trim();
        a.SeoTitle = (req.SeoTitle ?? "").Trim();
        a.MetaDescription = (req.MetaDescription ?? "").Trim();
        a.IsFeatured = req.IsFeatured ?? a.IsFeatured;
        a.DisclaimerType = NormalizeDisclaimer(req.DisclaimerType);
        a.RelatedArticleIds = SerializeSlugs(req.RelatedArticleIds);
        a.SortOrder = req.SortOrder ?? a.SortOrder;
        a.ReadingTimeMinutes = req.ReadingTimeMinutes ?? a.ReadingTimeMinutes;
        a.AuthorName = string.IsNullOrWhiteSpace(req.AuthorName) ? a.AuthorName : req.AuthorName!.Trim();
        // Publish state transitions are handled by the publish/unpublish endpoints,
        // but allow setting it here too (keeps PublishedAt coherent).
        if (req.IsPublished is bool wantPub && wantPub != a.IsPublished)
        {
            a.IsPublished = wantPub;
            if (wantPub && a.PublishedAt is null) a.PublishedAt = DateTime.UtcNow;
        }
        a.UpdatedAt = DateTime.UtcNow;
        a.UpdatedByUserId = uid;
        await db.SaveChangesAsync();
        await Audit(uid, uname, "edited", a);
        return Ok(ToAdminDto(a));
    }

    [HttpPost("{id:int}/publish")]
    public async Task<IActionResult> Publish(int id) => await SetPublished(id, true);

    [HttpPost("{id:int}/unpublish")]
    public async Task<IActionResult> Unpublish(int id) => await SetPublished(id, false);

    private async Task<IActionResult> SetPublished(int id, bool published)
    {
        var a = await db.LearnArticles.FindAsync(id);
        if (a is null) return NotFound(new { error = "Article not found." });
        var (uid, uname) = Actor();
        a.IsPublished = published;
        if (published && a.PublishedAt is null) a.PublishedAt = DateTime.UtcNow;
        a.UpdatedAt = DateTime.UtcNow;
        a.UpdatedByUserId = uid;
        await db.SaveChangesAsync();
        await Audit(uid, uname, published ? "published" : "unpublished", a);
        return Ok(ToAdminDto(a));
    }

    // DELETE /api/admin/learn/articles/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var a = await db.LearnArticles.FindAsync(id);
        if (a is null) return NotFound(new { error = "Article not found." });
        var (uid, uname) = Actor();
        // Audit BEFORE removal so the actor/slug/title are recorded even on delete.
        await Audit(uid, uname, "deleted", a);
        db.LearnArticles.Remove(a);
        await db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // GET /api/admin/learn/articles/audit  (recent admin activity)
    [HttpGet("audit")]
    public async Task<IActionResult> AuditTrail()
    {
        var rows = await db.AdminAuditLogs
            .OrderByDescending(x => x.CreatedAt).Take(100)
            .Select(x => new { x.Action, x.ActorUsername, x.EntitySlug, x.Detail, x.CreatedAt })
            .ToListAsync();
        return Ok(rows);
    }

    // ── helpers ─────────────────────────────────────────────────────────────
    private (int uid, string uname) Actor()
    {
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid);
        return (uid, User.FindFirstValue(ClaimTypes.Name) ?? "admin");
    }

    private async Task Audit(int uid, string uname, string action, LearnArticle a)
    {
        db.AdminAuditLogs.Add(new AdminAuditLog
        {
            ActorUserId = uid, ActorUsername = uname, Action = action,
            EntityId = a.Id, EntitySlug = a.Slug, Detail = a.Title, CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
        logger.LogInformation("[AdminLearn] {Action} article id={Id} slug={Slug} by={Actor}", action, a.Id, a.Slug, uname);
    }

    private static string? Validate(ArticleRequest req, out string slug)
    {
        slug = Slugify(req.Slug ?? req.Title ?? "");
        if (string.IsNullOrWhiteSpace(req.Title)) return "Title is required.";
        if (req.Title!.Length > 200) return "Title is too long.";
        if (string.IsNullOrWhiteSpace(slug)) return "A valid URL slug is required.";
        if (slug.Length > 120) return "Slug is too long.";
        if ((req.Summary ?? "").Length > 400) return "Summary is too long (max 400).";
        if ((req.Content ?? "").Length > 100_000) return "Content is too long.";
        return null;
    }

    private static string NormalizeDisclaimer(string? d) =>
        AllowedDisclaimers.Contains((d ?? "").Trim().ToLower()) ? (d!).Trim().ToLower() : "none";

    private static string SerializeSlugs(IEnumerable<string>? slugs) =>
        JsonSerializer.Serialize((slugs ?? []).Select(s => Slugify(s)).Where(s => s.Length > 0).Distinct());

    private static string Slugify(string input)
    {
        var s = (input ?? "").Trim().ToLowerInvariant();
        s = SlugInvalid().Replace(s, "-");
        s = SlugDashes().Replace(s, "-").Trim('-');
        return s;
    }

    private static object ToAdminDto(LearnArticle a) => new
    {
        a.Id, a.Title, a.Slug, a.Summary, a.Category, a.Content,
        a.FeaturedImageUrl, a.SeoTitle, a.MetaDescription,
        a.IsPublished, a.IsFeatured, a.DisclaimerType,
        RelatedArticleIds = LearnController.ParseSlugs(a.RelatedArticleIds),
        a.SortOrder, a.ReadingTimeMinutes, a.AuthorName,
        a.PublishedAt, a.CreatedAt, a.UpdatedAt,
    };

    [GeneratedRegex(@"[^a-z0-9]+")] private static partial Regex SlugInvalid();
    [GeneratedRegex(@"-+")]         private static partial Regex SlugDashes();
}

public record ArticleRequest(
    [Required][MaxLength(200)] string? Title,
    string? Slug,
    string? Summary,
    string? Category,
    string? Content,
    string? FeaturedImageUrl,
    string? SeoTitle,
    string? MetaDescription,
    bool? IsPublished,
    bool? IsFeatured,
    string? DisclaimerType,
    string[]? RelatedArticleIds,
    int? SortOrder,
    int? ReadingTimeMinutes,
    string? AuthorName
);
