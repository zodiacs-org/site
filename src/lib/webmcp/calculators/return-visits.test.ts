import { describe, expect, it } from 'vitest';
import * as engine from '../../engine/full';
import { scanTransitContacts, type TransitContact } from '../../engine/transit-scan';
import type { Chart } from '../../engine/types';
import { t } from '../../i18n';
import { wrappedTargets, wrappedWindow } from '../../return-visits/wrapped';
import { calculateEntry, type ChartEntry } from '../../sharing/chart-entry';
import { personNatal } from './chart';
import { position } from './format';
import { BIRTHS, city } from './fixtures';
import type { Birth } from './input';
import { islandFunction, ref } from './island-code';
import { chartPdfResult, yearWrappedResult } from './return-visits';

const PEOPLE = BIRTHS.filter(([label]) => label !== 'an untimed date the clock skipped');

const entry = (birth: Birth): ChartEntry => ({
  id: 3, name: '', date: birth.date, time: birth.time ?? '', timeKnown: birth.time !== null, city: city(birth), calendar: 'gregorian',
});

// ReturnPersonal's compute, the code /astrologer-kit/ and /your-sky-wrapped/ calculate with, and the wrapped page's
// worker, which scans the year.
const compute = islandFunction('ReturnPersonal.tsx', { function: 'compute' });
const worker = islandFunction('Wrapped.worker.ts', { assigned: 'self.onmessage' });

interface Shown {
  chart: Chart | null;
  pdfChart: Chart | null;
  contacts: TransitContact[] | null;
  error: string;
}

async function page(kind: 'kit' | 'wrapped', birth: Birth, year: number): Promise<Shown> {
  const state: Shown = { chart: null, pdfChart: null, contacts: null, error: '' };
  // The worker, run as the page runs it: one message in, one out.
  const scan = (chart: Chart, scanYear: number) => new Promise<TransitContact[]>((resolve, reject) => {
    worker({
      self: { postMessage: (message: { error?: boolean; contacts: TransitContact[] }) => (message.error ? reject(new Error('scan failed')) : resolve(message.contacts)) },
      scanTransitContacts, wrappedWindow, wrappedTargets,
    }, { data: { chart, year: scanYear } });
  });
  await compute({
    kind, locale: 'en', busy: false, clear: () => {}, generation: ref(0), selected: '', entry: entry(birth), year,
    loadProfile: () => ({ charts: [] }), engine: async () => engine, loadTrust: async () => ({}), calculateEntry, t,
    loadPdf: async () => ({ prepareClientPdf: async (chart: Chart) => { state.pdfChart = chart; return new Blob(); } }),
    scan,
    loadWrappedCard: async () => ({ prepareWrappedCard: async () => ({ blob: new Blob() }) }),
    loadCards: async () => ({ savePreparedChartCard: async () => 'downloaded' }),
    cardSaver: ref(null), resultRef: ref(null), requestAnimationFrame: () => 0,
    setResult: (value: { chart: Chart; contacts?: TransitContact[] } | null) => {
      state.chart = value?.chart ?? null;
      state.contacts = value?.contacts ?? null;
    },
    setError: (value: string) => { state.error = value; },
    s: (_locale: string, key: string) => key, calculationError: (_e: unknown, _l: string, fallback: string) => fallback,
  }, { preventDefault() {} });
  return state;
}

describe('ReturnPersonal on /astrologer-kit/ (Chart PDF)', () => {
  it.each(PEOPLE)('returns the chart the PDF prints: %s', async (_label, birth) => {
    const shown = await page('kit', birth, 2026);
    expect(shown.error).toBe('');
    expect(shown.pdfChart).not.toBeNull();
    const { chart } = await personNatal(birth);
    expect(chart).toEqual(shown.pdfChart);
    const result = await chartPdfResult(birth);
    const printed = shown.pdfChart!;
    expect(result.positions.map((body) => body.label)).toEqual(printed.bodies.map((body) => position(body.lon).label));
    expect(result.houses?.map((house) => house.cusp.label) ?? null).toEqual(printed.houses?.cusps.map((cusp) => position(cusp).label) ?? null);
    const aspects = printed.input.timeKnown ? printed.aspects : printed.aspects.filter((aspect) => aspect.a !== 'Moon' && aspect.b !== 'Moon');
    expect(result.aspects.map(({ a, b, type }) => [a, b, type])).toEqual(aspects.map(({ a, b, type }) => [a, b, type]));
    expect(result.computedUtc).toBe(printed.input.utc.toISOString());
    if (birth.time === null) expect(result.aspects.some((aspect) => aspect.a === 'Moon' || aspect.b === 'Moon')).toBe(false);
  });
});

describe('ReturnPersonal on /your-sky-wrapped/', () => {
  it.each(PEOPLE.flatMap(([label, birth]) => [2022, 2026].map((year) => [`${label}, ${year}`, birth, year] as [string, Birth, number])))(
    'finds the year\'s contacts the page lists: %s',
    async (_label, birth, year) => {
      const shown = await page('wrapped', birth, year);
      expect(shown.error).toBe('');
      expect(shown.contacts).not.toBeNull();
      const result = await yearWrappedResult(birth, year, new Date('2026-10-15T12:00:00Z'));
      expect(result.contacts.map(({ transiting, aspect, natal, exactUtc, pass, passCount }) => [transiting, aspect, natal, exactUtc, pass, passCount]))
        .toEqual(shown.contacts!.map((contact) => [contact.transitBody, contact.aspect, contact.natalPoint === 'ASC' ? 'Rising' : contact.natalPoint,
          contact.exactUtc, contact.pass, contact.passCount]));
      expect(result.jupiterContacts + result.saturnContacts).toBe(shown.contacts!.length);
      expect(result.natalPoints).toEqual(birth.time === null ? ['Sun'] : ['Sun', 'Moon', 'Rising']);
    },
  );

  it('includes years with contacts', async () => {
    const counts = await Promise.all(PEOPLE.map(([, birth]) => yearWrappedResult(birth, 2026, new Date()).then((result) => result.contacts.length)));
    expect(counts.some((count) => count > 0)).toBe(true);
  });
});
