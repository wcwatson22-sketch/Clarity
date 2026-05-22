namespace Clarity.Api.Models;

public class VariableMonth
{
    public string Month { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

/// <summary>EF Core entity — stored in DB per user.</summary>
public class UserIncome
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Type { get; set; } = "stable";
    public decimal GrossMonthlyIncome { get; set; }
    public decimal NetMonthlyIncome { get; set; }
    public List<VariableMonth> VariableMonths { get; set; } = [];

    public User? User { get; set; }
}

/// <summary>API DTO — what the frontend sends and receives.</summary>
public class IncomeData
{
    public string Type { get; set; } = "stable";
    public decimal GrossMonthlyIncome { get; set; }
    public decimal NetMonthlyIncome { get; set; }
    public List<VariableMonth> VariableMonths { get; set; } = [];

    public static IncomeData FromEntity(UserIncome e) => new()
    {
        Type = e.Type,
        GrossMonthlyIncome = e.GrossMonthlyIncome,
        NetMonthlyIncome = e.NetMonthlyIncome,
        VariableMonths = e.VariableMonths,
    };
}
