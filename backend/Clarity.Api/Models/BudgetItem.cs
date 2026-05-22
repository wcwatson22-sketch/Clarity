namespace Clarity.Api.Models;

public enum BudgetGroup { Fixed, Variable, Debt, Savings }

public class BudgetItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public int UserId { get; set; }
    public BudgetGroup Group { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Amount { get; set; }

    public User? User { get; set; }
}
