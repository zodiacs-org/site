/**
 * Phase 3 PWA acceptance against the built local preview.
 *
 * This deliberately uses a persistent Chromium profile: installability is a
 * browser-owned signal and incognito contexts are not eligible. The drive
 * observes the native install event but never calls prompt(), so it cannot
 * install the app on the host.
 *
 *   npm run build
 *   node tests/pwa-drive.mjs
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { BRAND_ICON_PATHS } from '../src/lib/brand-icons.mjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const TIMEOUT = 45_000;
const PROFILE_PREFIX = join(tmpdir(), 'zodiacs-pwa-drive-');
const COMPUTE_COUNT_KEY = 'zodiacs.install.compute-count.v1';
const DISMISSED_KEY = 'zodiacs.install.dismissed.v1';
const REGISTRY_AUTHORITY_PATH = '/registry/zodiacs.registry.json';

const expectedManifest = {
  name: 'Zodiacs | birth charts and daily astrology',
  short_name: 'Zodiacs',
  description: 'Birth charts, daily horoscopes, compatibility, and sign guides, free and private on your device.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#060709',
  theme_color: '#060709',
  icons: [
    { src: BRAND_ICON_PATHS.icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: BRAND_ICON_PATHS.icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: BRAND_ICON_PATHS.maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

const chartWire = {
  d: '1907-07-06',
  t: '08:30',
  z: 'America/Mexico_City',
  la: 19.35,
  lo: -99.16,
  n: 'PWA fixture',
  p: 'Coyoacán, Mexico',
};
const chartFragment = `#c=1.${Buffer.from(JSON.stringify(chartWire)).toString('base64url')}`;

const offlineRoutes = [
  { path: '/today/', heading: 'The sky today' },
  { path: '/birth-chart/', heading: 'Get your free birth chart.' },
  { path: '/tools/', heading: 'Free astrology tools' },
];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

function localPreviewOrigin(baseURL) {
  const url = new URL(baseURL);
  return url.protocol === 'http:'
    && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
    && url.username === ''
    && url.password === '';
}

async function waitForInstallability(session) {
  const deadline = Date.now() + TIMEOUT;
  let latest = [];
  while (Date.now() < deadline) {
    ({ installabilityErrors: latest } = await session.send('Page.getInstallabilityErrors'));
    if (latest.length === 0) return latest;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  return latest;
}

async function waitForWorkerControl(page) {
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    return registration.scope === `${location.origin}/`
      && registration.active?.state === 'activated';
  }, null, { timeout: TIMEOUT });

  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: TIMEOUT });
}

async function computeAgain(page) {
  await page.locator('.calc__form button[type="submit"]').click();
  await page.waitForFunction(() => (
    document.querySelector('.calc__form')?.getAttribute('aria-busy') === 'false'
      && Boolean(document.querySelector('.calc__result'))
  ), null, { timeout: TIMEOUT });
}

let fatalError = null;

try {
  await withPreview({ port: Number(process.env.PWA_DRIVE_PORT ?? 4441) }, async (baseURL) => {
    if (!localPreviewOrigin(baseURL)) {
      throw new Error(`PWA drive refuses non-loopback target ${baseURL}.`);
    }
    check('target is the built loopback preview, never production', true, baseURL);

    const userDataDirectory = await mkdtemp(PROFILE_PREFIX);
    let context;
    try {
      context = await chromium.launchPersistentContext(userDataDirectory, {
        executablePath: await findChromium(),
        headless: true,
        args: [...STABLE_CHROMIUM_ARGS, '--enable-features=DesktopPWAs'],
        viewport: { width: 1280, height: 900 },
        colorScheme: 'dark',
        locale: 'en-US',
        timezoneId: 'UTC',
        serviceWorkers: 'allow',
      });
      check('Chromium uses a persistent non-incognito profile with real service workers', true);

      const webErrors = [];
      context.on('weberror', (webError) => {
        const error = webError.error();
        webErrors.push(error instanceof Error ? error.stack ?? error.message : String(error));
      });
      const unexpectedOrigins = new Set();
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === new URL(baseURL).origin) {
          await route.continue();
          return;
        }
        unexpectedOrigins.add(url.origin);
        await route.abort('blockedbyclient');
      });
      await context.addInitScript(() => {
        globalThis.__pwaDriveAppInstalled = 0;
        window.addEventListener('appinstalled', () => {
          globalThis.__pwaDriveAppInstalled += 1;
        });
      });

      let page = context.pages()[0] ?? await context.newPage();
      const response = await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
      check('preview start URL responds successfully', response?.status() === 200, `status=${response?.status() ?? 'none'}`);

      await waitForWorkerControl(page);
      const worker = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        return {
          scope: registration.scope,
          scriptURL: registration.active?.scriptURL ?? null,
          state: registration.active?.state ?? null,
          controlled: Boolean(navigator.serviceWorker.controller),
        };
      });
      check('service worker is activated, controls the page, and owns root scope',
        worker.scope === `${baseURL}/`
          && worker.scriptURL === `${baseURL}/sw.js`
          && worker.state === 'activated'
          && worker.controlled,
        JSON.stringify(worker));

      const session = await context.newCDPSession(page);
      await session.send('Page.enable');
      const installabilityErrors = await waitForInstallability(session);
      check('Chromium reports no installability errors',
        installabilityErrors.length === 0,
        JSON.stringify(installabilityErrors));

      const browserManifest = await session.send('Page.getAppManifest');
      const manifest = JSON.parse(browserManifest.data);
      check('browser consumes the same-origin web app manifest',
        browserManifest.url === `${baseURL}/site.webmanifest`
          && await page.locator('link[rel="manifest"][href="/site.webmanifest"]').count() === 1,
        browserManifest.url);
      check('manifest identity, scope, display, and colors are exact',
        Object.entries(expectedManifest)
          .filter(([key]) => key !== 'icons')
          .every(([key, value]) => manifest[key] === value),
        JSON.stringify(manifest));
      check('manifest declares the exact any-purpose and maskable icon set',
        JSON.stringify(manifest.icons) === JSON.stringify(expectedManifest.icons),
        JSON.stringify(manifest.icons));
      await session.detach();

      const iconReceipts = await Promise.all(expectedManifest.icons.map(async (icon) => {
        const iconResponse = await fetch(`${baseURL}${icon.src}`);
        const bytes = (await iconResponse.arrayBuffer()).byteLength;
        return {
          src: icon.src,
          status: iconResponse.status,
          type: iconResponse.headers.get('content-type'),
          bytes,
        };
      }));
      check('every manifest icon is a nonempty local PNG',
        iconReceipts.every((icon) => icon.status === 200
          && icon.type?.toLowerCase().startsWith('image/png')
          && icon.bytes > 0),
        JSON.stringify(iconReceipts));
      const iconDimensions = await page.evaluate(async (icons) => Promise.all(icons.map((icon) => new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ src: icon.src, width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => resolve({ src: icon.src, width: 0, height: 0 });
        image.src = icon.src;
      }))), expectedManifest.icons);
      check('every manifest icon has the pixels its declared size promises',
        iconDimensions.every((icon, index) => {
          const [width, height] = expectedManifest.icons[index].sizes.split('x').map(Number);
          return icon.width === width && icon.height === height;
        }),
        JSON.stringify(iconDimensions));

      const workerSource = await (await fetch(`${baseURL}/sw.js`)).text();
      const cacheVersion = workerSource.match(/const CACHE_VERSION = '([a-f0-9]{12})';/)?.[1] ?? null;
      const cacheReceipt = await page.evaluate(async () => {
        const names = await caches.keys();
        const entries = {};
        for (const name of names) {
          entries[name] = (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname);
        }
        return { names, entries };
      });
      const shellCache = cacheVersion ? `zodiacs-shell-${cacheVersion}` : '';
      check('built worker carries a content-derived version and versioned shell/data names',
        cacheVersion !== null
          && workerSource.includes('const SHELL_CACHE = `zodiacs-shell-${CACHE_VERSION}`;')
          && workerSource.includes('const DATA_CACHE = `zodiacs-data-${CACHE_VERSION}`;')
          && workerSource.includes('const PUSH_ENABLED = false;'),
        `version=${cacheVersion ?? 'missing'}`);
      check('activated versioned shell cache contains every required offline route',
        cacheReceipt.names.includes(shellCache)
          && offlineRoutes.every(({ path }) => cacheReceipt.entries[shellCache]?.includes(path)),
        JSON.stringify(cacheReceipt.names));

      await page.evaluate(({ computeKey, dismissedKey }) => {
        localStorage.removeItem(computeKey);
        localStorage.removeItem(dismissedKey);
      }, {
        computeKey: COMPUTE_COUNT_KEY,
        dismissedKey: DISMISSED_KEY,
      });
      await page.goto(`${baseURL}/tools/`, { waitUntil: 'domcontentloaded' });
      await page.goto(`${baseURL}/birth-chart/${chartFragment}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.calc__result').waitFor({ state: 'visible', timeout: TIMEOUT });
      await page.waitForFunction((key) => localStorage.getItem(key) === '1', COMPUTE_COUNT_KEY, { timeout: TIMEOUT });
      await page.waitForFunction(() => Boolean(globalThis.zodiacsInstallPrompt), null, { timeout: TIMEOUT });
      check('first ordinary unsaved chart records progress without showing the install card',
        await page.locator('[data-pwa-install]').count() === 0
          && await page.locator('[data-save-chart]').count() === 1
          && await page.locator('[data-first-reading-prompt]').count() === 1);

      await computeAgain(page);
      await page.waitForFunction((key) => localStorage.getItem(key) === '2', COMPUTE_COUNT_KEY, { timeout: TIMEOUT });
      let installCard = page.locator('[data-pwa-install]');
      await installCard.waitFor({ state: 'visible', timeout: TIMEOUT });
      check('second ordinary unsaved chart earns one quiet install offer',
        await installCard.count() === 1
          && await installCard.getByText('Keep Zodiacs close?', { exact: true }).isVisible()
          && await installCard.getByRole('button', { name: 'Install Zodiacs', exact: true }).isVisible()
          && await installCard.locator('img[src^="/assets/zodiac-icons/48/"]').count() === 12);

      await installCard.getByRole('button', { name: 'No, do not ask again', exact: true }).click();
      await installCard.waitFor({ state: 'detached', timeout: TIMEOUT });
      check('dismissal is persisted and hides the earned offer',
        await page.evaluate((key) => localStorage.getItem(key), DISMISSED_KEY) === '1');
      await computeAgain(page);
      check('a later chart never re-offers after dismissal',
        await page.locator('[data-pwa-install]').count() === 0
          && await page.evaluate(() => globalThis.__pwaDriveAppInstalled) === 0
          && await page.evaluate(() => !window.matchMedia('(display-mode: standalone)').matches));
      check('the drive observes but never invokes the real OS install prompt',
        await page.evaluate(() => typeof globalThis.zodiacsInstallPrompt?.prompt === 'function'
          && globalThis.__pwaDriveAppInstalled === 0));

      await page.close();
      page = await context.newPage();
      await page.goto(`${baseURL}/tools/`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(({ computeKey, dismissedKey }) => {
        localStorage.removeItem(computeKey);
        localStorage.removeItem(dismissedKey);
      }, {
        computeKey: COMPUTE_COUNT_KEY,
        dismissedKey: DISMISSED_KEY,
      });
      await page.goto(`${baseURL}/birth-chart/${chartFragment}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.calc__result').waitFor({ state: 'visible', timeout: TIMEOUT });
      await page.waitForFunction((key) => localStorage.getItem(key) === '1', COMPUTE_COUNT_KEY, { timeout: TIMEOUT });
      await page.evaluate(() => {
        globalThis.__pwaDriveSyntheticPromptCalls = 0;
        const event = new Event('beforeinstallprompt', { cancelable: true });
        Object.defineProperties(event, {
          prompt: {
            value: async () => {
              globalThis.__pwaDriveSyntheticPromptCalls += 1;
            },
          },
          userChoice: {
            value: Promise.resolve({ outcome: 'dismissed', platform: 'test' }),
          },
        });
        window.dispatchEvent(event);
      });
      await computeAgain(page);
      installCard = page.locator('[data-pwa-install]');
      await installCard.waitFor({ state: 'visible', timeout: TIMEOUT });
      await installCard.getByRole('button', { name: 'Install Zodiacs', exact: true }).click();
      await installCard.waitFor({ state: 'detached', timeout: TIMEOUT });
      check('the install action invokes one captured prompt and treats browser-sheet dismissal as final',
        await page.evaluate(({ dismissedKey }) => (
          globalThis.__pwaDriveSyntheticPromptCalls === 1
            && localStorage.getItem(dismissedKey) === '1'
        ), { dismissedKey: DISMISSED_KEY }));

      await page.goto(`${baseURL}/birth-chart/${chartFragment}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.calc__result').waitFor({ state: 'visible', timeout: TIMEOUT });
      await page.waitForFunction(() => performance.getEntriesByType('resource')
        .some((entry) => entry.name.includes('/_astro/PwaInstallPrompt.')), null, { timeout: TIMEOUT });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      check('browser-sheet dismissal survives a full navigation and prevents re-offer',
        await page.locator('[data-pwa-install]').count() === 0
          && await page.evaluate((key) => localStorage.getItem(key), DISMISSED_KEY) === '1');

      const onlineRegistry = await page.evaluate(async (path) => {
        const registryResponse = await fetch(path, { cache: 'no-store' });
        return { status: registryResponse.status, bytes: (await registryResponse.text()).length };
      }, REGISTRY_AUTHORITY_PATH);
      check('Registry authority JSON is reachable online before the offline proof',
        onlineRegistry.status === 200 && onlineRegistry.bytes > 0,
        JSON.stringify(onlineRegistry));

      await context.setOffline(true);
      for (const route of offlineRoutes) {
        const offlineResponse = await page.goto(`${baseURL}${route.path}`, { waitUntil: 'domcontentloaded' });
        const content = await page.evaluate(() => {
          const h1 = document.querySelector('main h1');
          // An edition heading reads its current form ("The sky today") while
          // the edition is the day's, and its dated form once a day has passed.
          // Either is right; compare by the current form it carries.
          const edition = h1?.querySelector('[data-edition-text]');
          const shown = h1?.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
          return {
            heading: edition && shown === edition.getAttribute('data-edition-dated')
              ? edition.getAttribute('data-edition-current') ?? shown
              : shown,
            shown,
            textLength: document.querySelector('main')?.textContent?.replace(/\s+/gu, ' ').trim().length ?? 0,
          };
        });
        check(`${route.path} navigates offline from the real worker cache with meaningful content`,
          offlineResponse?.status() === 200
            && offlineResponse.fromServiceWorker()
            && content.heading === route.heading
            && content.textLength >= 150,
          JSON.stringify({ status: offlineResponse?.status() ?? null, fromWorker: offlineResponse?.fromServiceWorker() ?? false, ...content }));
      }

      const offlineRegistry = await page.evaluate(async (path) => {
        try {
          const registryResponse = await fetch(path, { cache: 'no-store' });
          return { rejected: false, status: registryResponse.status, bytes: (await registryResponse.text()).length };
        } catch (error) {
          return { rejected: true, name: error instanceof Error ? error.name : typeof error };
        }
      }, REGISTRY_AUTHORITY_PATH);
      const registryCacheEntries = await page.evaluate(async (path) => {
        const matches = [];
        for (const name of await caches.keys()) {
          for (const request of await (await caches.open(name)).keys()) {
            if (new URL(request.url).pathname === path) matches.push(name);
          }
        }
        return matches;
      }, REGISTRY_AUTHORITY_PATH);
      check('Registry authority JSON fails honestly offline and is absent from CacheStorage',
        offlineRegistry.rejected && registryCacheEntries.length === 0,
        JSON.stringify({ offlineRegistry, registryCacheEntries }));
      await context.setOffline(false);

      check('browser drive made no request to a production or third-party origin',
        unexpectedOrigins.size === 0,
        [...unexpectedOrigins].join(', '));
      check('browser drive observed no uncaught page exceptions',
        webErrors.length === 0,
        webErrors.join(' | '));
    } finally {
      if (context) {
        await context.setOffline(false).catch(() => {});
        await context.close().catch(() => {});
      }
      await rm(userDataDirectory, { recursive: true, force: true });
    }
  });
} catch (error) {
  fatalError = error;
  check('PWA drive completes without an unexpected exception', false,
    error instanceof Error ? error.stack ?? error.message : String(error));
}

for (const result of results) {
  const detail = result.detail ? ` — ${String(result.detail).replace(/\s+/gu, ' ').trim()}` : '';
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${detail}`);
}

const failures = results.filter((result) => !result.ok);
if (failures.length > 0 || fatalError) {
  console.error(`Phase 3 PWA drive: FAIL — ${failures.length} check${failures.length === 1 ? '' : 's'} failed.`);
  process.exitCode = 1;
} else {
  console.log(`Phase 3 PWA drive: PASS — ${results.length} checks passed.`);
}
