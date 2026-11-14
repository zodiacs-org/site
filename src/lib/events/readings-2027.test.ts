import { describe, expect, it } from 'vitest';
import { eventsCatalog } from './catalog';
import { signNameFor } from './format';
import { formatDate } from '../i18n/dates';
import {
  EVENT_READINGS_2027, EVENT_READINGS_2027_UPDATED, STYLE_GUIDE_READING_IDS,
} from './readings-2027';

const catalog = eventsCatalog();
const committedAnchor = (id: string): string => {
  const { facts } = catalog.byId.get(id)!;
  return facts.committed?.anchor ?? facts.at ?? facts.start ?? '';
};

/** What ZOD-211 asks for: each 2027 eclipse, retrograde, full moon and sign change with a page of its own. */
const inScope = catalog.pages.filter((event) => {
  const { family, subtype, id } = event.facts;
  if (!committedAnchor(id).startsWith('2027')) return false;
  return (family === 'lunation' && subtype === 'full')
    || family === 'eclipse' || family === 'retrograde' || family === 'ingress';
});

const monthDay = (iso: string) => formatDate('en', new Date(iso), { month: 'long', day: 'numeric', timeZone: 'UTC' });
const words = (text: string) => text.split(/\s+/u).filter(Boolean).length;
const sentences = (text: string) => (text.match(/[.?!][”"’']?(?=\s|$)/gu) ?? []).length;
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const datesIn = (text: string) => [...text.matchAll(new RegExp(`\\b(?:${MONTHS}) \\d{1,2}\\b`, 'gu'))].map((m) => m[0]);

/** Every UTC day on which the catalog has something happen: an instant, a station, a shadow edge. */
const skyDays = new Set(catalog.events.flatMap((event) => {
  const { at, start, end, preShadowStart, postShadowEnd } = event.facts;
  return [at, start, end, preShadowStart, postShadowEnd].filter((iso): iso is string => Boolean(iso)).map(monthDay);
}));

const SKY_WORDS = /\b(?:Moon|Sun|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|eclipse|sign|planet|sky|star|Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)\b/u;
const JARGON = /\b(?:retrograde|station(?:s|ed)?|ingress|aspect|conjunction|opposition|trine|sextile|square|orb|degree|node|lunation|house|transit|shadow period)\b|°/iu;

describe('2027 event readings, written to the reading style guide', () => {
  it('covers each 2027 full moon, eclipse, retrograde and sign change page, and nothing else', () => {
    expect([...STYLE_GUIDE_READING_IDS].sort()).toEqual(inScope.map((event) => event.facts.id).sort());
    const count = (test: (event: typeof inScope[number]) => boolean) => inScope.filter(test).length;
    expect({
      fullMoons: count((event) => event.facts.family === 'lunation'),
      eclipses: count((event) => event.facts.family === 'eclipse'),
      retrogrades: count((event) => event.facts.family === 'retrograde'),
      signChanges: count((event) => event.facts.family === 'ingress'),
    }).toEqual({ fullMoons: 12, eclipses: 5, retrogrades: 4, signChanges: 1 });
    for (const event of inScope) {
      expect(event.interpretation?.styleGuide, event.facts.id).toBeDefined();
      expect(event.indexEligible, event.facts.id).toBe(true);
    }
    expect(EVENT_READINGS_2027_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });

  it('opens with one sentence of advice and no sky detail', () => {
    for (const [id, reading] of Object.entries(EVENT_READINGS_2027)) {
      expect(sentences(reading.hook), `${id} hook`).toBe(1);
      expect(words(reading.hook), `${id} hook`).toBeLessThanOrEqual(16);
      expect(SKY_WORDS.test(reading.hook), `${id}: ${reading.hook}`).toBe(false);
      expect(/\d/u.test(reading.hook), `${id}: ${reading.hook}`).toBe(false);
      expect(catalog.byId.get(id)!.interpretation!.lead).toBe(reading.hook);
    }
    const hooks = Object.values(EVENT_READINGS_2027).map((reading) => reading.hook);
    expect(new Set(hooks).size).toBe(hooks.length);
  });

  it('keeps the guide’s shape and length', () => {
    for (const [id, reading] of Object.entries(EVENT_READINGS_2027)) {
      expect(sentences(reading.why), `${id} why`).toBeGreaterThanOrEqual(2);
      expect(sentences(reading.why), `${id} why`).toBeLessThanOrEqual(4);
      expect(sentences(reading.tryIt), `${id} try it`).toBeLessThanOrEqual(2);
      expect(words(reading.tryIt), `${id} try it`).toBeLessThanOrEqual(20);
      expect(sentences(reading.comeBack), `${id} come back`).toBeLessThanOrEqual(2);
      expect(reading.comeBack, `${id} come back`).toMatch(/Come back[^.]*\.$/u);
      const total = words(reading.hook) + words(reading.why) + words(reading.tryIt) + words(reading.comeBack);
      expect(total, `${id} words`).toBeGreaterThanOrEqual(80);
      expect(total, `${id} words`).toBeLessThanOrEqual(125);
      for (const sentence of [reading.hook, reading.why, reading.tryIt, reading.comeBack].join(' ').split(/(?<=[.?!][”"’']?)\s+/u)) {
        expect(words(sentence), `${id}: ${sentence}`).toBeLessThanOrEqual(32);
      }
    }
  });

  it('says what astrologers read, in plain words', () => {
    for (const [id, reading] of Object.entries(EVENT_READINGS_2027)) {
      const text = [reading.hook, reading.why, reading.tryIt, reading.comeBack].join(' ');
      expect(/\b[Aa]strologers\b/u.test(reading.why), `${id}: astrologers`).toBe(true);
      expect(/\bread\b|\blink\b/u.test(reading.why), `${id}: read or link`).toBe(true);
      expect(JARGON.test(text), `${id}: ${text.match(JARGON)?.[0]}`).toBe(false);
      expect(/[–—]/u.test(text), `${id}: dash`).toBe(false);
      expect(/!|\b(?:you will|you[’']ll|guaranteed|destined|certain to|beware|disaster|doom)\b/iu.test(text), id).toBe(false);
      expect(/\b(?:money|invest\w*|buy|sell|trade|diagnos\w*|cure|illness|disease)\b/iu.test(text), id).toBe(false);
    }
  });

  it('names its own event: the day, the sign and the body', () => {
    for (const event of inScope) {
      const { facts } = event;
      const reading = EVENT_READINGS_2027[facts.id];
      expect(reading.why, `${facts.id} day`).toContain(monthDay(facts.at ?? facts.start!));
      if (facts.end) expect(reading.why, `${facts.id} end`).toContain(monthDay(facts.end));
      for (const sign of facts.signs) expect(reading.why, `${facts.id} ${sign}`).toContain(signNameFor(sign));
      const body = facts.family === 'lunation' || facts.family === 'eclipse' ? 'Moon' : facts.bodies[0];
      expect(reading.why, `${facts.id} ${body}`).toContain(body);
      if (facts.family === 'ingress' && facts.fromSign) expect(reading.why).toContain(signNameFor(facts.fromSign));
    }
  });

  it('ends on a real event that comes after it, and every day it names is a day in the sky data', () => {
    for (const [id, reading] of Object.entries(EVENT_READINGS_2027)) {
      const own = catalog.byId.get(id)!;
      const next = catalog.byId.get(reading.next);
      expect(next, `${id} next`).toBeDefined();
      expect(catalog.pages.includes(next!), `${id}: ${reading.next} has a page`).toBe(true);
      const nextDays = [next!.facts.at, next!.facts.start, next!.facts.end]
        .filter((iso): iso is string => Boolean(iso));
      const ownStart = own.facts.at ?? own.facts.start!;
      // What is next is still ahead when the event begins.
      expect(nextDays.some((iso) => iso > ownStart), `${id}: ${reading.next} is ahead`).toBe(true);
      const named = datesIn(reading.comeBack);
      expect(named.some((day) => nextDays.filter((iso) => iso > ownStart).map(monthDay).includes(day)), `${id}: ${reading.comeBack}`).toBe(true);
      for (const day of datesIn([reading.why, reading.tryIt, reading.comeBack].join(' '))) {
        expect(skyDays.has(day), `${id}: ${day}`).toBe(true);
      }
    }
  });
});
