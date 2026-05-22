using Clarity.Api.Data;
using Clarity.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Services;

/// <summary>
/// Runs once per day. Sends a 7-day warning email to unpaid users whose trial
/// has expired, then permanently deletes them 14 days after trial end.
/// Admins and paid users are never touched.
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
        var push  = scope.ServiceProvider.GetRequiredService<PushService>();

        var now = DateTime.UtcNow;

        // Send push notification to users whose trial expires in exactly 3 days
        var trialExpiringSoon = await db.Users
            .Where(u => !u.IsAdmin
                     && u.StripeSubscriptionId == null
                     && u.TrialEndsAt > now
                     && u.TrialEndsAt <= now.AddDays(3).AddHours(1))
            .ToListAsync(ct);

        foreach (var u in trialExpiringSoon)
        {
            var daysLeft = (int)Math.Ceiling((u.TrialEndsAt - now).TotalDays);
            _ = push.SendToUserAsync(u.Id,
                "Your trial is ending soon",
                $"You have {daysLeft} day{(daysLeft == 1 ? "" : "s")} left in your Clarity free trial. Choose a plan to keep access.",
                "/settings");
        }

        // Candidate users: unpaid, not admin, trial has ended
        var candidates = await db.Users
            .Where(u => !u.IsAdmin
                     && u.Tier == UserTier.Base
                     && u.TrialEndsAt < now)
            .ToListAsync(ct);

        int warned = 0, deleted = 0;

        foreach (var user in candidates)
        {
            var daysPastTrial = (now - user.TrialEndsAt).TotalDays;

            // ── DELETE: 14+ days past trial end ───────────────────────────────
            if (daysPastTrial >= 14)
            {
                logger.LogInformation("[Cleanup] Deleting inactive user #{Id} (trial ended {Days:F0} days ago)",
                    user.Id, daysPastTrial);

                // Send deletion confirmation email (best-effort)
                await email.SendAccountDeletedAsync(user.Email, user.FirstName);

                db.Users.Remove(user);
                deleted++;
                continue;
            }

            // ── WARN: 7–13 days past trial end, warning not yet sent ──────────
            if (daysPastTrial >= 7 && user.DeletionNoticeSentAt is null)
            {
                var deleteOn = user.TrialEndsAt.AddDays(14);
                logger.LogInformation("[Cleanup] Sending deletion warning to user #{Id} (deletes {DeleteOn:yyyy-MM-dd})",
                    user.Id, deleteOn);

                await email.SendDeletionWarningAsync(user.Email, user.FirstName, deleteOn);
                user.DeletionNoticeSentAt = now;
                warned++;
            }
        }

        if (warned > 0 || deleted > 0)
            await db.SaveChangesAsync(ct);

        logger.LogInformation("[Cleanup] Run complete — {Warned} warned, {Deleted} deleted", warned, deleted);
    }
}
