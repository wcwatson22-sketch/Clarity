using System.Text.RegularExpressions;

namespace Clarity.Api.Services;

/// <summary>
/// Defense-in-depth sanitizer for admin-authored article HTML stored in the DB.
/// Strips script/style/iframe/object/embed blocks, inline event handlers, and
/// javascript:/data: URLs. The public frontend ALSO renders article HTML through
/// Angular's sanitizer (which neutralizes scripts/handlers), so this is a second
/// layer to prevent stored XSS — not the only one.
/// </summary>
public static partial class HtmlSanitizer
{
    public static string Clean(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return string.Empty;
        var s = html;
        s = DangerousBlocks().Replace(s, string.Empty);   // <script>…</script>, <style>…</style>, etc.
        s = SelfClosingDanger().Replace(s, string.Empty);  // stray <iframe>/<embed>/<object> open tags
        s = EventHandlers().Replace(s, " ");               // on*="…" / on*='…'
        s = JsUris().Replace(s, "href=\"#\"");             // href="javascript:…"
        return s.Trim();
    }

    [GeneratedRegex(@"<\s*(script|style|iframe|object|embed|noscript)\b[^>]*>[\s\S]*?<\s*/\s*\1\s*>", RegexOptions.IgnoreCase)]
    private static partial Regex DangerousBlocks();

    [GeneratedRegex(@"<\s*/?\s*(script|style|iframe|object|embed|noscript|link|meta)\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex SelfClosingDanger();

    [GeneratedRegex(@"\son\w+\s*=\s*(""[^""]*""|'[^']*'|[^\s>]+)", RegexOptions.IgnoreCase)]
    private static partial Regex EventHandlers();

    [GeneratedRegex(@"(href|src)\s*=\s*(""|')\s*(javascript|data)\s*:[^""']*\2", RegexOptions.IgnoreCase)]
    private static partial Regex JsUris();
}
