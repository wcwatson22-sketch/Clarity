using System.Security.Claims;
using Clarity.Api.Data;
using Clarity.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/real-estate")]
public class RealEstateController(AppDbContext db) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.RealEstateProperties
            .Where(p => p.UserId == UserId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetOne(string id)
    {
        var prop = await db.RealEstateProperties.FirstOrDefaultAsync(p => p.Id == id && p.UserId == UserId);
        return prop is null ? NotFound() : Ok(prop);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] RealEstateProperty prop)
    {
        prop.Id        = Guid.NewGuid().ToString();
        prop.UserId    = UserId;
        prop.CreatedAt = DateTime.UtcNow;
        prop.UpdatedAt = DateTime.UtcNow;
        db.RealEstateProperties.Add(prop);
        await db.SaveChangesAsync();
        await SyncLinkedAccountsAsync(prop, isNew: true);
        return Ok(prop);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] RealEstateProperty updated)
    {
        var prop = await db.RealEstateProperties.FirstOrDefaultAsync(p => p.Id == id && p.UserId == UserId);
        if (prop is null) return NotFound();

        prop.Address              = updated.Address;
        prop.PropertyType         = updated.PropertyType;
        prop.SquareFeet           = updated.SquareFeet;
        prop.Bedrooms             = updated.Bedrooms;
        prop.Bathrooms            = updated.Bathrooms;
        prop.YearBuilt            = updated.YearBuilt;
        prop.PurchasePrice        = updated.PurchasePrice;
        prop.AppraisedValue       = updated.AppraisedValue;
        prop.GrossMonthlyRent     = updated.GrossMonthlyRent;
        prop.VacancyRate          = updated.VacancyRate;
        prop.OtherMonthlyIncome   = updated.OtherMonthlyIncome;
        prop.ManagementFee        = updated.ManagementFee;
        prop.ManagementFeeIsPercent = updated.ManagementFeeIsPercent;
        prop.Repairs              = updated.Repairs;
        prop.RepairReserve        = updated.RepairReserve;
        prop.CapExReserve         = updated.CapExReserve;
        prop.PropertyTaxes        = updated.PropertyTaxes;
        prop.Insurance            = updated.Insurance;
        prop.HoaFees              = updated.HoaFees;
        prop.Utilities            = updated.Utilities;
        prop.LegalFees            = updated.LegalFees;
        prop.Cleaning             = updated.Cleaning;
        prop.OtherExpenses        = updated.OtherExpenses;
        prop.LoanAmount           = updated.LoanAmount;
        prop.InterestRate         = updated.InterestRate;
        prop.AmortizationYears    = updated.AmortizationYears;
        prop.AnnualRentGrowthPct  = updated.AnnualRentGrowthPct;
        prop.AnnualAppreciationPct = updated.AnnualAppreciationPct;
        prop.UpdatedAt            = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await SyncLinkedAccountsAsync(prop, isNew: false);
        return Ok(prop);
    }

    /// <summary>
    /// Deletes a property. If Dashboard records are linked to it, the caller must
    /// say what to do with them first — this endpoint never silently deletes or
    /// silently detaches a user's Dashboard data.
    ///
    /// linkedAccounts: "delete" removes the linked Dashboard records too;
    /// "unlink" (default when omitted but linked records exist after confirmation)
    /// detaches them so they remain as ordinary, independently-editable records.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, [FromQuery] string? linkedAccounts)
    {
        var prop = await db.RealEstateProperties.FirstOrDefaultAsync(p => p.Id == id && p.UserId == UserId);
        if (prop is null) return NotFound();

        var linked = await db.Accounts.Where(a => a.UserId == UserId && a.LinkedPropertyId == id).ToListAsync();

        if (linked.Count > 0 && linkedAccounts is null)
        {
            return Conflict(new
            {
                requiresConfirmation = true,
                message = "This property has linked Dashboard records. Choose whether to delete or keep them.",
                linkedAccounts = linked.Select(a => new { a.Id, a.Name, a.Type, a.Value }),
            });
        }

        if (linkedAccounts == "delete")
        {
            db.Accounts.RemoveRange(linked);
        }
        else
        {
            // Default / "unlink": detach so the records survive as independent,
            // user-owned Dashboard data — never orphaned, never silently destroyed.
            foreach (var a in linked)
            {
                a.LinkedPropertyId = null;
                a.LinkedPropertyRole = null;
                a.UpdatedAt = DateTime.UtcNow;
            }
        }

        db.RealEstateProperties.Remove(prop);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ── Dashboard sync ───────────────────────────────────────────────────────
    // The Real Estate record is the source of truth for a linked property's asset
    // value and debt balance. This keeps net worth, PFS, and Loan Prep consistent
    // with the Real Estate tab without the user re-entering the same figures.
    private async Task SyncLinkedAccountsAsync(RealEstateProperty prop, bool isNew)
    {
        var linked = await db.Accounts
            .Where(a => a.UserId == prop.UserId && a.LinkedPropertyId == prop.Id)
            .ToListAsync();
        var asset     = linked.FirstOrDefault(a => a.LinkedPropertyRole == "asset");
        var liability = linked.FirstOrDefault(a => a.LinkedPropertyRole == "liability");
        var label     = string.IsNullOrWhiteSpace(prop.Address) ? "Property" : prop.Address;

        if (asset is null)
        {
            db.Accounts.Add(new Account
            {
                UserId = prop.UserId, Type = AccountType.Asset,
                Group = "Real Estate", Category = "investment-property",
                Name = $"Real Estate: {label}", Value = prop.AppraisedValue,
                LinkedPropertyId = prop.Id, LinkedPropertyRole = "asset",
                UpdatedAt = DateTime.UtcNow,
            });
        }
        else
        {
            asset.Value = prop.AppraisedValue;
            if (isNew) asset.Name = $"Real Estate: {label}";   // only set the label at creation — respect later renames
            asset.UpdatedAt = DateTime.UtcNow;
        }

        if (prop.LoanAmount > 0)
        {
            if (liability is null)
            {
                db.Accounts.Add(new Account
                {
                    UserId = prop.UserId, Type = AccountType.Liability,
                    Group = "Mortgages", Category = "mortgage-invest",
                    Name = $"Mortgage: {label}", Value = prop.LoanAmount,
                    InterestRate = prop.InterestRate,
                    LinkedPropertyId = prop.Id, LinkedPropertyRole = "liability",
                    UpdatedAt = DateTime.UtcNow,
                });
            }
            else
            {
                liability.Value = prop.LoanAmount;
                liability.InterestRate = prop.InterestRate;
                if (isNew) liability.Name = $"Mortgage: {label}";
                liability.UpdatedAt = DateTime.UtcNow;
            }
        }
        else if (liability is not null)
        {
            // Loan paid off / removed on the property — the system-created
            // liability no longer applies. Safe to remove: it is a synced,
            // system-owned record, not independently user-entered data.
            db.Accounts.Remove(liability);
        }

        await db.SaveChangesAsync();
    }
}
