using System.Security.Claims;
using Clarity.Api.Data;
using Clarity.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SnapshotsController(AppDbContext db) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private const int BaseMonthlyLimit = 4;

    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.Snapshots
            .Where(s => s.UserId == UserId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Snapshot snapshot)
    {
        var user = await db.Users.FindAsync(UserId);
        if (user is null) return Unauthorized();

        // Enforce monthly snapshot limit for Base tier
        if (user.Tier == UserTier.Base)
        {
            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var countThisMonth = await db.Snapshots
                .CountAsync(s => s.UserId == UserId && s.CreatedAt >= monthStart);

            if (countThisMonth >= BaseMonthlyLimit)
                return StatusCode(429, new
                {
                    error = $"Base plan allows {BaseMonthlyLimit} snapshots per month. Upgrade to Premium for unlimited snapshots.",
                    limitReached = true,
                    tier = "Base"
                });
        }

        snapshot.Id = Guid.NewGuid().ToString();
        snapshot.UserId = UserId;
        snapshot.CreatedAt = DateTime.UtcNow;
        db.Snapshots.Add(snapshot);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), snapshot);
    }
}
