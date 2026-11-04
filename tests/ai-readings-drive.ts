/**
 * Browser drive for the readings panel: real Chromium, a synthetic host
 * bridge, results from the real coverage tools and find_birthplace. Writes
 * docs/platform/zodiacs-ai/evidence/readings-leo-scorpio.png. Then the panel
 * offered while ZODIACS_SKY_EVENTS_ENABLED=1: its birth chart lists the lunar
 * nodes, each body with its glyph. Run with
 * npx vite-node --script tests/ai-readings-drive.ts [-- --out <dir>] (the
 * second panel's screenshot goes to <dir> when given).
 */
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { READINGS_HTML } from '../integrations/generated/readings.mjs';
import { READINGS_SKY_EVENTS_HTML } from '../integrations/generated/readings-sky-events.mjs';
import { executeAiTool } from '../src/ai-tools/tools';
import { loadPlaceTable } from '../src/ai-tools/features/place-table';
import committedWindow from '../src/data/horoscope-window.json';
import committedMonths from '../src/data/horoscope-months.json';
import committedProgram from '../src/data/horoscope-program.json';
import type { AiToolName } from '../src/ai-tools/contracts';
import type { HoroscopeWindow } from '../src/ai-tools/horoscope/window';
import type { HoroscopeProgram } from '../src/lib/horoscope-program-types';

const NOW = new Date('2026-11-02T05:00:00Z');
const dependencies = {
  occasions: true, coverage: true, now: () => NOW,
  horoscopeWindow: async () => committedWindow as HoroscopeWindow,
  horoscopeMonths: async () => committedMonths,
  horoscopeProgram: async () => committedProgram as unknown as HoroscopeProgram,
  placeTable: async () => loadPlaceTable(),
};
async function result(tool: AiToolName, args: Record<string, unknown>) {
  const answer = await executeAiTool(tool, args, dependencies);
  assert.equal(answer.ok, true, `${tool} answered`);
  return answer as unknown as { tool: string; data: any };
}

// A town named in the chat goes through find_birthplace first; the chart takes its coordinates and zone.
const madrid = (await result('find_birthplace', { place: 'Madrid', country: 'Spain', date: '1990-05-03' })).data.places[0];
const natal = await result('get_natal_chart', { birthDate: '1990-05-03', time: '08:30', zone: madrid.timeZone, latitude: madrid.latitude, longitude: madrid.longitude, place: 'Madrid, Spain' });
const young = await result('get_natal_chart', { birthDate: '2014-06-01', time: '08:30', zone: madrid.timeZone, latitude: madrid.latitude, longitude: madrid.longitude });
const period = await result('get_horoscope_period', { sign: 'leo', period: 'month', date: '2026-11-05', zone: 'Asia/Bangkok' });
const animal = await result('get_chinese_zodiac', { birthDate: '1990-01-20', zone: 'Asia/Shanghai' });
const transits = await result('get_personal_transits', { birthDate: '1990-05-03', from: '2026-11-01', to: '2026-11-15', currentZone: 'America/New_York' });
const term = await result('explain_astrology', { topic: 'Are Leo and Scorpio compatible?' });
// With the sky events switch: the same chart with its lunar nodes.
const withNodes = await executeAiTool('get_natal_chart', { birthDate: '1990-05-03', time: '08:30', zone: madrid.timeZone, latitude: madrid.latitude, longitude: madrid.longitude }, { ...dependencies, skyEvents: true });
assert.equal(withNodes.ok, true, 'get_natal_chart answered with the sky events switch');
const argv = process.argv.slice(2);
const shots = argv.includes('--out') ? new URL(`file://${argv[argv.indexOf('--out') + 1].replace(/\/?$/u, '/')}`) : null;

async function show(page: Page, structuredContent: unknown) {
  await page.evaluate(content => {
    (window as any).openai = { toolOutput: content };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: content } } }));
  }, structuredContent);
}
/** Open "More from this reading", unless the card before it left it open. */
async function unfold(page: Page) {
  if (await page.locator('details.fold[open]').count() === 0) await page.locator('details.fold > summary').click();
  await page.locator('details.fold[open] .fold-body').waitFor();
}

const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS, headless: true });
const out = new URL('../docs/platform/zodiacs-ai/evidence/', import.meta.url);
await mkdir(out, { recursive: true });
const errors: string[] = [];
const checked: string[] = [];
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
  const open = page.getByRole('link', { name: 'Open the chart page' });
  assert.equal(await open.getAttribute('href'), 'https://zodiacs.org/birth-chart/');
  assert.doesNotMatch(await open.getAttribute('href') ?? '', /1990|Madrid|40\./u);
  await unfold(page);
  assert.match(await page.locator('article').innerText(), /Gemini rising/u);
  checked.push('birth chart: Taurus Sun, Gemini rising, and a chart link with no birth details');

  await show(page, young);
  await page.locator('details.fold > summary').waitFor();
  await unfold(page);
  const youngText = await page.locator('article').innerText();
  const note = 'This birth date is under 18, so romantic and attraction readings are left out.';
  assert.ok(youngText.includes(note));
  // The note names what is left out; no reading line uses those words.
  assert.doesNotMatch(youngText.replaceAll(note, ''), /\b(?:romance|romantic|intimacy|sexual)\b/iu);
  checked.push('a birth date under 18: the note shows, and no romantic wording');

  await show(page, period);
  await page.getByRole('heading', { name: 'Leo' }).waitFor();
  assert.match(await page.locator('article').innerText(), /Reading confidence 40%/u);
  assert.equal(await page.getByRole('link', { name: 'Open the horoscope' }).getAttribute('href'), period.data.pageUrl);
  checked.push('monthly horoscope: the published reading with "Reading confidence 40%"');

  await show(page, animal);
  await page.getByRole('link', { name: 'Open the Snake' }).waitFor();
  assert.match(await page.locator('article').innerText(), /Snake/u);
  assert.doesNotMatch(await page.getByRole('link', { name: 'Open the Snake' }).getAttribute('href') ?? '', /1990|January/u);
  checked.push('Chinese zodiac: the Snake for 20 January 1990, with no date in its link');

  await show(page, transits);
  await page.getByRole('heading', { name: 'Taurus Sun' }).waitFor();
  const transitText = await page.locator('article').innerText();
  assert.match(transitText, /Reading confidence \d+%/u);
  assert.match(transitText, /America\/New_York/u);
  checked.push('transits: each line with its reading confidence, on the clock where the person lives');

  await show(page, term);
  await page.getByRole('heading', { name: 'Leo and Scorpio' }).waitFor();
  await unfold(page);
  const termText = await page.locator('article').innerText();
  assert.match(termText, /under 18/u);
  assert.doesNotMatch(termText, /Reading confidence/u);
  assert.equal(await page.getByRole('link', { name: 'Open the page' }).getAttribute('href'), 'https://zodiacs.org/compatibility/leo-scorpio/');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  checked.push('a Sun-sign pair: the pair page, the under-18 guidance and no confidence label');
  assert.equal(errors.join('\n'), '');
  await page.screenshot({ path: new URL('readings-leo-scorpio.png', out).pathname, fullPage: true });

  // The panel offered while ZODIACS_SKY_EVENTS_ENABLED=1: the published one, but the birth chart lists the lunar nodes.
  const nodesPage = await context.newPage();
  nodesPage.on('pageerror', error => errors.push(error.message));
  await nodesPage.setContent(READINGS_SKY_EVENTS_HTML);
  await show(nodesPage, withNodes);
  await nodesPage.getByRole('heading', { name: 'Taurus Sun' }).waitFor();
  await unfold(nodesPage);
  const nodesSection = nodesPage.locator('section.card-section', { has: nodesPage.getByRole('heading', { name: 'The lunar nodes' }) });
  const nodeText = await nodesSection.innerText();
  const north = (withNodes as unknown as { data: { nodes: { north: { sign: string } ; south: { sign: string } } } }).data.nodes;
  assert.match(nodeText, new RegExp(`North Node\\s+${north.north.sign.charAt(0).toUpperCase()}${north.north.sign.slice(1)}`, 'u'));
  assert.match(nodeText, new RegExp(`South Node\\s+${north.south.sign.charAt(0).toUpperCase()}${north.south.sign.slice(1)}`, 'u'));
  // Every body row, the planets' and the nodes', leads with its glyph.
  assert.equal(await nodesPage.locator('dl.facts dt svg').count(), 10);
  assert.equal(await nodesSection.locator('dt svg').count(), 2);
  assert.equal(await nodesPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(errors.join('\n'), '');
  checked.push(`sky events panel: the birth chart lists the North Node in ${north.north.sign} and the South Node in ${north.south.sign}, each body with its glyph`);
  if (shots) {
    await mkdir(shots, { recursive: true });
    await nodesSection.scrollIntoViewIfNeeded();
    await nodesPage.screenshot({ path: new URL('readings-sky-events-nodes.png', shots).pathname, fullPage: true });
  }
} finally { await browser.close(); }
console.log(`Readings panel drive:\n- ${checked.join('\n- ')}`);
