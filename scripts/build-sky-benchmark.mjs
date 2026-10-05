#!/usr/bin/env node
/*
 * The Zodiacs sky-fact benchmark, version 0: 300 questions about the sky
 * that a calculation answers, the engine's answer to each, and
 * check_sky_fact's own reply to each.
 *
 *   npx vite-node --script scripts/build-sky-benchmark.mjs          write the three files of a version not yet published
 *   npx vite-node --script scripts/build-sky-benchmark.mjs --check  fail if a published version differs from what this draws
 *
 * It writes, under public/developers/sky-benchmark/<VERSION>/ (v0 so far):
 *   items.json         the questions, each worded so that a reply can be scored
 *                      without a person reading it
 *   key.json           the engine's answer to each, with the values that decide it
 *   tool-answers.json  check_sky_fact's reply to each, unchanged
 *
 * The questions are drawn by a seeded generator from fixed rules, so the set
 * is the same on every run and on every machine. The key does not come from
 * the compute API's search, which samples every 5 days, or every day for the
 * Moon: it comes from the engine's own longitudes, speeds and Moon phase,
 * sampled every 10 minutes to 6 hours, depending on how fast they change, and
 * narrowed to the second. tests/benchmarks/sky-benchmark.test.ts holds
 * check_sky_fact to it on every question.
 *
 * Every date is drawn from 1900 to 2049. A question whose answer would turn on
 * less than the margins below is left out: a body within 1′ of a sign
 * boundary, or the Moon within 30′, at the instant asked about; an event
 * within 10 minutes of the edge of a date, or within the time the body takes
 * to move 30″, more than the engine's largest measured error for any planet
 * (ENGINE_ERROR_ARCSEC); a station within 6 hours of one; for a date a planet
 * stays in one sign, or a sign it enters once in a period, a station within
 * 30″ of that sign's boundaries; and another entry into the sign, or another
 * lunation of the same phase, within those margins outside the period. ΔT is
 * observed to 24 September 2026, predicted to 2 October 2027 and extrapolated
 * after that; its uncertainty, about 12 seconds by 2049, is far inside these
 * margins.
 *
 * A version is frozen once published: tests/benchmarks/sky-benchmark.test.ts
 * pins the bytes of its files, this writes only a version whose folder is
 * empty or missing (so draw a version before adding its scorer.mjs), and it
 * refuses to check a published version with an engine or ΔT tables other
 * than those its files name, or with one of its files missing.
 * --check compares the questions and the key byte for byte, and
 * check_sky_fact's replies by what decides them: the request, the answer and
 * the facts behind it, each event within 2 seconds. The receipts beside the
 * replies say how each was made when the version was drawn, and may differ
 * from today's. A change in the engine or in these rules is a new version in
 * a new folder (raise VERSION), and v0 stays as it is.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION, moonPhase } from '@zodiacs/engine';
import { bodyLongitude, longitudeSpeed } from '@zodiacs/engine/internal';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const NAME = 'Zodiacs sky-fact benchmark';
export const VERSION = 'v0';
/** Where a version's files are published. */
export const folderOf = (version) => `public/developers/sky-benchmark/${version}`;
export const OUT_DIR = folderOf(VERSION);
/** The files the generator writes; scorer.mjs is written by hand. */
export const DRAWN_FILES = Object.freeze(['items.json', 'key.json', 'tool-answers.json']);
/** The day the questions were fixed; it decides only whether a question says "was" or "will be". */
export const REFERENCE_DATE = '2026-10-05';
export const SEED = 20261005;

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
export const SPAN = Object.freeze({ from: Date.UTC(1900, 0, 1), to: Date.UTC(2050, 0, 1) });

/** As the compute API reads a date without a zone: from 14 hours before its midnight UTC to 36 hours after. */
export const ANY_OFFSET_DAY = Object.freeze({ before: 14 * HOUR, after: 36 * HOUR });

/**
 * More than the engine's largest measured longitude error for any body from
 * 1900 to 2049, in arcseconds: against Swiss Ephemeris every tenth day over
 * those years the largest is 20.4″ (Venus, 2026), at the same UT and at the
 * same TT (docs/platform/evidence/site-engine-rc16/accuracy-refresh/
 * multiyear-1800-2199.json, by era). An event closer than this to the edge of
 * a date, in the time the body takes to move it, could fall on another date in
 * the real sky.
 */
export const ENGINE_ERROR_ARCSEC = 30;

/** The most draws a question may take before the generator gives up, instead of looping forever. */
const MAX_DRAWS = 20_000;
function drawLimit(label) {
  let draws = 0;
  return () => {
    draws += 1;
    if (draws > MAX_DRAWS) throw new Error(`build-sky-benchmark: no question for ${label} after ${MAX_DRAWS} draws`);
  };
}

export const SIGNS = Object.freeze(['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']);
const PLANETS = Object.freeze(['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
const BODIES = Object.freeze(['Sun', 'Moon', ...PLANETS]);
const MONTHS = Object.freeze(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
export const PHASES = Object.freeze({ new: 0, 'first-quarter': 90, full: 180, 'last-quarter': 270 });
const PHASE_WORDS = Object.freeze({ new: 'new moon', 'first-quarter': 'first quarter moon', full: 'full moon', 'last-quarter': 'last quarter moon' });

export const FAMILIES = Object.freeze([
  { id: 'sign-at-instant', count: 60, answer: 'sign', description: 'The sign a body is in at an instant given to the minute in UTC.' },
  { id: 'sign-on-date', count: 60, answer: 'sign-or-depends', description: 'The sign a body is in on a date, with no time or zone given: DEPENDS when it changes sign during that date in some UTC offset.' },
  { id: 'retrograde-on-date', count: 60, answer: 'yes-no-depends', description: 'Whether a planet is retrograde on a date: DEPENDS when it stations during that date in some UTC offset.' },
  { id: 'ingress-date', count: 60, answer: 'date', description: 'The date a body enters a sign, in a year, or for the Moon a month, in which it enters that sign exactly once.' },
  { id: 'lunation-date', count: 60, answer: 'date', description: 'The date of a new moon, first quarter, full moon or last quarter, in a month that has exactly one.' },
]);

export const INSTRUCTIONS = Object.freeze({
  sign: 'Answer with only the name of the sign.',
  'sign-or-depends': 'If the answer depends on the time of day or the time zone, answer DEPENDS; otherwise answer with only the name of the sign.',
  'yes-no-depends': 'If the answer depends on the time of day or the time zone, answer DEPENDS; otherwise answer YES or NO.',
  date: 'Answer with only the date, as YYYY-MM-DD.',
});

/** mulberry32: a small seeded generator, so the questions are the same on every run. */
function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (value, width = 2) => String(value).padStart(width, '0');
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);
const isoSecond = (ms) => new Date(Math.round(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');
const lonAt = (body, ms) => bodyLongitude(body, new Date(ms));
const speedAt = (body, ms) => longitudeSpeed(body, new Date(ms));
const signIndex = (lon) => Math.floor((((lon % 360) + 360) % 360) / 30);
const wrap180 = (angle) => ((((angle + 180) % 360) + 360) % 360) - 180;
const nameOf = (body) => (body === 'Sun' || body === 'Moon' ? `the ${body}` : body);
const signName = (slug) => slug[0].toUpperCase() + slug.slice(1);
const spoken = (ms) => { const d = new Date(ms); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const past = (ms) => ms < Date.parse(`${REFERENCE_DATE}T00:00:00Z`);

/** The window a date without a zone covers, as the compute API reads it: from inclusive, to exclusive. */
export function windowOf(date) {
  const midnight = Date.parse(`${date}T00:00:00Z`);
  return { from: midnight - ANY_OFFSET_DAY.before, to: midnight + ANY_OFFSET_DAY.after };
}

/** Every date whose window holds an instant: its date in some UTC offset from −12:00 to +14:00. */
export function datesHolding(ms) {
  const dates = [];
  for (let midnight = Math.floor((ms - ANY_OFFSET_DAY.after) / DAY) * DAY; midnight <= ms + ANY_OFFSET_DAY.before; midnight += DAY) {
    if (ms >= midnight - ANY_OFFSET_DAY.before && ms < midnight + ANY_OFFSET_DAY.after) dates.push(isoDate(midnight));
  }
  return dates;
}

/** The first instant, to the second, at which `before` stops holding, given it holds at `lo` and not at `hi`. */
function bisect(lo, hi, before) {
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (before(mid)) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Sign changes of a body in [from, to), by sampling its longitude every `step`. */
export function signChanges(body, from, to, step) {
  const changes = [];
  let t0 = from;
  let i0 = signIndex(lonAt(body, t0));
  while (t0 < to) {
    const t1 = Math.min(t0 + step, to);
    const i1 = signIndex(lonAt(body, t1));
    if (i1 !== i0) {
      const at = bisect(t0, t1, (t) => signIndex(lonAt(body, t)) === i0);
      if (at < to) changes.push({ at, from: SIGNS[i0], into: SIGNS[i1], retrograde: speedAt(body, at) < 0 });
    }
    t0 = t1;
    i0 = i1;
  }
  return changes;
}

/** Stations of a planet in [from, to): where its longitude speed changes sign, sampled every `step`. */
export function stations(body, from, to, step) {
  const found = [];
  let t0 = from;
  let s0 = speedAt(body, t0) < 0;
  while (t0 < to) {
    const t1 = Math.min(t0 + step, to);
    const s1 = speedAt(body, t1) < 0;
    if (s1 !== s0) {
      const at = bisect(t0, t1, (t) => (speedAt(body, t) < 0) === s0);
      if (at < to) found.push({ at, type: s1 ? 'retrograde' : 'direct' });
    }
    t0 = t1;
    s0 = s1;
  }
  return found;
}

/** How far a longitude is from the nearest sign boundary, in arcseconds. */
const boundaryDistance = (lon) => {
  const within = ((lon % 30) + 30) % 30;
  return Math.min(within, 30 - within) * 3600;
};

/**
 * True when every station of a planet in [from, to) is at least
 * ENGINE_ERROR_ARCSEC from each sign boundary in `boundaries`, given as
 * longitudes, or without them from every sign boundary. A planet that
 * stations closer than that without crossing could cross in the real sky.
 */
function stationsClearOfBoundaries(body, from, to, boundaries) {
  if (body === 'Sun' || body === 'Moon') return true;
  return stations(body, from, to, 6 * HOUR).every(({ at }) => {
    const lon = lonAt(body, at);
    const distance = boundaries === undefined
      ? boundaryDistance(lon)
      : Math.min(...boundaries.map((boundary) => Math.abs(wrap180(lon - boundary)))) * 3600;
    return distance >= ENGINE_ERROR_ARCSEC;
  });
}

/** Instants in [from, to) at which the Moon–Sun elongation reaches `target`, sampled every hour. */
export function phaseInstants(target, from, to) {
  const found = [];
  const offset = (t) => wrap180(moonPhase(new Date(t)).angle - target);
  let t0 = from;
  let f0 = offset(t0);
  while (t0 < to) {
    const t1 = Math.min(t0 + HOUR, to);
    const f1 = offset(t1);
    if (f0 < 0 && f1 >= 0) {
      const at = bisect(t0, t1, (t) => offset(t) < 0);
      if (at < to) found.push(at);
    }
    t0 = t1;
    f0 = f1;
  }
  return found;
}

/** How close an event may come to the edge of a date before the question is not asked: 10 minutes, or the time the body takes to move ENGINE_ERROR_ARCSEC. */
function eventMargin(body, at) {
  const speed = Math.abs(speedAt(body, at));
  return Math.max(10 * MINUTE, ((ENGINE_ERROR_ARCSEC / 3600) / speed) * DAY);
}

/**
 * The span in which a period's dates fall in some UTC offset: from 14 hours
 * before its first midnight to 12 hours after the midnight that ends it, the
 * windows of its first and last dates. "Exactly once in the period" is judged
 * over this span, so no other date of the period can hold the event in any
 * offset.
 */
export function periodReach(from, to) {
  return { from: from - ANY_OFFSET_DAY.before, to: to + ANY_OFFSET_DAY.after - DAY };
}

/** True when an instant is at least `margin` from every edge at which the dates holding it change. */
function clearOfDateEdges(at, margin) {
  const timeOfDay = ((at % DAY) + DAY) % DAY;
  return [ANY_OFFSET_DAY.after - DAY, DAY - ANY_OFFSET_DAY.before]
    .every((edge) => Math.abs(timeOfDay - edge) >= margin && Math.abs(timeOfDay - edge - DAY) >= margin && Math.abs(timeOfDay - edge + DAY) >= margin);
}

const randomDay = (random) => SPAN.from + Math.floor(random() * ((SPAN.to - SPAN.from) / DAY)) * DAY;

function signAtInstant(random, index) {
  const body = BODIES[index % BODIES.length];
  const draw = drawLimit(`sign-at-instant ${index}`);
  for (;;) {
    draw();
    const at = SPAN.from + Math.floor(random() * ((SPAN.to - SPAN.from) / MINUTE)) * MINUTE;
    const lon = lonAt(body, at);
    const within = lon % 30;
    const margin = Math.min(within, 30 - within) * 3600;
    if (margin < (body === 'Moon' ? 1800 : 60)) continue;
    const time = new Date(at);
    const when = `at ${pad(time.getUTCHours())}:${pad(time.getUTCMinutes())} UTC on ${spoken(at)}`;
    const sign = SIGNS[signIndex(lon)];
    return {
      item: {
        family: 'sign-at-instant',
        prompt: past(at)
          ? `In the tropical zodiac, which sign was ${nameOf(body)} in ${when}? ${INSTRUCTIONS.sign}`
          : `In the tropical zodiac, which sign will ${nameOf(body)} be in ${when}? ${INSTRUCTIONS.sign}`,
      },
      key: { answer: signName(sign), accepted: [signName(sign)], facts: { body, instant: isoSecond(at), lon, sign, boundaryMarginArcsec: margin } },
    };
  }
}

/** The sign changes in a date's window, or null when one falls too close to its edges to ask. */
function dateSigns(body, date) {
  const { from, to } = windowOf(date);
  const step = body === 'Moon' ? 10 * MINUTE : HOUR;
  const near = signChanges(body, from - DAY, to + DAY, step);
  if (near.some(({ at }) => [from, to].some((edge) => Math.abs(at - edge) < eventMargin(body, at)))) return null;
  return { from, to, changes: near.filter(({ at }) => at >= from && at < to) };
}

/**
 * A quarter ask about the Moon, whose sign usually changes within a date; half
 * about the Sun or a planet on any date; a quarter about the Sun or a planet on
 * a date that holds one of its sign changes. About half the answers are
 * DEPENDS.
 */
function signOnDate(random, index) {
  const kind = index % 4;
  const body = kind === 0 ? 'Moon' : ['Sun', ...PLANETS][index % 9];
  const draw = drawLimit(`sign-on-date ${index}`);
  for (;;) {
    draw();
    let date;
    if (kind === 3) {
      // A date that holds one of the body's sign changes, so the answer is DEPENDS.
      const year = Date.UTC(1900 + Math.floor(random() * 150), 0, 1);
      const changes = signChanges(body, year, Date.UTC(new Date(year).getUTCFullYear() + 1, 0, 1), 6 * HOUR);
      if (changes.length === 0) continue;
      date = isoDate(changes[Math.floor(random() * changes.length)].at);
    } else {
      date = isoDate(randomDay(random));
    }
    const signs = dateSigns(body, date);
    if (!signs) continue;
    const ms = Date.parse(`${date}T00:00:00Z`);
    const atStart = SIGNS[signIndex(lonAt(body, signs.from))];
    const answer = signs.changes.length > 0 ? 'DEPENDS' : signName(atStart);
    if (signs.changes.length === 0 && !stationsClearOfBoundaries(body, signs.from - DAY, signs.to + DAY)) continue;
    return {
      item: {
        family: 'sign-on-date',
        prompt: past(ms)
          ? `In the tropical zodiac, which sign was ${nameOf(body)} in on ${spoken(ms)}? ${INSTRUCTIONS['sign-or-depends']}`
          : `In the tropical zodiac, which sign will ${nameOf(body)} be in on ${spoken(ms)}? ${INSTRUCTIONS['sign-or-depends']}`,
      },
      key: {
        answer,
        accepted: [answer],
        facts: {
          body, date, window: { from: isoSecond(signs.from), to: isoSecond(signs.to) }, atStart,
          changes: signs.changes.map(({ at, from, into, retrograde }) => ({ at: isoSecond(at), from, into, retrograde })),
        },
      },
    };
  }
}

/**
 * Half ask about any date; a quarter about a date the planet is retrograde
 * throughout, since a planet is direct most of the time; a quarter about a
 * date on which it stations. The planet moves on by one each round of eight,
 * so that every planet is asked each kind of question and its name does not
 * give the answer away.
 */
function retrogradeOnDate(random, index) {
  const body = PLANETS[(index + Math.floor(index / PLANETS.length)) % PLANETS.length];
  const kind = index % 4;
  const onStation = kind === 3;
  const draw = drawLimit(`retrograde-on-date ${index}`);
  for (;;) {
    draw();
    let date;
    if (onStation) {
      const year = Date.UTC(1900 + Math.floor(random() * 150), 0, 1);
      const found = stations(body, year, Date.UTC(new Date(year).getUTCFullYear() + 1, 0, 1), 6 * HOUR);
      if (found.length === 0) continue;
      date = isoDate(found[Math.floor(random() * found.length)].at);
    } else {
      date = isoDate(randomDay(random));
    }
    const { from, to } = windowOf(date);
    const near = stations(body, from - DAY, to + DAY, HOUR);
    if (near.some(({ at }) => Math.abs(at - from) < 6 * HOUR || Math.abs(at - to) < 6 * HOUR)) continue;
    const inside = near.filter(({ at }) => at >= from && at < to);
    const retrograde = speedAt(body, from) < 0;
    const answer = inside.length > 0 ? 'DEPENDS' : retrograde ? 'YES' : 'NO';
    if (kind === 1 && answer !== 'YES') continue;
    const ms = Date.parse(`${date}T00:00:00Z`);
    return {
      item: {
        family: 'retrograde-on-date',
        prompt: past(ms)
          ? `Was ${body} retrograde on ${spoken(ms)}? ${INSTRUCTIONS['yes-no-depends']}`
          : `Will ${body} be retrograde on ${spoken(ms)}? ${INSTRUCTIONS['yes-no-depends']}`,
      },
      key: {
        answer,
        accepted: [answer],
        facts: {
          body, date, window: { from: isoSecond(from), to: isoSecond(to) }, retrogradeAtStart: retrograde,
          stations: inside.map(({ at, type }) => ({ at: isoSecond(at), type })),
        },
      },
    };
  }
}

/** Sun 8, Moon 12, Mercury, Venus, Mars, Jupiter and Saturn 6 each, Uranus 4, Neptune 3, Pluto 3. */
const INGRESS_BODIES = Object.freeze([
  ...Array(8).fill('Sun'), ...Array(12).fill('Moon'),
  ...['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].flatMap((body) => Array(6).fill(body)),
  ...Array(4).fill('Uranus'), ...Array(3).fill('Neptune'), ...Array(3).fill('Pluto'),
]);

function ingressDate(random, index) {
  const body = INGRESS_BODIES[index];
  const draw = drawLimit(`ingress-date ${index}`);
  for (;;) {
    draw();
    const year = 1900 + Math.floor(random() * 150);
    const month = Math.floor(random() * 12);
    const from = body === 'Moon' ? Date.UTC(year, month, 1) : Date.UTC(year, 0, 1);
    const to = body === 'Moon' ? Date.UTC(year, month + 1, 1) : Date.UTC(year + 1, 0, 1);
    const reach = periodReach(from, to);
    const entries = signChanges(body, reach.from, reach.to, body === 'Moon' ? HOUR : 6 * HOUR)
      .map((change) => ({ ...change, sign: change.into }));
    // A sign the body enters exactly once in any offset's view of the period,
    // moving forward, at least two days from either end of the period.
    const once = SIGNS.filter((sign) => entries.filter((entry) => entry.sign === sign).length === 1)
      .map((sign) => entries.find((entry) => entry.sign === sign))
      .filter(({ at, retrograde }) => !retrograde && at - from >= 2 * DAY && to - at >= 2 * DAY && clearOfDateEdges(at, eventMargin(body, at)));
    if (once.length === 0) continue;
    const { at, sign } = once[Math.floor(random() * once.length)];
    // "Exactly once" must not turn on an entry into the same sign just outside
    // the span, or on a station within ENGINE_ERROR_ARCSEC of either of the
    // sign's boundaries, where the body could enter it again.
    const step = body === 'Moon' ? HOUR : 6 * HOUR;
    const outside = [...signChanges(body, reach.from - 10 * DAY, reach.from, step), ...signChanges(body, reach.to, reach.to + 10 * DAY, step)];
    if (outside.some((change) => change.into === sign && Math.min(Math.abs(change.at - reach.from), Math.abs(change.at - reach.to)) < eventMargin(body, change.at))) continue;
    const start = SIGNS.indexOf(sign) * 30;
    if (!stationsClearOfBoundaries(body, reach.from - DAY, reach.to + DAY, [start, start + 30])) continue;
    const period = body === 'Moon' ? `${MONTHS[month]} ${year}` : `${year}`;
    const accepted = datesHolding(at);
    // The body's other sign changes in the same span, among them any entry
    // while retrograde, which the test asks check_sky_fact about as well.
    const others = entries.filter((entry) => entry.at !== at)
      .map(({ at: when, from: left, into, retrograde }) => ({ at: isoSecond(when), from: left, into, retrograde }));
    return {
      item: {
        family: 'ingress-date',
        prompt: past(at)
          ? `In the tropical zodiac, on what date in ${period} did ${nameOf(body)} enter ${signName(sign)}? ${INSTRUCTIONS.date}`
          : `In the tropical zodiac, on what date in ${period} will ${nameOf(body)} enter ${signName(sign)}? ${INSTRUCTIONS.date}`,
      },
      key: { answer: isoDate(at), accepted, facts: { body, sign, period: { from: isoDate(from), to: isoDate(to) }, at: isoSecond(at), others } },
    };
  }
}

/** New moon and full moon 20 each, first and last quarter 10 each. */
const LUNATION_PHASES = Object.freeze(['new', 'full', 'first-quarter', 'new', 'full', 'last-quarter']);

function lunationDate(random, index) {
  const phase = LUNATION_PHASES[index % LUNATION_PHASES.length];
  const draw = drawLimit(`lunation-date ${index}`);
  for (;;) {
    draw();
    const year = 1900 + Math.floor(random() * 150);
    const month = Math.floor(random() * 12);
    const from = Date.UTC(year, month, 1);
    const to = Date.UTC(year, month + 1, 1);
    const reach = periodReach(from, to);
    const found = phaseInstants(PHASES[phase], from - 3 * DAY, to + 3 * DAY);
    // Exactly one in any offset's view of the month.
    const inReach = found.filter((at) => at >= reach.from && at < reach.to);
    if (inReach.length !== 1) continue;
    const at = inReach[0];
    if (at - from < 2 * DAY || to - at < 2 * DAY || !clearOfDateEdges(at, 10 * MINUTE)) continue;
    // Nor may another of the same phase fall within 10 minutes outside the span.
    if (found.some((t) => (t < reach.from || t >= reach.to) && Math.min(Math.abs(t - reach.from), Math.abs(t - reach.to)) < 10 * MINUTE)) continue;
    const accepted = datesHolding(at);
    return {
      item: {
        family: 'lunation-date',
        prompt: past(at)
          ? `On what date was the ${PHASE_WORDS[phase]} in ${MONTHS[month]} ${year}? ${INSTRUCTIONS.date}`
          : `On what date will the ${PHASE_WORDS[phase]} be in ${MONTHS[month]} ${year}? ${INSTRUCTIONS.date}`,
      },
      key: { answer: isoDate(at), accepted, facts: { phase, period: { from: isoDate(from), to: isoDate(to) }, at: isoSecond(at) } },
    };
  }
}

const BUILDERS = Object.freeze({
  'sign-at-instant': signAtInstant,
  'sign-on-date': signOnDate,
  'retrograde-on-date': retrogradeOnDate,
  'ingress-date': ingressDate,
  'lunation-date': lunationDate,
});

const PREFIX = Object.freeze({
  'sign-at-instant': 'si', 'sign-on-date': 'sd', 'retrograde-on-date': 'rd', 'ingress-date': 'in', 'lunation-date': 'lu',
});

/** The questions and the key, from the engine alone. */
export function buildBenchmark() {
  const items = [];
  const keys = [];
  FAMILIES.forEach(({ id, count, answer }, familyIndex) => {
    const random = generator(SEED + familyIndex);
    for (let index = 0; index < count; index += 1) {
      let built = BUILDERS[id](random, index);
      // A question already asked is drawn again: the slow planets enter few signs in the years the span holds.
      while (items.some((item) => item.prompt === built.item.prompt)) built = BUILDERS[id](random, index);
      const itemId = `${PREFIX[id]}-${pad(index + 1, 3)}`;
      items.push({ id: itemId, family: id, answer, prompt: built.item.prompt });
      keys.push({ id: itemId, ...built.key });
    }
  });
  const header = {
    name: NAME,
    version: VERSION,
    reference: REFERENCE_DATE,
    seed: SEED,
    dates: { from: isoDate(SPAN.from), to: isoDate(SPAN.to - DAY) },
  };
  return {
    items: { ...header, count: items.length, families: FAMILIES, instructions: INSTRUCTIONS, items },
    key: {
      ...header,
      engine: { name: '@zodiacs/engine', version: ENGINE_VERSION },
      conventions: 'Tropical zodiac. Apparent geocentric ecliptic longitude of date, from the engine\'s bodyLongitude, which positions() reports; retrograde means longitude speed below zero, from longitudeSpeed; the Moon\'s phase is the Moon–Sun elongation of moonPhase(). A date without a zone is read from 14 hours before its midnight UTC to 36 hours after, from inclusive and to exclusive, as the compute API reads it.',
      items: keys,
    },
  };
}

/**
 * The question as check_sky_fact asks it: the fact the key's answer says is
 * true, or, for a date question, the fact on the date the key names. Its
 * answer must be true for an instant or a definite date, and depends where
 * the key says DEPENDS or gives a date, since a date without a zone holds an
 * event in some offsets and not others.
 */
export function factFor(item, key) {
  const { facts } = key;
  switch (item.family) {
    case 'sign-at-instant':
      return { request: { kind: 'sign', body: facts.body, sign: facts.sign, instant: facts.instant }, answer: 'true' };
    case 'sign-on-date':
      return { request: { kind: 'sign', body: facts.body, sign: facts.atStart, date: facts.date }, answer: key.answer === 'DEPENDS' ? 'depends' : 'true' };
    case 'retrograde-on-date':
      return { request: { kind: 'retrograde', body: facts.body, date: facts.date }, answer: { YES: 'true', NO: 'false', DEPENDS: 'depends' }[key.answer] };
    case 'ingress-date':
      return { request: { kind: 'ingress', body: facts.body, sign: facts.sign, date: key.answer }, answer: 'depends' };
    case 'lunation-date':
      return { request: { kind: 'phase', phase: facts.phase, date: key.answer }, answer: 'depends' };
    default:
      throw new Error(`unknown family ${item.family}`);
  }
}

/** One object per line inside the list, so a change shows as a change to one question. */
export function serialize(document, listKey) {
  const { [listKey]: list, ...rest } = document;
  const head = JSON.stringify(rest, null, 2).replace(/\n}$/, '');
  const rows = list.map((entry) => `    ${JSON.stringify(entry)}`).join(',\n');
  return `${head},\n  "${listKey}": [\n${rows}\n  ]\n}\n`;
}

/**
 * How many facts tests/benchmarks/sky-benchmark.test.ts asks check_sky_fact
 * about: each of the twelve signs for a question about a sign; each question
 * about whether a planet was retrograde; every date the key accepts and the
 * date either side, for a date answer; and every date that holds an entry into
 * a sign while retrograde in an ingress question's period, where the entry is
 * at least 10 minutes from the edge of a date. The test counts as it asks and
 * holds its count to this.
 */
export function agreementChecks(items, key) {
  let facts = 0;
  let retrogradeEntries = 0;
  let retrogradeEntryDates = 0;
  items.items.forEach((item, index) => {
    const entry = key.items[index];
    if (item.family === 'sign-at-instant' || item.family === 'sign-on-date') facts += SIGNS.length;
    else if (item.family === 'retrograde-on-date') facts += 1;
    else facts += entry.accepted.length + 2;
    if (item.family !== 'ingress-date') return;
    for (const other of entry.facts.others.filter((change) => change.retrograde)) {
      retrogradeEntries += 1;
      retrogradeEntryDates += datesHolding(Date.parse(other.at)).length;
    }
  });
  return { facts: facts + retrogradeEntryDates, retrogradeEntries, retrogradeEntryDates };
}

/** check_sky_fact's reply to each question, through the function the MCP adapter registers. */
export async function toolAnswers(items, key, checkSkyFact) {
  const answers = [];
  for (const [index, item] of items.items.entries()) {
    const { request } = factFor(item, key.items[index]);
    const outcome = await checkSkyFact(request);
    if (!outcome.ok) throw new Error(`${item.id}: check_sky_fact refused ${JSON.stringify(request)}: ${outcome.refusal}`);
    answers.push({ id: item.id, request, reply: outcome.value });
  }
  return {
    name: NAME,
    version: VERSION,
    tool: 'check_sky_fact',
    note: 'Each reply is what check_sky_fact returns for the request beside it, unchanged: the MCP adapter\'s structured content, which is the compute API\'s sky-fact body for the same request apart from cite.url.',
    checks: {
      ...agreementChecks(items, key),
      note: 'How many facts the site\'s test asks check_sky_fact about around these questions, all of which it answers as the key does: every sign for a question about a sign, the question itself for whether a planet was retrograde, every date the key accepts and the date either side for a date answer, and every date holding an entry into a sign while retrograde in an ingress question\'s period.',
    },
    answers,
  };
}

/** A value with named fields: an object that is not a list. */
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * What a version's files were drawn with: the engine, and the ΔT tables its
 * replies' receipts name, as the files write them, with undefined for what
 * the files do not say.
 */
export function drawnWith(key, tool) {
  return { engine: key?.engine?.version, deltaT: tool?.answers?.[0]?.reply?.receipt?.deltaT };
}

/** Whether the files name an engine and ΔT tables a refusal can compare: a version, and tables each with a model, table and digest. */
const readable = ({ engine, deltaT }) => typeof engine === 'string' && Array.isArray(deltaT) && deltaT.length > 0
  && deltaT.every((entry) => isRecord(entry) && ['model', 'table', 'tableDigest'].every((field) => typeof entry[field] === 'string'));

/** The ΔT tables as the refusal names them: model, table and digest of each, in any order. */
const tablesOf = (deltaT) => deltaT.map(({ model, table, tableDigest }) => `${model} ${table} ${tableDigest}`).sort().join(', ');

/**
 * Why the installed engine may not draw a published version again, or null
 * when it may. A version is frozen once published: another engine or ΔT
 * table could move its answers, so it draws the next version in its own
 * folder. Only what the refusal names is compared, so the way a receipt
 * writes the same engine and tables, or the order it lists the tables in,
 * does not count as another engine. Files that do not say which engine and
 * tables drew them are refused too.
 */
export function redrawRefusal(published, installed, version = VERSION) {
  if (!readable(published)) {
    return `build-sky-benchmark: ${version}'s files do not say which engine and ΔT tables drew it: key.json names the engine, `
      + `and the first reply's receipt in tool-answers.json the tables. ${version} is frozen: restore its files rather than draw ${version} again.`;
  }
  if (published.engine === installed.engine && tablesOf(published.deltaT) === tablesOf(installed.deltaT)) return null;
  return `build-sky-benchmark: ${version} was drawn with @zodiacs/engine ${published.engine} (ΔT ${tablesOf(published.deltaT)}), `
    + `and the installed engine is ${installed.engine} (ΔT ${tablesOf(installed.deltaT)}). ${version} is frozen: raise VERSION to draw the next version in its own folder.`;
}

export async function installedEngine() {
  const { engineStatements } = await import('../src/lib/compute-api/receipt.ts');
  return { engine: ENGINE_VERSION, deltaT: engineStatements().deltaT };
}

/** How far apart the same event may be in two replies, in milliseconds. */
const EVENT_TOLERANCE_MS = 2_000;

/**
 * An object's fields that decide a reply, or the value as it is when it is
 * not an object, so that a malformed reply differs rather than throws.
 */
const fieldsOf = (value, names) => (isRecord(value) ? Object.fromEntries(names.map((name) => [name, value[name]])) : value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** The fields that decide each kind of event, apart from its time. */
const EVENT_FIELDS = Object.freeze({ changes: ['into', 'retrograde'], stations: ['type'], ingresses: ['retrograde'], lunations: ['sign'] });

/**
 * The part of a reply that decides its answer, in two parts: what must stay
 * the same (the question as read, the answer, and the facts behind it, each
 * event without its time), and each event's time, which may move within the
 * tolerance. A reply without a result is taken whole, its receipt aside, and
 * facts that are not an object are taken as they are.
 */
function decisive(reply) {
  const result = isRecord(reply) ? reply.result : undefined;
  if (!isRecord(result)) return { same: { unread: isRecord(reply) ? { ...reply, receipt: undefined } : [reply] }, times: {} };
  const { answer, basis, fact, instant, window, zone, facts } = result;
  if (!isRecord(facts)) return { same: { answer, basis, fact, instant, window, zone, facts: [facts] }, times: {} };
  const kept = {
    answer, basis, fact, instant, window, zone,
    sign: facts.sign,
    retrograde: facts.retrograde,
    atStart: fieldsOf(facts.atStart, ['sign', 'retrograde']),
  };
  const times = {};
  for (const [list, names] of Object.entries(EVENT_FIELDS)) {
    const events = facts[list];
    kept[list] = Array.isArray(events) ? events.map((event) => fieldsOf(event, names)) : events;
    if (Array.isArray(events)) times[list] = events.map((event) => (isRecord(event) ? event.at : undefined));
  }
  return { same: kept, times };
}

/** A time as a message shows it: as written when it is a string, and as JSON otherwise. */
const shown = (at) => (at === undefined || at === null ? 'missing' : typeof at === 'string' ? at : JSON.stringify(at));
/** A time in milliseconds, or NaN when it is not a string that reads as one. */
const timeOf = (at) => (typeof at === 'string' ? Date.parse(at) : NaN);

/**
 * Where check_sky_fact's replies now differ from a version's published ones,
 * in what the benchmark rests on: each request, its answer, and the facts
 * that decide it, with every event within 2 seconds of where it was. The
 * receipts, and anything else a reply reports, may differ: the published
 * replies are what the tool returned when the version was drawn. A file, a
 * reply or a part of one in another form than the tool's is compared as it
 * is, so that it differs rather than throws, and a time that does not read
 * as one differs from any time, itself included.
 */
export function replyDifferences(published, current) {
  const split = (file) => (isRecord(file) ? file : { file });
  const { answers: before, ...headBefore } = split(published);
  const { answers: after, ...headAfter } = split(current);
  const differences = same(headBefore, headAfter) ? [] : ['the header or the counts of facts'];
  if (!Array.isArray(before) || !Array.isArray(after)) return same(before, after) ? differences : [...differences, 'the replies are not a list'];
  if (before.length !== after.length) return [...differences, `${before.length} replies published, ${after.length} now`];
  before.forEach((was, index) => {
    const is = after[index];
    const name = [was, is].map((entry) => (isRecord(entry) ? entry.id : undefined)).find((id) => typeof id === 'string') ?? `reply ${index + 1}`;
    const asked = (entry) => (isRecord(entry) ? { id: entry.id, request: entry.request } : [entry]);
    if (!same(asked(was), asked(is))) {
      differences.push(`${name}: the request`);
      return;
    }
    const a = decisive(isRecord(was) ? was.reply : undefined);
    const b = decisive(isRecord(is) ? is.reply : undefined);
    if (!same(a.same, b.same)) {
      differences.push(`${name}: the answer or the facts behind it`);
      return;
    }
    for (const [list, times] of Object.entries(a.times)) {
      times.forEach((then, n) => {
        const now = b.times[list]?.[n];
        if (!(Math.abs(timeOf(then) - timeOf(now)) <= EVENT_TOLERANCE_MS)) differences.push(`${name}: ${list} ${shown(then)} is now ${shown(now)}`);
      });
    }
  });
  return differences;
}

/**
 * Writes a version that has not been published, or with `check`, holds a
 * published one to what this draws now, returning the files that differ.
 * A version is published once its folder holds any file, scorer.mjs among
 * them. It draws only VERSION, and refuses rather than redraw a published
 * version: with one of its files missing, with another engine or ΔT tables,
 * or without `check`. With `check`, it refuses a version not yet published.
 */
export async function writeOrCheck(version = VERSION, { check = false, root = ROOT } = {}) {
  const dir = resolve(root, folderOf(version));
  // Only a folder or a file that is not there counts as absent; any other failure to read one stops the generator.
  const absent = (error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  };
  const entries = (await readdir(dir).catch(absent)) ?? [];
  const texts = await Promise.all(DRAWN_FILES.map((name) => readFile(resolve(dir, name), 'utf8').catch(absent)));
  const published = entries.length > 0 || texts.some((text) => text !== null);
  if (version !== VERSION) {
    throw new Error(`build-sky-benchmark: this generator draws ${VERSION}, not ${version}. `
      + (published ? `${version} is frozen: its pinned bytes hold it.` : `Raise VERSION to draw ${version}.`));
  }
  if (check && !published) {
    throw new Error(`build-sky-benchmark: ${version} is not published, so there is nothing to check. Draw it without --check.`);
  }
  let publishedTool;
  if (published) {
    const missing = DRAWN_FILES.filter((_, index) => texts[index] === null);
    if (missing.length > 0) {
      const listed = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)} are` : `${names[0]} is`);
      // With none of the drawn files left, say what makes the folder count as published.
      const others = entries.filter((name) => !DRAWN_FILES.includes(name));
      const holds = missing.length === DRAWN_FILES.length && others.length > 0 ? ` (its folder holds ${others.join(', ')})` : '';
      // A drawn file the folder lists but that reads as not there is a link to a file that is not there.
      const broken = missing.filter((name) => entries.includes(name));
      const links = broken.length > 0 ? ` ${listed(broken)} ${broken.length > 1 ? 'links to files that are' : 'a link to a file that is'} not there.` : '';
      throw new Error(`build-sky-benchmark: ${version} is published${holds}, but ${listed(missing)} missing.${links} ${version} is frozen: restore ${missing.length > 1 ? 'them' : 'it'} rather than draw ${version} again.`);
    }
    const parsed = (name) => {
      try {
        return JSON.parse(texts[DRAWN_FILES.indexOf(name)]);
      } catch (error) {
        throw new Error(`build-sky-benchmark: ${version}'s ${name} does not read as JSON (${error.message}). ${version} is frozen: restore it rather than draw ${version} again.`);
      }
    };
    const publishedKey = parsed('key.json');
    publishedTool = parsed('tool-answers.json');
    const refusal = redrawRefusal(drawnWith(publishedKey, publishedTool), await installedEngine(), version);
    if (refusal) throw new Error(refusal);
    if (!check) {
      throw new Error(`build-sky-benchmark: ${version} is published. ${version} is frozen: check it with --check, or raise VERSION to draw the next version in its own folder.`);
    }
  }
  const { checkSkyFact } = await import('../src/mcp/sky-tools.ts');
  const { items, key } = buildBenchmark();
  const tool = await toolAnswers(items, key, checkSkyFact);
  const files = {
    'items.json': serialize(items, 'items'),
    'key.json': serialize(key, 'items'),
    'tool-answers.json': serialize(tool, 'answers'),
  };
  if (!check) {
    for (const [name, text] of Object.entries(files)) {
      const path = resolve(dir, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, text);
    }
    return [];
  }
  const stale = ['items.json', 'key.json'].filter((name) => texts[DRAWN_FILES.indexOf(name)] !== files[name]);
  if (replyDifferences(publishedTool, tool).length > 0) stale.push('tool-answers.json');
  return stale;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = await writeOrCheck(VERSION, { check });
  if (check && stale.length > 0) {
    console.error(`build-sky-benchmark: ${stale.join(', ')} of ${VERSION} differ from what the generator draws now. ${VERSION} is frozen, so the change belongs in the next version.`);
    process.exit(1);
  }
  console.log(`build-sky-benchmark: ${check ? 'up to date' : `wrote ${OUT_DIR}`}`);
}
