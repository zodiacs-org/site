import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGISTRY_ESTABLISHED } from '../src/lib/registry-establishment.mjs';
import { renderStaticFooter } from './site-footer.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

async function requireMarkers(relativePath, markers) {
  const source = await readFile(resolve(repoRoot, relativePath), 'utf8').catch(() => null);
  if (source === null) {
    failures.push(`${relativePath}: missing`);
    return;
  }
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`${relativePath}: missing ${JSON.stringify(marker)}`);
  }
}

async function rejectMarkers(relativePath, markers) {
  const source = await readFile(resolve(repoRoot, relativePath), 'utf8').catch(() => null);
  if (source === null) return;
  for (const marker of markers) {
    if (source.includes(marker)) failures.push(`${relativePath}: forbidden ${JSON.stringify(marker)}`);
  }
}

async function requireExact(relativePath, expected, label) {
  const source = await readFile(resolve(repoRoot, relativePath), 'utf8').catch(() => null);
  if (source === null) {
    failures.push(`${relativePath}: missing`);
  } else if (!source.includes(expected)) {
    failures.push(`${relativePath}: stale ${label}`);
  }
}

async function requireCount(relativePath, marker, expected) {
  const source = await readFile(resolve(repoRoot, relativePath), 'utf8').catch(() => null);
  if (source === null) return;
  const actual = source.split(marker).length - 1;
  if (actual !== expected) failures.push(`${relativePath}: expected ${expected} × ${JSON.stringify(marker)}, found ${actual}`);
}

async function requireFooterAfterMain(relativePath) {
  const source = await readFile(resolve(repoRoot, relativePath), 'utf8').catch(() => null);
  if (source === null) return;
  const mainClose = source.lastIndexOf('</main>');
  const footer = source.lastIndexOf('<footer class="zfooter');
  if (mainClose === -1 || footer === -1 || footer < mainClose) {
    failures.push(`${relativePath}: canonical footer must follow </main>`);
  }
}

async function nestedHtmlFiles(relativeDirectory) {
  const entries = await readdir(resolve(repoRoot, relativeDirectory), { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) return nestedHtmlFiles(relativePath);
    return entry.isFile() && entry.name.endsWith('.html') ? [relativePath] : [];
  }));
  return nested.flat();
}

await requireMarkers('src/layouts/Base.astro', [
  "import SiteFooter from '../components/SiteFooter.astro';",
  '<SiteFooter',
  "stylesheet.href = '/assets/site-footer.css?v=20261003';",
  'if (nearViewport) appendStylesheet();',
  "window.addEventListener('load', appendAfterLoad, { once: true });",
  "<noscript><style>@import url('/assets/site-footer.css?v=20261003');</style></noscript>",
]);
await rejectMarkers('src/layouts/Base.astro', [
  "import '../styles/site-footer.css';",
]);
await requireMarkers('src/styles/base.css', [
  'content-visibility: auto;',
  'contain-intrinsic-size: auto 900px;',
]);
await requireMarkers('src/components/SiteFooter.astro', [
  '<footer class="zfooter">',
  'class="zfooter__language"',
  'class="zfooter__colophon"',
  'data-footer-guide',
  '.webp?surface=site-footer',
  '<nav class="zfooter__group zfooter__group--wide" aria-label={t(locale, \'footerRegistry\')}>',
  '<span class="zfooter__label">{t(locale, \'footerRegistry\')}</span>',
  '<a href="/astrofolio/" hreflang={englishHreflang} title={englishOnlyAria}>{t(locale, \'navCollect\')}{englishSuffix}</a>',
]);
await requireMarkers('src/app.jsx', [
  'function SiteEnd(',
  'className="zfooter zfooter--static"',
  'className="zfooter__language"',
  'className="zfooter__colophon"',
  '.webp?surface=site-footer',
]);
const appSource = await readFile(resolve(repoRoot, 'src/app.jsx'), 'utf8');
const appSourceSha256 = createHash('sha256').update(appSource).digest('hex');
await requireMarkers('public/assets/app.js', [
  `source-sha256:${appSourceSha256}`,
  'className:"zfooter zfooter--static"',
  '.webp?surface=site-footer',
]);
await requireMarkers('scripts/site-footer.mjs', [
  'export function renderStaticFooter(',
  '.webp?surface=site-footer',
]);

for (const generator of [
  'scripts/build-archive.mjs',
  'scripts/build-registry-hub.mjs',
  'scripts/build-sign-pages.mjs',
]) {
  await requireMarkers(generator, [
    "from './site-footer.mjs';",
    'SITE_FOOTER_STYLESHEET',
    'renderStaticFooter(',
  ]);
}

for (const fullPage of [
  'public/archive/index.html',
  'public/registry/index.html',
  'public/thesis/index.html',
  ...[
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
  ].map((sign) => `public/registry/${sign}/index.html`),
]) {
  await requireMarkers(fullPage, [
    '<link rel="stylesheet" href="/assets/site-footer.css?v=20261003" />',
    'class="zfooter zfooter--static"',
    'class="zfooter__language"',
    'class="zfooter__colophon"',
  ]);
  await requireFooterAfterMain(fullPage);
}

await requireExact('public/archive/index.html', renderStaticFooter({
  tagline: 'The dated public record of the Twelve.',
  established: 'MMXXIV',
}), 'generated footer');
await requireExact('public/registry/index.html', renderStaticFooter({
  tagline: 'The official public Registry of the Twelve.',
  established: REGISTRY_ESTABLISHED,
}), 'generated footer');
for (const [slug, name] of [
  ['aries', 'Aries'], ['taurus', 'Taurus'], ['gemini', 'Gemini'],
  ['cancer', 'Cancer'], ['leo', 'Leo'], ['virgo', 'Virgo'],
  ['libra', 'Libra'], ['scorpio', 'Scorpio'], ['sagittarius', 'Sagittarius'],
  ['capricorn', 'Capricorn'], ['aquarius', 'Aquarius'], ['pisces', 'Pisces'],
]) {
  await requireExact(`public/registry/${slug}/index.html`, renderStaticFooter({
    tagline: `${name} is one of the Twelve in the official Zodiacs Registry.`,
  }), 'generated footer');
}
await requireMarkers('public/thesis/index.html', [
  '<a href="/thesis/" aria-current="page">Thesis</a>',
  'aria-labelledby="thesis-footer-language-label"',
]);
await requireCount('public/thesis/index.html', '<span class="zfooter__visually-hidden">', 12);

for (const compactPage of [
  'public/astrofolio/index.html',
  'public/registry/technical/index.html',
  'public/sdk/index.html',
  'public/sdk/examples/simastry-aura/index.html',
  'public/terminal/index.html',
  'public/terminal/markets/index.html',
]) {
  await requireMarkers(compactPage, [
    '<link rel="stylesheet" href="/assets/site-footer.css?v=20261003" />',
    'class="zfooter zfooter--compact"',
  ]);
  await requireFooterAfterMain(compactPage);
}

for (const permanentCompactPage of [
  'public/sdk/index.html',
  'public/sdk/examples/simastry-aura/index.html',
  'public/terminal/markets/index.html',
]) {
  await requireMarkers(permanentCompactPage, ['data-footer-guide']);
}

const engineDocumentationPages = [
  ...await nestedHtmlFiles('public/sdk/engine'),
  ...await nestedHtmlFiles('public/developers/engine/reference'),
];
if (engineDocumentationPages.length === 0) failures.push('public/sdk/engine: no TypeDoc pages found');
for (const enginePage of engineDocumentationPages) {
  await requireMarkers(enginePage, [
    '<footer><nav class="engine-sign-rail"',
    'class="engine-docs-posture"',
  ]);
}
await requireMarkers('public/sdk/engine/assets/custom.css', [
  '.engine-sign-rail',
  'background: #0a0c11;',
]);

if (failures.length) {
  console.error(`site-footer-standard: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log('site-footer-standard: canonical footer sources and surfaces verified');
}
