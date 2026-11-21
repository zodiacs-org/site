import { describe, expect, it } from 'vitest';
import dailyData from '../../data/daily.json';
import { dailyEventFactId, dailyReading, type Daily, type DailyReading } from '../daily';
import { SIGNS } from '../signs';
import { LOCALES, type Locale } from './core';
import * as dailyReadingModule from './daily-reading';
import { dailyReadingForLocale } from './daily-reading';
import { DAILY_READING_ROUTE_LOCALES } from './index';

// dailyReadingForLocale once picked pt, fr or it by name and gave every other
// locale the Spanish renderer, so a ru, ar or zh daily route would have
// printed Spanish without an error. Every Locale is checked here: a locale
// with a renderer must get its own words, and any other must fail loudly.

const daily = dailyData as Daily;
const quietDay: Daily = { ...daily, events: [], bodies: [] };
const at = `${daily.date}T12:00:00.000Z`;

// The committed day may have no events, so each event kind is added once to
// make every renderer path run, alongside the day as published.
const days: Daily[] = [
  daily,
  { ...daily, events: [{ kind: 'ingress', at, planet: 'Pluto', sign: 'aquarius', degree: 0 }] },
  { ...daily, events: [{ kind: 'lunation', at, type: 'new', sign: 'cancer', degree: 18 }] },
  { ...daily, events: [{ kind: 'lunation', at, type: 'full', sign: 'capricorn', degree: 3 }] },
  { ...daily, events: [{ kind: 'station', at, planet: 'Neptune', type: 'retrograde', sign: 'aries', degree: 4 }] },
  { ...daily, events: [{ kind: 'station', at, planet: 'Mercury', type: 'direct', sign: 'cancer', degree: 22 }] },
  { ...daily, events: [{ kind: 'aspect', at, a: 'Mars', b: 'Saturn', type: 'square' }] },
];

// Read through the namespace so this file still loads (and reports every
// locale as unsupported) on a tree that does not export the list yet.
const supported: readonly Locale[] =
  (dailyReadingModule as { DAILY_READING_LOCALES?: readonly Locale[] }).DAILY_READING_LOCALES ?? [];

function render(locale: Locale): DailyReading[] {
  return days.flatMap((day) => SIGNS.map((sign) => dailyReadingForLocale(sign.slug, day, locale)));
}

function texts(readings: DailyReading[]): string[] {
  return readings.flatMap((reading) => [reading.headline, ...reading.lines.map((line) => line.text)]);
}

describe('dailyReadingForLocale over every Locale', () => {
  it('has a renderer for English and every locale with daily-reading routes', () => {
    expect(supported).toContain('en');
    for (const locale of DAILY_READING_ROUTE_LOCALES) expect(supported, locale).toContain(locale);
    for (const locale of supported) expect(LOCALES, locale).toContain(locale);
  });

  it('keeps English byte for byte on the canonical renderer', () => {
    for (const day of days) for (const sign of SIGNS) {
      expect(dailyReadingForLocale(sign.slug, day, 'en')).toEqual(dailyReading(sign.slug, day));
    }
  });

  it('runs every event kind through each renderer', () => {
    for (const locale of supported) {
      for (const day of days.slice(1)) {
        const event = day.events[0]!;
        const reading = dailyReadingForLocale('aries', day, locale);
        expect(reading.lines[0]?.evidenceRefs?.[0], `${locale} ${event.kind}`).toBe(dailyEventFactId(day.date, event));
      }
    }
  });

  it.each(LOCALES.map((locale) => [locale]))('%s gets its own renderer or an error, never another locale\'s words', (locale) => {
    if (!supported.includes(locale)) {
      expect(() => dailyReadingForLocale('aries', daily, locale)).toThrow(locale);
      expect(() => dailyReadingForLocale('aries', quietDay, locale)).toThrow(locale);
      return;
    }

    const own = new Set(texts(render(locale)));
    const ownQuiet = dailyReadingForLocale('aries', quietDay, locale).headline;
    expect(own.size).toBeGreaterThan(0);

    for (const other of supported) {
      if (other === locale) continue;
      const shared = texts(render(other)).filter((text) => own.has(text));
      expect(shared, `${locale} prints sentences that ${other} prints`).toEqual([]);
      expect(ownQuiet, `${locale} quiet-day line matches ${other}`)
        .not.toBe(dailyReadingForLocale('aries', quietDay, other).headline);
    }
  });
});
