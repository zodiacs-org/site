/**
 * Phase 4 proof fixture — Frida Kahlo × Diego Rivera synastry, computed
 * with the repo's own engine so no aspect, orb, sign, or degree in the
 * handoff or proofs is invented. Regenerate with:
 *
 *   npx vite-node docs/acceptance/phase4-sharing/assets/compute-fixture.mts
 *
 * Frida matches the committed demo chart (src/data/demo-chart-frida.json);
 * the script fails if the recomputed Sun drifts from that file's value.
 * Diego's birth facts are public record (December 8, 1886, Guanajuato);
 * his time is treated as unknown, so his Moon is the noon estimate — the
 * proofs deliberately exercise the no-time notice with him.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeChart } from '../../../../src/lib/engine/full';
import { summarizePair, type MinimalBody } from '../../../../src/lib/engine/synastry';
import { prepareLocalTime, resolveLocalToUtc } from '../../../../src/lib/time/localToUtc';
import { degreeInSign, signForLongitude } from '../../../../src/lib/signs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../../../..');

interface Side {
  label: string;
  date: string;
  time: string | null;
  timeKnown: boolean;
  lat: number;
  lon: number;
  tz: string;
  place: string;
}

const FRIDA: Side = {
  label: 'Frida Kahlo',
  date: '1907-07-06',
  time: '08:30',
  timeKnown: true,
  lat: 19.3467,
  lon: -99.1617,
  tz: 'America/Mexico_City',
  place: 'Coyoacán, Mexico',
};

const DIEGO: Side = {
  label: 'Diego Rivera',
  date: '1886-12-08',
  time: null,
  timeKnown: false,
  lat: 21.019,
  lon: -101.2574,
  tz: 'America/Mexico_City',
  place: 'Guanajuato, Mexico',
};

// Both dates are before 1970, so the engine's resolver loads the zone's history first.
async function chartFor(side: Side) {
  await prepareLocalTime(side.date, side.tz);
  const resolved = resolveLocalToUtc(
    side.date,
    side.timeKnown && side.time ? side.time : '12:00',
    side.tz,
  );
  const chart = computeChart({
    utc: resolved.utc,
    latitude: side.lat,
    longitude: side.lon,
    houseSystem: 'whole',
    timeKnown: side.timeKnown,
    flags: resolved.flags,
  });
  return { chart, utcISO: resolved.utc.toISOString() };
}

const describe = (lon: number) => {
  const sign = signForLongitude(lon);
  return { lon: Number(lon.toFixed(4)), sign: sign.name, slug: sign.slug, degree: Number(degreeInSign(lon).toFixed(1)) };
};

const a = await chartFor(FRIDA);
const b = await chartFor(DIEGO);

// Cross-check against the committed demo chart — fail loudly on drift.
const demo = JSON.parse(readFileSync(join(repo, 'src/data/demo-chart-frida.json'), 'utf8')) as {
  bodies: { body: string; lon: number }[];
};
const demoSun = demo.bodies.find((x) => x.body === 'Sun')!.lon;
const computedSun = a.chart.bodies.find((x) => x.body === 'Sun')!.lon;
if (Math.abs(demoSun - computedSun) > 0.01) {
  throw new Error(`Frida Sun drift: demo ${demoSun} vs computed ${computedSun}`);
}

const minimal = (chart: typeof a.chart): MinimalBody[] => chart.bodies.map(({ body, lon }) => ({ body, lon }));
const summary = summarizePair(minimal(a.chart), minimal(b.chart), 8);

const person = (side: Side, entry: typeof a) => ({
  label: side.label,
  input: { date: side.date, time: side.time, timeKnown: side.timeKnown, lat: side.lat, lon: side.lon, tz: side.tz, place: side.place },
  utc: entry.utcISO,
  sun: describe(entry.chart.bodies.find((x) => x.body === 'Sun')!.lon),
  moon: describe(entry.chart.bodies.find((x) => x.body === 'Moon')!.lon),
  asc: side.timeKnown && entry.chart.angles ? describe(entry.chart.angles.asc) : null,
});

const out = {
  note: 'Computed by the repo engine via compute-fixture.mts — do not hand-edit.',
  engineVersion: a.chart.engineVersion,
  a: person(FRIDA, a),
  b: person(DIEGO, b),
  summary: {
    easeful: summary.easeful,
    charged: summary.charged,
    top: summary.top.map((hit) => ({
      a: hit.a,
      b: hit.b,
      type: hit.type,
      orb: Number(hit.orb.toFixed(1)),
    })),
  },
};

writeFileSync(join(here, 'fixture-frida-diego.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
