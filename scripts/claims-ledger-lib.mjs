/*
 * The claims ledger's extractor (step 1.14 of the engine brief). Every public
 * sentence about accuracy, time handling or privacy must be listed in
 * docs/claims/ledger.json with the claim it makes and that claim's evidence;
 * scripts/claims-ledger.test.mjs holds the ledger and the copy to each other.
 *
 * This module finds the sentences. It reads the consumer surface
 * (consumer-boundary-lib's scope, plus the few files below), turns each file
 * into text blocks the way a reader meets them (an Astro or JSX paragraph is
 * one block however much inline markup it holds), splits blocks into
 * sentences, and selects the ones a trigger list matches:
 *
 * - FULL, on the trust files (the methodology, privacy and developer pages,
 *   the llms files, the assistant's site guide): any wording that could state
 *   an accuracy, time-handling or privacy fact. On the DENSE trust files, a
 *   triggered sentence brings every sentence of its block with it, so a claim
 *   that leans on its neighbour ("the number isn't known yet") is listed too.
 * - HARD, everywhere else: the unambiguous subset (JPL, arcseconds, IANA,
 *   "in your browser", "never sent" and the like).
 * - NEUTRAL, on translated pages and catalogs: names and numbers that read
 *   the same in any language (JPL, IANA, OpenAI, 12:00, UTC), so a
 *   translation of a listed claim is listed too.
 *
 * Nothing here writes the ledger; scripts/claims-ledger.mjs prints drafts.
 */
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseAstro } from '@astrojs/compiler';
import ts from 'typescript';
import { consumerSurfaceFiles } from './consumer-boundary-lib.mjs';

export const LEDGER_PATH = 'docs/claims/ledger.json';

/**
 * The Astro parser the extractor was built and checked on. It arrives with
 * astro rather than as a direct dependency (a lockfile change would move the
 * daily publication's generator digest), so the ledger test pins its version:
 * a different parser can assemble different blocks.
 */
export const ASTRO_COMPILER_VERSION = '2.13.1';

export const CLAIM_TOPICS = Object.freeze(['accuracy', 'privacy', 'product', 'time']);

/**
 * supported: the evidence bears the claim out as worded. overstated: true in
 * part, or truer than the evidence shows; open until its resolution lands.
 * false: untrue as worded. stale: a translation the English has moved past.
 */
export const CLAIM_STATUSES = Object.freeze(['supported', 'overstated', 'false', 'stale']);

/** Why a selected sentence makes no claim; a closed list. */
export const EXEMPT_REASONS = Object.freeze([
  'definitional',
  'input-validation',
  'interpretive',
  'legal',
  'limitation',
  'navigation',
  'not-a-claim',
  'third-party',
]);

export function readLedger(repoRoot) {
  return JSON.parse(readFileSync(resolve(repoRoot, LEDGER_PATH), 'utf8'));
}

const words = (text) => new Set(foldQuotes(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

/** The listed record most like an unlisted sentence (token Jaccard ≥ 0.6), if any: "did you edit …?". */
export function nearestRecord(text, records) {
  const target = words(text);
  let best = null;
  let bestScore = 0.6;
  for (const record of records) {
    const other = words(record.text);
    let shared = 0;
    for (const word of target) if (other.has(word)) shared += 1;
    const score = shared / (target.size + other.size - shared || 1);
    if (score >= bestScore) {
      best = record;
      bestScore = score;
    }
  }
  return best;
}

/** The ledger as committed: sorted, one record per line, so a diff reads as a list of changed claims. */
export function serializeLedger(ledger) {
  const line = (value) => `    ${JSON.stringify(value)}`;
  const list = (name, records) => `  "${name}": [\n${records.map(line).join(',\n')}\n  ]`;
  const sortedBy = (records, key) => records
    .map((record) => [key(record), record])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, record]) => record);
  return [
    '{',
    `  "version": ${JSON.stringify(ledger.version)},`,
    `  "lexiconVersion": ${JSON.stringify(ledger.lexiconVersion)},`,
    `  "maxOpenOverstated": ${JSON.stringify(ledger.maxOpenOverstated)},`,
    `${list('claims', sortedBy(ledger.claims, (claim) => claim.id))},`,
    `${list('machine', ledger.machine)},`,
    list('sentences', sortedBy(ledger.sentences, (record) => `${record.path}\u0000${record.text}`)),
    '}',
    '',
  ].join('\n');
}

/** Files outside the consumer surface that make claims to readers or to other programs. */
export const SCOPE_ADD = Object.freeze([
  'docs/engine-validation/README.md',
  'public/llms-full.txt',
  'scripts/build-assistant-context.mjs',
]);

/** In the consumer surface, but not read here, each with its reason. */
export const SCOPE_DROP = Object.freeze([
  { pattern: /^api\/_assistant\/context\.ts$/u, reason: 'generated from scripts/build-assistant-context.mjs, which is read instead' },
  { pattern: /^src\/data\/(?:sky|ingresses|eclipses|birthdays)\.json$/u, reason: 'generated sky data with no prose' },
  { pattern: /^src\/data\/transits-\d{4}-\d{2}\.json$/u, reason: 'generated sky data with no prose' },
  { pattern: /^src\/data\/tz-(?:lmt\.json|history\/)/u, reason: 'generated time zone tables' },
  { pattern: /^src\/data\/people\.json$/u, reason: 'the people pilot\'s frozen, generated copy; its facts are checked by build-people-pilot.mjs --check' },
  { pattern: /(?:^|\/)fixtures\/|\.fixture\.json$/u, reason: 'test fixtures, not copy' },
]);

/** Trust files whose blocks are ledgered whole once any sentence in them is triggered. */
export const DENSE_FILES = Object.freeze([
  'docs/engine-validation/README.md',
  'public/llms-full.txt',
  'public/llms.txt',
  'src/pages/developers/engine/index.astro',
  'src/pages/methodology/index.astro',
  'src/pages/privacy/index.astro',
]);

/** Trust files read with the FULL list, sentence by sentence. */
export const TRUST_PATTERNS = Object.freeze([
  /^src\/pages\/index\.astro$/u,
  /^src\/pages\/about\/index\.astro$/u,
  /^src\/pages\/terms\/index\.astro$/u,
  /^src\/pages\/birth-chart\/index\.astro$/u,
  /^src\/pages\/developers\//u,
  /^src\/mcp\/[^/]+\.ts$/u,
  /^src\/lib\/sky-api\/[^/]+\.ts$/u,
  /^src\/lib\/compute-api\/[^/]+\.ts$/u,
  /^scripts\/build-assistant-context\.mjs$/u,
]);

/** Translated pages and catalogs, read with the NEUTRAL list. */
export const MIRROR_PATTERNS = Object.freeze([
  /^src\/pages\/(?:es|fr|it|pt|ru)\//u,
  /^src\/lib\/i18n\/ui\/(?:es|fr|it|pt|ru)\.ts$/u,
  /^src\/strings\/(?:additions\.)?(?:es|fr|it|pt|ru)\.mjs$/u,
  /^src\/data\/(?:es|fr|it|pt|ru)-[^/]+$/u,
  /^src\/content\/[^/]+\/(?:es|fr|it|pt|ru)\//u,
]);

export function tierOf(file) {
  if (DENSE_FILES.includes(file)) return 'dense';
  if (TRUST_PATTERNS.some((pattern) => pattern.test(file))) return 'trust';
  if (MIRROR_PATTERNS.some((pattern) => pattern.test(file))) return 'mirror';
  return 'hard';
}

export async function ledgerScope(repoRoot) {
  const base = await consumerSurfaceFiles(repoRoot);
  return [...new Set([...base, ...SCOPE_ADD])]
    .filter((file) => !SCOPE_DROP.some(({ pattern }) => pattern.test(file)))
    .sort();
}

// ---------- normalization and splitting ----------

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', times: '×', deg: '°', prime: '′', Prime: '″', minus: '−',
};

export function normalizeText(value) {
  return String(value)
    .normalize('NFC')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (match, name) => {
      if (name[0] === '#') {
        const code = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return Object.prototype.hasOwnProperty.call(ENTITIES, name) ? ENTITIES[name] : match;
    })
    .replace(/[\s   ]+/gu, ' ')
    .trim();
}

/** Quotes folded for matching only; records keep the text as written. */
export function foldQuotes(value) {
  return value.replace(/[’‘ʼ]/gu, "'").replace(/[“”]/gu, '"');
}

const ABBREVIATIONS = /\b(?:e\.g|i\.e|etc|vs|approx|No|U\.S|a\.m|p\.m|cf|Fig|St|Dr|Mr|Mrs|Ms)\.(?=\s)/gu;
const HOLD = '⁠';

/** Sentences of three or more words: split after . ! ? before a capital, digit, quote, bracket or placeholder. */
export function splitSentences(block) {
  const text = normalizeText(block);
  if (!text) return [];
  return text
    .replace(ABBREVIATIONS, (match) => `${match}${HOLD}`)
    .split(new RegExp(`(?<=[.!?])(?<!${HOLD})\\s+(?=[\\p{Lu}\\d"“‘'(\\[$—–-])`, 'u'))
    .map((sentence) => sentence.replaceAll(HOLD, '').trim())
    .filter((sentence) => sentence.split(/\s+/u).filter((word) => /\p{L}/u.test(word)).length >= 3);
}

// ---------- extraction ----------

const BLOCK_TAGS = new Set([
  'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th', 'dd', 'dt', 'figcaption', 'blockquote',
  'summary', 'caption', 'label', 'button', 'legend', 'option',
]);
const INLINE_TAGS = new Set(['strong', 'em', 'b', 'i', 'a', 'code', 'span', 'abbr', 'sup', 'sub', 'small', 'mark', 'time', 'br', 'q', 'cite', 'kbd', 'var', 'dfn', 'wbr']);
const TEXT_ATTRIBUTES = new Set(['title', 'description', 'alt', 'aria-label', 'content', 'imageAlt', 'placeholder', 'lede', 'summary', 'note', 'caption', 'label']);
export const PLACEHOLDER = '${…}';

function scriptKindFor(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (file.endsWith('.js') || file.endsWith('.mjs')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function jsxTagName(node) {
  const tag = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
  return tag.getText();
}

/** The text of a JSX child list as a reader sees it, with inline elements joined in. */
function jsxInlineText(children, source) {
  let text = '';
  for (const child of children) {
    if (ts.isJsxText(child)) text += child.text;
    else if (ts.isJsxExpression(child)) {
      const expression = child.expression;
      if (!expression) continue;
      if (ts.isStringLiteralLike(expression)) text += expression.text;
      else text += PLACEHOLDER;
    } else if (ts.isJsxElement(child) && INLINE_TAGS.has(jsxTagName(child))) {
      text += jsxInlineText(child.children, source);
    } else if (ts.isJsxSelfClosingElement(child) && jsxTagName(child) === 'br') {
      text += ' ';
    } else if (ts.isJsxFragment(child)) {
      text += jsxInlineText(child.children, source);
    } else {
      text += ' ';
    }
  }
  return text;
}

/** String blocks in a script: literals, templates (joined around a placeholder) and JSX text blocks. */
export function scriptBlocks(source, file) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const blocks = [];
  const inJsxBlock = new WeakSet();
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isLiteralTypeNode(node)) return;
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const tag = ts.isJsxElement(node) ? jsxTagName(node) : '';
      const children = node.children;
      const hasText = children.some((child) => ts.isJsxText(child) && child.text.trim());
      if ((BLOCK_TAGS.has(tag) || hasText) && !inJsxBlock.has(node)) {
        blocks.push(jsxInlineText(children, tree));
        const mark = (child) => {
          if (ts.isJsxElement(child) && INLINE_TAGS.has(jsxTagName(child))) {
            inJsxBlock.add(child);
            child.children.forEach(mark);
          }
        };
        children.forEach(mark);
      }
    }
    if (ts.isJsxText(node)) return;
    if (ts.isStringLiteralLike(node)) {
      const parent = node.parent;
      if (ts.isPropertyAssignment(parent) && parent.name === node) return;
      if (ts.isJsxExpression(parent) && ts.isJsxElement(parent.parent)) return;
      if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return;
      blocks.push(node.text);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      blocks.push([node.head.text, ...node.templateSpans.map((span) => `${PLACEHOLDER}${span.literal.text}`)].join(''));
      for (const span of node.templateSpans) visit(span.expression);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return blocks;
}

async function astroBlocks(source, file) {
  const { ast } = await parseAstro(source, { position: false });
  const blocks = [];
  let inline = [];
  const flush = () => {
    if (inline.length) blocks.push(inline.join(''));
    inline = [];
  };
  const expressionText = (node) => (node.children ?? []).filter((child) => child.type === 'text').map((child) => child.value).join('');
  const walk = (node, inBlock) => {
    switch (node.type) {
      case 'frontmatter':
        flush();
        blocks.push(...scriptBlocks(node.value, `${file}.ts`));
        return;
      case 'text':
        inline.push(node.value);
        return;
      case 'comment':
      case 'doctype':
        return;
      case 'expression': {
        const code = expressionText(node).trim();
        const hasElements = (node.children ?? []).some((child) => child.type !== 'text');
        if (!hasElements) {
          if (/^(['"`]) \1$/u.test(code)) { inline.push(' '); return; }
          const literals = code ? scriptBlocks(`(${code})`, `${file}.tsx`) : [];
          if (literals.length === 1 && /^['"`]/u.test(code) && !code.includes('${')) inline.push(literals[0]);
          else {
            inline.push(PLACEHOLDER);
            blocks.push(...literals);
          }
          return;
        }
        // Markup inside an expression ({cond && <p>…</p>}, {items.map(…)}): its
        // code fragments are read as script, its elements as markup.
        for (const child of node.children ?? []) {
          if (child.type === 'text') {
            if (child.value.trim()) blocks.push(...scriptBlocks(`(${child.value})`.replace(/^\(\s*\)$/u, ''), `${file}.tsx`));
          } else walk(child, inBlock);
        }
        return;
      }
      case 'element':
      case 'component':
      case 'custom-element':
      case 'fragment': {
        const name = node.name ?? '';
        if (name === 'style') return;
        if (name === 'script') {
          flush();
          blocks.push(...scriptBlocks((node.children ?? []).map((child) => child.value ?? '').join(''), `${file}.ts`));
          return;
        }
        for (const attribute of node.attributes ?? []) {
          if (attribute.kind === 'quoted' && TEXT_ATTRIBUTES.has(attribute.name)) blocks.push(attribute.value);
          else if (attribute.kind === 'expression' || attribute.kind === 'template-literal') {
            blocks.push(...scriptBlocks(`(${attribute.value})`, `${file}.tsx`));
          }
        }
        const inlineTag = node.type === 'element' && INLINE_TAGS.has(name) && inBlock;
        if (inlineTag) {
          if (name === 'br') inline.push(' ');
          for (const child of node.children ?? []) walk(child, true);
          return;
        }
        flush();
        const block = node.type === 'element' && BLOCK_TAGS.has(name);
        for (const child of node.children ?? []) walk(child, block || inBlock);
        flush();
        return;
      }
      default:
        for (const child of node.children ?? []) walk(child, inBlock);
    }
  };
  walk(ast, false);
  flush();
  return blocks;
}

function markdownBlocks(source) {
  return source
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u, '')
    .replace(/<!--[\s\S]*?-->/gu, ' ')
    .split(/\r?\n\s*\r?\n/u)
    .filter((block) => !/^\s*(?:import|export)\s/u.test(block))
    .map((block) => block
      .replace(/<[^>]+>/gu, ' ')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/gu, '$1')
      .replace(/^\s{0,3}(?:#{1,6}|[-*+]|\d+\.|>)\s+/gmu, '')
      .replace(/[*`]+/gu, '')
      // Underscore emphasis only; an underscore inside a name (America/New_York) stays.
      .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/gmu, '$1$2'));
}

function jsonBlocks(source) {
  const blocks = [];
  const visit = (value) => {
    if (typeof value === 'string') blocks.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  try {
    visit(JSON.parse(source));
  } catch {
    return markdownBlocks(source);
  }
  return blocks;
}

/** The text blocks of one file, each a run of text a reader meets as one piece. */
export async function extractBlocks(file, source) {
  if (file.endsWith('.astro')) return astroBlocks(source, file);
  if (/\.(?:md|mdx|txt)$/u.test(file)) return markdownBlocks(source);
  if (file.endsWith('.json')) return jsonBlocks(source);
  return scriptBlocks(source, file);
}

// ---------- triggers ----------

/**
 * Versioned with the ledger: a change here changes which sentences must be
 * listed, so scripts/claims-ledger.test.mjs pins it.
 */
export const LEXICON_VERSION = 1;

const BRANDS = /(?:\bOpenAI\b|\bSupabase\b|\bPlausible\b|\bPII\b|\bJPL\b|\bNASA\b|\bHorizons\b|\bSwiss Ephemeris\b|\bIANA\b|\bICU\b)/u;

export const FULL = Object.freeze({
  names: BRANDS,
  accuracy: /(?:\baccura\w*|\binaccura\w*|\bprecis(?:e|ely|ion)\b|\barc-?(?:second|minute)s?\b|\d\s?″|\bJPL\b|\bNASA\b|\bHorizons\b|\bSwiss Ephemeris\b|\bVSOP|\bNOVAS\b|\bAstronomy Engine\b|\bastronomy-engine\b|\bephemer(?:is|ides)\b|\btested (?:against|with)\b|\bchecked (?:against|across|with)\b|\bcompared (?:against|with)\b|\bverified\b|\bvalidat\w+|\bresidual|\btolerances?\b|ΔT|\bdelta-?T\b|\bto the (?:minute|second|hour)\b|\bwithin (?:about |roughly )?(?:a few|\d[\d.,]*)\s?(?:°|degrees?|arc|minutes?|seconds?|hours?|hundredths|km)|\brefined to\b|\berror bars?\b|\bmargin of error\b|\bagree(?:s|ment)? (?:with|to)\b|\bmatch(?:es)? (?:Swiss|JPL|NASA|professional)|\bprofessional software\b|\bcertif(?:y|ied|ication)\b|\bproven\b|\bguarantee\w*)/iu,
  time: /(?:\bIANA\b|\bICU\b|\btzdb\b|\bbackzone\b|\btime[- ]?zones?\b|\bdaylight[- ]saving\b|\bDST\b|\blocal mean time\b|\bmean time\b|\bLMT\b|\bhistorical (?:clock|offset|time|civil)|\bclock changes?\b|\b12:00\b|\bnoon\b|\bleap seconds?\b|\bUT1\b|\bJulian\b|\bGregorian\b|\bOld Style\b|\bstandard(?:ized)? time\b)/iu,
  privacy: /(?:\bon (?:your|the|this|their|a|the visitor's|the user's) (?:own )?(?:device|machine|browser)\b|\bin (?:your|the|the visitor's|the user's|this) (?:own )?browser\b|\bon-device\b|\bleaves? (?:your|the) (?:device|browser)\b|\bnever (?:leaves?|sent|sends|stored|stores|shared|logged)\b|\bnot (?:sent|stored|shared|sold|logged|uploaded|attached|transmitted|retained|kept)\b|\bnothing is (?:sent|stored|uploaded)\b|\bno (?:account|tracking|cookies?|analytics|network (?:request|connection)|listener|port|server|logs?|ads)\b|\bcookieless\b|\bstore:\s?false\b|\bpersonal (?:data|information)\b|\banonymous\b|\bfingerprinting\b|\bIP address\b|\bthird[- ]part(?:y|ies)\b|\breaches zodiacs\.org\b|\bchart(?:-calculation)? (?:server|API)\b|\bprivately\b|\bprivacy\b|\bbirth (?:data|details|fields)\b|\b(?:no|not|never|neither|nor|without|omit\w*|includes?|contains?|carr(?:y|ies))\b[^.]{0,60}\bbirth (?:date|time|place)\b|\bpositions[- ]only\b|\bchart code\b|\bsent to (?:us|a server|our server|the server))/iu,
});

export const HARD = Object.freeze({
  names: BRANDS,
  accuracy: /(?:\baccura(?:te|cy) (?:to|within)\b|\bprecis(?:e|ion) (?:to|within)\b|\barc-?(?:second|minute)s?\b|\d\s?″|\bephemer(?:is|ides)\b|\b(?:tested|verified|validated|checked|compared) against\b|ΔT|\bdelta-?T\b|\bto the (?:minute|second)\b|\bprofessional software\b)/iu,
  time: /(?:\btzdb\b|\bbackzone\b|\blocal mean time\b|\bLMT\b|\bleap seconds?\b|\bUT1\b|\bOld Style\b)/u,
  privacy: /(?:\bon (?:your|this|the visitor's|the user's) (?:own )?(?:device|machine)\b|\bin (?:your|the visitor's|the user's|this) (?:own )?browser\b|\bon-device\b|\bleaves? (?:your|the|this) (?:device|browser)\b|\bnever (?:leaves? (?:your|the|this) (?:device|browser)|sent|stored|shared|logged)\b|\bnothing (?:is|gets) (?:sent|stored|uploaded)\b|\bno (?:tracking|cookies|analytics|network request|chart server)\b|\bcookieless\b|\bstore:\s?false\b|\bpersonal (?:data|information)\b|\bfingerprinting\b|\bIP address\b|\bchart(?:-calculation)? (?:server|API)\b|\bpositions[- ]only\b)/iu,
});

export const NEUTRAL = Object.freeze({
  names: /(?:\bJPL\b|\bNASA\b|\bHorizons\b|\bIANA\b|\bICU\b|\bOpenAI\b|\bPlausible\b|\bSupabase\b|\b12:00\b|\bUTC\b|\bSwiss Ephemeris\b)/u,
});

const LEXICONS = { dense: FULL, trust: FULL, hard: HARD, mirror: NEUTRAL };

/** The topics a sentence triggers under a tier's list. */
export function triggers(sentence, tier) {
  const folded = foldQuotes(sentence);
  return Object.entries(LEXICONS[tier]).filter(([, pattern]) => pattern.test(folded)).map(([topic]) => topic);
}

/**
 * The sentences a file must list: its triggered sentences, and on a dense
 * file every sentence of a block that holds one. Unique, in file order.
 */
export async function selectFileSentences(file, source) {
  const tier = tierOf(file);
  const blocks = await extractBlocks(file, source);
  const selected = new Map();
  for (const block of blocks) {
    const sentences = splitSentences(block);
    const hits = sentences.map((sentence) => triggers(sentence, tier));
    const whole = tier === 'dense' && hits.some((topics) => topics.length);
    sentences.forEach((sentence, index) => {
      if (!whole && !hits[index].length) return;
      if (!selected.has(sentence)) selected.set(sentence, { text: sentence, topics: hits[index], tier });
    });
  }
  return [...selected.values()];
}

/** Every in-scope file's selected sentences, keyed by path. */
export async function selectSentences(repoRoot) {
  const files = await ledgerScope(repoRoot);
  const selected = new Map();
  for (const file of files) {
    const source = await readFile(resolve(repoRoot, file), 'utf8');
    const sentences = await selectFileSentences(file, source);
    if (sentences.length) selected.set(file, sentences);
  }
  return { files, selected };
}
