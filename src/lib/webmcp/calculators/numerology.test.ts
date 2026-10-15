import { describe, expect, it } from 'vitest';
import { NumerologyInputError, numerologyProfile, type NumerologyProfile } from '../../numerology';
import { islandFunction } from './island-code';
import { numerologyResult } from './numerology';

// NumerologyCalculator's compute, the code /numerology/ reckons with.
const compute = islandFunction('NumerologyCalculator.tsx', { function: 'compute' });

const page = (date: string, name: string, today: string) => compute(
  { numerologyProfile, NumerologyInputError, lifePathExample: () => '' },
  { name, date, today },
  [],
) as { profile: NumerologyProfile; nameEmptied: boolean };

const reduction = (value: { value: number; total: number; chain: number[]; karmicDebt: unknown } | null | undefined) => (
  value ? { value: value.value, total: value.total, chain: value.chain, karmicDebt: value.karmicDebt } : null
);

describe('the numerology tool reckons what /numerology/ shows', () => {
  it.each([
    ['a name and a date', '1990-06-15', 'Alex Synthetic Example', '2026-10-15'],
    ['a master number', '1983-11-29', 'Sam Placeholder', '2026-10-15'],
    ['accents', '2001-02-03', 'Zoë Ångström Exemplo', '2026-01-01'],
    ['Y read by its neighbours', '1975-07-04', 'Yvonne Mayberry', '2026-12-31'],
    ['a name with nothing left', '1999-12-31', 'Dr. 123', '2026-10-15'],
    ['no name', '1800-01-01', '', '2199-12-31'],
  ])('%s', (_label, date, name, today) => {
    const shown = page(date, name, today);
    const result = numerologyResult(date, name === '' ? null : name, today);
    const { profile } = shown;
    expect(result.lifePath).toEqual(reduction(profile.date.lifePath));
    expect(result.birthday).toEqual(reduction(profile.date.birthday));
    expect(result.attitude).toBe(profile.date.attitude);
    expect(result.expression).toEqual(reduction(profile.name?.expression));
    expect(result.soulUrge).toEqual(reduction(profile.name?.soulUrge));
    expect(result.personality).toEqual(reduction(profile.name?.personality));
    expect(result.maturity).toEqual(reduction(profile.maturity));
    expect(result.personalCycles).toEqual(profile.personalCycles);
    expect(result.karmicDebts).toEqual(profile.karmicDebts);
    expect(result.nameUsed).toBe(profile.name !== null);
  });

  it('refuses letters outside A to Z, as the page does', () => {
    expect(() => numerologyResult('1990-06-15', 'Алекс', '2026-10-15')).toThrow(NumerologyInputError);
    expect(() => page('1990-06-15', 'Алекс', '2026-10-15')).toThrow(NumerologyInputError);
  });
});
