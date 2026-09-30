/**
 * The accuracy figures on /methodology/ against the measurement they come from.
 *
 * The page used to say the engine was "accurate to about one arcminute". That
 * figure is Astronomy Engine's own design target against NOVAS, published in
 * its README; nobody here had measured it, and it was written as though it
 * described a chart on this site. Two of the 180 measurements taken on
 * 2026-09-20 fall outside it.
 *
 * The first version of this file was a bad test. An adversarial review wrote
 * five wrong pages that all passed it: the end year changed to 2199 (captured
 * by the regex and never asserted), the 95th percentile and maximum relabelled
 * from arcseconds to arcminutes (only the median had its unit pinned), the
 * width of a sign changed from 108,000 to 10,800 arcseconds (never checked),
 * the two far-future epochs swapped and the delta-T gap inflated tenfold (the
 * values were searched for as bare strings anywhere on the page), and — worst
 * — "Charts here are accurate to one arcminute" inserted as a fresh sentence,
 * which slipped past a negative lookahead by putting the words "own target"
 * later in the same text node.
 *
 * So the cases below work on the page's prose rather than on substrings of its
 * source, bind every number to its unit and to the clause it belongs in, and
 * hold the set of sentences that may mention an arcminute at all. All five
 * mutations, and the ones that suggested themselves while fixing them, fail
 * here.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DeltaT_EspenakMeeus } from 'astronomy-engine';
import { deltaTAt } from '@zodiacs/engine/deltat';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (p) => readFileSync(resolve(root, p), 'utf8');

// The 180 measurements as run again on 2026-09-25 with engine 0.1.1-rc.8, whose
// clock is observed ΔT; report-measure.json beside it is rc.6's run. The
// per-row differences from Swiss were removed from the tree on 2026-09-28
// (docs/platform/programme/DECISIONS-2026-09-28.md §3; the record is
// docs/engine-validation/SWISS-OUTPUT-REMOVAL.md). The report keeps the
// comparator's own aggregates and, under `statistics`, the figures this file
// used to compute from the rows, computed from them by the same formulas
// before they went (docs/engine-validation/swiss-output-removal/strip.py,
// whose --check recomputes them from the last commit that has the rows).
// Since 2026-09-29 (DECISIONS-2026-09-29 §2) the pages carry no Swiss value
// at one date: the far-future Moon's two per-case differences left the
// statistics, and the clock is stated as statistics over 2100–2199, which
// deltat-gap-2100-2199.json holds and its tools regenerate with Swiss run on
// demand.
const report = JSON.parse(read('docs/platform/evidence/swiss-benchmark/report-measure-rc8.json'));
const gap = JSON.parse(read('docs/platform/evidence/swiss-benchmark/deltat-gap-2100-2199.json'));
const corpus = read('docs/platform/evidence/swiss-benchmark/tools/corpus.mjs');
const { withinRecord, farFuture } = report.statistics;
/** The comparator's own per-stratum aggregates, which the statistics must agree with. */
const strata = Object.entries(report.byStratum);
const withinStrata = strata.filter(([name]) => name !== 'future').map(([, s]) => s);

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
  .trim();

const prose = proseOf('src/pages/methodology/index.astro');
/**
 * The engine page repeats a subset of the same figures. It had none of this
 * coverage at first, so a re-run of the benchmark would have failed CI on
 * /methodology/ while the developer front door went on stating stale numbers.
 */
const enginePage = proseOf('src/pages/developers/engine/index.astro');

/** Sentence-ish fragments. Only the ones mentioning arcminutes are inspected. */
const fragments = prose.split(/(?<=[.;])\s+/u).map((s) => s.trim()).filter(Boolean);

const tenth = (x) => Number(x.toFixed(1)).toFixed(1);

/** The span the measured cases actually cover, read from the corpus they came from. */
function spanOf(caseIds) {
  const ids = new Set(caseIds);
  const years = [...corpus.matchAll(/c\('([\w-]+)',\s*'([\w-]+)',\s*'(\d{4})-/gu)]
    .filter(([, id]) => ids.has(id))
    .map(([, , , year]) => Number(year));
  return `from ${Math.min(...years)} to ${Math.max(...years)}`;
}

/** The year a corpus case is dated in. */
const yearOf = (id) => Number(new RegExp(`c\\('${id}',[^)]*'(\\d{4})-`, 'u').exec(corpus)[1]);

/**
 * Every sentence on the page that may mention an arcminute, in full. A new one
 * fails until it is added here deliberately, which is the only guard that
 * survives an author who adds a claim instead of editing one.
 */
const ARCMINUTE_SENTENCES = [
  'It is designed to stay within one arcminute of NOVAS — that is the library\'s own target,'
  + ' not a measurement of this site, and what we measured is in the next section.',
  'The other 20 measurements are the far-future cases, and none of them reaches one arcminute:'
  + ' the largest is 24.8 arcseconds, Pluto at 2190, where the two ephemerides differ.',
];

describe('the accuracy claim on /methodology/', () => {
  it('mentions an arcminute only in the sentences that attribute it', () => {
    const mentions = fragments.filter((f) => /arcminute/u.test(f));
    // Not `toContain` per sentence: the set has to match, so an inserted
    // claim fails even when every expected sentence is still present.
    expect(mentions).toEqual(ARCMINUTE_SENTENCES);
  });

  it('never states a bare accuracy figure for this site', () => {
    expect(prose).not.toMatch(/accurate to (?:about |roughly |within )?one arcminute/u);
    expect(prose).not.toMatch(/charts here are accurate/iu);
    // "high-accuracy", which measured nothing, is gone from the lunar model.
    expect(prose).not.toMatch(/high-accuracy/u);
  });

  it('keeps statistics that agree with the comparator\'s own aggregates', () => {
    // The statistics were computed from the rows before they were removed; the
    // comparator's per-stratum aggregates, which stay, have to agree with them.
    expect(withinRecord.n).toBe(withinStrata.reduce((sum, s) => sum + s.n, 0));
    expect(farFuture.n).toBe(report.byStratum.future.n);
    expect(withinRecord.n + farFuture.n).toBe(report.overall.n);
    expect(withinRecord.caseIds).toHaveLength(withinRecord.n / 10);
    const worstWithin = withinStrata.reduce((a, b) => (b.maxAbsArcsec > a.maxAbsArcsec ? b : a));
    expect(withinRecord.maxAbsArcsec).toBe(worstWithin.maxAbsArcsec);
    expect(withinRecord.worstCase).toEqual({ id: worstWithin.worstCase.id, body: worstWithin.worstCase.body });
    expect(farFuture.worstCase.absArcsec).toBe(report.byStratum.future.maxAbsArcsec);
    expect(farFuture.worstCase.id).toBe(report.byStratum.future.worstCase.id);
    expect(farFuture.worstCase.body).toBe(report.byStratum.future.worstCase.body);
    expect(farFuture.overOneArcminute === 0).toBe(report.byStratum.future.maxAbsArcsec <= 60);
    expect(withinRecord.p50AbsArcsec).toBeLessThanOrEqual(withinRecord.p95AbsArcsec);
    expect(withinRecord.p95AbsArcsec).toBeLessThanOrEqual(withinRecord.maxAbsArcsec);
    // The Moon: every Moon row is either within the record or a far-future
    // case, and the far-future ones are counted, not listed.
    expect(withinRecord.moon.n + farFuture.moon.n).toBe(report.byBody.Moon.n);
    expect(report.byBody.Moon.maxAbsArcsec).toBeGreaterThanOrEqual(withinRecord.moon.maxAbsArcsec);
    expect(farFuture).not.toHaveProperty('moonCases');
  });

  it('quotes the measured distribution, with its denominator and its span', () => {
    expect(withinRecord.n).toBe(160);
    // The statistics carry no date, so the span is taken from the corpus the
    // report was produced from rather than assumed.
    const ids = new Set(withinRecord.caseIds);
    const years = [...corpus.matchAll(/c\('([\w-]+)',\s*'([\w-]+)',\s*'(\d{4})-/gu)]
      .filter(([, id]) => ids.has(id))
      .map(([, , , year]) => Number(year));
    expect(years).toHaveLength(ids.size);
    const span = `from ${Math.min(...years)} to ${Math.max(...years)}`;
    expect(prose, `the page must say "${span}"`)
      .toContain(`Across the ${withinRecord.n} measurements ${span}`);
  });

  it('gives every figure its unit and its place in the sentence', () => {
    const p50 = tenth(withinRecord.p50AbsArcsec);
    const p95 = tenth(withinRecord.p95AbsArcsec);
    const max = tenth(withinRecord.maxAbsArcsec);
    expect(prose).toContain(`the median disagreement in longitude is ${p50} arcseconds`);
    expect(prose).toContain(`the 95th percentile is ${p95} arcseconds`);
    const worst = withinRecord.worstCase;
    const worstYear = /c\('historic-03',[^)]*'(\d{4})-/u.exec(corpus);
    expect(worst.id).toBe('historic-03');
    expect(prose).toContain(`the largest is ${max} arcseconds — ${worst.body} in ${worstYear[1]}`);
  });

  it('states the width of a sign correctly', () => {
    const stated = /A zodiac sign is (\d+) degrees, which is ([\d,]+) arcseconds/u.exec(prose);
    expect(stated, 'the page must state the width it is comparing against').toBeTruthy();
    expect(Number(stated[2].replaceAll(',', ''))).toBe(Number(stated[1]) * 3600);
    expect(Number(stated[1])).toBe(30);
  });

  it('binds the far-future cases to their bodies and epochs, none over an arcminute', () => {
    expect(farFuture.overOneArcminute).toBe(0);
    expect(report.byStratum.future.maxAbsArcsec).toBeLessThan(60);
    expect(farFuture.n).toBe(report.overall.n - withinRecord.n);
    const worst = farFuture.worstCase;
    expect(prose).toContain(`The other ${farFuture.n} measurements are the far-future cases, and none of them`
      + ` reaches one arcminute: the largest is ${tenth(worst.absArcsec)} arcseconds,`
      + ` ${worst.body} at ${yearOf(worst.id)}`);
    // The Moon's far-future cases are no longer quoted one by one: each, with
    // the engine's own Moon beside it, gave Swiss's back.
    expect(prose).not.toMatch(/arcseconds from Swiss at \d{4}/u);
  });

  it("gives the two clocks' difference as statistics over 2100–2199, from the committed run", () => {
    // Statistics over a stated span, never Swiss's ΔT at one date: the run
    // (tools/deltat-gap-zodiacs.mjs and tools/deltat_gap_swiss.py) computes
    // Swiss's ΔT on demand and commits only the extremes, with no daily value
    // and no date for either.
    const installed = JSON.parse(read('node_modules/@zodiacs/engine/package.json')).version;
    expect(gap.engine, 'a new engine needs the run again: tools/deltat-gap-zodiacs.mjs').toBe(installed);
    expect(gap.deltaTTableDigest).toBe(deltaTAt(0).tableDigest);
    expect([gap.from, gap.to, gap.cadenceDays, gap.n]).toEqual(['2100-01-01', '2199-12-31', 1, 36524]);
    expect(Object.keys(gap).sort()).toEqual(['cadenceDays', 'deltaTModel', 'deltaTTable', 'deltaTTableDigest', 'engine',
      'engineSigmaSeconds', 'ephemerisFiles', 'from', 'moonArcsecPerSecond', 'moonOffsetArcsec', 'n', 'node', 'swissBinding',
      'swissCall', 'swissMinusEngineSeconds', 'to', 'what', 'zodiacsDumpSha256']);
    const stated = /From (\d{4}) to (\d{4}) their values differ by ([\d.]+) to ([\d.]+) seconds, inside this engine's own one-sigma uncertainty, which grows from ([\d.]+) to ([\d.]+) seconds over those years/u
      .exec(prose);
    expect(stated, 'the page must give the span, the difference and the band').toBeTruthy();
    const [, from, to, least, most, sigmaFrom, sigmaTo] = stated;
    expect([from, to]).toEqual([gap.from.slice(0, 4), gap.to.slice(0, 4)]);
    expect([least, most]).toEqual([tenth(gap.swissMinusEngineSeconds.min), tenth(gap.swissMinusEngineSeconds.max)]);
    // "Inside" the band: the largest difference is below the smallest σ.
    expect(gap.swissMinusEngineSeconds.min).toBeGreaterThan(0);
    expect(gap.swissMinusEngineSeconds.max).toBeLessThan(gap.engineSigmaSeconds.min);
    // The band is the installed engine's own, at the ends of the span, where
    // it is smallest and largest: σ never decreases.
    const at = (iso) => deltaTAt((Date.parse(iso) - Date.UTC(2000, 0, 1, 12)) / 86_400_000);
    expect(at('2100-01-01T00:00:00Z').sigma).toBeCloseTo(gap.engineSigmaSeconds.min, 3);
    expect(at('2199-12-31T00:00:00Z').sigma).toBeCloseTo(gap.engineSigmaSeconds.max, 3);
    expect([sigmaFrom, sigmaTo]).toEqual([tenth(gap.engineSigmaSeconds.min), tenth(gap.engineSigmaSeconds.max)]);
    // What the difference alone does to the Moon, at the Moon's own speed.
    expect(prose).toMatch(/The Moon moves about half an arcsecond per second of time/u);
    expect(gap.moonArcsecPerSecond.min).toBeGreaterThan(0.45);
    expect(gap.moonArcsecPerSecond.max).toBeLessThan(0.65);
    const moved = /so the difference alone moves it by ([\d.]+) to ([\d.]+) arcseconds/u.exec(prose);
    expect(moved, 'the page must say what the clock alone does to the Moon').toBeTruthy();
    expect([moved[1], moved[2]]).toEqual([tenth(gap.moonOffsetArcsec.min), tenth(gap.moonOffsetArcsec.max)]);
    expect(gap.moonOffsetArcsec.min).toBeGreaterThanOrEqual(gap.swissMinusEngineSeconds.min * gap.moonArcsecPerSecond.min - 0.001);
    expect(gap.moonOffsetArcsec.max).toBeLessThanOrEqual(gap.swissMinusEngineSeconds.max * gap.moonArcsecPerSecond.max + 0.001);
    // And no Swiss value at one date, on either page.
    for (const page of [prose, enginePage]) {
      expect(page).not.toMatch(/Swiss reads ΔT/u);
      expect(page).not.toMatch(/\b93\.\d\b/u);
    }
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

  it('says what agreement with another implementation does not establish', () => {
    expect(prose).toContain('descend from JPL development ephemerides');
    expect(prose).toContain('two implementations agreeing, not a check against observation');
    expect(prose).toContain('where the two ephemerides differ');
    expect(prose).toContain('For the Moon the clock matters more');
  });

  it('names the reference configuration that produced the figures', () => {
    expect(report.isFullSwissConfiguration).toBe(true);
    expect(report.swissBackendsObserved).toEqual(['SWIEPH']);
    const version = /reports library ([\d.]+)/u.exec(read('docs/platform/evidence/swiss-benchmark/CONFIGURATION.md'));
    expect(version, 'CONFIGURATION.md must pin the Swiss library version').toBeTruthy();
    expect(prose).toContain(`Swiss Ephemeris ${version[1]}`);
    expect(prose).toContain(`${report.overall.n / 10} charts × 10 bodies`);
  });

  it('describes the reduction the engine actually performs', () => {
    // The Moon does not go through the light-time and aberration pass the
    // planets do: @zodiacs/engine calls EclipticGeoMoon, astronomy-engine's
    // own lunar path, which applies nutation and nothing else of the three.
    // Every emitted file, not one hashed chunk: a new engine build renames
    // its chunks, and the test must follow the code rather than the name.
    const engineDist = 'node_modules/@zodiacs/engine/dist';
    const engineSource = readdirSync(resolve(root, engineDist))
      .filter((name) => name.endsWith('.js'))
      .map((name) => read(`${engineDist}/${name}`))
      .join('\n');
    expect(engineSource).toMatch(/EclipticGeoMoon\(/u);
    expect(engineSource).toMatch(/GeoVector\(body, time, true\)/u);
    expect(prose).toMatch(/The Moon is the exception/u);
    expect(prose).toMatch(/neither light-time nor aberration/u);
    // …and the page must not go back to claiming all three for everything.
    expect(prose).not.toMatch(/including light-time, aberration, and nutation/u);
  });
});

describe('the same figures on /developers/engine/', () => {
  // The front door repeats the headline; a re-run that moved the distribution
  // has to fail here too, not only on the page that states it at length.
  it('quotes the median and the maximum with their unit and denominator', () => {
    const span = spanOf(withinRecord.caseIds);
    expect(enginePage).toContain(`across the ${withinRecord.n} measurements ${span}`);
    expect(enginePage).toContain(`the median disagreement in ecliptic longitude is ${tenth(withinRecord.p50AbsArcsec)} arcseconds`);
    expect(enginePage).toContain(`the largest is ${tenth(withinRecord.maxAbsArcsec)} arcseconds`);
  });

  it('gives the far-future clock difference and what it does to the Moon from the same statistics', () => {
    expect(enginePage).toContain(`from ${gap.from.slice(0, 4)} to ${gap.to.slice(0, 4)} their ΔT values differ by`
      + ` ${tenth(gap.swissMinusEngineSeconds.min)} to ${tenth(gap.swissMinusEngineSeconds.max)} seconds,`
      + ` which alone moves the Moon by ${tenth(gap.moonOffsetArcsec.min)} to ${tenth(gap.moonOffsetArcsec.max)} arcseconds`);
    expect(enginePage).not.toMatch(/arcseconds from Swiss at \d{4}/u);
  });

  it('says the package bounds its input date only where its ephemeris ends, because it does', async () => {
    // The page used to say the engine accepts 1800-2199. That is this site's
    // own form validation (src/lib/share.ts). Up to rc.13 the package rejected
    // nothing; since rc.14 it refuses only instants outside EPHEMERIS_SPAN,
    // the years astronomy-engine tabulates.
    expect(enginePage).toMatch(/bounds its input date only where its ephemeris ends/u);
    expect(enginePage).toContain('outside Terrestrial Time 0001-04-30 to 3998-09-03 throws a RangeError');
    expect(enginePage).not.toMatch(/does not bound its input date|the engine accepts dates from 1800 to 2199/u);
    const packaged = read('node_modules/@zodiacs/engine/dist/index.js')
      + read('node_modules/@zodiacs/engine/dist/index.d.ts');
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
    expect(packaged).toMatch(/outside-reference-span/u);
    expect(enginePage).toContain('outside 1800–2200 it carries the outside-reference-span flag');
  });

  it('says what agreement with another implementation does not establish', () => {
    expect(enginePage).toContain('descend from JPL development ephemerides');
    expect(enginePage).toContain('two implementations agreeing rather than a check against observation');
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
    const core = read('node_modules/@zodiacs/engine/dist/index.js');
    expect(core, 'the core must stay offline').not.toMatch(/globalThis\.fetch|createGeoNamesClient/u);
    expect(enginePage).toMatch(/GeoNames place-lookup client/u);
    expect(enginePage).toMatch(/makes\s+HTTP requests/u);
  });
});

describe('the every-tenth-day comparison, 1800 to 2199', () => {
  // Statistics only: the per-instant Swiss values stay out of the repository.
  const dense = JSON.parse(read('docs/platform/evidence/swiss-benchmark/multiyear-1800-2199.json'));
  const upTo2026 = dense.allBodiesLongitude.sameUt['1800-2026'];
  const moonSameTt = dense.sameTt.Moon.lon.byEra['2150-2199'];
  const moonSameUt = dense.sameUt.Moon.lon.byEra['2150-2199'];
  const worstYear = upTo2026.maxAt.slice(0, 4);

  it('was measured on the engine the site runs, with every call answered from the Swiss data files', () => {
    const installed = JSON.parse(read('node_modules/@zodiacs/engine/package.json')).version;
    expect(dense.engine, 'a new engine needs the run again: tools/multiyear-zodiacs.mjs').toBe(installed);
    expect(dense.swissBackendsObserved).toEqual(['SWIEPH']);
    expect([dense.instants, dense.cadenceDays, dense.from, dense.to]).toEqual([14610, 10, '1800-01-01', '2199-12-31']);
    expect(upTo2026.n).toBe(8291 * 11);
  });

  it('gives the page its worst case up to 2026, and the width of sign edge that follows from it', () => {
    expect(prose).toContain(`Up to 2026 that is ${upTo2026.n.toLocaleString('en-US')} comparisons,`
      + ` with a median of ${tenth(upTo2026.p50)} arcseconds and a largest of ${tenth(upTo2026.max)} arcseconds`
      + ` — ${upTo2026.maxBody} in ${worstYear}`);
    expect(prose).toContain(`changes a sign only for a body within ${Math.round(upTo2026.max)} arcseconds of its edge`);
    expect(enginePage).toContain(`the median is ${tenth(upTo2026.p50)} arcseconds and the largest`
      + ` ${tenth(upTo2026.max)} arcseconds (${upTo2026.maxBody}, ${worstYear})`);
  });

  it('gives the far-future Moon at the same TT and at the same UT, each with its own figure', () => {
    // At the same TT the clock is out and only the positions remain; at the same
    // UT the two programs' extrapolated clocks come back in.
    expect(moonSameTt.max).toBeLessThan(10);
    expect(moonSameUt.max).toBeGreaterThan(moonSameTt.max);
    expect(prose).toContain(`the Moon stays within ${tenth(moonSameTt.max)} arcseconds from 2150 to 2199,`
      + ` and at the same UT within ${tenth(moonSameUt.max)} arcseconds`);
    expect(enginePage).toContain(`Terrestrial Time, which takes the clock out, it stays within ${tenth(moonSameTt.max)}`
      + ' arcseconds from 2150 to 2199');
  });
});
