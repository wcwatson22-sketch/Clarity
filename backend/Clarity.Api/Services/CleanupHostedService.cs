using Clarity.Api.Data;
using Clarity.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Services;

/// <summary>
/// Runs once per day.
/// - Sends a re-engagement email to active Premium subscribers inactive for 15+ days
///   (30-day cooldown).
/// No trial logic: the Free plan is indefinite, so there are no trial-expiry pushes,
/// no trial-ended emails, and no account lockout/deletion based on account age.
/// Admins and free users are never sent paid-user reminders.
/// </summary>
public class CleanupHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<CleanupHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Stagger the first run by a few seconds so the app fully starts first
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunCleanupAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[Cleanup] Unhandled error during cleanup run");
            }

            // Run again in 24 hours
            await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
        }
    }

    private async Task RunCleanupAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db    = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var email = scope.ServiceProvider.GetRequiredService<EmailService>();

        var now = DateTime.UtcNow;

        // ── Inactive paid-user email ────────────────────────────────────────────
        // Sent to paying subscribers who haven't been active for 15+ days.
        // Cooldown: at most once every 30 days per user.
        // Uses LastActiveAt if available, falls back to LastLoginAt, then CreatedAt.
        var thirtyDaysAgo  = now.AddDays(-30);
        var fifteenDaysAgo = now.AddDays(-15);

        var inactivePaidCandidates = await db.Users
            .Where(u => !u.IsAdmin
                     && (u.StripeSubscriptionId != null || u.AppleOriginalTransactionId != null)
                     && (u.InactiveEmailLastSentAt == null || u.InactiveEmailLastSentAt < thirtyDaysAgo))
            .ToListAsync(ct);

        int inactiveSent = 0;
        foreach (var user in inactivePaidCandidates)
        {
            // Resolve the best available activity timestamp
            var effectiveLastActive = user.LastActiveAt ?? user.LastLoginAt ?? user.CreatedAt;
            if (effectiveLastActive >= fifteenDaysAgo) continue;  // still active

            var ok = await email.SendInactivePaidUserAsync(user.Email, user.FirstName);
            if (ok)
            {
                user.InactiveEmailLastSentAt = now;
                inactiveSent++;
                logger.LogInformation("[Cleanup] Inactive-paid email sent to user #{Id} (last active {LastActive:yyyy-MM-dd})",
                    user.Id, effectiveLastActive);
            }
            else
            {
                logger.LogWarning("[Cleanup] Inactive-paid email FAILED for user #{Id}", user.Id);
            }
        }

        if (inactiveSent > 0)
            await db.SaveChangesAsync(ct);

        logger.LogInformation("[Cleanup] Lifecycle emails — inactive-paid: {Inactive}", inactiveSent);
    }
}
