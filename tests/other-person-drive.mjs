import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const TIMEOUT = 45_000;

function token({ date, name }) {
  const wire = {
    d: date,
    t: '12:00',
    z: 'America/New_York',
    la: 40.7128,
    lo: -74.006,
    n: name,
    p: 'New York',
  };
  return `1.${Buffer.from(JSON.stringify(wire)).toString('base64url')}`;
}

const mine = token({ date: '1988-02-03', name: 'Mine' });
const other = token({ date: '1990-06-15', name: 'A friend' });

const browser = await chromium.launch({
  executablePath: await findChromium(),
  headless: true,
  args: STABLE_CHROMIUM_ARGS,
});

try {
  await withPreview({ port: 4337 }, async (baseURL) => {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/birth-chart/#c=${other}&subject=other&mine=${mine}`, {
      waitUntil: 'domcontentloaded',
    });

    const subject = page.locator('[data-chart-subject]');
    await subject.waitFor({ state: 'visible', timeout: TIMEOUT });
    assert.match(await subject.innerText(), /A friend/);
    assert.equal(await page.locator('.calc').getAttribute('data-subject-mode'), 'other');
    assert.equal(new URL(page.url()).hash, '', 'birth details should be stripped after the on-device handoff');

    const compare = page.locator('[data-compare-with-mine]');
    await compare.waitFor({ state: 'visible', timeout: TIMEOUT });
    const href = await compare.getAttribute('href');
    assert.ok(href?.startsWith('/compatibility/'), 'the compare link opens the compatibility page');
    assert.doesNotMatch(href ?? '', /[#&?](?:a|b|c|mine)=1\./u, 'the compare link carries no chart details');

    await compare.click();
    await page.locator('.syn__people').waitFor({ state: 'visible', timeout: TIMEOUT });
    const people = await page.locator('.syn__people').innerText();
    assert.match(people, /Mine/);
    assert.match(people, /A friend/);
    assert.equal(new URL(page.url()).hash, '', 'compatibility should consume the session handoff key');
    const leftover = await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('zodiacs.handoff.')));
    assert.deepEqual(leftover, [], 'the session handoff is deleted once read');
    await page.close();
  });
} finally {
  await browser.close();
}

process.stdout.write('other-person handoff: ok\n');
