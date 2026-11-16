import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { VedicPlacements } from './VedicSigns';
import { computeVedicSigns } from '../lib/vedic-signs/compute';
import { vedicReading } from '../lib/vedic-signs/reading';

const TITLES = ['Moon sign (rashi)', 'Moon nakshatra (lunar mansion)', 'Sun (soul and self)', 'Rising sign (lagna)'];

/** Where each card's title sits in the markup, in TITLES order. */
const positions = (markup: string) => TITLES.map((title) => markup.indexOf(`<p class="vedic__body">${title}</p>`));

describe('the /vedic-signs/ result (ZOD-18)', () => {
  it('leads with the Moon sign and nakshatra, then the Sun, then the rising sign', () => {
    const reading = computeVedicSigns({ birthUtc: new Date('2000-01-01T12:00:00Z'), timeKnown: true, latitude: 28.61, longitude: 77.21, ayanamsa: 'lahiri' });
    const markup = render(h(VedicPlacements, { result: reading }));
    const at = positions(markup);
    expect(at.every((index) => index >= 0), markup).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    // The Moon pair is its own group, ahead of the Sun and the lagna.
    expect(markup.indexOf('data-vedic-moon')).toBeLessThan(at[0]);
    expect(markup.indexOf('class="vedic__grid"')).toBeGreaterThan(at[1]);
    expect(markup).toContain('Pada');
  });

  it('keeps that order without a birth time, with no degree and no pada', () => {
    const moment = (moonLon: number, pada: 1 | 2 | 3 | 4) => ({ ayanamsa: 24, sun: { lon: 100, tropical: 124 }, moon: { lon: moonLon, tropical: moonLon + 24 }, rising: null, nakshatra: { index: 14, pada, lord: 'Rahu' } });
    const reading = vedicReading({ timeKnown: false, placed: false, ayanamsa: 'lahiri', at: moment(193, 2), ends: [moment(188, 1), moment(198, 4)] });
    const markup = render(h(VedicPlacements, { result: reading }));
    const at = positions(markup);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(markup).not.toContain('<dt>Pada</dt>');
    expect(markup).not.toMatch(/\d+°\d{2}′/u);
    expect(markup).toContain('The rising sign needs the birth time');
  });

  it('keeps that order when an untimed day leaves the Moon open, listing the candidates in their forward run', () => {
    const moment = (moonLon: number, index: number) => ({ ayanamsa: 24, sun: { lon: 100, tropical: 124 }, moon: { lon: moonLon, tropical: moonLon + 24 }, rising: null, nakshatra: { index, pada: 1 as const, lord: 'Mars' } });
    const reading = vedicReading({ timeKnown: false, placed: false, ayanamsa: 'lahiri', at: moment(5, 0), ends: [moment(358, 26), moment(15, 1)] });
    const markup = render(h(VedicPlacements, { result: reading }));
    const at = positions(markup);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(markup).toContain('The Moon changed nakshatra that day: Revati, Ashwini or Bharani. A birth time settles it.');
  });
});
