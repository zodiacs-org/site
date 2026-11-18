import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EN as TRUST_EN } from '../src/strings/en.mjs';
import {
  BREADCRUMB_LABELS,
  OG_EN,
  SCHEMA_EN,
} from '../src/strings/seo.en.mjs';
import { PWA_MANIFEST_EN, PWA_PUSH_EN } from '../src/strings/pwa.en.mjs';
import { PWA_PROMPT_EN } from '../src/strings/pwa.ts';
import { PUSH_COPY } from '../src/strings/push.ts';
import { PROGRAMMATIC_EN } from '../src/strings/programmatic.ts';
import { SHARE_CARD_EN } from '../src/lib/share-card-copy.ts';
import { GROWTH_UI_EN } from '../src/lib/i18n/ui/growth.ts';
import {
  CHINESE_ZODIAC_ANIMALS,
  CHINESE_ZODIAC_COPY,
} from '../src/data/chinese-zodiac.ts';
import {
  WIDGET_EN,
  WIDGET_PHASE_NAMES_EN,
  WIDGET_PLANET_NAMES_EN,
  WIDGET_SIGN_NAMES_EN,
} from '../src/strings/widgets.ts';
import { WALLET_CHART_EN } from '../src/strings/wallet-chart.ts';
import { ES_ADDITIONS } from '../src/strings/additions.es.mjs';
import { PT_ADDITIONS } from '../src/strings/additions.pt.mjs';
import { FR_ADDITIONS } from '../src/strings/additions.fr.mjs';
import { IT_ADDITIONS } from '../src/strings/additions.it.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'i18n-additions.md');

function readConstObject(relativePath, exportName) {
  const source = readFileSync(resolve(root, relativePath), 'utf8');
  const marker = `export const ${exportName} = `;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${exportName} in ${relativePath}`);
  const objectStart = source.indexOf('{', start + marker.length);
  const end = source.indexOf('} as const;', objectStart);
  if (objectStart < 0 || end < 0) throw new Error(`Cannot read ${exportName} in ${relativePath}`);
  const literal = source.slice(objectStart, end + 1);
  // These are repository-owned, data-only English object literals. Reading
  // them avoids importing TSX (unsupported by plain Node) while keeping this
  // manifest mechanically tied to the component source of truth.
  return Function(`"use strict"; return (${literal});`)();
}

const SHARE_POSITIONS_EN = readConstObject(
  'src/islands/PositionsShareSurface.tsx',
  'SHARE_POSITIONS_EN',
);
const COMPATIBILITY_PREFILL_EN = readConstObject(
  'src/islands/PrefilledPairNotice.tsx',
  'COMPATIBILITY_PREFILL_EN',
);

const ALL_NON_EN_LOCALES = Object.freeze(['ES', 'PT', 'FR', 'IT']);
const POST_ES_LOCALES = Object.freeze(['PT', 'FR', 'IT']);
export const ADDITION_TRANSLATIONS = Object.freeze({
  ES: ES_ADDITIONS,
  PT: PT_ADDITIONS,
  FR: FR_ADDITIONS,
  IT: IT_ADDITIONS,
});

function entriesFromObject(prefix, value) {
  return Object.entries(value).map(([key, english]) => ({
    key: `${prefix}.${key}`,
    english: String(english),
  }));
}

function ogEntries() {
  const entries = [{ key: 'og.fallbackAlt', english: OG_EN.fallbackAlt }];
  entries.push(...entriesFromObject('og.signNames', OG_EN.signNames));
  for (const group of [
    'share', 'signGuide', 'registryLot', 'wing', 'astrofolio', 'terminal', 'thesis', 'disclosure',
    'horoscope', 'rising', 'placements', 'compatibility',
  ]) {
    for (const [key, english] of Object.entries(OG_EN[group])) {
      if (!['path', 'image'].includes(key)) {
        entries.push({ key: `og.${group}.${key}`, english: String(english) });
      }
    }
  }
  entries.push(...entriesFromObject('og.planetNames', OG_EN.planetNames));
  entries.push({ key: 'og.pin.signGuide.kicker', english: OG_EN.pin.signGuide.kicker });
  entries.push(...entriesFromObject('og.pin.horoscope', OG_EN.pin.horoscope));
  entries.push({ key: 'og.pin.howTo.kicker', english: OG_EN.pin.howTo.kicker });
  entries.push({ key: 'og.pin.howTo.title', english: OG_EN.pin.howTo.title });
  entries.push(...entriesFromObject('og.pin.howTo.steps', OG_EN.pin.howTo.steps));
  // Tools whose pages exist only in English have no localized card to translate.
  for (const tool of OG_EN.tools.filter((entry) => !entry.englishOnly)) {
    for (const field of ['kicker', 'title', 'sub']) {
      entries.push({ key: `og.tools.${tool.key}.${field}`, english: tool[field] });
    }
  }
  return entries;
}

function schemaEntries() {
  return [
    ...entriesFromObject('schema', SCHEMA_EN),
    ...entriesFromObject('schema.breadcrumbLabels', BREADCRUMB_LABELS),
  ];
}

function chineseEntries() {
  const entries = entriesFromObject('chineseZodiac', CHINESE_ZODIAC_COPY);
  for (const animal of CHINESE_ZODIAC_ANIMALS) {
    for (const field of ['name', 'association', 'context']) {
      entries.push({
        key: `chineseZodiac.animals.${animal.slug}.${field}`,
        english: String(animal[field]),
      });
    }
  }
  return entries;
}

function widgetEntries() {
  return [
    ...entriesFromObject('widgets', WIDGET_EN),
    ...entriesFromObject('widgets.signNames', WIDGET_SIGN_NAMES_EN),
    ...entriesFromObject('widgets.planetNames', WIDGET_PLANET_NAMES_EN),
    ...entriesFromObject('widgets.phaseNames', WIDGET_PHASE_NAMES_EN),
  ];
}

export function requiredLocalesForKey(key) {
  // These families already have explicit Spanish copy. Positions sharing was
  // translated into all five locale rails by the locale project.
  if (key.startsWith('sharePositions.') || key.startsWith('push.prompt.')) return [];
  if (
    key.startsWith('email') ||
    key.startsWith('shareCard.') ||
    key.startsWith('compatibilityPrefill.') ||
    key.startsWith('pwa.prompt.')
  ) {
    return [...POST_ES_LOCALES];
  }
  return [...ALL_NON_EN_LOCALES];
}

function pendingLocales(key) {
  return requiredLocalesForKey(key).filter((locale) => !Object.prototype.hasOwnProperty.call(
    ADDITION_TRANSLATIONS[locale],
    key,
  ));
}

function locationFor(key) {
  if (key.startsWith('archive.')) return '/archive/ receipt labels, source chips, and evidence states';
  if (key.startsWith('disclosure.')) return '/disclosure/ and its Registry/About/Thesis disclosure links';
  if (key.startsWith('registry.')) return 'Registry verifier, provenance, and Registry-lot metadata';
  if (key.startsWith('footer')) return 'sitewide footer navigation';
  if (key.startsWith('emailCapture')) return 'EmailCapture form on chart results, /horoscopes/, and the astrology footer';
  if (key.startsWith('emailConfirm') || key.startsWith('emailPending') || key.startsWith('emailConfirmed') || key === 'emailReturnHome') return 'double-opt-in email and confirmation-status pages';
  if (key.startsWith('og.')) return 'build-time 1200×630 Open Graph/Twitter artwork and image alt text';
  if (key.startsWith('schema.breadcrumb')) return 'sitewide BreadcrumbList JSON-LD';
  if (key.startsWith('schema.')) return 'homepage/tool JSON-LD emitted in the document head';
  if (key.startsWith('shareCard.')) return 'client-rendered chart/compatibility PNG cards and their share controls';
  if (key.startsWith('sharePositions.')) return 'birth-chart positions-only sharing dialog and receiver';
  if (key.startsWith('compatibilityPrefill.')) return '/compatibility/ prefilled-pair notice';
  if (key.startsWith('pwa.manifest.')) return 'web app manifest shown by the operating system';
  if (key.startsWith('pwa.prompt.')) return 'install prompt shown after the second computed chart';
  if (key.startsWith('push.prompt.')) return 'feature-flagged, default-off daily-note permission UI';
  if (key.startsWith('push.notification.')) return 'feature-flagged, default-off push notification payload';
  if (key.startsWith('programmatic.')) return 'WS5 compatibility-pair page CTA';
  if (key.startsWith('chineseZodiac.animals.')) return 'Chinese-zodiac animal-year guide body copy';
  if (key.startsWith('chineseZodiac.')) return '/learn/chinese-zodiac/ hub and animal-year pages';
  if (key.startsWith('widgets.signNames.')) return 'compact widget sign labels';
  if (key.startsWith('widgets.planetNames.')) return 'compact widget planet labels';
  if (key.startsWith('widgets.phaseNames.')) return 'compact moon-widget phase labels';
  if (key.startsWith('widgets.')) return '/widgets/ generator and standalone iframe/script embed documents';
  if (key.startsWith('walletChart.')) return 'feature-flagged /registry/wallet-chart/ paste-only instrument and share card';
  throw new Error(`Missing i18n usage location for ${key}`);
}

function toneFor(key) {
  if (key.startsWith('archive.') || key.startsWith('disclosure.') || key.startsWith('registry.')) return 'dry, factual, and non-promotional';
  if (key.startsWith('email')) return 'warm, plain, privacy-forward, and never salesy';
  if (key.startsWith('footer')) return 'short, literal navigation label';
  if (key.startsWith('og.')) return 'restrained Cosmic Void editorial voice';
  if (key.startsWith('schema.')) return 'literal and machine-readable; avoid promotional claims';
  if (key.startsWith('shareCard.') || key.startsWith('sharePositions.')) return 'concise, privacy-aware, and non-clinical';
  if (key.startsWith('compatibilityPrefill.')) return 'clear and non-deterministic';
  if (key.startsWith('pwa.') || key.startsWith('push.')) return 'gentle, optional, and privacy-forward';
  if (key.startsWith('programmatic.') || key.startsWith('chineseZodiac.')) return 'educational, specific, and culturally careful';
  if (key.startsWith('widgets.')) return 'compact, direct, and privacy-forward';
  if (key.startsWith('walletChart.')) return 'neutral, symbolic, read-only, and never financial';
  throw new Error(`Missing i18n tone for ${key}`);
}

function maxLengthFor(key) {
  const lower = key.toLowerCase();
  if (lower.includes('metadescription')) return '170 characters';
  if (lower.includes('metatitle')) return '65 characters';
  if (key === 'pwa.manifest.shortName') return '12 characters';
  if (key === 'pwa.manifest.name') return '48 characters';
  if (key === 'pwa.manifest.description') return '120 characters';
  if (key.startsWith('og.')) {
    if (lower.endsWith('.kicker')) return '34 visible characters';
    if (lower.endsWith('.title')) return '60 visible characters across the encoded line breaks';
    if (lower.endsWith('.subtitle') || lower.endsWith('.sub')) return '120 visible characters';
    if (lower.endsWith('.data') || lower.endsWith('.numberline')) return '76 visible characters';
    if (lower.endsWith('alt') || key === 'og.fallbackAlt') return '170 characters';
  }
  if (key === 'emailConfirmSubject') return '78 characters';
  if (key === 'emailCaptureEmailPlaceholder') return '40 characters';
  if (key.startsWith('footer')) return '22 characters';
  if (key.startsWith('email') && /(Action|Submit|Submitting|ReturnHome)$/.test(key)) return '32 characters';
  if (key.startsWith('schema.breadcrumb')) return '42 characters';
  if (key.startsWith('shareCard.')) {
    if (/(Title|Descriptor|Action|Receipt|Contact)/.test(key)) return '58 visible characters';
    return '96 visible characters';
  }
  if (key.startsWith('sharePositions.') && /(Title|close|hide|copy)/i.test(key)) return '48 characters';
  if (key.startsWith('compatibilityPrefill.') && key !== 'compatibilityPrefill.help') return '56 characters';
  if ((key.startsWith('pwa.prompt.') || key.startsWith('push.prompt.')) && /(install|dismiss|accept|off)$/.test(key)) return '36 characters';
  if (key.startsWith('push.notification.')) return key.endsWith('.title') ? '48 characters' : '120 characters';
  if (key.startsWith('widgets.')) {
    if (/(pageMetaTitle|pageMetaDescription)/.test(key)) return null;
    if (/(Intro|Note|Privacy|requiresJavaScript|Error)/.test(key)) return '150 characters';
    return '48 characters';
  }
  if (key.startsWith('walletChart.card')) return '88 visible characters';
  if (key.startsWith('walletChart.') && /(calculate|share|submit|cancel|back)$/i.test(key)) return '42 characters';
  if (key.startsWith('chineseZodiac.meta')) return lower.includes('description') ? '170 characters' : '65 characters';
  return null;
}

function preservationInstructions(english) {
  const instructions = [];
  const placeholders = [...new Set(english.match(/\{[A-Za-z][A-Za-z0-9]*\}/g) ?? [])];
  if (placeholders.length) instructions.push(`Preserve placeholders exactly: ${placeholders.join(', ')}`);
  if (english.includes('<br/>')) instructions.push('Preserve each literal <br/> as an intentional artwork line break');
  if (english.includes('[OPERATOR TO ')) instructions.push('Preserve the bracketed operator-action marker verbatim');
  return instructions;
}

/**
 * A stated maximum shorter than the English it describes is not guidance, it is
 * a contradiction: a translator reading "Maximum: 150 characters" above a
 * four-hundred-character source has to ignore one of the two. An AI review
 * found exactly that on the widget privacy note, after a disclosure it had to
 * carry grew past the cap. The cap exists to keep a translation laid out like
 * the original, so where the original is longer the cap follows it, with the
 * usual expansion headroom, rounded to the next ten.
 */
function atLeastTheEnglish(maxLength, english) {
  if (!maxLength) return maxLength;
  const stated = /^(\d+)( visible)? characters\b/.exec(maxLength);
  if (!stated || english.length <= Number(stated[1])) return maxLength;
  return maxLength.replace(stated[1], String(Math.ceil((english.length * 1.1) / 10) * 10));
}

function usageContext(key, english) {
  const parts = [
    `Location: ${locationFor(key)}`,
    `Tone: ${toneFor(key)}`,
  ];
  const maxLength = atLeastTheEnglish(maxLengthFor(key), english);
  if (maxLength) parts.push(`Maximum: ${maxLength}`);
  parts.push(...preservationInstructions(english));
  return `${parts.join('. ')}.`;
}

function section(title, entries) {
  return {
    title,
    entries: entries
      .map(({ key, english }) => ({
        key,
        english: String(english),
        context: usageContext(key, String(english)),
        pendingLocales: pendingLocales(key),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
}

/** Complete, source-derived translation handoff with English defaults. */
export function i18nAdditionEntries() {
  return [
    section('WS1 — trust, disclosure, and archive receipts', entriesFromObject('', TRUST_EN).map((entry) => ({
      ...entry,
      key: entry.key.slice(1),
    }))),
    section('WS2b — email capture and shared footer', entriesFromObject('', GROWTH_UI_EN).map((entry) => ({
      ...entry,
      key: entry.key.slice(1),
    }))),
    section('WS2c — OG and social-card art', ogEntries()),
    section('WS2d — structured data', schemaEntries()),
    section('WS3 — share cards and result sharing', [
      ...entriesFromObject('shareCard', SHARE_CARD_EN),
      ...entriesFromObject('sharePositions', SHARE_POSITIONS_EN),
      ...entriesFromObject('compatibilityPrefill', COMPATIBILITY_PREFILL_EN),
    ]),
    section('WS4 — PWA, install prompt, and flag-off push scaffold', [
      ...entriesFromObject('pwa.manifest', PWA_MANIFEST_EN),
      ...entriesFromObject('pwa.prompt', PWA_PROMPT_EN),
      ...entriesFromObject('push.prompt', PUSH_COPY.en),
      ...entriesFromObject('push.notification', PWA_PUSH_EN),
    ]),
    section('WS5 — programmatic pages and Chinese zodiac', [
      ...entriesFromObject('programmatic', PROGRAMMATIC_EN),
      ...chineseEntries(),
    ]),
    section('WS6 — widgets', widgetEntries()),
    section('WS8 — wallet natal chart', entriesFromObject('walletChart', WALLET_CHART_EN)),
  ];
}

/** Backwards-compatible key-only view used by existing build checks. */
export function i18nAdditionSections() {
  return i18nAdditionEntries().map(({ title, entries }) => [
    title,
    entries.map(({ key }) => key),
  ]);
}

function inlineCode(value) {
  const text = String(value).replaceAll('\n', '\\n');
  const longestRun = Math.max(0, ...([...text.matchAll(/`+/g)].map(([run]) => run.length)));
  const fence = '`'.repeat(longestRun + 1);
  const padding = /^[ `]|[ `]$/.test(text) ? ' ' : '';
  return `${fence}${padding}${text}${padding}${fence}`;
}

function renderEntry({ key, english, context, pendingLocales: locales }) {
  return [
    `- \`${key}\``,
    `  - EN default: ${inlineCode(english)}`,
    `  - Usage: ${context}`,
    `  - Pending locales: ${locales.length ? locales.join(', ') : 'none — explicit copy exists in EN, ES, PT, FR, and IT'}`,
  ].join('\n');
}

export function renderI18nAdditions() {
  const sections = i18nAdditionEntries();
  const count = sections.reduce((sum, { entries }) => sum + entries.length, 0);
  const body = sections.map(({ title, entries }) => [
    `## ${title}`,
    '',
    ...entries.map(renderEntry),
    '',
  ].join('\n')).join('\n');
  return `# i18n additions\n\n` +
    `TODO(i18n): translation handoff for ${count} additive keys introduced by the Trust, Growth Infrastructure & SDK Expansion build. Every surface renders in all five locale rails; a pending locale currently receives the English fallback shown here.\n\n` +
    `Each entry names its English default, one-line usage brief, and exact pending locales. Keep placeholders such as \`{sign}\` byte-identical, and retain literal \`<br/>\` tags because they encode intentional line breaks in generated artwork. A “none” pending state means the locale project already supplied explicit EN/ES/PT/FR/IT copy.\n\n` +
    `This file is generated by \`scripts/build-i18n-additions.mjs\` from the English source catalogues. Paths, URLs, slugs, schema enum constants, Roman numerals, and brand wordmarks remain literal unless an entry says otherwise.\n\n` +
    body;
}

export async function writeI18nAdditions(path = output) {
  const content = renderI18nAdditions();
  await writeFile(path, content, 'utf8');
  return content;
}

export async function i18nManifestIsCurrent(path = output) {
  return readFile(path, 'utf8').then((value) => value === renderI18nAdditions(), () => false);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const content = await writeI18nAdditions();
  console.log(`i18n additions: ${content.split('\n- `').length - 1} keys written.`);
}
