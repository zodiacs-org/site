import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import tzNames from '../../data/tz-names.json';
import { ZONE_PER_HISTORY_FILE, prepareEveryZoneHistory } from './every-zone-history';

/** The engine's own choice of history file for a zone: FNV-1a over the lower-cased name, modulo the file count. */
function nameHash(name: string): number {
  let hash = 2166136261;
  for (const char of name.toLowerCase()) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
const engineDist = resolve(process.cwd(), 'node_modules/@zodiacs/engine/dist');
const historyFiles = readdirSync(engineDist).filter((name) => /^tzdb-\d{4}[a-z]-\d{2}-[A-Z0-9]+\.js$/u.test(name));
/** The engine module that picks a zone's history file. */
const picker = readdirSync(engineDist).filter((name) => name.endsWith('.js')).map((name) => readFileSync(resolve(engineDist, name), 'utf8'))
  .find((text) => text.includes('function loadHistory('))!;
const FIXED = /^(?:etc\/)?(?:utc|uct|gmt|gmt0|gmt[+-]0|greenwich|universal|zulu)$|^etc\/gmt[+-]\d{1,2}$/iu;
const intlAccepts = (zone: string) => { try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; } catch { return false; } };
const zones = (tzNames as { names: string[] }).names.filter((zone) => !FIXED.test(zone) && intlAccepts(zone));

describe('prepareEveryZoneHistory', () => {
  it('names one zone in each of the engine\'s history files, in file order', () => {
    // The engine picks the file as this test does: FNV-1a over the lower-cased name, modulo the sixteen loaders.
    expect(picker).toMatch(/const bucket = nameHash\(timeZone\) % SHARD_LOADERS\.length;/u);
    expect(picker).toMatch(/let hash = 2166136261;[\s\S]{0,160}Math\.imul\(hash, 16777619\) >>> 0/u);
    expect(picker.match(/\(\) => import\("\.\/tzdb-/gu)).toHaveLength(16);
    expect(historyFiles).toHaveLength(16);
    expect(ZONE_PER_HISTORY_FILE).toHaveLength(historyFiles.length);
    ZONE_PER_HISTORY_FILE.forEach((zone, index) => expect(nameHash(zone) % historyFiles.length, zone).toBe(index));
  });

  it('downloads every history file, so preparing any zone afterwards downloads nothing more', async () => {
    const geo = await import('@zodiacs/engine/geo');
    const at1900 = (zone: string) => () => geo.zoneOffsetAt(zone, Date.UTC(1900, 0, 1));
    // Nothing is loaded before.
    for (const zone of ZONE_PER_HISTORY_FILE) expect(at1900(zone), zone).toThrow(geo.ZoneHistoryNotLoadedError);
    await prepareEveryZoneHistory();
    // Each file is in: the zone named for it reads its history.
    for (const zone of ZONE_PER_HISTORY_FILE) expect(at1900(zone), zone).not.toThrow();
    // And every other zone's preparation is answered from those files.
    expect(zones.length).toBeGreaterThan(500);
    await Promise.all(zones.map((zone) => geo.prepareLocalTime('1900-01-01', zone)));
    expect(zones.filter((zone) => { try { at1900(zone)(); return false; } catch { return true; } })).toEqual([]);
  });
});
