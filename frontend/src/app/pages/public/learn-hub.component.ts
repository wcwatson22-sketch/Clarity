import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SeoService } from '../../services/seo.service';
import { LearnAnalyticsService } from '../../services/learn-analytics.service';
import {
  LEARN_CATEGORIES, publishedArticles, featuredArticles,
  articlesByCategory, LearnArticle,
} from '../../content/learn-content';

/**
 * Public Learn hub — /learn. Renders inside the marketing PublicLayout.
 * No authentication required; fully crawlable.
 */
@Component({
  selector: 'app-learn-hub',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="lh">
      <!-- Hero -->
      <section class="lh-hero">
        <nav class="lh-crumbs" aria-label="Breadcrumb">
          <a routerLink="/">Home</a><span aria-hidden="true">›</span><span>Learn</span>
        </nav>
        <h1>Learn About Your Financial Picture</h1>
        <p class="lh-intro">
          Straightforward guides to help you understand cash flow, debt, DTI, net worth,
          loan preparation, and investment real estate.
        </p>
        <div class="lh-search">
          <input
            type="search"
            placeholder="Search articles…"
            [value]="query()"
            (input)="onSearch($any($event.target).value)"
            aria-label="Search Learn articles" />
        </div>
        <div class="lh-filters" role="group" aria-label="Filter by category">
          <button class="lh-chip" [class.active]="activeCat() === 'all'" (click)="setCat('all')">All</button>
          @for (c of categories; track c.id) {
            <button class="lh-chip" [class.active]="activeCat() === c.id" (click)="setCat(c.id)">{{ c.name }}</button>
          }
        </div>
      </section>

      <!-- Featured (hidden while searching/filtering) -->
      @if (!query() && activeCat() === 'all' && featured().length) {
        <section class="lh-section">
          <h2 class="lh-h2">Featured guides</h2>
          <div class="lh-grid">
            @for (a of featured(); track a.id) {
              <a class="lh-card lh-card-feat" [routerLink]="['/learn', a.slug]" (click)="trackArticle(a)">
                <span class="lh-card-cat">{{ catName(a.category) }}</span>
                <h3>{{ a.title }}</h3>
                <p>{{ a.summary }}</p>
                <span class="lh-card-meta">{{ a.readMinutes }} min read</span>
              </a>
            }
          </div>
        </section>
      }

      <!-- Results -->
      @if (query() || activeCat() !== 'all') {
        <section class="lh-section">
          <h2 class="lh-h2">
            {{ filtered().length }} {{ filtered().length === 1 ? 'article' : 'articles' }}
            @if (activeCat() !== 'all') { in {{ catName(activeCat()) }} }
          </h2>
          @if (filtered().length) {
            <div class="lh-grid">
              @for (a of filtered(); track a.id) {
                <a class="lh-card" [routerLink]="['/learn', a.slug]" (click)="trackArticle(a)">
                  <span class="lh-card-cat">{{ catName(a.category) }}</span>
                  <h3>{{ a.title }}</h3>
                  <p>{{ a.summary }}</p>
                  <span class="lh-card-meta">{{ a.readMinutes }} min read</span>
                </a>
              }
            </div>
          } @else {
            <p class="lh-empty">No articles match your search. <button class="lh-link" (click)="reset()">Clear filters</button></p>
          }
        </section>
      } @else {
        <!-- Browse by category -->
        @for (c of categories; track c.id) {
          @if (byCat(c.id).length) {
            <section class="lh-section">
              <h2 class="lh-h2">{{ c.name }}</h2>
              <p class="lh-cat-blurb">{{ c.blurb }}</p>
              <div class="lh-grid">
                @for (a of byCat(c.id); track a.id) {
                  <a class="lh-card" [routerLink]="['/learn', a.slug]" (click)="trackArticle(a)">
                    <h3>{{ a.title }}</h3>
                    <p>{{ a.summary }}</p>
                    <span class="lh-card-meta">{{ a.readMinutes }} min read</span>
                  </a>
                }
              </div>
            </section>
          }
        }
      }

      <!-- CTA -->
      <section class="lh-cta">
        <h2>Put these ideas to work</h2>
        <p>Clarity turns these concepts into live numbers — cash flow, net worth, DTI, and more. It's free to start.</p>
        <div class="lh-cta-actions">
          @if (auth.isLoggedIn()) {
            <a routerLink="/dashboard" class="lh-btn lh-btn-primary">Go to Dashboard</a>
          } @else {
            <a routerLink="/signup" class="lh-btn lh-btn-primary" (click)="trackSignup()">Create a free account</a>
            <a routerLink="/features" class="lh-btn lh-btn-ghost">See features</a>
          }
        </div>
        <p class="lh-disclaimer">Clarity provides educational information and estimates only. It is not financial advice.</p>
      </section>
    </div>
  `,
  styles: [`
    .lh { max-width: 1080px; margin: 0 auto; padding: 28px 20px 8px; color: #111827; }
    .lh-hero { padding: 12px 0 8px; }
    .lh-crumbs { font-size: 13px; color: #9CA3AF; display: flex; gap: 8px; margin-bottom: 14px; }
    .lh-crumbs a { color: #6B7280; text-decoration: none; &:hover { color: #111827; } }
    .lh-hero h1 { font-size: clamp(26px, 4vw, 38px); font-weight: 800; margin: 0 0 12px; line-height: 1.15; }
    .lh-intro { font-size: 16px; color: #6B7280; line-height: 1.6; max-width: 680px; margin: 0 0 20px; }
    .lh-search input {
      width: 100%; max-width: 460px; box-sizing: border-box;
      padding: 12px 14px; font-size: 15px; border: 1px solid #E5E7EB; border-radius: 12px; outline: none;
      &:focus { border-color: #1D9E75; box-shadow: 0 0 0 3px rgba(29,158,117,.12); }
    }
    .lh-filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 6px; }
    .lh-chip {
      border: 1px solid #E5E7EB; background: #fff; color: #374151;
      padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 500; cursor: pointer;
      transition: all .15s;
      &:hover { border-color: #A7F3D0; }
      &.active { background: #E1F5EE; border-color: #1D9E75; color: #085041; font-weight: 600; }
    }
    .lh-section { margin: 30px 0; }
    .lh-h2 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
    .lh-cat-blurb { font-size: 14px; color: #6B7280; margin: 0 0 16px; }
    .lh-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 14px; }
    .lh-card {
      display: flex; flex-direction: column; gap: 8px; text-decoration: none; color: inherit;
      border: 1px solid #E5E7EB; border-radius: 16px; padding: 18px; background: #fff;
      transition: border-color .15s, box-shadow .15s, transform .15s;
      &:hover { border-color: #A7F3D0; box-shadow: 0 8px 24px rgba(16,24,40,.06); transform: translateY(-2px); }
      h3 { font-size: 16px; font-weight: 700; margin: 0; line-height: 1.3; }
      p { font-size: 13.5px; color: #6B7280; margin: 0; line-height: 1.5; }
    }
    .lh-card-feat { background: linear-gradient(180deg,#F0FBF7,#fff); border-color: #BBF7D0; }
    .lh-card-cat { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #1D9E75; }
    .lh-card-meta { font-size: 12px; color: #9CA3AF; margin-top: auto; }
    .lh-empty { font-size: 14px; color: #6B7280; }
    .lh-link { background: none; border: none; color: #1D9E75; font-weight: 600; cursor: pointer; padding: 0; font-size: 14px; }
    .lh-cta {
      margin: 40px 0 8px; padding: 34px 24px; border-radius: 20px; text-align: center;
      background: linear-gradient(135deg,#E1F5EE,#F0FBF7); border: 1px solid #BBF7D0;
      h2 { font-size: 22px; font-weight: 800; margin: 0 0 8px; }
      p { font-size: 15px; color: #374151; margin: 0 auto 18px; max-width: 560px; }
    }
    .lh-cta-actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
    .lh-btn { padding: 12px 22px; border-radius: 12px; font-size: 15px; font-weight: 600; text-decoration: none; }
    .lh-btn-primary { background: #1D9E75; color: #fff; &:hover { background: #085041; } }
    .lh-btn-ghost { background: #fff; color: #111827; border: 1px solid #E5E7EB; &:hover { border-color: #A7F3D0; } }
    .lh-disclaimer { font-size: 12px !important; color: #6B7280 !important; margin: 18px auto 0 !important; }
    @media (max-width: 520px) {
      .lh-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class LearnHubComponent implements OnInit {
  readonly auth = inject(AuthService);
  private seo = inject(SeoService);
  private analytics = inject(LearnAnalyticsService);

  readonly categories = LEARN_CATEGORIES;
  readonly featured = signal<LearnArticle[]>(featuredArticles());
  private all = publishedArticles();

  query = signal('');
  activeCat = signal<string>('all');

  readonly filtered = computed<LearnArticle[]>(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.activeCat();
    return this.all.filter(a => {
      const catOk = cat === 'all' || a.category === cat;
      const qOk = !q || (a.title + ' ' + a.summary).toLowerCase().includes(q);
      return catOk && qOk;
    });
  });

  ngOnInit(): void {
    this.seo.update({
      title: 'Learn About Your Financial Picture | Clarity Financial Tools',
      description: 'Straightforward guides to cash flow, debt, DTI, net worth, loan preparation, and investment real estate — free from Clarity Financial Tools.',
      path: '/learn',
      type: 'website',
    });
    this.seo.setRobots('index,follow');
    this.seo.setJsonLd('learn-hub', {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Learn About Your Financial Picture',
      description: 'Educational guides to cash flow, debt, DTI, net worth, loan preparation, and real estate.',
      url: this.seo.absoluteUrl('/learn'),
      hasPart: this.all.map(a => ({
        '@type': 'Article',
        headline: a.title,
        url: this.seo.absoluteUrl('/learn/' + a.slug),
      })),
    });
    this.analytics.track('learn_hub_viewed');
  }

  catName(id: string) { return this.categories.find(c => c.id === id)?.name ?? ''; }
  byCat(id: string) { return articlesByCategory(id); }

  setCat(id: string) { this.activeCat.set(id); }
  onSearch(v: string) { this.query.set(v); }
  reset() { this.query.set(''); this.activeCat.set('all'); }

  trackArticle(a: LearnArticle) { this.analytics.track('learn_article_viewed', { slug: a.slug, category: a.category }); }
  trackSignup() { this.analytics.track('learn_account_create_started', { label: 'hub_cta' }); }
}
