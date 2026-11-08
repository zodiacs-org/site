/**
 * The localized daily pages' copy by locale: Spanish and Portuguese from
 * their original modules, French and Italian from the locale expansion
 * (src/lib/locale-expansion/daily-copy/). Pages render a locale only when its
 * route is built, so a missing locale here fails that build loudly.
 */
import { LOCALIZED_HOROSCOPE_COPY, type Copy } from './horoscope-copy';
import { HUB_COPY, type HubCopy, type HubLocale } from './hub-copy';
import { TODAY_COPY, type TodayCopy, type TodayLocale } from './today-copy';

export { TODAY, named, cap, type Part, type TodayCopy, type TodayLocale } from './today-copy';
export type { HubLocale } from './hub-copy';

interface DailyCopySet { horoscope: Copy; today: TodayCopy; hub: HubCopy }

const extra = import.meta.glob<Record<string, DailyCopySet>>(
  ['../../lib/locale-expansion/daily-copy/fr.ts', '../../lib/locale-expansion/daily-copy/it.ts'],
  { eager: true },
);
const sets: Partial<Record<'fr' | 'it', DailyCopySet>> = Object.fromEntries(
  Object.entries(extra).map(([path, mod]) => {
    const locale = path.slice(-5, -3) as 'fr' | 'it';
    return [locale, mod[locale]];
  }),
);

function missing(locale: string): never {
  throw new Error(`No daily page copy is written for ${locale}`);
}

const pick = <T>(base: Record<'es' | 'pt', T>, key: keyof DailyCopySet) => new Proxy({} as Record<TodayLocale, T>, {
  get: (_, locale: string) => (locale === 'es' || locale === 'pt'
    ? base[locale]
    : (sets[locale as 'fr' | 'it']?.[key] as T | undefined) ?? missing(locale)),
});

export const COPY_FOR_HOROSCOPE = pick<Copy>(LOCALIZED_HOROSCOPE_COPY, 'horoscope');
export const COPY_FOR_TODAY = pick<TodayCopy>(TODAY_COPY, 'today');
export const COPY_FOR_HUB: Record<HubLocale, HubCopy> = pick<HubCopy>(HUB_COPY, 'hub');
