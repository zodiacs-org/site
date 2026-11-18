import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The due-date tool is exempt from the under-13 refusal on purpose (the
 * 9 November 2026 audit, Decision C): it is a date-only sky reader that takes
 * no name, no place and no save, and hands no chart on. Children's names,
 * places and coordinates are what took the baby occasion out of the hosted
 * tools in 0.6.5, so this test keeps the tool from growing any of them. If it
 * ever needs one, it stops being exempt and takes the birth date policy.
 */
const source = readFileSync(new URL('./BabyZodiac.tsx', import.meta.url), 'utf8');
const imports = [...source.matchAll(/^import[\s\S]*?from\s*'([^']+)';?$/gmu)].map((match) => match[1]);

describe('BabyZodiac stays a date-only sky reader', () => {
  it('imports no birth fields, place search, profile store or chart handoff', () => {
    expect(imports.length).toBeGreaterThan(0);
    for (const specifier of imports) {
      expect(specifier, specifier).not.toMatch(/BirthFields|PlaceSearch|\/profile\/|chart-handoff/u);
    }
    expect(source).not.toMatch(/\bBirthFields\b|\bPlaceSearch\b|chart-handoff|lib\/profile\//u);
  });

  it('has no name field and saves nothing', () => {
    expect(source).not.toMatch(/autoComplete="name"|autocomplete="name"|id="[^"]*name[^"]*"/iu);
    expect(source).not.toMatch(/localStorage|sessionStorage|saveChart|upsertChart/u);
  });
});
