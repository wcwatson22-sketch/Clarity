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

        // Snapshots are part of the Free plan — no per-tier limit.
        snapshot.Id = Guid.NewGuid().ToString();
        snapshot.UserId = UserId;
        snapshot.CreatedAt = DateTime.UtcNow;
        // The user's very first snapshot is their starting baseline — movement is
        // measured from here, never from zero.
        var hasAny = await db.Snapshots.AnyAsync(s => s.UserId == UserId);
        snapshot.IsInitialBaseline = !hasAny;
        db.Snapshots.Add(snapshot);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), snapshot);
    }
}
