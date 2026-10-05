import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { signForLongitude, signName, signPrepositional } from '../lib/signs';
import { RUSSIAN_RUNTIME } from '../lib/i18n/ru-runtime/server';
import { NAME_MAX } from '../lib/share';
import { t } from '../lib/i18n';

const source = readFileSync(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('ChartCalculator.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const emissions: ts.Expression[] = [];
const declarations = new Map<string, ts.VariableDeclaration>();
function visit(node: ts.Node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'sunSign') emissions.push(node.initializer);
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node);
  ts.forEachChild(node, visit);
}
visit(ast);
const evaluate = (code: string, context: object) => new Function('context', `with(context){${ts.transpile(code, { target: ts.ScriptTarget.ES2022 })}}`)(context);

describe('reference Sun downstream interpretation', () => {
  it.each([0, 29.999999999999996, 30, 359.99999999999994])('withholds unknown-time Sun context at longitude %s without changing the value', lon => {
    expect(emissions).toHaveLength(3); // computed event, matched context, saved context
    const computedSun = Object.freeze({ body: 'Sun', lon });
    const sunSign = signForLongitude(lon);
    for (const expression of emissions) {
      const value = evaluate(`return (${expression.getText(ast)});`, { input: { timeKnown: false }, computedInput: { timeKnown: false }, computedSun, sunSign, signForLongitude });
      expect(value == null).toBe(true);
    }
    expect(computedSun.lon).toBe(lon);
  });

  it('retains all three known-time Sun context paths', () => {
    for (const expression of emissions) {
      expect(evaluate(`return (${expression.getText(ast)});`, { input: { timeKnown: true }, computedInput: { timeKnown: true }, computedSun: { lon: 45 }, sunSign: signForLongitude(45), signForLongitude })).toBe('taurus');
    }
  });

  it.each(['en', 'es', 'fr', 'it', 'pt', 'ru'] as const)('qualifies new unknown-time automatic names and wording in %s', locale => {
    const sunSign = signForLongitude(45);
    const context = { locale, t, sunSign, signName, signPrepositional, date: '2024-04-19', computedInput: { date: '2024-04-19', timeKnown: false },
      russianCopy: RUSSIAN_RUNTIME, AUTO_NAME_SUN: { en: 'Sun', es: 'Sol', fr: 'Soleil', it: 'Sole', pt: 'Sol' } };
    const code = ['referenceName', 'autoName'].map(name => `const ${declarations.get(name)!.getText(ast)};`).join('\n');
    const name = evaluate(code + '\nreturn autoName;', context);
    expect(name).toBe(`${t(locale, 'referenceChartName')} · 2024-04-19`);
    expect(name.length).toBeLessThanOrEqual(24);
    const known = evaluate(code + '\nreturn autoName;', { ...context, computedInput: { ...context.computedInput, timeKnown: true } });
    expect(known).toContain(locale === 'ru' ? signPrepositional(sunSign) : signName(sunSign, locale));
    if (locale === 'ru') expect(known).toBe('Солнце в Тельце · 2024-04-19');
    if (locale === 'en') expect(known).toBe('Taurus Sun · 2024-04-19');
    expect(t(locale, 'unknownTimeSunReference')).not.toBe('unknownTimeSunReference');
  });

  it('states unverified whole-date Sun coverage without claiming a sign crossing', () => {
    const copy = t('en', 'unknownTimeSunReference');
    expect(copy).toContain('reference-moment positions');
    expect(copy).toContain('has not been verified across the whole birth date');
    expect(copy).not.toMatch(/changes|changed|both signs|all possible/i);
    expect(source).toContain("t(locale, 'unknownTimeSunReference')");
  });

  it('keeps earlier Russian automatic names recognizable beside the current form', () => {
    const sunSign = signForLongitude(75);
    const list = (locale: 'en' | 'ru') => evaluate(
      `const ${declarations.get('autoNameLocales')!.getText(ast)};\nreturn (${declarations.get('autoNames')!.initializer!.getText(ast)});`,
      { locale, sunSign, signName, signPrepositional, NAME_MAX, date: '', computedInput: { date: '2024-06-05' },
        russianCopy: locale === 'ru' ? RUSSIAN_RUNTIME : null,
        CATALOG_LOCALES: ['en', 'es', 'pt', 'fr', 'it', 'ru'], RELEASED_LOCALES: ['en', 'es', 'pt', 'fr', 'it'],
        AUTO_NAME_SUN: { en: 'Sun', es: 'Sol', fr: 'Soleil', it: 'Sole', pt: 'Sol' } },
    ) as string[];
    const russian = list('ru');
    expect(russian).toContain('Солнце в Близнецах · 2024-06-05');
    expect(russian).toContain('Близнецы Солнце · 2024-06-05');
    // Share links cap names at NAME_MAX, so the capped spellings are automatic too.
    expect(russian).toContain('Солнце в Близнецах · 2024-06-05'.slice(0, NAME_MAX).trim());
    expect(russian).toContain('Близнецы Солнце · 2024-06-05'.slice(0, NAME_MAX).trim());
    expect(russian.slice(0, 5)).toEqual(list('en'));
    expect(list('en')).toEqual([
      'Gemini Sun · 2024-06-05', 'Géminis Sol · 2024-06-05', 'Gêmeos Sol · 2024-06-05',
      'Gémeaux Soleil · 2024-06-05', 'Gemelli Sole · 2024-06-05',
    ]);
  });

  it('recognizes automatic reference names without requesting another client catalog', () => {
    const prefixes = evaluate(`return (${declarations.get('AUTO_NAME_REFERENCE')!.initializer!.getText(ast)});`, {});
    for (const locale of ['en', 'es', 'fr', 'it', 'pt', 'ru'] as const) {
      expect(prefixes[locale]).toBe(t(locale, 'referenceChartName'));
    }
    const push = source.split('\n').find(line => line.includes('autoNames.push'))!;
    const autoNames: string[] = [];
    evaluate(push, { autoNames, autoNameLocales: Object.keys(prefixes), AUTO_NAME_REFERENCE: prefixes,
      computedInput: { date: '2024-04-19' }, date: '',
      t: () => { throw new Error('No other client catalog is loaded'); } });
    expect(autoNames).toHaveLength(6);
    expect(autoNames).toContain('Ориентир · 2024-04-19');
  });
});
