/**
 * The sign-season copy by locale. English is the only locale so far; another
 * locale adds its SeasonCopy table and SeasonUi beside English here, and the
 * pages read through these functions.
 */
import { SIGNS } from '../signs';
import { readingConfidence } from '../../ai-tools/reading-confidence';
import {
  SEASON_COPY_EN,
  SEASON_HOUSE_ORDINALS_EN,
  SEASON_UI_EN,
  type SeasonCopy,
  type SeasonUi,
} from './copy-en';
import { solarHouse } from './windows';

export type SeasonLocale = 'en';
export type { SeasonCopy, SeasonUi };

const COPY: Record<SeasonLocale, { seasons: Readonly<Record<string, SeasonCopy>>; ui: SeasonUi; ordinals: readonly string[] }> = {
  en: { seasons: SEASON_COPY_EN, ui: SEASON_UI_EN, ordinals: SEASON_HOUSE_ORDINALS_EN },
};

export const SEASON_LOCALES: readonly SeasonLocale[] = ['en'];

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
