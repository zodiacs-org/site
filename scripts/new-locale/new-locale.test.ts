import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LOCALES } from '../../src/lib/i18n/core';
import en from '../../src/lib/i18n/ui/en';
import { CANDIDATE_CODES, LOCALE_CANDIDATES } from '../../src/lib/locale-candidates/candidates.mjs';
import publication from '../../src/data/locale-expansion-publication.json';
import { scaffoldFiles } from './scaffold';
import { fontCoverage } from './font-coverage.mjs';

describe('new locale candidates', () => {
  it('are prepared but not published anywhere', () => {
    for (const code of CANDIDATE_CODES) {
      expect(LOCALES as readonly string[]).not.toContain(code);
      expect(Object.keys(publication.entries)).not.toContain(code);
    }
    const hreflang = readFileSync('scripts/i18n-hreflang-policy.mjs', 'utf8');
    for (const { hreflang: tag } of LOCALE_CANDIDATES) expect(hreflang).not.toMatch(new RegExp(`hreflang: '${tag}'`));
  });

  it('scaffold a full catalog skeleton, a glossary, a copy deck and a checklist, with no dashes', () => {
    for (const code of CANDIDATE_CODES) {
      const files = scaffoldFiles(code);
      expect(Object.keys(files).sort()).toEqual(['CHECKLIST.md', 'COPY-DECK.md', 'catalog.json', 'glossary.json']);
      expect(Object.keys(JSON.parse(files['catalog.json']))).toEqual(Object.keys(en));
      expect(Object.keys(JSON.parse(files['glossary.json']).signs)).toHaveLength(12);
      for (const name of ['COPY-DECK.md', 'CHECKLIST.md']) expect(files[name]).not.toMatch(/[‒-―]/u);
    }
  });

  it('know which candidates the self-hosted fonts already draw', () => {
    const coverage = fontCoverage();
    expect(coverage.de.covered).toBe(true);
    for (const code of ['pl', 'tr', 'ja', 'hi']) expect(coverage[code].covered).toBe(false);
  });
});
