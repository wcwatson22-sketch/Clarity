import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Public marketing shell — header + footer wrapping the marketing pages
 * (home, features, pricing, about). Rendered for logged-out and logged-in
 * users alike; never exposes authenticated app data. The authenticated app
 * shell (sidebar/bottom-nav) is hidden on these routes by AppComponent.
 */
@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="pub" (keydown.escape)="menuOpen.set(false)">
      <a class="skip-link" href="#main-content">Skip to content</a>
      <header class="pub-header">
        <a routerLink="/" class="pub-brand" (click)="menuOpen.set(false)">
          <img src="icons/logo.png" alt="Clarity Financial Tools" class="pub-logo" />
        </a>

        <nav class="pub-nav" [class.open]="menuOpen()">
          <a routerLink="/features" routerLinkActive="active" (click)="menuOpen.set(false)">Features</a>
          <a routerLink="/pricing" routerLinkActive="active" (click)="menuOpen.set(false)">Pricing</a>
          <a routerLink="/learn" routerLinkActive="active" (click)="menuOpen.set(false)">Learn</a>
          <a routerLink="/about" routerLinkActive="active" (click)="menuOpen.set(false)">About</a>
          @if (auth.isLoggedIn()) {
            <a routerLink="/dashboard" class="pub-cta" (click)="menuOpen.set(false)">Go to Dashboard</a>
          } @else {
            <a routerLink="/login" class="pub-login" (click)="menuOpen.set(false)">Log In</a>
            <a routerLink="/signup" class="pub-cta" (click)="menuOpen.set(false)">Get Started</a>
          }
        </nav>

        <button class="pub-burger" (click)="menuOpen.set(!menuOpen())" aria-label="Toggle menu" [attr.aria-expanded]="menuOpen()">
          <span></span><span></span><span></span>
        </button>
      </header>

      <main id="main-content" class="pub-main" tabindex="-1"><router-outlet /></main>

      <footer class="pub-footer">
        <div class="pub-footer-inner">
          <div class="pub-footer-brand">
            <span class="pub-footer-name">Clarity Financial Tools</span>
            <span class="pub-footer-own">Owned and operated by Clearpath Digital LLC.</span>
          </div>
          <nav class="pub-footer-links">
            <a routerLink="/features">Features</a>
            <a routerLink="/pricing">Pricing</a>
            <a routerLink="/learn">Learn</a>
            <a routerLink="/about">About</a>
            <a href="https://clarityfinancialtools.com/privacy" target="_blank" rel="noopener">Privacy Policy</a>
            <a routerLink="/terms">Terms of Use</a>
            <a href="mailto:clarityfinancialtools@gmail.com">Contact</a>
          </nav>
        </div>
        <p class="pub-copy">© 2026 Clearpath Digital LLC. All rights reserved.</p>
      </footer>
    </div>
  `,
  styles: [`
    .pub { --g: #1D9E75; --ink: #111827; --muted: #6B7280; --line: #E5E7EB; color: var(--ink); }
    .pub-main:focus { outline: none; }
    .skip-link {
      position: absolute; left: 12px; top: -48px; z-index: 100;
      background: #1D9E75; color: #fff; padding: 10px 16px; border-radius: 8px;
      font-size: 14px; font-weight: 600; text-decoration: none; transition: top .15s;
    }
    .skip-link:focus { top: 12px; }
    @media (prefers-reduced-motion: reduce) {
      .pub *, .pub *::before, .pub *::after { transition: none !important; animation: none !important; }
    }
    .pub-header {
      position: sticky; top: 0; z-index: 50; display: flex; align-items: center;
      justify-content: space-between; gap: 16px; padding: 14px 24px; background: rgba(255,255,255,0.92);
      backdrop-filter: blur(8px); border-bottom: 1px solid var(--line);
    }
    .pub-logo { height: 30px; width: auto; display: block; }
    .pub-nav { display: flex; align-items: center; gap: 26px; }
    .pub-nav a { font-size: 14px; font-weight: 500; color: var(--muted); text-decoration: none; transition: color .15s; }
    .pub-nav a:hover, .pub-nav a.active { color: var(--ink); }
    .pub-nav a.pub-login { color: var(--g); font-weight: 600; }
    .pub-nav a.pub-cta {
      background: var(--g); color: #fff; padding: 9px 18px; border-radius: 10px; font-weight: 600;
      &:hover { background: #085041; color: #fff; }
    }
    .pub-burger { display: none; flex-direction: column; gap: 4px; background: none; border: none; cursor: pointer; padding: 6px; }
    .pub-burger span { width: 22px; height: 2px; background: var(--ink); border-radius: 2px; }

    .pub-main { min-height: 60vh; }

    .pub-footer { background: #0A1628; color: #cbd5e1; margin-top: 80px; padding: 48px 24px 28px; }
    .pub-footer-inner { max-width: 1080px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 24px; justify-content: space-between; }
    .pub-footer-name { display: block; font-size: 16px; font-weight: 700; color: #fff; }
    .pub-footer-own { display: block; font-size: 13px; color: #94a3b8; margin-top: 4px; }
    .pub-footer-links { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; }
    .pub-footer-links a { font-size: 13px; color: #cbd5e1; text-decoration: none; &:hover { color: #fff; } }
    .pub-copy { max-width: 1080px; margin: 28px auto 0; padding-top: 20px; border-top: 1px solid #1e2d44; font-size: 12px; color: #64748b; }

    @media (max-width: 760px) {
      .pub-burger { display: flex; }
      .pub-nav {
        position: absolute; top: 100%; left: 0; right: 0; flex-direction: column; align-items: stretch;
        gap: 0; background: #fff; border-bottom: 1px solid var(--line); padding: 8px 0;
        transform: translateY(-8px); opacity: 0; pointer-events: none; transition: .18s;
      }
      .pub-nav.open { transform: translateY(0); opacity: 1; pointer-events: auto; }
      .pub-nav a { padding: 13px 24px; }
      .pub-nav a.pub-cta { margin: 8px 24px; text-align: center; }
    }
  `],
})
export class PublicLayoutComponent {
  readonly auth = inject(AuthService);
  menuOpen = signal(false);
}
