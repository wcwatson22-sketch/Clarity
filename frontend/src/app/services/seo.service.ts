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

  /** Default OG image (homepage social card). */
  private readonly defaultImage = ORIGIN + '/images/clarity-social-card.png';

  update(opts: {
    title?: string;
    description?: string;
    path: string;
    image?: string;        // root-relative or absolute; falls back to the default card
    type?: string;         // og:type — 'website' (default) or 'article'
  }) {
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
    const img = opts.image
      ? (opts.image.startsWith('http') ? opts.image : ORIGIN + opts.image)
      : this.defaultImage;
    this.meta.updateTag({ property: 'og:image', content: img });
    this.meta.updateTag({ name: 'twitter:image', content: img });
    this.meta.updateTag({ property: 'og:type', content: opts.type || 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.setCanonical(url);
  }

  /** Resolve a root-relative path to an absolute canonical URL. */
  absoluteUrl(path: string): string {
    return ORIGIN + (path === '/' ? '/' : path.replace(/\/$/, ''));
  }

  /**
   * Inject (or replace) a JSON-LD structured-data block by id. Crawlable by
   * search engines. Pass `null` to remove a previously-set block.
   */
  setJsonLd(id: string, data: object | null) {
    const elId = 'ld-' + id;
    let script = this.doc.getElementById(elId) as HTMLScriptElement | null;
    if (!data) { script?.remove(); return; }
    if (!script) {
      script = this.doc.createElement('script');
      script.id = elId;
      script.type = 'application/ld+json';
      this.doc.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }

  /** Allow or block indexing for the current route. Public Learn = index. */
  setRobots(content: 'index,follow' | 'noindex,nofollow') {
    this.meta.updateTag({ name: 'robots', content });
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
