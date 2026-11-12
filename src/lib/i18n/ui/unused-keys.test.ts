import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './en';

// A UI key that no source file names is a string translated into every
// catalog locale that no page shows. This test fails when a new key like that
// appears, so a key is either used or deliberately listed below.
//
// The scan is the one the i18n string coverage audit used (2026-11): every
// identifier-shaped token in the .ts/.tsx/.astro/.js/.mjs sources under src/,
// api/ and scripts/, leaving out the locale catalogs themselves and test
// files. A key counts as used when its name appears anywhere, so lookups
// through a typed value (`t(locale, tool.label)` with `label: 'navTools'`
// elsewhere) still count. Keys are typed `UiKey`, so a key name built at run
// time would need a cast; none exists today.

// The 56 keys unused on main when this test was added. They are kept, not
// deleted: removing a key is a catalog change (and moves the 453-key count
// tests in index.test.ts and ru.test.ts) for its own pull request. The list
// only shrinks. Using one of these keys again, or deleting it from the
// catalogs, fails the test until its line is removed here.
const KNOWN_UNUSED_KEYS = [
  'activeTransitWithin',
  'activeTransitsWithin',
  'addAnotherChart',
  'chartLinkCopied',
  'chartPlural',
  'chartSavedMessage',
  'chartSavedStatus',
  'chartSingular',
  'copyChartLink',
  'crossChartAspects',
  'emptyProfile',
  'firstReadingFullTour',
  'firstReadingReplay',
  'footerArchive',
  'footerCollectNote',
  'footerMethodology',
  'footerThesis',
  'inviteCompare',
  'inviteLink',
  'inviteNamedNote',
  'inviteWith',
  'linkToChart',
  'natalPlanet',
  'navMenu',
  'noTransitTimeNotice',
  'noTransitsWithin',
  'nothingSaved',
  'ofExact',
  'pfdComing',
  'pfdSaturnBusy',
  'pfdWindows',
  'planetReturn',
  'quietSky',
  'readAspects',
  'readBigThree',
  'readBigThreeBody',
  'readInOrder',
  'readIntro',
  'readNoHouses',
  'readPairing',
  'readRooms',
  'readWeather',
  'recordChartBody',
  'recordChartLink',
  'recordChartSun',
  'savedChartPlural',
  'savedChartSingular',
  'storedBrowser',
  'syncedWhenSignedIn',
  'tourStart',
  'transitMiddayUtc',
  'transitMoonOmitted',
  'trustGamesIndependent',
  'weeklyDigestCopy',
  'weeklyDigestTitle',
  'welcomeBack',
] as const;

const ROOT = resolve(process.cwd());
const SCAN_ROOTS = ['src', 'api', 'scripts'];
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', '.astro', 'dist']);
const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|astro|js|jsx|mjs|cjs)$/;
const TEST_FILE = /\.(?:test|spec)\.[^.]+$/;
// The catalogs and the growth strings they spread. The lookup modules beside
// them (client.ts, server.ts, schema.ts) are scanned like any other source.
const CATALOG_FILE = /^src\/lib\/i18n\/ui\/(?:en|es|fr|it|pt|ru|zh-hans|zh-hant|growth)\.ts$/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return SKIP_DIRECTORIES.has(entry.name) ? [] : sourceFiles(path);
    if (!SOURCE_FILE.test(entry.name) || TEST_FILE.test(entry.name)) return [];
    return CATALOG_FILE.test(relative(ROOT, path).split('\\').join('/')) ? [] : [path];
  });
}

const keys = Object.keys(en);

function scan() {
  const files = SCAN_ROOTS.flatMap((root) => sourceFiles(join(ROOT, root)));
  const keySet = new Set(keys);
  const tokens = new Set<string>();
  let mostKeysInOneFile = { file: '', count: 0 };
  for (const file of files) {
    const fileKeys = new Set<string>();
    for (const [token] of readFileSync(file, 'utf8').matchAll(/[A-Za-z_$][\w$]*/g)) {
      tokens.add(token);
      if (keySet.has(token)) fileKeys.add(token);
    }
    if (fileKeys.size > mostKeysInOneFile.count) {
      mostKeysInOneFile = { file: relative(ROOT, file), count: fileKeys.size };
    }
  }
  return {
    files,
    mostKeysInOneFile,
    unused: keys.filter((key) => !tokens.has(key)).sort(),
  };
}

describe('UI catalog keys', () => {
  const { files, mostKeysInOneFile, unused } = scan();
  const known = new Set<string>(KNOWN_UNUSED_KEYS);

  it('scans the site sources and finds no copy of a whole catalog outside the catalogs', () => {
    expect(files.length).toBeGreaterThan(1000);
    // A generated bundle or a moved catalog that names every key would make
    // every key look used. No real reader comes near half the catalog.
    expect(
      mostKeysInOneFile.count,
      `${mostKeysInOneFile.file} names ${mostKeysInOneFile.count} of ${keys.length} UI keys; if it is a catalog copy, leave it out of this scan`,
    ).toBeLessThan(keys.length / 2);
  });

  it('has no unused key beyond the known list', () => {
    const unexpected = unused.filter((key) => !known.has(key));
    expect(
      unexpected,
      'These UI keys are named nowhere outside the catalogs. Use them, remove them from every catalog, or (only if a reader really builds the name at run time) add them to KNOWN_UNUSED_KEYS.',
    ).toEqual([]);
  });

  it('keeps the known list exact: every entry is still a catalog key and still unused', () => {
    expect(new Set(KNOWN_UNUSED_KEYS).size, 'duplicate entry in KNOWN_UNUSED_KEYS').toBe(KNOWN_UNUSED_KEYS.length);
    expect([...KNOWN_UNUSED_KEYS].sort(), 'KNOWN_UNUSED_KEYS stays sorted').toEqual([...KNOWN_UNUSED_KEYS]);
    const missing = KNOWN_UNUSED_KEYS.filter((key) => !(key in en));
    expect(missing, 'Deleted from the catalogs: remove these from KNOWN_UNUSED_KEYS').toEqual([]);
    const nowUsed = KNOWN_UNUSED_KEYS.filter((key) => !unused.includes(key));
    expect(nowUsed, 'Now used by a source file: remove these from KNOWN_UNUSED_KEYS').toEqual([]);
  });
});
