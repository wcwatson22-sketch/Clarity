namespace Clarity.Api.Models;

public record SignupRequest(
    string Username,
    string Password,
    string FirstName,
    string Email,
    string State,
    string City,
    int Age
);

public record LoginRequest(
    string Username,
    string Password
);

public record AuthResponse(
    string Token,
    MeResponse User
);

public record MeResponse(
    int Id,
    string Username,
    string FirstName,
    string Email,
    string State,
    string City,
    int Age,
    string Tier,
    bool EmailVerified,
    bool HasSeenOnboarding,
    bool IsAdmin,
    string AnonymousId,
    DateTime TrialEndsAt,
    bool IsPaid,             // true when user has an active Stripe or Apple IAP subscription
    bool HasAcceptedTerms    // true once user has accepted Privacy Policy + ToS
);

public record ForgotPasswordRequest(string Email);

public record ForgotUsernameRequest(string Email);

public record CreateCheckoutRequest(string Plan); // "base" or "premium"

/// <summary>Sent by the iOS app after a StoreKit purchase or restore.</summary>
public record VerifyIapRequest(
    string TransactionId,        // StoreKit transaction ID
    string ProductId,            // e.g. "com.clarityfinancialtools.app.premium_monthly"
    string? JwsRepresentation    // optional JWS token from StoreKit 2
);

public record ResetPasswordRequest(string Token, string NewPassword);

public record UpdateProfileRequest(
    string FirstName,
    string Email,
    string State,
    string City,
    int Age
);

public record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword
);

public record PushSubscribeRequest(
    string Endpoint,
    string P256dh,
    string Auth
);
