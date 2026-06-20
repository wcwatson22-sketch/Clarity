import { TestBed } from '@angular/core/testing';
import { LearnDisclosureComponent } from './learn-disclosure.component';

function render(setup: (c: LearnDisclosureComponent) => void): string {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [LearnDisclosureComponent] });
  const f = TestBed.createComponent(LearnDisclosureComponent);
  setup(f.componentInstance);
  f.detectChanges();
  return (f.nativeElement as HTMLElement).textContent ?? '';
}

describe('LearnDisclosureComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('publisher variant states educational-only, no overstated credentials', () => {
    const t = render(c => { c.variant = 'publisher'; });
    expect(t).toContain('Publisher Disclosure');
    expect(t).toContain('general educational purposes only');
    expect(t).toContain('not individualized financial');
    for (const claim of ['Certified Financial Planner', 'CPA', 'attorney', 'licensed investment adviser']) {
      expect(t.toLowerCase()).not.toContain(claim.toLowerCase());
    }
  });

  it('article variant is concise and educational', () => {
    const t = render(c => { c.variant = 'article'; });
    expect(t).toContain('Educational Disclosure');
    expect(t).toContain('does not constitute individualized');
  });

  it('adds the lending-variability note only for loan content', () => {
    expect(render(c => { c.variant = 'article'; c.loan = true; })).toContain('Lending standards');
    expect(render(c => { c.variant = 'article'; c.loan = false; })).not.toContain('Lending standards');
  });
});
