import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  buildHoroscopeProgram,
  validateHoroscopeProgramAgainstInput,
  type BuildHoroscopeProgramInput,
  type HoroscopeProgram,
  type HoroscopeProgramEvent,
  type HoroscopeProgramViolation,
} from '../src/lib/horoscope-program';
import type { Daily } from '../src/lib/daily';
import { computeDailySnapshot } from './daily-snapshot-lib.mjs';

export const HOROSCOPE_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const HOROSCOPE_PROGRAM_PATH = resolve(HOROSCOPE_REPO_ROOT, 'src/data/horoscope-program.json');

interface IngressWindow {
  planet: string;
  sign: string;
  from: string;
  to: string;
}

interface SkyRetrograde {
  planet: string;
  from: string;
  to: string | null;
}

interface EclipseRecord {
  type: 'solar' | 'lunar';
  kind: string;
  peak: string;
  sign: string;
  degree: number;
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function isoWeekDates(anchorDate: string): string[] {
  const value = new Date(`${anchorDate}T00:00:00.000Z`);
  const day = value.getUTCDay() || 7;
  const monday = addDays(anchorDate, 1 - day);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(resolve(HOROSCOPE_REPO_ROOT, relativePath), 'utf8')) as T;
}

function signAt(windows: readonly IngressWindow[], planet: string, at: string): string {
  const window = windows.find((candidate) => (
    candidate.planet === planet && candidate.from <= at && at < candidate.to
  ));
  if (!window) throw new Error(`No ingress window covers ${planet} at ${at}`);
  return window.sign;
}

/** The slow planets whose sign changes a yearly edition narrates. */
const YEAR_INGRESS_PLANETS = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);

/**
 * A yearly edition's events: the slow planets' ingresses and the eclipses in
 * the year, and both stations of every retrograde period that overlaps it.
 * sky.json starts on its `from` date, so a retrograde already under way then
 * is listed from that instant; that is the table's edge, not a station, and
 * only its direct station is kept.
 */
export async function yearlyEvents(year: 2026 | 2027 = 2027): Promise<HoroscopeProgramEvent[]> {
  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;
  const overlapsYear = (event: SkyRetrograde) => event.from < yearEnd && (event.to === null || event.to > yearStart);
  const ingresses = await readJson<{ windows: IngressWindow[] }>('src/data/ingresses.json');
  const sky = await readJson<{ from: string; retrogrades: SkyRetrograde[] }>('src/data/sky.json');
  const eclipses = await readJson<{ eclipses: EclipseRecord[] }>('src/data/eclipses.json');
  const tableStart = new Date(sky.from).toISOString();

  const majorIngresses: HoroscopeProgramEvent[] = ingresses.windows
    .filter((window) => window.from.startsWith(`${year}-`) && YEAR_INGRESS_PLANETS.has(window.planet))
    .map((window) => ({
      kind: 'ingress',
      planet: window.planet,
      sign: window.sign,
      degree: 0,
      at: window.from,
      sourceId: 'src/data/ingresses.json',
    }));

  const eclipseEvents: HoroscopeProgramEvent[] = eclipses.eclipses
    .filter((event) => event.peak.startsWith(`${year}-`))
    .map((event) => ({
      kind: 'eclipse',
      type: event.type,
      sign: event.sign,
      degree: event.degree,
      at: event.peak,
      sourceId: 'src/data/eclipses.json',
    }));

  const stationEvents: HoroscopeProgramEvent[] = sky.retrogrades
    .filter(overlapsYear)
    .flatMap((event) => {
      if (event.to === null) {
        throw new Error(
          `Retrograde period ${event.planet} from ${event.from} overlaps ${year} but has no direct-station boundary`,
        );
      }
      const stations: HoroscopeProgramEvent[] = [
        {
          kind: 'station' as const,
          planet: event.planet,
          type: 'retrograde',
          retrograde: true,
          sign: signAt(ingresses.windows, event.planet, event.from),
          at: event.from,
          sourceId: 'src/data/sky.json',
        },
        {
          kind: 'station' as const,
          planet: event.planet,
          type: 'direct',
          retrograde: false,
          sign: signAt(ingresses.windows, event.planet, event.to),
          at: event.to,
          sourceId: 'src/data/sky.json',
        },
      ];
      return event.from === tableStart ? stations.slice(1) : stations;
    });

  return [...majorIngresses, ...eclipseEvents, ...stationEvents]
    .sort((left, right) => left.at.localeCompare(right.at));
}

export async function expectedHoroscopeProgram(
  requestedDate?: string,
): Promise<{
  input: BuildHoroscopeProgramInput;
  program: HoroscopeProgram;
  violations: HoroscopeProgramViolation[];
}> {
  const committedDaily = await readJson<Daily>('src/data/daily.json');
  const anchorDate = requestedDate ?? committedDaily.date;
  if (anchorDate !== committedDaily.date) {
    throw new Error(`Horoscope program date ${anchorDate} does not match committed daily date ${committedDaily.date}`);
  }
  return computeHoroscopeEdition(anchorDate);
}

/**
 * The edition for any anchor date, computed exactly as the committed program
 * is. The assistant window (scripts/horoscope-window-files.ts) uses it for the
 * days either side of the committed date.
 */
export async function computeHoroscopeEdition(
  anchorDate: string,
): Promise<{
  input: BuildHoroscopeProgramInput;
  program: HoroscopeProgram;
  violations: HoroscopeProgramViolation[];
}> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate) || addDays(anchorDate, 0) !== anchorDate) {
    throw new Error(`Horoscope edition date ${anchorDate} is not a calendar date`);
  }
  const snapshotDates = [...new Set([
    anchorDate,
    addDays(anchorDate, 1),
    ...isoWeekDates(anchorDate),
  ])].sort();
  const dailySnapshots = await Promise.all(
    snapshotDates.map((date) => computeDailySnapshot(date, HOROSCOPE_REPO_ROOT) as Promise<Daily>),
  );
  const input: BuildHoroscopeProgramInput = {
    anchorDate,
    dailySnapshots,
    yearlyEvents: await yearlyEvents(2027),
    yearlyEvents2026: await yearlyEvents(2026),
  };
  const program = buildHoroscopeProgram(input);
  const violations = validateHoroscopeProgramAgainstInput(input, program);
  return { input, program, violations };
}
