using System.Text;
using System.Threading.RateLimiting;
using Clarity.Api.Data;
using Clarity.Api.Models;
using Clarity.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((ctx, services, config) =>
        config.ReadFrom.Configuration(ctx.Configuration)
              .WriteTo.Console());

    // ── Startup: validate JWT key is not the dev placeholder in production ────
    var jwtKey = builder.Configuration["Jwt:Key"]
        ?? throw new InvalidOperationException("Jwt:Key is not configured.");

    if (builder.Environment.IsProduction() && jwtKey.StartsWith("DEV-ONLY"))
        throw new InvalidOperationException(
            "Jwt:Key is still set to the dev placeholder. " +
            "Set the Jwt__Key environment variable to a secure random string before running in production.");

    // ── Database ──────────────────────────────────────────────────────────────
    var dbPath = Path.Combine(builder.Environment.ContentRootPath, "clarity.db");
    builder.Services.AddDbContext<AppDbContext>(opt =>
        opt.UseSqlite($"Data Source={dbPath}"));

    Log.Information("Database path: {DbPath}", dbPath);

    // ── App Services ──────────────────────────────────────────────────────────
    builder.Services.AddScoped<SeedService>();
    builder.Services.AddScoped<AnalyticsService>();
    builder.Services.AddScoped<PushService>();
    builder.Services.AddHttpClient<EmailService>();
    builder.Services.AddHttpClient(); // enables IHttpClientFactory for PaymentsController (Apple IAP)
    builder.Services.AddHostedService<CleanupHostedService>();

    builder.Services.AddControllers()
        .AddJsonOptions(opts =>
        {
            opts.JsonSerializerOptions.Converters.Add(
                new System.Text.Json.Serialization.JsonStringEnumConverter());
            // Prevent circular reference errors when EF navigation properties are loaded
            opts.JsonSerializerOptions.ReferenceHandler =
                System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        });

    // ── Rate Limiting ─────────────────────────────────────────────────────────
    // Auth endpoints: 10 requests per minute per IP (prevents brute force)
    builder.Services.AddRateLimiter(options =>
    {
        options.AddPolicy("auth", httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0,
                }
            ));

        // Global fallback: 120 requests per minute per IP
        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 120,
                    Window = TimeSpan.FromMinutes(1),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0,
                }
            ));

        options.OnRejected = async (context, token) =>
        {
            context.HttpContext.Response.StatusCode = 429;
            await context.HttpContext.Response.WriteAsync("Too many requests. Please try again later.", token);
        };
    });

    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new() { Title = "Clarity Finance API", Version = "v1" });
        c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
        {
            In = Microsoft.OpenApi.Models.ParameterLocation.Header,
            Description = "Enter: Bearer {token}",
            Name = "Authorization",
            Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
            Scheme = "Bearer"
        });
        c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
        {
            {
                new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                {
                    Reference = new Microsoft.OpenApi.Models.OpenApiReference
                    {
                        Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                        Id = "Bearer"
                    }
                },
                Array.Empty<string>()
            }
        });
    });

    builder.Services.AddHealthChecks();

    // ── JWT Auth ──────────────────────────────────────────────────────────────
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.MapInboundClaims = false; // keep raw claim names (e.g. "role", not the long URI)
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = builder.Configuration["Jwt:Issuer"],
                ValidAudience = builder.Configuration["Jwt:Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                ClockSkew = TimeSpan.Zero, // no grace period on expiry
            };
        });

    builder.Services.AddAuthorization(opts =>
    {
        // Admin policy: JWT must contain role=admin claim
        opts.AddPolicy("AdminOnly", p => p.RequireClaim("role", "admin"));
    });

    // ── CORS ──────────────────────────────────────────────────────────────────
    var allowedOrigins = builder.Configuration
        .GetSection("AllowedOrigins")
        .Get<string[]>() ?? ["http://localhost:4200"];

    Log.Information("CORS origins: {Origins}", string.Join(", ", allowedOrigins));

    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod());
    });

    var app = builder.Build();

    // ── Ensure DB is created + apply additive column migrations ──────────────
    using (var scope = app.Services.CreateScope())
    {
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        ctx.Database.EnsureCreated();

        // Additive column migrations (safe to re-run — exceptions mean column already exists)
        var conn = ctx.Database.GetDbConnection();
        await conn.OpenAsync();
        var additiveMigrations = new[]
        {
            "ALTER TABLE Users ADD COLUMN HasSeenOnboarding INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Users ADD COLUMN FirstName TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE Users ADD COLUMN IsAdmin INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Users ADD COLUMN AnonymousId TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE Users ADD COLUMN HasAcceptedTerms INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Users ADD COLUMN TermsAcceptedAt TEXT NULL",
            "ALTER TABLE Users ADD COLUMN LastLoginAt TEXT NULL",
            "ALTER TABLE Users ADD COLUMN DeletionNoticeSentAt TEXT NULL",
            "ALTER TABLE Users ADD COLUMN StripeCustomerId TEXT NULL",
            "ALTER TABLE Users ADD COLUMN StripeSubscriptionId TEXT NULL",
        };
        foreach (var sql in additiveMigrations)
        {
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = sql;
                await cmd.ExecuteNonQueryAsync();
            }
            catch { /* column already exists — safe to ignore */ }
        }

        // ── Create Lessons table for existing databases ──────────────────
        // (EnsureCreated only creates tables when the DB is brand new)
        try
        {
            using var createLessons = conn.CreateCommand();
            createLessons.CommandText = """
                CREATE TABLE IF NOT EXISTS "Lessons" (
                    "Id"          TEXT NOT NULL CONSTRAINT "PK_Lessons" PRIMARY KEY,
                    "Title"       TEXT NOT NULL,
                    "Description" TEXT NOT NULL,
                    "Category"    TEXT NOT NULL,
                    "ReadTime"    INTEGER NOT NULL,
                    "Content"     TEXT NOT NULL
                )
                """;
            await createLessons.ExecuteNonQueryAsync();
        }
        catch { /* table may already exist — safe to ignore */ }

        // Add Example column to Lessons (introduced after initial Lessons table)
        try
        {
            using var addExample = conn.CreateCommand();
            addExample.CommandText = "ALTER TABLE \"Lessons\" ADD COLUMN \"Example\" TEXT NOT NULL DEFAULT ''";
            await addExample.ExecuteNonQueryAsync();
        }
        catch { /* column already exists — safe to ignore */ }

        // Backfill Example and update Content for all lessons from LessonStore
        // (keeps existing rows in sync with any content or example changes in LessonStore.All)
        foreach (var ls in LessonStore.All)
        {
            using var upd = conn.CreateCommand();
            upd.CommandText = "UPDATE \"Lessons\" SET \"Content\" = @co, \"Example\" = @ex WHERE \"Id\" = @id";
            var pco = upd.CreateParameter(); pco.ParameterName = "@co"; pco.Value = ls.Content; upd.Parameters.Add(pco);
            var pex = upd.CreateParameter(); pex.ParameterName = "@ex"; pex.Value = ls.Example; upd.Parameters.Add(pex);
            var pid = upd.CreateParameter(); pid.ParameterName = "@id"; pid.Value = ls.Id; upd.Parameters.Add(pid);
            await upd.ExecuteNonQueryAsync();
        }

        // TrialEndsAt migration: add column, then give existing users a 30-day trial
        try
        {
            using var addCol = conn.CreateCommand();
            addCol.CommandText = "ALTER TABLE Users ADD COLUMN TrialEndsAt TEXT NOT NULL DEFAULT '0001-01-01 00:00:00'";
            await addCol.ExecuteNonQueryAsync();

            using var backfillTrial = conn.CreateCommand();
            backfillTrial.CommandText = "UPDATE Users SET TrialEndsAt = @d WHERE TrialEndsAt = '0001-01-01 00:00:00'";
            var tp = backfillTrial.CreateParameter();
            tp.ParameterName = "@d";
            tp.Value = DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd HH:mm:ss.fffffff");
            backfillTrial.Parameters.Add(tp);
            await backfillTrial.ExecuteNonQueryAsync();
        }
        catch { /* column already exists — safe to ignore */ }

        // Add Apple IAP transaction ID column
        try
        {
            using var addApple = conn.CreateCommand();
            addApple.CommandText = "ALTER TABLE Users ADD COLUMN AppleOriginalTransactionId TEXT NULL";
            await addApple.ExecuteNonQueryAsync();
        }
        catch { /* column already exists */ }

        // EmailLog table — full history of every email sent
        try
        {
            using var createEmailLog = conn.CreateCommand();
            createEmailLog.CommandText = """
                CREATE TABLE IF NOT EXISTS "EmailLogs" (
                    "Id"                INTEGER NOT NULL CONSTRAINT "PK_EmailLogs" PRIMARY KEY AUTOINCREMENT,
                    "UserId"            INTEGER NULL,
                    "EmailType"         TEXT NOT NULL DEFAULT '',
                    "RecipientEmail"    TEXT NOT NULL DEFAULT '',
                    "Subject"           TEXT NOT NULL DEFAULT '',
                    "SentAt"            TEXT NOT NULL DEFAULT '0001-01-01 00:00:00',
                    "Success"           INTEGER NOT NULL DEFAULT 0,
                    "ProviderMessageId" TEXT NULL,
                    "ErrorMessage"      TEXT NULL
                )
                """;
            await createEmailLog.ExecuteNonQueryAsync();
        }
        catch { /* table already exists */ }

        // Activity & lifecycle email tracking columns
        foreach (var col in new[]
        {
            "ALTER TABLE Users ADD COLUMN LastActiveAt TEXT NULL",
            "ALTER TABLE Users ADD COLUMN TrialEndedEmailSentAt TEXT NULL",
            "ALTER TABLE Users ADD COLUMN InactiveEmailLastSentAt TEXT NULL",
            // Phase 1: per-item variable budgets, baseline snapshot, setup completion.
            // SQLite stores decimal as TEXT. All additive and nullable — non-destructive.
            "ALTER TABLE BudgetItems ADD COLUMN Budget TEXT NULL",
            "ALTER TABLE BudgetItems ADD COLUMN Category TEXT NULL",
            "ALTER TABLE Snapshots ADD COLUMN IsInitialBaseline INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Users ADD COLUMN SetupCompletedAt TEXT NULL",
        })
        {
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = col;
                await cmd.ExecuteNonQueryAsync();
            }
            catch { /* column already exists */ }
        }

        // Phase 1: mark each user's earliest snapshot as their baseline if none is set
        // yet. Non-destructive — only flips a 0 default to 1 for the oldest row per user.
        try
        {
            using var baselineCmd = conn.CreateCommand();
            baselineCmd.CommandText =
                "UPDATE Snapshots SET IsInitialBaseline = 1 WHERE Id IN (" +
                "  SELECT s.Id FROM Snapshots s " +
                "  WHERE s.CreatedAt = (SELECT MIN(s2.CreatedAt) FROM Snapshots s2 WHERE s2.UserId = s.UserId) " +
                ") AND UserId NOT IN (SELECT UserId FROM Snapshots WHERE IsInitialBaseline = 1)";
            await baselineCmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex) { Log.Warning(ex, "Baseline snapshot backfill skipped"); }

        // Back-fill AnonymousId for existing users who don't have one yet
        var usersWithoutId = ctx.Users.Where(u => u.AnonymousId == "").ToList();
        foreach (var u in usersWithoutId)
            u.AnonymousId = $"User {u.Id:D3}";
        if (usersWithoutId.Count > 0)
            await ctx.SaveChangesAsync();

        // ── Freemium migration: retire the legacy paid "Base" tier ───────────────
        // Convert UNPAID legacy Base users to Free. Paid subscribers (Stripe/Apple)
        // and Premium users are never touched. Idempotent and non-destructive — it
        // only relabels the tier; no financial data, onboarding, or snapshots change.
        try
        {
            using var migrateTier = conn.CreateCommand();
            migrateTier.CommandText =
                "UPDATE Users SET Tier = 'Free' WHERE Tier = 'Base' " +
                "AND (StripeSubscriptionId IS NULL OR StripeSubscriptionId = '') " +
                "AND (AppleOriginalTransactionId IS NULL OR AppleOriginalTransactionId = '')";
            var migrated = await migrateTier.ExecuteNonQueryAsync();
            if (migrated > 0) Log.Information("Freemium migration: {Count} legacy Base users moved to Free", migrated);
        }
        catch (Exception ex) { Log.Warning(ex, "Freemium tier migration skipped"); }

        // Grant admin rights to the configured admin username (if set)
        var adminUsername = app.Configuration["Admin:Username"];
        if (!string.IsNullOrWhiteSpace(adminUsername))
        {
            var adminUser = ctx.Users.FirstOrDefault(u =>
                u.Username.ToLower() == adminUsername.ToLower());
            if (adminUser is not null && !adminUser.IsAdmin)
            {
                adminUser.IsAdmin = true;
                await ctx.SaveChangesAsync();
                Log.Information("Admin rights granted to user: {Username}", adminUser.Username);
            }
        }

        // Grant admin rights + Premium tier to any user IDs listed in Admin:UserIds (comma-separated)
        var adminUserIdsRaw = app.Configuration["Admin:UserIds"];
        if (!string.IsNullOrWhiteSpace(adminUserIdsRaw))
        {
            var adminIds = adminUserIdsRaw
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => int.TryParse(s, out var n) ? n : -1)
                .Where(n => n > 0)
                .ToList();
            var toPromote = ctx.Users.Where(u => adminIds.Contains(u.Id)).ToList();
            foreach (var u in toPromote)
            {
                u.IsAdmin = true;
                u.Tier = UserTier.Premium;
                u.TrialEndsAt = DateTime.UtcNow.AddYears(100);
                Log.Information("Admin/Premium granted to user ID: {Id}", u.Id);
            }
            if (toPromote.Count > 0)
                await ctx.SaveChangesAsync();
        }

        // ── Seed lessons if table is empty ──────────────────────────────
        if (!ctx.Lessons.Any())
        {
            ctx.Lessons.AddRange(LessonStore.All);
            await ctx.SaveChangesAsync();
            Log.Information("Seeded {Count} lessons into database.", LessonStore.All.Count);
        }

        // ── RealEstateProperties table (added after initial schema) ─────────────
        try
        {
            using var createRE = conn.CreateCommand();
            createRE.CommandText = """
                CREATE TABLE IF NOT EXISTS "RealEstateProperties" (
                    "Id"                     TEXT NOT NULL CONSTRAINT "PK_RealEstateProperties" PRIMARY KEY,
                    "UserId"                 INTEGER NOT NULL,
                    "Address"                TEXT NOT NULL DEFAULT '',
                    "PropertyType"           TEXT NOT NULL DEFAULT 'ltr',
                    "SquareFeet"             INTEGER NULL,
                    "Bedrooms"               INTEGER NULL,
                    "Bathrooms"              TEXT NULL,
                    "YearBuilt"              INTEGER NULL,
                    "PurchasePrice"          TEXT NOT NULL DEFAULT '0',
                    "AppraisedValue"         TEXT NOT NULL DEFAULT '0',
                    "GrossMonthlyRent"       TEXT NOT NULL DEFAULT '0',
                    "VacancyRate"            TEXT NOT NULL DEFAULT '0.05',
                    "OtherMonthlyIncome"     TEXT NOT NULL DEFAULT '0',
                    "ManagementFee"          TEXT NOT NULL DEFAULT '0',
                    "ManagementFeeIsPercent" INTEGER NOT NULL DEFAULT 1,
                    "Repairs"                TEXT NOT NULL DEFAULT '0',
                    "RepairReserve"          TEXT NOT NULL DEFAULT '0',
                    "CapExReserve"           TEXT NOT NULL DEFAULT '0',
                    "PropertyTaxes"          TEXT NOT NULL DEFAULT '0',
                    "Insurance"              TEXT NOT NULL DEFAULT '0',
                    "HoaFees"               TEXT NOT NULL DEFAULT '0',
                    "Utilities"              TEXT NOT NULL DEFAULT '0',
                    "LegalFees"              TEXT NOT NULL DEFAULT '0',
                    "Cleaning"               TEXT NOT NULL DEFAULT '0',
                    "OtherExpenses"          TEXT NOT NULL DEFAULT '0',
                    "LoanAmount"             TEXT NOT NULL DEFAULT '0',
                    "InterestRate"           TEXT NOT NULL DEFAULT '7.0',
                    "AmortizationYears"      INTEGER NOT NULL DEFAULT 30,
                    "AnnualRentGrowthPct"    TEXT NOT NULL DEFAULT '3.0',
                    "AnnualAppreciationPct"  TEXT NOT NULL DEFAULT '3.0',
                    "CreatedAt"              TEXT NOT NULL DEFAULT '0001-01-01 00:00:00',
                    "UpdatedAt"              TEXT NOT NULL DEFAULT '0001-01-01 00:00:00'
                )
                """;
            await createRE.ExecuteNonQueryAsync();
        }
        catch { /* table already exists */ }

        // ── Database indexes (CREATE INDEX IF NOT EXISTS is always safe to re-run) ──
        // These prevent full table scans on every dashboard load. Added 2026-06.
        var indexStatements = new[]
        {
            // Per-user queries: accounts, budget, snapshots, real estate
            "CREATE INDEX IF NOT EXISTS \"IX_Accounts_UserId\"           ON \"Accounts\"           (\"UserId\")",
            "CREATE INDEX IF NOT EXISTS \"IX_BudgetItems_UserId\"         ON \"BudgetItems\"         (\"UserId\")",
            "CREATE INDEX IF NOT EXISTS \"IX_RealEstateProperties_UserId\" ON \"RealEstateProperties\" (\"UserId\")",
            "CREATE INDEX IF NOT EXISTS \"IX_PasswordResetTokens_UserId\" ON \"PasswordResetTokens\" (\"UserId\")",
            "CREATE INDEX IF NOT EXISTS \"IX_PushSubscriptions_UserId\"   ON \"UserPushSubscription\" (\"UserId\")",
            // Snapshots: simple and composite (dashboard loads ordered by date DESC)
            "CREATE INDEX IF NOT EXISTS \"IX_Snapshots_UserId\"           ON \"Snapshots\"           (\"UserId\")",
            "CREATE INDEX IF NOT EXISTS \"IX_Snapshots_UserId_CreatedAt\" ON \"Snapshots\"           (\"UserId\", \"CreatedAt\")",
            // EmailLog: admin view filters by UserId and sorts by SentAt
            "CREATE INDEX IF NOT EXISTS \"IX_EmailLogs_UserId\"           ON \"EmailLogs\"           (\"UserId\")",
            "CREATE INDEX IF NOT EXISTS \"IX_EmailLogs_SentAt\"           ON \"EmailLogs\"           (\"SentAt\")",
        };
        foreach (var sql in indexStatements)
        {
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = sql;
                await cmd.ExecuteNonQueryAsync();
            }
            catch { /* table may not exist yet on this DB — safe to skip */ }
        }
        Log.Information("Database indexes verified/created.");

        await conn.CloseAsync();
    }

    // ── Swagger: dev only ─────────────────────────────────────────────────────
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseSerilogRequestLogging();
    app.UseMiddleware<Clarity.Api.Middleware.SlowRequestMiddleware>(); // warns on requests >500ms
    app.UseRateLimiter();
    app.UseCors();
    app.UseAuthentication();
    app.UseAuthorization();
    app.UseMiddleware<Clarity.Api.Middleware.ActivityTrackingMiddleware>();

    // Stripe webhook needs raw body — disable buffering for that route
    app.Use(async (ctx, next) =>
    {
        if (ctx.Request.Path.StartsWithSegments("/api/payments/webhook"))
            ctx.Request.EnableBuffering();
        await next();
    });

    app.MapControllers();
    app.MapHealthChecks("/healthz");
    app.MapHealthChecks("/readyz");

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
