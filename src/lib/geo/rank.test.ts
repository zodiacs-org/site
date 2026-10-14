import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { byPopulation, fold, foldedQuery, rankCities, shardKey, shardKeys, type CityIndex, type Row } from './rank';

const cities = new URL('../../../public/data/cities/', import.meta.url);
const shards: Record<string, Row[]> = Object.fromEntries(readdirSync(cities).filter((file) => /^[0a-z]\.json$/u.test(file))
  .map((file) => [file[0], JSON.parse(readFileSync(new URL(file, cities), 'utf8'))]));
const names = (row: Row) => (row[1] === 0 ? [row[0]] : [row[0], row[1]]);
// Two places whose GeoNames name and ASCII name are different names: each is found by its ASCII one.
const DIFFERENT_NAMES = ['Donostia / San Sebastián', 'Hondarribia'];

describe('the birthplace search ranking', () => {
  it('folds accents, letter case, apostrophes, dashes and the letters NFD leaves whole', () => {
    expect(fold('Łódź')).toBe('lodz');
    expect(fold('Ørsta')).toBe('orsta');
    expect(fold('Þorlákshöfn')).toBe('thorlakshofn');
    expect(fold('Großbeeren')).toBe('grossbeeren');
    expect(fold('Đà Nẵng')).toBe('da nang');
    expect(fold('İstanbul')).toBe('istanbul');
    expect(fold('Ærøskøbing')).toBe('aeroskobing');
    expect(fold('Əhmədbəyli')).toBe('ahmadbayli');
    expect(fold('Arkhangel’sk')).toBe('arkhangelsk');
    expect(fold("Arkhangel'sk")).toBe('arkhangelsk');
    expect(fold('‘Ibrī')).toBe('ibri');
    expect(fold('ʻEwa Gentry')).toBe('ewa gentry');
    expect(fold('Kamen’–na–Obi')).toBe('kamen-na-obi');
    expect(shardKey(foldedQuery('Łódź') ?? '')).toBe('l');
  });

  it('matches a place by its name or by its ASCII name', () => {
    const index: CityIndex = { tz: ['Europe/Zurich'], admin1: ['Zurich'], countries: ['Switzerland'], shards: ['z'] };
    const rows: Row[] = [['Zürich', 'Zuerich', 0, 0, 4737, 855, 0, 341730], ['Zug', 0, 0, 0, 4717, 852, 0, 23435]];
    for (const query of ['Zürich', 'Zurich', 'Zuerich', 'zür', 'ZUER']) {
      expect(rankCities(index, rows, foldedQuery(query) ?? '', 8).map((city) => city.name), query).toEqual(['Zürich']);
    }
    expect(rankCities(index, rows, foldedQuery('rich') ?? '', 8)).toEqual([]);
  });

  it("finds a place by its native spelling in the shard of its ASCII name's first letter", () => {
    const index: CityIndex = { tz: ['Europe/Warsaw'], admin1: ['Łódź Voivodeship'], countries: ['PL'], shards: ['l'] };
    const rows: Row[] = [['Lublin', 0, 0, 0, 5125, 2257, 0, 339850], ['Łódź', 'Lodz', 0, 0, 5175, 1947, 0, 768755]];
    expect(rankCities(index, rows, foldedQuery('Łódź') ?? '', 8).map((city) => city.name)).toEqual(['Łódź']);
  });

  it("matches names that contain the query only among those that begin with the query's first letter", () => {
    const index: CityIndex = { tz: ['America/New_York'], admin1: ['New York'], countries: ['US'], shards: ['n', 'y'] };
    const shardY: Row[] = [['Yonkers', 0, 0, 0, 4093, -7390, 0, 200370]];
    expect(rankCities(index, shardY, foldedQuery('york') ?? '', 8)).toEqual([]);
    // Rows read from another shard count only by a name that begins with the query's letter.
    const shardO: Row[] = [['Obour', 0, 0, 0, 3020, 3149, 0, 40000]];
    const shard0: Row[] = [['6th of October City', 0, 0, 0, 2997, 3093, 0, 185000]];
    expect(rankCities(index, byPopulation([shardO, shard0]), foldedQuery('october') ?? '', 8)).toEqual([]);
  });

  it('merges the rows of several shards by population, as each shard is ordered', () => {
    const a: Row[] = [['Aa', 0, 0, 0, 0, 0, 0, 900], ['Ab', 0, 0, 0, 0, 0, 0, 100]];
    const b: Row[] = [['Ba', 0, 0, 0, 0, 0, 0, 500], ['Bb', 0, 0, 0, 0, 0, 0, 100]];
    expect(byPopulation([a, b]).map((row) => row[0])).toEqual(['Aa', 'Ba', 'Ab', 'Bb']);
    expect(byPopulation([a])).toBe(a);
  });

  it('reads, for each first letter, every shard the index files names beginning with it under', () => {
    const filed = new Map<string, Set<string>>();
    const unreached: string[] = [];
    for (const [key, rows] of Object.entries(shards)) {
      for (const row of rows) {
        for (const name of names(row)) {
          if (!shardKeys(fold(name)).includes(key)) unreached.push(name);
          const first = shardKey(fold(name));
          if (first !== key && !DIFFERENT_NAMES.includes(name)) filed.set(first, (filed.get(first) ?? new Set()).add(key));
        }
      }
    }
    // Every place is reached by both of its names, but for the two whose names differ, reached by the ASCII one.
    expect(unreached.sort()).toEqual([...DIFFERENT_NAMES].sort());
    for (const letter of '0abcdefghijklmnopqrstuvwxyz') {
      expect(shardKeys(letter).slice(1).sort(), letter).toEqual([...(filed.get(letter) ?? [])].sort());
    }
  });
});
