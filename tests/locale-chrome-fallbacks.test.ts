import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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
  const localeRule = config.rewrites.find((rule: { destination: string }) => rule.destination === '/:locale/404/');
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
