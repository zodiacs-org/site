/**
 * The times the AI tools give for a planet's sign change, taken from NASA JPL Horizons (DE441) where the
 * site's NASA event table (src/data/nasa-event-instants.json, built by scripts/build-nasa-event-instants.py)
 * has the event, so a tool and the site's pages give one time for one event.
 *
 * The engine places a slow planet a few arcseconds from NASA, and for a planet that moves a few arcseconds an
 * hour that becomes hours in the time of a sign change: by NASA Neptune entered Aries at 17:35:23 UTC on
 * 26 January 2026, where the engine's own crossing is 14:31:41. The table holds every sign change of Mercury,
 * Venus and Mars from November 2025 to May 2031, of Jupiter from 2013 to 2046, of Saturn from 1979 to 2080 and
 * of Uranus, Neptune and Pluto from 1899 to 2100 (its `coverage`). The Sun and the Moon are not in it: the
 * engine places their sign changes within a minute of NASA.
 *
 * Outside those dates a tool can only give the engine's own time, and says how far that has been from NASA's
 * across the dates the table does cover (largestCorrectionSeconds, read from the table's own rows).
 *
 * Only the table's ingress rows and coverage are imported, so the stations and aspects stay out of the bundle.
 * Pure: no network, storage or logging.
 */
import { ingresses, coverage } from '../../data/nasa-event-instants.json';

const DAY = 86_400_000;
/** An engine instant and a NASA instant are the same event when they lie this close; the table is built with the same window. */
export const NASA_MATCH_WINDOW_MS = 2 * DAY;

export interface NasaIngress {
  body: string;
  sign: string;
  retrograde: boolean;
  /** NASA's instant, UTC, ISO 8601 with milliseconds (the table is solved to the second). */
  at: string;
}

interface Row { body: string; sign: string; retrograde: boolean; time: number; engine: number[] }
const ROWS = new Map<string, Row[]>();
for (const row of ingresses as { body: string; sign: string; retrograde: boolean; nasa: string; engine: string[] }[]) {
  const list = ROWS.get(row.body) ?? [];
  list.push({ body: row.body, sign: row.sign, retrograde: row.retrograde, time: Date.parse(row.nasa), engine: row.engine.map((at) => Date.parse(at)) });
  ROWS.set(row.body, list);
}
for (const list of ROWS.values()) list.sort((a, b) => a.time - b.time);

const SPANS = new Map<string, { from: number; to: number; fromDay: string; toDay: string }>();
for (const [body, entry] of Object.entries(coverage as Record<string, { ingresses: string }>)) {
  const [fromDay, toDay] = entry.ingresses.split(' to ');
  SPANS.set(body, { from: Date.parse(`${fromDay}T00:00:00Z`), to: Date.parse(`${toDay}T00:00:00Z`), fromDay, toDay });
}

/** The planets whose sign changes the table holds: Mercury through Pluto. */
export const NASA_INGRESS_BODIES: readonly string[] = [...ROWS.keys()];

const toIngress = (row: Row): NasaIngress => ({ body: row.body, sign: row.sign, retrograde: row.retrograde, at: new Date(row.time).toISOString() });

/** The first and last day the table holds a planet's sign changes for, or undefined for a body it leaves out. */
export function nasaIngressCoverage(body: string): { from: string; to: string } | undefined {
  const span = SPANS.get(body);
  return span ? { from: span.fromDay, to: span.toDay } : undefined;
}

/** Whether the table holds every sign change of the body at this instant: false outside its dates and for the Sun and the Moon. */
export function nasaCoversIngress(body: string, at: Date | string): boolean {
  const span = SPANS.get(body);
  const time = new Date(at).getTime();
  return !!span && time >= span.from && time <= span.to;
}

function nearest(body: string, sign: string, at: Date | string, retrograde?: boolean): Row | undefined {
  const time = new Date(at).getTime();
  let best: Row | undefined;
  for (const row of ROWS.get(body) ?? []) {
    if (row.sign !== sign || (retrograde !== undefined && row.retrograde !== retrograde)) continue;
    if (Math.abs(row.time - time) > NASA_MATCH_WINDOW_MS) continue;
    if (!best || Math.abs(row.time - time) < Math.abs(best.time - time)) best = row;
  }
  return best;
}

/**
 * NASA's instant for the sign change the engine dates at `at`: the table's entry of that body into that sign
 * within two days of it. Undefined when the table has none, which leaves the engine's own time.
 */
export function nasaIngressNear(body: string, sign: string, at: Date | string, retrograde?: boolean): string | undefined {
  const row = nearest(body, sign, at, retrograde);
  return row ? new Date(row.time).toISOString() : undefined;
}

/** The table's sign changes of a body after `from` and up to `to`, as the event searches count a window (start exclusive, end inclusive). */
export function nasaIngressesBetween(body: string, from: Date, to: Date): NasaIngress[] {
  return (ROWS.get(body) ?? []).filter((row) => row.time > from.getTime() && row.time <= to.getTime()).map(toIngress);
}

/**
 * How far the engine's own time for a body's sign change has been from NASA's, at most, across the table:
 * the largest gap between a row's NASA instant and the engine instants it replaces. Undefined for a body the
 * table leaves out.
 */
export function largestCorrectionSeconds(body: string): number | undefined {
  const rows = ROWS.get(body);
  if (!rows) return undefined;
  let worst = 0;
  for (const row of rows) for (const engine of row.engine) worst = Math.max(worst, Math.abs(row.time - engine) / 1000);
  return worst;
}

/** That gap in plain words, rounded up: "about 9 hours 37 minutes" or "about 5 minutes". */
export function largestCorrectionWords(body: string): string | undefined {
  const seconds = largestCorrectionSeconds(body);
  if (seconds === undefined) return undefined;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  if (hours === 0) return `about ${plural(minutes, 'minute')}`;
  return rest === 0 ? `about ${plural(hours, 'hour')}` : `about ${plural(hours, 'hour')} ${plural(rest, 'minute')}`;
}

export interface IngressLike { kind: string; body?: string; at: string; sign: string; retrograde?: boolean }
export interface RefinedIngresses<T> {
  /** The events with each planet's sign change at NASA's instant where the table has it, sorted by time. */
  events: T[];
  /** The sign changes now at NASA's instant. */
  nasa: NasaIngress[];
  /** Sign changes of Mercury through Pluto left at the engine's own time, because the table does not reach their date. */
  engineOnly: { body: string; sign: string; at: string }[];
}

/**
 * An event search's results with each planet's sign change moved to NASA's instant. The window is the search's
 * own (start exclusive, end inclusive) and `bodies` the bodies it searched: a sign change NASA puts outside the
 * window is dropped, and one NASA puts inside it that the engine put outside is added, so the list is what
 * NASA's times give for that window. Stations, lunations and the Sun's and the Moon's sign changes are kept as
 * they are.
 */
export function refineIngressEvents<T extends IngressLike>(events: readonly T[], from: Date, to: Date, bodies: readonly string[]): RefinedIngresses<T> {
  const out: T[] = [];
  const nasa: NasaIngress[] = [];
  const engineOnly: RefinedIngresses<T>['engineOnly'] = [];
  const used = new Set<Row>();
  const inside = (time: number) => time > from.getTime() && time <= to.getTime();
  for (const event of events) {
    if (event.kind !== 'ingress' || !event.body || !ROWS.has(event.body)) { out.push(event); continue; }
    const row = nearest(event.body, event.sign, event.at, event.retrograde);
    if (!row) {
      out.push(event);
      engineOnly.push({ body: event.body, sign: event.sign, at: event.at });
      continue;
    }
    used.add(row);
    if (!inside(row.time)) continue;
    out.push({ ...event, at: new Date(row.time).toISOString() });
    nasa.push(toIngress(row));
  }
  for (const body of bodies) {
    for (const row of ROWS.get(body) ?? []) {
      if (used.has(row) || !inside(row.time)) continue;
      const added = toIngress(row);
      out.push({ kind: 'ingress', body: added.body, at: added.at, sign: added.sign, retrograde: added.retrograde } as unknown as T);
      nasa.push(added);
    }
  }
  // A stable sort by time: events at one instant keep the search's own order.
  const events2 = out.map((event, index) => ({ event, index })).sort((a, b) => a.event.at.localeCompare(b.event.at) || a.index - b.index).map((entry) => entry.event);
  nasa.sort((a, b) => a.at.localeCompare(b.at));
  return { events: events2, nasa, engineOnly };
}

const METHOD_PATH = '/methodology/#event-times';
const listWords = (items: string[]) => (items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/**
 * The links that say where the sign-change times in an answer come from. The published results of
 * get_upcoming_events and check_sky_fact take no new field, and their calculation block is the engine's own
 * receipted answer, so the note travels in the links array, which was always open.
 */
export function ingressSourceLinks(origin: string, refined: Pick<RefinedIngresses<unknown>, 'nasa' | 'engineOnly'>): { title: string; url: string }[] {
  const links: { title: string; url: string }[] = [];
  const url = `${origin}${METHOD_PATH}`;
  if (refined.nasa.length) links.push({ title: 'Sign-change times of Mercury through Pluto are NASA JPL Horizons times; the calculation block keeps the engine\'s own', url });
  const bodies = [...new Set(refined.engineOnly.map((event) => event.body))];
  if (bodies.length) {
    const gaps = bodies.map((body) => `${largestCorrectionWords(body)} for ${body}`);
    links.push({ title: `Not checked against NASA at these dates: the sign-change time of ${listWords(bodies)} is the engine's own. Where it was checked it was up to ${listWords(gaps)} from NASA's, and it can be more here`, url });
  }
  return links;
}

/** The parts of a sky-fact result an ingress check reads. */
export interface IngressFactResult {
  answer: 'true' | 'false' | 'depends';
  basis: string;
  fact: Record<string, string | null>;
  window: { from: string; to: string } | null;
  facts: Record<string, unknown>;
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const second = (at: string) => at.replace('.000Z', 'Z');
const nasaLine = (row: NasaIngress) => `${row.body} ${row.retrograde ? 'moves back into' : 'enters'} ${cap(row.sign)} at ${second(row.at)}`;

/**
 * check_sky_fact's verdict on "did this planet enter this sign on this day", judged on NASA's time for the sign
 * change where the table has it. The day's window is the calculation's own. Null when the table does not hold
 * the planet's sign changes on that day (the Sun, the Moon, or a date outside its coverage) and the engine found
 * no sign change: the engine's verdict then stands as it is.
 */
export function checkIngressFact(origin: string, result: IngressFactResult): { answer: IngressFactResult['answer'] | null; links: { title: string; url: string }[] } | null {
  const { body, sign } = result.fact;
  if (!body || !sign || !result.window || !ROWS.has(body)) return null;
  const url = `${origin}${METHOD_PATH}`;
  // The search's span: from the window's first instant up to, not including, its last.
  const from = new Date(Date.parse(result.window.from) - 1);
  const to = new Date(Date.parse(result.window.to) - 1);
  const engine = ((result.facts.ingresses ?? []) as { at: string; retrograde: boolean }[]);
  if (!nasaCoversIngress(body, from) || !nasaCoversIngress(body, to)) {
    return engine.length ? { answer: null, links: ingressSourceLinks(origin, { nasa: [], engineOnly: engine.map((event) => ({ body, sign, at: event.at })) }) } : null;
  }
  const rows = nasaIngressesBetween(body, from, to).filter((row) => row.sign === sign);
  const answer = rows.length === 0 ? 'false' : result.basis === 'any-zone-day' ? 'depends' : 'true';
  // A sign change the engine put inside the day and NASA puts outside it: say where NASA puts it.
  const outside = rows.length ? [] : engine
    .map((event) => nearest(body, sign, event.at, event.retrograde))
    .filter((row): row is Row => !!row)
    .map(toIngress);
  const lines = [...rows.map(nasaLine), ...outside.map((row) => `${nasaLine(row)}, outside this day`)];
  return {
    answer,
    links: lines.length ? [{ title: `By NASA JPL Horizons, ${listWords(lines)}; the verdict follows NASA's time, and the calculation block keeps the engine's own`, url }] : [],
  };
}
