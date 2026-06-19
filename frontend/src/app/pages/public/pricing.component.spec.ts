import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { PublicPricingComponent } from './pricing.component';
import { AuthService } from '../../services/auth.service';

function renderText(): string {
  TestBed.configureTestingModule({
    imports: [PublicPricingComponent],
    providers: [provideRouter([]), { provide: AuthService, useValue: { isLoggedIn: signal(false) } }],
  });
  const f = TestBed.createComponent(PublicPricingComponent);
  f.detectChanges();
  return (f.nativeElement as HTMLElement).textContent ?? '';
}

describe('PublicPricingComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows the current Free / $2.99 Premium pricing', () => {
    const t = renderText();
    expect(t).toContain('Free');
    expect(t).toContain('$0');
    expect(t).toContain('Premium');
    expect(t).toContain('$2.99');
  });

  it('contains no legacy trial / Base / old-price language', () => {
    const t = renderText();
    for (const legacy of ['14-day', 'Free trial', 'Base Plan', 'Compare Plan', '$0.99', '$1/month', '$4.99', '$5/month']) {
      expect(t).withContext(legacy).not.toContain(legacy);
    }
  });
});
