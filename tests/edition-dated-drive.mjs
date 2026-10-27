/**
 * A daily page whose edition is a day old must paint its dated wording
 * first, not swap it in later. From 00:00 UTC until the next daily commit
 * deploys, every daily page is dated, and the guard used to rewrite its
 * relative wording after the first paint: Site Check's Lighthouse gate
 * measured CLS 0.020 on /today/, 0.005 on /horoscopes/ and 0.011 on
 * /horoscopes/aries/ just after 00:00 UTC (run 38184748851, finding F-84).
 * The Spanish and Portuguese daily pages kept "hoy" and "hoje" in that
 * window; they are driven the same way, with their own rules.
 *
 * The response is streamed in three parts with pauses, so the browser paints
 * before the document finishes and before DOMContentLoaded; the first break
 * falls just after a relative word. On a clock after the next UTC midnight
 * each route must keep CLS at exactly 0 across a tall viewport, through
 * hydration; every text node outside the islands must read exactly as the
 * server's `datedEditionTextIn` dates it in the page's language; and no
 * relative wording may remain.
 * Chromium holds a text run back until its end arrives, so a separate check
 * appends to a text node after its start was dated, as a parser that paints
 * partial text would. The tab title reads as the server's title dated (in
 * Spanish and Portuguese it loses "hoy"/"hoje"). The same routes on a current
 * clock keep CLS at 0 and the server's wording and title, and without
 * JavaScript /today/ shows EditionText's dated server form.
 *
 *   npm run build
 *   node tests/edition-dated-drive.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { datedEditionTextIn, datedEditionTitleIn, editionDateLabel } from '../src/lib/edition-freshness.ts';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
import { editionLayoutStreaming } from './edition-layout-stream-drive.mjs';

const publication = JSON.parse(await readFile(new URL('../src/data/daily-publication.json', import.meta.url), 'utf8'));
const program = JSON.parse(await readFile(new URL('../src/data/horoscope-program.json', import.meta.url), 'utf8'));
const daily = JSON.parse(await readFile(new URL('../src/data/daily.json', import.meta.url), 'utf8'));
const editionDate = publication.date;
const editionDay = Date.parse(`${editionDate}T00:00:00.000Z`);
// 00:17 UTC on the next day, when Site Check's Lighthouse step finished.
const datedNow = editionDay + 86_400_000 + 17 * 60_000;
const currentNow = editionDay + 12 * 3_600_000;

// Each language's relative word, a sentence to append after its start was
// dated, and the routes that say it.
const languages = {
  en: { word: /\b[Tt]oday\b/gu, left: /\btoday(?:[’']s)?\b/iu, append: ['Today', ', read today’s sky.'] },
  es: { word: /\b[Hh]oy\b/gu, left: /\bhoy\b/iu, append: ['La Luna pasa hoy por', ' tu octava casa: el cielo de hoy.'] },
  pt: { word: /\b[Hh]oje\b/gu, left: /\bhoje\b/iu, append: ['A Lua passa hoje por', ' sua oitava casa: o céu de hoje.'] },
};
const routes = [
  { path: '/today/', locale: 'en' },
  { path: '/horoscopes/', locale: 'en' },
  { path: '/horoscopes/aries/', locale: 'en' },
  { path: '/es/today/', locale: 'es' },
  { path: '/es/horoscopes/', locale: 'es' },
  { path: '/es/horoscopes/aries/', locale: 'es' },
  { path: '/pt/today/', locale: 'pt' },
  { path: '/pt/horoscopes/', locale: 'pt' },
  { path: '/pt/horoscopes/aries/', locale: 'pt' },
];
const routeByPath = new Map(routes.map((route) => [route.path, route]));
// Tall enough that a shift anywhere near the top of the page is in view;
// a layout shift only counts while its element is visible.
const viewports = [
  { width: 360, height: 1600 },
  { width: 412, height: 1600 },
  { width: 1280, height: 1400 },
];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
check('Today and Horoscopes share the edition date', program.anchorDate === editionDate, `${program.anchorDate} · ${editionDate}`);
check('The Spanish and Portuguese pages share the edition date', daily.date === editionDate, `${daily.date} · ${editionDate}`);

/** Offset just after the first relative word in an edition scope's text. */
function relativeWordBreak(html, word) {
  const scope = html.indexOf('data-edition-content');
  if (scope < 0) return -1;
  const pattern = new RegExp(word.source, word.flags);
  pattern.lastIndex = scope;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    const before = html.slice(0, match.index);
    if (before.lastIndexOf('<') > before.lastIndexOf('>')) continue;
    if (before.lastIndexOf('<script') > before.lastIndexOf('</script>')) continue;
    return match.index + match[0].length;
  }
  return -1;
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const total = (shifts) => shifts.reduce((sum, shift) => sum + shift.value, 0);

await withPreview({ port: 4393 }, async (baseURL) => {
  const served = new Map();
  const server = createServer(async (req, res) => {
    try {
      const response = await fetch(new URL(req.url, baseURL));
      const bytes = Buffer.from(await response.arrayBuffer());
      res.statusCode = response.status;
      for (const [name, value] of response.headers) {
        if (!['content-encoding', 'content-length', 'transfer-encoding', 'etag'].includes(name)) {
          res.setHeader(name, value);
        }
      }
      const html = bytes.toString();
      const route = routeByPath.get(req.url);
      const wordBreak = route && response.ok ? relativeWordBreak(html, languages[route.locale].word) : -1;
      const documentEnd = html.indexOf('</body>');
      if (wordBreak < 0 || documentEnd < wordBreak) {
        res.end(bytes);
        return;
      }
      served.set(req.url, html);
      res.write(html.slice(0, wordBreak));
      await pause(300);
      res.write(html.slice(wordBreak, documentEnd));
      await pause(300);
      res.end(html.slice(documentEnd));
    } catch {
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;

  let browser;
  try {
    browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });

    async function open(route, viewport, now, javaScriptEnabled = true) {
      const context = await browser.newContext({ viewport, javaScriptEnabled });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(({ at }) => {
        const NativeDate = Date;
        function FixedDate(...args) {
          if (!new.target) return new NativeDate(at).toString();
          return Reflect.construct(NativeDate, args.length ? args : [at], new.target);
        }
        Object.setPrototypeOf(FixedDate, NativeDate);
        FixedDate.prototype = NativeDate.prototype;
        FixedDate.now = () => at;
        globalThis.Date = FixedDate;
        globalThis.__editionShifts = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.hadRecentInput) continue;
            globalThis.__editionShifts.push({
              value: entry.value,
              sources: (entry.sources ?? []).map((source) => {
                const node = source.node?.nodeType === Node.ELEMENT_NODE ? source.node : source.node?.parentElement;
                return node ? `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}` : '(removed)';
              }),
            });
          }
        }).observe({ type: 'layout-shift', buffered: true });
      }, { at: now });
      const response = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
      return { context, page, errors, status: response?.status() };
    }

    async function settle(page) {
      // client:idle islands hydrate after load; give them their idle turn.
      await page.waitForFunction(() => document.querySelectorAll('astro-island[client="idle"][ssr]').length === 0);
      await page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 250)));
      }));
    }

    // Outside the islands, the text nodes of the edition scopes, live and as
    // the server sent them.
    const scopeTexts = (page, route) => page.evaluate((source) => {
      const textsOf = (doc) => {
        const out = [];
        for (const scope of doc.querySelectorAll('[data-edition-content]')) {
          const walker = doc.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.parentElement.closest('astro-island, script, style, noscript, [data-edition-text], [data-edition-current-only]')) continue;
            out.push(node.nodeValue);
          }
        }
        return out;
      };
      return { live: textsOf(document), server: textsOf(new DOMParser().parseFromString(source ?? '', 'text/html')) };
    }, served.get(route));

    // The tab title, live and as the server sent it.
    const titles = (page, route) => page.evaluate((source) => ({
      live: document.title,
      server: new DOMParser().parseFromString(source ?? '', 'text/html').title,
    }), served.get(route));

    for (const { path: route, locale } of routes) {
      const language = languages[locale];
      const label = editionDateLabel(editionDate, locale);
      const dated = (text) => datedEditionTextIn(locale, text, editionDate);
      for (const viewport of viewports) {
        const where = `${route} ${viewport.width}px dated`;
        const { context, page, errors, status } = await open(route, viewport, datedNow);
        try {
          check(`${where}: answers 200 and streams a break after a relative word`, status === 200 && served.has(route), String(status));
          await settle(page);
          check(`${where}: the edition is dated`, await page.getAttribute('html', 'data-edition-state') === 'dated');
          const shifts = await page.evaluate(() => globalThis.__editionShifts);
          check(`${where}: CLS is exactly 0`, total(shifts) === 0, JSON.stringify(shifts));

          // Outside the islands, each text node must read exactly as the
          // server dates its source, including the one the parser appended
          // to after its start was dated.
          const texts = await scopeTexts(page, route);
          const expected = texts.server.map(dated);
          const wrong = expected.flatMap((text, index) => (texts.live[index] === text ? [] : [{ live: texts.live[index], expected: text }]));
          check(`${where}: the server sent relative wording to date`, expected.some((text, index) => text !== texts.server[index]));
          check(
            `${where}: every text node reads as the server dates it`,
            texts.live.length === texts.server.length && wrong.length === 0,
            `${texts.live.length}/${texts.server.length} nodes; ${JSON.stringify(wrong.slice(0, 2))}`,
          );

          const spans = await page.$$eval('[data-edition-text]', (elements) => elements.map((element) => (
            element.textContent === element.getAttribute('data-edition-dated')
          )));
          check(`${where}: EditionText shows its dated form`, spans.every(Boolean), `${spans.filter(Boolean).length}/${spans.length}`);
          const scopeText = (await page.locator('[data-edition-content]').allInnerTexts()).join('\n');
          const left = new RegExp(`.{0,35}${language.left.source}.{0,35}`, language.left.flags);
          check(
            `${where}: no relative wording remains, islands included`,
            !language.left.test(scopeText) && scopeText.includes(label),
            scopeText.match(left)?.[0] ?? `no "${label}"`,
          );
          const title = await titles(page, route);
          check(
            `${where}: the tab title reads as the server's dated`,
            title.live === datedEditionTitleIn(locale, title.server) && !language.left.test(title.live)
              && (locale === 'en' || title.live !== title.server),
            JSON.stringify(title),
          );
          check(`${where}: no page errors`, errors.length === 0, errors.join(' | '));

          if (viewport === viewports[0]) {
            // Chromium holds back a text run until its end arrives, but a
            // parser may also append to a text node after its start was
            // dated, as here: "Today" is dated, then ", read" follows (in
            // Spanish and Portuguese, the start of the Moon's line).
            const appended = await page.evaluate(async ([start, rest]) => {
              const node = document.createTextNode('');
              const paragraph = document.createElement('p');
              paragraph.append(node);
              document.querySelector('[data-edition-content]').append(paragraph);
              await new Promise((resolve) => setTimeout(resolve));
              node.nodeValue = start;
              await new Promise((resolve) => setTimeout(resolve));
              node.appendData(rest);
              await new Promise((resolve) => setTimeout(resolve));
              const text = node.nodeValue;
              paragraph.remove();
              return text;
            }, language.append);
            const expectedAppend = dated(language.append.join(''));
            check(`${route} dated: text appended after its start was dated reads as one dated text`, appended === expectedAppend, appended);
          }
        } finally {
          await context.close();
        }
      }

      const where = `${route} ${viewports[1].width}px current`;
      const { context, page, errors, status } = await open(route, viewports[1], currentNow);
      try {
        check(`${where}: answers 200`, status === 200, String(status));
        await settle(page);
        check(`${where}: the edition is current`, await page.getAttribute('html', 'data-edition-state') === 'current');
        const shifts = await page.evaluate(() => globalThis.__editionShifts);
        check(`${where}: CLS is exactly 0`, total(shifts) === 0, JSON.stringify(shifts));
        const spans = await page.$$eval('[data-edition-text]', (elements) => elements.map((element) => (
          element.textContent === element.getAttribute('data-edition-current')
        )));
        check(`${where}: EditionText shows its current form`, spans.every(Boolean), `${spans.filter(Boolean).length}/${spans.length}`);
        const texts = await scopeTexts(page, route);
        const changed = texts.server.flatMap((text, index) => (texts.live[index] === text ? [] : [{ live: texts.live[index], server: text }]));
        check(
          `${where}: every text node keeps the server's wording`,
          texts.live.length === texts.server.length && changed.length === 0 && texts.server.some((text) => new RegExp(language.word.source, 'u').test(text)),
          `${texts.live.length}/${texts.server.length} nodes; ${JSON.stringify(changed.slice(0, 2))}`,
        );
        const title = await titles(page, route);
        check(`${where}: the tab title keeps the server's wording`, title.live === title.server, JSON.stringify(title));
        check(`${where}: no page errors`, errors.length === 0, errors.join(' | '));
      } finally {
        await context.close();
      }
    }

    // Without JavaScript nothing decides the state: EditionText keeps the
    // dated server form, which is true whichever day it is read.
    const { context, page } = await open('/today/', viewports[0], datedNow, false);
    try {
      check('/today/ without JavaScript: no state is decided', await page.getAttribute('html', 'data-edition-state') === null);
      const heading = await page.locator('.today-hero h1').innerText();
      check('/today/ without JavaScript: the heading is dated', heading === `The sky on ${editionDateLabel(editionDate)}`, heading);
    } finally {
      await context.close();
    }
    console.log(`Chromium ${browser.version()} · edition ${editionDate} · dated clock ${new Date(datedNow).toISOString()}`);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

try {
  await withPreview({ port: 4396 }, editionLayoutStreaming);
  check('Partly streamed edition controls and wheel: CLS is exactly 0', true);
} catch (error) {
  check('Partly streamed edition controls and wheel: CLS is exactly 0', false, error.message);
}

let failures = 0;
for (const result of results) {
  if (!result.ok) failures += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail && !result.ok ? ` · ${result.detail}` : ''}`);
}
console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
process.exit(failures ? 1 : 0);
