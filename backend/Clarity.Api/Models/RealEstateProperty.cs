namespace Clarity.Api.Models;

public class RealEstateProperty
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public int UserId { get; set; }

    // ── Property Info ─────────────────────────────────────────────────────────
    public string Address       { get; set; } = string.Empty;
    public string PropertyType  { get; set; } = "ltr"; // "ltr" | "str" | "multifamily"
    public int?   SquareFeet    { get; set; }
    public int?   Bedrooms      { get; set; }
    public decimal? Bathrooms   { get; set; }
    public int?   YearBuilt     { get; set; }
    public decimal PurchasePrice    { get; set; }
    public decimal AppraisedValue   { get; set; }

    // ── Income (monthly) ──────────────────────────────────────────────────────
    public decimal GrossMonthlyRent   { get; set; }
    public decimal VacancyRate        { get; set; } = 0.05m;  // 5% default LTR
    public decimal OtherMonthlyIncome { get; set; }           // parking, laundry, etc.

    // ── Expenses (monthly) ────────────────────────────────────────────────────
    // Management fee can be stored as either a flat $ amount or % of gross rent.
    // ManagementFeeIsPercent=true: ManagementFee is the percentage (e.g. 10 = 10%)
    public decimal ManagementFee        { get; set; }
    public bool    ManagementFeeIsPercent { get; set; } = true;
    public decimal Repairs              { get; set; }
    public decimal RepairReserve        { get; set; }   // ongoing maintenance reserve
    public decimal CapExReserve         { get; set; }   // capital expenditure (roof, HVAC)
    public decimal PropertyTaxes        { get; set; }
    public decimal Insurance            { get; set; }
    public decimal HoaFees              { get; set; }
    public decimal Utilities            { get; set; }   // if landlord-paid
    public decimal LegalFees            { get; set; }
    public decimal Cleaning             { get; set; }
    public decimal OtherExpenses        { get; set; }

    // ── Debt Structure ────────────────────────────────────────────────────────
    public decimal LoanAmount          { get; set; }
    public decimal InterestRate        { get; set; } = 7.0m;  // percent, e.g. 7.0
    public int     AmortizationYears   { get; set; } = 30;

    // ── 5-Year Projection Assumptions ────────────────────────────────────────
    public decimal AnnualRentGrowthPct        { get; set; } = 3.0m;  // %
    public decimal AnnualAppreciationPct      { get; set; } = 3.0m;  // %

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User? User { get; set; }
}
