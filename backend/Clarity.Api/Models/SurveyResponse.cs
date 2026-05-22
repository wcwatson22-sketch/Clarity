namespace Clarity.Api.Models;

public class SurveyResponse
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public int UserId { get; set; }
    public List<string> Topics { get; set; } = [];
    public string FreeText { get; set; } = string.Empty;
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}
