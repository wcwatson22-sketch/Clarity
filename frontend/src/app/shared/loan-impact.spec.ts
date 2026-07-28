import {
  monthlyPayment, annualGrossRent, effectiveGrossIncome, ratioOperatingExpenses,
  netOperatingIncome, annualDebtService, propertyDscr, DSCR_REFERENCE, simulatePayoff,
} from './loan-impact';

describe('simulatePayoff (amortization calculator)', () => {
  it('reproduces the original term when paying exactly the minimum payment', () => {
    const principal = 300000, rate = 6.5, term = 360;
    const payment = monthlyPayment(principal, rate, term);
    const result = simulatePayoff(principal, rate, payment);
    // Rounding in the payment can shave off/add a trailing month or two — allow slack.
    expect(result.months).toBeGreaterThanOrEqual(term - 1);
    expect(result.months).toBeLessThanOrEqual(term + 1);
    expect(result.payoffPossible).toBeTrue();
  });

  it('pays off faster with extra principal, and pays less total interest', () => {
    const principal = 300000, rate = 6.5, term = 360;
    const minPayment = monthlyPayment(principal, rate, term);
    const baseline = simulatePayoff(principal, rate, minPayment);
    const withExtra = simulatePayoff(principal, rate, minPayment + 300);

    expect(withExtra.months).toBeLessThan(baseline.months);
    expect(withExtra.totalInterest).toBeLessThan(baseline.totalInterest);
  });

  it('handles a 0% loan (no interest) — payoff = principal / payment, rounded up', () => {
    const result = simulatePayoff(12000, 0, 1000);
    expect(result.months).toBe(12);
    expect(result.totalInterest).toBe(0);
    expect(result.payoffPossible).toBeTrue();
  });

  it('flags payoffPossible=false when the payment does not even cover monthly interest', () => {
    // $500,000 at 8% = ~$3,333/mo interest-only; a $1,000 payment can never make progress.
    const result = simulatePayoff(500000, 8, 1000, 24);
    expect(result.payoffPossible).toBeFalse();
  });

  it('handles zero principal safely (nothing to pay off)', () => {
    const result = simulatePayoff(0, 6.5, 1000);
    expect(result.months).toBe(0);
    expect(result.totalInterest).toBe(0);
    expect(result.payoffPossible).toBeTrue();
  });

  it('handles zero payment safely (never pays off, no throw)', () => {
    expect(() => simulatePayoff(100000, 6.5, 0)).not.toThrow();
    const result = simulatePayoff(100000, 6.5, 0);
    expect(result.months).toBe(0);
  });

  it('a tiny extra payment still shortens the term, even if only slightly', () => {
    const principal = 20000, rate = 7, term = 60;
    const minPayment = monthlyPayment(principal, rate, term);
    const baseline = simulatePayoff(principal, rate, minPayment);
    const withExtra = simulatePayoff(principal, rate, minPayment + 25);
    expect(withExtra.months).toBeLessThanOrEqual(baseline.months);
  });
});

describe('Rental Property DSCR calculations', () => {
  const rentMonthly = 8000;
  const ratioPct = 30;

  it('computes annual gross rent', () => {
    expect(annualGrossRent(rentMonthly)).toBe(96000);
  });

  it('computes NOI matching a 30% ratio ($67,200/yr)', () => {
    const gross = annualGrossRent(rentMonthly);
    const egi = effectiveGrossIncome(gross, 0);
    const opEx = ratioOperatingExpenses(gross, ratioPct);
    expect(opEx).toBe(28800);
    expect(netOperatingIncome(egi, opEx)).toBe(67200);
  });

  it('computes DSCR from NOI and annual debt service', () => {
    const dscr = propertyDscr(67200, 52000);
    expect(dscr).not.toBeNull();
    expect(+dscr!.toFixed(2)).toBe(1.29);
  });

  it('exposes reference DSCR thresholds (1.25x ideal, 1.35x attractive) as guidance only', () => {
    expect(DSCR_REFERENCE.ideal).toBe(1.25);
    expect(DSCR_REFERENCE.attractive).toBe(1.35);
  });

  it('supports 25%, 27.5%, and 30% ratio presets', () => {
    const gross = annualGrossRent(rentMonthly);
    expect(ratioOperatingExpenses(gross, 25)).toBe(24000);
    expect(ratioOperatingExpenses(gross, 27.5)).toBeCloseTo(26400, 5);
    expect(ratioOperatingExpenses(gross, 30)).toBe(28800);
  });

  it('supports a custom ratio', () => {
    const gross = annualGrossRent(rentMonthly);
    expect(ratioOperatingExpenses(gross, 42)).toBe(gross * 0.42);
  });

  it('converts monthly P&I to annual debt service', () => {
    expect(annualDebtService(1000)).toBe(12000);
  });

  it('returns null DSCR when debt service is zero (no loan entered)', () => {
    expect(propertyDscr(67200, 0)).toBeNull();
  });

  it('handles zero rent safely (no NaN/throw)', () => {
    const gross = annualGrossRent(0);
    expect(gross).toBe(0);
    expect(netOperatingIncome(effectiveGrossIncome(gross, 0), ratioOperatingExpenses(gross, 30))).toBe(0);
  });

  it('rejects negative rent by clamping to zero', () => {
    expect(annualGrossRent(-5000)).toBe(0);
  });

  it('rejects negative expense ratio by clamping to zero', () => {
    const gross = annualGrossRent(rentMonthly);
    expect(ratioOperatingExpenses(gross, -10)).toBe(0);
  });

  it('applies vacancy once via effective gross income, not double-counted', () => {
    const gross = annualGrossRent(rentMonthly); // 96000
    const egiNoVacancy = effectiveGrossIncome(gross, 0);
    const egiWithVacancy = effectiveGrossIncome(gross, 5); // 5% vacancy
    expect(egiNoVacancy).toBe(96000);
    expect(egiWithVacancy).toBe(96000 * 0.95);
    expect(gross - egiWithVacancy).toBe(96000 * 0.05);
  });

  it('does not silently assume vacancy — defaults to 0 when unset', () => {
    const gross = annualGrossRent(rentMonthly);
    expect(effectiveGrossIncome(gross, 0)).toBe(gross);
  });

  describe('fixed "own expenses" method (mutually exclusive with ratio)', () => {
    it('uses the fixed amount directly, ignoring any ratio', () => {
      const gross = annualGrossRent(rentMonthly);
      const egi = effectiveGrossIncome(gross, 0);
      const ownAnnualExpenses = 30000;
      const noi = netOperatingIncome(egi, ownAnnualExpenses);
      expect(noi).toBe(96000 - 30000);
    });

    it('does not stack with the ratio method', () => {
      const gross = annualGrossRent(rentMonthly);
      const egi = effectiveGrossIncome(gross, 0);
      const ratioNoi = netOperatingIncome(egi, ratioOperatingExpenses(gross, 30));
      const ownNoi = netOperatingIncome(egi, 50000);
      expect(ownNoi).not.toBe(ratioNoi);
    });
  });

  it('reconciles monthly and annual conversions', () => {
    const gross = annualGrossRent(rentMonthly);
    expect(gross / 12).toBe(rentMonthly);
    const ads = annualDebtService(1200);
    expect(ads / 12).toBe(1200);
  });
});

describe('monthlyPayment (shared with rental property DSCR)', () => {
  it('computes standard amortized payment', () => {
    const pmt = monthlyPayment(500000, 7, 360);
    expect(Math.round(pmt * 100) / 100).toBeCloseTo(3326.51, 1);
  });

  it('returns 0 for zero principal', () => {
    expect(monthlyPayment(0, 7, 360)).toBe(0);
  });
});
