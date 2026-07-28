namespace Clarity.Api.Models;

public enum WeeklyReportStatus { Pending = 0, Completed = 1, Failed = 2, PartiallyCompleted = 3 }
public enum ReportDeliveryStatus { NotSent = 0, Sent = 1, Failed = 2 }

/// <summary>
/// One weekly executive report. Stores only aggregated, privacy-safe metrics —
/// never individual user financial data, names, emails, or raw credentials.
/// The *Json fields hold small serialized DTOs (see Services/Reporting/*Dto.cs).
/// </summary>
public class WeeklyReport
{
    public int Id { get; set; }
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public WeeklyReportStatus Status { get; set; } = WeeklyReportStatus.Pending;

    public string WebsiteMetricsJson { get; set; } = "{}";
    public string SearchMetricsJson { get; set; } = "{}";
    public string AppStoreMetricsJson { get; set; } = "{}";
    public string BusinessMetricsJson { get; set; } = "{}";

    public string SummaryHtml { get; set; } = string.Empty;
    public ReportDeliveryStatus DeliveryStatus { get; set; } = ReportDeliveryStatus.NotSent;
    /// <summary>Generic, secret-free error text (e.g. "App Store Connect: request timed out").</summary>
    public string? ErrorSummary { get; set; }

    public bool TriggeredManually { get; set; } = false;
}
