using System.Text.Json;
using Clarity.Api.Data;
using Clarity.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Services.Reporting;

/// <summary>
/// Composes the weekly report from all four sources, computes deterministic
/// commentary from real percentage changes, renders the HTML email, and
/// persists the result. Any single source failing does not block the others —
/// see BuildPayloadAsync.
/// </summary>
public class WeeklyReportOrchestratorService(
    AppDbContext db,
    Ga4ReportingService ga4,
    SearchConsoleReportingService searchConsole,
    AppStoreConnectReportingService appStore,
    DatabaseMetricsService dbMetrics,
    EmailService email,
    IConfiguration config,
    ILogger<WeeklyReportOrchestratorService> logger)
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    /// <summary>Most recent completed Mon-Sun week, in UTC calendar terms.
    /// "Completed" means the week has fully elapsed — never the in-progress week.</summary>
    public static (DateOnly start, DateOnly end) GetMostRecentCompletedWeek(DateTime nowUtc)
    {
        var today = DateOnly.FromDateTime(nowUtc);
        // Back up to the most recent Monday (start of the current, possibly-incomplete week).
        var daysSinceMonday = ((int)today.DayOfWeek + 6) % 7;
        var currentWeekStart = today.AddDays(-daysSinceMonday);
        var lastCompletedEnd = currentWeekStart.AddDays(-1);       // prior Sunday
        var lastCompletedStart = lastCompletedEnd.AddDays(-6);     // the Monday before that
        return (lastCompletedStart, lastCompletedEnd);
    }

    public async Task<WeeklyReport> RunAsync(bool triggeredManually, CancellationToken ct = default)
    {
        var (start, end) = GetMostRecentCompletedWeek(DateTime.UtcNow);
        var priorEnd = start.AddDays(-1);
        var priorStart = priorEnd.AddDays(-6);

        var report = new WeeklyReport
        {
            PeriodStart = start,
            PeriodEnd = end,
            Status = WeeklyReportStatus.Pending,
            TriggeredManually = triggeredManually,
        };
        db.WeeklyReports.Add(report);
        await db.SaveChangesAsync(ct);

        var payload = new WeeklyReportPayload { PeriodStart = start, PeriodEnd = end, PriorPeriodStart = priorStart, PriorPeriodEnd = priorEnd };

        // Each source is isolated — one failing never blocks the others.
        payload.Website = await SafeRunAsync(() => ga4.GetWeeklyMetricsAsync(start, end, priorStart, priorEnd), "Website (GA4)", payload.Errors);
        payload.Search = await SafeRunAsync(() => searchConsole.GetWeeklyMetricsAsync(start, end, priorStart, priorEnd), "Organic Search (Search Console)", payload.Errors);
        payload.AppStore = await SafeRunAsync(() => appStore.GetWeeklyMetricsAsync(start, end, priorStart, priorEnd), "App Store Connect", payload.Errors);
        try
        {
            payload.Business = await dbMetrics.GetWeeklyMetricsAsync(start, end, priorStart, priorEnd);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[WeeklyReport] Database metrics failed");
            payload.Errors.Add("Business metrics: database query failed");
        }

        BuildFunnel(payload);
        BuildCommentary(payload);

        report.WebsiteMetricsJson = JsonSerializer.Serialize(payload.Website, JsonOpts);
        report.SearchMetricsJson = JsonSerializer.Serialize(payload.Search, JsonOpts);
        report.AppStoreMetricsJson = JsonSerializer.Serialize(payload.AppStore, JsonOpts);
        report.BusinessMetricsJson = JsonSerializer.Serialize(new { payload.Business, payload.Funnel }, JsonOpts);
        report.SummaryHtml = WeeklyReportEmailRenderer.Render(payload);
        report.Status = payload.Errors.Count == 0
            ? WeeklyReportStatus.Completed
            : (payload.Website.Available || payload.Search.Available || payload.AppStore.Available)
                ? WeeklyReportStatus.PartiallyCompleted
                : WeeklyReportStatus.Failed;
        report.ErrorSummary = payload.Errors.Count > 0 ? string.Join("; ", payload.Errors) : null;

        await SendAsync(report);
        await db.SaveChangesAsync(ct);
        return report;
    }

    public async Task<WeeklyReport?> ResendAsync(int reportId)
    {
        var report = await db.WeeklyReports.FindAsync(reportId);
        if (report is null || string.IsNullOrWhiteSpace(report.SummaryHtml)) return null;
        await SendAsync(report);
        await db.SaveChangesAsync();
        return report;
    }

    private async Task SendAsync(WeeklyReport report)
    {
        var recipient = config["WEEKLY_REPORT_RECIPIENT"];
        if (string.IsNullOrWhiteSpace(recipient))
        {
            report.DeliveryStatus = ReportDeliveryStatus.Failed;
            report.ErrorSummary = (report.ErrorSummary is null ? "" : report.ErrorSummary + "; ") + "WEEKLY_REPORT_RECIPIENT not configured";
            return;
        }
        var subject = $"Clarity Weekly Performance Report — {report.PeriodStart:MMM d} to {report.PeriodEnd:MMM d, yyyy}";
        var sent = await email.SendRawHtmlAsync(recipient, subject, report.SummaryHtml, "weekly-report");
        report.DeliveryStatus = sent ? ReportDeliveryStatus.Sent : ReportDeliveryStatus.Failed;
    }

    private static async Task<SourceResult<T>> SafeRunAsync<T>(Func<Task<SourceResult<T>>> run, string sourceLabel, List<string> errors)
    {
        try
        {
            var result = await run();
            if (!result.Available) errors.Add($"{sourceLabel}: {result.UnavailableReason}");
            return result;
        }
        catch (Exception)
        {
            errors.Add($"{sourceLabel}: unexpected error");
            return SourceResult<T>.Unavailable("unexpected error");
        }
    }

    // ── Funnel ────────────────────────────────────────────────────────────────
    private static void BuildFunnel(WeeklyReportPayload p)
    {
        var funnel = new FunnelReport();
        decimal? websiteVisitors = p.Website.Available ? p.Website.Data!.CoreMetrics.FirstOrDefault(m => m.Label == "Total Users")?.Current : null;
        decimal? learnOrCalcVisitors = p.Website.Available
            ? (p.Website.Data!.LearnMetrics.FirstOrDefault(m => m.Label == "learn_hub_viewed")?.Current ?? 0)
              + (p.Website.Data!.CalculatorMetrics.FirstOrDefault(m => m.Label == "dti_calculator_viewed")?.Current ?? 0)
            : null;
        decimal accountsCreated = p.Business.UserGrowth.FirstOrDefault(m => m.Label == "New Registered Users")?.Current ?? 0;
        decimal premiumStarted = p.Business.SubscriptionGrowth.FirstOrDefault(m => m.Label == "New Premium Users")?.Current ?? 0;

        funnel.Stages =
        [
            new FunnelStage { Name = "Website Visitor", Count = websiteVisitors },
            new FunnelStage { Name = "Learn or Calculator Visitor", Count = learnOrCalcVisitors,
                ConversionFromPriorStagePct = Rate(learnOrCalcVisitors, websiteVisitors) },
            new FunnelStage { Name = "Signup Started", Count = null }, // not tracked yet
            new FunnelStage { Name = "Account Created", Count = accountsCreated,
                ConversionFromPriorStagePct = Rate(accountsCreated, learnOrCalcVisitors) },
            new FunnelStage { Name = "Premium Page Viewed", Count = null }, // not tracked yet
            new FunnelStage { Name = "Premium Subscription Started", Count = premiumStarted,
                ConversionFromPriorStagePct = Rate(premiumStarted, accountsCreated) },
        ];
        funnel.MissingTrackedEvents =
        [
            "signup_started — no event fires when a visitor opens the signup form (only learn_account_create_started, scoped to the Learn CTA specifically)",
            "premium_page_viewed — Settings/upgrade-prompt views aren't tracked as a distinct analytics event",
        ];
        p.Funnel = funnel;
    }

    private static decimal? Rate(decimal? numerator, decimal? denominator) =>
        (numerator is null || denominator is null || denominator == 0) ? null : Math.Round(numerator.Value / denominator.Value * 100, 1);

    // ── Deterministic commentary ─────────────────────────────────────────────
    // Minimum-volume rule: never state a percentage claim when the prior value
    // is below this threshold — small numbers produce misleading percentages.
    private const decimal MinVolumeForPercentClaim = 10;

    private static void BuildCommentary(WeeklyReportPayload p)
    {
        void Note(MetricPoint m, string upWord = "increased", string downWord = "decreased")
        {
            if (m.PercentChange is null) return;
            if (m.Prior < MinVolumeForPercentClaim)
            {
                p.Commentary.Add($"{m.Label} moved from {m.Prior:0.#} to {m.Current:0.#} — sample size is too small for a reliable percentage comparison.");
                return;
            }
            var word = m.Change > 0 ? upWord : m.Change < 0 ? downWord : "held steady";
            if (m.Change == 0) { p.Commentary.Add($"{m.Label} held steady at {m.Current:0.#}."); return; }
            p.Commentary.Add($"{m.Label} {word} {Math.Abs(m.PercentChange!.Value):0.#}% ({m.Prior:0.#} → {m.Current:0.#}).");
        }

        if (p.Website.Available)
            foreach (var m in p.Website.Data!.CoreMetrics.Where(m => m.Label is "Total Users" or "Sessions" or "Page Views"))
                Note(m);

        if (p.Search.Available)
        {
            var impressions = p.Search.Data!.CoreMetrics.FirstOrDefault(m => m.Label == "Organic Impressions");
            var ctr = p.Search.Data!.CoreMetrics.FirstOrDefault(m => m.Label == "Click-Through Rate (%)");
            if (impressions is not null && ctr is not null && impressions.Change > 0 && ctr.Change < 0 && impressions.Prior >= MinVolumeForPercentClaim)
                p.Commentary.Add("Organic impressions increased but click-through rate declined — search visibility is growing faster than click appeal for the same results.");
            else
            {
                if (impressions is not null) Note(impressions);
                var clicks = p.Search.Data!.CoreMetrics.FirstOrDefault(m => m.Label == "Organic Clicks");
                if (clicks is not null) Note(clicks);
            }
        }

        if (p.AppStore.Available)
            foreach (var m in p.AppStore.Data!.DownloadMetrics.Where(m => m.Label == "Total Downloads"))
                Note(m, "increased", "decreased");

        var conversionRate = p.Business.SubscriptionGrowth.FirstOrDefault(m => m.Label == "New Premium Users");
        if (conversionRate is not null) Note(conversionRate);

        var dtiCompleted = p.Website.Available ? p.Website.Data!.CalculatorMetrics.FirstOrDefault(m => m.Label == "dti_calculator_completed") : null;
        var dtiStarted = p.Website.Available ? p.Website.Data!.CalculatorMetrics.FirstOrDefault(m => m.Label == "dti_calculator_started") : null;
        if (dtiCompleted is not null && dtiStarted is not null && dtiStarted.Current > 0)
        {
            var curRate = Math.Round(dtiCompleted.Current / dtiStarted.Current * 100, 1);
            var priRate = dtiStarted.Prior > 0 ? Math.Round(dtiCompleted.Prior / dtiStarted.Prior * 100, 1) : (decimal?)null;
            if (priRate is not null && dtiStarted.Prior >= MinVolumeForPercentClaim)
                p.Commentary.Add($"DTI calculator completion rate was {curRate:0.#}% this period, versus {priRate:0.#}% previously.");
        }

        if (p.Search.Available && p.Search.Data!.TopPages.Count > 0)
        {
            var leader = p.Search.Data!.TopPages.OrderByDescending(t => t.Value).FirstOrDefault();
            if (leader is not null && leader.Value > 0)
                p.Commentary.Add($"\"{leader.Label}\" was the leading organic entry page this period ({leader.Value:0} clicks).");
        }

        if (p.Commentary.Count == 0)
            p.Commentary.Add("No sources with sufficient data were available to generate commentary this period.");

        // ── Recommended actions — only from real signals, never generic filler ──
        if (p.Search.Available && p.Search.Data!.HighImpressionLowCtrPages.Count > 0)
            p.RecommendedActions.Add($"Review title/meta description for high-impression, low-CTR pages: {string.Join(", ", p.Search.Data!.HighImpressionLowCtrPages.Take(3))}.");
        if (p.Search.Available && p.Search.Data!.PagesLosingTraffic.Count > 0)
            p.RecommendedActions.Add($"Investigate traffic loss on: {string.Join(", ", p.Search.Data!.PagesLosingTraffic.Take(3))}.");
        if (dtiStarted is not null && dtiCompleted is not null && dtiStarted.Current >= MinVolumeForPercentClaim && dtiCompleted.Current / Math.Max(dtiStarted.Current, 1) < 0.5m)
            p.RecommendedActions.Add("DTI calculator start-to-completion rate is below 50% — consider reviewing the form length or field clarity.");
        if (p.Funnel.MissingTrackedEvents.Count > 0)
            p.RecommendedActions.Add("Implement the missing funnel events listed below to get full visibility into the signup path.");
    }
}
