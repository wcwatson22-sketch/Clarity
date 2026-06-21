namespace Clarity.Api.Models;

/// <summary>
/// Records administrative actions on Learn content. Intentionally stores only
/// metadata (who/what/when) — never full article bodies.
/// </summary>
public class AdminAuditLog
{
    public int Id { get; set; }
    public int ActorUserId { get; set; }
    public string ActorUsername { get; set; } = string.Empty;
    /// <summary>created | edited | published | unpublished | deleted</summary>
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = "learn-article";
    public int? EntityId { get; set; }
    public string EntitySlug { get; set; } = string.Empty;
    /// <summary>Short, non-sensitive note (e.g. the article title). Never the body.</summary>
    public string Detail { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
