import { describe, expect, it } from 'vitest';
import ingressData from '../src/data/ingresses.json';
import skyData from '../src/data/sky.json';
import julyTransits from '../src/data/transits-2026-07.json';
import augustTransits from '../src/data/transits-2026-08.json';
import type { Daily } from '../src/lib/daily';
import {
  HOROSCOPE_WORD_BOUNDS,
  buildHoroscopeProgram,
  validateHoroscopeProgramAgainstInput,
} from '../src/lib/horoscope-program';
import { computeDailySnapshot } from './daily-snapshot-lib.mjs';
import { HOROSCOPE_REPO_ROOT, expectedHoroscopeProgram, yearlyEvents } from './horoscope-program-files';
import { verifyHoroscopeProgramCopy } from './independent-copy-verifier';

interface IngressWindow {
  planet: string;
  sign: string;
  from: string;
  to: string;
}

interface RetrogradeWindow {
  planet: string;
  from: string;
  to: string | null;
}

const YEAR_START = '2027-01-01T00:00:00.000Z';
const YEAR_END = '2028-01-01T00:00:00.000Z';
const ingresses = (ingressData as { windows: IngressWindow[] }).windows;
const overlapping = (skyData as { retrogrades: RetrogradeWindow[] }).retrogrades.filter((window) => (
  window.from < YEAR_END && (window.to === null || window.to > YEAR_START)
));

function committedSignAt(planet: string, at: string): string {
  const window = ingresses.find((candidate) => (
    candidate.planet === planet && candidate.from <= at && at < candidate.to
  ));
  if (!window) throw new Error(`fixture has no ingress window for ${planet} at ${at}`);
  return window.sign;
}

describe('strict 2027 horoscope fact catalog', () => {
  it('commits exact aspect hits with an explicit zero-degree orb', () => {
    const aspects = [
      ...(julyTransits as { aspects: Array<{ orb?: number }> }).aspects,
      ...(augustTransits as { aspects: Array<{ orb?: number }> }).aspects,
    ];
    expect(aspects.length).toBeGreaterThan(0);
    expect(aspects.every((aspect) => aspect.orb === 0)).toBe(true);
  });

  it('includes both committed station boundaries for every overlapping retrograde period', async () => {
    expect(overlapping).toHaveLength(10);
    expect(overlapping.every((window) => window.to !== null)).toBe(true);

    const events = await yearlyEvents();
    const stations = events.filter((event) => event.kind === 'station');
    expect(stations).toHaveLength(overlapping.length * 2);
    expect(events.map((event) => event.at)).toEqual(
      [...events].map((event) => event.at).sort((left, right) => left.localeCompare(right)),
    );

    for (const window of overlapping) {
      if (window.to === null) throw new Error(`${window.planet} period is unexpectedly open`);
      expect(stations).toContainEqual(expect.objectContaining({
        planet: window.planet,
        type: 'retrograde',
        retrograde: true,
        at: window.from,
        sign: committedSignAt(window.planet, window.from),
        sourceId: 'src/data/sky.json',
      }));
      expect(stations).toContainEqual(expect.objectContaining({
        planet: window.planet,
        type: 'direct',
        retrograde: false,
        at: window.to,
        sign: committedSignAt(window.planet, window.to),
        sourceId: 'src/data/sky.json',
      }));
    }

    expect(stations.some((event) => event.at.startsWith('2026-'))).toBe(true);
    expect(stations.some((event) => event.at.startsWith('2028-'))).toBe(true);
    expect(events.filter((event) => event.kind !== 'station').every((event) => event.at.startsWith('2027-')))
      .toBe(true);
  });

  it('renders the complete catalog inside the strict yearly word bounds', async () => {
    const { input, program, violations } = await expectedHoroscopeProgram();
    expect(violations).toEqual([]);
    expect(input.yearlyEvents).toHaveLength(26);
    for (const entry of program.signs) {
      const reading = entry.readings['yearly-2027'];
      expect(reading.wordCount, entry.sign).toBeGreaterThanOrEqual(HOROSCOPE_WORD_BOUNDS['yearly-2027'].min);
      expect(reading.wordCount, entry.sign).toBeLessThanOrEqual(HOROSCOPE_WORD_BOUNDS['yearly-2027'].max);
    }
  });
});

describe('strict 2026 horoscope fact catalog', () => {
  const tableStart = (skyData as { from: string }).from;
  const overlapping2026 = (skyData as { retrogrades: RetrogradeWindow[] }).retrogrades
    .filter((window) => window.from < '2027-01-01T00:00:00.000Z' && (window.to === null || window.to > '2026-01-01T00:00:00.000Z'));

  it('keeps only the direct station of a retrograde already under way where sky.json begins', async () => {
    const clipped = overlapping2026.filter((window) => window.from === tableStart);
    expect(clipped.map((window) => window.planet).sort()).toEqual(['Jupiter', 'Uranus']);

    const events = await yearlyEvents(2026);
    const stations = events.filter((event) => event.kind === 'station');
    expect(stations.some((event) => event.at === tableStart)).toBe(false);
    expect(stations).toHaveLength(overlapping2026.length * 2 - clipped.length);
    for (const window of clipped) {
      expect(stations).toContainEqual(expect.objectContaining({ planet: window.planet, type: 'direct', at: window.to }));
    }
    expect(events.filter((event) => event.kind !== 'station').every((event) => event.at.startsWith('2026-'))).toBe(true);
  });

  it('lists the slow planets\' 2026 sign changes and the four 2026 eclipses', async () => {
    const events = await yearlyEvents(2026);
    expect(events.filter((event) => event.kind === 'ingress').map((event) => `${event.planet} ${event.sign} ${event.at.slice(0, 10)}`)).toEqual([
      'Neptune aries 2026-01-26',
      'Saturn aries 2026-02-14',
      'Uranus gemini 2026-04-26',
      'Jupiter leo 2026-06-30',
    ]);
    expect(events.filter((event) => event.kind === 'eclipse').map((event) => `${event.type} ${event.sign} ${event.at.slice(0, 10)}`)).toEqual([
      'solar aquarius 2026-02-17',
      'lunar virgo 2026-03-03',
      'solar leo 2026-08-12',
      'lunar pisces 2026-08-28',
    ]);
  });

  it('renders the complete catalog inside the strict yearly word bounds', async () => {
    const { input, program, violations } = await expectedHoroscopeProgram();
    expect(violations).toEqual([]);
    expect(input.yearlyEvents2026).toHaveLength(28);
    expect(program.coverage.yearly2026).toBe('complete');
    for (const entry of program.signs) {
      const reading = entry.readings['yearly-2026'];
      expect(reading.wordCount, entry.sign).toBeGreaterThanOrEqual(HOROSCOPE_WORD_BOUNDS['yearly-2026'].min);
      expect(reading.wordCount, entry.sign).toBeLessThanOrEqual(HOROSCOPE_WORD_BOUNDS['yearly-2026'].max);
    }
  });
});

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

describe('computed daily horoscope editions', () => {
  // Before the alternate frames, Gemini and Virgo's tomorrow readings in these
  // editions measured 0.402 against the 0.4 limit and blocked publication.
  it.each(['2026-10-08', '2026-10-10'])('passes both validators for the %s edition', async (anchorDate) => {
    const isoDay = new Date(`${anchorDate}T00:00:00.000Z`).getUTCDay() || 7;
    const dates = [...new Set([
      anchorDate,
      addDays(anchorDate, 1),
      ...Array.from({ length: 7 }, (_, index) => addDays(anchorDate, index + 1 - isoDay)),
    ])].sort();
    const input = {
      anchorDate,
      dailySnapshots: await Promise.all(dates.map((date) => (
        computeDailySnapshot(date, HOROSCOPE_REPO_ROOT) as Promise<Daily>
      ))),
      yearlyEvents: await yearlyEvents(),
      yearlyEvents2026: await yearlyEvents(2026),
    };
    const program = buildHoroscopeProgram(input);
    expect(validateHoroscopeProgramAgainstInput(input, program)).toEqual([]);
    expect(verifyHoroscopeProgramCopy(program)).toEqual([]);
  });
});
