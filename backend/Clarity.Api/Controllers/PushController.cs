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
[Route("api/push")]
public class PushController(AppDbContext db, IConfiguration config) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ── Get VAPID public key ──────────────────────────────────────────────────
    [HttpGet("vapid-public-key")]
    public IActionResult GetVapidPublicKey()
    {
        var key = config["Push:VapidPublicKey"];
        if (string.IsNullOrWhiteSpace(key))
            return Ok(new { key = (string?)null });
        return Ok(new { key });
    }

    // ── Subscribe ─────────────────────────────────────────────────────────────
    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscribeRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Endpoint) ||
            string.IsNullOrWhiteSpace(req.P256dh) ||
            string.IsNullOrWhiteSpace(req.Auth))
            return BadRequest(new { error = "Invalid subscription data." });

        // Upsert — update if endpoint already exists, otherwise insert
        var existing = await db.PushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == req.Endpoint);

        if (existing is not null)
        {
            existing.P256dh = req.P256dh;
            existing.Auth   = req.Auth;
            existing.UserId = UserId;
        }
        else
        {
            db.PushSubscriptions.Add(new UserPushSubscription
            {
                UserId   = UserId,
                Endpoint = req.Endpoint,
                P256dh   = req.P256dh,
                Auth     = req.Auth,
            });
        }

        await db.SaveChangesAsync();
        return Ok(new { message = "Subscribed successfully." });
    }

    // ── Unsubscribe ───────────────────────────────────────────────────────────
    [HttpDelete("subscribe")]
    public async Task<IActionResult> Unsubscribe([FromBody] PushSubscribeRequest req)
    {
        var sub = await db.PushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == req.Endpoint && s.UserId == UserId);

        if (sub is not null)
        {
            db.PushSubscriptions.Remove(sub);
            await db.SaveChangesAsync();
        }

        return Ok(new { message = "Unsubscribed." });
    }

    // ── Check subscription status ─────────────────────────────────────────────
    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var count = await db.PushSubscriptions.CountAsync(s => s.UserId == UserId);
        return Ok(new { subscribed = count > 0 });
    }
}
