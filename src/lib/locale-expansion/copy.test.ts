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
import { fr as frDaily } from './daily-copy/fr';
import { it as itDaily } from './daily-copy/it';
import { copyProblems } from './copy-rules';
import type { ExpansionLocale } from './horoscope/types';
import type { HoroscopeSign } from '../horoscope-program-types';

type CopyCall = (fn: (...args: never[]) => unknown) => unknown;

/**
 * Walk any copy object, calling functions with plausible arguments, and
 * collect every string. A function that needs structured arguments gets them
 * from `calls`, keyed by its dotted path. A function that throws fails the
 * walk with its path, so no copy can drop out of the checks unseen.
 */
function strings(value: unknown, calls: Record<string, CopyCall> = {}, path = '', depth = 0): string[] {
  if (depth > 6 || value == null) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, calls, `${path}[${index}]`, depth + 1));
  if (typeof value === 'function') {
    const call: CopyCall = calls[path] ?? ((fn) => (fn as (...args: unknown[]) => unknown)('Leo', '24 de noviembre', 3));
    let result: unknown;
    try {
      result = call(value as (...args: never[]) => unknown);
    } catch (error) {
      throw new Error(`copy function ${path || '(root)'} threw: ${error instanceof Error ? error.message : String(error)}`);
    }
    return strings(result, calls, path, depth + 1);
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => strings(item, calls, path ? `${path}.${key}` : key, depth + 1));
  }
  return [];
}

describe('copy walker', () => {
  it('fails on a copy function that throws, naming it', () => {
    const copy = { lede: 'Plain', nested: { broken: () => { throw new Error('needs a date'); } } };
    expect(() => strings(copy)).toThrow('copy function nested.broken threw: needs a date');
  });

  it('calls a function that needs structured arguments with the ones it is given', () => {
    const copy = { note: (at: { when: { day: string } }) => `On ${at.when.day}` };
    expect(() => strings(copy)).toThrow('copy function note threw');
    expect(strings(copy, { note: (fn) => (fn as (at: { when: { day: string } }) => string)({ when: { day: '3 mai' } }) })).toEqual(['On 3 mai']);
  });
});

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
      if (locale === 'it') {
        // Italian names the reading's basis instead of printing a number.
        expect(mod.chrome.confidence(readingConfidence('sign'))).toBe('Lettura dal segno solare');
        expect(mod.chrome.confidence(readingConfidence('sign'))).not.toMatch(/[\d%]/u);
        expect(mod.chrome.confidenceNote).not.toMatch(/[\d%]|numero|affidabil|attendibil|accuratezz|precision/iu);
      } else {
        expect(mod.chrome.confidence(readingConfidence('sign'))).toMatch(/40 ?%/u);
      }
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

    if (locale === 'it') {
      it('names the reading as a Sun-sign reading without a number', () => {
        expect(copy.confidence(readingConfidence('sign'))).toBe('Lettura dal segno solare');
        expect(copy.confidenceNote).not.toMatch(/[\d%]|numero|affidabil|attendibil|accuratezz|precision/iu);
      });
    }
  });
}

describe('zodiac dates copy', () => {
  for (const locale of Object.keys(HOROSCOPE_MODULES) as ExpansionLocale[]) {
    it(`${locale} passes the copy rules`, () => {
      const copy = zodiacDatesCopy(locale);
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

describe('fr and it daily page copy', () => {
  // What LocalizedToday.astro hands the two functions that take structured
  // arguments: a localized sign and day, and localized planet names.
  const SAMPLE = {
    fr: { sign: 'Sagittaire', date: '22 novembre', a: 'Mars', b: 'Vénus' },
    it: { sign: 'Sagittario', date: '22 novembre', a: 'Marte', b: 'Venere' },
  } as const;
  for (const [locale, mod] of [['fr', frDaily], ['it', itDaily]] as const) {
    it(`${locale} passes the copy rules on every horoscope, today and hub string`, () => {
      const { today } = mod;
      const sample = SAMPLE[locale];
      const texts = strings(mod, {
        // Every third of the sign, with and without a coming ingress.
        'today.sunNote': () => [0, 1, 2].flatMap((third) => [
          today.sunNote(third, null),
          today.sunNote(third, { sign: sample.sign, date: sample.date }),
        ]),
        'today.represent': () => today.represent(sample.a, today.topics.Mars, sample.b, today.topics.Venus),
      });
      expect(texts.length).toBeGreaterThan(50);
      expect(texts.flatMap((text) => copyProblems(locale, text).map((problem) => `${problem}: ${text.slice(0, 120)}`))).toEqual([]);
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
