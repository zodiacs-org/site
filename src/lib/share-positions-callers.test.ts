import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Every chart code that leaves the device is made by one of the encoders
 * below, and each keeps ASC and MC to the whole degree. A chart without a
 * birth time has a second rule: its own positions are noon at the birthplace,
 * an instant that gives the place away, so a code made from it carries the
 * sky at 12:00 UTC on the birth date instead (share-positions-noon.ts). This
 * lists every production call of those encoders with how it keeps the
 * second rule; a new call fails here until someone decides and lists it.
 */
const ENCODERS = [
  'encodeSharedPositionsLink',
  'encodeSynastryLink',
  'encodeCardLink',
  'calendarToken',
  'deriveInviteChartFromSyncedPayload',
] as const;

const PRODUCERS: Record<string, { how: string; mustUse: string[] }> = {
  'src/lib/share-positions.ts': {
    how: 'defines encodeSharedPositionsLink, which keeps ASC and MC to the whole degree',
    mustUse: ['return encodePositionsLink({ ...input, angles: wholeDegreeAngles(angles) });'],
  },
  'src/islands/ChartShareDialog.tsx': {
    how: 'a chart without a birth time is linked from loadUntimedSharedPositions on its birth date',
    mustUse: ['chart.input.timeKnown', 'loadUntimedSharedPositions(base, birthDate)'],
  },
  'src/islands/CalendarSubscribe.tsx': {
    how: 'given a birth date (only for a chart without a birth time), the feed code comes from loadUntimedSharedPositions',
    mustUse: ['loadUntimedSharedPositions({ houseSystem, engineVersion }, birthDate)', 'timeUnknown ? untimed : direct'],
  },
  'src/lib/share-synastry.ts': {
    how: 'encodes the two sides it is given; sendBackToken gives it untimed sides at noon UTC',
    mustUse: [],
  },
  'src/islands/synastry/SendBackExperience.tsx': {
    how: 'a side with an untimedDate goes through loadUntimedSharedPositions; a received side passes on unchanged',
    mustUse: ['loadUntimedSharedPositions(person.positions, person.untimedDate)', 'untimed ? untimedToken : direct'],
  },
  'src/lib/invite/validate.ts': {
    how: 'a synced chart without a birth time becomes untimedSharedPositions with the server ephemeris, or no invitation',
    mustUse: ['untimedSharedPositions(base, birth.date, bodiesAt)'],
  },
  'src/lib/invite/routes/invites.ts': {
    how: 'passes the server ephemeris for the noon-UTC positions',
    mustUse: ["import('../../engine/server-ephemeris.js')"],
  },
  'src/lib/profile/card-link.ts': {
    how: 'cards are made from cardPositionsForChart; decoding and matching re-encode codes already made',
    mustUse: ['untimedSharedPositions(positions, chart.birth.date, bodiesAt)'],
  },
  'src/islands/ProfileIdentity.tsx': {
    how: 'makes the card from loadCardPositionsForChart',
    mustUse: ['loadCardPositionsForChart(chart)'],
  },
};

/** Every chart built by the calculators and passed to a producer's untimed path. */
const UNTIMED_DATE_SOURCES: Record<string, string[]> = {
  'src/islands/ChartCalculator.tsx': ["birthDate={chart.input.timeKnown ? undefined : computedInput?.date ?? ''}"],
  'src/islands/SynastryCalculator.tsx': [
    '...(resolved.timeKnown ? {} : { untimedDate: chart.birth.date })',
    '...(input.timeKnown ? {} : { untimedDate: input.date })',
    '...(timeKnown ? {} : { untimedDate: slot.date })',
    'untimedDate: result.a.untimedDate',
    'untimedDate: result.b.untimedDate',
  ],
};

const root = resolve(process.cwd());

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const production = [...walk(resolve(root, 'src')), ...walk(resolve(root, 'api'))]
  .filter((path) => /\.(?:ts|tsx|mjs|astro)$/u.test(path) && !/\.test\.|\.spec\./u.test(path))
  .map((path) => relative(root, path).split(sep).join('/'));

describe('producers of shared chart codes', () => {
  it('lists every production call of a shared-code encoder, each with how it treats a chart without a birth time', () => {
    const calling = production.filter((path) => {
      const source = readFileSync(resolve(root, path), 'utf8');
      return ENCODERS.some((name) => new RegExp(`\\b${name}\\(`, 'u').test(source));
    }).sort();
    expect(calling).toEqual(Object.keys(PRODUCERS).sort());
    for (const [path, { mustUse }] of Object.entries(PRODUCERS)) {
      const source = readFileSync(resolve(root, path), 'utf8');
      for (const text of mustUse) expect(source, `${path} must contain ${text}`).toContain(text);
    }
  });

  it('gives the untimed path the civil birth date wherever a chart without a birth time is computed', () => {
    for (const [path, texts] of Object.entries(UNTIMED_DATE_SOURCES)) {
      const source = readFileSync(resolve(root, path), 'utf8');
      for (const text of texts) expect(source, `${path} must contain ${text}`).toContain(text);
    }
  });
});
