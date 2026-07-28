using System.IdentityModel.Tokens.Jwt;
using System.IO.Compression;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace Clarity.Api.Services.Reporting;

/// <summary>
/// Reads aggregated download/subscription metrics from the official App Store
/// Connect Sales and Trends Reports API —
/// https://developer.apple.com/documentation/appstoreconnectapi/download_sales_and_trends_reports.
/// This is the simpler, single-request-per-day report endpoint (vs. the newer
/// multi-step Analytics Reports Request flow), officially supported and
/// sufficient for downloads/subscriptions. No scraping of the App Store Connect
/// website; ES256 JWT auth per Apple's documented API-key flow.
///
/// IMPORTANT — UNVERIFIED PARSING: the "Product Type Identifier" column values
/// used below to distinguish first-time downloads / redownloads / updates follow
/// Apple's published Sales Report field reference, but this has not been
/// reconciled against a real report from this app's own App Store Connect
/// account (no credentials were available to test with). Verify totals against
/// the App Store Connect dashboard before trusting this section — see the
/// deployment checklist.
/// </summary>
public class AppStoreConnectReportingService(IConfiguration config, HttpClient http, ILogger<AppStoreConnectReportingService> logger)
{
    private string? IssuerId => config["APPSTORE_CONNECT_ISSUER_ID"];
    private string? KeyId => config["APPSTORE_CONNECT_KEY_ID"];
    private string? PrivateKeyPath => config["APPSTORE_CONNECT_PRIVATE_KEY_PATH"];
    private string? AppId => config["APPSTORE_APP_ID"];
    /// <summary>Not in the originally requested env var list, but required by the
    /// Sales Reports endpoint — Apple's numeric vendor/legal-entity id (found in
    /// App Store Connect → Reports → "Vendor #"). Documented separately below.</summary>
    private string? VendorNumber => config["APPSTORE_CONNECT_VENDOR_NUMBER"];

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(IssuerId) && !string.IsNullOrWhiteSpace(KeyId) &&
        !string.IsNullOrWhiteSpace(PrivateKeyPath) && File.Exists(PrivateKeyPath) &&
        !string.IsNullOrWhiteSpace(VendorNumber);

    public async Task<SourceResult<AppStoreMetrics>> GetWeeklyMetricsAsync(DateOnly currentStart, DateOnly currentEnd, DateOnly priorStart, DateOnly priorEnd)
    {
        if (!IsConfigured)
            return SourceResult<AppStoreMetrics>.Unavailable("App Store Connect not configured (issuer/key/vendor number)");

        try
        {
            var token = BuildJwt();
            var current = await SumDailySalesAsync(token, currentStart, currentEnd);
            var prior = await SumDailySalesAsync(token, priorStart, priorEnd);

            var metrics = new AppStoreMetrics
            {
                DownloadMetrics =
                [
                    new MetricPoint("First-Time Downloads", current.FirstTime, prior.FirstTime),
                    new MetricPoint("Redownloads", current.Redownloads, prior.Redownloads),
                    new MetricPoint("Total Downloads", current.FirstTime + current.Redownloads, prior.FirstTime + prior.Redownloads),
                ],
                DownloadsBySource = [.. current.BySource.Select(kv => new TopItem(kv.Key, kv.Value))],
                DownloadsByTerritory = [.. current.ByTerritory.OrderByDescending(kv => kv.Value).Take(10).Select(kv => new TopItem(kv.Key, kv.Value))],
                DownloadsByDevice = [.. current.ByDevice.Select(kv => new TopItem(kv.Key, kv.Value))],
                // Subscription events require a separate reportType=SUBSCRIPTION /
                // SUBSCRIPTION_EVENT request — not fetched here; App Store Connect's
                // in-app-purchase reporting is opt-in per report type and requires the
                // subscription report to be enabled for this app first.
                SubscriptionMetrics = [],
            };
            // App Store Connect sales reports are typically finalized ~1-2 days after the report date.
            return SourceResult<AppStoreMetrics>.Ok(metrics, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[AppStoreConnect] Report fetch failed");
            return SourceResult<AppStoreMetrics>.Unavailable("App Store Connect request failed");
        }
    }

    private string BuildJwt()
    {
        var pem = File.ReadAllText(PrivateKeyPath!);
        using var ecdsa = ECDsa.Create();
        ecdsa.ImportFromPem(pem);
        var key = new ECDsaSecurityKey(ecdsa) { KeyId = KeyId };
        var creds = new SigningCredentials(key, SecurityAlgorithms.EcdsaSha256);
        var now = DateTime.UtcNow;
        var jwt = new JwtSecurityToken(
            claims:
            [
                new Claim("iss", IssuerId!),
                new Claim("aud", "appstoreconnect-v1"),
            ],
            notBefore: now,
            expires: now.AddMinutes(19), // Apple caps this token type at 20 minutes
            signingCredentials: creds);
        var handler = new JwtSecurityTokenHandler();
        var token = handler.WriteToken(jwt);
        // JwtSecurityToken doesn't expose a header "kid" setter via claims; ECDsaSecurityKey.KeyId
        // above sets it on the signing key, which JwtSecurityTokenHandler propagates into the header.
        return token;
    }

    private record DailyTotals(decimal FirstTime, decimal Redownloads, Dictionary<string, decimal> BySource, Dictionary<string, decimal> ByTerritory, Dictionary<string, decimal> ByDevice);

    private async Task<DailyTotals> SumDailySalesAsync(string token, DateOnly start, DateOnly end)
    {
        decimal firstTime = 0, redownloads = 0;
        var bySource = new Dictionary<string, decimal>();
        var byTerritory = new Dictionary<string, decimal>();
        var byDevice = new Dictionary<string, decimal>();

        for (var day = start; day <= end; day = day.AddDays(1))
        {
            var rows = await FetchDaySalesAsync(token, day);
            foreach (var row in rows)
            {
                // Per Apple's Sales Report field reference: Product Type Identifier
                // "1"/"1F"/"1T" = new download variants, "7"/"7F"/"7T" = update,
                // "3"/"F1" family = redownload. This mapping is the part flagged as
                // unverified above — confirm against a real report before relying on it.
                var isUpdate = row.ProductTypeId.StartsWith('7');
                if (isUpdate) continue; // never count app updates as downloads

                var isRedownload = row.ProductTypeId is "F1" or "IA9" || row.ProductTypeId.Contains("R");
                if (isRedownload) redownloads += row.Units; else firstTime += row.Units;

                if (!string.IsNullOrEmpty(row.Source)) bySource[row.Source] = bySource.GetValueOrDefault(row.Source) + row.Units;
                if (!string.IsNullOrEmpty(row.Territory)) byTerritory[row.Territory] = byTerritory.GetValueOrDefault(row.Territory) + row.Units;
                if (!string.IsNullOrEmpty(row.Device)) byDevice[row.Device] = byDevice.GetValueOrDefault(row.Device) + row.Units;
            }
        }
        return new DailyTotals(firstTime, redownloads, bySource, byTerritory, byDevice);
    }

    private record SalesRow(string ProductTypeId, decimal Units, string? Source, string? Territory, string? Device);

    private async Task<List<SalesRow>> FetchDaySalesAsync(string token, DateOnly day)
    {
        var url = "https://api.appstoreconnect.apple.com/v1/salesReports" +
                  $"?filter[frequency]=DAILY&filter[reportDate]={day:yyyy-MM-dd}" +
                  "&filter[reportSubType]=SUMMARY&filter[reportType]=SALES" +
                  $"&filter[vendorNumber]={VendorNumber}&filter[version]=1_1";
        var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/a-gzip"));
        var resp = await http.SendAsync(req);

        // 404 for a given day is expected/normal (no data yet, or nothing sold that day)
        // — never a hard failure for the whole week's report.
        if (resp.StatusCode == System.Net.HttpStatusCode.NotFound) return [];
        if (!resp.IsSuccessStatusCode)
        {
            logger.LogWarning("[AppStoreConnect] salesReports for {Day} returned {Status}", day, resp.StatusCode);
            return [];
        }

        await using var stream = await resp.Content.ReadAsStreamAsync();
        await using var gzip = new GZipStream(stream, CompressionMode.Decompress);
        using var reader = new StreamReader(gzip);
        var text = await reader.ReadToEndAsync();
        return ParseTsv(text);
    }

    private static List<SalesRow> ParseTsv(string text)
    {
        var rows = new List<SalesRow>();
        var lines = text.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 2) return rows; // header only / empty
        var header = lines[0].Split('\t');
        int Idx(string name) => Array.FindIndex(header, h => h.Equals(name, StringComparison.OrdinalIgnoreCase));
        var iType = Idx("Product Type Identifier");
        var iUnits = Idx("Units");
        var iSource = Idx("Promo Code"); // Apple's sales report doesn't have a clean "source" column; left blank pending confirmation.
        var iTerritory = Idx("Country Code");
        var iDevice = Idx("Device");

        for (var i = 1; i < lines.Length; i++)
        {
            var cols = lines[i].Split('\t');
            if (iType < 0 || iUnits < 0 || iType >= cols.Length || iUnits >= cols.Length) continue;
            if (!decimal.TryParse(cols[iUnits], out var units)) continue;
            rows.Add(new SalesRow(
                cols[iType],
                units,
                iSource >= 0 && iSource < cols.Length ? cols[iSource] : null,
                iTerritory >= 0 && iTerritory < cols.Length ? cols[iTerritory] : null,
                iDevice >= 0 && iDevice < cols.Length ? cols[iDevice] : null));
        }
        return rows;
    }
}
