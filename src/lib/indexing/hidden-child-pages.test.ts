import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  HIDDEN_ALMANAC_SLUGS, HIDDEN_BABY_ZODIAC_PATHS, HIDDEN_CHILD_PAGE_PATHS, isHiddenAlmanacSlug, isHiddenChildPage,
} from '../../data/hidden-child-pages.mjs';
import { HIDDEN_OCCASION_KINDS, PICKER_OCCASION_KINDS, isHiddenOccasion } from '../occasions/picker';
import { TOOLS_HUB } from '../nav-tools';

/**
 * The baby and coming-of-age pages and occasions, hidden on 12 November 2026 (#985, owner's decision): nothing on
 * the site is aimed at or about children in navigation, sitemaps or internal links. The pages stay built, marked
 * noindex and nofollow. #985 shipped without a test of its own; this one fails if a hidden page loses its noindex
 * or nofollow, comes back into the picker, the tools hub, llms.txt or the assistant's site guide, or gains a link
 * from another page.
 */
const repo = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(repo, path), 'utf8');

/** The opening <Base ...> tag of an Astro page. */
function baseTag(source: string): string {
  const start = source.indexOf('<Base');
  expect(start, 'page has a <Base> tag').toBeGreaterThan(-1);
  return source.slice(start, source.indexOf('>', start));
}

function filesUnder(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(repo, dir))) {
    const path = join(dir, name);
    if (statSync(join(repo, path)).isDirectory()) filesUnder(path, out);
    else if (/\.(?:astro|tsx|mdx|md)$/u.test(name) && !/\.test\./u.test(name)) out.push(path);
  }
  return out;
}

describe('hidden child pages', () => {
  it('lists the six baby zodiac pages, the baby shower card and the child\'s chart article', () => {
    expect([...HIDDEN_CHILD_PAGE_PATHS].sort()).toEqual([
      '/almanac/reading-a-childs-chart/', '/baby-zodiac/', '/es/baby-zodiac/', '/fr/baby-zodiac/', '/it/baby-zodiac/',
      '/occasions/baby-shower/', '/pt/baby-zodiac/', '/ru/baby-zodiac/',
    ]);
    for (const path of HIDDEN_CHILD_PAGE_PATHS) expect(isHiddenChildPage(path), path).toBe(true);
    expect(isHiddenChildPage('/birth-chart/')).toBe(false);
  });

  it('marks every hidden page noindex and nofollow on its own page', () => {
    for (const path of [...HIDDEN_BABY_ZODIAC_PATHS, '/occasions/baby-shower/']) {
      const tag = baseTag(read(`src/pages${path}index.astro`));
      expect(tag, path).toMatch(/\n\s*noindex\n/u);
      expect(tag, path).toMatch(/\n\s*nofollow\n/u);
      expect(tag, path).toContain(`path="${path}"`);
    }
    const article = baseTag(read('src/pages/almanac/[slug].astro'));
    expect(article).toContain('noindex={hidden}');
    expect(article).toContain('nofollow={hidden}');
    expect(read('src/pages/almanac/[slug].astro')).toContain('const hidden = isHiddenAlmanacSlug(slug);');
    for (const slug of HIDDEN_ALMANAC_SLUGS) {
      expect(isHiddenAlmanacSlug(slug)).toBe(true);
      expect(() => read(`src/content/almanac/${slug}.mdx`), slug).not.toThrow();
    }
  });

  it('keeps a new baby and a coming of age out of the occasions picker', () => {
    expect([...HIDDEN_OCCASION_KINDS].sort()).toEqual(['baby', 'coming-of-age']);
    expect(PICKER_OCCASION_KINDS).not.toContain('baby');
    expect(PICKER_OCCASION_KINDS).not.toContain('coming-of-age');
    expect(isHiddenOccasion('baby')).toBe(true);
    expect(isHiddenOccasion('coming-of-age')).toBe(true);
    expect(isHiddenOccasion('wedding')).toBe(false);
    expect(read('src/islands/OccasionSky.tsx')).not.toMatch(/\bOCCASION_KINDS\.map\b/u);
  });

  it('leaves them out of the tools hub, llms.txt, llms-full.txt and the assistant\'s site guide', () => {
    expect(read('src/pages/tools/index.astro')).toContain('const hubTools = TOOLS_HUB.filter((tool) => !isHiddenChildPage(tool.href));');
    expect(TOOLS_HUB.filter((tool) => !isHiddenChildPage(tool.href)).map((tool) => tool.href)).not.toContain('/baby-zodiac/');
    for (const file of ['public/llms.txt', 'public/llms-full.txt', 'api/_assistant/context.ts']) {
      const text = read(file);
      for (const path of HIDDEN_CHILD_PAGE_PATHS) {
        expect(text, `${file} ${path}`).not.toContain(`zodiacs.org${path}`);
        expect(text, `${file} ${path}`).not.toContain(`- ${path} `);
      }
    }
  });

  it('gains no link from any other page, island or article', () => {
    const own = new Set([
      ...[...HIDDEN_BABY_ZODIAC_PATHS, '/occasions/baby-shower/'].map((path) => `src/pages${path}index.astro`),
      ...HIDDEN_ALMANAC_SLUGS.map((slug) => `src/content/almanac/${slug}.mdx`),
      // Islands only the hidden pages load, checked below.
      'src/islands/BabyShowerSky.tsx', 'src/islands/BabyZodiac.tsx',
    ]);
    const offenders: string[] = [];
    for (const file of [...filesUnder('src/pages'), ...filesUnder('src/components'), ...filesUnder('src/islands'), ...filesUnder('src/content'), ...filesUnder('src/layouts')]) {
      const path = relative(repo, join(repo, file)).split('\\').join('/');
      if (own.has(path)) continue;
      const text = read(path);
      for (const hidden of HIDDEN_CHILD_PAGE_PATHS) {
        const quoted = hidden.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
        if (new RegExp(`href=["'{\`]*(?:https://zodiacs\\.org)?${quoted}|\\]\\((?:https://zodiacs\\.org)?${quoted}`, 'u').test(text)) offenders.push(`${path} -> ${hidden}`);
      }
    }
    expect(offenders).toEqual([]);
    // The islands let through above stay on hidden pages only.
    const users = filesUnder('src/pages').filter((file) => /islands\/(?:BabyShowerSky|BabyZodiac)(?:\.tsx)?['"]/u.test(read(file)));
    for (const file of users) expect(own.has(file.split('\\').join('/')), file).toBe(true);
    expect(users.length).toBeGreaterThan(0);
  });
});
