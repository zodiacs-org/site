import { readFileSync } from 'node:fs';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import TarotDraw, { formChoice } from './TarotDraw';

/** A form as the browser holds it: the checked radio's value and the reversals box. */
const form = (spread: string | null, reversals: boolean | null) => ({
  querySelector(selector: string) {
    if (selector === 'input[name="tarot-spread"]:checked') return spread === null ? null : { value: spread };
    if (selector === 'input[name="tarot-reversals"]') return reversals === null ? null : { checked: reversals };
    return null;
  },
});

describe('the tarot draw reads the form it is in', () => {
  it('takes the checked spread and the reversals box from the controls themselves', () => {
    expect(formChoice(form('celtic-cross', false))).toEqual({ spread: 'celtic-cross', reversals: false });
    expect(formChoice(form('one-card', true))).toEqual({ spread: 'one-card', reversals: true });
    // Nothing to read, or a value that is no spread: the state stands.
    expect(formChoice(null)).toBeNull();
    expect(formChoice(form(null, true))).toBeNull();
    expect(formChoice(form('seven-card', true))).toBeNull();
    expect(formChoice(form('three-card', null))).toBeNull();
  });

  it('names its controls so the form can be read, and keeps the button disabled until the island runs', () => {
    const markup = render(h(TarotDraw, {}));
    expect(markup.match(/<input type="radio" name="tarot-spread"/gu)).toHaveLength(3);
    expect(markup).toMatch(/<input type="checkbox" name="tarot-reversals"/u);
    // Without JavaScript the form cannot be sent, so no spread goes into a query.
    expect(markup).toMatch(/<button class="btn btn--primary calc__submit" type="submit" disabled/u);
  });

  it('draws from the controls at submit, and takes over a choice made before hydration', () => {
    const source = readFileSync(new URL('./TarotDraw.tsx', import.meta.url), 'utf8');
    const draw = source.slice(source.indexOf('function draw('));
    expect(draw.indexOf('formChoice(event.currentTarget as HTMLFormElement)')).toBeGreaterThan(0);
    expect(draw.indexOf('formChoice(event.currentTarget as HTMLFormElement)')).toBeLessThan(draw.indexOf('drawTarotReading('));
    expect(draw).toMatch(/drawTarotReading\(chosen\.spread, chosen\.reversals\)/u);
    expect(source).toMatch(/const chosen = formChoice\(formRef\.current\);\s*if \(chosen\) \{ setSpread\(chosen\.spread\); setReversals\(chosen\.reversals\); \}\s*setReady\(true\);/u);
  });
});

describe('the spread description keeps its height whichever spread is chosen', () => {
  it('renders every description in one cell, the chosen one shown and the others hidden from sight and from assistive technology', async () => {
    const { SPREADS, SPREAD_IDS } = await import('../lib/tarot/spreads');
    const markup = render(h(TarotDraw, {}));
    const cell = markup.match(/<div class="tarot__spread-help">([\s\S]*?)<\/div>/u)?.[1] ?? '';
    const paragraphs = [...cell.matchAll(/<p class="field__help"([^>]*)>([^<]*)<\/p>/gu)];
    expect(paragraphs.map((match) => match[2])).toEqual(SPREAD_IDS.map((id) => SPREADS[id].description.replaceAll("'", '&#39;').replaceAll('"', '&quot;')));
    const shown = paragraphs.filter((match) => /data-shown/u.test(match[1]));
    expect(shown).toHaveLength(1);
    expect(shown[0][2]).toBe(SPREADS['three-card'].description.replaceAll("'", '&#39;'));
    expect(shown[0][1]).not.toContain('aria-hidden');
    for (const match of paragraphs.filter((entry) => !/data-shown/u.test(entry[1]))) expect(match[1]).toContain('aria-hidden="true"');
  });

  it('stacks them in one grid cell and hides all but the chosen one, so the cell is as tall as the longest', () => {
    const css = readFileSync(new URL('../styles/tarot.css', import.meta.url), 'utf8');
    expect(css).toContain('.tarot__spread-help { display: grid; }');
    expect(css).toContain('.tarot__spread-help > .field__help { grid-area: 1 / 1; }');
    expect(css).toContain('.tarot__spread-help > .field__help:not([data-shown]) { visibility: hidden; }');
  });
});
