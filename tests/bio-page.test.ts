import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { SIGNS } from '../src/lib/signs';

const source = await readFile(new URL('../src/pages/bio/index.astro', import.meta.url), 'utf8');

describe('/bio/ link contract', () => {
  it('keeps the two primary destinations', () => {
    expect(source).toContain("href: '/birth-chart/'");
    expect(source).toContain("href: '/astrofolio/'");
    expect(source).not.toContain("href: '/horoscopes/'");
    expect(source).toContain('Daily horoscopes');
    expect(source).toContain('Choose your sign');
    expect(source).toContain('editionDate={publication.date}');
    expect(source).toContain('<EditionText current="today’s" editionDate={publication.date} />');
  });

  it('builds one daily horoscope link for every canonical sign', () => {
    expect(SIGNS).toHaveLength(12);
    expect(source).toContain('SIGNS.map((sign)');
    expect(source).toContain('class="tile bio-sign"');
    expect(source).toContain('href={`/horoscopes/${sign.slug}/`}');
  });

  it('focuses the canonical shared shell without creating a second chrome system', () => {
    expect(source).toContain('<Base\n  noindex\n  analyticsOnNoindex');
    expect(source).not.toContain('minimalChrome');
    expect(source).not.toContain(':global(body:has(.bio-shell) .nav)');
    expect(source).not.toContain(':global(body:has(.bio-shell) .nav__chip)');
    expect(source).toContain(':global(body:has(.bio-shell) .zguide-launcher)');
    expect(source).toContain(':global(body:has(.bio-shell) .zfooter__directory)');
    expect(source).toContain('background: var(--text);');
  });

  it('keeps sharing local and bounds analytics', () => {
    expect(source).toContain('data-bio-share');
    expect(source).toContain('navigator.share');
    expect(source).toContain('navigator.clipboard.writeText(url)');
    expect(source).toContain('document.querySelector(\'link[rel="canonical"]\')');
    expect(source).toContain("window.zodiacsAnalytics.track('bio_click'");
    expect(source).not.toMatch(/https?:\/\//u);
  });
});
