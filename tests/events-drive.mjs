/**
 * Browser contract for the Phase 2 sky-events surface.
 *
 *   npm run build
 *   OUT_DIR=/tmp/events node tests/events-drive.mjs
 *
 * Point ZODIACS_TEST_BASE_URL at an existing preview to skip spawning one.
 *
 * Verifies, per the Phase 2 frontend contract: meaning before machinery,
 * closed-by-default evidence, real no-JavaScript rendering (computed
 * opacity, not element presence), keyboard operability, reduced motion,
 * mobile/desktop overflow, resolvable related-event links, exact publication
 * allowlisting across metadata/search/sitemap/RSS, daily cross-links, and
 * fixture isolation.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const OUT = process.env.OUT_DIR ?? null;
const CHROMIUM = await findChromium();
if (OUT) await mkdir(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const eventsPublication = JSON.parse(await readFile(
  new URL('../src/data/events-publication.json', import.meta.url),
  'utf8',
));
const dailyPublication = JSON.parse(await readFile(
  new URL('../src/data/daily-publication.json', import.meta.url),
  'utf8',
));
const publishedPaths = new Set([
  ...(eventsPublication.hub.indexEligible ? [eventsPublication.hub.path] : []),
  ...eventsPublication.pages.map((event) => event.path),
]);
const isPhase2EventPath = (path) => (
  path === '/events/'
  || /^\/events\/(?!preview(?:\/|$))[a-z0-9-]+\/$/.test(path)
  || /^\/(?:full-moon|new-moon|eclipses|(?:mercury|venus|mars)-retrograde)\/\d{4}-\d{2}-\d{2}\/$/.test(path)
);
const exactSet = (actual, expected) => (
  actual.size === expected.size && [...actual].every((value) => expected.has(value))
);

function expectedDailyLinks(date) {
  const start = new Date(`${date}T00:00:00.000Z`).getTime();
  const end = start + 6 * 86_400_000;
  const candidates = eventsPublication.pages
    .filter((event) => {
      const anchor = new Date(event.anchor).getTime();
      return anchor >= start && anchor < end;
    })
    .sort((left, right) => left.anchor.localeCompare(right.anchor) || left.id.localeCompare(right.id));
  const eclipseDays = new Set(candidates
    .filter((event) => event.family === 'eclipse')
    .map((event) => event.anchor.slice(0, 10)));
  return candidates
    .filter((event) => event.family !== 'lunation' || !eclipseDays.has(event.anchor.slice(0, 10)))
    .slice(0, 3)
    .map((event) => event.path);
}

// Routes pinned by src/lib/events/catalog.test.ts against the committed data.
const HUB = '/events/';
const FULL_MOON = '/full-moon/2026-07-29/';
const NEW_MOON = '/new-moon/2026-08-12/';
const ECLIPSE = '/eclipses/2026-08-12/';
const MERCURY_RX = '/mercury-retrograde/2026-06-29/';
const VENUS_RX = '/venus-retrograde/2026-10-03/';
const INGRESS = '/events/saturn-enters-aries-2026-02-14/';
const ASPECT = '/events/jupiter-trine-saturn-2026-08-31/';
const PREVIEW_INDEX = '/events/preview/';
const FIXTURE_RICH = '/events/preview/sample-aspect/';
const FIXTURE_MINIMAL = '/events/preview/sample-full-moon/';
const EVENT_PAGES = [FULL_MOON, NEW_MOON, ECLIPSE, MERCURY_RX, VENUS_RX, INGRESS, ASPECT];

await withPreview({ port: 4412 }, async (BASE) => {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: STABLE_CHROMIUM_ARGS,
  });

  const trackErrors = (page, bucket) => {
    page.on('pageerror', (error) => bucket.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') bucket.push(`console: ${message.text()}`);
    });
  };

  const overflow = (page) => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);

  try {
    // ── Hub, desktop 1280 ────────────────────────────────────────────
    {
      const errors = [];
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      trackErrors(page, errors);
      await page.goto(`${BASE}${HUB}`, { waitUntil: 'networkidle' });
      check('hub: h1 is Sky events', await page.locator('h1').innerText() === 'Sky events');
      check('hub: publication receipt makes the route indexable',
        !(await page.locator('meta[name="robots"]').getAttribute('content'))?.includes('noindex'));
      check('hub: self-canonical URL',
        await page.locator('link[rel="canonical"]').getAttribute('href') === `https://zodiacs.org${HUB}`);
      check('hub: event RSS is discoverable',
        await page.locator('link[rel="alternate"][href="/feeds/events.xml"]').count() === 1);
      check('hub: now band renders one status line', await page.locator('.evhub-now__line').count() === 1);
      check('hub: three next-up tiles', await page.locator('.evhub-next__tile').count() === 3);
      check('hub: month sections render', await page.locator('[data-event-month]').count() > 12);
      check('hub: rows carry family marks', await page.locator('[data-event-row] .evmark').count() > 40);
      check('hub: desktop has no horizontal overflow', (await overflow(page)) <= 0);
      check(
        'hub: how-to prose sits after the calendar',
        await page.evaluate(() => {
          const calendar = document.querySelector('[data-event-month]');
          const heads = [...document.querySelectorAll('h2')];
          const howTo = heads.find((h) => h.textContent.includes('How to use this calendar'));
          return Boolean(calendar && howTo
            && (calendar.compareDocumentPosition(howTo) & Node.DOCUMENT_POSITION_FOLLOWING));
        }),
      );
      const disclosure = page.locator('[data-evidence-disclosure]');
      check('hub: methodology disclosure exists and starts closed',
        await disclosure.count() === 1 && !(await disclosure.evaluate((node) => node.open)));

      // Filter enhancement.
      const filter = page.locator('[data-event-filter]');
      check('hub: filter chips appear with JavaScript', await filter.evaluate((node) => node.classList.contains('is-ready')));
      check('hub: Everything chip starts pressed',
        await page.locator('[data-filter="all"]').getAttribute('aria-pressed') === 'true');
      await page.locator('[data-filter="eclipse"]').click();
      check('hub: eclipse filter presses its chip',
        await page.locator('[data-filter="eclipse"]').getAttribute('aria-pressed') === 'true');
      check('hub: eclipse filter leaves only eclipse rows visible', await page.evaluate(() => {
        const visible = [...document.querySelectorAll('[data-event-row]:not([hidden])')];
        return visible.length > 0 && visible.every((row) => row.getAttribute('data-family') === 'eclipse');
      }));
      check('hub: months without eclipses hide while filtered', await page.evaluate(() => {
        const months = [...document.querySelectorAll('[data-event-month]')];
        return months.some((month) => month.hidden)
          && months.filter((month) => !month.hidden)
            .every((month) => month.querySelector('[data-event-row]:not([hidden])'));
      }));
      if (OUT) await page.screenshot({ path: `${OUT}/hub-1280-filter-eclipses.png`, fullPage: false });
      await page.locator('[data-filter="all"]').click();
      check('hub: Everything restores all rows', await page.evaluate(() =>
        [...document.querySelectorAll('[data-event-row]')].every((row) => !row.hidden)));

      // Keyboard: Tab (real keyboard, so :focus-visible engages) must reach
      // the chips and draw a visible ring.
      await page.reload({ waitUntil: 'networkidle' });
      let chipFocused = false;
      for (let step = 0; step < 120 && !chipFocused; step += 1) {
        await page.keyboard.press('Tab');
        chipFocused = await page.evaluate(() =>
          document.activeElement?.matches('[data-event-filter] button') ?? false);
      }
      check('hub: filter chips are reachable by keyboard', chipFocused);
      check('hub: keyboard-focused chip shows a visible outline', await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement);
        return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      }));
      if (OUT) await page.screenshot({ path: `${OUT}/hub-1280-keyboard-focus.png` });
      check('hub: zero console or page errors', errors.length === 0, errors.join(' | '));
      if (OUT) await page.screenshot({ path: `${OUT}/hub-1280.png`, fullPage: true });
      await page.close();
    }

    // ── Hub, mobile 360 ──────────────────────────────────────────────
    {
      const page = await browser.newPage({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: 'reduce' });
      await page.goto(`${BASE}${HUB}`, { waitUntil: 'networkidle' });
      check('hub 360: no horizontal overflow', (await overflow(page)) <= 0);
      const chip = page.locator('[data-filter="all"]');
      const box = await chip.boundingBox();
      check('hub 360: filter chips meet touch-target height', Boolean(box && box.height >= 40), `h=${box?.height}`);
      if (OUT) await page.screenshot({ path: `${OUT}/hub-360-viewport.png` });
      if (OUT) await page.screenshot({ path: `${OUT}/hub-360.png`, fullPage: true });
      await page.close();
    }

    // ── Hub, no JavaScript ───────────────────────────────────────────
    {
      const page = await browser.newPage({ viewport: { width: 900, height: 800 }, javaScriptEnabled: false });
      await page.goto(`${BASE}${HUB}`, { waitUntil: 'networkidle' });
      check('hub no-JS: hero is actually visible (computed opacity 1)',
        await page.locator('.tool-hero').evaluate((node) => getComputedStyle(node).opacity === '1'));
      check('hub no-JS: timeline rows are actually visible',
        await page.locator('[data-event-month]').first().evaluate((node) => getComputedStyle(node).opacity === '1'));
      check('hub no-JS: filter chips stay hidden (no fake controls)',
        await page.locator('[data-event-filter]').evaluate((node) => getComputedStyle(node).display === 'none'));
      check('hub no-JS: every row remains visible', await page.evaluate(() =>
        [...document.querySelectorAll('[data-event-row]')].every((row) => !row.hidden)));
      check('hub no-JS: disclosure still opens natively', await page.evaluate(() => {
        const details = document.querySelector('[data-evidence-disclosure]');
        return details instanceof HTMLDetailsElement && !details.open;
      }));
      if (OUT) await page.screenshot({ path: `${OUT}/hub-nojs-900.png`, fullPage: true });
      await page.close();
    }

    // ── Hub, reduced motion ──────────────────────────────────────────
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      await page.goto(`${BASE}${HUB}`, { waitUntil: 'networkidle' });
      check('hub reduced-motion: content visible without animation', await page.evaluate(() => {
        const hero = document.querySelector('.tool-hero');
        const style = getComputedStyle(hero);
        return style.opacity === '1' && (style.transitionDuration === '0s' || style.transitionProperty === 'none');
      }));
      if (OUT) await page.screenshot({ path: `${OUT}/hub-1280-reduced-motion.png` });
      await page.close();
    }

    // ── Every event page: hierarchy, disclosure, indexing, overflow ──
    for (const route of EVENT_PAGES) {
      const errors = [];
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      trackErrors(page, errors);
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });

      check(`${route}: lead paragraph before facts, facts before evidence`, await page.evaluate(() => {
        const lead = document.querySelector('[data-event-lead]');
        const facts = document.querySelector('[data-event-facts]');
        const evidence = document.querySelector('[data-event-evidence]');
        const follows = (a, b) => Boolean(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
        return follows(lead, facts) && follows(facts, evidence);
      }));
      const disclosure = page.locator('[data-evidence-disclosure]');
      check(`${route}: evidence disclosure closed by default`,
        await disclosure.count() === 1 && !(await disclosure.evaluate((node) => node.open)));
      check(`${route}: included in the publication receipt`, publishedPaths.has(route));
      check(`${route}: published page is indexable`,
        !(await page.locator('meta[name="robots"]').getAttribute('content'))?.includes('noindex'));
      check(`${route}: self-canonical URL`,
        await page.locator('link[rel="canonical"]').getAttribute('href') === `https://zodiacs.org${route}`);
      check(`${route}: event RSS is discoverable`,
        await page.locator('link[rel="alternate"][href="/feeds/events.xml"]').count() === 1);
      check(`${route}: back-link leads to the hub`,
        await page.locator('.event-hero .crumb[href="/events/"]').count() === 1);
      check(`${route}: desktop has no horizontal overflow`, (await overflow(page)) <= 0);
      check(`${route}: zero console or page errors`, errors.length === 0, errors.join(' | '));

      // Related links resolve.
      const relatedHrefs = await page.evaluate(() =>
        [...document.querySelectorAll('.event-pair__link, .event-near a, .event-crossref a')]
          .map((a) => a.getAttribute('href')));
      let resolved = true;
      for (const href of relatedHrefs) {
        const target = href.split('#')[0];
        const response = await page.request.get(`${BASE}${target}`);
        if (response.status() !== 200) { resolved = false; break; }
      }
      check(`${route}: every related-event link resolves`, resolved, relatedHrefs.join(' '));
      await page.close();
    }

    // ── Buck Moon page: the full composition ─────────────────────────
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      await page.goto(`${BASE}${FULL_MOON}`, { waitUntil: 'networkidle' });
      check('full moon: heading names the Buck Moon',
        (await page.locator('h1').innerText()).includes('Buck Moon'));
      check('full moon: dateline carries the exact UTC clock',
        (await page.locator('.event-hero__when').innerText()).includes('14:35 UTC'));
      check('full moon: twelve sign notes with anchors',
        await page.locator('.event-signs__item').count() === 12
        && await page.locator('#for-aquarius').count() === 1);
      check('full moon: sign notes keep pastel icons',
        await page.locator('.event-signs__item .sign-icon img').count() === 12);
      check('full moon: previous and next full moons are linked',
        await page.locator('.event-pair__link[data-direction="previous"]').count() === 1
        && await page.locator('.event-pair__link[data-direction="next"]').count() === 1);
      check('full moon: nearby events carry visible reasons',
        await page.locator('.event-near__reason').count() > 0);
      const personalTransitAction = page.locator('.btn--primary');
      check('full moon: one primary action, to personal transits at the exact event instant',
        await personalTransitAction.count() === 1
        && await personalTransitAction.getAttribute('href')
          === '/transits/?at=2026-07-29T14%3A35%3A42.223Z'
        && (await personalTransitAction.innerText()).trim() === 'See this event with my chart');

      // Open the evidence by keyboard and confirm the receipts show.
      const summary = page.locator('[data-evidence-disclosure] summary');
      await summary.focus();
      await page.keyboard.press('Enter');
      check('full moon: evidence opens by keyboard',
        await page.locator('[data-evidence-disclosure]').evaluate((node) => node.open));
      check('full moon: opened evidence lists the exact instant',
        (await page.locator('.event-evidence__rows').innerText()).includes('2026-07-29T14:35'));
      if (OUT) await page.screenshot({ path: `${OUT}/full-moon-1280-evidence-open.png`, fullPage: true });
      await page.close();

      const mobile = await browser.newPage({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: 'reduce' });
      await mobile.goto(`${BASE}${FULL_MOON}`, { waitUntil: 'networkidle' });
      check('full moon 360: no horizontal overflow', (await overflow(mobile)) <= 0);
      if (OUT) await mobile.screenshot({ path: `${OUT}/full-moon-360.png`, fullPage: true });
      await mobile.close();
    }

    // ── Eclipse page: crossref + visible limitation ──────────────────
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      await page.goto(`${BASE}${ECLIPSE}`, { waitUntil: 'networkidle' });
      check('eclipse: cross-references its new moon',
        await page.locator(`.event-crossref a[href="${NEW_MOON}"]`).count() === 1);
      check('eclipse: visibility limitation stays visible outside the disclosure',
        await page.locator('[data-event-limits]').count() === 1
        && (await page.locator('[data-event-limits]').innerText()).includes('ground track'));
      check('eclipse: limitation is not buried inside the closed details', await page.evaluate(() => {
        const limits = document.querySelector('[data-event-limits]');
        return Boolean(limits && !limits.closest('details'));
      }));
      if (OUT) await page.screenshot({ path: `${OUT}/eclipse-1280.png`, fullPage: true });
      await page.close();
    }

    // ── Retrograde page: complete station and shadow window ──────
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      await page.goto(`${BASE}${MERCURY_RX}`, { waitUntil: 'networkidle' });
      const facts = await page.locator('.event-facts__core').innerText();
      const normalizedFacts = facts.toLowerCase();
      check('mercury rx: both stations dated in the facts band',
        facts.includes('June 29, 2026') && facts.includes('July 23, 2026'));
      check('mercury rx: cycle named entirely within Cancer', facts.toLowerCase().includes('cancer'));
      const limitationCount = await page.locator('[data-event-limits]').count();
      check('mercury rx: verified shadow boundaries replace the old limitation',
        normalizedFacts.includes('pre-shadow begins')
        && facts.includes('June 13, 2026')
        && normalizedFacts.includes('post-shadow ends')
        && facts.includes('August 7, 2026')
        && limitationCount === 0,
        `limitations=${limitationCount} facts=${JSON.stringify(facts)}`);
      if (OUT) await page.screenshot({ path: `${OUT}/mercury-retrograde-1280.png`, fullPage: true });
      const mobile = await browser.newPage({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: 'reduce' });
      await mobile.goto(`${BASE}${MERCURY_RX}`, { waitUntil: 'networkidle' });
      check('mercury rx 360: no horizontal overflow', (await overflow(mobile)) <= 0);
      if (OUT) await mobile.screenshot({ path: `${OUT}/mercury-retrograde-360.png`, fullPage: true });
      await mobile.close();
      await page.close();
    }

    // ── Ingress + aspect pages, 360 sweep ────────────────────────────
    for (const [route, name] of [[INGRESS, 'ingress'], [ASPECT, 'aspect']]) {
      const page = await browser.newPage({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: 'reduce' });
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      check(`${name} 360: no horizontal overflow`, (await overflow(page)) <= 0);
      check(`${name} 360: lead paragraph present`,
        (await page.locator('[data-event-lead]').innerText()).length > 80);
      if (OUT) await page.screenshot({ path: `${OUT}/${name}-360.png`, fullPage: true });
      await page.close();
    }

    // ── Publication boundaries, RSS, daily links, fixture isolation ──
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      await page.goto(`${BASE}${FIXTURE_RICH}`, { waitUntil: 'networkidle' });
      check('fixture: sample banner is visible',
        (await page.locator('[data-event-sample]').innerText()).includes('Sample'));
      check('fixture: noindex robots meta',
        (await page.locator('meta[name="robots"]').getAttribute('content'))?.includes('noindex') === true);
      await page.goto(`${BASE}${FIXTURE_MINIMAL}`, { waitUntil: 'networkidle' });
      check('fixture minimal: renders the fact-grounded fallback lead without authored copy',
        (await page.locator('[data-event-lead]').innerText()).includes('still to come'));
      check('fixture minimal: no reading section renders for absent interpretation',
        await page.locator('[data-event-reading]').count() === 0);
      await page.goto(`${BASE}${PREVIEW_INDEX}`, { waitUntil: 'networkidle' });
      check('preview index: lists every fixture with its banner',
        await page.locator('.preview-list a').count() === 3
        && (await page.locator('[data-event-sample]').innerText()).includes('sample data'));
      const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
      const sitemapEventPaths = new Set(
        [...sitemap.matchAll(/<loc>https:\/\/zodiacs\.org([^<]+)<\/loc>/g)]
          .map((match) => match[1])
          .filter(isPhase2EventPath),
      );
      check(
        'sitemap: exact publication allowlist',
        exactSet(sitemapEventPaths, publishedPaths),
        `actual=${sitemapEventPaths.size} expected=${publishedPaths.size}`,
      );

      const searchIndex = await (await fetch(`${BASE}/search-index.json`)).json();
      const searchEventPaths = new Set(searchIndex
        .map((entry) => entry.path)
        .filter((path) => !path.includes('#') && isPhase2EventPath(path)));
      check(
        'search index: exact publication allowlist',
        exactSet(searchEventPaths, publishedPaths),
        `actual=${searchEventPaths.size} expected=${publishedPaths.size}`,
      );

      const eventsFeed = await (await fetch(`${BASE}/feeds/events.xml`)).text();
      const feedIds = new Set(
        [...eventsFeed.matchAll(/<guid isPermaLink="false">https:\/\/zodiacs\.org\/feeds\/events\/([^<]+)<\/guid>/g)]
          .map((match) => match[1]),
      );
      const feedPaths = new Set(
        [...eventsFeed.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<\/item>/g)]
          .map((match) => {
            const url = new URL(match[1]);
            return `${url.pathname}${url.hash}`;
          }),
      );
      const expectedFeedPaths = new Set(eventsPublication.timeline.map((event) => event.path));
      check(
        'events RSS: exact timeline ids',
        exactSet(feedIds, new Set(eventsPublication.timeline.map((event) => event.id))),
        `actual=${feedIds.size} expected=${eventsPublication.timeline.length}`,
      );
      check(
        'events RSS: exact timeline links',
        exactSet(feedPaths, expectedFeedPaths),
        `actual=${feedPaths.size} expected=${expectedFeedPaths.size}`,
      );

      const expectedLinks = expectedDailyLinks(dailyPublication.date);
      for (const route of ['/today/', '/horoscopes/aries/']) {
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
        const actualLinks = await page.locator('[data-daily-event-links] a').evaluateAll((anchors) => (
          anchors.map((anchor) => anchor.getAttribute('href'))
        ));
        check(
          `${route}: exact next-five-day event links`,
          JSON.stringify(actualLinks) === JSON.stringify(expectedLinks),
          `actual=${actualLinks.join(',')} expected=${expectedLinks.join(',')}`,
        );
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

let failures = 0;
for (const result of results) {
  if (!result.ok) failures += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` · ${result.detail}` : ''}`);
}
console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
process.exit(failures ? 1 : 0);
