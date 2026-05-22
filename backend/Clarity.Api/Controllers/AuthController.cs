using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Clarity.Api.Data;
using Clarity.Api.Models;
using Clarity.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Clarity.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    AppDbContext db,
    SeedService seed,
    EmailService email,
    IConfiguration config,
    IWebHostEnvironment env) : ControllerBase
{
    // ── Signup ────────────────────────────────────────────────────────────────
    [EnableRateLimiting("auth")]
    [HttpPost("signup")]
    public async Task<IActionResult> Signup([FromBody] SignupRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || req.Username.Length < 3)
            return BadRequest(new { error = "Username must be at least 3 characters." });
        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
            return BadRequest(new { error = "Password must be at least 6 characters." });
        if (req.Age < 18 || req.Age > 120)
            return BadRequest(new { error = "Age must be between 18 and 120." });
        if (await db.Users.AnyAsync(u => u.Username == req.Username))
            return Conflict(new { error = "Username is already taken." });
        if (await db.Users.AnyAsync(u => u.Email == req.Email.ToLowerInvariant()))
            return Conflict(new { error = "Email is already registered." });

        var verifyToken = GenerateToken(32);

        var user = new User
        {
            Username = req.Username.Trim(),
            FirstName = req.FirstName.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Email = req.Email.Trim().ToLowerInvariant(),
            State = req.State.Trim(),
            City = req.City.Trim(),
            Age = req.Age,
            VerificationToken = verifyToken,
            EmailVerified = false,
            HasAcceptedTerms = true,             // user checked the box at signup
            TermsAcceptedAt = DateTime.UtcNow,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        // Assign sequential anonymous ID after DB assigns the user's PK
        user.AnonymousId = $"User {user.Id:D3}";
        await db.SaveChangesAsync();

        // Seed default financial data for this new user
        await seed.SeedUserAsync(user.Id);

        // Send verification email (best-effort)
        var appUrl = config["AppUrl"] ?? "http://localhost:4200";
        var verifyUrl = $"{appUrl}/verify-email?token={verifyToken}";
        _ = email.SendVerificationAsync(user.Email, verifyUrl);

        // Welcome email (best-effort)
        _ = email.SendWelcomeAsync(user.Email, user.FirstName, user.TrialEndsAt);

        // Notify admin of new signup (best-effort)
        var ageBracket = Services.AnalyticsService.GetAgeBracket(user.Age);
        _ = email.SendSignupNotificationAsync(user.Email, ageBracket, user.City, user.State);

        return Ok(new AuthResponse(BuildToken(user), ToMe(user)));
    }

    // ── Login ─────────────────────────────────────────────────────────────────
    [EnableRateLimiting("auth")]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        // Normalize to lowercase so login is case-insensitive; accept email OR username
        var normalized = req.Username.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u =>
            u.Username.ToLower() == normalized || u.Email == normalized);
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { error = "Invalid username or password." });

        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new AuthResponse(BuildToken(user), ToMe(user)));
    }

    // ── Me ────────────────────────────────────────────────────────────────────
    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await GetUser();
        return user is null ? Unauthorized() : Ok(ToMe(user));
    }

    // ── Verify Email ──────────────────────────────────────────────────────────
    [HttpGet("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromQuery] string token)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.VerificationToken == token);
        if (user is null) return BadRequest(new { error = "Invalid or expired verification token." });

        user.EmailVerified = true;
        user.VerificationToken = null;
        await db.SaveChangesAsync();

        return Ok(new { message = "Email verified successfully." });
    }

    // ── Resend Verification ───────────────────────────────────────────────────
    [Authorize]
    [HttpPost("resend-verification")]
    public async Task<IActionResult> ResendVerification()
    {
        var user = await GetUser();
        if (user is null) return Unauthorized();
        if (user.EmailVerified) return Ok(new { message = "Email is already verified." });

        var verifyToken = GenerateToken(32);
        user.VerificationToken = verifyToken;
        await db.SaveChangesAsync();

        var appUrl = config["AppUrl"] ?? "http://localhost:4200";
        var verifyUrl = $"{appUrl}/verify-email?token={verifyToken}";
        _ = email.SendVerificationAsync(user.Email, verifyUrl);

        return Ok(new { message = "Verification email sent." });
    }

    // ── Forgot Password ───────────────────────────────────────────────────────
    [EnableRateLimiting("auth")]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email.ToLowerInvariant());

        // Always return 200 to prevent email enumeration
        if (user is null) return Ok(new { message = "If that email is registered, you'll receive a reset link shortly." });

        // Expire any previous tokens
        var existing = await db.ResetTokens.Where(t => t.UserId == user.Id && !t.Used).ToListAsync();
        existing.ForEach(t => t.Used = true);

        var tokenStr = GenerateToken(40);
        db.ResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            Token = tokenStr,
            ExpiresAt = DateTime.UtcNow.AddMinutes(15),
        });
        await db.SaveChangesAsync();

        var appUrl = config["AppUrl"] ?? "http://localhost:4200";
        var resetUrl = $"{appUrl}/reset-password?token={tokenStr}";
        var sent = await email.SendPasswordResetAsync(user.Email, resetUrl);

        // In development with no SMTP: include the URL in the response so it's usable
        if (!sent && env.IsDevelopment())
            return Ok(new { message = "Reset link (dev only — configure SMTP for production):", resetUrl });

        return Ok(new { message = "If that email is registered, you'll receive a reset link shortly." });
    }

    // ── Forgot Username ───────────────────────────────────────────────────────
    [EnableRateLimiting("auth")]
    [HttpPost("forgot-username")]
    public async Task<IActionResult> ForgotUsername([FromBody] ForgotUsernameRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email.ToLowerInvariant());
        // Always return 200 to prevent email enumeration
        if (user is not null)
            _ = email.SendForgotUsernameAsync(user.Email, user.Username);
        return Ok(new { message = "If that email is registered, you'll receive your username shortly." });
    }

    // ── Reset Password ────────────────────────────────────────────────────────
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
            return BadRequest(new { error = "Password must be at least 6 characters." });

        var record = await db.ResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == req.Token && !t.Used);

        if (record is null || record.ExpiresAt < DateTime.UtcNow)
            return BadRequest(new { error = "This reset link is invalid or has expired." });

        record.User!.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        record.Used = true;
        await db.SaveChangesAsync();

        return Ok(new { message = "Password updated successfully." });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private async Task<User?> GetUser()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(id, out var uid) ? await db.Users.FindAsync(uid) : null;
    }

    private string BuildToken(User user)
    {
        var key    = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var creds  = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = DateTime.UtcNow.AddHours(double.Parse(config["Jwt:ExpiryHours"]!));

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
        };
        if (user.IsAdmin)
            claims.Add(new Claim("role", "admin"));

        var jwt = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims.ToArray(),
            expires: expiry,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }

    // ── Accept Terms ─────────────────────────────────────────────────────────
    [Authorize]
    [HttpPost("accept-terms")]
    public async Task<IActionResult> AcceptTerms()
    {
        var user = await GetUser();
        if (user is null) return Unauthorized();
        if (!user.HasAcceptedTerms)
        {
            user.HasAcceptedTerms = true;
            user.TermsAcceptedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        return Ok(ToMe(user));
    }

    // ── Complete Onboarding ───────────────────────────────────────────────────
    [Authorize]
    [HttpPost("complete-onboarding")]
    public async Task<IActionResult> CompleteOnboarding()
    {
        var user = await GetUser();
        if (user is null) return Unauthorized();
        user.HasSeenOnboarding = true;
        await db.SaveChangesAsync();
        return Ok(ToMe(user));
    }

    private static MeResponse ToMe(User u) =>
        new(u.Id, u.Username, u.FirstName, u.Email, u.State, u.City, u.Age, u.Tier.ToString(),
            u.EmailVerified, u.HasSeenOnboarding, u.IsAdmin, u.AnonymousId, u.TrialEndsAt,
            IsPaid: u.StripeSubscriptionId != null,
            HasAcceptedTerms: u.HasAcceptedTerms);

    private static string GenerateToken(int bytes) =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(bytes)).ToLowerInvariant();
}
