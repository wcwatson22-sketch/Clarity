namespace Clarity.Api.Services.Reporting;

/// <summary>
/// Aggregated, privacy-safe DTOs shared by every reporting source. None of these
/// types may ever carry a name, email, user id, or individual financial value —
/// only counts, rates, and labels.
/// </summary>

public record MetricPoint(string Label, decimal Current, decimal Prior)
{
    public decimal Change => Current - Prior;
    /// <summary>Null when the prior value is 0 (percentage change is meaningless there).</summary>
    public decimal? PercentChange => Prior == 0 ? null : Math.Round((Current - Prior) / Prior * 100, 1);
}

public record TopItem(string Label, decimal Value, decimal? SecondaryValue = null);

public class SourceResult<T>
{
    public bool Available { get; set; }
    /// <summary>Generic, secret-free reason the source is unavailable (e.g. "not configured", "request timed out").</summary>
    public string? UnavailableReason { get; set; }
    public T? Data { get; set; }
    public DateOnly? DataCutoff { get; set; }

    public static SourceResult<T> Ok(T data, DateOnly? cutoff = null) => new() { Available = true, Data = data, DataCutoff = cutoff };
    public static SourceResult<T> Unavailable(string reason) => new() { Available = false, UnavailableReason = reason };
}

// ── Google Analytics 4 ───────────────────────────────────────────────────────
public class WebsiteMetrics
{
    public List<MetricPoint> CoreMetrics { get; set; } = [];      // totalUsers, newUsers, sessions, engagedSessions, engagementRate, avgEngagementTime, pageViews
    public List<MetricPoint> LearnMetrics { get; set; } = [];      // learnHubVisits, learnArticleViews
    public List<MetricPoint> CalculatorMetrics { get; set; } = []; // dtiViews, dtiStarted, dtiCompleted
    public List<MetricPoint> ConversionMetrics { get; set; } = []; // signupCtaClicks, signupCompletions, premiumConversionEvents
    public List<TopItem> TopLandingPages { get; set; } = [];
    public List<TopItem> TopTrafficSources { get; set; } = [];
}

// ── Google Search Console ────────────────────────────────────────────────────
public class SearchMetrics
{
    public List<MetricPoint> CoreMetrics { get; set; } = [];   // impressions, clicks, ctr, avgPosition
    public List<TopItem> TopQueries { get; set; } = [];
    public List<TopItem> TopPages { get; set; } = [];
    public List<TopItem> DeviceBreakdown { get; set; } = [];
    public List<TopItem> CountryBreakdown { get; set; } = [];
    public List<string> QueriesGainingImpressions { get; set; } = [];
    public List<string> QueriesGainingClicks { get; set; } = [];
    public List<string> PagesGainingTraffic { get; set; } = [];
    public List<string> PagesLosingTraffic { get; set; } = [];
    public List<string> HighImpressionLowCtrPages { get; set; } = [];
    public List<string> NewDtiQueries { get; set; } = [];
}

// ── App Store Connect ────────────────────────────────────────────────────────
public class AppStoreMetrics
{
    public List<MetricPoint> DownloadMetrics { get; set; } = []; // firstTimeDownloads, redownloads, totalDownloads, productPageViews, conversionRate
    public List<TopItem> DownloadsBySource { get; set; } = [];
    public List<TopItem> DownloadsByTerritory { get; set; } = [];
    public List<TopItem> DownloadsByDevice { get; set; } = [];
    public List<MetricPoint> SubscriptionMetrics { get; set; } = []; // starts, renewals, cancellations
    public decimal? SubscriptionProceeds { get; set; }
    public int? Crashes { get; set; }
    public int? ActiveDevices { get; set; }
}

// ── Clarity database ──────────────────────────────────────────────────────────
public class BusinessMetrics
{
    public List<MetricPoint> UserGrowth { get; set; } = [];       // newUsers, totalUsers, activeUsers
    public List<MetricPoint> SubscriptionGrowth { get; set; } = []; // newFree, newPremium, activePremium, cancellations
    public decimal? FreeToPremiumConversionRatePct { get; set; }
    public int LinkedHouseholds { get; set; }
    public int CompletedSnapshots { get; set; }
    public List<TopItem> MostUsedFeatures { get; set; } = [];
}

// ── Funnel ────────────────────────────────────────────────────────────────────
public class FunnelStage
{
    public string Name { get; set; } = string.Empty;
    public decimal? Count { get; set; }               // null when tracking doesn't exist yet
    public decimal? ConversionFromPriorStagePct { get; set; }
    public decimal? WeekOverWeekChangePct { get; set; }
}

public class FunnelReport
{
    public List<FunnelStage> Stages { get; set; } = [];
    public List<string> MissingTrackedEvents { get; set; } = [];
}

/// <summary>Full composed report payload — the four *Json columns plus the funnel
/// and the deterministic commentary, before HTML rendering.</summary>
public class WeeklyReportPayload
{
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public DateOnly PriorPeriodStart { get; set; }
    public DateOnly PriorPeriodEnd { get; set; }

    public SourceResult<WebsiteMetrics> Website { get; set; } = SourceResult<WebsiteMetrics>.Unavailable("not run");
    public SourceResult<SearchMetrics> Search { get; set; } = SourceResult<SearchMetrics>.Unavailable("not run");
    public SourceResult<AppStoreMetrics> AppStore { get; set; } = SourceResult<AppStoreMetrics>.Unavailable("not run");
    public BusinessMetrics Business { get; set; } = new();
    public FunnelReport Funnel { get; set; } = new();
    public List<string> Commentary { get; set; } = [];
    public List<string> RecommendedActions { get; set; } = [];
    public List<string> Errors { get; set; } = [];
}
