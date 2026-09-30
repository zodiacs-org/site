import { beforeAll, describe, expect, it } from 'vitest';
import { parseNatalEnvelope } from '@zodiacs/engine/receipt';
import lmtEras from '../../data/tz-lmt.json';
import { computeCalculatorReceipt } from '../engine/calculator-receipt';
import { offsetAt, prepareLocalTime, resolveLocalToUtc } from './localToUtc';
import { loadZoneHistory, type ZoneHistory } from './tz-history-load';

/*
 * Every wall minute within 26 hours of a zone's local mean time era end,
 * for towns east and west of the zone's reference meridian (and the
 * reference city itself), checked against a separate model of the
 * birthplace's clock: before the end, wall = t + the town's mean time; from
 * the end, wall = t + the zone's legal offset, which before 1970 is the
 * pinned release's (src/data/tz-history/). One reading is the answer; two
 * are a fold and take the earlier with `dst-fold`; none is a gap, moved
 * forward by the offset in force just before, with `dst-gap`. Sampled
 * results must also make portable receipts that validate.
 */
const eras: Record<string, number> = lmtEras.eras;
const CASES: [zone: string, town: string, longitude: number][] = [
  ['America/New_York', 'Buffalo', -78.88],
  ['America/New_York', 'Hartford', -72.69],
  ['America/New_York', 'New York', -74.01],
  ['America/Chicago', 'Omaha', -95.94],
  ['Europe/Paris', 'Brest', -4.49],
  ['Europe/Paris', 'Strasbourg', 7.75],
  ['Europe/Dublin', 'Galway', -9.05],
  ['Europe/London', 'Norwich', 1.3],
  ['Europe/Oslo', 'Bergen', 5.32],
  ['America/Toronto', 'Montreal', -73.57],
  ['America/Toronto', 'Thunder Bay', -89.25],
  ['Asia/Kolkata', 'Mumbai', 72.88],
  ['America/Mexico_City', 'Merida', -89.62],
  ['America/Sitka', 'Sitka', -135.33],
  // Intl changes offset after the table's era end in these two.
  ['Africa/Maseru', 'Butha-Buthe', 28.25],
  ['Africa/Ouagadougou', 'Aribinda', -0.87],
  ['Africa/Ouagadougou', 'Bobo-Dioulasso', -4.3],
  ['Asia/Muscat', 'Muscat', 58.41],
  ['Africa/Mbabane', 'Manzini', 31.38],
  // Towns whose mean time puts an in-era reading one second before the end.
  ['Asia/Seoul', 'Andong', 128.72],
  ['Africa/Cairo', 'Armant', 32.54],
];

const histories = new Map<string, ZoneHistory>();

/** The legal offset in minutes at an instant: the pinned history's before 1970 (Intl's where it has none), Intl's after. */
function legalOffset(zone: string, t: number): number {
  const history = histories.get(zone);
  if (!history || t >= 0) return offsetAt(zone, t);
  let index = 0;
  while (index < history.t.length && history.t[index] * 1000 <= t) index += 1;
  const offset = history.o[index];
  return offset === null ? offsetAt(zone, t) : offset / 60;
}

function wallParts(ms: number): [string, string] {
  const iso = new Date(ms).toISOString();
  return [iso.slice(0, 10), iso.slice(11, 16)];
}

describe('the birthplace clock at the end of its local mean time era', () => {
  beforeAll(async () => {
    for (const [zone] of CASES) {
      await prepareLocalTime('1800-01-01', zone);
      histories.set(zone, (await loadZoneHistory(zone))!);
    }
  });

  it.each(CASES)('%s: %s', (zone, _town, longitude) => {
    const endMs = eras[zone] * 1000;
    const legalFrom = endMs;
    const legalAt = (t: number) => legalOffset(zone, Math.max(t, legalFrom));
    const meanSeconds = Math.round(longitude * 240);
    const zoneBefore = legalOffset(zone, endMs - 1000) * 60;
    const place = (meanSeconds + Math.round((zoneBefore - meanSeconds) / 86_400) * 86_400) / 60;
    const endWall = endMs + Math.round(place * 60_000);
    const start = Math.floor((endWall - 26 * 3_600_000) / 60_000) * 60_000;
    const failures: string[] = [];
    let receipts = 0;
    let previousFlag = '';
    for (let wall = start; wall <= endWall + 26 * 3_600_000; wall += 60_000) {
      const readings: { t: number; offset: number }[] = [];
      const inEra = wall - Math.round(place * 60_000);
      if (inEra < endMs) readings.push({ t: inEra, offset: place });
      const legal = new Set([endMs, legalFrom, wall - 36 * 3_600_000, wall, wall + 36 * 3_600_000, endMs + 86_400_000]
        .map(legalAt));
      for (const offset of legal) {
        const t = wall - Math.round(offset * 60_000);
        if (t >= endMs && Math.abs(legalAt(t) - offset) < 1e-9 && !readings.some((r) => r.t === t)) {
          readings.push({ t, offset });
        }
      }
      readings.sort((a, b) => a.t - b.t);
      const expected = readings.length === 0
        ? { t: inEra, offset: legalAt(inEra), flag: 'dst-gap' }
        : { t: readings[0].t, offset: readings[0].offset, flag: readings.length > 1 ? 'dst-fold' : '' };

      const [date, time] = wallParts(wall);
      const resolved = resolveLocalToUtc(date, time, zone, { longitude });
      const flag = resolved.flags.filter((f) => f !== 'lmt').join(',');
      // Since engine rc.15 `lmt` means a local mean time read the wall time: the
      // town's, before the era ended. A legal clock that runs to seconds does not.
      const lmtFlagAgrees = resolved.flags.includes('lmt') === (resolved.utc.getTime() < endMs);
      if (resolved.utc.getTime() !== expected.t || Math.abs(resolved.offsetMinutes - expected.offset) > 1e-9
        || flag !== expected.flag || !lmtFlagAgrees) {
        failures.push(`${date} ${time}: got ${resolved.utc.toISOString()} ${resolved.offsetMinutes} [${resolved.flags}], `
          + `expected ${new Date(expected.t).toISOString()} ${expected.offset} [${expected.flag}]`);
      }
      // A receipt for the first minute of each run of flagged readings, and every six hours.
      const firstFlagged = flag !== '' && flag !== previousFlag;
      previousFlag = flag;
      if (firstFlagged || (wall - start) % (6 * 60 * 60_000) === 0) {
        receipts += 1;
        const captured = computeCalculatorReceipt({
          utc: resolved.utc, latitude: 40, longitude, houseSystem: 'placidus', timeKnown: true, flags: resolved.flags,
        }, { date, time, timeZone: zone, offsetMinutes: resolved.offsetMinutes, reference: 'supplied-instant' });
        if (!captured || !parseNatalEnvelope(captured.envelopeJson).ok) failures.push(`${date} ${time}: receipt did not validate`);
      }
    }
    expect(receipts).toBeGreaterThan(8);
    expect(failures.slice(0, 5)).toEqual([]);
  });
});

/*
 * Every wall minute within 90 minutes of each change in a zone's pinned
 * history before 1970, read with a longitude, against the same model: one
 * reading is the answer, two a fold, none a gap moved forward by the offset
 * in force just before. The local mean time era is long over at these
 * changes, so only the pinned legal clock is involved.
 */
const LEGAL_CASES: [zone: string, town: string, longitude: number][] = [
  ['America/New_York', 'New York', -74.01],
  ['Europe/Stockholm', 'Stockholm', 18.07],
  ['Europe/Amsterdam', 'Amsterdam', 4.89],
  ['Atlantic/Reykjavik', 'Reykjavik', -21.9],
  ['America/Aruba', 'Oranjestad', -70.03],
];

describe('the birthplace clock at each change of its pinned history before 1970', () => {
  beforeAll(async () => {
    for (const [zone] of LEGAL_CASES) {
      await prepareLocalTime('1800-01-01', zone);
      histories.set(zone, (await loadZoneHistory(zone))!);
    }
  });

  it.each(LEGAL_CASES)('%s: %s', (zone, _town, longitude) => {
    const history = histories.get(zone)!;
    const eraEnd = Object.prototype.hasOwnProperty.call(eras, zone) ? eras[zone] * 1000 : Number.NEGATIVE_INFINITY;
    const failures: string[] = [];
    let changes = 0;
    let gaps = 0;
    let folds = 0;
    history.t.forEach((seconds, index) => {
      const at = seconds * 1000;
      if (at - eraEnd < 2 * 86_400_000) return;
      changes += 1;
      const before = history.o[index] as number;
      const after = history.o[index + 1] as number;
      const jumpWall = at + Math.min(before, after) * 1000;
      // Wall times are whole minutes; some jumps fall on odd seconds (Stockholm, 1900).
      const first = Math.floor((jumpWall - 90 * 60_000) / 60_000) * 60_000;
      for (let wall = first; wall <= jumpWall + 90 * 60_000 + Math.abs(after - before) * 1000; wall += 60_000) {
        const readings = [before, after]
          .map((offset) => ({ t: wall - offset * 1000, offset: offset / 60 }))
          .filter(({ t, offset }) => legalOffset(zone, t) === offset)
          .sort((a, b) => a.t - b.t);
        const expected = readings.length === 0
          ? { t: wall - before * 1000, offset: legalOffset(zone, wall - before * 1000), flag: 'dst-gap' }
          : { t: readings[0].t, offset: readings[0].offset, flag: readings.length > 1 && readings[0].t !== readings[1].t ? 'dst-fold' : '' };
        if (expected.flag === 'dst-gap') gaps += 1;
        if (expected.flag === 'dst-fold') folds += 1;
        const [date, time] = wallParts(wall);
        const resolved = resolveLocalToUtc(date, time, zone, { longitude });
        const flag = resolved.flags.filter((f) => f !== 'lmt').join(',');
        if (resolved.utc.getTime() !== expected.t || Math.abs(resolved.offsetMinutes - expected.offset) > 1e-9 || flag !== expected.flag) {
          failures.push(`${date} ${time}: got ${resolved.utc.toISOString()} ${resolved.offsetMinutes} [${resolved.flags}], `
            + `expected ${new Date(expected.t).toISOString()} ${expected.offset} [${expected.flag}]`);
        }
      }
    });
    expect(changes).toBeGreaterThan(0);
    expect(gaps + folds).toBeGreaterThan(0);
    expect(failures.slice(0, 5)).toEqual([]);
  });
});
