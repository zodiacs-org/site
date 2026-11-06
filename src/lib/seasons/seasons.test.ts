import { describe, expect, it } from 'vitest';
import { SIGNS, signName } from '../signs';
import { alternatePaths, localizePath } from '../i18n';
import { countdownParts, countdownTarget, seasonFocus, seasonLengthDays, seasonProgress } from './clock';
import { SEASON_COPY_EN, SEASON_HOUSE_ORDINALS_EN, SEASON_UI_EN, type SeasonCopy, type SeasonUi } from './copy-en';
import { SEASON_LOCALES, SEASON_READING_CONFIDENCE, seasonAsk, seasonCopy, seasonUi, type SeasonLocale } from './copy';
import { currentSunSeason, seasonWindowsFor, signSeasonFocus, solarHouse, sunSeasons } from './windows';
import { readingConfidenceText } from '../../ai-tools/reading-confidence';
import ingressTable from '../../data/ingresses.json';
import sunTable from '../../data/sun-ingresses.json';

const DASHES = /[‒–—―]/u;
const BANNED = /\b(properly|shows its work|like a human|no mush|not vibes|guarantee[ds]?|money|invest\w*|health\w*|bet|betting|lottery|stocks?|crypto|token)\b/iu;

/** Every string the season pages print from the English copy, chrome included. */
const FACTS = {
  title: 'Sagittarius season', sign: 'Sagittarius', phase: 'under-way' as const,
  start: 'November 22, 2026, 05:35 UTC', end: 'December 21, 2026, 20:50 UTC', days: 30,
  confidence: 'Reading confidence 40%', value: 40,
};

/** Every string a SeasonUi, a SeasonCopy table and the ordinals print, functions called with sample values. */
function allStrings(ui: SeasonUi, seasons: Readonly<Record<string, SeasonCopy>>, ordinals: readonly string[], sign: string): string[] {
  const facts = { ...FACTS, sign, title: ui.title(sign), confidence: ui.confidence(40) };
  const chrome = Object.entries(ui).flatMap(([key, value]): string[] => {
    if (typeof value !== 'function') return [value];
    if (key === 'faq') return ui.faq(facts).flatMap(({ q, a }) => [q, a]).concat(ui.faq({ ...facts, phase: 'upcoming' }).flatMap(({ q, a }) => [q, a]));
    if (key === 'description') return [ui.description(facts), ui.description({ ...facts, phase: 'upcoming' }), ui.description({ ...facts, phase: null })];
    if (key === 'hubDescription') return [ui.hubDescription(facts.title, '21 December 2026'), ui.hubDescription(null, '')];
    if (key === 'quality') return [ui.quality('mutable', 'fire'), ui.quality('fixed', 'water'), ui.quality('cardinal', 'air')];
    if (key === 'ruledBy') return ['Sun', 'Moon', 'Jupiter', 'Pluto'].map((ruler) => ui.ruledBy(ruler));
    if (key === 'metaTitle') return [ui.metaTitle(facts.title, '2026'), ui.metaTitle(facts.title, null)];
    if (key === 'range' || key === 'eventDescription') return [(value as (...args: string[]) => string)(sign, '1 May', '8 June')];
    if (key === 'aboutDays' || key === 'confidence') return [(value as (n: number) => string)(30)];
    return [(value as (...args: string[]) => string)(sign, '2026')];
  });
  const copy = Object.values(seasons).flatMap((entry) => [entry.theme, entry.guidePrompt, ...entry.about, ...entry.asks]);
  return [...chrome, ...copy, ...ordinals];
}

function allEnglishStrings(): string[] {
  return allStrings(SEASON_UI_EN, SEASON_COPY_EN, SEASON_HOUSE_ORDINALS_EN, 'Sagittarius');
}

describe('season copy', () => {
  it('covers all twelve seasons, each with a reading for all twelve signs', () => {
    expect(Object.keys(SEASON_COPY_EN).sort()).toEqual(SIGNS.map((sign) => sign.slug).sort());
    for (const sign of SIGNS) {
      const copy = seasonCopy(sign.slug);
      expect(copy.theme.length, sign.slug).toBeGreaterThan(30);
      expect(copy.about.length, sign.slug).toBeGreaterThanOrEqual(2);
      expect(copy.asks, sign.slug).toHaveLength(12);
      expect(new Set(copy.asks).size, sign.slug).toBe(12);
      expect(copy.guidePrompt).toContain(sign.name);
      for (const line of copy.asks) expect(line.split(/(?<=[.!?])\s+/u).length, line).toBeLessThanOrEqual(2);
    }
  });

  it('uses no em or en dashes anywhere', () => {
    for (const text of allEnglishStrings()) expect(text, text).not.toMatch(DASHES);
  });

  it('avoids the banned tells, money, health and betting talk, and guarantees', () => {
    for (const text of allEnglishStrings()) expect(text, text).not.toMatch(BANNED);
  });

  it('gives each reader the line for the house the season lights for them', () => {
    expect(solarHouse('sagittarius', 'sagittarius')).toBe(1);
    expect(solarHouse('sagittarius', 'aries')).toBe(9);
    expect(solarHouse('sagittarius', 'capricorn')).toBe(12);
    expect(solarHouse('sagittarius', 'scorpio')).toBe(2);
    expect(solarHouse('aries', 'pisces')).toBe(2);
    for (const season of SIGNS) {
      const own = seasonAsk(season.slug, season.slug);
      expect(own.house).toBe(1);
      expect(own.text, season.slug).toMatch(/your season/iu);
      // The sign after the season's: the month before its own season (twelfth house).
      const after = SIGNS[(SIGNS.indexOf(season) + 1) % 12];
      const twelfth = seasonAsk(season.slug, after.slug);
      expect(twelfth.house).toBe(12);
      expect(twelfth.houseName).toBe('twelfth');
      expect(twelfth.text, season.slug).toMatch(/own season is next/iu);
    }
    const aries = seasonAsk('sagittarius', 'aries');
    expect(aries.houseName).toBe('ninth');
    expect(aries.text).toMatch(/horizon/iu);
  });

  it('labels every line with the Sun-sign reading confidence', () => {
    expect(SEASON_READING_CONFIDENCE).toBe(40);
    expect(readingConfidenceText(SEASON_READING_CONFIDENCE)).toBe('Reading confidence 40%');
  });
});

describe('season windows', () => {
  it('has the Sun entering Sagittarius on 22 November 2026', () => {
    const sagittarius = seasonWindowsFor('sagittarius');
    expect(sagittarius[0].start.slice(0, 16)).toBe('2026-11-22T07:23');
    expect(sagittarius[0].end.slice(0, 16)).toBe('2026-12-21T20:50');
    const focus = signSeasonFocus('sagittarius', new Date('2026-11-05T12:00:00Z'));
    expect(focus?.phase).toBe('upcoming');
    expect(focus?.window.start).toBe(sagittarius[0].start);
  });

  it('runs the Sun through the signs without gaps, in zodiac order', () => {
    const seasons = sunSeasons();
    for (let index = 1; index < seasons.length; index += 1) {
      expect(seasons[index].start).toBe(seasons[index - 1].end);
      const previous = SIGNS.findIndex((sign) => sign.slug === seasons[index - 1].sign);
      expect(seasons[index].sign).toBe(SIGNS[(previous + 1) % 12].slug);
    }
  });

  it('starts every season within a day of its sign’s usual dates, lasting 29 to 32 days', () => {
    for (const sign of SIGNS) {
      const windows = seasonWindowsFor(sign.slug);
      expect(windows.length, sign.slug).toBeGreaterThanOrEqual(2);
      for (const window of windows) {
        const start = new Date(window.start);
        const usual = Date.UTC(start.getUTCFullYear(), sign.start[0] - 1, sign.start[1]);
        expect(Math.abs(start.getTime() - usual), `${sign.slug} ${window.start}`).toBeLessThan(2 * 86_400_000);
        expect(seasonLengthDays(window)).toBeGreaterThanOrEqual(29);
        expect(seasonLengthDays(window)).toBeLessThanOrEqual(32);
      }
    }
  });

  // The season pages read their own Sun table (build-sun-ingresses.mjs),
  // which holds every season that begins from 2026 through 2040, so every
  // sign has its current or next season on every day up to the end of 2039.
  it('has a current or next season for every sign through 2039', () => {
    expect(sunTable.horizon).toEqual({ from: '2026-01-01', to: '2041-02-01' });
    const until = Date.UTC(2039, 11, 31, 23, 59);
    for (let at = Date.UTC(2026, 1, 1); at <= until; at += 86_400_000 * 5) {
      for (const sign of SIGNS) expect(signSeasonFocus(sign.slug, new Date(at)), `${sign.slug} ${new Date(at).toISOString()}`).not.toBeNull();
    }
    for (const sign of SIGNS) {
      expect(signSeasonFocus(sign.slug, new Date(until)), sign.slug).not.toBeNull();
      expect(seasonWindowsFor(sign.slug).some((window) => window.start.startsWith('2040-')), sign.slug).toBe(true);
    }
    expect(sunSeasons().at(-1)!.sign).toBe('capricorn');
    expect(sunSeasons().at(-1)!.end.slice(0, 7)).toBe('2041-01');
    expect(currentSunSeason(new Date('2026-11-05T00:00:00Z'))?.sign).toBe('scorpio');
    expect(currentSunSeason(new Date('2026-11-22T07:24:00Z'))?.sign).toBe('sagittarius');
    expect(currentSunSeason(new Date('2035-07-01T00:00:00Z'))?.sign).toBe('cancer');
  });

  // Same calculation as build-ingresses.mjs, so the years both tables hold
  // agree to the millisecond. ingresses.json itself stays as it is: the AI
  // runtime bundles it byte for byte.
  it('agrees exactly with the Sun windows in ingresses.json where both run', () => {
    const shared = (ingressTable.windows as { planet: string; sign: string; from: string; to: string }[])
      .filter((row) => row.planet === 'Sun');
    expect(shared.length).toBeGreaterThan(30);
    for (const row of shared) {
      expect(sunTable.windows, row.from).toContainEqual({ sign: row.sign, from: row.from, to: row.to });
    }
  });
});

describe('season clock', () => {
  const window = { sign: 'sagittarius', start: '2026-11-22T07:23:34.315Z', end: '2026-12-21T20:50:20.394Z' };

  it('picks the season under way, or the next one', () => {
    const later = { sign: 'sagittarius', start: '2027-11-22T13:16:21.481Z', end: '2027-12-22T02:42:17.442Z' };
    expect(seasonFocus([later, window], new Date('2026-11-01T00:00:00Z'))).toEqual({ window, phase: 'upcoming' });
    expect(seasonFocus([window, later], new Date('2026-12-01T00:00:00Z'))).toEqual({ window, phase: 'under-way' });
    expect(seasonFocus([window, later], new Date('2027-01-01T00:00:00Z'))).toEqual({ window: later, phase: 'upcoming' });
    expect(seasonFocus([window], new Date('2027-01-01T00:00:00Z'))).toBeNull();
  });

  it('counts down to the entry, then to the exit', () => {
    expect(countdownTarget({ window, phase: 'upcoming' }).toISOString()).toBe(window.start);
    expect(countdownTarget({ window, phase: 'under-way' }).toISOString()).toBe(window.end);
    expect(countdownParts(((16 * 24 + 7) * 3600 + 23 * 60 + 34) * 1000 + 999)).toEqual({ days: 16, hours: 7, minutes: 23, seconds: 34 });
    expect(countdownParts(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it('measures how far through the season the Sun is', () => {
    expect(seasonProgress(window, new Date('2026-11-01T00:00:00Z'))).toBe(0);
    expect(seasonProgress(window, new Date('2027-01-01T00:00:00Z'))).toBe(1);
    const middle = new Date((Date.parse(window.start) + Date.parse(window.end)) / 2);
    expect(seasonProgress(window, middle)).toBeCloseTo(0.5, 6);
  });
});

describe('season copy in Spanish, Portuguese, French and Italian', () => {
  const RULES: Record<Exclude<SeasonLocale, 'en'>, { own: RegExp; next: RegExp; banned: RegExp }> = {
    es: { own: /^Es tu temporada/u, next: /^Tu propia temporada es la siguiente/u, banned: /\b(dinero|invers\w*|salud|apuesta\w*|lotería|garantí\w*|cripto\w*|token)\b/iu },
    pt: { own: /^É a sua temporada/u, next: /^A sua própria temporada é a próxima/u, banned: /\b(dinheiro|investim\w*|saúde|aposta\w*|loteria|garanti\w*|cripto\w*|token)\b/iu },
    fr: { own: /^C’est ta saison/u, next: /^Ta propre saison est la suivante/u, banned: /\b(argent|investiss\w*|santé|pari|paris|loterie|garanti\w*|crypto\w*|token)\b/iu },
    it: { own: /^È la tua stagione/u, next: /^La tua stagione è la prossima/u, banned: /\b(denaro|soldi|investim\w*|salute|scommess\w*|lotteria|garanzi\w*|cripto\w*|token)\b/iu },
  };
  const translated = SEASON_LOCALES.filter((entry): entry is Exclude<SeasonLocale, 'en'> => entry !== 'en');

  for (const locale of translated) {
    describe(locale, () => {
      const ui = seasonUi(locale);
      const tables = Object.fromEntries(SIGNS.map((sign) => [sign.slug, seasonCopy(sign.slug, locale)]));
      const ordinals = SIGNS.map((reader) => seasonAsk('aries', reader.slug, locale).houseName);

      it('has the same shape as the English: every key, all twelve seasons, a line for every sign', () => {
        expect(Object.keys(ui).sort()).toEqual(Object.keys(SEASON_UI_EN).sort());
        for (const sign of SIGNS) {
          const copy = tables[sign.slug];
          expect(copy.about.length, sign.slug).toBe(SEASON_COPY_EN[sign.slug].about.length);
          expect(copy.asks, sign.slug).toHaveLength(12);
          expect(new Set(copy.asks).size, sign.slug).toBe(12);
          expect(copy.guidePrompt, sign.slug).toContain(signName(sign, locale));
          for (const line of copy.asks) expect(line.split(/(?<=[.!?])\s+/u).length, line).toBeLessThanOrEqual(2);
        }
      });

      it('gives each reader the line for the house the season lights for them', () => {
        for (const season of SIGNS) {
          expect(seasonAsk(season.slug, season.slug, locale).text, `${locale} ${season.slug}`).toMatch(RULES[locale].own);
          const after = SIGNS[(SIGNS.indexOf(season) + 1) % 12];
          expect(seasonAsk(season.slug, after.slug, locale).text, `${locale} ${season.slug}`).toMatch(RULES[locale].next);
        }
      });

      it('uses no dashes, and keeps clear of money, health, betting and guarantees', () => {
        for (const text of allStrings(ui, tables, ordinals, signName('sagittarius', locale))) {
          expect(text, text).not.toMatch(DASHES);
          expect(text, text).not.toMatch(RULES[locale].banned);
          expect(text, text).not.toMatch(/undefined|NaN|\bseason\b/u);
        }
      });

      it('labels each line with the Sun-sign reading confidence in its own words', () => {
        expect(ui.confidence(SEASON_READING_CONFIDENCE)).toMatch(/^\D+ 40 ?%$/u);
        expect(ui.confidence(SEASON_READING_CONFIDENCE)).not.toContain('Reading confidence');
      });

      it('publishes the hub and the twelve season pages under its own prefix, with alternates', () => {
        expect(localizePath(locale, '/seasons/')).toBe(`/${locale}/seasons/`);
        for (const sign of SIGNS) expect(alternatePaths(`/seasons/${sign.slug}/`)?.[locale]).toBe(`/${locale}/seasons/${sign.slug}/`);
      });
    });
  }

  it('leaves Russian on the English pages', () => {
    expect(localizePath('ru', '/seasons/aries/')).toBe('/seasons/aries/');
    expect(alternatePaths('/seasons/')).toEqual({ en: '/seasons/', es: '/es/seasons/', pt: '/pt/seasons/', fr: '/fr/seasons/', it: '/it/seasons/' });
  });
});
