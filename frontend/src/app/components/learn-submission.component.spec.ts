import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { LearnSubmissionComponent } from './learn-submission.component';
import { AuthService } from '../services/auth.service';
import { LearnSubmissionService } from '../services/learn-submission.service';

function setup(loggedIn: boolean, svc: Partial<LearnSubmissionService> = {}): ComponentFixture<LearnSubmissionComponent> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [LearnSubmissionComponent],
    providers: [
      { provide: AuthService, useValue: { isLoggedIn: signal(loggedIn) } },
      { provide: LearnSubmissionService, useValue: { submit: () => of({ success: true }), ...svc } },
    ],
  });
  const f = TestBed.createComponent(LearnSubmissionComponent);
  f.detectChanges();
  return f;
}

describe('LearnSubmissionComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows a compact card and opens a modal form (no mailto links anywhere)', () => {
    const f = setup(false);
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Have a Question or Topic Suggestion?');
    expect(el.querySelector('.ls-sheet')).toBeNull();           // closed initially
    (el.querySelector('.ls-open') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelector('.ls-sheet')).toBeTruthy();          // modal open
    expect(el.querySelector('.ls-textarea')).toBeTruthy();
    expect(el.querySelector('.ls-hp')).toBeTruthy();             // honeypot present
    expect(el.querySelector('a[href^="mailto:"]')).toBeNull();   // never mailto
  });

  it('hides name/email for logged-in users, shows them for visitors', () => {
    const out = setup(false); (out.nativeElement.querySelector('.ls-open') as HTMLButtonElement).click(); out.detectChanges();
    expect((out.nativeElement as HTMLElement).querySelector('#ls-email')).toBeTruthy();

    const inn = setup(true); (inn.nativeElement.querySelector('.ls-open') as HTMLButtonElement).click(); inn.detectChanges();
    expect((inn.nativeElement as HTMLElement).querySelector('#ls-email')).toBeNull();
  });

  it('shows a thank-you on success', () => {
    const f = setup(false);
    const c = f.componentInstance;
    c.open(); c.message.set('How is DTI calculated?'); c.submit(); f.detectChanges();
    expect(c.sent()).toBeTrue();
    expect((f.nativeElement as HTMLElement).textContent).toContain('your submission has been received');
  });

  it('preserves the typed message and shows an error on failure', () => {
    const f = setup(false, { submit: () => throwError(() => ({ error: { error: 'boom' } })) });
    const c = f.componentInstance;
    c.open(); c.message.set('keep me'); c.submit(); f.detectChanges();
    expect(c.sent()).toBeFalse();
    expect(c.message()).toBe('keep me');         // not cleared
    expect(c.error()).toBe('boom');
  });
});
