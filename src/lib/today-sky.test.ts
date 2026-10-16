import { describe, expect, it } from 'vitest';
import dailyData from '../data/daily.json';
import skyData from '../data/sky.json';
import eclipseData from '../data/eclipses.json';
import eventsData from '../data/events-publication.json';
import type { Daily } from './daily';
import { HOUSE_THEME } from './daily';
import {
  aspectsToday,
  comingUp,
  degreeMinutes,
  editionDayEvents,
  houseFrom,
  moonAgeDays,
  moonCycle,
  moonFromEachSign,
  nextEclipse,
  planetRows,
  retrogradeTimeline,
  type TransitCatalog,
} from './today-sky';

const daily = dailyData as Daily;
const catalogs = Object.values(import.meta.glob<{ default: TransitCatalog }>('../data/transits-*.json', { eager: true }))
  .map((module) => module.default);

describe('Sky today facts', () => {
  it('lists all ten bodies in order with the edition positions', () => {
    const rows = planetRows(daily);
    expect(rows.map((row) => row.body)).toEqual(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
    for (const row of rows) {
      const body = daily.bodies.find((entry) => entry.body === row.body)!;
      expect(row.sign).toBe(body.sign);
      expect(row.degree).toBe(degreeMinutes(body.degree));
      expect(row.retrograde).toBe(body.retrograde);
    }
    const stations = daily.events.filter((event) => event.kind === 'station' && event.at.startsWith(daily.date));
    expect(rows.filter((row) => row.stationToday).map((row) => row.body)).toEqual(stations.map((event) => event.planet));
  });

  it('places the edition in its lunar cycle, new moon to new moon', () => {
    const nodes = moonCycle(daily, skyData.moons, catalogs);
    const snapshot = `${daily.date}T12:00:00.000Z`;
    expect(nodes).toHaveLength(4);
    expect(nodes.map((node) => node.at)).toEqual([...nodes.map((node) => node.at)].sort());
    expect(nodes[0].kind).toBe('new');
    expect(nodes[0].at <= snapshot).toBe(true);
    expect(nodes.at(-1)?.kind).toBe('new');
    expect(nodes.at(-1)!.at > snapshot).toBe(true);
    expect(nodes.filter((node) => node.kind === 'full')).toHaveLength(1);
    expect(nodes.filter((node) => node.kind === 'now').map((node) => node.at)).toEqual([snapshot]);
    expect(nodes.filter((node) => node.kind !== 'now').every((node) => Boolean(node.sign))).toBe(true);
    const age = moonAgeDays(daily, skyData.moons);
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(30);
  });

  it('holds the cycle together on a waning date as well', () => {
    const full = skyData.moons.find((moon) => moon.type === 'full' && moon.at > `${daily.date}T12:00:00.000Z`)!;
    const waning = { ...daily, date: full.at.slice(0, 10), snapshotAt: new Date(Date.parse(full.at) + 3 * 86_400_000).toISOString() };
    const nodes = moonCycle(waning, skyData.moons, catalogs);
    expect(nodes.map((node) => node.kind)).toEqual(['new', 'full', 'now', 'new']);
  });

  it('reads the Moon from each Sun sign as the publication does', () => {
    const rows = moonFromEachSign(daily);
    const moon = daily.bodies.find((body) => body.body === 'Moon')!;
    expect(rows).toHaveLength(12);
    for (const row of rows) {
      expect(row.house).toBe(houseFrom(row.sign, moon.sign));
      expect(row.theme.toLowerCase()).toBe(HOUSE_THEME[row.house].toLowerCase());
    }
    expect(rows.filter((row) => row.moonInSign).map((row) => row.sign)).toEqual([moon.sign]);
  });

  it('lists coming events as dated facts after the snapshot, in order, linked when published', () => {
    const events = comingUp(daily, catalogs, eclipseData.eclipses, eventsData.pages);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.at > `${daily.date}T12:00:00.000Z`)).toBe(true);
    expect(events.map((event) => event.at)).toEqual([...events.map((event) => event.at)].sort());
    for (const event of events.filter((entry) => entry.path)) {
      const page = eventsData.pages.find((candidate) => candidate.path === event.path)!;
      expect(Math.abs(Date.parse(page.anchor) - Date.parse(event.at))).toBeLessThan(120_000);
    }
    expect(events.map((event) => event.title).join(' ')).not.toMatch(/\b(?:best|lucky|good day|bad day)\b/iu);
  });

  it('links every published event page in its window, on any edition date', () => {
    // tests/events-drive.mjs expects exactly these links on /today/.
    const expected = (snapshot: string, day: string) => {
      const start = Date.parse(snapshot);
      const end = Date.parse(`${day}T00:00:00.000Z`) + 32 * 86_400_000;
      const pages = eventsData.pages.filter((page) => Date.parse(page.anchor) > start && Date.parse(page.anchor) < end);
      const eclipseDays = new Set(pages.filter((page) => page.family === 'eclipse').map((page) => page.anchor.slice(0, 10)));
      return pages
        .filter((page) => page.family !== 'lunation' || !eclipseDays.has(page.anchor.slice(0, 10)))
        .sort((a, b) => a.anchor.localeCompare(b.anchor))
        .map((page) => page.path);
    };
    for (let time = Date.parse('2026-01-01T12:00:00.000Z'); time < Date.parse('2027-12-01T00:00:00.000Z'); time += 5 * 86_400_000) {
      const day = new Date(time).toISOString().slice(0, 10);
      const snapshot = `${day}T12:00:00.000Z`;
      const edition = { ...daily, date: day, snapshotAt: snapshot };
      const linked = comingUp(edition, catalogs, eclipseData.eclipses, eventsData.pages)
        .flatMap((event) => (event.path ? [event.path] : []));
      expect(linked, day).toEqual(expected(snapshot, day));
    }
  });

  it('says what happens on the edition date in plain phrases', () => {
    const phrases = editionDayEvents(daily);
    const own = daily.events.filter((event) => event.at.startsWith(daily.date));
    expect(phrases).toHaveLength(daily.eventsCoverage === 'unavailable' ? 0 : own.length);
    expect(phrases.join(' ')).not.toMatch(/\b(?:best|lucky|should|will)\b/iu);
  });

  it('finds the next eclipse after the edition', () => {
    const eclipse = nextEclipse(daily, eclipseData.eclipses);
    expect(eclipse?.peak && eclipse.peak > `${daily.date}T12:00:00.000Z`).toBe(true);
  });

  it('puts each retrograde period on one axis with the edition marked', () => {
    const timeline = retrogradeTimeline(daily, skyData.retrogrades);
    expect(timeline.todayAt).toBeGreaterThan(0);
    expect(timeline.todayAt).toBeLessThan(100);
    const now = timeline.rows.filter((row) => row.state === 'now').map((row) => row.planet).sort();
    const retrogradeBodies = daily.bodies.filter((body) => body.retrograde && body.body !== 'Moon' && body.body !== 'Sun')
      .map((body) => body.body).sort();
    expect(now).toEqual(retrogradeBodies);
    for (const row of timeline.rows) {
      expect(row.left).toBeGreaterThanOrEqual(0);
      expect(row.left + row.width).toBeLessThanOrEqual(100.01);
    }
  });

  it('computes aspects from the snapshot within the orb, exact ones first', () => {
    const aspects = aspectsToday(daily);
    expect(aspects.every((aspect) => aspect.orb <= 3)).toBe(true);
    const exact = daily.events.filter((event) => event.kind === 'aspect' && event.at.startsWith(daily.date));
    expect(aspects.filter((aspect) => aspect.exactAt)).toHaveLength(exact.length);
  });
});
