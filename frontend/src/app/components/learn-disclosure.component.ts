import { Component, Input } from '@angular/core';

/**
 * Subtle, restrained publisher/educational disclosure used on the Learn hub
 * and individual articles (web) and the native app Learn screen.
 *
 * Deliberately worded to NOT overstate credentials — it does not claim CFP,
 * CPA, attorney, licensed-adviser, or underwriting authority. It states that
 * the content is educational and not individualized advice.
 *
 *  - variant="publisher" → Learn hub block
 *  - variant="article"   → concise per-article block
 *  - [collapsible]="true" → renders as a compact expandable <details> (app)
 */
@Component({
  selector: 'app-learn-disclosure',
  standalone: true,
  template: `
    @if (collapsible) {
      <details class="ld" [class.ld-article]="variant === 'article'">
        <summary>{{ heading }}</summary>
        <p>{{ body }}</p>
        @if (loan) { <p class="ld-loan">{{ loanNote }}</p> }
      </details>
    } @else {
      <aside class="ld" [class.ld-article]="variant === 'article'" [attr.aria-label]="heading">
        <p class="ld-head">{{ heading }}</p>
        <p>{{ body }}</p>
        @if (loan) { <p class="ld-loan">{{ loanNote }}</p> }
      </aside>
    }
  `,
  styles: [`
    .ld {
      border: 1px solid #E5E7EB; background: #FAFAFA; border-radius: 12px;
      padding: 14px 16px; margin: 18px 0; color: #6B7280;
    }
    .ld-article { background: transparent; border: none; border-left: 3px solid #E5E7EB; border-radius: 0; padding: 4px 0 4px 14px; margin: 24px 0; }
    .ld-head { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #6B7280; margin: 0 0 6px; }
    .ld p { font-size: 12.5px; line-height: 1.6; margin: 0 0 6px; }
    .ld p:last-child { margin-bottom: 0; }
    .ld-loan { color: #9CA3AF; }
    .ld summary { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #6B7280; cursor: pointer; outline: none; }
    .ld summary + p { margin-top: 8px; }
  `],
})
export class LearnDisclosureComponent {
  @Input() variant: 'publisher' | 'article' = 'publisher';
  @Input() loan = false;
  @Input() collapsible = false;

  get heading() { return this.variant === 'publisher' ? 'Publisher Disclosure' : 'Educational Disclosure'; }

  get body() {
    return this.variant === 'publisher'
      ? 'Clarity Learn content is based on knowledge developed through formal education, professional work experience, continuing financial education, and independent research. The material is provided for general educational purposes only and is not individualized financial, legal, tax, accounting, credit, or investment advice.'
      : 'This article reflects general knowledge developed through education, professional experience, continuing financial education, and research. It is intended for educational purposes only and does not constitute individualized financial, legal, tax, credit, lending, or investment advice. Requirements and outcomes vary by lender, program, and personal circumstances.';
  }

  get loanNote() {
    return 'Lending standards, underwriting methods, approval requirements, and financial calculations may vary by lender, loan program, and individual circumstances.';
  }
}
