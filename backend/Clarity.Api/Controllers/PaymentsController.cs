using System.Security.Claims;
using Clarity.Api.Data;
using Clarity.Api.Models;
using Clarity.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe;
using Stripe.Checkout;

namespace Clarity.Api.Controllers;

[ApiController]
[Route("api/payments")]
public class PaymentsController(
    AppDbContext db,
    IConfiguration config,
    IWebHostEnvironment env,
    EmailService emailService) : ControllerBase
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
}
