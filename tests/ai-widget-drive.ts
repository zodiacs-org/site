import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { WIDGET_HTML } from '../src/ai-tools/widget';
import { executeAiTool } from '../src/ai-tools/tools';

const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS, headless: true });
const page = await browser.newPage({ viewport: { width: 780, height: 640 } });
const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
let network = 0; page.on('request', () => { network++; });
try {
  await page.setContent(WIDGET_HTML);
  const result = await executeAiTool('get_upcoming_events', { from: '2026-10-01T00:00:00Z', to: '2026-10-31T00:00:00Z', zone: 'Asia/Bangkok', kinds: ['lunation'] }, {});
  assert.equal(result.ok, true);
  await page.evaluate(result => {
    (window as any).openai = { callTool: async () => ({ structuredContent: result }) };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: result } } }));
  }, result);
  assert.ok(await page.locator('li').count() > 0);
  assert.match(await page.locator('#status').innerText(), /times for Bangkok/);
  assert.doesNotMatch(await page.locator('#events').innerText(), /UTC|Z\b|\d{4}-\d{2}-\d{2}T/);
  assert.match(await page.locator('#coverage').innerText(), /new and full Moons/);
  // One plain way back: the page that explains subscribing to the site's public sky calendar.
  const keep = page.getByRole('link', { name: 'Add new and full Moons, eclipses and retrogrades to your own calendar' });
  assert.equal(await keep.count(), 1);
  assert.equal(await keep.getAttribute('href'), 'https://zodiacs.org/sky-calendar/');
  assert.equal(await keep.getAttribute('target'), '_blank');
  assert.equal(network, 0);
  const out = new URL('../docs/platform/zodiacs-ai/evidence/', import.meta.url);
  await mkdir(out, { recursive: true });
  await page.screenshot({ path: new URL('widget-desktop.png', out).pathname, fullPage: true });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.screenshot({ path: new URL('widget-mobile.png', out).pathname, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const injected = structuredClone(result) as any;
  injected.data.events[0].body = '<img src=x onerror="window.pwned=1">'; injected.data.events[0].kind = 'ingress';
  injected.links.push({ title: '<script>attack</script>', url: 'https://attacker.example/' }, { title: 'Private URL', url: 'https://zodiacs.org/?birth=secret' });
  await page.evaluate(result => window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: result } } })), injected);
  assert.equal(await page.locator('img').count(), 0); assert.equal(await page.locator('a[href*="attacker"]').count(), 0); assert.equal(await page.locator('a[href*="birth="]').count(), 0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: { tool: 'get_upcoming_events', ok: false, error: { message: 'The search was refused.' } } } } })));
  assert.equal(await page.locator('li').count(), 0); assert.equal(await page.locator('a').count(), 0); assert.equal(await page.locator('#coverage').innerText(), '');
  const changed = await executeAiTool('get_upcoming_events', { from: '2026-10-02T00:00:00Z', to: '2026-10-09T00:00:00Z', zone: 'America/New_York' }, {});
  assert.equal(changed.ok, true);
  // Exercise the legacy host bridge with a real form submission, without fetch.
  await page.evaluate(result => {
    (window as any).requests = [];
    (window as any).openai = { callTool: async (name: string, args: unknown) => { (window as any).requests.push({ name, args }); return { structuredContent: result }; } };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: {} } }));
  }, changed);
  await page.locator('#zone').selectOption('America/New_York'); await page.locator('#from').fill('2026-10-02'); await page.locator('#to').fill('2026-10-09');
  await page.locator('#update').click();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('times for New York'));
  // From and To are local dates in the chosen zone: New York midnight is 04:00 UTC in October, and To is inclusive.
  assert.deepEqual(await page.evaluate(() => (window as any).requests), [{ name: 'get_upcoming_events', args: { from: '2026-10-02T04:00:00.000Z', to: '2026-10-10T04:00:00.000Z', zone: 'America/New_York' } }]);
  await page.locator('#to').fill('2027-02-09'); await page.locator('#update').click();
  assert.match(await page.locator('#status').innerText(), /up to 92 days apart/);
  assert.equal(await page.evaluate(() => (window as any).requests.length), 1);
  assert.equal(await page.locator('li').count(), 0);
  // Exercise the standard MCP Apps handshake and host-mediated tools/call.
  await page.setContent('<iframe title="Sky calendar" id="calendar-frame" style="width:100%;height:740px;border:0"></iframe>');
  await page.evaluate(result => {
    (window as any).protocolMessages = [];
    window.addEventListener('message', event => {
      const iframe = document.querySelector('iframe')!;
      if (event.source !== iframe.contentWindow) return;
      (window as any).protocolMessages.push(event.data);
      if (event.data.method === 'ui/initialize') iframe.contentWindow!.postMessage({ jsonrpc: '2.0', id: event.data.id, result: { protocolVersion: '2026-01-26', hostInfo: { name: 'synthetic-host', version: '1' }, hostCapabilities: { serverTools: {}, openLinks: {} } } }, '*');
      if (event.data.method === 'ui/notifications/size-changed') iframe.style.height = `${event.data.params.height}px`;
      if (event.data.method === 'tools/call') iframe.contentWindow!.postMessage({ jsonrpc: '2.0', id: event.data.id, result: { structuredContent: result } }, '*');
    });
  }, changed);
  const frame = page.frames()[1]; await frame.setContent(WIDGET_HTML);
  await frame.waitForFunction(() => !(document.querySelector('#update') as HTMLButtonElement).disabled);
  await page.evaluate(result => document.querySelector('iframe')!.contentWindow!.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: result } }, '*'), result);
  await frame.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('times for Bangkok'));
  await frame.locator('#zone').selectOption('America/New_York'); await frame.locator('#from').fill('2026-10-02'); await frame.locator('#to').fill('2026-10-09');
  await frame.locator('#update').click();
  await frame.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('times for New York'));
  // The frame takes the calendar's height, with no scrolling inside it, and links open through the host.
  await page.waitForTimeout(200);
  assert.equal(await frame.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, 'The calendar frame fits its content');
  const content = await frame.evaluate(() => { const root = document.documentElement; root.style.height = 'max-content'; const height = root.getBoundingClientRect().height; root.style.height = ''; return Math.ceil(height); });
  assert.equal(await page.evaluate(() => document.querySelector('iframe')!.getBoundingClientRect().height), content, 'The frame is exactly as tall as the calendar');
  await frame.locator('#links a').first().click();
  await page.waitForFunction(() => (window as any).protocolMessages.some((message: any) => message.method === 'ui/open-link'));
  await frame.getByRole('link', { name: /to your own calendar/ }).click();
  await page.waitForFunction(() => (window as any).protocolMessages.filter((message: any) => message.method === 'ui/open-link').length === 2);
  const messages = await page.evaluate(() => (window as any).protocolMessages);
  assert.match(messages.find((message: any) => message.method === 'ui/open-link').params.url, /^https:\/\/zodiacs\.org\//);
  assert.equal(messages.filter((message: any) => message.method === 'ui/open-link')[1].params.url, 'https://zodiacs.org/sky-calendar/', 'The calendar link opens through the host');
  // In ChatGPT (window.openai) the calendar stays as OpenAI reviewed it: links aren't routed through the host.
  await page.evaluate(() => { (window as any).protocolMessages = []; document.body.innerHTML = '<iframe title="Sky calendar" style="width:100%;height:740px;border:0"></iframe>'; });
  const chatgpt = page.frames().find(item => item !== page.mainFrame() && !item.isDetached())!;
  await chatgpt.setContent(WIDGET_HTML.replace('<head>', '<head><script>window.openai = {};</script>'));
  await page.evaluate(result => document.querySelector('iframe')!.contentWindow!.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: result } }, '*'), result);
  await chatgpt.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('times for Bangkok'));
  await chatgpt.evaluate(() => window.addEventListener('click', event => event.preventDefault()));
  await chatgpt.locator('#links a').first().click();
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => (window as any).protocolMessages.filter((message: any) => message.method === 'ui/open-link').length), 0, 'ChatGPT keeps ordinary links');
  assert.ok(messages.some((message: any) => message.method === 'ui/notifications/initialized'));
  assert.deepEqual(messages.find((message: any) => message.method === 'tools/call').params, { name: 'get_upcoming_events', arguments: { from: '2026-10-02T04:00:00.000Z', to: '2026-10-10T04:00:00.000Z', zone: 'America/New_York' } });
  assert.equal(network, 0); assert.deepEqual(errors, []);
  await writeFile(new URL('widget-review.json', out), JSON.stringify({ scope: 'Local Chromium render and synthetic host bridges; not ChatGPT host acceptance', passed: ['desktop', '360px mobile', 'local dates and times', 'no UTC or ISO times on screen', 'coverage', 'a link to keep the sky dates in your own calendar','no external requests', 'text injection', 'URL allowlist', 'refusal clears stale content', 'calendar form through OpenAI bridge', '92-day form limit before host call', 'MCP Apps initialization and calendar tools/call', 'frame fits the calendar', 'links open through an MCP Apps host that offers it', 'ChatGPT keeps the reviewed calendar'], errors }, null, 2) + '\n');
  console.log('Widget browser QA: desktop, mobile, injection, links and error recovery passed.');
} finally { await browser.close(); }
