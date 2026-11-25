/**
 * get_retrograde_for_me reads the natal side on the page's ephemeris (./page-ephemeris.ts), so a birth near a cusp
 * gets the same Sun sign, houses and share card from the hosted tool as from /retrogrades/for-you/ in the browser.
 *
 * The browser bundle computes on astronomy-engine: scripts/lib/browser-engine.mjs rewrites the engine's default at
 * bundle time. Node keeps the DE440 default, as the hosted runtime does (api/_ai/runtime.mjs is bundled without
 * that rewrite), so this file runs the tool on that default and switches the root entry to astronomy-engine, as the
 * bundle does, only around the page's own calculation. tests/personal-pages-drive.mjs checks the same three
 * births on the built page in Chromium.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defaultEphemeris, setDefaultEphemeris } from '@zodiacs/engine';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { bodyLongitude, computeChart } from '../../lib/engine/full';
import { computeRetrogradeForYou, prepareLocalTime } from '../../islands/retrograde-for-you/compute';
import { resolveLocalToUtc } from '../../lib/time/localToUtc';
import { SIGNS, signIndexForLongitude } from '../../lib/signs';
import { onPageEphemeris, pageChart, pageLongitudes } from './page-ephemeris';
import { retrogradeForMe } from './retrograde-for-me';
import { browserEngineEsbuild } from '../../../scripts/lib/browser-engine.mjs';

/** Births within seconds of a Sun ingress, where DE440 and astronomy-engine fall on either side of the cusp. */
export const CUSP_BIRTHS = [
  { label: 'Reykjavik, 20 April 1970, 12:15', birthDate: '1970-04-20', time: '12:15', place: { lat: 64.15, lon: -21.94, tz: 'Atlantic/Reykjavik' }, sun: 'aries', de440: 'taurus' },
  { label: 'London, 20 April 1962, 14:51', birthDate: '1962-04-20', time: '14:51', place: { lat: 51.51, lon: -0.13, tz: 'Europe/London' }, sun: 'aries', de440: 'taurus' },
  { label: 'New York, 19 February 1956, 11:05', birthDate: '1956-02-19', time: '11:05', place: { lat: 40.71, lon: -74.01, tz: 'America/New_York' }, sun: 'aquarius', de440: 'pisces' },
] as const;

const NOW = new Date('2026-11-24T12:00:00Z');
const clock = createLocalTimeModule();
const sunOf = (lon: number) => SIGNS[signIndexForLongitude(lon)].slug;

describe('the browser bundle’s ephemeris', () => {
  it('is astronomy-engine: the bundle rewrites the engine’s default, and takes out the DE440 pack', async () => {
    const plugin = browserEngineEsbuild();
    const loaders: { filter: RegExp; load: (args: { path: string }) => Promise<{ contents: string } | undefined> }[] = [];
    plugin.setup({ onLoad: (options: { filter: RegExp }, load: (args: { path: string }) => Promise<{ contents: string } | undefined>) => loaders.push({ filter: options.filter, load }) });
    const dist = fileURLToPath(new URL('../../../node_modules/@zodiacs/engine/dist/', import.meta.url));
    const ephemeris = await loaders[0].load({ path: `${dist}chunk-BPZVUBFC.js` });
    expect(ephemeris?.contents).toContain('var INITIAL_DEFAULT_EPHEMERIS = "astronomy-engine";');
    const pack = await loaders[0].load({ path: `${dist}chunk-UXY4RU57.js` });
    expect(pack?.contents).not.toContain('DE440_PACK_BASE64');
    expect(readFileSync(`${dist}chunk-BPZVUBFC.js`, 'utf8')).toContain('var INITIAL_DEFAULT_EPHEMERIS = "de440";');
  });
});

/** Run `run` with the engine's root default switched to astronomy-engine, as the browser bundle has it. */
async function asInTheBrowser<T>(run: () => Promise<T> | T): Promise<T> {
  setDefaultEphemeris('astronomy-engine');
  try { return await run(); } finally { setDefaultEphemeris('de440'); }
}

describe('get_retrograde_for_me reads the natal side on the page’s ephemeris', () => {
  beforeAll(() => setDefaultEphemeris('de440'));
  afterAll(() => setDefaultEphemeris('de440'));

  it('casts the chart and reads each longitude exactly as the page does in the browser', () => asInTheBrowser(() => {
    const lonAt = pageLongitudes();
    for (const iso of ['1824-09-20T12:00:00Z', '1926-03-21T19:00:00Z', '1956-02-19T16:05:00Z', '1970-04-20T12:15:00Z', '2003-10-16T21:59:00Z', '2026-11-24T12:00:00Z']) {
      const input = { utc: new Date(iso), latitude: 64.15, longitude: -21.94, houseSystem: 'whole' as const, timeKnown: true };
      expect(pageChart(input), iso).toEqual(computeChart(input));
      for (const body of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const) {
        expect(lonAt(body, input.utc), `${body} ${iso}`).toBe(bodyLongitude(body, input.utc));
      }
    }
  }));

  it('switches the engine to astronomy-engine for one calculation only, and back whatever happens', () => {
    const utc = new Date('1970-04-20T12:15:00Z');
    expect(defaultEphemeris().name).toBe('de440');
    expect(sunOf(pageChart({ utc, houseSystem: 'whole', timeKnown: true }).bodies.find((row) => row.body === 'Sun')!.lon)).toBe('aries');
    expect(sunOf(pageLongitudes()('Sun', utc))).toBe('aries');
    expect(defaultEphemeris().name).toBe('de440');
    expect(sunOf(computeChart({ utc, houseSystem: 'whole', timeKnown: true }).bodies.find((row) => row.body === 'Sun')!.lon)).toBe('taurus');
    expect(() => onPageEphemeris(() => { throw new RangeError('stop'); })).toThrow('stop');
    expect(defaultEphemeris().name).toBe('de440');
    expect(() => onPageEphemeris(() => Promise.resolve(1))).toThrow(TypeError);
    expect(defaultEphemeris().name).toBe('de440');
  });

  for (const birth of CUSP_BIRTHS) {
    it(`gives the page’s Sun sign and share cards for ${birth.label}`, async () => {
      // The hosted tool, on the hosted runtime's default ephemeris (DE440).
      const tool = await retrogradeForMe(
        { birthDate: birth.birthDate, time: birth.time, zone: birth.place.tz, latitude: birth.place.lat, longitude: birth.place.lon, currentZone: 'UTC' },
        { now: NOW, localTime: clock, resolveZone: async (name: string) => name, origin: 'https://zodiacs.org', pageOn: true },
      );
      if ('refused' in tool) throw new Error(tool.refused);
      // The page's own calculation, on the browser's ephemeris.
      await prepareLocalTime(birth.birthDate, birth.place.tz);
      const page = await asInTheBrowser(() => computeRetrogradeForYou({ birthDate: birth.birthDate, birthTime: birth.time, place: birth.place, planets: ['Mercury', 'Venus', 'Mars'], now: NOW, zone: 'UTC' }));
      if (page.refused) throw new Error(page.refused);

      const toolSuns = tool.data.periods.map((period) => new URL(period.shareUrl!).searchParams.get('sun'));
      const pageSuns = page.periods.map((period) => new URLSearchParams(period.shareQuery!).get('sun'));
      expect(pageSuns.length).toBeGreaterThan(0);
      expect(new Set(pageSuns)).toEqual(new Set([birth.sun]));
      expect(toolSuns).toEqual(pageSuns);
      expect(tool.data.periods.map((period) => new URL(period.shareUrl!).search.slice(1))).toEqual(page.periods.map((period) => period.shareQuery));
      // Same houses, contacts, readings and station degrees.
      const same = ({ planet, status, signs, housesCountedFrom, houses, contacts, possibleContacts, reading, stationRetrograde, stationDirect }: (typeof page.periods)[number] | (typeof tool.data.periods)[number]) =>
        ({ planet, status, signs, housesCountedFrom, houses, contacts, possibleContacts, reading, stationRetrograde, stationDirect });
      expect(tool.data.periods.map(same)).toEqual(page.periods.map(same));

      // On the hosted engine's own default (DE440) the same instant falls in the next sign: the case is a real cusp.
      const utc = resolveLocalToUtc(birth.birthDate, birth.time, birth.place.tz, { longitude: birth.place.lon }).utc;
      expect(sunOf(computeChart({ utc, houseSystem: 'whole', timeKnown: true }).bodies.find((row) => row.body === 'Sun')!.lon)).toBe(birth.de440);
    });
  }
});
