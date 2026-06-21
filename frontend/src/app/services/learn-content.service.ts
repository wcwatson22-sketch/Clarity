import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  LEARN_ARTICLES, LearnArticle as StaticArticle, DisclaimerType,
} from '../content/learn-content';

/** Normalized shape the public Learn components render. */
export interface PublicArticleListItem {
  slug: string;
  title: string;
  summary: string;
  category: string;
  isFeatured: boolean;
  readMinutes: number;
  featuredImage: string;
}

export interface PublicArticle extends PublicArticleListItem {
  content: string;            // sanitized on render via [innerHTML]
  seoTitle: string;
  metaDescription: string;
  disclaimerType: DisclaimerType;
  authorName: string;
  relatedSlugs: string[];
  publishedAt: string | null;
  updatedAt: string | null;
}

/**
 * Public Learn content source. Reads PUBLISHED articles from the backend CMS
 * (so admin publish/unpublish takes effect with no redeploy) and falls back to
 * the bundled static content if the API is unavailable — guaranteeing the
 * public Learn pages never go blank during/after rollout.
 */
@Injectable({ providedIn: 'root' })
export class LearnContentService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(): Observable<PublicArticleListItem[]> {
    return this.http.get<any[]>(`${this.base}/learn/articles`).pipe(
      map(rows => rows.map(r => ({
        slug: r.slug, title: r.title, summary: r.summary, category: r.category,
        isFeatured: !!r.isFeatured, readMinutes: r.readingTimeMinutes ?? 3,
        featuredImage: r.featuredImageUrl || '',
      }))),
      map(list => list.length ? list : this.staticList()),
      catchError(() => of(this.staticList())),
    );
  }

  get(slug: string): Observable<PublicArticle | null> {
    return this.http.get<any>(`${this.base}/learn/articles/${slug}`).pipe(
      map(r => ({
        slug: r.slug, title: r.title, summary: r.summary, category: r.category,
        isFeatured: !!r.isFeatured, readMinutes: r.readingTimeMinutes ?? 3,
        featuredImage: r.featuredImageUrl || '',
        content: r.content ?? '', seoTitle: r.seoTitle || r.title,
        metaDescription: r.metaDescription || r.summary,
        disclaimerType: (r.disclaimerType ?? 'none') as DisclaimerType,
        authorName: r.authorName || 'Clarity Financial Tools',
        relatedSlugs: r.relatedArticleIds ?? [],
        publishedAt: r.publishedAt ?? null, updatedAt: r.updatedAt ?? null,
      } as PublicArticle)),
      catchError(() => of(this.staticGet(slug))),
    );
  }

  // ── Static fallback (bundled content) ─────────────────────────────────────
  private staticList(): PublicArticleListItem[] {
    return LEARN_ARTICLES.filter(a => a.isPublished).map(this.toListItem);
  }

  private staticGet(slug: string): PublicArticle | null {
    const a = LEARN_ARTICLES.find(x => x.slug === slug && x.isPublished);
    return a ? this.toPublic(a) : null;
  }

  private toListItem = (a: StaticArticle): PublicArticleListItem => ({
    slug: a.slug, title: a.title, summary: a.summary, category: a.category,
    isFeatured: a.isFeatured, readMinutes: a.readMinutes, featuredImage: a.featuredImage,
  });

  private toPublic(a: StaticArticle): PublicArticle {
    return {
      ...this.toListItem(a),
      content: a.bodyHtml, seoTitle: a.seoTitle, metaDescription: a.summary,
      disclaimerType: a.disclaimerType, authorName: 'Clarity Financial Tools',
      relatedSlugs: a.relatedArticleIds, publishedAt: a.publishedAt, updatedAt: a.updatedAt,
    };
  }
}

/** Category → relevant Clarity tool CTA (derived; preserves the feature box). */
export interface CategoryFeature { label: string; route: string; premium?: boolean; note?: string; }
export const CATEGORY_FEATURE: Record<string, CategoryFeature> = {
  basics:        { label: 'Open your Dashboard', route: '/dashboard', note: 'Clarity totals your net worth, assets, and liabilities automatically.' },
  dti:           { label: 'Try the Loan Impact Calculator', route: '/loan-impact', note: 'See how a new loan payment would change your DTI.' },
  'loan-prep':   { label: 'Get ready with Loan Prep', route: '/loan-prep', premium: true, note: 'Premium organizes the income, debt, and asset picture lenders ask for.' },
  retirement:    { label: 'Plan it in Cash Flow', route: '/cash-flow', note: 'Track contributions and employer match alongside your budget.' },
  'real-estate': { label: 'Analyze a property in Real Estate', route: '/real-estate', premium: true, note: 'Premium unlocks rental cash flow, cap rate, and DSCR analysis.' },
};
