/**
 * The localized daily reading for every language the daily pages render:
 * Spanish, Portuguese, French and Italian from src/lib/i18n/daily-reading.ts,
 * Russian from ./daily-ru.ts (the frozen i18n module is left as it is).
 * Every renderer attaches the same receipts as the English reading.
 */
import type { Daily, DailyReading } from '../daily';
import { dailyReadingForLocale } from '../i18n/daily-reading';
import { dailyReadingRu } from './daily-ru';

export type DailyLocale = 'es' | 'pt' | 'fr' | 'it' | 'ru';

export function dailyReadingFor(sunSign: string, daily: Daily, locale: DailyLocale): DailyReading {
  return locale === 'ru' ? dailyReadingRu(sunSign, daily) : dailyReadingForLocale(sunSign, daily, locale);
}
