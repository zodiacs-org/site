import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The good day finder takes an optional birth date. On the site it is used on the device for one search and kept
 * only in the island's memory: never written to storage, the address bar or analytics, and never sent anywhere.
 * These checks read the sources that handle it, so a later change that starts keeping or sending it fails here.
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const SOURCES = {
  island: read('../../islands/GoodDayFinder.tsx'),
  find: read('./find.ts'),
  personal: read('./personal.ts'),
  goals: read('./goals.ts'),
  feature: read('../../ai-tools/features/good-days.ts'),
};
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

describe('the good day finder keeps birth details to the one request', () => {
  it('never stores, logs, sends or links what it is given', () => {
    for (const [name, text] of Object.entries(SOURCES)) {
      const source = code(text);
      for (const pattern of [/localStorage/u, /sessionStorage/u, /indexedDB/u, /document\.cookie/u, /history\.(?:push|replace)State/u, /location\.(?:hash|search|href)\s*=/u,
        /\bfetch\(/u, /sendBeacon/u, /XMLHttpRequest/u, /console\./u, /\btrack\w*\(/u, /plausible|gtag|posthog|analytics/iu, /URLSearchParams/u]) {
        expect(source, `${name}: ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('asks the site page for a birth date only, never a name, time or place', () => {
    const island = code(SOURCES.island);
    expect(island).toContain('type="date"');
    expect(island).not.toMatch(/type="(?:text|time)"/u);
    expect(island).not.toMatch(/PlaceSearch|latitude|longitude/u);
    // The field will not take a date less than 13 years ago, and the finder refuses one anyway.
    expect(island).toContain('max={thirteenYearsAgo(today)}');
  });

  it('keeps consumer copy free of en and em dashes', () => {
    for (const [name, text] of Object.entries(SOURCES)) expect(text, name).not.toMatch(/[–—]/u);
    expect(read('../../pages/good-days/index.astro')).not.toMatch(/[–—]/u);
  });
});
