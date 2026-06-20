// Generates src/sitemap.xml from the public marketing routes + every published
// Learn article in src/app/content/learn-content.ts.
//
// Run:  node scripts/gen-sitemap.mjs   (also wired into "npm run gen:sitemap")
//
// It parses slugs/isPublished/updatedAt with a light regex so it needs no TS
// build step. Re-run whenever you add, remove, or unpublish an article.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ORIGIN = 'https://clarityfinancialtools.com';
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const src = readFileSync(join(root, 'src/app/content/learn-content.ts'), 'utf8');

// Split on article object boundaries (each starts with "id:") and keep only
// blocks that are published, capturing slug + updatedAt.
const articles = [];
const re = /slug:\s*'([^']+)'[\s\S]*?updatedAt:\s*'([^']+)'[\s\S]*?isPublished:\s*(true|false)/g;
let m;
while ((m = re.exec(src)) !== null) {
  if (m[3] === 'true') articles.push({ slug: m[1], updated: m[2] });
}

const today = new Date().toISOString().slice(0, 10);
const staticPages = [
  { loc: '/', pri: '1.0', freq: 'weekly' },
  { loc: '/features', pri: '0.8', freq: 'monthly' },
  { loc: '/pricing', pri: '0.8', freq: 'monthly' },
  { loc: '/learn', pri: '0.9', freq: 'weekly' },
  { loc: '/about', pri: '0.5', freq: 'monthly' },
];

const url = (loc, lastmod, pri, freq) =>
  `  <url>\n    <loc>${ORIGIN}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n` +
  `    <changefreq>${freq}</changefreq>\n    <priority>${pri}</priority>\n  </url>`;

const body = [
  ...staticPages.map(p => url(p.loc, today, p.pri, p.freq)),
  ...articles.map(a => url('/learn/' + a.slug, a.updated, '0.7', 'monthly')),
].join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(join(root, 'src/sitemap.xml'), xml);
console.log(`sitemap.xml written: ${staticPages.length} pages + ${articles.length} articles`);
