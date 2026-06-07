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
        return Ok(prop);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var prop = await db.RealEstateProperties.FirstOrDefaultAsync(p => p.Id == id && p.UserId == UserId);
        if (prop is null) return NotFound();
        db.RealEstateProperties.Remove(prop);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
