using Clarity.Api.Data;
using Clarity.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Services.Reporting;

/// <summary>
/// Aggregated business metrics from Clarity's own database. Excludes admin
/// accounts and known test-account usernames from every count. Never selects
/// or returns individual financial fields (income, net worth, etc.) — only
/// counts and rates.
/// </summary>
public class DatabaseMetricsService(AppDbContext db, IConfiguration config)
{
    /// <summary>Comma-separated substrings (case-insensitive) that mark a username as
    /// a test/seed account, e.g. "test,demo,seed". Configurable via
    /// WEEKLY_REPORT_EXCLUDED_USERNAME_PATTERNS; defaults to a safe minimal set.</summary>
    private string[] ExcludedPatterns =>
        (config["WEEKLY_REPORT_EXCLUDED_USERNAME_PATTERNS"] ?? "test,demo,seed")
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private IQueryable<User> RealUsers()
    {
        var patterns = ExcludedPatterns;
        var q = db.Users.AsNoTracking().Where(u => !u.IsAdmin);
        foreach (var p in patterns)
        {
            var pattern = p; // avoid captured-variable pitfalls in the loop
            q = q.Where(u => !u.Username.ToLower().Contains(pattern.ToLower()));
        }
        return q;
    }

    public async Task<BusinessMetrics> GetWeeklyMetricsAsync(DateOnly currentStart, DateOnly currentEnd, DateOnly priorStart, DateOnly priorEnd)
    {
        var curFrom = currentStart.ToDateTime(TimeOnly.MinValue);
        var curTo = currentEnd.ToDateTime(TimeOnly.MaxValue);
        var priFrom = priorStart.ToDateTime(TimeOnly.MinValue);
        var priTo = priorEnd.ToDateTime(TimeOnly.MaxValue);

        var users = RealUsers();

        var newUsersCur = await users.CountAsync(u => u.CreatedAt >= curFrom && u.CreatedAt <= curTo);
        var newUsersPri = await users.CountAsync(u => u.CreatedAt >= priFrom && u.CreatedAt <= priTo);
        var totalUsersCur = await users.CountAsync(u => u.CreatedAt <= curTo);
        var totalUsersPri = await users.CountAsync(u => u.CreatedAt <= priTo);

        // "Active" = any authenticated request in the period (LastActiveAt is updated
        // at most once/hour on any authenticated call — see auth middleware).
        var activeCur = await users.CountAsync(u => u.LastActiveAt != null && u.LastActiveAt >= curFrom && u.LastActiveAt <= curTo);
        var activePri = await users.CountAsync(u => u.LastActiveAt != null && u.LastActiveAt >= priFrom && u.LastActiveAt <= priTo);

        var newPremiumCur = await users.CountAsync(u => u.CreatedAt >= curFrom && u.CreatedAt <= curTo && (u.StripeSubscriptionId != null || u.AppleOriginalTransactionId != null));
        var newPremiumPri = await users.CountAsync(u => u.CreatedAt >= priFrom && u.CreatedAt <= priTo && (u.StripeSubscriptionId != null || u.AppleOriginalTransactionId != null));
        var newFreeCur = newUsersCur - newPremiumCur;
        var newFreePri = newUsersPri - newPremiumPri;

        // "Active Premium Users" means currently has a paid subscription — it must
        // NOT also require LastActiveAt within the reporting window. A paying
        // subscriber who simply didn't open the app during a given 7-day window is
        // still a paying subscriber, and this metric feeds the CFO report's MRR
        // estimate directly; requiring recent app activity on top of an active
        // subscription silently undercounted real revenue (confirmed: a known
        // legacy $1/mo subscriber was being dropped from this count entirely).
        // Both counts use "as of curTo/priTo" since a subscription doesn't have a
        // period-start boundary the way a one-time event (signup, cancellation) does.
        var activePremiumCur = await users.CountAsync(u => u.CreatedAt <= curTo && (u.StripeSubscriptionId != null || u.AppleOriginalTransactionId != null));
        var activePremiumPri = await users.CountAsync(u => u.CreatedAt <= priTo && (u.StripeSubscriptionId != null || u.AppleOriginalTransactionId != null));

        // Cancellations: Clarity doesn't currently store a "cancelled at" timestamp
        // distinct from simply clearing the subscription id — this is a known gap,
        // reported as a missing tracked event rather than guessed at.
        var cancellations = 0;

        var conversionRate = totalUsersCur > 0
            ? Math.Round((decimal)await users.CountAsync(u => u.StripeSubscriptionId != null || u.AppleOriginalTransactionId != null) / totalUsersCur * 100, 2)
            : (decimal?)null;

        var completedSnapshotsCur = await db.Snapshots.AsNoTracking()
            .Where(s => s.CreatedAt >= curFrom && s.CreatedAt <= curTo)
            .Join(RealUsers(), s => s.UserId, u => u.Id, (s, u) => s)
            .CountAsync();

        return new BusinessMetrics
        {
            UserGrowth =
            [
                new MetricPoint("New Registered Users", newUsersCur, newUsersPri),
                new MetricPoint("Total Registered Users", totalUsersCur, totalUsersPri),
                new MetricPoint("Active Users", activeCur, activePri),
            ],
            SubscriptionGrowth =
            [
                new MetricPoint("New Free Users", newFreeCur, newFreePri),
                new MetricPoint("New Premium Users", newPremiumCur, newPremiumPri),
                new MetricPoint("Active Premium Users", activePremiumCur, activePremiumPri),
                new MetricPoint("Subscription Cancellations", cancellations, 0),
            ],
            FreeToPremiumConversionRatePct = conversionRate,
            // Household linking was never implemented (feature paused pre-launch) —
            // always 0 until that feature ships; not a bug in this report.
            LinkedHouseholds = 0,
            CompletedSnapshots = completedSnapshotsCur,
            // "Most-used major features" would require server-side feature-usage
            // tracking, which doesn't exist today (usage lives only in GA4 events
            // for Learn/calculator, and isn't tracked at all for the authenticated
            // app's own tabs). Left empty — see MissingTrackedEvents in the funnel.
            MostUsedFeatures = [],
        };
    }
}
