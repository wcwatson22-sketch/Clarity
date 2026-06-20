import { Component, Input } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';

/**
 * Optional ad slot for the PUBLIC Learn pages.
 *
 * Disabled by default behind environment.publicLearnAdsEnabled. When disabled
 * it renders NOTHING (no reserved blank space). It also renders nothing inside
 * the native app — ads must never appear in the app or on authenticated screens.
 *
 * When ads are later approved, set the environment flags and drop the real ad
 * markup (e.g. AdSense) inside the @if block. Placement is controlled by the
 * `slot` input: 'inline' (after the intro) or 'footer' (near the end).
 */
@Component({
  selector: 'app-learn-ad',
  standalone: true,
  template: `
    @if (enabled) {
      <aside class="learn-ad" aria-label="Advertisement">
        <span class="learn-ad-label">Advertisement</span>
        <!-- Ad markup goes here once approved & configured (slot: {{ slot }}) -->
      </aside>
    }
  `,
  styles: [`
    .learn-ad {
      margin: 28px 0; padding: 14px; border: 1px dashed #E5E7EB; border-radius: 12px;
      background: #FAFAFA; text-align: center;
    }
    .learn-ad-label {
      display: block; font-size: 11px; font-weight: 600; letter-spacing: .06em;
      text-transform: uppercase; color: #9CA3AF;
    }
  `],
})
export class LearnAdComponent {
  @Input() slot: 'inline' | 'footer' = 'inline';

  /** Ads are off unless the flag is on AND we're on the web (never in-app). */
  readonly enabled =
    !Capacitor.isNativePlatform() && (environment as { publicLearnAdsEnabled?: boolean }).publicLearnAdsEnabled === true;
}
