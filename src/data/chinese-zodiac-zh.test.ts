import { describe, expect, it } from 'vitest';
import { CHINESE_ZODIAC_ANIMALS, CHINESE_ZODIAC_COPY } from './chinese-zodiac';
import { CHINESE_ZODIAC_ZH, stemBranchYear } from './chinese-zodiac-zh';
import { chineseZodiacAnimals, chineseZodiacLocalizedText } from './chinese-zodiac-localized';

const strings = (locale: keyof typeof CHINESE_ZODIAC_ZH) => [
  ...Object.values(CHINESE_ZODIAC_ZH[locale].copy),
  ...Object.values(CHINESE_ZODIAC_ZH[locale].animals).flatMap((animal) => Object.values(animal)),
];

describe('Chinese editions of the Chinese zodiac guide', () => {
  it('carries every English key and every animal in both scripts', () => {
    for (const locale of ['zh-hans', 'zh-hant'] as const) {
      expect(Object.keys(CHINESE_ZODIAC_ZH[locale].copy).sort()).toEqual(Object.keys(CHINESE_ZODIAC_COPY).sort());
      expect(Object.keys(CHINESE_ZODIAC_ZH[locale].animals).sort())
        .toEqual(CHINESE_ZODIAC_ANIMALS.map((animal) => animal.slug).sort());
      for (const [key, english] of Object.entries(CHINESE_ZODIAC_COPY)) {
        const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();
        // Pinyin is dropped for Chinese readers; every other placeholder survives.
        expect(placeholders(CHINESE_ZODIAC_ZH[locale].copy[key as keyof typeof CHINESE_ZODIAC_COPY]), key)
          .toEqual(placeholders(english).filter((name) => name !== 'pinyin'));
      }
    }
  });

  it('uses no dashes and keeps each script apart', () => {
    for (const locale of ['zh-hans', 'zh-hant'] as const) {
      for (const text of strings(locale)) expect(text).not.toMatch(/[–—―－]/u);
    }
    const simplifiedOnly = /[这个们说为时还与历门马鸡龙猪传统应关从对见长东车书学图]/u;
    const traditionalOnly = /[這個們說為時還與曆門馬雞龍豬傳統應關從對見長東車書學圖]/u;
    for (const text of strings('zh-hant')) expect(text, text).not.toMatch(simplifiedOnly);
    for (const text of strings('zh-hans')) expect(text, text).not.toMatch(traditionalOnly);
  });

  it('names the stem-branch year of the sixty-part cycle', () => {
    expect(stemBranchYear(1924)).toBe('甲子');
    expect(stemBranchYear(1984)).toBe('甲子');
    expect(stemBranchYear(2020)).toBe('庚子');
    expect(stemBranchYear(2026)).toBe('丙午');
    expect(stemBranchYear(2043)).toBe('癸亥');
    for (const animal of chineseZodiacAnimals('zh-hant')) {
      expect(stemBranchYear(2019 + animal.position).slice(1)).toBe(animal.branch);
    }
  });

  it('formats the animal titles in each script', () => {
    expect(chineseZodiacLocalizedText('zh-hans', 'yearOf', { animal: '龙' })).toBe('龙年');
    expect(chineseZodiacLocalizedText('zh-hant', 'metaAnimalTitle', { animal: '龍' }))
      .toBe('生肖龍：屬龍的年份與傳統寓意 | Zodiacs.org');
    expect(chineseZodiacAnimals('zh-hans').map((animal) => animal.name).join('')).toBe('鼠牛虎兔龙蛇马羊猴鸡狗猪');
    expect(chineseZodiacAnimals('zh-hant').map((animal) => animal.name).join('')).toBe('鼠牛虎兔龍蛇馬羊猴雞狗豬');
  });
});
