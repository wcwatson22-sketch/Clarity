using Clarity.Api.Data;
using Clarity.Api.Models;
using Clarity.Api.Services.Reporting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Controllers;

/// <summary>
/// Admin-only weekly report archive. Every endpoint requires the AdminOnly
/// policy, enforced server-side (regular/anonymous users get 401/403, never a
/// silently-filtered 200). Reports contain aggregated metrics only.
/// </summary>
[ApiController]
[Route("api/admin/reports/weekly")]
[Authorize(Policy = "AdminOnly")]
public class AdminReportsController(AppDbContext db, WeeklyReportOrchestratorService orchestrator, ILogger<AdminReportsController> logger) : ControllerBase
{
    // In-process lock so a second "Run Now" click can't start an overlapping run.
    private static readonly SemaphoreSlim RunLock = new(1, 1);

    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.WeeklyReports.AsNoTracking()
            .OrderByDescending(r => r.PeriodStart)
            .Select(r => new
            {
                r.Id, r.PeriodStart, r.PeriodEnd, r.GeneratedAt, r.Status,
                r.DeliveryStatus, r.ErrorSummary, r.TriggeredManually,
            })
            .ToListAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var r = await db.WeeklyReports.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        return r is null ? NotFound(new { error = "Report not found." }) : Ok(r);
    }

    [HttpPost("run-now")]
    public async Task<IActionResult> RunNow()
    {
        if (!await RunLock.WaitAsync(0))
            return Conflict(new { error = "A report run is already in progress." });
        try
        {
            var report = await orchestrator.RunAsync(triggeredManually: true);
            return Ok(new { report.Id, report.Status, report.DeliveryStatus, report.ErrorSummary });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[AdminReports] Manual run failed");
            return StatusCode(500, new { error = "Report generation failed. Check server logs for details." });
        }
        finally { RunLock.Release(); }
    }

    [HttpPost("{id:int}/resend")]
    public async Task<IActionResult> Resend(int id)
    {
        var report = await orchestrator.ResendAsync(id);
        if (report is null) return NotFound(new { error = "Report not found or has no content to send." });
        return Ok(new { report.Id, report.DeliveryStatus });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var report = await db.WeeklyReports.FindAsync(id);
        if (report is null) return NotFound(new { error = "Report not found." });
        db.WeeklyReports.Remove(report);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
