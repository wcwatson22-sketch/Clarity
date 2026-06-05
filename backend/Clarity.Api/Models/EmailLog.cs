namespace Clarity.Api.Models;

/// <summary>
/// Immutable record of every email dispatch attempt.
/// Logged by EmailService after every send — success or failure.
/// </summary>
public class EmailLog
{
    public int Id { get; set; }

    /// <summary>Clarity user ID, if the email was user-specific. Null for admin notifications.</summary>
    public int? UserId { get; set; }

    /// <summary>Machine-readable type: "welcome", "verification", "password-reset",
    /// "trial-ended", "deletion-warning", "account-deleted", "subscription-confirmation",
    /// "cancellation-confirmation", "inactive-paid", "forgot-username", "signup-notification".
    /// </summary>
    public string EmailType { get; set; } = string.Empty;

    public string RecipientEmail { get; set; } = string.Empty;
    public string Subject        { get; set; } = string.Empty;
    public DateTime SentAt       { get; set; } = DateTime.UtcNow;
    public bool Success          { get; set; }

    /// <summary>Message ID returned by Resend on success (re_...).</summary>
    public string? ProviderMessageId { get; set; }

    /// <summary>Error detail when Success == false.</summary>
    public string? ErrorMessage { get; set; }
}
