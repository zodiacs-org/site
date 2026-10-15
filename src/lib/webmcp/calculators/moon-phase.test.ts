import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as engine from '../../engine/full';
import { moonPhaseNameFromAngle } from '../../engine/lite';
import { prepareLocalTime, resolveLocalToUtc } from '../../time/localToUtc';
import { assessLocalDateReference } from '../../time/local-date-reference';
import { t } from '../../i18n';
import { LocalDateReferenceError, lookupMoonPhase, moonIlluminationFromAngle } from './moon-phase';

// The page's own lookup, executed as MoonPhaseTool.reference.test.ts does: the tool must answer what the page shows.
const source = readFileSync(new URL('../../../islands/MoonPhaseTool.tsx', import.meta.url), 'utf8');
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
const pageLookup = new Function('context', `with(context){${ts.transpile([...functions.values()].join('\n'), {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
})};return lookup({preventDefault(){}});}`);

interface Input { date: string; time: string; zone: string | null; lon?: number }

async function page({ date, time, zone, lon = 0 }: Input) {
  const state: { result: Record<string, unknown> | null; error: string } = { result: null, error: '' };
  await pageLookup({
    date, time, city: zone ? { tz: zone, lon } : null, locale: 'en', t, moonPhaseNameFromAngle,
    lookupRevisionRef: { current: 0 }, focusAfterComputeRef: { current: false }, handoffInputsRef: { current: null },
    setBusy: () => {}, setError: (value: string) => { state.error = value; }, setResult: (value: Record<string, unknown> | null) => { state.result = value; },
    loadEngine: async () => engine, prepareLocalTime, resolveLocalToUtc, assessLocalDateReference,
    calculationError: (_error: unknown, _locale: string, fallback: string) => fallback, console: { error() {} },
  });
  return state;
}

async function tool({ date, time, zone, lon = 0 }: Input) {
  return lookupMoonPhase({ date, time: time || null, place: zone ? { lon, tz: zone } : null }, engine);
}

const controls: Array<[string, Input]> = [
  ['UTC noon', { date: '1990-01-04', time: '', zone: null }],
  ['local noon', { date: '1990-01-01', time: '', zone: 'Europe/London', lon: -0.1276 }],
  ['local time', { date: '2024-03-20', time: '21:45', zone: 'Asia/Bangkok', lon: 100.5018 }],
  ['local mean time before standard time', { date: '1880-05-02', time: '06:00', zone: 'Europe/Paris', lon: 2.3522 }],
  ['Toronto omitted member', { date: '1919-03-31', time: '', zone: 'America/Toronto', lon: -79.3832 }],
  ['known local gap', { date: '2000-01-15', time: '12:00', zone: 'Africa/Khartoum', lon: 32.5599 }],
  ['known UTC', { date: '2000-01-15', time: '08:30', zone: null }],
  ['known skipped date', { date: '2011-12-30', time: '08:30', zone: 'Pacific/Apia', lon: -171.7513 }],
];

describe('the moon-phase tool reads what the page shows', () => {
  it.each(controls)('%s', async (_label, input) => {
    const shown = await page(input);
    if (shown.error) {
      await expect(tool(input)).rejects.toThrow();
      return;
    }
    const answered = await tool(input);
    expect({
      computedUtc: answered.computedUtc, reference: answered.reference, phase: answered.phase,
      angle: answered.angle, illum: answered.illum, lon: answered.lon,
    }).toEqual({
      computedUtc: shown.result!.computedUtc, reference: shown.result!.reference, phase: shown.result!.phase,
      angle: shown.result!.angle, illum: shown.result!.illum, lon: shown.result!.lon,
    });
  });

  it('refuses local noon outside the local date, as the page does', async () => {
    // Samoa skipped 30 December 2011: no local noon falls within that date.
    const input = { date: '2011-12-30', time: '', zone: 'Pacific/Apia', lon: -171.7513 };
    expect((await page(input)).error).toBe(t('en', 'localDateReferenceError'));
    await expect(tool(input)).rejects.toBeInstanceOf(LocalDateReferenceError);
  });

  it('names the basis it read and the lit fraction', async () => {
    expect((await tool({ date: '2024-03-20', time: '', zone: null })).basis).toBe('utc-reference');
    expect((await tool({ date: '2024-03-20', time: '10:00', zone: null })).basis).toBe('utc-time');
    expect(moonIlluminationFromAngle(0)).toBe(0);
    expect(moonIlluminationFromAngle(180)).toBe(1);
  });
});
