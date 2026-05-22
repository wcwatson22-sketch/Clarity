namespace Clarity.Api.Models;

// ── Internal analytics data object (never exposed directly) ─────────────────
public class UserFinancialData
{
    public int UserId { get; init; }
    public int Age { get; init; }
    public DateTime CreatedAt { get; init; }
    public bool HasProfile { get; init; }
    public decimal? NetWorth { get; init; }
    public decimal? TotalAssets { get; init; }
    public decimal? TotalLiabilities { get; init; }
    public decimal? MonthlyIncome { get; init; }
    public decimal? MonthlyExpenses { get; init; }
    public decimal? MonthlySavings { get; init; }
    public decimal? SavingsBalance { get; init; }
    public decimal? InvestmentsBalance { get; init; }
    public DateTime? LastSnapshotAt { get; init; }
}

// ── Aggregate averages (global or per age bracket) ──────────────────────────
public record FinancialAverages(
    int UserCount,
    decimal AvgNetWorth,
    decimal AvgTotalAssets,
    decimal AvgTotalLiabilities,
    decimal AvgMonthlyIncome,
    decimal AvgMonthlyExpenses,
    decimal AvgMonthlySavings,
    decimal AvgSavingsRate,
    decimal AvgDebtToIncomeRatio,
    decimal AvgSavingsBalance,
    decimal AvgInvestmentsBalance
);

// ── Age bracket container ────────────────────────────────────────────────────
public record BracketStats(
    string Bracket,
    int Count,
    bool HasEnoughData,
    string Message,
    FinancialAverages? Averages
);

// ── Admin: summary stats response ────────────────────────────────────────────
public record AdminStatsResponse(
    int TotalUsers,
    int UsersWithProfiles,
    bool GlobalHasEnoughData,
    string GlobalMessage,
    FinancialAverages? GlobalAverages,
    Dictionary<string, BracketStats> ByAgeBracket
);

// ── Admin: anonymized per-user row (no PII) ──────────────────────────────────
public record AdminUserRow(
    string AnonymousId,
    string AgeBracket,
    string City,
    string State,
    bool HasProfile,
    decimal? NetWorth,
    decimal? TotalAssets,
    decimal? TotalLiabilities,
    decimal? MonthlyIncome,
    decimal? MonthlyExpenses,
    decimal? MonthlySavings,
    decimal? SavingsBalance,
    decimal? InvestmentsBalance,
    DateTime CreatedAt,
    DateTime? LastSnapshotAt
);

// ── User-facing comparison item ──────────────────────────────────────────────
public record UserComparisonItem(
    string Category,
    string Label,
    decimal UserValue,
    decimal AvgValue,
    string Status,   // "above" | "at" | "below"
    string Message
);

// ── User-facing comparison response ─────────────────────────────────────────
public record UserComparisonResponse(
    string AgeBracket,
    bool HasEnoughData,
    string Message,
    List<UserComparisonItem> Comparisons
);
