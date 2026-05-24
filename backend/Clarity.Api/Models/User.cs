namespace Clarity.Api.Models;

public enum UserTier { Base = 0, Premium = 1 }

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
    public UserTier Tier { get; set; } = UserTier.Base;
    public bool HasSeenOnboarding { get; set; } = false;
    public bool IsAdmin { get; set; } = false;
    public string AnonymousId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime TrialEndsAt { get; set; } = DateTime.UtcNow.AddDays(14);
    public DateTime? LastLoginAt { get; set; }
    public DateTime? DeletionNoticeSentAt { get; set; }
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
