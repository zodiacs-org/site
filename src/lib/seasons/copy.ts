/**
 * The sign-season copy by locale: English (copy-en.ts) and the Spanish,
 * Portuguese, French and Italian translations (copy-{es,pt,fr,it}.ts), each
 * a SeasonCopy table, a SeasonUi and the house ordinals. The pages read
 * through these functions. Everything here renders at build time; the
 * pages' scripts get plain strings, so no table reaches the browser.
 */
import { SIGNS } from '../signs';
import { readingConfidence, readingConfidenceText } from '../../ai-tools/reading-confidence';

/** Re-exported so the season pages print the label without importing src/ai-tools/ themselves. */
export { readingConfidenceText };
import {
  SEASON_COPY_EN,
  SEASON_HOUSE_ORDINALS_EN,
  SEASON_UI_EN,
  type SeasonCopy,
  type SeasonFacts,
  type SeasonUi,
} from './copy-en';
import { SEASON_COPY_ES, SEASON_HOUSE_ORDINALS_ES, SEASON_UI_ES } from './copy-es';
import { SEASON_COPY_PT, SEASON_HOUSE_ORDINALS_PT, SEASON_UI_PT } from './copy-pt';
import { SEASON_COPY_FR, SEASON_HOUSE_ORDINALS_FR, SEASON_UI_FR } from './copy-fr';
import { SEASON_COPY_IT, SEASON_HOUSE_ORDINALS_IT, SEASON_UI_IT } from './copy-it';
import { solarHouse } from './windows';

export const SEASON_LOCALES = ['en', 'es', 'pt', 'fr', 'it'] as const;
export type SeasonLocale = typeof SEASON_LOCALES[number];
export type { SeasonCopy, SeasonFacts, SeasonUi };

const COPY: Record<SeasonLocale, { seasons: Readonly<Record<string, SeasonCopy>>; ui: SeasonUi; ordinals: readonly string[] }> = {
  en: { seasons: SEASON_COPY_EN, ui: SEASON_UI_EN, ordinals: SEASON_HOUSE_ORDINALS_EN },
  es: { seasons: SEASON_COPY_ES, ui: SEASON_UI_ES, ordinals: SEASON_HOUSE_ORDINALS_ES },
  pt: { seasons: SEASON_COPY_PT, ui: SEASON_UI_PT, ordinals: SEASON_HOUSE_ORDINALS_PT },
  fr: { seasons: SEASON_COPY_FR, ui: SEASON_UI_FR, ordinals: SEASON_HOUSE_ORDINALS_FR },
  it: { seasons: SEASON_COPY_IT, ui: SEASON_UI_IT, ordinals: SEASON_HOUSE_ORDINALS_IT },
};

/**
 * A season line names a Sun sign and no date, so it carries the reading
 * confidence of a Sun sign alone (src/ai-tools/reading-confidence.ts).
 */
export const SEASON_READING_CONFIDENCE = readingConfidence('sign');

export function seasonCopy(slug: string, locale: SeasonLocale = 'en'): SeasonCopy {
  const copy = COPY[locale].seasons[slug];
  if (!copy) throw new Error(`no season copy for ${slug}`);
  return copy;
}

export function seasonUi(locale: SeasonLocale = 'en'): SeasonUi {
  return COPY[locale].ui;
}

/** What `season` asks of a reader whose Sun is in `reader`, and the solar house it reads from. */
export function seasonAsk(season: string, reader: string, locale: SeasonLocale = 'en'): { text: string; house: number; houseName: string } {
  const seasonIndex = SIGNS.findIndex((sign) => sign.slug === season);
  const readerIndex = SIGNS.findIndex((sign) => sign.slug === reader);
  if (seasonIndex < 0 || readerIndex < 0) throw new Error('unknown sign');
  const house = solarHouse(season, reader);
  return {
    text: seasonCopy(season, locale).asks[(readerIndex - seasonIndex + 12) % 12],
    house,
    houseName: COPY[locale].ordinals[house - 1],
  };
}
