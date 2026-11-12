import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// A local parser: importing build-keywords.mjs would run it and rewrite the files.
function parseLine(line) {
  const out = []; let cur = ''; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') quoted = false; else cur += ch; }
    else if (ch === '"') quoted = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

const read = (locale) => readFileSync(`docs/visibility/keywords/${locale}.csv`, 'utf8').trim().split('\n').slice(1).map(parseLine);
const LOCALES = ['en', 'es', 'pt', 'fr', 'it', 'ru', 'zh-hans', 'zh-hant', 'ar', 'de', 'pl', 'tr', 'ja', 'hi'];
const CANDIDATES = ['de', 'pl', 'tr', 'ja', 'hi'];

describe('keyword tables', () => {
  it('hold every target locale, the five candidates included', () => {
    for (const locale of LOCALES) expect(read(locale), locale).toHaveLength(296);
  });

  it('never invent a volume: a number needs a named source', () => {
    for (const locale of LOCALES) {
      for (const row of read(locale)) {
        const [volume, source, competition] = row.slice(8, 11);
        if (volume !== 'TBD' || competition !== 'TBD') expect(source, `${locale} ${row[5]}`).not.toBe('TBD');
        // A Keyword Planner range is kept as low-high (lib.mjs parseVolume).
        if (volume !== 'TBD') expect(volume, `${locale} ${row[5]}`).toMatch(/^\d+(-\d+)?$/);
      }
    }
  });

  it('list each query once per locale, with no dashes', () => {
    for (const locale of LOCALES) {
      const queries = read(locale).map((row) => row[5]);
      expect(new Set(queries).size, locale).toBe(queries.length);
      for (const query of queries) expect(query).not.toMatch(/[‒-―]/u);
    }
  });

  it('send each candidate chart query to the calculator that answers it', () => {
    const target = (locale, query) => read(locale).find((row) => row[5] === query)?.[6];
    expect(target('de', 'aszendent berechnen')).toBe('/rising-sign/');
    expect(target('de', 'mondzeichen')).toBe('/moon-sign/');
    expect(target('de', 'sonne mond aszendent')).toBe('/big-three/');
    expect(target('de', 'geburtshoroskop deuten')).toBe('/learn/how-to-read-a-birth-chart/');
    expect(target('pl', 'słońce księżyc ascendent')).toBe('/big-three/');
    expect(target('pl', 'znak księżyca')).toBe('/moon-sign/');
    expect(target('pl', 'jak czytać horoskop urodzeniowy')).toBe('/learn/how-to-read-a-birth-chart/');
    expect(target('tr', 'yükselen burç')).toBe('/rising-sign/');
    expect(target('tr', 'ay burcu hesaplama')).toBe('/moon-sign/');
    expect(target('tr', 'güneş ay yükselen')).toBe('/big-three/');
    expect(target('ja', 'アセンダント')).toBe('/rising-sign/');
    expect(target('ja', '月星座 調べ方')).toBe('/moon-sign/');
    expect(target('ja', '月星座 太陽星座')).toBe('/big-three/');
    expect(target('hi', 'लग्न राशि')).toBe('/rising-sign/');
    expect(target('hi', 'चंद्र राशि')).toBe('/moon-sign/');
    expect(target('hi', 'कुंडली कैसे देखें')).toBe('/learn/how-to-read-a-birth-chart/');
    for (const locale of CANDIDATES) expect(target(locale, read(locale).find((row) => row[3] === 'birth-chart')[5])).toBe('/birth-chart/');
  });

  it('mark candidates as unpublished and held pages with the URL they will have', () => {
    for (const locale of CANDIDATES) {
      for (const row of read(locale)) {
        expect(row[7], `${locale} ${row[5]}`).toBe('partial');
        expect(row[6].startsWith(`/${locale}/`)).toBe(false);
        expect(row[11]).toMatch(/candidate locale/);
      }
    }
    const held = read('es').filter((row) => row[7] === 'held');
    expect(held.length).toBeGreaterThan(0);
    for (const row of held) expect(row[6].startsWith('/es/')).toBe(true);
  });
});
