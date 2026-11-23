import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DeltaT_EspenakMeeus } from 'astronomy-engine';
import { deltaTAt } from '@zodiacs/engine/deltat';
import { describe, expect, it } from 'vitest';
import { MEASURE, BODIES } from '../docs/platform/evidence/swiss-benchmark/tools/corpus.mjs';

const root = process.cwd();
const read = (p) => readFileSync(resolve(root, p), 'utf8');

/** Read the root's transitive relative import graph, rather than its facade alone. */
function rootEntryGraph(extension = 'js') {
  const seen = new Set();
  function visit(path) {
    if (seen.has(path)) return '';
    seen.add(path);
    const text = read(path);
    const imports = [...text.matchAll(/(?:import|export)\s*(?:[^'";]*?from\s*)?["'](\.\/[^"']+)["']/gu),
      ...text.matchAll(/import\(\s*["'](\.\/[^"']+)["']\s*\)/gu)];
    return text + imports.map(([, specifier]) => visit(resolve(root, path, '..',
      extension === 'd.ts' ? specifier.replace(/\.js$/u, '.d.ts') : specifier))).join('\n');
  }
  return visit(`node_modules/@zodiacs/engine/dist/index.${extension}`);
}

const evidencePath = 'docs/platform/evidence/site-engine-2-1-0/claims-horizons';
const { engine, ephemeris, archiveSha256, deltaTTableDigest, reference, stratified, dense, clock }
  = JSON.parse(read(`${evidencePath}/results.json`));
const requests = JSON.parse(read(`${evidencePath}/requests.json`));

/**
 * What a reader sees, near enough: the source with its stylesheet, its markup
 * and its Astro expressions removed. Working on this rather than on the source
 * is what stops a claim hiding inside a tag or a unit hiding outside one.
 */
const proseOf = (path) => read(path)
  .replace(/^---[\s\S]*?^---/mu, ' ')
  .replace(/<style>[\s\S]*?<\/style>/gu, ' ')
  .replace(/\{' '\}/gu, ' ')
  .replace(/\{[^{}]*\}/gu, ' ')
  .replace(/<[^>]+>/gu, ' ')
  .replace(/&mdash;/gu, '—')
  .replace(/\s+/gu, ' ')
  .replace(/\s+([.,;:])/gu, '$1')
  .trim();

const prose = proseOf('src/pages/methodology/index.astro');
/**
 * The engine page repeats a subset of the same figures. It had none of this
 * coverage at first, so a re-run of the benchmark would have failed CI on
 * /methodology/ while the developer front door went on stating stale numbers.
 */
const enginePage = proseOf('src/pages/developers/engine/index.astro');

const tenth = (x) => x.toFixed(1);
const hundredth = (x) => x.toFixed(2);
const upperHundredth = (x) => (Math.ceil(x * 100) / 100).toFixed(2);

describe('the accuracy claim on /methodology/', () => {
  it('attributes the arcminute target to the browser library', () => {
    const sentences = prose.split(/(?<=[.;])\s+/u);
    expect(sentences.filter((sentence) => /arcminute/u.test(sentence)))
      .toEqual([
        'It is designed to stay within one arcminute of NOVAS, its own target.',
        "Most of the rest were degrees one arcminute apart, where NASA's value sits within arcseconds of a minute line.",
      ]);
    expect(prose).not.toMatch(/accurate to (?:about |roughly |within )?one arcminute|charts here are accurate|high-accuracy/iu);
  });

  it('keeps the original chart dates, body count, and stratified measurements', () => {
    expect(stratified.cases).toEqual(MEASURE.map(({ id, utc, stratum }) => ({ id, utc: new Date(utc).toISOString(), stratum })));
    const within = MEASURE.filter(({ stratum }) => stratum !== 'future');
    const future = MEASURE.filter(({ stratum }) => stratum === 'future');
    expect(stratified.within.n).toBe(within.length * BODIES.length);
    expect(stratified.future.n).toBe(future.length * BODIES.length);
    expect(stratified.moon.n).toBe(within.length);
    for (const summary of [stratified.within, stratified.future, stratified.moon]) {
      expect(summary.p50).toBeLessThanOrEqual(summary.p95);
      expect(summary.p95).toBeLessThanOrEqual(summary.max);
      expect(MEASURE.some(({ utc }) => new Date(utc).toISOString() === summary.maxAt)).toBe(true);
      expect(BODIES).toContain(summary.maxBody);
    }
    expect(stratified.future.max).toBeLessThan(60);
    expect(stratified.moon.max).toBeLessThanOrEqual(stratified.within.max);
  });

  it('gives every stratified figure its unit, denominator and epoch', () => {
    const { within, future } = stratified;
    expect(prose).toContain('18 chart dates and ten bodies');
    expect(prose).toContain(`Across the ${within.n} measurements from 1801 to 2026, the median disagreement in longitude was ${hundredth(within.p50)} arcseconds`);
    expect(prose).toContain(`the 95th percentile was ${hundredth(within.p95)} arcseconds`);
    expect(prose).toContain(`the largest was ${hundredth(within.max)} arcseconds (${within.maxBody} in ${within.maxAt.slice(0, 4)})`);
    expect(prose).toContain(`The largest of the ${future.n} far-future measurements was ${hundredth(future.max)} arcseconds (the ${future.maxBody} in ${future.maxAt.slice(0, 4)})`);
  });

  it('states the width of a sign correctly', () => {
    const stated = /A zodiac sign is (\d+) degrees, which is ([\d,]+) arcseconds/u.exec(prose);
    expect(stated, 'the page must state the width it is comparing against').toBeTruthy();
    expect(Number(stated[2].replaceAll(',', ''))).toBe(Number(stated[1]) * 3600);
    expect(Number(stated[1])).toBe(30);
  });

  it('binds the clock comparison to the daily run and discloses the reference convention', () => {
    expect(clock.n).toBe(36524);
    expect(deltaTTableDigest).toBe(deltaTAt(0).tableDigest);
    expect(requests.find(({ name }) => name === 'clock-2100-2199').url)
      .toContain('START_TIME=%272100-01-01%27&STOP_TIME=%272199-12-31%27&STEP_SIZE=%271+d%27&QUANTITIES=%2730%27');
    expect(prose).toContain('Beyond its prediction interval Horizons holds its UTC offset fixed.');
    expect(prose).toContain("The engine estimates the Earth's rotation with its ΔT model.");
    // Since engine 2.0.0 both read a future calendar label as UTC with a fixed offset, so the readings agree.
    expect(clock.offset[0]).toBeLessThanOrEqual(clock.offset[1]);
    expect(prose).toContain('Since release 2.0.0 it also holds atomic time a fixed 69.184 seconds ahead of UTC beyond 2 October 2027, as Horizons does.');
    expect(prose).toContain(`from 2100 to 2199, those clock readings put the calculation within ${upperHundredth(clock.offset[1])} seconds of Horizons`);
    expect(enginePage).toContain(`Horizons' fixed future UTC offset put the same calendar labels within ${upperHundredth(clock.offset[1])} seconds of each other`);
  });

  it('states the observed ΔT the engine uses, with its measured agreement', () => {
    const gate = JSON.parse(read('docs/platform/evidence/deltat-2026-09-25/outputs/gate1.json'));
    expect(gate.everyObservedDay.from).toBe('1962-01-01');
    const stated = /From 1962 on it is within ([\d.]+) seconds of the IERS value on every day/u.exec(prose);
    expect(stated, 'the page must bound the agreement it claims').toBeTruthy();
    // A bound, so never below the worst day measured, and no looser than a hundredth over it.
    expect(Number(stated[1])).toBeGreaterThanOrEqual(gate.everyObservedDay.maxAbs);
    expect(Number(stated[1]) - gate.everyObservedDay.maxAbs).toBeLessThan(0.01);
    expect(enginePage).toContain(`from 1962 on it is within ${stated[1]} seconds of the IERS value on every day`);
    // It is the installed engine's model, and every chart names it.
    const model = deltaTAt((Date.parse('2026-09-22T00:00:00Z') - Date.UTC(2000, 0, 1, 12)) / 86_400_000);
    expect(model.model).toBe('zodiacs-deltat/1');
    expect(model.tableDigest).toBe(gate.tableDigest);
    expect(prose).toContain('each chart records the value it used and its uncertainty');
  });

  it('states the ΔT error of the formula it replaced from the IERS value, not as a convention', () => {
    const deltaT = JSON.parse(read('docs/platform/evidence/deltat-2026-09-23/values.json'));
    const today = deltaT.values.find((row) => row.date === '2026-09-22');
    expect(prose).not.toContain('Neither extrapolation is wrong');
    const stated = /on 22 September 2026 read ([\d.]+) seconds where the IERS value is ([\d.]+), and which on its own moved the Moon about ([\d.]+) arcseconds/u
      .exec(prose);
    expect(stated, 'the page must give both values and the Moon displacement').toBeTruthy();
    expect(stated[1]).toBe(tenth(today.formulaSeconds));
    expect(stated[2]).toBe(tenth(today.observedSeconds));
    expect(stated[3]).toBe(tenth(today.moonArcseconds));
    // The formula value is the installed library's, at that instant.
    const installed = JSON.parse(read('node_modules/astronomy-engine/package.json')).version;
    expect(deltaT.formula).toEqual({ function: 'DeltaT_EspenakMeeus', package: 'astronomy-engine', version: installed });
    const days = (Date.parse('2026-09-22T00:00:00Z') - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
    expect(DeltaT_EspenakMeeus(days)).toBeCloseTo(today.formulaSeconds, 3);
    expect(today.moonArcseconds).toBeCloseTo(today.differenceSeconds * deltaT.moonArcsecondsPerSecond, 2);
  });

  it('names the related ephemerides and limits the figures to the measurement dates', () => {
    expect(reference).toBe('NASA JPL Horizons DE441');
    expect(prose).toContain(`engine ${engine} with the NASA JPL Horizons DE441 answers`);
    expect(prose).toContain("DE440 and DE441 are related JPL ephemerides. This comparison measures their agreement on the sampled dates.");
    expect(prose).toContain("Horizons returned apparent longitudes at Earth's centre in the ecliptic of date.");
    expect(prose).not.toContain('Swiss Ephemeris');
  });

  it('describes the reduction the engine actually performs', () => {
    // The Moon does not go through the light-time and aberration pass the
    // planets do: since rc.16 the engine takes GeoMoon's geometric EQJ vector
    // through its own full IAU2000B ecliptic frame, without light-time or
    // aberration.
    // Every emitted file, not one hashed chunk: a new engine build renames
    // its chunks, and the test must follow the code rather than the name.
    const engineDist = 'node_modules/@zodiacs/engine/dist';
    const engineSource = readdirSync(resolve(root, engineDist))
      .filter((name) => name.endsWith('.js'))
      .map((name) => read(`${engineDist}/${name}`))
      .join('\n');
    expect(engineSource).toMatch(/const equatorial = GeoMoon\(time\);/u);
    expect(engineSource).toContain('return eclipticOfDate(equatorial.x, equatorial.y, equatorial.z, time.tt);');
    expect(engineSource).toContain('const at = tilt(tt);');
    expect(engineSource).toMatch(/GeoVector\(body, time, true\)/u);
    expect(prose).toContain('The DE440 calculation applies light-time and aberration.');
    expect(prose).toContain('The browser applies both for the planets.');
    expect(prose).toContain('For its Moon it rotates a geometric lunar vector into the true ecliptic of date with IAU 2000B nutation.');
    expect(prose).not.toMatch(/including light-time, aberration, and nutation/u);
  });
});

describe('the same figures on /developers/engine/', () => {
  it('repeats the stratified measurement with its unit and denominator', () => {
    const { within } = stratified;
    expect(enginePage).toContain(`Across the ${within.n} measurements from 1801 to 2026, the median disagreement in ecliptic longitude was ${hundredth(within.p50)} arcseconds and the largest was ${hundredth(within.max)} arcseconds.`);
  });

  it('says the package bounds its input date only where its ephemeris ends, because it does', async () => {
    // The page used to say the engine accepts 1800-2199. That is this site's
    // own form validation (src/lib/share.ts). Up to rc.13 the package rejected
    // nothing; since rc.14 it refuses only instants outside EPHEMERIS_SPAN,
    // the years astronomy-engine tabulates.
    expect(enginePage).toMatch(/bounds its input date only where its ephemeris ends/u);
    expect(enginePage).toContain('outside Terrestrial Time 0001-04-30 to 3998-09-03 throws a RangeError');
    expect(enginePage).not.toMatch(/does not bound its input date|the engine accepts dates from 1800 to 2199/u);
    const javascript = rootEntryGraph();
    // EPHEMERIS_SPAN's declaration lives in the reference-span .d.ts chunk.
    const packaged = javascript + rootEntryGraph('d.ts');
    expect(packaged, 'if the package ever gains a 2199 range, this claim must change').not.toMatch(/2199/u);
    expect(read('src/lib/share.ts'), 'the site is where the 1800-2199 bound lives').toMatch(/year > 2199/u);
    const { EPHEMERIS_SPAN, natalChart } = await import('@zodiacs/engine');
    expect(EPHEMERIS_SPAN).toMatchObject({ timeScale: 'TT', fromTT: '0001-04-30T12:00:00', toTT: '3998-09-03T12:00:00' });
    // Inside the span it computes, with no error, what the page says it computes…
    for (const year of [900, 3500]) {
      const utc = new Date(Date.UTC(year, 5, 15, 12));
      expect(natalChart({ utc, timeKnown: false }).flags, String(year)).toContain('outside-reference-span');
    }
    // …and outside it every calculation throws.
    for (const year of [-500, 4500]) {
      const utc = new Date(Date.UTC(year, 5, 15, 12));
      expect(() => natalChart({ utc, timeKnown: false }), String(year)).toThrow(/outside the ephemeris span/u);
    }
    // What the package does inside the span since rc.8: it flags a chart outside its reference span.
    expect(javascript).toMatch(/outside-reference-span/u);
    expect(enginePage).toContain('outside 1800–2200 it carries the outside-reference-span flag');
  });

  it('discloses that the geo entry point ships a network client', () => {
    // The page headline is that the core makes no network request. That is
    // true of the core and not of everything behind /geo.
    // The calls are `fetcher(url)` against `options.fetch ?? globalThis.fetch`,
    // not a literal `fetch(` — which is exactly why this asserts the client's
    // presence rather than grepping for a spelling.
    const geo = read('node_modules/@zodiacs/engine/dist/geo.js');
    expect(geo, 'this case exists because /geo ships a network client').toMatch(/createGeoNamesClient/u);
    expect(geo).toMatch(/globalThis\.fetch/u);
    const core = rootEntryGraph();
    expect(core, 'the core must stay offline').not.toMatch(/globalThis\.fetch|createGeoNamesClient/u);
    expect(enginePage).toMatch(/GeoNames place-lookup client/u);
    expect(enginePage).toMatch(/makes\s+HTTP requests/u);
  });
});

describe('the every-tenth-day comparison, 1800 to 2199', () => {
  const early = dense.ut.through2026;
  const futureUt = dense.ut.futureMoon;
  const futureTt = dense.tt.futureMoon;

  it('binds the run to the shipped engine and its exact Horizons sample', () => {
    const installed = JSON.parse(read('node_modules/@zodiacs/engine/package.json')).version;
    const archive = JSON.parse(read('package.json')).dependencies['@zodiacs/engine'].replace(/^file:/u, '');
    expect(engine).toBe(installed);
    expect(ephemeris).toBe('de440');
    expect(archiveSha256).toBe(createHash('sha256').update(readFileSync(resolve(root, archive))).digest('hex'));
    expect(early.n).toBe(8291 * 11);
    expect([dense.ut.all.n, dense.tt.all.n]).toEqual([14610 * 11, 14610 * 11]);
    expect([futureUt.n, futureTt.n]).toEqual([1826, 1826]);
    expect(requests.filter(({ name }) => name.startsWith('dense-tt-'))).toHaveLength(30);
    expect(requests.filter(({ name }) => name.startsWith('dense-ut-'))).toHaveLength(10);
    expect(requests.filter(({ name }) => name.startsWith('dense-node-'))).toHaveLength(4);
    for (const { url, sha256 } of requests) {
      expect(new URL(url).origin).toBe('https://ssd.jpl.nasa.gov');
      expect(sha256).toMatch(/^[a-f0-9]{64}$/u);
    }
  });

  it('gives the worst case through 2026 and the width of its sign edge', () => {
    expect(prose).toContain('sampled every tenth day from 1800 to 2199 at noon, for the ten bodies and the North Node');
    expect(prose).toContain(`Through 2026 that was ${early.n.toLocaleString('en-US')} comparisons, with a median of ${hundredth(early.p50)} arcseconds and a largest of ${upperHundredth(early.max)} arcseconds (the ${early.maxBody} in ${early.maxAt.slice(0, 4)})`);
    expect(prose).toContain(`could change the sign within ${upperHundredth(early.max)} arcseconds of its edge`);
    expect(enginePage).toContain(`the median was ${hundredth(early.p50)} arcseconds and the largest was ${upperHundredth(early.max)} arcseconds (the ${early.maxBody} in ${early.maxAt.slice(0, 4)})`);
  });

  it('gives the far-future Moon at matched TT and at the same input time', () => {
    expect(futureTt.max).toBeLessThan(10);
    // Since engine 2.0.0 the same input time and matched TT agree, so the two figures are close.
    expect(futureUt.max).toBeLessThan(10);
    const result = `${upperHundredth(futureTt.max)} arcseconds at matched Terrestrial Time and ${upperHundredth(futureUt.max)} arcseconds at the same input time`;
    expect(prose).toContain(`From 2150 to 2199, the largest Moon difference was ${result}`);
    expect(enginePage).toContain(`From 2150 to 2199 the maximum Moon difference was ${result}`);
  });
});
