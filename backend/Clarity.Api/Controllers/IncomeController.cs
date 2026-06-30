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
}
