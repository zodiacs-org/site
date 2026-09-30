import { describe, expect, it } from 'vitest';
import { bodyLongitude, computeBodies, computeChart } from './engine/full';
import { e_tilt, MakeTime, SetDeltaTFunction, SiderealTime } from 'astronomy-engine';
import { deltaT } from '@zodiacs/engine/deltat';
import { computeAngles } from './engine/houses';
import {
  decodePositionsLink,
  encodePositionsLink,
  encodeSharedPositionsLink,
  POSITION_BODY_ORDER,
  type PositionsShareInput,
  wholeDegreeAngle,
} from './share-positions';
import {
  onWholeMinute,
  sharedReferenceInstant,
  sharedTimedInstant,
  timedSharedPositions,
  untimedSharedPositions,
} from './share-positions-noon';
import { prepareLocalTime, resolveLocalToUtc } from './time/localToUtc';
import { timeBasis } from './engine/time-basis.mjs';

// Sidereal time and obliquity below are read on the engine's clock, as its
// own angles are (scripts/deltat-install-guard.test.mjs).
SetDeltaTFunction(deltaT);

/**
 * Sidereal time (hours) and the true obliquity at an instant, as the engine
 * takes them: since 0.1.1-rc.15 at the UT1 of its time basis (for 1972 to
 * 2027-10-02, UTC plus IERS UT1 − UTC), with the basis's ΔT held for the call.
 */
function onEngineClock(utc: Date): { gastHours: number; obliquity: number } {
  const basis = timeBasis(utc.getTime(), 'utc');
  SetDeltaTFunction(() => basis.deltaT.seconds);
  try {
    const time = MakeTime(basis.ut1Days);
    return { gastHours: SiderealTime(time), obliquity: e_tilt(time).tobl };
  } finally {
    SetDeltaTFunction(deltaT);
  }
}

function input(angles: PositionsShareInput['angles']): PositionsShareInput {
  return {
    bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: (index * 29.9876 + 0.12345) % 360 })),
    angles,
    houseSystem: 'whole',
    engineVersion: 'zodiacs-1.0.0',
  };
}

describe('shared positions code', () => {
  it('keeps ASC and MC to the middle of their whole degree and every body to 0.001°', () => {
    const shared = decodePositionsLink(encodeSharedPositionsLink(input({ asc: 29.999, mc: 359.9996 }))!)!;
    // 29.999° stays in Aries and 359.9996° stays in Pisces: the sign and the
    // whole degree are kept, and the error is at most 0.5°.
    expect(shared.angles).toEqual({ asc: 29.5, mc: 359.5 });
    expect(shared.bodies.map(({ lon }) => lon))
      .toEqual(decodePositionsLink(encodePositionsLink(input(null))!)!.bodies.map(({ lon }) => lon));
    expect(shared.bodies.find(({ body }) => body === 'Sun')?.lon).toBe(0.123);

    // Rounding a code again changes nothing, so the feed can round every code it receives.
    expect(decodePositionsLink(encodeSharedPositionsLink(input(shared.angles))!)!.angles).toEqual(shared.angles);
    expect([0, 0.5, 12.25, 123.999, 359.4].map(wholeDegreeAngle)).toEqual([0.5, 0.5, 12.5, 123.5, 359.5]);
  });

  it('leaves no-time codes angle-free and rejects what the exact encoder rejects', () => {
    expect(decodePositionsLink(encodeSharedPositionsLink(input(null))!)!.angles).toBeNull();
    for (const angles of [
      { asc: '12' as unknown as number, mc: 40 },
      { asc: Number.NaN, mc: 40 },
      { asc: 360, mc: 40 },
      { asc: -0.5, mc: 40 },
      undefined as unknown as PositionsShareInput['angles'],
    ]) {
      expect(encodeSharedPositionsLink(input(angles))).toBeNull();
      expect(encodePositionsLink(input(angles))).toBeNull();
    }
  });

  it('keeps the exact angles for the encoder that charts kept on the device use', () => {
    expect(decodePositionsLink(encodePositionsLink(input({ asc: 29.999, mc: 359.9996 }))!)!.angles)
      .toEqual({ asc: 29.999, mc: 0 });
  });

  it('shares a chart without a birth time at 12:00 UTC on its date, and refuses a date that is not one', () => {
    expect(sharedReferenceInstant('1870-06-15')?.toISOString()).toBe('1870-06-15T12:00:00.000Z');
    expect(sharedReferenceInstant('2024-02-29')?.toISOString()).toBe('2024-02-29T12:00:00.000Z');
    for (const bad of ['1990-02-30', '1990-13-01', '90-01-01', '1990-1-1', '', 'today', undefined as unknown as string]) {
      expect(sharedReferenceInstant(bad)).toBeNull();
    }
    const seen: string[] = [];
    const shared = untimedSharedPositions({ houseSystem: 'placidus', engineVersion: 'zodiacs-1.0.0' }, '1990-04-11', (utc) => {
      seen.push(utc.toISOString());
      return input(null).bodies;
    })!;
    expect(seen).toEqual(['1990-04-11T12:00:00.000Z']);
    expect(shared).toEqual({ ...input(null), houseSystem: 'placidus' });
    expect(untimedSharedPositions(shared, '1990-04-31', () => input(null).bodies)).toBeNull();
  });
});

/*
 * A chart without a birth time. The site computes it at 12:00 at the
 * birthplace: 12:00 on the zone's clock, or before standard time on the
 * birthplace's own mean time. The bodies at 0.001° give the instant to a few
 * seconds, so a code made from the chart's own positions gave the recipient
 * the UTC offset of that noon: the zone (Kathmandu +5:45, Adelaide +9:30) or,
 * before standard time, the birthplace's longitude. Shared codes now carry
 * the sky at 12:00 UTC on the birth date instead. A recipient's decoder
 * recovers the instant from the Moon, checks every body against it, and
 * reads the offset of the chart's noon from it.
 */
const DAY = 864e5;
const UNTIMED_BIRTHS: ReadonlyArray<{ place: string; date: string; zone: string; lat: number; lon: number }> = [
  // Before standard time: the birthplace's own mean time.
  { place: 'Buffalo', date: '1870-06-15', zone: 'America/New_York', lat: 42.89, lon: -78.88 },
  { place: 'New York', date: '1870-06-15', zone: 'America/New_York', lat: 40.71, lon: -74.01 },
  { place: 'Rochester', date: '1870-06-15', zone: 'America/New_York', lat: 43.16, lon: -77.61 },
  { place: 'Omaha', date: '1870-06-15', zone: 'America/Chicago', lat: 41.26, lon: -95.94 },
  { place: 'Brest', date: '1870-06-15', zone: 'Europe/Paris', lat: 48.39, lon: -4.49 },
  // Zones on a half or quarter hour, and the ends of the offset range.
  { place: 'Kathmandu', date: '2000-04-11', zone: 'Asia/Kathmandu', lat: 27.72, lon: 85.32 },
  { place: 'Adelaide', date: '2000-04-11', zone: 'Australia/Adelaide', lat: -34.93, lon: 138.6 },
  { place: "St. John's", date: '2000-04-11', zone: 'America/St_Johns', lat: 47.56, lon: -52.71 },
  { place: 'Tehran', date: '2000-04-11', zone: 'Asia/Tehran', lat: 35.69, lon: 51.42 },
  { place: 'Chatham', date: '2000-04-11', zone: 'Pacific/Chatham', lat: -43.95, lon: -176.55 },
  { place: 'Kiritimati', date: '2000-04-11', zone: 'Pacific/Kiritimati', lat: 1.87, lon: -157.43 },
  { place: 'Pago Pago', date: '2000-04-11', zone: 'Pacific/Pago_Pago', lat: -14.28, lon: -170.7 },
  { place: 'London', date: '2000-04-11', zone: 'Europe/London', lat: 51.51, lon: -0.13 },
];

async function untimedChart(birth: typeof UNTIMED_BIRTHS[number]) {
  await prepareLocalTime(birth.date, birth.zone);
  const resolved = resolveLocalToUtc(birth.date, '12:00', birth.zone, { longitude: birth.lon });
  const chart = computeChart({
    utc: resolved.utc, latitude: birth.lat, longitude: birth.lon,
    houseSystem: 'whole', timeKnown: false, flags: resolved.flags,
  });
  return { resolved, chart };
}

/** The instant a code's bodies describe, found from the code alone near a guess, or null. */
function decodeInstant(code: string, guess: number): number | null {
  const { bodies } = decodePositionsLink(code)!;
  const moon = bodies.find(({ body }) => body === 'Moon')!.lon;
  const off = (ms: number) => signed(bodyLongitude('Moon', new Date(ms)) - moon);
  let low = guess - 1.5 * DAY;
  let high = guess + 1.5 * DAY;
  if (!(off(low) < 0 && off(high) > 0)) return null;
  for (let i = 0; i < 60; i += 1) {
    const middle = (low + high) / 2;
    if (off(middle) < 0) low = middle; else high = middle;
  }
  const at = new Date(Math.round((low + high) / 2));
  const sky = computeBodies(at);
  const agrees = bodies.every(({ body, lon }) => Math.abs(signed(sky.find((row) => row.body === body)!.lon - lon)) <= 0.0006);
  return agrees ? at.getTime() : null;
}

/** Minutes east of UTC that put 12:00 local time at the decoded instant. */
const impliedNoonOffset = (date: string, instant: number) => (sharedReferenceInstant(date)!.getTime() - instant) / 60_000;

describe('what the code of a chart without a birth time gives away', () => {
  it('was the birthplace: its own positions give the zone offset, and before standard time the longitude', async () => {
    for (const birth of UNTIMED_BIRTHS) {
      const { resolved, chart } = await untimedChart(birth);
      const ownCode = encodeSharedPositionsLink({
        bodies: chart.bodies, angles: null, houseSystem: 'whole', engineVersion: chart.engineVersion,
      })!;
      const instant = decodeInstant(ownCode, sharedReferenceInstant(birth.date)!.getTime());
      expect(instant, birth.place).not.toBeNull();
      // The decoder reads the true offset back to a few seconds.
      expect(Math.abs(impliedNoonOffset(birth.date, instant!) - resolved.offsetMinutes), birth.place).toBeLessThan(0.2);
      if (resolved.localMeanTime !== undefined) {
        // Local mean time runs four minutes per degree: the longitude, to a few kilometres.
        expect(Math.abs(impliedNoonOffset(birth.date, instant!) / 4 - birth.lon), birth.place).toBeLessThan(0.05);
      }
    }
  }, 60_000);

  it('is now nothing about the place: every birthplace on a date gives the same code, at 12:00 UTC', async () => {
    const codesByDate = new Map<string, Set<string>>();
    for (const birth of UNTIMED_BIRTHS) {
      const { chart } = await untimedChart(birth);
      const shared = untimedSharedPositions(
        { houseSystem: 'whole', engineVersion: chart.engineVersion }, birth.date, computeBodies,
      )!;
      const code = encodeSharedPositionsLink(shared)!;
      const instant = decodeInstant(code, sharedReferenceInstant(birth.date)!.getTime());
      expect(instant, birth.place).not.toBeNull();
      // The decoder finds noon UTC whatever the place: an implied offset of zero.
      expect(Math.abs(impliedNoonOffset(birth.date, instant!)), birth.place).toBeLessThan(0.2);
      // The Moon moves at most about 9° between the chart's noon and noon UTC,
      // which is why the site never states the Moon's sign without a birth time.
      const own = chart.bodies.find(({ body }) => body === 'Moon')!.lon;
      const sharedMoon = shared.bodies.find(({ body }) => body === 'Moon')!.lon;
      expect(Math.abs(signed(sharedMoon - own)), birth.place).toBeLessThan(9.5);
      if (!codesByDate.has(birth.date)) codesByDate.set(birth.date, new Set());
      codesByDate.get(birth.date)!.add(code);
    }
    // One code per date, whatever the birthplace, so nothing in it depends on the place.
    expect([...codesByDate.values()].map((codes) => codes.size)).toEqual([1, 1]);
  }, 60_000);
});

/*
 * A chart with a birth time, before standard time. The time is entered to
 * the minute, but the chart keeps the birthplace's own mean time, four
 * minutes of time per degree of longitude, so the seconds of its UTC instant
 * are the longitude's: UTC seconds + longitude × 240 s is a whole minute. The
 * bodies at 0.001° give the instant to about ±3 s, so a code made from the
 * chart's own positions gave a recipient the longitude to within strips a
 * few kilometres wide, one every quarter degree, inside the band the MC's
 * degree leaves. Shared codes now carry the bodies at the instant rounded to
 * the whole minute (sharedTimedInstant).
 */
const TIMED_BEFORE_STANDARD_TIME: ReadonlyArray<{
  place: string; date: string; time: string; zone: string; lat: number; lon: number;
}> = [
  { place: 'Buffalo', date: '1870-06-15', time: '14:30', zone: 'America/New_York', lat: 42.8864, lon: -78.8784 },
  { place: 'Rochester', date: '1870-06-15', time: '14:30', zone: 'America/New_York', lat: 43.1566, lon: -77.6088 },
  { place: 'Omaha', date: '1880-03-02', time: '07:05', zone: 'America/Chicago', lat: 41.2565, lon: -95.9345 },
  { place: 'Brest', date: '1880-10-20', time: '21:47', zone: 'Europe/Paris', lat: 48.3904, lon: -4.4861 },
  { place: 'Kathmandu', date: '1915-01-20', time: '16:20', zone: 'Asia/Kathmandu', lat: 27.7172, lon: 85.324 },
  { place: 'Riyadh', date: '1946-05-10', time: '09:10', zone: 'Asia/Riyadh', lat: 24.6877, lon: 46.7219 },
];

async function timedChart(birth: typeof TIMED_BEFORE_STANDARD_TIME[number], longitude = birth.lon) {
  await prepareLocalTime(birth.date, birth.zone);
  const resolved = resolveLocalToUtc(birth.date, birth.time, birth.zone, { longitude });
  const chart = computeChart({
    utc: resolved.utc, latitude: birth.lat, longitude,
    houseSystem: 'whole', timeKnown: true, flags: resolved.flags,
  });
  const own: PositionsShareInput = {
    bodies: chart.bodies,
    angles: { asc: chart.angles!.asc, mc: chart.angles!.mc },
    houseSystem: 'whole',
    engineVersion: chart.engineVersion,
  };
  return { resolved, chart, own };
}

/** The instant a code's bodies describe, and how far either side of it the Moon's 0.001° allows. */
function decodeWindow(code: string, guess: number): { at: number; halfWindowMs: number } {
  const at = decodeInstant(code, guess);
  expect(at).not.toBeNull();
  const degreesPerMs = Math.abs(signed(bodyLongitude('Moon', new Date(at! + 60_000)) - bodyLongitude('Moon', new Date(at! - 60_000)))) / 120_000;
  return { at: at!, halfWindowMs: 0.0005 / degreesPerMs };
}

/** Seconds past the minute, from −30 to 30. */
const secondsPastMinute = (ms: number) => signed(((ms / 1000) % 60) * 6) / 6;

describe('what the code of a chart with a birth time gives away before standard time', () => {
  it('shares a chart at its UTC instant rounded to the whole minute, and a whole minute unchanged', () => {
    expect(sharedTimedInstant(new Date('1870-06-15T19:45:31.000Z'))?.toISOString()).toBe('1870-06-15T19:46:00.000Z');
    expect(sharedTimedInstant('1946-05-10T06:03:07.000Z')?.toISOString()).toBe('1946-05-10T06:03:00.000Z');
    expect(sharedTimedInstant('1969-12-31T23:59:30.000Z')?.toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(sharedTimedInstant('not a date')).toBeNull();
    expect(onWholeMinute('1987-03-14T05:42:00.000Z')).toBe(true);
    expect(onWholeMinute('1870-06-15T19:45:31.000Z')).toBe(false);
    const asked: string[] = [];
    const bodiesAt = (utc: Date) => {
      asked.push(utc.toISOString());
      return input(null).bodies;
    };
    const chart = input({ asc: 12.3, mc: 280.9 });
    // A whole minute keeps the chart's own positions and asks the ephemeris nothing.
    expect(timedSharedPositions(chart, '1987-03-14T05:42:00.000Z', bodiesAt)).toBe(chart);
    expect(asked).toEqual([]);
    // Seconds are replaced by the whole minute; the angles stay the chart's.
    expect(timedSharedPositions({ ...chart, bodies: [] }, '1870-06-15T19:45:31.000Z', bodiesAt))
      .toEqual({ ...chart, bodies: input(null).bodies });
    expect(asked).toEqual(['1870-06-15T19:46:00.000Z']);
    expect(timedSharedPositions(chart, 'not a date', bodiesAt)).toBeNull();
  });

  it('was the longitude: the seconds of the chart’s own positions put the birthplace in strips about 3 km wide', async () => {
    for (const birth of TIMED_BEFORE_STANDARD_TIME) {
      const { resolved, own } = await timedChart(birth);
      expect(resolved.localMeanTime?.longitude, birth.place).toBe(birth.lon);
      expect(onWholeMinute(resolved.utc), birth.place).toBe(false);
      const { at, halfWindowMs } = decodeWindow(encodeSharedPositionsLink(own)!, resolved.utc.getTime());
      // The decoder reads the instant's seconds to about ±3 s…
      expect(halfWindowMs, birth.place).toBeLessThan(4000);
      expect(Math.abs(at - resolved.utc.getTime()), birth.place).toBeLessThan(halfWindowMs + 500);
      // …and local mean time makes UTC seconds + longitude × 240 s a whole
      // minute, so the longitude lies in the strip those seconds allow.
      expect(Math.abs(secondsPastMinute(at + birth.lon * 240_000)), birth.place).toBeLessThan(halfWindowMs / 1000 + 0.5);
      const stripKm = ((2 * halfWindowMs) / 240_000) * KM_PER_DEGREE_LONGITUDE_AT_EQUATOR * Math.cos(birth.lat * DEG);
      expect(stripKm, birth.place).toBeLessThan(3.3);
    }
  }, 60_000);

  it('is now nothing: the shared bodies are those at the whole minute, the same for every longitude that rounds to it', async () => {
    for (const birth of TIMED_BEFORE_STANDARD_TIME) {
      const { resolved, chart, own } = await timedChart(birth);
      const shared = timedSharedPositions(own, resolved.utc, computeBodies)!;
      const code = encodeSharedPositionsLink(shared)!;
      const { at, halfWindowMs } = decodeWindow(code, resolved.utc.getTime());
      // The decoder now reads a whole minute, within 30 s of the birth…
      expect(Math.abs(secondsPastMinute(at)), birth.place).toBeLessThan(halfWindowMs / 1000 + 0.5);
      expect(Math.abs(at - resolved.utc.getTime()), birth.place).toBeLessThan(30_000 + halfWindowMs + 500);
      // …which moves the Moon at most 0.0054° and every other body less than 0.001°.
      for (const { body, lon } of shared.bodies) {
        const drift = Math.abs(signed(lon - chart.bodies.find((row) => row.body === body)!.lon));
        expect(drift, `${birth.place} ${body}`).toBeLessThanOrEqual(body === 'Moon' ? 0.0054 : 0.001);
      }
      // Every longitude within 0.1° whose instant rounds to the same minute
      // gives exactly the same bodies, so they no longer tell those places apart.
      const bodies = decodePositionsLink(code)!.bodies;
      let alike = 0;
      for (let step = -10; step <= 10; step += 1) {
        const nearby = await timedChart(birth, birth.lon + step * 0.01);
        if (sharedTimedInstant(nearby.resolved.utc)!.getTime() !== sharedTimedInstant(resolved.utc)!.getTime()) continue;
        const nearbyShared = timedSharedPositions(nearby.own, nearby.resolved.utc, computeBodies)!;
        expect(decodePositionsLink(encodeSharedPositionsLink(nearbyShared)!)!.bodies, `${birth.place} ${step}`).toEqual(bodies);
        alike += 1;
      }
      expect(alike, birth.place).toBeGreaterThanOrEqual(5);
    }
  }, 120_000);

  it('rounds a zone whose own offset had seconds, as Monrovia’s did until 1972', async () => {
    await prepareLocalTime('1971-06-01', 'Africa/Monrovia');
    const resolved = resolveLocalToUtc('1971-06-01', '14:30', 'Africa/Monrovia', { longitude: -10.8 });
    expect(resolved.utc.toISOString()).toBe('1971-06-01T15:14:30.000Z');
    const chart = computeChart({ utc: resolved.utc, latitude: 6.3, longitude: -10.8, houseSystem: 'whole', timeKnown: true });
    const shared = timedSharedPositions({
      bodies: chart.bodies, angles: chart.angles, houseSystem: 'whole', engineVersion: chart.engineVersion,
    }, resolved.utc, computeBodies)!;
    const { at, halfWindowMs } = decodeWindow(encodeSharedPositionsLink(shared)!, resolved.utc.getTime());
    expect(Math.abs(secondsPastMinute(at))).toBeLessThan(halfWindowMs / 1000 + 0.5);
  });
});

/*
 * What a shared code with a birth time leaves of the birthplace. The planets,
 * the Moon and the nodes are geocentric and stay at 0.001°, so they give the
 * birth date and the UTC birth time to a few seconds. ASC and MC depend on the
 * place and are kept to the whole degree. With the instant known, the MC's
 * degree leaves a band of longitude (the MC depends on longitude alone), and
 * across it the ASC's degree leaves a range of latitude. The region is the
 * piece of that set around the birthplace: near the Arctic Circle the
 * ecliptic can lie along the horizon, the ASC swings through many degrees in
 * a little latitude, and the set can split. The area shrinks away from the
 * equator, so each band is sampled at its outer edge, and the far north at
 * the places the index reaches, up to Longyearbyen at 78.2°N; the index goes
 * no further south than Ushuaia, 54.8°S.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEG = Math.PI / 180;
const KM_PER_DEGREE_LATITUDE = 110.57;
const KM_PER_DEGREE_LONGITUDE_AT_EQUATOR = 111.32;
const norm = (value: number) => ((value % 360) + 360) % 360;
const signed = (value: number) => norm(value + 180) - 180;

interface PlaceRegion {
  latitude: number;
  eastWestKm: number;
  northSouthKm: number;
  eastWestDegrees: number;
  containsBirthplace: boolean;
}

function placeRegion(utc: Date, latitude: number, longitude: number): PlaceRegion {
  const chart = computeChart({ utc, latitude, longitude, houseSystem: 'whole', timeKnown: true });
  const shared = decodePositionsLink(encodeSharedPositionsLink({
    bodies: chart.bodies,
    angles: chart.angles,
    houseSystem: 'whole',
    engineVersion: chart.engineVersion,
  })!)!;
  const ascDegree = Math.floor(shared.angles!.asc);
  const mcDegree = Math.floor(shared.angles!.mc);

  // Sidereal time and the true obliquity follow from the instant, which the
  // bodies give; the engine's own angles at the birthplace check them.
  const { gastHours, obliquity } = onEngineClock(utc);
  const anglesAt = (lon: number, lat: number) => computeAngles({ gastHours, latitude: lat, longitude: signed(lon), obliquity });
  const own = anglesAt(longitude, latitude);
  expect(Math.abs(signed(own.asc - chart.angles!.asc))).toBeLessThan(1e-6);
  expect(Math.abs(signed(own.mc - chart.angles!.mc))).toBeLessThan(1e-6);
  const inAscDegree = (lon: number, lat: number) => Math.floor(anglesAt(lon, lat).asc) === ascDegree;

  // The MC grows with longitude alone: its whole degree allows one span.
  const ramcOfMc = (mc: number) => norm(
    Math.atan2(Math.sin(mc * DEG) * Math.cos(obliquity * DEG), Math.cos(mc * DEG)) / DEG,
  );
  const birthRamc = norm(gastHours * 15 + longitude);
  const lowRamc = ramcOfMc(mcDegree);
  const eastWestDegrees = norm(ramcOfMc(mcDegree + 1) - lowRamc);
  const west = longitude + signed(lowRamc - birthRamc);

  // Across that span, the latitudes whose ASC falls in the shared degree, on a
  // grid 25° either side of the birthplace, and the piece of them around it.
  const COLUMNS = 21;
  const STEP = 0.05;
  const low = Math.max(-89.9, latitude - 25);
  const rows = Math.floor((Math.min(89.9, latitude + 25) - low) / STEP) + 1;
  const columnLon = (k: number) => west + eastWestDegrees * (0.001 + (0.998 * k) / (COLUMNS - 1));
  const rowLat = (j: number) => low + j * STEP;
  const inside = new Uint8Array(rows * COLUMNS);
  for (let j = 0; j < rows; j += 1) {
    for (let k = 0; k < COLUMNS; k += 1) inside[j * COLUMNS + k] = inAscDegree(columnLon(k), rowLat(j)) ? 1 : 0;
  }
  const birthColumn = Math.round(((signed(longitude - west) / eastWestDegrees) - 0.001) / 0.998 * (COLUMNS - 1));
  const birthRow = Math.round((latitude - low) / STEP);
  let start = -1;
  let nearest = Infinity;
  inside.forEach((cell, index) => {
    const distance = Math.abs(Math.floor(index / COLUMNS) - birthRow) + Math.abs((index % COLUMNS) - birthColumn);
    if (cell && distance < nearest) { nearest = distance; start = index; }
  });
  const piece = new Uint8Array(rows * COLUMNS);
  const stack = [start];
  piece[start] = 1;
  while (stack.length) {
    const cell = stack.pop()!;
    const j = Math.floor(cell / COLUMNS);
    const k = cell % COLUMNS;
    for (let dj = -1; dj <= 1; dj += 1) {
      for (let dk = -1; dk <= 1; dk += 1) {
        const jj = j + dj;
        const kk = k + dk;
        if (jj < 0 || jj >= rows || kk < 0 || kk >= COLUMNS) continue;
        const next = jj * COLUMNS + kk;
        if (inside[next] && !piece[next]) { piece[next] = 1; stack.push(next); }
      }
    }
  }
  const edge = (lon: number, inner: number, outer: number) => {
    let a = inner;
    let b = outer;
    for (let i = 0; i < 30; i += 1) {
      const middle = (a + b) / 2;
      if (inAscDegree(lon, middle)) a = middle; else b = middle;
    }
    return a;
  };
  let south = Infinity;
  let north = -Infinity;
  for (let k = 0; k < COLUMNS; k += 1) {
    let first = -1;
    let last = -1;
    for (let j = 0; j < rows; j += 1) if (piece[j * COLUMNS + k]) { if (first < 0) first = j; last = j; }
    if (first < 0) continue;
    south = Math.min(south, first > 0 ? edge(columnLon(k), rowLat(first), rowLat(first - 1)) : rowLat(first));
    north = Math.max(north, last < rows - 1 ? edge(columnLon(k), rowLat(last), rowLat(last + 1)) : rowLat(last));
  }

  return {
    latitude,
    eastWestKm: eastWestDegrees * KM_PER_DEGREE_LONGITUDE_AT_EQUATOR * Math.cos(latitude * DEG),
    northSouthKm: (north - south) * KM_PER_DEGREE_LATITUDE,
    eastWestDegrees,
    containsBirthplace: inAscDegree(longitude, latitude)
      && latitude >= south && latitude <= north
      && signed(longitude - west) >= 0 && signed(longitude - west) <= eastWestDegrees,
  };
}

/**
 * Across the whole of the shared MC degree, every latitude within a degree of
 * the birthplace (about 110 km either way) whose ASC falls in the shared
 * degree, on a 110 m grid refined at each edge: the north-south extent (km)
 * of all of them together. Matches reaching the edge of that window give
 * Infinity, so a window too small can never make the area look narrow.
 */
function nearbyNorthSouthKm(utc: Date, latitude: number, longitude: number): number {
  const chart = computeChart({ utc, latitude, longitude, houseSystem: 'whole', timeKnown: true });
  const shared = decodePositionsLink(encodeSharedPositionsLink({
    bodies: chart.bodies, angles: chart.angles, houseSystem: 'whole', engineVersion: chart.engineVersion,
  })!)!;
  const ascDegree = Math.floor(shared.angles!.asc);
  const mcDegree = Math.floor(shared.angles!.mc);
  const { gastHours, obliquity } = onEngineClock(utc);
  const inAscDegree = (lon: number, lat: number) => Math.floor(computeAngles({
    gastHours, latitude: lat, longitude: signed(lon), obliquity,
  }).asc) === ascDegree;
  expect(inAscDegree(longitude, latitude)).toBe(true);
  const ramcOfMc = (mc: number) => norm(
    Math.atan2(Math.sin(mc * DEG) * Math.cos(obliquity * DEG), Math.cos(mc * DEG)) / DEG,
  );
  const lowRamc = ramcOfMc(mcDegree);
  const eastWestDegrees = norm(ramcOfMc(mcDegree + 1) - lowRamc);
  const west = longitude + signed(lowRamc - norm(gastHours * 15 + longitude));
  const COLUMNS = 101;
  const STEP = 0.001;
  const ROWS = 2000;
  const rowLat = (j: number) => latitude - 1 + j * STEP;
  const edge = (lon: number, inner: number, outer: number) => {
    let a = inner;
    let b = outer;
    for (let i = 0; i < 40; i += 1) {
      const middle = (a + b) / 2;
      if (inAscDegree(lon, middle)) a = middle; else b = middle;
    }
    return a;
  };
  let south = Infinity;
  let north = -Infinity;
  for (let k = 0; k < COLUMNS; k += 1) {
    const lon = west + eastWestDegrees * (0.001 + (0.998 * k) / (COLUMNS - 1));
    let first = -1;
    let last = -1;
    for (let j = 0; j <= ROWS; j += 1) if (inAscDegree(lon, rowLat(j))) { if (first < 0) first = j; last = j; }
    if (first < 0) continue;
    if (first === 0 || last === ROWS) return Infinity;
    south = Math.min(south, edge(lon, rowLat(first), rowLat(first - 1)));
    north = Math.max(north, edge(lon, rowLat(last), rowLat(last + 1)));
  }
  return (north - south) * KM_PER_DEGREE_LATITUDE;
}

function seededRegions(latitudes: readonly number[], perLatitude: number, seed: number): PlaceRegion[] {
  const random = seededRandom(seed);
  const start = Date.UTC(1950, 0, 1);
  const end = Date.UTC(2008, 11, 31);
  return latitudes.flatMap((latitude) => Array.from({ length: perLatitude }, () => {
    const utc = new Date(Math.floor(start + random() * (end - start)));
    return placeRegion(utc, latitude, -180 + random() * 360);
  }));
}

const minimum = (values: number[]) => Math.min(...values);

describe('what a shared positions code leaves of the birthplace', () => {
  it('leaves an area about a degree of longitude wide and, from north to south, at least 400 km within 15° of the equator, 200 km within 45° and 70 km within 60°', () => {
    // The outer edge of each band, where its area is smallest; 54.8°S is the
    // index's southernmost place. A dense sweep of sidereal time at each
    // edge (1990, 3,600 longitudes) found 464.9 km at 15°, 222.9 km at 45°
    // and 79.8 km at 60°; the stated floors keep a margin below them.
    const regions = seededRegions([15, -15, 45, -45, 54.81, -54.81, 60], 45, 20260928);
    expect(regions.every((region) => region.containsBirthplace)).toBe(true);
    const northSouth = (limit: number) => regions
      .filter((region) => Math.abs(region.latitude) <= limit)
      .map((region) => region.northSouthKm);
    expect(minimum(northSouth(15))).toBeGreaterThanOrEqual(400);
    expect(minimum(northSouth(45))).toBeGreaterThanOrEqual(200);
    expect(minimum(northSouth(60))).toBeGreaterThanOrEqual(70);

    // East to west the MC's degree leaves 0.92° to 1.09° of longitude:
    // about 110 km at the equator, 80 km at 45° and 55 km at 60°.
    expect(minimum(regions.map((region) => region.eastWestDegrees))).toBeGreaterThanOrEqual(0.9);
    expect(Math.max(...regions.map((region) => region.eastWestDegrees))).toBeLessThanOrEqual(1.1);
    const width = (latitude: number) => regions.filter((region) => Math.abs(region.latitude) === latitude)
      .map((region) => region.eastWestKm);
    for (const [latitude, about] of [[45, 80], [60, 55]] as const) {
      expect(minimum(width(latitude))).toBeGreaterThan(about * 0.85);
      expect(Math.max(...width(latitude))).toBeLessThan(about * 1.15);
    }
    expect(placeRegion(new Date(Date.UTC(1990, 5, 15, 12)), 0, 30).eastWestKm).toBeGreaterThan(100);
  }, 120_000);

  it('can leave much less far from the equator: tens of kilometres in the far north, and on the Arctic Circle a strip less than a kilometre from north to south', () => {
    // Places in the index north of 60°: Anchorage, Yellowknife, Nuuk,
    // Fairbanks, Rovaniemi, Salekhard, Murmansk, Tromsø, Norilsk, Longyearbyen.
    const far = seededRegions([61.22, 62.45, 64.18, 64.84, 66.5, 66.53, 68.97, 69.65, 69.35, 78.22], 12, 20260929);
    expect(far.every((region) => region.containsBirthplace)).toBe(true);
    expect(minimum(far.map((region) => Math.max(region.eastWestKm, region.northSouthKm)))).toBeLessThan(70);
    // Longyearbyen: a degree of longitude is about 23 km there.
    expect(Math.max(...far.filter((region) => region.latitude === 78.22).map((region) => region.eastWestKm))).toBeLessThan(25);

    // On the Arctic Circle, when the ecliptic lies close to the horizon
    // (local sidereal time near 18h), the ASC's degree holds only a thin strip
    // of latitude across the whole of the MC's degree. At 66.56°N, 25.73°E
    // (Rovaniemi's longitude), every three minutes for an hour either side of
    // that moment on 21 December 1990, every match within a degree of latitude
    // lies in a strip 0.84 km from north to south at the narrowest. (Rovaniemi
    // itself, at 66.5°N, gives about 5 km; a fine scan at 66.56°N, 174.3°W on
    // 15 June 1990 found 0.42 km.)
    const noon = Date.UTC(1990, 11, 21, 12);
    const localSiderealDegrees = norm(onEngineClock(new Date(noon)).gastHours * 15 + 25.73);
    const eighteenHours = noon - (signed(localSiderealDegrees - 270) / 360.9856) * DAY;
    const arctic = Array.from({ length: 41 }, (_, step) => nearbyNorthSouthKm(
      new Date(Math.round(eighteenHours + (step * 3 - 60) * 60_000)),
      66.56,
      25.73,
    ));
    expect(minimum(arctic)).toBeGreaterThan(0);
    expect(minimum(arctic)).toBeLessThan(1);
  }, 120_000);
});
