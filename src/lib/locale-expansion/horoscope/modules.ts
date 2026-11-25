import type { ExpansionLocale, HoroscopeLocaleModule } from './types';

// Every written locale module in this folder (es.ts, pt.ts, fr.ts, it.ts,
// ru.ts), each exporting a HoroscopeLocaleModule under its locale's name.
const found = import.meta.glob<Record<string, HoroscopeLocaleModule>>(
  ['./es.ts', './pt.ts', './fr.ts', './it.ts', './ru.ts'],
  { eager: true },
);

export const HOROSCOPE_MODULES: Partial<Record<ExpansionLocale, HoroscopeLocaleModule>> = Object.fromEntries(
  Object.entries(found).map(([path, mod]) => {
    const locale = path.slice(2, -3) as ExpansionLocale;
    const module = mod[locale];
    if (!module || module.locale !== locale) throw new Error(`${path} must export \`${locale}\` with locale "${locale}"`);
    return [locale, module];
  }),
);

export function horoscopeModule(locale: ExpansionLocale): HoroscopeLocaleModule {
  const module = HOROSCOPE_MODULES[locale];
  if (!module) throw new Error(`No horoscope period copy is written for ${locale}`);
  return module;
}
