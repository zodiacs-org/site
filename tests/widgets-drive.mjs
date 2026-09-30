import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { builtRoutes } from '../scripts/embed-routes.mjs';
import { withPreview } from './visual/preview-server.mjs';

export async function verifyWidgetBuilder({ browser, baseURL, check, outDir = null }) {
  if (outDir) await mkdir(outDir, { recursive: true });
  const page = await browser.newPage();
  const errors = [];
  const previewRequests = [];
  page.on('requestfailed', (request) => {
    if (request.url().includes('/embed/')) previewRequests.push({ url: request.url(), failure: request.failure() });
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  const settle = async (target, selector = null) => {
    await target.waitForFunction((selector) => {
      const root = selector ? document.querySelector(selector) : document;
      return root && document.fonts.status === 'loaded'
        && [...root.querySelectorAll('img')].every((image) => image.complete);
    }, selector, { timeout: 20_000 });
    await target.evaluate(async (selector) => {
      const root = selector ? document.querySelector(selector) : document;
      await document.fonts.ready;
      for (const image of root.querySelectorAll('img')) {
        if (!image.naturalWidth) throw new Error(`Widget capture image failed: ${image.currentSrc}`);
        await image.decode();
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, selector);
  };
  const capture = async (width, state) => {
    if (!outDir) return;
    const builder = page.locator('[data-widget-generator]');
    const frame = builder.locator('[data-widget-preview]');
    // The real preview is lazy-loaded. Approach it naturally before waiting
    // for its selected destination; an offscreen frame can defer navigation.
    await frame.scrollIntoViewIfNeeded();
    const element = await frame.elementHandle();
    const preview = await element.contentFrame();
    if (!preview) throw new Error('Widget preview frame is unavailable for capture');
    const expected = new URL(await element.getAttribute('src'), baseURL);
    try {
      await preview.waitForURL((url) => url.href === expected.href, { waitUntil: 'load' });
    } catch (error) {
      const diagnostic = {
        width, state, expected: expected.href, actual: preview.url(),
        frames: page.frames().map((child) => child.url()),
        failedRequests: previewRequests, errors,
        element: await frame.evaluate((node) => ({
          src: node.src, loading: node.loading,
          box: node.getBoundingClientRect().toJSON(),
          viewport: { width: innerWidth, height: innerHeight },
        })),
      };
      console.error('Widget preview navigation diagnostic:', JSON.stringify(diagnostic));
      await writeFile(join(outDir, `widget-navigation-${state}-${width}.json`), `${JSON.stringify(diagnostic, null, 2)}\n`);
      await page.screenshot({ path: join(outDir, `widget-navigation-${state}-${width}.png`), fullPage: true });
      throw error;
    }
    await settle(preview);
    await settle(page, '[data-widget-generator]');
    await builder.screenshot({ path: join(outDir, `widget-builder-${state}-${width}.png`), animations: 'disabled' });
  };
  try {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${baseURL}/widgets/`, { waitUntil: 'networkidle' });
      const builder = page.locator('[data-widget-generator]');
      // Match each select's actual accessible name; wrapped label text also
      // contains option text, which is not the combobox's accessible name.
      const setting = (name) => ['Widget', 'Embed mode', 'Theme'].includes(name)
        ? builder.getByRole('combobox', { name, exact: true })
        : builder.getByLabel(name, { exact: true });
      const labels = ['Widget', 'Embed mode', 'Theme', 'Accent', 'Embed code'];
      for (const label of labels) {
        const control = setting(label);
        const presentation = await control.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            height: rect.height,
            left: rect.left,
            right: rect.right,
            background: style.backgroundColor,
            border: parseFloat(style.borderTopWidth),
            scheme: style.colorScheme,
          };
        });
        if (presentation.height < 44 || presentation.left < 0 || presentation.right > width
          || presentation.background === 'rgb(255, 255, 255)' || presentation.background === 'rgba(0, 0, 0, 0)'
          || presentation.border < 1 || presentation.scheme !== 'dark') {
          throw new Error(`${label} is unstyled or outside the ${width}px viewport: ${JSON.stringify(presentation)}`);
        }
      }

      // Follow the real keyboard order through the four settings. Checking the
      // computed focus ring catches a missing stylesheet as well as lost labels.
      await setting('Widget').focus();
      for (const label of ['Embed mode', 'Theme', 'Accent']) {
        await page.keyboard.press('Tab');
        const focused = await setting(label).evaluate((element) => {
          const style = getComputedStyle(element);
          return element === document.activeElement && element.matches(':focus-visible')
            && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
        });
        if (!focused) throw new Error(`${label} lacks visible keyboard focus at ${width}px`);
      }
      check?.(`widgets ${width}: labeled controls fit, meet 44px height, and retain visible keyboard focus`, true);
      await capture(width, 'controls');

      await setting('Widget').selectOption('sky');
      await setting('Theme').selectOption('light');
      const code = builder.getByLabel('Embed code', { exact: true });
      const frame = builder.locator('[data-widget-preview]');
      if (!(await code.inputValue()).includes('/embed/sky/?theme=light')
        || !(await frame.getAttribute('src')).includes('/embed/sky/?theme=light')) {
        throw new Error('Builder settings did not update the iframe snippet and preview together');
      }
      await setting('Embed mode').selectOption('script');
      if (!(await code.inputValue()).includes('data-zodiacs-widget="sky"')) {
        throw new Error('Script mode did not produce the selected widget');
      }
      await setting('Widget').selectOption('chart');
      if (!(await code.inputValue()).includes('data-zodiacs-widget="chart"')
        || !(await frame.getAttribute('src')).includes('/embed/chart/?theme=light')) {
        throw new Error('Chart selection did not update the script snippet and preview together');
      }
      check?.(`widgets ${width}: native settings keep iframe/script code and actual preview destination aligned`, true);
      await capture(width, 'chart-script');
    }

    // These are rendered text assertions: source whitespace alone does not
    // establish whether Astro preserves a space at an inline-link boundary.
    const textCases = [
      ['/widgets/', '.wdg-intro', ['published as machine-readable JSON.']],
      ['/developers/', 'main', [
        "the shared sky, and the site's own chart calculation stays on the device.",
        'a $schema link to its JSON Schema, and links to the related files.',
        'An agent should start at /api/v1/llms.txt: it lists every endpoint',
        'Tool-calling frameworks can load /api/v1/openapi.json directly, and the daily files',
        'The site-wide guide for agents is llms.txt.',
        'extended; read index.json rather than',
        'free to use under CC BY 4.0.',
        'with a link to https://zodiacs.org wherever',
        'consume JSON, the embeddable widgets',
        'RSS: daily horoscopes and the daily sky.',
        'and the theme and accent parameters',
      ]],
      ['/people/', '.people-directory__footer', ['Something wrong on one of these pages? Ask us to correct or remove it.']],
      ['/people/ada-lovelace/', '.person-evidence__correction', ['Something wrong here? Ask us to correct or remove it.']],
    ];
    for (const [route, selector, phrases] of textCases) {
      await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
      const text = (await page.locator(selector).textContent()).replace(/\s+/g, ' ').trim();
      for (const phrase of phrases) {
        if (!text.includes(phrase)) throw new Error(`${route} has a broken rendered text boundary: ${phrase}`);
      }
      check?.(`widgets copy: ${route} preserves inline text spacing`, true);
    }
    if (errors.length) throw new Error(`Widget builder emitted unexpected browser errors:\n${errors.join('\n')}`);
    console.log('widgets-drive: builder labels, mobile controls, keyboard focus, modes, previews, and inline copy pass');
  } finally {
    await page.close();
  }
}

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return rejectListen(new Error('host server has no TCP address'));
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolveClose) => server.close(resolveClose));
}

/**
 * Someone embedding a widget inherits its keyboard behaviour on their own page,
 * so the one control every embed carries — the backlink that attributes it —
 * has to be reachable by Tab and has to show where the focus went. Chromium
 * paints `outline: auto` as a contrasting ring, so what this catches is the
 * regression that actually happens: a stylesheet suppressing the indicator.
 */
export async function verifyEmbedKeyboard({ browser, baseURL, routes }) {
  const page = await browser.newPage({ viewport: { width: 420, height: 360 } });
  try {
    for (const route of routes) {
      await page.goto(`${baseURL}/embed/${route}/`, { waitUntil: 'networkidle' });
      // The chart embed is a form, so its first stop is a field, not the
      // backlink; what matters is that tabbing reaches the link at all.
      let reached = null;
      const visited = [];
      for (let stop = 0; stop < 12 && !reached; stop += 1) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
          const element = document.activeElement;
          if (!element || element === document.body) return null;
          const style = getComputedStyle(element);
          // A fully transparent ring paints nothing, so colour is part of the
          // question, not just presence.
          const opaque = (colour) => !/rgba?\([^)]*,\s*0\s*\)$/u.test(colour ?? '');
          return {
            tag: element.tagName,
            text: (element.textContent ?? '').trim(),
            outlined: style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0
              && opaque(style.outlineColor),
            shadowed: style.boxShadow !== 'none' && opaque(style.boxShadow),
          };
        });
        if (!focused) break;
        visited.push(`${focused.tag}:${focused.text.slice(0, 20)}`);
        if (/Powered by Zodiacs\.org/u.test(focused.text)) reached = focused;
      }
      if (visited.length === 0) throw new Error(`/embed/${route}/ has nothing reachable by keyboard`);
      if (!reached) {
        throw new Error(`/embed/${route}/ never reaches its attribution link by keyboard; stops: ${visited.join(', ')}`);
      }
      if (!reached.outlined && !reached.shadowed) {
        throw new Error(`/embed/${route}/ focuses its attribution link without showing a focus indicator`);
      }
    }
    console.log(`widgets-drive: ${routes.length} embed routes are keyboard reachable with a visible focus indicator`);
  } finally {
    await page.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await withPreview({ port: Number(process.env.WIDGET_PREVIEW_PORT ?? 4331) }, async (baseURL) => {
  const host = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><html><body>
      <iframe id="moon" src="${baseURL}/embed/moon/?theme=light&accent=%23E0B080" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>
      <iframe id="sky" src="${baseURL}/embed/sky/?theme=dark" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>
      <iframe id="chart" src="${baseURL}/embed/chart/?theme=dark" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>
      <script async src="${baseURL}/assets/widgets.js" data-zodiacs-widget="sky" data-theme="light" data-accent="#E0B080" data-title="Mounted sky"></script>
    </body></html>`);
  });
  const hostURL = await listen(host);
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    headless: true,
    args: STABLE_CHROMIUM_ARGS,
  });
  const requests = [];

  try {
    const page = await browser.newPage();
    page.on('request', (request) => requests.push(request.url()));
    await page.goto(hostURL, { waitUntil: 'networkidle' });
    if (new URL(page.url()).origin === new URL(baseURL).origin) throw new Error('fixture is not foreign-origin');

    for (const selector of ['#moon', '#sky', '#chart']) {
      const frame = page.frameLocator(selector);
      await frame.getByRole('link', { name: /Powered by Zodiacs\.org/ }).waitFor();
      if (await frame.locator('img[src*="/assets/zodiac-icons/48/"]').count() < 1) {
        throw new Error(`${selector} did not render a canonical sign icon`);
      }
    }

    const mounted = page.frameLocator('iframe[title="Mounted sky"]');
    await mounted.getByRole('link', { name: /Powered by Zodiacs\.org/ }).waitFor();

    const chart = page.frameLocator('#chart');
    await chart.getByLabel('Birth date').fill('1990-01-15');
    await chart.getByLabel('Birth time').fill('12:30');
    const birthplace = chart.getByLabel('Birthplace');
    await birthplace.fill('New York');
    await chart.getByRole('option').first().waitFor();
    await birthplace.press('ArrowDown');
    await birthplace.press('ArrowUp');
    await birthplace.press('Enter');
    if (!(await chart.getByLabel('Birthplace').inputValue()).includes('New York')) {
      throw new Error('mini chart keyboard selection did not preserve the labeled birthplace input');
    }
    await chart.getByRole('button', { name: 'Find the big three' }).click();
    await chart.locator('.mini-chart__result article').first().waitFor({ timeout: 30_000 });
    if (await chart.locator('.mini-chart__result article').count() !== 3) {
      throw new Error('mini chart did not render all three placements');
    }

    const forbidden = requests.filter((url) => /plausible|analytics|session[-_]?record|fingerprint|\/api\//i.test(url));
    if (forbidden.length > 0) throw new Error(`embed made forbidden requests:\n${forbidden.join('\n')}`);
    console.log('widgets-drive: foreign-origin iframe, script mount, branding, icons, and private chart all pass');
    // Discovered, not listed: the same source of truth verify-widgets uses, so
    // a new embed route is exercised here the day it ships.
    await verifyEmbedKeyboard({ browser, baseURL, routes: await builtRoutes() });
    await verifyWidgetBuilder({ browser, baseURL, outDir: process.env.OUT_DIR ?? 'tests/visual/artifacts/widgets' });
  } finally {
    await browser.close();
    await close(host);
  }
});
