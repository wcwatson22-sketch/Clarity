using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Clarity.Api.Services;

public class EmailService(IConfiguration config, ILogger<EmailService> logger, HttpClient http)
{
    private readonly string _apiKey   = config["Resend:ApiKey"] ?? config["Smtp:Password"] ?? string.Empty;
    private readonly string _from     = config["Smtp:FromEmail"] ?? "noreply@clarityfinancialtools.com";
    private readonly string _fromName = config["Smtp:FromName"] ?? "Clarity Finance";

    public async Task<bool> SendPasswordResetAsync(string toEmail, string resetUrl)
    {
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
              <h2 style="color:#085041;margin-bottom:8px;">Password Reset</h2>
              <p style="color:#374151;line-height:1.6;">
                We received a request to reset the password for your Clarity account.
                Click the button below to choose a new password. This link expires in 15 minutes.
              </p>
              <a href="{resetUrl}" style="display:inline-block;background:#1D9E75;color:#fff;
                 text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;
                 font-size:14px;margin:20px 0;">
                Reset Password
              </a>
              <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
                If you didn't request this, you can safely ignore this email.
                Your password will not change.
              </p>
            </div>
            """;
        return await SendAsync(toEmail, "Reset your Clarity password", html);
    }

    public async Task<bool> SendWelcomeAsync(string toEmail, string firstName, DateTime trialEndsAt)
    {
        var name = string.IsNullOrWhiteSpace(firstName) ? "there" : firstName;
        var trialDate = trialEndsAt.ToString("MMMM d, yyyy");
        var html = $"""
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
                <div style="width:12px;height:12px;border-radius:50%;background:#1D9E75;"></div>
                <span style="font-size:18px;font-weight:700;color:#111827;">Clarity</span>
              </div>

              <h1 style="font-size:24px;font-weight:700;color:#111827;margin:0 0 8px;">
                Welcome, {name}! 🎉
              </h1>
              <p style="color:#374151;line-height:1.7;margin:0 0 24px;">
                Congratulations on taking the first step toward financial clarity. You now have a
                <strong>30-day free trial</strong> with access to everything Clarity has to offer —
                no credit card required.
              </p>

              <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
                <p style="color:#065F46;font-weight:600;margin:0 0 12px;">Your trial is active until <strong>{trialDate}</strong></p>
                <ul style="color:#374151;margin:0;padding-left:20px;line-height:1.9;">
                  <li>📊 <strong>Dashboard</strong> — track your full net worth in one place</li>
                  <li>💵 <strong>Cash Flow</strong> — manage income, expenses &amp; savings</li>
                  <li>📸 <strong>Snapshots</strong> — capture your financial position over time</li>
                  <li>📚 <strong>Learn</strong> — bite-sized financial education lessons</li>
                  <li>📄 <strong>PFS</strong> — generate a Personal Financial Statement</li>
                </ul>
              </div>

              <p style="color:#374151;line-height:1.7;margin:0 0 24px;">
                After your trial, continue with a <strong>Compare plan ($0.99/month)</strong> or
                unlock everything with <strong>Premium ($4.99/month)</strong>.
              </p>

              <a href="https://clarityfinancialtools.com/dashboard"
                 style="display:inline-block;background:#1D9E75;color:#fff;text-decoration:none;
                        padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
                Go to Dashboard →
              </a>

              <p style="color:#9CA3AF;font-size:12px;margin-top:32px;line-height:1.6;">
                Questions? Reply to this email anytime.<br/>— The Clarity Team
              </p>
            </div>
            """;
        return await SendAsync(toEmail, $"Welcome to Clarity, {name}! 🎉", html);
    }

    public async Task<bool> SendForgotUsernameAsync(string toEmail, string username)
    {
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
              <h2 style="color:#085041;margin-bottom:8px;">Username Reminder</h2>
              <p style="color:#374151;line-height:1.6;">
                You requested a reminder of your Clarity username. Here it is:
              </p>
              <div style="background:#F3F4F6;border-radius:10px;padding:16px 20px;margin:20px 0;
                          font-size:20px;font-weight:700;color:#111827;letter-spacing:0.5px;">
                {username}
              </div>
              <p style="color:#374151;line-height:1.6;">
                You can also sign in using your email address directly.
              </p>
              <a href="https://clarityfinancialtools.com/login"
                 style="display:inline-block;background:#1D9E75;color:#fff;text-decoration:none;
                        padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;margin-top:8px;">
                Go to Sign In
              </a>
            </div>
            """;
        return await SendAsync(toEmail, "Your Clarity username", html);
    }

    public async Task<bool> SendSignupNotificationAsync(string newUserEmail, string ageBracket, string city, string state)
    {
        var notifyAddress = config["Admin:NotifyEmail"];
        if (string.IsNullOrWhiteSpace(notifyAddress)) return false;

        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
              <h2 style="color:#085041;margin-bottom:8px;">New User Signed Up 🎉</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
                <tr><td style="padding:6px 0;font-weight:600;width:120px;">Email</td><td>{newUserEmail}</td></tr>
                <tr><td style="padding:6px 0;font-weight:600;">Age bracket</td><td>{ageBracket}</td></tr>
                <tr><td style="padding:6px 0;font-weight:600;">Location</td><td>{city}, {state}</td></tr>
              </table>
            </div>
            """;
        return await SendAsync(notifyAddress, $"New Clarity signup — {newUserEmail}", html);
    }

    public async Task<bool> SendVerificationAsync(string toEmail, string verifyUrl)
    {
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
              <h2 style="color:#085041;margin-bottom:8px;">Confirm Your Email</h2>
              <p style="color:#374151;line-height:1.6;">
                Thanks for signing up for Clarity! Click below to verify your email address.
              </p>
              <a href="{verifyUrl}" style="display:inline-block;background:#1D9E75;color:#fff;
                 text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;
                 font-size:14px;margin:20px 0;">
                Verify Email
              </a>
              <p style="color:#9CA3AF;font-size:12px;margin-top:16px;">
                If you didn't create a Clarity account, you can safely ignore this email.
              </p>
            </div>
            """;
        return await SendAsync(toEmail, "Verify your Clarity email", html);
    }

    public async Task<bool> SendDeletionWarningAsync(string toEmail, string firstName, DateTime deleteOn)
    {
        var name = string.IsNullOrWhiteSpace(firstName) ? "there" : firstName;
        var deleteDate = deleteOn.ToString("MMMM d, yyyy");
        var html = $"""
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
                <div style="width:12px;height:12px;border-radius:50%;background:#1D9E75;"></div>
                <span style="font-size:18px;font-weight:700;color:#111827;">Clarity</span>
              </div>
              <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">
                Your account will be deleted on {deleteDate}
              </h1>
              <p style="color:#374151;line-height:1.7;margin:0 0 20px;">
                Hi {name}, your Clarity free trial has ended and your account hasn't been upgraded to a paid plan.
                If you'd like to keep your financial data, please log in and select a plan before <strong>{deleteDate}</strong>.
              </p>
              <a href="https://clarityfinancialtools.com/settings"
                 style="display:inline-block;background:#1D9E75;color:#fff;text-decoration:none;
                        padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;margin-bottom:24px;">
                Choose a Plan →
              </a>
              <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
                <p style="color:#B91C1C;font-weight:600;margin:0 0 4px;">⚠️ What gets deleted</p>
                <p style="color:#374151;font-size:13px;margin:0;line-height:1.6;">
                  Your dashboard accounts, cash flow data, snapshots, and progress will be permanently removed.
                  This cannot be undone.
                </p>
              </div>
              <p style="color:#9CA3AF;font-size:12px;line-height:1.6;">
                Plans start at just $0.99/month. If you have questions, reply to this email anytime.<br/>— The Clarity Team
              </p>
            </div>
            """;
        return await SendAsync(toEmail, "Action required: your Clarity account will be deleted soon", html);
    }

    public async Task<bool> SendAccountDeletedAsync(string toEmail, string firstName)
    {
        var name = string.IsNullOrWhiteSpace(firstName) ? "there" : firstName;
        var html = $"""
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
                <div style="width:12px;height:12px;border-radius:50%;background:#1D9E75;"></div>
                <span style="font-size:18px;font-weight:700;color:#111827;">Clarity</span>
              </div>
              <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">
                Your Clarity account has been removed
              </h1>
              <p style="color:#374151;line-height:1.7;margin:0 0 20px;">
                Hi {name}, your Clarity account and all associated data have been permanently deleted
                as your free trial ended without an active subscription.
              </p>
              <p style="color:#374151;line-height:1.7;margin:0 0 24px;">
                If you'd like to start fresh, you're always welcome to create a new account.
              </p>
              <a href="https://clarityfinancialtools.com/signup"
                 style="display:inline-block;background:#1D9E75;color:#fff;text-decoration:none;
                        padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
                Create a New Account
              </a>
              <p style="color:#9CA3AF;font-size:12px;margin-top:32px;line-height:1.6;">
                Questions? Reply to this email anytime.<br/>— The Clarity Team
              </p>
            </div>
            """;
        return await SendAsync(toEmail, "Your Clarity account has been deleted", html);
    }

    public async Task<bool> SendSubscriptionConfirmationAsync(string toEmail, string firstName, string plan)
    {
        var name      = string.IsNullOrWhiteSpace(firstName) ? "there" : firstName;
        var planLabel = plan == "base" ? "Compare ($0.99/month)" : "Premium ($4.99/month)";
        var features  = plan == "base"
            ? "<li>📊 Full dashboard &amp; net worth tracking</li><li>💵 Cash flow budget &amp; DTI</li><li>📸 10 snapshots per month</li><li>📈 Compare tab — see how you stack up</li>"
            : "<li>📊 Full dashboard &amp; net worth tracking</li><li>💵 Cash flow budget &amp; DTI</li><li>📸 Unlimited snapshots</li><li>📈 Compare tab</li><li>🏦 Loan Prep guides</li><li>📄 Personal Financial Statement (PFS)</li>";

        var html = $"""
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
                <div style="width:12px;height:12px;border-radius:50%;background:#1D9E75;"></div>
                <span style="font-size:18px;font-weight:700;color:#111827;">Clarity</span>
              </div>
              <h1 style="font-size:24px;font-weight:700;color:#111827;margin:0 0 8px;">
                You're subscribed! 🎉
              </h1>
              <p style="color:#374151;line-height:1.7;margin:0 0 24px;">
                Hi {name}, thank you for subscribing to the <strong>{planLabel}</strong> plan.
                Your payment was successful and your account is now active.
              </p>
              <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
                <p style="color:#065F46;font-weight:600;margin:0 0 12px;">What's included in your plan:</p>
                <ul style="color:#374151;margin:0;padding-left:20px;line-height:1.9;">
                  {features}
                </ul>
              </div>
              <a href="https://clarityfinancialtools.com/dashboard"
                 style="display:inline-block;background:#1D9E75;color:#fff;text-decoration:none;
                        padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
                Go to Dashboard →
              </a>
              <p style="color:#9CA3AF;font-size:12px;margin-top:32px;line-height:1.6;">
                Questions? Reply to this email anytime.<br/>— The Clarity Team
              </p>
            </div>
            """;
        return await SendAsync(toEmail, $"Welcome to Clarity {planLabel}! Your subscription is active", html);
    }

    public async Task<bool> SendCancellationConfirmationAsync(string toEmail, string firstName)
    {
        var name = string.IsNullOrWhiteSpace(firstName) ? "there" : firstName;
        var html = $"""
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
                <div style="width:12px;height:12px;border-radius:50%;background:#1D9E75;"></div>
                <span style="font-size:18px;font-weight:700;color:#111827;">Clarity</span>
              </div>
              <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">
                Your subscription has been cancelled
              </h1>
              <p style="color:#374151;line-height:1.7;margin:0 0 20px;">
                Hi {name}, your Clarity subscription has been successfully cancelled.
                You'll retain access through the end of your current billing period.
              </p>
              <p style="color:#374151;line-height:1.7;margin:0 0 24px;">
                Your data will remain on file. If you change your mind, you can resubscribe anytime
                from your Settings page.
              </p>
              <a href="https://clarityfinancialtools.com/settings"
                 style="display:inline-block;background:#1D9E75;color:#fff;text-decoration:none;
                        padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
                Manage Settings →
              </a>
              <p style="color:#9CA3AF;font-size:12px;margin-top:32px;line-height:1.6;">
                Questions? Reply to this email anytime.<br/>— The Clarity Team
              </p>
            </div>
            """;
        return await SendAsync(toEmail, "Your Clarity subscription has been cancelled", html);
    }

    private async Task<bool> SendAsync(string toEmail, string subject, string html)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            logger.LogWarning("[EmailService] Resend API key not configured — skipping send to {Email}", toEmail);
            return false;
        }

        try
        {
            var payload = new
            {
                from = $"{_fromName} <{_from}>",
                to   = new[] { toEmail },
                subject,
                html
            };

            var json    = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            request.Content = content;

            var response = await http.SendAsync(request);
            var body     = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("[EmailService] Resend API error {Status}: {Body}", (int)response.StatusCode, body);
                return false;
            }

            logger.LogInformation("[EmailService] Email sent to {Email} — {Subject}", toEmail, subject);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[EmailService] Failed to send email to {Email}", toEmail);
            return false;
        }
    }
}
