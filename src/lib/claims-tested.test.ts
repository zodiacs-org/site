import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import data from '../data/claims-tested.json';
import { CLAIM_VERDICTS, claimsTested, claimsTestedEntries } from './claims-tested';
import { OG_EN } from '../strings/seo.en.mjs';

const root = new URL('../../', import.meta.url);
const text = JSON.stringify(data);

describe('Astrology claims, tested', () => {
  it('holds its schema, with unique ids and both kinds', () => {
    expect(claimsTested.safeParse(data).success).toBe(true);
    const { prediction, calculation } = claimsTestedEntries();
    expect(prediction.length).toBeGreaterThan(0);
    expect(calculation.length).toBeGreaterThan(0);
    expect(() => claimsTestedEntries({ ...data, entries: [...data.entries, data.entries[0]] })).toThrow('duplicate id');
  });

  it('keeps results at chance on the page', () => {
    expect(data.entries.find((entry) => entry.id === 'year-ahead-score-backtest')).toMatchObject({ verdict: 'at-chance', kind: 'prediction' });
    expect(data.entries.find((entry) => entry.id === 'year-ahead-score-backtest')!.result).toContain('1 of 3');
    expect(Object.keys(CLAIM_VERDICTS)).toContain('failed');
  });

  it('cites evidence in this repository or its pull requests, and every file it names exists', () => {
    for (const entry of data.entries) {
      expect(entry.source.url, entry.id).toMatch(/^https:\/\/github\.com\/zodiacs-org\/site\/(?:pull\/\d+|blob\/main\/)/u);
      const blob = entry.source.url.match(/\/blob\/main\/(.+)$/u)?.[1];
      if (blob) expect(existsSync(new URL(blob, root)), blob).toBe(true);
    }
  });

  it('carries no market, token or crypto language and no living person\'s name, and no dashes', () => {
    expect(text).not.toMatch(/\b(?:market|markets|stock|stocks|token|tokens|crypto|bitcoin|binance|exchange|price|trading|invest\w*)\b/iu);
    expect(text).not.toMatch(/Saylor|Zhao|Huang|Musk|MSCI/u);
    expect(text).not.toMatch(/[–—]/u);
  });

  it('stays noindex and off unless its switch is on, and out of the sitemap', () => {
    const page = readFileSync(new URL('src/pages/claims-tested/index.astro', root), 'utf8');
    expect(page).toMatch(/<Base\s+noindex/u);
    expect(page).toContain("PUBLIC_CLAIMS_TESTED_ENABLED) === '1'");
    expect(readFileSync(new URL('src/pages/sitemap.xml.ts', root), 'utf8')).not.toContain('/claims-tested/');
  });

  it('has its own share card, in plain words', () => {
    const card = OG_EN.claimsTested;
    expect(card.image).toBe('/assets/og/claims-tested/v1/card.jpg');
    expect(card.rows).toEqual(['Passed', 'Passed after a correction', 'At chance'].map((row) => row));
    for (const row of card.rows) expect(Object.values(CLAIM_VERDICTS)).toContain(row);
    for (const words of [card.title, card.line, card.alt]) expect(words).not.toMatch(/[–—]|token|market|crypto/iu);
  });
});
