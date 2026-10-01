import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { WIDGET_HTML } from '../src/ai-tools/widget';
import { executeAiTool } from '../src/ai-tools/tools';
import * as localTime from '../api/_compute/local-time.mjs';

const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS, headless: true });
const page = await browser.newPage({ viewport: { width: 780, height: 640 } });
const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
let network = 0; page.on('request', () => { network++; });
try {
  await page.setContent(WIDGET_HTML);
  const result = await executeAiTool('get_upcoming_events', { from: '2026-10-01T00:00:00Z', to: '2026-10-31T00:00:00Z', zone: 'Asia/Bangkok', kinds: ['lunation'] }, { localTime });
  assert.equal(result.ok, true);
  await page.evaluate(result => {
    (window as any).openai = { callTool: async () => ({ structuredContent: result }) };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: result } } }));
  }, result);
  assert.ok(await page.locator('li').count() > 0);
  assert.match(await page.locator('#status').innerText(), /Asia\/Bangkok/);
  assert.match(await page.locator('#coverage').innerText(), /0\.1\.1-rc\.15/);
  assert.match(await page.locator('#coverage').innerText(), /tested, not proven/);
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
  const changed = await executeAiTool('get_upcoming_events', { from: '2026-10-02T00:00:00Z', to: '2026-10-09T00:00:00Z', zone: 'America/New_York' }, { localTime });
  assert.equal(changed.ok, true);
  // Exercise the legacy host bridge with a real form submission, without fetch.
  await page.evaluate(result => {
    (window as any).requests = [];
    (window as any).openai = { callTool: async (name: string, args: unknown) => { (window as any).requests.push({ name, args }); return { structuredContent: result }; } };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: {} } }));
  }, changed);
  await page.locator('#from').fill('2026-10-02'); await page.locator('#to').fill('2026-10-09'); await page.locator('#zone').fill('America/New_York');
  await page.locator('#update').click();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('America/New_York'));
  assert.deepEqual(await page.evaluate(() => (window as any).requests), [{ name: 'get_upcoming_events', args: { from: '2026-10-02T00:00:00.000Z', to: '2026-10-09T00:00:00.000Z', zone: 'America/New_York' } }]);
  await page.locator('#to').fill('2026-12-09'); await page.locator('#update').click();
  assert.match(await page.locator('#status').innerText(), /at most 31 days/);
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
      if (event.data.method === 'ui/initialize') iframe.contentWindow!.postMessage({ jsonrpc: '2.0', id: event.data.id, result: { protocolVersion: '2026-01-26', hostInfo: { name: 'synthetic-host', version: '1' }, hostCapabilities: { serverTools: {} } } }, '*');
      if (event.data.method === 'tools/call') iframe.contentWindow!.postMessage({ jsonrpc: '2.0', id: event.data.id, result: { structuredContent: result } }, '*');
    });
  }, changed);
  const frame = page.frames()[1]; await frame.setContent(WIDGET_HTML);
  await frame.waitForFunction(() => !(document.querySelector('#update') as HTMLButtonElement).disabled);
  await page.evaluate(result => document.querySelector('iframe')!.contentWindow!.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: result } }, '*'), result);
  await frame.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Asia/Bangkok'));
  await frame.locator('#from').fill('2026-10-02'); await frame.locator('#to').fill('2026-10-09'); await frame.locator('#zone').fill('America/New_York');
  await frame.locator('#update').click();
  await frame.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('America/New_York'));
  const messages = await page.evaluate(() => (window as any).protocolMessages);
  assert.ok(messages.some((message: any) => message.method === 'ui/notifications/initialized'));
  assert.deepEqual(messages.find((message: any) => message.method === 'tools/call').params, { name: 'get_upcoming_events', arguments: { from: '2026-10-02T00:00:00.000Z', to: '2026-10-09T00:00:00.000Z', zone: 'America/New_York' } });
  assert.equal(network, 0); assert.deepEqual(errors, []);
  await writeFile(new URL('widget-review.json', out), JSON.stringify({ scope: 'Local Chromium render and synthetic host bridges; not ChatGPT host acceptance', passed: ['desktop', '360px mobile', 'UTC/local time', 'engine version', 'coverage', 'no external requests', 'text injection', 'URL allowlist', 'refusal clears stale content', 'calendar form through OpenAI bridge', '31-day form limit before host call', 'MCP Apps initialization and calendar tools/call'], errors }, null, 2) + '\n');
  console.log('Widget browser QA: desktop, mobile, injection, links and error recovery passed.');
} finally { await browser.close(); }
