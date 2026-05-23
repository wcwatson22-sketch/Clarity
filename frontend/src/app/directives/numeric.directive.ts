import { Directive, ElementRef, HostListener, Input, OnInit } from '@angular/core';

/**
 * NumericDirective — appNumeric
 *
 * Attach to any <input> that should accept numbers.
 *
 *   <input appNumeric />               ← decimal mode (money/percentages)
 *   <input appNumeric="decimal" />     ← explicit decimal mode
 *   <input appNumeric="integer" />     ← whole-numbers only (age, count, credit score)
 *
 * What it does:
 *   • Switches type to "text" so iOS uses our inputmode instead of the
 *     quirky number keyboard (which allows "e", "+", "-" and lacks formatting control).
 *   • Sets inputmode="decimal" or "numeric" → shows numeric keypad on iOS/Android.
 *   • Blocks letters and invalid chars on keydown (desktop defence).
 *   • Strips any remaining invalid chars on the input event (iOS paste/autocorrect defence).
 *   • Prevents multiple decimal points.
 *   • Preserves an empty string while the user is typing so the field stays
 *     comfortable to edit.
 *   • Sanitises BEFORE Angular template event handlers run, so (input)/(change)/(blur)
 *     bindings in the host template always receive the clean value.
 */
@Directive({
  selector: 'input[appNumeric]',
  standalone: true,
})
export class NumericDirective implements OnInit {
  /**
   * 'decimal'  (default) — allows digits + one decimal point.  Use for money, %.
   * 'integer'             — allows digits only.  Use for age, count, credit score, etc.
   * ''                   — bare attribute with no value; treated as 'decimal'.
   */
  @Input('appNumeric') mode: 'decimal' | 'integer' | '' = 'decimal';

  constructor(private el: ElementRef<HTMLInputElement>) {}

  ngOnInit(): void {
    const input = this.el.nativeElement;

    // Use type="text" so we control the full experience.
    // inputmode tells iOS/Android which keyboard to show.
    input.setAttribute('type', 'text');
    input.setAttribute('inputmode', this.isInteger ? 'numeric' : 'decimal');

    // pattern assists some mobile browsers in selecting the right keyboard variant.
    input.setAttribute('pattern', this.isInteger ? '[0-9]*' : '[0-9]*[.]?[0-9]*');

    // Disable autocorrect / autocapitalize — annoying and harmful for number fields.
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
  }

  // ── Input event: primary sanitisation (handles paste, autocorrect, IME) ──────
  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value;
    const sanitized = this.sanitize(raw);

    if (sanitized !== raw) {
      // Adjust cursor so it doesn't jump to end after we overwrite input.value.
      const pos = input.selectionStart ?? sanitized.length;
      const removed = raw.length - sanitized.length;
      input.value = sanitized;
      const newPos = Math.max(0, pos - removed);
      input.setSelectionRange(newPos, newPos);
      // NOTE: we do NOT re-dispatch an input event here.
      // Angular's @HostListener runs before the template (input)="..." handler,
      // so by the time the template reads $event.target.value it sees the
      // already-sanitised string.
    }
  }

  // ── Keydown event: fast defence against letters on desktop / physical keyboard ─
  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    // Always allow browser/OS shortcuts (Ctrl+A, Cmd+C, etc.)
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    // Always allow navigation / editing keys.
    const always = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End',
    ];
    if (always.includes(event.key)) return;

    // Digits are always fine.
    if (/^[0-9]$/.test(event.key)) return;

    // Decimal point — only in decimal mode, and only if not already present.
    if (!this.isInteger && event.key === '.') {
      if (!(event.target as HTMLInputElement).value.includes('.')) return;
      event.preventDefault(); // block second decimal point
      return;
    }

    // Everything else (letters, symbols, minus, plus, 'e') → blocked.
    event.preventDefault();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private get isInteger(): boolean {
    return this.mode === 'integer';
  }

  private sanitize(value: string): string {
    if (this.isInteger) {
      return value.replace(/[^0-9]/g, '');
    }
    // Decimal: strip anything that's not a digit or a dot,
    // then collapse any extra dots (keep only the first).
    return value
      .replace(/[^0-9.]/g, '')
      .replace(/(\..*)\./g, '$1');
  }
}
