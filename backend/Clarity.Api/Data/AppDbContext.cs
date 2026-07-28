using System.Text.Json;
using Clarity.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Clarity.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<BudgetItem> BudgetItems => Set<BudgetItem>();
    public DbSet<UserIncome> Incomes => Set<UserIncome>();
    public DbSet<Snapshot> Snapshots => Set<Snapshot>();
    public DbSet<UserEducationProgress> EducationProgress => Set<UserEducationProgress>();
    public DbSet<SurveyResponse> SurveyResponses => Set<SurveyResponse>();
    public DbSet<PasswordResetToken> ResetTokens => Set<PasswordResetToken>();
    public DbSet<UserPushSubscription> PushSubscriptions => Set<UserPushSubscription>();
    public DbSet<Lesson>    Lessons    => Set<Lesson>();
    public DbSet<EmailLog>  EmailLogs  => Set<EmailLog>();
    public DbSet<RealEstateProperty> RealEstateProperties => Set<RealEstateProperty>();
    public DbSet<LearnArticle> LearnArticles => Set<LearnArticle>();
    public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();
    public DbSet<WeeklyReport> WeeklyReports => Set<WeeklyReport>();

    private static readonly JsonSerializerOptions _json = new();

    // ── Value comparer helper ─────────────────────────────────────────────────
    // Compares List<T> properties by their serialized JSON. This prevents EF Core
    // from treating every SaveChanges as a modification when the list hasn't changed.
    private static ValueComparer<List<T>> ListComparer<T>() =>
        new(
            (a, b) => JsonSerializer.Serialize(a, _json) == JsonSerializer.Serialize(b, _json),
            v => v == null ? 0 : JsonSerializer.Serialize(v, _json).GetHashCode(),
            v => JsonSerializer.Deserialize<List<T>>(JsonSerializer.Serialize(v, _json), _json) ?? new()
        );

    protected override void OnModelCreating(ModelBuilder mb)
    {
        // ── User ─────────────────────────────────────────────────────────────
        mb.Entity<User>(e =>
        {
            e.HasIndex(u => u.Username).IsUnique();
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Tier).HasConversion<string>();
        });

        // ── Account ───────────────────────────────────────────────────────────
        mb.Entity<Account>(e =>
        {
            e.Property(a => a.Type).HasConversion<string>();
            e.HasOne(a => a.User).WithMany(u => u.Accounts).HasForeignKey(a => a.UserId);
            // Index: every account query filters by UserId — prevents full table scan
            e.HasIndex(a => a.UserId);
            // Index: Real Estate sync looks up linked accounts by property id
            e.HasIndex(a => a.LinkedPropertyId);
        });

        // ── BudgetItem ─────────────────────────────────────────────────────────
        mb.Entity<BudgetItem>(e =>
        {
            e.Property(b => b.Group).HasConversion<string>();
            e.HasOne(b => b.User).WithMany(u => u.BudgetItems).HasForeignKey(b => b.UserId);
            // Index: every budget query filters by UserId
            e.HasIndex(b => b.UserId);
        });

        // ── UserIncome ─────────────────────────────────────────────────────────
        mb.Entity<UserIncome>(e =>
        {
            e.HasIndex(i => i.UserId).IsUnique();
            e.HasOne(i => i.User).WithOne(u => u.Income).HasForeignKey<UserIncome>(i => i.UserId);
            e.Property(i => i.VariableMonths)
             .HasConversion(
                v => JsonSerializer.Serialize(v, _json),
                v => JsonSerializer.Deserialize<List<VariableMonth>>(v, _json) ?? new(),
                ListComparer<VariableMonth>())  // ← value comparer: stops spurious UPDATE on unchanged months
             .HasColumnType("TEXT");
            e.Property(i => i.RetirementItems)
             .HasConversion(
                v => JsonSerializer.Serialize(v, _json),
                v => JsonSerializer.Deserialize<List<RetirementItem>>(v, _json) ?? new(),
                ListComparer<RetirementItem>())
             .HasColumnType("TEXT");
            e.Property(i => i.EmployerMatchTiersPrimary)
             .HasConversion(
                v => JsonSerializer.Serialize(v, _json),
                v => JsonSerializer.Deserialize<List<MatchTier>>(v, _json) ?? new(),
                ListComparer<MatchTier>())
             .HasColumnType("TEXT");
            e.Property(i => i.EmployerMatchTiersSecondary)
             .HasConversion(
                v => JsonSerializer.Serialize(v, _json),
                v => JsonSerializer.Deserialize<List<MatchTier>>(v, _json) ?? new(),
                ListComparer<MatchTier>())
             .HasColumnType("TEXT");
        });

        // ── Snapshot ───────────────────────────────────────────────────────────
        mb.Entity<Snapshot>(e =>
        {
            e.HasOne(s => s.User).WithMany(u => u.Snapshots).HasForeignKey(s => s.UserId);
            // Simple index for existence checks / counts
            e.HasIndex(s => s.UserId);
            // Composite index: dashboard queries filter by UserId AND order by CreatedAt DESC
            e.HasIndex(s => new { s.UserId, s.CreatedAt });
            e.Property(s => s.LineItems)
             .HasConversion(
                v => JsonSerializer.Serialize(v, _json),
                v => JsonSerializer.Deserialize<List<SnapshotLineItem>>(v, _json) ?? new(),
                ListComparer<SnapshotLineItem>())  // ← value comparer: stops spurious UPDATE on unchanged line items
             .HasColumnType("TEXT");
        });

        // ── EducationProgress ──────────────────────────────────────────────────
        mb.Entity<UserEducationProgress>(e =>
        {
            e.HasIndex(p => new { p.UserId, p.ArticleId }).IsUnique();
            e.HasOne(p => p.User).WithMany(u => u.EducationProgress).HasForeignKey(p => p.UserId);
        });

        // ── SurveyResponse ─────────────────────────────────────────────────────
        mb.Entity<SurveyResponse>(e =>
        {
            e.HasOne(s => s.User).WithMany(u => u.SurveyResponses).HasForeignKey(s => s.UserId);
            e.Property(s => s.Topics)
             .HasConversion(
                v => JsonSerializer.Serialize(v, _json),
                v => JsonSerializer.Deserialize<List<string>>(v, _json) ?? new(),
                ListComparer<string>())  // ← value comparer: stops spurious UPDATE on unchanged topics
             .HasColumnType("TEXT");
        });

        // ── PasswordResetToken ─────────────────────────────────────────────────
        mb.Entity<PasswordResetToken>(e =>
        {
            e.HasOne(t => t.User).WithMany(u => u.ResetTokens).HasForeignKey(t => t.UserId);
            // Index: reset-password flow looks up tokens by UserId to expire old ones
            e.HasIndex(t => t.UserId);
        });

        // ── UserPushSubscription ───────────────────────────────────────────────
        mb.Entity<UserPushSubscription>(e =>
        {
            e.HasOne(p => p.User).WithMany(u => u.PushSubscriptions).HasForeignKey(p => p.UserId);
            e.HasIndex(p => p.Endpoint).IsUnique();
            e.HasIndex(p => p.UserId);
        });

        // ── Lesson ─────────────────────────────────────────────────────────────
        mb.Entity<Lesson>(e =>
        {
            e.HasKey(l => l.Id);
            e.Property(l => l.Id).ValueGeneratedNever();
        });

        // ── EmailLog ───────────────────────────────────────────────────────────
        mb.Entity<EmailLog>(e =>
        {
            // Index: admin email-log view filters/sorts by UserId and SentAt
            e.HasIndex(el => el.UserId);
            e.HasIndex(el => el.SentAt);
        });

        // ── RealEstateProperty ─────────────────────────────────────────────────
        mb.Entity<RealEstateProperty>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).ValueGeneratedNever();
            e.HasOne(p => p.User).WithMany().HasForeignKey(p => p.UserId);
            // Index: real estate properties always queried per user
            e.HasIndex(p => p.UserId);
        });

        // ── LearnArticle ─────────────────────────────────────────────────────
        mb.Entity<LearnArticle>(e =>
        {
            e.HasKey(a => a.Id);
            e.HasIndex(a => a.Slug).IsUnique();   // public URL key
            e.HasIndex(a => a.IsPublished);        // public hub filters published
            e.HasIndex(a => a.Category);
            e.HasIndex(a => a.PublishedAt);
        });

        // ── AdminAuditLog ────────────────────────────────────────────────────
        mb.Entity<AdminAuditLog>(e =>
        {
            e.HasKey(a => a.Id);
            e.HasIndex(a => a.CreatedAt);
            e.HasIndex(a => a.ActorUserId);
        });
    }
}
