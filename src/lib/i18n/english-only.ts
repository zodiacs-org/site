import { isPageLocale, type Locale, type PageLocale } from './core';

export interface EnglishOnlyCue {
  /** Visible text appended after a label, in parentheses. */
  suffix: string;
  /** Plain-sentence form for title tooltips and aria labels. */
  aria: string;
  /** Compact tag the navigation bar shows after a label, in the reader's script. */
  badge: string;
}

/**
 * The RU release set the bar: a link whose destination is English-only
 * carries hreflang="en" plus a visible "in English for now" cue. Every
 * released locale inherits that courtesy instead of linking silently, and
 * this module is the one copy of the strings: the nav, the footer, and
 * page-level links all read from here so the cues cannot drift apart.
 */
export const ENGLISH_ONLY_COPY: Record<Exclude<PageLocale, 'en'>, EnglishOnlyCue> = {
  es: { suffix: ' (por ahora en inglés)', aria: 'Contenido por ahora en inglés', badge: 'EN' },
  pt: { suffix: ' (por enquanto em inglês)', aria: 'Conteúdo por enquanto em inglês', badge: 'EN' },
  fr: { suffix: ' (pour l’instant en anglais)', aria: 'Contenu pour l’instant en anglais', badge: 'EN' },
  it: { suffix: ' (per ora in inglese)', aria: 'Contenuto per ora in inglese', badge: 'EN' },
  ru: { suffix: ' (пока по-английски)', aria: 'Материал пока доступен по-английски', badge: 'EN' },
  'zh-hans': { suffix: '（英文）', aria: '这一页目前只有英文版', badge: '英' },
  'zh-hant': { suffix: '（英文）', aria: '這一頁目前只有英文版', badge: '英' },
};

/** Cue for the locale, or undefined when none applies (English, staged AR). */
export function englishOnlyCue(locale: Locale): EnglishOnlyCue | undefined {
  if (locale === 'en' || !isPageLocale(locale)) return undefined;
  return ENGLISH_ONLY_COPY[locale];
}
