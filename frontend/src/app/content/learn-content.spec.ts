import {
  LEARN_ARTICLES, LEARN_CATEGORIES, publishedArticles, getArticle,
  relatedArticles, LEARN_DISCLAIMERS,
} from './learn-content';

describe('Learn content', () => {
  it('has unique slugs', () => {
    const slugs = LEARN_ARTICLES.map(a => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has unique SEO titles and meta descriptions (no duplicate/thin metadata)', () => {
    const pub = publishedArticles();
    const titles = pub.map(a => a.seoTitle);
    const descs = pub.map(a => a.summary);
    expect(new Set(titles).size).withContext('seoTitle').toBe(titles.length);
    expect(new Set(descs).size).withContext('summary').toBe(descs.length);
  });

  it('uses kebab-case slugs that match the suggested article URLs', () => {
    for (const a of LEARN_ARTICLES) {
      expect(a.slug).withContext(a.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    for (const expected of ['what-is-dti', 'how-to-calculate-net-worth', 'assets-vs-liabilities',
      'personal-financial-statement', 'how-a-new-loan-affects-dti', 'employer-401k-match', 'rental-property-cash-flow']) {
      expect(getArticle(expected)).withContext(expected).toBeTruthy();
    }
  });

  it('only references valid categories', () => {
    const ids = new Set(LEARN_CATEGORIES.map(c => c.id));
    for (const a of LEARN_ARTICLES) expect(ids.has(a.category)).withContext(a.slug).toBeTrue();
  });

  it('only references related articles that exist and are published', () => {
    for (const a of publishedArticles()) {
      const related = relatedArticles(a);
      expect(related.length).withContext(a.slug).toBe(a.relatedArticleIds.length);
    }
  });

  it('attaches a disclaimer to loan/DTI/real-estate articles', () => {
    expect(getArticle('what-is-dti')!.disclaimerType).toBe('standard');
    expect(getArticle('rental-property-cash-flow')!.disclaimerType).toBe('realestate');
    expect(LEARN_DISCLAIMERS.standard).toContain('does not provide financial advice');
    expect(LEARN_DISCLAIMERS.realestate).toContain('educational purposes only');
  });

  it('gives every published article a non-trivial body and a summary', () => {
    for (const a of publishedArticles()) {
      expect(a.bodyHtml.length).withContext(a.slug).toBeGreaterThan(400);
      expect(a.summary.length).withContext(a.slug).toBeGreaterThan(20);
      expect(a.bodyHtml).withContext(a.slug + ' has an H2').toContain('<h2>');
    }
  });
});
