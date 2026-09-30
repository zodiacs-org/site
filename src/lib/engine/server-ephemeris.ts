/**
 * Node-only ephemeris primitives for serverless functions.
 *
 * `@zodiacs/engine` is browser-first ESM and imports named values from the
 * dual-mode `astronomy-engine` package. Vercel externalizes that dependency as
 * CommonJS, so this boundary deliberately selects its `require` export and
 * avoids relying on synthetic named exports.
 *
 * It computes what the engine's ephemeris computes, on the engine's clock.
 * Since @zodiacs/engine 0.1.1-rc.15 that clock reads an instant from 1972 to
 * 2027-10-02 as UTC, with TT from the leap seconds and UT1 from IERS
 * UT1 − UTC, and any other instant as UT1 with the ΔT model. The package does
 * not export that time basis, so `time-basis.mjs` carries its own compiled
 * code, bundled by scripts/build-time-basis.mjs. Each sample is then taken as
 * the engine takes it: astronomy-engine's time at the basis's UT1, with the
 * basis's ΔT held for that call.
 */
import { createRequire } from 'node:module';
import type * as AstronomyEngine from 'astronomy-engine';
import { deltaT } from '@zodiacs/engine/deltat';
import { EPHEMERIS_SPAN, elapsedDays, timeBasis, type TimeBasis } from './time-basis.mjs';
import type { BodyName } from './types';

const require = createRequire(import.meta.url);
const Astronomy = require('astronomy-engine') as typeof AstronomyEngine;
// This CommonJS instance of astronomy-engine is separate from the ESM one the
// engine installs its clock in, so it gets the same ΔT model here between
// calls (@zodiacs/engine/deltat imports nothing), as the engine leaves its own.
Astronomy.SetDeltaTFunction(deltaT);
const RAD = 180 / Math.PI;
const DAY = 86_400_000;

const PLANETS = [
  { name: 'Sun', body: Astronomy.Body.Sun },
  { name: 'Mercury', body: Astronomy.Body.Mercury },
  { name: 'Venus', body: Astronomy.Body.Venus },
  { name: 'Mars', body: Astronomy.Body.Mars },
  { name: 'Jupiter', body: Astronomy.Body.Jupiter },
  { name: 'Saturn', body: Astronomy.Body.Saturn },
  { name: 'Uranus', body: Astronomy.Body.Uranus },
  { name: 'Neptune', body: Astronomy.Body.Neptune },
  { name: 'Pluto', body: Astronomy.Body.Pluto },
] as const;

function normalizeLongitude(value: number): number {
  return ((value % 360) + 360) % 360;
}

/** astronomy-engine's time for a basis, as the engine makes it: UT1 days, with the basis's ΔT held. */
function timeOf(basis: TimeBasis): AstronomyEngine.AstroTime {
  const { from, to } = EPHEMERIS_SPAN.daysFromJ2000;
  if (!(basis.ttDays >= from && basis.ttDays <= to)) {
    throw new RangeError(
      'The instant is outside the ephemeris span: its Terrestrial Time, and that of each speed sample, must lie between 0001-04-30T12:00 and 3998-09-03T12:00 TT, the years astronomy-engine tabulates (EPHEMERIS_SPAN).',
    );
  }
  const seconds = basis.deltaT.seconds;
  Astronomy.SetDeltaTFunction(() => seconds);
  return Astronomy.MakeTime(basis.ut1Days);
}

/** Runs one calculation and puts the ΔT model back, whatever happens, as the engine does. */
function onEngineClock<T>(run: () => T): T {
  try {
    return run();
  } finally {
    Astronomy.SetDeltaTFunction(deltaT);
  }
}

function eclipticLongitude(body: AstronomyEngine.Body, time: AstronomyEngine.AstroTime): number {
  const equatorial = Astronomy.GeoVector(body, time, true);
  const ecliptic = Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECT(time), equatorial);
  return normalizeLongitude(Math.atan2(ecliptic.y, ecliptic.x) * RAD);
}

function trueNodeLongitude(time: AstronomyEngine.AstroTime): number {
  const state = Astronomy.GeoMoonState(time);
  const angularMomentum = {
    x: state.y * state.vz - state.z * state.vy,
    y: state.z * state.vx - state.x * state.vz,
    z: state.x * state.vy - state.y * state.vx,
  };
  const eclipticMomentum = Astronomy.RotateVector(
    Astronomy.Rotation_EQJ_ECT(time),
    new Astronomy.Vector(
      angularMomentum.x,
      angularMomentum.y,
      angularMomentum.z,
      time,
    ),
  );
  return normalizeLongitude(Math.atan2(eclipticMomentum.x, -eclipticMomentum.y) * RAD);
}

function longitudeOn(body: BodyName, basis: TimeBasis): number {
  const time = timeOf(basis);
  if (body === 'Moon') return normalizeLongitude(Astronomy.EclipticGeoMoon(time).lon);
  if (body === 'North Node') return trueNodeLongitude(time);
  if (body === 'South Node') return normalizeLongitude(trueNodeLongitude(time) + 180);

  const planet = PLANETS.find((candidate) => candidate.name === body);
  if (!planet) throw new RangeError(`Unknown body: ${body}`);
  return eclipticLongitude(planet.body, time);
}

export function bodyLongitude(body: BodyName, date: Date): number {
  return onEngineClock(() => longitudeOn(body, timeBasis(date.getTime(), 'utc')));
}

/**
 * Longitude speed in degrees/day, the way @zodiacs/engine takes it (since 0.1.1-rc.7):
 * a central difference over ±0.001 day for the planets and the Moon, and
 * ±0.25 day for the true node, whose short-period noise dominates a shorter
 * step. Since rc.15 a difference whose two samples straddle a leap second or a
 * change of time basis is divided by the TT between them (`elapsedDays`).
 * server-ephemeris.test.ts holds the two to 12 decimal places.
 */
export function longitudeSpeed(body: BodyName, date: Date): number {
  const stepDays = body === 'North Node' || body === 'South Node' ? 0.25 : 0.001;
  return onEngineClock(() => {
    const ms = date.getTime();
    const before = timeBasis(ms + -stepDays * DAY, 'utc');
    const lonBefore = longitudeOn(body, before);
    const after = timeBasis(ms + stepDays * DAY, 'utc');
    let difference = longitudeOn(body, after) - lonBefore;
    if (difference > 180) difference -= 360;
    if (difference < -180) difference += 360;
    return difference / elapsedDays(before, after, 2 * stepDays);
  });
}
