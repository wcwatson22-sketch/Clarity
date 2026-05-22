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
        account.Id = Guid.NewGuid().ToString();
        account.UserId = UserId;
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
        existing.Name = account.Name;
        existing.Value = account.Value;
        existing.Group = account.Group;
        existing.Category = account.Category;
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
        db.Accounts.Remove(existing);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
