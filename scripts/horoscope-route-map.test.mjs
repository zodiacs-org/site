import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');

const routeFamilies = [
  { key: 'daily', suffix: '', file: 'src/pages/horoscopes/[sign]/index.astro', surface: 'today' },
  { key: 'tomorrow', suffix: 'tomorrow', file: 'src/pages/horoscopes/[sign]/tomorrow/index.astro', surface: 'tomorrow' },
  { key: 'weekly', suffix: 'weekly', file: 'src/pages/horoscopes/[sign]/weekly/index.astro', surface: 'weekly' },
  { key: 'monthly', suffix: 'monthly', file: 'src/pages/horoscopes/[sign]/monthly/index.astro', surface: 'monthly' },
  { key: 'love', suffix: 'love', file: 'src/pages/horoscopes/[sign]/love/index.astro', surface: 'love' },
  { key: 'career', suffix: 'career', file: 'src/pages/horoscopes/[sign]/career/index.astro', surface: 'career' },
  { key: 'year2026', suffix: '2026', file: 'src/pages/horoscopes/[sign]/2026/index.astro', surface: 'year2026' },
  { key: 'year', suffix: '2027', file: 'src/pages/horoscopes/[sign]/2027/index.astro', surface: 'year' },
];

async function canonicalSignSlugs() {
  const source = await read('src/lib/signs.ts');
  const table = source.slice(
    source.indexOf('export const SIGNS'),
    source.indexOf('export const SIGN_SLUGS'),
  );
  return [...table.matchAll(/\{ slug: '([a-z]+)'/g)].map((match) => match[1]);
}

describe('Phase 1 horoscope URL contract', () => {
  it('maps eight canonical families across all twelve source signs', async () => {
    const signs = await canonicalSignSlugs();
    expect(signs).toHaveLength(12);
    expect(new Set(signs).size).toBe(12);

    const urls = signs.flatMap((sign) => routeFamilies.map(({ suffix }) => (
      `/horoscopes/${sign}/${suffix ? `${suffix}/` : ''}`
    )));

    expect(urls).toHaveLength(96);
    expect(new Set(urls).size).toBe(96);
    const phaseOneRoutes = ['/horoscopes/', ...urls];
    expect(phaseOneRoutes).toHaveLength(97);
    expect(new Set(phaseOneRoutes).size).toBe(97);
    expect(urls).toContain('/horoscopes/aries/');
    expect(urls).toContain('/horoscopes/aries/tomorrow/');
    expect(urls).toContain('/horoscopes/libra/love/');
    expect(urls).toContain('/horoscopes/capricorn/career/');
    expect(urls).toContain('/horoscopes/pisces/2026/');
    expect(urls).toContain('/horoscopes/pisces/2027/');
  });

  it.each(routeFamilies)('$key family is statically generated from canonical source', async ({ file, surface }) => {
    const source = await read(file);
    expect(source).toContain('getStaticPaths');
    expect(source).toMatch(/SIGN(?:S|_SLUGS)/);
    if (surface) {
      expect(source).toContain("HoroscopeProgramPage");
      expect(source).toContain(`surface="${surface}"`);
      expect(source).toContain('reading={reading}');
    }
  });

  it('keeps one SSR renderer boundary for all eight surface families', async () => {
    const source = await read('src/components/HoroscopeProgramPage.astro');
    for (const surface of ['today', 'tomorrow', 'weekly', 'monthly', 'love', 'career', 'year', 'year2026']) {
      expect(source).toContain(`${surface}: {`);
    }
    expect(source).toContain('reading: HoroscopeProgramPageReading');
    expect(source).toContain("Astro.slots.has('editorial')");
    expect(source).toContain("Astro.slots.has('enhancement')");
    expect(source).toContain('class="program__sky"');
    expect(source).toContain('rssFeed={{');
    expect(source).toContain('prefers-reduced-motion: reduce');
    expect(source).not.toContain('client:');
  });
});
