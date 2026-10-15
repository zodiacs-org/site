import { describe, expect, it } from 'vitest';
import * as receiptModule from '../../engine/calculator-receipt';
import * as engine from '../../engine/full';
import type { Chart, HouseSystem } from '../../engine/types';
import { t } from '../../i18n';
import { moonCandidates as pageMoonCandidates, moonIsUncertain } from '../../moon-certainty';
import { signForLongitude } from '../../signs';
import { prepareLocalTime, resolveLocalToUtc } from '../../time/localToUtc';
import { assessLocalDateReference } from '../../time/local-date-reference';
import {
  bigThreeResult, birthChartResult, chartPageNatal, moonCandidates, moonSignResult, personNatal, risingSignResult,
} from './chart';
import { position } from './format';
import type { Birth } from './input';
import { BIRTHS, city } from './fixtures';
import { islandFunction, ref } from './island-code';
import { LocalDateReferenceError } from './moon-phase';

// ChartCalculator's runChart, the code /birth-chart/, /moon-sign/ and /rising-sign/ calculate with.
const runChart = islandFunction('ChartCalculator.tsx', { function: 'runChart' });

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
    prepareLocalTime, resolveLocalToUtc, assessLocalDateReference, signForLongitude, moonIsUncertain, t,
    calculationError: (_error: unknown, _locale: string, fallback: string) => fallback,
    setChart: (chart: Chart) => { state.chart = chart; },
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
      prepareLocalTime, resolveLocalToUtc, loadEngine: async () => engine,
      loadResultTrust: async () => ({}), loadReading: async () => null,
      setPlacements: (value: typeof state.placements) => { state.placements = value; },
      setError: (value: string) => { state.error = value; },
      s: (_locale: string, key: string) => key, t, localizePath: (_locale: string, path: string) => path,
      chartHandoffFragment: () => '', prepareCard: async () => undefined,
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
        expect(chart.bigThree.moon).toBeNull();
        expect(chart.moonSignStatus).toBe('unverified');
        expect(moon.moon).toBeNull();
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

  it('keep a degree just short of a sign\'s end in that sign', () => {
    expect(position(29.999999999)).toMatchObject({ sign: 'Aries', degreeInSign: 29.9999, label: '29°59′ Aries' });
    expect(position(359.99999999)).toMatchObject({ sign: 'Pisces', longitude: 359.9999 });
    expect(position(0)).toMatchObject({ sign: 'Aries', longitude: 0, degreeInSign: 0 });
  });
});
