/** Actual article-to-transit behavior at the gated mobile and desktop widths. */
import { mkdir, readFile } from 'node:fs/promises';

const publication = JSON.parse(await readFile(new URL('../src/data/events-publication.json', import.meta.url), 'utf8'));
const demo = JSON.parse(await readFile(new URL('../src/data/demo-chart-frida.json', import.meta.url), 'utf8'));
const ids = ['neptune-sextile-pluto-2026-09-16', 'new-moon-2026-09-11', 'venus-retrograde-2026-10-03', 'jupiter-enters-leo-2026-06-30', 'eclipse-2026-08-28'];
const events = ids.map((id) => {
  const event = publication.pages.find((page) => page.id === id);
  if (!event) throw new Error(`Missing event fixture: ${id}`);
  return event;
});
const profile = {
  version: 1, settings: { houseSystem: 'whole' },
  charts: [true, false].map((known) => ({
    id: known ? 'event-known' : 'event-unknown', name: known ? 'Known time' : 'Unknown time',
    createdAt: '2026-09-06T00:00:00Z', updatedAt: '2026-09-06T00:00:00Z',
    birth: { date: '1907-07-06', time: known ? '08:30' : null, timeKnown: known,
      place: { name: 'Coyoacán', admin1: 'CDMX', country: 'MX', lat: 19.35, lon: -99.16, tz: 'America/Mexico_City' } },
    summary: { engineVersion: 'fixture', utcISO: demo.utc, houseSystem: 'whole', bodies: demo.bodies, angles: demo.angles, flags: demo.flags },
  })),
};
const fit = (page, ringExpected = false) => page.evaluate((required) => {
  if (document.documentElement.scrollWidth > innerWidth + 1) return false;
  const ring = document.querySelector('.tring');
  if (!ring) return !required;
  const bounds = ring.getBoundingClientRect();
  return [...ring.querySelectorAll('.tring__scrub, .tring__date, .tring__next-link')].every((node) => {
    const rect = node.getBoundingClientRect();
    return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
      && node.scrollWidth <= node.clientWidth + 1;
  });
}, ringExpected);
const ringGeometry = (page) => page.evaluate(() => ({page:document.documentElement.scrollWidth,viewport:innerWidth,
  nodes:[...document.querySelectorAll('.tring,.tring__scrub,.tring__date,.tring__marks,.tring__mark,.tring__next-link')].map(n=>{const r=n.getBoundingClientRect();return {class:n.className,left:r.left,right:r.right,scroll:n.scrollWidth,client:n.clientWidth};})}));
const compute = async (page) => {
  await page.locator('.calc__submit').click();
  await page.locator('[data-ring-instant]').waitFor({ timeout: 30_000 });
};

export async function runEventTransitChecks({ browser, baseURL, check, outDir = null }) {
  if (outDir) await mkdir(outDir, { recursive: true });
  for (const width of [390, 1440]) {
    const staticPage = await browser.newPage({ viewport: { width, height: 1000 }, javaScriptEnabled: false });
    try {
      for (const event of events) {
        await staticPage.goto(`${baseURL}${event.path}`, { waitUntil: 'load' });
        const link = staticPage.getByRole('link', { name: 'See this event with my chart', exact: true });
        const href = new URL(await link.getAttribute('href'), baseURL);
        check(`event ${width}: ${event.id} has a plain exact-UTC handoff and substantive reading without JavaScript`,
          href.pathname === '/transits/' && href.searchParams.get('at') === event.anchor
          && [...href.searchParams.keys()].join(',') === 'at'
          && await staticPage.locator('[data-event-reading] p').count() === 2
          && await staticPage.locator('.event-reflect li').count() === 2 && await fit(staticPage));
        const articles = await staticPage.locator('script[type="application/ld+json"]').evaluateAll((scripts) => scripts
          .flatMap((script) => { const data = JSON.parse(script.textContent); return data['@graph'] ?? [data]; })
          .filter((node) => node['@type'] === 'Article'));
        check(`event ${width}: ${event.id} exposes the actual revision without inventing first publication`,
          articles.length === 1 && articles[0].dateModified === `${event.lastModified}T00:00:00.000Z`
          && !Object.hasOwn(articles[0], 'datePublished'));
        if (outDir) await staticPage.screenshot({ path: `${outDir}/event-${event.id}-${width}.png`, fullPage: true });
      }
    } finally { await staticPage.close(); }

    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript((value) => localStorage.setItem('zodiacs.profile.v1', JSON.stringify(value)), profile);
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${baseURL}${events[0].path}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: 'See this event with my chart', exact: true }).click();
      await page.locator('#trans-source').waitFor();
      await page.locator('#trans-source').selectOption('event-known');
      await compute(page);
      const instant = () => page.locator('[data-ring-instant]').getAttribute('data-ring-instant');
      check(`event transit ${width}: saved chart opens the exact article UTC`, await instant() === events[0].anchor);
      await page.getByRole('button', { name: 'Now', exact: true }).click();
      check(`event transit ${width}: Now means the actual current time`, Math.abs(Date.parse(await instant()) - Date.now()) < 60_000);
      await page.getByRole('button', { name: 'Event date', exact: true }).click();
      check(`event transit ${width}: Event date restores the original millisecond`, await instant() === events[0].anchor);
      await page.locator('.tring__range').focus();
      await page.keyboard.press('ArrowRight');
      check(`event transit ${width}: keyboard scrub changes the instant`, await instant() !== events[0].anchor);
      await compute(page);
      check(`event transit ${width}: recomputing the same event resets scrub and selection`,
        await instant() === events[0].anchor && await page.locator('.tring__range').inputValue() === '0'
        && await page.locator('.tring__focus').count() === 0);
      const knownFits = await fit(page, true);
      check(`event transit ${width}: date controls fit the viewport`, knownFits, knownFits ? '' : JSON.stringify(await ringGeometry(page)));
      if (outDir) await page.locator('.tring').screenshot({ path: `${outDir}/event-transit-known-${width}.png`, animations: 'disabled' });

      await page.locator('#trans-source').selectOption('event-unknown');
      await page.locator('[data-ring-instant]').waitFor({ state: 'detached' });
      await compute(page);
      check(`event transit ${width}: unknown time keeps UTC and explicitly withholds precise Moon contacts`,
        await instant() === events[0].anchor
        && (await page.locator('.calc__result .notice').innerText()).includes('precise Moon contacts')
        && !(await page.locator('.tring__row').allTextContents()).some((text) => text.includes('Natal Moon'))
        && await fit(page, true), JSON.stringify(await ringGeometry(page)));
      if (outDir) await page.locator('.calc__result').screenshot({ path: `${outDir}/event-transit-unknown-${width}.png`, animations: 'disabled' });
      check(`event transit ${width}: no unexpected JavaScript errors`, errors.length === 0, errors.join('; '));
    } finally { await context.close(); }
  }
}
