namespace Clarity.Api.Models;

public class UserPushSubscription
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>Push endpoint URL provided by the browser</summary>
    public string Endpoint { get; set; } = string.Empty;

    /// <summary>Browser-generated elliptic-curve public key (base64url)</summary>
    public string P256dh { get; set; } = string.Empty;

    /// <summary>Browser-generated auth secret (base64url)</summary>
    public string Auth { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
