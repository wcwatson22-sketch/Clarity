namespace Clarity.Api.Models;

/// <summary>
/// A public Learn article, managed through the admin CMS. Content is stored as
/// authored HTML and rendered with client-side sanitization (Angular strips
/// scripts/handlers), so drafts and edits never require a redeploy.
/// </summary>
public class LearnArticle
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;   // category id (e.g. "dti")
    public string Content { get; set; } = string.Empty;     // authored HTML body

    public string FeaturedImageUrl { get; set; } = string.Empty;
    public string SeoTitle { get; set; } = string.Empty;
    public string MetaDescription { get; set; } = string.Empty;

    public bool IsPublished { get; set; } = false;          // drafts default to unpublished
    public bool IsFeatured { get; set; } = false;
    /// <summary>none | standard (lending/DTI) | realestate | retirement</summary>
    public string DisclaimerType { get; set; } = "none";

    /// <summary>JSON array of related article slugs.</summary>
    public string RelatedArticleIds { get; set; } = "[]";
    public int SortOrder { get; set; } = 0;
    public int ReadingTimeMinutes { get; set; } = 3;
    public string AuthorName { get; set; } = "Clarity Financial Tools";

    public DateTime? PublishedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }
}
