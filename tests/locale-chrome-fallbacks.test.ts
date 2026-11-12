import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import compatibilityHandler from '../api/compatibility.js';
import {
  clearLocaleNotFoundCache,
  LOCALE_NOT_FOUND_ROUTE_KEY,
  NOT_FOUND_FETCH_HEADER,
  NOT_FOUND_LOCALES,
} from '../src/server/locale-not-found';
import { CATALOG_LOCALES, SECTION_LOCALES } from '../src/lib/i18n/core';
import { sourcePattern } from '../scripts/lib/vercel-source-pattern.mjs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('mobile navigation landmark label', () => {
  const nav = read('src/components/SiteNav.astro');
  const table = nav.match(/const mobileNavLabel: ([^=]+)= \{([\s\S]*?)\};/u);

  it('is a full table over every page locale, with no English fallback', () => {
    expect(table, 'mobileNavLabel table').not.toBeNull();
    expect(table![1].trim()).toBe('Record<Locale, string>');
    expect(nav).toContain('aria-label={mobileNavLabel[locale]}');
    expect(nav).not.toMatch(/mobileNavLabel\[locale\]\s*\?\?/u);
  });

  it('names the landmark in each live locale rather than in English', () => {
    const entries = new Map(
      [...table![2].matchAll(/(?:'([a-z-]+)'|([a-z]+)):\s*'([^']+)'/gu)].map((m) => [m[1] ?? m[2], m[3]]),
    );
    for (const locale of [...CATALOG_LOCALES, ...SECTION_LOCALES]) {
      const label = entries.get(locale);
      expect(label, locale).toBeTruthy();
      if (locale !== 'en') expect(label, locale).not.toBe(entries.get('en'));
    }
  });
});

describe('localized 404 for unknown paths under a locale prefix', () => {
  const config = JSON.parse(read('vercel.json'));
  const destination = `/api/compatibility?${LOCALE_NOT_FOUND_ROUTE_KEY}=:locale`;
  const localeRule = config.rewrites.find((rule: { destination: string }) => rule.destination === destination);
  const pageLocales = readdirSync(new URL('../src/pages/', import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(new URL(`../src/pages/${entry.name}/404.astro`, import.meta.url)))
    .map((entry) => entry.name)
    .sort();

  it('rewrites exactly the locales that have their own 404 page, as the last rewrite', () => {
    expect(localeRule).toBeTruthy();
    // Rewrites run after the filesystem, so every built page still wins; last
    // keeps every specific rewrite ahead of this catch-all.
    expect(config.rewrites.at(-1)).toBe(localeRule);
    // `(.*)`, not `:path*`: Vercel compiles sources strictly, and `:path*`
    // never matches a path with a trailing slash, which every page here has.
    const listed = localeRule.source.match(/^\/:locale\(([a-z|]+)\)\/\(\.\*\)$/u)?.[1].split('|').sort();
    expect(listed).toEqual(pageLocales);
    expect([...NOT_FOUND_LOCALES].sort()).toEqual(pageLocales);
  });

  it('never rewrites a miss straight to a built 404 page, which would answer 200', () => {
    // A rewrite keeps the destination's status, and /es/404/ and the rest are
    // ordinary built pages: rewriting to one makes every miss a soft 404.
    for (const rule of config.rewrites as Array<{ source: string; destination: string }>) {
      expect(rule.destination, rule.source).not.toMatch(/(?:^|\/)404(?:\/|\.html)?$/u);
    }
  });

  it('matches paths under those prefixes only', () => {
    const pattern = sourcePattern(localeRule.source);
    for (const locale of pageLocales) {
      for (const path of [`/${locale}/no-such-page/`, `/${locale}/a/b/c`, `/${locale}/today/`]) {
        expect(pattern.test(path), path).toBe(true);
      }
    }
    for (const path of ['/no-such-page/', '/espanol/x/', '/es-x/', '/ar/birth-chart/', '/zh-hans/x/', '/api/v1/chart']) {
      expect(pattern.test(path), path).toBe(false);
    }
  });

  it('sends no locale path through a redirect first', () => {
    for (const locale of pageLocales) {
      const path = `/${locale}/no-such-page-audit/`;
      const redirected = config.redirects.filter((rule: { source: string; has?: unknown }) => !rule.has && sourcePattern(rule.source).test(path));
      expect(redirected, path).toEqual([]);
    }
  });
});

describe('localized 404 response', () => {
  const pageHtml = (locale: string) => `<!doctype html><html lang="${locale}"><head><meta name="robots" content="noindex, follow"></head><body>404 ${locale}</body></html>`;

  function recorder() {
    return {
      statusCode: 200,
      headers: new Map<string, string>(),
      body: undefined as string | undefined,
      setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); },
      end(body?: string) { this.body = body; },
    };
  }

  function request(query: Record<string, unknown>, headers: Record<string, string> = {}, method = 'GET') {
    return { method, query, headers: { host: 'zodiacs.org', ...headers } };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    clearLocaleNotFoundCache();
  });

  it.each(NOT_FOUND_LOCALES)('answers 404, not 200, with the %s page and noindex', async (locale) => {
    const fetchMock = vi.fn(async (url: string) => new Response(pageHtml(locale), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = recorder();
    await compatibilityHandler(request({ [LOCALE_NOT_FOUND_ROUTE_KEY]: locale }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain(`lang="${locale}"`);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('x-robots-tag')).toMatch(/^noindex\b/u);
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://zodiacs.org/${locale}/404/`);
  });

  it('takes the route before any other dispatcher, whatever the missing URL carried', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(pageHtml('es'), { status: 200 })));
    const res = recorder();
    await compatibilityHandler(request({ [LOCALE_NOT_FOUND_ROUTE_KEY]: 'es', __zodiacs_ai: 'consent', action: 'invites' }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('lang="es"');
  });

  it('still answers 404 when the locale page cannot be read', async () => {
    for (const failure of [
      async () => new Response('missing', { status: 404 }),
      async () => { throw new Error('offline'); },
    ]) {
      vi.stubGlobal('fetch', vi.fn(failure));
      const res = recorder();
      await compatibilityHandler(request({ [LOCALE_NOT_FOUND_ROUTE_KEY]: 'es' }), res);
      expect(res.statusCode).toBe(404);
      expect(res.headers.get('x-robots-tag')).toMatch(/^noindex\b/u);
    }
  });

  it('fetches from the canonical host when the request names an untrusted one', async () => {
    const fetchMock = vi.fn(async () => new Response(pageHtml('fr'), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = recorder();
    await compatibilityHandler(request({ [LOCALE_NOT_FOUND_ROUTE_KEY]: 'fr' }, { host: 'evil.example' }), res);
    expect(fetchMock.mock.calls[0][0]).toBe('https://zodiacs.org/fr/404/');
  });

  it('does not fetch again for its own request, an unknown locale, or a HEAD body', async () => {
    const fetchMock = vi.fn(async () => new Response(pageHtml('it'), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const looped = recorder();
    await compatibilityHandler(request({ [LOCALE_NOT_FOUND_ROUTE_KEY]: 'it' }, { [NOT_FOUND_FETCH_HEADER]: '1' }), looped);
    const unknown = recorder();
    await compatibilityHandler(request({ [LOCALE_NOT_FOUND_ROUTE_KEY]: 'de' }), unknown);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(looped.statusCode).toBe(404);
    expect(unknown.statusCode).toBe(404);
    const head = recorder();
    await compatibilityHandler(request({ [LOCALE_NOT_FOUND_ROUTE_KEY]: 'it' }, {}, 'HEAD'), head);
    expect(head.statusCode).toBe(404);
    expect(head.body).toBeUndefined();
  });
});
