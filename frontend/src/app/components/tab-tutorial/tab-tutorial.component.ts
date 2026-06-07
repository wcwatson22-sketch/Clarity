import { Component, input, output, OnInit, signal } from '@angular/core';

export interface TutorialStep {
  icon: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-tab-tutorial',
  standalone: true,
  template: `
    <div class="tutorial-backdrop" (click)="close()">
      <div class="tutorial-sheet" (click)="$event.stopPropagation()">
        <div class="tutorial-handle"></div>

        <div class="tutorial-step-indicators">
          @for (s of steps(); track $index; let i = $index) {
            <span class="t-dot" [class.active]="i === currentStep()"></span>
          }
        </div>

        @if (currentStep() < steps().length) {
          <div class="tutorial-content">
            <div class="tutorial-icon">{{ steps()[currentStep()].icon }}</div>
            <h3 class="tutorial-title">{{ steps()[currentStep()].title }}</h3>
            <p class="tutorial-body">{{ steps()[currentStep()].body }}</p>
          </div>
        }

        <div class="tutorial-actions">
          @if (currentStep() < steps().length - 1) {
            <button class="tutorial-next" (click)="next()">Next →</button>
            <button class="tutorial-skip" (click)="close()">Skip</button>
          } @else {
            <button class="tutorial-next" (click)="close()">Got It!</button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tutorial-backdrop {
      position: fixed; inset: 0; z-index: 1500;
      background: rgba(0,0,0,0.45);
      display: flex; align-items: flex-end; justify-content: center;
      animation: fadeIn 0.18s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .tutorial-sheet {
      background: #fff;
      border-radius: 24px 24px 0 0;
      padding: 12px 28px 40px;
      width: 100%; max-width: 540px;
      animation: sheetUp 0.28s cubic-bezier(0.32,0.72,0,1);
    }
    @keyframes sheetUp {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }

    .tutorial-handle {
      width: 36px; height: 4px; background: #E5E7EB;
      border-radius: 2px; margin: 0 auto 20px;
    }

    .tutorial-step-indicators {
      display: flex; gap: 6px; justify-content: center; margin-bottom: 20px;
    }
    .t-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #E5E7EB; transition: background 0.2s;
    }
    .t-dot.active { background: #1D9E75; }

    .tutorial-content { text-align: center; }
    .tutorial-icon  { font-size: 44px; display: block; margin-bottom: 12px; }
    .tutorial-title { font-size: 19px; font-weight: 700; color: #111827; margin: 0 0 10px; }
    .tutorial-body  { font-size: 14px; color: #6B7280; line-height: 1.65; margin: 0 0 24px; }

    .tutorial-actions { display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .tutorial-next {
      background: #1D9E75; color: #fff;
      border: none; border-radius: 12px;
      padding: 13px 32px; font-size: 15px; font-weight: 600;
      cursor: pointer; width: 100%; max-width: 320px;
      transition: background 0.15s;
      &:hover { background: #085041; }
    }
    .tutorial-skip {
      background: none; border: none;
      color: #9CA3AF; font-size: 13px; cursor: pointer;
      &:hover { color: #6B7280; }
    }
  `]
})
export class TabTutorialComponent implements OnInit {
  readonly steps  = input.required<TutorialStep[]>();
  readonly storageKey = input.required<string>();
  readonly dismissed = output<void>();

  currentStep = signal(0);

  ngOnInit() {
    // Mark as seen immediately so it never shows again
    localStorage.setItem(this.storageKey(), '1');
  }

  next() {
    this.currentStep.update(s => Math.min(s + 1, this.steps().length - 1));
  }

  close() {
    this.dismissed.emit();
  }
}

/** Returns true when a tab tutorial should be shown (first visit only, per user). */
export function shouldShowTutorial(key: string, userId?: number | null): boolean {
  const scoped = userId != null ? `${key}_u${userId}` : key;
  return !localStorage.getItem(scoped);
}

/** Returns the user-scoped storage key. */
export function tutorialKey(key: string, userId?: number | null): string {
  return userId != null ? `${key}_u${userId}` : key;
}
