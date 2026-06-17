// ─────────────────────────────────────────────────────────────────────────────
// Loan Impact Calculator — centralized, framework-free calculation logic.
//
// Single source of truth for the loan-payment formula, DTI math, housing ratio,
// debt-replacement logic, and reference-range evaluation. Both the app and the
// website import these pure functions so results are always identical.
//
// EDUCATIONAL ESTIMATES ONLY — not a loan approval, prequalification, preapproval,
// credit decision, or lending commitment.
// ─────────────────────────────────────────────────────────────────────────────

export type LoanCategory = 'mortgage' | 'auto' | 'personal' | 'student' | 'other';

/** Standard amortized monthly principal & interest payment. */
export function monthlyPayment(principal: number, annualRatePct: number, termMonths: number): number {
  if (!(principal > 0) || !(termMonths > 0)) return 0;
  const r = (annualRatePct / 100) / 12;
  if (r === 0) return principal / termMonths;          // 0% loan
  const f = Math.pow(1 + r, termMonths);
  return principal * (r * f) / (f - 1);
}

/** Sum of optional mortgage escrow/housing add-ons (all default to 0). */
export interface HousingExtras {
  propertyTaxes?: number;
  insurance?: number;
  hoa?: number;
  mortgageInsurance?: number;
  other?: number;
}
export function housingExtrasTotal(e: HousingExtras): number {
  return (e.propertyTaxes ?? 0) + (e.insurance ?? 0) + (e.hoa ?? 0)
       + (e.mortgageInsurance ?? 0) + (e.other ?? 0);
}

/** Current DTI = existing monthly debt ÷ gross monthly income. Null if no income. */
export function currentDti(existingDebt: number, grossIncome: number): number | null {
  if (!(grossIncome > 0)) return null;
  return existingDebt / grossIncome;
}

/**
 * Projected DTI = (existing debt − replaced payment + proposed payment) ÷ gross income.
 * Replacement is clamped to ≥0 and never below zero net debt. Null if no income.
 */
export function projectedDti(args: {
  existingDebt: number; grossIncome: number; proposedPayment: number; replacedPayment: number;
}): number | null {
  const { existingDebt, grossIncome, proposedPayment, replacedPayment } = args;
  if (!(grossIncome > 0)) return null;
  const projectedDebt = Math.max(0, existingDebt - Math.max(0, replacedPayment)) + Math.max(0, proposedPayment);
  return projectedDebt / grossIncome;
}

/** Projected total monthly debt (for display). */
export function projectedDebt(existingDebt: number, proposedPayment: number, replacedPayment: number): number {
  return Math.max(0, existingDebt - Math.max(0, replacedPayment)) + Math.max(0, proposedPayment);
}

/** Housing ratio (mortgage only) = total proposed housing payment ÷ gross income. */
export function housingRatio(totalHousingPayment: number, grossIncome: number): number | null {
  if (!(grossIncome > 0)) return null;
  return totalHousingPayment / grossIncome;
}

// ── Reference ranges (configurable, per loan category) ───────────────────────
// Neutral, educational bands only — NEVER "approved/denied/qualified". Edit these
// values to update guidance without touching the calculator logic.
export type RangeTone = 'lower' | 'moderate' | 'higher';
export interface RangeBand { upTo: number | null; label: string; tone: RangeTone; }

export const REFERENCE_RANGES: Record<LoanCategory, RangeBand[]> = {
  mortgage: [
    { upTo: 0.36, label: 'Within a commonly referenced range (lower debt burden)', tone: 'lower' },
    { upTo: 0.43, label: 'Within a commonly referenced range', tone: 'moderate' },
    { upTo: null, label: 'Above a commonly referenced range — review with a lender', tone: 'higher' },
  ],
  auto: [
    { upTo: 0.40, label: 'Within a commonly referenced range (lower debt burden)', tone: 'lower' },
    { upTo: 0.50, label: 'Within a commonly referenced range', tone: 'moderate' },
    { upTo: null, label: 'Above a commonly referenced range — review with a lender', tone: 'higher' },
  ],
  personal: [
    { upTo: 0.36, label: 'Within a commonly referenced range (lower debt burden)', tone: 'lower' },
    { upTo: 0.43, label: 'Within a commonly referenced range', tone: 'moderate' },
    { upTo: null, label: 'Above a commonly referenced range — review with a lender', tone: 'higher' },
  ],
  student: [
    { upTo: 0.36, label: 'Within a commonly referenced range (lower debt burden)', tone: 'lower' },
    { upTo: 0.43, label: 'Within a commonly referenced range', tone: 'moderate' },
    { upTo: null, label: 'Above a commonly referenced range — review with a lender', tone: 'higher' },
  ],
  other: [
    { upTo: 0.36, label: 'Within a commonly referenced range (lower debt burden)', tone: 'lower' },
    { upTo: 0.43, label: 'Within a commonly referenced range', tone: 'moderate' },
    { upTo: null, label: 'Above a commonly referenced range — review with a lender', tone: 'higher' },
  ],
};

/** Housing-ratio reference bands (mortgage only). */
export const HOUSING_RATIO_RANGE: RangeBand[] = [
  { upTo: 0.28, label: 'Within a commonly referenced range (lower housing burden)', tone: 'lower' },
  { upTo: 0.31, label: 'Within a commonly referenced range', tone: 'moderate' },
  { upTo: null, label: 'Above a commonly referenced range — review with a lender', tone: 'higher' },
];

/** Evaluate a ratio (0–1) against a set of bands. */
export function evaluateRange(ratio: number, bands: RangeBand[]): RangeBand {
  for (const b of bands) {
    if (b.upTo === null || ratio <= b.upTo) return b;
  }
  return bands[bands.length - 1];
}
