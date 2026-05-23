import { Component, output, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="splash" [class.fade-out]="fadingOut">
      <!-- Fog layers -->
      <div class="fog fog-1"></div>
      <div class="fog fog-2"></div>
      <div class="fog fog-3"></div>

      <!-- Logo -->
      <div class="splash-logo" [class.logo-visible]="logoVisible">
        <div class="logo-icon">◆</div>
        <div class="logo-text">CLARITY</div>
      </div>
    </div>
  `,
  styles: [`
    .splash {
      position: fixed;
      inset: 0;
      background: #0a1628;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      overflow: hidden;
      transition: opacity 0.8s ease;
    }
    .splash.fade-out {
      opacity: 0;
      pointer-events: none;
    }

    /* Fog layers */
    .fog {
      position: absolute;
      inset: -20%;
      background: radial-gradient(ellipse at center,
        rgba(29, 158, 117, 0.15) 0%,
        rgba(29, 158, 117, 0.05) 40%,
        transparent 70%
      );
      border-radius: 50%;
      animation: fogDrift 6s ease-in-out infinite;
      filter: blur(40px);
    }
    .fog-1 {
      animation-delay: 0s;
      transform: scale(1.2) translate(-10%, -15%);
    }
    .fog-2 {
      background: radial-gradient(ellipse at center,
        rgba(8, 80, 65, 0.2) 0%,
        rgba(8, 80, 65, 0.06) 50%,
        transparent 70%
      );
      animation-delay: -2s;
      transform: scale(0.9) translate(15%, 10%);
      filter: blur(60px);
    }
    .fog-3 {
      background: radial-gradient(ellipse at center,
        rgba(255, 255, 255, 0.04) 0%,
        transparent 60%
      );
      animation-delay: -4s;
      transform: scale(1.5) translate(5%, -5%);
      filter: blur(80px);
    }

    @keyframes fogDrift {
      0%, 100% { transform: scale(1.2) translate(-10%, -15%); }
      50%       { transform: scale(1.0) translate(5%, 10%); }
    }

    /* Logo */
    .splash-logo {
      position: relative;
      z-index: 2;
      opacity: 0;
      transform: scale(0.85);
      transition: opacity 1s ease, transform 1s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .splash-logo.logo-visible {
      opacity: 1;
      transform: scale(1);
    }
    .logo-icon {
      font-size: 52px;
      color: #1D9E75;
      line-height: 1;
      filter: drop-shadow(0 0 18px rgba(29, 158, 117, 0.6));
    }
    .logo-text {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 6px;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-shadow: 0 0 30px rgba(29, 158, 117, 0.4);
    }
  `]
})
export class SplashComponent implements OnInit {
  done = output<void>();

  logoVisible  = false;
  fadingOut    = false;

  ngOnInit() {
    // Fog plays immediately, logo fades in after 700ms
    setTimeout(() => { this.logoVisible = true; }, 700);

    // Hold for 3s total then fade the whole splash out
    setTimeout(() => {
      this.fadingOut = true;
      // After fade-out transition (800ms) notify parent to remove
      setTimeout(() => this.done.emit(), 800);
    }, 3000);
  }
}
