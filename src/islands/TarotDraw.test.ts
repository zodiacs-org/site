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
