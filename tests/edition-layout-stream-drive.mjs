import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

// A response can pause between the period switch and the sign rail, or
// between a sign's image and its label. Both controls must have their final
// geometry before those later children arrive. Centred flex rows used to
// move the period switch down when the taller sign rail finished parsing.
// Today's wheel similarly needs its square reserved before the SVG arrives:
// otherwise the already painted decorative disc changes its position.
export async function editionLayoutStreaming(baseURL) {
  const publication = JSON.parse(await readFile(new URL('../src/data/daily-publication.json', import.meta.url), 'utf8'));
  const editionClock = Date.parse(`${publication.date}T00:17:00Z`);
  const datedClock = editionClock + 86_400_000;
  const response = await fetch(new URL('/horoscopes/aries/', baseURL));
  assert.equal(response.status, 200);
  const html = await response.text();
  const periods = html.indexOf('class="seg program__periods');
  const rail = html.indexOf('class="hz-signrail"', periods);
  const image = html.indexOf('</picture>', rail);
  const cuts = {
    periods: html.indexOf('</nav>', periods) + '</nav>'.length,
    icon: image + '</picture>'.length,
  };
  assert.ok(periods > 0 && rail > periods && image > rail, 'The real horoscope controls must be present');

  const todayResponse = await fetch(new URL('/today/', baseURL));
  assert.equal(todayResponse.status, 200);
  const todayHTML = await todayResponse.text();
  const wheel = todayHTML.indexOf('<div class="today-wheel"');
  assert.ok(wheel > 0, 'The real Today wheel must be present');
  const wheelCut = todayHTML.indexOf('>', wheel) + 1;
  // Pause after the last motion glyph. Every edition has at least Mercury's
  // direct or retrograde status, even when no other planet is retrograde.
  const motionItem = Math.max(
    todayHTML.lastIndexOf('class="skyticker__item skyticker__item--retro"'),
    todayHTML.lastIndexOf('class="skyticker__item skyticker__item--direct"'),
  );
  const glyphEnd = '</svg></span>';
  const glyph = todayHTML.indexOf(glyphEnd, motionItem);
  assert.ok(motionItem > wheel && glyph > motionItem, 'The Today ticker must include a motion glyph');
  const tickerCut = glyph + glyphEnd.length;

  function afterTag(source, marker, end) {
    const element = source.indexOf(marker, source.indexOf('<body'));
    const close = source.indexOf(end, element);
    assert.ok(element >= 0 && close > element, `Missing streamed boundary at ${marker} ... ${end}`);
    return close + end.length;
  }

  for (const cut of Object.values(cuts)) assert.ok(cut > periods, 'Every control pause must be inside the controls');
  const pages = new Map([
    ['/horoscopes/aries/', { html, cuts: { ...cuts, brand: afterTag(html, 'class="nav__mark"', '</a>') } }],
    ['/today/', { html: todayHTML, cuts: { wheel: wheelCut, ticker: tickerCut } }],
  ]);
  const hubs = ['/es/horoscopes/', '/pt/horoscopes/'];
  for (const path of hubs) {
    const response = await fetch(new URL(path, baseURL));
    assert.equal(response.status, 200);
    const html = await response.text();
    // Split the visible teaser itself, even when the date and reading wrap.
    const label = html.indexOf('class="hhl-card__label"');
    const go = html.indexOf('class="hhl-card__go"', label);
    const teaser = [...html.slice(label, go).matchAll(/>([^<>]{24,})</gu)].at(-1);
    assert.ok(label > 0 && go > label && teaser, `Missing card reading on ${path}`);
    const picker = afterTag(html, 'class="hhl-picker"', '</picture>');
    const name = html.indexOf('>', html.indexOf('<span', picker)) + 1;
    assert.match(html.slice(name), /^(Aries|Áries)</u);
    pages.set(path, { html, cuts: {
      picker,
      name: name + 1,
      date: afterTag(html, 'class="hhl-card__label"', '</span>'),
      card: afterTag(html, 'class="hhl-grid"', '</a>'),
      teaser: label + teaser.index + 1 + 18,
    } });
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://local');
      const page = pages.get(url.pathname);
      if (page) {
        const cut = page.cuts[url.searchParams.get('pause')];
        assert.ok(cut > 0, `Unknown pause on ${url.pathname}`);
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.write(page.html.slice(0, cut));
        await new Promise(resolve => setTimeout(resolve, 600));
        res.end(page.html.slice(cut));
        return;
      }
      const asset = await fetch(new URL(req.url, baseURL));
      res.writeHead(asset.status, { 'content-type': asset.headers.get('content-type') ?? 'application/octet-stream' });
      res.end(Buffer.from(await asset.arrayBuffer()));
    } catch (error) {
      if (!res.headersSent) res.writeHead(500);
      res.end(String(error));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const failures = [];
  try {
    browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
    const scenarios = [
      ...[360, 900, 1280].flatMap(width => Object.keys(cuts).map(pause => ({ path: '/horoscopes/aries/', width, pause }))),
      { path: '/horoscopes/aries/', width: 1280, pause: 'brand' },
      ...hubs.flatMap(path => [
        { path, width: 360, pause: 'picker' },
        { path, width: 700, pause: 'name' },
        { path, width: 900, pause: 'date' },
        { path, width: 1280, pause: 'card' },
        { path, width: 900, pause: 'teaser' },
      ]),
      ...[360, 412, 1280].map(width => ({ path: '/today/', width, pause: 'wheel' })),
      ...[360, 900].map(width => ({ path: '/today/', width, height: 1400, pause: 'ticker' })),
    ];
    for (const { path, width, height = 1600, pause } of scenarios) {
      const context = await browser.newContext({ viewport: { width, height } });
      try {
        if (pause === 'brand' || hubs.includes(path)) {
          await context.route('**/fonts/**', async route => {
            await new Promise(resolve => setTimeout(resolve, 300));
            await route.continue();
          });
        }
        const page = await context.newPage();
        await page.addInitScript(({ now }) => {
          const NativeDate = Date;
          function FixedDate(...args) {
            if (!new.target) return new NativeDate(now).toString();
            return Reflect.construct(NativeDate, args.length ? args : [now], new.target);
          }
          Object.setPrototypeOf(FixedDate, NativeDate);
          FixedDate.prototype = NativeDate.prototype;
          FixedDate.now = () => now;
          globalThis.Date = FixedDate;
          window.__controlShifts = [];
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              if (entry.hadRecentInput) continue;
              window.__controlShifts.push({
                value: entry.value,
                sources: (entry.sources ?? []).map(source => ({
                  node: source.node?.nodeName,
                  class: source.node?.className,
                  before: source.previousRect,
                  after: source.currentRect,
                })),
              });
            }
          }).observe({ type: 'layout-shift', buffered: true });
        }, { now: pause === 'ticker' ? editionClock : datedClock });
        await page.goto(`http://127.0.0.1:${server.address().port}${path}?pause=${pause}`, { waitUntil: 'networkidle' });
        if (pause === 'ticker') {
          await page.waitForSelector('[data-today-state="empty"]');
        }
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const shifts = await page.evaluate(() => window.__controlShifts);
        const cls = shifts.reduce((sum, shift) => sum + shift.value, 0);
        const scenario = `${path} ${width}px response paused after ${pause}`;
        console.log(JSON.stringify({ scenario, cls, shifts }));
        if (cls !== 0) failures.push(`${scenario}: ${cls}`);
        if (path === '/horoscopes/aries/') {
          assert.equal(await page.locator('.hz-signrail a').count(), 12);
          assert.equal(await page.locator('.hz-signrail a[aria-current="page"]').count(), 1);
        } else if (hubs.includes(path)) {
          assert.equal(await page.locator('.hhl-picker a').count(), 12);
          assert.equal(await page.locator('.hhl-grid a').count(), 12);
        } else {
          assert.equal(await page.locator('.today-wheel svg').first().count(), 1);
        }
      } finally {
        await context.close();
      }
    }
    assert.deepEqual(failures, [], 'Streamed edition layouts must have exactly zero CLS');
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await withPreview({ port: 4396 }, editionLayoutStreaming);
}
