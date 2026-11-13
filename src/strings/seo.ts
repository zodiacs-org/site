import { isSectionLocale, type PageLocale as Locale, type SectionLocale } from '../lib/i18n/core';
import { additionText, localizedAdditionObject } from './additions';
import { BREADCRUMB_LABELS, OG_EN, SCHEMA_EN, ogImageForPath, ogSpecialForPath } from './seo.en.mjs';
import { ruOgImageForPath } from './seo.ru.mjs';

// Russian is the first localized social-card catalogue. Other released
// locales keep the established English artwork until their own reviewed card
// sets are approved; the route-level copy and metadata remain localized.

export function schemaCatalog(locale: Locale) {
  if (locale === 'ru') return RU_SCHEMA;
  if (isSectionLocale(locale)) return SECTION_SCHEMA[locale];
  return localizedAdditionObject(locale, 'schema', SCHEMA_EN);
}

export function breadcrumbLabelForLocale(segment: string, locale: Locale): string {
  const key = decodeURIComponent(String(segment || '')).toLowerCase();
  const english = BREADCRUMB_LABELS[key as keyof typeof BREADCRUMB_LABELS];
  if (!english) return key.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (locale === 'ru') return RU_BREADCRUMB_LABELS[key] ?? english;
  if (isSectionLocale(locale)) return english;
  return additionText(locale, `schema.breadcrumbLabels.${key}`, english);
}

/** Resolve only cards that exist for the requested released route family. */
export function ogImageForPathAndLocale(path: string, locale: Locale): string | null {
  if (locale === 'ru') return ruOgImageForPath(path) ?? ogImageForPath(path);
  if (isSectionLocale(locale)) return null;
  return ogImageForPath(path);
}

export function ogAltForPathAndLocale(path: string, locale: Locale): string {
  const normalized = path === '/'
    ? '/'
    : `/${String(path || '/').split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, '')}/`;
  // The section locales publish only the Chinese zodiac guide, which uses the
  // site's fallback card.
  if (isSectionLocale(locale)) return SECTION_SCHEMA[locale].fallbackAlt;
  const tool = OG_EN.tools.find((entry) => entry.path === normalized);
  if (tool) {
    if (locale === 'ru') return `${RU_OG_TOOL_TITLES[tool.key] ?? tool.title} | Zodiacs.org`;
    return `${additionText(locale, `og.tools.${tool.key}.title`, tool.title)} | Zodiacs.org`;
  }
  const special = ogSpecialForPath(normalized);
  if (special) {
    if (locale === 'ru') return RU_OG_SPECIAL_ALT[special.key] ?? special.value.alt;
    return additionText(locale, `og.${special.key}.alt`, special.value.alt);
  }
  if (locale === 'ru') return 'Zodiacs.org: бесплатные натальные карты, гиды по знакам и астрологические инструменты.';
  return additionText(locale, 'og.fallbackAlt', OG_EN.fallbackAlt);
}

const RU_SCHEMA = Object.freeze({
  organizationName: 'Zodiacs',
  organizationAlternateName: 'Zodiacs.org',
  websiteName: 'Zodiacs.org',
  websiteDescription: 'Бесплатные натальные карты, совместимость и гиды по знакам. Всё считается приватно в вашем браузере.',
  breadcrumbHome: 'Zodiacs.org',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Любое устройство с современным браузером',
  browserRequirements: 'Требуется современный браузер.',
  freePrice: '0',
  currency: 'USD',
});

const SECTION_SCHEMA = Object.freeze({
  'zh-hans': Object.freeze({
    organizationName: 'Zodiacs',
    organizationAlternateName: 'Zodiacs.org',
    websiteName: 'Zodiacs.org',
    websiteDescription: '免费的出生星盘、星盘配对和星座指南，星盘在你自己的浏览器里计算。',
    breadcrumbHome: 'Zodiacs.org',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: '任何装有现代浏览器的设备',
    browserRequirements: '需要使用现代浏览器。',
    freePrice: '0',
    currency: 'USD',
    fallbackAlt: 'Zodiacs.org：免费的出生星盘、星座指南和占星工具。',
  }),
  'zh-hant': Object.freeze({
    organizationName: 'Zodiacs',
    organizationAlternateName: 'Zodiacs.org',
    websiteName: 'Zodiacs.org',
    websiteDescription: '免費的出生星盤、星盤配對和星座指南，星盤在你自己的瀏覽器裡計算。',
    breadcrumbHome: 'Zodiacs.org',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: '任何裝有現代瀏覽器的裝置',
    browserRequirements: '需要使用現代瀏覽器。',
    freePrice: '0',
    currency: 'USD',
    fallbackAlt: 'Zodiacs.org：免費的出生星盤、星座指南和占星工具。',
  }),
} satisfies Record<SectionLocale, Record<string, string>>);

const RU_BREADCRUMB_LABELS: Readonly<Record<string, string>> = Object.freeze({
  about: 'О проекте',
  'baby-zodiac': 'Знак ребёнка',
  'birth-chart': 'Натальная карта',
  compatibility: 'Совместимость',
  disclosure: 'Раскрытие информации',
  methodology: 'Методология',
  markets: 'Маршрут Terminal к торговой площадке',
  'moon-phase': 'Фаза Луны',
  'moon-sign': 'Лунный знак',
  privacy: 'Конфиденциальность',
  profile: 'Профиль',
  registry: 'Реестр Zodiacs',
  research: 'Исследования рынков',
  'rising-sign': 'Асцендент',
  ru: 'Русский',
  'saturn-return': 'Возвращение Сатурна',
  astrofolio: 'Astrofolio',
  terminal: 'Terminal',
  tools: 'Астроинструменты',
  transits: 'Транзиты',
});

const RU_OG_TOOL_TITLES: Readonly<Record<string, string>> = Object.freeze({
  'baby-zodiac': 'Знак ребёнка',
  'birth-chart': 'Ваша натальная карта',
  compatibility: 'Сравнение двух карт',
  'moon-phase': 'Луна в любую ночь',
  'moon-sign': 'Ваш лунный знак',
  'rising-sign': 'Ваш асцендент',
  'saturn-return': 'Ваше возвращение Сатурна',
  tools: 'Астрологические расчёты',
  transits: 'Ваши транзиты сегодня',
});

const RU_OG_SPECIAL_ALT: Readonly<Record<string, string>> = Object.freeze({
  astrofolio: 'Astrofolio: коллекция двенадцати официальных токенов Зодиака.',
  terminal: 'Terminal: экспертный рыночный контекст и проверенные исследования двенадцати официальных токенов Зодиака.',
  thesis: 'Вера — самый древний актив: манифест Реестра Zodiacs.org.',
  disclosure: 'Раскрытие информации о Реестре — подтверждённые факты и ожидающие подтверждения сведения.',
});
