using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Clarity.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Clarity.Api.Controllers;

/// <summary>
/// Issues a short-lived session token for the single designated automated-test
/// account (username "emailtest99"), so scheduled test/QA tasks can exercise
/// logged-in flows without any human or agent ever handling that account's
/// password. Gated by a server-only shared secret (TestAuth:Secret) that never
/// appears in any client-facing form or field — it is configured once as
/// server/environment config and read here the same way Jwt:Key is.
/// </summary>
[ApiController]
[Route("api/test-auth")]
public class TestAuthController(AppDbContext db, IConfiguration config, ILogger<TestAuthController> logger) : ControllerBase
{
    private const string TestUsername = "emailtest99";

    [EnableRateLimiting("test-auth")]
    [HttpPost("login-as-test-user")]
    public async Task<IActionResult> LoginAsTestUser([FromHeader(Name = "X-Test-Auth-Secret")] string? secret)
    {
        var expected = config["TestAuth:Secret"];

        // Fail closed: if no secret is configured on the server, this endpoint
        // can never be used, in any environment — there is no default value.
        if (string.IsNullOrEmpty(expected))
            return NotFound();

        if (string.IsNullOrEmpty(secret) || !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(expected)))
            return Unauthorized();

        // Hardcoded to the one designated test account — never accepts a
        // username/email/id from the caller, so this can't be used to mint a
        // token for any other account.
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == TestUsername);
        if (user is null) return NotFound(new { error = "Test account not found." });

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        // Deliberately short-lived (1 hour) — this is a per-run test session,
        // not a standing credential.
        var expiry = DateTime.UtcNow.AddHours(1);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new("test", "true"), // marks tokens minted by this endpoint, for auditing
        };
        // Mirrors AuthController.BuildToken exactly: only adds the admin claim if
        // this specific account already has IsAdmin set via normal means. This does
        // NOT grant any new permission — it just stops the test token from being
        // artificially LESS privileged than a real login for the same account would be.
        if (user.IsAdmin)
            claims.Add(new Claim("role", "admin"));

        var jwt = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: expiry,
            signingCredentials: creds);

        var token = new JwtSecurityTokenHandler().WriteToken(jwt);

        logger.LogInformation("Test-auth session token issued for {Username} (expires {Expiry})", user.Username, expiry);

        return Ok(new { token, expiresAt = expiry });
    }
}
