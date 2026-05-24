using System.Text;
using System.Threading.RateLimiting;
using Clarity.Api.Data;
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

        // Back-fill AnonymousId for existing users who don't have one yet
        var usersWithoutId = ctx.Users.Where(u => u.AnonymousId == "").ToList();
        foreach (var u in usersWithoutId)
            u.AnonymousId = $"User {u.Id:D3}";
        if (usersWithoutId.Count > 0)
            await ctx.SaveChangesAsync();

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

        // ── Seed lessons if table is empty ──────────────────────────────
        if (!ctx.Lessons.Any())
        {
            ctx.Lessons.AddRange(LessonStore.All);
            await ctx.SaveChangesAsync();
            Log.Information("Seeded {Count} lessons into database.", LessonStore.All.Count);
        }

        await conn.CloseAsync();
    }

    // ── Swagger: dev only ─────────────────────────────────────────────────────
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseSerilogRequestLogging();
    app.UseRateLimiter();
    app.UseCors();
    app.UseAuthentication();
    app.UseAuthorization();

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
