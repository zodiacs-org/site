import { describe, expect, it, vi } from 'vitest';
import * as receiptModule from '../../engine/calculator-receipt';
import * as engine from '../../engine/full';
import type { Chart, HouseSystem } from '../../engine/types';
import { t } from '../../i18n';
import { moonCandidates as pageMoonCandidates, moonIsUncertain } from '../../moon-certainty';
import { signBySlug, signForLongitude } from '../../signs';
import { offsetAt, prepareLocalTime, resolveLocalToUtc } from '../../time/localToUtc';
import { assessLocalDateReference } from '../../time/local-date-reference';
import { localDateMoonSigns } from '../../moon-day-bounds';
import {
  bigThreeResult, birthChartResult, chartPageNatal, moonCandidates, moonSignResult, personNatal, risingSignResult,
} from './chart';
import { position } from './format';
import type { Birth } from './input';
import { BIRTHS, city } from '../../../../tests/webmcp/calculator-fixtures';
import { islandFunction, ref } from '../../../../tests/webmcp/island-code';
import { LocalDateReferenceError } from './moon-phase';
import { runCalculatorTool } from '../calculator-runtime';
import { birthDateRefusal, birthDateRefusalText } from '../../birth-date-policy';

// ChartCalculator's runChart, the code /birth-chart/, /moon-sign/ and /rising-sign/ calculate with.
const runChart = islandFunction('ChartCalculator.tsx', { function: 'runChart' });

/**
 * A browser's Temporal, as far as a date's limits read it: Intl's offsets, each change found by an hourly scan and a
 * bisection to the millisecond. Node has no Temporal; the zones it stands in for here change months apart.
 */
function intlTemporal() {
  const HOUR = 3_600_000;
  const offset = (zone: string, instant: number) => Math.round(offsetAt(zone, instant) * 60_000);
  class ZonedDateTime {
    constructor(private readonly zone: string, private readonly instant: number) {}
    get offsetNanoseconds() { return offset(this.zone, this.instant) * 1_000_000; }
    get epochNanoseconds() { return BigInt(this.instant) * 1_000_000n; }
    getTimeZoneTransition() {
      const base = offset(this.zone, this.instant);
      for (let probe = this.instant + HOUR; probe <= this.instant + 80 * HOUR; probe += HOUR) {
        if (offset(this.zone, probe) === base) continue;
        let low = probe - HOUR, high = probe;
        while (high - low > 1) {
          const middle = Math.floor((low + high) / 2);
          if (offset(this.zone, middle) === base) low = middle; else high = middle;
        }
        return new ZonedDateTime(this.zone, high);
      }
      return null;
    }
  }
  class Instant {
    constructor(private readonly instant: number) {}
    static fromEpochMilliseconds(instant: number) { return new Instant(instant); }
    toZonedDateTimeISO(zone: string) { return new ZonedDateTime(zone, this.instant); }
  }
  return { Instant, ZonedDateTime };
}

async function chartPage(mode: 'full' | 'moon' | 'rising', birth: Birth, houseSystem: HouseSystem) {
  const state: { chart: Chart | null; error: string; moonAmbiguous: boolean | null; onMeanTime: boolean | null } = {
    chart: null, error: '', moonAmbiguous: null, onMeanTime: null,
  };
  await runChart({
    mode, locale: 'en', showsEnglishInterpretation: false,
    inputRevisionRef: ref(0), runChartIdRef: ref(0), profileAccessGeneration: ref(0), primaryProfileOriginRef: ref(false),
    focusAfterComputeRef: ref(false), resultOwnerRef: ref(null), receiptExportRef: ref(null), chartContextIdRef: ref(0),
    shareRuntimeRef: ref({}), resultRef: ref(null), chartActionDockModule: null,
    profileAccessAllowed: () => true,
    loadEngine: async () => engine, loadCalculatorReceipt: async () => receiptModule,
    loadNotices: async () => ({ resolveEngine2Notices: () => [] }),
    prepareLocalTime, resolveLocalToUtc, assessLocalDateReference, localDateMoonSigns, signForLongitude, moonIsUncertain, t,
    birthDateRefusal, birthDateRefusalText,
    calculationError: (_error: unknown, _locale: string, fallback: string) => fallback,
    setChart: (chart: Chart) => { state.chart = chart; },
    setEngine2Notices: () => {},
    setError: (error: string) => { state.error = error; },
    setMoonAmbiguous: (value: boolean) => { state.moonAmbiguous = value; },
    setOnMeanTime: (value: boolean) => { state.onMeanTime = value; },
    window: { dispatchEvent: () => true }, CustomEvent: class { constructor(readonly type: string) {} },
    requestAnimationFrame: () => 0, matchMedia: () => ({ matches: true }), console: { error() {} },
  }, {
    date: birth.date, time: birth.time ?? '', timeKnown: birth.time !== null, city: city(birth), houseSystem,
  }, false, 'fresh');
  return state;
}

async function tool(birth: Birth, houseSystem: HouseSystem, receipt: boolean) {
  try {
    return { reading: await chartPageNatal(birth, houseSystem, { receipt }), error: null };
  } catch (error) {
    return { reading: null, error };
  }
}

describe('the chart tools calculate what the chart pages calculate', () => {
  const cases = BIRTHS.flatMap(([label, birth]) => [
    [`/birth-chart/, whole sign: ${label}`, 'full', birth, 'whole', true],
    [`/birth-chart/, Placidus: ${label}`, 'full', birth, 'placidus', true],
    [`/moon-sign/: ${label}`, 'moon', birth, 'whole', false],
    ...(birth.time ? [[`/rising-sign/: ${label}`, 'rising', birth, 'whole', false]] : []),
  ]) as Array<[string, 'full' | 'moon' | 'rising', Birth, HouseSystem, boolean]>;

  it.each(cases)('%s', async (_label, mode, birth, houseSystem, receipt) => {
    const shown = await chartPage(mode, birth, houseSystem);
    const refusal = birthDateRefusal(birth.date);
    if (refusal) {
      // The page refuses a birth date still to come (or under 13) before it computes anything.
      expect(shown.chart).toBeNull();
      expect(shown.error).toBe(birthDateRefusalText(refusal));
      expect(runChart.missing.has('birthDateRefusal')).toBe(false);
      const name = mode === 'full' ? 'zodiacs.birth_chart' : mode === 'moon' ? 'zodiacs.moon_sign' : 'zodiacs.rising_sign';
      const input = { date: birth.date, place: birth.place, ...(birth.time ? { time: birth.time } : {}), ...(mode === 'full' ? { houseSystem } : {}) };
      const envelope = await runCalculatorTool(name, input);
      const code = refusal === 'under_13' ? 'BIRTH_DATE_UNDER_13' : 'FUTURE_BIRTH_DATE';
      expect(envelope).toEqual({ ok: false, error: { code, message: birthDateRefusalText(refusal) } });
      return;
    }
    const computed = await tool(birth, houseSystem, receipt);
    if (shown.error) {
      expect(shown.chart).toBeNull();
      expect(shown.error).toBe(t('en', 'localDateReferenceError'));
      expect(computed.error).toBeInstanceOf(LocalDateReferenceError);
      return;
    }
    expect(computed.error).toBeNull();
    expect(shown.chart).not.toBeNull();
    expect(computed.reading!.chart).toEqual(shown.chart);
    expect(computed.reading!.localMeanTime).toBe(shown.onMeanTime);
    expect(moonCandidates(computed.reading!.chart).length !== 1).toBe(shown.moonAmbiguous);
    expect(runChart.missing.has('loadEngine')).toBe(false);
  });

  it('includes the controls that matter: an untimed date refused, local mean time, a gap and the far north', async () => {
    expect((await tool(BIRTHS[8][1], 'whole', true)).error).toBeInstanceOf(LocalDateReferenceError);
    expect((await chartPage('full', BIRTHS[8][1], 'whole')).error).toBe(t('en', 'localDateReferenceError'));
    expect((await chartPageNatal(BIRTHS[2][1], 'whole', { receipt: true })).localMeanTime).toBe(true);
    expect((await chartPageNatal(BIRTHS[3][1], 'whole', { receipt: true })).chart.flags).toContain('dst-gap');
    expect((await chartPageNatal(BIRTHS[6][1], 'placidus', { receipt: true })).chart.flags).toContain('polar-fallback');
  });
});

describe('BigThreeQuick (/big-three/)', () => {
  const compute = islandFunction('BigThreeQuick.tsx', { function: 'compute' });

  it.each(BIRTHS.filter(([, birth]) => birth.time !== null))('%s', async (_label, birth) => {
    const state: { placements: Array<{ kind: string; lon: number }> | null; error: string } = { placements: null, error: '' };
    const cardSource = ref<{ chart: Chart } | null>(null);
    await compute({
      date: birth.date, time: birth.time, city: city(birth), calendar: 'gregorian', locale: 'en',
      calendarInPlay: () => false, generation: ref(0), cardSource,
      loadLocalTime: async () => ({ prepareLocalTime, resolveLocalToUtc }), loadEngine: async () => engine,
      loadResultTrust: async () => ({}), loadReading: async () => null,
      loadNotices: async () => ({ resolveEngine2Notices: () => [] }),
      setPlacements: (value: typeof state.placements) => { state.placements = value; },
      setResultNotices: () => {},
      setError: (value: string) => { state.error = value; },
      s: (_locale: string, key: string) => key, t, localizePath: (_locale: string, path: string) => path,
      prepareCard: async () => undefined,
      requestAnimationFrame: () => 0, matchMedia: () => ({ matches: true }),
      calculationError: (_error: unknown, _locale: string, fallback: string) => fallback,
    }, { preventDefault() {} });
    expect(state.error).toBe('');
    const reading = await personNatal(birth);
    expect(reading.chart).toEqual(cardSource.current!.chart);
    const result = bigThreeResult(reading);
    const shown = Object.fromEntries(state.placements!.map((entry) => [entry.kind, position(entry.lon)]));
    expect({ sun: result.sun, moon: result.moon, rising: result.rising }).toEqual(shown);
  });
});

describe('the chart results', () => {
  it('name the Moon only when it is settled, as the pages do', async () => {
    for (const [, birth] of BIRTHS) {
      let reading;
      try {
        reading = await chartPageNatal(birth, 'whole', { receipt: true });
      } catch {
        continue;
      }
      expect(moonCandidates(reading.chart)).toEqual(pageMoonCandidates(reading.chart));
      const chart = birthChartResult(reading);
      const moon = moonSignResult(reading);
      if (birth.time === null) {
        // Settled only when the Moon held one sign through the whole birth date, both signs when it changed sign.
        const candidates = moonCandidates(reading.chart);
        const status = candidates.length === 1 ? 'settled' : candidates.length === 2 ? 'changed-sign' : 'unverified';
        expect(chart.moonSignStatus).toBe(status);
        expect(moon.moonSignStatus).toBe(status);
        expect(chart.bigThree.moon === null).toBe(status !== 'settled');
        expect(moon.moon === null).toBe(status !== 'settled');
        // A settled sign without a time is the sign alone: no longitude or degree from the noon reference.
        if (status === 'settled') {
          for (const shown of [chart.bigThree.moon, moon.moon]) expect(shown).toEqual({ sign: signBySlug(candidates[0]).name });
        }
        expect(chart.angles).toBeNull();
        expect(chart.houses).toBeNull();
        expect(chart.bodies.every((body) => body.house === null)).toBe(true);
      } else {
        expect(chart.bigThree.moon).toEqual(position(reading.chart.bodies.find((body) => body.body === 'Moon')!.lon));
        expect(moon.moonSignStatus).toBe('settled');
        expect(chart.houses).toHaveLength(12);
        expect(risingSignResult(reading).rising).toEqual(chart.bigThree.rising);
      }
      expect(chart.computedUtc).toBe(reading.chart.input.utc.toISOString());
    }
  });

  describe('the Moon without a birth time', () => {
    const untimed = (date: string, place: Birth['place']) => chartPageNatal({ date, time: null, place }, 'whole', { receipt: true });
    const BANGKOK = { latitude: 13.7563, longitude: 100.5018, timeZone: 'Asia/Bangkok' };
    const LONDON = { latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London' };
    const TORONTO = { latitude: 43.65, longitude: -79.38, timeZone: 'America/Toronto' };

    it('names the one sign the Moon held through the birth date, and no noon degree as the Moon\'s', async () => {
      const reading = await untimed('1990-01-04', BANGKOK);
      expect(reading.chart.moonSignCandidates).toEqual(['aries']);
      const note = 'The Moon was in Aries through the whole birth date, so without a birth time the page names that sign '
        + 'but not a degree: the Moon\'s degree at local noon is a reference, and its degree at birth needs the time from '
        + 'the birth record.';
      for (const result of [birthChartResult(reading), moonSignResult(reading)]) {
        expect(result).toMatchObject({ timeKnown: false, basis: 'local-noon', moonSignStatus: 'settled', moonSignNote: note });
        expect(result).not.toHaveProperty('moonSignCandidates');
        expect(result.moonSignNote).not.toMatch(/[\u2013\u2014]/);
      }
      // The sign alone. Noon's Moon is in Aries too, but its longitude and degree are not the Moon's at birth.
      expect(moonSignResult(reading).moon).toEqual({ sign: 'Aries' });
      expect(birthChartResult(reading).bigThree.moon).toEqual({ sign: 'Aries' });
      const noon = position(reading.chart.bodies.find((row) => row.body === 'Moon')!.lon);
      expect(noon.sign).toBe('Aries');
      const moonSign = JSON.stringify(moonSignResult(reading));
      for (const value of ['"longitude"', '"degreeInSign"', '"label"', String(noon.longitude), noon.label]) {
        expect(moonSign).not.toContain(value);
      }
      // The birth chart keeps noon's Moon only among its bodies, read at local noon, as every other reference position.
      const chart = birthChartResult(reading);
      expect(chart.bodies.find((row) => row.body === 'Moon')).toMatchObject(noon);
      expect(JSON.stringify(chart.bigThree)).not.toContain(noon.label);

      // With the time known, the same instant's Moon is a position.
      const timed = await chartPageNatal({ date: '1990-01-04', time: '12:00', place: BANGKOK }, 'whole', { receipt: true });
      expect(timed.chart.input.utc.toISOString()).toBe(reading.chart.input.utc.toISOString());
      expect(moonSignResult(timed)).not.toHaveProperty('moonSignNote');
      expect(moonSignResult(timed).moon).toEqual(noon);
      expect(birthChartResult(timed).bigThree.moon).toEqual(noon);
    });

    it('gives both signs of a day the Moon changed sign, in the order it took them, and chooses neither', async () => {
      const reading = await untimed('1990-01-01', LONDON);
      expect(reading.chart.moonSignCandidates).toEqual(['aquarius', 'pisces']);
      for (const result of [birthChartResult(reading), moonSignResult(reading)]) {
        expect(result).toMatchObject({ moonSignStatus: 'changed-sign', moonSignCandidates: ['Aquarius', 'Pisces'] });
        expect(result.moonSignNote).toBe('Two Moon signs are possible for this birth date: the Moon moved from Aquarius '
          + 'into Pisces during the date. The page names both; a birth time from the birth record is needed to know which.');
        expect(result.moonSignNote).not.toMatch(/[\u2013\u2014]/);
      }
      expect(moonSignResult(reading).moon).toBeNull();
      expect(birthChartResult(reading).bigThree.moon).toBeNull();
      // The noon reference's sign is one of the two, but it is not given as the birth sign.
      expect(JSON.stringify(moonSignResult(reading))).not.toContain('"sign"');
    });

    const unverified = {
      moon: null, moonSignStatus: 'unverified',
      moonSignNote: 'Without a birth time the Moon\'s sign across the birth date is not verified, so the page does not '
        + 'name it; give the time from the birth record.',
    };

    it('keeps the unverified answer, word for word, when the date\'s limits settle nothing', async () => {
      const reading = await untimed('1919-03-31', TORONTO);
      expect(reading.chart.moonSignCandidates).toEqual([]);
      const { moonPhase, engine: _engine, page: _page, timeKnown: _known, basis: _basis, computedUtc: _utc, flags: _flags,
        localMeanTime: _lmt, ...moon } = moonSignResult(reading);
      expect(typeof moonPhase).toBe('string');
      expect(moon).toEqual(unverified);
      const { bigThree, moonSignStatus, moonSignNote } = birthChartResult(reading);
      expect(bigThree.moon).toBeNull();
      expect({ moon: bigThree.moon, moonSignStatus, moonSignNote }).toEqual(unverified);
      expect(birthChartResult(reading)).not.toHaveProperty('moonSignCandidates');
    });

    it('names no sign for a date a clock split when the Moon changed sign between its runs', async () => {
      // St. John's turned its clocks back from 00:01 on 29 October 1989 to 23:01 on the 28th, and the Moon
      // entered Scorpio in that repeated hour: the 29th had Libra in its first minute and Scorpio after it, but
      // the Moon did not change sign on the 29th. Node has no Temporal, so the repeated midnight leaves both
      // dates unverified; a browser's Temporal gives each date's two runs.
      const ST_JOHNS = { latitude: 47.5615, longitude: -52.7126, timeZone: 'America/St_Johns' };
      expect((await untimed('1989-10-28', ST_JOHNS)).chart.moonSignCandidates).toEqual([]);
      vi.stubGlobal('Temporal', intlTemporal());
      try {
        const split = await untimed('1989-10-29', ST_JOHNS);
        expect(split.chart.moonSignCandidates).toEqual([]);
        expect(moonSignResult(split)).toMatchObject(unverified);
        const { bigThree, moonSignStatus, moonSignNote } = birthChartResult(split);
        expect({ moon: bigThree.moon, moonSignStatus, moonSignNote }).toEqual(unverified);
        // The 28th saw the change, so it gives both signs.
        expect(moonSignResult(await untimed('1989-10-28', ST_JOHNS)))
          .toMatchObject({ moonSignStatus: 'changed-sign', moonSignCandidates: ['Libra', 'Scorpio'] });
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  it('keep a degree just short of a sign\'s end in that sign', () => {
    expect(position(29.999999999)).toMatchObject({ sign: 'Aries', degreeInSign: 29.9999, label: '29°59′ Aries' });
    expect(position(359.99999999)).toMatchObject({ sign: 'Pisces', longitude: 359.9999 });
    expect(position(0)).toMatchObject({ sign: 'Aries', longitude: 0, degreeInSign: 0 });
  });
});
