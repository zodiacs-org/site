import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Every chart code that leaves the device is made by one of the encoders
 * below, and each keeps ASC and MC to the whole degree. The bodies it
 * carries follow two more rules (share-positions-noon.ts): a chart with a
 * birth time is shared at its UTC instant rounded to the whole minute, since
 * before standard time the instant's seconds give the birthplace's longitude;
 * a chart without one is shared as the sky at 12:00 UTC on its birth date,
 * since its own noon gives the place away. This lists every production call
 * of those encoders with how it keeps both rules; a new call fails here until
 * someone decides and lists it.
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
    how: 'a chart with a birth time is linked from loadTimedSharedPositions at its instant, one without from loadUntimedSharedPositions on its birth date',
    mustUse: ['chart.input.timeKnown', 'loadTimedSharedPositions({', '}, chart.input.utc)', 'loadUntimedSharedPositions(base, birthDate)'],
  },
  'src/islands/CalendarSubscribe.tsx': {
    how: 'given a birth date (only for a chart without a birth time) the feed code comes from loadUntimedSharedPositions; otherwise from the chart itself on a whole UTC minute, or from loadTimedSharedPositions',
    mustUse: [
      'loadUntimedSharedPositions({ houseSystem, engineVersion }, birthDate)',
      'const wholeMinute = !timeUnknown && onWholeMinute(utc);',
      'loadTimedSharedPositions({',
      'const token = wholeMinute ? direct : loaded;',
    ],
  },
  'src/lib/share-synastry.ts': {
    how: 'encodes the two sides it is given; sendBackToken gives it untimed sides at noon UTC and timed sides at the whole minute',
    mustUse: [],
  },
  'src/islands/synastry/SendBackExperience.tsx': {
    how: 'a side with an untimedDate goes through loadUntimedSharedPositions, one with a utc through loadTimedSharedPositions; a received side passes on unchanged',
    mustUse: [
      'loadUntimedSharedPositions(person.positions, person.untimedDate)',
      'loadTimedSharedPositions(person.positions, person.utc)',
      'const token = computed ? computedToken : direct;',
    ],
  },
  'src/lib/invite/validate.ts': {
    how: 'a synced chart becomes timedSharedPositions or untimedSharedPositions with the server ephemeris, or no invitation',
    mustUse: [
      'input = onWholeMinute(utc) ? own : bodiesAt ? timedSharedPositions(own, utc, bodiesAt) : null;',
      'untimedSharedPositions(base, birth.date, bodiesAt)',
    ],
  },
  'src/lib/invite/routes/invites.ts': {
    how: 'passes the server ephemeris for the positions at noon UTC or at the whole minute',
    mustUse: ["import('../../engine/server-ephemeris.js')"],
  },
  'src/lib/profile/card-link.ts': {
    how: 'cards are made from cardPositionsForChart; decoding and matching re-encode codes already made',
    mustUse: [
      'timedSharedPositions(positions, chart.summary.utcISO, bodiesAt)',
      'untimedSharedPositions(positions, chart.birth.date, bodiesAt)',
    ],
  },
  'src/islands/ProfileIdentity.tsx': {
    how: 'makes the card from loadCardPositionsForChart',
    mustUse: ['loadCardPositionsForChart(chart)'],
  },
};

/** Every chart built by the calculators and passed to a producer's untimed or timed path. */
const SHARE_INSTANT_SOURCES: Record<string, string[]> = {
  'src/islands/ChartCalculator.tsx': [
    "birthDate={chart.input.timeKnown ? undefined : computedInput?.date ?? ''}",
    'utc: chart.input.utc,',
  ],
  'src/islands/SynastryCalculator.tsx': [
    '...(resolved.timeKnown ? { utc: summary.utcISO } : { untimedDate: chart.birth.date })',
    '...(input.timeKnown ? { utc: resolved.utc } : { untimedDate: input.date })',
    '...(timeKnown ? { utc: resolved.utc } : { untimedDate: slot.date })',
    'a={result.a}',
    'b={result.b}',
  ],
  'src/islands/TransitTracker.tsx': [
    'return wheelFromChart(r, timeKnown, resolved.utc);',
    'return wheelFromChart(r, timeKnown, resolved.utc, chart.summary.houseSystem);',
    'utc: chart.summary.utcISO,',
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
    for (const [path, texts] of Object.entries(SHARE_INSTANT_SOURCES)) {
      const source = readFileSync(resolve(root, path), 'utf8');
      for (const text of texts) expect(source, `${path} must contain ${text}`).toContain(text);
    }
  });
});
