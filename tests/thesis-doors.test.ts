import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

// ZOD-43: the two doors into /thesis/ and the one count behind them.
const fomo = await readFile(new URL('../src/pages/fomo/index.astro', import.meta.url), 'utf8');
const thesis = await readFile(new URL('../public/thesis/index.html', import.meta.url), 'utf8');

const FOMO_LINE = 'Not sure about memecoins? Read the case for these twelve, and the case against.';

describe('thesis doors (ZOD-43)', () => {
  it('adds the Fomo line once, in English, as a plain link to the thesis', () => {
    expect(fomo.split(FOMO_LINE)).toHaveLength(2);
    expect(fomo).toContain(`<a href="/thesis/" data-thesis-door="fomo">${FOMO_LINE} <span aria-hidden="true">→</span></a>`);
    expect(fomo).not.toMatch(/data-thesis-door="fomo"[^>]*class="fomo-cta/u);
  });

  it('counts the Fomo door with the fixed source and nothing else', () => {
    expect(fomo).toContain("window.zodiacsAnalytics.track('thesis_click', { source: 'fomo' });");
    expect(fomo).toContain("if (!link || !window.zodiacsAnalytics) return;");
    expect(fomo).not.toMatch(/preventDefault\(\)[\s\S]{0,200}thesis_click/u);
  });

  it('adds no dash to the new copy', () => {
    expect(FOMO_LINE).not.toMatch(/[–—]/u);
  });

  it('leaves the thesis page itself without any analytics call', () => {
    expect(thesis).not.toContain('thesis_click');
    expect(thesis).not.toContain('zodiacsAnalytics.track');
  });
});
