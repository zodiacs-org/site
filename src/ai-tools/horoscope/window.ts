/**
 * The assistant horoscope window: the daily editions for the committed daily
 * date and the days either side of it. A reader's local date is always one of
 * those three somewhere in the world, so each reader gets the edition written
 * for their own today and its words ("today", "this evening") stay true.
 *
 * scripts/build-horoscope-window.ts writes src/data/horoscope-window.json from
 * the same deterministic builder as the website's program; the get_horoscope
 * tool reads it. This module is pure so both can share it.
 */
import type {
  HoroscopeEvidenceReceipt,
  HoroscopePassage,
  HoroscopeProgram,
  HoroscopeReading,
  HoroscopeSign,
} from '../../lib/horoscope-program-types';

export const HOROSCOPE_WINDOW_SCHEMA = 'zodiacs.horoscope-window.v1';
/** The edition offsets around the committed daily date, in days. */
export const WINDOW_OFFSETS = [-1, 0, 1] as const;
/** The program surfaces an assistant reads. "tomorrow" is the next edition's "today". */
export const WINDOW_SURFACES = ['today', 'love', 'career', 'weekly'] as const;
export type WindowSurface = typeof WINDOW_SURFACES[number];

export type WindowReading = Pick<HoroscopeReading, 'surface' | 'period' | 'title' | 'status' | 'passages'> & {
  fallbackReason?: string;
};

export interface WindowEdition {
  anchorDate: string;
  signs: Record<HoroscopeSign, Record<WindowSurface, WindowReading>>;
}

export interface HoroscopeWindow {
  schema: typeof HOROSCOPE_WINDOW_SCHEMA;
  /** The committed daily date (UTC) the window is centred on. */
  generatedFor: string;
  policy: HoroscopeProgram['policy'];
  editions: WindowEdition[];
  /** Every receipt the window's readings cite, keyed by its stable ID. */
  evidence: Record<string, HoroscopeEvidenceReceipt>;
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function windowDates(generatedFor: string): string[] {
  return WINDOW_OFFSETS.map((offset) => addDays(generatedFor, offset));
}

/** The receipts a reading cites, plus the facts its solar-house mappings rest on. */
export function evidenceClosure(
  passages: readonly HoroscopePassage[],
  evidence: ReadonlyMap<string, HoroscopeEvidenceReceipt>,
): string[] {
  const ids = new Set(passages.flatMap((passage) => passage.evidenceRefs));
  for (const id of [...ids]) {
    const sourceFactId = evidence.get(id)?.sourceFactId;
    if (sourceFactId) ids.add(sourceFactId);
  }
  return [...ids].sort();
}

/** Build the window from the three programs, oldest first. Throws on any inconsistency. */
export function buildHoroscopeWindow(
  generatedFor: string,
  programs: readonly HoroscopeProgram[],
): HoroscopeWindow {
  const expected = windowDates(generatedFor);
  const actual = programs.map((program) => program.anchorDate);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Horoscope window for ${generatedFor} needs editions ${expected.join(', ')}; got ${actual.join(', ')}`);
  }
  const policy = programs[WINDOW_OFFSETS.indexOf(0)].policy;
  if (programs.some((program) => JSON.stringify(program.policy) !== JSON.stringify(policy))) {
    throw new Error('Horoscope window editions were built under different policies');
  }
  const evidence = new Map<string, HoroscopeEvidenceReceipt>();
  const editions = programs.map((program): WindowEdition => {
    const byId = new Map(program.evidence.map((receipt) => [receipt.id, receipt]));
    const signs = {} as WindowEdition['signs'];
    for (const entry of program.signs) {
      const readings = {} as Record<WindowSurface, WindowReading>;
      for (const surface of WINDOW_SURFACES) {
        const reading = entry.readings[surface];
        readings[surface] = {
          surface: reading.surface,
          period: reading.period,
          title: reading.title,
          status: reading.status,
          ...(reading.fallbackReason ? { fallbackReason: reading.fallbackReason } : {}),
          passages: reading.passages,
        };
        for (const id of evidenceClosure(reading.passages, byId)) {
          const receipt = byId.get(id);
          if (!receipt) throw new Error(`${program.anchorDate} ${entry.sign} ${surface} cites missing evidence ${id}`);
          const known = evidence.get(id);
          if (known && JSON.stringify(known) !== JSON.stringify(receipt)) {
            throw new Error(`Evidence ${id} differs between horoscope editions`);
          }
          evidence.set(id, receipt);
        }
      }
      signs[entry.sign] = readings;
    }
    return { anchorDate: program.anchorDate, signs };
  });
  return {
    schema: HOROSCOPE_WINDOW_SCHEMA,
    generatedFor,
    policy,
    editions,
    evidence: Object.fromEntries([...evidence].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))),
  };
}

/** Structural problems with a window, as plain messages. Empty means sound. */
export function windowProblems(window: HoroscopeWindow): string[] {
  const problems: string[] = [];
  if (window.schema !== HOROSCOPE_WINDOW_SCHEMA) problems.push(`schema is ${String(window.schema)}`);
  const dates = window.editions.map((edition) => edition.anchorDate);
  if (JSON.stringify(dates) !== JSON.stringify(windowDates(window.generatedFor))) {
    problems.push(`editions ${dates.join(', ')} do not surround ${window.generatedFor}`);
  }
  for (const edition of window.editions) {
    for (const [sign, readings] of Object.entries(edition.signs)) {
      for (const surface of WINDOW_SURFACES) {
        const reading = readings[surface];
        if (!reading) { problems.push(`${edition.anchorDate} ${sign} has no ${surface} reading`); continue; }
        for (const passage of reading.passages) {
          for (const id of passage.evidenceRefs) {
            if (!window.evidence[id]) problems.push(`${edition.anchorDate} ${sign} ${surface} cites missing evidence ${id}`);
          }
        }
        if (surface !== 'weekly' && (reading.period.from !== edition.anchorDate || reading.period.through !== edition.anchorDate)) {
          problems.push(`${edition.anchorDate} ${sign} ${surface} covers ${reading.period.from}–${reading.period.through}`);
        }
      }
    }
  }
  for (const receipt of Object.values(window.evidence)) {
    if (receipt.sourceFactId && !window.evidence[receipt.sourceFactId]) {
      problems.push(`evidence ${receipt.id} rests on missing fact ${receipt.sourceFactId}`);
    }
  }
  return problems;
}
