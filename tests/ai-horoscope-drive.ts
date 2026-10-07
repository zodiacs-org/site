/**
 * Browser drive for the horoscope panel and Chart Studio's first screen:
 * real Chromium, synthetic host bridges, no network. Writes screenshots to
 * docs/platform/zodiacs-ai/evidence/. Run with npx vite-node --script.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { HOROSCOPES_HTML } from '../integrations/generated/horoscopes.mjs';
import { STUDIO_HTML } from '../integrations/generated/chart-studio.mjs';
import { executeAiTool, type AiCallContext } from '../src/ai-tools/tools';
import type { HoroscopeWindow } from '../src/ai-tools/horoscope/window';

const window = JSON.parse(await readFile(new URL('../src/data/horoscope-window.json', import.meta.url), 'utf8')) as HoroscopeWindow;
const noon = new Date(`${window.generatedFor}T12:00:00Z`);
async function horoscope(args: Record<string, unknown>) {
  const context: AiCallContext = {};
  const result = await executeAiTool('get_horoscope', args, { now: () => noon, horoscopeWindow: async () => window }, context);
  assert.equal(result.ok, true);
  return { structuredContent: result, _meta: context.horoscopePanel ? { 'zodiacs/horoscope': context.horoscopePanel } : undefined };
}

const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS, headless: true });
const out = new URL('../docs/platform/zodiacs-ai/evidence/', import.meta.url);
await mkdir(out, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 760, height: 900 }, timezoneId: 'Asia/Bangkok' });
  const page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let network = 0; page.on('request', request => { if (!request.url().startsWith('data:')) network++; });
  await page.setContent(HOROSCOPES_HTML);
  // A sign-less call shows the picker.
  const picker = await horoscope({});
  const leo = await horoscope({ sign: 'leo', zone: 'Asia/Bangkok' });
  await page.evaluate(([first, second]) => {
    (window as any).requests = [];
    (window as any).openai = { toolOutput: first.structuredContent, callTool: async (name: string, args: unknown) => { (window as any).requests.push({ name, args }); return second; } };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: first.structuredContent } } }));
  }, [picker, leo] as const);
  await page.getByRole('heading', { name: 'Your horoscope' }).waitFor();
  assert.equal(await page.locator('.grid button').count(), 12);
  await page.screenshot({ path: new URL('horoscopes-picker.png', out).pathname, fullPage: true });
  await page.locator('.grid button', { hasText: 'Leo' }).click();
  await page.getByRole('heading', { name: 'Leo' }).waitFor();
  const requests = await page.evaluate(() => (window as any).requests);
  assert.deepEqual(requests, [{ name: 'get_horoscope', args: { sign: 'leo', period: 'day', focus: 'general', zone: 'Asia/Bangkok' } }]);
  // ChatGPT sends updates for resizes and may repeat the turn's first result; neither undoes the choice.
  await page.evaluate((first) => {
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { maxHeight: 640 } } }));
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: first.structuredContent } } }));
  }, picker);
  await page.waitForTimeout(300);
  assert.equal(await page.getByRole('heading', { name: 'Leo' }).count(), 1, 'A host update after the choice keeps Leo on screen');
  const text = await page.locator('article').innerText();
  assert.match(text, /times for Bangkok/);
  assert.doesNotMatch(text, /UTC|Asia\/Bangkok|\d{4}-\d{2}-\d{2}/, 'People see dates and places, not UTC, time-zone IDs or ISO dates');
  assert.match(text, /For reflection\. Astrology does not establish what will happen in your life\./);
  await page.getByRole('button', { name: 'Love' }).click();
  assert.match(await page.locator('.when').innerText(), /times for Bangkok/);
  await page.getByRole('button', { name: 'This week' }).click();
  assert.match(await page.locator('.when').innerText(), /^Week of/);
  await page.locator('details.why summary').click();
  assert.ok(await page.locator('.why li').count() > 0);
  await page.screenshot({ path: new URL('horoscopes-desktop.png', out).pathname, fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const article = await page.locator('article').boundingBox();
  assert.ok(article && article.y < 812, 'On a phone the reading starts on the first screen');
  await page.screenshot({ path: new URL('horoscopes-mobile.png', out).pathname, fullPage: true });
  // Reading text is rendered as text, never as markup (a fresh panel, as the host's first result).
  const injected = structuredClone(leo) as any;
  injected._meta['zodiacs/horoscope'].days.forEach((day: any) => { day.focuses.general.paragraphs = [{ text: '<img src=x onerror="window.pwned=1">' }]; });
  const fresh = await context.newPage();
  fresh.on('pageerror', error => errors.push(error.message));
  fresh.on('request', request => { if (!request.url().startsWith('data:')) network++; });
  await fresh.setContent(HOROSCOPES_HTML);
  await fresh.evaluate(result => {
    (window as any).openai = { toolOutput: result.structuredContent, toolResponseMetadata: result._meta };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: result.structuredContent, toolResponseMetadata: result._meta } } }));
  }, injected);
  await fresh.locator('.prose p', { hasText: 'onerror' }).waitFor();
  assert.equal(await fresh.locator('article img').count(), 0);
  assert.equal(await fresh.evaluate(() => (window as any).pwned), undefined);
  assert.equal(network, 0); assert.deepEqual(errors, []);

  // Chart Studio opens on the person's own birth details; the example is a labelled second choice.
  const studio = await context.newPage();
  const studioErrors: string[] = []; studio.on('pageerror', error => studioErrors.push(error.message));
  await studio.setContent(STUDIO_HTML);
  await studio.getByRole('heading', { name: 'When and where were you born?' }).waitFor();
  assert.equal(await studio.locator('.wheel-wrap').count(), 0, 'No chart is shown before the person chooses');
  await studio.screenshot({ path: new URL('studio-start.png', out).pathname, fullPage: true });
  await studio.locator('details.unknown-time summary').click();
  await studio.locator('details.unknown-time input[type=date]').fill('1992-03-14');
  await studio.getByRole('button', { name: 'Make my chart without a time' }).click();
  await studio.locator('.wheel-wrap').waitFor();
  assert.match(await studio.locator('.chart-meta').innerText(), /Your chart/);
  assert.match(await studio.locator('.chart-area .callout').first().innerText(), /Birth time unknown/);
  await studio.getByRole('button', { name: 'Start over' }).click();
  await studio.getByRole('button', { name: 'See an example chart (not yours)' }).click();
  assert.match(await studio.locator('.chart-meta').innerText(), /Example chart \(not yours\)/);
  assert.deepEqual(studioErrors, []);

  // In an MCP Apps host such as Claude, both panels report their content height,
  // so the frame grows to fit instead of scrolling inside a short frame, and open
  // their links through the host.
  const host = await context.newPage();
  const hostErrors: string[] = []; host.on('pageerror', error => hostErrors.push(error.message));
  await host.setContent('<iframe title="Zodiacs panel" style="width:100%;height:160px;border:0"></iframe>');
  await host.evaluate(() => {
    (window as any).sizes = []; (window as any).links = [];
    window.addEventListener('message', event => {
      const iframe = document.querySelector('iframe')!;
      if (event.source !== iframe.contentWindow) return;
      if (event.data.method === 'ui/initialize') iframe.contentWindow!.postMessage({ jsonrpc: '2.0', id: event.data.id, result: { protocolVersion: '2026-01-26', hostInfo: { name: 'synthetic-host', version: '1' }, hostCapabilities: { serverTools: {}, openLinks: {} } } }, '*');
      if (event.data.method === 'ui/open-link') { (window as any).links.push(event.data.params.url); iframe.contentWindow!.postMessage({ jsonrpc: '2.0', id: event.data.id, result: {} }, '*'); }
      if (event.data.method === 'ui/notifications/size-changed') { (window as any).sizes.push(event.data.params.height); iframe.style.height = `${event.data.params.height}px`; }
    });
  });
  const fitsFrame = (frame: import('playwright-core').Frame) => frame.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1);
  const panel = host.frames()[1];
  await panel.setContent(HOROSCOPES_HTML);
  await host.waitForFunction(() => (window as any).sizes.length > 0);
  await host.evaluate(result => document.querySelector('iframe')!.contentWindow!.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: result }, '*'), leo);
  await panel.getByRole('heading', { name: 'Leo' }).waitFor();
  await host.waitForFunction(() => (window as any).sizes.at(-1) > 500);
  await host.waitForTimeout(200);
  assert.equal(await fitsFrame(panel), true, 'The horoscope frame fits the reading, with no scrolling inside it');
  await panel.getByRole('link', { name: /More on zodiacs\.org/ }).click();
  await host.waitForFunction(() => (window as any).links.length === 1);
  assert.deepEqual(await host.evaluate(() => (window as any).links), ['https://zodiacs.org/horoscopes/leo/'], 'Links open through the host');
  assert.equal(await panel.getByRole('heading', { name: 'Leo' }).count(), 1, 'The panel stays put when a link opens');
  await host.evaluate(() => { (window as any).sizes = []; document.querySelector('iframe')!.style.height = '160px'; });
  await panel.setContent(STUDIO_HTML);
  await panel.getByRole('heading', { name: 'When and where were you born?' }).waitFor();
  await host.waitForFunction(() => (window as any).sizes.length > 0);
  const before = await host.evaluate(() => (window as any).sizes.at(-1));
  await panel.locator('details.unknown-time summary').click();
  await panel.locator('details.unknown-time input[type=date]').fill('1992-03-14');
  await panel.getByRole('button', { name: 'Make my chart without a time' }).click();
  await panel.locator('.wheel-wrap').waitFor();
  await host.waitForFunction(previous => (window as any).sizes.at(-1) !== previous, before);
  await host.waitForTimeout(200);
  assert.equal(await fitsFrame(panel), true, 'Chart Studio grows with its chart, with no scrolling inside the frame');
  await panel.getByRole('link', { name: 'Privacy' }).click();
  await host.waitForFunction(() => (window as any).links.length === 2);
  assert.equal(await host.evaluate(() => (window as any).links[1]), 'https://zodiacs.org/privacy/');
  assert.deepEqual(hostErrors, []);
  await writeFile(new URL('horoscopes-review.json', out), JSON.stringify({ scope: 'Local Chromium render with synthetic host bridges; not ChatGPT or Claude host acceptance', timezone: 'Asia/Bangkok', window: window.editions.map(edition => edition.anchorDate), passed: ['sign picker', 'sign choice through the OpenAI bridge', 'host updates after a choice keep it','plain dates and places', 'focus and week switching', 'why this reading', '375px phone: no sideways scroll, reading on the first screen', 'text injection', 'no external requests', 'Chart Studio opens on birth details', 'unknown birth time path', 'labelled example chart', 'both panels report their content height to an MCP Apps host', 'links open through an MCP Apps host that offers it'], errors: [...errors, ...studioErrors] }, null, 2) + '\n');
  console.log('Horoscope and Chart Studio browser QA passed.');
} finally { await browser.close(); }
