import { describe, expect, it } from 'vitest';
import * as lunarCompute from '../../../islands/lunar-return/compute';
import * as solarCompute from '../../../islands/solar-return/compute';
import { houseOf } from '../../engine/houses';
import * as returnsModule from '../../engine/returns';
import type { ReturnSeason, SaturnReturnResult } from '../../engine/returns';
import type { Chart } from '../../engine/types';
import { prepareLocalTime, resolveLocalToUtc } from '../../time/localToUtc';
import { position } from './format';
import { BIRTHS, city, LONDON, SYDNEY } from './fixtures';
import type { Birth, Place } from './input';
import { islandFunction, ref } from './island-code';
import { lunarReturnResult, saturnReturnResult, solarReturnResult } from './returns';

const PEOPLE = BIRTHS.filter(([label]) => label !== 'an untimed date the clock skipped');
const fallback = (_error: unknown, _locale: string, message: string) => message;

describe('SaturnReturnCalculator (/saturn-return/)', () => {
  const compute = islandFunction('SaturnReturnCalculator.tsx', { function: 'compute' });

  async function page(date: string, time: string | null, place: Place | null) {
    const state: { result: SaturnReturnResult | null; receipt: { utc: Date } | null; error: string } = { result: null, receipt: null, error: '' };
    await compute({
      date, time: time ?? '', city: place ? city({ place }) : null, showDetail: place !== null,
      calendar: 'gregorian', calendarInPlay: () => false, locale: 'en', generation: ref(0), focusAfterComputeRef: ref(false),
      busy: false, loadReturns: async () => returnsModule, prepareLocalTime, resolveLocalToUtc,
      setResult: (value: SaturnReturnResult) => { state.result = value; },
      setResultReceipt: (value: { utc: Date }) => { state.receipt = value; },
      setError: (value: string) => { state.error = value; }, calculationError: fallback, t: (_l: string, key: string) => key,
      console: { error() {} },
    }, { preventDefault() {} });
    return state;
  }

  const cases: Array<[string, string, string | null, Place | null]> = [
    ...PEOPLE.slice(0, 6).map(([label, birth]) => [label, birth.date, birth.time, birth.place] as [string, string, string | null, Place]),
    ['a date alone (noon UTC)', '1990-06-15', null, null],
    ['a late date the reference span clips', '2150-01-01', null, null],
  ];

  it.each(cases)('%s', async (_label, date, time, place) => {
    const now = new Date('2026-10-15T12:00:00Z');
    const shown = await page(date, time, place);
    expect(shown.error).toBe('');
    const result = await saturnReturnResult(date, time, place, now);
    expect(result.computedUtc).toBe(shown.receipt!.utc.toISOString());
    expect(result.natalSaturn).toEqual({ ...position(shown.result!.natalLon), retrograde: shown.result!.natalRetrograde });
    expect(result.rangeClipped).toBe(shown.result!.rangeClipped);
    expect(result.seasons.map((season) => [season.return, season.first, season.last, season.passes]))
      .toEqual(shown.result!.seasons.map((season: ReturnSeason) => [season.index, season.first.toISOString(), season.last.toISOString(),
        season.crossings.map((crossing) => ({ at: crossing.at.toISOString(), retrograde: crossing.retrograde }))]));
  });
});

describe('SolarReturnCalculator (/solar-return/)', () => {
  const calculate = islandFunction('SolarReturnCalculator.tsx', { function: 'calculate' });

  async function page(birth: Birth, year: 'current' | number, cast: Place | null, houseSystem: 'whole' | 'placidus') {
    const state: { data: solarCompute.SolarReturnResultData | null; error: string } = { data: null, error: '' };
    await calculate({
      mounted: ref(true), ready: true, inFlight: ref(false), source: 'form', saved: null, city: city(birth),
      date: birth.date, time: birth.time ?? '', timeKnown: birth.time !== null, differentPlace: cast !== null,
      castCity: cast ? city({ place: cast }) : null, profile: { charts: [], settings: { houseSystem } },
      yearMode: year === 'current' ? 'current' : 'custom', customYear: String(year), revision: ref(0),
      profileAccessGeneration: ref(0), calendarInPlay: () => false,
      loadModule: (load: () => Promise<unknown>) => load(),
      __import: async (specifier: string) => (specifier === './solar-return/compute' ? solarCompute : {}),
      setResult: (value: { data: solarCompute.SolarReturnResultData } | null) => { state.data = value?.data ?? null; },
      setError: (value: string) => { state.error = value; }, calculationError: fallback, console: { error() {} },
    }, { preventDefault() {} });
    return state;
  }

  const cases: Array<[string, Birth, 'current' | number, Place | null, 'whole' | 'placidus']> = [
    ...PEOPLE.slice(0, 7).map(([label, birth]) => [label, birth, 2030, null, 'whole'] as [string, Birth, number, null, 'whole']),
    ['the return in force now', PEOPLE[0][1], 'current', null, 'whole'],
    ['cast elsewhere, Placidus', PEOPLE[0][1], 2024, SYDNEY, 'placidus'],
    ['untimed, cast elsewhere', PEOPLE[1][1], 2024, LONDON, 'whole'],
  ];

  it.each(cases)('%s', async (_label, birth, year, cast, houseSystem) => {
    const shown = await page(birth, year, cast, houseSystem);
    expect(shown.error).toBe('');
    const result = await solarReturnResult(birth, year, cast, houseSystem, new Date());
    const chart: Chart = shown.data!.chart;
    expect(result.returnYear).toBe(shown.data!.returnYear);
    expect(result.instant).toBe(chart.input.utc.toISOString());
    expect(result.bodies.map((body) => [body.body, body.longitude, body.house]))
      .toEqual(chart.bodies.map((body) => [body.body, position(body.lon).longitude, chart.houses ? houseOf(body.lon, chart.houses.cusps) : null]));
    expect(result.angles?.ascendant ?? null).toEqual(chart.angles ? position(chart.angles.asc) : null);
    expect(result.houseSystem).toBe(chart.houses?.system ?? null);
    expect(result.timeKnown).toBe(!shown.data!.noTime);
  });
});

describe('LunarReturnCalculator (/lunar-return/)', () => {
  const calculate = islandFunction('LunarReturnCalculator.tsx', { function: 'calculate' });
  const after = new Date('2026-10-15T00:00:00Z');

  async function page(birth: Birth, cast: Place | null, houseSystem: 'whole' | 'placidus') {
    const state: { data: lunarCompute.LunarReturnResultData | null; error: string } = { data: null, error: '' };
    await calculate({
      mounted: ref(true), ready: true, inFlight: ref(false), saved: null, date: birth.date, time: birth.time ?? '',
      known: birth.time !== null, birthplace: city(birth), differentPlace: cast !== null,
      castCity: cast ? city({ place: cast }) : null, profile: { charts: [], settings: { houseSystem } },
      reference: ref(after), revision: ref(0), accessGeneration: ref(0), calendarInPlay: () => false,
      loadModule: (load: () => Promise<unknown>) => load(),
      __import: async (specifier: string) => (specifier === './lunar-return/compute' ? lunarCompute : {}),
      setResult: (value: { data: lunarCompute.LunarReturnResultData } | null) => { state.data = value?.data ?? null; },
      setError: (value: string) => { state.error = value; }, calculationError: fallback,
    }, { preventDefault() {} });
    return state;
  }

  const cases: Array<[string, Birth, Place | null, 'whole' | 'placidus']> = [
    ...PEOPLE.filter(([, birth]) => birth.time !== null).map(([label, birth]) => [label, birth, null, 'whole'] as [string, Birth, null, 'whole']),
    ['cast elsewhere, Placidus', PEOPLE[0][1], SYDNEY, 'placidus'],
  ];

  it.each(cases)('%s', async (_label, birth, cast, houseSystem) => {
    const shown = await page(birth, cast, houseSystem);
    let result;
    try {
      result = await lunarReturnResult(birth, after, cast, houseSystem);
    } catch (error) {
      // The page refuses a birth time a clock change skipped or repeated, with the same RangeError.
      expect(shown.data).toBeNull();
      expect(shown.error).toBe((error as Error).message);
      return;
    }
    expect(shown.error).toBe('');
    const chart: Chart = shown.data!.chart;
    expect(result.instant).toBe(chart.input.utc.toISOString());
    expect(result.after).toBe(shown.data!.referenceUtc);
    expect(result.bodies.map((body) => body.longitude)).toEqual(chart.bodies.map((body) => position(body.lon).longitude));
    expect(result.angles?.ascendant ?? null).toEqual(chart.angles ? position(chart.angles.asc) : null);
    expect(result.natalLocalMeanTime).toBe(shown.data!.natalLocalMeanTime);
  });

  it('refuses a birth time a clock change skipped, as the page does', async () => {
    const gap = BIRTHS.find(([label]) => label === 'a clock-change gap')![1];
    await expect(lunarReturnResult(gap, after, null, 'whole')).rejects.toThrow(/clock change/);
    expect((await page(gap, null, 'whole')).error).toMatch(/clock change/);
  });
});
