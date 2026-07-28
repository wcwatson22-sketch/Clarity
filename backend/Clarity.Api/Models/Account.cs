namespace Clarity.Api.Models;

public enum AccountType { Asset, Liability }

public class Account
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public int UserId { get; set; }
    public string Group { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public AccountType Type { get; set; }
    public bool IsAnchor { get; set; } = false;

    /// <summary>Optional annual interest rate (%) for liabilities. Null = unknown —
    /// never treated as 0% in analysis. Not applicable to assets.</summary>
    public decimal? InterestRate { get; set; }

    /// <summary>When set, this account is a Real Estate-linked record. The linked
    /// RealEstateProperty is the source of truth for Value — only the Real Estate
    /// sync process (RealEstateController) may set these two fields.</summary>
    public string? LinkedPropertyId { get; set; }
    /// <summary>"asset" or "liability" — which side of the property this record represents.</summary>
    public string? LinkedPropertyRole { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}
