using System.Security.Claims;
using Clarity.Api.Data;
using Clarity.Api.Models;
using Clarity.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Controllers;

[Authorize(Policy = "AdminOnly")]
[ApiController]
[Route("api/admin")]
public class AdminController(AppDbContext db, AnalyticsService analytics) : ControllerBase
{
    // ── GET /api/admin/users ─────────────────────────────────────────────────
    // Returns all users as anonymized rows — no names, emails, usernames, or passwords.
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await db.Users.AsNoTracking().ToListAsync();
        var allData = await analytics.GetAllUserFinancialDataAsync();
        var dataByUser = allData.ToDictionary(d => d.UserId);

        var rows = users.Select(u =>
        {
            dataByUser.TryGetValue(u.Id, out var fd);
            return new AdminUserRow(
                AnonymousId: string.IsNullOrEmpty(u.AnonymousId) ? $"User {u.Id:D3}" : u.AnonymousId,
                AgeBracket: AnalyticsService.GetAgeBracket(u.Age),
                City: u.City,
                State: u.State,
                HasProfile: fd?.HasProfile ?? false,
                NetWorth: fd?.NetWorth,
                TotalAssets: fd?.TotalAssets,
                TotalLiabilities: fd?.TotalLiabilities,
                MonthlyIncome: fd?.MonthlyIncome,
                MonthlyExpenses: fd?.MonthlyExpenses,
                MonthlySavings: fd?.MonthlySavings,
                SavingsBalance: fd?.SavingsBalance,
                InvestmentsBalance: fd?.InvestmentsBalance,
                CreatedAt: u.CreatedAt,
                LastSnapshotAt: fd?.LastSnapshotAt
            );
        }).OrderBy(r => r.AnonymousId).ToList();

        return Ok(rows);
    }

    // ── GET /api/admin/stats ─────────────────────────────────────────────────
    // Returns total counts + aggregate averages (global and by age bracket).
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var totalUsers = await db.Users.CountAsync();
        var allData = await analytics.GetAllUserFinancialDataAsync();
        var usersWithProfiles = allData.Count(d => d.HasProfile);

        var (globalHasData, globalMsg, globalAvgs) = await analytics.GetGlobalStatsAsync();
        var brackets = await analytics.GetBracketStatsAsync();

        return Ok(new AdminStatsResponse(
            TotalUsers: totalUsers,
            UsersWithProfiles: usersWithProfiles,
            GlobalHasEnoughData: globalHasData,
            GlobalMessage: globalHasData ? string.Empty : globalMsg,
            GlobalAverages: globalAvgs,
            ByAgeBracket: brackets
        ));
    }

    // ── GET /api/admin/roster ────────────────────────────────────────────────
    // Returns full user roster with PII — admin eyes only.
    [HttpGet("roster")]
    public async Task<IActionResult> GetRoster()
    {
        var now = DateTime.UtcNow;
        var users = await db.Users
            .AsNoTracking()
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new
            {
                u.Id,
                u.Username,
                u.FirstName,
                u.Email,
                u.EmailVerified,
                u.State,
                u.City,
                u.Age,
                Tier = u.Tier.ToString(),
                u.IsAdmin,
                IsPaid      = u.StripeSubscriptionId != null,
                TrialActive = u.StripeSubscriptionId == null && u.TrialEndsAt > now,
                TrialEndsAt = u.TrialEndsAt.ToString("yyyy-MM-dd"),
                CreatedAt = u.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                AccountCount = u.Accounts.Count,
                SnapshotCount = u.Snapshots.Count,
            })
            .ToListAsync();

        var total   = users.Count;
        var onTrial = users.Count(u => u.TrialActive);
        var paid    = users.Count(u => u.IsPaid);
        var expired = users.Count(u => !u.IsPaid && !u.TrialActive);

        return Ok(new { summary = new { total, onTrial, paid, expired }, users });
    }

    // ── GET /api/admin/me ────────────────────────────────────────────────────
    // Verify admin access is working (useful for frontend health check).
    [HttpGet("me")]
    public IActionResult AdminMe()
    {
        var username = User.FindFirstValue(ClaimTypes.Name);
        return Ok(new { message = $"Admin access confirmed for {username}." });
    }

    // ── GET /api/admin/email-log ─────────────────────────────────────────────
    // Returns the last N email send records, newest first.
    [HttpGet("email-log")]
    public async Task<IActionResult> GetEmailLog([FromQuery] int limit = 200, [FromQuery] string? type = null)
    {
        var query = db.EmailLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(type))
            query = query.Where(e => e.EmailType == type);

        var logs = await query
            .OrderByDescending(e => e.SentAt)
            .Take(Math.Min(limit, 1000))
            .Select(e => new
            {
                e.Id,
                e.UserId,
                e.EmailType,
                e.RecipientEmail,
                e.Subject,
                e.SentAt,
                e.Success,
                e.ProviderMessageId,
                e.ErrorMessage,
            })
            .ToListAsync();

        var total    = await db.EmailLogs.CountAsync();
        var failures = await db.EmailLogs.CountAsync(e => !e.Success);

        return Ok(new { total, failures, logs });
    }

    // ── Lesson CRUD ──────────────────────────────────────────────────────────

    [HttpGet("lessons")]
    public async Task<IActionResult> GetLessons() =>
        Ok(await db.Lessons.OrderBy(l => l.Category).ThenBy(l => l.Title).ToListAsync());

    [HttpPost("lessons")]
    public async Task<IActionResult> CreateLesson([FromBody] Lesson lesson)
    {
        if (string.IsNullOrWhiteSpace(lesson.Id) || string.IsNullOrWhiteSpace(lesson.Title))
            return BadRequest(new { error = "Id and Title are required." });
        if (await db.Lessons.AnyAsync(l => l.Id == lesson.Id))
            return BadRequest(new { error = $"A lesson with Id '{lesson.Id}' already exists." });
        db.Lessons.Add(lesson);
        await db.SaveChangesAsync();
        return Ok(lesson);
    }

    [HttpPut("lessons/{id}")]
    public async Task<IActionResult> UpdateLesson(string id, [FromBody] Lesson updated)
    {
        var lesson = await db.Lessons.FindAsync(id);
        if (lesson is null) return NotFound(new { error = "Lesson not found." });
        lesson.Title       = updated.Title;
        lesson.Description = updated.Description;
        lesson.Category    = updated.Category;
        lesson.ReadTime    = updated.ReadTime;
        lesson.Content     = updated.Content;
        lesson.Example     = updated.Example;
        await db.SaveChangesAsync();
        return Ok(lesson);
    }

    [HttpDelete("lessons/{id}")]
    public async Task<IActionResult> DeleteLesson(string id)
    {
        var lesson = await db.Lessons.FindAsync(id);
        if (lesson is null) return NotFound(new { error = "Lesson not found." });
        db.Lessons.Remove(lesson);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
