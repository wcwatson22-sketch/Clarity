import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';
import { SeoService } from '../../services/seo.service';
import { LearnAnalyticsService } from '../../services/learn-analytics.service';
import { MarketingAdUnitComponent } from '../../components/marketing-ad-unit.component';
import { MARKETING_ADS } from '../../services/marketing-ads.config';
import { LearnDisclosureComponent } from '../../components/learn-disclosure.component';
import { categoryName, LEARN_DISCLAIMERS } from '../../content/learn-content';
import {
  LearnContentService, PublicArticle, PublicArticleListItem,
  CATEGORY_FEATURE, CategoryFeature,
} from '../../services/learn-content.service';

/**
 * Public Learn article — /learn/:slug. Renders inside the marketing
 * PublicLayout. No authentication; fully crawlable. Unknown slugs redirect
 * back to the Learn hub.
 */
@Component({
  selector: 'app-learn-article',
  standalone: true,
  imports: [RouterLink, DatePipe, MarketingAdUnitComponent, LearnDisclosureComponent],
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

        <!-- Article body — rendered with Angular's HTML sanitizer (strips any
             scripts/handlers); content is also sanitized server-side on save.
             The body is split at the first section heading so the inline ad
             sits after the introduction and never splits a table/list/steps. -->
        <div class="la-body" [innerHTML]="introHtml()"></div>
        @if (restHtml()) {
          @if (ads.placements.learnArticleInlineEnabled) {
            <app-marketing-ad-unit placementName="learn_article_inline" [adSlot]="ads.slots.learnInline"
              format="fluid" [minimumHeight]="120" />
          }
          <div class="la-body" [innerHTML]="restHtml()"></div>
        }

        @if (disclaimer()) {
          <p class="la-disclaimer">{{ disclaimer() }}</p>
        }

        @if (feature(); as f) {
          <aside class="la-feature">
            <div class="la-feature-text">
              <strong>{{ f.label }}</strong>
              @if (f.note) { <span>{{ f.note }}</span> }
              @if (f.premium) { <span class="la-premium">Premium feature</span> }
            </div>
            <a [routerLink]="f.route" class="la-feature-btn" (click)="trackFeature(f)">Open</a>
          </aside>
        }

        @if (related().length) {
          <section class="la-related">
            <h2>Related articles</h2>
            <div class="la-related-grid">
              @for (r of related(); track r.slug) {
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

        <!-- Bottom ad — only on longer articles, after the CTA -->
        @if (ads.placements.learnArticleBottomEnabled && isLongArticle()) {
          <app-marketing-ad-unit placementName="learn_article_bottom" [adSlot]="ads.slots.learnBottom"
            format="auto" [minimumHeight]="100" />
        }
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
  private analytics = inject(LearnAnalyticsService);
  private content = inject(LearnContentService);

  readonly article = signal<PublicArticle | null>(null);
  readonly related = signal<PublicArticleListItem[]>([]);

  readonly feature = computed<CategoryFeature | null>(() => {
    const a = this.article();
    return a ? (CATEGORY_FEATURE[a.category] ?? null) : null;
  });

  readonly disclaimer = computed(() => {
    const t = this.article()?.disclaimerType;
    return t && t !== 'none' ? (LEARN_DISCLAIMERS as Record<string, string>)[t] ?? '' : '';
  });

  /** Loan/DTI/underwriting articles get the extra lending-variability note. */
  readonly loanArticle = computed(() => this.article()?.disclaimerType === 'standard');

  // Marketing ad config + body split (intro vs. the rest, at the first heading).
  readonly ads = MARKETING_ADS;
  private splitIndex = () => (this.article()?.content ?? '').search(/<h2[\s>]/i);
  readonly introHtml = computed(() => { const c = this.article()?.content ?? ''; const i = this.splitIndex(); return i > 0 ? c.slice(0, i) : c; });
  readonly restHtml  = computed(() => { const c = this.article()?.content ?? ''; const i = this.splitIndex(); return i > 0 ? c.slice(i) : ''; });
  readonly isLongArticle = computed(() => (this.article()?.readMinutes ?? 0) >= 5);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(pm => {
      const slug = pm.get('slug') ?? '';
      this.content.get(slug).subscribe(a => {
        if (!a) { this.router.navigateByUrl('/learn', { replaceUrl: true }); return; }
        this.article.set(a);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
        this.applySeo(a);
        // Resolve related cards (title/summary) from the list by slug.
        this.content.list().subscribe(list =>
          this.related.set(a.relatedSlugs
            .map(s => list.find(x => x.slug === s))
            .filter((x): x is PublicArticleListItem => !!x)));
      });
    });
  }

  private applySeo(a: PublicArticle) {
    const path = '/learn/' + a.slug;
    const img = a.featuredImage || '/images/clarity-social-card.png';
    this.seo.update({ title: a.seoTitle, description: a.metaDescription, path, image: img, type: 'article' });
    this.seo.setRobots('index,follow');
    this.seo.setJsonLd('article', {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: a.title,
      description: a.metaDescription,
      image: this.seo.absoluteUrl(img),
      datePublished: a.publishedAt,
      dateModified: a.updatedAt,
      author: { '@type': 'Organization', name: a.authorName },
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
  trackRelated(r: PublicArticleListItem) { this.analytics.track('learn_related_clicked', { slug: r.slug }); }
  trackFeature(f: CategoryFeature) {
    this.analytics.track(f.premium ? 'learn_premium_link_clicked' : 'learn_cta_clicked', { slug: this.article()?.slug, to: f.route });
  }
  trackSignup() { this.analytics.track('learn_account_create_started', { slug: this.article()?.slug, label: 'article_cta' }); }
}
