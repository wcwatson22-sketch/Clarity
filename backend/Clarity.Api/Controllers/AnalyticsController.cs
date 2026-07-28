using System.Security.Claims;
using Clarity.Api.Data;
using Clarity.Api.Models;
using Clarity.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/analytics")]
public class AnalyticsController(AppDbContext db, AnalyticsService analytics) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ── GET /api/analytics/compare ───────────────────────────────────────────
    // Returns this user's financial position compared to their age bracket.
    // No other user's individual data is ever exposed — only aggregates.
    [HttpGet("compare")]
    public async Task<IActionResult> Compare()
    {
        var user = await db.Users.FindAsync(UserId);
        if (user is null) return Unauthorized();

        // Build this user's financial data snapshot
        var allData = await analytics.GetAllUserFinancialDataAsync();
        var myData = allData.FirstOrDefault(d => d.UserId == UserId);
        if (myData is null)
            return Ok(new UserComparisonResponse(
                AgeBracket: AnalyticsService.GetAgeBracket(user.Age),
                HasEnoughData: false,
                Message: "Comparison data will unlock once enough anonymous user data is available.",
                Comparisons: []));

        var bracketStats = await analytics.GetBracketStatsForAgeAsync(user.Age);
        var usingAllUsersFallback = false;

        // If the user's own age bracket doesn't have 30 people yet, fall back to
        // comparing against all users once the site overall has 30 — keeps Compare
        // functional early on instead of waiting for every bracket to fill up.
        if (bracketStats is null || !bracketStats.HasEnoughData)
        {
            var allUsersStats = await analytics.GetAllUsersFallbackStatsAsync();
            if (allUsersStats is not null)
            {
                bracketStats = allUsersStats;
                usingAllUsersFallback = true;
            }
        }

        if (bracketStats is null || !bracketStats.HasEnoughData)
            return Ok(new UserComparisonResponse(
                AgeBracket: AnalyticsService.GetAgeBracket(user.Age),
                HasEnoughData: false,
                Message: "Comparison data will unlock once enough anonymous user data is available.",
                Comparisons: []));

        var comparison = analytics.GetUserComparison(myData, bracketStats);
        if (usingAllUsersFallback)
            comparison = comparison with
            {
                AgeBracket = AnalyticsService.GetAgeBracket(user.Age),
                Message = "Not enough users in your age bracket yet — compared to all Clarity users instead.",
            };
        return Ok(comparison);
    }

    // ── GET /api/analytics/global ────────────────────────────────────────────
    // Returns global averages across all users (min 30 required).
    // Only aggregate data is returned — never individual user records.
    [HttpGet("global")]
    public async Task<IActionResult> Global()
    {
        var (hasData, message, averages) = await analytics.GetGlobalStatsAsync();
        return Ok(new
        {
            hasEnoughData = hasData,
            message = hasData ? null : message,
            averages
        });
    }

    // ── GET /api/analytics/privacy ───────────────────────────────────────────
    // Returns the privacy disclaimer text for display in the app.
    [AllowAnonymous]
    [HttpGet("privacy")]
    public IActionResult Privacy() => Ok(new
    {
        disclaimer = "Clarity uses your financial inputs to help you track your own progress. " +
                     "We may also use anonymized, aggregated data to create average benchmarks " +
                     "and comparison tools. Your personal identity is never shown in benchmark data. " +
                     "All comparisons use only anonymous averages across groups of users."
    });
}
