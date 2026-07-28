using Clarity.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Services.Reporting;

/// <summary>
/// In-process scheduler for the weekly performance report — runs inside the
/// same systemd-managed clarity-api process, so it needs no separate cron job
/// or systemd timer unit, survives app restarts (duplicate-run guard is
/// DB-backed, not in-memory), and requires no developer machine to be on.
///
/// Checks hourly whether it's Monday 8:00-8:59 AM in the configured business
/// timezone (WEEKLY_REPORT_TIMEZONE, default America/New_York) and whether a
/// report for the most recently completed week doesn't already exist yet.
///
/// SAFETY: this hosted service is inert (never sends a real email) until
/// WEEKLY_REPORT_RECIPIENT is configured — see WeeklyReportOrchestratorService.
/// Per the rollout plan, do not set that variable in production until every
/// source's numbers have been manually reconciled against its own dashboard.
/// </summary>
public class WeeklyReportHostedService(IServiceScopeFactory scopeFactory, IConfiguration config, ILogger<WeeklyReportHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); // let the app finish starting

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await MaybeRunAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[WeeklyReport] Scheduler tick failed");
            }
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task MaybeRunAsync(CancellationToken ct)
    {
        var tz = ResolveTimeZone();
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        if (localNow.DayOfWeek != DayOfWeek.Monday || localNow.Hour != 8) return;

        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var (start, end) = WeeklyReportOrchestratorService.GetMostRecentCompletedWeek(DateTime.UtcNow);

        // DB-backed duplicate guard — survives restarts within the same hour window.
        var alreadyRan = await db.WeeklyReports.AnyAsync(r => r.PeriodStart == start && r.PeriodEnd == end, ct);
        if (alreadyRan) return;

        logger.LogInformation("[WeeklyReport] Running scheduled weekly report for {Start} to {End}", start, end);
        var orchestrator = scope.ServiceProvider.GetRequiredService<WeeklyReportOrchestratorService>();
        await orchestrator.RunAsync(triggeredManually: false, ct);
    }

    private TimeZoneInfo ResolveTimeZone()
    {
        var id = config["WEEKLY_REPORT_TIMEZONE"] ?? "America/New_York";
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch (TimeZoneNotFoundException)
        {
            logger.LogWarning("[WeeklyReport] Unknown timezone '{Id}' — falling back to America/New_York", id);
            return TimeZoneInfo.FindSystemTimeZoneById("America/New_York");
        }
    }
}
