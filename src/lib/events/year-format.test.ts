import { describe, expect, it } from 'vitest';
import solved from '../../../docs/platform/evidence/event-pages-2027-20261113/horizons-event-times.json';
import { eventsCatalog } from './catalog';
import { STYLE_GUIDE_READING_IDS } from './readings-2027';
import {
  eventClockHeading, eventClockRows, eventQuestions, eventTimesLine, guideDescription,
} from './year-format';
import { formatDate } from '../i18n/dates';
import { worldTimes } from '../../world-times/world-times';

const catalog = eventsCatalog();
const resolve = (id: string) => catalog.byId.get(id);
const pages = STYLE_GUIDE_READING_IDS.map((id) => catalog.byId.get(id)!);
const horizons = Object.values((solved as unknown as { events: Record<string, { horizons: string }> }).events)
  .map((event) => event.horizons);

const utcMinute = (iso: string) => `${new Date(iso).toISOString().slice(11, 16)} UTC on ${
  formatDate('en', new Date(iso), { month: 'long', day: 'numeric', timeZone: 'UTC' })}`;
const day = (iso: string) => formatDate('en', new Date(iso), { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const solvedMinutes = new Set(horizons.map(utcMinute));
const solvedDays = new Set(horizons.map(day));
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';

describe('the year-page format on the style-guide event pages', () => {
  it('puts every instant a page prints on five clocks', () => {
    for (const event of pages) {
      const rows = eventClockRows(event.facts);
      const { family } = event.facts;
      expect(rows.length, event.facts.id).toBe(family === 'retrograde' ? 4 : 1);
      for (const row of rows) {
        expect(solvedMinutes.has(utcMinute(row.at.toISOString())), `${event.facts.id}: ${row.label}`).toBe(true);
        expect(worldTimes(row.at).map((t) => t.city)).toEqual(['UTC', 'New York', 'London', 'Kolkata', 'Sydney']);
      }
      expect(eventClockHeading(event.facts).caption).toContain('New York, London, Kolkata and Sydney');
    }
  });

  it('says the times are NASA’s on every page, because every page prints NASA’s instant', () => {
    for (const event of pages) {
      expect(event.facts.committed, event.facts.id).toBeDefined();
      expect(eventTimesLine(event.facts)[0], event.facts.id).toContain('NASA JPL Horizons (the DE441 ephemeris)');
    }
  });

  it('answers four to eight questions a page, each once, without a dash', () => {
    for (const event of pages) {
      const questions = eventQuestions(event, resolve, catalog.events);
      expect(questions.length, event.facts.id).toBeGreaterThanOrEqual(4);
      expect(questions.length, event.facts.id).toBeLessThanOrEqual(8);
      expect(new Set(questions.map((item) => item.q)).size).toBe(questions.length);
      for (const { q, a } of questions) {
        expect(q.endsWith('?'), `${event.facts.id}: ${q}`).toBe(true);
        expect(a.trim().endsWith('.'), `${event.facts.id}: ${a}`).toBe(true);
        expect(/[–—]/u.test(q + a), `${event.facts.id}: ${q}`).toBe(false);
        expect(/undefined|null|NaN/u.test(q + a), `${event.facts.id}: ${a}`).toBe(false);
      }
    }
  });

  it('prints only clock times and dates solved on Horizons', () => {
    for (const event of pages) {
      const text = [
        guideDescription(event.facts),
        ...eventQuestions(event, resolve, catalog.events).flatMap(({ q, a }) => [q, a]),
      ].join(' ');
      const clocks = [...text.matchAll(new RegExp(`\\d{2}:\\d{2} UTC on (?:${MONTHS}) \\d{1,2}`, 'gu'))].map((m) => m[0]);
      expect(clocks.length, event.facts.id).toBeGreaterThan(0);
      for (const clock of clocks) expect(solvedMinutes.has(clock), `${event.facts.id}: ${clock}`).toBe(true);
      const dates = [...text.matchAll(new RegExp(`(?:${MONTHS}) \\d{1,2}, \\d{4}`, 'gu'))].map((m) => m[0]);
      for (const date of dates) expect(solvedDays.has(date), `${event.facts.id}: ${date}`).toBe(true);
    }
  });

  it('keeps each description to what a search result shows', () => {
    for (const event of pages) {
      const description = guideDescription(event.facts);
      expect(description.length, `${event.facts.id}: ${description}`).toBeLessThanOrEqual(200);
      expect(description).toContain('New York, London, Kolkata and Sydney');
    }
  });
});
