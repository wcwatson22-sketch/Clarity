using System.Security.Claims;
using Clarity.Api.Data;
using Clarity.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class IncomeController(AppDbContext db) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var record = await db.Incomes.FirstOrDefaultAsync(i => i.UserId == UserId);
        if (record is null) return Ok(new IncomeData());
        await MigrateLegacyRetirementAsync(record);
        await MigrateFlatMatchToTiersAsync(record);
        return Ok(IncomeData.FromEntity(record));
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] IncomeData dto)
    {
        var record = await db.Incomes.FirstOrDefaultAsync(i => i.UserId == UserId);
        if (record is null)
        {
            record = new UserIncome { UserId = UserId };
            db.Incomes.Add(record);
        }
        dto.ApplyTo(record);
        await db.SaveChangesAsync();
        return Ok(IncomeData.FromEntity(record));
    }

    /// <summary>
    /// One-time migration from the old "single shared set of 4 contribution
    /// types" shape into the new per-income-source item list. Everything
    /// migrates as "primary" — we never guess which legacy value belonged to a
    /// spouse's income; the user assigns that themselves going forward. Runs
    /// only while RetirementItems is still empty, and zeroes the legacy columns
    /// immediately after so a later intentional "remove all items" can never be
    /// mistaken for not-yet-migrated data and get resurrected.
    /// </summary>
    private async Task MigrateLegacyRetirementAsync(UserIncome e)
    {
        var hasLegacyData = e.Trad401kValue > 0 || e.Roth401kValue > 0 || e.TradIraValue > 0
            || e.RothIraValue > 0 || e.EmployerMatchMonthly > 0;
        if (e.RetirementItems.Count > 0 || !hasLegacyData) return;

        var items = new List<RetirementItem>();
        void Add(string type, string mode, decimal value)
        {
            if (value > 0) items.Add(new RetirementItem { IncomeSource = "primary", Type = type, Mode = mode, Value = value });
        }
        Add("trad401k", e.Trad401kMode, e.Trad401kValue);
        Add("roth401k", e.Roth401kMode, e.Roth401kValue);
        Add("tradIra",  e.TradIraMode,  e.TradIraValue);
        Add("rothIra",  e.RothIraMode,  e.RothIraValue);

        e.RetirementItems = items;
        e.EmployerMatchPrimaryMonthly = e.EmployerMatchMonthly;
        e.Trad401kValue = 0; e.Roth401kValue = 0; e.TradIraValue = 0; e.RothIraValue = 0;
        e.EmployerMatchMonthly = 0;
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// One-time migration from the brief flat "$/mo employer match" shape into a
    /// tiered match formula. We can't recover the user's real plan tiers from a
    /// single dollar figure, so we convert it into an equivalent single tier —
    /// "100% match up to X% contributed" — where X exactly reproduces today's
    /// dollar amount at their current contribution rate. The user can then edit
    /// it to reflect their actual plan's real tier structure going forward.
    /// Runs only while the tier lists are still empty, and zeroes the flat
    /// columns immediately after.
    /// </summary>
    private async Task MigrateFlatMatchToTiersAsync(UserIncome e)
    {
        var changed = false;

        if (e.EmployerMatchTiersPrimary.Count == 0 && e.EmployerMatchPrimaryMonthly > 0)
        {
            if (e.GrossMonthlyIncome > 0)
            {
                var pct = Math.Round(e.EmployerMatchPrimaryMonthly / e.GrossMonthlyIncome * 100, 2);
                if (pct > 0) e.EmployerMatchTiersPrimary = [new MatchTier { MatchPercent = 100, ContributionPercent = pct }];
            }
            e.EmployerMatchPrimaryMonthly = 0;
            changed = true;
        }

        if (e.EmployerMatchTiersSecondary.Count == 0 && e.EmployerMatchSecondaryMonthly > 0)
        {
            if (e.SecondaryGrossMonthly > 0)
            {
                var pct = Math.Round(e.EmployerMatchSecondaryMonthly / e.SecondaryGrossMonthly * 100, 2);
                if (pct > 0) e.EmployerMatchTiersSecondary = [new MatchTier { MatchPercent = 100, ContributionPercent = pct }];
            }
            e.EmployerMatchSecondaryMonthly = 0;
            changed = true;
        }

        if (changed) await db.SaveChangesAsync();
    }
}
