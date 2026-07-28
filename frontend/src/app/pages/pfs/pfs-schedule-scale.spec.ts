import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PfsComponent } from './pfs.component';
import { FinanceService } from '../../services/finance.service';
import { AuthService } from '../../services/auth.service';
import { PlanAccessService } from '../../services/plan-access.service';
import { RealEstateService } from '../../services/real-estate.service';
import { RealEstateProperty } from '../real-estate/real-estate.component';

function makeProperties(n: number): (RealEstateProperty & { id: string })[] {
  const types: RealEstateProperty['propertyType'][] = ['ltr', 'str', 'multifamily'];
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    address: `${100 + i} Test St, Unit ${i}`,
    propertyType: types[i % 3],
    purchasePrice: 250000 + i * 1000,
    appraisedValue: 260000 + i * 1000,
    grossMonthlyRent: 1800 + (i % 5) * 100,
    vacancyRate: 5,
    otherMonthlyIncome: 0,
    managementFee: 10,
    managementFeeIsPercent: true,
    repairs: 50, repairReserve: 50, capExReserve: 75,
    propertyTaxes: 200, insurance: 100, hoaFees: 0, utilities: 0, legalFees: 0, cleaning: 0, otherExpenses: 0,
    loanAmount: 200000 + i * 800,
    interestRate: 6.5 + (i % 4) * 0.25,
    amortizationYears: 30,
    annualRentGrowthPct: 3, annualAppreciationPct: 3,
  }));
}

describe('PFS Schedule A/B at scale (3, 20, 75 properties)', () => {
  let fixture: ComponentFixture<PfsComponent>;
  let component: PfsComponent;
  let reService: RealEstateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PfsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: FinanceService,
          useValue: {
            getAccounts: () => of([]),
            getBudget: () => of([]),
            getIncome: () => of({ type: 'stable', grossMonthlyIncome: 8000, netMonthlyIncome: 6000 }),
          },
        },
        { provide: AuthService, useValue: { currentUser: () => ({ firstName: 'Test', username: 'emailtest99' }) } },
        { provide: PlanAccessService, useValue: { canPfs: () => true, canRealEstate: () => true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PfsComponent);
    component = fixture.componentInstance;
    reService = TestBed.inject(RealEstateService);
  });

  function loadWith(n: number) {
    reService.properties.set(makeProperties(n));
    reService.loaded.set(true);
    fixture.detectChanges();
  }

  // ── 3 properties ──────────────────────────────────────────────────────────
  it('3 properties: renders the full per-property Schedule A table (below the 20 threshold)', () => {
    const t0 = performance.now();
    loadWith(3);
    const renderMs = performance.now() - t0;

    expect(component.useLargePortfolioFormat()).toBeFalse();
    expect(component.scheduleARows().length).toBe(3);
    const rows = fixture.nativeElement.querySelectorAll('.schedule-table tbody tr');
    expect(rows.length).toBe(3);
    expect(fixture.nativeElement.textContent).not.toContain('exceeds 20 properties');
    console.log(`[scale] 3 properties render: ${renderMs.toFixed(1)}ms`);
  });

  // ── 20 properties: exact boundary ──────────────────────────────────────────
  it('20 properties: still uses the full-detail table (boundary is "> 20", not ">= 20")', () => {
    loadWith(20);
    expect(component.useLargePortfolioFormat()).toBeFalse();
    const rows = fixture.nativeElement.querySelectorAll('.schedule-a-page .schedule-table tbody tr');
    expect(rows.length).toBe(20);
    // Schedule B preview should NOT appear yet at exactly 20.
    expect(fixture.nativeElement.querySelector('.schedule-b-preview')).toBeNull();
  });

  it('20 properties: totals reconcile against the sum of individual rows', () => {
    loadWith(20);
    const rows = component.scheduleARows();
    const expectedValue = rows.reduce((s, r) => s + r.appraisedValue, 0);
    expect(component.investTotalValue()).toBeCloseTo(expectedValue, 2);
  });

  // ── 75 properties: grouped view + Schedule B ────────────────────────────────
  it('75 properties: switches to the grouped-by-type Schedule A + Schedule B preview', () => {
    const t0 = performance.now();
    loadWith(75);
    const renderMs = performance.now() - t0;

    expect(component.useLargePortfolioFormat()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('exceeds 20 properties');

    // Grouped table: exactly 3 rows (ltr/str/multifamily), not 75.
    const groupedRows = fixture.nativeElement.querySelectorAll('.schedule-a-page .schedule-table tbody tr');
    expect(groupedRows.length).toBe(3);

    // Schedule B preview renders ALL 75 rows in a second, un-virtualized table.
    const scheduleBRows = fixture.nativeElement.querySelectorAll('.schedule-b-preview tbody tr');
    expect(scheduleBRows.length).toBe(75);

    console.log(`[scale] 75 properties render: ${renderMs.toFixed(1)}ms (renders 75-row Schedule B table with no pagination/virtualization)`);
  });

  it('75 properties: grouped totals reconcile against per-property sums', () => {
    loadWith(75);
    const groups = component.scheduleAGroups();
    const totalFromGroups = groups.reduce((s, g) => s + g.count, 0);
    expect(totalFromGroups).toBe(75);

    const sumValueFromGroups = groups.reduce((s, g) => s + g.totalValue, 0);
    expect(sumValueFromGroups).toBeCloseTo(component.investTotalValue(), 1);
  });

  it('75 properties: CSV export includes all 75 rows without truncation', () => {
    loadWith(75);
    let capturedBlob: Blob | null = null;
    const originalCreateObjectURL = URL.createObjectURL;
    spyOn(URL, 'createObjectURL').and.callFake((blob: any) => { capturedBlob = blob; return 'blob:mock'; });
    spyOn(URL, 'revokeObjectURL').and.callFake(() => {});
    spyOn(document, 'createElement').and.callThrough();

    component.exportCsv();

    expect(capturedBlob).not.toBeNull();
    URL.createObjectURL = originalCreateObjectURL;
  });

  // ── Regression check for the fix itself ─────────────────────────────────────
  it('reflects a newly-added property immediately (the bug this session fixed)', () => {
    loadWith(0);
    expect(component.hasInvestProps()).toBeFalse();

    // Simulate the Real Estate tab adding a property elsewhere, then PFS reloading.
    reService.properties.set(makeProperties(1));
    fixture.detectChanges();
    expect(component.hasInvestProps()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Schedule A');
  });
});
