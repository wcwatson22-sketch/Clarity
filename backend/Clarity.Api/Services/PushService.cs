using Clarity.Api.Data;
using Microsoft.EntityFrameworkCore;
using WebPush;

namespace Clarity.Api.Services;

public class PushService(AppDbContext db, IConfiguration config, ILogger<PushService> logger)
{
    private readonly string _publicKey  = config["Push:VapidPublicKey"]  ?? "";
    private readonly string _privateKey = config["Push:VapidPrivateKey"] ?? "";
    private readonly string _subject    = config["Push:VapidSubject"]    ?? "mailto:support@clarityfinancialtools.com";

    /// <summary>Send a push notification to all subscriptions for a user.</summary>
    public async Task SendToUserAsync(int userId, string title, string body, string? url = null)
    {
        if (string.IsNullOrWhiteSpace(_publicKey) || string.IsNullOrWhiteSpace(_privateKey)) return;

        var subs = await db.PushSubscriptions
            .Where(s => s.UserId == userId)
            .ToListAsync();

        await SendToSubscriptionsAsync(subs, title, body, url);
    }

    /// <summary>Send a push notification to every subscribed user (admin broadcast).</summary>
    public async Task SendToAllAsync(string title, string body, string? url = null)
    {
        if (string.IsNullOrWhiteSpace(_publicKey) || string.IsNullOrWhiteSpace(_privateKey)) return;

        var subs = await db.PushSubscriptions.ToListAsync();
        await SendToSubscriptionsAsync(subs, title, body, url);
    }

    private async Task SendToSubscriptionsAsync(
        IEnumerable<Models.UserPushSubscription> subs,
        string title, string body, string? url)
    {
        var vapidDetails = new VapidDetails(_subject, _publicKey, _privateKey);
        var client       = new WebPushClient();
        var staleIds     = new List<int>();

        var payload = System.Text.Json.JsonSerializer.Serialize(new
        {
            title,
            body,
            icon = "/icons/icon-192x192.png",
            badge = "/icons/icon-96x96.png",
            url = url ?? "/dashboard"
        });

        foreach (var sub in subs)
        {
            try
            {
                var pushSub = new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
                await client.SendNotificationAsync(pushSub, payload, vapidDetails);
            }
            catch (WebPushException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Gone ||
                                               ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                // Subscription expired — mark for removal
                staleIds.Add(sub.Id);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Push failed for subscription {Id}", sub.Id);
            }
        }

        // Clean up expired subscriptions
        if (staleIds.Count > 0)
        {
            var toRemove = db.PushSubscriptions.Where(s => staleIds.Contains(s.Id));
            db.PushSubscriptions.RemoveRange(toRemove);
            await db.SaveChangesAsync();
        }
    }
}
