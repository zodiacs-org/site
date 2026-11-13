import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import cityIndex from '../../public/data/cities/index.json';
import shardS from '../../public/data/cities/s.json';
import * as actualEngine from '../lib/engine/full';
import * as actualReceipt from '../lib/engine/calculator-receipt';
import type { City } from '../lib/geo/search';
import { moonIsUncertain } from '../lib/moon-certainty';
import { signForLongitude } from '../lib/signs';
import { assessLocalDateReference } from '../lib/time/local-date-reference';
import { prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import { adoptionNote } from '../lib/time/birth-calendar';
import { birthDateForChart, calendarInPlay } from './BirthFields';

// The calculator's own calculation statements, run on the date its form hands
// over (as in ChartCalculator.confidence.test.ts).
const source = readFileSync(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
const fieldsSource = readFileSync(new URL('./BirthFields.tsx', import.meta.url), 'utf8');
const ast =ts.createSourceFile('ChartCalculator.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let runChart: ts.FunctionDeclaration | undefined;
ts.forEachChild(ast, function visit(node): void {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'runChart') runChart = node;
  ts.forEachChild(node, visit);
});
const statements = runChart!.body!.statements.find(ts.isTryStatement)!.tryBlock.statements;
const first = statements.findIndex((node) => node.getText(ast).startsWith('const effectiveTime ='));
const end = statements.findIndex((node) => node.getText(ast).startsWith('const owner: ChartResultOwner ='));
if (first < 0 || end <= first) throw Error('Chart calculation block not found');
const execute = new Function('context', `with(context){${ts.transpile(
  statements.slice(first, end).map((node) => node.getText(ast)).join('\n'),
  { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
)}; return {result, portable, resolved};}`);

/** A birthplace as the form's city search returns it (src/lib/geo/search.ts). */
function birthplace(name: string): City {
  const row = (shardS as [string, string | 0, number, number, number, number, number, number][]).find((entry) => entry[0] === name)!;
  return {
    name: row[0], admin1: cityIndex.admin1[row[2]], country: cityIndex.countries[row[3]],
    lat: row[4] / 100, lon: row[5] / 100, tz: cityIndex.tz[row[6]], pop: row[7],
  };
}

function chartFor(date: string, city: City) {
  return execute({
    input: { date, time: '12:00', timeKnown: true, city, houseSystem: 'placidus' },
    mode: 'full', engine: actualEngine, receiptModule: actualReceipt,
    resolveLocalToUtc, assessLocalDateReference, signForLongitude, moonIsUncertain,
    runIsCurrent: () => true, localDateReferenceFailure: new Error('unused'),
  }) as {
    result: import('../lib/engine/types').Chart;
    portable: ReturnType<typeof actualReceipt.computeCalculatorReceipt>;
    resolved: ReturnType<typeof resolveLocalToUtc>;
  };
}

describe('an Old Style birth through the birth chart form', () => {
  it('gives Petrograd 25 October 1917 (Old Style) the chart of 7 November 1917 at the same wall time', async () => {
    const petrograd = birthplace('Saint Petersburg');
    expect(petrograd).toMatchObject({ country: 'Russia', tz: 'Europe/Moscow', lat: 59.94, lon: 30.31 });
    // Left Gregorian, the date draws the Russian note; marked Old Style, it does not.
    expect(adoptionNote('1917-10-25', 'gregorian', petrograd.country)?.kind).toBe('old-style');
    expect(adoptionNote('1917-10-25', 'julian', petrograd.country)).toBeNull();

    // compute(): a date before 1924 is read in its calendar before runChart.
    expect(calendarInPlay('1917-10-25', 'julian')).toBe(true);
    const oldStyle = await birthDateForChart('en', '1917-10-25', 'julian');
    const newStyle = await birthDateForChart('en', '1917-11-07', 'gregorian');
    expect(oldStyle).toMatchObject({ date: '1917-11-07' });
    expect(newStyle).toEqual({ date: '1917-11-07' });
    if ('error' in oldStyle || 'error' in newStyle) throw Error('unreadable date');

    // runChart(): prepare the birthplace clock for that date, then calculate.
    await prepareLocalTime(oldStyle.date, petrograd.tz);
    const converted = chartFor(oldStyle.date, petrograd);
    const typed = chartFor(newStyle.date, petrograd);
    expect(converted.resolved.utc.toISOString()).toBe(typed.resolved.utc.toISOString());
    expect(converted.portable!.envelopeJson).toBe(typed.portable!.envelopeJson);
    expect(converted.result.bodies).toEqual(typed.result.bodies);
    expect(converted.result.houses).toEqual(typed.result.houses);
    const sun = converted.result.bodies.find((body) => body.body === 'Sun')!;
    expect(signForLongitude(sun.lon).slug).toBe('scorpio');

    // Read as a Gregorian date, the Old Style date is a chart 13 days earlier.
    await prepareLocalTime('1917-10-25', petrograd.tz);
    const misread = chartFor('1917-10-25', petrograd);
    expect(converted.resolved.utc.getTime() - misread.resolved.utc.getTime()).toBe(13 * 86_400_000);
  });

  it('sends a date before 1924 through the calendar reader and shows the entered date with the result', () => {
    const compute = source.slice(source.indexOf('function compute('), source.indexOf('function requestChartControls('));
    expect(compute).toContain('if (!calendarInPlay(date, calendar)) return start({ date });');
    expect(compute).toContain('void birthDateForChart(locale, date, calendar).then((entry) => {');
    expect(compute).toContain('oldStyle: entry.oldStyle,');
    expect(source).toContain('{computedInput?.oldStyle && (');
    // Links and saved charts fill the form with a Gregorian date.
    expect(source.match(/setDate\((?:handoff|input|decoded)\.date\);\n\s+setCalendar\('gregorian'\);/g)).toHaveLength(3);
  });

  it('gives no calendar note for the date of a saved chart or a chart link, which was already converted', () => {
    // A saved Petrograd chart keeps its birthplace's country; the note would
    // ask for Julian and convert the stored Gregorian date a second time.
    expect(source.match(/setStoredDate\((?:input|decoded)\.date\);/g)).toHaveLength(2);
    expect(source).toContain('charted={date === storedDate}');
    expect(fieldsSource).toContain('country={charted ? undefined : city?.country}');
    expect(adoptionNote('1917-11-07', 'gregorian', undefined)).toBeNull();
    // A date typed by hand, or handed over from the Moon phase tool, keeps it.
    expect(source).not.toContain('setStoredDate(handoff.date)');
  });
});
