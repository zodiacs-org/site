/**
 * Daily Guide health check against production.
 *
 *   node scripts/guide-health-check.mjs [https://zodiacs.org]
 *
 * Opens Guide the way a visitor does, asks one fixed public question, accepts
 * the privacy step and waits for an answer. Exits 1 when Guide shows its
 * "can't answer" note or no answer arrives, so the scheduled workflow fails
 * and GitHub emails the repository owner. The question carries no personal
 * details and nothing is attached beyond the public page and today's sky.
 */
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from '../tests/visual/browser.mjs';

const ORIGIN = (process.argv[2] ?? 'https://zodiacs.org').replace(/\/$/, '');
const QUESTION = 'What is a retrograde, in one sentence?';
const ANSWER_TIMEOUT_MS = 75_000;

function fail(message) {
  console.error(`::error title=Guide health check::${message}`);
  process.exitCode = 1;
}

const browser = await chromium.launch({
  executablePath: await findChromium(),
  args: STABLE_CHROMIUM_ARGS,
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await page.goto(`${ORIGIN}/ask/`, { waitUntil: 'load' });

  // The first open in a tab may reload the page once to drop analytics, so
  // try the opener until the composer is on screen.
  const composer = page.locator('.zassistant__input');
  for (let attempt = 0; attempt < 3 && !(await composer.isVisible()); attempt += 1) {
    await page.locator('[data-guide-launcher], [data-assistant-open]').first().click();
    await composer.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  }
  if (!(await composer.isVisible())) throw new Error('Guide did not open.');

  await composer.fill(QUESTION);
  await page.locator('.zassistant__send').click();
  const consent = page.locator('.zassistant__consent-confirm');
  await consent.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  if (await consent.isVisible()) await consent.click();

  const answered = page.locator('.zassistant__followups');
  const waitNote = page.locator('.zassistant__wait');
  const outcome = await Promise.race([
    answered.waitFor({ state: 'attached', timeout: ANSWER_TIMEOUT_MS }).then(() => 'answered'),
    waitNote.waitFor({ state: 'attached', timeout: ANSWER_TIMEOUT_MS }).then(() => 'unavailable'),
  ]).catch(() => 'timeout');

  const status = (await page.locator('.zassistant__status').textContent().catch(() => ''))?.trim();
  if (outcome === 'answered') {
    const answer = (await page.locator('.zassistant__message--assistant .zassistant__message-body').last().innerText()).trim();
    if (!answer) fail('Guide finished with an empty answer.');
    else console.log(`Guide answered (${answer.length} characters).`);
  } else if (outcome === 'unavailable') {
    fail(`Guide could not answer: "${status}". Check GUIDE_ANTHROPIC_API_KEY in Vercel and the /v1/guide/turn runtime logs.`);
  } else {
    fail(`No answer within ${ANSWER_TIMEOUT_MS / 1000} seconds. Status line: "${status}".`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}
