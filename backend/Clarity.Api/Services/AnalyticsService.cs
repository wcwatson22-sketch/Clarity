using Clarity.Api.Data;
using Clarity.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Services;

public class AnalyticsService(AppDbContext db)
{
    private const int MinUsersForStats = 30;

    private static readonly string[] SavingsKeywords =
        ["saving", "emergency", "hsa", "money market", "cd ", "certificate"];

    private static readonly string[] InvestmentKeywords =
        ["invest", "retirement", "brokerage", "401k", "403b", "457", "ira", "roth",
         "etf", "stock", "mutual fund", "pension", "annuity"];

    // ── Age bracket helper ────────────────────────────────────────────────────
    public static string GetAgeBracket(int age) => age switch
    {
        >= 18 and <= 24 => "18-24",
        >= 25 and <= 34 => "25-34",
        >= 35 and <= 44 => "35-44",
        >= 45 and <= 54 => "45-54",
        >= 55 and <= 64 => "55-64",
        _ => "65+"
    };

    // ── Load all user financial data into memory ──────────────────────────────
    public async Task<List<UserFinancialData>> GetAllUserFinancialDataAsync()
    {
        var users = await db.Users.AsNoTracking().ToListAsync();

        // Load all snapshots, then group client-side (safe for MVP scale)
        var allSnapshots = await db.Snapshots.AsNoTracking().ToListAsync();
        var latestSnapshots = allSnapshots
            .GroupBy(s => s.UserId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.CreatedAt).First());

        var incomes = await db.Incomes.AsNoTracking().ToListAsync();
        var incomeByUser = incomes.ToDictionary(i => i.UserId);

        var allBudget = await db.BudgetItems.AsNoTracking().ToListAsync();
        var budgetByUser = allBudget.GroupBy(b => b.UserId)
                                    .ToDictionary(g => g.Key, g => g.ToList());

        return users.Select(u =>
        {
            var snapshot = latestSnapshots.GetValueOrDefault(u.Id);
            var income = incomeByUser.GetValueOrDefault(u.Id);
            var budgets = budgetByUser.GetValueOrDefault(u.Id, []);

            var monthlyExpenses = budgets
                .Where(b => b.Group is BudgetGroup.Fixed or BudgetGroup.Variable or BudgetGroup.Debt)
                .Sum(b => b.Amount);

            var monthlySavings = budgets
                .Where(b => b.Group == BudgetGroup.Savings)
                .Sum(b => b.Amount);

            // Savings and investments are derived from snapshot line items
            decimal savingsBalance = 0;
            decimal investmentsBalance = 0;
            if (snapshot?.LineItems is { Count: > 0 })
            {
                foreach (var item in snapshot.LineItems)
                {
                    if (item.Type != "Asset") continue;
                    var combined = (item.Category + " " + item.Group + " " + item.Name).ToLowerInvariant();
                    if (SavingsKeywords.Any(k => combined.Contains(k)))
                        savingsBalance += item.Value;
                    else if (InvestmentKeywords.Any(k => combined.Contains(k)))
                        investmentsBalance += item.Value;
                }
            }

            var monthlyIncome = income?.NetMonthlyIncome ?? 0;
            var hasProfile = snapshot != null && monthlyIncome > 0;

            return new UserFinancialData
            {
                UserId = u.Id,
                Age = u.Age,
                CreatedAt = u.CreatedAt,
                HasProfile = hasProfile,
                NetWorth = snapshot?.NetWorth,
                TotalAssets = snapshot?.TotalAssets,
                TotalLiabilities = snapshot?.TotalLiabilities,
                MonthlyIncome = monthlyIncome > 0 ? monthlyIncome : null,
                MonthlyExpenses = monthlyExpenses > 0 ? monthlyExpenses : null,
                MonthlySavings = monthlySavings > 0 ? monthlySavings : null,
                SavingsBalance = savingsBalance > 0 ? savingsBalance : null,
                InvestmentsBalance = investmentsBalance > 0 ? investmentsBalance : null,
                LastSnapshotAt = snapshot?.CreatedAt,
            };
        }).ToList();
    }

    // ── Calculate averages from a list of user data ───────────────────────────
    private static FinancialAverages CalcAverages(List<UserFinancialData> data)
    {
        static decimal Avg(IEnumerable<decimal?> values)
        {
            var list = values.Where(v => v.HasValue).Select(v => v!.Value).ToList();
            return list.Count > 0 ? list.Average() : 0;
        }

        var avgIncome = Avg(data.Select(d => d.MonthlyIncome));
        var avgExpenses = Avg(data.Select(d => d.MonthlyExpenses));
        var avgSavings = Avg(data.Select(d => d.MonthlySavings));
        var avgLiabilities = Avg(data.Select(d => d.TotalLiabilities));

        var savingsRate = avgIncome > 0 ? Math.Round(avgSavings / avgIncome * 100, 1) : 0;
        var dti = avgIncome > 0 ? Math.Round(avgLiabilities / (avgIncome * 12) * 100, 1) : 0;

        return new FinancialAverages(
            UserCount: data.Count,
            AvgNetWorth: Math.Round(Avg(data.Select(d => d.NetWorth)), 2),
            AvgTotalAssets: Math.Round(Avg(data.Select(d => d.TotalAssets)), 2),
            AvgTotalLiabilities: Math.Round(avgLiabilities, 2),
            AvgMonthlyIncome: Math.Round(avgIncome, 2),
            AvgMonthlyExpenses: Math.Round(avgExpenses, 2),
            AvgMonthlySavings: Math.Round(avgSavings, 2),
            AvgSavingsRate: savingsRate,
            AvgDebtToIncomeRatio: dti,
            AvgSavingsBalance: Math.Round(Avg(data.Select(d => d.SavingsBalance)), 2),
            AvgInvestmentsBalance: Math.Round(Avg(data.Select(d => d.InvestmentsBalance)), 2)
        );
    }

    // ── Global stats (min 30 users) ───────────────────────────────────────────
    public async Task<(bool HasEnoughData, string Message, FinancialAverages? Averages)> GetGlobalStatsAsync()
    {
        var all = await GetAllUserFinancialDataAsync();
        if (all.Count < MinUsersForStats)
            return (false,
                "Comparison data will unlock once enough anonymous user data is available.",
                null);

        return (true, string.Empty, CalcAverages(all));
    }

    // ── Per-bracket stats ─────────────────────────────────────────────────────
    public async Task<Dictionary<string, BracketStats>> GetBracketStatsAsync()
    {
        var all = await GetAllUserFinancialDataAsync();
        var brackets = new[] { "18-24", "25-34", "35-44", "45-54", "55-64", "65+" };

        return brackets.ToDictionary(b => b, b =>
        {
            var group = all.Where(u => GetAgeBracket(u.Age) == b).ToList();
            var hasData = group.Count >= MinUsersForStats;
            return new BracketStats(
                Bracket: b,
                Count: group.Count,
                HasEnoughData: hasData,
                Message: hasData
                    ? string.Empty
                    : "Comparison data will unlock once enough anonymous user data is available.",
                Averages: hasData ? CalcAverages(group) : null
            );
        });
    }

    // ── Per-bracket stats for a specific bracket ──────────────────────────────
    public async Task<BracketStats?> GetBracketStatsForAgeAsync(int age)
    {
        var bracket = GetAgeBracket(age);
        var all = await GetBracketStatsAsync();
        return all.GetValueOrDefault(bracket);
    }

    // ── Build comparison list for a single user ───────────────────────────────
    public UserComparisonResponse GetUserComparison(
        UserFinancialData userData, BracketStats bracketStats)
    {
        if (!bracketStats.HasEnoughData)
            return new UserComparisonResponse(
                AgeBracket: bracketStats.Bracket,
                HasEnoughData: false,
                Message: bracketStats.Message,
                Comparisons: []);

        var avgs = bracketStats.Averages!;
        var items = new List<UserComparisonItem>();

        void AddComparison(string category, string label, decimal? userVal, decimal avgVal, bool higherIsBetter)
        {
            if (userVal is null || avgVal == 0) return;
            var ratio = userVal.Value / avgVal;
            string status, message;

            if (higherIsBetter)
            {
                if (ratio >= 1.1m) { status = "above"; message = "You are ahead of the average in this category. Keep up the great work."; }
                else if (ratio >= 0.9m) { status = "at"; message = "You are right on track with the average in your age bracket. You are building momentum."; }
                else { status = "below"; message = "This is an area where you have room to improve. Small consistent progress here can make a big difference."; }
            }
            else
            {
                // Lower is better (e.g. expenses, liabilities)
                if (ratio <= 0.9m) { status = "above"; message = "You are doing better than average in this category. Keep it up."; }
                else if (ratio <= 1.1m) { status = "at"; message = "You are right on track with the average in your age bracket."; }
                else { status = "below"; message = "This is an area where reducing the balance over time can make a meaningful difference."; }
            }

            items.Add(new UserComparisonItem(category, label, Math.Round(userVal.Value, 2), Math.Round(avgVal, 2), status, message));
        }

        AddComparison("netWorth", "Net Worth", userData.NetWorth, avgs.AvgNetWorth, true);
        AddComparison("totalAssets", "Total Assets", userData.TotalAssets, avgs.AvgTotalAssets, true);
        AddComparison("totalLiabilities", "Total Debt", userData.TotalLiabilities, avgs.AvgTotalLiabilities, false);
        AddComparison("monthlyIncome", "Monthly Income", userData.MonthlyIncome, avgs.AvgMonthlyIncome, true);
        AddComparison("monthlyExpenses", "Monthly Expenses", userData.MonthlyExpenses, avgs.AvgMonthlyExpenses, false);
        AddComparison("savingsBalance", "Savings Balance", userData.SavingsBalance, avgs.AvgSavingsBalance, true);
        AddComparison("investmentsBalance", "Investments", userData.InvestmentsBalance, avgs.AvgInvestmentsBalance, true);

        return new UserComparisonResponse(
            AgeBracket: bracketStats.Bracket,
            HasEnoughData: true,
            Message: $"Compared to other users in the {bracketStats.Bracket} age bracket.",
            Comparisons: items);
    }
}
