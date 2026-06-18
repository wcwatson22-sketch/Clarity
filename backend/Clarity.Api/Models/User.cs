namespace Clarity.Api.Models;

// Base is retained only for backward compatibility with existing rows; it is
// treated as Free for access control. New users default to Free.
public enum UserTier { Base = 0, Premium = 1, Free = 2 }

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool EmailVerified { get; set; } = false;
    public string? VerificationToken { get; set; }
    public string State { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public int Age { get; set; }
    public UserTier Tier { get; set; } = UserTier.Free;
    public bool HasSeenOnboarding { get; set; } = false;
    public bool IsAdmin { get; set; } = false;
    public string AnonymousId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime TrialEndsAt { get; set; } = DateTime.UtcNow.AddDays(14);
    public DateTime? LastLoginAt { get; set; }
    public DateTime? DeletionNoticeSentAt { get; set; }
    /// <summary>Set once when the user finishes initial financial setup; their baseline snapshot exists from this point.</summary>
    public DateTime? SetupCompletedAt { get; set; }

    // ── Activity & lifecycle email tracking ───────────────────────────────────
    /// <summary>Updated (max once per hour) on any authenticated API request.</summary>
    public DateTime? LastActiveAt { get; set; }
    /// <summary>Set once when the trial-ended email is dispatched. Prevents duplicates.</summary>
    public DateTime? TrialEndedEmailSentAt { get; set; }
    /// <summary>Set each time the inactive-paid-user email is sent. Enforces 30-day cooldown.</summary>
    public DateTime? InactiveEmailLastSentAt { get; set; }

    public string? StripeCustomerId { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public string? AppleOriginalTransactionId { get; set; }  // StoreKit IAP
    public bool HasAcceptedTerms { get; set; } = false;
    public DateTime? TermsAcceptedAt { get; set; }

    // Navigation
    public List<Account> Accounts { get; set; } = [];
    public List<BudgetItem> BudgetItems { get; set; } = [];
    public UserIncome? Income { get; set; }
    public List<Snapshot> Snapshots { get; set; } = [];
    public List<UserEducationProgress> EducationProgress { get; set; } = [];
    public List<SurveyResponse> SurveyResponses { get; set; } = [];
    public List<PasswordResetToken> ResetTokens { get; set; } = [];
    public List<UserPushSubscription> PushSubscriptions { get; set; } = [];
}
