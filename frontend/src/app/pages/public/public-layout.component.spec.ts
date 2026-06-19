import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { PublicLayoutComponent } from './public-layout.component';
import { AuthService } from '../../services/auth.service';

function setup(loggedIn: boolean): ComponentFixture<PublicLayoutComponent> {
  TestBed.configureTestingModule({
    imports: [PublicLayoutComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { isLoggedIn: signal(loggedIn) } },
    ],
  });
  const f = TestBed.createComponent(PublicLayoutComponent);
  f.detectChanges();
  return f;
}

describe('PublicLayoutComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('logged out: shows Log In and Get Started, not Go to Dashboard', () => {
    const text = (setup(false).nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Log In');
    expect(text).toContain('Get Started');
    expect(text).not.toContain('Go to Dashboard');
  });

  it('logged in: shows Go to Dashboard', () => {
    const text = (setup(true).nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Go to Dashboard');
  });

  it('does not render the authenticated sidebar or bottom navigation', () => {
    const el = setup(false).nativeElement as HTMLElement;
    expect(el.querySelector('.sidebar')).toBeNull();
    expect(el.querySelector('.bottom-nav')).toBeNull();
  });

  it('hamburger has an accessible label and exposes expanded/collapsed state', () => {
    const f = setup(false);
    const btn = (f.nativeElement as HTMLElement).querySelector('.pub-burger') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBeTruthy();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    btn.click(); f.detectChanges();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    btn.click(); f.detectChanges();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });
});
