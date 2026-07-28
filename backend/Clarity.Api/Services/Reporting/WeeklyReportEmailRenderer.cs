using System.Text;
using System.Web;

namespace Clarity.Api.Services.Reporting;

/// <summary>
/// Renders the weekly report payload into a single self-contained, responsive
/// HTML email (inline styles only — no external CSS/images beyond a color dot,
/// matching the existing EmailService templates). Never includes secrets or
/// individual user financial data — only the aggregated payload already
/// constructed by the orchestrator.
///
/// Deliberately concise: a small set of headline KPIs + the deterministic
/// commentary + top 3 content + issues/actions (only when non-empty). The full
/// breakdown data (device/country splits, per-event tables, full funnel, etc.)
/// still lives in the report's *Json columns for anyone who needs to dig in —
/// it's just no longer dumped into the default view, which was the complaint.
/// </summary>
public static class WeeklyReportEmailRenderer
{
    public static string Render(WeeklyReportPayload p)
    {
        static string Esc(string s) => HttpUtility.HtmlEncode(s);
        var sb = new StringBuilder();

        sb.Append($"""
            <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
                <div style="width:12px;height:12px;border-radius:50%;background:#1D9E75;"></div>
                <span style="font-size:17px;font-weight:700;">Clarity Weekly Report</span>
              </div>
              <p style="color:#6B7280;font-size:12.5px;margin:0 0 20px;">
                {Esc(p.PeriodStart.ToString("MMM d"))} – {Esc(p.PeriodEnd.ToString("MMM d, yyyy"))}
                &nbsp;vs.&nbsp; {Esc(p.PriorPeriodStart.ToString("MMM d"))} – {Esc(p.PriorPeriodEnd.ToString("MMM d, yyyy"))}
              </p>
            """);

        // ── Headline KPIs — the handful of numbers that actually matter week to week ──
        var kpis = new List<MetricPoint>();
        if (p.Website.Available) kpis.AddRange(p.Website.Data!.CoreMetrics.Where(m => m.Label == "Total Users"));
        if (p.Search.Available) kpis.AddRange(p.Search.Data!.CoreMetrics.Where(m => m.Label is "Organic Clicks" or "Organic Impressions"));
        kpis.AddRange(p.Business.UserGrowth.Where(m => m.Label == "New Registered Users"));
        kpis.AddRange(p.Business.SubscriptionGrowth.Where(m => m.Label == "New Premium Users"));

        if (kpis.Count > 0)
        {
            sb.Append("<div style=\"display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px;\">");
            foreach (var k in kpis) KpiCard(sb, k);
            sb.Append("</div>");
        }

        // ── Executive Summary — the deterministic commentary ──────────────────────
        Section(sb, "Executive Summary", () =>
        {
            sb.Append("<ul style=\"margin:0;padding-left:20px;color:#374151;font-size:13.5px;line-height:1.7;\">");
            foreach (var line in p.Commentary) sb.Append($"<li>{Esc(line)}</li>");
            sb.Append("</ul>");
        });

        // ── Top content — 3 items each, only if the source is available ───────────
        if ((p.Website.Available && p.Website.Data!.TopLandingPages.Count > 0) ||
            (p.Search.Available && p.Search.Data!.TopPages.Count > 0))
        {
            Section(sb, "Top Content", () =>
            {
                if (p.Website.Available) TopList(sb, "Top landing pages", p.Website.Data!.TopLandingPages, 3);
                if (p.Search.Available) TopList(sb, "Top organic queries", p.Search.Data!.TopQueries, 3);
            });
        }

        // ── App Store — only shown once it's actually configured ──────────────────
        if (p.AppStore.Available)
        {
            Section(sb, "App Store", () => MetricTable(sb, p.AppStore.Data!.DownloadMetrics.Where(m => m.Label == "Total Downloads").ToList()));
        }

        // ── Issues — only rendered when something is actually wrong ───────────────
        if (p.Errors.Count > 0)
        {
            Section(sb, "Issues", () =>
            {
                sb.Append("<ul style=\"margin:0;padding-left:20px;color:#B45309;font-size:13px;line-height:1.6;\">");
                foreach (var e in p.Errors) sb.Append($"<li>{Esc(e)}</li>");
                sb.Append("</ul>");
            });
        }

        // ── Recommended actions — only rendered when there's a real one ───────────
        if (p.RecommendedActions.Count > 0)
        {
            Section(sb, "Recommended Actions", () =>
            {
                sb.Append("<ul style=\"margin:0;padding-left:20px;color:#374151;font-size:13px;line-height:1.6;\">");
                foreach (var a in p.RecommendedActions) sb.Append($"<li>{Esc(a)}</li>");
                sb.Append("</ul>");
            });
        }

        sb.Append("""
              <p style="color:#9CA3AF;font-size:11px;margin-top:24px;">
                Aggregated metrics only. Full source-level detail is available in the Admin report archive.
                Never includes individual user financial data, names, or emails.
              </p>
            </div>
            """);
        return sb.ToString();
    }

    private static void KpiCard(StringBuilder sb, MetricPoint m)
    {
        var color = m.Change > 0 ? "#1D9E75" : m.Change < 0 ? "#EF4444" : "#6B7280";
        var changeStr = m.PercentChange is { } pc ? $"{(m.Change >= 0 ? "+" : "")}{pc}%" : (m.Change == 0 ? "—" : $"{(m.Change >= 0 ? "+" : "")}{m.Change:0.#}");
        sb.Append($"""
            <div style="flex:1 1 auto;min-width:110px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:12px 14px;">
              <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#9CA3AF;margin-bottom:4px;">{HttpUtility.HtmlEncode(m.Label)}</div>
              <div style="font-size:20px;font-weight:800;color:#111827;">{m.Current:0.#}</div>
              <div style="font-size:11.5px;font-weight:600;color:{color};">{changeStr}</div>
            </div>
            """);
    }

    private static void Section(StringBuilder sb, string title, Action body)
    {
        sb.Append($"""
            <div style="margin-bottom:20px;">
              <h2 style="font-size:13.5px;font-weight:700;color:#111827;border-bottom:1px solid #E5E7EB;padding-bottom:6px;margin:0 0 10px;">{HttpUtility.HtmlEncode(title)}</h2>
            """);
        body();
        sb.Append("</div>");
    }

    private static void MetricTable(StringBuilder sb, List<MetricPoint> metrics)
    {
        if (metrics.Count == 0) { sb.Append("<p style=\"font-size:12.5px;color:#9CA3AF;\">No data.</p>"); return; }
        sb.Append("<table style=\"width:100%;border-collapse:collapse;font-size:13px;\">");
        sb.Append("<tr style=\"color:#6B7280;text-align:left;\"><th style=\"padding:4px 0;\">Metric</th><th>Current</th><th>Prior</th><th>Change</th></tr>");
        foreach (var m in metrics)
        {
            var changeStr = m.PercentChange is { } pc ? $"{(m.Change >= 0 ? "+" : "")}{pc}%" : $"{(m.Change >= 0 ? "+" : "")}{m.Change:0.#}";
            var color = m.Change > 0 ? "#1D9E75" : m.Change < 0 ? "#EF4444" : "#6B7280";
            sb.Append($"<tr style=\"border-top:1px solid #F3F4F6;\"><td style=\"padding:6px 0;\">{HttpUtility.HtmlEncode(m.Label)}</td>" +
                       $"<td>{m.Current:0.##}</td><td>{m.Prior:0.##}</td><td style=\"color:{color};\">{changeStr}</td></tr>");
        }
        sb.Append("</table>");
    }

    private static void TopList(StringBuilder sb, string title, List<TopItem> items, int take)
    {
        if (items.Count == 0) return;
        sb.Append($"<p style=\"font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#6B7280;margin:10px 0 4px;\">{HttpUtility.HtmlEncode(title)}</p>");
        sb.Append("<ol style=\"margin:0 0 6px;padding-left:18px;color:#374151;font-size:13px;line-height:1.6;\">");
        foreach (var i in items.Take(take))
            sb.Append($"<li>{HttpUtility.HtmlEncode(i.Label)} — {i.Value:0.#}</li>");
        sb.Append("</ol>");
    }
}
