import { mkdir } from 'node:fs/promises';

const own = {
  id: '77777777-7777-4777-8777-777777777777', name: 'Continuity owner', relationship: 'self',
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  birth: { date: '1990-01-01', time: '12:00', timeKnown: true, place: null },
  summary: { engineVersion: 'continuity-fixture', utcISO: '1990-01-01T12:00:00.000Z', houseSystem: 'whole',
    bodies: [{ body: 'Sun', lon: 280, retrograde: false }, { body: 'Moon', lon: 330, retrograde: false }],
    angles: { asc: 290, mc: 200 }, flags: [] },
};
const friend = { ...own, id: '88888888-8888-4888-8888-888888888888', name: 'Recently edited friend', relationship: 'other', updatedAt: '2026-09-06T00:00:00.000Z' };

/** Regression: a recent friend edit must not change whom the personal daily CTA names. */
export async function runPersonalChartHandoff({ browser, baseURL, check, outDir }) {
  if (outDir) await mkdir(outDir, { recursive: true });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    try {
      await context.addInitScript((charts) => {
        localStorage.setItem('zodiacs.profile.v1', JSON.stringify({ version: 1, settings: { houseSystem: 'whole' }, charts }));
      }, [friend, own]);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
      const card = page.locator('.wb-chart').filter({ has: page.getByRole('heading', { name: new RegExp(own.name) }) });
      await card.waitFor({ state: 'visible' });
      check(`personal chart ${width}: homepage identifies the explicit owner`, (await card.locator('h2').textContent()).includes(own.name));
      check(`personal chart ${width}: homepage has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (outDir) await card.screenshot({ path: `${outDir}/personal-chart-home-${width}.png` });
      await card.locator('a[href="/today/"]').click();
      await page.getByRole('heading', { name: `For ${own.name}`, exact: true }).waitFor({ state: 'visible' });
      check(`personal chart ${width}: Today preserves the homepage identity`, (await page.locator('.today-reading__chart-name').textContent()).trim() === own.name);
      await page.goto(`${baseURL}/profile/`, { waitUntil: 'domcontentloaded' });
      const selector = page.locator('.pfd__pick select');
      await selector.waitFor({ state: 'visible' });
      check(`personal chart ${width}: Profile starts with the same owner`, await selector.inputValue() === own.id);
      await selector.selectOption(friend.id);
      check(`personal chart ${width}: explicit selection can still explore a friend`, await selector.inputValue() === friend.id);
      check(`personal chart ${width}: no browser exceptions`, errors.length === 0, errors.join('; '));
    } finally { await context.close(); }
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await context.addInitScript((chart) => {
      localStorage.setItem('zodiacs.profile.v1', JSON.stringify({ version: 1, settings: { houseSystem: 'whole' }, charts: [chart] }));
    }, friend);
    const page = await context.newPage();
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    const choose = page.getByRole('link', { name: 'Choose my chart', exact: true });
    await choose.waitFor({ state: 'visible' });
    if (outDir) await page.locator('.wb-choose').screenshot({ path: `${outDir}/personal-chart-choice-390.png` });
    await choose.click();
    await page.locator('[data-living-self-chart]').waitFor({ state: 'visible' });
    check('personal chart: a missing owner choice reaches the existing explicit chooser', await page.locator('.today-reading--resolved').count() === 0);
  } finally { await context.close(); }
}
