namespace Clarity.Api.Models;

public class VariableMonth
{
    public string Month { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

/// <summary>A single retirement contribution input: either a % of gross or a $/month amount.</summary>
public class ContributionInput
{
    /// <summary>"pct" (percent of gross) or "amount" ($/month).</summary>
    public string Mode { get; set; } = "amount";
    public decimal Value { get; set; }
}

/// <summary>Retirement CONTRIBUTIONS (savings the user puts in) — not retirement income received.</summary>
public class RetirementContributions
{
    public ContributionInput Trad401k { get; set; } = new();
    public ContributionInput Roth401k { get; set; } = new();
    public ContributionInput TradIra { get; set; } = new();
    public ContributionInput RothIra { get; set; } = new();
    /// <summary>Employer match in $/month. Counts toward savings; never reduces take-home cash flow.</summary>
    public decimal EmployerMatchMonthly { get; set; }
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

    // ── Retirement contributions (mode + value per type) ────────────────────
    public string Trad401kMode { get; set; } = "amount";
    public decimal Trad401kValue { get; set; }
    public string Roth401kMode { get; set; } = "amount";
    public decimal Roth401kValue { get; set; }
    public string TradIraMode { get; set; } = "amount";
    public decimal TradIraValue { get; set; }
    public string RothIraMode { get; set; } = "amount";
    public decimal RothIraValue { get; set; }
    public decimal EmployerMatchMonthly { get; set; }

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

    public RetirementContributions Retirement { get; set; } = new();

    public static IncomeData FromEntity(UserIncome e) => new()
    {
        Type = e.Type,
        GrossMonthlyIncome = e.GrossMonthlyIncome,
        NetMonthlyIncome = e.NetMonthlyIncome,
        VariableMonths = e.VariableMonths,
        SecondaryEnabled = e.SecondaryEnabled,
        SecondaryGrossMonthly = e.SecondaryGrossMonthly,
        SecondaryNetMonthly = e.SecondaryNetMonthly,
        Retirement = new RetirementContributions
        {
            Trad401k = new() { Mode = e.Trad401kMode, Value = e.Trad401kValue },
            Roth401k = new() { Mode = e.Roth401kMode, Value = e.Roth401kValue },
            TradIra  = new() { Mode = e.TradIraMode,  Value = e.TradIraValue },
            RothIra  = new() { Mode = e.RothIraMode,  Value = e.RothIraValue },
            EmployerMatchMonthly = e.EmployerMatchMonthly,
        },
    };

    /// <summary>Copy DTO values onto the entity. Modes are validated to a safe allowlist.</summary>
    public void ApplyTo(UserIncome e)
    {
        static string M(string? m) => m == "pct" ? "pct" : "amount";
        static decimal NN(decimal v) => v < 0 ? 0 : v;   // never store negative financial inputs

        e.Type = Type;
        e.GrossMonthlyIncome = NN(GrossMonthlyIncome);
        e.NetMonthlyIncome = NN(NetMonthlyIncome);
        e.VariableMonths = VariableMonths;
        e.SecondaryEnabled = SecondaryEnabled;
        e.SecondaryGrossMonthly = NN(SecondaryGrossMonthly);
        e.SecondaryNetMonthly = NN(SecondaryNetMonthly);
        var r = Retirement ?? new RetirementContributions();
        e.Trad401kMode = M(r.Trad401k?.Mode); e.Trad401kValue = NN(r.Trad401k?.Value ?? 0);
        e.Roth401kMode = M(r.Roth401k?.Mode); e.Roth401kValue = NN(r.Roth401k?.Value ?? 0);
        e.TradIraMode  = M(r.TradIra?.Mode);  e.TradIraValue  = NN(r.TradIra?.Value ?? 0);
        e.RothIraMode  = M(r.RothIra?.Mode);  e.RothIraValue  = NN(r.RothIra?.Value ?? 0);
        e.EmployerMatchMonthly = NN(r.EmployerMatchMonthly);
    }
}
