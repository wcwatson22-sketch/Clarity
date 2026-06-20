import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { SeoService } from '../../services/seo.service';
import { LearnAnalyticsService } from '../../services/learn-analytics.service';
import { LearnAdComponent } from '../../components/learn-ad.component';
import { LearnDisclosureComponent } from '../../components/learn-disclosure.component';
import {
  getArticle, relatedArticles, categoryName, LearnArticle,
  LEARN_DISCLAIMERS,
} from '../../content/learn-content';

/**
 * Public Learn article — /learn/:slug. Renders inside the marketing
 * PublicLayout. No authentication; fully crawlable. Unknown slugs redirect
 * back to the Learn hub.
 */
@Component({
  selector: 'app-learn-article',
  standalone: true,
  imports: [RouterLink, DatePipe, LearnAdComponent, LearnDisclosureComponent],
  template: `
    @if (article(); as a) {
      <article class="la">
        <nav class="la-crumbs" aria-label="Breadcrumb">
          <a routerLink="/">Home</a><span aria-hidden="true">›</span>
          <a routerLink="/learn">Learn</a><span aria-hidden="true">›</span>
          <span>{{ catName(a.category) }}</span>
        </nav>

        <header class="la-head">
          <span class="la-cat">{{ catName(a.category) }}</span>
          <h1>{{ a.title }}</h1>
          <p class="la-meta">
            {{ a.readMinutes }} min read · Updated {{ a.updatedAt | date:'longDate' }}
          </p>
        </header>

        <!-- Authored HTML body (no user input) -->
        <div class="la-body" [innerHTML]="body()"></div>

        <!-- Optional ad slot — disabled behind a feature flag by default -->
        <app-learn-ad slot="inline" />

        @if (disclaimer()) {
          <p class="la-disclaimer">{{ disclaimer() }}</p>
        }

        @if (a.feature; as f) {
          <aside class="la-feature">
            <div class="la-feature-text">
              <strong>{{ f.label }}</strong>
              @if (f.note) { <span>{{ f.note }}</span> }
              @if (f.premium) { <span class="la-premium">Premium feature</span> }
            </div>
            <a [routerLink]="f.route" class="la-feature-btn" (click)="trackFeature(a, f.premium)">Open</a>
          </aside>
        }

        @if (related().length) {
          <section class="la-related">
            <h2>Related articles</h2>
            <div class="la-related-grid">
              @for (r of related(); track r.id) {
                <a class="la-related-card" [routerLink]="['/learn', r.slug]" (click)="trackRelated(r)">
                  <h3>{{ r.title }}</h3>
                  <p>{{ r.summary }}</p>
                </a>
              }
            </div>
          </section>
        }

        <app-learn-disclosure variant="article" [loan]="loanArticle()" />

        <section class="la-cta">
          <h2>See your own numbers</h2>
          <p>Clarity turns these concepts into a live view of your finances — free to start.</p>
          <div class="la-cta-actions">
            @if (auth.isLoggedIn()) {
              <a routerLink="/dashboard" class="la-btn la-btn-primary">Go to Dashboard</a>
            } @else {
              <a routerLink="/signup" class="la-btn la-btn-primary" (click)="trackSignup()">Create a free account</a>
              <a routerLink="/learn" class="la-btn la-btn-ghost">Back to Learn</a>
            }
          </div>
        </section>

        <app-learn-ad slot="footer" />
      </article>
    }
  `,
  styles: [`
    .la { max-width: 760px; margin: 0 auto; padding: 28px 20px 8px; color: #111827; }
    .la-crumbs { font-size: 13px; color: #9CA3AF; display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
    .la-crumbs a { color: #6B7280; text-decoration: none; &:hover { color: #111827; } }
    .la-cat { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #1D9E75; }
    .la-head h1 { font-size: clamp(26px, 4vw, 36px); font-weight: 800; line-height: 1.2; margin: 8px 0 10px; }
    .la-meta { font-size: 13px; color: #9CA3AF; margin: 0 0 8px; }
    .la-body { font-size: 16.5px; line-height: 1.72; color: #1F2937; }
    .la-body h2 { font-size: 22px; font-weight: 700; margin: 32px 0 10px; color: #111827; }
    .la-body h3 { font-size: 18px; font-weight: 700; margin: 24px 0 8px; }
    .la-body p { margin: 0 0 16px; }
    .la-body ul { margin: 0 0 16px; padding-left: 22px; }
    .la-body li { margin: 0 0 7px; }
    .la-body a { color: #1D9E75; font-weight: 600; text-decoration: none; &:hover { text-decoration: underline; } }
    .la-body .example {
      background: #F0FBF7; border: 1px solid #BBF7D0; border-radius: 12px;
      padding: 14px 16px; margin: 0 0 20px;
    }
    .la-body .example-label {
      display: block; font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; color: #1D9E75; margin-bottom: 6px;
    }
    .la-body .example p:last-child { margin-bottom: 0; }
    .la-disclaimer {
      font-size: 12.5px; color: #6B7280; line-height: 1.55; font-style: italic;
      border-left: 3px solid #E5E7EB; padding: 4px 0 4px 14px; margin: 24px 0;
    }
    .la-feature {
      display: flex; align-items: center; gap: 16px; justify-content: space-between;
      background: #fff; border: 1px solid #BBF7D0; border-radius: 16px; padding: 18px 20px; margin: 26px 0;
    }
    .la-feature-text { display: flex; flex-direction: column; gap: 3px; }
    .la-feature-text strong { font-size: 15px; }
    .la-feature-text span { font-size: 13px; color: #6B7280; }
    .la-premium { color: #B45309 !important; font-weight: 600; }
    .la-feature-btn {
      flex-shrink: 0; background: #1D9E75; color: #fff; text-decoration: none;
      padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 14px;
      &:hover { background: #085041; }
    }
    .la-related { margin: 36px 0; }
    .la-related h2 { font-size: 18px; font-weight: 700; margin: 0 0 14px; }
    .la-related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px,1fr)); gap: 14px; }
    .la-related-card {
      text-decoration: none; color: inherit; border: 1px solid #E5E7EB; border-radius: 14px; padding: 16px;
      transition: border-color .15s, transform .15s;
      &:hover { border-color: #A7F3D0; transform: translateY(-2px); }
      h3 { font-size: 14.5px; font-weight: 700; margin: 0 0 6px; line-height: 1.3; }
      p { font-size: 13px; color: #6B7280; margin: 0; line-height: 1.5; }
    }
    .la-cta {
      margin: 36px 0 8px; padding: 30px 24px; border-radius: 20px; text-align: center;
      background: linear-gradient(135deg,#E1F5EE,#F0FBF7); border: 1px solid #BBF7D0;
      h2 { font-size: 20px; font-weight: 800; margin: 0 0 8px; }
      p { font-size: 14.5px; color: #374151; margin: 0 auto 16px; max-width: 480px; }
    }
    .la-cta-actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
    .la-btn { padding: 12px 22px; border-radius: 12px; font-size: 15px; font-weight: 600; text-decoration: none; }
    .la-btn-primary { background: #1D9E75; color: #fff; &:hover { background: #085041; } }
    .la-btn-ghost { background: #fff; color: #111827; border: 1px solid #E5E7EB; &:hover { border-color: #A7F3D0; } }
  `],
})
export class LearnArticleComponent {
  readonly auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);
  private analytics = inject(LearnAnalyticsService);

  private slug = toSignal(this.route.paramMap.pipe(map(p => p.get('slug') ?? '')), { initialValue: '' });

  readonly article = computed<LearnArticle | undefined>(() => {
    const a = getArticle(this.slug());
    if (!a && this.slug()) {
      // Unknown slug → send the visitor back to the hub.
      this.router.navigateByUrl('/learn', { replaceUrl: true });
      return undefined;
    }
    if (a) this.applySeo(a);
    return a;
  });

  readonly body = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.article()?.bodyHtml ?? ''));

  readonly related = computed(() => {
    const a = this.article();
    return a ? relatedArticles(a) : [];
  });

  readonly disclaimer = computed(() => {
    const t = this.article()?.disclaimerType;
    return t && t !== 'none' ? LEARN_DISCLAIMERS[t] : '';
  });

  /** Loan/DTI/underwriting articles get the extra lending-variability note. */
  readonly loanArticle = computed(() => this.article()?.disclaimerType === 'standard');

  private lastSeoSlug = '';
  private applySeo(a: LearnArticle) {
    if (this.lastSeoSlug === a.slug) return;
    // Navigating to a different article (e.g. a related link at the bottom of
    // the page) should start at the top, not retain the previous scroll.
    if (this.lastSeoSlug && typeof window !== 'undefined') window.scrollTo({ top: 0 });
    this.lastSeoSlug = a.slug;
    const path = '/learn/' + a.slug;
    this.seo.update({ title: a.seoTitle, description: a.summary, path, image: a.featuredImage, type: 'article' });
    this.seo.setRobots('index,follow');
    this.seo.setJsonLd('article', {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: a.title,
      description: a.summary,
      image: this.seo.absoluteUrl(a.featuredImage),
      datePublished: a.publishedAt,
      dateModified: a.updatedAt,
      author: { '@type': 'Organization', name: 'Clarity Financial Tools' },
      publisher: {
        '@type': 'Organization',
        name: 'Clarity Financial Tools',
        logo: { '@type': 'ImageObject', url: this.seo.absoluteUrl('/icons/icon-512x512.png') },
      },
      mainEntityOfPage: this.seo.absoluteUrl(path),
    });
    this.seo.setJsonLd('breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: this.seo.absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Learn', item: this.seo.absoluteUrl('/learn') },
        { '@type': 'ListItem', position: 3, name: a.title, item: this.seo.absoluteUrl(path) },
      ],
    });
    this.analytics.track('learn_article_viewed', { slug: a.slug, category: a.category });
  }

  catName(id: string) { return categoryName(id); }
  trackRelated(r: LearnArticle) { this.analytics.track('learn_related_clicked', { slug: r.slug }); }
  trackFeature(a: LearnArticle, premium?: boolean) {
    this.analytics.track(premium ? 'learn_premium_link_clicked' : 'learn_cta_clicked', { slug: a.slug, to: a.feature?.route });
  }
  trackSignup() { this.analytics.track('learn_account_create_started', { slug: this.article()?.slug, label: 'article_cta' }); }
}
