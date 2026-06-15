import { Component, inject, signal, output } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { MeResponse } from '../../models/auth.models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  template: `
    <div class="onboarding-backdrop">
      <div class="onboarding-card">

        <!-- Step dots -->
        <div class="step-dots">
          @for (s of steps; track s; let i = $index) {
            <span class="dot" [class.active]="i === step()"></span>
          }
        </div>

        <!-- Step content -->
        @if (step() === 0) {
          <div class="step-content">
            <div class="step-icon">👋</div>
            <h2 class="step-title">Welcome to Clarity</h2>
            <p class="step-body">
              Clarity is your all-in-one personal finance dashboard. Everything is
              <strong>private to your account</strong> and saved automatically.
            </p>
            <p class="step-body">
              Here's a quick look at what's waiting for you across all five tabs.
            </p>
          </div>
        }

        @if (step() === 1) {
          <div class="step-content">
            <div class="step-icon">📊</div>
            <h2 class="step-title">Dashboard — Net Worth</h2>
            <p class="step-body">
              Add your <strong>assets</strong> (savings, investments, property) and
              <strong>liabilities</strong> (loans, credit cards, mortgage) to see your
              real-time net worth.
            </p>
            <p class="step-body">
              Hit <strong>Save Snapshot</strong> when balances change — your net worth
              chart and month-over-month progress fill in automatically.
            </p>
          </div>
        }

        @if (step() === 2) {
          <div class="step-content">
            <div class="step-icon">💸</div>
            <h2 class="step-title">Cash Flow — Budget & Income</h2>
            <p class="step-body">
              Enter your income and monthly expenses on the <strong>Cash Flow</strong> tab
              to see your free cash flow, debt-to-income ratio, savings rate, and a
              personalized 50/30/20 budget breakdown.
            </p>
            <p class="step-body">
              Supports both stable W-2 income and variable / self-employed income.
            </p>
          </div>
        }

        @if (step() === 3) {
          <div class="step-content">
            <div class="step-icon">📚</div>
            <h2 class="step-title">Learn & Compare</h2>
            <p class="step-body">
              <strong>Learn</strong> offers bite-sized lessons on budgeting, debt,
              credit, investing, and mortgages — written to help you understand the
              numbers you're tracking, not just log them.
            </p>
            <p class="step-body">
              <strong>Compare</strong> shows how your finances stack up against others
              in your age bracket, anonymously.
            </p>
          </div>
        }

        @if (step() === 4) {
          <div class="step-content">
            <div class="step-icon">🏦</div>
            <h2 class="step-title">Get a Loan — Prep Guide</h2>
            <p class="step-body">
              The <strong>Loan Prep</strong> tab gives you step-by-step checklists for
              every major loan type — mortgage, auto, personal, business, and more.
            </p>
            <p class="step-body">
              <strong>Start on the Dashboard.</strong> Add your first asset or liability
              and hit Save Snapshot. You're all set!
            </p>
          </div>
        }

        <!-- Actions -->
        <div class="step-actions">
          @if (step() < steps.length - 1) {
            <button class="btn-next" (click)="next()">Next →</button>
            <button class="btn-skip" (click)="finish()">Skip Tour</button>
          } @else {
            <button class="btn-next" (click)="finish()" [disabled]="saving()">
              {{ saving() ? 'Loading…' : 'Get Started →' }}
            </button>
          }
        </div>

      </div>
    </div>
  `,
  styles: [`
    .onboarding-backdrop {
      position: fixed; inset: 0; z-index: 2000;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .onboarding-card {
      background: #fff; border-radius: 24px;
      padding: 40px 36px; max-width: 460px; width: 100%;
      box-shadow: 0 24px 64px rgba(0,0,0,0.2);
      animation: slideUp 0.25s ease;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .step-dots {
      display: flex; gap: 8px; justify-content: center; margin-bottom: 28px;
    }
    .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #E5E7EB; transition: background 0.2s;
    }
    .dot.active { background: #1D9E75; }

    .step-content { text-align: center; }
    .step-icon { font-size: 48px; display: block; margin-bottom: 16px; }
    .step-title {
      font-size: 22px; font-weight: 700; color: #111827;
      margin: 0 0 16px;
    }
    .step-body {
      font-size: 15px; color: #4B5563; line-height: 1.65;
      margin: 0 0 12px;
    }
    .step-body strong { color: #111827; font-weight: 600; }

    .step-actions {
      display: flex; flex-direction: column; align-items: center;
      gap: 10px; margin-top: 28px;
    }
    .btn-next {
      background: #1D9E75; color: #fff;
      border: none; border-radius: 12px;
      padding: 14px 32px; font-size: 15px; font-weight: 600;
      cursor: pointer; width: 100%;
      transition: background 0.15s;
      &:hover:not(:disabled) { background: #085041; }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
    }
    .btn-skip {
      background: none; border: none;
      color: #9CA3AF; font-size: 13px; cursor: pointer;
      &:hover { color: #6B7280; }
    }
  `]
})
export class OnboardingComponent {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  readonly done = output<void>();

  step   = signal(0);
  saving = signal(false);
  readonly steps = [0, 1, 2, 3, 4];

  next() { this.step.update(s => s + 1); }

  finish() {
    this.saving.set(true);
    // Optimistically mark hasSeenOnboarding=true in localStorage immediately so the
    // onboarding never re-fires even if the API call fails (e.g. network error).
    const cached = this.auth.currentUser();
    if (cached) this.auth.updateCachedUser({ ...cached, hasSeenOnboarding: true });

    this.http.post<MeResponse>(`${environment.apiUrl}/auth/complete-onboarding`, {}).subscribe({
      next: user => {
        this.auth.updateCachedUser(user);
        this.saving.set(false);
        this.done.emit();
      },
      error: () => {
        // Already marked locally — just dismiss. Will sync next successful refresh.
        this.saving.set(false);
        this.done.emit();
      }
    });
  }
}
