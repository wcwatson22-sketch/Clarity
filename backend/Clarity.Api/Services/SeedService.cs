using Clarity.Api.Data;
using Clarity.Api.Models;

namespace Clarity.Api.Services;

/// <summary>
/// Seeds minimal blank data for a brand-new user.
/// No placeholder numbers — everything starts at zero.
/// </summary>
public class SeedService(AppDbContext db)
{
    // Last 6 calendar months (for the variable income grid)
    private static List<VariableMonth> BlankVariableMonths()
    {
        var months = new List<VariableMonth>();
        var now = DateTime.UtcNow;
        for (int i = 5; i >= 0; i--)
        {
            var m = now.AddMonths(-i);
            months.Add(new VariableMonth { Month = m.ToString("yyyy-MM"), Amount = 0 });
        }
        return months;
    }

    public async Task SeedUserAsync(int userId)
    {
        // Blank income record — user fills in their own numbers
        db.Incomes.Add(new UserIncome
        {
            UserId = userId,
            Type = "stable",
            GrossMonthlyIncome = 0,
            NetMonthlyIncome = 0,
            VariableMonths = BlankVariableMonths(),
        });

        await db.SaveChangesAsync();
    }
}
