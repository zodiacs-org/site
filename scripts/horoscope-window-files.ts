/**
 * Files and replay for the assistant horoscope window
 * (src/ai-tools/horoscope/window.ts). The daily workflow builds it after the
 * day's program; tests and the workflow verify it.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HoroscopeProgram } from '../src/lib/horoscope-program-types';
import type { Daily } from '../src/lib/daily';
import {
  WINDOW_OFFSETS,
  WINDOW_SURFACES,
  addDays,
  buildHoroscopeWindow,
  windowProblems,
  type HoroscopeWindow,
} from '../src/ai-tools/horoscope/window';
import {
  HOROSCOPE_PROGRAM_PATH,
  HOROSCOPE_REPO_ROOT,
  computeHoroscopeEdition,
} from './horoscope-program-files';
import { verifyHoroscopeProgramCopy } from './independent-copy-verifier';

export const HOROSCOPE_WINDOW_PATH = resolve(HOROSCOPE_REPO_ROOT, 'src/data/horoscope-window.json');

/** Violations on surfaces the window leaves out (the website's tomorrow and 2027 pages) do not block it. */
const OUTSIDE_WINDOW = /readings\.(?:tomorrow|yearly-2027)\b|\.(?:tomorrow|yearly-2027)(?:\.|$)/u;
export function blocksWindow(path: string): boolean {
  return !OUTSIDE_WINDOW.test(path);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

export async function readCommittedWindowInputs(): Promise<{ daily: Daily; program: HoroscopeProgram }> {
  const daily = await readJson<Daily>(resolve(HOROSCOPE_REPO_ROOT, 'src/data/daily.json'));
  const program = await readJson<HoroscopeProgram>(HOROSCOPE_PROGRAM_PATH);
  if (program.anchorDate !== daily.date) {
    throw new Error(`horoscope-window: the committed program is for ${program.anchorDate}, the daily date is ${daily.date}`);
  }
  return { daily, program };
}

/**
 * Recompute the window around the committed program: its neighbours come from
 * the deterministic builder, the centre is the committed program itself.
 */
export async function expectedHoroscopeWindow(): Promise<{ window: HoroscopeWindow; violations: string[] }> {
  const { program } = await readCommittedWindowInputs();
  const violations: string[] = [];
  const programs: HoroscopeProgram[] = [];
  for (const offset of WINDOW_OFFSETS) {
    if (offset === 0) { programs.push(program); continue; }
    const edition = await computeHoroscopeEdition(addDays(program.anchorDate, offset));
    for (const failure of edition.violations) {
      if (blocksWindow(failure.path)) violations.push(`${edition.program.anchorDate} ${failure.ruleId} ${failure.path}: ${failure.message}`);
    }
    for (const failure of verifyHoroscopeProgramCopy(edition.program)) {
      if (blocksWindow(failure.path)) violations.push(`${edition.program.anchorDate} ${failure.ruleId} ${failure.path}: ${failure.message}`);
    }
    programs.push(edition.program);
  }
  const window = buildHoroscopeWindow(program.anchorDate, programs);
  violations.push(...windowProblems(window));
  return { window, violations };
}

/**
 * Checks that need no recomputation: the window is sound, centred on the
 * committed daily date, and its centre edition is the committed program's.
 */
export function quickWindowProblems(window: HoroscopeWindow, program: HoroscopeProgram): string[] {
  const problems = windowProblems(window);
  if (window.generatedFor !== program.anchorDate) {
    problems.push(`window is for ${window.generatedFor}, the committed program is for ${program.anchorDate}`);
  }
  if (JSON.stringify(window.policy) !== JSON.stringify(program.policy)) problems.push('window policy differs from the program');
  const centre = window.editions.find((edition) => edition.anchorDate === program.anchorDate);
  if (centre) {
    for (const entry of program.signs) {
      for (const surface of WINDOW_SURFACES) {
        const expected = entry.readings[surface];
        const actual = centre.signs[entry.sign]?.[surface];
        if (!actual || JSON.stringify(actual.passages) !== JSON.stringify(expected.passages)
          || actual.title !== expected.title || actual.status !== expected.status) {
          problems.push(`${program.anchorDate} ${entry.sign} ${surface} differs from the committed program`);
        }
      }
    }
  }
  return problems;
}

export function serializeWindow(window: HoroscopeWindow): string {
  return `${JSON.stringify(window)}\n`;
}
