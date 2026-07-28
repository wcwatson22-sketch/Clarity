import { Component, ElementRef, Input, ViewChild, inject, signal, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MarketingAdScriptLoader } from '../services/marketing-ad-script-loader.service';
import { ConsentScriptLoader } from '../services/consent-script-loader.service';
import { MARKETING_ADS } from '../services/marketing-ads.config';

type AdMode = 'pending' | 'live' | 'placeholder' | 'hidden';

/**
 * Restrained AdSense ad unit for the PUBLIC MARKETING SITE ONLY.
 *
 * Must never be imported into authenticated application components. It renders
 * nothing (collapses) unless ads are enabled, configured, consented, on an
 * approved marketing route, and on the web (never native). In local dev it can
 * show a neutral placeholder so placements are visible without live ads.
 */
@Component({
  selector: 'app-marketing-ad-unit',
  standalone: true,
  template: `
    @if (mode() === 'placeholder') {
      <aside class="mad mad-ph {{ className }}" [class.mad-mobile-hide]="mobileVisibility === 'hidden'"
             [class.mad-desktop-hide]="mobileVisibility === 'only'" [style.minHeight.px]="minimumHeight"
             role="complementary" aria-label="Advertisement placeholder">
        <span class="mad-label">Advertisement</span>
        <span class="mad-ph-name">{{ placementName }}</span>
      </aside>
    } @else if (mode() === 'live') {
      <aside class="mad {{ className }}" [class.mad-mobile-hide]="mobileVisibility === 'hidden'"
             [class.mad-desktop-hide]="mobileVisibility === 'only'" [style.minHeight.px]="minimumHeight"
             role="complementary" aria-label="Advertisement">
        @if (showLabel) { <span class="mad-label">Advertisement</span> }
        <ins #ins class="adsbygoogle" style="display:block"
             [attr.data-ad-client]="clientId"
             [attr.data-ad-slot]="adSlot"
             [attr.data-ad-format]="format"
             [attr.data-full-width-responsive]="responsive ? 'true' : 'false'"></ins>
      </aside>
    }
  `,
  styles: [`
    /* Neutral, restrained — visually distinct from Clarity cards/CTAs, never promotional. */
    .mad {
      display: block; margin: 24px auto; padding: 8px;
      border: 1px solid #ECEEF1; border-radius: 12px; background: #FCFCFD;
      max-width: 100%; box-sizing: border-box; overflow: hidden;
    }
    .mad-label {
      display: block; font-size: 10px; font-weight: 600; letter-spacing: .08em;
      text-transform: uppercase; color: #9CA3AF; text-align: left; margin-bottom: 4px;
    }
    .mad-ph {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 4px; border-style: dashed; color: #9CA3AF; text-align: center;
    }
    .mad-ph-name { font-size: 12px; color: #B6BCC4; }
    .adsbygoogle { display: block; width: 100%; }
    @media (prefers-color-scheme: dark) {
      .mad { background: #11161d; border-color: #232b36; }
      .mad-label { color: #6B7280; }
    }
    @media (max-width: 760px) { .mad-mobile-hide { display: none !important; } }
    @media (min-width: 761px) { .mad-desktop-hide { display: none !important; } }
  `],
})
export class MarketingAdUnitComponent implements AfterViewInit {
  @Input() placementName = 'ad';
  @Input() adSlot = '';
  @Input() format = 'auto';
  @Input() responsive = true;
  @Input() minimumHeight = 90;
  @Input() className = '';
  @Input() showLabel = true;
  @Input() mobileVisibility: 'visible' | 'hidden' | 'only' = 'visible';
  @Input() testMode = false;

  @ViewChild('ins') insRef?: ElementRef<HTMLElement>;

  readonly mode = signal<AdMode>('pending');
  readonly clientId = MARKETING_ADS.clientId;
  private pushed = false;

  private loader = inject(MarketingAdScriptLoader);
  private consentLoader = inject(ConsentScriptLoader);
  private router = inject(Router);

  ngAfterViewInit(): void {
    const path = this.router.url;

    // Load Google's certified consent CMP wherever an ad placement can appear —
    // it must load regardless of consent state, since collecting consent is its job.
    this.consentLoader.ensureLoaded(path);

    // Local-dev / explicit test placeholder so placements are visible without live ads.
    if (this.testMode || (MARKETING_ADS.devPlaceholders && !this.loader.canServeAds(path))) {
      this.mode.set('placeholder');
      return;
    }
    // Collapse cleanly when ads can't/shouldn't serve here.
    if (!this.adSlot || !this.loader.canServeAds(path)) {
      this.mode.set('hidden');
      return;
    }
    this.mode.set('live');
    this.loader.ensureScriptLoaded(path);
    // Defer the push until the <ins> is in the DOM.
    setTimeout(() => this.pushAd(), 0);
  }

  private pushAd(): void {
    if (this.pushed) return;       // prevent duplicate init on re-render / route change
    this.pushed = true;
    this.loader.track('ad_slot_requested', this.placementName);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      this.loader.track('ad_slot_error', this.placementName);
      this.mode.set('hidden');
      return;
    }
    // Collapse if AdSense returns no ad; otherwise record a render.
    setTimeout(() => {
      const el = this.insRef?.nativeElement;
      const unfilled = el?.getAttribute('data-ad-status') === 'unfilled' || (el && el.offsetHeight === 0);
      if (unfilled) { this.mode.set('hidden'); this.loader.track('ad_slot_empty', this.placementName); }
      else { this.loader.track('ad_slot_rendered', this.placementName); }
    }, 2500);
  }
}
