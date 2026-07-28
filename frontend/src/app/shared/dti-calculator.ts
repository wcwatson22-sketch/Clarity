// ─────────────────────────────────────────────────────────────────────────────
// Public DTI Calculator — centralized, framework-free calculation logic.
//
// EDUCATIONAL ESTIMATES ONLY — not a loan application, prequalification,
// preapproval, credit decision, or lending commitment.
// ─────────────────────────────────────────────────────────────────────────────

export interface DtiDebts {
  housing?: number;
  auto?: number;
  student?: number;
  creditCards?: number;
  personal?: number;
  other?: number;
}

export type DtiBandTone = 'good' | 'ok' | 'high';

/** Never lets a negative input reduce a total — matches how the calculator's
 *  numeric inputs behave (NumericDirective only allows digits/decimal point,
 *  so this is primarily a safety net for direct calls, e.g. from tests). */
function nonNegative(v: number | undefined): number {
  return v && v > 0 ? v : 0;
}

/** Sum of all monthly debt payments. Blank/undefined/negative fields count as 0. */
export function totalMonthlyDebt(debts: DtiDebts): number {
  return nonNegative(debts.housing) + nonNegative(debts.auto) + nonNegative(debts.student) +
         nonNegative(debts.creditCards) + nonNegative(debts.personal) + nonNegative(debts.other);
}

/**
 * DTI = total monthly debt ÷ gross monthly income × 100.
 * Returns null when income is not a positive number — DTI is undefined
 * without a valid income, and the calculator must not show a result.
 */
export function calculateDti(grossMonthlyIncome: number, debts: DtiDebts): number | null {
  if (!(grossMonthlyIncome > 0)) return null;
  return (totalMonthlyDebt(debts) / grossMonthlyIncome) * 100;
}

/**
 * Educational band for a computed DTI%. These are general reference points,
 * not universal lender cutoffs — acceptable ranges vary by lender, loan type,
 * and credit profile. Never use this to claim approval likelihood.
 */
export function dtiBand(dtiPct: number): { label: string; tone: DtiBandTone } {
  if (dtiPct <= 36) return { label: 'Generally considered a healthy range', tone: 'good' };
  if (dtiPct <= 43) return { label: 'Generally considered a moderate range', tone: 'ok' };
  return { label: 'Generally considered a higher range', tone: 'high' };
}
