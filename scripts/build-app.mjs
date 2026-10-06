import { initProfileNavigation } from '../src/lib/profile/navigation-avatar.mjs';
// Build step for the Zodiacs.org main page.
//
// Transforms the JSX source (src/app.jsx) into a plain browser script
// (assets/app.js) using Babel's React preset — the same transform the page
// used to run in the browser via @babel/standalone, now done ahead of time so
// visitors never download or run a compiler.
//
//   node scripts/build-app.mjs
//
// Uses a local @babel/standalone install if one is present; otherwise fetches
// the pinned Babel build from unpkg (the same CDN the site already trusted).
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  REGISTRY_ESTABLISHED,
  REGISTRY_ESTABLISHMENT_PROVENANCE_URL,
} from '../src/lib/registry-establishment.mjs';
import {
  REGISTRY_AURA_ENTRY_COPY,
  REGISTRY_AURA_META_NAME,
  REGISTRY_AURA_PATH,
  injectRegistryAuraLanding,
  injectRegistryAuraThesis,
} from '../src/lib/registry-aura-entry.mjs';
import { REGISTRY_TRADE_META } from '../src/trade/entry.mjs';
import {
  REGISTRY_EXCHANGE_LANDING_COPY,
  REGISTRY_EXCHANGE_META,
  REGISTRY_EXCHANGE_PATH,
  injectRegistryExchangeLanding,
} from '../src/exchange/entry.mjs';
import { EN } from '../src/strings/en.mjs';
import { buildRegistryOutlookArtifact } from './registry-outlook-artifact.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const SRC = resolve(root, 'src/app.jsx');
const OUT = resolve(root, 'public/assets/app.js');
const TERMINAL_SPLIT_CSS = resolve(root, 'src/terminal/split-styles.css');
const ASTROFOLIO_HTML = resolve(root, 'public/astrofolio/index.html');
const TERMINAL_HTML = resolve(root, 'public/terminal/index.html');
const THESIS_HTML = resolve(root, 'public/thesis/index.html');
const REGISTRY_DATA = resolve(root, 'public/registry/zodiacs.registry.json');
const REGISTRY_TECHNICAL_HTML = resolve(root, 'public/registry/technical/index.html');
const REGISTRY_OUTLOOK = resolve(root, 'public/assets/registry-outlook.json');
const VENDOR_DIR = resolve(root, 'public/assets/vendor');
const REACT_RUNTIME_SOURCE = resolve(root, 'node_modules/react/umd/react.production.min.js');
const REACT_DOM_RUNTIME_SOURCE = resolve(root, 'node_modules/react-dom/umd/react-dom.production.min.js');
const REACT_RUNTIME = resolve(VENDOR_DIR, 'react-18.3.1.production.min.js');
const REACT_DOM_RUNTIME = resolve(VENDOR_DIR, 'react-dom-18.3.1.production.min.js');

const BABEL_VERSION = '7.26.4';
const BABEL_URL = `https://unpkg.com/@babel/standalone@${BABEL_VERSION}/babel.min.js`;

async function getBabel() {
  try {
    const mod = await import('@babel/standalone');
    return mod.default ?? mod;
  } catch {
    const res = await fetch(BABEL_URL);
    if (!res.ok) throw new Error(`Failed to fetch Babel (${res.status}) from ${BABEL_URL}`);
    const code = await res.text();
    const module = { exports: {} };
    new Function('module', 'exports', code)(module, module.exports);
    return module.exports;
  }
}

const Babel = await getBabel();
const source = await readFile(SRC, 'utf8');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function replaceGeneratedRegion(sourceHtml, name, content) {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const startIndex = sourceHtml.indexOf(start);
  const endIndex = sourceHtml.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Missing or malformed generated region: ${name}`);
  }

  return [
    sourceHtml.slice(0, startIndex + start.length),
    content ? `\n${content.trim()}\n` : '\n',
    sourceHtml.slice(endIndex),
  ].join('');
}

function extractRegistryStyles(registryHtml) {
  const styles = (registryHtml.match(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/giu) ?? [])
    .filter((style) => !style.includes('data-terminal-split-styles'));
  if (styles.length === 0) throw new Error('Registry HTML contains no shared style blocks');
  return styles.join('\n\n');
}

function stampTerminalSplitStyles(sourceHtml, splitCss) {
  const marker = /<style data-terminal-split-styles>[\s\S]*?<\/style>/iu;
  if (!marker.test(sourceHtml)) {
    throw new Error('Terminal page is missing the generated split-style marker');
  }
  const splitStyle = `<style data-terminal-split-styles>${splitCss}</style>`;
  const withoutStaleSplit = sourceHtml.replace(/\s*<style data-terminal-split-styles>[\s\S]*?<\/style>/iu, '');
  const analyticsStart = '<!-- zodiacs-analytics:start -->';
  const insertionPoint = withoutStaleSplit.includes(analyticsStart) ? analyticsStart : '</head>';
  return withoutStaleSplit.replace(insertionPoint, `\n${splitStyle}\n${insertionPoint}`);
}

function synchronizeTerminalStyles(sourceHtml, targetHtml) {
  const sourceStyles = sourceHtml.match(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/giu) ?? [];
  const splitStyle = sourceStyles.find((style) => style.includes('data-terminal-split-styles'));
  const sharedStyles = sourceStyles.filter((style) => style !== splitStyle);
  const cleanTarget = targetHtml.replace(/\s*<style data-terminal-split-styles>[\s\S]*?<\/style>/iu, '');
  const targetMatches = [...cleanTarget.matchAll(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/giu)];
  if (!splitStyle || sharedStyles.length === 0 || targetMatches.length < sharedStyles.length) {
    throw new Error('Terminal market desk is missing the shared wing style blocks');
  }
  let output = cleanTarget;
  for (let index = sharedStyles.length - 1; index >= 0; index -= 1) {
    const match = targetMatches[index];
    output = output.slice(0, match.index) + sharedStyles[index] + output.slice(match.index + match[0].length);
  }
  // Keep the generated Terminal styles ahead of the analytics bridge. The
  // analytics configurator always owns the final block before </head>; using
  // the same boundary here makes both generators byte-idempotent regardless
  // of which one runs first in a release check.
  const analyticsStart = '<!-- zodiacs-analytics:start -->';
  const insertionPoint = output.includes(analyticsStart) ? analyticsStart : '</head>';
  return output.replace(insertionPoint, `\n${splitStyle}\n${insertionPoint}`);
}

function renderTechnicalRecords(registry) {
  const assets = Array.isArray(registry?.assets) ? registry.assets : [];
  const officialRepresentations = (asset) => (
    (asset.representations ?? []).filter((representation) => representation.isOfficialRepresentation === true)
  );
  const representations = assets.flatMap(officialRepresentations);
  if (assets.length !== 12 || representations.length !== 24) {
    throw new Error(
      `Technical Registry requires 12 signs and 24 representations; found ${assets.length} and ${representations.length}`,
    );
  }

  return assets.map((asset) => {
    const assetRepresentations = officialRepresentations(asset);
    const chains = new Set(assetRepresentations.map((representation) => representation.chain));
    if (assetRepresentations.length !== 2 || !chains.has('solana') || !chains.has('base')) {
      throw new Error(`${asset.displayName ?? asset.sign} must have official Solana and Base representations`);
    }
    const sign = escapeHtml(asset.sign);
    const displayName = escapeHtml(asset.displayName);
    const rows = assetRepresentations.map((representation) => {
      const chain = escapeHtml(representation.chain);
      const standard = escapeHtml(representation.tokenStandard);
      const address = escapeHtml(representation.address);
      const role = representation.isCanonicalOrigin ? 'Canonical origin' : 'Official representation';
      return `
            <div class="technical-static__record" data-technical-representation data-chain="${chain}">
              <dt><span>${chain}</span><small>${escapeHtml(role)} · ${standard}</small></dt>
              <dd><code>${address}</code></dd>
            </div>`;
    }).join('');

    return `
        <article class="technical-static__sign" data-technical-sign="${sign}">
          <h3><a href="/registry/${sign}/">${displayName}</a></h3>
          <dl>${rows}
          </dl>
        </article>`;
  }).join('\n');
}

const { code } = Babel.transform(source, {
  presets: ['react'],
  compact: true,
  comments: false,
});

const sourceSha256 = createHash('sha256').update(source).digest('hex');
const banner = `/* Generated from src/app.jsx by scripts/build-app.mjs — source-sha256:${sourceSha256} — do not edit directly. */\n`;
const registryMeta = [
  `const initProfileNavigation=${initProfileNavigation.toString()};`,
  `const REGISTRY_ESTABLISHED=${JSON.stringify(REGISTRY_ESTABLISHED)};`,
  `const REGISTRY_ESTABLISHMENT_PROVENANCE_URL=${JSON.stringify(REGISTRY_ESTABLISHMENT_PROVENANCE_URL)};`,
  `const REGISTRY_DISCLOSURE_LABEL=${JSON.stringify(EN['disclosure.linkLabel'])};`,
  `const REGISTRY_PROVENANCE_PENDING_LABEL=${JSON.stringify(EN['disclosure.provenancePendingShort'])};`,
  `const REGISTRY_VERIFIER_NOT_FOUND_SENTENCE=${JSON.stringify(EN['registry.verifierNotFoundSentence'])};`,
  `const REGISTRY_VERIFIER_NOT_FOUND_INLINE=${JSON.stringify(EN['registry.verifierNotFoundInline'])};`,
  `const REGISTRY_ESTABLISHMENT_PROVENANCE_LABEL=${JSON.stringify(EN['registry.establishmentProvenanceLink'])};`,
  `const REGISTRY_AURA_ENABLED=document.querySelector('meta[name="${REGISTRY_AURA_META_NAME}"]')?.content==='1';`,
  `const REGISTRY_AURA_PATH=${JSON.stringify(REGISTRY_AURA_PATH)};`,
  `const REGISTRY_AURA_ENTRY_COPY=Object.freeze(${JSON.stringify(REGISTRY_AURA_ENTRY_COPY)});`,
  `const REGISTRY_TRADE_ENABLED=document.querySelector('meta[name="${REGISTRY_TRADE_META}"]')?.content==='1';`,
  `const REGISTRY_EXCHANGE_ENABLED=document.querySelector('meta[name="${REGISTRY_EXCHANGE_META}"]')?.content==='1';`,
  `const REGISTRY_EXCHANGE_PATH=${JSON.stringify(REGISTRY_EXCHANGE_PATH)};`,
  `const REGISTRY_EXCHANGE_LANDING_COPY=Object.freeze(${JSON.stringify(REGISTRY_EXCHANGE_LANDING_COPY)});`,
].join('');
const output = banner + registryMeta + code + '\n';
const [terminalSplitCss, astrofolioHtml, terminalHtml, thesisHtml, registryOutlook] = await Promise.all([
  readFile(TERMINAL_SPLIT_CSS, 'utf8'),
  readFile(ASTROFOLIO_HTML, 'utf8'),
  readFile(TERMINAL_HTML, 'utf8'),
  readFile(THESIS_HTML, 'utf8'),
  buildRegistryOutlookArtifact(root),
]);
// Consumer keeps its collection control. Since the 2026-08-31 owner addendum
// the market gateway also carries a flag-gated venue-route entry, so the
// exchange marker is stamped here exactly like the Terminal landing:
// committed 0, production builds may stamp 1, one flag rolls both back.
const styledAstrofolio = stampTerminalSplitStyles(astrofolioHtml, terminalSplitCss);
const configuredAstrofolio = injectRegistryExchangeLanding(
  injectRegistryAuraLanding(styledAstrofolio, process.env).output,
  process.env,
).output;
const configuredTerminal = synchronizeTerminalStyles(
  configuredAstrofolio,
  injectRegistryExchangeLanding(terminalHtml, process.env).output,
);
const configuredThesis = injectRegistryAuraThesis(thesisHtml, process.env).output.replace(
  /(<p class="zfooter__copyright">© )\d{4}( Zodiacs\.org<\/p>)/u,
  `$1${new Date().getUTCFullYear()}$2`,
);

await mkdir(VENDOR_DIR, { recursive: true });
await Promise.all([
  writeFile(OUT, output, 'utf8'),
  copyFile(REACT_RUNTIME_SOURCE, REACT_RUNTIME),
  copyFile(REACT_DOM_RUNTIME_SOURCE, REACT_DOM_RUNTIME),
  writeFile(REGISTRY_OUTLOOK, `${JSON.stringify(registryOutlook, null, 2)}\n`, 'utf8'),
  configuredAstrofolio !== astrofolioHtml ? writeFile(ASTROFOLIO_HTML, configuredAstrofolio, 'utf8') : null,
  configuredTerminal !== terminalHtml ? writeFile(TERMINAL_HTML, configuredTerminal, 'utf8') : null,
  configuredThesis !== thesisHtml ? writeFile(THESIS_HTML, configuredThesis, 'utf8') : null,
]);

const registryData = JSON.parse(await readFile(REGISTRY_DATA, 'utf8'));
const technicalHtml = await readFile(REGISTRY_TECHNICAL_HTML, 'utf8');
const technicalWithStyles = replaceGeneratedRegion(
  technicalHtml,
  'registry-shared-styles',
  extractRegistryStyles(configuredAstrofolio),
);
const configuredTechnical = replaceGeneratedRegion(
  technicalWithStyles,
  'registry-technical-records',
  renderTechnicalRecords(registryData),
);
if (configuredTechnical !== technicalHtml) {
  await writeFile(REGISTRY_TECHNICAL_HTML, configuredTechnical, 'utf8');
}

const hash = createHash('sha256').update(output).digest('hex').slice(0, 12);
console.log(`Wrote ${OUT}`);
console.log(`  ${output.length} bytes  ·  sha256:${hash}  ·  from src/app.jsx (${source.length} bytes)`);
console.log('Self-hosted React 18.3.1 runtime copied to public/assets/vendor.');
console.log(`Wrote ${REGISTRY_TECHNICAL_HTML}`);
console.log('  shared Registry styles · 12 signs · 24 official representations');
console.log(`Wrote ${REGISTRY_OUTLOOK}`);
console.log(`  daily + weekly symbolic outlook · edition ${registryOutlook.daily.date}`);
