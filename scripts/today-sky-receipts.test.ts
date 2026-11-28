// /today/'s coming events over both event receipts, joined as the page reads
// them (src/pages/today/index.astro): 2026 to 2027 and 2028 to 2030.
// src/lib/today-sky.test.ts keeps its own checks on the first receipt; this
// file sits outside src/lib so the Phase 1 template digest does not move.
import { describe, expect, it } from 'vitest';
import dailyData from '../src/data/daily.json';
import eclipseData from '../src/data/eclipses.json';
import { eventsPublication } from '../src/lib/events/site-publication';
import type { Daily } from '../src/lib/daily';
import { comingUp, type TransitCatalog } from '../src/lib/today-sky';

const daily = dailyData as Daily;
const catalogs = Object.values(import.meta.glob<{ default: TransitCatalog }>('../src/data/transits-*.json', { eager: true }))
  .map((module) => module.default);
const pages = eventsPublication.pages;

describe('Sky today over both event receipts', () => {
  it('reads pages from both receipts', () => {
    expect(pages.some((page) => page.anchor.startsWith('2027-'))).toBe(true);
    expect(pages.some((page) => page.anchor.startsWith('2030-'))).toBe(true);
  });

  it('lists coming events as dated facts after the snapshot, in order, linked when published', () => {
    const events = comingUp(daily, catalogs, eclipseData.eclipses, pages);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.at > `${daily.date}T12:00:00.000Z`)).toBe(true);
    expect(events.map((event) => event.at)).toEqual([...events.map((event) => event.at)].sort());
    for (const event of events.filter((entry) => entry.path)) {
      const page = pages.find((candidate) => candidate.path === event.path)!;
      // Matched as src/lib/today-sky.test.ts matches them: the catalogs carry
      // engine 2.1.0 times, so a page is held to its bodies and signs.
      expect(page.bodies).toContain(event.body);
      if (event.other) expect(page.bodies).toContain(event.other);
      if (event.kind !== 'station') expect(page.signs).toContain(event.sign);
    }
  });

  it('links every published event page in its window, on any edition date through 2030', () => {
    // The same expectation as src/lib/today-sky.test.ts, over the joined pages.
    const expected = (snapshot: string, day: string) => {
      const start = Date.parse(snapshot);
      const end = Date.parse(`${day}T00:00:00.000Z`) + 32 * 86_400_000;
      const inWindow = pages.filter((page) => Date.parse(page.anchor) > start && Date.parse(page.anchor) < end);
      const eclipseDays = new Set(inWindow.filter((page) => page.family === 'eclipse').map((page) => page.anchor.slice(0, 10)));
      return inWindow
        .filter((page) => page.family !== 'lunation' || !eclipseDays.has(page.anchor.slice(0, 10)))
        .sort((a, b) => a.anchor.localeCompare(b.anchor))
        .map((page) => page.path);
    };
    let checkedLater = 0;
    for (let time = Date.parse('2026-01-01T12:00:00.000Z'); time < Date.parse('2030-12-01T00:00:00.000Z'); time += 5 * 86_400_000) {
      const day = new Date(time).toISOString().slice(0, 10);
      const snapshot = `${day}T12:00:00.000Z`;
      const edition = { ...daily, date: day, snapshotAt: snapshot };
      const linked = comingUp(edition, catalogs, eclipseData.eclipses, pages)
        .flatMap((event) => (event.path ? [event.path] : []));
      expect(linked, day).toEqual(expected(snapshot, day));
      if (day >= '2028-01-01' && linked.length > 0) checkedLater += 1;
    }
    expect(checkedLater).toBeGreaterThan(0);
  });
});
