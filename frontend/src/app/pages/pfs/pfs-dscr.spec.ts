import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { PfsComponent } from './pfs.component';
import { FinanceService } from '../../services/finance.service';
import { AuthService } from '../../services/auth.service';
import { PlanAccessService } from '../../services/plan-access.service';
import { RealEstateService } from '../../services/real-estate.service';

describe('PfsComponent — Portfolio DSCR / Global DSCR (replacing DTI when applicable)', () => {
  let fixture: ComponentFixture<PfsComponent>;
  let component: PfsComponent;

  function setup(opts: { propertyCount: number; portfolioDSCR: number | null; totalNOI: number; totalDebtSvc: number; personalDebt: number }) {
    const props = Array.from({ length: opts.propertyCount }, (_, i) => ({ id: `p${i}`, address: `${i} St` }));
    TestBed.configureTestingModule({
      imports: [PfsComponent],
      providers: [
        provideRouter([]),
        {
          provide: FinanceService,
          useValue: {
            getAccounts: () => of([]),
            getBudget: () => of(opts.personalDebt > 0 ? [{ id: '1', group: 'Debt', name: 'Car', amount: opts.personalDebt }] : []),
            getIncome: () => of({ type: 'stable', grossMonthlyIncome: 8000, netMonthlyIncome: 6000 }),
          },
        },
        { provide: AuthService, useValue: { currentUser: () => ({ firstName: 'Test', username: 'emailtest99' }) } },
        { provide: PlanAccessService, useValue: { canPfs: () => true, canRealEstate: () => true } },
        {
          provide: RealEstateService,
          useValue: {
            properties: () => props, load: () => {},
            totalValue: () => 0, totalDebt: () => 0, totalEquity: () => 0,
            totalNOI: () => opts.totalNOI, totalMonthlyDebtService: () => opts.totalDebtSvc,
            portfolioLTV: () => 0, portfolioDSCR: () => opts.portfolioDSCR,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PfsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('shows DTI (unchanged) when there are no investment properties', () => {
    setup({ propertyCount: 0, portfolioDSCR: null, totalNOI: 0, totalDebtSvc: 0, personalDebt: 400 });
    expect(component.hasInvestProps()).toBeFalse();
    const ratiosHtml: string = fixture.nativeElement.querySelector('.ratios-table').textContent;
    expect(ratiosHtml).toContain('Debt-to-Income (DTI)');
    expect(ratiosHtml).not.toContain('DSCR');
  });

  it('shows "Property DSCR" (singular), Personal DSCR, and Global DSCR for exactly one property', () => {
    setup({ propertyCount: 1, portfolioDSCR: 1.4, totalNOI: 2000, totalDebtSvc: 1200, personalDebt: 500 });
    expect(component.portfolioDscrLabel()).toBe('Property DSCR');
    const ratiosHtml: string = fixture.nativeElement.querySelector('.ratios-table').textContent;
    expect(ratiosHtml).toContain('Personal DSCR');
    expect(ratiosHtml).toContain('Property DSCR');
    expect(ratiosHtml).toContain('Global DSCR');
    expect(ratiosHtml).not.toContain('Debt-to-Income (DTI)');
  });

  it('places Personal DSCR above Property/Total DSCR and Global DSCR', () => {
    setup({ propertyCount: 1, portfolioDSCR: 1.4, totalNOI: 2000, totalDebtSvc: 1200, personalDebt: 500 });
    const labels: string[] = Array.from(fixture.nativeElement.querySelectorAll('.ratio-label'))
      .map((el: any) => el.textContent.trim());
    const iPersonal = labels.indexOf('Personal DSCR');
    const iProperty = labels.indexOf('Property DSCR');
    const iGlobal = labels.indexOf('Global DSCR');
    expect(iPersonal).toBeGreaterThanOrEqual(0);
    expect(iPersonal).toBeLessThan(iProperty);
    expect(iPersonal).toBeLessThan(iGlobal);
  });

  it('Personal DSCR uses only personal debt (net income ÷ personal debt), not rental debt', () => {
    setup({ propertyCount: 2, portfolioDSCR: 1.5, totalNOI: 4000, totalDebtSvc: 2800, personalDebt: 400 });
    // netIncome from getIncome mock: netMonthlyIncome 6000 (stable, no secondary)
    expect(component.personalDscr()).toBeCloseTo(6000 / 400, 5);
  });

  it('Personal DSCR is null (not Infinity) when there is no personal debt', () => {
    setup({ propertyCount: 1, portfolioDSCR: 1.2, totalNOI: 2000, totalDebtSvc: 1500, personalDebt: 0 });
    expect(component.personalDscr()).toBeNull();
  });

  it('Personal DSCR is null when there are no investment properties (DTI stays in charge)', () => {
    setup({ propertyCount: 0, portfolioDSCR: null, totalNOI: 0, totalDebtSvc: 0, personalDebt: 500 });
    expect(component.personalDscr()).toBeNull();
  });

  it('shows "Total DSCR" (plural) for more than one property', () => {
    setup({ propertyCount: 3, portfolioDSCR: 1.6, totalNOI: 6000, totalDebtSvc: 3600, personalDebt: 500 });
    expect(component.portfolioDscrLabel()).toBe('Total DSCR');
    const ratiosHtml: string = fixture.nativeElement.querySelector('.ratios-table').textContent;
    expect(ratiosHtml).toContain('Total DSCR');
    expect(ratiosHtml).not.toContain('Property DSCR');
  });

  it('Global DSCR = (personal NET income + rental NOI) ÷ (personal debt + rental debt service)', () => {
    // net income 6000/mo (gross is 8000 — must not be used), NOI 6000/mo, personal debt 500/mo, rental debt service 3600/mo
    setup({ propertyCount: 3, portfolioDSCR: 1.6, totalNOI: 6000, totalDebtSvc: 3600, personalDebt: 500 });
    const expected = (6000 + 6000) / (500 + 3600);
    expect(component.globalDscr()).toBeCloseTo(expected, 5);
    expect(component.globalDscr()).not.toBeCloseTo((8000 + 6000) / (500 + 3600), 1); // confirms not gross-based
  });

  it('Global DSCR is null when there are no properties', () => {
    setup({ propertyCount: 0, portfolioDSCR: null, totalNOI: 0, totalDebtSvc: 0, personalDebt: 500 });
    expect(component.globalDscr()).toBeNull();
  });

  it('Global DSCR is null (not Infinity) when there is zero combined debt', () => {
    setup({ propertyCount: 1, portfolioDSCR: null, totalNOI: 2000, totalDebtSvc: 0, personalDebt: 0 });
    expect(component.globalDscr()).toBeNull();
  });
});
