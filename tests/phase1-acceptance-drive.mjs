import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { phase1TemplateSourceSha256, sha256 } from './visual/phase1-evidence-contract.mjs';
import { withPreview } from './visual/preview-server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactRoot = resolve(root, 'docs/acceptance/phase1/screenshots');
const payloadFiles = {
  daily: 'src/data/daily.json',
  dailyPublication: 'src/data/daily-publication.json',
  dailyPublicationManifest: 'src/data/daily-publication-manifest.json',
  horoscopeProgram: 'src/data/horoscope-program.json',
};
const payloadBytes = Object.fromEntries(await Promise.all(
  Object.entries(payloadFiles).map(async ([name, path]) => [name, await readFile(resolve(root, path))]),
));
const renderPayloadSha256 = Object.fromEntries(
  Object.entries(payloadBytes).map(([name, bytes]) => [name, sha256(bytes)]),
);
const daily = JSON.parse(payloadBytes.daily.toString('utf8'));
const publicationManifest = JSON.parse(payloadBytes.dailyPublicationManifest.toString('utf8'));
const templateSourceSha256 = await phase1TemplateSourceSha256(root);
let buildReceipt;
try {
  buildReceipt = JSON.parse(
    await readFile(resolve(root, 'dist/.phase1-build-receipt.json'), 'utf8'),
  );
} catch {
  throw new Error('Phase 1 acceptance requires a current production build. Run `npm run build` first.');
}
if (buildReceipt.schema !== 'zodiacs.phase1-build-receipt.v1'
  || buildReceipt.templateSourceSha256 !== templateSourceSha256
  || buildReceipt.dailyDate !== daily.date
  || buildReceipt.publicationCanonicalSha256 !== publicationManifest.publication.canonicalSha256
  || Object.entries(renderPayloadSha256).some(([name, digest]) => (
    buildReceipt.renderPayloadSha256?.[name] !== digest
  ))) {
  throw new Error('Phase 1 acceptance found a stale `dist` build. Run `npm run build` before capturing.');
}
const playwrightPackage = JSON.parse(
  await readFile(resolve(root, 'node_modules/playwright-core/package.json'), 'utf8'),
);
const fixedNow = `${daily.date}T12:00:00.000Z`;

const templates = [
  { name: 'today', path: '/today/' },
  { name: 'horoscopes-hub', path: '/horoscopes/' },
  { name: 'daily', path: '/horoscopes/aries/' },
  { name: 'tomorrow', path: '/horoscopes/aries/tomorrow/' },
  { name: 'weekly', path: '/horoscopes/aries/weekly/' },
  { name: 'monthly', path: '/horoscopes/aries/monthly/' },
  { name: 'love', path: '/horoscopes/aries/love/' },
  { name: 'career', path: '/horoscopes/aries/career/' },
  { name: 'yearly', path: '/horoscopes/aries/2027/' },
];

const viewports = [
  { name: '360', width: 360, height: 800 },
  { name: '1280', width: 1280, height: 900 },
];

await mkdir(artifactRoot, { recursive: true });
const executablePath = await findChromium();
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: STABLE_CHROMIUM_ARGS,
});
const browserVersion = await browser.version();

const captures = [];
let failures = 0;

try {
  await withPreview({ port: Number(process.env.PHASE1_ACCEPTANCE_PORT ?? 4331) }, async (baseURL) => {
    for (const template of templates) {
      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
          colorScheme: 'dark',
          locale: 'en-US',
          timezoneId: 'UTC',
          reducedMotion: 'no-preference',
        });
        const page = await context.newPage();
        page.setDefaultTimeout(20_000);
        page.setDefaultNavigationTimeout(30_000);
        const errors = [];
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(`console: ${message.text()}`);
        });
        page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
        await page.addInitScript(({ isoNow, inviteSessionKey }) => {
          const NativeDate = Date;
          const fixed = new NativeDate(isoNow).valueOf();
          class FixedDate extends NativeDate {
            constructor(...args) {
              super(...(args.length ? args : [fixed]));
            }
            static now() { return fixed; }
          }
          Object.setPrototypeOf(FixedDate, NativeDate);
          globalThis.Date = FixedDate;
        }, { isoNow: fixedNow });

        console.log(`CAPTURE ${template.name} @ ${viewport.width}: ${template.path}`);
        const response = await page.goto(`${baseURL}${template.path}`, { waitUntil: 'load' });
        await page.evaluate(() => Promise.race([
          document.fonts.ready,
          new Promise((resolveReady) => setTimeout(resolveReady, 10_000)),
        ]));
        // `font-display: optional` is a production performance contract, but
        // it deliberately permits either the metric-matched fallback or the
        // downloaded face on a cold load. Loading an optional face after its
        // no-swap window expires does not make the browser select it. Create
        // fresh evidence-only aliases, fully load them, and only then assign
        // them in the screenshot stylesheet below.
        const evidenceFonts = await page.evaluate(async () => {
          const definitions = [
            {
              family: 'ZDX Evidence Instrument Sans',
              source: 'url("/fonts/instrument-sans-latin-wght-normal.woff2") format("woff2-variations")',
              descriptors: { weight: '400 700', style: 'normal' },
            },
            {
              family: 'ZDX Evidence Instrument Sans',
              source: 'url("/fonts/instrument-sans-latin-wght-italic.woff2") format("woff2-variations")',
              descriptors: { weight: '400 700', style: 'italic' },
            },
            {
              family: 'ZDX Evidence EB Garamond',
              source: 'url("/fonts/eb-garamond-latin-400-normal.woff2") format("woff2")',
              descriptors: { weight: '400', style: 'normal' },
            },
            {
              family: 'ZDX Evidence EB Garamond',
              source: 'url("/fonts/eb-garamond-latin-500-normal.woff2") format("woff2")',
              descriptors: { weight: '500', style: 'normal' },
            },
            {
              family: 'ZDX Evidence EB Garamond',
              source: 'url("/fonts/eb-garamond-latin-400-italic.woff2") format("woff2")',
              descriptors: { weight: '400', style: 'italic' },
            },
            {
              family: 'ZDX Evidence JetBrains Mono',
              source: 'url("/fonts/jetbrains-mono-latin-wght-normal.woff2") format("woff2-variations")',
              descriptors: { weight: '300 600', style: 'normal' },
            },
          ];
          return Promise.all(definitions.map(async ({ family, source, descriptors }) => {
            try {
              const face = await new FontFace(family, source, descriptors).load();
              document.fonts.add(face);
              return { family, weight: descriptors.weight, style: descriptors.style, loaded: true };
            } catch (error) {
              return {
                family,
                weight: descriptors.weight,
                style: descriptors.style,
                loaded: false,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          }));
        });
        const missingEvidenceFonts = evidenceFonts.filter(({ loaded }) => !loaded);
        if (missingEvidenceFonts.length > 0) {
          errors.push(`evidence fonts failed to load: ${missingEvidenceFonts.map(({ family, weight, style, error }) => `${family} ${style} ${weight}${error ? ` (${error})` : ''}`).join(', ')}`);
        }
        // Guide deliberately mounts 500 ms after `load` so its resources stay
        // outside LCP. Evidence still requires the settled launcher, so wait
        // for that explicit product boundary instead of racing the timer.
        await page.locator('.zguide-launcher').waitFor({ state: 'visible', timeout: 5_000 });
        // Durable evidence represents a settled page, not a random frame of
        // an infinite ornament or an IntersectionObserver transition. Motion
        // cadence has its own Phase 1 gate; make this pixel receipt repeatable.
        await page.addStyleTag({ content: `
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
          }
          /* Shared chrome and the footer use evidence-only aliases that were
             loaded before this assignment. Routes that explicitly choose
             local typography (Today and the hub) retain their production
             content families; other Phase 1 readers use the same font files
             through the evidence aliases for deterministic rasterization. */
          :root {
            --font-nav-serif: 'ZDX Evidence EB Garamond', Georgia, serif;
            --font-nav-sans: 'ZDX Evidence Instrument Sans', system-ui, -apple-system, sans-serif;
            --font-nav-mono: 'ZDX Evidence JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
          }
          :root[data-stable-typography]:not([data-local-typography]) {
            --font-serif: 'ZDX Evidence EB Garamond', Georgia, serif;
            --font-sans: 'ZDX Evidence Instrument Sans', system-ui, -apple-system, sans-serif;
            --font-mono: 'ZDX Evidence JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
          }
          .zfooter {
            --zf-serif: 'ZDX Evidence EB Garamond', Georgia, serif;
            --zf-sans: 'ZDX Evidence Instrument Sans', system-ui, sans-serif;
            --zf-mono: 'ZDX Evidence JetBrains Mono', ui-monospace, monospace;
          }
          /* Chromium can rerasterize fixed translucent layers on different
             compositor tiles during a very tall full-page screenshot. Pin
             their equivalent first-viewport positions into document space;
             fixed-position behavior is covered by interaction tests, while
             this receipt records stable page composition. */
          .orbs, .dust {
            position: absolute !important;
            inset: 0 0 auto !important;
            height: 100vh !important;
          }
          .nav-wrap { position: absolute !important; }
          .nav, .zguide-launcher {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
          .zguide-launcher {
            position: absolute !important;
            top: calc(100vh - 66px) !important;
            bottom: auto !important;
            opacity: 1 !important;
            transform: none !important;
          }
          @media (max-width: 560px) {
            .zguide-launcher { top: calc(100vh - 60px) !important; }
          }
          /* Production skips the far-offscreen footer until a real user
             approaches it. Full-page screenshots rasterize from the top and
             can otherwise record only its intrinsic placeholder even after
             the driver has scrolled through it. Evidence must show the
             settled footer, so disable only that paint optimization here. */
          .zfooter { content-visibility: visible !important; }
        ` });
        await page.evaluate(() => {
          document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-in'));
          document.querySelectorAll('[data-reading-reveal]')
            .forEach((element) => element.setAttribute('data-visible', 'true'));
          // Shared entrance motion (docs/MOTION.md) hides [data-enter] blocks
          // until they scroll into view. Evidence must show the settled page,
          // so mark every entrance as arrived and finished before capture.
          document.querySelectorAll('[data-enter]')
            .forEach((element) => element.classList.add('is-in', 'is-done'));
        });
        const missingZodiacIcons = await page.evaluate(async () => {
          const waitForPaint = () => new Promise((resolvePaint) => requestAnimationFrame(() => resolvePaint()));
          for (const image of document.images) image.loading = 'eager';
          const step = Math.max(480, Math.floor(window.innerHeight * 0.8));
          for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await waitForPaint();
          }
          window.scrollTo(0, 0);
          await waitForPaint();
          await Promise.race([
            Promise.all([...document.images].map((image) => image.decode?.().catch(() => undefined))),
            new Promise((resolveImages) => setTimeout(resolveImages, 10_000)),
          ]);
          // The initial font-ready promise covers the first viewport. Scrolling
          // can request a below-fold face for the first time; wait again so a
          // fallback glyph cannot change wrapping or rasterization mid-shot.
          await Promise.race([
            document.fonts.ready,
            new Promise((resolveFonts) => setTimeout(resolveFonts, 10_000)),
          ]);
          document.querySelector('.zguide-launcher')
            ?.removeAttribute('data-footer-guide-visible');
          await waitForPaint();
          await waitForPaint();
          return [...document.images]
            .filter((image) => (image.currentSrc || image.src).includes('/assets/zodiac-icons/'))
            .filter((image) => !image.complete || image.naturalWidth === 0)
            .map((image) => image.currentSrc || image.src);
        });
        if (missingZodiacIcons.length > 0) {
          errors.push(`zodiac icons failed to load: ${missingZodiacIcons.join(', ')}`);
        }

        const layout = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          contentLength: document.body.innerText.trim().length,
          overlay: Boolean(document.querySelector('.vite-error-overlay, #webpack-dev-server-client-overlay')),
          guideLauncher: Boolean(document.querySelector('.zguide-launcher')),
        }));
        const filename = `${template.name}-${viewport.name}.png`;
        const image = await page.screenshot({ fullPage: true, animations: 'disabled' });
        const png = PNG.sync.read(image);
        await writeFile(resolve(artifactRoot, filename), image);

        const capture = {
          template: template.name,
          path: template.path,
          viewport: { width: viewport.width, height: viewport.height },
          screenshot: {
            file: filename,
            width: png.width,
            height: png.height,
            sha256: sha256(image),
          },
          layout,
          errors,
          status: response?.status() ?? null,
        };
        captures.push(capture);

        const failureReasons = [
          ...(!response?.ok() ? [`HTTP ${response?.status() ?? 'unknown'}`] : []),
          ...(layout.contentLength < 100 ? ['meaningful content missing'] : []),
          ...(layout.overlay ? ['error overlay present'] : []),
          ...(!layout.guideLauncher ? ['Guide launcher missing'] : []),
          ...(layout.clientWidth !== viewport.width ? [`layout width ${layout.clientWidth} != ${viewport.width}`] : []),
          ...(layout.scrollWidth > layout.clientWidth ? [`horizontal overflow ${layout.scrollWidth} > ${layout.clientWidth}`] : []),
          ...(png.width !== viewport.width ? [`screenshot width ${png.width} != ${viewport.width}`] : []),
          ...(png.height !== layout.scrollHeight ? [`screenshot height ${png.height} != ${layout.scrollHeight}`] : []),
          ...errors,
        ];
        if (failureReasons.length > 0) {
          failures += 1;
          console.error(`FAIL ${template.name} @ ${viewport.width}: ${failureReasons.join('; ')}`);
        } else {
          console.log(`PASS ${template.name} @ ${viewport.width}: ${png.width}×${png.height}`);
        }
        await context.close();
      }
    }
  });
} finally {
  await browser.close();
}

const manifest = {
  schema: 'zodiacs.phase1-visual-acceptance.v4',
  driver: {
    name: 'playwright-core',
    version: playwrightPackage.version,
    script: 'tests/phase1-acceptance-drive.mjs',
    contractVersion: 4,
  },
  capturedAt: new Date().toISOString(),
  browser: `Chromium ${browserVersion}`,
  dailyDate: daily.date,
  publicationCanonicalSha256: publicationManifest.publication.canonicalSha256,
  templateSourceSha256,
  renderPayloadSha256,
  buildReceipt,
  captures,
};
await writeFile(resolve(artifactRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

if (failures > 0) {
  throw new Error(`Phase 1 visual acceptance failed in ${failures}/${captures.length} captures.`);
}
console.log(`Phase 1 visual acceptance: PASS — ${captures.length}/${captures.length} exact-width captures`);
