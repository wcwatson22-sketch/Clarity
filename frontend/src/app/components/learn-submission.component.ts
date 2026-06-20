import { Component, Input, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { LearnSubmissionService, LearnSubmissionType } from '../services/learn-submission.service';
import { LearnAnalyticsService } from '../services/learn-analytics.service';

/**
 * Compact "Have a question or topic suggestion?" card used at the top of the
 * public Learn hub and the native app Learn screen. Opens a modal (centered on
 * desktop, bottom-sheet on mobile) with a short form that submits directly to
 * the backend — no mailto:, no navigation away, no financial data.
 *
 * Logged-in users are not asked to re-enter name/email; the backend pulls their
 * identity from the auth token automatically.
 */
@Component({
  selector: 'app-learn-submission',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="ls-card">
      <div class="ls-card-text">
        <h2>Have a Question or Topic Suggestion?</h2>
        <p>Send us a question, suggest a topic, or let us know what you’d like Clarity to explain next.</p>
      </div>
      <button class="ls-open" (click)="open()">Send a message</button>
    </section>

    @if (isOpen()) {
      <div class="ls-backdrop" (click)="close()">
        <div class="ls-sheet" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Send Clarity Learn a message">
          <div class="ls-sheet-head">
            <h3>{{ sent() ? 'Thank you' : 'Send Clarity a message' }}</h3>
            <button class="ls-close" (click)="close()" aria-label="Close">✕</button>
          </div>

          @if (sent()) {
            <div class="ls-success">
              <span class="ls-success-icon">✓</span>
              <p class="ls-success-title">Thank you — your submission has been received.</p>
              <p class="ls-success-sub">We review questions and topic suggestions as we plan future Learn content.</p>
              <button class="ls-done" (click)="close()">Done</button>
            </div>
          } @else {
            <label class="ls-label" for="ls-type">What is this about?</label>
            <select id="ls-type" class="ls-input" [(ngModel)]="type">
              <option value="Question">Question</option>
              <option value="Topic Suggestion">Topic Suggestion</option>
              <option value="Comment">Comment</option>
              <option value="Correction">Correction</option>
              <option value="Other">Other</option>
            </select>

            <label class="ls-label" for="ls-msg">Message</label>
            <textarea id="ls-msg" class="ls-input ls-textarea" rows="4"
              placeholder="Ask a question, suggest a topic, or share feedback…"
              [(ngModel)]="message" maxlength="4000"></textarea>

            @if (!auth.isLoggedIn()) {
              <div class="ls-row">
                <div class="ls-col">
                  <label class="ls-label" for="ls-name">Name <span class="ls-opt">(optional)</span></label>
                  <input id="ls-name" class="ls-input" [(ngModel)]="name" maxlength="120" autocomplete="name" />
                </div>
                <div class="ls-col">
                  <label class="ls-label" for="ls-email">Email <span class="ls-opt">(optional, for a reply)</span></label>
                  <input id="ls-email" class="ls-input" type="email" [(ngModel)]="email" maxlength="200" autocomplete="email" />
                </div>
              </div>
            }

            <!-- Honeypot: hidden from real users; bots fill it and get dropped. -->
            <input class="ls-hp" tabindex="-1" autocomplete="off" aria-hidden="true" [(ngModel)]="website" />

            <p class="ls-note">Please don’t include account numbers, passwords, Social Security numbers, or other sensitive financial information.</p>

            @if (error()) { <p class="ls-error">{{ error() }}</p> }

            <div class="ls-actions">
              <button class="ls-cancel" (click)="close()">Cancel</button>
              <button class="ls-submit" (click)="submit()" [disabled]="!message().trim() || submitting()">
                {{ submitting() ? 'Sending…' : 'Submit' }}
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .ls-card {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      background: linear-gradient(135deg,#F0FBF7,#FFFFFF); border: 1px solid #BBF7D0;
      border-radius: 14px; padding: 16px 20px; margin: 0 0 18px;
    }
    .ls-card-text h2 { font-size: 16px; font-weight: 700; margin: 0 0 3px; color: #111827; }
    .ls-card-text p { font-size: 13.5px; color: #6B7280; margin: 0; line-height: 1.5; }
    .ls-open {
      flex-shrink: 0; background: #1D9E75; color: #fff; border: none; cursor: pointer;
      padding: 11px 18px; border-radius: 10px; font-weight: 600; font-size: 14px; font-family: inherit;
      &:hover { background: #085041; }
    }
    .ls-backdrop {
      position: fixed; inset: 0; z-index: 1200; background: rgba(0,0,0,.45);
      display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .ls-sheet {
      background: #fff; border-radius: 18px; width: 100%; max-width: 480px;
      padding: 22px 22px 24px; box-shadow: 0 24px 60px rgba(0,0,0,.2);
      max-height: 90vh; overflow-y: auto;
    }
    .ls-sheet-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .ls-sheet-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: #111827; }
    .ls-close { background: none; border: none; font-size: 16px; color: #9CA3AF; cursor: pointer; padding: 2px 6px; border-radius: 6px; &:hover { background: #F3F4F6; color: #374151; } }
    .ls-label { display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin: 12px 0 5px; }
    .ls-opt { font-weight: 400; color: #9CA3AF; }
    .ls-input {
      width: 100%; box-sizing: border-box; border: 1px solid #E5E7EB; border-radius: 10px;
      padding: 10px 12px; font-size: 14px; font-family: inherit; color: #111827; outline: none; background: #fff;
      &:focus { border-color: #1D9E75; box-shadow: 0 0 0 3px rgba(29,158,117,.12); }
    }
    .ls-textarea { resize: vertical; line-height: 1.5; }
    .ls-row { display: flex; gap: 12px; } .ls-col { flex: 1; min-width: 0; }
    .ls-hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
    .ls-note { font-size: 11.5px; color: #9CA3AF; line-height: 1.5; margin: 12px 0 0; }
    .ls-error { font-size: 12.5px; color: #B91C1C; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 8px 12px; margin: 10px 0 0; }
    .ls-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
    .ls-cancel { background: #F3F4F6; border: none; border-radius: 10px; padding: 10px 18px; font-size: 14px; font-weight: 500; color: #374151; cursor: pointer; font-family: inherit; &:hover { background: #E5E7EB; } }
    .ls-submit { background: #1D9E75; border: none; border-radius: 10px; padding: 10px 22px; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; font-family: inherit; &:hover:not(:disabled) { background: #085041; } &:disabled { opacity: .45; cursor: not-allowed; } }
    .ls-success { text-align: center; padding: 10px 4px 4px; }
    .ls-success-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: #1D9E75; color: #fff; font-size: 22px; font-weight: 700; margin-bottom: 12px; }
    .ls-success-title { font-size: 15px; font-weight: 600; color: #065F46; margin: 0 0 6px; }
    .ls-success-sub { font-size: 13px; color: #6B7280; margin: 0 0 18px; line-height: 1.5; }
    .ls-done { background: #1D9E75; border: none; border-radius: 10px; padding: 10px 26px; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; font-family: inherit; &:hover { background: #085041; } }

    @media (max-width: 600px) {
      .ls-card { flex-direction: column; align-items: stretch; text-align: left; }
      .ls-open { width: 100%; }
      /* Bottom-sheet presentation on phones */
      .ls-backdrop { align-items: flex-end; padding: 0; }
      .ls-sheet { max-width: 100%; border-radius: 18px 18px 0 0; padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px)); }
      .ls-row { flex-direction: column; gap: 0; }
    }
  `],
})
export class LearnSubmissionComponent {
  /** Source page identifier (defaults to the current path). */
  @Input() page = '';

  readonly auth = inject(AuthService);
  private svc = inject(LearnSubmissionService);
  private analytics = inject(LearnAnalyticsService);

  isOpen = signal(false);
  type = signal<LearnSubmissionType>('Question');
  message = signal('');
  name = signal('');
  email = signal('');
  website = signal('');   // honeypot
  submitting = signal(false);
  sent = signal(false);
  error = signal('');

  open() {
    this.sent.set(false);
    this.error.set('');
    this.isOpen.set(true);
    this.analytics.track('learn_submission_opened');
  }

  close() { this.isOpen.set(false); }

  submit() {
    const message = this.message().trim();
    if (!message || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');

    this.svc.submit({
      type: this.type(),
      message,
      name: this.name().trim() || undefined,
      email: this.email().trim() || undefined,
      page: this.page || (typeof window !== 'undefined' ? window.location.pathname : ''),
      website: this.website().trim() || undefined,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.sent.set(true);
        this.analytics.track('learn_submission_completed', { label: this.type() });
        // Reset the fields (but keep the success view until the user closes).
        this.message.set(''); this.name.set(''); this.email.set('');
      },
      error: (err) => {
        this.submitting.set(false);
        this.analytics.track('learn_submission_failed', { label: this.type() });
        this.error.set(err?.error?.error ?? 'Something went wrong. Your message is still here — please try again.');
      },
    });
  }
}
