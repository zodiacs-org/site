#!/usr/bin/env node
/*
 * Checks every answer in the sky-fact benchmark's key against NASA JPL
 * Horizons: the apparent geocentric ecliptic longitude of date of each body
 * (Horizons observer quantity 31, ObsEcLon), sampled around each question, in
 * place of the engine's.
 *
 *   node docs/platform/evidence/sky-benchmark-v0/tools/horizons-check.mjs [version]
 *
 * It reads public/developers/sky-benchmark/<version>/ (v0 by default), asks
 * Horizons one question at a time, and writes horizons-check.json beside this
 * folder's README: for each question the answer Horizons' longitudes give,
 * whether it is the key's, and, for an event, how far the engine's instant is
 * from Horizons'. It needs the network; nothing in the site's tests runs it.
 *
 * Horizons gives times as UT: UTC from 1962, UT1 before. The engine reads UTC
 * only from 1972, so from 1962 to 1972 the two read a time a fraction of a
 * second apart. Between samples a longitude is interpolated linearly, every 10
 * minutes for the Moon and every hour for the Sun and the planets, which puts
 * an event within seconds.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const VERSION = process.argv[2] ?? 'v0';
const DIR = resolve(ROOT, 'public/developers/sky-benchmark', VERSION);
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', VERSION === 'v0' ? 'horizons-check.json' : `horizons-check-${VERSION}.json`);
const items = JSON.parse(readFileSync(resolve(DIR, 'items.json'), 'utf8'));
const key = JSON.parse(readFileSync(resolve(DIR, 'key.json'), 'utf8'));

const COMMAND = { Sun: '10', Moon: '301', Mercury: '199', Venus: '299', Mars: '499', Jupiter: '599', Saturn: '699', Uranus: '799', Neptune: '899', Pluto: '999' };
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const PHASES = { new: 0, 'first-quarter': 90, full: 180, 'last-quarter': 270 };
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const signName = (slug) => slug[0].toUpperCase() + slug.slice(1);
const signIndex = (lon) => Math.floor((((lon % 360) + 360) % 360) / 30);
const wrap180 = (angle) => ((((angle + 180) % 360) + 360) % 360) - 180;
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);
const isoSecond = (ms) => new Date(Math.round(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');
const stamp = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** As the compute API reads a date without a zone: from 14 hours before its midnight UTC to 36 hours after. */
function datesHolding(ms) {
  const dates = [];
  for (let midnight = Math.floor((ms - 36 * HOUR) / DAY) * DAY; midnight <= ms + 14 * HOUR; midnight += DAY) {
    if (ms >= midnight - 14 * HOUR && ms < midnight + 36 * HOUR) dates.push(isoDate(midnight));
  }
  return dates;
}

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

/** Horizons' apparent ecliptic longitudes of a body from `from` to `to`, every `step` minutes. */
async function longitudes(body, from, to, step) {
  const params = new URLSearchParams({
    format: 'text',
    COMMAND: `'${COMMAND[body]}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500@399'",
    START_TIME: `'${stamp(from)}'`,
    STOP_TIME: `'${stamp(to)}'`,
    STEP_SIZE: `'${step} m'`,
    QUANTITIES: "'31'",
    ANG_FORMAT: "'DEG'",
    EXTRA_PREC: "'YES'",
    TIME_TYPE: "'UT'",
    CSV_FORMAT: "'YES'",
  });
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const table = text.split('$$SOE')[1]?.split('$$EOE')[0];
      if (!table) throw new Error(`no ephemeris in the reply: ${text.slice(0, 300)}`);
      return table.trim().split('\n').map((line) => {
        const cells = line.split(',').map((cell) => cell.trim());
        const match = /^(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/u.exec(cells[0]);
        if (!match) throw new Error(`unreadable row: ${line}`);
        const ms = Date.UTC(Number(match[1]), MONTHS[match[2]], Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] ?? 0));
        const lon = Number(cells[3]);
        if (!Number.isFinite(lon)) throw new Error(`no longitude in row: ${line}`);
        return { ms, lon };
      });
    } catch (error) {
      if (attempt >= 4) throw error;
      await sleep(2000 * 2 ** attempt);
    }
  }
}

/** Instants at which `value(row) − target` crosses zero upward, interpolated between rows. */
function upwardCrossings(rows, value) {
  const found = [];
  for (let index = 1; index < rows.length; index += 1) {
    const a = value(rows[index - 1]);
    const b = value(rows[index]);
    if (a < 0 && b >= 0 && b - a < 180) found.push(rows[index - 1].ms + ((rows[index].ms - rows[index - 1].ms) * -a) / (b - a));
  }
  return found;
}

/** Sign changes in the rows: the boundary crossed, either way. */
function signChanges(rows) {
  const changes = [];
  for (let index = 1; index < rows.length; index += 1) {
    const before = signIndex(rows[index - 1].lon);
    const after = signIndex(rows[index].lon);
    if (before === after) continue;
    const forward = wrap180(rows[index].lon - rows[index - 1].lon) > 0;
    const boundary = (forward ? after : before) * 30;
    const a = wrap180(rows[index - 1].lon - boundary);
    const b = wrap180(rows[index].lon - boundary);
    changes.push({ at: rows[index - 1].ms + ((rows[index].ms - rows[index - 1].ms) * -a) / (b - a), into: SIGNS[after], retrograde: !forward });
  }
  return changes;
}

/**
 * Stations: where the longitude stops and turns. The motion from one row to
 * the next is read at the middle of the step; a station is where it changes
 * sign, interpolated between the last two steps that moved. Near a station
 * a step can print no motion at all at Horizons' seven decimals, so a step
 * that does not move is passed over rather than read as a turn.
 */
function stations(rows) {
  const found = [];
  let last = null;
  for (let index = 1; index < rows.length; index += 1) {
    const motion = wrap180(rows[index].lon - rows[index - 1].lon);
    if (motion === 0) continue;
    const middle = (rows[index].ms + rows[index - 1].ms) / 2;
    if (last && Math.sign(motion) !== Math.sign(last.motion)) {
      found.push({ at: last.middle + ((middle - last.middle) * last.motion) / (last.motion - motion), type: motion < 0 ? 'retrograde' : 'direct' });
    }
    last = { motion, middle };
  }
  return found;
}

const stepFor = (body) => (body === 'Moon' ? 10 : 60);

async function check(item, entry) {
  const { facts } = entry;
  switch (item.family) {
    case 'sign-at-instant': {
      const at = Date.parse(facts.instant);
      const [row] = await longitudes(facts.body, at, at + MINUTE, 1);
      const answer = signName(SIGNS[signIndex(row.lon)]);
      const within = ((row.lon % 30) + 30) % 30;
      return { answer, lon: row.lon, boundaryMarginArcsec: Math.min(within, 30 - within) * 3600, engineMinusJplArcsec: wrap180(facts.lon - row.lon) * 3600 };
    }
    case 'sign-on-date': {
      const from = Date.parse(facts.window.from);
      const to = Date.parse(facts.window.to);
      const rows = await longitudes(facts.body, from - DAY, to + DAY, stepFor(facts.body));
      const all = signChanges(rows);
      const inside = all.filter(({ at }) => at >= from && at < to);
      const start = rows.find((row) => row.ms >= from);
      const answer = inside.length > 0 ? 'DEPENDS' : signName(SIGNS[signIndex(start.lon)]);
      const nearestEdgeMinutes = Math.min(...all.flatMap(({ at }) => [Math.abs(at - from), Math.abs(at - to)]).map((ms) => ms / MINUTE), Infinity);
      return { answer, changes: inside.map(({ at, into, retrograde }) => ({ at: isoSecond(at), into, retrograde })), nearestEdgeMinutes: Number.isFinite(nearestEdgeMinutes) ? Math.round(nearestEdgeMinutes) : null };
    }
    case 'retrograde-on-date': {
      const from = Date.parse(facts.window.from);
      const to = Date.parse(facts.window.to);
      const rows = await longitudes(facts.body, from - DAY, to + DAY, 60);
      const found = stations(rows);
      const inside = found.filter(({ at }) => at >= from && at < to);
      const startIndex = rows.findIndex((row) => row.ms >= from);
      const retrograde = wrap180(rows[startIndex + 1].lon - rows[startIndex].lon) < 0;
      const answer = inside.length > 0 ? 'DEPENDS' : retrograde ? 'YES' : 'NO';
      const nearestEdgeHours = Math.min(...found.flatMap(({ at }) => [Math.abs(at - from), Math.abs(at - to)]).map((ms) => ms / HOUR), Infinity);
      return { answer, stations: inside.map(({ at, type }) => ({ at: isoSecond(at), type })), nearestEdgeHours: Number.isFinite(nearestEdgeHours) ? Number(nearestEdgeHours.toFixed(1)) : null };
    }
    case 'ingress-date': {
      const at = Date.parse(facts.at);
      const rows = await longitudes(facts.body, at - DAY, at + DAY, stepFor(facts.body));
      const boundary = SIGNS.indexOf(facts.sign) * 30;
      const [cross] = upwardCrossings(rows, (row) => wrap180(row.lon - boundary));
      if (cross === undefined) return { answer: null, note: 'no entry within a day of the key' };
      return { answer: isoDate(cross), accepted: datesHolding(cross), at: isoSecond(cross), engineMinusJplMinutes: Number(((at - cross) / MINUTE).toFixed(2)) };
    }
    case 'lunation-date': {
      const at = Date.parse(facts.at);
      const [moon, sun] = [await longitudes('Moon', at - DAY, at + DAY, 10), await longitudes('Sun', at - DAY, at + DAY, 10)];
      const rows = moon.map((row, index) => ({ ms: row.ms, lon: row.lon - sun[index].lon }));
      const target = PHASES[facts.phase];
      const [cross] = upwardCrossings(rows, (row) => wrap180(row.lon - target));
      if (cross === undefined) return { answer: null, note: 'no lunation within a day of the key' };
      return { answer: isoDate(cross), accepted: datesHolding(cross), at: isoSecond(cross), engineMinusJplMinutes: Number(((at - cross) / MINUTE).toFixed(2)) };
    }
    default:
      throw new Error(`unknown family ${item.family}`);
  }
}

const results = [];
for (const [index, item] of items.items.entries()) {
  const entry = key.items[index];
  const jpl = await check(item, entry);
  const agree = jpl.accepted
    ? JSON.stringify(jpl.accepted) === JSON.stringify(entry.accepted)
    : entry.accepted.includes(jpl.answer);
  results.push({ id: item.id, family: item.family, key: entry.accepted, horizons: jpl, agree });
  process.stdout.write(`${item.id} ${agree ? 'agrees' : 'DIFFERS'}\n`);
  await sleep(250);
}
const differ = results.filter(({ agree }) => !agree).map(({ id }) => id);
const summary = {
  checked: new Date().toISOString().slice(0, 10),
  source: 'NASA JPL Horizons API (https://ssd.jpl.nasa.gov/api/horizons.api), observer quantity 31: apparent geocentric ecliptic longitude of date, TIME_TYPE UT',
  benchmark: { name: key.name, version: key.version, engine: key.engine },
  questions: results.length,
  agree: results.length - differ.length,
  differ,
};
writeFileSync(OUT, `${JSON.stringify({ ...summary, results }, null, 1)}\n`);
console.log(JSON.stringify(summary, null, 1));
if (differ.length > 0) process.exitCode = 1;
