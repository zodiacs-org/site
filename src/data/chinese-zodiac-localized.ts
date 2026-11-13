import { isSectionLocale, type ReleasedLocale, type SectionLocale } from '../lib/i18n/core';
import { additionFormat, additionText, localizedAdditionObject } from '../strings/additions';
import { CHINESE_ZODIAC_ANIMALS, CHINESE_ZODIAC_COPY } from './chinese-zodiac';
import { CHINESE_ZODIAC_ZH } from './chinese-zodiac-zh';

/** The released locales plus the Chinese editions, which publish only this guide. */
export type ChineseZodiacLocale = ReleasedLocale | SectionLocale;

function format(template: string, values: Record<string, string | number>): string {
  return template.replace(
    /\{([A-Za-z][A-Za-z0-9]*)\}/g,
    (token, name: string) => Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : token,
  );
}

export function chineseZodiacCopy(locale: ChineseZodiacLocale) {
  if (isSectionLocale(locale)) return CHINESE_ZODIAC_ZH[locale].copy;
  return localizedAdditionObject(locale, 'chineseZodiac', CHINESE_ZODIAC_COPY);
}

export function chineseZodiacAnimals(locale: ChineseZodiacLocale) {
  if (locale === 'en') return CHINESE_ZODIAC_ANIMALS;
  if (isSectionLocale(locale)) {
    return CHINESE_ZODIAC_ANIMALS.map((animal) => ({ ...animal, ...CHINESE_ZODIAC_ZH[locale].animals[animal.slug] }));
  }
  return CHINESE_ZODIAC_ANIMALS.map((animal) => ({
    ...animal,
    name: additionText(locale, `chineseZodiac.animals.${animal.slug}.name`, animal.name),
    association: additionText(locale, `chineseZodiac.animals.${animal.slug}.association`, animal.association),
    context: additionText(locale, `chineseZodiac.animals.${animal.slug}.context`, animal.context),
  }));
}

export function chineseZodiacLocalizedText(
  locale: ChineseZodiacLocale,
  key: keyof typeof CHINESE_ZODIAC_COPY,
  values: Record<string, string | number> = {},
): string {
  if (isSectionLocale(locale)) return format(CHINESE_ZODIAC_ZH[locale].copy[key], values);
  return additionFormat(locale, `chineseZodiac.${key}`, values, CHINESE_ZODIAC_COPY[key]);
}
