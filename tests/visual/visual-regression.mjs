import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './browser.mjs';
import { withPreview } from './preview-server.mjs';

const visualRoot = dirname(fileURLToPath(import.meta.url));
// Even with the same pinned Chromium, CoreText and FreeType produce different
// glyph metrics and rasterization. Keep each supported platform strict against
// its own committed pixels instead of weakening the 0.1% gate.
const baselineRoot = resolve(visualRoot, 'baselines', process.platform);
const artifactRoot = resolve(visualRoot, 'artifacts/visual');
const update = process.argv.includes('--update') || process.env.UPDATE_VISUAL_BASELINES === '1';

// `threshold` is pixelmatch's perceptual color tolerance. The separate
// maxDiffRatio is the actual regression budget: at most 0.1% of pixels.
const pixelmatchThreshold = 0.1;
const maxDiffRatio = 0.001;
const fixedNow = '2026-07-10T12:00:00.000Z';
// Daily JSON is intentionally refreshed independently of layout changes. The
// ticker's values, glyph types, and hues all come from that receipt, so mask
// the live row plus the Today-by-sign date stamp. The surrounding bands,
// headings, sign controls, and CSS-driven reflow remain under comparison.
//
// The ticker's TEXT is additionally replaced with a fixed line before capture.
// Masking alone cannot protect it: the dimension check runs before any mask
// applies, so on days the refreshed receipt is long enough to wrap the row,
// the page grows and every home case fails on height (2026-07-28 was such a
// day). A canonical line keeps page height independent of the day's data
// while still failing the suite if a style change rewraps that same line.
const canonicalSkyTicker =
  'jul 10 · ☉ Sun 15°00′ Leo · ☽ Moon in Aries · ☿ Mercury direct · '
  + '♄ Saturn retrograde · ♆ Neptune retrograde · ♇ Pluto retrograde · '
  + '○ New moon — Aug 12';
const liveDailySelectors = [
  '.skyticker',
  '.tbs__stamp',
];

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];

const routes = [
  { name: 'home', path: '/' },
  { name: 'birth-chart-kahlo', path: '/birth-chart/', result: true },
  { name: 'aries', path: '/aries/' },
  { name: 'events-hub', path: '/events/', normalizeEventsHub: true },
  { name: 'event-full-moon', path: '/full-moon/2026-07-29/' },
];
const routeFilter = new Set(
  (process.env.VISUAL_ROUTES ?? '').split(',').map((name) => name.trim()).filter(Boolean),
);
const selectedRoutes = routeFilter.size > 0
  ? routes.filter((route) => routeFilter.has(route.name))
  : routes;
if (selectedRoutes.length === 0) {
  throw new Error(`VISUAL_ROUTES did not match a visual route: ${[...routeFilter].join(', ')}`);
}

const cases = selectedRoutes.flatMap((route) => [
  ...viewports.map((viewport) => ({ ...route, viewport, reducedMotion: 'no-preference' })),
  { ...route, viewport: viewports[0], reducedMotion: 'reduce', suffix: 'reduced-motion' },
]);

function kahloFragment() {
  const fixture = {
    d: '1907-07-06',
    z: 'America/Mexico_City',
    la: 19.35,
    lo: -99.16,
    t: '08:30',
    n: 'Frida Kahlo',
    p: 'Coyoacán, Mexico',
  };
  return `#c=1.${Buffer.from(JSON.stringify(fixture)).toString('base64url')}`;
}

function fileStem(testCase) {
  const motion = testCase.suffix ? `-${testCase.suffix}` : '';
  return `${testCase.name}-${testCase.viewport.name}${motion}`;
}

async function settlePage(page, { result, normalizeEventsHub, name }) {
  await page.waitForLoadState('networkidle');
  const loadFonts = () => page.evaluate(async () => {
    await Promise.all([...document.fonts].map((font) => font.load().catch(() => undefined)));
    await document.fonts.ready;
  });
  await loadFonts();

  if (normalizeEventsHub) {
    await page.evaluate(() => {
      document.querySelector('.evhub-earlier')?.setAttribute('open', '');
    });
    await page.addStyleTag({
      content: `
        .evhub-now, .evhub-next, .evhub-earlier > summary { display: none !important; }
        .evhub-earlier { display: contents !important; }
      `,
    });
  }

  if (result) {
    await page.locator('.calc__result').waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForFunction(() => document.querySelector('.calc__form')?.getAttribute('aria-busy') === 'false');
    // The complete English reading loads these two below-the-fold surfaces
    // through dynamic imports after the chart result becomes available. Wait
    // for both so a cold first capture cannot establish a truncated baseline.
    await Promise.all([
      page.locator('.calc__approach').waitFor({ state: 'visible', timeout: 30_000 }),
      page.locator('.calc__comm').waitFor({ state: 'visible', timeout: 30_000 }),
    ]);
  }

  // Trigger lazy images, client:visible islands, and every reveal observer.
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
    const step = Math.max(500, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await wait(35);
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await wait(100);
    window.scrollTo(0, 0);
    await wait(100);
    await Promise.race([
      Promise.all([...document.images].map(async (image) => {
        if (!image.complete) {
          await new Promise((resolveImage) => {
            image.addEventListener('load', resolveImage, { once: true });
            image.addEventListener('error', resolveImage, { once: true });
          });
        }
        await image.decode?.().catch(() => undefined);
      })),
      wait(5_000),
    ]);
    for (const video of document.querySelectorAll('video')) {
      video.pause();
      try { video.currentTime = 0; } catch { /* poster remains deterministic */ }
    }
  });
  if (result) {
    // A timed sweep can pass below-the-fold story cards before their effect
    // installs the observer on a busy runner. Exercise their real reveal
    // behavior and require the settled state; never force data-visible or
    // opacity, which would hide a broken observer from the visual gate.
    for (const slug of ['big-three', 'places', 'aspects', 'pattern']) {
      const selector = `.reading-path [data-reading-card="${slug}"]`;
      const card = page.locator(selector);
      await card.waitFor({ state: 'attached', timeout: 30_000 });
      await card.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      try {
        await page.waitForFunction((target) => {
          const element = document.querySelector(target);
          return element?.getAttribute('data-visible') === 'true'
            && getComputedStyle(element).opacity === '1';
        }, selector, { timeout: 30_000 });
      } catch (error) {
        const state = await card.evaluate((element) => ({
          visible: element.getAttribute('data-visible'),
          opacity: getComputedStyle(element).opacity,
          rectangle: element.getBoundingClientRect().toJSON(),
        }));
        await writeFile(resolve(artifactRoot, `reading-reveal-${slug}.json`), JSON.stringify(state, null, 2));
        await page.screenshot({ path: resolve(artifactRoot, `reading-reveal-${slug}.png`), fullPage: true });
        throw error;
      }
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  // After hydration is done: the live row keeps its element (the mask
  // presence check still counts it) but reads the canonical line, so the
  // day's receipt can never change how many lines it wraps to.
  if (name === 'home') {
    await page.evaluate((text) => {
      const ticker = document.querySelector('.skyticker');
      if (ticker) ticker.textContent = text;
    }, canonicalSkyTicker);
  }

  // Long editorial pages can introduce below-the-fold font faces only after
  // the lazy-loading sweep. Wait once more so fallback metrics cannot become
  // a platform baseline by racing the final screenshot.
  await loadFonts();
  await page.waitForTimeout(100);
}


async function ariesFontReceipt(page, context, stem, phase) {
  const css = await page.evaluate(() => ({
    faces: [...document.fonts].map((face) => ({
      family: face.family, style: face.style, weight: face.weight, status: face.status,
    })),
    samples: ['.guide-hero__essence', '.guide-main .prose p'].map((selector) => {
      const node = document.querySelector(selector);
      if (!node) throw new Error('Missing Aries typography sample: ' + selector);
      const style = getComputedStyle(node);
      return { selector, family: style.fontFamily, weight: style.fontWeight, size: style.fontSize };
    }),
  }));
  const session = await context.newCDPSession(page);
  const rendered = [];
  try {
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    for (const sample of css.samples) {
      const { nodeId } = await session.send('DOM.querySelector', {
        nodeId: root.nodeId, selector: sample.selector,
      });
      if (!nodeId) throw new Error('Missing rendered Aries typography sample: ' + sample.selector);
      const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
      rendered.push({ ...sample, fonts });
    }
  } finally {
    await session.detach();
  }
  const receipt = { stem, phase, css, rendered };
  await writeFile(resolve(artifactRoot, stem + '.fonts.' + phase + '.json'), JSON.stringify(receipt, null, 2));
  for (const sample of rendered) {
    if (!sample.fonts.some((font) => font.isCustomFont
      && /instrument\s*sans/i.test(font.familyName) && font.glyphCount > 0)) {
      throw new Error('Aries screenshot rendered a fallback body font: '
        + JSON.stringify({ phase, sample }));
    }
  }
}

async function capture(browser, baseURL, testCase) {
  const context = await browser.newContext({
    viewport: { width: testCase.viewport.width, height: testCase.viewport.height },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: testCase.reducedMotion,
  });
  const page = await context.newPage();

  await page.addInitScript((isoNow) => {
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
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: () => Promise.resolve(),
    });
    // Keep cinematic surfaces on their deterministic poster. A moving video
    // frame is not a stable visual baseline, and Save-Data is already a real
    // product path whose layout is identical to the animated tier.
    Object.defineProperty(Navigator.prototype, 'connection', {
      configurable: true,
      get: () => ({ saveData: true, effectiveType: '4g' }),
    });
  }, fixedNow);

  const fragment = testCase.result ? kahloFragment() : '';
  const response = await page.goto(`${baseURL}${testCase.path}${fragment}`, { waitUntil: 'domcontentloaded' });
  if (!response?.ok()) {
    throw new Error(`${testCase.path} returned HTTP ${response?.status() ?? 'unknown'}.`);
  }
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
      html { scroll-behavior: auto !important; }
      /* Production reader pages use optional faces to prevent late swaps.
         Screenshots instead pin the same font files under test-only family
         names with blocking display. The unique names bypass production
         font-display timing, so an optional face cannot race its platform
         fallback while the strict pixel gate keeps the intended typography. */
      @font-face {
        font-family: 'ZDX Visual Instrument';
        src: url('/fonts/instrument-sans-latin-wght-normal.woff2') format('woff2');
        font-weight: 400 700;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'ZDX Visual Instrument';
        src: url('/fonts/instrument-sans-latin-wght-italic.woff2') format('woff2');
        font-weight: 400 700;
        font-style: italic;
        font-display: block;
      }
      @font-face {
        font-family: 'ZDX Visual EB Garamond';
        src: url('/fonts/eb-garamond-latin-400-normal.woff2') format('woff2');
        font-weight: 400;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'ZDX Visual EB Garamond';
        src: url('/fonts/eb-garamond-latin-500-normal.woff2') format('woff2');
        font-weight: 500;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'ZDX Visual EB Garamond';
        src: url('/fonts/eb-garamond-latin-400-italic.woff2') format('woff2');
        font-weight: 400;
        font-style: italic;
        font-display: block;
      }
      @font-face {
        font-family: 'ZDX Visual JetBrains Mono';
        src: url('/fonts/jetbrains-mono-latin-wght-normal.woff2') format('woff2');
        font-weight: 300 600;
        font-style: normal;
        font-display: block;
      }
      html[data-stable-typography] {
        --font-serif: 'ZDX Visual EB Garamond', Georgia, serif !important;
        --font-sans: 'ZDX Visual Instrument', system-ui, sans-serif !important;
        --font-mono: 'ZDX Visual JetBrains Mono', ui-monospace, monospace !important;
      }
      .reveal {
        filter: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
      /* Full-page rasterization starts at the top and may substitute the
         production footer's intrinsic placeholder after the lazy sweep has
         returned there. Keep the test receipt on the settled visual state. */
      .zfooter { content-visibility: visible !important; }
    `,
  });
  await settlePage(page, testCase);
  if (testCase.name === 'aries') {
    // The general sweep includes optional/local faces whose failures can be
    // legitimate. The sign guide's required body font must load explicitly:
    // do not swallow its error or accept CSS family names as proof of rendering.
    await page.evaluate(async () => {
      for (const weight of [400, 500, 600, 700]) {
        const fonts = await document.fonts.load(weight + ' 16px "Instrument Sans"', 'Aries');
        if (fonts.length === 0 || fonts.some((font) => font.status !== 'loaded')) {
          throw new Error('Required Instrument Sans font did not load at weight ' + weight);
        }
      }
      await document.fonts.ready;
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    await ariesFontReceipt(page, context, fileStem(testCase), 'before');
  }

  if (testCase.result && testCase.viewport.name === 'mobile') {
    const geometry = await page.evaluate(async () => {
      const viewport = document.documentElement.clientWidth;
      const selectors = [
        '.calc__result',
        '.calc__result > *',
        '.calc__approach',
        '.calc__approach-part',
        '.calc__comm',
        '.calc__comm-part',
        '.calc__record',
        '.calc__wheel',
      ];
      const escaped = [...document.querySelectorAll(selectors.join(', '))]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > viewport + 1;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            className: element.className,
            left: rect.left,
            right: rect.right,
            width: rect.width,
          };
        });

      const scrollY = window.scrollY;
      window.scrollTo({ left: 100, top: scrollY, behavior: 'instant' });
      await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
      const scrollX = window.scrollX;
      window.scrollTo({ left: 0, top: scrollY, behavior: 'instant' });

      return {
        viewport,
        htmlWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        scrollX,
        escaped,
      };
    });
    if (
      geometry.htmlWidth > geometry.viewport + 1
      || geometry.bodyWidth > geometry.viewport + 1
      || geometry.scrollX !== 0
      || geometry.escaped.length > 0
    ) {
      throw new Error(
        `Rendered birth chart escapes the mobile viewport: ${JSON.stringify(geometry)}`,
      );
    }
  }

  const masks = await page.locator(liveDailySelectors.join(', ')).evaluateAll((elements) => (
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0
        ? [{
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
          }]
        : [];
    })
  ));
  const image = await page.screenshot({ fullPage: true, animations: 'disabled' });
  if (testCase.name === 'aries') {
    await ariesFontReceipt(page, context, fileStem(testCase), 'after');
  }
  await context.close();
  return { image, masks };
}

function comparePng(expectedBuffer, actualBuffer, masks = []) {
  const expected = PNG.sync.read(expectedBuffer);
  const actual = PNG.sync.read(actualBuffer);
  if (expected.width !== actual.width || expected.height !== actual.height) {
    return {
      dimensionError: `${expected.width}×${expected.height} expected, ${actual.width}×${actual.height} received`,
    };
  }

  for (const mask of masks) {
    const padding = 3;
    const left = Math.max(0, Math.floor(mask.x) - padding);
    const top = Math.max(0, Math.floor(mask.y) - padding);
    const right = Math.min(actual.width, Math.ceil(mask.x + mask.width) + padding);
    const bottom = Math.min(actual.height, Math.ceil(mask.y + mask.height) + padding);
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const offset = (y * actual.width + x) * 4;
        actual.data.set(expected.data.subarray(offset, offset + 4), offset);
      }
    }
  }

  const diff = new PNG({ width: expected.width, height: expected.height });
  const diffPixels = pixelmatch(
    expected.data,
    actual.data,
    diff.data,
    expected.width,
    expected.height,
    { threshold: pixelmatchThreshold, includeAA: false },
  );
  const totalPixels = expected.width * expected.height;
  return {
    diffBuffer: PNG.sync.write(diff),
    diffPixels,
    diffRatio: diffPixels / totalPixels,
  };
}

await rm(artifactRoot, { recursive: true, force: true });
await mkdir(artifactRoot, { recursive: true });
await mkdir(baselineRoot, { recursive: true });

const executablePath = await findChromium();
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: STABLE_CHROMIUM_ARGS,
});

let failures = 0;
try {
  await withPreview({ port: Number(process.env.VISUAL_PORT ?? 4327) }, async (baseURL) => {
    console.log(`Visual regression · ${await browser.version()} · ${baseURL}`);
    for (const testCase of cases) {
      const stem = fileStem(testCase);
      const baselinePath = resolve(baselineRoot, `${stem}.png`);
      const { image: actual, masks } = await capture(browser, baseURL, testCase);
      const expectedMaskCount = testCase.name === 'home' ? 2 : 0;
      if (masks.length !== expectedMaskCount) {
        failures += 1;
        await writeFile(resolve(artifactRoot, `${stem}.actual.png`), actual);
        console.error(`  FAIL ${stem}: ${masks.length} daily masks found, expected ${expectedMaskCount}`);
        continue;
      }

      if (update) {
        await writeFile(baselinePath, actual);
        console.log(`  updated ${stem}`);
        continue;
      }

      let expected;
      try {
        expected = await readFile(baselinePath);
      } catch {
        failures += 1;
        await writeFile(resolve(artifactRoot, `${stem}.actual.png`), actual);
        console.error(`  FAIL ${stem}: baseline missing (run npm run test:visual:update)`);
        continue;
      }

      const comparison = comparePng(expected, actual, masks);
      if (comparison.dimensionError) {
        failures += 1;
        await writeFile(resolve(artifactRoot, `${stem}.actual.png`), actual);
        console.error(`  FAIL ${stem}: ${comparison.dimensionError}`);
        continue;
      }

      const percent = (comparison.diffRatio * 100).toFixed(4);
      if (comparison.diffRatio > maxDiffRatio) {
        failures += 1;
        await Promise.all([
          writeFile(resolve(artifactRoot, `${stem}.actual.png`), actual),
          writeFile(resolve(artifactRoot, `${stem}.diff.png`), comparison.diffBuffer),
        ]);
        console.error(`  FAIL ${stem}: ${percent}% differs (limit 0.1000%)`);
      } else {
        console.log(`  pass ${stem}: ${percent}% differs`);
      }
    }
  });
} finally {
  await browser.close();
}

if (failures > 0) {
  throw new Error(`${failures} visual regression case${failures === 1 ? '' : 's'} failed. Artifacts: ${artifactRoot}`);
}
