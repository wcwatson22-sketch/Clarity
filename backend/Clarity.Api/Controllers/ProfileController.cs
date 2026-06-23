using System.Security.Claims;
using Clarity.Api.Data;
using Clarity.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace Clarity.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/profile")]
public class ProfileController(AppDbContext db, IConfiguration config) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var user = await db.Users.FindAsync(UserId);
        if (user is null) return Unauthorized();

        // Check email uniqueness if changed
        if (!user.Email.Equals(req.Email.ToLowerInvariant(), StringComparison.Ordinal))
        {
            if (db.Users.Any(u => u.Email == req.Email.ToLowerInvariant() && u.Id != UserId))
                return Conflict(new { error = "Email is already in use." });
            user.Email = req.Email.Trim().ToLowerInvariant();
            user.EmailVerified = false; // require re-verification if email changes
        }

        if (!string.IsNullOrWhiteSpace(req.FirstName))
            user.FirstName = req.FirstName.Trim();
        user.State = req.State.Trim();
        user.City = req.City.Trim();
        user.Age = req.Age;
        await db.SaveChangesAsync();

        return Ok(new MeResponse(user.Id, user.Username, user.FirstName, user.Email, user.State, user.City, user.Age, user.Tier.ToString(), user.EmailVerified, user.HasSeenOnboarding, user.IsAdmin, user.AnonymousId, user.TrialEndsAt, IsPaid: user.StripeSubscriptionId != null || user.AppleOriginalTransactionId != null, HasAcceptedTerms: user.HasAcceptedTerms, SetupCompletedAt: user.SetupCompletedAt));
    }

    // ── Complete Financial Setup ───────────────────────────────────────────────
    // Marks the user's starting baseline. Idempotent — does not overwrite an
    // existing completion timestamp.
    [HttpPost("complete-setup")]
    public async Task<IActionResult> CompleteSetup()
    {
        var user = await db.Users.FindAsync(UserId);
        if (user is null) return Unauthorized();
        user.SetupCompletedAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new MeResponse(user.Id, user.Username, user.FirstName, user.Email, user.State, user.City, user.Age, user.Tier.ToString(), user.EmailVerified, user.HasSeenOnboarding, user.IsAdmin, user.AnonymousId, user.TrialEndsAt, IsPaid: user.StripeSubscriptionId != null || user.AppleOriginalTransactionId != null, HasAcceptedTerms: user.HasAcceptedTerms, SetupCompletedAt: user.SetupCompletedAt));
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
            return BadRequest(new { error = "New password must be at least 6 characters." });

        var user = await db.Users.FindAsync(UserId);
        if (user is null) return Unauthorized();

        if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash))
            return BadRequest(new { error = "Current password is incorrect." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        await db.SaveChangesAsync();

        return Ok(new { message = "Password updated successfully." });
    }

    // ── Delete Account ────────────────────────────────────────────────────────
    [HttpDelete("me")]
    public async Task<IActionResult> DeleteAccount()
    {
        var userId = UserId;
        var user = await db.Users.FindAsync(userId);
        if (user is null) return Unauthorized();

        // Cancel Stripe subscription first (best effort — don't block deletion if it fails)
        if (user.StripeSubscriptionId is not null)
        {
            try
            {
                var secretKey = config["Stripe:SecretKey"];
                if (!string.IsNullOrWhiteSpace(secretKey))
                {
                    StripeConfiguration.ApiKey = secretKey;
                    var subService = new SubscriptionService();
                    await subService.CancelAsync(user.StripeSubscriptionId);
                }
            }
            catch { /* best effort — proceed with deletion regardless */ }
        }

        // Remove all related data (no cascade delete configured in EF).
        // Every user-owned table must be included here so account deletion never
        // leaves orphaned financial records behind.
        db.Accounts.RemoveRange(db.Accounts.Where(a => a.UserId == userId));
        db.BudgetItems.RemoveRange(db.BudgetItems.Where(b => b.UserId == userId));
        db.Snapshots.RemoveRange(db.Snapshots.Where(s => s.UserId == userId));
        db.EducationProgress.RemoveRange(db.EducationProgress.Where(e => e.UserId == userId));
        db.SurveyResponses.RemoveRange(db.SurveyResponses.Where(s => s.UserId == userId));
        db.ResetTokens.RemoveRange(db.ResetTokens.Where(t => t.UserId == userId));
        db.RealEstateProperties.RemoveRange(db.RealEstateProperties.Where(p => p.UserId == userId));

        var income = await db.Incomes.FirstOrDefaultAsync(i => i.UserId == userId);
        if (income is not null) db.Incomes.Remove(income);

        db.Users.Remove(user);
        await db.SaveChangesAsync();

        return Ok(new { message = "Account deleted successfully." });
    }
}
