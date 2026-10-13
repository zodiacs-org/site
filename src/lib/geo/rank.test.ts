import { describe, expect, it } from 'vitest';
import { fold, foldedQuery, rankCities, shardKey, type CityIndex, type Row } from './rank';

describe('the birthplace search ranking', () => {
  it('folds accents and the letters NFD leaves whole to the ASCII spelling the index is sharded by', () => {
    expect(fold('Łódź')).toBe('lodz');
    expect(fold('Ørsta')).toBe('orsta');
    expect(fold('Þorlákshöfn')).toBe('thorlakshofn');
    expect(fold('Großbeeren')).toBe('grossbeeren');
    expect(fold('Đà Nẵng')).toBe('da nang');
    expect(fold('İstanbul')).toBe('istanbul');
    expect(fold('Ærøskøbing')).toBe('aeroskobing');
    expect(shardKey(foldedQuery('Łódź') ?? '')).toBe('l');
  });

  it("finds a place by its native spelling in the shard of its ASCII name's first letter", () => {
    const index: CityIndex = { tz: ['Europe/Warsaw'], admin1: ['Łódź Voivodeship'], countries: ['PL'], shards: ['l'] };
    const rows: Row[] = [['Lublin', 0, 0, 0, 5125, 2257, 0, 339850], ['Łódź', 'Lodz', 0, 0, 5175, 1947, 0, 768755]];
    expect(rankCities(index, rows, foldedQuery('Łódź') ?? '', 8).map((city) => city.name)).toEqual(['Łódź']);
  });
});
