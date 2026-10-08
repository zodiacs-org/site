/**
 * Browser drive for the horoscope panel and Chart Studio's first screens:
 * real Chromium, synthetic host bridges, no network. Writes screenshots to
 * docs/platform/zodiacs-ai/evidence/. Run with npx vite-node --script.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { HOROSCOPES_HTML } from '../integrations/generated/horoscopes.mjs';
import { STUDIO_HTML } from '../integrations/generated/chart-studio.mjs';
import { executeAiTool, type AiCallContext } from '../src/ai-tools/tools';
import type { HoroscopeWindow } from '../src/ai-tools/horoscope/window';
import { calculateStudio, EXAMPLE, type StudioInput } from '../src/ai-tools/studio/model';
import { localStudioInput } from '../src/ai-tools/studio/local-time';
import { weekRequest } from '../src/ai-tools/studio/week';
import { computeYourWeek } from '../src/ai-tools/studio/week-local';
import { weekDates, weekLine, weekTitle } from '../src/ai-tools/studio/week-words';

const window = JSON.parse(await readFile(new URL('../src/data/horoscope-window.json', import.meta.url), 'utf8')) as HoroscopeWindow;
const noon = new Date(`${window.generatedFor}T12:00:00Z`);
async function horoscope(args: Record<string, unknown>) {
  const context: AiCallContext = {};
  const result = await executeAiTool('get_horoscope', args, { now: () => noon, horoscopeWindow: async () => window }, context);
  assert.equal(result.ok, true);
  return { structuredContent: result, _meta: context.horoscopePanel ? { 'zodiacs/horoscope': context.horoscopePanel } : undefined };
}

// Chart Studio's week runs on a fixed device clock, so the drive can compare the
// panel with the same calculation in Node: Friday 9 October 2026, 10:00 in Bangkok.
const WEEK_NOW = new Date('2026-10-09T03:00:00.000Z');
const ZONE = 'Asia/Bangkok';
function expectedWeek(input: StudioInput) {
  return computeYourWeek(weekRequest(calculateStudio(input), WEEK_NOW)).items.map(item => `${weekTitle(item)}\n${weekDates(item, ZONE)}\n${weekLine(item)}`);
}
const shownWeek = (page: Page) => page.locator('.week-list li').evaluateAll(items => items.map(item => [...item.children].map(child => child.textContent).join('\n')));

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
  // While a reading is on its way the panel shows a quiet line, not the sign picker.
  // A watcher placed before the panel's own script records whether the picker ever appeared.
  const watched = HOROSCOPES_HTML.replace('<head>', '<head><script>new MutationObserver(() => { if (document.querySelector(".grid")) window.sawPicker = true; }).observe(document, { childList: true, subtree: true });</script>');
  const arriving = await context.newPage();
  arriving.on('pageerror', error => errors.push(error.message));
  arriving.on('request', request => { if (!request.url().startsWith('data:')) network++; });
  await arriving.setContent(watched);
  assert.match(await arriving.getByRole('status').innerText(), /^Opening your horoscope…$/);
  assert.equal(await arriving.locator('.grid button').count(), 0, 'No sign picker while the reading is on its way');
  await arriving.waitForTimeout(300);
  await arriving.evaluate(result => {
    (window as any).openai = { toolOutput: result.structuredContent, toolResponseMetadata: result._meta };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: result.structuredContent, toolResponseMetadata: result._meta } } }));
  }, leo);
  await arriving.getByRole('heading', { name: 'Leo' }).waitFor();
  await arriving.waitForTimeout(1200);
  assert.equal(await arriving.getByRole('heading', { name: 'Leo' }).count(), 1, 'The reading stays after the picker deadline passes');
  assert.equal(await arriving.evaluate(() => (window as any).sawPicker), undefined, 'The picker never flashed before the reading');
  // Opened with no reading at all (from a sidebar, say), the picker appears after a short wait.
  const empty = await context.newPage();
  empty.on('pageerror', error => errors.push(error.message));
  empty.on('request', request => { if (!request.url().startsWith('data:')) network++; });
  const opened = Date.now();
  await empty.setContent(watched);
  assert.match(await empty.getByRole('status').innerText(), /Opening your horoscope/);
  assert.equal(await empty.locator('.grid button').count(), 0);
  await empty.getByRole('heading', { name: 'Your horoscope' }).waitFor();
  assert.ok(Date.now() - opened >= 1400, `The picker waits for a reading first (${Date.now() - opened} ms)`);
  assert.equal(await empty.locator('.grid button').count(), 12);
  assert.equal(await empty.getByText('Opening your horoscope…').count(), 0);
  assert.equal(network, 0); assert.deepEqual(errors, []);

  // Chart Studio opens on the person's own birth details; the example is a labelled second choice.
  // Its own context has a fixed device clock, so "Your week" can be compared with Node.
  const weekContext = await browser.newContext({ viewport: { width: 760, height: 900 }, timezoneId: ZONE });
  await weekContext.clock.setFixedTime(WEEK_NOW);
  const studio = await weekContext.newPage();
  const studioErrors: string[] = []; studio.on('pageerror', error => studioErrors.push(error.message));
  let studioNetwork = 0, workerScripts = 0;
  studio.on('request', request => { if (request.url().startsWith('blob:')) workerScripts++; else if (!request.url().startsWith('data:')) studioNetwork++; });
  await studio.setContent(STUDIO_HTML);
  await studio.getByRole('heading', { name: 'When and where were you born?' }).waitFor();
  assert.equal(await studio.locator('.wheel-wrap').count(), 0, 'No chart is shown before the person chooses');
  await studio.screenshot({ path: new URL('studio-start.png', out).pathname, fullPage: true });
  await studio.locator('details.unknown-time summary').click();
  await studio.locator('details.unknown-time input[type=date]').fill('1992-03-14');
  const made = Date.now();
  await studio.getByRole('button', { name: 'Make my chart without a time' }).click();
  await studio.locator('.your-week[data-state=ready]').waitFor();
  const weekMs = Date.now() - made;
  assert.ok(weekMs < 1000, `"Your week" is ready well within a second of making the chart (${weekMs} ms)`);
  console.log(`Chart Studio: chart and "Your week" ready ${weekMs} ms after the click.`);
  await studio.locator('.wheel-wrap').waitFor();
  const untimedMeta = await studio.locator('.chart-meta').innerText();
  assert.match(untimedMeta, /Your chart/);
  assert.match(untimedMeta, /14 March 1992 · Birth time unknown/);
  assert.doesNotMatch(untimedMeta, /UTC|12:00|\d{4}-\d{2}-\d{2}/, 'The header uses plain words, not a UTC instant');
  assert.match(await studio.locator('.chart-area .callout').first().innerText(), /Birth time unknown/);
  const untimedSection = await studio.locator('.your-week').innerText();
  assert.match(untimedSection, /Your week/);
  assert.match(untimedSection, /Without a birth time, this leaves out your Moon, rising sign and Midheaven, and the dates are approximate\./);
  assert.doesNotMatch(untimedSection, /UTC|GMT|Asia\/|\d{4}-\d{2}-\d{2}|\d:\d\d/, 'Plain dates on the device clock: no ISO dates, UTC, zone names or clock times');
  const untimedWeek = await shownWeek(studio);
  assert.ok(untimedWeek.length > 0 && untimedWeek.length <= 5, 'A handful of items');
  assert.deepEqual(untimedWeek, expectedWeek({ ...EXAMPLE, date: '1992-03-14', time: '12:00', timeKnown: false, latitude: '', longitude: '' }), 'The panel shows the week the model works out in Node');
  for (const item of untimedWeek) {
    assert.doesNotMatch(item, /rising sign|Midheaven|house|your Moon|emotional life/, 'No rising sign, Midheaven, house or Moon items without a birth time');
    assert.match(item.split('\n')[1], /^(All week|((Until|From) )?(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} (Oct|Nov)( to (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} (Oct|Nov))?)( · exact on (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} (Oct|Nov))?$/);
  }
  // With a time and a city, the header shows the date, clock time and place the person entered.
  await studio.getByRole('button', { name: 'Start over' }).click();
  await studio.getByLabel('Local date', { exact: true }).fill('1992-03-14');
  await studio.getByLabel('Local time', { exact: true }).fill('09:30');
  await studio.getByLabel('Find a city', { exact: true }).fill('London');
  await studio.getByRole('button', { name: 'London, England, United Kingdom' }).click();
  const london = { zone: await studio.getByLabel('Place time zone', { exact: true }).inputValue(), latitude: await studio.getByLabel('Place latitude', { exact: true }).inputValue(), longitude: await studio.getByLabel('Place longitude', { exact: true }).inputValue() };
  await studio.getByRole('button', { name: 'Review local time' }).click();
  await studio.getByRole('button', { name: 'Make my chart', exact: true }).click();
  await studio.locator('.your-week[data-state=ready]').waitFor();
  const timedMeta = await studio.locator('.chart-meta').innerText();
  assert.match(timedMeta, /Your chart/);
  assert.match(timedMeta, /14 March 1992 · 9:30 am · London, England, United Kingdom/);
  assert.doesNotMatch(timedMeta, /UTC|Europe\/London|\d{4}-\d{2}-\d{2}/);
  assert.doesNotMatch(await studio.locator('.local-origin').innerText(), /Europe\/London|\d{4}-\d{2}-\d{2}/);
  const timed = await localStudioInput({ date: '1992-03-14', time: '09:30', ...london }, 'placidus');
  assert.deepEqual(await shownWeek(studio), expectedWeek(timed.input), 'A timed chart\'s week matches Node, Moon and angles included');
  assert.equal(await studio.locator('.your-week .callout').count(), 0, 'No unknown-time note for a chart with a time');
  // The labelled example keeps its label and has no "Your week".
  await studio.getByRole('button', { name: 'Start over' }).click();
  await studio.getByRole('button', { name: 'See an example chart (not yours)' }).click();
  const exampleMeta = await studio.locator('.chart-meta').innerText();
  assert.match(exampleMeta, /Example chart \(not yours\)/);
  assert.match(exampleMeta, /15 June 1990 · 1:00 pm · London/);
  assert.equal(await studio.locator('.your-week').count(), 0, 'No "Your week" for the example chart');
  assert.ok(workerScripts > 0, 'The week was worked out in the panel\'s own worker');
  // Where a host refuses workers, the same week is worked out on the page.
  const strict = await weekContext.newPage();
  strict.on('pageerror', error => studioErrors.push(error.message));
  strict.on('request', request => { if (!request.url().startsWith('data:') && !request.url().startsWith('blob:')) studioNetwork++; });
  await strict.setContent(STUDIO_HTML.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="worker-src 'none'">`));
  await strict.locator('details.unknown-time summary').click();
  await strict.locator('details.unknown-time input[type=date]').fill('1992-03-14');
  await strict.getByRole('button', { name: 'Make my chart without a time' }).click();
  await strict.locator('.your-week[data-state=ready]').waitFor();
  assert.deepEqual(await shownWeek(strict), untimedWeek, 'The same week without a worker');
  assert.equal(studioNetwork, 0, 'Chart Studio makes no network requests');
  assert.deepEqual(studioErrors, []);
  await weekContext.close();

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
      if (event.data.method === 'ui/initialize') (window as any).inits = ((window as any).inits ?? 0) + 1;
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
  await panel.locator('.your-week[data-state=ready]').waitFor();
  await host.waitForFunction(previous => (window as any).sizes.at(-1) !== previous, before);
  await host.waitForTimeout(200);
  assert.equal(await fitsFrame(panel), true, 'Chart Studio grows with its chart and "Your week", with no scrolling inside the frame');
  await panel.getByRole('link', { name: 'Privacy' }).click();
  await host.waitForFunction(() => (window as any).links.length === 2);
  assert.equal(await host.evaluate(() => (window as any).links[1]), 'https://zodiacs.org/privacy/');
  // In ChatGPT (window.openai) both panels stay as OpenAI reviewed them: no size reports and no host links.
  // Each check gets a fresh frame, as a real host gives each panel.
  const inChatGpt = (html: string) => html.replace('<head>', '<head><script>window.openai = {};</script>');
  const freshFrame = async () => {
    await host.evaluate(() => { document.body.innerHTML = '<iframe title="Zodiacs panel" style="width:100%;height:160px;border:0"></iframe>'; (window as any).sizes = []; (window as any).links = []; });
    return host.frames().find(frame => frame !== host.mainFrame() && !frame.isDetached())!;
  };
  let chatgpt = await freshFrame();
  const inits = await host.evaluate(() => (window as any).inits);
  await chatgpt.setContent(inChatGpt(HOROSCOPES_HTML));
  await host.waitForFunction(previous => (window as any).inits > previous, inits);
  await host.evaluate(result => document.querySelector('iframe')!.contentWindow!.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: result }, '*'), leo);
  await chatgpt.getByRole('heading', { name: 'Leo' }).waitFor();
  await chatgpt.evaluate(() => window.addEventListener('click', event => event.preventDefault()));
  await chatgpt.getByRole('link', { name: /More on zodiacs\.org/ }).click();
  await host.waitForTimeout(300);
  assert.deepEqual(await host.evaluate(() => [(window as any).sizes, (window as any).links]), [[], []], 'ChatGPT keeps the reviewed horoscope panel');
  chatgpt = await freshFrame();
  await chatgpt.setContent(inChatGpt(STUDIO_HTML));
  await chatgpt.getByRole('heading', { name: 'When and where were you born?' }).waitFor();
  await chatgpt.evaluate(() => window.addEventListener('click', event => event.preventDefault()));
  await chatgpt.getByRole('link', { name: 'Privacy' }).click();
  await host.waitForTimeout(300);
  assert.deepEqual(await host.evaluate(() => [(window as any).sizes, (window as any).links]), [[], []], 'ChatGPT keeps the reviewed Chart Studio');
  assert.deepEqual(hostErrors, []);
  await writeFile(new URL('horoscopes-review.json', out), JSON.stringify({ scope: 'Local Chromium render with synthetic host bridges; not ChatGPT or Claude host acceptance', timezone: 'Asia/Bangkok', window: window.editions.map(edition => edition.anchorDate), passed: ['sign picker', 'sign choice through the OpenAI bridge', 'host updates after a choice keep it','plain dates and places', 'focus and week switching', 'why this reading', '375px phone: no sideways scroll, reading on the first screen', 'text injection', 'a quiet line, not the sign picker, while a reading is on its way', 'the sign picker after a short wait when no reading comes', 'no external requests', 'Chart Studio opens on birth details', 'unknown birth time path', 'header in plain words: date, "Birth time unknown", or clock time and city', 'Your week: plain dates on the device clock, closest first, at most five', 'Your week without a birth time leaves out the Moon, rising sign and Midheaven', 'Your week matches the same calculation in Node, with and without a birth time', 'Your week ready within a second, in a worker or, where workers are refused, on the page', 'labelled example chart without Your week','both panels report their content height to an MCP Apps host', 'links open through an MCP Apps host that offers it', 'ChatGPT keeps the reviewed panels'], errors: [...errors, ...studioErrors] }, null, 2) + '\n');
  console.log('Horoscope and Chart Studio browser QA passed.');
} finally { await browser.close(); }
