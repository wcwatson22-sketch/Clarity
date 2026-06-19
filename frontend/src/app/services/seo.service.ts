import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta } from '@angular/platform-browser';

const ORIGIN = 'https://clarityfinancialtools.com';

/**
 * Updates per-route SEO metadata (description, canonical, Open Graph URL/title/
 * description) on client navigation. Page <title> is handled by Angular's default
 * TitleStrategy from each route's `title`.
 *
 * Note: social scrapers that don't execute JS will read the static tags in
 * index.html (the homepage values). Full per-route social cards require SSR /
 * prerendering — see the QA report.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private meta = inject(Meta);
  private doc  = inject(DOCUMENT);

  update(opts: { title?: string; description?: string; path: string }) {
    const url = ORIGIN + (opts.path === '/' ? '/' : opts.path.replace(/\/$/, ''));
    if (opts.description) {
      this.meta.updateTag({ name: 'description', content: opts.description });
      this.meta.updateTag({ property: 'og:description', content: opts.description });
      this.meta.updateTag({ name: 'twitter:description', content: opts.description });
    }
    if (opts.title) {
      this.meta.updateTag({ property: 'og:title', content: opts.title });
      this.meta.updateTag({ name: 'twitter:title', content: opts.title });
    }
    this.meta.updateTag({ property: 'og:url', content: url });
    this.setCanonical(url);
  }

  private setCanonical(url: string) {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
