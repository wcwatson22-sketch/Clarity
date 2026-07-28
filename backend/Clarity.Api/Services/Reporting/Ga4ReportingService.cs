using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Clarity.Api.Services.Reporting;

/// <summary>
/// Reads aggregated website metrics from the official Google Analytics Data API
/// (GA4) — https://developers.google.com/analytics/devguides/reporting/data/v1.
/// Read-only: only ever calls `:runReport`, never a write/admin endpoint.
/// Requests dimensions/metrics only — GA4 never has individual financial values
/// to begin with, since Clarity's own analytics code (LearnAnalyticsService) is
/// deliberately restricted to non-financial event names and identifiers.
/// </summary>
public class Ga4ReportingService(IConfiguration config, GoogleServiceAccountAuth auth, HttpClient http, ILogger<Ga4ReportingService> logger)
{
    private const string Scope = "https://www.googleapis.com/auth/analytics.readonly";
    private string? PropertyId => config["GA4_PROPERTY_ID"];

    public bool IsConfigured => auth.IsConfigured && !string.IsNullOrWhiteSpace(PropertyId);

    public async Task<SourceResult<WebsiteMetrics>> GetWeeklyMetricsAsync(DateOnly currentStart, DateOnly currentEnd, DateOnly priorStart, DateOnly priorEnd)
    {
        if (!IsConfigured) return SourceResult<WebsiteMetrics>.Unavailable("GA4 not configured (GA4_PROPERTY_ID / GOOGLE_APPLICATION_CREDENTIALS)");

        var token = await auth.GetAccessTokenAsync(Scope);
        if (token is null) return SourceResult<WebsiteMetrics>.Unavailable("Google authentication failed");

        try
        {
            var core = await RunCoreMetricsAsync(token, currentStart, currentEnd, priorStart, priorEnd);
            var events = await RunEventMetricsAsync(token, currentStart, currentEnd, priorStart, priorEnd);
            var landing = await RunTopRowsAsync(token, currentStart, currentEnd, "landingPagePlusQueryString", "screenPageViews", 5);
            var sources = await RunTopRowsAsync(token, currentStart, currentEnd, "sessionSourceMedium", "sessions", 5);

            var metrics = new WebsiteMetrics
            {
                CoreMetrics = core,
                LearnMetrics = events.Where(m => m.Label is "learn_hub_viewed" or "learn_article_viewed").ToList(),
                CalculatorMetrics = events.Where(m => m.Label.StartsWith("dti_calculator_")).ToList(),
                ConversionMetrics = events.Where(m => m.Label is "learn_account_create_started" or "learn_cta_clicked" or "learn_premium_link_clicked").ToList(),
                TopLandingPages = landing,
                TopTrafficSources = sources,
            };
            // GA4 has up to 24-48h reporting delay; treat "yesterday" as the safe cutoff.
            return SourceResult<WebsiteMetrics>.Ok(metrics, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[GA4] Report fetch failed");
            return SourceResult<WebsiteMetrics>.Unavailable("GA4 request failed");
        }
    }

    private async Task<List<MetricPoint>> RunCoreMetricsAsync(string token, DateOnly cs, DateOnly ce, DateOnly ps, DateOnly pe)
    {
        var metricNames = new[] { "totalUsers", "newUsers", "sessions", "engagedSessions", "engagementRate", "averageSessionDuration", "screenPageViews" };
        var labels = new[] { "Total Users", "New Users", "Sessions", "Engaged Sessions", "Engagement Rate", "Avg. Engagement Time (s)", "Page Views" };

        var body = new
        {
            dateRanges = new object[] { new { startDate = Fmt(cs), endDate = Fmt(ce), name = "current" }, new { startDate = Fmt(ps), endDate = Fmt(pe), name = "prior" } },
            metrics = metricNames.Select(m => new { name = m }).ToArray(),
        };
        var report = await PostReportAsync(token, body);
        var current = new decimal[metricNames.Length];
        var prior = new decimal[metricNames.Length];
        if (report is not null)
        {
            foreach (var row in ReadRows(report.Value))
            {
                var target = row.dateRangeName == "current" ? current : prior;
                for (var i = 0; i < row.metricValues.Count; i++)
                    target[i] = row.metricValues[i];
            }
        }
        return [.. Enumerable.Range(0, metricNames.Length).Select(i => new MetricPoint(labels[i], current[i], prior[i]))];
    }

    private async Task<List<MetricPoint>> RunEventMetricsAsync(string token, DateOnly cs, DateOnly ce, DateOnly ps, DateOnly pe)
    {
        var eventNames = new[]
        {
            "learn_hub_viewed", "learn_article_viewed", "learn_account_create_started",
            "learn_cta_clicked", "learn_premium_link_clicked",
            "dti_calculator_viewed", "dti_calculator_started", "dti_calculator_completed",
            "dti_calculator_signup_clicked", "dti_calculator_article_clicked",
        };
        var body = new
        {
            dateRanges = new object[] { new { startDate = Fmt(cs), endDate = Fmt(ce), name = "current" }, new { startDate = Fmt(ps), endDate = Fmt(pe), name = "prior" } },
            dimensions = new[] { new { name = "eventName" } },
            metrics = new[] { new { name = "eventCount" } },
            dimensionFilter = new
            {
                filter = new
                {
                    fieldName = "eventName",
                    inListFilter = new { values = eventNames },
                },
            },
        };
        var report = await PostReportAsync(token, body);
        var current = new Dictionary<string, decimal>();
        var prior = new Dictionary<string, decimal>();
        if (report is not null)
        {
            foreach (var row in ReadRows(report.Value))
            {
                var target = row.dateRangeName == "current" ? current : prior;
                if (row.dimensionValues.Count > 0) target[row.dimensionValues[0]] = row.metricValues.FirstOrDefault();
            }
        }
        return [.. eventNames.Select(e => new MetricPoint(e, current.GetValueOrDefault(e), prior.GetValueOrDefault(e)))];
    }

    private async Task<List<TopItem>> RunTopRowsAsync(string token, DateOnly cs, DateOnly ce, string dimension, string metric, int limit)
    {
        var body = new
        {
            dateRanges = new[] { new { startDate = Fmt(cs), endDate = Fmt(ce) } },
            dimensions = new[] { new { name = dimension } },
            metrics = new[] { new { name = metric } },
            limit,
            orderBys = new object[] { new { metric = new { metricName = metric }, desc = true } },
        };
        var report = await PostReportAsync(token, body);
        if (report is null) return [];
        return [.. ReadRows(report.Value).Select(r => new TopItem(r.dimensionValues.FirstOrDefault() ?? "(unknown)", r.metricValues.FirstOrDefault()))];
    }

    private async Task<JsonElement?> PostReportAsync(string token, object body)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"https://analyticsdata.googleapis.com/v1beta/properties/{PropertyId}:runReport");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var resp = await http.SendAsync(req);
        if (!resp.IsSuccessStatusCode)
        {
            logger.LogWarning("[GA4] runReport returned {Status}", resp.StatusCode);
            return null;
        }
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    private static string Fmt(DateOnly d) => d.ToString("yyyy-MM-dd");

    private static IEnumerable<(string? dateRangeName, List<string> dimensionValues, List<decimal> metricValues)> ReadRows(JsonElement report)
    {
        if (!report.TryGetProperty("rows", out var rows)) yield break;
        foreach (var row in rows.EnumerateArray())
        {
            var dims = new List<string>();
            if (row.TryGetProperty("dimensionValues", out var dv))
                foreach (var d in dv.EnumerateArray()) dims.Add(d.GetProperty("value").GetString() ?? "");

            string? dateRangeName = dims.Count > 0 && (dims[^1] == "current" || dims[^1] == "prior") ? dims[^1] : null;
            if (dateRangeName is not null) dims.RemoveAt(dims.Count - 1);

            var mets = new List<decimal>();
            if (row.TryGetProperty("metricValues", out var mv))
                foreach (var m in mv.EnumerateArray())
                    mets.Add(decimal.TryParse(m.GetProperty("value").GetString(), out var val) ? val : 0);

            yield return (dateRangeName, dims, mets);
        }
    }
}
