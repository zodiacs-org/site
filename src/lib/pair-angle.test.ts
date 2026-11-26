import { describe, expect, it } from 'vitest';
import { ALL_PAIRS } from './compat';
import { pairAngle } from './pair-angle';
import { PAIR_ANGLE_LOCALES, PAIR_ANGLE_WORDS } from './pair-angle-words';
import { signName } from './signs';

describe('pairAngle', () => {
  it('measures the shorter way round, 30 degrees a sign', () => {
    expect(pairAngle('aries', 'aries')).toMatchObject({ steps: 0, degrees: 0, aspect: 'conjunction', same: true });
    expect(pairAngle('aries', 'taurus')).toMatchObject({ steps: 1, degrees: 30, aspect: 'semi-sextile', clockwise: true });
    expect(pairAngle('aries', 'gemini')).toMatchObject({ degrees: 60, aspect: 'sextile' });
    expect(pairAngle('aries', 'cancer')).toMatchObject({ degrees: 90, aspect: 'square' });
    expect(pairAngle('aries', 'leo')).toMatchObject({ degrees: 120, aspect: 'trine' });
    expect(pairAngle('aries', 'virgo')).toMatchObject({ degrees: 150, aspect: 'quincunx' });
    expect(pairAngle('aries', 'libra')).toMatchObject({ degrees: 180, aspect: 'opposition', clockwise: true });
    expect(pairAngle('aries', 'pisces')).toMatchObject({ steps: 1, degrees: 30, clockwise: false });
    expect(pairAngle('taurus', 'capricorn')).toMatchObject({ steps: 4, degrees: 120, clockwise: false });
  });

  it('states only shared make-up that holds for every pair at its angle', () => {
    const expected = [
      [true, true, true],
      [false, false, false],
      [false, false, true],
      [false, true, false],
      [true, false, true],
      [false, false, false],
      [false, true, true],
    ];
    for (const [a, b] of ALL_PAIRS) {
      const angle = pairAngle(a, b);
      expect([angle.sharesElement, angle.sharesModality, angle.sharesPolarity], `${a}-${b}`).toEqual(expected[angle.steps]);
    }
  });

  it('writes plain copy with no dashes and links to a Learn page', () => {
    for (const [a, b] of ALL_PAIRS) {
      const angle = pairAngle(a, b);
      for (const text of [angle.heading, angle.lede, angle.alt, angle.learn.label]) {
        expect(text, `${a}-${b}`).not.toMatch(/[–—]/u);
      }
      expect(angle.learn.href).toMatch(/^\/learn\/aspects\/(?:(?:conjunction|sextile|square|trine|opposition)\/)?$/u);
    }
  });

  it('keeps the English plate as first published', () => {
    expect(pairAngle('aries', 'leo')).toMatchObject({
      heading: 'Aries and Leo are four signs apart',
      lede: 'Four signs apart is 120 degrees, a trine, a third of the wheel. Aries and Leo share an element, both fire, and a polarity, and differ in modality.',
      elements: 'Both fire',
      modalities: 'Cardinal and fixed',
      share: 'a third of the wheel',
      aspectName: 'trine',
      learn: { href: '/learn/aspects/trine/', label: 'The trine in a birth chart' },
      alt: 'A zodiac wheel of twelve signs with Aries at the top. A line joins Aries and Leo, four signs and 120 degrees apart, a trine.',
    });
    expect(pairAngle('aries', 'aries').heading).toBe('Aries and Aries share one sign');
    expect(pairAngle('aries', 'virgo').learn).toEqual({ href: '/learn/aspects/', label: 'The five major aspects' });
  });

  it('words every pair in every language: no gaps, no dashes, both signs named', () => {
    for (const locale of PAIR_ANGLE_LOCALES) {
      const words = PAIR_ANGLE_WORDS[locale];
      const fixed = [
        words.kicker, words.signsApart, words.sameSign, words.shorterWay, words.angle, words.elements,
        words.modalities, words.elementShared.yes, words.elementShared.no, words.modalityShared.yes,
        words.modalityShared.no, words.learnIndex, words.source, ...words.share, ...Object.values(words.aspect),
      ];
      expect(words.share, locale).toHaveLength(7);
      for (const text of fixed) {
        expect(text, locale).toBeTruthy();
        expect(text, locale).not.toMatch(/[–—]|undefined/u);
      }
      for (const [a, b] of ALL_PAIRS) {
        const angle = pairAngle(a, b, locale);
        const where = `${locale} ${a}-${b}`;
        const copy = [angle.heading, angle.lede, angle.alt, angle.learn.label, angle.elements, angle.modalities, angle.share, angle.aspectName];
        for (const text of copy) {
          expect(text, where).toBeTruthy();
          expect(text, where).not.toMatch(/[–—]|undefined|null|NaN|\$\{/u);
          expect(text, where).not.toMatch(/\s{2}|\s[,.]/u);
        }
        for (const slug of [a, b]) {
          const name = signName(slug, locale);
          expect(angle.heading, where).toContain(name);
          expect(angle.lede, where).toContain(name);
          expect(angle.alt, where).toContain(name);
        }
        // The facts do not depend on the language.
        const english = pairAngle(a, b);
        expect([angle.steps, angle.degrees, angle.aspect, angle.clockwise, angle.learn.href], where)
          .toEqual([english.steps, english.degrees, english.aspect, english.clockwise, english.learn.href]);
      }
    }
  });

  it('words the translations in each language, not in English', () => {
    const english = /\b(?:the|and|signs?|apart|share[ds]?|wheel|degrees|Both|Elements|Modalities|Angle between)\b/u;
    for (const locale of PAIR_ANGLE_LOCALES.filter((l) => l !== 'en')) {
      for (const [a, b] of ALL_PAIRS) {
        const angle = pairAngle(a, b, locale);
        for (const text of [angle.heading, angle.lede, angle.alt, angle.elements, angle.modalities, angle.share]) {
          expect(text, `${locale} ${a}-${b}`).not.toMatch(english);
        }
      }
    }
  });

  it('puts the French and Italian articles before a sign', () => {
    expect(pairAngle('aries', 'leo', 'fr').lede).toContain('Le Bélier et le Lion partagent un élément, tous deux signes de feu');
    expect(pairAngle('gemini', 'aquarius', 'fr').lede).toContain('Les Gémeaux et le Verseau');
    expect(pairAngle('aries', 'aries', 'fr').lede).toContain('dans le Bélier');
    expect(pairAngle('aries', 'leo', 'it').lede).toContain('L’Ariete e il Leone condividono l’elemento, entrambi segni di fuoco');
    expect(pairAngle('scorpio', 'scorpio', 'it').lede).toContain('sono nello Scorpione');
    expect(pairAngle('gemini', 'libra', 'it').lede).toContain('I Gemelli e la Bilancia');
  });
});
