import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import * as engine from '../lib/engine/full';
import { moonPhaseName, moonPhaseNameFromAngle } from '../lib/engine/lite';
import { localDateContainsUtc, prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import { assessLocalDateReference } from '../lib/time/local-date-reference';
import { signForLongitude } from '../lib/signs';
import { t, type CatalogLocale } from '../lib/i18n';

// Execute the exact caller with controlled state and loader boundaries. The
// separate native driver covers Preact rendering, visibility and ownership.
const source = readFileSync(new URL('./MoonPhaseTool.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('MoonPhaseTool.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && ['lookup', 'moonIlluminationFromAngle'].includes(node.name?.text ?? '')) {
    functions.set(node.name!.text, node.getText(ast));
  }
  ts.forEachChild(node, visit);
}
visit(ast);
if (functions.size !== 2) throw new Error('Moon lookup functions not found');
const execute = new Function('context', `with(context){${ts.transpile([...functions.values()].join('\n'), {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
})};return lookup({preventDefault(){}});}`);
type Result = { phase: ReturnType<typeof moonPhaseName>; angle: number; illum: number; lon: number; caption: string };
type Input = { date: string; time: string; zone: string | null; locale?: CatalogLocale };
async function capture({ date, time, zone, locale = 'en' }: Input, longitudes?: { Moon: number; Sun: number }, assess = assessLocalDateReference) {
  const calls: Array<{ body: string; utc: string; value: number }> = [];
  const resolutions: Parameters<typeof resolveLocalToUtc>[] = [];
  const state: { result: Result | null; error: string; busy: boolean } = { result: null, error: '', busy: false };
  await execute({ date, time, city: zone ? { tz: zone } : null, locale, t, moonPhaseNameFromAngle,
    lookupRevisionRef: { current: 0 }, focusAfterComputeRef: { current: false }, handoffInputsRef: { current: null },
    setBusy: (value: boolean) => { state.busy = value; },
    setError: (value: string) => { state.error = value; },
    setResult: (value: Result | null) => { state.result = value; },
    loadEngine: async () => ({ ...engine, bodyLongitude: (...args: Parameters<typeof engine.bodyLongitude>) => {
      const value = longitudes && (args[0] === 'Moon' || args[0] === 'Sun')
        ? longitudes[args[0]] : engine.bodyLongitude(...args); calls.push({ body: args[0], utc: args[1].toISOString(), value }); return value;
    } }),
    prepareLocalTime,
    resolveLocalToUtc: (...args: Parameters<typeof resolveLocalToUtc>) => { resolutions.push(args); return resolveLocalToUtc(...args); },
    assessLocalDateReference: assess, calculationError: (_error: unknown, _locale: string, fallback: string) => fallback,
    console: { error() {} },
  });
  return { ...state, calls, resolutions };
}
const controls: Array<[string, Input]> = [
  ['UTC singleton', { date: '1990-01-04', time: '', zone: null }],
  ['local former two signs', { date: '1990-01-01', time: '', zone: 'Europe/London' }],
  ['Toronto omitted member', { date: '1919-03-31', time: '', zone: 'America/Toronto' }],
  ['Juneau returned member', { date: '1867-10-18', time: '', zone: 'America/Juneau' }],
  ['same-date noon gap', { date: '2000-01-15', time: '', zone: 'Africa/Khartoum' }],
  ['known local gap', { date: '2000-01-15', time: '12:00', zone: 'Africa/Khartoum' }],
  ['known UTC', { date: '2000-01-15', time: '08:30', zone: null }],
  ['known skipped date', { date: '2011-12-30', time: '08:30', zone: 'Pacific/Apia' }],
];

describe('Moon phase reference result', () => {
  it.each(['complete', 'unavailable', 'failed'] as const)('preserves the same reference longitudes and phase with %s date coverage', state => {
    const provider = state === 'unavailable' ? null : {
      completeness: 'complete-transitions-v1' as const, offsetMilliseconds: () => 0,
      nextTransitionMilliseconds: () => { if (state === 'failed') throw Error('private'); return null; },
    };
    const assess = vi.fn((date: string, utc: Date, zone: string) => assessLocalDateReference(date, utc, zone, provider));
    return (async () => {
      const request = { date: '2024-03-20', time: '', zone: 'UTC' };
      const actual = await capture(request, undefined, assess);
      const baseline = await capture(request, undefined, (date, utc, zone) => assessLocalDateReference(date, utc, zone, null));
      expect(actual).toEqual(baseline);
      expect(actual.calls).toHaveLength(2);
      expect(actual.result!.caption).toBe(t('en', 'referenceLocalCaption'));
      expect(actual.result).not.toHaveProperty('coverage');
      expect(assess).toHaveBeenCalledOnce();
    })();
  });

  it.each([
    { date: '2011-12-30', time: '08:30', zone: 'Pacific/Apia' },
    { date: '2024-03-20', time: '', zone: null },
    { date: '2024-03-20', time: '08:30', zone: null },
  ])('leaves known-time and explicit UTC paths unchanged (%j)', async request => {
    const assess = vi.fn(() => { throw Error('Unexpected coverage call'); });
    const result = await capture(request, undefined, assess);
    expect(result.error).toBe(''); expect(result.calls).toHaveLength(2);
    expect(assess).not.toHaveBeenCalled();
  });

  it('refuses a provider violation before either longitude calculation', async () => {
    const assess = (date: string, utc: Date, zone: string) => assessLocalDateReference(date, utc, zone, {
      completeness: 'complete-transitions-v1', offsetMilliseconds: () => 0,
      nextTransitionMilliseconds: () => 0,
    });
    const result = await capture({ date: '2024-03-20', time: '', zone: 'UTC' }, undefined, assess);
    expect(result.result).toBeNull(); expect(result.calls).toEqual([]);
    expect(result.error).toBe(t('en', 'localDateReferenceError'));
  });

  it.each(['outside-date', 'unresolved'] as const)('refuses %s without ephemeris work', async referenceStatus => {
    const assess = () => ({ referenceStatus, coverage: { status: 'unresolved' as const, reason: 'provider-violation' as const }, evidence: null });
    const result = await capture({ date: '2024-03-20', time: '', zone: 'UTC' }, undefined, assess);
    expect(result.result).toBeNull(); expect(result.calls).toEqual([]);
    expect(result.error).toBe(t('en', 'localDateReferenceError'));
  });

  it('corrects the real January 16 boundary disagreement without changing full values', async () => {
    const actual = await capture({ date: '2024-01-16', time: '10:18', zone: null });
    expect(moonPhaseName(new Date('2024-01-16T10:18:00Z'))).toBe('Waxing Crescent');
    // Engine rc.15 reads 2024 as UTC through the leap seconds and IERS UT1 − UTC,
    // which moves the Moon by 0.0034″ here; the ΔT model gave 67.50628837199378°
    // and 3.271500028636467°. The phase is the same.
    expect(actual.result!.angle).toBe(67.50628923593246);
    expect(actual.result!.lon).toBe(3.2715009589996953);
    expect(actual.result!.phase).toBe('First Quarter');
    expect(actual.result!.illum).toBe((1 - Math.cos((actual.result!.angle * Math.PI) / 180)) / 2);
  });

  it('names the retained full result even when the lite date calculation disagrees', async () => {
    const input = { date: '1990-01-04', time: '12:00', zone: null };
    expect(moonPhaseName(new Date('1990-01-04T12:00:00Z'))).toBe('First Quarter');
    const actual = await capture(input, { Moon: 180, Sun: 0 });
    expect(actual.result).toEqual({ phase: 'Full Moon', angle: 180, illum: 1,
      lon: 180, caption: t('en', 'utcTimeCaption') });
    expect(actual.calls.map(call => call.body)).toEqual(['Moon', 'Sun']);
  });

  it.each(controls)('%s preserves every primary value and omits endpoint confidence work', async (_name, input) => {
    const actual = await capture(input);
    const utc = input.zone ? resolveLocalToUtc(input.date, input.time || '12:00', input.zone).utc
      : new Date(`${input.date}T${input.time || '12:00'}:00Z`);
    const lon = engine.bodyLongitude('Moon', utc), sun = engine.bodyLongitude('Sun', utc);
    const angle = (((lon - sun) % 360) + 360) % 360;
    expect(actual.error).toBe('');
    expect(actual.busy).toBe(false);
    const { caption, ...numerical } = actual.result!;
    expect(JSON.stringify(numerical)).toBe(JSON.stringify({ phase: moonPhaseNameFromAngle(angle), angle,
      illum: (1 - Math.cos((angle * Math.PI) / 180)) / 2, lon }));
    expect(actual.calls).toEqual([{ body: 'Moon', utc: utc.toISOString(), value: lon }, { body: 'Sun', utc: utc.toISOString(), value: sun }]);
    expect(actual.resolutions).toEqual(input.zone ? [[input.date, input.time || '12:00', input.zone, { longitude: undefined }]] : []);
    expect(caption).toBe(input.time ? input.zone ? '' : t('en', 'utcTimeCaption')
      : t('en', input.zone ? 'referenceLocalCaption' : 'referenceUtcCaption'));
  });

  it('retains the actual 13:00 local gap result without promising a noon clock', async () => {
    const actual = await capture({ date: '2000-01-15', time: '', zone: 'Africa/Khartoum' });
    expect(actual.calls[0].utc).toBe('2000-01-15T10:00:00.000Z');
    expect(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Khartoum', hour: '2-digit', hourCycle: 'h23' })
      .format(new Date(actual.calls[0].utc))).toBe('13');
    expect(actual.result!.caption).not.toMatch(/12:00|noon|midday|exact/i);
  });

  it.each([
    ['2011-12-30', 'Pacific/Apia'], ['1993-08-21', 'Pacific/Kwajalein'],
    ['1994-12-31', 'Pacific/Kiritimati'], ['1844-12-31', 'Pacific/Guam'],
  ])('keeps %s %s refusal before all numerical work', async (date, zone) => {
    const actual = await capture({ date, time: '', zone });
    expect(actual.result).toBeNull(); expect(actual.calls).toEqual([]);
    expect(actual.error).toBe(t('en', 'localDateReferenceError'));
  });

  it.each(['en', 'es', 'fr', 'it', 'pt', 'ru'] as const)('%s captures the local and UTC reference qualification', async locale => {
    for (const zone of [null, 'Europe/London']) {
      const actual = await capture({ date: '1990-01-01', time: '', zone, locale });
      expect(actual.result!.caption).toBe(t(locale, zone ? 'referenceLocalCaption' : 'referenceUtcCaption'));
      expect(actual.result!.caption).not.toMatch(/12:00|12 h/);
    }
  });

  it.each([
    ['2024-01-09', ['Waning Crescent', 'Waning Crescent', 'New Moon']],
    ['2024-01-16', ['Waxing Crescent', 'First Quarter', 'First Quarter']],
    ['2024-04-07', ['Waning Crescent', 'New Moon', 'New Moon']],
    ['2024-01-01', ['Waning Gibbous', 'Waning Gibbous', 'Waning Gibbous']],
  ])('preserves the existing finite phase-category witness for %s', (date, phases) => {
    expect(['00:00', '12:00', '23:59'].map(time => moonPhaseName(new Date(`${date}T${time}:00Z`)))).toEqual(phases);
  });

  it.each([
    ['1919-03-31', 'America/Toronto', '1919-03-31T04:30:00Z', 'pisces', 'aries'],
    ['1867-10-18', 'America/Juneau', '1867-10-19T00:31:13Z', 'cancer', 'gemini'],
  ])('retains the omitted member of %s as a counterexample, not a complete range', async (date, zone, instant, sign, reference) => {
    const actual = await capture({ date, time: '', zone });
    expect(localDateContainsUtc(date, new Date(instant), zone)).toBe(true);
    expect(signForLongitude(engine.bodyLongitude('Moon', new Date(instant))).slug).toBe(sign);
    expect(signForLongitude(actual.result!.lon).slug).toBe(reference);
    expect(actual.result).not.toHaveProperty('altLon');
  });
});
