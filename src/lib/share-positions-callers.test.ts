import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/*
 * Every chart code that leaves the device is made by one of the shared
 * encoders below, and each keeps ASC and MC to the whole degree. The bodies
 * it carries follow two more rules (share-positions-noon.ts): a chart with a
 * birth time is shared at its UTC instant rounded to the whole minute, since
 * before standard time the instant's seconds give the birthplace's longitude;
 * a chart without one is shared as the sky at 12:00 UTC on its birth date,
 * since its own noon gives the place away. This lists every production call
 * of those encoders with how it keeps both rules, and every call of the exact
 * encoder, encodePositionsLink, with why its code never leaves the device as
 * a new code. A new call, in any file type and under any name, fails here
 * until someone decides and lists it.
 */
const SHARED_ENCODERS = [
  'encodeSharedPositionsLink',
  'encodeSynastryLink',
  'encodeCardLink',
  'calendarToken',
  'deriveInviteChartFromSyncedPayload',
] as const;
const EXACT_ENCODER = 'encodePositionsLink';
const ENCODERS: readonly string[] = [...SHARED_ENCODERS, EXACT_ENCODER];

/**
 * Every file that calls a shared encoder. share-positions.ts, which defines
 * encodeSharedPositionsLink, calls only the exact encoder (EXACT_CALLS).
 */
const PRODUCERS: Record<string, { how: string; mustUse: string[] }> = {
  'src/islands/ChartShareDialog.tsx': {
    how: 'a chart with a birth time is linked from loadTimedSharedPositions at its instant, one without from loadUntimedSharedPositions on its birth date',
    mustUse: ['chart.input.timeKnown', 'loadTimedSharedPositions({', '}, chart.input.utc)', 'loadUntimedSharedPositions(base, birthDate)'],
  },
  'src/islands/CalendarSubscribe.tsx': {
    how: 'given a birth date (only for a chart without a birth time) the feed code comes from loadUntimedSharedPositions; otherwise from the chart itself on a whole UTC minute, or from loadTimedSharedPositions',
    mustUse: [
      'loadUntimedSharedPositions({ houseSystem, engineVersion }, birthDate)',
      'const wholeMinute = !timeUnknown && onWholeMinute(utc);',
      'loadTimedSharedPositions({',
      'const token = wholeMinute ? direct : loaded;',
    ],
  },
  'src/lib/share-synastry.ts': {
    how: 'encodes the two sides it is given; sendBackToken gives it untimed sides at noon UTC and timed sides at the whole minute',
    mustUse: [],
  },
  'src/islands/synastry/SendBackExperience.tsx': {
    how: 'a side with an untimedDate goes through loadUntimedSharedPositions, one with a utc through loadTimedSharedPositions; a received side passes on unchanged',
    mustUse: [
      'loadUntimedSharedPositions(person.positions, person.untimedDate)',
      'loadTimedSharedPositions(person.positions, person.utc)',
      'const token = computed ? computedToken : direct;',
    ],
  },
  'src/lib/invite/validate.ts': {
    how: 'a synced chart becomes timedSharedPositions or untimedSharedPositions with the server ephemeris, or no invitation',
    mustUse: [
      'input = onWholeMinute(utc) ? own : bodiesAt ? timedSharedPositions(own, utc, bodiesAt) : null;',
      'untimedSharedPositions(base, birth.date, bodiesAt)',
    ],
  },
  'src/lib/invite/routes/invites.ts': {
    how: 'passes the server ephemeris for the positions at noon UTC or at the whole minute',
    mustUse: ["import('../../engine/server-ephemeris.js')"],
  },
  'src/lib/profile/card-link.ts': {
    how: 'cards are made from cardPositionsForChart; decoding and matching re-encode codes already made',
    mustUse: [
      'timedSharedPositions(positions, chart.summary.utcISO, bodiesAt)',
      'untimedSharedPositions(positions, chart.birth.date, bodiesAt)',
    ],
  },
  'src/islands/ProfileIdentity.tsx': {
    how: 'makes the card from loadCardPositionsForChart',
    mustUse: ['loadCardPositionsForChart(chart)'],
  },
};

/**
 * Every call of the exact encoder, which keeps ASC and MC and every body to
 * 0.001°. None may make a new code that leaves the device.
 */
const EXACT_CALLS: Record<string, { call: string; why: string }[]> = {
  'src/lib/share-positions.ts': [
    { call: 'encodePositionsLink(input)', why: 'encodeSharedPositionsLink itself, for input without angles, which its callers have already made shareable' },
    { call: 'encodePositionsLink({ ...input, angles: wholeDegreeAngles(angles) })', why: 'encodeSharedPositionsLink itself, with the angles at the whole degree' },
  ],
  'src/islands/ProfilePeople.tsx': [
    { call: 'encodePositionsLink(entry.chart)', why: 'a card someone sent, already a shared code, re-encoded unchanged into a link that opens it on this device' },
  ],
  'src/islands/synastry/inviteClient.ts': [
    { call: 'encodePositionsLink(source as unknown as Parameters<typeof encodePositionsLink>[0])', why: 'checks the positions of an invitation our server returned, already shared; nothing is sent' },
  ],
  'src/lib/account-v2/chart-wire.ts': [
    { call: 'encodePositionsLink({ bodies, angles: chart.summary.angles, houseSystem: chart.summary.houseSystem, engineVersion: chart.summary.engineVersion, })', why: 'canonicalizes the positions of the upload to the person’s own synced account, which carries the birth details themselves' },
  ],
  'src/lib/profile/circle.ts': [
    { call: 'encodePositionsLink(chart as PositionsShareInput)', why: 'canonicalizes a received card before it is kept on this device' },
    { call: 'encodePositionsLink(a)', why: 'compares two kept cards on this device' },
    { call: 'encodePositionsLink(b)', why: 'compares two kept cards on this device' },
  ],
  'src/lib/profile/pairs.ts': [
    { call: 'encodePositionsLink(side.chart as PositionsShareInput)', why: 'validates a received side read back from this device’s saved comparisons' },
    { call: 'encodePositionsLink(side.chart)', why: 'a received side’s identity key for a saved comparison, kept on this device' },
    { call: 'encodePositionsLink(chart)', why: 'canonicalizes a received side before it is kept on this device' },
  ],
  'src/lib/invite/validate.ts': [
    { call: "encodePositionsLink({ bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: (payload.b as number[])[index], })), angles, houseSystem: payload.h === 'w' ? 'whole' : 'placidus', engineVersion: payload.v, })", why: 'checks positions already stored with an invitation; it makes none' },
  ],
};

/** Every chart built by the calculators and passed to a producer's untimed or timed path. */
const SHARE_INSTANT_SOURCES: Record<string, string[]> = {
  'src/islands/ChartCalculator.tsx': [
    "birthDate={chart.input.timeKnown ? undefined : computedInput?.date ?? ''}",
    'utc: chart.input.utc,',
  ],
  'src/islands/SynastryCalculator.tsx': [
    '...(resolved.timeKnown ? { utc: summary.utcISO } : { untimedDate: chart.birth.date })',
    '...(input.timeKnown ? { utc: resolved.utc } : { untimedDate: input.date })',
    '...(timeKnown ? { utc: resolved.utc } : { untimedDate: slot.date })',
    'a={result.a}',
    'b={result.b}',
  ],
  'src/islands/TransitTracker.tsx': [
    'return wheelFromChart(r, timeKnown, resolved.utc);',
    'return wheelFromChart(r, timeKnown, resolved.utc, chart.summary.houseSystem);',
    'utc: chart.summary.utcISO,',
  ],
};

interface EncoderUse {
  encoder: string;
  /** The call's source text, or `reference` for any other use of an encoder. */
  call: string;
}

/** The TypeScript/JavaScript an .astro file runs: its frontmatter and its scripts. */
function astroScripts(source: string): string[] {
  const parts: string[] = [];
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(source);
  if (frontmatter) parts.push(frontmatter[1]);
  for (const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gu)) parts.push(match[1]);
  return parts;
}

const scriptKind = (path: string) => (/\.(?:jsx|tsx)$/u.test(path) ? ts.ScriptKind.TSX
  : /\.(?:js|mjs|cjs)$/u.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS);

/**
 * Every call of an encoder in one file, however it is named there: imported
 * under an alias, reached through a namespace or a module object, taken from
 * a dynamic import, or assigned to another name. Any other reference to an
 * encoder (passed as a value, re-exported) is reported as `reference`.
 */
function encoderUses(source: string, path: string): EncoderUse[] {
  if (path.endsWith('.astro')) {
    const uses = astroScripts(source).flatMap((part) => encoderUses(part, `${path}.ts`));
    // The template can call a function too: any mention outside the scripts is reported.
    let template = source;
    for (const part of astroScripts(source)) template = template.replace(part, '');
    for (const encoder of ENCODERS) {
      if (new RegExp(`\\b${encoder}\\b`, 'u').test(template)) uses.push({ encoder, call: 'reference' });
    }
    return uses;
  }
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKind(path));
  const aliases = new Map<string, string>();
  const namespaces = new Set<string>();
  const uses: EncoderUse[] = [];
  const text = (node: ts.Node) => node.getText(file).replace(/\s+/gu, ' ').replace(/\( /gu, '(').replace(/ \)/gu, ')');

  const collect = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && node.importClause?.namedBindings) {
      const bindings = node.importClause.namedBindings;
      if (ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
      else {
        for (const element of bindings.elements) {
          const imported = (element.propertyName ?? element.name).text;
          if (ENCODERS.includes(imported)) aliases.set(element.name.text, imported);
        }
      }
    }
    if (ts.isBindingElement(node)) {
      const property = node.propertyName && ts.isIdentifier(node.propertyName) ? node.propertyName.text
        : ts.isIdentifier(node.name) ? node.name.text : null;
      if (property && ENCODERS.includes(property) && ts.isIdentifier(node.name)) aliases.set(node.name.text, property);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const value = node.initializer;
      if (ts.isIdentifier(value) && ENCODERS.includes(value.text)) aliases.set(node.name.text, value.text);
      if (ts.isPropertyAccessExpression(value) && ENCODERS.includes(value.name.text)) aliases.set(node.name.text, value.name.text);
    }
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name && ts.isIdentifier(node.name)
      && ENCODERS.includes(node.name.text) && !aliases.has(node.name.text)) {
      aliases.set(node.name.text, node.name.text);
    }
    ts.forEachChild(node, collect);
  };
  collect(file);

  const encoderOf = (node: ts.Node): string | null => {
    if (ts.isIdentifier(node)) return aliases.get(node.text) ?? (ENCODERS.includes(node.text) ? node.text : null);
    if (ts.isPropertyAccessExpression(node) && ENCODERS.includes(node.name.text)) return node.name.text;
    return null;
  };
  const declares = (node: ts.Node) => {
    const parent = node.parent;
    return Boolean(parent) && (
      ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isBindingElement(parent)
      || ((ts.isFunctionDeclaration(parent) || ts.isVariableDeclaration(parent)) && parent.name === node)
      || (ts.isPropertyAccessExpression(parent) && parent.name === node)
      || ts.isTypeQueryNode(parent)
    );
  };

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const encoder = encoderOf(node.expression);
      if (encoder) {
        uses.push({ encoder, call: text(node) });
        node.arguments.forEach(visit);
        return;
      }
    }
    if (ts.isExportSpecifier(node) && ENCODERS.includes((node.propertyName ?? node.name).text)) {
      uses.push({ encoder: (node.propertyName ?? node.name).text, call: 'reference' });
    } else if ((ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) && !declares(node)) {
      const encoder = encoderOf(node);
      const aliasDeclaration = ts.isIdentifier(node) && node.parent && ts.isVariableDeclaration(node.parent)
        && node.parent.initializer === node && ts.isIdentifier(node.parent.name) && aliases.has(node.parent.name.text);
      const accessDeclaration = ts.isPropertyAccessExpression(node) && node.parent && ts.isVariableDeclaration(node.parent)
        && node.parent.initializer === node;
      if (encoder && !aliasDeclaration && !accessDeclaration
        && !(ts.isIdentifier(node) && namespaces.has(node.text))) uses.push({ encoder, call: 'reference' });
      if (ts.isPropertyAccessExpression(node)) return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return uses;
}

const root = resolve(process.cwd());

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const PRODUCTION_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|astro)$/u;
const production = [...walk(resolve(root, 'src')), ...walk(resolve(root, 'api'))]
  .filter((path) => PRODUCTION_FILE.test(path) && !/\.test\.|\.spec\.|\.d\.ts$/u.test(path))
  .map((path) => relative(root, path).split(sep).join('/'));

const squash = (value: string) => value.replace(/\s+/gu, '').replace(/,\)/gu, ')').replace(/,\}/gu, '}');

describe('producers of shared chart codes', () => {
  const uses = new Map(production.map((path) => [path, encoderUses(readFileSync(resolve(root, path), 'utf8'), path)]));

  it('finds encoder calls in .ts, .tsx, .js, .jsx and .astro files, through aliases, namespaces and dynamic imports', () => {
    expect(production.some((path) => path.endsWith('.jsx'))).toBe(true);
    expect(production.some((path) => path.endsWith('.js'))).toBe(true);
    expect(production.some((path) => path.endsWith('.astro'))).toBe(true);
    const calls = (source: string, path: string) => encoderUses(source, path).map(({ encoder, call }) => `${encoder}: ${call}`);
    expect(calls("import { encodePositionsLink as exact } from '../share-positions';\nexact(chart);", 'a.ts'))
      .toEqual(['encodePositionsLink: exact(chart)']);
    expect(calls("import * as positions from './share-positions';\npositions.encodeSharedPositionsLink(x);", 'b.js'))
      .toEqual(['encodeSharedPositionsLink: positions.encodeSharedPositionsLink(x)']);
    expect(calls("const { calendarToken: feed } = await import('./CalendarSubscribe');\nfeed(p);", 'c.mjs'))
      .toEqual(['calendarToken: feed(p)']);
    expect(calls("import('./card-link').then(({ encodeCardLink }) => encodeCardLink(card));", 'd.ts'))
      .toEqual(['encodeCardLink: encodeCardLink(card)']);
    expect(calls("const mod = await import('./share-synastry');\nconst link = mod.encodeSynastryLink;\nlink(pair);", 'e.ts'))
      .toEqual(['encodeSynastryLink: link(pair)']);
    expect(calls("import { encodeCardLink } from './card-link';\nexport const A = () => <a href={encodeCardLink({ chart })} />;", 'f.jsx'))
      .toEqual(['encodeCardLink: encodeCardLink({ chart })']);
    expect(calls("import { encodePositionsLink } from './share-positions';\nrows.map(encodePositionsLink);\nexport { encodePositionsLink };", 'g.ts'))
      .toEqual(['encodePositionsLink: reference', 'encodePositionsLink: reference']);
    expect(calls("---\nimport { calendarToken } from '../islands/CalendarSubscribe';\nconst t = calendarToken(p);\n---\n<a href={encodeCardLink(c)}>x</a>", 'h.astro'))
      .toEqual(['calendarToken: calendarToken(p)', 'encodeCardLink: reference']);
  });

  it('lists every production call of a shared-code encoder, each with how it keeps a code to the whole minute or to noon UTC', () => {
    const calling = production.filter((path) => uses.get(path)!
      .some(({ encoder }) => (SHARED_ENCODERS as readonly string[]).includes(encoder))).sort();
    expect(calling).toEqual(Object.keys(PRODUCERS).sort());
    for (const [path, { mustUse }] of Object.entries(PRODUCERS)) {
      const source = readFileSync(resolve(root, path), 'utf8');
      for (const text of mustUse) expect(source, `${path} must contain ${text}`).toContain(text);
    }
  });

  it('lists every production call of the exact encoder, each with why its code does not leave the device as a new one', () => {
    const problems: string[] = [];
    for (const [path, found] of uses) {
      const exact = found.filter(({ encoder }) => encoder === EXACT_ENCODER).map(({ call }) => squash(call)).sort();
      const listed = (EXACT_CALLS[path] ?? []).map(({ call }) => squash(call)).sort();
      if (JSON.stringify(exact) !== JSON.stringify(listed)) {
        problems.push(`${path}: found ${JSON.stringify(exact)}, listed ${JSON.stringify(listed)}`);
      }
    }
    for (const [path, calls] of Object.entries(EXACT_CALLS)) {
      for (const { why } of calls) expect(why.length, path).toBeGreaterThan(20);
    }
    expect(problems).toEqual([]);
    // Nothing takes an encoder as a value, where a call could not be seen.
    const references = [...uses].flatMap(([path, found]) => found
      .filter(({ call }) => call === 'reference').map(({ encoder }) => `${path}: ${encoder}`));
    expect(references).toEqual([]);
  });

  it('gives the shared path the civil birth date or the UTC instant wherever a calculator computes a chart', () => {
    for (const [path, texts] of Object.entries(SHARE_INSTANT_SOURCES)) {
      const source = readFileSync(resolve(root, path), 'utf8');
      for (const text of texts) expect(source, `${path} must contain ${text}`).toContain(text);
    }
  });
});
