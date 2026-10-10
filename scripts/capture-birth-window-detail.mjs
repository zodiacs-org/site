// Supplementary visual record: the expanded birth-time window detail on
// canonical production, for the drive's first chart input. Not a gate; the
// drive's report is the control record.
import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [out] = process.argv.slice(2);
const base = 'https://zodiacs.org';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
const records = [];
try {
  for (const variant of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 1000 }]) {
    const context = await browser.newContext({ viewport: { width: variant.width, height: variant.height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.message)));
    await page.goto(base + '/birth-chart/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => { const island = document.querySelector('.calc__form')?.closest('astro-island'); return island && !island.hasAttribute('ssr'); });
    await page.getByLabel('Birth date', { exact: true }).fill('1907-07-06');
    await page.getByLabel('Birth time', { exact: true }).fill('08:30');
    await page.getByLabel('Birthplace', { exact: true }).fill('Coyo');
    await page.locator('#place-opt-0').waitFor({ state: 'visible' });
    await page.locator('#place-opt-0').click();
    await page.locator('.calc__submit').click();
    await page.locator('.calc__result').waitFor();
    await page.getByRole('button', { name: 'Check a time window', exact: true }).click();
    const surface = page.locator('[data-birth-window]');
    await surface.waitFor();
    await surface.locator('select').selectOption('120');
    await surface.getByRole('button', { name: 'Check this window', exact: true }).click();
    await surface.locator('[data-birth-window-verification]').waitFor({ state: 'attached', timeout: 60000 });
    await surface.locator(':scope > details > summary').click();
    await surface.getByText(/Sun, Moon, rising sign, houses and aspects \(/).click();
    await page.evaluate(() => document.fonts.ready);
    const file = 'detail-' + variant.name + '.png';
    await surface.screenshot({ path: join(out, file) });
    const bytes = await readFile(join(out, file));
    records.push({ file, viewport: variant, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), text: (await surface.innerText()).slice(0, 4000), pageErrors: errors });
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(join(out, 'detail-capture.json'), JSON.stringify({ base, capturedAt: new Date().toISOString(), records }, null, 2) + '\n');
console.log(JSON.stringify(records.map((record) => [record.file, record.sha256, record.pageErrors.length])));
