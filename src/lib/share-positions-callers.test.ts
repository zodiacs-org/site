import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/*
 * Every chart code that leaves the device is made by one of the shared
 * encoders below, and each keeps ASC and MC to the whole degree. The bodies
 * it carries follow two more rules (share-positions-noon.ts): a chart with a
 * birth time is shared at its UTC instant rounded to the whole minute, since
 * before standard time the instant's seconds give the birthplace's longitude;
 * a chart without one is shared as the sky at 12:00 UTC on its birth date,
 * since its own noon gives the place away. The exact encoder,
 * encodePositionsLink, keeps ASC and MC and every body to 0.001°; none of its
 * codes may leave the device as a new one.
 *
 * Rather than search for names, this follows the module graph, so a new way
 * to reach an encoder fails here until someone decides and lists it:
 *
 * - A module can reach the exact encoder only by loading share-positions.ts
 *   (statically, dynamically, through require, a glob, a computed path, a
 *   worker URL or a script tag) or a module that passes the encoder on.
 *   Every module that loads it at run time is listed, with what it takes
 *   from it and why (EXACT_MODULE_IMPORTERS). Type-only imports are erased
 *   and carry nothing.
 * - In every module, an encoder may only be called by name: any other use
 *   (as a value, an argument, `.call`, `.apply` or `.bind`, an alias, an
 *   export or a re-export, a computed or rest destructuring) fails, and so
 *   does any use of its module's object other than reading a member by name
 *   or calling an encoder on it. A module that passes the exact encoder on
 *   counts as its module, so its importers must be listed too.
 * - Each call is listed: the exact encoder's with why its code stays on the
 *   device (EXACT_CALLS), the shared encoders' with how their file keeps the
 *   two rules (PRODUCERS).
 * - The frontmatter and scripts of .astro files and the ESM of .mdx files
 *   are parsed as modules; a name bound to an encoder or its module may not
 *   appear in their templates, and nothing there may load a module.
 * - Every relative, rooted or aliased path must name a file; a file the
 *   site serves from a build is followed to its source (BUILT_FILES); a
 *   template literal is read as the glob Vite bundles it by; any other
 *   computed path must be listed with what it loads (OPAQUE_LOADS); and code
 *   run from a string (eval, the Function constructor) fails.
 *
 * The probes at the end, the first fifteen from an independent review, each
 * add or change modules and must each make this fail.
 */
const EXACT_MODULE = 'src/lib/share-positions.ts';
const EXACT_ENCODER = 'encodePositionsLink';

/** The encoders of codes that leave the device, by the module that defines each. */
const SHARED_ENCODERS: Record<string, readonly string[]> = {
  'src/lib/share-positions.ts': ['encodeSharedPositionsLink'],
  'src/lib/share-synastry.ts': ['encodeSynastryLink'],
  'src/lib/profile/card-link.ts': ['encodeCardLink'],
  'src/islands/CalendarSubscribe.tsx': ['calendarToken'],
  'src/lib/invite/validate.ts': ['deriveInviteChartFromSyncedPayload'],
};

/**
 * Every module that loads the exact encoder's module at run time, with what
 * it takes from it and why.
 */
const EXACT_MODULE_IMPORTERS: Record<string, { takes: string[]; why: string }> = {
  'api/calendar/transits.ts': {
    takes: ['decodePositionsLink', 'wholeDegreeAngles'],
    why: 'the calendar feed decodes the code in its URL and takes its angles to the whole degree',
  },

  'src/islands/ChartShareDialog.tsx': {
    takes: ['encodeSharedPositionsLink'],
    why: 'makes the chart link with the shared encoder (PRODUCERS)',
  },
  'src/islands/PositionsShareSurface.tsx': {
    takes: ['decodePositionsLink'],
    why: 'decodes a received chart link to show it',
  },
  'src/islands/ProfilePeople.tsx': {
    takes: [EXACT_ENCODER],
    why: 'opens a received card on this device (EXACT_CALLS)',
  },
  'src/islands/SomeoneElseChart.tsx': {
    takes: ['decodePositionsLink'],
    why: 'decodes a received chart link to show it',
  },
  'src/islands/synastry/inviteClient.ts': {
    takes: ['decodePositionsLink', EXACT_ENCODER],
    why: 'checks the positions of an invitation the server returned (EXACT_CALLS)',
  },
  'src/lib/account-v2/chart-wire.ts': {
    takes: ['POSITION_BODY_ORDER', 'decodePositionsLink', EXACT_ENCODER],
    why: 'canonicalizes the upload to the person’s own synced account (EXACT_CALLS)',
  },
  'src/lib/account-v2/remote-chart.ts': {
    takes: ['POSITION_BODY_ORDER'],
    why: 'reads the body order of the synced positions; nothing is encoded',
  },
  'src/lib/invite/routes/invites.ts': {
    takes: ['POSITION_BODY_ORDER'],
    why: 'reads the body order of stored invitation positions; nothing is encoded',
  },
  'src/lib/invite/validate.ts': {
    takes: ['POSITION_BODY_ORDER', 'decodePositionsLink', EXACT_ENCODER, 'encodeSharedPositionsLink'],
    why: 'checks stored positions (EXACT_CALLS) and makes invitation positions with the shared encoder (PRODUCERS)',
  },
  'src/lib/profile/card-link.ts': {
    takes: ['decodePositionsLink', 'encodeSharedPositionsLink'],
    why: 'makes and reads chart cards with the shared encoder (PRODUCERS)',
  },
  'src/lib/profile/circle.ts': {
    takes: ['decodePositionsLink', EXACT_ENCODER],
    why: 'canonicalizes and compares cards kept on this device (EXACT_CALLS)',
  },
  'src/lib/profile/pairs.ts': {
    takes: ['decodePositionsLink', EXACT_ENCODER],
    why: 'canonicalizes received sides of saved comparisons kept on this device (EXACT_CALLS)',
  },
  'src/lib/share-synastry.ts': {
    takes: ['decodePositionsLink', 'encodeSharedPositionsLink'],
    why: 'makes and reads two-chart links with the shared encoder (PRODUCERS)',
  },
  'src/server/chart-preview-model.ts': {
    takes: ['decodePositionsLink'],
    why: 'the link preview decodes the code it is given; nothing is encoded',
  },
};

/**
 * Every call of a shared encoder, by file, with how the file keeps the two
 * rules. share-positions.ts, which defines encodeSharedPositionsLink, calls
 * only the exact encoder (EXACT_CALLS).
 */
const PRODUCERS: Record<string, { how: string; calls: string[]; mustUse: string[] }> = {
  'src/islands/ChartShareDialog.tsx': {
    how: 'a chart with a birth time is linked from loadTimedSharedPositions at its instant, one without from loadUntimedSharedPositions on its birth date',
    calls: ['encodeSharedPositionsLink(shared)'],
    mustUse: ['chart.input.timeKnown', 'loadTimedSharedPositions({', '}, chart.input.utc)', 'loadUntimedSharedPositions(base, birthDate)'],
  },

  'src/lib/share-synastry.ts': {
    how: 'encodes the two sides it is given; sendBackToken gives it untimed sides at noon UTC and timed sides at the whole minute',
    calls: ['encodeSharedPositionsLink(first.chart)', 'encodeSharedPositionsLink(second.chart)'],
    mustUse: [],
  },
  'src/islands/synastry/SendBackExperience.tsx': {
    how: 'a side with an untimedDate goes through loadUntimedSharedPositions, one with a utc through loadTimedSharedPositions; a received side passes on unchanged',
    calls: [
      'encodeSynastryLink({ sides: [{ chart: chartA, label: a.label }, { chart: chartB, label: b.label }] })',
      'encodeSynastryLink({ sides: [ { chart: a.positions, label: a.label }, { chart: b.positions, label: b.label }, ], })',
    ],
    mustUse: [
      'loadUntimedSharedPositions(person.positions, person.untimedDate)',
      'loadTimedSharedPositions(person.positions, person.utc)',
      'const token = computed ? computedToken : direct;',
    ],
  },
  'src/lib/invite/validate.ts': {
    how: 'a synced chart becomes timedSharedPositions or untimedSharedPositions with the server ephemeris, or no invitation',
    calls: ['encodeSharedPositionsLink(input)'],
    mustUse: [
      'input = onWholeMinute(utc) ? own : bodiesAt ? timedSharedPositions(own, utc, bodiesAt) : null;',
      'untimedSharedPositions(base, birth.date, bodiesAt)',
    ],
  },
  'src/lib/invite/routes/invites.ts': {
    how: 'passes the server ephemeris for the positions at noon UTC or at the whole minute',
    calls: ['deriveInviteChartFromSyncedPayload(syncedPayload, (utc) => POSITION_BODY_ORDER.map((body) => ({ body, lon: bodyLongitude(body, utc) })),)'],
    mustUse: ["import('../../engine/server-ephemeris.js')"],
  },
  'src/lib/profile/card-link.ts': {
    how: 'cards are made from cardPositionsForChart; decoding and matching re-encode codes already made',
    calls: [
      'encodeSharedPositionsLink(input.chart)',
      'encodeSharedPositionsLink(chart)',
      'encodeSharedPositionsLink(positions)',
      'encodeSharedPositionsLink(card.chart)',
    ],
    mustUse: [
      'timedSharedPositions(positions, chart.summary.utcISO, bodiesAt)',
      'untimedSharedPositions(positions, chart.birth.date, bodiesAt)',
    ],
  },
  'src/islands/ProfileIdentity.tsx': {
    how: 'makes the card from loadCardPositionsForChart',
    calls: ['encodeCardLink({ chart: positions, label: name })'],
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

/**
 * Every load whose path is an expression, with the modules it can load.
 * Each is matched by the expression's text.
 */
const OPAQUE_LOADS: Record<string, { expression: string; loads: string[]; why: string }[]> = {
  'src/components/EmailCaptureEnhancement.astro': [{
    expression: 'enhancementUrl',
    loads: ['src/lib/email/capture-enhancement.js'],
    why: 'the URL of capture-enhancement.js, from the ?url import in the frontmatter',
  }],
  'src/lib/assistant/guide-bootstrap.ts': [{
    expression: 'DRAWER_MODULE_HREF',
    loads: ['src/lib/assistant/open-assistant.ts'],
    why: '/assets/assistant-drawer.js, which scripts/build-assistant-ui.mjs builds from open-assistant.ts',
  }],
};

/**
 * Files the site serves that a build script makes from a module read here,
 * by the path a module loads them at: a load of one is a load of its source.
 */
const BUILT_FILES: Record<string, { source: string; by: string }> = {
  'assets/search-ui.js': { source: 'src/lib/search/open-search.ts', by: 'scripts/build-search-ui.mjs' },
  'assets/webmcp-register.js': { source: 'src/lib/webmcp/register.ts', by: 'scripts/build-webmcp.mjs' },
  'assets/registry-token-chart.js': { source: 'src/registry/selected-token-chart.mjs', by: 'scripts/build-registry-token-chart.mjs' },
  'precision-preview/app.mjs': { source: 'src/precision-preview/app.src.mjs', by: 'scripts/build-precision-preview.mjs' },
  // The preview app loads its worker by URL, from beside the built app.mjs.
  'src/precision-preview/worker.mjs': { source: 'src/precision-preview/worker.src.mjs', by: 'scripts/build-precision-preview.mjs' },
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

// ---------------------------------------------------------------------------
// Reading the modules

const root = resolve(process.cwd());
const ROOTS = ['src', 'api'];
const CODE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|astro|mdx)$/u;
const NOT_PRODUCTION = /\.(?:test|spec)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/u;
/** Files that hold no code: data, styles, fonts, images, prose and test snapshots. */
const NOT_CODE = /\.(?:json|css|snap|woff2?|ttf|otf|svg|png|jpe?g|webp|avif|gif|ico|md|txt|html|xml|yaml|yml|csv|wasm)$/u;
/** Package names the builds map to repository files (scripts/build-precision-preview.mjs). */
const ALIASES: Record<string, string> = {
  '@zodiacs/precision-alpha/browser': 'examples/precision-alpha/src/browser.mjs',
};

type Files = Map<string, string>;

function walk(directory: string): string[] {
  const absolute = resolve(root, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = posix.join(directory, entry.name);
    if (['node_modules', '.git', 'dist', '.astro', '.cache', '.vercel'].includes(entry.name)) return [];
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function productionFiles(): { files: Files; others: string[] } {
  const files: Files = new Map();
  const others: string[] = [];
  for (const path of ROOTS.flatMap(walk)) {
    if (CODE.test(path)) {
      if (!NOT_PRODUCTION.test(path)) files.set(path, readFileSync(resolve(root, path), 'utf8'));
    } else if (!NOT_CODE.test(path)) others.push(path);
  }
  return { files, others };
}

type EdgeKind = 'import' | 'export' | 'import-equals' | 'dynamic' | 'require' | 'glob' | 'computed' | 'url' | 'script';

interface RawEdge {
  kind: EdgeKind;
  /** The specifier; for a glob or template literal, the pattern; for a computed load, the expression. */
  specifier: string;
  patterns?: string[];
  typeOnly: boolean;
  node: ts.Node | null;
  unit: ts.SourceFile | null;
}

interface Parsed {
  /** A .ts/.js file whole; an .astro file's frontmatter and scripts; an .mdx file's ESM. */
  units: ts.SourceFile[];
  /** What else an .astro or .mdx file holds: markup and expressions. */
  template: string;
  edges: RawEdge[];
  /** Code run from a string (eval, the Function constructor) or a load in a template: nothing here can follow it. */
  unfollowable: string[];
}

const scriptKind = (path: string) => (/\.tsx$/u.test(path) ? ts.ScriptKind.TSX
  : /\.jsx$/u.test(path) ? ts.ScriptKind.JSX
    : /\.[cm]?js$/u.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS);

const parsedCache = new Map<string, Parsed>();

function parse(path: string, source: string): Parsed {
  const key = `${path}\u0000${source}`;
  const cached = parsedCache.get(key);
  if (cached) return cached;
  const unit = (code: string, index: number, kind: ts.ScriptKind) => ts.createSourceFile(
    `${path}#${index}`, code, ts.ScriptTarget.Latest, true, kind,
  );
  const scriptSources: string[] = [];
  let units: ts.SourceFile[];
  let template = '';
  if (path.endsWith('.astro')) {
    const frontmatter = /^\uFEFF?\s*---\r?\n([\s\S]*?)\r?\n---[^\n]*(?:\n|$)/u.exec(source);
    const codes = frontmatter ? [frontmatter[1]] : [];
    template = (frontmatter ? source.slice(frontmatter[0].length) : source)
      .replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu, (_, attributes: string, body: string) => {
        if (/\bsrc\s*=/u.test(attributes)) {
          const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/u.exec(attributes);
          scriptSources.push(src ? (src[1] ?? src[2]) : attributes.trim());
        }
        codes.push(body);
        return ' ';
      });
    units = codes.map((code, index) => unit(code, index, ts.ScriptKind.TS));
  } else if (path.endsWith('.mdx')) {
    const frontmatter = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---[^\n]*(?:\n|$)/u.exec(source);
    const blocks = (frontmatter ? source.slice(frontmatter[0].length) : source).split(/\r?\n[ \t]*\r?\n/u);
    const isEsm = (block: string) => /^\s*(?:import|export)\b/u.test(block);
    const esm = blocks.filter(isEsm);
    template = blocks.filter((block) => !isEsm(block)).join('\n\n');
    units = esm.map((code, index) => unit(code, index, ts.ScriptKind.TSX));
  } else {
    units = [unit(source, 0, scriptKind(path))];
  }
  const parsed: Parsed = { units, template, edges: [], unfollowable: [] };
  for (const sourceFile of units) {
    parsed.edges.push(...rawEdges(sourceFile));
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && node.text === 'eval' && !notAReference(node)) parsed.unfollowable.push(oneLine(node.parent));
      if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && ts.isIdentifier(node.expression)
        && node.expression.text === 'Function') parsed.unfollowable.push(oneLine(node));
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  const templateLoad = /\bimport\s*\(|\brequire\s*\(|\bimport\.meta\b|\bAstro\.glob\b/u.exec(template);
  if (templateLoad) parsed.unfollowable.push(`${templateLoad[0]} in its template`);
  for (const specifier of scriptSources) {
    parsed.edges.push({ kind: /^(?:[./~]|https?:)/u.test(specifier) ? 'script' : 'computed', specifier, typeOnly: false, node: null, unit: null });
  }
  parsedCache.set(key, parsed);
  return parsed;
}

const literalText = (node: ts.Node | undefined) => (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
  ? node.text : null);
const isImportMeta = (node: ts.Node) => ts.isMetaProperty(node)
  && node.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === 'meta';

/** Every load of another module one parsed unit makes. */
function rawEdges(unit: ts.SourceFile): RawEdge[] {
  const edges: RawEdge[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings : null;
      const typeOnly = Boolean(clause && (clause.isTypeOnly
        || (!clause.name && named && named.elements.length > 0 && named.elements.every((element) => element.isTypeOnly))));
      edges.push({ kind: 'import', specifier: literalText(node.moduleSpecifier) ?? '', typeOnly, node, unit });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const named = node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause : null;
      const typeOnly = node.isTypeOnly
        || Boolean(named && named.elements.length > 0 && named.elements.every((element) => element.isTypeOnly));
      edges.push({ kind: 'export', specifier: literalText(node.moduleSpecifier) ?? '', typeOnly, node, unit });
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      edges.push({
        kind: 'import-equals', specifier: literalText(node.moduleReference.expression) ?? '', typeOnly: node.isTypeOnly, node, unit,
      });
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const argument = node.arguments[0];
      const load = callee.kind === ts.SyntaxKind.ImportKeyword ? 'dynamic'
        : ts.isIdentifier(callee) && callee.text === 'require' ? 'require' : null;
      const glob = ts.isPropertyAccessExpression(callee) && (
        (isImportMeta(callee.expression) && ['glob', 'globEager'].includes(callee.name.text))
        || (ts.isIdentifier(callee.expression) && callee.expression.text === 'Astro' && callee.name.text === 'glob'));
      if (load) {
        const text = literalText(argument);
        if (text !== null) edges.push({ kind: load, specifier: text, typeOnly: false, node, unit });
        else if (argument && ts.isTemplateExpression(argument)) {
          // Vite bundles `./dir/${x}.json` as the glob ./dir/*.json; ** is wider still.
          const pattern = argument.head.text + argument.templateSpans.map((span) => `**${span.literal.text}`).join('');
          edges.push({ kind: 'glob', specifier: argument.getText(unit), patterns: [pattern], typeOnly: false, node, unit });
        } else edges.push({ kind: 'computed', specifier: argument ? argument.getText(unit) : '', typeOnly: false, node, unit });
      } else if (glob) {
        const patterns = argument && ts.isArrayLiteralExpression(argument)
          ? argument.elements.map((element) => literalText(element))
          : [literalText(argument)];
        if (patterns.every((pattern): pattern is string => pattern !== null)) {
          edges.push({ kind: 'glob', specifier: argument!.getText(unit), patterns, typeOnly: false, node, unit });
        } else edges.push({ kind: 'computed', specifier: argument ? argument.getText(unit) : '', typeOnly: false, node, unit });
      }
    } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL'
      && node.arguments?.length === 2 && ts.isPropertyAccessExpression(node.arguments[1])
      && isImportMeta(node.arguments[1].expression) && node.arguments[1].name.text === 'url') {
      const text = literalText(node.arguments[0]);
      edges.push(text !== null
        ? { kind: 'url', specifier: text, typeOnly: false, node, unit }
        : { kind: 'computed', specifier: node.arguments[0].getText(unit), typeOnly: false, node, unit });
    }
    ts.forEachChild(node, visit);
  };
  visit(unit);
  return edges;
}

// ---------------------------------------------------------------------------
// Resolving paths

const diskFiles = new Map<string, boolean>();
const diskListings = new Map<string, string[]>();

function isFile(files: Files, path: string): boolean {
  if (files.has(path)) return true;
  let known = diskFiles.get(path);
  if (known === undefined) {
    const absolute = resolve(root, path);
    known = existsSync(absolute) && statSync(absolute).isFile();
    diskFiles.set(path, known);
  }
  return known;
}

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.astro', '.mdx', '.json'];

/** The repository path a specifier names before extensions are tried, or 'external' for a package or anything outside. */
function localBase(from: string, specifier: string): string | 'external' {
  const path = specifier.replace(/[?#].*$/su, '');
  let base: string;
  if (path === '.' || path === '..' || path.startsWith('./') || path.startsWith('../')) base = posix.join(posix.dirname(from), path);
  else if (path.startsWith('~/')) base = posix.join('src', path.slice(2));
  else if (path.startsWith(`${root}/`)) base = path.slice(root.length + 1);
  else if (path.startsWith('/')) base = path.slice(1);
  else if (ALIASES[path]) base = ALIASES[path];
  else if (/^(?:src|api)\//u.test(path)) base = path; // tsconfig baseUrl "."
  else return 'external';
  return base.startsWith('../') || base === '..' || base.startsWith('node_modules/') ? 'external' : posix.normalize(base);
}

/** The file a specifier names, 'external' for a package, or null when a local path names no file. */
function resolveSpecifier(files: Files, from: string, specifier: string): string | 'external' | null {
  const base = localBase(from, specifier);
  if (base === 'external') return base;
  const candidates = [base];
  const js = /\.([cm]?)js(x?)$/u.exec(base);
  if (js) candidates.push(`${base.slice(0, -js[0].length)}.${js[1]}ts${js[2]}`);
  for (const extension of EXTENSIONS) candidates.push(base + extension);
  for (const extension of EXTENSIONS) candidates.push(`${base}/index${extension}`);
  const file = candidates.find((candidate) => isFile(files, candidate));
  if (file) return file;
  if (BUILT_FILES[base]) return BUILT_FILES[base].source;
  // Served from public/ as it is: hand-written, or built from a module read here in its own right.
  if (specifier.startsWith('/') && isFile(files, `public/${base}`)) return 'external';
  return null;
}

function listUnder(files: Files, directory: string): string[] {
  let listing = diskListings.get(directory);
  if (!listing) {
    listing = walk(directory);
    diskListings.set(directory, listing);
  }
  const prefix = directory ? `${directory}/` : '';
  return [...new Set([...listing, ...[...files.keys()].filter((path) => path.startsWith(prefix))])];
}

function globToRegex(glob: string): RegExp {
  let source = '';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === '*' && glob[index + 1] === '*') {
      source += '.*';
      index += glob[index + 2] === '/' ? 2 : 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else if (char === '{') {
      const end = glob.indexOf('}', index);
      source += `(?:${glob.slice(index + 1, end).split(',').map((part) => part.replace(/[.+^$()|[\]\\]/gu, '\\$&').replace(/\*/gu, '[^/]*')).join('|')})`;
      index = end;
    } else source += char.replace(/[.+^$()|[\]\\{}]/gu, '\\$&');
  }
  return new RegExp(`^${source}$`, 'u');
}

/** The files a glob can load, or null when its base cannot be placed. */
function globFiles(files: Files, from: string, patterns: string[]): string[] | null {
  const matched = new Set<string>();
  const excluded: RegExp[] = [];
  for (const raw of patterns) {
    const negated = raw.startsWith('!');
    const base = localBase(from, negated ? raw.slice(1) : raw);
    if (base === 'external') return null;
    const regex = globToRegex(base);
    if (negated) {
      excluded.push(regex);
      continue;
    }
    const fixed = base.split(/[*?{[]/u)[0];
    const directory = fixed.endsWith('/') ? fixed.slice(0, -1) : posix.dirname(fixed);
    for (const path of listUnder(files, directory === '.' ? '' : directory)) if (regex.test(path)) matched.add(path);
  }
  return [...matched].filter((path) => !excluded.some((regex) => regex.test(path)));
}

interface Edge extends RawEdge {
  targets: string[];
  unresolved: boolean;
  opaque: boolean;
}

function resolveEdges(files: Files, path: string, parsed: Parsed): Edge[] {
  return parsed.edges.map((edge) => {
    if (edge.kind === 'glob') {
      const targets = globFiles(files, path, edge.patterns!);
      return { ...edge, targets: targets ?? [], unresolved: false, opaque: targets === null };
    }
    if (edge.kind === 'computed') {
      const listed = OPAQUE_LOADS[path]?.find(({ expression }) => expression === edge.specifier);
      return { ...edge, targets: listed?.loads ?? [], unresolved: false, opaque: !listed };
    }
    if (/^(?:[a-z]+:)?\/\//iu.test(edge.specifier)) return { ...edge, targets: [], unresolved: false, opaque: false };
    const target = resolveSpecifier(files, path, edge.specifier);
    return {
      ...edge, targets: target && target !== 'external' ? [target] : [], unresolved: target === null, opaque: false,
    };
  });
}

// ---------------------------------------------------------------------------
// Following what a module does with an encoder

type Sensitive = Map<string, ReadonlySet<string> | '*'>;

interface Call { file: string; module: string; binding: string; text: string }

interface Escape { file: string; module: string; binding: string | null; why: string; text: string }

interface Context {
  path: string;
  sensitive: Sensitive;
  /** Local names bound to an encoder. */
  aliases: Map<string, { module: string; binding: string }>;
  /** Local names holding the module object of an encoder's module. */
  holders: Map<string, string>;
  takes: Map<string, Set<string>>;
  calls: Call[];
  escapes: Escape[];
}

const squash = (value: string) => value.replace(/\s+/gu, '').replace(/,\)/gu, ')').replace(/,\}/gu, '}');
const oneLine = (node: ts.Node) => node.getText().replace(/\s+/gu, ' ').replace(/\( /gu, '(').replace(/ \)/gu, ')');

const sensitiveTo = (ctx: Context, module: string, name: string) => {
  const names = ctx.sensitive.get(module);
  return names === '*' || Boolean(names?.has(name));
};
const take = (ctx: Context, module: string, name: string) => {
  if (!ctx.takes.has(module)) ctx.takes.set(module, new Set());
  ctx.takes.get(module)!.add(name);
};
const escape = (ctx: Context, module: string, binding: string | null, node: ts.Node | null, why: string) => {
  let statement: ts.Node | null = node;
  while (statement?.parent && !ts.isSourceFile(statement.parent) && !ts.isBlock(statement.parent)) statement = statement.parent;
  ctx.escapes.push({
    file: ctx.path, module, binding, why, text: statement ? oneLine(statement).slice(0, 160) : '',
  });
};

/** Skips parentheses, `as`, `!` and `satisfies` around an expression. */
function outer(node: ts.Node): { self: ts.Node; parent: ts.Node } {
  let self = node;
  while (self.parent && (ts.isParenthesizedExpression(self.parent) || ts.isAsExpression(self.parent)
    || ts.isNonNullExpression(self.parent) || ts.isSatisfiesExpression(self.parent) || ts.isTypeAssertionExpression(self.parent))) {
    self = self.parent;
  }
  return { self, parent: self.parent };
}

/** Binds what a destructuring or a name receives from a module object (element `index` of an array). */
function bind(ctx: Context, module: string, name: ts.BindingName, index: number | null, at: ts.Node): void {
  if (index !== null) {
    if (!ts.isArrayBindingPattern(name)) {
      escape(ctx, module, null, at, 'holds the module object in an array');
      return;
    }
    const elements = name.elements;
    if (elements.slice(0, index + 1).some((element) => ts.isBindingElement(element) && element.dotDotDotToken)) {
      escape(ctx, module, null, at, 'gathers the module object into a rest element');
      return;
    }
    const element = elements[index];
    if (element && ts.isBindingElement(element)) bind(ctx, module, element.name, null, at);
    return;
  }
  if (ts.isIdentifier(name)) {
    ctx.holders.set(name.text, module);
    return;
  }
  if (!ts.isObjectBindingPattern(name)) {
    escape(ctx, module, null, at, 'destructures the module object as an array');
    return;
  }
  for (const element of name.elements) {
    const key = element.propertyName ?? element.name;
    if (element.dotDotDotToken || !(ts.isIdentifier(key) || ts.isStringLiteral(key))) {
      escape(ctx, module, null, at, 'destructures the module object with a computed key or a rest element');
      continue;
    }
    take(ctx, module, key.text);
    if (!sensitiveTo(ctx, module, key.text)) continue;
    if (ts.isIdentifier(element.name)) ctx.aliases.set(element.name.text, { module, binding: key.text });
    else escape(ctx, module, key.text, at, 'destructures an encoder');
  }
}

/** Reading a member of a module object by name: an encoder must be called there and then. */
function member(ctx: Context, module: string, access: ts.PropertyAccessExpression): void {
  const name = access.name.text;
  take(ctx, module, name);
  if (!sensitiveTo(ctx, module, name)) return;
  const { self, parent } = outer(access);
  if (ts.isCallExpression(parent) && parent.expression === self) {
    ctx.calls.push({ file: ctx.path, module, binding: name, text: oneLine(parent) });
  } else escape(ctx, module, name, access, 'uses an encoder other than by calling it');
}

/** Every preact/React state variable whose setter is named `setter`. */
function statesOf(unit: ts.SourceFile, setter: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer
      && ts.isCallExpression(node.initializer)) {
      const callee = node.initializer.expression;
      const hook = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
      const [state, set] = node.name.elements;
      if (hook === 'useState' && set && ts.isBindingElement(set) && ts.isIdentifier(set.name) && set.name.text === setter
        && state && ts.isBindingElement(state) && ts.isIdentifier(state.name)) found.push(state.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(unit);
  return found;
}

/**
 * Follows the module object a dynamic import or a require gives: through
 * loadModule, Promise.all, await, then/catch/finally, into a name, a
 * destructuring or a member read. Any other use fails.
 */
function follow(ctx: Context, module: string, start: ts.Node, promise: boolean, unit: ts.SourceFile): void {
  let node = start;
  let index: number | null = null;
  for (let step = 0; step < 16; step += 1) {
    const { self, parent } = outer(node);
    if (promise) {
      if (ts.isArrowFunction(parent) && parent.body === self && ts.isCallExpression(parent.parent)
        && ts.isIdentifier(parent.parent.expression) && parent.parent.expression.text === 'loadModule'
        && parent.parent.arguments[0] === parent) {
        node = parent.parent;
        continue;
      }
      if (index === null && ts.isArrayLiteralExpression(parent) && ts.isCallExpression(parent.parent)
        && parent.parent.arguments[0] === parent && ts.isPropertyAccessExpression(parent.parent.expression)
        && ts.isIdentifier(parent.parent.expression.expression) && parent.parent.expression.expression.text === 'Promise'
        && parent.parent.expression.name.text === 'all') {
        index = parent.elements.indexOf(self as ts.Expression);
        if (index < 0 || parent.elements.slice(0, index).some(ts.isSpreadElement)) break;
        node = parent.parent;
        continue;
      }
      if (ts.isAwaitExpression(parent)) {
        promise = false;
        node = parent;
        continue;
      }
      if (ts.isPropertyAccessExpression(parent) && parent.expression === self && ts.isCallExpression(parent.parent)
        && parent.parent.expression === parent) {
        const method = parent.name.text;
        if (method === 'catch' || method === 'finally') {
          node = parent.parent;
          continue;
        }
        if (method === 'then') {
          const handler = parent.parent.arguments[0];
          if (handler && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))) {
            const first = handler.parameters[0];
            if (first) bind(ctx, module, first.name, index, handler);
            return;
          }
          const states = handler && ts.isIdentifier(handler) && index === null ? statesOf(unit, handler.text) : [];
          if (states.length) {
            for (const state of states) ctx.holders.set(state, module);
            return;
          }
        }
      }
      if (ts.isExpressionStatement(parent) || ts.isVoidExpression(parent)) return;
      escape(ctx, module, null, self, 'passes on the promise of the module object');
      return;
    }
    if (ts.isVariableDeclaration(parent) && parent.initializer === self) {
      bind(ctx, module, parent.name, index, parent);
      return;
    }
    if (index === null && ts.isPropertyAccessExpression(parent) && parent.expression === self) {
      member(ctx, module, parent);
      return;
    }
    if (ts.isExpressionStatement(parent)) return;
    escape(ctx, module, null, self, 'uses the module object as a value');
    return;
  }
  escape(ctx, module, null, start, 'loads the module in a way this test cannot follow');
}

/** Whether an identifier here names something other than a value read. */
function notAReference(id: ts.Identifier): boolean {
  const parent = id.parent;
  if (!parent) return true;
  if (ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)
    || ts.isImportEqualsDeclaration(parent) || ts.isExportSpecifier(parent) || ts.isNamespaceExport(parent)) return true;
  if (ts.isBindingElement(parent) && (parent.name === id || parent.propertyName === id)) return true;
  if ((ts.isVariableDeclaration(parent) || ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent)
    || ts.isClassDeclaration(parent) || ts.isClassExpression(parent) || ts.isParameter(parent)
    || ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent) || ts.isEnumDeclaration(parent)
    || ts.isModuleDeclaration(parent) || ts.isTypeParameterDeclaration(parent) || ts.isPropertyAssignment(parent)
    || ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isPropertySignature(parent)
    || ts.isMethodSignature(parent) || ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent)
    || ts.isEnumMember(parent) || ts.isJsxAttribute(parent)) && parent.name === id) return true;
  if ((ts.isPropertyAccessExpression(parent) && parent.name === id) || (ts.isQualifiedName(parent) && parent.right === id)) return true;
  if (ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent)) return true;
  for (let node: ts.Node | undefined = parent; node && !ts.isSourceFile(node); node = node.parent) {
    // `class A extends B` reads B as a value.
    if (ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent)
      && node.parent.token === ts.SyntaxKind.ExtendsKeyword) return false;
    if (ts.isTypeNode(node)) return true;
  }
  return false;
}

/** What one module takes from the encoders' modules, which encoders it calls, and every other use. */
function analyze(path: string, parsed: Parsed, edges: Edge[], sensitive: Sensitive): Context {
  const ctx: Context = {
    path, sensitive, aliases: new Map(), holders: new Map(), takes: new Map(), calls: [], escapes: [],
  };
  const own = sensitive.get(path);
  if (own && own !== '*') for (const name of own) ctx.aliases.set(name, { module: path, binding: name });
  for (const edge of edges) {
    if (edge.typeOnly) continue;
    const modules = edge.targets.filter((target) => sensitive.has(target));
    if (!modules.length) continue;
    if (edge.kind === 'glob' || edge.kind === 'computed' || modules.length > 1) {
      escape(ctx, modules[0], null, edge.node, `loads ${modules.join(', ')} through a computed path, where no use can be followed`);
      continue;
    }
    const module = modules[0];
    const node = edge.node;
    // A worker or a page script runs apart from this module: nothing to follow.
    if (!node || edge.kind === 'url' || edge.kind === 'script') continue;
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (!clause || clause.isTypeOnly) continue;
      if (clause.name) {
        take(ctx, module, 'default');
        if (sensitiveTo(ctx, module, 'default')) ctx.aliases.set(clause.name.text, { module, binding: 'default' });
      }
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) ctx.holders.set(bindings.name.text, module);
      else if (bindings) {
        for (const element of bindings.elements) {
          if (element.isTypeOnly) continue;
          const imported = (element.propertyName ?? element.name).text;
          take(ctx, module, imported);
          if (sensitiveTo(ctx, module, imported)) ctx.aliases.set(element.name.text, { module, binding: imported });
        }
      }
    } else if (ts.isExportDeclaration(node)) {
      const clause = node.exportClause;
      if (!clause || ts.isNamespaceExport(clause)) {
        take(ctx, module, '*');
        escape(ctx, module, '*', node, 'passes on every export of an encoder’s module');
        continue;
      }
      for (const element of clause.elements) {
        if (element.isTypeOnly) continue;
        const imported = (element.propertyName ?? element.name).text;
        take(ctx, module, imported);
        if (sensitiveTo(ctx, module, imported)) escape(ctx, module, imported, node, 're-exports an encoder');
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      ctx.holders.set(node.name.text, module);
    } else if (edge.kind === 'dynamic' || edge.kind === 'require') {
      follow(ctx, module, node, edge.kind === 'dynamic', edge.unit!);
    }
  }

  for (const unit of parsed.units) {
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && !notAReference(node)) {
        const alias = ctx.aliases.get(node.text);
        const holder = ctx.holders.get(node.text);
        if (alias) {
          const { self, parent } = outer(node);
          if (ts.isCallExpression(parent) && parent.expression === self) {
            ctx.calls.push({ file: path, module: alias.module, binding: alias.binding, text: oneLine(parent) });
          } else escape(ctx, alias.module, alias.binding, node, 'uses an encoder other than by calling it by name');
        } else if (holder) {
          const parent = node.parent;
          if (ts.isPropertyAccessExpression(parent) && parent.expression === node) member(ctx, holder, parent);
          else if (ts.isVariableDeclaration(parent) && parent.initializer === node) bind(ctx, holder, parent.name, null, parent);
          else escape(ctx, holder, null, node, 'uses an encoder’s module object other than to read a member by name');
        }
      }
      if (ts.isExportSpecifier(node) && !node.parent.parent.moduleSpecifier && !node.isTypeOnly) {
        const local = (node.propertyName ?? node.name).text;
        const alias = ctx.aliases.get(local);
        const holder = ctx.holders.get(local);
        const ownExport = alias && alias.module === path && alias.binding === local && node.name.text === local;
        if (alias && !ownExport) escape(ctx, alias.module, alias.binding, node, 'exports an encoder');
        if (holder) escape(ctx, holder, null, node, 'exports an encoder’s module object');
      }
      ts.forEachChild(node, visit);
    };
    visit(unit);
  }

  if (parsed.template) {
    for (const [name, module] of [
      ...[...ctx.aliases].map(([local, { module: from }]) => [local, from] as const),
      ...ctx.holders,
    ]) {
      if (new RegExp(`(?<![\\w$])${name.replace(/[$]/gu, '\\$&')}(?![\\w$])`, 'u').test(parsed.template)) {
        escape(ctx, module, null, null, `names ${name} in its template`);
      }
    }
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// The audit

interface Audit {
  files: Files;
  edges: Map<string, Edge[]>;
  /** Modules that may pass the exact encoder on; share-positions.ts first. */
  carriers: Set<string>;
  results: Map<string, Context>;
  calls: Call[];
  escapes: Escape[];
  unresolved: string[];
  opaque: string[];
}

function audit(input: Files): Audit {
  const files: Files = new Map(input);
  const edges = new Map<string, Edge[]>();
  // Parse, following local paths to code outside the roots.
  const pending = [...files.keys()];
  while (pending.length) {
    const path = pending.pop()!;
    const resolved = resolveEdges(files, path, parse(path, files.get(path)!));
    edges.set(path, resolved);
    for (const edge of resolved) {
      for (const target of edge.targets) {
        if (!files.has(target) && CODE.test(target) && isFile(files, target)) {
          files.set(target, readFileSync(resolve(root, target), 'utf8'));
          pending.push(target);
        }
      }
    }
  }

  let carriers = new Set([EXACT_MODULE]);
  let results = new Map<string, Context>();
  for (let round = 0; round < 8; round += 1) {
    const sensitive: Sensitive = new Map(Object.entries(SHARED_ENCODERS).map(([module, names]) => [module, new Set(names)]));
    sensitive.set(EXACT_MODULE, new Set([EXACT_ENCODER, ...SHARED_ENCODERS[EXACT_MODULE]]));
    for (const carrier of carriers) if (carrier !== EXACT_MODULE) sensitive.set(carrier, '*');
    results = new Map();
    for (const [path, found] of edges) {
      if (!sensitive.has(path) && !found.some((edge) => !edge.typeOnly && edge.targets.some((target) => sensitive.has(target)))) continue;
      results.set(path, analyze(path, parse(path, files.get(path)!), found, sensitive));
    }
    const next = new Set(carriers);
    for (const [path, ctx] of results) {
      const passesOn = ctx.escapes.some(({ module, binding }) => carriers.has(module)
        && (module !== EXACT_MODULE || binding === null || binding === '*' || binding === EXACT_ENCODER));
      if (passesOn) next.add(path);
    }
    if (next.size === carriers.size) break;
    carriers = next;
  }

  const unresolved: string[] = [];
  const opaque: string[] = [];
  for (const [path, source] of files) {
    for (const text of parse(path, source).unfollowable) opaque.push(`${path}: runs code this test cannot follow: ${text}`);
  }
  for (const [path, found] of edges) {
    for (const edge of found) {
      if (edge.unresolved && !edge.typeOnly) unresolved.push(`${path}: '${edge.specifier}' names no file`);
      if (edge.opaque) opaque.push(`${path}: loads a module named by ${edge.specifier || 'nothing'}, which OPAQUE_LOADS does not list`);
    }
  }
  for (const [path, loads] of Object.entries(OPAQUE_LOADS)) {
    for (const { expression } of loads) {
      if (input.has(path) && !(edges.get(path) ?? []).some((edge) => edge.kind === 'computed' && edge.specifier === expression)) {
        opaque.push(`${path}: OPAQUE_LOADS lists ${expression}, which it no longer loads`);
      }
    }
  }
  return {
    files,
    edges,
    carriers,
    results,
    calls: [...results.values()].flatMap(({ calls }) => calls),
    escapes: [...results.values()].flatMap(({ escapes }) => escapes),
    unresolved,
    opaque,
  };
}

/** Every module that loads a carrier of the exact encoder at run time, with what it takes from share-positions.ts. */
function exactImporters(found: Audit): Map<string, { loads: string[]; takes: string[] }> {
  const importers = new Map<string, { loads: string[]; takes: string[] }>();
  for (const [path, edges] of found.edges) {
    if (path === EXACT_MODULE) continue;
    const loads = [...new Set(edges.filter((edge) => !edge.typeOnly)
      .flatMap((edge) => edge.targets.filter((target) => found.carriers.has(target))))];
    if (!loads.length) continue;
    const takes = [...(found.results.get(path)?.takes.get(EXACT_MODULE) ?? [])].sort();
    importers.set(path, { loads: loads.sort(), takes });
  }
  return importers;
}

const isExactCall = (found: Audit, call: Call) => (call.module === EXACT_MODULE && call.binding === EXACT_ENCODER)
  || (call.module !== EXACT_MODULE && found.carriers.has(call.module));
const isSharedCall = (call: Call) => Boolean(SHARED_ENCODERS[call.module]?.includes(call.binding));

function sharedCallsByFile(found: Audit): Map<string, string[]> {
  const byFile = new Map<string, string[]>();
  for (const call of found.calls.filter(isSharedCall)) byFile.set(call.file, [...(byFile.get(call.file) ?? []), squash(call.text)]);
  for (const calls of byFile.values()) calls.sort();
  return byFile;
}

/** Everything the audit finds wrong, one line each. */
function problems(found: Audit): string[] {
  const lines = [
    ...found.escapes.map(({ file, why, text }) => `${file}: ${why}${text ? `: ${text}` : ''}`),
    ...found.unresolved,
    ...found.opaque,
  ];
  for (const carrier of found.carriers) {
    if (carrier !== EXACT_MODULE) lines.push(`${carrier}: passes the exact encoder on`);
  }
  const importers = exactImporters(found);
  for (const [path, { loads, takes }] of importers) {
    const listed = EXACT_MODULE_IMPORTERS[path];
    if (!listed) lines.push(`${path}: loads ${loads.join(', ')}, which EXACT_MODULE_IMPORTERS does not list`);
    else if (JSON.stringify([...listed.takes].sort()) !== JSON.stringify(takes)) {
      lines.push(`${path}: takes ${JSON.stringify(takes)} from ${EXACT_MODULE}, listed ${JSON.stringify([...listed.takes].sort())}`);
    }
  }
  for (const path of Object.keys(EXACT_MODULE_IMPORTERS)) {
    if (!importers.has(path)) lines.push(`${path}: listed in EXACT_MODULE_IMPORTERS but does not load ${EXACT_MODULE}`);
  }
  const exact = new Map<string, string[]>();
  for (const call of found.calls.filter((entry) => isExactCall(found, entry))) {
    exact.set(call.file, [...(exact.get(call.file) ?? []), squash(call.text)]);
  }
  for (const path of new Set([...exact.keys(), ...Object.keys(EXACT_CALLS)])) {
    const calls = (exact.get(path) ?? []).sort();
    const listed = (EXACT_CALLS[path] ?? []).map(({ call }) => squash(call)).sort();
    if (JSON.stringify(calls) !== JSON.stringify(listed)) {
      lines.push(`${path}: calls the exact encoder as ${JSON.stringify(calls)}, EXACT_CALLS lists ${JSON.stringify(listed)}`);
    }
  }
  const shared = sharedCallsByFile(found);
  for (const path of new Set([...shared.keys(), ...Object.keys(PRODUCERS)])) {
    const calls = shared.get(path) ?? [];
    const listed = (PRODUCERS[path]?.calls ?? []).map(squash).sort();
    if (JSON.stringify(calls) !== JSON.stringify(listed)) {
      lines.push(`${path}: calls a shared encoder as ${JSON.stringify(calls)}, PRODUCERS lists ${JSON.stringify(listed)}`);
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------

const { files: production, others } = productionFiles();
const found = audit(production);

/** Every file of a probe tree beside production: the file to add or a change to an existing one. */
const probeAudit = (probe: Record<string, string | ((source: string) => string)>) => {
  const files = new Map(production);
  for (const [path, change] of Object.entries(probe)) {
    files.set(path, typeof change === 'function' ? change(files.get(path) ?? '') : change);
  }
  return problems(audit(files));
};

describe('producers of shared chart codes', () => {
  it('reads every production module: .ts, .tsx, .js, .jsx and .mjs files, .astro frontmatter and scripts, and .mdx ESM', () => {
    const extensions = new Set([...production.keys()].map((path) => /\.\w+$/u.exec(path)![0]));
    for (const extension of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.astro', '.mdx']) expect(extensions).toContain(extension);
    // Nothing that could hold code is left unread.
    expect(others).toEqual([]);
    // Local code a production module loads from outside src/ and api/ is read too.
    expect(found.files.has('examples/precision-alpha/src/browser.mjs')).toBe(true);
    const astro = parse('a.astro', "---\nimport { a } from './x';\n---\n<p>{a}</p>\n<script>\nimport './y';\n</script>\n<script src=\"./z.ts\"></script>");
    expect(astro.edges.map(({ kind, specifier }) => `${kind} ${specifier}`)).toEqual(['import ./x', 'import ./y', 'script ./z.ts']);
    expect(astro.template).toContain('<p>{a}</p>');
    const mdx = parse('b.mdx', "---\ntitle: x\n---\n\nimport { a } from './x';\nexport const b = a;\n\n# Heading\n\n{a}\n");
    expect(mdx.edges.map(({ specifier }) => specifier)).toEqual(['./x']);
    expect(mdx.template).toContain('{a}');
  });

  it('follows a load of a built file to the module it is built from', () => {
    for (const [served, { source, by }] of Object.entries(BUILT_FILES)) {
      expect(readFileSync(resolve(root, by), 'utf8'), served).toContain(posix.basename(source));
      expect(found.files.has(source), source).toBe(true);
    }
    for (const [path, loads] of Object.entries(OPAQUE_LOADS)) {
      for (const { loads: targets } of loads) for (const target of targets) expect(found.files.has(target), path).toBe(true);
    }
    expect(readFileSync(resolve(root, 'scripts/build-assistant-ui.mjs'), 'utf8')).toContain("'src/lib/assistant/open-assistant.ts'");
  });

  it('finds encoder calls in .ts, .tsx, .js, .jsx, .astro and .mdx files, through aliases, namespaces and dynamic imports', () => {
    const callsIn = (path: string, source: string) => audit(new Map([...production, [path, source]])).calls
      .filter(({ file }) => file === path).map(({ binding, text }) => `${binding}: ${text}`);
    expect(callsIn('src/lib/a.ts', "import { encodePositionsLink as exact } from './share-positions';\nexact(chart);"))
      .toEqual(['encodePositionsLink: exact(chart)']);
    expect(callsIn('src/lib/b.js', "import * as positions from './share-positions';\npositions.encodeSharedPositionsLink(x);"))
      .toEqual(['encodeSharedPositionsLink: positions.encodeSharedPositionsLink(x)']);
    expect(callsIn('src/islands/c.mjs', "const { calendarToken: feed } = await import('./CalendarSubscribe');\nfeed(p);"))
      .toEqual(['calendarToken: feed(p)']);
    expect(callsIn('src/lib/profile/d.ts', "import('./card-link').then(({ encodeCardLink }) => encodeCardLink(card));"))
      .toEqual(['encodeCardLink: encodeCardLink(card)']);
    expect(callsIn('src/lib/e.ts', "const [mod] = await Promise.all([loadModule(() => import('./share-synastry'))]);\nmod.encodeSynastryLink(pair);"))
      .toEqual(['encodeSynastryLink: mod.encodeSynastryLink(pair)']);
    expect(callsIn('src/lib/profile/f.jsx', "import { encodeCardLink } from './card-link';\nexport const A = () => <a href={encodeCardLink({ chart })} />;"))
      .toEqual(['encodeCardLink: encodeCardLink({ chart })']);
    expect(callsIn('src/pages/g.astro', "---\nimport { calendarToken } from '../islands/CalendarSubscribe';\nconst t = calendarToken(p);\n---\n<a href={t}>x</a>"))
      .toEqual(['calendarToken: calendarToken(p)']);
    expect(callsIn('src/content/learn/h.mdx', "import { encodeCardLink as card } from '../../lib/profile/card-link';\nexport const link = card(c);\n\n# Title"))
      .toEqual(['encodeCardLink: card(c)']);
  }, 60_000);

  it('reaches an encoder nowhere other than by calling it by name, and resolves every load', () => {
    expect(found.escapes.map(({ file, why, text }) => `${file}: ${why}: ${text}`)).toEqual([]);
    expect(found.carriers).toEqual(new Set([EXACT_MODULE]));
    expect(found.unresolved).toEqual([]);
    expect(found.opaque).toEqual([]);
  });

  it('lists every module that loads the exact encoder’s module, with what it takes and why', () => {
    const importers = exactImporters(found);
    expect([...importers.keys()].sort()).toEqual(Object.keys(EXACT_MODULE_IMPORTERS).sort());
    for (const [path, { takes, why }] of Object.entries(EXACT_MODULE_IMPORTERS)) {
      expect(importers.get(path)?.takes, path).toEqual([...takes].sort());
      expect(why.length, path).toBeGreaterThan(20);
    }
  });

  it('lists every production call of a shared-code encoder, each with how it keeps a code to the whole minute or to noon UTC', () => {
    const shared = sharedCallsByFile(found);
    expect([...shared.keys()].sort()).toEqual(Object.keys(PRODUCERS).sort());
    for (const [path, { how, calls, mustUse }] of Object.entries(PRODUCERS)) {
      expect(shared.get(path), path).toEqual(calls.map(squash).sort());
      expect(how.length, path).toBeGreaterThan(20);
      const source = readFileSync(resolve(root, path), 'utf8');
      for (const text of mustUse) expect(source, `${path} must contain ${text}`).toContain(text);
    }
  });

  it('lists every production call of the exact encoder, each with why its code does not leave the device as a new one', () => {
    const exact = found.calls.filter((call) => isExactCall(found, call));
    const byFile = new Map<string, string[]>();
    for (const call of exact) byFile.set(call.file, [...(byFile.get(call.file) ?? []), squash(call.text)]);
    expect([...byFile.keys()].sort()).toEqual(Object.keys(EXACT_CALLS).sort());
    for (const [path, calls] of Object.entries(EXACT_CALLS)) {
      expect(byFile.get(path)!.sort(), path).toEqual(calls.map(({ call }) => squash(call)).sort());
      for (const { why } of calls) expect(why.length, path).toBeGreaterThan(20);
    }
    expect(problems(found)).toEqual([]);
  });

  it('gives the shared path the civil birth date or the UTC instant wherever a calculator computes a chart', () => {
    for (const [path, texts] of Object.entries(SHARE_INSTANT_SOURCES)) {
      const source = readFileSync(resolve(root, path), 'utf8');
      for (const text of texts) expect(source, `${path} must contain ${text}`).toContain(text);
    }
  });
});

/**
 * Each probe adds modules to the production tree, or changes one, and must
 * make the audit fail on the file it names. The first fifteen are the
 * fourteen of an independent review, placed where their relative paths
 * resolve, with the consumer of an exported alias tried alone and beside it.
 */
const PROBES: [string, Record<string, string | ((source: string) => string)>, string][] = [
  ['.call', { 'src/lib/call.ts': "import { encodePositionsLink } from './share-positions';\nencodePositionsLink.call(null, chart);" }, 'src/lib/call.ts'],
  ['.apply', { 'src/lib/apply.ts': "import { encodePositionsLink } from './share-positions';\nencodePositionsLink.apply(null, [chart]);" }, 'src/lib/apply.ts'],
  ['.bind', { 'src/lib/bind.ts': "import { encodePositionsLink } from './share-positions';\nconst f = encodePositionsLink.bind(null);\nf(chart);" }, 'src/lib/bind.ts'],
  ['element access on a namespace', { 'src/lib/element.ts': "import * as P from './share-positions';\nP['encodePositionsLink'](chart);" }, 'src/lib/element.ts'],
  ['element access on a dynamic import', { 'src/lib/element2.ts': "const m = await import('./share-positions');\nconst e = m['encodePositionsLink'];\ne(chart);" }, 'src/lib/element2.ts'],
  ['a computed destructuring', { 'src/lib/computed-destructure.ts': "const { ['encodePositionsLink']: e } = await import('./share-positions');\ne(chart);" }, 'src/lib/computed-destructure.ts'],
  ['an exported alias', { 'src/lib/export-const-alias.ts': "import { encodePositionsLink } from './share-positions';\nexport const makeCode = encodePositionsLink;" }, 'src/lib/export-const-alias.ts'],
  ['a consumer of an exported alias, alone', { 'src/lib/consumer-of-alias.ts': "import { makeCode } from './export-const-alias';\nmakeCode(chart);" }, 'src/lib/consumer-of-alias.ts'],
  ['a consumer of an exported alias', {
    'src/lib/export-const-alias.ts': "import { encodePositionsLink } from './share-positions';\nexport const makeCode = encodePositionsLink;",
    'src/lib/consumer-of-alias.ts': "import { makeCode } from './export-const-alias';\nmakeCode(chart);",
  }, 'src/lib/consumer-of-alias.ts'],
  ['export *', { 'src/lib/export-star.ts': "export * from './share-positions';" }, 'src/lib/export-star.ts'],
  ['an alias in an .astro template', { 'src/pages/astro-alias.astro': "---\nimport { encodeCardLink as mk } from '../lib/profile/card-link';\n---\n<a href={mk(card)}>x</a>" }, 'src/pages/astro-alias.astro'],
  ['an .astro script', { 'src/pages/astro-inline.astro': "---\n---\n<script>\nimport { encodePositionsLink as e } from '../lib/share-positions';\ne(chart);\n</script>" }, 'src/pages/astro-inline.astro'],
  ['a comma callee', { 'src/lib/control-comma.ts': "import { encodePositionsLink } from './share-positions';\n(0, encodePositionsLink)(chart);" }, 'src/lib/control-comma.ts'],
  ['Reflect.apply', { 'src/lib/reflect.ts': "import { encodePositionsLink } from './share-positions';\nReflect.apply(encodePositionsLink, null, [chart]);" }, 'src/lib/reflect.ts'],
  ['a default import', { 'src/lib/default-import.ts': "import P from './share-positions';\nP.encodePositionsLink(chart);" }, 'src/lib/default-import.ts'],
  // Further ways in.
  ['an .mdx expression', { 'src/content/learn/probe.mdx': "import { encodePositionsLink } from '../../lib/share-positions';\n\n# Probe\n\n{encodePositionsLink(chart)}\n" }, 'src/content/learn/probe.mdx'],
  ['an exported wrapper', { 'src/lib/wrapper.ts': "import { encodePositionsLink } from './share-positions';\nexport const makeCode = (chart) => encodePositionsLink(chart);" }, 'src/lib/wrapper.ts'],
  ['a new call in a listed module', { 'src/lib/profile/circle.ts': (source) => `${source}\nexport const exactCode = (chart: PositionsShareInput) => encodePositionsLink(chart);\n` }, 'src/lib/profile/circle.ts'],
  ['a re-export from a listed module', { 'src/islands/ProfilePeople.tsx': (source) => `${source}\nexport { encodePositionsLink };\n` }, 'src/islands/ProfilePeople.tsx'],
  ['an alias exported from a listed module', { 'src/lib/profile/pairs.ts': (source) => `${source}\nexport const exact = encodePositionsLink;\n` }, 'src/lib/profile/pairs.ts'],
  ['a named re-export', { 'src/lib/named-reexport.ts': "export { encodePositionsLink as default } from './share-positions';" }, 'src/lib/named-reexport.ts'],
  ['a shared encoder re-exported', { 'src/lib/card-reexport.ts': "export { encodeCardLink } from './profile/card-link';" }, 'src/lib/card-reexport.ts'],
  ['require', { 'src/lib/required.cjs': "const P = require('./share-positions');\nP.encodePositionsLink(chart);" }, 'src/lib/required.cjs'],
  ['a template-literal import', { 'src/lib/template-import.ts': "const kind = 'positions';\nconst P = await import(`./share-${kind}`);\nP.encodePositionsLink(chart);" }, 'src/lib/template-import.ts'],
  ['a computed import', { 'src/lib/computed-import.ts': "const where = './share-positions';\nconst P = await import(where);\nP.encodePositionsLink(chart);" }, 'src/lib/computed-import.ts'],
  ['a glob', { 'src/lib/glob.ts': "const modules = import.meta.glob('./share-*.ts', { eager: true });\nconsole.log(modules);" }, 'src/lib/glob.ts'],
  ['eval', { 'src/lib/evaluated.ts': "import { encodePositionsLink } from './share-positions';\neval('encodePositionsLink(chart)');" }, 'src/lib/evaluated.ts'],
  ['the Function constructor', { 'src/lib/constructed.ts': "const load = new Function('return import(\"./share-positions\")');\nload();" }, 'src/lib/constructed.ts'],
  ['a load in an .astro template', { 'src/pages/template-load.astro': "---\n---\n<p>{import('../lib/share-positions').then((m) => m.encodePositionsLink(chart))}</p>" }, 'src/pages/template-load.astro'],
  ['the module object passed on', { 'src/lib/passed.ts': "import('./share-positions').then((m) => m);" }, 'src/lib/passed.ts'],
  ['the module object into a rest element', { 'src/lib/rest.ts': "const { decodePositionsLink, ...rest } = await import('./share-positions');\nrest.encodePositionsLink(chart);" }, 'src/lib/rest.ts'],
  ['a script tag', { 'src/pages/script-src.astro': '---\n---\n<script src="../lib/share-positions.ts"></script>' }, 'src/pages/script-src.astro'],
  ['a type-only import that is not', { 'src/lib/mixed.ts': "import { type PositionsShareChart, encodePositionsLink as e } from './share-positions';\nconst x: PositionsShareChart | null = null;\ne(x);" }, 'src/lib/mixed.ts'],
  ['a new call of a shared encoder in a listed producer', { 'src/islands/ChartShareDialog.tsx': (source) => `${source}\nexport const exactLink = (chart: PositionsShareInput) => encodeSharedPositionsLink(chart);\n` }, 'src/islands/ChartShareDialog.tsx'],
  ['a shared encoder as a value in .tsx', { 'src/islands/card-value.tsx': "import { encodeCardLink } from '../lib/profile/card-link';\nexport const C = () => <Button onClick={encodeCardLink} />;" }, 'src/islands/card-value.tsx'],
];

describe('the audit of encoder callers', () => {
  it.each(PROBES)('fails on %s', (_, probe, path) => {
    const lines = probeAudit(probe);
    expect(lines.filter((line) => line.startsWith(`${path}:`)), lines.join('\n')).not.toEqual([]);
  }, 60_000);

  it('passes on a type-only import and on a module that only decodes', () => {
    expect(probeAudit({ 'src/lib/types-only.ts': "import type { PositionsShareChart } from './share-positions';\nexport const none: PositionsShareChart | null = null;" }))
      .toEqual([]);
    expect(probeAudit({ 'src/lib/decodes.ts': "import { decodePositionsLink } from './share-positions';\ndecodePositionsLink('x');" }))
      .toEqual(['src/lib/decodes.ts: loads src/lib/share-positions.ts, which EXACT_MODULE_IMPORTERS does not list']);
  }, 60_000);
});
