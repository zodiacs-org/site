import { describe, expect, it } from 'vitest';
import sky from '../../data/sky.json';
import { alternatePaths, localizePath } from '../i18n';
import { MOON_JOURNAL_COPY, MOON_JOURNAL_LOCALES, moonJournalCopy, type MoonJournalCopy } from './copy';
import { MOON_JOURNAL_COPY_ES } from './copy-es';
import { MOON_JOURNAL_COPY_PT } from './copy-pt';
import { MOON_JOURNAL_COPY_FR } from './copy-fr';
import { MOON_JOURNAL_COPY_IT } from './copy-it';
import { MOON_JOURNAL_PAGE_COPY } from './page-copy';
import { journalMarkdown, lunationCalendar, promptFor } from './cycle';
import { SIGN_SLUGS, type Lunation } from './types';

const DASHES = /[‒–—―]/;
const TRANSLATED = { es: MOON_JOURNAL_COPY_ES, pt: MOON_JOURNAL_COPY_PT, fr: MOON_JOURNAL_COPY_FR, it: MOON_JOURNAL_COPY_IT } as const;
/** No predictions, luck, money or health in the questions. */
const PREDICTIVE: Record<keyof typeof TRANSLATED, RegExp> = {
  es: /\b(suerte|dinero|salud|garantí\w*|pasará)\b/iu,
  pt: /\b(sorte|dinheiro|saúde|garanti\w*|acontecerá)\b/iu,
  fr: /\b(chance|argent|santé|garanti\w*|arrivera)\b/iu,
  it: /\b(fortuna|soldi|denaro|salute|garanzi\w*|accadrà)\b/iu,
};

function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return [String((value as (...args: unknown[]) => unknown)('Escorpio', '9 nov 2026'))];
  if (value && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}

function keysOf(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([key, inner]) => keysOf(inner, `${prefix}.${key}`));
}

describe('the Moon journal in Spanish, Portuguese, French and Italian', () => {
  it('has a page under each released prefix, with hreflang alternates', () => {
    expect(MOON_JOURNAL_LOCALES).toEqual(['en', 'es', 'pt', 'fr', 'it']);
    expect(alternatePaths('/moon-journal/')).toEqual({
      en: '/moon-journal/', es: '/es/moon-journal/', pt: '/pt/moon-journal/', fr: '/fr/moon-journal/', it: '/it/moon-journal/',
    });
    expect(localizePath('ru', '/moon-journal/')).toBe('/moon-journal/');
  });

  for (const [locale, copy] of Object.entries(TRANSLATED) as [keyof typeof TRANSLATED, MoonJournalCopy][]) {
    describe(locale, () => {
      it('registers itself and has every key the English has', () => {
        expect(moonJournalCopy(locale)).toBe(copy);
        expect(keysOf(copy).sort()).toEqual(keysOf(MOON_JOURNAL_COPY.en).sort());
        expect(Object.keys(MOON_JOURNAL_PAGE_COPY[locale]).sort()).toEqual(Object.keys(MOON_JOURNAL_PAGE_COPY.en).sort());
      });

      it('asks a question for every sign at both the new and the full Moon, never predicting', () => {
        const all = [...Object.values(copy.prompts.new), ...Object.values(copy.prompts.full)];
        for (const phase of ['new', 'full'] as const) {
          expect(Object.keys(copy.prompts[phase]).sort()).toEqual([...SIGN_SLUGS].sort());
        }
        expect(new Set(all).size).toBe(24);
        for (const prompt of all) {
          expect(prompt.trim().endsWith('?'), prompt).toBe(true);
          expect(prompt, prompt).not.toMatch(PREDICTIVE[locale]);
        }
      });

      it('uses no em or en dashes and no English left behind', () => {
        const strings = [...allStrings(copy), ...allStrings(MOON_JOURNAL_PAGE_COPY[locale])];
        expect(strings.length).toBeGreaterThan(60);
        for (const line of strings) {
          expect(line, line).not.toMatch(DASHES);
          expect(line, line).not.toMatch(/\b(?:the|your|Moon in|entry|entries)\b/u);
        }
        expect(copy.ui.deleteAllConfirm(1)).not.toBe(copy.ui.deleteAllConfirm(3));
      });

      it('writes the calendar and the download in its own words, with links to its own page', () => {
        const all: Lunation[] = (sky.moons as { type: 'new' | 'full'; at: string }[]).map((moon) => ({ ...moon, sign: 'aries' as const }));
        const calendar = lunationCalendar(all, Date.parse('2026-11-05T00:00:00Z'), (slug) => slug.toUpperCase(), locale)!;
        expect(calendar).toContain(`URL:https://zodiacs.org/${locale}/moon-journal/`);
        expect(calendar).toContain(copy.lunationTitle('new', 'ARIES'));
        expect(calendar).not.toMatch(DASHES);
        const markdown = journalMarkdown([{
          id: 'new-2026-11-09', phase: 'new', sign: 'scorpio', at: '2026-11-09T07:02:00.000Z',
          prompt: promptFor({ type: 'new', sign: 'scorpio' }, locale), text: 'x', savedAt: '2026-11-09T20:00:00.000Z',
        }], { downloadedOn: '30', formatDay: (iso) => iso.slice(0, 10), signName: (slug) => slug, locale });
        expect(markdown).toContain(`# ${copy.ui.exportTitle}`);
        expect(markdown).toContain(`zodiacs.org/${locale}/moon-journal/`);
        expect(markdown).toContain(copy.prompts.new.scorpio);
      });
    });
  }
});
