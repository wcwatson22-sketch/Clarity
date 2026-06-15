using System.Diagnostics;

namespace Clarity.Api.Middleware;

/// <summary>
/// Logs a warning for any request that takes longer than <see cref="WarnThresholdMs"/>.
/// Helps distinguish cold-start delays from database query delays in production logs.
///
/// Safe to run in production:
///   - Does not log request/response bodies.
///   - Does not log authorization tokens.
///   - Does not log financial data.
///   - Only emits a warning line when the threshold is exceeded (zero noise when fast).
/// </summary>
public class SlowRequestMiddleware(RequestDelegate next, ILogger<SlowRequestMiddleware> logger)
{
    private const int WarnThresholdMs  = 500;   // warn at 500 ms
    private const int ErrorThresholdMs = 2000;  // escalate to error at 2 s

    public async Task InvokeAsync(HttpContext context)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            await next(context);
        }
        finally
        {
            sw.Stop();
            var ms      = sw.ElapsedMilliseconds;
            var method  = context.Request.Method;
            var path    = context.Request.Path.Value ?? "";
            var status  = context.Response.StatusCode;

            if (ms >= ErrorThresholdMs)
                logger.LogError("[SlowRequest] {Method} {Path} -> {Status} took {Ms}ms — investigate immediately",
                    method, path, status, ms);
            else if (ms >= WarnThresholdMs)
                logger.LogWarning("[SlowRequest] {Method} {Path} -> {Status} took {Ms}ms",
                    method, path, status, ms);
            // Under threshold: no log entry (Serilog request logging already covers normal requests)
        }
    }
}
