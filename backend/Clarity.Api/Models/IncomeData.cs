namespace Clarity.Api.Models;

public class VariableMonth
{
    public string Month { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

/// <summary>
/// A single retirement contribution the user has chosen to track. Each item
/// belongs to one income source (so a spouse's contribution rate/amount is
/// tracked and calculated independently from the primary earner's) and is
/// entered as either a % of that income source's gross or a flat $/month.
/// </summary>
public class RetirementItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>"primary" or "secondary" — which income this contribution is based on.</summary>
    public string IncomeSource { get; set; } = "primary";
    /// <summary>"trad401k" | "roth401k" | "tradIra" | "rothIra".</summary>
    public string Type { get; set; } = "trad401k";
    /// <summary>"pct" (percent of that income source's gross) or "amount" ($/month).</summary>
    public string Mode { get; set; } = "amount";
    public decimal Value { get; set; }
}

/// <summary>
/// One tier of an employer match formula. Real 401(k) matches are almost always
/// tiered percentages of the employee's OWN contribution rate, e.g. "100% of the
/// first 3% you contribute, plus 50% of the next 2%" is two tiers:
/// {MatchPercent=100, ContributionPercent=3}, {MatchPercent=50, ContributionPercent=2}.
/// Tiers apply in order against the employee's combined contribution rate (as a
/// % of that income source's gross), each tier consuming its slice before the next applies.
/// </summary>
public class MatchTier
{
    public decimal MatchPercent { get; set; }
    public decimal ContributionPercent { get; set; }
}

/// <summary>EF Core entity — stored in DB per user. Secondary income + retirement are
/// flattened to columns so they persist server-side and can feed Dashboard/PFS/Compare.</summary>
public class UserIncome
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Type { get; set; } = "stable";
    public decimal GrossMonthlyIncome { get; set; }
    public decimal NetMonthlyIncome { get; set; }
    public List<VariableMonth> VariableMonths { get; set; } = [];

    // ── Secondary / spousal income ──────────────────────────────────────────
    public bool SecondaryEnabled { get; set; }
    public decimal SecondaryGrossMonthly { get; set; }
    public decimal SecondaryNetMonthly { get; set; }

    // ── Retirement contributions — per income source, user-managed list ─────
    public List<RetirementItem> RetirementItems { get; set; } = [];
    public List<MatchTier> EmployerMatchTiersPrimary { get; set; } = [];
    public List<MatchTier> EmployerMatchTiersSecondary { get; set; } = [];

    // ── Legacy (pre-2026-07 "single shared set of 4") — read once for a
    // one-time migration in IncomeController, then zeroed. Kept only so
    // existing users' data is never lost; new saves never write these again. ──
    public string Trad401kMode { get; set; } = "amount";
    public decimal Trad401kValue { get; set; }
    public string Roth401kMode { get; set; } = "amount";
    public decimal Roth401kValue { get; set; }
    public string TradIraMode { get; set; } = "amount";
    public decimal TradIraValue { get; set; }
    public string RothIraMode { get; set; } = "amount";
    public decimal RothIraValue { get; set; }
    public decimal EmployerMatchMonthly { get; set; }

    // ── Legacy (2026-07, briefly-live flat $/mo match) — read once for a
    // one-time migration to a tiered formula, then zeroed. ──
    public decimal EmployerMatchPrimaryMonthly { get; set; }
    public decimal EmployerMatchSecondaryMonthly { get; set; }

    public User? User { get; set; }
}

/// <summary>API DTO — what the frontend sends and receives.</summary>
public class IncomeData
{
    public string Type { get; set; } = "stable";
    public decimal GrossMonthlyIncome { get; set; }
    public decimal NetMonthlyIncome { get; set; }
    public List<VariableMonth> VariableMonths { get; set; } = [];

    public bool SecondaryEnabled { get; set; }
    public decimal SecondaryGrossMonthly { get; set; }
    public decimal SecondaryNetMonthly { get; set; }

    public List<RetirementItem> RetirementItems { get; set; } = [];
    public List<MatchTier> EmployerMatchTiersPrimary { get; set; } = [];
    public List<MatchTier> EmployerMatchTiersSecondary { get; set; } = [];

    public static IncomeData FromEntity(UserIncome e) => new()
    {
        Type = e.Type,
        GrossMonthlyIncome = e.GrossMonthlyIncome,
        NetMonthlyIncome = e.NetMonthlyIncome,
        VariableMonths = e.VariableMonths,
        SecondaryEnabled = e.SecondaryEnabled,
        SecondaryGrossMonthly = e.SecondaryGrossMonthly,
        SecondaryNetMonthly = e.SecondaryNetMonthly,
        RetirementItems = e.RetirementItems,
        EmployerMatchTiersPrimary = e.EmployerMatchTiersPrimary,
        EmployerMatchTiersSecondary = e.EmployerMatchTiersSecondary,
    };

    private static readonly HashSet<string> ValidTypes = ["trad401k", "roth401k", "tradIra", "rothIra"];

    /// <summary>Copy DTO values onto the entity. Modes/types/sources are validated to a safe allowlist.</summary>
    public void ApplyTo(UserIncome e)
    {
        static string Mode(string? m) => m == "pct" ? "pct" : "amount";
        static string Source(string? s) => s == "secondary" ? "secondary" : "primary";
        static decimal NN(decimal v) => v < 0 ? 0 : v;   // never store negative financial inputs
        static List<MatchTier> Tiers(List<MatchTier>? tiers) => (tiers ?? [])
            .Select(t => new MatchTier { MatchPercent = NN(t.MatchPercent), ContributionPercent = NN(t.ContributionPercent) })
            .Where(t => t.ContributionPercent > 0)
            .ToList();

        e.Type = Type;
        e.GrossMonthlyIncome = NN(GrossMonthlyIncome);
        e.NetMonthlyIncome = NN(NetMonthlyIncome);
        e.VariableMonths = VariableMonths;
        e.SecondaryEnabled = SecondaryEnabled;
        e.SecondaryGrossMonthly = NN(SecondaryGrossMonthly);
        e.SecondaryNetMonthly = NN(SecondaryNetMonthly);

        e.RetirementItems = (RetirementItems ?? [])
            .Where(i => ValidTypes.Contains(i.Type))
            .Select(i => new RetirementItem
            {
                Id = string.IsNullOrWhiteSpace(i.Id) ? Guid.NewGuid().ToString() : i.Id,
                IncomeSource = Source(i.IncomeSource),
                Type = i.Type,
                Mode = Mode(i.Mode),
                Value = NN(i.Value),
            })
            .ToList();
        e.EmployerMatchTiersPrimary = Tiers(EmployerMatchTiersPrimary);
        e.EmployerMatchTiersSecondary = Tiers(EmployerMatchTiersSecondary);
    }
}
