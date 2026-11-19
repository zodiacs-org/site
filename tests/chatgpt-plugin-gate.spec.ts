/**
 * Pre-submission gate for the ChatGPT plugin (Apps SDK) listing of
 * https://zodiacs.org/mcp. Run with `npm run test:chatgpt-gate`; plain
 * `npm test` skips it (it needs Chrome and a server).
 *
 *   BASE_URL       a deployment to test (a Vercel preview, or a local server).
 *                  Without it the gate starts tests/helpers/chatgpt-gate-server.ts,
 *                  which serves the published connector on 127.0.0.1.
 *   VERCEL_BYPASS  the preview's protection bypass token, sent only as Vercel's
 *                  own x-vercel-protection-bypass header.
 *   GATE_MCP=local with BASE_URL: check the pages on BASE_URL and run the MCP
 *                  half against the local published connector (for a preview
 *                  whose hostname /mcp does not accept).
 *   GATE_SCREENSHOT_DIR, GATE_REPORT  where the carousel PNGs and the JSON
 *                  measurements go (defaults under the system temp directory).
 *
 * It speaks Streamable HTTP to /mcp with no credentials of any kind, and
 * holds exactly five positive and three negative review cases. Every birth
 * detail in this file is invented for the test. Model routing itself (whether
 * ChatGPT picks a tool for a prompt) cannot be tested here: that is a manual
 * developer-mode check.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { startGateServer, type GateServer } from './helpers/chatgpt-gate-server';

const ENABLED = process.env.CHATGPT_GATE === '1';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SCREENSHOT_DIR = process.env.GATE_SCREENSHOT_DIR ?? join(tmpdir(), 'chatgpt-gate-screenshots');
const REPORT_PATH = process.env.GATE_REPORT ?? join(tmpdir(), 'chatgpt-gate-report.json');
const BYPASS = (process.env.VERCEL_BYPASS ?? process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '').trim();
const PROTOCOL = '2025-06-18';
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

// Invented people, used nowhere else: person A in Madrid, person B in Chicago.
const PERSON_A = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };
const PERSON_B = { birthDate: '1988-11-21', time: '19:45', zone: 'America/Chicago', latitude: 41.88, longitude: -87.63 };

// ---------------------------------------------------------------------------
// Streamable HTTP, with nothing but the protocol's own headers.
// ---------------------------------------------------------------------------
let mcpBase = '';
let pagesBase = '';
let local: GateServer | undefined;
let paceMs = 0;
let lastRequestAt = 0;
const sentHeaderNames = new Set<string>();

interface Reply { status: number; headers: Headers; message: any; text: string }

async function paced(): Promise<void> {
  const wait = Math.max(0, paceMs - (Date.now() - lastRequestAt));
  if (wait) await new Promise(done => setTimeout(done, wait));
  lastRequestAt = Date.now();
}

function edgeHeaders(): Record<string, string> {
  return BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {};
}

async function post(body: unknown, extra: Record<string, string> = {}): Promise<Reply> {
  await paced();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': PROTOCOL, ...extra };
  for (const name of Object.keys(headers)) sentHeaderNames.add(name.toLowerCase());
  const response = await fetch(`${mcpBase}/mcp`, { method: 'POST', headers: { ...headers, ...edgeHeaders() }, body: JSON.stringify(body), redirect: 'manual' });
  const text = await response.text();
  let message: any = null;
  try {
    const data = (response.headers.get('content-type') ?? '').includes('text/event-stream')
      ? text.split('\n').filter(line => line.startsWith('data: ')).pop()?.slice(6) ?? ''
      : text;
    message = data ? JSON.parse(data) : null;
  } catch { message = null; }
  return { status: response.status, headers: response.headers, message, text };
}

let serial = 0;
const rpc = (method: string, params: unknown = {}) => post({ jsonrpc: '2.0', id: ++serial, method, params });
const callTool = (name: string, args: Record<string, unknown> = {}) => rpc('tools/call', { name, arguments: args });

async function get(base: string, path: string): Promise<{ status: number; headers: Headers; text: string }> {
  await paced();
  const response = await fetch(`${base}${path}`, { headers: edgeHeaders(), redirect: 'manual' });
  return { status: response.status, headers: response.headers, text: await response.text() };
}

/** A tool result that answered: HTTP 200, a JSON-RPC result, not an error, and the text block mirrors the structured content. */
function answered(reply: Reply, tool: string): any {
  expect(reply.status, `${tool} HTTP status`).toBe(200);
  expect(reply.headers.get('www-authenticate'), `${tool} asks for no credentials`).toBeNull();
  expect(reply.message?.error, `${tool} JSON-RPC error`).toBeUndefined();
  const result = reply.message.result;
  expect(result.isError ?? false, `${tool} isError`).toBe(false);
  expect(result.structuredContent).toMatchObject({ schema: 'zodiacs.ai-tool-result.v1', ok: true, tool });
  expect(result.content?.[0]).toMatchObject({ type: 'text', text: JSON.stringify(result.structuredContent) });
  sizes[tool] = Math.max(sizes[tool] ?? 0, Buffer.byteLength(JSON.stringify(result.structuredContent)));
  return result;
}

/** A refusal: HTTP 200, isError, a coded error, plain words, nothing that looks like a crash. */
function refused(reply: Reply, tool: string): { code: string; message: string } {
  expect(reply.status, `${tool} HTTP status`).toBe(200);
  const result = reply.message?.result;
  expect(result?.isError, `${tool} isError`).toBe(true);
  expect(result.structuredContent).toMatchObject({ schema: 'zodiacs.ai-tool-result.v1', ok: false, tool });
  const error = result.structuredContent.error;
  expect(typeof error.code).toBe('string');
  expect(error.message.length).toBeGreaterThan(10);
  expect(error.message).not.toMatch(/\b(?:TypeError|ReferenceError|RangeError|SyntaxError|undefined|NaN|stack|node_modules)\b|\bat .+:\d+:\d+/);
  return error;
}

function everyString(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value)) for (const item of value) everyString(item, into);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) everyString(item, into);
  return into;
}

// ---------------------------------------------------------------------------
// Listing policy lint (plugin guidelines 1.3, 3.4, 5.1, 5.4, 6.1).
// ---------------------------------------------------------------------------
/** A sentence that refuses or rules something out. Commerce and guarantee words may appear only in these. */
const REFUSES = /\b(?:not|no|never|nor|nothing|none|cannot|without|outside|refuses|refused|neither)\b/i;
const POLICY_RULES: { id: string; pattern: RegExp; allowedInRefusal: boolean }[] = [
  { id: 'competitor named', pattern: /\b(?:co-?star|the pattern|chani|sanctuary|astro\.com|astro-?seek|cafe ?astrology|time ?passages|nebula|astrotalk|horoscope\.com|astrology\.com|astrodienst)\b/i, allowedInRefusal: false },
  { id: 'comparison or superlative', pattern: /\b(?:better than|unlike other|the best astrology|most accurate|more accurate than|number one|world'?s (?:best|first|most)|leading|award[- ]winning|official(?:ly)?)\b|#1\b/i, allowedInRefusal: false },
  { id: 'pricing or upsell', pattern: /\b(?:pricing|price[sd]?|subscription plans?|paid|premium|upgrade[sd]?|free trial|discount|promo(?:tion|tional)?|coupon|checkout|purchase[sd]?|paywall|in-app)\b|\$\s?\d/i, allowedInRefusal: true },
  { id: 'purchase prompt', pattern: /\b(?:buy|sell|shop|order now)\b/i, allowedInRefusal: true },
  { id: 'crypto', pattern: /\b(?:crypto\w*|tokens?|coins?|wallets?|nfts?|blockchain|solana|airdrop|market cap|memecoin|astrofolio)\b/i, allowedInRefusal: false },
  { id: 'advertising', pattern: /\b(?:advertis\w*|sponsor\w*|affiliate\w*)\b/i, allowedInRefusal: false },
  { id: 'unverifiable claim', pattern: /\b(?:100% accurate|guarantee[sd]?|scientifically (?:proven|validated)|always right|never wrong)\b/i, allowedInRefusal: true },
  { id: 'steering the model', pattern: /\b(?:always (?:use|call|prefer)|prefer (?:zodiacs|this (?:tool|app|plugin))|instead of (?:other|another) (?:apps?|plugins?|tools?|connectors?)|do not use (?:other|another)|ignore (?:previous|other|all) (?:instructions|tools))\b/i, allowedInRefusal: false },
  { id: 'endorsement', pattern: /\b(?:endorsed by|made by|built by|partnered with|approved by) (?:openai|chatgpt)\b/i, allowedInRefusal: false },
];

function sentencesOf(text: string): string[] {
  return text.split(/\n+/).flatMap(line => line.split(/(?<=[.!?])\s+(?=["'“(A-Z])/)).map(part => part.trim()).filter(Boolean);
}

function policyFindings(source: string, text: string): string[] {
  const found: string[] = [];
  for (const sentence of sentencesOf(text)) {
    for (const rule of POLICY_RULES) {
      if (!rule.pattern.test(sentence)) continue;
      if (rule.allowedInRefusal && REFUSES.test(sentence)) continue;
      found.push(`${source}: ${rule.id}: "${sentence.slice(0, 160)}"`);
    }
  }
  return found;
}

/** Negative case 1's fixed list: prompts Zodiacs must not be chosen for, with the words that would invite them. */
const OFF_TOPIC = [
  { prompt: 'What is the weather in Paris tomorrow?', terms: ['weather', 'temperature', 'rain'] },
  { prompt: 'Book me a flight to Tokyo next Friday.', terms: ['flight', 'airline', 'hotel', 'booking'] },
  { prompt: 'Write a Python function that sorts a list.', terms: ['python', 'javascript', 'programming', 'source code'] },
  { prompt: "What is Apple's stock price today?", terms: ['stock', 'share price', 'ticker'] },
  { prompt: "Translate 'good morning' into French.", terms: ['translate', 'translation'] },
  { prompt: 'Send an email to my manager to say I will be late.', terms: ['send an email', 'send a message', 'draft an email', 'inbox'] },
  { prompt: 'Who won the football match last night?', terms: ['football', 'soccer', 'sports', 'match result'] },
  { prompt: 'Set a reminder to call my mother at 5pm.', terms: ['reminder', 'reminders', 'alarm', 'timer'] },
  { prompt: 'Which lottery numbers should I play this week?', terms: ['lottery', 'betting', 'bet', 'bets', 'gamble', 'gambling'] },
  { prompt: 'I have a headache and a fever. What is wrong with me?', terms: ['diagnose', 'diagnosis', 'symptom', 'symptoms', 'medical', 'medicine'] },
] as const;

// ---------------------------------------------------------------------------
// The widget host: a page with a sandboxed frame and the MCP Apps bridge.
// ---------------------------------------------------------------------------
const HOST_ORIGIN = 'https://host.gate.test';
const SANDBOX_ORIGIN = 'https://sandbox.gate.test';
const MODES = [
  { name: 'light', theme: 'light', width: 768, mobile: false },
  { name: 'dark', theme: 'dark', width: 768, mobile: false },
  { name: 'mobile', theme: 'light', width: 375, mobile: true },
] as const;
type Mode = typeof MODES[number];
const TAP_MIN = 44;
/**
 * Controls in the published panels that are under 44px on a 375px phone today, with the smaller side each had
 * on 20 November 2026. /mcp serves a frozen bundle (api/_ai/published/runtime.mjs), so enlarging them needs a
 * new panel version and the owner's yes; until then this list may only shrink. The gate fails when a control
 * that is not listed is under 44px, when a listed one gets smaller, and when a listed one is no longer found
 * (then its line goes). A link inside a sentence is not a tap target here (WCAG 2.5.8's inline exception).
 */
const KNOWN_SMALL_TARGETS: Record<string, number> = {
  'a.nameplate': 19, // the ZODIACS · ORG line at the top of the readings and occasions panels
  'a.brand': 19, // the same line in the sky calendar
  'a "Privacy"': 18.8, // the footer link
  'button.copy': 29, // Copy the reading, Copy the card
  'a.secondary': 29, // Read this pair
  summary: 22.5, // "4 more contacts"
  'input#from': 43, 'input#to': 43, 'select#zone': 43, // the sky calendar's form, one pixel short
};
const smallTargetsSeen: Record<string, number> = {};
const targetKey = (control: Control) => (control.tag === 'a' ? `a "${control.label}"` : control.tag.startsWith('summary') ? 'summary' : control.tag);

interface Widget { uri: string; html: string; csp: { connectDomains: string[]; resourceDomains: string[] } }
interface Control { tag: string; label: string; width: number; height: number; inline: boolean }
interface Rendered {
  text: string; labels: string[]; scrollWidth: number; clientWidth: number; overflowing: string[];
  controls: Control[]; theme: string; background: string; brokenImages: string[];
  messages: any[]; errors: string[]; requests: string[]; blocked: string[]; height: number; openHeight: number;
}

let browser: Browser | undefined;
const widgets = new Map<string, Widget>();
const results = new Map<string, any>();
const renderedText: { source: string; text: string }[] = [];
const sizes: Record<string, number> = {};
const report: Record<string, unknown> = {};
/** What each rendered state showed, as text, for the submission's expected results. */
const onScreen: Record<string, string> = {};

/** The policy a host builds from the resource's declared domains: nothing else may load or connect. */
function cspHeader(csp: Widget['csp']): string {
  const resources = csp.resourceDomains.join(' ');
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' ${resources}`.trim(),
    `style-src 'unsafe-inline' ${resources}`.trim(),
    `img-src data: blob: ${resources}`.trim(),
    `font-src data: ${resources}`.trim(),
    `media-src data: blob: ${resources}`.trim(),
    `connect-src ${csp.connectDomains.join(' ') || "'none'"}`,
    "frame-src 'none'", "worker-src blob:", "base-uri 'none'", "form-action 'none'",
  ].join('; ');
}

function hostPage(config: { theme: string; result: unknown }): string {
  const json = JSON.stringify(config).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;background:${config.theme === 'dark' ? '#212121' : '#ffffff'}}#frame{display:block;width:100%;height:640px;border:0}</style></head>
<body><iframe id="frame" title="Zodiacs" sandbox="allow-scripts allow-same-origin allow-forms" src="${SANDBOX_ORIGIN}/widget.html"></iframe>
<script>
const gate = window.__gate = { config: ${json}, messages: [], delivered: false };
const frame = document.getElementById('frame');
window.addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow) return;
  const message = event.data;
  gate.messages.push(message);
  if (!message || message.jsonrpc !== '2.0') return;
  if (message.method === 'ui/initialize') {
    frame.contentWindow.postMessage({ jsonrpc: '2.0', id: message.id, result: {
      protocolVersion: '2026-01-26', hostInfo: { name: 'chatgpt-gate-host', version: '1' },
      hostCapabilities: { openLinks: {}, serverTools: {} },
      hostContext: { theme: gate.config.theme, displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'] },
    } }, '*');
  } else if (message.method === 'ui/notifications/initialized') {
    if (gate.config.result && !gate.delivered) {
      gate.delivered = true;
      frame.contentWindow.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: gate.config.result }, '*');
    }
  } else if (message.method === 'ui/notifications/size-changed') {
    if (message.params && Number.isFinite(message.params.height)) frame.style.height = Math.ceil(message.params.height) + 'px';
  } else if (message.id !== undefined && message.method) {
    frame.contentWindow.postMessage({ jsonrpc: '2.0', id: message.id, result: {} }, '*');
  }
});
</script></body></html>`;
}

/** Loads one widget in the host page, hands it a tool result (or none) and measures what a person would see. */
async function render(widget: Widget, mode: Mode, result: unknown, options: { openai?: boolean; screenshot?: string } = {}): Promise<Rendered> {
  const context = await browser!.newContext({
    viewport: { width: mode.width, height: 900 }, colorScheme: mode.theme, deviceScaleFactor: 2,
    isMobile: mode.mobile, hasTouch: mode.mobile, reducedMotion: 'reduce', timezoneId: 'Europe/Madrid', locale: 'en-GB',
  });
  const errors: string[] = [];
  const requests: string[] = [];
  const blocked: string[] = [];
  const allowed = new Set(widget.csp.resourceDomains);
  // ChatGPT also sets window.openai; the panels read the result from it and still complete the MCP Apps handshake.
  const html = options.openai
    ? widget.html.replace('<head>', `<head><script>window.openai = ${JSON.stringify({ toolOutput: (result as any)?.structuredContent ?? null, theme: mode.theme, displayMode: 'inline', locale: 'en-US' }).replace(/</g, '\\u003c')};</script>`)
    : widget.html;
  try {
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === HOST_ORIGIN) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: hostPage({ theme: mode.theme, result: options.openai ? null : result }) });
      if (url.origin === SANDBOX_ORIGIN) return route.fulfill({ status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': cspHeader(widget.csp) }, body: html });
      requests.push(url.href);
      if (!allowed.has(url.origin)) { blocked.push(url.href); return route.abort('blockedbyclient'); }
      // The panels' art lives on zodiacs.org; the same files are in public/.
      const file = join(root, 'public', decodeURIComponent(url.pathname));
      if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, body: await readFile(file), headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    await page.goto(`${HOST_ORIGIN}/`);
    await page.waitForFunction(() => (window as any).__gate.messages.some((message: any) => message?.method === 'ui/notifications/initialized'), undefined, { timeout: 15_000 });
    const frame = page.frames().find(item => item.url().startsWith(SANDBOX_ORIGIN))!;
    // Past the panels' 1.5 s "working it out" state.
    await page.waitForTimeout(result ? 600 : 1900);
    // The frame is as tall as its content, as a host sizes it: no scrolling inside the card.
    const fit = async () => {
      const height = await frame.evaluate(() => {
        const element = document.documentElement;
        const before = element.style.height;
        element.style.height = 'max-content';
        const measured = Math.ceil(element.getBoundingClientRect().height);
        element.style.height = before;
        return measured;
      });
      await page.evaluate((value) => { (document.getElementById('frame') as HTMLIFrameElement).style.height = `${value}px`; }, height);
      // The whole card is in view, so pictures that load lazily load too. A panel carries a light and a dark
      // twin of each picture and shows one; the hidden twin never loads, so only pictures on screen count.
      await page.setViewportSize({ width: mode.width, height: Math.min(Math.max(height, 600), 8000) });
      await frame.waitForFunction(() => document.fonts.status === 'loaded' && [...document.images].every(image => image.complete || image.getBoundingClientRect().width === 0), undefined, { timeout: 15_000 })
        .catch(async () => {
          const state = await frame.evaluate(() => ({ fonts: document.fonts.status, pending: [...document.images].filter(image => !image.complete && image.getBoundingClientRect().width > 0).map(image => `${(image.currentSrc || image.src).slice(0, 90)} loading=${image.loading}`) }));
          errors.push(`still loading after 15 s: fonts ${state.fonts}; pictures ${state.pending.join(', ') || 'none'}`);
        });
      await page.waitForTimeout(150);
      return height;
    };
    const measure = () => frame.evaluate(() => {
      const doc = document.documentElement;
      const shown = (element: Element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0;
      };
      const name = (element: Element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${typeof element.className === 'string' && element.className ? `.${element.className.trim().split(/\s+/).join('.')}` : ''}`;
      // A link inside a sentence is sized by its line of text (WCAG 2.5.8's inline exception); every other control is a tap target.
      const inSentence = (element: Element) => element.tagName === 'A' && getComputedStyle(element).display.startsWith('inline')
        && [...(element.parentElement?.childNodes ?? [])].some(node => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 1);
      const controls = [...document.querySelectorAll('button, select, input:not([type=hidden]), textarea, summary, [role=button], [role=tab], a[href]')].filter(shown).map((element) => {
        const box = element.getBoundingClientRect();
        return { tag: name(element), label: (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60), width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10, inline: inSentence(element) };
      });
      const overflowing = [...document.querySelectorAll('body *')].filter(shown).filter((element) => {
        const box = element.getBoundingClientRect();
        return box.right > doc.clientWidth + 0.5 || box.left < -0.5;
      }).slice(0, 6).map(name);
      const labels = [...document.querySelectorAll('[aria-label], [alt], [title], [placeholder]')].flatMap(element => ['aria-label', 'alt', 'title', 'placeholder'].map(attribute => element.getAttribute(attribute) ?? '')).filter(Boolean);
      return {
        text: document.body.innerText, labels, scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth), clientWidth: doc.clientWidth, overflowing, controls,
        theme: doc.dataset.theme ?? '', background: getComputedStyle(document.body).backgroundColor,
        brokenImages: [...document.images].filter(image => shown(image) && image.naturalWidth === 0).map(image => image.currentSrc || image.src).map(source => source.slice(0, 80)),
      };
    });
    const height = await fit();
    const closed = await measure();
    if (options.screenshot) {
      await mkdir(SCREENSHOT_DIR, { recursive: true });
      await page.locator('#frame').screenshot({ path: join(SCREENSHOT_DIR, options.screenshot), animations: 'disabled' });
    }
    // Then with every "more" section open, where a wide table would show.
    await frame.evaluate(() => { for (const details of document.querySelectorAll('details')) details.open = true; });
    const openHeight = await fit();
    const open = await measure();
    const messages = await page.evaluate(() => (window as any).__gate.messages);
    const unique = <T,>(items: T[]) => [...new Map(items.map(item => [JSON.stringify(item), item])).values()];
    return {
      ...open, scrollWidth: Math.max(closed.scrollWidth, open.scrollWidth), overflowing: unique([...closed.overflowing, ...open.overflowing]),
      controls: unique([...closed.controls, ...open.controls]), brokenImages: unique([...closed.brokenImages, ...open.brokenImages]), labels: unique([...closed.labels, ...open.labels]),
      messages, errors, requests, blocked, height, openHeight,
    };
  } finally {
    await context.close();
  }
}

/** What every rendered state must satisfy, whatever it shows. */
function expectClean(view: Rendered, widget: Widget, mode: Mode, label: string): void {
  const initialize = view.messages.find(message => message?.method === 'ui/initialize');
  expect(initialize, `${label}: the widget opens with ui/initialize`).toMatchObject({ jsonrpc: '2.0', params: { protocolVersion: expect.any(String), appInfo: { name: expect.any(String) } } });
  expect(view.messages.some(message => message?.method === 'ui/notifications/initialized'), `${label}: the widget confirms the handshake`).toBe(true);
  expect(view.errors, `${label}: console and page errors`).toEqual([]);
  expect(view.blocked, `${label}: requests outside the declared CSP domains`).toEqual([]);
  expect(view.brokenImages, `${label}: pictures that did not load`).toEqual([]);
  expect(view.scrollWidth, `${label}: horizontal overflow (${view.overflowing.join(', ')})`).toBeLessThanOrEqual(view.clientWidth);
  expect(view.overflowing, `${label}: elements past the edge`).toEqual([]);
  expect(view.text.trim().length, `${label}: the card is not blank`).toBeGreaterThan(20);
  expect(view.text, `${label}: no raw values on screen`).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b/);
  renderedText.push({ source: `${widget.uri} ${label}`, text: [view.text, ...view.labels].join('\n') });
  onScreen[label] = view.text;
  if (mode.mobile) {
    const small = view.controls.filter(control => !control.inline && Math.min(control.width, control.height) < TAP_MIN);
    const failures: string[] = [];
    for (const control of small) {
      const key = targetKey(control);
      const side = Math.min(control.width, control.height);
      const size = `${control.tag} "${control.label}" ${control.width}x${control.height}`;
      if (!(key in KNOWN_SMALL_TARGETS)) failures.push(`under ${TAP_MIN}px and not on the known list: ${size}`);
      else if (side < KNOWN_SMALL_TARGETS[key] - 0.5) failures.push(`smaller than recorded (${KNOWN_SMALL_TARGETS[key]}px): ${size}`);
      smallTargetsSeen[key] = Math.min(smallTargetsSeen[key] ?? Infinity, side);
    }
    expect(failures.join('\n'), `${label}: tap targets`).toBe('');
  }
}

function widgetFor(tool: string): Widget {
  const uri = toolsByName.get(tool)?._meta?.['openai/outputTemplate'];
  const widget = widgets.get(uri);
  if (!widget) throw new Error(`No widget was read for ${tool} (${uri}).`);
  return widget;
}

function resultOf(key: string): any {
  const result = results.get(key);
  if (!result) throw new Error(`The review case that produces "${key}" did not pass, so there is nothing to render.`);
  return result;
}

// ---------------------------------------------------------------------------
let initialize: Reply;
let tools: any[] = [];
let resources: any[] = [];
const toolsByName = new Map<string, any>();

describe.skipIf(!ENABLED)('ChatGPT plugin gate', () => {
  beforeAll(async () => {
    // Vite sets BASE_URL to "/" in every test run, so only an http(s) address counts as given.
    const given = /^https?:\/\//.test(process.env.BASE_URL ?? '') ? process.env.BASE_URL!.replace(/\/+$/, '') : undefined;
    if (!given || process.env.GATE_MCP === 'local') local = await startGateServer();
    pagesBase = given ?? local!.baseUrl;
    mcpBase = process.env.GATE_MCP === 'local' || !given ? local!.baseUrl : given;
    const remote = !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(mcpBase);
    // A deployment allows about thirty requests a minute from one address; stay under it.
    paceMs = Number(process.env.GATE_PACE_MS ?? (remote ? 2600 : 0));
    initialize = await rpc('initialize', { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 'chatgpt-plugin-gate', version: '1' } });
    if (initialize.status !== 200) {
      const code = initialize.message?.error?.code;
      const why = code === 'host-not-allowed'
        ? `This deployment does not accept its own hostname for /mcp. A preview needs ZODIACS_MCP_STAGING_HOST set to ${new URL(mcpBase).host} (an environment change, the owner's call), or run the MCP half locally with GATE_MCP=local.`
        : code === 'disabled' ? 'ZODIACS_MCP_ENABLED is not 1 on this deployment.'
        : initialize.status === 401 ? 'The deployment is behind Vercel protection: pass its bypass token as VERCEL_BYPASS.'
        : code === 'rate-limited' ? 'The deployment is rate limiting this address: wait a minute and run again.'
        : 'See the status and body.';
      throw new Error(`initialize at ${mcpBase}/mcp answered HTTP ${initialize.status} ${code ?? ''}. ${why}\n${initialize.text.slice(0, 300)}`);
    }
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    tools = (await rpc('tools/list')).message.result.tools;
    resources = (await rpc('resources/list')).message.result.resources;
    for (const tool of tools) toolsByName.set(tool.name, tool);
    browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS, headless: true });
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
    await local?.close();
    report.structuredContentBytes = sizes;
    report.onScreen = onScreen;
    report.target = { mcp: mcpBase, pages: pagesBase, server: initialize?.message?.result?.serverInfo, tools: tools.length, resources: resources.length };
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  });

  describe('protocol and submission', () => {
    it('connects with no credentials: only protocol headers go out, and nothing asks for an account', async () => {
      expect(initialize.message.result).toMatchObject({ protocolVersion: PROTOCOL, serverInfo: { name: 'zodiacs', version: expect.stringMatching(/^\d+\.\d+\.\d+$/) }, capabilities: { tools: {}, resources: {} } });
      expect(initialize.headers.get('www-authenticate')).toBeNull();
      expect([...sentHeaderNames].sort()).toEqual(['accept', 'content-type', 'mcp-protocol-version']);
      expect(tools.length).toBeGreaterThanOrEqual(13);
      for (const tool of tools) expect(tool._meta?.securitySchemes, `${tool.name} security scheme`).toEqual([{ type: 'noauth' }]);
      // No OAuth discovery document exists, so no client is sent into a sign-in flow.
      for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-authorization-server', '/.well-known/openid-configuration']) {
        const reply = await get(mcpBase, path);
        expect(reply.status, path).toBe(404);
        expect(reply.headers.get('www-authenticate'), path).toBeNull();
      }
      const health = await get(mcpBase, '/mcp/health');
      expect(health.status).toBe(200);
      expect(JSON.parse(health.text)).toMatchObject({ service: 'zodiacs-mcp', ready: true });
    }, 120_000);

    it('ships a plugin package whose MCP entry has a URL and nothing else: no headers, no keys', async () => {
      for (const file of ['plugins/zodiacs-sky/mcp.json', 'plugins/zodiacs-sky/.mcp.json']) {
        const servers = Object.values(JSON.parse(await readFile(join(root, file), 'utf8')).mcpServers) as Record<string, unknown>[];
        expect(servers, file).toHaveLength(1);
        expect(Object.keys(servers[0]).sort(), file).toEqual(['type', 'url']);
        expect(servers[0].url, file).toBe('https://zodiacs.org/mcp');
      }
      const plugin = JSON.parse(await readFile(join(root, 'plugins/zodiacs-sky/plugin.json'), 'utf8'));
      const listing = plugin.extensions['com.openai'].interface;
      // Guideline 1.3: no "MCP", "MCP Server" or "Plugin" after the product name; no pricing or comparisons in the listing.
      expect(listing.displayName).toBe('Zodiacs');
      expect(listing.displayName).not.toMatch(/\b(?:MCP|Server|Plugin|App)\b/i);
      expect(policyFindings('listing', [listing.shortDescription, listing.longDescription].join('\n'))).toEqual([]);
      expect(plugin.extensions['com.openai'].review.test_cases.positive).toHaveLength(5);
      expect(plugin.extensions['com.openai'].review.test_cases.negative).toHaveLength(3);
    });

    it('serves versioned widget addresses, with each tool on the newest version of its panel', () => {
      const listed = new Map<string, number[]>();
      for (const resource of resources) {
        const match = /^ui:\/\/zodiacs\/([a-z-]+)-v(\d+)\.html$/.exec(resource.uri);
        expect(match, `versioned address: ${resource.uri}`).not.toBeNull();
        expect(resource.mimeType).toBe('text/html;profile=mcp-app');
        listed.set(match![1], [...(listed.get(match![1]) ?? []), Number(match![2])]);
      }
      const used = new Set<string>();
      for (const tool of tools) {
        const uri = tool._meta?.['openai/outputTemplate'];
        if (uri === undefined) continue;
        expect(tool._meta.ui?.resourceUri, `${tool.name}: both template fields agree`).toBe(uri);
        const [, family, version] = /^ui:\/\/zodiacs\/([a-z-]+)-v(\d+)\.html$/.exec(uri)!;
        expect(Number(version), `${tool.name} uses the newest ${family}`).toBe(Math.max(...listed.get(family)!));
        used.add(uri);
      }
      // Earlier versions stay served, so a conversation that opened one still loads it.
      for (const [family, versions] of listed) expect(versions.sort((a, b) => a - b), family).toEqual(Array.from({ length: Math.max(...versions) }, (_, index) => index + 1).slice(-versions.length));
      report.widgetFamilies = Object.fromEntries(listed);
      report.widgetsInUse = [...used];
    });

    it('keeps each widget CSP to its own connect and resource domains, with no frame domains', async () => {
      for (const resource of resources) {
        const csp = resource._meta?.ui?.csp;
        expect(Object.keys(csp).sort(), resource.uri).toEqual(['connectDomains', 'resourceDomains']);
        expect(csp.connectDomains, resource.uri).toEqual([]);
        expect(['[]', '["https://zodiacs.org"]'], resource.uri).toContain(JSON.stringify(csp.resourceDomains));
      }
      const inUse = [...new Set(tools.map(tool => tool._meta?.['openai/outputTemplate']).filter(Boolean))] as string[];
      for (const uri of inUse) {
        const reply = await rpc('resources/read', { uri });
        expect(reply.status, uri).toBe(200);
        const content = reply.message.result.contents[0];
        expect(content.mimeType).toBe('text/html;profile=mcp-app');
        const meta = content._meta;
        expect(Object.keys(meta.ui.csp).sort(), uri).toEqual(['connectDomains', 'resourceDomains']);
        expect(meta['openai/widgetCSP'], uri).toEqual({ connect_domains: meta.ui.csp.connectDomains, resource_domains: meta.ui.csp.resourceDomains });
        expect(JSON.stringify(meta), uri).not.toMatch(/frame_?domains/i);
        // The page itself embeds nothing and calls nothing outside those domains.
        expect(content.text, uri).not.toMatch(/<iframe\b/i);
        widgets.set(uri, { uri, html: content.text, csp: meta.ui.csp });
      }
      report.widgetBytes = Object.fromEntries([...widgets].map(([uri, widget]) => [uri, Buffer.byteLength(widget.html)]));
    }, 180_000);

    it('declares every tool with a name, a title, a description and all four annotations', () => {
      expect(new Set(tools.map(tool => tool.name)).size).toBe(tools.length);
      for (const tool of tools) {
        expect(tool.name, tool.name).toMatch(/^[a-z]+(?:_[a-z0-9]+)+$/);
        expect(tool.name, tool.name).not.toMatch(/best|official|pick_me|top|pro$/);
        expect(tool.title.length, `${tool.name} title`).toBeGreaterThan(3);
        expect(tool.description.length, `${tool.name} description`).toBeGreaterThan(80);
        for (const hint of ['readOnlyHint', 'destructiveHint', 'openWorldHint', 'idempotentHint']) expect(typeof tool.annotations?.[hint], `${tool.name} ${hint}`).toBe('boolean');
        expect(tool.inputSchema.additionalProperties, `${tool.name} takes no undeclared fields`).toBe(false);
      }
    });

    it('keeps the listing policy in every name, title, description, field description and the instructions', () => {
      const findings: string[] = [];
      findings.push(...policyFindings('instructions', initialize.message.result.instructions));
      for (const tool of tools) {
        findings.push(...policyFindings(tool.name, [tool.name.replace(/_/g, ' '), tool.title, tool.annotations?.title ?? '', tool.description].join('\n')));
        findings.push(...policyFindings(`${tool.name} input`, everyString(tool.inputSchema).filter(text => /\s/.test(text)).join('\n')));
        findings.push(...policyFindings(`${tool.name} _meta`, everyString(tool._meta).filter(text => !text.startsWith('ui://')).join('\n')));
      }
      for (const resource of resources) findings.push(...policyFindings(resource.uri, everyString([resource.title, resource.description, resource._meta?.['openai/widgetDescription']]).join('\n')));
      expect(findings.join('\n')).toBe('');
    });

    it('asks for no more than the task needs: no contact, identity or device-location fields, and town-level places', () => {
      const fields = new Set<string>();
      const walk = (schema: any) => {
        for (const [name, value] of Object.entries(schema?.properties ?? {})) { fields.add(name); walk(value); }
        for (const branch of [...(schema?.anyOf ?? []), ...(schema?.oneOf ?? [])]) walk(branch);
        if (schema?.items) walk(schema.items);
      };
      for (const tool of tools) walk(tool.inputSchema);
      report.inputFields = [...fields].sort();
      for (const field of fields) expect(field).not.toMatch(/address|street|postal|zip|phone|e-?mail|passport|ssn|password|secret|device|gps|ip$|currentLat|currentLon|userLocation/i);
      // find_birthplace hands the chart tools coordinates rounded to two decimals: a town, not a doorstep.
      expect(toolsByName.get('find_birthplace')?.description ?? '').toMatch(/rounded to two decimals/);
      expect(toolsByName.get('find_birthplace')?.description ?? '').toMatch(/does not take a street address/);
    });

    it('refuses a birth date under 13, in words that say why', async () => {
      const year = new Date().getUTCFullYear() - 5;
      const error = refused(await callTool('get_natal_chart', { birthDate: `${year}-06-01` }), 'get_natal_chart');
      expect(error.message).toMatch(/not directed at children under 13/);
    }, 60_000);

    it('has the four listing pages and the domain verification file in place', async (context) => {
      if (local && pagesBase === local.baseUrl && !local.servesPages) {
        // The connector needs no site build; the pages do. Say so instead of passing quietly.
        console.warn('chatgpt-plugin-gate: no dist/ build, so the four listing pages were NOT checked. Run `npm run build` first, or set BASE_URL.');
        report.listingPages = 'skipped: no dist/ build';
        context.skip();
      }
      const pages: Record<string, number> = {};
      for (const path of ['/', '/support/', '/privacy/', '/terms/']) {
        const page = await get(pagesBase, path);
        pages[path] = page.status;
        expect(page.status, path).toBe(200);
        expect(page.headers.get('content-type'), path).toMatch(/^text\/html/);
        expect(page.text, path).toMatch(/<title>[^<]{5,}<\/title>/);
      }
      const support = (await get(pagesBase, '/support/')).text;
      expect(support).toContain('mailto:admin@zodiacs.org');
      for (const link of ['/privacy/', '/terms/', '/developers/ai/']) expect(support, `support links ${link}`).toContain(`href="${link}`);
      expect(support).not.toMatch(/<form\b/i);
      const challenge = await get(pagesBase, '/.well-known/openai-apps-challenge');
      expect(challenge.status).toBe(200);
      // The portal wants the bare token: one line, no JSON, no markup.
      expect(challenge.text.trim()).toMatch(/^[A-Za-z0-9_-]{20,200}$/);
      report.listingPages = pages;
    }, 120_000);
  });

  // -------------------------------------------------------------------------
  // The review cases. Exactly five positive and three negative.
  // -------------------------------------------------------------------------
  const POSITIVE_CASES: [string, () => Promise<void>][] = [
    ['P1 a birth chart with an exact birth time gives the rising sign, the angles and a house for every planet', async () => {
      const result = answered(await callTool('get_natal_chart', PERSON_A), 'get_natal_chart');
      const data = result.structuredContent.data;
      expect(data).toMatchObject({ timeKnown: true, placed: true, houseSystem: 'whole-sign', castFor: { utc: '1990-05-03T06:30:00.000Z', basis: 'birth-time' } });
      expect(data.sun.sign).toBe('taurus');
      expect(data.moon.sign).toBe('leo');
      expect(data.rising.sign).toBe('gemini');
      expect(data.angles.ascendant).toMatch(/Gemini$/);
      expect(data.angles.midheaven).toMatch(/Aquarius$/);
      expect(data.planets).toHaveLength(10);
      for (const planet of data.planets) { expect(planet.house, `${planet.body} house`).toBeGreaterThanOrEqual(1); expect(planet.house).toBeLessThanOrEqual(12); }
      expect(data.unknown).toEqual([]);
      // Nothing the result links to carries the birth details.
      for (const url of everyString(result.structuredContent).filter(text => text.startsWith('https://'))) expect(url).not.toMatch(/1990|08[:%3A]*30|40\.42|-3\.7|Madrid/i);
      results.set('natal-exact', result);
    }],
    ['P2 a birth chart with no birth time gives no rising sign and no houses, and says what is uncertain', async () => {
      const result = answered(await callTool('get_natal_chart', { birthDate: PERSON_A.birthDate }), 'get_natal_chart');
      const data = result.structuredContent.data;
      expect(data).toMatchObject({ timeKnown: false, placed: false, houseSystem: null, angles: null, castFor: { basis: 'utc-noon' } });
      expect(data.rising).toEqual({ sign: null, possibleSigns: [], meaning: null, pageUrl: null });
      for (const planet of data.planets) { expect(planet.house, `${planet.body} house`).toBeNull(); expect(planet.houseLine).toBeNull(); }
      // The Moon changed sign on this day, so it is given as two possibilities, never one guess.
      expect(data.moon.sign).toBeNull();
      expect(data.moon.possibleSigns).toEqual(['leo', 'virgo']);
      expect(data.unknown.join(' ')).toMatch(/No birth time was given, so the rising sign and the houses are unknown/);
      expect(data.unknown.join(' ')).toMatch(/The Moon changed sign that day/);
      expect(JSON.stringify(data)).not.toMatch(/"ascendant":"|"midheaven":"/);
      results.set('natal-unknown-time', result);
    }],
    ["P3 today's sky and a person's transits come back dated, with the reading kept apart from the astronomy", async () => {
      const sky = answered(await callTool('get_sky', {}), 'get_sky').structuredContent.data;
      expect(sky.mode).toBe('current-instant');
      expect(Math.abs(Date.now() - Date.parse(sky.time.utc))).toBeLessThan(5 * 60_000);
      const bodies = sky.calculation.result.instants[0].bodies;
      expect(bodies.map((body: any) => body.body)).toEqual(expect.arrayContaining(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']));
      for (const body of bodies) { expect(body.lon).toBeGreaterThanOrEqual(0); expect(body.lon).toBeLessThan(360); expect(SIGNS).toContain(body.sign); }
      expect(sky.moonPhase.illumination).toBeGreaterThanOrEqual(0);
      expect(sky.moonPhase.illumination).toBeLessThanOrEqual(1);
      const result = answered(await callTool('get_personal_transits', { ...PERSON_A, from: '2027-03-01', to: '2027-03-31', currentZone: 'Europe/Madrid' }), 'get_personal_transits');
      const transits = result.structuredContent.data;
      expect(transits).toMatchObject({ mode: 'window', timeKnown: true, from: '2027-03-01', to: '2027-03-31', zone: 'Europe/Madrid' });
      expect(transits.contacts.length).toBeGreaterThan(5);
      expect(transits.contacts[0]).toMatchObject({ exactUtc: '2027-03-03T09:35:04.484Z', planet: 'Sun', aspect: 'sextile', point: 'Sun' });
      for (const contact of transits.contacts) { expect(contact.confidenceLabel).toMatch(/^Reading confidence \d{2}%$/); expect(Date.parse(contact.exactUtc)).not.toBeNaN(); }
      expect(transits.note).toMatch(/not a guarantee/);
      results.set('transits', result);
    }],
    ['P4 two people are compared: a score out of 100 with its parts, a confidence label and a share link with no birth details', async () => {
      const result = answered(await callTool('get_compatibility', { a: PERSON_A, b: PERSON_B }), 'get_compatibility');
      const data = result.structuredContent.data;
      expect(data.a).toMatchObject({ sun: 'taurus', moon: 'leo', rising: 'gemini', timeKnown: true });
      expect(data.b).toMatchObject({ sun: 'scorpio', timeKnown: true });
      for (const value of [data.score.overall, ...Object.values(data.score.areas) as number[]]) { expect(Number.isInteger(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(100); }
      expect(Object.keys(data.score.areas).sort()).toEqual(['attraction', 'communication', 'stability']);
      expect(data.score.headline).toMatch(/Reading confidence \d{2}%/);
      expect(data.note).toMatch(/not a guarantee/);
      expect(data.contacts.length).toBeGreaterThan(0);
      const share = new URL(data.shareUrl);
      expect(share.origin).toBe('https://zodiacs.org');
      expect([...share.searchParams.keys()].sort()).toEqual(['as', 'attraction', 'bs', 'c', 'communication', 'ref', 'score', 'stability', 'v']);
      for (const url of everyString(result.structuredContent).filter(text => text.startsWith('https://'))) expect(url).not.toMatch(/1990|1988|08[:%3A]*30|19[:%3A]*45|40\.42|41\.88|Madrid|Chicago/i);
      results.set('compatibility', result);
    }],
    ['P5 what is coming up in the sky is listed with times, and the 2 August 2027 solar eclipse is in that month', async () => {
      const result = answered(await callTool('get_upcoming_events', { from: '2027-07-25', to: '2027-08-20', zone: 'Europe/Madrid' }), 'get_upcoming_events');
      const data = result.structuredContent.data;
      expect(data.zone).toBe('Europe/Madrid');
      const line = (event: any) => `${event.at} ${event.kind} ${event.body ?? ''}`.trim();
      const lines = data.events.map(line);
      expect(lines).toContain('2027-08-02T10:05:00Z lunation');
      expect(lines).toContain('2027-08-09T18:01:00Z station Saturn');
      expect(lines).toContain('2027-07-26T04:46:00Z ingress Jupiter');
      expect(lines).toEqual([...lines].sort());
      expect(data.completeness).toBe('tested-not-proven');
      results.set('events', result);
      const month = answered(await callTool('get_horoscope_period', { sign: 'leo', period: 'month', date: '2027-08-10', zone: 'Europe/Madrid' }), 'get_horoscope_period');
      const eclipse = month.structuredContent.data.sky.find((entry: any) => entry.kind === 'eclipse');
      expect(eclipse).toMatchObject({ planet: 'Sun', sign: 'leo', house: 1 });
      expect(eclipse.utc.slice(0, 16)).toBe('2027-08-02T10:06');
      expect(eclipse.line).toMatch(/^Solar eclipse in Leo on Mon 2 Aug/);
      results.set('month', month);
    }],
  ];

  const NEGATIVE_CASES: [string, () => Promise<void>][] = [
    ['N1 off topic: no tool invites a prompt on the fixed list, and an unrelated tool name gets a plain error', async () => {
      const texts: [string, string][] = [['instructions', initialize.message.result.instructions]];
      for (const tool of tools) texts.push([tool.name, [tool.title, tool.description, ...everyString(tool.inputSchema).filter(text => /\s/.test(text))].join('\n')]);
      const invitations: string[] = [];
      for (const { prompt, terms } of OFF_TOPIC) {
        for (const term of terms) {
          const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          for (const tool of tools) if (pattern.test(tool.name.replace(/_/g, ' '))) invitations.push(`${tool.name} is named for "${term}" (${prompt})`);
          // Where a word from the list appears at all, the sentence must be one that rules the request out.
          for (const [source, text] of texts) for (const sentence of sentencesOf(text)) {
            if (pattern.test(sentence) && !REFUSES.test(sentence)) invitations.push(`${source} invites "${term}" (${prompt}): "${sentence.slice(0, 140)}"`);
          }
        }
      }
      expect(invitations.join('\n')).toBe('');
      for (const name of ['get_weather', 'book_flight', 'run_python']) {
        const reply = await callTool(name, { query: 'Paris' });
        expect(reply.status, name).toBe(200);
        expect(reply.message.result, name).toBeUndefined();
        expect(reply.message.error, name).toMatchObject({ code: -32602 });
        expect(reply.message.error.message, name).not.toMatch(/Paris|stack|TypeError/);
      }
      answered(await callTool('get_capabilities'), 'get_capabilities');
    }],
    ['N2 a malformed date, time or coordinate is refused by name, without a crash and without repeating the input', async () => {
      const cases: [string, Record<string, unknown>, RegExp, string][] = [
        ['get_natal_chart', { birthDate: '1990-13-45' }, /birthDate must be a real date/, '1990-13-45'],
        ['get_natal_chart', { birthDate: 'the third of May' }, /birthDate must be a date such as/, 'third of May'],
        ['get_natal_chart', { ...PERSON_A, latitude: 123.4, longitude: -999 }, /latitude must be at most 90\. longitude must be at least -180\./, '123.4'],
        ['get_natal_chart', { ...PERSON_A, time: '25:99' }, /time/, '25:99'],
        ['get_upcoming_events', { from: '2027-08-20', to: '2027-07-25' }, /to must be later than from/, '2027-08-20'],
        ['get_compatibility', { a: PERSON_A, b: { birthDate: '31/12/1988' } }, /birthDate/, '31/12/1988'],
      ];
      for (const [tool, args, expected, input] of cases) {
        const reply = await callTool(tool, args);
        const error = refused(reply, tool);
        expect(error.code, tool).toMatch(/^invalid-(?:request|arguments)$/);
        expect(error.message, tool).toMatch(expected);
        expect(reply.text, `${tool} does not repeat the input`).not.toContain(input);
        if (tool === 'get_natal_chart' && !results.has('refusal')) results.set('refusal', reply.message.result);
      }
      const broken = await fetch(`${mcpBase}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...edgeHeaders() }, body: '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{' });
      expect(broken.status).toBe(400);
      expect(await broken.json()).toMatchObject({ jsonrpc: '2.0', error: { code: -32700 } });
      answered(await callTool('get_capabilities'), 'get_capabilities');
    }],
    ['N3 writing is not possible: every tool is read-only, and a save, a write field or a write method is refused', async () => {
      for (const tool of tools) {
        expect(tool.annotations, tool.name).toMatchObject({ readOnlyHint: true, destructiveHint: false });
        expect(tool.name, tool.name).not.toMatch(/^(?:save|create|update|delete|remove|set|send|post|write|add|schedule|book|buy|pay|subscribe|upload)_/);
      }
      for (const name of ['save_chart', 'delete_chart', 'send_email', 'create_reminder']) {
        const reply = await callTool(name, { birthDate: PERSON_A.birthDate });
        expect(reply.status, name).toBe(200);
        expect(reply.message.error, name).toMatchObject({ code: -32602 });
      }
      const extra = refused(await callTool('get_natal_chart', { birthDate: PERSON_A.birthDate, save: true }), 'get_natal_chart');
      expect(extra.message).toBe('Leave out fields this tool does not take.');
      for (const method of ['resources/subscribe', 'prompts/get', 'sampling/createMessage']) {
        const reply = await rpc(method, { uri: 'ui://zodiacs/readings-v3.html', name: 'x' });
        expect(reply.message?.error?.code, method).toBe(-32601);
      }
      for (const method of ['PUT', 'DELETE', 'PATCH']) {
        await paced();
        const reply = await fetch(`${mcpBase}/mcp`, { method, headers: { 'Content-Type': 'application/json', ...edgeHeaders() }, body: method === 'DELETE' ? undefined : '{}' });
        expect(reply.status, method).toBe(405);
        expect(reply.headers.get('allow'), method).toBe('POST, OPTIONS');
      }
      // The same question still gets the same answer: nothing was kept between calls.
      const again = answered(await callTool('get_natal_chart', PERSON_A), 'get_natal_chart');
      expect(again.structuredContent).toEqual(resultOf('natal-exact').structuredContent);
    }],
  ];

  describe('positive review cases', () => {
    it('are exactly five', () => { expect(POSITIVE_CASES).toHaveLength(5); });
    for (const [name, run] of POSITIVE_CASES) it(name, run, 120_000);
    it('keep each answer small enough for the conversation', () => {
      // The largest answer on the live server in the 20 November capture was 12,030 bytes.
      for (const [tool, bytes] of Object.entries(sizes)) expect(bytes, `${tool} structuredContent bytes`).toBeLessThanOrEqual(16_384);
    });
  });

  describe('negative review cases', () => {
    it('are exactly three', () => { expect(NEGATIVE_CASES).toHaveLength(3); });
    for (const [name, run] of NEGATIVE_CASES) it(name, run, 180_000);
  });

  // -------------------------------------------------------------------------
  // The panels those five cases open, drawn in Chrome.
  // -------------------------------------------------------------------------
  describe('rendered widgets', () => {
    const VIEWS: { key: string; tool: string; shows: RegExp[]; hides?: RegExp[]; shots: Partial<Record<Mode['name'], string>> }[] = [
      { key: 'natal-exact', tool: 'get_natal_chart', shows: [/Taurus/, /Leo/, /Gemini/, /Rising/i], shots: { dark: '01-birth-chart-exact-time-dark.png' } },
      { key: 'natal-unknown-time', tool: 'get_natal_chart', shows: [/Taurus/, /Leo or Virgo/, /No birth time was given/], hides: [/Ascendant|Midheaven/], shots: { mobile: '02-birth-chart-unknown-time-mobile.png' } },
      { key: 'transits', tool: 'get_personal_transits', shows: [/Sun sextile your Sun/, /Reading confidence 75%/], shots: { light: '03-transits-light.png' } },
      { key: 'compatibility', tool: 'get_compatibility', shows: [/Taurus/, /Scorpio/, /Reading confidence 75%/, /\b79\b/], shots: { dark: '04-compatibility-dark.png' } },
      { key: 'events', tool: 'get_upcoming_events', shows: [/times for Madrid/, /New Moon/i, /Saturn/], hides: [/\d{4}-\d{2}-\d{2}T/], shots: { mobile: '05-sky-calendar-mobile.png' } },
      { key: 'month', tool: 'get_horoscope_period', shows: [/Leo/, /Solar eclipse in Leo on Mon 2 Aug/], shots: {} },
    ];
    const measurements: Record<string, unknown> = {};

    for (const view of VIEWS) {
      for (const mode of MODES) {
        it(`${view.key} in ${mode.name} (${mode.width}px): fits, loads cleanly and shows the answer`, async () => {
          const widget = widgetFor(view.tool);
          const drawn = await render(widget, mode, resultOf(view.key), { screenshot: view.shots[mode.name] });
          expectClean(drawn, widget, mode, `${view.key}/${mode.name}`);
          const seen = [drawn.text, ...drawn.labels].join('\n');
          for (const pattern of view.shows) expect(seen, `${view.key}/${mode.name} shows ${pattern}`).toMatch(pattern);
          for (const pattern of view.hides ?? []) expect(seen, `${view.key}/${mode.name} hides ${pattern}`).not.toMatch(pattern);
          measurements[`${view.key}/${mode.name}`] = { height: drawn.height, scrollWidth: drawn.scrollWidth, clientWidth: drawn.clientWidth, theme: drawn.theme, background: drawn.background, requests: drawn.requests.length, smallestControl: drawn.controls.filter(control => !control.inline).sort((a, b) => Math.min(a.width, a.height) - Math.min(b.width, b.height))[0] ?? null };
        }, 90_000);
      }
    }

    it('follows the host theme in the panels that have a light and a dark card', async () => {
      const widget = widgetFor('get_natal_chart');
      const light = await render(widget, MODES[0], resultOf('natal-exact'));
      const dark = await render(widget, MODES[1], resultOf('natal-exact'));
      expect(light.theme).toBe('light');
      expect(dark.theme).toBe('dark');
      expect(light.background).not.toBe(dark.background);
    }, 90_000);

    it('draws the same answer when ChatGPT hands it over through window.openai', async () => {
      for (const view of VIEWS.filter(item => ['natal-exact', 'compatibility', 'events'].includes(item.key))) {
        const widget = widgetFor(view.tool);
        const drawn = await render(widget, MODES[1], resultOf(view.key), { openai: true });
        expectClean(drawn, widget, MODES[1], `${view.key}/window.openai`);
        for (const pattern of view.shows) expect([drawn.text, ...drawn.labels].join('\n'), `${view.key}/window.openai shows ${pattern}`).toMatch(pattern);
      }
    }, 120_000);

    it('has a plain empty state in every panel, on a phone too', async () => {
      for (const tool of ['get_natal_chart', 'get_compatibility', 'get_upcoming_events']) {
        const widget = widgetFor(tool);
        for (const mode of [MODES[1], MODES[2]]) {
          const drawn = await render(widget, mode, null);
          expectClean(drawn, widget, mode, `${tool}/empty/${mode.name}`);
          expect(drawn.text, `${tool} empty state`).toMatch(/appears here|Ask about a week or month/);
        }
      }
    }, 180_000);

    it('shows a refusal as one plain sentence, with no stale answer and no error in the console', async () => {
      const refusal = resultOf('refusal');
      const message = refusal.structuredContent.error.message;
      for (const tool of ['get_natal_chart', 'get_compatibility', 'get_upcoming_events']) {
        const widget = widgetFor(tool);
        const failed = { ...refusal, structuredContent: { ...refusal.structuredContent, tool } };
        for (const mode of [MODES[0], MODES[2]]) {
          const drawn = await render(widget, mode, failed);
          expectClean(drawn, widget, mode, `${tool}/refusal/${mode.name}`);
          expect(drawn.text, `${tool} refusal`).toContain(message);
          expect(drawn.text, `${tool} refusal shows no answer`).not.toMatch(/Reading confidence|Rising|New Moon/);
        }
      }
    }, 180_000);

    it('keeps the listing policy in everything the panels put on screen', () => {
      expect(renderedText.length).toBeGreaterThanOrEqual(30);
      const findings = renderedText.flatMap(({ source, text }) => policyFindings(source, text));
      expect([...new Set(findings)].join('\n')).toBe('');
      // Every line of the known list is still needed; one that is not goes.
      expect(Object.keys(KNOWN_SMALL_TARGETS).filter(key => !(key in smallTargetsSeen)).join(', '), 'known small targets no longer found under 44px').toBe('');
      report.tapTargets = { minimum: TAP_MIN, knownUnderMinimum: smallTargetsSeen };
      report.widgetMeasurements = measurements;
      report.renderedStates = renderedText.length;
    });
  });
});
