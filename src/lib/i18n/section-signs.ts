import { SIGNS, signName, type Sign } from '../signs';
import { signDateRange } from '../sign-display';
import { isSectionLocale, type PageLocale, type SectionLocale } from './core';

/**
 * Western sign names for the section locales' shared chrome (server-only, so
 * no browser bundle carries them). Traditional Chinese follows Taiwan usage
 * for Aries (牡羊座); every other name reads the same in Hong Kong.
 */
const SECTION_SIGN_NAMES: Record<SectionLocale, Record<string, string>> = {
  'zh-hans': {
    aries: '白羊座', taurus: '金牛座', gemini: '双子座', cancer: '巨蟹座',
    leo: '狮子座', virgo: '处女座', libra: '天秤座', scorpio: '天蝎座',
    sagittarius: '射手座', capricorn: '摩羯座', aquarius: '水瓶座', pisces: '双鱼座',
  },
  'zh-hant': {
    aries: '牡羊座', taurus: '金牛座', gemini: '雙子座', cancer: '巨蟹座',
    leo: '獅子座', virgo: '處女座', libra: '天秤座', scorpio: '天蠍座',
    sagittarius: '射手座', capricorn: '摩羯座', aquarius: '水瓶座', pisces: '雙魚座',
  },
};

function resolve(sign: Sign | string): Sign {
  const resolved = typeof sign === 'string' ? SIGNS.find((entry) => entry.slug === sign) : sign;
  if (!resolved) throw new Error(`Unknown sign: ${String(sign)}`);
  return resolved;
}

export function chromeSignName(sign: Sign | string, locale: PageLocale): string {
  if (!isSectionLocale(locale)) return signName(sign, locale);
  return SECTION_SIGN_NAMES[locale][resolve(sign).slug];
}

export function chromeSignDateRange(sign: Sign | string, locale: PageLocale): string {
  if (!isSectionLocale(locale)) return signDateRange(sign, locale);
  const { start, end } = resolve(sign);
  return `${start[0]}月${start[1]}日至${end[0]}月${end[1]}日`;
}
