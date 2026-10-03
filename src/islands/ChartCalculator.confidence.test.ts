import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as actualEngine from '../lib/engine/full';
import * as actualReceipt from '../lib/engine/calculator-receipt';
import { localDateContainsUtc, prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import { assessLocalDateReference } from '../lib/time/local-date-reference';
import { moonCandidates, moonIsUncertain, moonLabel } from '../lib/moon-certainty';
import { signForLongitude } from '../lib/signs';
import { buildChartContext } from '../lib/chart-context';
import { approachRead } from '../lib/approach';
import { communicationRead } from '../lib/communication';
import { chartSignature } from '../lib/chart-signature';
import { buildSceneModel } from '../lib/scene/build';
import { bigThreePlacements, communicationCardContent, approachCardContent } from '../lib/share-card';
import { encodePositionsLink, decodePositionsLink } from '../lib/share-positions';
import { positionsReading } from '../lib/share-positions-reading';
import type { Chart, ChartInput } from '../lib/engine/types';

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
const execute = new Function('context', `with(context){${ts.transpile(calculation, {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
})}; return {result, portable, resolved, nextMoonAmbiguous};}`);
const input = (date: string, zone: string, known = false) => ({ date, time: '12:00', timeKnown: known,
  city: { name: 'Synthetic place', tz: zone, lat: 43.65, lon: -79.38 }, houseSystem: 'whole' });
function capture(value: ReturnType<typeof input>, mode = 'full', fallback = false, assess = assessLocalDateReference) {
  const calls = { publicNatal: 0, legacyNatal: 0, endpoints: 0 };
  const receiptModule = fallback || mode !== 'full' ? undefined : { computeCalculatorReceipt: (...args: Parameters<typeof actualReceipt.computeCalculatorReceipt>) => {
    const result = actualReceipt.computeCalculatorReceipt(...args); if (result) calls.publicNatal++; return result;
  } };
  const engine = { ...actualEngine, computeChart: (arg: ChartInput) => {
    calls.legacyNatal++; return actualEngine.computeChart(arg);
  }, computeBodies: () => { calls.endpoints++; throw Error('Unexpected endpoint calculation'); } };
  const result = execute({ input: value, mode, engine, receiptModule, resolveLocalToUtc, assessLocalDateReference: assess,
    signForLongitude, moonIsUncertain, runIsCurrent: () => true,
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
const controls = [
  ['Toronto omitted member', '1919-03-31', 'America/Toronto'],
  ['Juneau repeated member', '1867-10-18', 'America/Juneau'],
  ['ordinary endpoint singleton', '1990-01-04', 'Asia/Bangkok'],
  ['ordinary two endpoint signs', '1990-01-01', 'Europe/London'],
  ['non-hour gap day', '2024-10-06', 'Australia/Lord_Howe'],
  ['repeated Apia date', '1892-07-04', 'Pacific/Apia'],
] as const;

describe('ChartCalculator reference confidence', () => {
  // The calculator awaits this before its calculation block, which runs here alone.
  beforeAll(() => Promise.all(['America/Toronto', 'America/Juneau', 'Pacific/Apia', 'Asia/Bangkok', 'Europe/London', 'Australia/Lord_Howe']
    .map((zone) => prepareLocalTime('1800-01-01', zone))));
  it.each(['complete', 'unavailable', 'failed'] as const)('keeps reference receipt bytes and unverified signs with %s date coverage', state => {
    const value = input('1990-06-15', 'UTC'), expected = reference(value);
    const provider = state === 'unavailable' ? null : {
      completeness: 'complete-transitions-v1' as const,
      offsetMilliseconds: () => 0,
      nextTransitionMilliseconds: () => { if (state === 'failed') throw Error('private'); return null; },
    };
    const assess = vi.fn((date: string, utc: Date, zone: string) => assessLocalDateReference(date, utc, zone, provider));
    const actual = capture(value, 'full', false, assess);
    expect(assess).toHaveBeenCalledOnce();
    expect(assess.mock.results[0].value.coverage.status).toBe(state === 'complete' ? 'existing' : 'unresolved');
    expect(actual.portable!.envelopeJson).toBe(expected.envelopeJson);
    expect(positions(actual.result)).toBe(positions(expected.chart));
    expect(actual.result.moonSignCandidates).toEqual([]);

    expect(actual.result).not.toHaveProperty('coverage');
    expect(actual.calls).toEqual({ publicNatal: 1, legacyNatal: 0, endpoints: 0 });
  });

  it.each(['full', 'moon', 'rising'])('does no coverage work for known-time %s requests', mode => {
    const assess = vi.fn(() => { throw Error('Coverage must not run for known time'); });
    expect(capture(input('2011-12-30', 'Pacific/Apia', true), mode, false, assess).result).toBeTruthy();
    expect(assess).not.toHaveBeenCalled();
  });

  it('refuses a provider violation before receipt calculation even when the point belongs to the date', () => {
    const receipt = vi.spyOn(actualReceipt, 'computeCalculatorReceipt');
    const assess = (date: string, utc: Date, zone: string) => assessLocalDateReference(date, utc, zone, {
      completeness: 'complete-transitions-v1', offsetMilliseconds: () => 0,
      nextTransitionMilliseconds: () => 0, // nonadvancing; contradictory provider evidence
    });
    try {
      expect(() => capture(input('1990-06-15', 'UTC'), 'full', false, assess)).toThrow('local-date reference refused');
      expect(receipt).not.toHaveBeenCalled();
    } finally { receipt.mockRestore(); }
  });

  it.each(['outside-date', 'unresolved'] as const)('refuses %s coverage adjudication before natal or receipt work', referenceStatus => {
    const assess = vi.fn(() => ({ referenceStatus, coverage: { status: 'unresolved' as const, reason: 'provider-violation' as const }, evidence: null }));
    expect(() => capture(input('1990-06-15', 'UTC'), 'full', false, assess)).toThrow('local-date reference refused');
    expect(assess).toHaveBeenCalledOnce();
  });

  it.each(controls)('%s keeps exact reference bytes and uses unresolved Moon confidence', (_name, date, zone) => {
    const value = input(date, zone), expected = reference(value), actual = capture(value);
    const { moonSignCandidates, ...numerical } = actual.result;
    expect(JSON.stringify(numerical)).toBe(JSON.stringify(expected.chart));
    expect(actual.portable!.envelopeJson).toBe(expected.envelopeJson);
    expect(positions(actual.result)).toBe(positions(expected.chart));
    expect(moonSignCandidates).toEqual([]);
    expect(actual.nextMoonAmbiguous).toBe(true);

    expect(actual.calls).toEqual({ publicNatal: 1, legacyNatal: 0, endpoints: 0 });
    expect(moonLabel(actual.result)).toBe('Needs a birth time');
    const context = buildChartContext({ ...actual.result, timeKnown: false });
    expect(context.placements.find(row => row.body === 'Moon')).toMatchObject({ status: 'unresolved', sign: null, conditionalSigns: [], dignities: [] });
    expect(context.placements.find(row => row.body === 'Sun')!.status).toBe('reference');
  });

  it.each([
    ['1919-03-31', 'America/Toronto', '1919-03-31T04:30:00Z', 'pisces', 'aries'],
    ['1867-10-18', 'America/Juneau', '1867-10-19T00:31:13Z', 'cancer', 'gemini'],
  ])('retains the real contradictory member for %s without inventing a complete range', (date, zone, instant, memberSign, referenceSign) => {
    const actual = capture(input(date, zone));
    expect(localDateContainsUtc(date, new Date(instant), zone)).toBe(true);
    expect(signForLongitude(actualEngine.bodyLongitude('Moon', new Date(instant))).slug).toBe(memberSign);
    expect(signForLongitude(actual.result.bodies.find(row => row.body === 'Moon')!.lon).slug).toBe(referenceSign);
    expect(moonCandidates(actual.result)).toEqual([]);
  });

  it.each([
    ['1867-10-18', 'America/Juneau', '1867-10-17T20:57:41.000Z', ['lmt']],
    ['1892-07-04', 'Pacific/Apia', '1892-07-03T23:26:56.000Z', ['dst-fold', 'lmt']],
  ])('keeps the zone clock for %s in %s, hours from the synthetic longitude', (date, zone, instant, flags) => {
    // Toronto's longitude is outside the bound on a birthplace's departure
    // from the zone's mean time, so these controls keep the zone's clock. Only
    // the reading with a longitude says which clock that was: the zone's own
    // local mean time, `lmt` (the flag's meaning since engine rc.15).
    const actual = capture(input(date, zone));
    const zoneClock = resolveLocalToUtc(date, '12:00', zone);
    expect({ ...actual.resolved, flags: actual.resolved.flags.filter((flag) => flag !== 'lmt') }).toEqual(zoneClock);
    expect(actual.resolved.utc.toISOString()).toBe(instant);
    expect(actual.resolved.flags).toEqual(flags);
    expect(actual.resolved.localMeanTime).toBeUndefined();
  });

  it.each(['full', 'moon', 'rising'])('preserves known-time numerical, receipt and confidence behavior in %s mode', mode => {
    const value = input('1990-06-15', 'America/Toronto', true), expected = reference(value), actual = capture(value, mode);
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

    expect(actual.calls).toEqual({ publicNatal: mode === 'full' ? 1 : 0, legacyNatal: mode === 'full' ? 0 : 1, endpoints: 0 });
  });

  it('preserves reference fallback and C014 refusal, without extra endpoint work', () => {
    const actual = capture(input('1990-01-04', 'Asia/Bangkok'), 'full', true);
    expect(actual.portable).toBeUndefined(); expect(actual.result.moonSignCandidates).toEqual([]);
    expect(actual.calls).toEqual({ publicNatal: 0, legacyNatal: 1, endpoints: 0 });
    expect(() => capture(input('2011-12-30', 'Pacific/Apia'))).toThrow('local-date reference refused');
    expect(capture(input('2011-12-31', 'Pacific/Apia')).result).toBeTruthy();
  });

  it.each(controls.slice(0, 4))('%s propagates unresolved confidence through advice, scene and sharing', (_name, date, zone) => {
    const chart = capture(input(date, zone)).result;
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
});
