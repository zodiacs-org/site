/**
 * The site's own technique code against @zodiacs/engine/techniques, in one
 * process, on one engine: the parity the P2.E units ask to be recorded before
 * the site's code is removed.
 *
 *   node docs/platform/evidence/site-engine-rc16/tools/compare-techniques.mjs <base commit> > techniques-parity.json
 *
 * Run from the repository root with rc.16 installed (`npm ci`). The site side
 * is the base commit's code, read from git objects (never the working tree):
 * `src/lib/` and `src/islands/aspect-patterns/`, bundled by the repository's
 * esbuild for Node with `@zodiacs/engine` and `astronomy-engine` left external.
 * The package side is the installed `@zodiacs/engine/techniques`. Both resolve
 * the one installed package, so they read the same ephemeris, the same
 * astronomy-engine instance and the same clock: a difference comes from the
 * port, not from the nutation or the time basis.
 *
 * The corpus is synthetic. Every input is drawn from mulberry32 seeded by the
 * 32-bit FNV-1a hash of "site-engine-rc16:<section>"; births are invented
 * instants and places, and the few real charts cast here are cast at those
 * invented instants. Its sections follow the engine's own parity corpus
 * (docs/evidence/techniques-2026-09-29/PREREGISTRATION.md in zodiacs-org/engine)
 * with a new seed, and add the shapes the site's pages produce: solar returns
 * near 12:00 UTC on a birthday, lunar returns after a reference instant, and
 * aspect patterns and composites of charts the site's own adapter casts.
 *
 * Every value is compared exactly: numbers with Object.is, instants by their
 * milliseconds, lists element by element in order, errors by class and
 * message. The package's API is read into the site's shapes only where the
 * two name the same thing differently (a sign index and a sign name, a status
 * object and a RangeError with the same reason); the mapping is written out in
 * `mapping` below. Every difference is given a cause from `CAUSES`; one that no
 * cause claims is listed under `unexplained`, which the record requires empty.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const [baseCommit] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/u.test(baseCommit ?? '')) {
  console.error('usage: compare-techniques.mjs <40-hex base commit>');
  process.exit(2);
}
const root = process.cwd();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 1 << 26 });
const DAY = 86_400_000;
const HOUR = 3_600_000;

/** The site files the comparison runs, from the base commit. */
const SITE_FILES = [
  'src/lib/engine/solar-return.ts', 'src/lib/engine/lunar-return.ts', 'src/lib/engine/returns.ts',
  'src/lib/engine/reference-span.ts', 'src/lib/engine/full.ts', 'src/lib/engine/chart-adapter.ts',
  'src/lib/engine/types.ts', 'src/lib/engine/aspects.ts', 'src/lib/engine/void-of-course.ts',
  'src/lib/engine/aspect-patterns.ts', 'src/lib/aspect-pattern-model.ts', 'src/lib/composite.ts',
  'src/lib/dignities.ts', 'src/lib/moon-certainty.ts', 'src/lib/chart-date-certainty.ts',
  'src/lib/share-card.ts', 'src/lib/share-positions-noon.ts', 'src/lib/signs.ts', 'src/lib/time/localToUtc.ts',
];

/** Why a result differs. Each difference is given one; none is left without. */
const CAUSES = {
  'returns-span':
    'The site clips its solar-return scans to 1800–2200 and refuses a return it cannot find inside, and limits a lunar '
    + 'return\'s reference to 1800-01-02 to 2199-11-21; the package searches without clipping and flags a result outside '
    + '1800–2200 instead (docs/techniques.md, "Differences from the site"). Where both find the same return, one from a '
    + 'clipped window, the crossing solver samples another grid and the instants can differ within its resolution, the '
    + 'step over 2^24 (about 5 ms at a 1-day step).',
  'returns-validation':
    'The site\'s lunar-return chart takes whole sign or Placidus and needs a birthplace; the package takes any house '
    + 'system and casts without houses when there is no place.',
  'moon-skipped-date':
    'A date the zone skipped: the site gives the two midnights it resolves and their signs, the package refuses the date.',
  'moon-before-1970':
    'Before 1970 the site reads a date\'s midnights on the host\'s Intl data and the package on its own tzdata 2025c '
    + 'with backzone; where the two histories differ, so do the midnights.',
  'moon-date-form':
    'The site\'s untimed Moon reads a date with Date.UTC, which maps years 0 to 99 into 1900 to 1999, and answers null; '
    + 'the package reads the year as written, and refuses one whose span lies before the ephemeris span.',
  'dignity-validation':
    'A name that is not one of the twelve bodies, or not a lowercase sign: the site answers null, [] or false, the '
    + 'package throws RangeError.',
  'pattern-order':
    'The site orders pattern ids and edge keys with localeCompare, which reads the host\'s locale; the package '
    + 'compares code units.',
  'composite-validation':
    'A list with a name that is not a body, or a body twice: the site takes it as given, the package throws RangeError.',
};

const work = mkdtempSync(join(tmpdir(), 'zodiacs-techniques-parity-'));
try {
  // ---- the site side: the base commit's code, bundled from git objects --------
  const site = join(work, 'site');
  mkdirSync(site, { recursive: true });
  execFileSync('sh', ['-c', `git archive ${baseCommit} src/lib src/islands/aspect-patterns | tar -x -C "${site}"`], { cwd: root });
  // untimedMoonSign lives in share-card.ts, whose other code draws on a canvas.
  // Its text, from `const HOUR_MS` to the export after `referenceInstant`, is
  // copied unchanged into a module of its own beside it.
  const shareCard = readFileSync(join(site, 'src/lib/share-card.ts'), 'utf8');
  const start = shareCard.indexOf('const HOUR_MS = 3_600_000;');
  const end = shareCard.indexOf('export const SHARE_CARD_SCALE');
  if (start < 0 || end < start) throw new Error('untimedMoonSign not found in share-card.ts');
  const untimedText = shareCard.slice(start, end);
  writeFileSync(join(site, 'src/lib/__untimed-moon-sign.ts'), `import { signForLongitude } from './signs';\n\n${untimedText}`);
  mkdirSync(join(work, 'node_modules/@zodiacs'), { recursive: true });
  symlinkSync(resolve(root, 'node_modules/@zodiacs/engine'), join(work, 'node_modules/@zodiacs/engine'), 'dir');
  symlinkSync(resolve(root, 'node_modules/astronomy-engine'), join(work, 'node_modules/astronomy-engine'), 'dir');
  const lib = (file) => JSON.stringify(`./site/src/lib/${file}`);
  writeFileSync(join(work, 'entry.ts'), [
    `export * as solar from ${lib('engine/solar-return.ts')};`,
    `export * as lunar from ${lib('engine/lunar-return.ts')};`,
    `export * as full from ${lib('engine/full.ts')};`,
    `export * as aspects from ${lib('engine/aspects.ts')};`,
    `export * as composite from ${lib('composite.ts')};`,
    `export * as voc from ${lib('engine/void-of-course.ts')};`,
    `export * as patterns from ${lib('engine/aspect-patterns.ts')};`,
    `export * as patternModel from ${lib('aspect-pattern-model.ts')};`,
    `export * as dignities from ${lib('dignities.ts')};`,
    `export * as moon from ${lib('moon-certainty.ts')};`,
    `export * as dateCertainty from ${lib('chart-date-certainty.ts')};`,
    `export * as untimed from ${lib('__untimed-moon-sign.ts')};`,
    `export * as signs from ${lib('signs.ts')};`,
  ].join('\n'));
  await esbuild.build({
    entryPoints: [join(work, 'entry.ts')],
    outfile: join(work, 'site-bundle.mjs'),
    bundle: true, format: 'esm', platform: 'node', target: 'node22',
    external: ['@zodiacs/engine', '@zodiacs/engine/*', 'astronomy-engine'],
    define: { 'import.meta.env.SSR': 'true' },
    logLevel: 'error',
    plugins: [{
      // The site's resolver loads its birthplace clock (the local mean time
      // table and the pinned zone histories) only for a birthplace longitude,
      // which no input here passes; it stays out of the bundle.
      name: 'no-birthplace-clock',
      setup(build) {
        build.onResolve({ filter: /\/birthplace-clock$/ }, () => ({ path: 'birthplace-clock', namespace: 'stub' }));
        build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: "export {}; throw new Error('the birthplace clock is not part of this comparison');",
          loader: 'js',
        }));
      },
    }],
  });
  const S = await import(pathToFileURL(join(work, 'site-bundle.mjs')).href);
  // The package, from the same node_modules the bundle resolves.
  const P = await import(pathToFileURL(join(work, 'node_modules/@zodiacs/engine/dist/techniques.js')).href);
  // Before 1970 the package reads a date's midnights on the zone history it
  // ships, which prepareLocalTime loads first (its docs/techniques.md).
  const { prepareLocalTime } = await import(pathToFileURL(join(work, 'node_modules/@zodiacs/engine/dist/geo.js')).href);
  const engineVersion = JSON.parse(readFileSync(resolve(root, 'node_modules/@zodiacs/engine/package.json'), 'utf8')).version;

  // ---- the corpus -------------------------------------------------------------
  const fnv1a = (text) => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
  };
  const SEED_TEXT = 'site-engine-rc16';
  const stream = (name) => {
    let state = fnv1a(`${SEED_TEXT}:${name}`) >>> 0;
    const next = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const uniform = (low, high) => low + (high - low) * next();
    const integer = (low, high) => Math.floor(uniform(low, high + 1));
    const pick = (list) => list[integer(0, list.length - 1)];
    const shuffle = (list) => {
      const out = [...list];
      for (let index = out.length - 1; index > 0; index -= 1) {
        const other = integer(0, index);
        [out[index], out[other]] = [out[other], out[index]];
      }
      return out;
    };
    return { next, uniform, integer, pick, shuffle, instant: (low, high) => Math.floor(uniform(low, high)) };
  };
  const utc = (text) => Date.parse(text);
  const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);
  const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node'];
  const PATTERN_BODIES = BODIES.slice(0, 10);
  const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
  const place = (random) => ({ latitude: random.uniform(-66, 66), longitude: random.uniform(-180, 180) });
  const Y1801 = utc('1801-01-01T00:00:00Z');
  const Y1850 = utc('1850-01-01T00:00:00Z');
  const Y2150 = utc('2150-01-01T00:00:00Z');
  const Y2199 = utc('2199-01-01T00:00:00Z');
  const LUNAR_AFTER_MIN = utc('1800-01-02T00:00:00.000Z');
  const LUNAR_AFTER_MAX = utc('2199-11-21T23:59:59.999Z');
  const HOUSES = ['whole', 'placidus'];

  // ---- comparison ---------------------------------------------------------------
  const report = {
    schema: 'zodiacs-site-techniques-parity/v1',
    generatedAt: new Date().toISOString(),
    node: process.version,
    tz: process.versions.tz ?? null,
    icu: process.versions.icu ?? null,
    esbuild: esbuild.version,
    site: {
      sourceCommit: baseCommit,
      files: Object.fromEntries(SITE_FILES.map((file) => [file, sha256(git('cat-file', 'blob', `${baseCommit}:${file}`))])),
      untimedMoonSignExtract: sha256(untimedText),
    },
    package: {
      name: '@zodiacs/engine',
      version: engineVersion,
      entry: '@zodiacs/engine/techniques',
      techniquesJs: sha256(readFileSync(resolve(root, 'node_modules/@zodiacs/engine/dist/techniques.js'))),
    },
    seed: `mulberry32, seeded by FNV-1a of "${SEED_TEXT}:<section>"`,
    causes: CAUSES,
    mapping: {
      returns: 'Instants compared as milliseconds. A site chart is compared with the site adapter\'s chart at the package\'s instant (computeChart, as the site casts every chart) and, for the bodies, angles, cusps and aspects, with the package\'s own return chart.',
      voidOfCourse: 'The site\'s signIndex and nextSignIndex are compared with the package\'s sign and nextSign through the twelve sign names in order; its bodies arrays VOID_BODIES_MODERN and VOID_BODIES_TRADITIONAL with the package\'s "modern" and "traditional"; voidStatus with voidOfCourseAt.',
      aspectPatterns: 'The site\'s { status: "unavailable", reason } is compared with the package\'s RangeError: the reason with the error\'s message. A ready detection is compared field by field: points, then every pattern\'s id, kind, members, edges (a, b, type, orb, limit, key, sourceIds), oppositions and roles.',
      composite: 'Midpoints and aspects compared field by field in order.',
      dignities: 'dignityFor, dignitiesFor and hasClassicalDignities, value for value; a site null, [] or false against a package RangeError is a difference.',
      moonSign: 'untimedMoonSign(date) against moonSignCandidates(date).sign; moonCandidatesFromEndpoints of the two resolved midnights (localDateEndpointsUtc) against moonSignCandidates(date, { timeZone }): the midnights against from and to, the candidates against signs.',
    },
    sections: {},
    differences: [],
  };
  const found = [];
  let unit;
  let sectionName;
  const begin = (unitName, name, description) => {
    unit = unitName;
    sectionName = name;
    report.sections[name] = { unit: unitName, description, cases: 0, values: 0, agree: 0, differ: 0, causes: {} };
  };
  const outcome = (run) => {
    try {
      return { ok: true, value: run() };
    } catch (error) {
      return { ok: false, error: `${error?.constructor?.name ?? typeof error}: ${String(error?.message ?? error)}` };
    }
  };
  const flatten = (value, path, out) => {
    if (value instanceof Date) out.push([path, value.getTime()]);
    else if (Array.isArray(value)) {
      out.push([`${path}.length`, value.length]);
      value.forEach((item, index) => flatten(item, `${path}[${index}]`, out));
    } else if (value && typeof value === 'object') {
      for (const key of Object.keys(value).sort()) flatten(value[key], `${path}.${key}`, out);
    } else out.push([path, value]);
    return out;
  };
  /**
   * One case: both results, compared exactly. `cause` names the cause of a
   * difference given the inputs, or null where the two are meant to agree.
   */
  const compare = (label, input, siteResult, packageResult, cause) => {
    const section = report.sections[sectionName];
    section.cases += 1;
    const a = new Map(flatten(siteResult, label, []));
    const b = new Map(flatten(packageResult, label, []));
    const keys = [...new Set([...a.keys(), ...b.keys()])];
    let differs = 0;
    const firstPaths = [];
    for (const key of keys) {
      section.values += 1;
      if (!a.has(key) || !b.has(key) || !Object.is(a.get(key), b.get(key))) {
        differs += 1;
        if (firstPaths.length < 3) firstPaths.push({ path: key, site: a.has(key) ? a.get(key) : 'absent', package: b.has(key) ? b.get(key) : 'absent' });
      }
    }
    if (differs === 0) {
      section.agree += 1;
      return;
    }
    section.differ += 1;
    const assigned = cause ?? 'unexplained';
    section.causes[assigned] = (section.causes[assigned] ?? 0) + 1;
    found.push({ unit, section: sectionName, cause: assigned, label, input, differingValues: differs, first: firstPaths });
  };

  // ============================================================== returns
  const sunAt = (ms) => S.full.bodyLongitude('Sun', new Date(ms));
  const moonAt = (ms) => S.full.bodyLongitude('Moon', new Date(ms));
  const instantOf = (run) => {
    const result = outcome(run);
    return result.ok ? { instant: result.value.getTime() } : { error: result.error };
  };
  const inSpan = (ms) => ms >= utc('1800-01-01T00:00:00Z') && ms < utc('2200-01-01T00:00:00Z');
  const chartView = (chart) => chart && {
    utc: chart.input.utc.getTime(),
    bodies: chart.bodies.map((row) => [row.body, row.lon, row.lat, row.speed, row.retrograde]),
    angles: chart.angles && [chart.angles.asc, chart.angles.mc, chart.angles.dsc, chart.angles.ic],
    houses: chart.houses && [chart.houses.system, ...chart.houses.cusps],
    aspects: chart.aspects.map((row) => [row.a, row.b, row.type, row.orb, row.applying]),
    flags: [...chart.flags],
  };
  const chartOf = (run) => {
    const result = outcome(run);
    return result.ok ? chartView(result.value) : { error: result.error };
  };

  begin('returns', 'R-SI', 'solarReturnInstant(natal Sun, near): births 1850–2150, near 1801–2199');
  {
    const random = stream('R-SI');
    for (let index = 0; index < 400; index += 1) {
      const birth = random.instant(Y1850, Y2150);
      const near = random.instant(Y1801, Y2199);
      const lon = sunAt(birth);
      compare('solarReturnInstant', { birth: new Date(birth).toISOString(), near: new Date(near).toISOString() },
        instantOf(() => S.solar.solarReturnInstant(lon, new Date(near))),
        instantOf(() => P.solarReturnInstant(lon, new Date(near))), null);
    }
  }

  begin('returns', 'R-SY', 'solarReturnInstant at 12:00 UTC on the birthday of each year the page offers (1800–2199), as the solar-return page asks it');
  {
    const random = stream('R-SY');
    for (let index = 0; index < 400; index += 1) {
      const birth = random.instant(Y1850, Y2150);
      const birthDate = isoDate(birth);
      const year = random.integer(1800, 2199);
      const [, month, day] = birthDate.split('-').map(Number);
      const near = Date.UTC(year, month - 1, day, 12);
      if (new Date(near).getUTCDate() !== day) continue; // 29 February in a common year: the page's own Date.UTC rolls it on; skipped here
      const lon = sunAt(birth);
      const site = instantOf(() => S.solar.solarReturnInstant(lon, new Date(near)));
      const pkg = instantOf(() => P.solarReturnInstant(lon, new Date(near)));
      const edge = near - 200 * DAY < utc('1800-01-01T00:00:00Z') || near + 200 * DAY >= utc('2200-01-01T00:00:00Z');
      compare('solarReturnInstant', { birth: new Date(birth).toISOString(), year }, site, pkg, edge ? 'returns-span' : null);
    }
  }

  begin('returns', 'R-SM', 'mostRecentSolarReturnInstant(natal Sun, at): births 1850–2150, at 1801–2199');
  {
    const random = stream('R-SM');
    for (let index = 0; index < 400; index += 1) {
      const birth = random.instant(Y1850, Y2150);
      const at = random.instant(Y1801, Y2199);
      const lon = sunAt(birth);
      compare('mostRecentSolarReturnInstant', { birth: new Date(birth).toISOString(), at: new Date(at).toISOString() },
        instantOf(() => S.solar.mostRecentSolarReturnInstant(lon, new Date(at))),
        instantOf(() => P.mostRecentSolarReturnInstant(lon, new Date(at))), null);
    }
  }

  begin('returns', 'R-SC', 'solarReturnChart against the site adapter at the package\'s instant, and against the package\'s solarReturn chart: no place, the natal place or another; whole sign or Placidus; nearest or most recent');
  {
    const random = stream('R-SC');
    for (let index = 0; index < 80; index += 1) {
      const birth = random.instant(Y1850, Y2150);
      const natal = place(random);
      const houseSystem = HOUSES[index % 2];
      const near = random.instant(Y1801, Y2199);
      const cast = [null, natal, place(random)][index % 3];
      const selection = Math.floor(index / 2) % 2 === 0 ? 'nearest' : 'most-recent';
      const lon = sunAt(birth);
      const input = { birth: new Date(birth).toISOString(), ...natal, houseSystem, near: new Date(near).toISOString(), cast, selection };
      const siteChart = chartOf(() => S.solar.solarReturnChart(lon, new Date(near), cast, houseSystem, selection));
      const instant = instantOf(() => (selection === 'most-recent' ? P.mostRecentSolarReturnInstant : P.solarReturnInstant)(lon, new Date(near)));
      compare('solarReturnChart', input, siteChart,
        'error' in instant ? instant : chartView(S.full.computeChart({ utc: new Date(instant.instant), ...(cast ?? {}), houseSystem, timeKnown: true })), null);
      // The package's own return chart: the same instant, cast by natalChart.
      const packageReturn = outcome(() => P.solarReturn({ utc: new Date(birth), ...natal, houseSystem, timeKnown: true }, new Date(near),
        { selection, location: cast, houseSystem }));
      const own = packageReturn.ok ? chartView(packageReturn.value.chart) : { error: packageReturn.error };
      const strip = (view) => (view && !('error' in view) ? { ...view, flags: view.flags.filter((flag) => flag !== 'outside-reference-span') } : view);
      compare('solarReturn.chart', input, strip(siteChart), strip(own), null);
    }
  }

  begin('returns', 'R-LI', 'lunarReturnInstant(natal Moon, after): births 1850–2150, after 1800-01-02 to 2199-11-21');
  {
    const random = stream('R-LI');
    for (let index = 0; index < 400; index += 1) {
      const birth = random.instant(Y1850, Y2150);
      const after = random.instant(LUNAR_AFTER_MIN, LUNAR_AFTER_MAX + 1);
      const lon = moonAt(birth);
      compare('lunarReturnInstant', { birth: new Date(birth).toISOString(), after: new Date(after).toISOString() },
        instantOf(() => S.lunar.lunarReturnInstant(lon, new Date(after))),
        instantOf(() => P.lunarReturnInstant(lon, new Date(after))), null);
    }
  }

  begin('returns', 'R-LC', 'lunarReturnChart against the site adapter at the package\'s instant, and against the package\'s lunarReturn chart: the natal place or another, whole sign or Placidus');
  {
    const random = stream('R-LC');
    for (let index = 0; index < 80; index += 1) {
      const birth = random.instant(Y1850, Y2150);
      const natal = place(random);
      const houseSystem = HOUSES[index % 2];
      const after = random.instant(birth, LUNAR_AFTER_MAX + 1);
      const cast = index % 2 === 0 ? null : place(random);
      const input = { birth: new Date(birth).toISOString(), ...natal, houseSystem, after: new Date(after).toISOString(), cast };
      const birthInput = { utc: new Date(birth), ...natal, houseSystem, timeKnown: true };
      const siteChart = chartOf(() => S.lunar.lunarReturnChart(birthInput, new Date(after), cast ?? undefined));
      const instant = instantOf(() => P.lunarReturnInstant(moonAt(birth), new Date(after)));
      compare('lunarReturnChart', input, siteChart,
        'error' in instant ? instant : chartView(S.full.computeChart({ utc: new Date(instant.instant), ...(cast ?? natal), houseSystem, timeKnown: true })), null);
      const packageReturn = outcome(() => P.lunarReturn(birthInput, new Date(after), { location: cast ?? natal, houseSystem }));
      const own = packageReturn.ok ? chartView(packageReturn.value.chart) : { error: packageReturn.error };
      compare('lunarReturn.chart', input, siteChart, own, null);
    }
  }

  begin('returns', 'R-E', 'windows that reach outside 1800–2200, where the site clips or refuses (recorded, not required to agree)');
  {
    const random = stream('R-E');
    const rows = [];
    for (let index = 0; index < 60; index += 1) {
      const which = ['solarReturnInstant', 'mostRecentSolarReturnInstant', 'lunarReturnInstant', 'lunarReturnChart'][index % 4];
      const early = Math.floor(index / 4) % 2 === 0;
      const birth = random.instant(Y1850, Y2150);
      const windows = {
        solarReturnInstant: early ? ['1799-06-15', '1800-07-20'] : ['2199-06-15', '2200-07-20'],
        mostRecentSolarReturnInstant: early ? ['1800-01-01', '1801-01-06'] : ['2199-12-01', '2200-12-31'],
        lunarReturnInstant: early ? ['1799-12-01', '1800-01-02'] : ['2199-11-22', '2200-01-31'],
        lunarReturnChart: early ? ['1799-12-01', '1800-01-02'] : ['2199-11-22', '2200-01-31'],
      }[which];
      const date = random.instant(utc(`${windows[0]}T00:00:00Z`), utc(`${windows[1]}T00:00:00Z`));
      rows.push({ which, birth, date, ...place(random) });
    }
    for (const row of rows) {
      const input = { fn: row.which, birth: new Date(row.birth).toISOString(), date: new Date(row.date).toISOString() };
      if (row.which === 'lunarReturnChart') {
        const birthInput = { utc: new Date(row.birth), latitude: row.latitude, longitude: row.longitude, houseSystem: 'placidus', timeKnown: true };
        const siteChart = chartOf(() => S.lunar.lunarReturnChart(birthInput, new Date(row.date)));
        const packageReturn = outcome(() => P.lunarReturn(birthInput, new Date(row.date)));
        compare(row.which, input, siteChart, packageReturn.ok ? chartView(packageReturn.value.chart) : { error: packageReturn.error }, 'returns-span');
        continue;
      }
      const lon = row.which === 'lunarReturnInstant' ? moonAt(row.birth) : sunAt(row.birth);
      const site = instantOf(() => S[row.which === 'lunarReturnInstant' ? 'lunar' : 'solar'][row.which](lon, new Date(row.date)));
      const pkg = instantOf(() => P[row.which](lon, new Date(row.date)));
      // Where the two agree the case counts as agreeing; a difference here is the span rule's.
      compare(row.which, { ...input, packageInstantInSpan: 'instant' in pkg ? inSpan(pkg.instant) : null }, site, pkg, 'returns-span');
    }
  }

  // ======================================================== void of course
  const signOf = (index) => SIGNS[index];
  const windowView = (window, site) => window && ({
    from: window.from.getTime(),
    to: window.to.getTime(),
    lastAspect: window.lastAspect && {
      at: window.lastAspect.at.getTime(), body: window.lastAspect.body, aspect: window.lastAspect.aspect, moonLon: window.lastAspect.moonLon,
    },
    sign: site ? signOf(window.signIndex) : window.sign,
    nextSign: site ? signOf(window.nextSignIndex) : window.nextSign,
  });
  const siteBodies = (name) => (name === 'modern' ? S.voc.VOID_BODIES_MODERN : S.voc.VOID_BODIES_TRADITIONAL);

  begin('void-of-course', 'V-W', 'voidOfCourseWindows over 10-day windows starting 1801–2199, modern and traditional bodies');
  {
    const random = stream('V-W');
    for (let index = 0; index < 40; index += 1) {
      const from = random.instant(Y1801, Y2199);
      const to = from + 10 * DAY;
      const bodies = index < 20 ? 'modern' : 'traditional';
      compare('voidOfCourseWindows', { from: new Date(from).toISOString(), to: new Date(to).toISOString(), bodies },
        S.voc.voidOfCourseWindows(new Date(from), new Date(to), { bodies: siteBodies(bodies) }).map((window) => windowView(window, true)),
        P.voidOfCourseWindows(new Date(from), new Date(to), { bodies }).map((window) => windowView(window, false)), null);
    }
  }

  begin('void-of-course', 'V-P', 'voidOfCourseWindows as the void-of-course page asks it: the first of a month to the first of the third month after, modern bodies, 2020–2031');
  {
    for (let year = 2020; year <= 2031; year += 1) {
      for (const month of [0, 4, 8]) {
        const from = Date.UTC(year, month, 1);
        const to = Date.UTC(year, month + 3, 1);
        compare('voidOfCourseWindows', { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
          S.voc.voidOfCourseWindows(new Date(from), new Date(to)).map((window) => windowView(window, true)),
          P.voidOfCourseWindows(new Date(from), new Date(to)).map((window) => windowView(window, false)), null);
      }
    }
  }

  begin('void-of-course', 'V-S', 'voidStatus against voidOfCourseAt at instants 1801–2199, modern and traditional bodies');
  {
    const random = stream('V-S');
    for (let index = 0; index < 80; index += 1) {
      const at = random.instant(Y1801, Y2199);
      const bodies = index < 40 ? 'modern' : 'traditional';
      const site = S.voc.voidStatus(new Date(at), { bodies: siteBodies(bodies) });
      const pkg = P.voidOfCourseAt(new Date(at), { bodies });
      compare('voidStatus', { at: new Date(at).toISOString(), bodies },
        { at: site.at.getTime(), isVoid: site.isVoid, current: windowView(site.current, true), next: windowView(site.next, true) },
        { at: pkg.at.getTime(), isVoid: pkg.isVoid, current: windowView(pkg.current, false), next: windowView(pkg.next, false) }, null);
    }
  }

  // ======================================================= aspect patterns
  const siteMatch = (aBody, aLon, bBody, bLon) => {
    const match = S.aspects.matchAspect(aBody, aLon, bBody, bLon);
    return match ? { type: match.def.type, orb: match.orb } : null;
  };
  const edgesOf = (points) => points.flatMap((a, index) => points.slice(index + 1).flatMap((b) => {
    const match = siteMatch(a.body, a.lon, b.body, b.lon);
    return match ? [{ a: a.body, b: b.body, type: match.type, orb: match.orb }] : [];
  }));
  const patternView = (pattern) => ({
    id: pattern.id,
    kind: pattern.kind,
    members: [...pattern.members],
    edges: pattern.edges.map((edge) => ({ a: edge.a, b: edge.b, type: edge.type, orb: edge.orb, limit: edge.limit, key: edge.key, sourceIds: [...edge.sourceIds] })),
    oppositions: pattern.oppositions.map((pair) => [...pair]),
    apex: pattern.apex ?? null,
    triangle: pattern.triangle ? [...pattern.triangle] : null,
    axisVertex: pattern.axisVertex ?? null,
    opposedVertex: pattern.opposedVertex ?? null,
  });
  const containmentView = (containment) => ({
    roots: containment.roots.map((pattern) => pattern.id),
    included: Object.entries(containment.included).map(([id, list]) => [id, list.map((pattern) => pattern.id)]),
  });
  const detect = (points, edges) => {
    const site = S.patterns.detectAspectPatterns(points, edges);
    const siteView = site.status === 'ready'
      ? { status: 'ready', points: site.points.map((point) => [point.body, point.lon]), patterns: site.patterns.map(patternView),
        containment: containmentView(S.patternModel.patternContainment(site.patterns)) }
      : { status: 'unavailable', reason: site.reason };
    const pkg = outcome(() => P.aspectPatterns(points, edges));
    const pkgView = pkg.ok
      ? { status: 'ready', points: pkg.value.points.map((point) => [point.body, point.lon]), patterns: pkg.value.patterns.map(patternView),
        containment: containmentView(P.patternContainment(pkg.value.patterns)) }
      : { status: 'unavailable', reason: pkg.error.replace(/^RangeError: /u, '') };
    return [siteView, pkgView, pkg.ok || pkg.error.startsWith('RangeError: ')];
  };
  const patternCause = (siteView, pkgView) => {
    if (siteView.status !== 'ready' || pkgView.status !== 'ready') return null;
    // Same patterns, other order: the locale-aware sort against the code-unit one.
    const ids = (view) => view.patterns.map((pattern) => pattern.id);
    const sameSet = JSON.stringify([...ids(siteView)].sort()) === JSON.stringify([...ids(pkgView)].sort());
    return sameSet ? 'pattern-order' : null;
  };

  begin('aspect-patterns', 'P-D', 'detectAspectPatterns and patternContainment on 800 constructed point sets of 3 to 10 bodies near multiples of 30°, with the site\'s own aspect records, shuffled, reversed or repeated; and 40 malformed inputs');
  {
    const random = stream('P-D');
    for (let index = 0; index < 800; index += 1) {
      const count = random.integer(3, 10);
      const bodies = random.shuffle(PATTERN_BODIES).slice(0, count);
      const base = random.uniform(0, 360);
      const points = bodies.map((body) => ({ body, lon: base + 30 * random.integer(0, 11) + random.uniform(-9, 9) * (random.next() < 0.3 ? 0 : 1) }));
      if (random.next() < 0.15) points.push({ body: random.pick(['North Node', 'South Node', 'ASC', 'MC']), lon: random.uniform(0, 360) });
      let edges = edgesOf(points);
      if (random.next() < 0.5) edges = random.shuffle(edges);
      edges = edges.map((edge, position) => (random.next() < 0.3 ? { a: edge.b, b: edge.a, type: edge.type, orb: edge.orb, sourceId: `record-${position}` } : edge));
      if (edges.length > 0 && random.next() < 0.2) edges.push({ a: edges[0].b, b: edges[0].a, type: edges[0].type, orb: edges[0].orb, sourceId: 'repeat' });
      const [siteView, pkgView] = detect(points, edges);
      compare('detectAspectPatterns', { case: index }, siteView, pkgView, patternCause(siteView, pkgView));
    }
    const good = [{ body: 'Mercury', lon: 0 }, { body: 'Venus', lon: 120 }, { body: 'Mars', lon: 240 }];
    const goodEdges = edgesOf(good);
    const malformed = [
      [[...good, good[0]], goodEdges],
      [[{ body: 'Mercury', lon: Number.NaN }, good[1]], []],
      [[{ body: 'Mercury', lon: Number.POSITIVE_INFINITY }, good[1]], []],
      [[{ body: '', lon: 10 }, good[1]], []],
      [[], []],
      [[{ body: 'ASC', lon: 0 }, { body: 'North Node', lon: 90 }], []],
      [good, [...goodEdges, { ...goodEdges[0], orb: Number.NaN }]],
      [good, [...goodEdges, { ...goodEdges[0], orb: -1 }]],
      [good, [...goodEdges, { ...goodEdges[0], type: 'quincunx' }]],
      [good, [...goodEdges, { ...goodEdges[0], type: 'square' }]],
      [good, [...goodEdges, { ...goodEdges[0], b: 'Sun' }]],
      [good, [...goodEdges, { ...goodEdges[0], b: goodEdges[0].a }]],
      [good, [...goodEdges, { ...goodEdges[0], orb: goodEdges[0].orb + 1e-6 }]],
      [good, [goodEdges[0], { ...goodEdges[0], orb: goodEdges[0].orb + 1e-12 }]],
    ];
    for (let index = malformed.length; index < 40; index += 1) {
      const points = random.shuffle(PATTERN_BODIES).slice(0, 4).map((body) => ({ body, lon: random.uniform(0, 360) }));
      const edges = edgesOf(points);
      const kind = index % 4;
      if (kind === 0) points.push({ ...points[0] });
      else if (kind === 1) edges.push({ a: points[0].body, b: points[1].body, type: 'trine', orb: 99 });
      else if (kind === 2) edges.push({ a: 'Chiron', b: points[1].body, type: 'trine', orb: 0 });
      else edges.push({ a: points[0].body, b: 'Sun', type: 'opposition', orb: 0 });
      malformed.push([points, edges]);
    }
    malformed.forEach(([points, edges], index) => {
      const [siteView, pkgView, thrownRangeError] = detect(points, edges);
      compare('detectAspectPatterns', { malformed: index }, siteView, pkgView, thrownRangeError ? null : 'unexplained');
    });
  }

  begin('aspect-patterns', 'P-C', 'detectAspectPatterns on the bodies and aspects of 1,000 charts the site\'s adapter casts at invented instants 1800–2199 and places within 66°, as the chart page passes them');
  {
    const random = stream('P-C');
    for (let index = 0; index < 1000; index += 1) {
      const at = random.instant(utc('1800-01-02T00:00:00Z'), utc('2199-12-30T00:00:00Z'));
      const chart = S.full.computeChart({ utc: new Date(at), ...place(random), houseSystem: 'placidus', timeKnown: true });
      const [siteView, pkgView] = detect(chart.bodies, chart.aspects);
      compare('detectAspectPatterns', { at: new Date(at).toISOString() }, siteView, pkgView, patternCause(siteView, pkgView));
    }
  }

  // ============================================================ composite
  const compositeView = (points, aspects) => ({
    points: points.map((point) => [point.body, point.lon]),
    aspects: aspects.map((aspect) => [aspect.a, aspect.b, aspect.type, aspect.orb]),
  });
  const composite = (a, b) => {
    const sitePoints = S.composite.compositeMidpoints(a, b);
    const site = compositeView(sitePoints, S.composite.compositeAspects(sitePoints));
    const pkg = outcome(() => {
      const points = P.compositeMidpoints(a, b);
      return compositeView(points, P.compositeAspects(points));
    });
    return [site, pkg.ok ? pkg.value : { error: pkg.error }];
  };

  begin('composite', 'C-M', 'compositeMidpoints and compositeAspects on 500 pairs of body lists, with exact coincidences, exact oppositions and near-oppositions');
  {
    const random = stream('C-M');
    for (let index = 0; index < 500; index += 1) {
      const a = random.shuffle(BODIES).slice(0, random.integer(1, 12)).map((body) => ({ body, lon: random.uniform(0, 360) }));
      const b = random.shuffle(BODIES).slice(0, random.integer(1, 12)).map((body) => {
        const own = a.find((point) => point.body === body);
        const roll = random.next();
        if (own && roll < 0.1) return { body, lon: own.lon };
        if (own && roll < 0.2) return { body, lon: (own.lon + 180) % 360 };
        if (own && roll < 0.25) return { body, lon: (own.lon + 180 + (random.next() < 0.5 ? -1e-9 : 1e-9)) % 360 };
        return { body, lon: random.uniform(0, 360) };
      });
      const [site, pkg] = composite(a, b);
      compare('composite', { case: index }, site, pkg, null);
    }
  }

  begin('composite', 'C-R', 'composites of 500 pairs of charts the site\'s adapter casts at invented instants 1800–2199, as the relationship page passes their bodies');
  {
    const random = stream('C-R');
    for (let index = 0; index < 500; index += 1) {
      const at = () => random.instant(utc('1800-01-02T00:00:00Z'), utc('2199-12-30T00:00:00Z'));
      const a = S.full.computeBodies(new Date(at()));
      const b = S.full.computeBodies(new Date(at()));
      const [site, pkg] = composite(a, b);
      compare('composite', { case: index }, site, pkg, null);
    }
  }

  begin('composite', 'C-X', 'lists the site never builds: a name that is not a body, or a body twice (recorded, not required to agree)');
  {
    const lists = [
      [[{ body: 'Chiron', lon: 10 }, { body: 'Sun', lon: 20 }], [{ body: 'Sun', lon: 40 }]],
      [[{ body: 'Sun', lon: 10 }, { body: 'Sun', lon: 20 }], [{ body: 'Sun', lon: 40 }]],
      [[{ body: 'ASC', lon: 10 }], [{ body: 'ASC', lon: 50 }]],
    ];
    for (const [a, b] of lists) {
      const [site, pkg] = composite(a, b);
      compare('composite', { a, b }, site, pkg, 'composite-validation');
    }
  }

  // ============================================================ dignities
  begin('dignities', 'D-X', 'dignityFor, dignitiesFor and hasClassicalDignities for every body in every sign');
  for (const planet of BODIES) {
    for (const sign of SIGNS) {
      const row = (run) => {
        const result = outcome(run);
        return result.ok ? result.value : { error: result.error };
      };
      compare('dignities', { planet, sign },
        [row(() => S.dignities.dignityFor(planet, sign)), row(() => [...S.dignities.dignitiesFor(planet, sign)]), row(() => S.dignities.hasClassicalDignities(planet))],
        [row(() => P.dignityFor(planet, sign)), row(() => [...P.dignitiesFor(planet, sign)]), row(() => P.hasClassicalDignities(planet))], null);
    }
  }
  begin('dignities', 'D-N', 'names outside the twelve bodies and the twelve lowercase signs (recorded, not required to agree)');
  for (const [planet, sign] of [['Chiron', 'aries'], ['Ascendant', 'leo'], ['', 'leo'], ['sun', 'leo'], ['Sun', 'Leo'], ['Sun', ''], ['Mars', 'ophiuchus']]) {
    const row = (run) => {
      const result = outcome(run);
      return result.ok ? result.value : { error: result.error };
    };
    compare('dignities', { planet, sign },
      [row(() => S.dignities.dignityFor(planet, sign)), row(() => [...S.dignities.dignitiesFor(planet, sign)]), row(() => S.dignities.hasClassicalDignities(planet))],
      [row(() => P.dignityFor(planet, sign)), row(() => [...P.dignitiesFor(planet, sign)]), row(() => P.hasClassicalDignities(planet))], 'dignity-validation');
  }

  // =========================================================== Moon signs
  const ZONES = [
    'UTC', 'Etc/GMT+12', 'Etc/GMT-14', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Pacific/Apia', 'Pacific/Auckland',
    'Pacific/Chatham', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Denver', 'America/Chicago',
    'America/New_York', 'America/Havana', 'America/Santiago', 'America/Asuncion', 'America/Sao_Paulo', 'America/St_Johns',
    'America/Caracas', 'Atlantic/Azores', 'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Stockholm',
    'Europe/Moscow', 'Africa/Cairo', 'Africa/Casablanca', 'Africa/Lagos', 'Asia/Beirut', 'Asia/Jerusalem', 'Asia/Tehran',
    'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Manila', 'Australia/Adelaide',
    'Australia/Lord_Howe', 'America/Juneau',
  ];
  const MIDNIGHT_CHANGES = [
    ['America/Santiago', '2022-09-11'], ['America/Havana', '2023-03-12'], ['Asia/Beirut', '2023-03-26'],
    ['America/Asuncion', '2023-10-01'], ['Africa/Cairo', '2023-04-28'], ['Asia/Tehran', '2021-03-22'],
    ['America/Sao_Paulo', '2018-11-04'], ['Pacific/Apia', '2011-12-30'], ['Asia/Beirut', '2023-10-29'],
    ['America/Havana', '2023-11-05'], ['America/Santiago', '2023-04-02'], ['Asia/Tehran', '2021-09-22'],
    ['America/Asuncion', '2023-03-26'], ['Africa/Cairo', '2023-10-27'],
  ];
  const dayIn = (random, from, to) => isoDate(utc(`${from}T00:00:00Z`) + random.integer(0, (utc(`${to}T00:00:00Z`) - utc(`${from}T00:00:00Z`)) / DAY) * DAY);
  const shiftDate = (date, days) => isoDate(utc(`${date}T00:00:00Z`) + days * DAY);

  begin('moon-sign-candidates', 'M-A', 'untimedMoonSign(date) against moonSignCandidates(date).sign, dates 1800-01-02 to 2199-12-30, and five dates in years 0 to 99');
  {
    const random = stream('M-A');
    const dates = Array.from({ length: 3000 }, () => dayIn(random, '1800-01-02', '2199-12-30'));
    dates.push('0050-06-15', '0099-12-31', '0001-06-01', '0012-02-29', '0000-02-29');
    for (const date of dates) {
      const site = await S.untimed.untimedMoonSign(date);
      const pkg = outcome(() => P.moonSignCandidates(date).sign);
      compare('untimedMoonSign', { date }, { sign: site }, pkg.ok ? { sign: pkg.value } : { error: pkg.error },
        Number(date.slice(0, 4)) < 100 ? 'moon-date-form' : null);
    }
  }

  const zonedCase = (date, timeZone) => {
    const site = outcome(() => {
      const endpoints = S.dateCertainty.localDateEndpointsUtc(date, timeZone);
      return {
        from: endpoints.start.getTime(),
        to: endpoints.end.getTime(),
        signs: [...S.moon.moonCandidatesFromEndpoints(S.full.computeBodies(endpoints.start), S.full.computeBodies(endpoints.end))],
      };
    });
    const pkg = outcome(() => {
      const result = P.moonSignCandidates(date, { timeZone });
      return { from: result.from.getTime(), to: result.to.getTime(), signs: [...result.signs] };
    });
    return [site.ok ? site.value : { error: site.error }, pkg.ok ? pkg.value : { error: pkg.error }];
  };

  begin('moon-sign-candidates', 'M-Z', 'moonCandidatesFromEndpoints of localDateEndpointsUtc against moonSignCandidates(date, { timeZone }): 1,500 dates 1971–2199 in 40 zones, and 42 dates at or beside a change of offset at local midnight');
  {
    const random = stream('M-Z');
    const rows = [
      ...Array.from({ length: 1500 }, () => ({ date: dayIn(random, '1971-01-01', '2199-12-30'), timeZone: random.pick(ZONES) })),
      ...MIDNIGHT_CHANGES.flatMap(([timeZone, date]) => [-1, 0, 1].map((shift) => ({ date: shiftDate(date, shift), timeZone }))),
    ];
    for (const row of rows) {
      const [site, pkg] = zonedCase(row.date, row.timeZone);
      const skipped = 'error' in pkg && /did not occur/u.test(pkg.error) && !('error' in site) && site.to < site.from;
      compare('moonSignCandidates', row, site, pkg, skipped ? 'moon-skipped-date' : null);
    }
  }

  begin('moon-sign-candidates', 'M-P', 'as M-Z before 1970: 600 dates 1800-01-02 to 1969-12-31 in the same zones (recorded; a difference must be a different midnight)');
  {
    const random = stream('M-P');
    for (let index = 0; index < 600; index += 1) {
      const row = { date: dayIn(random, '1800-01-02', '1969-12-31'), timeZone: random.pick(ZONES) };
      await prepareLocalTime(row.date, row.timeZone);
      await prepareLocalTime(shiftDate(row.date, 1), row.timeZone);
      const [site, pkg] = zonedCase(row.date, row.timeZone);
      const midnights = !('error' in site) && !('error' in pkg) && (site.from !== pkg.from || site.to !== pkg.to);
      compare('moonSignCandidates', row, site, pkg, midnights ? 'moon-before-1970' : null);
    }
  }

  // ---- summary ------------------------------------------------------------------
  report.differences = found;
  const units = {};
  for (const [name, section] of Object.entries(report.sections)) {
    const row = (units[section.unit] ??= { sections: [], cases: 0, values: 0, agree: 0, differ: 0, causes: {} });
    row.sections.push(name);
    row.cases += section.cases;
    row.values += section.values;
    row.agree += section.agree;
    row.differ += section.differ;
    for (const [cause, count] of Object.entries(section.causes)) row.causes[cause] = (row.causes[cause] ?? 0) + count;
  }
  report.units = units;
  report.unexplained = found.filter((row) => row.cause === 'unexplained');
  report.summary = {
    cases: Object.values(units).reduce((sum, row) => sum + row.cases, 0),
    values: Object.values(units).reduce((sum, row) => sum + row.values, 0),
    agree: Object.values(units).reduce((sum, row) => sum + row.agree, 0),
    differ: Object.values(units).reduce((sum, row) => sum + row.differ, 0),
    unexplained: report.unexplained.length,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
