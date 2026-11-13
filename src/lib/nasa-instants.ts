/**
 * The exact times the pages print for planet ingresses, stations and aspects,
 * taken from NASA JPL Horizons (DE441) instead of the site's engine.
 *
 * The engine places the planets a few arcseconds from NASA. For a slow
 * planet that becomes minutes or hours in an event's time (Neptune's entry
 * into Aries is about three hours off), so the committed data files keep the
 * engine's instants and src/data/nasa-event-instants.json
 * (`python3 scripts/build-nasa-event-instants.py`) records NASA's instant for
 * each of them. Every committed engine instant is listed in its NASA row, so
 * the lookup is exact: an instant the table does not list comes back
 * unchanged, and src/lib/nasa-instants.test.ts fails until the table is
 * rebuilt.
 *
 * The data files stay as they are: ingresses.json, sky.json and
 * events-publication.json are bundled byte for byte into the AI tools, and a
 * page's id and address still come from the committed instant. Only what a
 * page prints changes. The Sun and the Moon are not in the table: the engine
 * already places their events within a minute of NASA.
 *
 * Build-side module: pages and libraries import it; islands must not (the
 * table is about 200 KB).
 */
import table from '../data/nasa-event-instants.json';

interface IngressRow { body: string; sign: string; retrograde: boolean; nasa: string; engine: string[] }
interface StationRow { body: string; type: string; sign: string; nasa: string; engine: string[] }
interface AspectRow { a: string; b: string; type: string; aSign: string; nasa: string; engine: string[] }

export interface NasaEventTable {
  schema: string;
  matchWindowDays: number;
  ingresses: IngressRow[];
  stations: StationRow[];
  aspects: AspectRow[];
}

export const NASA_EVENT_TABLE = table as unknown as NasaEventTable;

/** Where a refined instant comes from, for provenance lines. */
export const NASA_INSTANT_SOURCE = 'NASA JPL Horizons (DE441), src/data/nasa-event-instants.json';

const iso = (value: string): string => new Date(value).toISOString();

const ingressIndex = new Map<string, string>();
const stationIndex = new Map<string, string>();
const aspectIndex = new Map<string, string>();
for (const row of NASA_EVENT_TABLE.ingresses) {
  for (const at of row.engine) ingressIndex.set(`${row.body}|${at}`, iso(row.nasa));
}
for (const row of NASA_EVENT_TABLE.stations) {
  for (const at of row.engine) stationIndex.set(`${row.body}|${at}`, iso(row.nasa));
}
for (const row of NASA_EVENT_TABLE.aspects) {
  for (const at of row.engine) aspectIndex.set(`${row.a}|${row.b}|${row.type}|${at}`, iso(row.nasa));
}

/** NASA's instant for a planet's sign ingress the data files date at `at`. */
export function nasaIngressAt(body: string, at: string): string | undefined {
  return ingressIndex.get(`${body}|${at}`);
}

/** NASA's instant for a planet's station the data files date at `at`. */
export function nasaStationAt(body: string, at: string): string | undefined {
  return stationIndex.get(`${body}|${at}`);
}

/** NASA's instant for an exact aspect the data files date at `at`. */
export function nasaAspectAt(a: string, b: string, type: string, at: string): string | undefined {
  return aspectIndex.get(`${a}|${b}|${type}|${at}`);
}

export type SkyEventRef =
  | { kind: 'ingress'; body: string; at: string }
  | { kind: 'station'; body: string; at: string }
  | { kind: 'aspect'; a: string; b: string; type: string; at: string };

/** The instant to print for an event: NASA's when the table has it, else the committed one. */
export function exactInstant(event: SkyEventRef): string {
  switch (event.kind) {
    case 'ingress': return nasaIngressAt(event.body, event.at) ?? event.at;
    case 'station': return nasaStationAt(event.body, event.at) ?? event.at;
    case 'aspect': return nasaAspectAt(event.a, event.b, event.type, event.at) ?? event.at;
  }
}

const byAt = <T extends { at: string }>(a: T, b: T) => a.at.localeCompare(b.at);

interface TransitMonthShape {
  ingresses: { planet: string; at: string }[];
  stations: { planet: string; at: string }[];
  aspects: { a: string; b: string; type: string; at: string }[];
}

/**
 * A monthly catalog (src/data/transits-YYYY-MM.json) with its ingress,
 * station and aspect instants taken from NASA. Lunations and the Sun's
 * ingresses keep the catalog's instants.
 */
export function refineTransitMonth<T extends TransitMonthShape>(month: T): T {
  return {
    ...month,
    ingresses: month.ingresses
      .map((item) => ({ ...item, at: exactInstant({ kind: 'ingress', body: item.planet, at: item.at }) }))
      .sort(byAt),
    stations: month.stations
      .map((item) => ({ ...item, at: exactInstant({ kind: 'station', body: item.planet, at: item.at }) }))
      .sort(byAt),
    aspects: month.aspects
      .map((item) => ({ ...item, at: exactInstant({ kind: 'aspect', a: item.a, b: item.b, type: item.type, at: item.at }) }))
      .sort(byAt),
  };
}

/**
 * A day's events (src/data/daily.json) with each planet ingress, station and
 * exact aspect at NASA's instant. Lunations and the Sun keep their instants.
 * Order is kept as given, though a correction can be hours and can move an
 * event across midnight: a list for one UTC day takes its events from
 * eventsOnUtcDay instead.
 */
export function refineDailyEvents<E extends { kind: string; at: string; planet?: string; a?: string; b?: string; type?: string }>(events: readonly E[]): E[] {
  return events.map((event) => {
    let at = event.at;
    if ((event.kind === 'ingress' || event.kind === 'station') && event.planet) {
      at = exactInstant({ kind: event.kind, body: event.planet, at: event.at });
    } else if (event.kind === 'aspect' && event.a && event.b && event.type) {
      at = exactInstant({ kind: 'aspect', a: event.a, b: event.b, type: event.type, at: event.at });
    }
    return at === event.at ? event : { ...event, at };
  });
}

/** One event of a day, in the shape of daily.json's events. */
export interface DayEvent {
  kind: 'ingress' | 'lunation' | 'station' | 'aspect';
  at: string;
  planet?: string;
  a?: string;
  b?: string;
  type?: string;
  sign?: string;
}

type CatalogItem = Omit<DayEvent, 'kind'>;

interface TransitCatalogShape {
  month: string;
  ingresses: readonly CatalogItem[];
  lunations: readonly CatalogItem[];
  stations: readonly CatalogItem[];
  aspects: readonly CatalogItem[];
}

const EVENT_ARRAYS = [
  ['ingresses', 'ingress'],
  ['lunations', 'lunation'],
  ['stations', 'station'],
  ['aspects', 'aspect'],
] as const;

const shiftMonth = (month: string, by: number): string => {
  const at = new Date(`${month}-01T00:00:00.000Z`);
  at.setUTCMonth(at.getUTCMonth() + by);
  return at.toISOString().slice(0, 7);
};

/**
 * The events of one UTC day (YYYY-MM-DD) as the pages print them, in the
 * shape of daily.json's events: every catalog ingress, lunation, station and
 * aspect whose printed instant (refineDailyEvents) falls on that day, sorted.
 * daily.json slices the catalog by the engine's instant, and NASA can move an
 * event across midnight (Neptune sextile Pluto: engine 24 July 2026 23:09,
 * NASA 25 July 05:28), so a day's list is built here rather than from that
 * slice. The catalogs of the day's month and the months either side are read.
 */
export function eventsOnUtcDay(catalogs: readonly TransitCatalogShape[], date: string): DayEvent[] {
  const month = date.slice(0, 7);
  const months = new Set([shiftMonth(month, -1), month, shiftMonth(month, 1)]);
  const events = catalogs
    .filter((catalog) => months.has(catalog.month))
    .flatMap((catalog) => EVENT_ARRAYS.flatMap(([array, kind]) => (
      catalog[array].map((item): DayEvent => ({ kind, ...item }))
    )));
  return refineDailyEvents(events)
    .filter((event) => event.at.slice(0, 10) === date)
    .sort(byAt);
}

/**
 * Published event pages (src/data/events-publication.json) with each anchor
 * moved to the NASA instant the page prints, so a list that prints NASA's
 * times still finds the page for an event. A retrograde page's anchor is its
 * retrograde station.
 */
export function refinePublishedAnchors<P extends { family: string; anchor: string; bodies?: string[]; subtype?: string }>(pages: readonly P[]): P[] {
  return pages.map((page) => {
    const [a, b] = page.bodies ?? [];
    let anchor: string | undefined;
    if (page.family === 'ingress' && a) anchor = nasaIngressAt(a, page.anchor);
    else if (page.family === 'aspect' && a && b && page.subtype) anchor = nasaAspectAt(a, b, page.subtype, page.anchor);
    else if (page.family === 'retrograde' && a) anchor = nasaStationAt(a, page.anchor);
    return anchor ? { ...page, anchor } : page;
  });
}

/**
 * Retrograde windows (src/data/sky.json) with each station moved to NASA's
 * instant. A start clipped at the table's first day is not a station and is
 * kept.
 */
export function refineRetrogradeWindows<W extends { planet: string; from: string; to: string | null }>(windows: readonly W[]): W[] {
  return windows.map((window) => ({
    ...window,
    from: nasaStationAt(window.planet, window.from) ?? window.from,
    to: window.to === null ? null : nasaStationAt(window.planet, window.to) ?? window.to,
  }));
}

/**
 * Sign occupancy windows (src/data/ingresses.json) with each edge moved to
 * NASA's ingress instant. Edges the table does not list (the Sun, and the
 * clipped edges at each horizon) are kept.
 */
export function refineIngressWindows<W extends { planet: string; from: string; to: string }>(windows: readonly W[]): W[] {
  return windows.map((window) => ({
    ...window,
    from: nasaIngressAt(window.planet, window.from) ?? window.from,
    to: nasaIngressAt(window.planet, window.to) ?? window.to,
  }));
}
