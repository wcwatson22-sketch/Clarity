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

export type LoanCategory = 'mortgage' | 'rental' | 'auto' | 'personal' | 'student' | 'other' | 'amortization';

/** Standard amortized monthly principal & interest payment. */
export function monthlyPayment(principal: number, annualRatePct: number, termMonths: number): number {
  if (!(principal > 0) || !(termMonths > 0)) return 0;
  const r = (annualRatePct / 100) / 12;
  if (r === 0) return principal / termMonths;          // 0% loan
  const f = Math.pow(1 + r, termMonths);
  return principal * (r * f) / (f - 1);
}

export interface PayoffResult {
  months: number;
  totalInterest: number;
  /** False if the payment doesn't even cover monthly interest — balance would never shrink. */
  payoffPossible: boolean;
}

/**
 * Simulates month-by-month amortization to find how many months it actually takes to
 * pay off a loan at a given monthly payment (which may be larger than the minimum
 * required payment, e.g. extra principal). Unlike `monthlyPayment()` (which solves for
 * the payment that exactly amortizes over a fixed term), this solves the inverse:
 * given a payment, how long does payoff take.
 */
export function simulatePayoff(
  principal: number, annualRatePct: number, payment: number, maxMonths = 1200,
): PayoffResult {
  if (!(principal > 0) || !(payment > 0)) return { months: 0, totalInterest: 0, payoffPossible: true };
  const r = (annualRatePct / 100) / 12;
  let balance = principal, months = 0, totalInterest = 0;
  while (balance > 0.01 && months < maxMonths) {
    const interest = balance * r;
    const principalPortion = payment - interest;
    if (principalPortion <= 0) return { months, totalInterest, payoffPossible: false };
    totalInterest += interest;
    balance -= Math.min(principalPortion, balance);
    months++;
  }
  return { months, totalInterest, payoffPossible: balance <= 0.01 };
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
  rental: [
    { upTo: 0.36, label: 'Within a commonly referenced range (lower debt burden)', tone: 'lower' },
    { upTo: 0.45, label: 'Within a commonly referenced range', tone: 'moderate' },
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
  // Amortization is a standalone payoff-timeline tool, not a DTI-impact category —
  // this entry only exists to satisfy the Record type; the DTI band is never shown for it.
  amortization: [],
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

// ─────────────────────────────────────────────────────────────────────────────
// Rental Property — property-level DSCR analysis.
//
// Two mutually-exclusive expense methods: a simplified percentage-of-rent ratio,
// or a single user-entered "own expenses" figure. Never combine both. Property
// taxes/insurance are expected to already be folded into whichever expense figure
// the user supplies (ratio or own-expenses) — never added again separately, and
// never deducted from debt service.
// ─────────────────────────────────────────────────────────────────────────────

export type CreExpenseMethod = 'ratio' | 'own';

/** Annual gross rent = monthly gross rent × 12. Negative input clamps to 0. */
export function annualGrossRent(monthlyGrossRent: number): number {
  return Math.max(0, monthlyGrossRent || 0) * 12;
}

/** Annual vacancy allowance deducted from gross rent (0–100%, clamped). */
export function vacancyAllowance(annualGross: number, vacancyPct: number): number {
  const v = Math.min(100, Math.max(0, vacancyPct || 0)) / 100;
  return annualGross * v;
}

/** Effective gross income = annual gross rent − vacancy allowance. */
export function effectiveGrossIncome(annualGross: number, vacancyPct: number): number {
  return annualGross - vacancyAllowance(annualGross, vacancyPct);
}

/** Simplified-method annual operating expenses = annual gross rent × ratio. */
export function ratioOperatingExpenses(annualGross: number, expenseRatioPct: number): number {
  return annualGross * (Math.max(0, expenseRatioPct || 0) / 100);
}

/**
 * Net Operating Income. Never include principal & interest here — P&I is
 * annual debt service, computed and applied separately.
 */
export function netOperatingIncome(effectiveGrossIncome: number, annualOperatingExpenses: number): number {
  return effectiveGrossIncome - annualOperatingExpenses;
}

/** Annual debt service = monthly P&I × 12. */
export function annualDebtService(monthlyPI: number): number {
  return Math.max(0, monthlyPI || 0) * 12;
}

/** Property DSCR = NOI ÷ annual debt service. Null when debt service is 0 (undefined ratio, e.g. no loan entered). */
export function propertyDscr(noi: number, adsAnnual: number): number | null {
  if (!(adsAnnual > 0)) return null;
  return noi / adsAnnual;
}

/** Reference DSCR thresholds shown as guidance only — never an editable target. */
export const DSCR_REFERENCE = { ideal: 1.25, attractive: 1.35 };
