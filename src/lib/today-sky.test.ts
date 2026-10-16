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

  it('places the edition between the lunations around it', () => {
    const nodes = moonCycle(daily, skyData.moons, catalogs);
    const now = nodes.findIndex((node) => node.kind === 'now');
    expect(now).toBe(1);
    expect(nodes[0].at <= `${daily.date}T12:00:00.000Z`).toBe(true);
    expect(nodes.slice(2).every((node) => node.at > `${daily.date}T12:00:00.000Z`)).toBe(true);
    expect(nodes.filter((node) => node.kind !== 'now').every((node) => Boolean(node.sign))).toBe(true);
    const age = moonAgeDays(daily, skyData.moons);
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(30);
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
