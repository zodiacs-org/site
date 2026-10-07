/**
 * Listing screenshots for Claude's connector directory: the real panels from
 * this build, filled with live answers from https://zodiacs.org/mcp, as
 * 1520px-wide PNGs of the app only. Manual, not part of CI (it uses the network).
 * Run with: npx vite-node --script tests/claude-directory-shots.ts
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { HOROSCOPES_HTML } from '../integrations/generated/horoscopes.mjs';
import { STUDIO_HTML } from '../integrations/generated/chart-studio.mjs';
import { WIDGET_HTML } from '../src/ai-tools/widget';

const SERVER = 'https://zodiacs.org/mcp';
let session: string | undefined;
async function rpc(body: Record<string, unknown>) {
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (session) headers['mcp-session-id'] = session;
  const response = await fetch(SERVER, { method: 'POST', headers, body: JSON.stringify(body) });
  session = response.headers.get('mcp-session-id') ?? session;
  const text = await response.text();
  const data = text.split('\n').filter(line => line.startsWith('data: ')).map(line => line.slice(6));
  const last = data.at(-1) ?? text;
  return last.trim() ? JSON.parse(last) : undefined;
}
async function call(name: string, args: Record<string, unknown>) {
  const reply = await rpc({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } });
  assert.ok(reply?.result?.structuredContent?.ok, `${name} answered`);
  return { structuredContent: reply.result.structuredContent, _meta: reply.result._meta };
}
async function host(page: Page, result: { structuredContent: unknown; _meta?: unknown }) {
  await page.evaluate(value => {
    (window as any).openai = { toolOutput: value.structuredContent, toolResponseMetadata: value._meta };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: value.structuredContent, toolResponseMetadata: value._meta } } }));
  }, result);
}

await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'zodiacs-listing-shots', version: '1' } } });
await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' });
const now = new Date();
const picker = await call('get_horoscope', { zone: 'Asia/Bangkok' });
const leo = await call('get_horoscope', { sign: 'leo', zone: 'Asia/Bangkok' });
const week = await call('get_upcoming_events', { from: now.toISOString(), to: new Date(now.getTime() + 7 * 86400000).toISOString(), zone: 'Asia/Bangkok' });

const out = new URL('../docs/platform/zodiacs-ai/claude-directory/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS, headless: true });
const shots: { file: string; prompt: string }[] = [];
try {
  const context = await browser.newContext({ viewport: { width: 760, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark', timezoneId: 'Asia/Bangkok' });
  const page = await context.newPage();
  // Size the page to its content, as an MCP Apps host does from the panel's size reports.
  const save = async (file: string, prompt: string, part?: ReturnType<Page['locator']>) => {
    const height = await page.evaluate(() => {
      const root = document.documentElement, previous = root.style.height;
      root.style.height = 'max-content';
      const value = Math.ceil(root.getBoundingClientRect().height);
      root.style.height = previous;
      return value;
    });
    await page.setViewportSize({ width: 760, height });
    const path = new URL(file, out).pathname;
    if (part) await part.screenshot({ path }); else await page.screenshot({ path });
    shots.push({ file, prompt });
  };

  await page.setContent(HOROSCOPES_HTML); await host(page, picker);
  await page.getByRole('heading', { name: 'Your horoscope' }).waitFor();
  await save('01-choose-your-sign.png', 'Show my horoscope for today');

  await page.setContent(HOROSCOPES_HTML); await host(page, leo);
  await page.getByRole('heading', { name: 'Leo' }).waitFor();
  await save('02-leo-today.png', "Show today's horoscope for Leo.");

  await page.setContent(WIDGET_HTML); await host(page, week);
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('times for Bangkok'));
  await save('03-sky-this-week.png', "What's happening in the sky this week? I'm in Bangkok.");

  await page.setContent(STUDIO_HTML);
  await page.getByRole('heading', { name: 'When and where were you born?' }).waitFor();
  await save('04-chart-studio-start.png', 'Help me read my birth chart.');

  await page.locator('details.unknown-time summary').click();
  await page.locator('details.unknown-time input[type=date]').fill('1992-03-14');
  await page.getByRole('button', { name: 'Make my chart without a time' }).click();
  await page.locator('.wheel-wrap').waitFor();
  await save('05-chart-without-birth-time.png', "Help me read my birth chart. I don't know my birth time.", page.locator('.workspace'));

  await writeFile(new URL('screenshots.json', out), JSON.stringify({ made: now.toISOString(), source: 'Real panels from this build with live answers from https://zodiacs.org/mcp; dark theme; Bangkok time zone; the birth date in 05 is made up', screenshots: shots }, null, 2) + '\n');
  console.log(`Saved ${shots.length} listing screenshots.`);
} finally { await browser.close(); }
