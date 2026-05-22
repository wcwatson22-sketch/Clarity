namespace Clarity.Api.Models;

public class Lesson
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int ReadTime { get; set; }
    public string Content { get; set; } = string.Empty;
}

public class UserEducationProgress
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string ArticleId { get; set; } = string.Empty;
    public bool Completed { get; set; }
    public bool Bookmarked { get; set; }
    public bool? Helpful { get; set; }

    public User? User { get; set; }
}
