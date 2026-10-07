import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildHoroscopeWindow, windowDates, type HoroscopeWindow } from '../src/ai-tools/horoscope/window';
import type { HoroscopeProgram } from '../src/lib/horoscope-program-types';
import { blocksWindow, quickWindowProblems, readCommittedWindowInputs } from './horoscope-window-files';

const committed = async () => JSON.parse(await readFile(new URL('../src/data/horoscope-window.json', import.meta.url), 'utf8')) as HoroscopeWindow;

describe('assistant horoscope window', () => {
  it('surrounds the committed daily program and matches it', async () => {
    const window = await committed();
    const { daily, program } = await readCommittedWindowInputs();
    expect(window.generatedFor).toBe(daily.date);
    expect(window.editions.map(edition => edition.anchorDate)).toEqual(windowDates(daily.date));
    expect(quickWindowProblems(window, program)).toEqual([]);
  });
  it('refuses editions that do not surround the date', async () => {
    const { program } = await readCommittedWindowInputs();
    const shifted = (date: string): HoroscopeProgram => ({ ...program, anchorDate: date });
    expect(() => buildHoroscopeWindow(program.anchorDate, [program, program, program])).toThrow(/needs editions/);
    const [before, , after] = windowDates(program.anchorDate);
    expect(() => buildHoroscopeWindow(program.anchorDate, [shifted(before), program, { ...shifted(after), policy: { ...program.policy, version: '9.9.9' as '1.0.0' } }])).toThrow(/different policies/);
  });
  it('lets problems on the website-only surfaces through and blocks the rest', () => {
    expect(blocksWindow('program.signs.gemini/virgo.readings.tomorrow')).toBe(false);
    expect(blocksWindow('program.signs[2].readings.yearly-2027.passages')).toBe(false);
    expect(blocksWindow('program.signs.gemini/virgo.readings.today')).toBe(true);
    expect(blocksWindow('program.coverage')).toBe(true);
  });
});
