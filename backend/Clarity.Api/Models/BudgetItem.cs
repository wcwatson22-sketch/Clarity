namespace Clarity.Api.Models;

public enum BudgetGroup { Fixed, Variable, Debt, Savings }

public class BudgetItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public int UserId { get; set; }
    public BudgetGroup Group { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Amount { get; set; }

    // Per-item monthly budget — used only by Variable expenses (planning value).
    // Null = "No budget set". Never counted as an actual expense.
    public decimal? Budget { get; set; }

    // Optional free-text category (Variable items). Null when unused.
    public string? Category { get; set; }

    public User? User { get; set; }
}
