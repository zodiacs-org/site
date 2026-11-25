import type { ExpansionLocale } from '../horoscope/types';
import type { ZodiacDatesCopy } from './types';

const found = import.meta.glob<Record<string, ZodiacDatesCopy>>(['./es.ts', './pt.ts', './fr.ts', './it.ts', './ru.ts'], { eager: true });
const BY_LOCALE: Partial<Record<ExpansionLocale, ZodiacDatesCopy>> = Object.fromEntries(
  Object.entries(found).map(([path, mod]) => [path.slice(2, -3), mod[path.slice(2, -3)]]),
);

export function zodiacDatesCopy(locale: ExpansionLocale): ZodiacDatesCopy {
  const copy = BY_LOCALE[locale];
  if (!copy) throw new Error(`No zodiac dates copy is written for ${locale}`);
  return copy;
}
