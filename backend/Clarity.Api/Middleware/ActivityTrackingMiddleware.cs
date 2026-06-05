using System.Security.Claims;
using Clarity.Api.Data;

namespace Clarity.Api.Middleware;

/// <summary>
/// Updates <see cref="Clarity.Api.Models.User.LastActiveAt"/> after any authenticated
/// API request — fired as a background task so it adds zero latency to responses.
///
/// Uses a 1-hour debounce: if LastActiveAt was set within the last hour, the write
/// is skipped to avoid hammering the database on every request.
///
/// Auth endpoints and the Stripe webhook are excluded from activity tracking.
/// </summary>
public class ActivityTrackingMiddleware(RequestDelegate next, IServiceScopeFactory scopeFactory,
    ILogger<ActivityTrackingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        await next(context);   // Handle the request before touching activity

        // Only authenticated users
        if (context.User.Identity?.IsAuthenticated != true) return;

        // Skip: login/signup/token endpoints (they're not "activity" inside the app)
        var path = context.Request.Path.Value ?? "";
        if (path.StartsWith("/api/auth/", StringComparison.OrdinalIgnoreCase)) return;

        // Skip: Stripe webhook (server-to-server, no user activity)
        if (path.Contains("/webhook", StringComparison.OrdinalIgnoreCase)) return;

        // Skip: health checks
        if (path.StartsWith("/healthz", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/readyz",  StringComparison.OrdinalIgnoreCase)) return;

        var userIdStr = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out var userId)) return;

        // Fire-and-forget: never delay the response for activity tracking
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db  = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var now = DateTime.UtcNow;

                var user = await db.Users.FindAsync(userId);
                if (user is null) return;

                // 1-hour debounce — skip if already updated recently
                if (user.LastActiveAt.HasValue &&
                    (now - user.LastActiveAt.Value).TotalHours < 1) return;

                user.LastActiveAt = now;
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // Never surface activity-tracking failures to the caller
                logger.LogDebug(ex, "[Activity] Failed to update LastActiveAt for user #{Id}", userId);
            }
        });
    }
}
