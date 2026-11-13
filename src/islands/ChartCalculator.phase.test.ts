import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { moonPhaseNameFromAngle } from '../lib/engine/lite';
import { computeChart } from '../lib/engine/full';

const source = readFileSync(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('ChartCalculator.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let expression: string | undefined;
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'moonPhase') expression = node.initializer?.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
if (!expression) throw new Error('Retained-chart phase expression not found');
const phase = new Function('sun', 'moon', 'mode', 'moonPhaseNameFromAngle', `return ${expression};`);
const classify = (sun: { lon: number } | undefined, moon: { lon: number } | undefined, mode = 'moon') =>
  phase(sun, moon, mode, moonPhaseNameFromAngle);

describe('Moon-mode retained chart phase', () => {
  it.each([
    [350, 12.5, 'Waxing Crescent'], [20, 200, 'Full Moon'],
    [100, 77.5, 'Waning Crescent'], [120, 119, 'New Moon'],
  ])('uses retained longitudes %s/%s without consulting a date or ephemeris', (sun, moon, expected) => {
    expect(classify({ lon: sun as number }, { lon: moon as number })).toBe(expected);
  });
  it('does not fabricate a category for missing bodies or non-Moon modes', () => {
    expect(classify(undefined, { lon: 10 })).toBeNull();
    expect(classify({ lon: 10 }, undefined)).toBeNull();
    expect(classify({ lon: 10 }, { lon: 20 }, 'full')).toBeNull();
    expect(source).toContain('moonPhaseLabel(locale, moonPhase)');
    expect(source).not.toContain('moonPhaseName(chart.input.utc)');
  });
  it.each([true, false])('does not mutate a full chart with timeKnown=%s', timeKnown => {
    const chart = computeChart({ utc: new Date('2024-01-16T12:00:00Z'), latitude: 51.51,
      longitude: -0.13, houseSystem: 'whole', timeKnown });
    const before = JSON.stringify(chart);
    const sun = chart.bodies.find(body => body.body === 'Sun')!;
    const moon = chart.bodies.find(body => body.body === 'Moon')!;
    expect(classify(sun, moon)).toBe(moonPhaseNameFromAngle((((moon.lon - sun.lon) % 360) + 360) % 360));
    expect(JSON.stringify(chart)).toBe(before);
  });
});
