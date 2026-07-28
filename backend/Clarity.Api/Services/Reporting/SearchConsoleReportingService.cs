using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Clarity.Api.Services.Reporting;

/// <summary>
/// Reads aggregated organic search metrics from the official Search Console
/// Search Analytics API — https://developers.google.com/webmaster-tools/v1/searchanalytics/query.
/// Search Console data typically lags 2-3 days behind real time; callers must
/// treat DataCutoff as authoritative rather than assuming "today" is available.
/// </summary>
public class SearchConsoleReportingService(IConfiguration config, GoogleServiceAccountAuth auth, HttpClient http, ILogger<SearchConsoleReportingService> logger)
{
    private const string Scope = "https://www.googleapis.com/auth/webmasters.readonly";
    private string? SiteUrl => config["SEARCH_CONSOLE_PROPERTY"];

    public bool IsConfigured => auth.IsConfigured && !string.IsNullOrWhiteSpace(SiteUrl);

    public async Task<SourceResult<SearchMetrics>> GetWeeklyMetricsAsync(DateOnly currentStart, DateOnly currentEnd, DateOnly priorStart, DateOnly priorEnd)
    {
        if (!IsConfigured) return SourceResult<SearchMetrics>.Unavailable("Search Console not configured (SEARCH_CONSOLE_PROPERTY / GOOGLE_APPLICATION_CREDENTIALS)");
        var token = await auth.GetAccessTokenAsync(Scope);
        if (token is null) return SourceResult<SearchMetrics>.Unavailable("Google authentication failed");

        try
        {
            var currentTotals = await QueryAsync(token, currentStart, currentEnd, []);
            var priorTotals = await QueryAsync(token, priorStart, priorEnd, []);
            var (curClicks, curImpr, curCtr, curPos) = Totals(currentTotals);
            var (priClicks, priImpr, priCtr, priPos) = Totals(priorTotals);

            var currentQueries = await QueryAsync(token, currentStart, currentEnd, ["query"], 20);
            var priorQueries = await QueryAsync(token, priorStart, priorEnd, ["query"], 20);
            var currentPages = await QueryAsync(token, currentStart, currentEnd, ["page"], 20);
            var priorPages = await QueryAsync(token, priorStart, priorEnd, ["page"], 20);
            var devices = await QueryAsync(token, currentStart, currentEnd, ["device"], 5);
            var countries = await QueryAsync(token, currentStart, currentEnd, ["country"], 5);

            var curQ = ToDict(currentQueries);
            var priQ = ToDict(priorQueries);
            var curP = ToDict(currentPages);
            var priP = ToDict(priorPages);

            var metrics = new SearchMetrics
            {
                CoreMetrics =
                [
                    new MetricPoint("Organic Impressions", curImpr, priImpr),
                    new MetricPoint("Organic Clicks", curClicks, priClicks),
                    new MetricPoint("Click-Through Rate (%)", Math.Round(curCtr * 100, 2), Math.Round(priCtr * 100, 2)),
                    new MetricPoint("Average Position", Math.Round(curPos, 1), Math.Round(priPos, 1)),
                ],
                TopQueries = [.. currentQueries.Select(r => new TopItem(r.key, r.clicks, r.impressions))],
                TopPages = [.. currentPages.Select(r => new TopItem(r.key, r.clicks, r.impressions))],
                DeviceBreakdown = [.. devices.Select(r => new TopItem(r.key, r.clicks))],
                CountryBreakdown = [.. countries.Select(r => new TopItem(r.key, r.clicks))],
                QueriesGainingImpressions = GainList(curQ, priQ, minVolume: 10),
                QueriesGainingClicks = GainList(curQ, priQ, minVolume: 1, useClicks: true),
                PagesGainingTraffic = GainList(curP, priP, minVolume: 1, useClicks: true),
                PagesLosingTraffic = LossList(curP, priP, minVolume: 1, useClicks: true),
                HighImpressionLowCtrPages = [.. currentPages.Where(r => r.impressions >= 50 && r.impressions > 0 && (r.clicks / r.impressions) < 0.02m).Select(r => r.key)],
                // New queries: appeared this period with real volume but had 0 impressions last period.
                NewDtiQueries = [.. currentQueries.Where(r => r.key.Contains("dti", StringComparison.OrdinalIgnoreCase) && !priQ.ContainsKey(r.key) && r.impressions >= 5).Select(r => r.key)],
            };
            // Search Console typically finalizes data ~2-3 days back.
            return SourceResult<SearchMetrics>.Ok(metrics, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-3)));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[SearchConsole] Report fetch failed");
            return SourceResult<SearchMetrics>.Unavailable("Search Console request failed");
        }
    }

    private static (decimal clicks, decimal impressions, decimal ctr, decimal position) Totals(List<(string key, decimal clicks, decimal impressions, decimal ctr, decimal position)> rows)
    {
        if (rows.Count == 0) return (0, 0, 0, 0);
        var clicks = rows.Sum(r => r.clicks);
        var impressions = rows.Sum(r => r.impressions);
        var ctr = impressions > 0 ? clicks / impressions : 0;
        var weightedPos = impressions > 0 ? rows.Sum(r => r.position * r.impressions) / impressions : 0;
        return (clicks, impressions, ctr, weightedPos);
    }

    private static Dictionary<string, (decimal clicks, decimal impressions)> ToDict(List<(string key, decimal clicks, decimal impressions, decimal ctr, decimal position)> rows) =>
        rows.ToDictionary(r => r.key, r => (r.clicks, r.impressions));

    /// <summary>Rows whose impressions/clicks grew, ignoring low-volume noise below minVolume.</summary>
    private static List<string> GainList(Dictionary<string, (decimal clicks, decimal impressions)> current, Dictionary<string, (decimal clicks, decimal impressions)> prior, int minVolume, bool useClicks = false)
    {
        var result = new List<(string key, decimal delta)>();
        foreach (var (key, cur) in current)
        {
            var pri = prior.GetValueOrDefault(key);
            var curVal = useClicks ? cur.clicks : cur.impressions;
            var priVal = useClicks ? pri.clicks : pri.impressions;
            if (curVal < minVolume) continue;
            if (curVal > priVal) result.Add((key, curVal - priVal));
        }
        return [.. result.OrderByDescending(r => r.delta).Take(5).Select(r => r.key)];
    }

    private static List<string> LossList(Dictionary<string, (decimal clicks, decimal impressions)> current, Dictionary<string, (decimal clicks, decimal impressions)> prior, int minVolume, bool useClicks = false)
    {
        var result = new List<(string key, decimal delta)>();
        foreach (var (key, pri) in prior)
        {
            var cur = current.GetValueOrDefault(key);
            var curVal = useClicks ? cur.clicks : cur.impressions;
            var priVal = useClicks ? pri.clicks : pri.impressions;
            if (priVal < minVolume) continue;
            if (curVal < priVal) result.Add((key, priVal - curVal));
        }
        return [.. result.OrderByDescending(r => r.delta).Take(5).Select(r => r.key)];
    }

    private async Task<List<(string key, decimal clicks, decimal impressions, decimal ctr, decimal position)>> QueryAsync(
        string token, DateOnly start, DateOnly end, string[] dimensions, int rowLimit = 1)
    {
        var body = new Dictionary<string, object?>
        {
            ["startDate"] = start.ToString("yyyy-MM-dd"),
            ["endDate"] = end.ToString("yyyy-MM-dd"),
            ["rowLimit"] = rowLimit,
        };
        if (dimensions.Length > 0) body["dimensions"] = dimensions;

        var url = $"https://www.googleapis.com/webmasters/v3/sites/{Uri.EscapeDataString(SiteUrl!)}/searchAnalytics/query";
        var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json") };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var resp = await http.SendAsync(req);
        if (!resp.IsSuccessStatusCode)
        {
            logger.LogWarning("[SearchConsole] searchAnalytics/query returned {Status}", resp.StatusCode);
            return [];
        }
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var result = new List<(string, decimal, decimal, decimal, decimal)>();
        if (!doc.RootElement.TryGetProperty("rows", out var rows)) return result; // empty period — not an error
        foreach (var row in rows.EnumerateArray())
        {
            var key = "(all)";
            if (row.TryGetProperty("keys", out var keys) && keys.GetArrayLength() > 0)
                key = keys[0].GetString() ?? key;
            decimal clicks = row.TryGetProperty("clicks", out var c) ? c.GetDecimal() : 0;
            decimal impressions = row.TryGetProperty("impressions", out var i) ? i.GetDecimal() : 0;
            decimal ctr = row.TryGetProperty("ctr", out var t) ? t.GetDecimal() : 0;
            decimal position = row.TryGetProperty("position", out var p) ? p.GetDecimal() : 0;
            result.Add((key, clicks, impressions, ctr, position));
        }
        return result;
    }
}
