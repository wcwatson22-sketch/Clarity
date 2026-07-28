import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardComponent } from './dashboard.component';
import { FinanceService } from '../../services/finance.service';
import { AuthService } from '../../services/auth.service';
import { RealEstateService } from '../../services/real-estate.service';
import { Snapshot } from '../../models/finance.models';

describe('DashboardComponent — per-account month-over-month history', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;

  function makeSnapshot(id: string, dateIso: string, checkingValue: number, savingsValue?: number): Snapshot {
    return {
      id, netWorth: 0, totalAssets: 0, totalLiabilities: 0, cashPosition: 0, createdAt: dateIso,
      lineItems: [
        { accountId: 'acc-checking', name: 'Checking', category: 'checking', group: 'Cash', type: 'Asset', value: checkingValue },
        ...(savingsValue !== undefined ? [{ accountId: 'acc-savings', name: 'Savings', category: 'savings', group: 'Cash', type: 'Asset' as const, value: savingsValue }] : []),
      ],
    };
  }

  function setup(snapshots: Snapshot[], accounts: any[] = []) {
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: FinanceService,
          useValue: {
            getAccounts: () => of(accounts),
            getSnapshots: () => of(snapshots),
            getBudget: () => of([]),
            getIncome: () => of({ type: 'stable', grossMonthlyIncome: 8000, netMonthlyIncome: 6000 }),
          },
        },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 5, username: 'emailtest99', firstName: 'Test' }) } },
        {
          provide: RealEstateService,
          useValue: {
            hasProperties: () => false, properties: () => [], load: () => {},
            totalGrossRent: () => 0, totalNOI: () => 0, totalCashFlow: () => 0,
            totalValue: () => 0, totalDebt: () => 0, totalEquity: () => 0,
            portfolioLTV: () => 0, portfolioDSCR: () => null,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => { localStorage.clear(); TestBed.resetTestingModule(); });

  it('reports no history for an account that never appeared in a snapshot', () => {
    setup([]);
    expect(component.hasHistory('acc-checking')).toBeFalse();
    expect(component.accountHistory('acc-checking')).toEqual([]);
  });

  it('returns a single baseline entry (no change) for an account with only one snapshot', () => {
    setup([makeSnapshot('s1', '2026-05-01T12:00:00Z', 10000)]);
    expect(component.hasHistory('acc-checking')).toBeTrue();
    const history = component.accountHistory('acc-checking');
    expect(history.length).toBe(1);
    expect(history[0].value).toBe(10000);
    expect(history[0].change).toBeNull();
  });

  it('sorts history chronologically (oldest first) regardless of snapshot array order', () => {
    // Deliberately out of order to prove the sort works.
    setup([
      makeSnapshot('s3', '2026-07-01T12:00:00Z', 12000),
      makeSnapshot('s1', '2026-05-01T12:00:00Z', 10000),
      makeSnapshot('s2', '2026-06-01T12:00:00Z', 10800),
    ]);
    const history = component.accountHistory('acc-checking');
    expect(history.map(h => h.value)).toEqual([10000, 10800, 12000]);
  });

  it('computes the change vs. the immediately prior snapshot, not vs. the baseline', () => {
    setup([
      makeSnapshot('s1', '2026-05-01T12:00:00Z', 10000),
      makeSnapshot('s2', '2026-06-01T12:00:00Z', 10800),
      makeSnapshot('s3', '2026-07-01T12:00:00Z', 10500),
    ]);
    const history = component.accountHistory('acc-checking');
    expect(history[0].change).toBeNull();       // baseline
    expect(history[1].change).toBe(800);        // 10800 - 10000
    expect(history[2].change).toBe(-300);       // 10500 - 10800 (a decrease, not vs. 10000)
  });

  it('tracks each account independently — one account\'s history is unaffected by another\'s values', () => {
    setup([
      makeSnapshot('s1', '2026-05-01T12:00:00Z', 10000, 5000),
      makeSnapshot('s2', '2026-06-01T12:00:00Z', 10800, 5000), // savings unchanged
    ]);
    const checking = component.accountHistory('acc-checking');
    const savings = component.accountHistory('acc-savings');
    expect(checking.length).toBe(2);
    expect(checking[1].change).toBe(800);
  });

  it('collapses to one entry per calendar month — the EARLIEST snapshot in that month wins', () => {
    setup([
      makeSnapshot('s1', '2026-05-01T12:00:00Z', 10000, 5000),
      makeSnapshot('s2', '2026-06-01T12:00:00Z', 10200, 5000), // June's earliest — this one should win
      makeSnapshot('s3', '2026-06-15T12:00:00Z', 10800, 7500), // same month as s2, later — discarded
      makeSnapshot('s4', '2026-06-28T12:00:00Z', 11000, 8000), // same month, later still — discarded
      makeSnapshot('s5', '2026-07-01T12:00:00Z', 12000, 8000),
    ]);
    const checking = component.accountHistory('acc-checking');
    // One row per month: May, June, July — June's value comes from s2 (the 1st), not s3/s4.
    expect(checking.length).toBe(3);
    expect(checking.map(h => h.value)).toEqual([10000, 10200, 12000]);
    expect(checking[1].change).toBe(200);   // 10200 - 10000, from the EARLIEST June snapshot
    expect(checking[2].change).toBe(1800);  // 12000 - 10200

    const savings = component.accountHistory('acc-savings');
    expect(savings.map(h => h.value)).toEqual([5000, 5000, 8000]); // June = s2's 5000, not s3/s4's later values
  });

  it('totalHistoryChange is null when there is only one entry (nothing to compare)', () => {
    setup([makeSnapshot('s1', '2026-05-01T12:00:00Z', 10000)]);
    const history = component.accountHistory('acc-checking');
    expect(component.totalHistoryChange(history)).toBeNull();
  });

  it('totalHistoryChange is the difference between the first and last entries, not a sum of intermediate deltas', () => {
    setup([
      makeSnapshot('s1', '2026-05-01T12:00:00Z', 10000),
      makeSnapshot('s2', '2026-06-01T12:00:00Z', 10800),
      makeSnapshot('s3', '2026-07-01T12:00:00Z', 10500),
    ]);
    const history = component.accountHistory('acc-checking');
    // Matches the Empower example in the report: 13304 -> 13696 -> 14085, total = 14085-13304.
    expect(component.totalHistoryChange(history)).toBe(500); // 10500 - 10000, not (800 + -300)
  });

  it('totalHistoryChange can legitimately be zero (and is not treated as "no total")', () => {
    setup([
      makeSnapshot('s1', '2026-05-01T12:00:00Z', 10000),
      makeSnapshot('s2', '2026-06-01T12:00:00Z', 10000),
    ]);
    const history = component.accountHistory('acc-checking');
    expect(component.totalHistoryChange(history)).toBe(0);
    expect(component.totalHistoryChange(history)).not.toBeNull();
  });

  it('multiple snapshots within the same month never produce more than one history row', () => {
    setup([
      makeSnapshot('s1', '2026-06-05T12:00:00Z', 1000),
      makeSnapshot('s2', '2026-06-10T12:00:00Z', 1500),
      makeSnapshot('s3', '2026-06-20T12:00:00Z', 2000),
    ]);
    const checking = component.accountHistory('acc-checking');
    expect(checking.length).toBe(1); // all three are June — only the earliest (June 5) is kept
    expect(checking[0].value).toBe(1000);
    expect(checking[0].change).toBeNull();
  });

  it('still tracks history correctly across a simulated rename (matched by AccountId, not name)', () => {
    const s1: Snapshot = {
      id: 's1', netWorth: 0, totalAssets: 0, totalLiabilities: 0, cashPosition: 0, createdAt: '2026-05-01T12:00:00Z',
      lineItems: [{ accountId: 'acc-checking', name: 'Old Name', category: 'checking', group: 'Cash', type: 'Asset', value: 10000 }],
    };
    const s2: Snapshot = {
      id: 's2', netWorth: 0, totalAssets: 0, totalLiabilities: 0, cashPosition: 0, createdAt: '2026-06-01T12:00:00Z',
      lineItems: [{ accountId: 'acc-checking', name: 'New Name After Rename', category: 'checking', group: 'Cash', type: 'Asset', value: 11000 }],
    };
    setup([s1, s2]);
    const history = component.accountHistory('acc-checking');
    expect(history.length).toBe(2);
    expect(history[1].value).toBe(11000);
    expect(history[1].change).toBe(1000);
  });

  it('toggleHistory opens and closes the panel for one account at a time', () => {
    setup([makeSnapshot('s1', '2026-05-01T12:00:00Z', 10000)]);
    expect(component.historyOpenId()).toBeNull();
    component.toggleHistory('acc-checking');
    expect(component.historyOpenId()).toBe('acc-checking');
    component.toggleHistory('acc-checking'); // toggling the same one again closes it
    expect(component.historyOpenId()).toBeNull();
    component.toggleHistory('acc-checking');
    component.toggleHistory('acc-savings'); // switching accounts replaces, doesn't stack
    expect(component.historyOpenId()).toBe('acc-savings');
  });

  it('the History button only renders for accounts that have snapshot history', () => {
    setup(
      [makeSnapshot('s1', '2026-05-01T12:00:00Z', 10000)],
      [{ id: 'acc-checking', group: 'Cash', category: 'checking', name: 'Checking', value: 10000, type: 'Asset', updatedAt: '2026-05-01T12:00:00Z' },
       { id: 'acc-untracked', group: 'Cash', category: 'checking', name: 'Untracked', value: 500, type: 'Asset', updatedAt: '2026-07-01T12:00:00Z' }],
    );
    expect(component.hasHistory('acc-checking')).toBeTrue();
    expect(component.hasHistory('acc-untracked')).toBeFalse();
  });
});
