import { describe, expect, it } from 'vitest';
import sky from '../data/sky.json';
import eclipsesData from '../data/eclipses.json';
import solved from '../../docs/platform/evidence/event-pages-2027-20261113/horizons-event-times.json';
import { eventsCatalog } from './events/catalog';
import { STYLE_GUIDE_READING_IDS } from './events/readings-2027';
import { nasaStationAt, nasaIngressAt } from './nasa-instants';
import {
  NASA_EVENT_TIMES_2027, nasaEclipseAt, nasaLunationAt, nasaShadowAt,
} from './nasa-event-times-2027';

interface SolvedEvent {
  kind: string;
  detail: Record<string, string>;
  engine: string;
  horizons: string;
  pages: string[];
}
const solvedEvents = Object.values((solved as unknown as { events: Record<string, SolvedEvent> }).events);
const minute = (iso: string) => new Date(iso).toISOString().slice(0, 16);
const catalog = eventsCatalog();

describe('the 2027 event pages print NASA’s instants', () => {
  it('lists every 2027 full moon and eclipse, and each shadow edge of the 2027 Mercury and Mars retrogrades', () => {
    const fulls = (sky.moons as { type: string; at: string }[]).filter((m) => m.type === 'full' && m.at.startsWith('2027'));
    expect(NASA_EVENT_TIMES_2027.lunations.map((row) => row.engine)).toEqual(fulls.map((m) => m.at));
    const eclipses = (eclipsesData.eclipses as { peak: string }[]).filter((e) => e.peak.startsWith('2027'));
    expect(NASA_EVENT_TIMES_2027.eclipses.map((row) => row.engine)).toEqual(eclipses.map((e) => e.peak));
    const windows = (sky.retrogrades as { planet: string; from: string; preShadowStart?: string | null; postShadowEnd?: string | null }[])
      .filter((w) => ['Mercury', 'Venus', 'Mars'].includes(w.planet) && w.from.startsWith('2027'));
    expect(windows).toHaveLength(4);
    for (const window of windows) {
      expect(nasaShadowAt(window.planet, 'pre', window.preShadowStart!), `${window.planet} ${window.from}`).toBeDefined();
      expect(nasaShadowAt(window.planet, 'post', window.postShadowEnd!), `${window.planet} ${window.from}`).toBeDefined();
    }
    expect(NASA_EVENT_TIMES_2027.shadows).toHaveLength(8);
  });

  it('holds the table to the instants solved on Horizons, row for row', () => {
    const find = (kind: string, engine: string) => solvedEvents.find((event) => event.kind === kind && event.engine === engine);
    for (const row of NASA_EVENT_TIMES_2027.lunations) expect(find('lunation', row.engine)?.horizons).toBe(row.nasa);
    for (const row of NASA_EVENT_TIMES_2027.eclipses) expect(find('eclipse', row.engine)?.horizons).toBe(row.nasa);
    for (const row of NASA_EVENT_TIMES_2027.shadows) expect(find('shadow', row.engine)?.horizons).toBe(row.nasa);
  });

  it('keeps the engine within a few seconds for the Moon, and leaves other years alone', () => {
    for (const row of [...NASA_EVENT_TIMES_2027.lunations, ...NASA_EVENT_TIMES_2027.eclipses]) {
      expect(Math.abs(Date.parse(row.nasa) - Date.parse(row.engine)), row.engine).toBeLessThan(6_000);
    }
    expect(nasaLunationAt('full', '2026-12-24T01:28:16.590Z')).toBeUndefined();
    expect(nasaLunationAt('new', '2027-01-07T20:24:26.069Z')).toBeUndefined();
    expect(nasaEclipseAt('lunar', '2028-01-12T04:13:07.811Z')).toBeUndefined();
    // Seconds move a printed minute twice in 2027.
    expect(minute(nasaLunationAt('full', '2027-10-15T13:46:59.502Z')!)).toBe('2027-10-15T13:47');
    expect(minute(nasaEclipseAt('lunar', '2027-07-18T16:03:01.519Z')!)).toBe('2027-07-18T16:02');
  });

  it('prints, on each style-guide page, the minute Horizons gives', () => {
    for (const id of STYLE_GUIDE_READING_IDS) {
      const { facts } = catalog.byId.get(id)!;
      const own = solvedEvents.filter((event) => event.pages.includes(id));
      const printed = [facts.at, facts.start, facts.end, facts.preShadowStart, facts.postShadowEnd]
        .filter((iso): iso is string => Boolean(iso));
      expect(printed.length, id).toBeGreaterThan(0);
      for (const iso of printed) {
        const match = own.find((event) => Math.abs(Date.parse(event.horizons) - Date.parse(iso)) < 5_000);
        expect(match, `${id}: ${iso} is an instant solved on Horizons`).toBeDefined();
        expect(minute(iso), `${id}: ${iso}`).toBe(minute(match!.horizons));
      }
    }
  });

  it('agrees with the planets’ table on every station and sign change solved again', () => {
    for (const event of solvedEvents) {
      if (event.kind !== 'station' && event.kind !== 'ingress') continue;
      const printed = event.kind === 'station'
        ? nasaStationAt(event.detail.body, event.engine)
        : nasaIngressAt(event.detail.body, event.engine);
      expect(printed, `${event.kind} ${event.detail.body} ${event.engine}`).toBeDefined();
      // The planets' table is rounded to the second. This job's solve is within a second of it for
      // Mercury and for the sign changes, within five for a station of Mars, and within two minutes
      // for a station of a slow planet, which these pages name by date only.
      const gap = Math.abs(Date.parse(printed!) - Date.parse(event.horizons));
      const slow = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(event.detail.body) && event.kind === 'station';
      const mars = event.detail.body === 'Mars' && event.kind === 'station';
      expect(gap, `${event.detail.body} ${event.engine}`).toBeLessThan(slow ? 120_000 : mars ? 5_000 : 1_000);
      if (!slow) expect(minute(printed!), `${event.detail.body} ${event.engine}`).toBe(minute(event.horizons));
    }
  });
});
