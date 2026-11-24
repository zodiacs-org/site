import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import VedicSigns, { VedicPlacements, formatDegrees } from './VedicSigns';
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

describe('the /vedic-signs/ form', () => {
  const SOURCE = readFileSync(new URL('./VedicSigns.tsx', import.meta.url), 'utf8');
  const input = (markup: string, id: string) => markup.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`, 'u'))?.[0] ?? '';

  it('opens with the birth time and birthplace locked, and no birthplace search to send a city lookup', () => {
    const markup = render(h(VedicSigns, {}));
    expect(input(markup, 'vedic-time')).toMatch(/\sdisabled/u);
    expect(input(markup, 'vedic-place')).toMatch(/\sdisabled/u);
    expect(markup).not.toContain('role="combobox"');
  });

  it('asks for the time and birthplace only through the gated fields, opened by the converted date', () => {
    expect(SOURCE).not.toMatch(/<BirthFields\b/u);
    expect(SOURCE).toMatch(/useBirthDateCheck\(date, calendar, vedicFormRefusal\)/u);
    expect(SOURCE).toMatch(/const ready = birthDateOpen\(check\) && city !== null/u);
  });

  it('gives a skipped birth time its own sentence, and logs nothing', () => {
    expect(SOURCE).toMatch(/cause instanceof SkippedBirthTimeError \? SKIPPED_BIRTH_TIME/u);
    // A birth date the clock skipped whole gets its own sentence too, not the general one.
    expect(SOURCE).toMatch(/cause instanceof SkippedBirthDateError \? SKIPPED_BIRTH_DATE : calculationError\(/u);
    expect(SOURCE).not.toMatch(/console\./u);
  });

  it('prints whole arcminutes without losing one to binary rounding', () => {
    expect(formatDegrees(2.15)).toBe('2°09′');
    expect(formatDegrees(16.52)).toBe('16°31′');
    expect(formatDegrees(0.29)).toBe('0°17′');
    expect(formatDegrees(29.99)).toBe('29°59′');
    expect(formatDegrees(0)).toBe('0°00′');
    expect(formatDegrees(10.016)).toBe('10°00′');
    for (let hundredths = 0; hundredths < 3000; hundredths += 1) {
      const value = hundredths / 100;
      const minutes = Math.floor((hundredths * 60) / 100);
      expect(formatDegrees(value), String(value)).toBe(`${Math.floor(minutes / 60)}°${String(minutes % 60).padStart(2, '0')}′`);
    }
  });
});

describe('the personal pages drive on this branch', () => {
  const drive = readFileSync(new URL('../../tests/personal-pages-drive.mjs', import.meta.url), 'utf8');
  const workflow = readFileSync(new URL('../../.github/workflows/site-check.yml', import.meta.url), 'utf8');
  it('drives Vedic signs, its age gate and share link, and runs in the flag-on job', () => {
    expect(drive).toContain("path: '/vedic-signs/'");
    expect(drive).toContain("check('an under-13 date locks the birth time'");
    const job = workflow.slice(workflow.indexOf('  vedic-signs-flag-on:'));
    expect(job.slice(0, job.indexOf('\n  good-days-drive:'))).toContain('run: node tests/personal-pages-drive.mjs');
  });
});
