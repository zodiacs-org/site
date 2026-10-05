import { describe, expect, it } from 'vitest';
import { SIGNS } from '../lib/signs';
import { RU_GUIDES, russianGuideFor } from './ru-guides';

const EXPECTED = [
  { slug: 'aries', name: 'Овен', dates: '21 мар – 19 апр', prep: 'Овне', element: 'кардинальный знак огня', ruler: 'Марс' },
  { slug: 'taurus', name: 'Телец', dates: '20 апр – 20 мая', prep: 'Тельце', element: 'фиксированный знак земли', ruler: 'Венера' },
  { slug: 'gemini', name: 'Близнецы', dates: '21 мая – 20 июн', prep: 'Близнецах', element: 'мутабельный знак воздуха', ruler: 'Меркурий' },
  { slug: 'cancer', name: 'Рак', dates: '21 июн – 22 июл', prep: 'Раке', element: 'кардинальный знак воды', ruler: 'Луна' },
  { slug: 'leo', name: 'Лев', dates: '23 июл – 22 авг', prep: 'Льве', element: 'фиксированный знак огня', ruler: 'Солнце' },
  { slug: 'virgo', name: 'Дева', dates: '23 авг – 22 сен', prep: 'Деве', element: 'мутабельный знак земли', ruler: 'Меркурий' },
  { slug: 'libra', name: 'Весы', dates: '23 сен – 22 окт', prep: 'Весах', element: 'кардинальный знак воздуха', ruler: 'Венера' },
  { slug: 'scorpio', name: 'Скорпион', dates: '23 окт – 21 ноя', prep: 'Скорпионе', element: 'фиксированный знак воды', ruler: 'Марс в традиции и Плутон в современной астрологии' },
  { slug: 'sagittarius', name: 'Стрелец', dates: '22 ноя – 21 дек', prep: 'Стрельце', element: 'мутабельный знак огня', ruler: 'Юпитер' },
  { slug: 'capricorn', name: 'Козерог', dates: '22 дек – 19 янв', prep: 'Козероге', element: 'кардинальный знак земли', ruler: 'Сатурн' },
  { slug: 'aquarius', name: 'Водолей', dates: '20 янв – 18 фев', prep: 'Водолее', element: 'фиксированный знак воздуха', ruler: 'Сатурн в традиции и Уран в современной астрологии' },
  { slug: 'pisces', name: 'Рыбы', dates: '19 фев – 20 мар', prep: 'Рыбах', element: 'мутабельный знак воды', ruler: 'Юпитер в традиции и Нептун в современной астрологии' },
] as const;

function readerText(slug: string) {
  const guide = RU_GUIDES[slug];
  if (!guide) throw new Error(`Missing fixture ${slug}`);
  return [
    guide.title,
    guide.description,
    ...guide.intro,
    ...guide.sections.flatMap((section) => [section.heading, ...section.body]),
    ...guide.faq.flatMap(({ q, a }) => [q, a]),
  ].join('\n');
}

describe('Russian sign guides', () => {
  it('provides the complete long-form structure for all twelve signs', () => {
    expect(Object.keys(RU_GUIDES)).toEqual(SIGNS.map(({ slug }) => slug));

    for (const sign of SIGNS) {
      const guide = russianGuideFor(sign);
      expect(guide.sign).toBe(sign.slug);
      expect(guide.intro).toHaveLength(2);
      expect(guide.sections).toHaveLength(9);
      expect(guide.sections.map(({ body }) => body.length)).toEqual([2, 2, 1, 3, 3, 3, 4, 3, 3]);
      expect(guide.sections.flatMap(({ body }) => body)).toHaveLength(24);
      expect(guide.sections.filter(({ risingProfile }) => risingProfile)).toHaveLength(1);
      expect(guide.faq).toHaveLength(6);
      expect(guide.sections[6]?.heading).toContain('в положениях карты');
    }
  });

  it('keeps names, dates, cases, elements and rulers aligned with the Russian deck', () => {
    for (const expected of EXPECTED) {
      const guide = RU_GUIDES[expected.slug];
      expect(guide).toBeDefined();
      const text = readerText(expected.slug);
      expect(guide?.title.startsWith(`${expected.name}:`)).toBe(true);
      expect(text).toContain(expected.dates);
      expect(text).toContain(expected.element);
      expect(text).toContain(expected.ruler);
      expect(guide?.sections[6]?.body[0]).toContain(`Солнце в ${expected.prep}`);
      expect(guide?.sections[6]?.body[0]).toContain(`Луна в ${expected.prep}`);
      expect(guide?.sections[6]?.body[0]).toContain(`Асцендент в ${expected.prep}`);
      expect(guide?.sections[6]?.body[1]).toContain(`Венера в ${expected.prep}`);
      expect(guide?.sections[6]?.body[1]).toContain(`Марс в ${expected.prep}`);
    }
  });

  it('uses the canonical chart vocabulary without English prose leakage', () => {
    for (const expected of EXPECTED) {
      const text = readerText(expected.slug);
      for (const term of ['натальная карта', 'Солнце', 'Луна', 'Венера', 'Марс', 'асцендент', 'дома', 'аспекты']) {
        expect(text).toContain(term);
      }
      expect(text).not.toMatch(/[A-Za-z]{3,}/u);
      expect(text).not.toMatch(/\b(?:birth chart|sun sign|rising sign|read more|compatibility|personality)\b/iu);
    }
  });

  it('keeps the reflective voice and rejects provenance or deterministic claims', () => {
    const corpus = EXPECTED.map(({ slug }) => readerText(slug)).join('\n');
    expect(corpus).toContain('осознанным выбором, а не автоматической реакцией');
    expect(corpus).toContain('Солнечный знак — только начало.');
    expect(corpus).toContain('Знак даёт словарь; натальная карта составляет фразу.');
    // «ё» is written wherever it is pronounced (RU-COPY-DECK conventions).
    expect(corpus).not.toMatch(/(?<![а-яё])(?:еще|ее|дает|растет|остается|вперед|партнер[а-я]*|надежн[а-я]*|расчет[а-я]*|учеб[а-я]*|серьезн[а-я]*)(?![а-яё])/iu);
    expect(corpus).not.toMatch(/гарантир|предначерт|сужден|неизбеж|обязательно случит/iu);
    expect(corpus).not.toMatch(/машинн(?:ый|ого) перевод|проверен\w* носител|переведен\w* человеком|искусственн\w+ интеллект/iu);
  });

  it('preserves a distinct growth practice and private truth for every sign', () => {
    const growth = SIGNS.map((sign) => russianGuideFor(sign).sections[7]?.body[1]);
    const truths = SIGNS.map((sign) => russianGuideFor(sign).sections[8]?.body[0]);
    expect(new Set(growth).size).toBe(SIGNS.length);
    expect(new Set(truths).size).toBe(SIGNS.length);
  });
});
