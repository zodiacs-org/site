/**
 * Local-day uncertainty checks in the existing Explorer browser drive.
 *
 * Since `9d180c9f` an unknown birth time yields NO Moon sign candidates:
 * two endpoint samples of a civil date do not establish coverage of it, so
 * a reference instant cannot verify which signs the Moon could occupy. The
 * Moon stays present and explicitly unresolved instead.
 *
 * These checks therefore assert the absence of a claim, which is easy to
 * pass by accident. They are kept strict by requiring the unresolved label
 * to be present on every surface AND forbidding every sign name on the Moon
 * surfaces -- not merely the old pair -- so reintroducing any inferred sign,
 * single or paired, fails here.
 */
import { mkdir } from 'node:fs/promises';

const TIMEOUT = 30_000;
/** The pair the old endpoint inference produced. Now forbidden, not expected. */
const CANDIDATES = 'Aquarius / Pisces';
const UNRESOLVED = 'Needs a birth time';
/** Copy belonging to the retired "both neighbours are fair" behaviour. */
const RETIRED_NOTICE = 'The Moon also changed signs that day';
const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];
/** Any sign name surfacing on a Moon-only element is an unverified claim. */
const namesIn = (text) => SIGN_NAMES.filter((name) => new RegExp(`\\b${name}\\b`).test(text));
const boundaryFragment = `#c=1.${Buffer.from(JSON.stringify({
  d: '1990-01-01', z: 'Europe/London', la: 51.5074, lo: -0.1278, p: 'London',
})).toString('base64url')}`;

async function waitForResult(page) {
  await page.locator('.reading-path').waitFor({ state: 'visible', timeout: TIMEOUT });
  await page.waitForFunction(() => document.querySelector('.calc__form')?.getAttribute('aria-busy') === 'false', null, { timeout: TIMEOUT });
}

async function recompute(page, date, known) {
  await page.locator('#birth-date').fill(date);
  await page.locator('.field__toggle input[type="checkbox"]').setChecked(!known);
  if (known) await page.locator('#birth-time').fill('12:00');
  await page.locator('.calc__form button[type="submit"]').click();
  await waitForResult(page);
}

export async function runExplorerMoonChecks({ browser, baseURL, check, outDir }) {
  if (outDir) await mkdir(outDir, { recursive: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      globalThis.__moonPositionsLink = null;
      Object.defineProperty(Navigator.prototype, 'clipboard', {
        configurable: true,
        get: () => ({ writeText: async (value) => { globalThis.__moonPositionsLink = value; } }),
      });
    });
    try {
      const page = await context.newPage();
      await page.goto(`${baseURL}/birth-chart/${boundaryFragment}`, { waitUntil: 'domcontentloaded' });
      await waitForResult(page);
      const hero = page.locator('.calc__three [data-moon-uncertain]');
      const heroText = await hero.innerText();
      const readingMoon = page.locator('.reading-path__big-three [data-moon-uncertain]');
      const links = await page.locator('.reading-path__placement-link').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')).sort());
      const readingMoonText = await readingMoon.innerText();
      check(`Moon ${width}: London boundary leaves the Moon unresolved in hero and story, with no inferred signs`,
        heroText.includes(UNRESOLVED) && namesIn(heroText).length === 0
        && readingMoonText.includes(UNRESOLVED) && namesIn(readingMoonText).length === 0
        && !heroText.includes(CANDIDATES) && !readingMoonText.includes(CANDIDATES)
        // No placement link may be offered for a sign the chart cannot establish.
        && JSON.stringify(links) === JSON.stringify([])
        // No reference degree may stand in for the unresolved position.
        && await hero.locator('.three-card__deg').count() === 0,
        JSON.stringify({ heroText, readingMoonText, links, heroNames: namesIn(heroText), storyNames: namesIn(readingMoonText) }));
      check(`Moon ${width}: the retired both-neighbours notice is gone from the result`,
        !(await page.locator('.reading-path').innerText()).includes(RETIRED_NOTICE)
        && !(await page.locator('.calc__three').innerText()).includes(RETIRED_NOTICE));
      check(`Moon ${width}: uncertain body is excluded from definitive balance and aspect readings`,
        (await page.locator('.reading-path').innerText()).includes('The Moon is left out of these totals')
        && (await page.locator('.reading-path').innerText()).includes('Moon aspects need a birth time'));

      if (outDir) {
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        await page.locator('.calc__three').screenshot({ path: `${outDir}/moon-boundary-hero-${width}.png`, animations: 'disabled' });
        await page.locator('.reading-path__big-three').screenshot({ path: `${outDir}/moon-boundary-story-${width}.png`, animations: 'disabled' });
      }

      await page.locator('.reading-path__show[aria-label="Show on chart: Moon at the reference time"]').first().click();
      await page.waitForFunction(() => document.querySelector('.insp__body [data-moon-uncertain]')?.textContent?.includes('Needs a birth time'), null, { timeout: TIMEOUT });
      const inspectorText = await page.locator('.insp__body').innerText();
      const announcement = await page.locator('.calc__wheel .sr-only[role="status"]').innerText();
      const inspectorMoon = await page.locator('.insp__body [data-moon-uncertain]').innerText();
      check(`Moon ${width}: selecting the reference Moon keeps inspector and announcement unresolved`,
        inspectorMoon.includes(UNRESOLVED) && namesIn(inspectorMoon).length === 0
        // No sign interpretation may be offered for a sign that was not established.
        && !inspectorText.includes('How the sign shapes it')
        && !inspectorText.includes(CANDIDATES)
        && announcement.includes(UNRESOLVED) && !announcement.includes(CANDIDATES)
        && namesIn(announcement).length === 0,
        JSON.stringify({ inspectorMoon, announcement, announcementNames: namesIn(announcement) }));

      await page.locator('[data-explorer-entity-picker]').selectOption('');
      await page.locator('[data-first-reading-start]').click();
      await page.locator('[data-tour-card]').waitFor({ state: 'visible', timeout: TIMEOUT });
      const quickTour = await page.locator('[data-tour-card]').innerText();
      check(`Moon ${width}: quick tour reports the Moon unresolved and claims no sign`,
        quickTour.includes(UNRESOLVED) && !quickTour.includes(CANDIDATES)
        && await page.locator('[data-tour-card] a[href*="/learn/placements/moon-in-"]').count() === 0, quickTour);
      await page.locator('[data-tour-exit]').click();
      await page.locator('[data-first-reading-dismiss]').click();
      // Exercise the real mobile launcher cascade before and after the drawer
      // stylesheet arrives. Loading its public CSS avoids starting a private
      // conversation merely to verify the layering of a floating button.
      const launcher = page.locator('[data-guide-launcher]');
      const inlineGuide = page.locator('.calc__guide [data-assistant-open]');
      const usesInlineGuide = width <= 900;
      if (usesInlineGuide) {
        await inlineGuide.focus();
        check(`Moon ${width}: inline Guide replaces the floating launcher on mobile`,
          await launcher.isHidden() && await inlineGuide.isVisible()
          && await inlineGuide.evaluate((node) => document.activeElement === node));
      }
      for (const guideStyles of width < 960 ? ['bootstrap', 'loaded drawer CSS'] : ['bootstrap']) {
        if (guideStyles === 'loaded drawer CSS') {
          const [response] = await Promise.all([
            page.waitForResponse((item) => new URL(item.url()).pathname === '/assets/assistant-drawer.css', { timeout: TIMEOUT }),
            page.evaluate(() => {
              const link = document.createElement('link');
              link.rel = 'stylesheet'; link.href = '/assets/assistant-drawer.css';
              link.dataset.moonGuideStylesheet = '';
              document.head.append(link);
            }),
          ]);
          check('Moon mobile: real Guide drawer stylesheet loads successfully', response.status() === 200);
          await page.waitForFunction(() => Boolean(document.querySelector('[data-moon-guide-stylesheet]')?.sheet), null, { timeout: TIMEOUT });
        } else {
          check(`Moon ${width}: launcher begins with its bootstrap styles`, await page.locator('link[href*="/assets/assistant-drawer.css"]').count() === 0);
        }
        await launcher.waitFor({ state: usesInlineGuide ? 'hidden' : 'visible', timeout: TIMEOUT });
        await page.locator('[data-tour-start]').click();
        await page.locator('[data-tour-card]').waitFor({ state: 'visible', timeout: TIMEOUT });
        if (width < 960) {
          check(`Moon mobile ${guideStyles}: sheet removes the launcher from pointer and keyboard access`, await launcher.evaluate((node) => {
            const style = getComputedStyle(node);
            node.focus();
            return style.visibility === 'hidden' && style.pointerEvents === 'none' && document.activeElement !== node;
          }));
        }
        const bigThreeIndex = await page.locator('[data-tour-dot]').evaluateAll((nodes) => nodes.findIndex((node) => /big three/i.test(node.getAttribute('aria-label') ?? '')));
        if (bigThreeIndex < 0) throw new Error('Full tour is missing the Big Three chapter');
        await page.locator('[data-tour-dot]').nth(bigThreeIndex).click();
        const next = page.locator('[data-tour-next]');
        await next.scrollIntoViewIfNeeded();
        const ownership = await next.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          const x = rect.left + rect.width / 2; const y = rect.top + rect.height / 2;
          const hit = document.elementFromPoint(x, y);
          return { owned: x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && Boolean(hit && node.contains(hit)), hit: hit?.className?.baseVal ?? hit?.className ?? null };
        });
        check(`Moon ${width} ${guideStyles}: the real Next pointer target belongs to the tour`, ownership.owned, JSON.stringify(ownership));
        await next.click();
        await page.waitForFunction(() => document.querySelector('.tour__sub-receipt')?.textContent?.trim().startsWith('Moon'), null, { timeout: TIMEOUT });
        const tourReceipt = await page.locator('.tour__sub-receipt').innerText();
        check(`Moon ${width} ${guideStyles}: full tour Moon receipt stays unresolved, with no sign and no degree`,
          tourReceipt.includes(UNRESOLVED) && !tourReceipt.includes(CANDIDATES)
          && namesIn(tourReceipt).length === 0 && !tourReceipt.includes('°'), tourReceipt);
        if (outDir && width < 960) await page.locator('[data-tour-card]').screenshot({ path: `${outDir}/moon-tour-guide-${guideStyles === 'bootstrap' ? 'bootstrap' : 'loaded'}-390.png`, animations: 'disabled' });
        await page.locator('[data-tour-exit]').click();
        await launcher.waitFor({ state: usesInlineGuide ? 'hidden' : 'visible', timeout: TIMEOUT });
        if (usesInlineGuide) {
          await inlineGuide.focus();
          check(`Moon mobile ${guideStyles}: dismissal keeps inline Guide keyboard-accessible without restoring a duplicate launcher`,
            await launcher.isHidden() && await inlineGuide.evaluate((node) => document.activeElement === node));
        }
      }

      await page.locator('[data-chart-more] > summary').click();
      await page.locator('[data-share-options]').click();
      await page.locator('[data-share-dialog]').waitFor({ state: 'visible', timeout: TIMEOUT });
      await page.locator('[data-share-dialog] [data-positions-link]').click();
      await page.waitForFunction(() => typeof globalThis.__moonPositionsLink === 'string', null, { timeout: TIMEOUT });
      const positionsUrl = await page.evaluate(() => globalThis.__moonPositionsLink);
      const token = new URLSearchParams(new URL(positionsUrl).hash.slice(1)).get('p');
      if (!token?.startsWith('2.')) throw new Error('Expected the existing v2 positions contract');
      const wire = JSON.parse(Buffer.from(token.slice(2), 'base64url').toString('utf8'));
      check(`Moon ${width}: positions link omits time precision and candidate metadata`,
        JSON.stringify(Object.keys(wire).sort()) === JSON.stringify(['b', 'h', 'v']) && wire.b.length === 12);
      const receiver = await context.newPage();
      await receiver.goto(positionsUrl, { waitUntil: 'domcontentloaded' });
      const received = receiver.locator('[data-positions-only]');
      await received.waitFor({ state: 'visible', timeout: TIMEOUT });
      const receivedText = await received.innerText();
      const moonRow = received.locator('tbody tr').filter({ has: receiver.locator('td:first-child', { hasText: /^Moon$/ }) });
      check(`Moon ${width}: positions receiver keeps Moon unresolved without inventing a boundary`,
        (await received.locator('[data-moon-uncertain]').innerText()).includes(UNRESOLVED)
        && (await moonRow.locator('td').nth(2).innerText()) === UNRESOLVED
        && !receivedText.includes(CANDIDATES) && !receivedText.includes(RETIRED_NOTICE)
        && await receiver.locator('#birth-time').inputValue() === '');
      await receiver.close();

      if (width === 1440) {
        await page.locator('[data-share-dialog]').press('Escape');
        await recompute(page, '1990-01-01', true);
        const knownMoon = await page.locator('.calc__three .three-card').nth(1).innerText();
        check('Moon: recalculating with a known noon time clears the boundary state',
          knownMoon.includes('Pisces') && !knownMoon.includes('Aquarius')
          && await page.locator('.calc__three [data-moon-uncertain]').count() === 0
          && await page.locator('[data-explorer-entity-picker] option[value="angle:asc"]').count() === 1, knownMoon);
        // The Moon's endpoints agree on this date, which is exactly the
        // inference that was withdrawn: agreement at two samples is not
        // coverage of the date. It must stay unresolved like any other
        // unknown-time chart, while the angles remain unavailable.
        await recompute(page, '1990-01-02', false);
        const endpointAgreeingMoon = await page.locator('.calc__three .three-card').nth(1).innerText();
        check('Moon: an unknown-time date whose endpoints agree is still unresolved, and angles stay omitted',
          endpointAgreeingMoon.includes(UNRESOLVED)
          && namesIn(endpointAgreeingMoon).length === 0
          && await page.locator('.calc__three [data-moon-uncertain]').count() === 1
          && await page.locator('[data-explorer-entity-picker] option[value="angle:asc"]').count() === 0,
          JSON.stringify({ endpointAgreeingMoon, names: namesIn(endpointAgreeingMoon) }));
      }
    } finally {
      await context.close();
    }
  }
}
