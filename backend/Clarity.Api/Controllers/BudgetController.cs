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
public class BudgetController(AppDbContext db) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.BudgetItems.Where(b => b.UserId == UserId).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BudgetItem item)
    {
        item.Id = Guid.NewGuid().ToString();
        item.UserId = UserId;
        db.BudgetItems.Add(item);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), item);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] BudgetItem item)
    {
        var existing = await db.BudgetItems.FirstOrDefaultAsync(b => b.Id == id && b.UserId == UserId);
        if (existing is null) return NotFound();
        existing.Name = item.Name;
        existing.Amount = item.Amount;
        existing.Group = item.Group;
        await db.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var existing = await db.BudgetItems.FirstOrDefaultAsync(b => b.Id == id && b.UserId == UserId);
        if (existing is null) return NotFound();
        db.BudgetItems.Remove(existing);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
