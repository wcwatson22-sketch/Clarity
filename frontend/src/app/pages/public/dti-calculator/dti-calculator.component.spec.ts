import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DtiCalculatorComponent } from './dti-calculator.component';
import { AuthService } from '../../../services/auth.service';

declare global {
  interface Window { dataLayer?: Array<Record<string, unknown>>; }
}

// Fields that must never appear anywhere in a dataLayer event pushed by this
// calculator — income, debts, the result, or any personal identifier.
const FORBIDDEN_KEYS = [
  'grossIncome', 'income', 'housing', 'auto', 'student', 'creditCards', 'personal',
  'other', 'totalDebt', 'debt', 'dti', 'dtiPct', 'result',
  'name', 'email', 'userId', 'user_id',
];

function setup() {
  window.dataLayer = [];
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DtiCalculatorComponent],
    providers: [provideRouter([]), { provide: AuthService, useValue: { isLoggedIn: signal(false), currentUser: signal(null) } }],
  });
  const f = TestBed.createComponent(DtiCalculatorComponent);
  f.detectChanges(); // triggers ngOnInit -> dti_calculator_viewed
  return f;
}

/** No event payload — at any point in the recorded dataLayer — may contain a
 *  forbidden key, and no event's values may equal an entered financial number. */
function assertNoFinancialLeak(sensitiveValues: number[] = []) {
  for (const record of window.dataLayer ?? []) {
    for (const key of Object.keys(record)) {
      expect(FORBIDDEN_KEYS).withContext(`event "${record['event']}" had key "${key}"`).not.toContain(key);
    }
    for (const v of Object.values(record)) {
      if (typeof v === 'number') {
        expect(sensitiveValues).withContext(`event "${record['event']}" leaked numeric value ${v}`).not.toContain(v);
      }
    }
  }
}

describe('DtiCalculatorComponent — analytics privacy', () => {
  afterEach(() => { TestBed.resetTestingModule(); delete window.dataLayer; });

  it('fires dti_calculator_viewed on load with no financial data', () => {
    setup();
    const events = (window.dataLayer ?? []).map(r => r['event']);
    expect(events).toContain('dti_calculator_viewed');
    assertNoFinancialLeak();
  });

  it('fires dti_calculator_started exactly once, without the entered income value', () => {
    const f = setup();
    const c = f.componentInstance;
    c.setField(c.grossIncome.set, '6000');
    c.setField(c.housing.set, '1800'); // second call must not fire "started" again
    const startedCount = (window.dataLayer ?? []).filter(r => r['event'] === 'dti_calculator_started').length;
    expect(startedCount).toBe(1);
    assertNoFinancialLeak([6000, 1800]);
  });

  it('fires dti_calculator_completed once a result exists, without income/debt/DTI values', () => {
    const f = setup();
    const c = f.componentInstance;
    c.setField(c.grossIncome.set, '6000');
    c.setField(c.housing.set, '1800');
    c.setField(c.auto.set, '400');
    c.setField(c.creditCards.set, '150');
    f.detectChanges(); // renders the result, which calls onResultShown()
    const events = (window.dataLayer ?? []).map(r => r['event']);
    expect(events).toContain('dti_calculator_completed');
    // 39.166...% and $2,350 must never leak into the event stream.
    assertNoFinancialLeak([6000, 1800, 400, 150, 2350, 39.16666666666667]);
  });

  it('fires dti_calculator_signup_clicked with no payload beyond the event name', () => {
    const f = setup();
    f.componentInstance.trackSignup();
    const record = (window.dataLayer ?? []).find(r => r['event'] === 'dti_calculator_signup_clicked');
    expect(record).toEqual({ event: 'dti_calculator_signup_clicked' });
  });

  it('fires dti_calculator_article_clicked with only a slug, never financial data', () => {
    const f = setup();
    f.componentInstance.trackArticle('what-is-dti');
    const record = (window.dataLayer ?? []).find(r => r['event'] === 'dti_calculator_article_clicked');
    expect(record).toEqual({ event: 'dti_calculator_article_clicked', slug: 'what-is-dti' });
    assertNoFinancialLeak();
  });
});
