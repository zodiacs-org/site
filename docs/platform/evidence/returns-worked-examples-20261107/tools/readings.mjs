// The UT of every stated instant, under the reading used and under every combination of the
// open readings (PREREGISTRATION.md, "The reading of each instant" and the tolerance's b).
// Imports only Node built-ins and the vendored @zodiacs/engine/geo (C4). It computes no
// longitude of a returning body: the only astronomy here is the equation of time, from the
// Astronomical Almanac's low-precision solar formulas, for apparent-time readings.
//
// A spec (recorded before the freeze from the two readings' fields):
//   zone: IANA zone of the place, for 'civil'; lonEastDeg: the place's longitude, degrees east;
//   lonFromGeoNames: true when the longitude is not printed;
//   returnClock: { date: 'YYYY-MM-DD', time: 'HH:MM' | 'HH:MM:SS' } as printed, on the civil day
//     unless the basis says dayStart 'noon';
//   birthClock: the same, or null for a step fixture;
//   sameWay: true when the source prints the birth and the return the same way (one reading
//     then applies to both);
//   used: { return: Basis, birth?: Basis };
//   open: [ { name, return?: Basis, birth?: Basis } ]  alternatives the source leaves open.
// Basis: { kind: 'GMT' | 'LMT' | 'apparent' | 'civil' } | { kind: 'offset', hours }, with an
//   optional dayStart: 'noon' for the astronomical day.
import { prepareLocalTime, resolveLocalToUtc } from '@zodiacs/engine/geo';

/** Equation of time (apparent minus mean), seconds: the Astronomical Almanac's low-precision solar formulas. */
export function equationOfTimeSec(utcMs) {
  const jd = utcMs / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const rad = Math.PI / 180;
  const L = (((280.46 + 0.9856474 * n) % 360) + 360) % 360;
  const g = (((357.528 + 0.9856003 * n) % 360) + 360) % 360;
  const lambda = L + 1.915 * Math.sin(g * rad) + 0.02 * Math.sin(2 * g * rad);
  const eps = 23.439 - 0.0000004 * n;
  const alpha = Math.atan2(Math.cos(eps * rad) * Math.sin(lambda * rad), Math.cos(lambda * rad)) / rad;
  let e = L - (((alpha % 360) + 360) % 360);
  e = ((e + 540) % 360) - 180;
  return e * 240;
}

function clockMs({ date, time }) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const h = /^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(time);
  if (!m || !h) throw new Error(`bad clock reading ${date} ${time}`);
  const sec = h[3] === undefined ? 0 : Number(h[3]);
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +h[1], +h[2], 0) + Math.round(sec * 1000);
}

function hms(ms) {
  const d = new Date(ms);
  const p = (x, w = 2) => String(x).padStart(w, '0');
  return {
    date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`,
  };
}

/** UT (ms) of a printed clock reading under a basis, with the longitude and equation-of-time shifts given. */
export async function utcOf(clock, basis, place, shift = {}) {
  const lon = place.lonEastDeg + (shift.lonDeg ?? 0);
  let wall = clockMs(clock);
  if (basis.dayStart === 'noon') wall += 43200000;
  switch (basis.kind) {
    case 'GMT': return wall;
    case 'LMT': return wall - lon * 240000;
    case 'apparent': {
      const mean = wall - lon * 240000;
      return mean - Math.round((equationOfTimeSec(mean) + (shift.eotSec ?? 0)) * 1000);
    }
    case 'offset': return wall - Math.round(basis.hours * 3600000);
    case 'civil': {
      // resolveLocalToUtc reads HH:MM; the seconds are added after it, since the offset holds within a minute.
      const minute = Math.floor(wall / 60000) * 60000;
      const { date, time } = hms(minute);
      await prepareLocalTime(date, place.zone);
      return resolveLocalToUtc(date, time.slice(0, 5), place.zone, { longitude: lon }).utc.getTime() + (wall - minute);
    }
    default: throw new Error(`unknown basis ${basis.kind}`);
  }
}

function shiftsFor(basis, place) {
  const lonShifts = place.lonFromGeoNames && ['LMT', 'apparent', 'civil'].includes(basis.kind) ? [0, 0.1, -0.1] : [0];
  const eotShifts = basis.kind === 'apparent' ? [0, 10, -10] : [0];
  const out = [];
  for (const lonDeg of lonShifts) for (const eotSec of eotShifts) out.push({ lonDeg, eotSec });
  return out;
}

const label = (name, s) => `${name}${s && s.lonDeg ? ` lon${s.lonDeg > 0 ? '+' : ''}${s.lonDeg}` : ''}${s && s.eotSec ? ` eot${s.eotSec > 0 ? '+' : ''}${s.eotSec}` : ''}`;
const isZero = (s) => !s || (s.lonDeg === 0 && s.eotSec === 0);

/**
 * The readings array for holdout.json: the reading used first, then every combination of the
 * open readings. When the source prints the birth and the return the same way at the same place
 * (sameWay), one reading and one longitude or equation-of-time shift apply to both; otherwise
 * each instant takes its own, in every combination.
 */
export async function readings(spec) {
  const placeR = { zone: spec.zone, lonEastDeg: spec.lonEastDeg, lonFromGeoNames: !!spec.lonFromGeoNames };
  const bp = spec.birthPlace ?? spec;
  const placeB = { zone: bp.zone, lonEastDeg: bp.lonEastDeg, lonFromGeoNames: !!bp.lonFromGeoNames };
  const chain = !!spec.birthClock;
  const iso = (ms) => new Date(ms).toISOString();
  const usedR = spec.used.return;
  const usedB = chain ? (spec.used.birth ?? spec.used.return) : null;
  const out = [{
    name: 'used',
    returnUtc: iso(await utcOf(spec.returnClock, usedR, placeR)),
    birthUtc: chain ? iso(await utcOf(spec.birthClock, usedB, placeB)) : null,
  }];
  const open = spec.open ?? [];
  const push = async (name, rb, rs, bb, bs) => {
    if (name === 'used' && isZero(rs) && isZero(bs)) return;
    out.push({
      name,
      returnUtc: iso(await utcOf(spec.returnClock, rb, placeR, rs ?? {})),
      birthUtc: chain ? iso(await utcOf(spec.birthClock, bb, placeB, bs ?? {})) : null,
    });
  };
  if (chain && spec.sameWay && !spec.birthPlace) {
    for (const o of [{ name: 'used', return: usedR, birth: usedB }, ...open]) {
      const rb = o.return ?? usedR;
      const bb = o.birth ?? o.return ?? usedB;
      for (const s of shiftsFor(rb, placeR)) {
        const sb = shiftsFor(bb, placeB).some((x) => x.lonDeg === s.lonDeg && x.eotSec === s.eotSec) ? s : { lonDeg: 0, eotSec: 0 };
        await push(label(o.name, s), rb, s, bb, sb);
      }
    }
    return out;
  }
  const altsR = [{ name: 'used', basis: usedR }, ...open.filter((o) => o.return).map((o) => ({ name: o.name, basis: o.return }))];
  const altsB = chain ? [{ name: 'used', basis: usedB }, ...open.filter((o) => o.birth).map((o) => ({ name: o.name, basis: o.birth }))] : [null];
  for (const r of altsR) {
    for (const rs of shiftsFor(r.basis, placeR)) {
      if (!chain) {
        await push(label(r.name, rs), r.basis, rs, null, null);
        continue;
      }
      for (const b of altsB) {
        for (const bs of shiftsFor(b.basis, placeB)) {
          const name = r.name === 'used' && b.name === 'used' ? 'used' : `${label(r.name, rs)} / birth ${label(b.name, bs)}`;
          await push(name === 'used' && (!isZero(rs) || !isZero(bs)) ? `${label('used', rs)} / birth ${label('used', bs)}` : name, r.basis, rs, b.basis, bs);
        }
      }
    }
  }
  return out;
}
