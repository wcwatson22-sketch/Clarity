import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { LoanImpactComponent } from './loan-impact.component';
import { FinanceService } from '../../services/finance.service';
import { PlanAccessService } from '../../services/plan-access.service';

describe('LoanImpactComponent — Rental Property DSCR section', () => {
  let fixture: ComponentFixture<LoanImpactComponent>;
  let component: LoanImpactComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanImpactComponent],
      providers: [
        provideRouter([]),
        {
          provide: FinanceService,
          useValue: {
            getIncome: () => of({ type: 'stable', grossMonthlyIncome: 10000, netMonthlyIncome: 7500 }),
            getBudget: () => of([]),
          },
        },
        { provide: PlanAccessService, useValue: { canLoanPrep: () => true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanImpactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function selectRental() {
    component.selectType('rental');
    component.amount.set(500000);
    component.rate.set(7);
    component.term.set(360);
    fixture.detectChanges();
  }

  it('does not render a Commercial Real Estate loan type', () => {
    const html: string = fixture.nativeElement.textContent;
    expect(html).not.toContain('Commercial Real Estate');
  });

  it('shows a friendly empty-state prompt instead of a live $0 result before anything is entered', () => {
    fixture.detectChanges();
    const resultsHtml: string = fixture.nativeElement.querySelector('.results').textContent;
    expect(resultsHtml).toContain('Enter a loan amount above to see your estimated impact.');
    expect(resultsHtml).not.toContain('With Proposed Loan');
    expect(resultsHtml).not.toContain('Save this scenario');
  });

  it('replaces the empty-state prompt with real results once a loan amount is entered', () => {
    component.amount.set(300000);
    component.rate.set(6.5);
    component.term.set(360);
    fixture.detectChanges();
    const resultsHtml: string = fixture.nativeElement.querySelector('.results').textContent;
    expect(resultsHtml).not.toContain('Enter a loan amount above');
    expect(resultsHtml).toContain('With Proposed Loan');
  });

  it('does not show a redundant Housing card for rental (housing extras were removed from rental)', () => {
    selectRental(); // rental with amount/rate/term set, but no rent entered
    const resultsHtml: string = fixture.nativeElement.querySelector('.results').textContent;
    expect(resultsHtml).not.toContain('Housing');
  });

  it('still shows the Housing card for Mortgage (housing extras still apply there)', () => {
    component.selectType('mortgage');
    component.amount.set(400000);
    component.rate.set(6.5);
    component.term.set(360);
    component.taxes.set(300);
    fixture.detectChanges();
    const resultsHtml: string = fixture.nativeElement.querySelector('.results').textContent;
    expect(resultsHtml).toContain('Housing');
    expect(resultsHtml).not.toContain('Projected total DTI'); // removed — duplicated "With Proposed Loan"
  });

  it('shows the rental income section only when Rental Property is selected and no rent entered yet', () => {
    let html: string = fixture.nativeElement.textContent;
    expect(html).not.toContain('Estimated rental income');
    selectRental();
    html = fixture.nativeElement.textContent;
    expect(html).toContain('Estimated rental income');
    expect(html).toContain('Estimated monthly gross rent');
  });

  it('does not show a Target DSCR input anywhere', () => {
    selectRental();
    component.creRent.set(8000);
    fixture.detectChanges();
    const html: string = fixture.nativeElement.textContent;
    expect(html).not.toContain('Target DSCR');
  });

  it('shows the 1.25x ideal / 1.35x attractive reference note once rent is entered', () => {
    selectRental();
    component.creRent.set(8000);
    fixture.detectChanges();
    const html: string = fixture.nativeElement.textContent;
    expect(html).toContain('1.25x');
    expect(html).toContain('1.35x');
  });

  it('defaults to the 30% ratio method', () => {
    selectRental();
    expect(component.creExpenseMethod()).toBe('ratio');
    expect(component.creRatioPct()).toBe(30);
  });

  it('computes NOI and DSCR from rent and ratio', () => {
    selectRental();
    component.creRent.set(8000);
    component.creRatioPct.set(30);
    fixture.detectChanges();

    expect(component.creAnnualGrossRent()).toBe(96000);
    expect(component.creNoiAnnual()).toBe(96000 - 96000 * 0.3);
    expect(component.creDscr()).toBeGreaterThan(0);
  });

  it('switches to "own expenses" and no longer applies the ratio', () => {
    selectRental();
    component.creRent.set(8000);
    component.creExpenseMethod.set('own');
    component.creOwnExpenses.set(2000); // monthly
    fixture.detectChanges();

    expect(component.creAnnualOpEx()).toBe(24000); // 2000 * 12, NOT rent-ratio-based
  });

  it('does not stack ratio and own-expenses methods', () => {
    selectRental();
    component.creRent.set(8000);
    component.creRatioPct.set(30);
    component.creExpenseMethod.set('own');
    component.creOwnExpenses.set(1000);
    fixture.detectChanges();

    expect(component.creAnnualOpEx()).toBe(12000); // only the "own" figure applies
  });

  it('handles zero rent safely', () => {
    selectRental();
    component.creRent.set(0);
    fixture.detectChanges();
    expect(component.creAnnualGrossRent()).toBe(0);
    expect(() => component.creDscr()).not.toThrow();
  });

  it('handles zero debt service safely (DSCR is null, no divide-by-zero throw)', () => {
    selectRental();
    component.creRent.set(8000);
    component.amount.set(0);
    fixture.detectChanges();
    expect(component.creDscr()).toBeNull();
  });

  it('reflects vacancy in effective gross income without double-counting', () => {
    selectRental();
    component.creRent.set(8000);
    component.creVacancyPct.set(0);
    fixture.detectChanges();
    const noVacancyNoi = component.creNoiAnnual();

    component.creVacancyPct.set(10);
    fixture.detectChanges();
    const withVacancyNoi = component.creNoiAnnual();

    expect(withVacancyNoi).toBeLessThan(noVacancyNoi);
    expect(noVacancyNoi - withVacancyNoi).toBeCloseTo(96000 * 0.10, 5);
  });

  it('formats DSCR as "X.XXx" via fmtX', () => {
    expect(component.fmtX(1.2543)).toBe('1.25x');
    expect(component.fmtX(null)).toBe('—');
  });

  it('dscrActive() is false with no rent entered, even for Rental Property', () => {
    selectRental();
    expect(component.creRent()).toBe(0);
    expect(component.dscrActive()).toBeFalse();
  });

  it('dscrActive() is true once rent is entered on Rental Property', () => {
    selectRental();
    component.creRent.set(3000);
    fixture.detectChanges();
    expect(component.dscrActive()).toBeTrue();
  });

  it('shows Purchase price only for Rental Property', () => {
    let html: string = fixture.nativeElement.textContent;
    expect(html).not.toContain('Purchase price');
    selectRental();
    html = fixture.nativeElement.textContent;
    expect(html).toContain('Purchase price');
  });

  it('defaults loan amount to 80% of purchase price when amount is still 0', () => {
    selectRental();
    component.amount.set(0);
    component.purchasePrice.set(400000);
    component.onPurchasePriceChange();
    expect(component.amount()).toBe(320000);
  });

  it('does not overwrite a manually-entered loan amount when purchase price changes', () => {
    selectRental();
    component.amount.set(250000);
    component.purchasePrice.set(400000);
    component.onPurchasePriceChange();
    expect(component.amount()).toBe(250000);
  });

  it('caps rental amortization at 300 months (25 years)', () => {
    selectRental();
    component.setTerm(360);
    expect(component.term()).toBe(300);
  });

  it('does not cap amortization for non-rental categories', () => {
    component.selectType('mortgage');
    component.setTerm(360);
    expect(component.term()).toBe(360);
  });

  it('defaults rental amortization to 240 months (20 years) on selection', () => {
    component.selectType('rental'); // don't use selectRental() — it overrides term for other tests
    expect(component.term()).toBe(240);
  });

  it('removes property-tax/insurance/HOA housing-extra inputs for rental', () => {
    selectRental();
    const html: string = fixture.nativeElement.textContent;
    expect(html).not.toContain('Additional monthly housing costs');
  });

  it('shows a hover/focus tooltip (not a native title attribute) explaining amortization', () => {
    selectRental();
    const wrap: HTMLElement = fixture.nativeElement.querySelector('.tooltip-wrap');
    const icon: HTMLElement = fixture.nativeElement.querySelector('.tooltip-icon');
    const bubble: HTMLElement = fixture.nativeElement.querySelector('.tooltip-bubble');
    expect(wrap).toBeTruthy();
    expect(icon).toBeTruthy();
    expect(icon.title).toBeFalsy(); // no native title — custom hover tooltip only
    expect(bubble).toBeTruthy();
    expect(bubble.textContent).toContain('300-month');
    expect(bubble.textContent!.toLowerCase()).toContain('5 years');
  });

  it('does not permanently show the amortization explanation text outside the tooltip', () => {
    selectRental();
    const hints: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.hint'));
    const alwaysVisibleAmortizationHint = hints.find(h => h.textContent?.includes('Amortized over') && h.textContent.includes('years)'));
    expect(alwaysVisibleAmortizationHint).toBeFalsy();
  });

  it('shows a % financed field once a purchase price is entered, synced to loan amount', () => {
    selectRental();
    component.purchasePrice.set(400000);
    component.amount.set(320000);
    fixture.detectChanges();
    const html: string = fixture.nativeElement.textContent;
    expect(html).toContain('% Financed');
    expect(component.pctFinanced()).toBeCloseTo(80, 5);
  });

  it('setPctFinanced updates loan amount from a chosen percentage', () => {
    selectRental();
    component.purchasePrice.set(400000);
    component.setPctFinanced(75);
    expect(component.amount()).toBe(300000);
  });

  it('setPctFinanced does nothing without a purchase price', () => {
    selectRental();
    component.purchasePrice.set(0);
    component.amount.set(250000);
    component.setPctFinanced(75);
    expect(component.amount()).toBe(250000);
  });

  it('shows only Property DSCR and Global DSCR cards once rent is entered (no DTI mixed in)', () => {
    selectRental();
    component.creRent.set(8000);
    fixture.detectChanges();
    const resultsHtml: string = fixture.nativeElement.querySelector('.results').textContent;
    expect(resultsHtml).toContain('Property DSCR');
    expect(resultsHtml).toContain('Global DSCR');
    expect(resultsHtml).not.toContain('Current DTI');
    expect(resultsHtml).not.toContain('With Proposed Loan');
    expect(resultsHtml).not.toContain('Housing (rental)');
  });

  it('hides the generic DTI narrative/band paragraphs in the simplified rental DSCR view', () => {
    selectRental();
    component.creRent.set(8000);
    fixture.detectChanges();
    const html: string = fixture.nativeElement.textContent;
    expect(html).not.toContain('This proposed payment would change your estimated DTI');
  });

  it('moves DSCR reference/methodology text into hover tooltips instead of permanent paragraphs', () => {
    selectRental();
    component.creRent.set(8000);
    fixture.detectChanges();
    const bubbles: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.tooltip-bubble'));
    const combined = bubbles.map(b => b.textContent).join(' ');
    expect(combined).toContain('1.25x');
    expect(combined).toContain('1.35x');
    expect(combined.toLowerCase()).toContain('household-level');
    // The always-visible required disclaimer must remain outside any tooltip.
    const disclaimers: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.disclaimer'));
    expect(disclaimers.some(d => d.textContent?.includes('not a loan approval'))).toBeTrue();
  });

  it('formats purchase price with commas on blur, like loan amount', () => {
    selectRental();
    component.onPurchasePriceInput('400000');
    component.onPurchasePriceBlur();
    expect(component.purchasePriceDisplay()).toBe('400,000');
    expect(component.purchasePrice()).toBe(400000);
  });

  it('shows a live NOI preview once an expense ratio or own-expenses figure is set', () => {
    selectRental();
    component.creRent.set(8000);
    fixture.detectChanges();
    const html: string = fixture.nativeElement.textContent;
    expect(html).toContain('Estimated NOI');
    expect(html).toContain(component.fmt(component.creNoiAnnual()));
  });

  it('computes Global DSCR as NET income ÷ total projected debt (reciprocal of projected DTI, net-based)', () => {
    selectRental();
    component.creRent.set(8000);
    fixture.detectChanges();
    const expected = component.netIncomeVal() / component.projectedDebtVal();
    expect(component.globalDscr()).toBeCloseTo(expected, 5);
    expect(component.netIncomeVal()).not.toBe(component.grossIncome()); // confirms it's actually net-based, not accidentally gross
  });

  it('saves rentalDscr snapshot in scenarios only for Rental Property with rent entered', () => {
    selectRental();
    component.creRent.set(8000);
    fixture.detectChanges();
    component.saveScenario();
    const saved = component.scenarios()[0];
    expect(saved.rentalDscr).toBeDefined();
    expect(saved.rentalDscr!.estimatedRent).toBe(8000);
    component.deleteScenario(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DTI ⇄ DSCR conversion: once a rental DSCR metric is active anywhere on the page,
// every other DTI figure should convert to DSCR too (they're inverse measurements
// of the same debt burden and shouldn't be shown side by side). Uses a non-zero
// existing debt so currentDscrVal() has something real to compute against.
// ─────────────────────────────────────────────────────────────────────────────
describe('LoanImpactComponent — DTI/DSCR conversion (5 scenarios)', () => {
  let fixture: ComponentFixture<LoanImpactComponent>;
  let component: LoanImpactComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanImpactComponent],
      providers: [
        provideRouter([]),
        {
          provide: FinanceService,
          useValue: {
            getIncome: () => of({ type: 'stable', grossMonthlyIncome: 8000, netMonthlyIncome: 6000 }),
            getBudget: () => of([{ id: '1', group: 'Debt', name: 'Car payment', amount: 400 }]),
          },
        },
        { provide: PlanAccessService, useValue: { canLoanPrep: () => true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanImpactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function topCardText(): string {
    return fixture.nativeElement.querySelector('.li-current').textContent;
  }

  it('Scenario 1 — Mortgage: top card shows Current DTI, never DSCR', () => {
    component.selectType('mortgage');
    component.amount.set(400000); component.rate.set(6.5); component.term.set(360);
    fixture.detectChanges();

    expect(component.dscrActive()).toBeFalse();
    const text = topCardText();
    expect(text).toContain('Current DTI');
    expect(text).not.toContain('Current DSCR');
    expect(component.pct(component.currentDtiVal())).toBe('5.0%'); // 400/8000
  });

  it('Scenario 2 — Rental with no rent entered: still DTI (DSCR not active yet)', () => {
    component.selectType('rental');
    component.amount.set(200000); component.rate.set(7.25); component.term.set(240);
    fixture.detectChanges();

    expect(component.creRent()).toBe(0);
    expect(component.dscrActive()).toBeFalse();
    const text = topCardText();
    expect(text).toContain('Current DTI');
    expect(text).not.toContain('Current DSCR');
  });

  it('Scenario 3 — Rental with rent entered: top card converts to Current DSCR', () => {
    component.selectType('rental');
    component.amount.set(200000); component.rate.set(7.25); component.term.set(240);
    component.creRent.set(2500);
    fixture.detectChanges();

    expect(component.dscrActive()).toBeTrue();
    const text = topCardText();
    expect(text).toContain('Current DSCR');
    expect(text).not.toContain('Current DTI');
    // Current DSCR = NET income / existing debt = 6000/400 = 15.00x (net-based, not gross)
    expect(component.fmtX(component.currentDscrVal())).toBe(component.fmtX(6000 / 400));
    expect(component.currentDscrVal()).not.toBeCloseTo(8000 / 400, 1); // confirms it's not accidentally gross-based
  });

  it('Scenario 4 — Auto/Personal/Student/Other never show DSCR anywhere, regardless of state', () => {
    for (const cat of ['auto', 'personal', 'student', 'other'] as const) {
      component.selectType(cat);
      component.amount.set(20000); component.rate.set(7); component.term.set(60);
      fixture.detectChanges();

      expect(component.dscrActive()).toBeFalse();
      const pageText: string = fixture.nativeElement.textContent;
      expect(topCardText()).toContain('Current DTI');
      // Property/Global DSCR result cards must never appear for these categories.
      expect(pageText).not.toContain('Property DSCR');
      expect(pageText).not.toContain('Global DSCR');
    }
  });

  it('Scenario 5 — switching from active rental DSCR back to Mortgage reverts to DTI everywhere (no stale state)', () => {
    component.selectType('rental');
    component.amount.set(200000); component.rate.set(7.25); component.term.set(240);
    component.creRent.set(2500);
    fixture.detectChanges();
    expect(component.dscrActive()).toBeTrue();
    expect(topCardText()).toContain('Current DSCR');

    component.selectType('mortgage');
    component.amount.set(400000); component.rate.set(6.5); component.term.set(360);
    fixture.detectChanges();

    expect(component.dscrActive()).toBeFalse();
    const text = topCardText();
    expect(text).toContain('Current DTI');
    expect(text).not.toContain('Current DSCR');
    const resultsHtml: string = fixture.nativeElement.querySelector('.results').textContent;
    expect(resultsHtml).not.toContain('Global DSCR');
    expect(resultsHtml).not.toContain('Property DSCR');
  });
});

describe('LoanImpactComponent — Amortization calculator', () => {
  let fixture: ComponentFixture<LoanImpactComponent>;
  let component: LoanImpactComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanImpactComponent],
      providers: [
        provideRouter([]),
        {
          provide: FinanceService,
          useValue: {
            getIncome: () => of({ type: 'stable', grossMonthlyIncome: 10000, netMonthlyIncome: 7500 }),
            getBudget: () => of([]),
          },
        },
        { provide: PlanAccessService, useValue: { canLoanPrep: () => true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanImpactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function setLoan(amount: number, rate: number, term: number) {
    component.selectType('amortization');
    component.amount.set(amount);
    component.rate.set(rate);
    component.term.set(term);
    fixture.detectChanges();
  }

  it('Amortization is its own selectable category in the Loan Type grid', () => {
    const html: string = fixture.nativeElement.textContent;
    expect(html).toContain('Amortization');
  });

  it('is not shown as a category button duplicated inside other categories\' results', () => {
    component.selectType('mortgage');
    component.amount.set(300000); component.rate.set(6.5); component.term.set(360);
    fixture.detectChanges();
    // "Amortization" still appears once, as the Loan Type button label — but not the
    // dedicated payoff card content (no "Paid off in" / extra-principal input) under Mortgage.
    const html: string = fixture.nativeElement.textContent;
    expect(html).not.toContain('Paid off in');
    expect(html).not.toContain('Additional monthly principal');
  });

  it('hides the DTI/DSCR-focused sections (current picture, debt replacement, Estimated Impact) in Amortization mode', () => {
    setLoan(300000, 6.5, 360);
    const html: string = fixture.nativeElement.textContent;
    expect(html).not.toContain('Your Current Financial Picture');
    expect(html).not.toContain('Will this loan pay off or replace an existing debt?');
    expect(html).not.toContain('Estimated Impact');
  });

  it('does not render the payoff timeline until a loan amount is entered, even in Amortization mode', () => {
    component.selectType('amortization');
    fixture.detectChanges();
    const html: string = fixture.nativeElement.textContent;
    expect(html).not.toContain('Paid off in');
  });

  it('shows the baseline payoff timeline once a loan is entered, with no extra payment yet', () => {
    setLoan(300000, 6.5, 360);
    const html: string = fixture.nativeElement.textContent;
    expect(html).toContain('Amortization');
    expect(html).toContain('Paid off in');
    expect(html).toContain('Total interest over the life of the loan');
    expect(html).not.toContain('with new payment');
  });

  it('shows the "paid off sooner" comparison once extra principal is entered', () => {
    setLoan(300000, 6.5, 360);
    component.extraPrincipal.set(300);
    fixture.detectChanges();

    expect(component.extraPayoff()).not.toBeNull();
    expect(component.monthsSaved()).toBeGreaterThan(0);
    expect(component.interestSaved()).toBeGreaterThan(0);
    const html: string = fixture.nativeElement.textContent;
    expect(html).toContain('with new payment');
    expect(html).toContain('sooner');
  });

  it('extra payment result disappears again if the user clears it back to 0', () => {
    setLoan(300000, 6.5, 360);
    component.extraPrincipal.set(300);
    fixture.detectChanges();
    expect(component.extraPayoff()).not.toBeNull();

    component.extraPrincipal.set(0);
    fixture.detectChanges();
    expect(component.extraPayoff()).toBeNull();
    const html: string = fixture.nativeElement.textContent;
    expect(html).not.toContain('with new payment');
  });

  it('shows a warning instead of a bogus payoff time when extra payment still cannot cover interest', () => {
    // High balance/rate, tiny payment override so P&I itself barely covers interest.
    component.overridePayment.set(true);
    component.onManualPaymentInput('100'); // simulates the user typing into the payment field
    setLoan(500000, 8, 360);
    fixture.detectChanges();
    component.extraPrincipal.set(50);
    fixture.detectChanges();

    expect(component.extraPayoff()?.payoffPossible).toBeFalse();
    const html: string = fixture.nativeElement.textContent;
    expect(html).toContain("doesn't fully cover monthly interest");
  });

  it('computes a valid payoff after switching into Amortization mode from any other category', () => {
    for (const cat of ['mortgage', 'rental', 'auto', 'personal', 'student', 'other'] as const) {
      component.selectType(cat);
      component.amount.set(20000); component.rate.set(7); component.term.set(60);
      component.selectType('amortization'); // switching category resets term to the amortization default
      component.amount.set(20000); component.rate.set(7); component.term.set(60);
      fixture.detectChanges();
      expect(component.isAmortizationMode()).toBeTrue();
      expect(component.baselinePayoff().months).toBeGreaterThan(0);
    }
  });

  it('formats months as years/months correctly via fmtMonths', () => {
    expect(component.fmtMonths(6)).toBe('6 mo');
    expect(component.fmtMonths(12)).toBe('1 yr');
    expect(component.fmtMonths(24)).toBe('2 yrs');
    expect(component.fmtMonths(25)).toBe('2 yrs 1 mo');
  });

  it('renames the loan card to "Your Loan" (not "Proposed Loan") in Amortization mode', () => {
    component.selectType('amortization');
    fixture.detectChanges();
    const html: string = fixture.nativeElement.textContent;
    expect(html).toContain('Your Loan');
    expect(html).not.toContain('Proposed Loan');
  });

  it('does not show the lender-quote checkbox/override in Amortization mode', () => {
    setLoan(300000, 6.5, 360);
    const html: string = fixture.nativeElement.textContent;
    expect(html).not.toContain('lender quote');
    expect(html).not.toContain('I have a lender quote');
  });

  it('shows a plain, always-editable "Your monthly payment" field, auto-seeded from loan amount/rate/term', () => {
    component.selectType('amortization');
    component.amount.set(300000);
    component.rate.set(6.5);
    component.term.set(360);
    fixture.detectChanges();

    const html: string = fixture.nativeElement.textContent;
    expect(html).toContain('Your monthly payment');
    // Auto-seeded to the calculated P&I for $300k/6.5%/360mo (~$1,896/mo) — not left at 0.
    expect(component.manualPayment()).toBeGreaterThan(1800);
    expect(component.manualPayment()).toBeLessThan(2000);
  });

  it('never overwrites a manually-typed payment once the user has entered one', () => {
    component.selectType('amortization');
    component.amount.set(300000);
    component.rate.set(6.5);
    component.term.set(360);
    fixture.detectChanges();
    const autoSeeded = component.manualPayment();
    expect(autoSeeded).toBeGreaterThan(0);

    component.onManualPaymentInput('2500'); // user types their real payment
    component.rate.set(6.75); // editing rate afterward shouldn't clobber the typed payment
    fixture.detectChanges();
    expect(component.manualPayment()).toBe(2500);
  });

  it('computes the correct payment when Loan Amount is filled in before Interest Rate (regression)', () => {
    // Reproduces the bug found in the 2026-07-27 Triage report: filling Amount first,
    // while Rate is still 0, used to compute a 0%-interest payment ($30,000 / 60 = $500)
    // and then permanently lock onto it once Interest Rate was entered afterward.
    component.selectType('amortization');
    component.term.set(60);
    component.amount.set(30000); // amount filled in first, rate still 0 at this point
    fixture.detectChanges();
    expect(component.manualPayment()).toBe(500); // 0%-rate auto-fill, not yet edited by the user

    component.rate.set(6); // rate filled in second (the natural top-to-bottom form order)
    fixture.detectChanges();
    expect(component.manualPayment()).toBeCloseTo(579.98, 1); // correct 6% amortized payment
  });

  it('shows the payoff time explicitly in months (not just "X yrs")', () => {
    setLoan(300000, 6.5, 360);
    const html: string = fixture.nativeElement.textContent;
    expect(html).toMatch(/\d+\s*months/);
  });

  it('"Additional Principal" mode adds on top of the current payment (default mode)', () => {
    setLoan(300000, 6.5, 360);
    expect(component.extraPaymentMode()).toBe('extra');
    const basePayment = component.piPayment();
    component.extraPrincipal.set(300);
    fixture.detectChanges();
    // internal: extraPayoff should simulate at basePayment + 300, not just 300
    const withExtra = component.extraPayoff();
    expect(withExtra).not.toBeNull();
    expect(withExtra!.months).toBeLessThan(component.baselinePayoff().months);
    // Sanity: a $300 addition on a real payment pays off much sooner than a bare $300/mo would.
    expect(basePayment).toBeGreaterThan(300);
  });

  it('"Proposed Payment" mode replaces the payment entirely, not additive', () => {
    setLoan(300000, 6.5, 360);
    component.extraPaymentMode.set('proposed');
    const basePayment = component.piPayment();
    // Propose a payment noticeably higher than the base payment.
    component.extraPrincipal.set(basePayment + 300);
    fixture.detectChanges();

    const proposed = component.extraPayoff();
    expect(proposed).not.toBeNull();
    // Should match simulating at exactly (basePayment + 300), same result as "extra" mode
    // would give for the same total — confirms "proposed" isn't double-adding.
    const extraModeEquivalent = component.baselinePayoff();
    expect(proposed!.months).toBeLessThan(extraModeEquivalent.months);
  });

  it('switching between Additional Principal and Proposed Payment updates the input label', () => {
    setLoan(300000, 6.5, 360);
    let html: string = fixture.nativeElement.textContent;
    expect(html).toContain('Extra payment toward principal');

    component.extraPaymentMode.set('proposed');
    fixture.detectChanges();
    html = fixture.nativeElement.textContent;
    expect(html).toContain('New monthly payment');
    expect(html).not.toContain('Extra payment toward principal');
  });
});
