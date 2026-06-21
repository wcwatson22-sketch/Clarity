// One-time/maintenance generator: converts the static LEARN_ARTICLES (authored
// in src/app/content/learn-content.ts) into a JSON seed the backend loads on
// first run to migrate the 12 existing articles into the database — preserving
// titles, slugs, categories, content, disclaimers, related links, and dates
// exactly (zero-loss; content stays HTML).
//
// Output: backend/Clarity.Api/Data/learn-seed.json
// Re-run if the static source changes before the DB cutover.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = readFileSync(join(root, 'src/app/content/learn-content.ts'), 'utf8');

// Reproduce the two helpers used inside the array literal.
const OG = (src.match(/const OG\s*=\s*'([^']+)'/) || [, '/images/clarity-social-card.png'])[1];
const ex = (html) => `<div class="example"><span class="example-label">Example</span>${html}</div>`;

// Extract the array literal via bracket matching.
const startMarker = 'LEARN_ARTICLES: LearnArticle[] =';
const mi = src.indexOf(startMarker);
if (mi === -1) throw new Error('LEARN_ARTICLES not found');
// Start at the array's opening bracket — AFTER the "=" (skips the "[]" in the type).
let i = src.indexOf('[', src.indexOf('=', mi));
let depth = 0, end = -1, inStr = null, prev = '';
for (let p = i; p < src.length; p++) {
  const c = src[p];
  if (inStr) {
    if (c === inStr && prev !== '\\') inStr = null;
  } else if (c === "'" || c === '"' || c === '`') {
    inStr = c;
  } else if (c === '[') depth++;
  else if (c === ']') { depth--; if (depth === 0) { end = p; break; } }
  prev = c;
}
if (end === -1) throw new Error('array end not found');
const arrayLiteral = src.slice(i, end + 1);

// eslint-disable-next-line no-new-func
const articles = new Function('OG', 'ex', `return ${arrayLiteral};`)(OG, ex);

const seed = articles.map(a => ({
  title: a.title,
  slug: a.slug,
  summary: a.summary,
  category: a.category,
  content: a.bodyHtml.trim(),
  featuredImageUrl: a.featuredImage || '',
  seoTitle: a.seoTitle,
  metaDescription: a.summary,
  isPublished: a.isPublished !== false,
  isFeatured: !!a.isFeatured,
  disclaimerType: a.disclaimerType || 'none',
  relatedArticleIds: a.relatedArticleIds || [],
  readingTimeMinutes: a.readMinutes || 3,
  publishedAt: a.publishedAt || null,
  updatedAt: a.updatedAt || a.publishedAt || null,
}));

const out = join(root, '../backend/Clarity.Api/Data/learn-seed.json');
writeFileSync(out, JSON.stringify(seed, null, 2));
console.log(`learn-seed.json written: ${seed.length} articles`);
