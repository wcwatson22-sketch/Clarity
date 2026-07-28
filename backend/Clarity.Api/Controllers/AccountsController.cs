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
public class AccountsController(AppDbContext db) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.Accounts.Where(a => a.UserId == UserId).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Account account)
    {
        var rateError = ValidateRate(account);
        if (rateError is not null) return BadRequest(new { error = rateError });

        account.Id = Guid.NewGuid().ToString();
        account.UserId = UserId;
        // Only the Real Estate sync process (RealEstateController) may create
        // linked accounts — never trust a client-supplied link on manual create.
        account.LinkedPropertyId = null;
        account.LinkedPropertyRole = null;
        account.InterestRate = account.Type == AccountType.Liability ? account.InterestRate : null;
        account.UpdatedAt = DateTime.UtcNow;
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), account);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] Account account)
    {
        var existing = await db.Accounts.FirstOrDefaultAsync(a => a.Id == id && a.UserId == UserId);
        if (existing is null) return NotFound();

        var rateError = ValidateRate(account);
        if (rateError is not null) return BadRequest(new { error = rateError });

        existing.Name = account.Name;
        existing.Group = account.Group;
        existing.Category = account.Category;
        existing.InterestRate = existing.Type == AccountType.Liability ? account.InterestRate : null;

        // Real Estate is the source of truth for a linked account's Value — direct
        // edits here are ignored (blank/unknown here is fine; edit the property in
        // the Real Estate tab instead). LinkedPropertyId/Role can never be changed
        // through this endpoint — only the Real Estate delete/unlink flow can clear them.
        if (existing.LinkedPropertyId is null)
        {
            existing.Value = account.Value;
        }

        existing.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var existing = await db.Accounts.FirstOrDefaultAsync(a => a.Id == id && a.UserId == UserId);
        if (existing is null) return NotFound();
        if (existing.IsAnchor) return BadRequest(new { error = "This account is protected and cannot be deleted." });
        if (existing.LinkedPropertyId is not null)
            return BadRequest(new { error = "This account is linked to a Real Estate property. Manage it from the Real Estate tab." });
        db.Accounts.Remove(existing);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Optional field — null (unknown) is always allowed; if provided it must be a sensible percentage.</summary>
    private static string? ValidateRate(Account a) =>
        a.InterestRate is { } r && (r < 0 || r > 100) ? "Interest rate must be between 0 and 100." : null;
}
