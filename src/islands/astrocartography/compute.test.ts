import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ZONE_PER_HISTORY_FILE } from '../../lib/time/every-zone-history';
import { computeAstrocartography } from './compute';

/*
 * The page's downloads say nothing about the birth: before it reads the birthplace clock, the calculation asks for
 * every zone history file the engine ships, so a birth after 1970 (which needs none) and one before it (which needs
 * its zone's file) make the same requests. tests/personal-pages-drive.mjs checks the requests in a browser.
 */
describe('computeAstrocartography', () => {
  it('loads every zone history file for a birth after 1970 too, before it reads the clock', async () => {
    const geo = await import('@zodiacs/engine/geo');
    const at1900 = (zone: string) => () => geo.zoneOffsetAt(zone, Date.UTC(1900, 0, 1));
    for (const zone of ZONE_PER_HISTORY_FILE) expect(at1900(zone), zone).toThrow(geo.ZoneHistoryNotLoadedError);
    await computeAstrocartography({ birthDate: '1990-05-03', birthTime: '08:30', place: { tz: 'Europe/London', lon: -0.13 } });
    // A birth in London in 1990 needs no history, yet every file is in, each zone named for its file reading it.
    for (const zone of ZONE_PER_HISTORY_FILE) expect(at1900(zone), zone).not.toThrow();
  });

  it('waits for the whole set before it prepares the birth\'s own date and zone', () => {
    const source = readFileSync(new URL('./compute.ts', import.meta.url), 'utf8');
    const body = source.slice(source.indexOf('export async function computeAstrocartography'));
    expect(body).toMatch(/await prepareEveryZoneHistory\(\);\s*\n\s*await prepareLocalTime\(input\.birthDate, input\.place\.tz\);/u);
  });
});
