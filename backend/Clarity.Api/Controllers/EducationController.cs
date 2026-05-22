using System.Security.Claims;
using Clarity.Api.Data;
using Clarity.Api.Models;
using Clarity.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Clarity.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class EducationController(AppDbContext db) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("lessons")]
    public IActionResult GetLessons() => Ok(LessonStore.All);

    [HttpGet("progress")]
    public async Task<IActionResult> GetProgress()
    {
        var progress = await db.EducationProgress.Where(p => p.UserId == UserId).ToListAsync();
        // Map to the DTO shape the frontend expects
        return Ok(progress.Select(p => new
        {
            articleId = p.ArticleId,
            completed = p.Completed,
            bookmarked = p.Bookmarked,
            helpful = p.Helpful
        }));
    }

    [HttpPut("progress/{articleId}")]
    public async Task<IActionResult> UpsertProgress(string articleId, [FromBody] ProgressDto dto)
    {
        var existing = await db.EducationProgress
            .FirstOrDefaultAsync(p => p.UserId == UserId && p.ArticleId == articleId);

        if (existing is null)
        {
            existing = new UserEducationProgress { UserId = UserId, ArticleId = articleId };
            db.EducationProgress.Add(existing);
        }
        existing.Completed = dto.Completed;
        existing.Bookmarked = dto.Bookmarked;
        existing.Helpful = dto.Helpful;
        await db.SaveChangesAsync();

        return Ok(new { articleId = existing.ArticleId, completed = existing.Completed, bookmarked = existing.Bookmarked, helpful = existing.Helpful });
    }

    [HttpPost("survey")]
    public async Task<IActionResult> SubmitSurvey([FromBody] SurveyResponse response)
    {
        response.Id = Guid.NewGuid().ToString();
        response.UserId = UserId;
        response.SubmittedAt = DateTime.UtcNow;
        db.SurveyResponses.Add(response);
        await db.SaveChangesAsync();
        return Ok(response);
    }
}

public record ProgressDto(bool Completed, bool Bookmarked, bool? Helpful);
