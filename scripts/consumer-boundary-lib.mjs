import { readFile, readdir } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set([
  '.astro', '.js', '.jsx', '.json', '.md', '.mdx', '.mjs', '.ts', '.tsx', '.txt',
]);

/**
 * Exported so the scanner's own test seeds exactly the roots it will read. A
 * hand-kept copy of this list in the test drifted the moment a root was added,
 * and the scanner failing loudly on a missing root is the behaviour to keep.
 */
export const SOURCE_ROOTS = Object.freeze([
  'api',
  'src/components',
  'src/content',
  'src/data',
  'src/islands',
  'src/layouts',
  'src/lib',
  'src/mcp',
  'src/pages',
  'src/server',
  'src/strings',
]);

const EXACT_SOURCE_FILES = Object.freeze(['public/llms.txt']);

const WING_ONLY_SOURCE = Object.freeze([
  /^api\/_registry\//u,
  /^api\/(?:aura-holdings|wallet-birth)\.ts$/u,
  /^src\/app\.jsx$/u,
  /^src\/(?:exchange|registry|shelf|trade)\//u,
  /^src\/components\/(?:Registry[^/]*|TerminalMarketVenueNotice)\.astro$/u,
  /^src\/data\/(?:aura-moon-ingresses|registry-origin-receipts)\.json$/u,
  /^src\/data\/registry-research\/(?:approval-manifest|drafts|publication)\.json$/u,
  /^src\/islands\/(?:RegistryAura|WalletChart)\.tsx$/u,
  /^src\/islands\/aura\//u,
  /^src\/lib\/(?:aura(?:-|\/)|registry(?:-|\/)|wallet\/)\S*/u,
  /^src\/pages\/astrofolio\/how-to-buy\//u,
  /^src\/pages\/fomo\//u,
  /^src\/pages\/(?:registry|terminal)\//u,
  /^src\/pages\/feeds\/market-research\.json\.ts$/u,
  /^src\/strings\/wallet-chart\.ts$/u,
]);

const NON_SURFACE_SOURCE = Object.freeze([
  /(?:^|\/)__snapshots__\//u,
  /(?:^|\/)__fixtures__\//u,
  /(?:^|\/)[^/]+\.(?:spec|test)\.[^.]+$/u,
  /^api\/_assistant\/persona\.ts$/u,
  /^src\/lib\/guide-server\/safety\.ts$/u,
]);

const VOCABULARY = Object.freeze([
  ['token, market, or crypto vocabulary', /(?<![\p{L}\p{N}_])(?:tokens?|t[oó]kens?|jeton\p{L}*|getton\p{L}*|токен\p{L}*|markets?|mercad\p{L}*|mercat\p{L}*|marchés?|рын\p{L}*|crypto(?:currenc(?:y|ies))?|cryptomonnaie?s?|cripto(?:moned\p{L}*|moed\p{L}*|valut\p{L}*)?|крипто(?:валют\p{L}*)?)(?![\p{L}\p{N}_])/iu],
  ['crypto vocabulary', /\b(?:altcoins?|crypto(?:currenc(?:y|ies))?|memecoins?|web3)\b/iu],
  ['chain or exchange vocabulary', /\b(?:blockchains?|dex\s*screener|dexscreener|erc-?20|on-?chain|solana|spl\s+(?:mint|record|token))\b/iu],
  ['token or coin vocabulary', /\b(?:(?:official(?:\s+zodiac)?|zodiac|registry|digital|crypto)\s+(?:assets?|coins?|tokens?)|(?:coins?|tokens?)\s+(?:acquisition|addresses?|deployment|liquidity|markets?|mints?|prices?|records?|trading))\b/iu],
  ['acquisition vocabulary', /\b(?:buy|buying|purchase|purchasing|sell|selling|trade|trading|acquir(?:e|ing|ed)|acquisition)\b[\s\S]{0,90}\b(?:assets?|coins?|registry|tokens?)\b|\b(?:assets?|coins?|tokens?)\b[\s\S]{0,90}\b(?:buy|buying|purchase|sell|selling|trade|trading|acquisition)\b/iu],
  ['market vocabulary', /\bmarkets?\b/iu],
  ['liquidity vocabulary', /\b(?:indexed liquidity|liquidity (?:aggregator|pool)|market cap|market desk|market tape)\b/iu],
]);

const EXTERNAL_WING_DESTINATION = /\b(?:astrofolio\.xyz|api\.dexscreener\.com|dexscreener\.com|jup\.ag|raydium\.io|orca\.so|fomo\.family|wallet\.coinbase\.com|web3\.okx\.com|phantom\.com|solflare\.com|binance\.com\/en\/web3wallet|bybit\.com\/web3)\b/giu;
const INTERNAL_WING_DESTINATION = /(?:^|[\s("'`=]|https?:\/\/(?:www\.)?zodiacs\.org)(\/(?:archive|astrofolio|disclosure|fomo|registry|sdk|terminal|thesis)(?:(?:\/|[?#])[a-z0-9._/?=&%#${}…-]*)?)(?=$|[\s("'`=),.;:<>])/giu;
const SOURCE_PROBE = /(?:astrofolio\.xyz|jup\.ag|raydium\.io|orca\.so|fomo\.family|wallet\.coinbase\.com|web3\.okx\.com|phantom\.com|solflare\.com|binance\.com\/en\/web3wallet|bybit\.com\/web3|\/(?:archive|astrofolio|disclosure|fomo|registry|sdk|terminal|thesis)(?:\/|[?#]|(?=$))|(?<![\p{L}\p{N}_])(?:acquir(?:e|ed|ing)|acquisition|altcoins?|assets?|blockchains?|buy(?:ing)?|coins?|crypto(?:currenc(?:y|ies))?|cryptomonnaie?s?|cripto(?:moned\p{L}*|moed\p{L}*|valut\p{L}*)?|крипто(?:валют\p{L}*)?|dexscreener|erc-?20|getton\p{L}*|jeton\p{L}*|liquidity|markets?|marchés?|mercad\p{L}*|mercat\p{L}*|memecoins?|on-?chain|purchas(?:e|ed|ing)|рын\p{L}*|sell(?:ing)?|solana|spl|t[oó]kens?|tokens?|токен\p{L}*|trad(?:e|ed|ing)|web3|zodiac)(?![\p{L}\p{N}_]))/iu;

const LEGAL_PATH = /^(?:src\/components\/LocalizedDisclosurePage\.astro|src\/lib\/disclosure\.ts|src\/pages\/(?:privacy|terms|disclosure)\/|src\/pages\/(?:es|fr|it|pt|ru)\/(?:privacy|terms|disclosure)\/)/u;
const LEGAL_DEFENSIVE_CONTEXT = /(?:\b(?:can|cannot|disclosure|does not|do not|independent(?:ly)?|irreversible|liable|loss|may|never|no|not|only|privacy|risk|speculative|terms|third part|verify|volatile|without)\b|\b(?:aucun(?:e)?|confidentialit[eé]|ind[eé]pendant|irr[eé]versible|jamais|ne|ni|pas|perte|peut|risque|sans|seulement|uniquement|v[eé]rif\p{L}*)\b|\b(?:indipendente|irreversibile|mai|nessun[ao]?|non|perdita|privacy|pu[oò]|rischio|senza|solo|verific\p{L}*)\b|\b(?:apenas|independente|irrevers[ií]vel|jamais|n[aã]o|nenhum[ao]?|perda|pode|privacidade|risco|sem|somente|verific\p{L}*)\b|\b(?:independiente|irreversible|nunca|ning[uú]n|no|p[eé]rdida|puede|privacidad|riesgo|sin|solo|verific\p{L}*)\b|(?:^|\s)(?:без|может|не|нет|потеря|провер\p{L}*|риск|только)(?:\s|$))/iu;
const LEGAL_OPERATIONAL_CONTEXT = /(?:\b(?:access|address|browser|contract|cookies?|data|endpoint|external|fees?|funds?|history|holdings?|infrastructure|keys?|law|metadata|network|provider|public|registry|request|service|session|sign[ -]?in|third part|transaction|wallet)\b|\b(?:acceso|cartera|datos|direcci[oó]n|historial|infraestructura|metadatos|navegador|proveedor|p[uú]blic[ao]s?|registro|ses[ió]n|solicitud|transacci[oó]n)\b|\b(?:adresse|avoir|donn[eé]es|fournisseur|historique|infrastructure|m[eé]tadonn[eé]es|navigateur|portefeuille|public|registre|requ[eê]te|session|transaction)\b|\b(?:accesso|browser|cronologia|dati|fornitore|infrastruttura|indirizzo|metadati|portafoglio|pubblic[ao]|registro|richiesta|sessione|transazione|wallet)\b|\b(?:acesso|carteira|dados|endereço|hist[oó]rico|infraestrutura|metadados|navegador|provedor|p[uú]blic[ao]s?|registro|sess[aã]o|solicitaç[aã]o|transaç[aã]o)\b|(?:^|\s)(?:адрес|браузер|данные|инфраструктура|метаданные|провайдер|публичный|реестр|сессия|транзакция)(?:\s|$))/iu;
const LEGAL_PROMOTIONAL_CONTEXT = /(?:^|[.!?]\s*)(?:buy|purchase|sell|trade|acquire|visit|open|follow)\b|\b(?:buy|purchase|sell|trade|acquire)\b[\s\S]{0,60}\b(?:here|now|today)\b/iu;
const DISCLOSURE_KEY = /(?:^|\.)disclosure(?:\.|$)/iu;
const DISCLOSURE_OPERATOR_KEY = /(?:^|\.)disclosure\.operatorStatement$/iu;
const APPROVED_DISCLOSURE_KEY = /(?:^|\.)disclosure\.(?:adviceEvidence|adviceStatement|economicEvidence|economicStatement|metaDescription|operatorEvidence|operatorStatement|originEvidence|originStatement|tradeEvidence|tradeStatement)$/iu;
const DISCLOSURE_CATALOG_SOURCE = /^src\/strings\/(?:en|additions\.(?:es|fr|it|pt))\.mjs$/u;
const WING_CATALOG_KEY = /(?:^|\.)(?:archive|astrofolio|disclosure|markets?|registry(?:Lot)?|research|terminal|thesis|walletChart|wing)(?:\.|$)|^TERMINAL_OG_PREFIXES$/iu;

export const READ_ONLY_POSTURE = 'Read-only posture (Registry and SDK): Official Registry records, catalogue profiles, paste-address verification, and the SDK are read-only. Registry lookup requests no wallet signature and submits no transaction. The separate, opt-in Astrofolio How to Buy tool may load independent Jupiter only after a visitor’s click; the visitor’s wallet reviews and signs. Zodiacs.org holds no keys or funds. Unknown addresses are reported only as “not found in the official Zodiacs.org registry.” Optional market context never changes identity status. Nothing on the site is financial advice. The site\'s calculators compute a visitor\'s chart on their device and send the birth details to no server. When you calculate for someone yourself, prefer a local calculation (the engine package or the local MCP server); send birth details to the compute API only when that person has agreed to them leaving their device, and only in the POST body, never in a URL. Account sync and the explicitly attached AI-assistant context are separate, opt-in transmissions described above.';

const SANCTIONED_INTERNAL_LINKS = Object.freeze([
  [/^src\/components\/CollectBand\.astro$/u, /^\/registry\/\$\{…\}\/$/u],
  [/^src\/components\/LocalizedDisclosurePage\.astro$/u, /^\/(?:disclosure|registry)\/$/u],
  [/^src\/components\/SiteFooter\.astro$/u, /^\/(?:astrofolio|disclosure|registry|sdk)\/$/u],
  [/^src\/components\/SiteNav\.astro$/u, /^\/astrofolio\/$/u],
  [/^src\/islands\/(?:ChartCalculator|RaceBoard)\.tsx$/u, /^\/registry\/\$\{…\}\/$/u],
  [/^src\/lib\/disclosure\.ts$/u, /^\/(?:astrofolio\/how-to-buy\/|registry\/(?:aries\/|zodiacs\.registry\.json)|sdk\/|thesis\/)$/u],
  [/^src\/lib\/legacy\/urls\.ts$/u, /^\/(?:archive|astrofolio|registry|sdk|terminal|thesis)\//u],
  [/^src\/lib\/i18n\/index\.ts$/u, /^\/disclosure\/$/u],
  [/^src\/strings\/seo\.(?:en|ru)\.mjs$/u, /^\/disclosure\/$/u],
  [/^src\/pages\/about\/index\.astro$/u, /^\/(?:astrofolio|disclosure|registry|terminal)\/$/u],
  [/^src\/pages\/bio\/index\.astro$/u, /^\/astrofolio\/$/u],
  // The developer front door identifies the separate, optional read-only SDK.
  // Keep this bridge exact: consumer pages and other wing routes remain checked.
  [/^src\/pages\/developers\/index\.astro$/u, /^\/sdk\/$/u],
  [/^src\/pages\/developers\/support\/index\.astro$/u, /^\/sdk\/(?:engine\/)?$/u],
  [/^src\/pages\/terms\/index\.astro$/u, /^\/(?:astrofolio\/how-to-buy|disclosure)\/$/u],
  [/^src\/pages\/ru\/\[sign\]\/index\.astro$/u, /^\/registry\/\$\{…\}\/$/u],
  [/^src\/pages\/ru\/disclosure\/index\.astro$/u, /^\/terminal\/$/u],
  [/^src\/pages\/sitemap\.xml\.ts$/u, /^\/(?:astrofolio|disclosure|fomo|registry|sdk|terminal|thesis)\//u],
]);

function toPosix(value) {
  return value.replaceAll('\\', '/');
}

function lineLocator(source) {
  const starts = [0];
  for (let index = source.indexOf('\n'); index >= 0; index = source.indexOf('\n', index + 1)) {
    starts.push(index + 1);
  }
  return (offset) => {
    const target = Math.max(0, offset);
    let low = 0;
    let high = starts.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (starts[middle] <= target) low = middle + 1;
      else high = middle;
    }
    return low;
  };
}

function decoded(value) {
  return value
    .replace(/&(?:amp|#38);/giu, '&')
    .replace(/&(?:apos|#39);/giu, "'")
    .replace(/&(?:quot|#34);/giu, '"')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&#x201[89];/giu, "'")
    .replace(/&#x201[34];/giu, '—')
    .replace(/\s+/gu, ' ')
    .trim();
}

function nameText(name) {
  if (!name) return '';
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text;
  return name.getText().replace(/^\[|\]$/gu, '');
}

function objectIdentity(object) {
  if (!ts.isObjectLiteralExpression(object)) return '';
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = nameText(property.name);
    if (!['id', 'key', 'kind', 'locale'].includes(key)) continue;
    if (ts.isStringLiteralLike(property.initializer)) return property.initializer.text;
  }
  return '';
}

function propertyPath(node) {
  const parts = [];
  let child = node;
  for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isPropertyAssignment(parent) && parent.initializer === child) {
      parts.unshift(nameText(parent.name));
      const identity = objectIdentity(parent.parent);
      if (identity && identity !== nameText(parent.name)) parts.unshift(identity);
    } else if (ts.isVariableDeclaration(parent) && parent.initializer === child) {
      parts.unshift(nameText(parent.name));
    }
  }
  return parts.filter(Boolean).join('.');
}

function scriptKind(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (file.endsWith('.js') || file.endsWith('.mjs')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function extractScript(source, file, lineOffset = 0) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file));
  const fragments = [];
  const sourceLine = lineLocator(source);

  function add(node, text, kind = 'literal') {
    const value = decoded(text);
    if (!value) return;
    fragments.push({
      file,
      kind,
      key: propertyPath(node),
      line: sourceLine(node.getStart(tree)) + lineOffset,
      text: value,
    });
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) return;
    }
    if (ts.isPropertyAssignment(node) && ts.isStringLiteralLike(node.name)) {
      visit(node.initializer);
      return;
    }
    if (ts.isStringLiteralLike(node)) {
      const parent = node.parent;
      if (ts.isLiteralTypeNode(parent)) return;
      const kind = ts.isJsxAttribute(parent) ? nameText(parent.name) : 'literal';
      add(node, node.text, kind);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      const text = [node.head.text, ...node.templateSpans.map((span) => `\${…}${span.literal.text}`)].join('');
      add(node, text, 'template');
      for (const span of node.templateSpans) visit(span.expression);
      return;
    }
    if (ts.isJsxText(node)) add(node, node.text, 'visible');
    ts.forEachChild(node, visit);
  }

  visit(tree);
  return fragments;
}

function mask(source, pattern) {
  return source.replace(pattern, (match) => match.replace(/[^\n]/gu, ' '));
}

function extractAstro(source, file) {
  const fragments = [];
  const sourceLine = lineLocator(source);
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (frontmatter) fragments.push(...extractScript(frontmatter[1], file, 1));

  let template = frontmatter
    ? `${'\n'.repeat(frontmatter[0].split('\n').length - 1)}${source.slice(frontmatter[0].length)}`
    : source;
  template = mask(template, /<!--[\s\S]*?-->/gu);
  template = mask(template, /<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/giu);

  for (const match of template.matchAll(/>([^<]+)</gu)) {
    const raw = match[1].replace(/\{[\s\S]*?\}/gu, ' ');
    const text = decoded(raw);
    if (!text) continue;
    fragments.push({ file, kind: 'visible', key: '', line: sourceLine(match.index + 1), text });
  }

  for (const match of template.matchAll(/\b(alt|aria-label|description|href|placeholder|title)\s*=\s*(["'`])([\s\S]*?)\2/giu)) {
    fragments.push({
      file,
      kind: match[1].toLowerCase(),
      key: match[1].toLowerCase(),
      line: sourceLine(match.index),
      text: decoded(match[3].replace(/\$\{[\s\S]*?\}/gu, '${…}')),
    });
  }

  // Astro expression attributes often wrap a template or quoted literal in
  // braces. Read only strings carrying a boundary probe, not CSS/classes.
  for (const match of template.matchAll(/(["'`])([^\n]*?(?:astrofolio\.xyz|\/(?:archive|astrofolio|disclosure|fomo|registry|sdk|terminal|thesis)\/|\b(?:crypto|market|memecoin|solana|token)\b)[^\n]*?)\1/giu)) {
    fragments.push({
      file,
      kind: 'expression',
      key: '',
      line: sourceLine(match.index),
      text: decoded(match[2].replace(/\$\{[\s\S]*?\}/gu, '${…}')),
    });
  }
  return fragments;
}

function extractMarkdown(source, file) {
  // Code fences and raw HTML are rendered content on MD/MDX pages, so they
  // remain in the scan. Comments are not audience-facing.
  const visible = mask(source, /<!--[\s\S]*?-->/gu);
  const fragments = [];
  const sourceLine = lineLocator(visible);

  for (const match of visible.matchAll(/\bhref\s*=\s*(["'])([\s\S]*?)\1/giu)) {
    fragments.push({
      file,
      kind: 'href',
      key: 'href',
      line: sourceLine(match.index),
      text: decoded(match[2]),
    });
  }

  for (const match of visible.matchAll(/\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/gu)) {
    fragments.push({
      file,
      kind: 'href',
      key: 'href',
      line: sourceLine(match.index),
      text: decoded(match[1]),
    });
  }

  for (const match of visible.matchAll(/(?:^|\n)([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gu)) {
    const text = decoded(match[1].replace(/<[^>]+>/gu, ' '));
    if (text) fragments.push({ file, kind: 'visible', key: '', line: sourceLine(match.index), text });
  }
  return fragments;
}

function extractJson(source, file) {
  const fragments = [];
  const sourceLine = lineLocator(source);
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    return extractMarkdown(source, file);
  }
  let cursor = 0;
  function visit(item, path = []) {
    if (typeof item === 'string') {
      const at = source.indexOf(JSON.stringify(item), cursor);
      if (at >= 0) cursor = at + 1;
      fragments.push({ file, kind: 'json', key: path.join('.'), line: sourceLine(Math.max(0, at)), text: decoded(item) });
      return;
    }
    if (Array.isArray(item)) item.forEach((entry, index) => visit(entry, [...path, String(index)]));
    else if (item && typeof item === 'object') {
      for (const [key, entry] of Object.entries(item)) visit(entry, [...path, key]);
    }
  }
  visit(value);
  return fragments;
}

export function extractConsumerFragments(source, file) {
  if (file.endsWith('.astro')) return extractAstro(source, file);
  if (file.endsWith('.md') || file.endsWith('.mdx') || file.endsWith('.txt')) return extractMarkdown(source, file);
  if (file.endsWith('.json')) return extractJson(source, file);
  return extractScript(source, file);
}

function isDisclosureFragment(fragment) {
  return DISCLOSURE_CATALOG_SOURCE.test(fragment.file) && DISCLOSURE_KEY.test(fragment.key);
}

function isApprovedDisclosureFragment(fragment) {
  return DISCLOSURE_CATALOG_SOURCE.test(fragment.file)
    && APPROVED_DISCLOSURE_KEY.test(fragment.key)
    && !LEGAL_PROMOTIONAL_CONTEXT.test(fragment.text);
}

function riskySentences(text) {
  return text
    .split(/(?<=[.!?])\s+/u)
    .filter((sentence) => SOURCE_PROBE.test(sentence));
}

function isDefensiveLegalText(text) {
  const sentences = riskySentences(text);
  return sentences.length > 0 && sentences.every((sentence) => (
    (LEGAL_DEFENSIVE_CONTEXT.test(sentence) || LEGAL_OPERATIONAL_CONTEXT.test(sentence))
    && !LEGAL_PROMOTIONAL_CONTEXT.test(sentence)
  ));
}

function isLegalDefensiveFragment(fragment) {
  return LEGAL_PATH.test(fragment.file)
    && isDefensiveLegalText(fragment.text);
}

function isWingCatalogFragment(fragment) {
  return /^src\/strings\//u.test(fragment.file)
    && !DISCLOSURE_KEY.test(fragment.key)
    && WING_CATALOG_KEY.test(fragment.key);
}

function isReadOnlyPosture(fragment) {
  return fragment.file === 'public/llms.txt' && fragment.text === READ_ONLY_POSTURE;
}

function isPureRouteOrState(text) {
  return /^[#/][a-z0-9._/?=&%#${}…-]+$/iu.test(text);
}

function isTechnicalState(fragment) {
  if (fragment.text === 'web-crypto-unavailable') return true;
  if (/^(?:api|src\/lib)\//u.test(fragment.file)
    && /^(?:expired|invalid|malformed|missing|revoked) (?:access|auth|csrf|invite|refresh|reset|session|unsubscribe|verification) token$/iu.test(fragment.text)) return true;

  const technicalFiles = /^(?:api\/calendar\/transits\.ts|api\/email\/(?:_confirm|_unsubscribe)\.ts|src\/islands\/(?:CalendarSubscribe|ProfileInvites)\.tsx|src\/lib\/daily-email\/delivery\.ts|src\/lib\/email\/(?:daily-page|daily-resend|daily-unsubscribe-token|provider|server-page)\.ts|src\/lib\/invite\/(?:routes\/invite-exchange|token)\.ts)$/u;
  if (!technicalFiles.test(fragment.file)) return false;

  return /^(?:token|Token \$\{…\}|Invalid positions-only chart token\.|A positions-only chart token is required\.|Daily email reservation owner token is invalid\.|Daily sun confirmation token could not be verified\.|The invitation token generator returned an invalid value\.|<form[\s\S]*\bname="token"[\s\S]*<\/form>)$/u.test(fragment.text);
}

// Owner-approved destination descriptions (2026-10-01). These name the separate
// collection before a visitor opens it; acquisition copy remains prohibited.
function isAstrofolioNavigationDescription(fragment) {
  return fragment.file === 'src/components/SiteNav.astro'
    && new Set([
    'Official Zodiac token collection',
    'Colección oficial de tokens del Zodiaco — en inglés',
    'Coleção oficial de tokens do Zodíaco — em inglês',
    'Collection officielle de jetons du Zodiaque — en anglais',
    'Collezione ufficiale di token zodiacali — in inglese',
    'Официальная коллекция токенов Зодиака — на английском',
  ]).has(fragment.text);
}

function vocabularyAllowed(fragment) {
  return isReadOnlyPosture(fragment)
    || isApprovedDisclosureFragment(fragment)
    || isLegalDefensiveFragment(fragment)
    || isWingCatalogFragment(fragment)
    || isAstrofolioNavigationDescription(fragment)
    || isPureRouteOrState(fragment.text)
    || isTechnicalState(fragment);
}

/**
 * Rendered install blocks that import Node's hashing API to verify an archive
 * digest before extracting it. `node:crypto` is the standard library module, not
 * crypto-market vocabulary, and a developer page that checks a checksum has to
 * name it. Listed pair by pair rather than pattern-matched, and only the
 * complete module specifier is excluded — surrounding code and prose stay in
 * scope, so this cannot quietly cover a real boundary breach on the same page.
 */
const HASHING_IMPORT_BLOCKS = new Set([
  'src/pages/developers/examples/index.astro\u0000setup',
  // A .ts fragment carries no key, so this one is listed by file. It narrows the
  // same way regardless: only the complete `from 'node:crypto'` specifier is
  // excluded, so any other crypto-market vocabulary in the file still fails.
  'src/lib/mcp-install-block.ts\u0000',
  'src/lib/engine-install-block.ts\u0000',
]);

function vocabularyText(fragment) {
  if (HASHING_IMPORT_BLOCKS.has(`${fragment.file}\u0000${fragment.key}`)) {
    return fragment.text.replace(/\bfrom (['"])node:crypto\1/gu, 'from "node:hashing-module"');
  }
  return fragment.text;
}

function externalDestinationAllowed(fragment, destination) {
  return DISCLOSURE_CATALOG_SOURCE.test(fragment.file)
    && DISCLOSURE_OPERATOR_KEY.test(fragment.key)
    && isDefensiveLegalText(fragment.text)
    && destination.toLocaleLowerCase('en-US') === 'astrofolio.xyz';
}

function internalDestinationAllowed(fragment, destination) {
  if (isDisclosureFragment(fragment) || isWingCatalogFragment(fragment)) return true;
  return SANCTIONED_INTERNAL_LINKS.some(([source, route]) => (
    source.test(fragment.file) && route.test(destination)
  ));
}

export function findConsumerBoundaryViolations(source, file) {
  const normalizedFile = toPosix(file);
  const fragments = extractConsumerFragments(source, normalizedFile);
  const violations = [];
  const seen = new Set();

  function add(fragment, rule, match) {
    const key = `${fragment.line}:${rule}:${match.toLocaleLowerCase('en-US')}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({
      file: normalizedFile,
      key: fragment.key,
      line: fragment.line,
      match,
      rule,
      text: fragment.text,
    });
  }

  for (const fragment of fragments) {
    if (!vocabularyAllowed(fragment)) {
      for (const [rule, pattern] of VOCABULARY) {
        const match = vocabularyText(fragment).match(pattern)?.[0];
        if (match) add(fragment, rule, match);
      }
    }

    for (const externalMatch of fragment.text.matchAll(EXTERNAL_WING_DESTINATION)) {
      const external = externalMatch[0];
      if (!externalDestinationAllowed(fragment, external)) {
        add(fragment, 'external wing or acquisition destination', external);
      }
    }

    for (const internalMatch of fragment.text.matchAll(INTERNAL_WING_DESTINATION)) {
      const internal = internalMatch[1];
      if (!internalDestinationAllowed(fragment, internal)) {
        add(fragment, 'unsanctioned wing link', internal);
      }
    }
  }
  return violations;
}

function excludedSource(file) {
  return WING_ONLY_SOURCE.some((pattern) => pattern.test(file))
    || NON_SURFACE_SOURCE.some((pattern) => pattern.test(file));
}

async function filesUnder(root, local) {
  const absolute = resolve(root, local);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = `${local}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await filesUnder(root, child));
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(toPosix(child));
  }
  return files;
}

export async function consumerSurfaceFiles(repoRoot) {
  const files = [...EXACT_SOURCE_FILES];
  for (const root of SOURCE_ROOTS) files.push(...await filesUnder(repoRoot, root));
  return [...new Set(files)]
    .filter((file) => !excludedSource(file))
    .sort();
}

export async function scanConsumerBoundary(repoRoot) {
  const files = await consumerSurfaceFiles(repoRoot);
  const violations = [];
  for (const file of files) {
    const source = await readFile(resolve(repoRoot, file), 'utf8');
    if (!SOURCE_PROBE.test(source)) continue;
    violations.push(...findConsumerBoundaryViolations(source, file));
  }
  return { files, violations };
}

export function formatConsumerBoundaryViolation(violation) {
  const key = violation.key ? ` [${violation.key}]` : '';
  return `${violation.file}:${violation.line}${key}: ${violation.rule}: ${violation.match}`;
}

export function repoRelative(repoRoot, file) {
  return toPosix(relative(repoRoot, file));
}
