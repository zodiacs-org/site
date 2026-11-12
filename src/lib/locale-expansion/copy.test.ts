/**
 * Every string the locale expansion prints, in every locale whose copy is
 * written: horoscope periods for all twelve signs, the month, the full and
 * new Moon pages, the zodiac dates page and the fr/it daily page chrome.
 */
import { describe, expect, it } from 'vitest';
import { SIGN_SLUGS } from '../signs';
import { signDateRange } from '../sign-display';
import { horoscopeShingleJaccard } from '../horoscope-program';
import { readingConfidence } from '../../ai-tools/reading-confidence';
import { HOROSCOPE_MODULES } from './horoscope/modules';
import { englishReading, localizedMonthlyReading, localizedPeriodReading, PERIOD_SURFACES } from './horoscope/engine';
import { expansionMonth } from './horoscope/month';
import { LUNATION_COPY } from './lunation/modules';
import { lunations } from './lunation/catalog';
import { zodiacDatesCopy } from './zodiac-dates/modules';
import { copyProblems } from './copy-rules';
import type { ExpansionLocale } from './horoscope/types';
import type { HoroscopeSign } from '../horoscope-program-types';

/** Walk any copy object, calling functions with plausible arguments, and collect every string. */
function strings(value: unknown, depth = 0): string[] {
  if (depth > 6 || value == null) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => strings(item, depth + 1));
  if (typeof value === 'function') {
    try {
      return strings((value as (...args: unknown[]) => unknown)('Leo', '24 de noviembre', 3), depth + 1);
    } catch {
      return [];
    }
  }
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap((item) => strings(item, depth + 1));
  return [];
}

const month = expansionMonth();

for (const [locale, mod] of Object.entries(HOROSCOPE_MODULES) as Array<[ExpansionLocale, NonNullable<(typeof HOROSCOPE_MODULES)['es']>]>) {
  describe(`${locale} horoscope periods`, () => {
    const all = SIGN_SLUGS.flatMap((sign) => PERIOD_SURFACES.map((surface) => ({
      sign, surface, reading: localizedPeriodReading(mod, sign as HoroscopeSign, surface),
    })));

    it('writes one passage per English passage, keeping its receipts', () => {
      for (const { sign, surface, reading } of all) {
        const english = englishReading(sign as HoroscopeSign, surface);
        expect(reading.passages.map((passage) => passage.evidenceRefs), `${sign} ${surface}`)
          .toEqual(english.passages.map((passage) => passage.evidenceRefs));
        for (const passage of reading.passages) expect(passage.text.length, `${sign} ${surface}`).toBeGreaterThan(40);
      }
    });

    it('passes the copy rules on every passage, heading and month', () => {
      const texts = [
        ...all.flatMap(({ reading }) => reading.passages.flatMap((passage) => [passage.text, passage.heading ?? ''])),
        ...SIGN_SLUGS.flatMap((sign) => localizedMonthlyReading(mod, sign as HoroscopeSign, month.transits).passages
          .flatMap((passage) => [passage.text, passage.heading ?? ''])),
      ].filter(Boolean);
      const problems = texts.flatMap((text) => copyProblems(locale, text).map((problem) => `${problem}: ${text.slice(0, 120)}`));
      expect(problems).toEqual([]);
    });

    it('reads differently from sign to sign on every surface', () => {
      for (const surface of PERIOD_SURFACES) {
        const texts = all.filter((entry) => entry.surface === surface).map((entry) => entry.reading.passages.map((passage) => passage.text).join(' '));
        for (let left = 0; left < texts.length; left += 1) {
          for (let right = left + 1; right < texts.length; right += 1) {
            expect(horoscopeShingleJaccard(texts[left], texts[right]), `${surface} ${SIGN_SLUGS[left]}/${SIGN_SLUGS[right]}`).toBeLessThan(0.75);
          }
        }
      }
    });

    it('keeps titles short and labels the reading confidence in its own words', () => {
      for (const { sign, surface, reading } of all) {
        const title = mod.chrome.title('Capricornio', { surface, from: reading.from, through: reading.through });
        expect(title.length, `${sign} ${surface}: ${title}`).toBeLessThanOrEqual(60);
      }
      const monthly = mod.chrome.title('Capricornio', { surface: 'monthly', from: `${month.month}-01`, through: `${month.month}-28`, month: month.month });
      expect(monthly.length, monthly).toBeLessThanOrEqual(60);
      expect(mod.chrome.confidence(readingConfidence('sign'))).toMatch(/40 ?%/u);
      expect(mod.chrome.confidence(40)).not.toContain('Reading confidence');
      const { skyRow, title, h1, description, faq, ...plain } = mod.chrome;
      const sample = all.find((entry) => entry.surface === 'weekly')!.reading;
      const ctx = { surface: 'weekly' as const, from: sample.from, through: sample.through };
      const texts = [
        ...strings(plain),
        ...sample.facts.map((fact) => skyRow(fact)),
        title('Leo', ctx), h1('Leo', ctx), description('Leo', ctx),
        ...faq('Leo', 'weekly').flatMap(({ q, a }) => [q, a]),
      ];
      expect(texts.flatMap((text) => copyProblems(locale, text).map((problem) => `${problem}: ${text}`))).toEqual([]);
    });
  });
}

for (const [locale, copy] of Object.entries(LUNATION_COPY) as Array<[ExpansionLocale, NonNullable<(typeof LUNATION_COPY)['es']>]>) {
  describe(`${locale} full and new Moon pages`, () => {
    it('passes the copy rules for every published lunation and every sign note', () => {
      const problems: string[] = [];
      for (const kind of ['full', 'new'] as const) {
        for (const { facts } of lunations(kind)) {
          const texts = [copy.title(facts), copy.h1(facts), copy.description(facts), copy.lead(facts), copy.eclipseNote(facts),
            ...copy.meaning(facts), ...copy.faq(facts).flatMap(({ q, a }) => [q, a]),
            ...SIGN_SLUGS.map((sign, index) => copy.signNote(sign, index + 1, facts))].filter(Boolean);
          expect(copy.title(facts).length, copy.title(facts)).toBeLessThanOrEqual(60);
          if (facts.eclipse) expect(copy.eclipseNote(facts)).not.toBe('');
          for (const text of texts) problems.push(...copyProblems(locale, text).map((problem) => `${problem}: ${text}`));
        }
      }
      expect(problems).toEqual([]);
    });
  });
}

describe('zodiac dates copy', () => {
  for (const locale of Object.keys(HOROSCOPE_MODULES) as ExpansionLocale[]) {
    it(`${locale} passes the copy rules`, () => {
      let copy;
      try { copy = zodiacDatesCopy(locale); } catch { return; }
      expect(copy.title(2026, 2027).length).toBeLessThanOrEqual(60);
      expect(Object.keys(copy.season).sort()).toEqual(['Autumn', 'Spring', 'Summer', 'Winter']);
      expect(strings(copy).flatMap((text) => copyProblems(locale, text).map((problem) => `${problem}: ${text}`))).toEqual([]);
    });
    it(`${locale} prints each sign's dates as words, not a dashed range`, () => {
      // The table cells come from signDateRange (LocalizedZodiacDates.astro).
      const cells = SIGN_SLUGS.map((sign) => signDateRange(sign, locale));
      expect(cells.flatMap((text) => copyProblems(locale, text).map((problem) => `${problem}: ${text}`))).toEqual([]);
      expect(cells.filter((text) => /[–—]/u.test(text))).toEqual([]);
    });
  }
});

describe('event times', () => {
  it('print NASA instants, so a week and its month give an event the same time', () => {
    const mod = HOROSCOPE_MODULES.es!;
    const monthEvents = localizedMonthlyReading(mod, 'leo', month.transits).facts;
    for (const sign of SIGN_SLUGS) {
      for (const fact of localizedPeriodReading(mod, sign as HoroscopeSign, 'weekly').facts) {
        if (fact.kind !== 'event' || fact.eventKind !== 'aspect') continue;
        const same = monthEvents.find((event) => event.eventKind === 'aspect' && event.a === fact.a && event.b === fact.b && event.eventType === fact.eventType
          && Math.abs(Date.parse(event.at) - Date.parse(fact.at)) < 86_400_000);
        if (same) expect(fact.at, `${sign} ${fact.a} ${fact.b}`).toBe(same.at);
      }
    }
  });
});
