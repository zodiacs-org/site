/**
 * Versioned directory screenshots of the current, unmodified occasion panel.
 * Real live answers, synthetic people and dates, no host chrome.
 * node tests/claude-directory-cards.mjs --version 0.5.1 [--replace-unpublished]
 * Published image URLs are immutable and can never be replaced by this tool.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { OCCASIONS_HTML } from '../integrations/generated/occasions.mjs';

const args = process.argv.slice(2);
const versionIndex = args.indexOf('--version');
const version = versionIndex < 0 ? '' : args[versionIndex + 1];
assert.match(version, /^\d+\.\d+\.\d+$/u, 'Supply --version with a new release version.');
const replaceUnpublished = args.includes('--replace-unpublished');
const origin = 'https://zodiacs.org';
const out = new URL(`../docs/platform/zodiacs-ai/claude-directory/${version}/`, import.meta.url);
const hostedOut = new URL('../public/assets/ai/review/', import.meta.url);
const digest = value => createHash('sha256').update(value).digest('hex');
let session;
let requestId = 0;
async function rpc(method, params) {
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (session) headers['mcp-session-id'] = session;
  const response = await fetch(`${origin}/mcp`, {
    method: 'POST', headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
  });
  assert.equal(response.ok, true, `${method}: HTTP ${response.status}`);
  session = response.headers.get('mcp-session-id') ?? session;
  const text = await response.text();
  const events = text.split('\n').filter(line => line.startsWith('data: ')).map(line => line.slice(6));
  const reply = JSON.parse(events.at(-1) ?? text);
  assert.equal(reply.error, undefined, `${method}: no protocol error`);
  return reply.result;
}
async function exists(path) {
  try { await access(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

const cards = [
  {
    name: 'comparison', tool: 'get_compatibility',
    prompt: "Compare my chart with my partner's and tell us how compatible we are: I was born 3 May 1990 at 8:30 in Madrid, he was born 10 August 1992.",
    input: {
      a: { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038, place: 'Madrid, Spain' },
      b: { birthDate: '1992-08-10' },
    },
    heading: 'Two charts compared',
  },
  {
    name: 'wedding', tool: 'get_occasion_sky',
    prompt: "We're getting married on 12 June 2027 at 17:00 in Florence. Is it a good day for it? Make us a card with the sky for that day.",
    input: { occasion: 'wedding', date: '2027-06-12', time: '17:00', zone: 'Europe/Rome', latitude: 43.7696, longitude: 11.2558, place: 'Florence, Italy' },
    heading: 'The sky on your wedding day',
  },
];
// Check every destination before making or replacing any file.
for (const card of cards) {
  card.file = `zodiacs-${card.name}-card-${version}.png`;
  const response = await fetch(`${origin}/assets/ai/review/${card.file}`, { method: 'HEAD' });
  assert.equal(response.status, 404, `${card.file}: URL must be unpublished, not ${response.status}`);
  for (const path of [new URL(card.file, out), new URL(card.file, hostedOut)]) {
    assert.ok(replaceUnpublished || !(await exists(path)), `${path.pathname} exists; use a new version or --replace-unpublished.`);
  }
}

await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'zodiacs-directory-cards', version: '1' } });
const tools = await rpc('tools/list', {});
const definition = tools.tools.find(tool => tool.name === 'get_occasion_sky');
const panelUri = definition?._meta?.['openai/outputTemplate'] ?? definition?._meta?.ui?.resourceUri;
assert.ok(panelUri, 'Live occasion tool provides a panel URI.');
const panel = await rpc('resources/read', { uri: panelUri });
assert.equal(digest(panel.contents[0].text), digest(OCCASIONS_HTML), 'Local panel must match the live panel byte for byte.');
await mkdir(out, { recursive: true });
await mkdir(hostedOut, { recursive: true });

const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS, headless: true });
const screenshots = [];
try {
  for (const card of cards) {
    const result = await rpc('tools/call', { name: card.tool, arguments: card.input });
    assert.equal(result.structuredContent?.ok, true, `${card.tool} answered`);
    // The phone layout preserves at least two source pixels per displayed
    // artwork pixel, including the wedding's published 720px master.
    const width = 375;
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 2, colorScheme: 'dark', timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith('data:')) requests.push(request.url()); });
    await page.setContent(OCCASIONS_HTML);
    await page.evaluate(result => {
      window.openai = { toolOutput: result.structuredContent, toolResponseMetadata: result._meta, theme: 'dark' };
      window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: window.openai } }));
    }, result);
    await page.getByText(card.heading, { exact: true }).waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].filter(image => image.getClientRects().length).map(image => image.decode()));
    });
    const height = await page.evaluate(() => {
      document.documentElement.style.height = 'max-content';
      return Math.ceil(document.documentElement.getBoundingClientRect().height);
    });
    await page.setViewportSize({ width, height });
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      art: [...document.images].filter(image => image.getBoundingClientRect().width > 150).map(image => ({ width: image.getBoundingClientRect().width, naturalWidth: image.naturalWidth })),
    }));
    assert.equal(geometry.overflow, false, `${card.name}: no horizontal overflow`);
    assert.ok(geometry.art.length > 0, `${card.name}: artwork is present`);
    assert.ok(geometry.art.every(image => image.naturalWidth >= image.width * 2), `${card.name}: sharp artwork for a 2x capture, ${JSON.stringify(geometry.art)}`);
    assert.deepEqual(errors, [], `${card.name}: no browser errors`);
    assert.ok(requests.every(url => url.startsWith(`${origin}/assets/`)), `${card.name}: only owned static artwork requested`);
    await page.screenshot({ path: new URL(card.file, out).pathname, fullPage: true });
    await copyFile(new URL(card.file, out), new URL(card.file, hostedOut));
    const bytes = await readFile(new URL(card.file, out));
    screenshots.push({ file: card.file, prompt: card.prompt, tool: card.tool, input: card.input, sha256: digest(bytes), bytes: bytes.length, width: width * 2, height: height * 2, geometry, result: result.structuredContent });
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(new URL('screenshots.json', out), JSON.stringify({ generatedAt: new Date().toISOString(), source: `${origin}/mcp`, panelUri, panelSha256: digest(OCCASIONS_HTML), theme: 'dark', deviceScaleFactor: 2, timezone: 'Asia/Bangkok', syntheticExamples: true, screenshots }, null, 2) + '\n');
console.log(`Captured ${screenshots.length} sharp, versioned directory cards.`);
