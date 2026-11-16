import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

// ZOD-43: the two doors into /thesis/ and the one count behind them.
const astrofolio = await readFile(new URL('../public/astrofolio/index.html', import.meta.url), 'utf8');
const fomo = await readFile(new URL('../src/pages/fomo/index.astro', import.meta.url), 'utf8');
const thesis = await readFile(new URL('../public/thesis/index.html', import.meta.url), 'utf8');

const FOMO_LINE = 'Not sure about memecoins? Read the case for these twelve, and the case against.';

describe('thesis doors (ZOD-43)', () => {
  it('names what the first Astrofolio link leads to and keeps the second as it was', () => {
    expect(astrofolio).toContain(
      'and keep. <a href="/thesis/">How is this different from other memecoins? <span aria-hidden="true">→</span></a></p>',
    );
    expect(astrofolio.match(/How is this different from other memecoins\?/gu)).toHaveLength(1);
    expect(astrofolio).toContain('<strong id="static-story-title">The story behind the collection</strong>');
    expect(astrofolio).toMatch(/static-story-title[\s\S]{0,400}<b><span>Read the story<\/span>/u);
  });

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
    expect('How is this different from other memecoins?').not.toMatch(/[–—]/u);
  });

  it('leaves the thesis page itself without any analytics call', () => {
    expect(thesis).not.toContain('thesis_click');
    expect(thesis).not.toContain('zodiacsAnalytics.track');
  });
});
