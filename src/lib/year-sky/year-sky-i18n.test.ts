import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeChart } from '../engine/full';
import { alternatePaths, localizePath } from '../i18n';
import type { EclipseRecord } from '../upcoming';
import eclipsesData from '../../data/eclipses.json';
import skyData from '../../data/sky.json';
import ingressesData from '../../data/ingresses.json';
import { YEAR_SKY_LOCALES, yearSkyWords, type YearSkyWords } from './copy';
import { YEAR_SKY_WORDS_ES } from './copy-es';
import { YEAR_SKY_WORDS_PT } from './copy-pt';
import { YEAR_SKY_WORDS_FR } from './copy-fr';
import { YEAR_SKY_WORDS_IT } from './copy-it';
import { EDITION_PATH, EDITION_YEAR } from './edition';
import { generalSky, type IngressWindowRecord } from './general';
import { scanYearSky, type YearSkyNatal } from './scan';
import { personalYear } from './moments';
import { calendarMoments, yearCalendar } from './calendar';
import type { YearMoment } from './types';

const ECLIPSES = (eclipsesData as { eclipses: EclipseRecord[] }).eclipses;
const INGRESSES = (ingressesData as { windows: IngressWindowRecord[] }).windows;
const TABLES = { eclipses: ECLIPSES, ingresses: INGRESSES };
const DASHES = /[‒–—―]/u;
const TRANSLATED = { es: YEAR_SKY_WORDS_ES, pt: YEAR_SKY_WORDS_PT, fr: YEAR_SKY_WORDS_FR, it: YEAR_SKY_WORDS_IT } as const;

function natalFor(utc: string, latitude: number, longitude: number, timeKnown: boolean): YearSkyNatal {
  const chart = computeChart({ utc: new Date(utc), latitude, longitude, houseSystem: 'whole', timeKnown });
  return {
    bodies: chart.bodies.filter((b) => !b.body.includes('Node')).map(({ body, lon }) => ({ body, lon })),
    asc: timeKnown ? chart.angles!.asc : null,
    mc: timeKnown ? chart.angles!.mc : null,
    utc: chart.input.utc.toISOString(),
    timeKnown,
  };
}

const general = generalSky({ eclipses: ECLIPSES, retrogrades: skyData.retrogrades, ingresses: INGRESSES });
const charts = [
  natalFor('1998-03-20T06:00:00.000Z', 51.5, -0.12, true),
  natalFor('1990-02-07T12:00:00.000Z', 40.71, -74.01, false),
  natalFor('1985-08-01T22:30:00.000Z', -23.55, -46.63, true),
  natalFor('1969-09-11T03:10:00.000Z', 48.85, 2.35, true),
];
const scans = charts.map((natal) => scanYearSky(natal, EDITION_YEAR, general.retrogrades));

function allText(moments: readonly YearMoment[]): string[] {
  return moments.flatMap((m) => [m.title, m.line, m.detail, m.card ?? '', ...m.dates.map((d) => d.label ?? '')]);
}

function wordsText(w: YearSkyWords): string[] {
  return [
    ...Object.values(w).filter((v): v is string => typeof v === 'string'),
    ...w.quarterNames, ...w.monthNames, ...w.moreLinks.map((l) => l.label),
    w.cardCount(1), w.cardCount(9), w.savedLede(null), w.savedLede('Ana'), w.confidence(55),
  ];
}

describe('Your 2027 sky in Spanish, Portuguese, French and Italian', () => {
  it('has a route and hreflang alternates in the four released translations', () => {
    expect(YEAR_SKY_LOCALES).toEqual(['en', 'es', 'pt', 'fr', 'it']);
    expect(alternatePaths(EDITION_PATH)).toEqual({
      en: '/your-2027-sky/', es: '/es/your-2027-sky/', pt: '/pt/your-2027-sky/', fr: '/fr/your-2027-sky/', it: '/it/your-2027-sky/',
    });
    expect(localizePath('ru', EDITION_PATH)).toBe(EDITION_PATH);
  });

  for (const [locale, words] of Object.entries(TRANSLATED) as [keyof typeof TRANSLATED, YearSkyWords][]) {
    describe(locale, () => {
      const sky = generalSky({ eclipses: ECLIPSES, retrogrades: skyData.retrogrades, ingresses: INGRESSES }, locale);
      const years = charts.map((natal, i) => personalYear(scans[i], natal, TABLES, locale));
      const text = [
        ...wordsText(words),
        ...allText(sky.moments), ...sky.background.map((b) => b.line),
        ...years.flatMap((year) => [...allText(year.moments), ...allText(year.allYear)]),
      ];

      it('registers its words when imported', () => {
        expect(yearSkyWords(locale)).toBe(words);
        expect(Object.keys(words).sort()).toEqual(Object.keys(yearSkyWords('en')).sort());
      });

      it('reads the same moments as the English, in its own words', () => {
        expect(sky.moments.map((m) => m.id)).toEqual(general.moments.map((m) => m.id));
        for (const [i, moment] of sky.moments.entries()) expect(moment.title).not.toBe(general.moments[i].title);
        expect(years.flatMap((year) => year.moments).length).toBeGreaterThan(10);
      });

      it('uses no em or en dashes, and leaves no English template words behind', () => {
        for (const line of text) {
          expect(line, line).not.toMatch(DASHES);
          expect(line, line).not.toMatch(/\b(?:your|the|until|retrograde|eclipse on|undefined|null|NaN)\b/u);
        }
      });

      it('names signs and planets with the site’s own localized names', () => {
        expect(words.signName('gemini')).not.toBe('Gemini');
        expect(words.planet('Jupiter')).not.toBe('');
      });

      it('labels each personal reading with its localized reading confidence', () => {
        const labels = years.flatMap((year) => year.moments).filter((m) => m.confidence !== null).map((m) => words.confidence(m.confidence!));
        expect(labels.length).toBeGreaterThan(0);
        for (const label of labels) expect(label).toMatch(/^\D+ \d{2} ?%$/u);
      });

      it('writes a calendar file in its own words, with links to its own page', () => {
        const path = localizePath(locale, EDITION_PATH);
        expect(path).toBe(`/${locale}${EDITION_PATH}`);
        const file = yearCalendar(calendarMoments(years[0].moments, sky.moments), {
          locale, timeZone: 'UTC', generatedAt: '2026-11-06T00:00:00Z', pageUrl: `https://zodiacs.org${path}`,
        })!;
        expect(file).toContain(`zodiacs.org/${locale}/your-2027-sky/`);
        expect(file).not.toContain('Reading confidence');
      });

      if (process.env.YEAR_SKY_DUMP) {
        it('dumps the copy for review', () => {
          writeFileSync(resolve(process.env.YEAR_SKY_DUMP!, `year-sky-${locale}.txt`), [...new Set(text)].join('\n'));
        });
      }
    });
  }

  it('keeps the shared template free of dashes', () => {
    const page = readFileSync(resolve('src/components/year-sky/YearSkyPage.astro'), 'utf8');
    expect(page.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')).not.toMatch(DASHES);
  });
});
