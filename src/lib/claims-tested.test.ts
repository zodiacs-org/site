import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import data from '../data/claims-tested.json';
import { CLAIM_VERDICTS, claimEntry, claimTally, claimsTested, claimsTestedEntries, tallyLine } from './claims-tested';
import { OG_EN } from '../strings/seo.en.mjs';

const root = new URL('../../', import.meta.url);
const text = JSON.stringify(data);
const MARKET_WORDS = /\b(?:market|markets|stock|stocks|token|tokens|crypto|bitcoin|binance|exchange|price|trading|invest\w*)\b/iu;
const SURNAMES = /Saylor|Zhao|Huang|Musk|MSCI/u;
// Exact phrases in a cited file where a listed word has its plain meaning, not a market one. Each is named here,
// so any other use still fails. The accuracy audit report counts text tokens its output guard matched.
const PLAIN_USES: Record<string, string[]> = {
  'docs/accuracy-audit-2026-11/REPORT.md': ['flagged 5 tokens, which matched by coincidence: dates and digits'],
};

describe('Astrology claims, tested', () => {
  it('holds its schema, with unique ids, an empty prediction section and two calculation checks', () => {
    expect(claimsTested.safeParse(data).success).toBe(true);
    const { prediction, calculation } = claimsTestedEntries();
    expect(prediction).toEqual([]);
    expect(calculation.map((entry) => entry.id)).toEqual(['returns-worked-examples', 'nasa-event-times']);
    expect(data.entries.map((entry) => entry.id).sort()).toEqual(['nasa-event-times', 'returns-worked-examples']);
    expect(() => claimsTestedEntries({ ...data, entries: [...data.entries, data.entries[0]] })).toThrow('duplicate id');
    expect(Object.keys(CLAIM_VERDICTS)).toContain('failed');
  });

  it('cites a file on main or a page on zodiacs.org, never a pull request', () => {
    const entry = data.entries[0];
    expect(claimEntry.safeParse({ ...entry, source: { ...entry.source, url: 'https://github.com/zodiacs-org/site/pull/933' } }).success).toBe(false);
    expect(claimEntry.safeParse({ ...entry, source: { ...entry.source, url: 'https://zodiacs.org/claims-tested/' } }).success).toBe(true);
    for (const item of data.entries) {
      expect(item.source.url, item.id).toMatch(/^https:\/\/(?:github\.com\/zodiacs-org\/site\/blob\/main\/|zodiacs\.org\/)/u);
    }
  });

  it('every file on main it cites exists here and carries no market words or living person\'s name', () => {
    for (const entry of data.entries) {
      const blob = entry.source.url.match(/\/blob\/main\/(.+)$/u)?.[1];
      if (!blob) continue;
      const file = new URL(blob, root);
      expect(existsSync(file), blob).toBe(true);
      let body = readFileSync(file, 'utf8');
      for (const phrase of PLAIN_USES[blob] ?? []) {
        expect(body, `${blob}: ${phrase}`).toContain(phrase);
        body = body.replace(phrase, '');
      }
      expect(body, blob).not.toMatch(MARKET_WORDS);
      expect(body, blob).not.toMatch(SURNAMES);
    }
  });

  it('keeps every verdict in exactly one tally, so the tallies add up', () => {
    const mixed = { ...data.entries[0], id: 'a-mixed-prediction', kind: 'prediction', verdict: 'mixed' };
    const { prediction, calculation } = claimsTestedEntries({ ...data, entries: [...data.entries, mixed] });
    for (const entries of [prediction, calculation]) {
      const tally = claimTally(entries);
      expect(tally.held + tally.not + tally.other).toBe(entries.length);
    }
    expect(claimTally(prediction)).toEqual({ n: 1, held: 0, not: 0, other: 1 });
    expect(tallyLine('prediction', claimTally(prediction))).toBe('Prediction tests: 1. Held up: 0. Mixed or still running: 1.');
    expect(tallyLine('prediction', claimTally([]))).toBe('Prediction tests: none yet. Held up: 0.');
    expect(tallyLine('calculation', claimTally(calculation))).toBe('Calculation checks: 2. Held up: 2.');
    const all = Object.keys(CLAIM_VERDICTS).map((verdict, index) => ({ ...data.entries[0], id: `v${index}`, verdict }));
    const tally = claimTally(claimsTested.parse({ ...data, entries: all }).entries);
    expect(tally).toEqual({ n: 6, held: 2, not: 2, other: 2 });
  });

  it('carries no market, token or crypto language and no living person\'s name, and no dashes', () => {
    expect(text).not.toMatch(MARKET_WORDS);
    expect(text).not.toMatch(SURNAMES);
    expect(text).not.toMatch(/[–—]/u);
  });

  it('stays noindex and off unless its switch is on, and out of the sitemap', () => {
    const page = readFileSync(new URL('src/pages/claims-tested/index.astro', root), 'utf8');
    expect(page).toMatch(/<Base\s+noindex/u);
    expect(page).toContain("PUBLIC_CLAIMS_TESTED_ENABLED) === '1'");
    expect(readFileSync(new URL('src/pages/sitemap.xml.ts', root), 'utf8')).not.toContain('/claims-tested/');
  });

  it('has its own share card, with the two kinds counted apart and matching the data', () => {
    const card = OG_EN.claimsTested;
    const { prediction, calculation } = claimsTestedEntries();
    expect(card.image).toBe('/assets/og/claims-tested/v1/card.jpg');
    expect(card.rows).toHaveLength(2);
    const [predicts, sky] = card.rows;
    expect(predicts).toContain('predict');
    // The card says there is no prediction test only while the data has none.
    expect(prediction).toHaveLength(0);
    expect(predicts).toBe('Does the reading predict? No test to report yet');
    expect(sky).toBe(`Is the sky right? ${claimTally(calculation).held} checks passed`);
    expect(claimTally(calculation).held).toBe(calculation.length);
    expect(sky).toContain(String(calculation.length));
    for (const row of card.rows) {
      expect(row).not.toMatch(/At chance/iu);
      expect(row).not.toContain('3');
    }
    for (const words of [card.title, card.line, card.alt, ...card.rows]) expect(words).not.toMatch(/[–—]|token|market|crypto|at chance/iu);
  });
});
