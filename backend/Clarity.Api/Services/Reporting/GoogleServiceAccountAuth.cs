using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace Clarity.Api.Services.Reporting;

/// <summary>
/// Minimal Google service-account OAuth2 flow using the official token endpoint
/// (no scraping, no third-party client library — just the documented
/// "JWT bearer" grant: https://developers.google.com/identity/protocols/oauth2/service-account).
/// Builds a self-signed RS256 JWT assertion from the service-account key file and
/// exchanges it for a short-lived, read-only access token. Never logs the key
/// contents or the resulting token.
/// </summary>
public class GoogleServiceAccountAuth(IConfiguration config, HttpClient http, ILogger<GoogleServiceAccountAuth> logger)
{
    private (string? token, DateTime expiresAt) _cache;

    /// <summary>Path to the service-account JSON key. Configured via
    /// GOOGLE_APPLICATION_CREDENTIALS, same as Google's own client libraries expect.</summary>
    private string? KeyPath => config["GOOGLE_APPLICATION_CREDENTIALS"];

    public bool IsConfigured => !string.IsNullOrWhiteSpace(KeyPath) && File.Exists(KeyPath);

    public async Task<string?> GetAccessTokenAsync(string scope)
    {
        if (_cache.token is not null && _cache.expiresAt > DateTime.UtcNow.AddMinutes(2))
            return _cache.token;

        if (!IsConfigured)
        {
            logger.LogWarning("[GoogleAuth] GOOGLE_APPLICATION_CREDENTIALS not set or file missing — skipping.");
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(await File.ReadAllTextAsync(KeyPath!));
            var root = doc.RootElement;
            var clientEmail = root.GetProperty("client_email").GetString()!;
            var privateKeyPem = root.GetProperty("private_key").GetString()!;
            var tokenUri = root.TryGetProperty("token_uri", out var tu) ? tu.GetString()! : "https://oauth2.googleapis.com/token";

            using var rsa = RSA.Create();
            rsa.ImportFromPem(privateKeyPem);
            var key = new RsaSecurityKey(rsa);
            // Microsoft.IdentityModel.Tokens caches SignatureProviders keyed by the
            // key material itself, not by object identity — GA4 and Search Console
            // both load the same private key file, so without disabling this cache
            // the second caller gets handed back a provider pointing at the FIRST
            // caller's already-`using`-disposed RSA object (ObjectDisposedException).
            key.CryptoProviderFactory.CacheSignatureProviders = false;
            var creds = new SigningCredentials(key, SecurityAlgorithms.RsaSha256);

            var now = DateTime.UtcNow;
            var jwt = new JwtSecurityToken(
                claims:
                [
                    new Claim("iss", clientEmail),
                    new Claim("scope", scope),
                    new Claim("aud", tokenUri),
                    // JwtSecurityToken's notBefore/expires params populate nbf/exp, but
                    // NOT iat — Google's token endpoint requires iat explicitly, or it
                    // rejects the assertion with "invalid_grant: iat is not set".
                    new Claim(JwtRegisteredClaimNames.Iat, EpochTime.GetIntDate(now).ToString(), ClaimValueTypes.Integer64),
                ],
                notBefore: now,
                expires: now.AddMinutes(30),
                signingCredentials: creds);
            var assertion = new JwtSecurityTokenHandler().WriteToken(jwt);

            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "urn:ietf:params:oauth:grant-type:jwt-bearer",
                ["assertion"] = assertion,
            });
            var resp = await http.PostAsync(tokenUri, form);
            if (!resp.IsSuccessStatusCode)
            {
                // Google's OAuth error body (error/error_description) never contains
                // secrets — it's safe to log and essential for diagnosing setup issues
                // like scope/audience/clock-skew problems.
                var body = await resp.Content.ReadAsStringAsync();
                logger.LogWarning("[GoogleAuth] Token exchange failed with status {Status}: {Body}", resp.StatusCode, body);
                return null;
            }
            using var respDoc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
            var accessToken = respDoc.RootElement.GetProperty("access_token").GetString();
            var expiresIn = respDoc.RootElement.TryGetProperty("expires_in", out var e) ? e.GetInt32() : 3600;
            _cache = (accessToken, now.AddSeconds(expiresIn));
            return accessToken;
        }
        catch (Exception ex)
        {
            // Never log key contents or tokens — just the generic failure.
            logger.LogError(ex, "[GoogleAuth] Failed to obtain access token");
            return null;
        }
    }
}
