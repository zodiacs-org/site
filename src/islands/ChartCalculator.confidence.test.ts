import { readFileSync } from 'node:fs';
import { Fragment, h } from 'preact';
import { render } from 'preact-render-to-string';
import ts from 'typescript';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as actualEngine from '../lib/engine/full';
import * as actualReceipt from '../lib/engine/calculator-receipt';
import * as actualNotices from '../lib/chart-notices';
import { localDateContainsUtc, offsetAt, prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import { assessLocalDateReference } from '../lib/time/local-date-reference';
import type { CompleteTransitionProvider } from '../lib/time/local-date-intervals';
import { localDateMoonSigns } from '../lib/moon-day-bounds';
import { moonAspectsUnsettled, moonCandidates, moonDegreeUnsettled, moonIsUncertain, moonLabel, moonNoticeKey } from '../lib/moon-certainty';
import { formatLongitude, signBySlug, signForLongitude, signName } from '../lib/signs';
import { signIcon } from '../lib/sign-icon';
import { localizePath, t } from '../lib/i18n';
import { aspectLabel, planetLabel } from '../lib/i18n/astrology';
import { houseOf } from '../lib/engine/houses';
import { chartWeather, topAspects } from '../lib/natal';
import { deriveChapters, deriveFirstReading, flattenStops } from '../lib/scene/chapters';
import ReadingPath, { type ReadingPathPlacement } from './explorer/ReadingPath';
import Inspector from './explorer/Inspector';
import ChartTour from './explorer/tour/ChartTour';
import { buildChartContext } from '../lib/chart-context';
import { approachRead } from '../lib/approach';
import { communicationRead } from '../lib/communication';
import { chartSignature } from '../lib/chart-signature';
import { buildSceneModel } from '../lib/scene/build';
import type { EntityRef } from '../lib/scene/types';
import { bigThreePlacements, communicationCardContent, approachCardContent } from '../lib/share-card';
import { encodePositionsLink, decodePositionsLink } from '../lib/share-positions';
import { positionsReading } from '../lib/share-positions-reading';
import type { Aspect, Chart, ChartInput } from '../lib/engine/types';

// Execute the actual caller's calculation/confidence statements. The separate
// native driver exercises the complete component and its rendered actions.
const source = readFileSync(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('ChartCalculator.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let run: ts.FunctionDeclaration | undefined;
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'runChart') run = node;
  ts.forEachChild(node, visit);
}
visit(ast);
const statements = run!.body!.statements.find(ts.isTryStatement)!.tryBlock.statements;
const first = statements.findIndex(node => node.getText(ast).startsWith('const effectiveTime ='));
const end = statements.findIndex(node => node.getText(ast).startsWith('const owner: ChartResultOwner ='));
if (first < 0 || end <= first) throw Error('Chart calculation block not found');
// Stop before result ownership/state is committed; current-run checks remain.
const calculation = statements.slice(first, end).map(node => node.getText(ast)).join('\n');
// The block awaits the Moon's date limits, so it runs as an async function.
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (context: object) => Promise<object>;
const execute = new AsyncFunction('context', `with(context){${ts.transpile(calculation, {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
})}; return {result, portable, resolved, nextMoonAmbiguous};}`);
/** One of ChartCalculator's memos, `const name = useMemo(() => ..., deps)`, run on its own. */
function componentMemo<T>(name: string): (context: object) => T {
  let memo: ts.ArrowFunction | undefined;
  (function find(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer
      && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === 'useMemo'
      && ts.isArrowFunction(node.initializer.arguments[0])) memo = node.initializer.arguments[0];
    ts.forEachChild(node, find);
  })(ast);
  if (!memo) throw Error(`${name} memo not found`);
  const code = ts.transpile(`const memo = ${memo.getText(ast)};`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
  return new Function('context', `with(context){${code}; return memo();}`) as (context: object) => T;
}
/** One of ChartCalculator's JSX expressions, `{expression}`, found by how it begins, rendered on its own. */
function componentJsx(start: string): (context: object) => ReturnType<typeof h> {
  let found: ts.JsxExpression | undefined;
  (function find(node: ts.Node) {
    if (!found && ts.isJsxExpression(node) && node.expression?.getText(ast).startsWith(start)) found = node;
    ts.forEachChild(node, find);
  })(ast);
  if (!found) throw Error(`JSX expression ${start} not found`);
  const code = ts.transpile(`const node = (${found.expression!.getText(ast)});`, {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React, jsxFactory: 'h', jsxFragmentFactory: 'Fragment',
  }, 'expression.tsx');
  return new Function('context', `with(context){${code}; return node;}`) as (context: object) => ReturnType<typeof h>;
}
/** One of ChartCalculator's inner functions, `function name(...) {...}`, run on its own. */
function componentFunction<T>(name: string): (context: object) => T {
  let found: ts.FunctionDeclaration | undefined;
  (function find(node: ts.Node) {
    if (!found && ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, find);
  })(ast);
  if (!found) throw Error(`${name} function not found`);
  const code = ts.transpile(found.getText(ast), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
  return new Function('context', `with(context){${code}; return ${name};}`) as (context: object) => T;
}
const input = (date: string, zone: string, known = false) => ({ date, time: '12:00', timeKnown: known,
  city: { name: 'Synthetic place', tz: zone, lat: 43.65, lon: -79.38 }, houseSystem: 'whole' });
async function capture(value: ReturnType<typeof input>, mode = 'full', fallback = false, assess = assessLocalDateReference) {
  const calls = { publicNatal: 0, legacyNatal: 0, endpoints: 0, moonSamples: 0 };
  const receiptModule = fallback || mode !== 'full' ? undefined : { computeCalculatorReceipt: (...args: Parameters<typeof actualReceipt.computeCalculatorReceipt>) => {
    const result = actualReceipt.computeCalculatorReceipt(...args); if (result) calls.publicNatal++; return result;
  } };
  const engine = { ...actualEngine, computeChart: (arg: ChartInput) => {
    calls.legacyNatal++; return actualEngine.computeChart(arg);
  }, computeBodies: () => { calls.endpoints++; throw Error('Unexpected endpoint calculation'); },
  bodyLongitude: (...args: Parameters<typeof actualEngine.bodyLongitude>) => {
    if (args[0] !== 'Moon') throw Error('Unexpected body calculation');
    calls.moonSamples++; return actualEngine.bodyLongitude(...args);
  } };
  const result = await execute({ input: value, mode, locale: 'en', engine, receiptModule, noticesModule: actualNotices, resolveLocalToUtc, assessLocalDateReference: assess,
    localDateMoonSigns, signForLongitude, moonIsUncertain, runIsCurrent: () => true,
    localDateReferenceFailure: new Error('local-date reference refused'),
  });
  return { ...result, calls } as { result: Chart; portable: ReturnType<typeof actualReceipt.computeCalculatorReceipt>;
    resolved: ReturnType<typeof resolveLocalToUtc>; nextMoonAmbiguous: boolean; calls: typeof calls };
}
function reference(value: ReturnType<typeof input>) {
  const resolved = resolveLocalToUtc(value.date, value.timeKnown ? value.time : '12:00', value.city.tz, { longitude: value.city.lon });
  return actualReceipt.computeCalculatorReceipt({ utc: resolved.utc, latitude: value.city.lat, longitude: value.city.lon,
    houseSystem: 'whole', timeKnown: value.timeKnown, flags: resolved.flags }, {
    date: value.date, time: value.timeKnown ? value.time : '12:00', timeZone: value.city.tz,
    offsetMinutes: resolved.offsetMinutes, reference: value.timeKnown ? 'supplied-instant' : 'local-noon',
  })!;
}
function positions(chart: Chart) {
  return encodePositionsLink({ bodies: chart.bodies, angles: chart.angles, houseSystem: 'whole', engineVersion: chart.engineVersion })!;
}
/** Test-only complete transitions from the host's Intl offsets: an hourly scan, bisected to the millisecond. */
const intlProvider: CompleteTransitionProvider = {
  completeness: 'complete-transitions-v1',
  offsetMilliseconds: (zone, instant) => Math.round(offsetAt(zone, instant) * 60_000),
  nextTransitionMilliseconds(zone, after) {
    const hour = 3_600_000, offset = (instant: number) => Math.round(offsetAt(zone, instant) * 60_000), base = offset(after);
    for (let probe = after + hour; probe <= after + 80 * hour; probe += hour) {
      if (offset(probe) === base) continue;
      let low = probe - hour, high = probe;
      while (high - low > 1) { const middle = Math.floor((low + high) / 2); if (offset(middle) === base) low = middle; else high = middle; }
      return high;
    }
    return null;
  },
};
const coverage = {
  complete: (date: string, utc: Date, zone: string) => assessLocalDateReference(date, utc, zone, intlProvider),
  unavailable: (date: string, utc: Date, zone: string) => assessLocalDateReference(date, utc, zone, null),
};
const title = (slug: string) => slug[0].toUpperCase() + slug.slice(1);
// The Moon's signs over each date with the host's complete transitions, then without them.
const controls = [
  ['Toronto omitted member', '1919-03-31', 'America/Toronto', ['pisces', 'aries'], []],
  ['Juneau repeated member', '1867-10-18', 'America/Juneau', [], []],
  ['ordinary singleton', '1990-01-04', 'Asia/Bangkok', ['aries'], ['aries']],
  ['ordinary two signs', '1990-01-01', 'Europe/London', ['aquarius', 'pisces'], ['aquarius', 'pisces']],
  ['non-hour gap day', '2012-10-07', 'Australia/Lord_Howe', ['gemini', 'cancer'], ['gemini', 'cancer']],
  ['repeated Apia date', '1892-07-04', 'Pacific/Apia', ['libra', 'scorpio'], []],
] as const;

describe('ChartCalculator reference confidence', () => {
  // The calculator awaits this before its calculation block, which runs here alone.
  beforeAll(() => Promise.all(['America/Toronto', 'America/Juneau', 'Pacific/Apia', 'Asia/Bangkok', 'Europe/London', 'Australia/Lord_Howe']
    .map((zone) => prepareLocalTime('1800-01-01', zone))));
  it.each(['complete', 'unavailable', 'failed'] as const)('keeps reference receipt bytes with %s date coverage, and its Moon signs come only from that coverage', async state => {
    const value = input('1990-06-15', 'UTC'), expected = reference(value);
    const provider = state === 'unavailable' ? null : {
      completeness: 'complete-transitions-v1' as const,
      offsetMilliseconds: () => 0,
      nextTransitionMilliseconds: () => { if (state === 'failed') throw Error('private'); return null; },
    };
    const assess = vi.fn((date: string, utc: Date, zone: string) => assessLocalDateReference(date, utc, zone, provider));
    const actual = await capture(value, 'full', false, assess);
    expect(assess).toHaveBeenCalledOnce();
    expect(assess.mock.results[0].value.coverage.status).toBe(state === 'complete' ? 'existing' : 'unresolved');
    expect(actual.portable!.envelopeJson).toBe(expected.envelopeJson);
    expect(positions(actual.result)).toBe(positions(expected.chart));
    // One UTC day, in Pisces throughout: from the host's transitions, or from
    // the engine's midnights when there are none; nothing from a failed provider.
    expect(actual.result.moonSignCandidates).toEqual(state === 'failed' ? [] : ['pisces']);
    expect(actual.nextMoonAmbiguous).toBe(state === 'failed');

    expect(actual.result).not.toHaveProperty('coverage');
    expect(actual.calls).toMatchObject({ publicNatal: 1, legacyNatal: 0, endpoints: 0 });
    expect(actual.calls.moonSamples > 0).toBe(state !== 'failed');
  });

  it.each(['full', 'moon', 'rising'])('does no coverage work for known-time %s requests', async mode => {
    const assess = vi.fn(() => { throw Error('Coverage must not run for known time'); });
    const actual = await capture(input('2011-12-30', 'Pacific/Apia', true), mode, false, assess);
    expect(actual.result).toBeTruthy();
    expect(assess).not.toHaveBeenCalled();
    expect(actual.calls.moonSamples).toBe(0);
  });

  it('refuses a provider violation before receipt calculation even when the point belongs to the date', async () => {
    const receipt = vi.spyOn(actualReceipt, 'computeCalculatorReceipt');
    const assess = (date: string, utc: Date, zone: string) => assessLocalDateReference(date, utc, zone, {
      completeness: 'complete-transitions-v1', offsetMilliseconds: () => 0,
      nextTransitionMilliseconds: () => 0, // nonadvancing; contradictory provider evidence
    });
    try {
      await expect(capture(input('1990-06-15', 'UTC'), 'full', false, assess)).rejects.toThrow('local-date reference refused');
      expect(receipt).not.toHaveBeenCalled();
    } finally { receipt.mockRestore(); }
  });

  it.each(['outside-date', 'unresolved'] as const)('refuses %s coverage adjudication before natal or receipt work', async referenceStatus => {
    const assess = vi.fn(() => ({ referenceStatus, coverage: { status: 'unresolved' as const, reason: 'provider-violation' as const }, evidence: null }));
    await expect(capture(input('1990-06-15', 'UTC'), 'full', false, assess)).rejects.toThrow('local-date reference refused');
    expect(assess).toHaveBeenCalledOnce();
  });

  it.each(controls.flatMap(([name, date, zone, complete, unavailable]) => [
    [name, 'complete', date, zone, complete], [name, 'unavailable', date, zone, unavailable],
  ] as const))('%s keeps exact reference bytes and, with %s coverage, takes its Moon signs from the date limits', async (_name, path, date, zone, signs) => {
    const value = input(date, zone), expected = reference(value), actual = await capture(value, 'full', false, coverage[path]);
    const { moonSignCandidates, ...numerical } = actual.result;
    expect(JSON.stringify(numerical)).toBe(JSON.stringify(expected.chart));
    expect(actual.portable!.envelopeJson).toBe(expected.envelopeJson);
    expect(positions(actual.result)).toBe(positions(expected.chart));
    expect(moonSignCandidates).toEqual(signs);
    expect(actual.nextMoonAmbiguous).toBe(signs.length !== 1);

    expect(actual.calls).toMatchObject({ publicNatal: 1, legacyNatal: 0, endpoints: 0 });
    const referenceMoon = signForLongitude(actual.result.bodies.find(row => row.body === 'Moon')!.lon).slug;
    if (signs.length) expect(signs).toContain(referenceMoon);
    expect(moonLabel(actual.result)).toBe(signs.length ? signs.map(title).join(' / ') : 'Needs a birth time');
    const context = buildChartContext({ ...actual.result, timeKnown: false });
    expect(context.placements.find(row => row.body === 'Moon')).toMatchObject(signs.length === 1
      ? { status: 'established', sign: signs[0], conditionalSigns: [] }
      : { status: 'unresolved', sign: null, conditionalSigns: signs, dignities: [] });
    expect(context.placements.find(row => row.body === 'Sun')!.status).toBe('reference');
  });

  it.each([
    ['1919-03-31', 'America/Toronto', '1919-03-31T04:30:00Z', 'pisces', 'aries', ['pisces', 'aries']],
    ['1867-10-18', 'America/Juneau', '1867-10-19T00:31:13Z', 'cancer', 'gemini', []],
  ] as const)('retains the real contradictory member for %s without inventing a single sign', async (date, zone, instant, memberSign, referenceSign, completeSigns) => {
    expect(localDateContainsUtc(date, new Date(instant), zone)).toBe(true);
    expect(signForLongitude(actualEngine.bodyLongitude('Moon', new Date(instant))).slug).toBe(memberSign);
    for (const [assess, expected] of [
      [assessLocalDateReference, []],
      [coverage.complete, completeSigns],
      [coverage.unavailable, []],
    ] as const) {
      const actual = await capture(input(date, zone), 'full', false, assess);
      expect(signForLongitude(actual.result.bodies.find(row => row.body === 'Moon')!.lon).slug).toBe(referenceSign);
      expect(moonCandidates(actual.result)).toEqual(expected);
    }
  });

  it.each([
    ['1867-10-18', 'America/Juneau', '1867-10-17T20:57:41.000Z', ['lmt']],
    ['1892-07-04', 'Pacific/Apia', '1892-07-03T23:26:56.000Z', ['dst-fold', 'lmt']],
  ])('keeps the zone clock for %s in %s, hours from the synthetic longitude', async (date, zone, instant, flags) => {
    // Toronto's longitude is outside the bound on a birthplace's departure
    // from the zone's mean time, so these controls keep the zone's clock, as
    // a reading without a longitude does: the zone's own local mean time,
    // `lmt` (the flag's meaning since engine rc.15).
    const actual = await capture(input(date, zone));
    const zoneClock = resolveLocalToUtc(date, '12:00', zone);
    expect(actual.resolved).toEqual(zoneClock);
    expect(actual.resolved.utc.toISOString()).toBe(instant);
    expect(actual.resolved.flags).toEqual(flags);
    expect(actual.resolved.localMeanTime).toBeUndefined();
  });

  it.each(['full', 'moon', 'rising'])('preserves known-time numerical, receipt and confidence behavior in %s mode', async mode => {
    const value = input('1990-06-15', 'America/Toronto', true), expected = reference(value), actual = await capture(value, mode);
    // The legacy adapter preserves caller input/property identity, while the
    // portable adapter owns a normalized snapshot. Compare each existing path
    // to itself rather than silently reordering either serialized input.
    const expectedChart = mode === 'full' ? expected.chart : actualEngine.computeChart({
      utc: actual.resolved.utc, latitude: value.city.lat, longitude: value.city.lon,
      houseSystem: 'whole', timeKnown: true, flags: actual.resolved.flags,
    });
    expect(JSON.stringify(actual.result)).toBe(JSON.stringify(expectedChart));
    if (mode === 'full') expect(actual.portable!.envelopeJson).toBe(expected.envelopeJson);
    else expect(actual.portable).toBeUndefined();
    expect(actual.nextMoonAmbiguous).toBe(false);
    expect(moonCandidates(actual.result)).toHaveLength(1);

    expect(actual.calls).toEqual({ publicNatal: mode === 'full' ? 1 : 0, legacyNatal: mode === 'full' ? 0 : 1, endpoints: 0, moonSamples: 0 });
  });

  it('preserves reference fallback and C014 refusal, without extra endpoint work', async () => {
    const actual = await capture(input('1990-01-04', 'Asia/Bangkok'), 'full', true, coverage.unavailable);
    expect(actual.portable).toBeUndefined(); expect(actual.result.moonSignCandidates).toEqual(['aries']);
    expect(actual.calls).toMatchObject({ publicNatal: 0, legacyNatal: 1, endpoints: 0 });
    await expect(capture(input('2011-12-30', 'Pacific/Apia'))).rejects.toThrow('local-date reference refused');
    expect((await capture(input('2011-12-31', 'Pacific/Apia'))).result).toBeTruthy();
  });

  it.each(controls.slice(0, 2))('%s propagates unresolved confidence through advice, scene and sharing', async (_name, date, zone) => {
    const chart = (await capture(input(date, zone))).result;
    expect(approachRead(chart).moon).toBeNull();
    const communication = communicationRead(chart);
    expect(communication.moonSign).toBeNull();
    expect(communication.aspects.every(row => row.target !== 'Moon')).toBe(true);
    expect(chartSignature(chart)).toEqual(chartSignature({ ...chart,
      bodies: chart.bodies.filter(row => row.body !== 'Moon'), aspects: chart.aspects.filter(row => row.a !== 'Moon' && row.b !== 'Moon') }));
    expect(buildSceneModel(chart).moonSignCandidates).toEqual([]);
    expect(bigThreePlacements(chart).find(row => row.kind === 'moon')).toMatchObject({ sign: 'Needs a birth time', slug: '', uncertain: true });
    for (const content of [communicationCardContent(chart), approachCardContent(chart)]) {
      expect(content.rows.find(row => row.body === 'Moon')).toMatchObject({ sign: 'Needs a birth time', reading: 'Needs a birth time' });
    }
    const received = decodePositionsLink(positions(chart))!;
    expect(received).not.toHaveProperty('moonSignCandidates'); expect(received.angles).toBeNull();
    expect(moonCandidates(received)).toEqual([]);
    expect(positionsReading(received).topAspects.every(row => row.a !== 'Moon' && row.b !== 'Moon')).toBe(true);
  });

  it('carries one verified Moon sign, or both signs of a crossing, into advice, scene and cards, never into the positions link', async () => {
    const single = (await capture(input('1990-01-04', 'Asia/Bangkok'), 'full', false, coverage.unavailable)).result;
    expect(approachRead(single).moon?.sign).toBe('aries');
    expect(communicationRead(single).moonSign).toBe('aries');
    expect(buildSceneModel(single).moonSignCandidates).toEqual(['aries']);
    const singleMoon = bigThreePlacements(single).find(row => row.kind === 'moon');
    expect(singleMoon).toMatchObject({ sign: 'Aries', slug: 'aries' });
    expect(singleMoon).not.toHaveProperty('uncertain');

    const pair = (await capture(input('1990-01-01', 'Europe/London'), 'full', false, coverage.unavailable)).result;
    expect(approachRead(pair).moon).toBeNull();
    expect(communicationRead(pair).moonSign).toBeNull();
    expect(communicationRead(pair).aspects.every(row => row.target !== 'Moon')).toBe(true);
    expect(buildSceneModel(pair).moonSignCandidates).toEqual(['aquarius', 'pisces']);
    expect(bigThreePlacements(pair).find(row => row.kind === 'moon')).toMatchObject({ sign: 'Aquarius / Pisces', slug: '', uncertain: true });
    for (const content of [communicationCardContent(pair), approachCardContent(pair)]) {
      expect(content.rows.find(row => row.body === 'Moon')).toMatchObject({ sign: 'Aquarius / Pisces', reading: 'Needs a birth time' });
    }

    for (const chart of [single, pair]) {
      // The link carries positions only, so its receiver keeps the Moon unresolved.
      const received = decodePositionsLink(positions(chart))!;
      expect(received).not.toHaveProperty('moonSignCandidates'); expect(received.angles).toBeNull();
      expect(moonCandidates(received)).toEqual([]);
      expect(positionsReading(received).topAspects.every(row => row.a !== 'Moon' && row.b !== 'Moon')).toBe(true);
    }
  });
});

describe('an untimed Moon sign verified across the birth date', () => {
  // The calculator awaits this before its calculation block, which runs here alone.
  beforeAll(() => prepareLocalTime('1990-01-04', 'Asia/Bangkok'));
  type Reading = { ps: ReadingPathPlacement[]; top: Aspect[]; weather: ReturnType<typeof chartWeather> };
  const placementsMemo = componentMemo<Array<Chart['bodies'][number] & { label: string; house: number | null }>>('placements');
  const readingMemo = componentMemo<Reading>('reading');
  /** The main reading as ChartCalculator derives it for the page, from the page's own memos. */
  function pageReading(chart: Chart) {
    const placements = placementsMemo({ chart, locale: 'en', formatLongitude, houseOf });
    return readingMemo({ chart, mode: 'full', placements, chartActionDockModule: { topAspects, chartWeather },
      signForLongitude, moonIsUncertain, moonAspectsUnsettled });
  }
  const withMoon = (aspect: Pick<Aspect, 'a' | 'b'>) => aspect.a === 'Moon' || aspect.b === 'Moon';
  const moonNeptuneSquare = (aspect: Aspect) => aspect.type === 'square' && [aspect.a, aspect.b].sort().join() === 'Moon,Neptune';
  const BANGKOK = { name: 'Bangkok', tz: 'Asia/Bangkok', lat: 13.7563, lon: 100.5018 };
  const untimed = { ...input('1990-01-04', 'Asia/Bangkok'), city: BANGKOK };
  // The same instant, local noon, with the time known: the control the gate is measured against.
  const timed = { ...untimed, timeKnown: true };

  function tour(chart: Chart, variant: 'quick' | 'full', chapter: string, sub?: string) {
    const scene = buildSceneModel(chart);
    const chapters = variant === 'quick' ? deriveFirstReading(scene) : deriveChapters(scene);
    const initialStep = flattenStops(chapters).findIndex((stop) => chapters[stop.chapter].id === chapter
      && (sub === undefined || chapters[stop.chapter].subs[stop.sub]?.id === sub));
    expect(initialStep).toBeGreaterThan(-1);
    return render(h(ChartTour, {
      scene, chart, locale: 'en', variant, initialStep, selection: null,
      loadEngine: () => import('../lib/engine/full'), buildScene: buildSceneModel, renderInspector: () => null,
      topAspects, readAspect: (a: string, type: string, b: string) => `Natal reading of ${a} ${type} ${b}.`, readHouse: () => '',
      onSelect: () => {}, onAnnounce: () => {}, onVisual: () => {}, onEnsure: () => {}, onTrack: () => {},
      onSave: () => {}, shareLabel: 'Share', shareStatusLabel: 'Share', shareDisabled: true,
      onShare: () => {}, onExit: () => {}, returnFocus: () => {},
    }));
  }
  const loudest = (markup: string) => /<ul class="tour__loudest">([\s\S]*?)<\/ul>/.exec(markup)![1];

  it('verifies Aries for 1990-01-04 in Bangkok whatever the date coverage, while noon’s Moon square Neptune is not the date’s', async () => {
    for (const assess of [assessLocalDateReference, coverage.complete, coverage.unavailable]) {
      const { result, nextMoonAmbiguous } = await capture(untimed, 'full', false, assess);
      expect(result.moonSignCandidates).toEqual(['aries']);
      expect(nextMoonAmbiguous).toBe(false);
    }
    const chart = (await capture(untimed)).result;
    expect(chart.input.timeKnown).toBe(false);
    expect(chart.input.utc.toISOString()).toBe('1990-01-04T05:00:00.000Z');
    expect(moonLabel(chart)).toBe('Aries');
    expect(chart.aspects.find(moonNeptuneSquare)).toMatchObject({ a: 'Moon', b: 'Neptune' });
    // 00:00 in Bangkok is the date's first instant; the Moon, at 3° Aries then, is not yet square Neptune.
    const first = new Date('1990-01-03T17:00:00Z');
    expect(localDateContainsUtc('1990-01-04', first, 'Asia/Bangkok')).toBe(true);
    expect(localDateContainsUtc('1990-01-04', new Date(first.getTime() - 1), 'Asia/Bangkok')).toBe(false);
    const dateStart = actualEngine.computeChart({ utc: first, latitude: BANGKOK.lat, longitude: BANGKOK.lon, houseSystem: 'whole', timeKnown: false });
    expect(signForLongitude(dateStart.bodies.find((row) => row.body === 'Moon')!.lon).slug).toBe('aries');
    expect(dateStart.aspects.some(moonNeptuneSquare)).toBe(false);
    // The numerical reference chart keeps every aspect it found.
    expect(JSON.stringify(chart.aspects)).toBe(JSON.stringify(reference(untimed).chart.aspects));
  });

  it('keeps noon-only Moon aspects out of the main reading, which still names the Moon in Aries', async () => {
    const chart = (await capture(untimed)).result;
    const reading = pageReading(chart);
    expect(reading.top).toHaveLength(4);
    expect(reading.top.some(withMoon)).toBe(false);
    expect(reading.ps.some((row) => row.body === 'Moon')).toBe(true);
    const props = { placements: reading.ps, topAspects: reading.top, weather: reading.weather, risingLon: null,
      housesKnown: false, moonSignCandidates: moonCandidates(chart), timeKnown: false, onShowOnChart: () => {} };
    const markup = render(h(ReadingPath, props));
    expect(markup).toContain('Show on chart: Moon in Aries');
    expect(markup).toContain('/learn/placements/moon-in-aries/');
    expect(markup).toContain('Moon aspects need a birth time and are left out of this reading.');
    expect(markup).not.toMatch(/Moon (?:square|trine|sextile|conjunction|opposition) |(?:square|trine|sextile|conjunction|opposition) Moon/);
    // ReadingPath holds the line itself, even when handed the noon chart's Moon aspects.
    const handed = render(h(ReadingPath, { ...props, topAspects: topAspects(chart.aspects, 4) }));
    expect(topAspects(chart.aspects, 4).filter(withMoon).map((row) => `${row.a} ${row.type} ${row.b}`))
      .toEqual(['Moon trine Mars', 'Moon square Neptune']);
    expect(handed).not.toContain('Moon trine Mars');
    expect(handed).not.toContain('Moon square Neptune');

    // With the time known the same instant's Moon aspects are the chart's, and the reading names them.
    const known = (await capture(timed)).result;
    expect(pageReading(known).top.filter(withMoon).map((row) => `${row.a} ${row.type} ${row.b}`))
      .toEqual(['Moon trine Mars', 'Moon square Neptune']);
  });

  it('keeps noon-only Moon aspects out of the guided tour, the signature, the inspector and the communication read', async () => {
    const chart = (await capture(untimed)).result;
    const known = (await capture(timed)).result;

    // The quick tour's one aspect, and the full tour's loudest four.
    expect(tour(known, 'quick', 'first-aspect')).toContain('Natal reading of Moon trine Mars.');
    const quick = tour(chart, 'quick', 'first-aspect');
    expect(quick).toContain('Natal reading of Sun conjunction Neptune.');
    expect(quick).not.toMatch(/Natal reading of (?:Moon \w+ \w+|\w+ \w+ Moon)\./);
    expect(loudest(tour(known, 'full', 'aspects'))).toContain('Moon');
    expect(loudest(tour(chart, 'full', 'aspects'))).not.toContain('Moon');
    // The tour still names the verified sign.
    expect(tour(chart, 'quick', 'first-big-three')).toContain('Aries');

    // The signature: the noon chart's tightest flowing contact is Moon trine Mars, which needs the time.
    expect(chartSignature(known)).toMatchObject({ kind: 'aspect', title: 'Moon trine Mars' });
    const signature = chartSignature(chart);
    expect(signature.bodies).not.toContain('Moon');
    expect(`${signature.title} ${signature.summary} ${signature.detail}`).not.toMatch(/Moon/);
    expect(signature).toEqual(chartSignature({ ...chart, aspects: chart.aspects.filter((row) => !withMoon(row)) }));

    // The inspector reads a selected Moon aspect only with the time.
    const square = chart.aspects.find(moonNeptuneSquare)!;
    const selection = { kind: 'aspect' as const, a: square.a, b: square.b, type: square.type };
    const inspect = (source: Chart) => render(h(Inspector, { scene: buildSceneModel(source), selection, onSelect: () => {}, locale: 'en' }));
    expect(inspect(known)).toContain('How it works here');
    const inspected = inspect(chart);
    expect(inspected).not.toContain('How it works here');
    expect(inspected).toContain('Moon · Aries · Needs a birth time');

    // A Mercury contact with the Moon, were there one at noon, stays out of the communication read too.
    const contact: Aspect = { a: 'Mercury', b: 'Moon', type: 'trine', orb: 0.5, applying: false };
    expect(communicationRead({ ...known, aspects: [contact] }).aspects.map((row) => row.target)).toEqual(['Moon']);
    expect(communicationRead({ ...chart, aspects: [contact] }).aspects).toEqual([]);
    expect(communicationRead(chart).moonSign).toBe('aries');
  });

  it('names the verified Moon sign without noon’s degree in the hero and the full tour, which give the degree with the time', async () => {
    const heroCards = componentMemo<Array<{ kind: string; title: string; lon: number | null }>>('heroCards');
    const heroMarkup = componentJsx('heroCards.map(');
    /** The page's big three cards, each as rendered. */
    function hero(source: Chart, mode: 'full' | 'moon') {
      const sun = source.bodies.find((row) => row.body === 'Sun');
      const moon = source.bodies.find((row) => row.body === 'Moon');
      const cards = heroCards({ chart: source, mode, sun, moon, asc: source.angles?.asc ?? null, locale: 'en', t });
      const markup = render(h(Fragment, null, heroMarkup({
        h, Fragment, chart: source, heroCards: cards, locale: 'en', t, moonIsUncertain, moonDegreeUnsettled, moonLabel,
        moonCandidates, localizePath, signName, signBySlug, signForLongitude, signIcon, formatLongitude,
        showsEnglishInterpretation: true, readBigThree: null,
      })));
      return markup.split(/(?=<div class="three-card )/u).filter(Boolean);
    }
    const chart = (await capture(untimed)).result;
    const known = (await capture(timed)).result;
    const noon = formatLongitude(chart.bodies.find((row) => row.body === 'Moon')!.lon, 'en');
    expect(noon).toMatch(/^\d+°\d{2}′ Aries$/u);
    expect(formatLongitude(known.bodies.find((row) => row.body === 'Moon')!.lon, 'en')).toBe(noon);

    for (const mode of ['full', 'moon'] as const) {
      const cards = hero(chart, mode);
      const moonCard = cards.find((card) => card.includes('data-moon-sign-only'))!;
      expect(cards.filter((card) => card.includes('data-moon-sign-only'))).toHaveLength(1);
      expect(moonCard).toContain(mode === 'full' ? 'Moon' : 'Your Moon sign');
      expect(moonCard).toContain('Aries');
      expect(moonCard).not.toContain('three-card__deg');
      expect(moonCard).not.toContain('°');
      expect(moonCard).not.toContain('data-moon-uncertain');
      expect(cards.join('')).not.toContain(noon);
      // With the time known, the same instant's degree is the Moon's, and the card gives it.
      const timedCards = hero(known, mode);
      expect(timedCards.join('')).not.toContain('data-moon-sign-only');
      expect(timedCards.find((card) => card.includes(noon))).toContain('three-card__deg');
    }
    // The Sun's card keeps its reference degree, as before.
    expect(hero(chart, 'full')[0]).toContain('three-card__deg');

    const receipt = (markup: string) => /<span class="mono tour__sub-receipt">([\s\S]*?)<\/span>/u.exec(markup)![1];
    expect(receipt(tour(chart, 'full', 'big-three', 'moon'))).toBe('Moon · Aries');
    expect(receipt(tour(known, 'full', 'big-three', 'moon'))).toBe(`Moon · ${noon} · Aries`);
    // The Sun's sub-step is unchanged.
    expect(receipt(tour(chart, 'full', 'big-three', 'sun'))).toMatch(/^Sun · \d+°\d{2}′ Capricorn · Capricorn$/u);
  });

  it('keeps noon’s Moon degree and aspects out of the inspector’s Moon and Aries readings, which give both with the time', async () => {
    const chart = (await capture(untimed)).result;
    const known = (await capture(timed)).result;
    const locales = ['en', 'es', 'pt', 'fr', 'it', 'ru'] as const;
    const inspect = (source: Chart, selection: EntityRef, locale: typeof locales[number] = 'en') => render(h(Inspector, {
      scene: buildSceneModel(source), selection, onSelect: () => {}, locale }));
    /** The card's reading, and apart from it the reference disclosure ("Exact chart data"). */
    const parts = (markup: string) => {
      const exact = /<details class="insp__exact">[\s\S]*?<\/details>/u.exec(markup)?.[0] ?? '';
      return { reading: exact ? markup.replace(exact, '') : markup, exact };
    };
    const lon = chart.bodies.find((row) => row.body === 'Moon')!.lon;
    expect(known.bodies.find((row) => row.body === 'Moon')!.lon).toBe(lon);
    const noon = formatLongitude(lon, 'en');
    expect(noon).toBe('10°29′ Aries');
    const degree = noon.split(' ')[0];
    const moonAspects = buildSceneModel(known).aspects.filter(withMoon);
    expect(moonAspects.map((row) => `${row.a} ${row.type} ${row.b}`)).toEqual(expect.arrayContaining(['Moon trine Mars', 'Moon square Neptune']));
    const chips = moonAspects.map((row) => `${aspectLabel('en', row.type)} · ${planetLabel('en', row.a === 'Moon' ? row.b : row.a)}`);

    // 1. The Moon selected. With the time, every aspect is listed with its orb and the degree is the chart's.
    const moon = { kind: 'body', body: 'Moon' } as const;
    const timedMoon = parts(inspect(known, moon));
    for (const chip of chips) expect(timedMoon.reading).toContain(chip);
    expect(timedMoon.reading).toContain('class="insp__orb"');
    expect(timedMoon.exact).toContain(noon);
    expect(timedMoon.exact).not.toContain(t('en', 'noTimeNotice'));
    // Without it, the reading names Aries and nothing measured from noon's Moon.
    const untimedMoon = parts(inspect(chart, moon));
    const heading = /<h3 class="insp__title"[^>]*>([\s\S]*?)<\/h3>/u.exec(untimedMoon.reading)![1];
    expect(heading).toContain('Moon');
    expect(heading).not.toContain('°');
    expect(untimedMoon.reading).not.toContain('data-moon-uncertain');
    expect(untimedMoon.reading).toContain('How the sign shapes it');
    expect(untimedMoon.reading).toContain('/learn/placements/moon-in-aries/');
    expect(untimedMoon.reading).toContain('Moon aspects need a birth time and are left out of this reading.');
    expect(untimedMoon.reading).not.toContain(degree);
    expect(untimedMoon.reading).not.toContain('insp__orb');
    for (const chip of chips) expect(untimedMoon.reading).not.toContain(chip);
    // Noon's degree stays a reference, after the notice that says so.
    const notice = untimedMoon.exact.indexOf(t('en', 'noTimeNotice'));
    expect(notice).toBeGreaterThan(-1);
    expect(untimedMoon.exact.indexOf(noon)).toBeGreaterThan(notice);
    // The other languages print the exact data openly, so the Moon's moves into the disclosure without the time.
    for (const locale of locales.filter((code) => code !== 'en')) {
      const position = formatLongitude(lon, locale);
      const timedLocal = parts(inspect(known, moon, locale));
      expect(timedLocal.reading, locale).toContain(position);
      expect(timedLocal.reading, locale).toContain('class="insp__orb"');
      const untimedLocal = parts(inspect(chart, moon, locale));
      expect(untimedLocal.reading, locale).not.toContain(position.split(' ')[0]);
      expect(untimedLocal.reading, locale).not.toContain('insp__orb');
      expect(untimedLocal.reading, locale).toContain('/learn/placements/moon-in-aries/');
      expect(untimedLocal.exact.indexOf(position), locale).toBeGreaterThan(untimedLocal.exact.indexOf(t(locale, 'noTimeNotice')));
      expect(untimedLocal.exact.indexOf(t(locale, 'noTimeNotice')), locale).toBeGreaterThan(-1);
      expect(untimedLocal.exact, locale).not.toContain('Exact chart data');
    }

    // 2. Aries selected: the Moon is listed there, with noon's degree only once the time is known.
    const aries = { kind: 'sign', sign: 'aries' } as const;
    for (const locale of locales) {
      const label = planetLabel(locale, 'Moon');
      const position = formatLongitude(lon, locale).split(' ')[0];
      expect(inspect(known, aries, locale), locale).toContain(`${label} · ${position}`);
      const untimedAries = inspect(chart, aries, locale);
      expect(untimedAries, locale).toContain(`${label}</button>`);
      expect(untimedAries, locale).not.toContain(position);
      expect(untimedAries, locale).not.toContain(t(locale, 'needsBirthTime'));
    }

    // The selection's announcement, which the wheel's "Show on chart" cue also prints, follows the inspector.
    const describeSelection = (source: Chart) => componentFunction<(ref: EntityRef) => string>('describeSelection')({
      scene: buildSceneModel(source), chart: source, locale: 'en', planetLabel, aspectLabel, t, moonIsUncertain,
      moonDegreeUnsettled, moonLabel, formatLongitude, signName, signBySlug,
    })(moon);
    expect(describeSelection(known)).toBe(`Moon, ${noon}, House 1`);
    expect(describeSelection(chart)).toBe('Moon, Aries');
  });

  it('keeps noon’s Moon aspects off the other planet’s card too, Neptune’s and Mars’s, which list them with the time', async () => {
    const chart = (await capture(untimed)).result;
    const known = (await capture(timed)).result;
    const locales = ['en', 'es', 'pt', 'fr', 'it', 'ru'] as const;
    /** The planet's card, without its reference disclosure ("Exact chart data"). */
    const reading = (source: Chart, body: 'Neptune' | 'Mars', locale: typeof locales[number] = 'en') => render(h(Inspector, {
      scene: buildSceneModel(source), selection: { kind: 'body', body }, onSelect: () => {}, locale,
    })).replace(/<details class="insp__exact">[\s\S]*?<\/details>/u, '');
    const chip = (type: Aspect['type'], partner: string, locale: typeof locales[number] = 'en') => `${aspectLabel(locale, type)} · ${planetLabel(locale, partner)}`;
    const note = 'Moon aspects need a birth time and are left out of this reading.';
    // At noon the Moon is square Neptune and trine Mars, which has no other aspect.
    const bodies = buildSceneModel(chart).bodies;
    expect(bodies.find((row) => row.body === 'Neptune')!.aspects)
      .toEqual(['aspect:Sun-conjunction-Neptune', 'aspect:Moon-square-Neptune', 'aspect:Saturn-conjunction-Neptune']);
    expect(bodies.find((row) => row.body === 'Mars')!.aspects).toEqual(['aspect:Moon-trine-Mars']);

    // Without the time neither card lists its Moon aspect, and each says why; Neptune keeps its other two.
    const neptune = reading(chart, 'Neptune');
    expect(neptune).not.toContain(chip('square', 'Moon'));
    expect(neptune).toContain(chip('conjunction', 'Sun'));
    expect(neptune).toContain(chip('conjunction', 'Saturn'));
    expect(neptune.match(/class="insp__orb"/gu)).toHaveLength(2);
    expect(neptune).toContain(note);
    const mars = reading(chart, 'Mars');
    expect(mars).not.toContain(chip('trine', 'Moon'));
    expect(mars).not.toContain('insp__orb');
    expect(mars).toContain(note);
    for (const locale of locales.filter((code) => code !== 'en')) {
      expect(reading(chart, 'Neptune', locale), locale).not.toContain(chip('square', 'Moon', locale));
      expect(reading(chart, 'Neptune', locale), locale).toContain(chip('conjunction', 'Saturn', locale));
      expect(reading(chart, 'Mars', locale), locale).not.toContain(chip('trine', 'Moon', locale));
    }

    // With the time known at the same instant, the Moon's aspects are the chart's, and both cards list them.
    expect(known.input.utc.getTime()).toBe(chart.input.utc.getTime());
    const timedNeptune = reading(known, 'Neptune');
    expect(timedNeptune).toContain(chip('square', 'Moon'));
    expect(timedNeptune.match(/class="insp__orb"/gu)).toHaveLength(3);
    expect(timedNeptune).not.toContain(note);
    expect(reading(known, 'Mars')).toContain(chip('trine', 'Moon'));
    for (const locale of locales) {
      expect(reading(known, 'Neptune', locale), locale).toContain(chip('square', 'Moon', locale));
      expect(reading(known, 'Mars', locale), locale).toContain(chip('trine', 'Moon', locale));
    }

    // The full guided tour's aspect-focus chips, highlights, and guided wheel also leave noon-only Moon aspects out.
    const tourSource = readFileSync(new URL('./explorer/tour/ChartTour.tsx', import.meta.url), 'utf8');
    expect(tourSource).toContain('deriveChapters(tourScene)');
    expect(tourSource).toContain('emphasisForChapter(tourScene, c, state.sub, { aspectFocus: state.focus })');
    expect(tourSource).toContain('const base = state.preview && altFiltered ? altFiltered : tourScene;');
    expect(tourSource).toContain('const present = [...new Set(tourScene.aspects.map((a) => a.type))];');
    expect(tourSource).toContain("moonAspectsOut ? 'quickAspectEmptyNoTime' : 'quickAspectEmpty'");
    // When only Moon aspects exist in an untimed chart, the quick tour explains Moon aspects were excluded rather than claiming none exist.
    const moonOnlyChart: Chart = { ...chart, aspects: chart.aspects.filter(withMoon) };
    const moonOnlyQuick = tour(moonOnlyChart, 'quick', 'first-aspect');
    expect(moonOnlyQuick).toContain('Moon aspects need a birth time and are left out of this reading.');
    expect(moonOnlyQuick).not.toContain('No major aspect involving your Sun, Moon, Mercury, Venus, or Mars stands out.');
    const calcSource = readFileSync(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    expect(calcSource.match(/\(!tourVisual \|\| \(!moonAmbiguous && !moonAspectsUnsettled\(chart\)\) \|\| \(a\.a !== 'Moon' && a\.b !== 'Moon'\)\)/gu)).toHaveLength(2);
    expect(calcSource).toContain('<EntityPicker\n                        scene={viewScene ?? scene}');
    expect(calcSource).toContain('&& (viewScene ?? scene).aspects.some((x) => x.a === a.a && x.b === a.b && x.type === a.type);');
    // The exact-data reference table pairs noon's Moon degree with noon's sign (never the two-sign birth summary).
    expect(calcSource).toContain("? <><SignChip lon={p.lon} locale={locale} /> · {t(locale, 'needsBirthTime')}</>");
  });
});

describe('the no-time notice says what the birth date verified', () => {
  // The calculator awaits this before its calculation block, which runs here alone.
  beforeAll(() => Promise.all(['America/Toronto', 'Asia/Bangkok', 'Europe/London']
    .map((zone) => prepareLocalTime('1800-01-01', zone))));
  const notice = componentJsx("chart.flags.includes('no-time') &&");
  async function shown(date: string, zone: string) {
    const { result, nextMoonAmbiguous } = await capture(input(date, zone));
    return { result, text: render(h(Fragment, null, notice({ h, Fragment, chart: result, locale: 'en', t, moonAmbiguous: nextMoonAmbiguous, moonNoticeKey }))) };
  }

  it('gives both signs of a date the Moon changed sign on their own notice, not the unverified one', async () => {
    const { result, text } = await shown('1990-01-01', 'Europe/London');
    expect(moonCandidates(result)).toEqual(['aquarius', 'pisces']);
    expect(moonNoticeKey(result)).toBe('moonAmbiguousNotice');
    expect(text).toContain(t('en', 'moonAmbiguousNotice'));
    expect(text).not.toContain(t('en', 'moonUnverifiedNotice'));
    expect(text).toContain(t('en', 'noTimeNotice'));
  });

  it('keeps the unverified notice where the date verified no sign, and neither where it verified one', async () => {
    const toronto = await shown('1919-03-31', 'America/Toronto');
    expect(moonCandidates(toronto.result)).toEqual([]);
    expect(moonNoticeKey(toronto.result)).toBe('moonUnverifiedNotice');
    expect(toronto.text).toContain(t('en', 'moonUnverifiedNotice'));
    expect(toronto.text).not.toContain(t('en', 'moonAmbiguousNotice'));

    const bangkok = await shown('1990-01-04', 'Asia/Bangkok');
    expect(moonCandidates(bangkok.result)).toEqual(['aries']);
    expect(moonNoticeKey(bangkok.result)).toBeNull();
    for (const key of ['moonUnverifiedNotice', 'moonAmbiguousNotice'] as const) expect(bangkok.text).not.toContain(t('en', key));
    expect(bangkok.text).toContain(t('en', 'unknownTimeSunReference'));
  });

  it('has both sentences in every language the calculator speaks', () => {
    for (const locale of ['en', 'es', 'pt', 'fr', 'it', 'ru'] as const) {
      for (const key of ['moonAmbiguousNotice', 'moonUnverifiedNotice'] as const) {
        expect(t(locale, key), `${locale} ${key}`).toMatch(/\S/u);
        expect(t(locale, key), `${locale} ${key}`).not.toBe(key);
      }
    }
  });
});
