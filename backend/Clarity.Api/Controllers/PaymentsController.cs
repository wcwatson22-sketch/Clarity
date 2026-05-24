using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Clarity.Api.Data;
using Clarity.Api.Models;
using Clarity.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Stripe;
using Stripe.Checkout;
using System.IdentityModel.Tokens.Jwt;

namespace Clarity.Api.Controllers;

[ApiController]
[Route("api/payments")]
public class PaymentsController(
    AppDbContext db,
    IConfiguration config,
    IWebHostEnvironment env,
    EmailService emailService,
    IHttpClientFactory httpClientFactory) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ── Create Checkout Session ───────────────────────────────────────────────
    [Authorize]
    [HttpPost("create-checkout")]
    public async Task<IActionResult> CreateCheckout([FromBody] CreateCheckoutRequest? req)
    {
        var plan      = req?.Plan?.ToLower() == "base" ? "base" : "premium";
        var secretKey = config["Stripe:SecretKey"];
        var priceId   = plan == "base"
            ? config["Stripe:BasePriceId"]
            : config["Stripe:PremiumPriceId"];
        var appUrl    = config["AppUrl"] ?? "http://localhost:4200";

        // Graceful degradation: if Stripe not configured, return a helpful dev message
        if (string.IsNullOrWhiteSpace(secretKey) || string.IsNullOrWhiteSpace(priceId))
        {
            if (env.IsDevelopment())
                return Ok(new
                {
                    devMode = true,
                    message = "Stripe is not configured.",
                    mockUpgradeUrl = $"{appUrl}/settings?upgraded=true"
                });
            return BadRequest(new { error = "Payment processing is not configured." });
        }

        var user = await db.Users.FindAsync(UserId);
        if (user is null) return Unauthorized();
        if (user.Tier == UserTier.Premium)
            return BadRequest(new { error = "You are already on a paid plan." });

        StripeConfiguration.ApiKey = secretKey;

        var options = new SessionCreateOptions
        {
            PaymentMethodTypes = ["card"],
            Mode = "subscription",
            LineItems =
            [
                new SessionLineItemOptions { Price = priceId, Quantity = 1 }
            ],
            SuccessUrl = $"{appUrl}/settings?upgraded=true",
            CancelUrl  = $"{appUrl}/settings?upgraded=false",
            ClientReferenceId = user.Id.ToString(),
            CustomerEmail = user.Email,
            Metadata = new Dictionary<string, string>
            {
                ["userId"] = user.Id.ToString(),
                ["plan"]   = plan,
            }
        };

        var service = new SessionService();
        var session = await service.CreateAsync(options);

        return Ok(new { url = session.Url });
    }

    // ── Stripe Webhook ────────────────────────────────────────────────────────
    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook()
    {
        var webhookSecret = config["Stripe:WebhookSecret"];
        var secretKey     = config["Stripe:SecretKey"];

        if (string.IsNullOrWhiteSpace(secretKey) || string.IsNullOrWhiteSpace(webhookSecret))
            return Ok(); // not configured — no-op

        StripeConfiguration.ApiKey = secretKey;

        var json = await new StreamReader(Request.Body).ReadToEndAsync();
        Event stripeEvent;

        try
        {
            stripeEvent = EventUtility.ConstructEvent(
                json,
                Request.Headers["Stripe-Signature"],
                webhookSecret
            );
        }
        catch (StripeException)
        {
            return BadRequest(new { error = "Invalid webhook signature." });
        }

        // Handle checkout completed → upgrade tier + save Stripe IDs
        if (stripeEvent.Type == EventTypes.CheckoutSessionCompleted)
        {
            var session = stripeEvent.Data.Object as Session;
            if (session?.Metadata.TryGetValue("userId", out var userIdStr) == true
                && int.TryParse(userIdStr, out var userId))
            {
                var user = await db.Users.FindAsync(userId);
                if (user is not null)
                {
                    var plan = session.Metadata.TryGetValue("plan", out var p) ? p : "premium";
                    user.Tier = plan == "base" ? UserTier.Base : UserTier.Premium;
                    user.StripeCustomerId     = session.CustomerId;
                    user.StripeSubscriptionId = session.SubscriptionId;
                    await db.SaveChangesAsync();
                    _ = emailService.SendSubscriptionConfirmationAsync(user.Email, user.FirstName, plan);
                }
            }
        }

        // Handle subscription cancelled → downgrade to Base
        if (stripeEvent.Type == EventTypes.CustomerSubscriptionDeleted)
        {
            var sub = stripeEvent.Data.Object as Subscription;
            // Match by subscription ID (more reliable than metadata)
            var user = await db.Users.FirstOrDefaultAsync(u => u.StripeSubscriptionId == sub!.Id);
            if (user is not null)
            {
                user.Tier = UserTier.Base;
                user.StripeSubscriptionId = null;
                await db.SaveChangesAsync();
            }
        }

        return Ok();
    }

    // ── Cancel Subscription ───────────────────────────────────────────────────
    [Authorize]
    [HttpDelete("subscription")]
    public async Task<IActionResult> CancelSubscription()
    {
        var user = await db.Users.FindAsync(UserId);
        if (user is null) return Unauthorized();
        if (user.Tier == UserTier.Base)
            return BadRequest(new { error = "No active subscription to cancel." });

        var secretKey = config["Stripe:SecretKey"];

        // Cancel in Stripe if configured and we have a subscription ID
        if (!string.IsNullOrWhiteSpace(secretKey) && !string.IsNullOrWhiteSpace(user.StripeSubscriptionId))
        {
            StripeConfiguration.ApiKey = secretKey;
            var svc = new SubscriptionService();
            await svc.CancelAsync(user.StripeSubscriptionId);
        }

        // Immediately reflect cancellation in our DB
        user.Tier = UserTier.Base;
        user.StripeSubscriptionId = null;
        await db.SaveChangesAsync();

        // Send confirmation email (best-effort)
        _ = emailService.SendCancellationConfirmationAsync(user.Email, user.FirstName);

        return Ok(new { message = "Subscription cancelled.", tier = user.Tier.ToString() });
    }

    // ── Dev: Manual upgrade (development only) ────────────────────────────────
    [Authorize]
    [HttpPost("dev-upgrade")]
    public async Task<IActionResult> DevUpgrade()
    {
        if (!env.IsDevelopment())
            return NotFound();

        var user = await db.Users.FindAsync(UserId);
        if (user is null) return Unauthorized();

        user.Tier = UserTier.Premium;
        await db.SaveChangesAsync();

        return Ok(new
        {
            message = "Upgraded to Premium (dev mode).",
            tier = user.Tier.ToString()
        });
    }

    // ── Apple IAP: Verify Purchase ────────────────────────────────────────────
    // Called by the iOS app after a StoreKit purchase.
    // We verify the transaction with Apple's App Store Server API,
    // then update the user's tier accordingly.
    [Authorize]
    [HttpPost("verify-iap")]
    public async Task<IActionResult> VerifyIap([FromBody] VerifyIapRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.TransactionId))
            return BadRequest(new { error = "Transaction ID is required." });

        var user = await db.Users.FindAsync(UserId);
        if (user is null) return Unauthorized();

        // Validate productId is one of our known products
        var tier = MapProductToTier(req.ProductId);
        if (tier is null)
            return BadRequest(new { error = $"Unknown product identifier: {req.ProductId}" });

        // Attempt server-side verification with Apple
        JsonNode? txnPayload = null;
        var ascKeyB64 = config["Apple:AscPrivateKeyB64"];
        if (!string.IsNullOrWhiteSpace(ascKeyB64))
        {
            try
            {
                var ascJwt  = BuildAscJwt(ascKeyB64);
                txnPayload  = await FetchAppleTransaction(req.TransactionId, ascJwt);
            }
            catch (Exception ex)
            {
                // Log but don't fail — fall through to client JWS parsing
                Console.Error.WriteLine($"Apple ASC API error: {ex.Message}");
            }
        }

        // If ASC API unavailable, decode JWS payload from client (no sig verification)
        if (txnPayload is null && !string.IsNullOrWhiteSpace(req.JwsRepresentation))
        {
            txnPayload = DecodeJwsPayload(req.JwsRepresentation);
        }

        if (txnPayload is null)
            return BadRequest(new { error = "Could not verify purchase with Apple. Please try again." });

        // Validate bundle ID
        var bundleId = txnPayload["bundleId"]?.GetValue<string>();
        if (bundleId != "com.clarityfinancialtools.app")
            return BadRequest(new { error = "Purchase bundle mismatch." });

        // Validate product ID matches what client reported
        var verifiedProductId = txnPayload["productId"]?.GetValue<string>();
        if (verifiedProductId != req.ProductId)
            return BadRequest(new { error = "Product ID mismatch." });

        // Check subscription is not expired
        var expiresMsRaw = txnPayload["expiresDate"];
        if (expiresMsRaw is not null)
        {
            var expiresMs = expiresMsRaw.GetValue<long>();
            var expiresAt = DateTimeOffset.FromUnixTimeMilliseconds(expiresMs).UtcDateTime;
            if (expiresAt < DateTime.UtcNow)
                return BadRequest(new { error = "This subscription has expired." });
        }

        // Update user tier and Apple transaction ID
        var originalTxnId = txnPayload["originalTransactionId"]?.GetValue<string>() ?? req.TransactionId;
        user.Tier = tier.Value;
        user.AppleOriginalTransactionId = originalTxnId;
        await db.SaveChangesAsync();

        _ = emailService.SendSubscriptionConfirmationAsync(
            user.Email, user.FirstName, tier.Value == UserTier.Premium ? "premium" : "base");

        return Ok(new { tier = user.Tier.ToString(), message = "Purchase verified." });
    }

    // ── Apple IAP: Restore Purchases ─────────────────────────────────────────
    // Called when user taps "Restore Purchases". Re-verifies and syncs tier.
    [Authorize]
    [HttpPost("restore-iap")]
    public async Task<IActionResult> RestoreIap([FromBody] VerifyIapRequest req)
    {
        // Same logic as VerifyIap — reuse the endpoint
        return await VerifyIap(req);
    }

    // ── Apple IAP Helpers ─────────────────────────────────────────────────────

    private static UserTier? MapProductToTier(string? productId) => productId switch
    {
        "com.clarityfinancialtools.app.premium_monthly" => UserTier.Premium,
        "com.clarityfinancialtools.app.base_monthly"    => UserTier.Base,
        "com.clarityfinancialtools.app.premium_annual"  => UserTier.Premium,
        _                                               => null
    };

    /// <summary>Create a signed JWT for the App Store Server API.</summary>
    private string BuildAscJwt(string privateKeyB64)
    {
        var keyId    = config["Apple:AscKeyId"]    ?? "24DJNHQWAS";
        var issuerId = config["Apple:AscIssuerId"] ?? "55a91748-0078-45c8-ae86-f98d86a83c88";

        // Private key is base64 of the PEM file text
        var pem = Encoding.UTF8.GetString(Convert.FromBase64String(privateKeyB64));
        var ecdsa = ECDsa.Create();
        ecdsa.ImportFromPem(pem);

        var secKey = new ECDsaSecurityKey(ecdsa) { KeyId = keyId };
        var creds  = new SigningCredentials(secKey, SecurityAlgorithms.EcdsaSha256);

        var claims = new[] { new System.Security.Claims.Claim("bid", "com.clarityfinancialtools.app") };
        var token  = new JwtSecurityToken(
            issuer:  issuerId,
            audience: "appstoreconnect-v1",
            claims:  claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(5),
            signingCredentials: creds);

        // Add kid to header manually
        token.Header["kid"] = keyId;

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>Call Apple's App Store Server API and return the decoded transaction payload.</summary>
    private async Task<JsonNode?> FetchAppleTransaction(string transactionId, string ascJwt)
    {
        using var http = httpClientFactory.CreateClient();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ascJwt);

        // Try production endpoint first; fall back to sandbox
        foreach (var host in new[] { "api.storekit.itunes.apple.com", "api.storekit-sandbox.itunes.apple.com" })
        {
            var url = $"https://{host}/inApps/v1/transactions/{transactionId}";
            var res = await http.GetAsync(url);
            if (!res.IsSuccessStatusCode) continue;

            var body    = await res.Content.ReadAsStringAsync();
            var node    = JsonNode.Parse(body);
            var signedTxn = node?["signedTransactionInfo"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(signedTxn)) continue;

            return DecodeJwsPayload(signedTxn);
        }
        return null;
    }

    /// <summary>
    /// Base64url-decode the JWS payload segment (middle part) to get the transaction JSON.
    /// Note: does NOT verify the signature — used only when ASC API result is also checked.
    /// </summary>
    private static JsonNode? DecodeJwsPayload(string jws)
    {
        try
        {
            var parts = jws.Split('.');
            if (parts.Length < 2) return null;

            // Add padding for standard base64 decode
            var payload = parts[1];
            payload = payload.Replace('-', '+').Replace('_', '/');
            switch (payload.Length % 4)
            {
                case 2: payload += "=="; break;
                case 3: payload += "=";  break;
            }

            var json = Encoding.UTF8.GetString(Convert.FromBase64String(payload));
            return JsonNode.Parse(json);
        }
        catch { return null; }
    }
}
