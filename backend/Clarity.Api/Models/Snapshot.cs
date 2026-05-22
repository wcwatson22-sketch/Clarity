namespace Clarity.Api.Models;

public class SnapshotLineItem
{
    public string AccountId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public decimal Value { get; set; }
}

public class Snapshot
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public int UserId { get; set; }
    public decimal NetWorth { get; set; }
    public decimal TotalAssets { get; set; }
    public decimal TotalLiabilities { get; set; }
    public decimal CashPosition { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<SnapshotLineItem> LineItems { get; set; } = [];

    public User? User { get; set; }
}
