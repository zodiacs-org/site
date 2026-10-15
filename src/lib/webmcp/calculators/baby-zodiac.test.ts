import { describe, expect, it } from 'vitest';
import sky from '../../../data/sky.json';
import { birthdaySlug } from '../../birthdays';
import * as engine from '../../engine/full';
import { signForLongitude } from '../../signs';
import { babyZodiacResult } from './baby-zodiac';
import { islandFunction, ref } from './island-code';

interface Reading {
  dueISO: string;
  sun: { kind: 'single'; sign: { name: string }; nearEdge: { name: string } | null } | { kind: 'split'; a: { name: string }; b: { name: string } };
  moonSpans: Array<{ fromISO: string; toISO: string; sign: { name: string } }>;
  retro: string[];
  birthdayHref: string;
}

// BabyZodiac's compute, the code /baby-zodiac/ reads a due date with.
const compute = islandFunction('BabyZodiac.tsx', { const: 'compute' });
const DAY = islandFunction('BabyZodiac.tsx', { const: 'DAY' }, { value: true })({});

async function page(due: string) {
  const state: { reading: Reading | null; error: string | null } = { reading: null, error: null };
  await compute({
    due, DAY, locale: 'en', loadEngine: async () => engine, signForLongitude, sky, birthdaySlug, focusAfterComputeRef: ref(false),
    setReading: (value: Reading | null) => { state.reading = value; },
    setError: (value: string | null) => { state.error = value; },
    t: (_locale: string, key: string) => key, calculationError: (_e: unknown, _l: string, fallback: string) => fallback,
  }, { preventDefault() {} });
  return state;
}

describe('the baby-zodiac tool reads what /baby-zodiac/ shows', () => {
  it.each([
    ['a plain date', '2027-02-10'],
    ['the Sun changing sign that day', '2026-12-21'],
    ['the Sun near a sign\'s edge', '2026-03-20'],
    ['planets retrograde', '2026-07-30'],
    ['the first date', '1990-01-01'],
    ['the last date', '2028-12-31'],
    ['a leap day', '2028-02-29'],
  ])('%s', async (_label, due) => {
    const shown = await page(due);
    expect(shown.error).toBeNull();
    const reading = shown.reading!;
    const result = babyZodiacResult(due);
    expect(result.computedUtc).toBe(reading.dueISO);
    expect(result.sun).toEqual(reading.sun.kind === 'split'
      ? { changesSignThatDay: true, signs: [reading.sun.a.name, reading.sun.b.name], nearEdge: null }
      : { changesSignThatDay: false, signs: [reading.sun.sign.name], nearEdge: reading.sun.nearEdge?.name ?? null });
    expect(result.moonSpans).toEqual(reading.moonSpans.map((span) => ({ from: span.fromISO, to: span.toISO, sign: span.sign.name })));
    expect(result.birthdayPage).toBe(`https://zodiacs.org${reading.birthdayHref}`);
    const covered = due >= sky.from.slice(0, 10) && due < sky.to.slice(0, 10);
    // Within the table's span the tool lists what the page lists; outside it the page lists nothing and the tool
    // says it cannot tell, rather than "none".
    expect(result.retrograde).toEqual(covered ? reading.retro : null);
    if (!covered) expect(reading.retro).toEqual([]);
  });

  it('includes a date with planets retrograde, and one the table does not cover', () => {
    expect(babyZodiacResult('2026-07-30').retrograde!.length).toBeGreaterThan(0);
    expect(babyZodiacResult('1990-01-01').retrograde).toBeNull();
  });
});
