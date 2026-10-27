import { isSectionLocale, requireCatalogLocale, type CatalogLocale, type Locale, type SectionLocale } from '../core.js';
import en from './en.js';
import es from './es.js';
import pt from './pt.js';
import fr from './fr.js';
import it from './it.js';
import ru from './ru.js';
import zhHans from './zh-hans.js';
import zhHant from './zh-hant.js';
import type { UiCatalog, UiKey } from './schema';

export const UI = {
  en,
  es,
  pt,
  fr,
  it,
  ru,
} as const satisfies Record<CatalogLocale, UiCatalog>;

/** Chrome-only catalogs for the section locales; never embedded for islands. */
export const SECTION_UI = {
  'zh-hans': zhHans,
  'zh-hant': zhHant,
} as const satisfies Record<SectionLocale, Partial<UiCatalog>>;

/** Server-only lookup for code that runs outside Astro/Vite's import-meta environment. */
export function serverUiMessage(locale: Locale, key: UiKey): string {
  if (isSectionLocale(locale)) {
    const message = (SECTION_UI[locale] as Partial<UiCatalog>)[key];
    if (message === undefined) throw new Error(`No ${locale} chrome message for ${key}`);
    return message;
  }
  return UI[requireCatalogLocale(locale)][key];
}
