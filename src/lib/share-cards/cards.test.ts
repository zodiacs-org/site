import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SIGN_SLUGS } from '../signs';
import { copyProblems } from '../locale-expansion/copy-rules';
import { CARD_SHARE_LABELS } from './labels';
import {
  ALL_PAIR_SLUGS, CARD_LOCALES, bigThreeCard, bigThreeCardPath, bigThreeLines, pairCard, pairCardPath, pairPagePath, signPagePath,
} from './cards';

const SIGN = `(?:${SIGN_SLUGS.join('|')})`;

describe('shareable cards', () => {
  it('cover all 78 pairs and 12 signs in every live locale', () => {
    expect(ALL_PAIR_SLUGS).toHaveLength(78);
    expect(CARD_LOCALES).toEqual(['en', 'es', 'pt', 'fr', 'it']);
  });

  it('carry nothing but sign slugs in their addresses and the links they share', () => {
    const allowed = new RegExp(`^(?:/(?:es|pt|fr|it))?/(?:compatibility/${SIGN}-${SIGN}|${SIGN})/$`);
    const cardAllowed = new RegExp(`^/cards/(?:en|es|pt|fr|it)/(?:pair/${SIGN}-${SIGN}|big-three/${SIGN})\\.jpg$`);
    for (const locale of CARD_LOCALES) {
      for (const pair of ALL_PAIR_SLUGS) {
        expect(pairPagePath(locale, pair)).toMatch(allowed);
        expect(pairCardPath(locale, pair)).toMatch(cardAllowed);
      }
      for (const sign of SIGN_SLUGS) {
        expect(signPagePath(locale, sign)).toMatch(allowed);
        expect(bigThreeCardPath(locale, sign)).toMatch(cardAllowed);
      }
    }
  });

  it('write one short, plain line per sign and role in each language', () => {
    for (const locale of CARD_LOCALES) {
      const lines = bigThreeLines(locale);
      expect(Object.keys(lines).sort()).toEqual([...SIGN_SLUGS].sort());
      for (const [sign, roles] of Object.entries(lines)) {
        for (const [role, text] of Object.entries(roles)) {
          expect(text.length, `${locale} ${sign} ${role}`).toBeLessThanOrEqual(80);
          if (locale !== 'en') expect(copyProblems(locale as 'es', text), `${locale} ${sign} ${role}: ${text}`).toEqual([]);
          else expect(text).not.toMatch(/[‒-―]/u);
        }
      }
      for (const value of Object.values(CARD_SHARE_LABELS[locale])) {
        const text = typeof value === 'function' ? value('Leo') : value;
        expect(text).not.toMatch(/[‒-―]/u);
      }
    }
  });

  it('render as 1200 by 630 JPEGs within the budget', async () => {
    for (const bytes of [new Uint8Array(await pairCard('es', 'cancer-capricorn')), new Uint8Array(await bigThreeCard('it', 'leo'))]) {
      expect([...bytes.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
      expect(bytes.length).toBeLessThan(150_000);
      const view = Buffer.from(bytes);
      let offset = 2;
      while (offset < view.length && view[offset + 1] !== 0xc0 && view[offset + 1] !== 0xc2) offset += 2 + view.readUInt16BE(offset + 2);
      expect([view.readUInt16BE(offset + 7), view.readUInt16BE(offset + 5)]).toEqual([1200, 630]);
    }
  }, 60_000);

  it('share without asking anything: the control has no fields and sends no birth details', () => {
    const control = readFileSync('src/components/share/CardShare.astro', 'utf8');
    expect(control).not.toMatch(/<input|<form|<select|<textarea/u);
    expect(control).not.toMatch(/birth|date|time|place|lat|lon/iu);
  });
});
