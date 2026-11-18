import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { bodyLongitude } from '../../lib/engine/full';
import { UI } from '../../lib/i18n';
import { computeSolarReturn, type SolarReturnResultData } from './compute';
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
});
