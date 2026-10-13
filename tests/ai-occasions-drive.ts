/**
 * Browser drive for the occasions panel: real Chromium, synthetic host
 * bridges, results from the real occasion tools, no network. Writes
 * screenshots to docs/platform/zodiacs-ai/evidence/. Run with
 * npx vite-node --script tests/ai-occasions-drive.ts.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { OCCASIONS_HTML } from '../integrations/generated/occasions.mjs';
import { executeAiTool } from '../src/ai-tools/tools';
import type { AiToolName } from '../src/ai-tools/contracts';

const NOW = new Date('2026-10-13T12:00:00Z');
async function result(tool: AiToolName, args: Record<string, unknown>) {
  const answer = await executeAiTool(tool, args, { occasions: true, now: () => NOW });
  assert.equal(answer.ok, true, `${tool} answered`);
  return answer;
}
const wedding = await result('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12', time: '19:00', zone: 'Europe/Rome', latitude: 43.7696, longitude: 11.2558, place: 'Florence, Italy', names: 'Ana & Luis' });
const baby = await result('get_occasion_sky', { occasion: 'baby', date: '2026-10-23' });
const milestones = await result('get_life_milestones', { birthDate: '1997-03-15' });

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
let network = 0;
try {
  const context = await browser.newContext({ viewport: { width: 760, height: 900 }, timezoneId: 'Asia/Bangkok' });
  const open = async (html = OCCASIONS_HTML) => {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith('data:')) network++; });
    await page.setContent(html);
    return page;
  };

  // A wedding with a time and a place: the card, the evening on Rome's clock, the printable card's link.
  const page = await open();
  assert.match(await page.getByRole('status').innerText(), /^Working out the sky…$/);
  await show(page, wedding);
  const data = (wedding as any).data;
  await page.getByRole('heading', { name: data.card.title }).waitFor();
  const card = await page.locator('article').innerText();
  assert.match(card, /Wedding · Ana & Luis/);
  assert.match(card, /Saturday 12 June 2027 · Florence, Italy · 19:00/);
  assert.match(card, /Gemini Sun/);
  assert.match(card, /Libra Moon/);
  assert.match(card, /Golden hour\s+20:13 – 20:57/);
  assert.match(card, /Sunset\s+20:57/);
  assert.match(card, /Bright after dark\s+.*Mars.*Jupiter|Bright after dark\s+.*Jupiter.*Mars/);
  assert.match(card, /Mercury retrograde/);
  assert.match(card, /Zodiacs does not choose or rank dates/);
  assert.doesNotMatch(card, /Europe\/Rome|\d{4}-\d{2}-\d{2}|T\d{2}:\d{2}/, 'People see dates, places and clock times, not zone IDs or ISO instants');
  const link = page.getByRole('link', { name: /Open the printable card/ });
  assert.equal(await link.getAttribute('href'), data.cardUrl);
  assert.ok(data.cardUrl.startsWith('https://zodiacs.org/occasions/#'));
  await page.screenshot({ path: new URL('occasions-wedding-desktop.png', out).pathname, fullPage: true });
  // Copy gives the card as plain text.
  // A page set from a string has no origin the clipboard serves, so the drive records the write.
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => { (window as any).copied = text; } } }); });
  await page.getByRole('button', { name: 'Copy the card' }).click();
  await page.getByText('Copied.').waitFor();
  const copied: string = await page.evaluate(() => (window as any).copied);
  assert.match(copied, new RegExp(`^Ana & Luis\\n${data.card.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`));
  assert.match(copied, /zodiacs\.org\/occasions$/);
  // A resize update never replays or clears the card.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { maxHeight: 640 } } })));
  await page.waitForTimeout(200);
  assert.equal(await page.getByRole('heading', { name: data.card.title }).count(), 1);
  // Phone width: no sideways scroll, the card starts on the first screen.
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const box = await page.locator('article').boundingBox();
  assert.ok(box && box.y < 200, 'On a phone the card starts at the top');
  await page.screenshot({ path: new URL('occasions-wedding-mobile.png', out).pathname, fullPage: true });

  // A date alone: noon UTC, said so, no evening, and the Moon's change of sign.
  const plain = await open();
  await show(plain, baby);
  await plain.getByRole('heading', { name: (baby as any).data.card.title }).waitFor();
  const babyText = await plain.locator('article').innerText();
  assert.match(babyText, /A new baby/);
  assert.match(babyText, /Friday 23 October 2026 · no time or place given, so at noon UTC/);
  assert.match(babyText, /Pisces → Aries Moon/);
  assert.match(babyText, /The Moon changes sign that day\. Add the time to pin it down\./);
  assert.doesNotMatch(babyText, /Golden hour|Sunset/);

  // A place name with no zone or coordinates is shown, and the line does not claim there was no place.
  const named = await open();
  await show(named, await result('get_occasion_sky', { occasion: 'birthday', date: '2026-10-23', place: 'Florence, Italy' }));
  await named.locator('h1').waitFor();
  assert.match(await named.locator('.when').innerText(), /^Friday 23 October 2026 · Florence, Italy · no time given, so at noon UTC$/);

  // Life milestones: the next one with each pass, the numbers, every milestone.
  const lives = await open();
  await show(lives, milestones);
  await lives.getByRole('heading', { name: 'Your sky milestones' }).waitFor();
  const lifeText = await lives.locator('article').innerText();
  assert.match(lifeText, /Born 15 Mar 1997/);
  assert.match(lifeText, /Now: your first Saturn return, at 29/);
  assert.match(lifeText, /Saturn reaches its place at your birth\s+23 Apr 2026/);
  assert.match(lifeText, /Passes back over it, retrograde\s+19 Nov 2026/);
  assert.match(lifeText, /Crosses it for the last time\s+31 Dec 2026/);
  assert.match(lifeText, /366\s+full moons lived through/);
  assert.match(lifeText, /93\s+Mercury retrogrades/);
  assert.match(lifeText, /First Jupiter return · age 11/);
  assert.match(lifeText, /Without a birth time, a date can be a day off\./);
  assert.equal(await lives.getByRole('link', { name: /Open the card on zodiacs\.org/ }).getAttribute('href'), 'https://zodiacs.org/occasions/milestones/#b=1997-03-15');
  await lives.screenshot({ path: new URL('occasions-milestones-desktop.png', out).pathname, fullPage: true });
  // A timed result has no card link (the page could not reproduce it), and the panel offers none.
  const timed = await result('get_life_milestones', { birthDate: '1997-03-15', time: '08:30', zone: 'Europe/Rome' });
  const timedPage = await open();
  await show(timedPage, timed);
  await timedPage.getByRole('heading', { name: 'Your sky milestones' }).waitFor();
  assert.equal(await timedPage.getByRole('link', { name: /Open the card/ }).count(), 0);
  assert.equal(await timedPage.getByText('Without a birth time, a date can be a day off.').count(), 0);

  // Names are text, never markup.
  const injected = structuredClone(wedding) as any;
  injected.data.names = '<img src=x onerror="window.pwned=1">';
  const safe = await open();
  await show(safe, injected);
  await safe.getByRole('heading', { name: data.card.title }).waitFor();
  assert.equal(await safe.locator('article img[src="x"]').count(), 0);
  assert.equal(await safe.evaluate(() => (window as any).pwned), undefined);

  // A refusal shows the tool's message; another tool's result is ignored.
  const refused = await open();
  await show(refused, { ok: false, tool: 'get_occasion_sky', error: { code: 'invalid-request', message: 'Add the time zone for that time.' } });
  assert.equal(await refused.getByRole('alert').innerText(), 'Add the time zone for that time.');
  const other = await open();
  await show(other, { ok: true, tool: 'get_sky', data: {} });
  await other.waitForTimeout(1700);
  assert.match(await other.locator('main').innerText(), /Ask the assistant about a day that matters/);

  // Dark theme from the host.
  const dark = await open();
  await show(dark, wedding);
  await dark.evaluate(() => window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { theme: 'dark' } } })));
  await dark.getByRole('heading', { name: data.card.title }).waitFor();
  assert.equal(await dark.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(20, 18, 24)');
  await dark.screenshot({ path: new URL('occasions-wedding-dark.png', out).pathname, fullPage: true });

  // An MCP Apps host: the result arrives as a notification, and the panel reports its height.
  const host = await context.newPage();
  host.on('pageerror', error => errors.push(error.message));
  await host.setContent('<iframe style="width:700px;height:600px;border:0"></iframe><script>window.sizes=[];window.addEventListener("message",e=>{const m=e.data;if(m&&m.method==="ui/initialize")e.source.postMessage({jsonrpc:"2.0",id:m.id,result:{protocolVersion:"2026-01-26",hostCapabilities:{},hostContext:{theme:"light"}}},"*");if(m&&m.method==="ui/notifications/size-changed")window.sizes.push(m.params.height);});</script>');
  const frame = host.frames()[1];
  frame.page().on('request', request => { if (!request.url().startsWith('data:') && !request.url().startsWith('about:')) network++; });
  await frame.setContent(OCCASIONS_HTML);
  await host.waitForTimeout(300);
  await host.evaluate(content => document.querySelector('iframe')!.contentWindow!.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: content } }, '*'), milestones);
  await frame.getByRole('heading', { name: 'Your sky milestones' }).waitFor();
  await host.waitForFunction(() => (window as any).sizes.length > 0);

  assert.equal(network, 0, 'The panel makes no network requests');
  assert.deepEqual(errors, []);
  await writeFile(new URL('occasions-review.json', out), JSON.stringify({
    scope: 'Local Chromium render with synthetic host bridges; not ChatGPT or Claude host acceptance',
    timezone: 'Asia/Bangkok',
    passed: ['wedding card with the evening on the place\'s clock', 'plain dates, places and clock times', 'printable card link from the tool', 'copy as plain text', 'resize updates keep the card', '375px phone: no sideways scroll, card at the top', 'date alone at noon UTC, said so, with the Moon\'s change of sign', 'life milestones: each pass, the numbers, every milestone', 'no card link when the page could not reproduce the answer', 'text injection', 'refusal message', 'other tools\' results ignored', 'host dark theme', 'MCP Apps tool-result notification and height report', 'no external requests'],
  }, null, 2) + '\n');
  console.log('Occasions panel browser QA passed.');
} finally { await browser.close(); }
