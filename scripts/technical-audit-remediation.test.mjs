import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { editorialDates } from '../src/lib/editorial-metadata.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');

function headerMap(rule) {
  return new Map((rule?.headers ?? []).map(({ key, value }) => [key, value]));
}

describe('technical audit remediation contracts', () => {
  it('self-hosts the pinned legacy runtime behind SRI and a bounded CSP', async () => {
    const [config, react, reactDom, ...pages] = await Promise.all([
      read('vercel.json').then(JSON.parse),
      read('public/assets/vendor/react-18.3.1.production.min.js'),
      read('public/assets/vendor/react-dom-18.3.1.production.min.js'),
      read('public/astrofolio/index.html'),
      read('public/terminal/index.html'),
      read('public/registry/technical/index.html'),
    ]);
    const global = headerMap(config.headers.find(({ source }) => source === '/(.*)'));
    const csp = global.get('Content-Security-Policy') ?? '';

    expect(global.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
    expect(global.get('Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups');
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://plausible.io");
    expect(csp).not.toContain('unpkg.com');
    expect(csp).toContain("script-src-attr 'none'");

    const runtimes = [
      ['/assets/vendor/react-18.3.1.production.min.js', react],
      ['/assets/vendor/react-dom-18.3.1.production.min.js', reactDom],
    ];
    for (const page of pages) {
      expect(page).not.toContain('unpkg.com');
      for (const [source, contents] of runtimes) {
        const tag = page.match(new RegExp(`<script[^>]+src="${source.replaceAll('.', '\\.') }"[^>]*><\\/script>`, 'u'))?.[0] ?? '';
        expect(tag).toContain('crossorigin="anonymous"');
        expect(tag).toContain('referrerpolicy="no-referrer"');
        const digest = createHash('sha384').update(contents).digest('base64');
        expect(tag).toContain(`integrity="sha384-${digest}"`);
      }
    }
  });

  it('uses one revalidating app bundle key and immutable caching only for frozen paths', async () => {
    const [config, ...pages] = await Promise.all([
      read('vercel.json').then(JSON.parse),
      read('public/astrofolio/index.html'),
      read('public/terminal/index.html'),
      read('public/registry/technical/index.html'),
    ]);
    const appKeys = pages.map((page) => page.match(/<script defer src="(\/assets\/app\.js\?v=[^"]+)"><\/script>/u)?.[1]);
    expect(new Set(appKeys)).toEqual(new Set(['/assets/app.js?v=z10']));

    const cacheFor = (source) => headerMap(config.headers.find((rule) => rule.source === source)).get('Cache-Control');
    expect(cacheFor('/assets/app.js')).toBe('public, max-age=0, must-revalidate');
    expect(cacheFor('/assets/vendor/(.*)')).toBe('public, max-age=31536000, immutable');
    expect(cacheFor('/assets/astrofolio/v2/(.*)')).toBe('public, max-age=31536000, immutable');
    expect(cacheFor('/assets/og/v2/share-pastel-wheel-20260809.png')).toBe('public, max-age=31536000, immutable');
    // `.v1` identifies the archive schema, not immutable content; the file is
    // appended repeatedly and must continue to revalidate.
    expect(cacheFor('/assets/data/registry-market-history.v1.json')).toBe('public, max-age=0, must-revalidate');
  });

  it('keeps every static wing usable without 320px navigation overflow', async () => {
    const pagePaths = [
      'public/archive/index.html',
      'public/astrofolio/index.html',
      'public/registry/index.html',
      'public/registry/technical/index.html',
      'public/sdk/index.html',
      'public/terminal/index.html',
      'public/terminal/markets/index.html',
      'public/thesis/index.html',
    ];
    const pages = await Promise.all(pagePaths.map(read));

    for (const page of pages) {
      expect(page).toMatch(/\.wnav__search[^{}]*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/u);
      expect(page).toMatch(/\.wnav__burger[^{}]*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/u);
      expect(page).toContain('@media (max-width: 360px)');
      expect(page).not.toMatch(/\.wnav__(?:search|burger)[^{}]*\{[^}]*(?:width|height):\s*34px;/u);
    }

    const staticNavPages = await Promise.all([
      'public/archive/index.html',
      'public/registry/index.html',
      'public/sdk/index.html',
      'public/terminal/markets/index.html',
      'public/thesis/index.html',
    ].map(read));
    const app = await read('src/app.jsx');
    for (const page of staticNavPages) {
      expect(page).toContain('href="/today/">Today</a>');
    }
    expect(app).toContain('href="/today/">Today</a>');
  });

  it('keeps the how-to-buy pilot deliberately private from indexing and caches', async () => {
    const [config, guide, sitemap, decision] = await Promise.all([
      read('vercel.json').then(JSON.parse),
      read('src/pages/astrofolio/how-to-buy/index.astro'),
      read('src/pages/sitemap.xml.ts'),
      read('docs/REGISTRY-TRADE-OWNER-RISK-DECISION.md'),
    ]);
    const headers = headerMap(config.headers.find(({ source }) => source === '/astrofolio/how-to-buy/(.*)'));
    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(headers.get('X-Robots-Tag')).toBe('noindex, noarchive');
    expect(guide).toMatch(/<Base[\s\S]*?\bnoindex\b/u);
    expect(sitemap).not.toContain("loc: '/astrofolio/how-to-buy/");
    expect(decision).toContain('The guide begins as a `noindex`,');
    expect(decision).toContain('`no-store` pilot');
  });

  it('never relabels FDV as market cap and guards partial aggregates', async () => {
    const [app, galleryCard] = await Promise.all([
      read('src/app.jsx'),
      read('src/shelf/card.mjs'),
    ]);
    expect(app).not.toMatch(/marketCap\s*:\s*[^,\n]*\?\?[^,\n]*fdv/gu);
    expect(galleryCard).not.toMatch(/marketCap[^\n]*\?\?[^\n]*fdv/gu);
    expect(galleryCard).toContain("marketCell('Reported market cap', fmtCompact(pair.marketCap));");
    expect(app).toContain('const toNonNegativeNumber = (value) => {');
    expect(app).toContain('const indexedPools = new Map();');
    expect(app).toContain('Reported market cap subtotal');
    expect(app).toContain('marketCaps.length > 0');
    expect(app).toContain('missing values excluded');
    expect(app).toContain('each pool address');
  });

  it('keeps cusp OG and modification metadata consistent across page and sitemap', async () => {
    const [birthdayPage, sitemap] = await Promise.all([
      read('src/pages/birthday/[slug].astro'),
      read('src/pages/sitemap.xml.ts'),
    ]);
    expect(birthdayPage).toContain("? '/assets/og/v2/tool/birthday.png'");
    expect(birthdayPage).toContain('dateModified: pageModifiedAt');
    expect(sitemap).toContain('birthdayFacts.days[b.id]?.cusp');
    expect(sitemap).toContain('BIRTHDAY_CUSP_OG_MODIFIED_AT');
    expect(sitemap).not.toContain("['/terminal/research/', registryResearchPublication.generatedAt.slice(0, 10)]");
    expect(sitemap).toContain("['/terminal/research/', researchLastmod]");
  });

  it('dates materially revised evergreen schemas and sitemap entries together', async () => {
    const [sitemap, privacy, terms, about, learn, houses, glossary, thesis] = await Promise.all([
      read('src/pages/sitemap.xml.ts'),
      read('src/pages/privacy/index.astro'),
      read('src/pages/terms/index.astro'),
      read('src/pages/about/index.astro'),
      read('src/pages/learn/index.astro'),
      read('src/pages/learn/houses/index.astro'),
      read('src/pages/learn/glossary/index.astro'),
      read('public/thesis/index.html'),
    ]);
    expect(sitemap).toContain("const AUDIT_REMEDIATION_LASTMOD = '2026-08-23'");
    expect(sitemap).toContain("const LEGAL_IDENTITY_LASTMOD = '2026-08-29'");
    expect(sitemap).toContain("...['/', '/about/', '/privacy/', '/terms/'].map((loc) => [loc, LEGAL_IDENTITY_LASTMOD] as const)");
    // Revised on 2026-09-29 (the ΔT attribution, finding F-50); the sitemap's
    // DELTAT_ATTRIBUTION_LASTMOD carries that date for it.
    expect(terms).toContain("const modifiedAt = '2026-09-29T00:00:00.000Z'");
    // Revised on 2026-09-23 (the claims ledger's corrections), on 2026-09-28
    // (the privacy audit's fixes) and on 2026-09-29 (the share-image review);
    // the opaque calendar feed release then revised it on 2026-10-01.
    expect(privacy).toContain("const modifiedAt = '2026-10-01T00:00:00.000Z'");
    expect(sitemap).toContain("const CALENDAR_FEEDS_LASTMOD = '2026-10-01'");
    for (const page of [privacy, terms]) expect(page).toContain('dateModified: modifiedAt');
    expect(about).toContain("dateModified: '2026-09-28T00:00:00.000Z'");
    expect(sitemap).toContain("const ENGINE_PHASE1_LASTMOD = '2026-09-23'");
    expect(sitemap).toContain("const PRIVACY_AUDIT_LASTMOD = '2026-09-28'");
    expect(sitemap).toContain("const SHARE_IMAGE_REVIEW_LASTMOD = '2026-09-29'");
    expect(sitemap).toContain("const DELTAT_ATTRIBUTION_LASTMOD = '2026-09-29'");
    expect(sitemap).toContain("const DELTAT_ATTRIBUTION_ROUTES = ['/methodology/', '/terms/'] as const;");
    expect(sitemap).toContain("'/about/', '/ask/', '/birth-chart/someone-else/', '/methodology/', '/privacy/', '/tools/',");
    for (const [page, path, modified] of [
      [learn, '/learn/', '2026-09-05T00:00:00.000Z'],
      [houses, '/learn/houses/', '2026-08-23T00:00:00.000Z'],
    ]) {
      expect(page).toContain(`...editorialDates('${path}')`);
      expect(editorialDates(path)).toEqual({ dateModified: modified });
    }
    expect(sitemap).toContain('EDITORIAL_METADATA[loc]?.modified');
    expect(glossary).toContain("const PAGE_DATE = '2026-08-23'");
    expect(thesis).toContain('property="article:modified_time" content="2026-09-05"');
    expect(thesis).toContain('"dateModified": "2026-09-05"');
  });
});
