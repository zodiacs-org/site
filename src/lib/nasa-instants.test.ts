/**
 * The NASA event table (src/data/nasa-event-instants.json) offline: CI
 * cannot reach NASA, so these checks hold the committed table to itself and
 * to the site's data files. `python3 scripts/build-nasa-event-instants.py
 * --check` rebuilds it from the Horizons responses where they are on disk.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NASA_EVENT_TABLE as table,
  exactInstant,
  nasaAspectAt,
  nasaIngressAt,
  nasaStationAt,
  refineIngressWindows,
  refinePublishedAnchors,
  refineRetrogradeWindows,
  refineTransitMonth,
} from './nasa-instants';

const DATA = resolve(process.cwd(), 'src/data');
const read = <T>(name: string): T => JSON.parse(readFileSync(resolve(DATA, name), 'utf8')) as T;
const raw = read<Record<string, unknown> & {
  provenance: { ephemeris: string; source: string; queries: { name: string; url: string; retrievedUtc: string; sha256: string; bytes: number }[] };
  coverage: Record<string, { ingresses: string; stations: string }>;
  withinOneMinute: { sunIngresses: { count: number; maxSeconds: number } };
}>('nasa-event-instants.json');

const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const DAY_MS = 86_400_000;
const time = (iso: string) => Date.parse(iso);

interface TransitMonth {
  month: string;
  ingresses: { planet: string; at: string; sign: string; retrograde: boolean }[];
  lunations: { type: string; at: string }[];
  stations: { planet: string; at: string; type: string }[];
  aspects: { a: string; b: string; type: string; at: string; aSign: string }[];
}
const months = readdirSync(DATA)
  .filter((name) => /^transits-\d{4}-\d{2}\.json$/u.test(name))
  .sort()
  .map((name) => read<TransitMonth>(name));
const ingressData = read<{ horizons: { planets: string[]; from: string; to: string }[]; windows: { planet: string; sign: string; from: string; to: string }[] }>('ingresses.json');
const sky = read<{ from: string; retrogrades: { planet: string; from: string; to: string | null }[] }>('sky.json');
const publication = read<{ pages: { id: string; family: string; anchor: string; bodies: string[]; subtype: string; signs: string[] }[] }>('events-publication.json');
const program = read<{ evidence: { kind: string; eventKind?: string; eventType?: string; body?: string; a?: string; b?: string; at: string }[] }>('horoscope-program.json');

describe('the NASA event table', () => {
  it('records where every instant came from', () => {
    expect(raw.provenance.ephemeris).toBe('DE441');
    expect(raw.provenance.source).toMatch(/NASA JPL Horizons/u);
    expect(raw.provenance.queries.length).toBeGreaterThanOrEqual(9);
    for (const query of raw.provenance.queries) {
      expect(query.url.startsWith('https://ssd.jpl.nasa.gov/api/horizons.api?')).toBe(true);
      expect(query.url).toContain('QUANTITIES=%2731%27');
      expect(query.sha256).toMatch(/^[0-9a-f]{64}$/u);
      expect(query.retrievedUtc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u);
      expect(query.bytes).toBeGreaterThan(0);
    }
  });

  it('writes each instant in UTC to the second, in time order', () => {
    for (const rows of [table.ingresses, table.stations, table.aspects]) {
      for (const row of rows) expect(row.nasa).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u);
      const order = rows.map((row) => row.nasa);
      expect(order).toEqual([...order].sort());
    }
  });

  it('keeps each engine instant within the match window of its NASA instant, in one row only', () => {
    const window = table.matchWindowDays * DAY_MS;
    const seen = new Set<string>();
    const rows: { key: string; nasa: string; engine: string[] }[] = [
      ...table.ingresses.map((row) => ({ key: `ingress|${row.body}`, nasa: row.nasa, engine: row.engine })),
      ...table.stations.map((row) => ({ key: `station|${row.body}`, nasa: row.nasa, engine: row.engine })),
      ...table.aspects.map((row) => ({ key: `aspect|${row.a}|${row.b}|${row.type}`, nasa: row.nasa, engine: row.engine })),
    ];
    for (const row of rows) {
      for (const at of row.engine) {
        expect(Math.abs(time(at) - time(row.nasa))).toBeLessThanOrEqual(window);
        const key = `${row.key}|${at}`;
        expect(seen.has(key), key).toBe(false);
        seen.add(key);
      }
    }
  });

  it('moves each planet one sign at a time, forward when direct and back when retrograde', () => {
    for (const body of PLANETS) {
      const rows = table.ingresses.filter((row) => row.body === body);
      expect(rows.length, body).toBeGreaterThan(0);
      for (let i = 1; i < rows.length; i += 1) {
        const previous = SIGNS.indexOf(rows[i - 1].sign);
        const step = rows[i].retrograde ? 11 : 1;
        expect(SIGNS.indexOf(rows[i].sign), `${body} ${rows[i].nasa}`).toBe((previous + step) % 12);
      }
    }
  });

  it('alternates each planet\'s retrograde and direct stations', () => {
    for (const body of PLANETS) {
      const rows = table.stations.filter((row) => row.body === body);
      expect(rows.length, body).toBeGreaterThan(0);
      for (let i = 1; i < rows.length; i += 1) expect(rows[i].type).not.toBe(rows[i - 1].type);
    }
  });

  it('leaves out only the Sun, which the engine places within a minute of NASA', () => {
    expect(raw.withinOneMinute.sunIngresses.count).toBeGreaterThan(0);
    expect(raw.withinOneMinute.sunIngresses.maxSeconds).toBeLessThan(60);
    expect(table.ingresses.some((row) => row.body === 'Sun' || row.body === 'Moon')).toBe(false);
  });

  it('agrees with the NASA instants the accuracy audit found', () => {
    expect(nasaIngressAt('Neptune', '2026-01-26T14:30:44.561Z')).toBe('2026-01-26T17:35:23.000Z');
    expect(nasaIngressAt('Uranus', '2026-04-26T01:01:21.002Z')).toBe('2026-04-26T00:51:53.000Z');
    expect(nasaIngressAt('Jupiter', '2026-06-30T05:56:21.335Z')).toBe('2026-06-30T05:52:27.000Z');
    expect(nasaIngressAt('Saturn', '2026-02-14T00:39:37.844Z')).toBe('2026-02-14T00:11:49.000Z');
    expect(nasaAspectAt('Neptune', 'Pluto', 'sextile', '2026-07-24T23:09:38.401Z')).toBe('2026-07-25T05:28:07.000Z');
  });
});

describe('every planet event the pages print has its NASA instant', () => {
  it('in the monthly catalogs', () => {
    for (const month of months) {
      for (const item of month.ingresses) {
        if (item.planet === 'Sun' || item.planet === 'Moon') continue;
        expect(nasaIngressAt(item.planet, item.at), `${month.month} ${item.planet} ${item.at}`).toBeDefined();
      }
      for (const item of month.stations) {
        expect(nasaStationAt(item.planet, item.at), `${month.month} ${item.planet} ${item.at}`).toBeDefined();
      }
      for (const item of month.aspects) {
        expect(nasaAspectAt(item.a, item.b, item.type, item.at), `${month.month} ${item.a} ${item.type} ${item.b} ${item.at}`).toBeDefined();
      }
    }
  });

  it('in the sign windows of ingresses.json, inside its horizons', () => {
    const horizon = new Map<string, [string, string]>();
    for (const h of ingressData.horizons) for (const planet of h.planets) horizon.set(planet, [`${h.from}T00:00:00.000Z`, `${h.to}T00:00:00.000Z`]);
    for (const window of ingressData.windows) {
      if (window.planet === 'Sun') continue;
      const [from, to] = horizon.get(window.planet)!;
      if (window.from > from && window.from < to) {
        expect(nasaIngressAt(window.planet, window.from), `${window.planet} ${window.from}`).toBeDefined();
      }
    }
  });

  it('in sky.json\'s retrograde windows, whose stations never change UTC day', () => {
    for (const window of sky.retrogrades) {
      const stations = [window.from === sky.from ? null : window.from, window.to].filter((at): at is string => Boolean(at));
      for (const at of stations) {
        const nasa = nasaStationAt(window.planet, at);
        expect(nasa, `${window.planet} ${at}`).toBeDefined();
        // Pages that print only a station's date read sky.json directly.
        expect(nasa!.slice(0, 10), `${window.planet} ${at}`).toBe(at.slice(0, 10));
      }
    }
  });

  it('in the event pages\' publication receipt', () => {
    for (const page of publication.pages) {
      if (page.family === 'ingress') expect(nasaIngressAt(page.bodies[0], page.anchor), page.id).toBeDefined();
      if (page.family === 'aspect') expect(nasaAspectAt(page.bodies[0], page.bodies[1], page.subtype, page.anchor), page.id).toBeDefined();
    }
  });

  it('in the horoscope program\'s dated events', () => {
    for (const receipt of program.evidence) {
      if (receipt.kind !== 'sky-event') continue;
      if (receipt.eventKind === 'ingress') expect(nasaIngressAt(receipt.body!, receipt.at), receipt.at).toBeDefined();
      if (receipt.eventKind === 'station') expect(nasaStationAt(receipt.body!, receipt.at), receipt.at).toBeDefined();
      if (receipt.eventKind === 'aspect') expect(nasaAspectAt(receipt.a!, receipt.b!, receipt.eventType!, receipt.at), receipt.at).toBeDefined();
    }
  });
});

describe('the helpers', () => {
  const month = months.find((entry) => entry.month === '2026-07')!;

  it('refine a month\'s planet events and keep its lunations and the Sun', () => {
    const refined = refineTransitMonth(month);
    expect(refined.lunations).toEqual(month.lunations);
    const sun = month.ingresses.filter((item) => item.planet === 'Sun');
    expect(refined.ingresses.filter((item) => item.planet === 'Sun')).toEqual(sun);
    const sextile = refined.aspects.find((item) => item.a === 'Neptune' && item.b === 'Pluto');
    expect(sextile?.at).toBe('2026-07-25T05:28:07.000Z');
    expect(refined.aspects.map((item) => item.at)).toEqual(refined.aspects.map((item) => item.at).sort());
  });

  it('move both edges of a sign window and keep the clipped ones', () => {
    const windows = refineIngressWindows(ingressData.windows);
    const neptune = windows.find((window) => window.planet === 'Neptune' && window.sign === 'aries' && window.from.startsWith('2026-01'));
    expect(neptune?.from).toBe('2026-01-26T17:35:23.000Z');
    const sun = ingressData.windows.filter((window) => window.planet === 'Sun');
    expect(windows.filter((window) => window.planet === 'Sun')).toEqual(sun);
  });

  it('move retrograde stations and leave a window clipped at the table\'s start', () => {
    const refined = refineRetrogradeWindows(sky.retrogrades);
    sky.retrogrades.forEach((window, index) => {
      if (window.from === sky.from) expect(refined[index].from).toBe(sky.from);
      else expect(refined[index].from).toBe(nasaStationAt(window.planet, window.from));
    });
  });

  it('move a published page\'s anchor with its event', () => {
    const [page] = refinePublishedAnchors(publication.pages.filter((entry) => entry.id === 'neptune-sextile-pluto-2026-07-24'));
    expect(page.anchor).toBe('2026-07-25T05:28:07.000Z');
  });

  it('return the committed instant for an event the table does not list', () => {
    expect(exactInstant({ kind: 'ingress', body: 'Sun', at: '2026-03-20T14:46:00.000Z' })).toBe('2026-03-20T14:46:00.000Z');
  });
});
