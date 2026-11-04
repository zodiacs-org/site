/**
 * Browser drive for the readings panel: real Chromium, a synthetic host
 * bridge, results from the real coverage tools. Run with
 * npx vite-node --script tests/ai-readings-drive.ts.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { READINGS_HTML } from '../integrations/generated/readings.mjs';
import { executeAiTool } from '../src/ai-tools/tools';
import committedWindow from '../src/data/horoscope-window.json';
import committedMonths from '../src/data/horoscope-months.json';
import committedProgram from '../src/data/horoscope-program.json';
import type { HoroscopeWindow } from '../src/ai-tools/horoscope/window';
import type { HoroscopeProgram } from '../src/lib/horoscope-program-types';

const NOW = new Date('2026-11-02T05:00:00Z');
const dependencies = {
  occasions: true, coverage: true, now: () => NOW,
  horoscopeWindow: async () => committedWindow as HoroscopeWindow,
  horoscopeMonths: async () => committedMonths,
  horoscopeProgram: async () => committedProgram as unknown as HoroscopeProgram,
};
async function result(tool: 'get_natal_chart' | 'get_horoscope_period' | 'get_chinese_zodiac' | 'get_personal_transits' | 'explain_astrology', args: Record<string, unknown>) {
  const answer = await executeAiTool(tool, args, dependencies);
  assert.equal(answer.ok, true, `${tool} answered`);
  return answer;
}

const natal = await result('get_natal_chart', { birthDate: '1990-05-03', time: '08:30', place: 'Madrid, Spain' });
const period = await result('get_horoscope_period', { sign: 'leo', period: 'month', date: '2026-11-05', zone: 'Asia/Bangkok' });
const animal = await result('get_chinese_zodiac', { birthDate: '1990-01-20', zone: 'Asia/Shanghai' });
const transits = await result('get_personal_transits', { birthDate: '1990-05-03', from: '2026-11-01', to: '2026-11-15', currentZone: 'America/New_York' });
const term = await result('explain_astrology', { topic: 'Are Leo and Scorpio compatible?' });

async function show(page: Page, structuredContent: unknown) {
  await page.evaluate(content => {
    (window as any).openai = { toolOutput: content };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: content } } }));
  }, structuredContent);
}

const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS, headless: true });
const out = new URL('../docs/platform/zodiacs-ai/evidence/', import.meta.url);
await mkdir(out, { recursive: true });
const errors: string[] = [];
try {
  const context = await browser.newContext({ viewport: { width: 760, height: 900 } });
  await context.route('https://zodiacs.org/assets/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = await readFile(new URL(`../public${pathname}`, import.meta.url));
    await route.fulfill({ body, contentType: pathname.endsWith('.avif') ? 'image/avif' : 'image/webp' });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent(READINGS_HTML);
  assert.match(await page.getByRole('status').innerText(), /^Working out the reading…$/u);

  await show(page, natal);
  await page.getByRole('heading', { name: 'Taurus Sun' }).waitFor();
  const open = page.getByRole('link', { name: 'Open your chart' });
  assert.equal(await open.getAttribute('href'), 'https://zodiacs.org/birth-chart/');
  assert.doesNotMatch(await open.getAttribute('href') ?? '', /1990|Madrid|40\./u);
  await page.locator('details.fold > summary').click();
  assert.match(await page.locator('article').innerText(), /Gemini rising/u);

  await show(page, period);
  await page.getByRole('heading', { name: 'Leo' }).waitFor();
  assert.match(await page.locator('article').innerText(), /confidence 85%/u);
  assert.equal(await page.getByRole('link', { name: 'Open the horoscope' }).getAttribute('href'), (period as any).data.pageUrl);

  await show(page, animal);
  assert.match(await page.locator('article').innerText(), /Snake/u);
  assert.doesNotMatch(await page.getByRole('link', { name: 'Open the Snake' }).getAttribute('href') ?? '', /1990|January/u);

  await show(page, transits);
  assert.match(await page.locator('article').innerText(), /confidence \d+%/iu);
  assert.match(await page.locator('article').innerText(), /America\/New_York/u);

  await show(page, term);
  await page.getByRole('heading', { name: 'Leo and Scorpio' }).waitFor();
  await page.locator('details.fold > summary').click();
  assert.match(await page.locator('article').innerText(), /under 18/u);
  assert.equal(await page.getByRole('link', { name: 'Open the page' }).getAttribute('href'), 'https://zodiacs.org/compatibility/leo-scorpio/');
  assert.equal(errors.join('\n'), '');
  await page.screenshot({ path: new URL('readings-leo-scorpio.png', out).pathname, fullPage: true });
} finally { await browser.close(); }
console.log('Readings panel drive: chart link, period, zodiac, transits and sign pair.');
