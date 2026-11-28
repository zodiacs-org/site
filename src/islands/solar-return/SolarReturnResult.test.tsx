import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { bodyLongitude } from '../../lib/engine/full';
import { UI } from '../../lib/i18n';
import { computeSolarReturn, prepareLocalTime, type SolarReturnResultData } from './compute';
import { SolarReturnResult } from './SolarReturnResult';

const KAHLO_BIRTH = new Date('1907-07-06T15:06:36Z');
const Wheel = () => null;
const markupOf = (result: SolarReturnResultData) => render(h(SolarReturnResult, { result, Wheel }));
const receiptOf = (markup: string) => markup.match(/<aside class="chart-trust" data-check-our-math[^>]*>[\s\S]*?<\/aside>/)?.[0] ?? '';
// A clock time in any form the result could print it: an ISO instant or the details' "HH:MM:SS".
const CLOCK = /T\d\d:\d\d|\d\d:\d\d:\d\d/;

beforeAll(() => { vi.stubGlobal('location', new URL('https://zodiacs.org/solar-return/')); });
afterAll(() => { vi.unstubAllGlobals(); });

describe('solar return result receipts', () => {
  const untimed = () => computeSolarReturn({
    birthDate: '1907-07-06', birthTime: null, timeKnown: false, birthplace: null,
    savedSunLon: null, houseSystem: 'whole', castLocation: null, year: 2026,
  });

  it('shows a UTC date and never a clock time for a birth without a time', () => {
    const result = untimed();
    const date = result.chart.input.utc.toISOString().slice(0, 10);
    const markup = markupOf(result);
    const receipt = receiptOf(markup);
    expect(receipt).toContain('data-instant-basis="approximate-return"');
    expect(receipt).toContain(UI.en.trustApproxReturn);
    expect(receipt).toContain(`<time class="mono" datetime="${date}">${date}</time>`);
    expect(markup).toContain(`UTC date · ${date}`);
    expect(markup).not.toMatch(CLOCK);
    expect(markup).not.toContain(result.chart.input.utc.toISOString());
  });

  it('keeps an untimed return one minute before UTC midnight on its own date', () => {
    // The instant Codex saw printed on /solar-return/ with every launch flag off.
    const result = untimed();
    const late = { ...result, chart: { ...result.chart, input: { ...result.chart.input, utc: new Date('2026-09-27T23:59:51.003Z') } } };
    const markup = markupOf(late);
    expect(receiptOf(markup)).toContain('<time class="mono" datetime="2026-09-27">2026-09-27</time>');
    expect(markup).not.toMatch(CLOCK);
    expect(markup).not.toContain('23:59');
    expect(markup).not.toContain('T00:00');
  });

  it('still shows the exact unrounded instant for a timed return', () => {
    const result = computeSolarReturn({
      birthDate: '1907-07-06', birthTime: null, timeKnown: true, birthplace: null,
      savedSunLon: bodyLongitude('Sun', KAHLO_BIRTH), houseSystem: 'whole', castLocation: null, year: 2026,
    });
    const instant = result.chart.input.utc.toISOString();
    const receipt = receiptOf(markupOf(result));
    expect(receipt).toContain('data-instant-basis="return"');
    expect(receipt).toContain(UI.en.trustReturnInstant);
    expect(receipt).toContain(`<time class="mono" datetime="${instant}">${instant}</time>`);
  });

  it('softens 5th-house romance wording for an under-18 birth date without repeating words', () => {
    const base = computeSolarReturn({
      birthDate: '2010-03-01', birthTime: null, timeKnown: true, birthplace: null,
      savedSunLon: bodyLongitude('Sun', new Date('2010-03-01T12:00:00Z')), houseSystem: 'whole',
      castLocation: { name: 'Madrid', lat: 40.42, lon: -3.7, tz: 'Europe/Madrid' }, year: 2028,
    }, new Date('2028-02-29T12:00:00Z'));
    expect(base.under18).toBe(true);
    const markup = markupOf(base);
    expect(markup).not.toMatch(/\b(?:romance|romantic|play,\s*play)\b/iu);
  });

  it('explains why a polar solar return omits houses instead of asking for birth time and place', async () => {
    await prepareLocalTime('1990-05-03', 'UTC');
    const pole = computeSolarReturn({
      birthDate: '1990-05-03', birthTime: '08:30', timeKnown: true,
      birthplace: { name: 'North Pole', lat: 90, lon: 0, tz: 'UTC' },
      savedSunLon: bodyLongitude('Sun', new Date('1990-05-03T08:30:00Z')), houseSystem: 'whole',
      castLocation: { name: 'North Pole', lat: 90, lon: 0, tz: 'UTC' }, year: 2026,
    });
    const markup = render(h(SolarReturnResult, { result: pole, Wheel, themes: true }));
    expect(markup).toContain('data-pole-notice');
    expect(markup).toContain('undefined at a geographic pole');
    expect(markup).not.toContain('A birth time and place make it yours.');
  });

  it('displays the repeated-time notice when a DST-fold birth time was used', () => {
    const fold = {
      ...computeSolarReturn({
        birthDate: '1990-05-03', birthTime: null, timeKnown: true, birthplace: null,
        savedSunLon: bodyLongitude('Sun', new Date('1990-05-03T08:30:00Z')), houseSystem: 'whole',
        castLocation: null, year: 2026,
      }),
      clockLimit: 'The birthplace clock showed that birth time twice that day, when the clocks went back. This reading uses the first of the two.',
    };
    const markup = markupOf(fold);
    expect(markup).toContain('data-clock-notice');
    expect(markup).toContain('first of the two');
  });
});
