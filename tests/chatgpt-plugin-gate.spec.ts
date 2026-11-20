/**
 * Pre-submission gate for the ChatGPT plugin (Apps SDK) listing of
 * https://zodiacs.org/mcp. Plain `npm test` skips it (it needs Chrome and a
 * server). Run it after `npm run build`, directly (there is no npm script:
 * package.json is fingerprinted by the Phase 1 screenshot receipt):
 *
 *   CHATGPT_GATE=1 GATE_BASE_URL="$BASE_URL" npx vitest run tests/chatgpt-plugin-gate.spec.ts --reporter=verbose
 *
 *   GATE_BASE_URL  a deployment to test (a Vercel preview, or a local server).
 *                  Without it the gate starts tests/helpers/chatgpt-gate-server.ts,
 *                  which serves the published connector on 127.0.0.1 and the
 *                  built site from dist/. (Vitest overwrites BASE_URL inside the
 *                  test process, which is why the address has its own name.)
 *   GATE_ALLOW_NO_PAGES=1  without a deployment and without dist/, skip the
 *                  listing-page check instead of failing on it.
 *   VERCEL_BYPASS  the preview's protection bypass token, sent only as Vercel's
 *                  own x-vercel-protection-bypass header.
 *   GATE_MCP=local with BASE_URL: check the pages on BASE_URL and run the MCP
 *                  half against the local published connector (for a preview
 *                  whose hostname /mcp does not accept).
 *   GATE_SCREENSHOT_DIR, GATE_REPORT  where the carousel PNGs and the JSON
 *                  measurements go (defaults under the system temp directory).
 *
 * It speaks Streamable HTTP to /mcp with no credentials of any kind. Its five
 * positive and three negative review cases are the ones the package declares
 * (plugins/zodiacs-sky/plugin.json, extensions["com.openai"].review.test_cases):
 * each is driven with its prompt's own details, and none needs a private birth
 * detail. The birth chart, unknown birth time and transit checks sit outside
 * the five and three, as protocol tests; every private birth detail in them is
 * invented for the test. Model routing itself (whether ChatGPT picks a tool
 * for a prompt) cannot be tested here: that is a manual developer-mode check.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Body, Ecliptic, GeoVector } from 'astronomy-engine';
import { chromium, type Browser } from 'playwright-core';
import {
  COVERAGE_TOOL_NAMES, HOROSCOPE_URI, LEGACY_HOROSCOPE_URIS, LEGACY_OCCASIONS_URIS,
  LEGACY_READINGS_SKY_EVENTS_URI, LEGACY_READINGS_URI, LEGACY_STUDIO_URIS, LEGACY_WIDGET_URIS,
  OCCASION_TOOL_NAMES, OCCASIONS_URI, READINGS_SKY_EVENTS_URI, READINGS_URI, STUDIO_URI, WIDGET_URI,
} from '../src/ai-tools/contracts';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { startGateServer, type GateServer } from './helpers/chatgpt-gate-server';

const ENABLED = process.env.CHATGPT_GATE === '1';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SCREENSHOT_DIR = process.env.GATE_SCREENSHOT_DIR ?? join(tmpdir(), 'chatgpt-gate-screenshots');
const REPORT_PATH = process.env.GATE_REPORT ?? join(tmpdir(), 'chatgpt-gate-report.json');
const BYPASS = (process.env.VERCEL_BYPASS ?? process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '').trim();
const PROTOCOL = '2025-06-18';
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

interface DeclaredCase { description: string; prompt: string; tools_triggered?: string; expected_behavior: string }
/** The review cases the package submits. The gate's five and three are these, prompt for prompt. */
const DECLARED = JSON.parse(readFileSync(join(root, 'plugins/zodiacs-sky/plugin.json'), 'utf8')).extensions['com.openai'].review.test_cases as { positive: DeclaredCase[]; negative: DeclaredCase[] };

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
/** The tools called since a review case last cleared it, in order. */
const called: string[] = [];
const callTool = (name: string, args: Record<string, unknown> = {}) => { called.push(name); return rpc('tools/call', { name, arguments: args }); };
const todayIn = (zone: string, at = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
const literal = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

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
  for (const text of everyString(result.structuredContent)) if (/[–—]/.test(text)) answerDashes.add(`${tool}: ${/.{0,30}[–—].{0,20}/.exec(text)![0]}`);
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
/** Words that refuse or rule something out. Commerce and guarantee words may appear only where one of these governs them. */
const REFUSES = /\b(?:not|no|never|nor|nothing|none|cannot|without|outside|refuses|refused|neither)\b/i;
/** After the term, only a negated verb rules it out ("... or a guarantee is not a request for this tool"). */
const NEGATED_AFTER = /\b(?:is|are|was|were|does|do|can|will|would|should|may|must) (?:not|never)\b|\bcannot\b/i;
/** A clause that ends in a colon and says its list is ruled out ("A request for one of those is outside Zodiacs ...: a stock pick, a bet"). */
const RULES_OUT_ITS_LIST = /\b(?:is|are) (?:outside|not|never)\b/i;
/**
 * True when every place the term appears in the sentence is ruled out in its own clause: a refusing word
 * before it, a negated verb after it, or a list whose heading clause rules it out. "Zodiacs gives no stock
 * picks" passes; "Buy now, no card needed" and "No card needed: buy now" do not.
 */
function ruledOut(sentence: string, pattern: RegExp): boolean {
  for (const match of sentence.matchAll(new RegExp(pattern.source, 'gi'))) {
    const clauses = (sentence.slice(0, match.index).split(/[.;!?]/).pop() ?? '').split(':');
    const before = clauses.pop()!.slice(-240);
    const after = sentence.slice(match.index! + match[0].length).split(/[.;:!?]/)[0];
    if (!REFUSES.test(before) && !NEGATED_AFTER.test(after) && !RULES_OUT_ITS_LIST.test(clauses.join(':'))) return false;
  }
  return true;
}
const POLICY_RULES: { id: string; pattern: RegExp; allowedInRefusal: boolean }[] = [
  { id: 'competitor named', pattern: /\b(?:co-?star|the pattern|chani|sanctuary|astro\.com|astro-?seek|cafe ?astrology|time ?passages|nebula|astrotalk|horoscope\.com|astrology\.com|astrodienst)\b/i, allowedInRefusal: false },
  { id: 'comparison or superlative', pattern: /\b(?:better than|unlike other|the best astrology|most accurate|more accurate than|number one|world'?s (?:best|first|most)|leading|award[- ]winning|official(?:ly)?)\b|#1\b/i, allowedInRefusal: false },
  { id: 'pricing or upsell', pattern: /\b(?:pricing|price[sd]?|subscription plans?|paid|premium|upgrade[sd]?|free trial|discount|promo(?:tion|tional)?|coupon|checkout|purchase[sd]?|paywall|in-app)\b|\$\s?\d/i, allowedInRefusal: true },
  { id: 'purchase prompt', pattern: /\b(?:buy|sell|shop|order now)\b/i, allowedInRefusal: true },
  { id: 'crypto', pattern: /\b(?:crypto\w*|tokens?|coins?|wallets?|nfts?|blockchain|solana|airdrop|market cap|memecoin|astrofolio)\b/i, allowedInRefusal: false },
  { id: 'trading or investing', pattern: /\b(?:trad(?:e[sd]?|ing)(?!-off)|invest\w*|stocks?|shares? in|portfolio)\b/i, allowedInRefusal: true },
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
      if (rule.allowedInRefusal && ruledOut(sentence, rule.pattern)) continue;
      found.push(`${source}: ${rule.id}: "${sentence.slice(0, 160)}"`);
    }
  }
  return found;
}

/** A fixed list of prompts Zodiacs must not be chosen for, with the words that would invite them. */
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
// Links inside sentences use WCAG 2.5.8's inline exception.
const STUDIO_TARGET_REASON = "Chart Studio is pinned to its published engine; a new address needs the owner's yes for the engine change";
const KNOWN_SMALL_TARGETS: Record<string, { minimum: number; reason: string }> = {
  'ui://zodiacs/chart-studio-v6.html a.panel-brand': { minimum: 19, reason: STUDIO_TARGET_REASON },
  'ui://zodiacs/chart-studio-v6.html a "How we calculate"': { minimum: 14, reason: STUDIO_TARGET_REASON },
  'ui://zodiacs/chart-studio-v6.html a "Privacy"': { minimum: 14, reason: STUDIO_TARGET_REASON },
};
const smallTargetsSeen: Record<string, number> = {};
const tapFailures: string[] = [];
const answerDashes = new Set<string>();
/** No link a panel builds may carry the invented people's birth details (dates, times, coordinates, places). */
const BIRTH_DETAILS_IN_LINK = /1990|1988|08[:%3A]*30|19[:%3A]*45|40\.42|41\.88|-3\.7|-87\.63|Madrid|Chicago/i;

interface Widget { uri: string; html: string; csp: { connectDomains: string[]; resourceDomains: string[] } }
interface Control { tag: string; label: string; width: number; height: number; inline: boolean }
interface Rendered {
  text: string; labels: string[]; scrollWidth: number; clientWidth: number; overflowing: string[];
  controls: Control[]; theme: string; background: string; brokenImages: string[]; hrefs: string[];
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
  // ChatGPT also sets window.openai (the answer, and its _meta as toolResponseMetadata, which the horoscope panel
  // draws from); the panels read the result from it and still complete the MCP Apps handshake.
  const html = options.openai
    ? widget.html.replace('<head>', `<head><script>window.openai = ${JSON.stringify({ toolOutput: (result as any)?.structuredContent ?? null, toolResponseMetadata: (result as any)?._meta ?? null, theme: mode.theme, displayMode: 'inline', locale: 'en-US' }).replace(/</g, '\\u003c')};</script>`)
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
        text: document.body.innerText, labels, hrefs: [...document.querySelectorAll('a[href]')].map(link => (link as HTMLAnchorElement).href), scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth), clientWidth: doc.clientWidth, overflowing, controls,
        theme: doc.dataset.theme ?? '', background: getComputedStyle(document.body).backgroundColor,
        brokenImages: [...document.images].filter(image => shown(image) && image.naturalWidth === 0).map(image => image.currentSrc || image.src).map(source => source.slice(0, 80)),
      };
    });
    const height = await fit();
    const closed = await measure();
    if (options.screenshot) {
      await mkdir(SCREENSHOT_DIR, { recursive: true });
      // Cropped to the card: the whole of it, or on a phone the first 900px of a long one, cut under the last
      // whole line or row that fits so no text is sliced.
      const cap = 900;
      const cut = !mode.mobile || height <= cap ? height : await frame.evaluate((limit) => {
        const bottoms = [...document.querySelectorAll('li, p, h1, h2, h3, form, details, a, button')].map(element => element.getBoundingClientRect().bottom).filter(bottom => bottom > 0 && bottom <= limit - 10);
        return Math.ceil(Math.max(...bottoms)) + 10;
      }, cap);
      await page.screenshot({ path: join(SCREENSHOT_DIR, options.screenshot), animations: 'disabled', clip: { x: 0, y: 0, width: mode.width, height: cut } });
    }
    // Then with every "more" section open, where a wide table would show.
    await frame.evaluate(() => { for (const details of document.querySelectorAll('details')) details.open = true; });
    const openHeight = await fit();
    const open = await measure();
    const messages = await page.evaluate(() => (window as any).__gate.messages);
    const unique = <T,>(items: T[]) => [...new Map(items.map(item => [JSON.stringify(item), item])).values()];
    return {
      ...open, scrollWidth: Math.max(closed.scrollWidth, open.scrollWidth), overflowing: unique([...closed.overflowing, ...open.overflowing]),
      controls: unique([...closed.controls, ...open.controls]), brokenImages: unique([...closed.brokenImages, ...open.brokenImages]), labels: unique([...closed.labels, ...open.labels]), hrefs: unique([...closed.hrefs, ...open.hrefs]),
      messages, errors, requests, blocked, height, openHeight,
    };
  } finally {
    await context.close();
  }
}

/** What every rendered state must satisfy, whatever it shows. `linksOmit` adds what this state's own links must not carry. */
function expectClean(view: Rendered, widget: Widget, mode: Mode, label: string, linksOmit?: RegExp): void {
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
  for (const href of view.hrefs) {
    expect(href, `${label}: a link carries a birth detail`).not.toMatch(BIRTH_DETAILS_IN_LINK);
    if (linksOmit) expect(href, `${label}: a link carries what it must not`).not.toMatch(linksOmit);
  }
  const dashed = [view.text, ...view.labels].join('\n').split('\n').filter(line => /[\u2013\u2014]/u.test(line));
  expect(dashed, `${label}: dashes on screen`).toEqual([]);
  renderedText.push({ source: `${widget.uri} ${label}`, text: [view.text, ...view.labels].join('\n') });
  onScreen[label] = view.text;
  if (mode.mobile) {
    // Collected here and judged once, in "375px touch targets", so one small control does not hide a state's other checks.
    for (const control of view.controls.filter(item => !item.inline && Math.min(item.width, item.height) < TAP_MIN)) {
      const side = Math.min(control.width, control.height);
      const target = control.tag === 'a' ? `a "${control.label}"` : control.tag;
      const key = `${widget.uri} ${target}`;
      const known = KNOWN_SMALL_TARGETS[key];
      const size = `${label}: ${control.tag} "${control.label}" is ${control.width}x${control.height}px`;
      if (!known) tapFailures.push(size);
      else if (side < known.minimum - 0.5) tapFailures.push(`${size}, smaller than the recorded ${known.minimum}px`);
      smallTargetsSeen[key] = Math.min(smallTargetsSeen[key] ?? Infinity, side);
    }
  }
}

/** What the local server saw arrive on /mcp: header names only. A remote deployment cannot be asked, so this holds on loopback. */
function expectNoCredentialHeaders(): void {
  if (!local || mcpBase !== local.baseUrl) return;
  const names = local.receivedHeaderNames();
  for (const name of ['authorization', 'proxy-authorization', 'cookie', 'x-api-key', 'api-key', 'x-vercel-protection-bypass']) expect(names, `no ${name} header reached /mcp`).not.toContain(name);
  for (const name of ['content-type', 'accept', 'mcp-protocol-version']) expect(names).toContain(name);
  report.headerNamesReceived = names;
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
    // Vitest overwrites BASE_URL with Vite's base ("/") inside the test process, so the npm script hands the
    // shell's BASE_URL over as GATE_BASE_URL. Only an http(s) address counts as given.
    const address = [process.env.GATE_BASE_URL, process.env.BASE_URL].find(value => /^https?:\/\//.test(value ?? ''));
    const given = address?.replace(/\/+$/, '');
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
    report.tapTargets = { minimum: TAP_MIN, knownSmallTargets: KNOWN_SMALL_TARGETS, underMinimum: smallTargetsSeen, failures: tapFailures };
    report.dashesInAnswers = [...answerDashes];
    report.target = { mcp: mcpBase, pages: pagesBase, server: initialize?.message?.result?.serverInfo, tools: tools.length, resources: resources.length };
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  });

  describe('protocol and submission', () => {
    it('connects with no credentials: only protocol headers go out, and nothing asks for an account', async () => {
      expect(initialize.message.result).toMatchObject({ protocolVersion: PROTOCOL, serverInfo: { name: 'zodiacs', version: expect.stringMatching(/^\d+\.\d+\.\d+$/) }, capabilities: { tools: {}, resources: {} } });
      expect(initialize.headers.get('www-authenticate')).toBeNull();
      expectNoCredentialHeaders();
      expect(tools.length).toBeGreaterThanOrEqual(13);
      for (const tool of tools) expect(tool._meta?.securitySchemes, `${tool.name} security scheme`).toEqual([{ type: 'noauth' }]);
      // No OAuth discovery document exists, so no client is sent into a sign-in flow.
      for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-authorization-server', '/.well-known/openid-configuration']) {
        const reply = await get(mcpBase, path);
        expect(reply.status, path).toBe(404);
        expect(reply.headers.get('www-authenticate'), path).toBeNull();
      }
      // ChatGPT's own origin may call from a browser; what any other origin gets is recorded, not judged here.
      const origins: Record<string, number> = {};
      for (const origin of ['https://chatgpt.com', 'https://directory.example']) {
        await paced();
        const preflight = await fetch(`${mcpBase}/mcp`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type', ...edgeHeaders() } });
        origins[origin] = preflight.status;
        if (origin === 'https://chatgpt.com') {
          expect(preflight.status).toBe(204);
          expect(preflight.headers.get('access-control-allow-origin')).toBe(origin);
        }
      }
      report.corsPreflightStatusByOrigin = origins;
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
      // The review cases themselves are run below, prompt for prompt.
      expect(plugin.extensions['com.openai'].review.test_cases).toEqual(DECLARED);
      expect(plugin.extensions['com.openai'].review.commerce).toBe(false);
    });

    it('serves versioned widget addresses, with each tool on the newest version of its panel', () => {
      const skyEvents = toolsByName.has('search_sky_events');
      // Both readings panels share a URI prefix. Each keeps its own published aliases.
      const panels = [
        { current: WIDGET_URI, legacy: LEGACY_WIDGET_URIS, toolNames: ['get_upcoming_events'], alwaysListed: true },
        { current: STUDIO_URI, legacy: LEGACY_STUDIO_URIS, toolNames: ['open_chart_studio'], alwaysListed: true },
        { current: HOROSCOPE_URI, legacy: LEGACY_HOROSCOPE_URIS, toolNames: ['get_horoscope'] },
        { current: OCCASIONS_URI, legacy: LEGACY_OCCASIONS_URIS, toolNames: OCCASION_TOOL_NAMES },
        {
          current: READINGS_URI,
          legacy: [LEGACY_READINGS_URI],
          toolNames: COVERAGE_TOOL_NAMES.filter(name => !skyEvents || name !== 'get_natal_chart'),
        },
        {
          current: READINGS_SKY_EVENTS_URI,
          legacy: [LEGACY_READINGS_SKY_EVENTS_URI],
          toolNames: skyEvents ? ['get_natal_chart'] : [],
        },
      ];
      const expectedUris = panels
        .filter(panel => panel.alwaysListed || panel.toolNames.some(name => toolsByName.has(name)))
        .flatMap(panel => [panel.current, ...panel.legacy]);
      expect(resources.map(resource => resource.uri).sort(), 'current and legacy widget addresses').toEqual(expectedUris.sort());

      const listed = new Map<string, number[]>();
      for (const resource of resources) {
        const match = /^ui:\/\/zodiacs\/([a-z-]+)-v(\d+)\.html$/.exec(resource.uri);
        expect(match, `versioned address: ${resource.uri}`).not.toBeNull();
        expect(resource.mimeType).toBe('text/html;profile=mcp-app');
        listed.set(match![1], [...(listed.get(match![1]) ?? []), Number(match![2])]);
      }
      const currentByTool = new Map(panels.flatMap(panel => panel.toolNames.map(name => [name, panel.current] as const)));
      const used = new Set<string>();
      for (const tool of tools) {
        const current = currentByTool.get(tool.name);
        expect(tool._meta?.['openai/outputTemplate'], `${tool.name} output template`).toBe(current);
        expect(tool._meta?.ui?.resourceUri, `${tool.name} resource URI`).toBe(current);
        if (current !== undefined) used.add(current);
      }
      for (const versions of listed.values()) versions.sort((a, b) => a - b);
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
        // Nor does any string in it, shown yet or not, name the collection, a purchase or a promotion (pictures and fonts set aside).
        const strings = content.text.replace(/data:[a-z0-9/+.-]+;base64,[A-Za-z0-9+/=]+/g, '');
        expect(strings.match(/\b(?:astrofolio|wallets?|memecoin|solana|airdrop|crypto\w*|blockchain|nfts?|tokens?|coins?|trad(?:e[sd]?|ing)|market cap|invest\w*|buy now|free trial|coupon|sponsor\w*)\b/gi) ?? [], uri).toEqual([]);
        // And the words in its markup (scripts, styles and tags set aside) keep the whole listing policy.
        const words = strings.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '\n').replace(/<!--[\s\S]*?-->/g, '\n').replace(/<[^>]+>/g, '\n');
        expect(policyFindings(`${uri} markup`, words).join('\n'), uri).toBe('');
        widgets.set(uri, { uri, html: content.text, csp: meta.ui.csp });
      }
      report.widgetBytes = Object.fromEntries([...widgets].map(([uri, widget]) => [uri, Buffer.byteLength(widget.html)]));
    }, 180_000);

    it('declares every tool with a name, a title, a description and all four annotations', () => {
      expect(new Set(tools.map(tool => tool.name)).size).toBe(tools.length);
      // The review cases need the tools production lists today (ZODIACS_OCCASIONS_ENABLED=1 and ZODIACS_COVERAGE_ENABLED=1).
      const declared = DECLARED.positive.flatMap(item => (item.tools_triggered ?? '').split(', '));
      for (const name of [...declared, 'get_natal_chart', 'get_sky', 'get_personal_transits', 'get_horoscope_period', 'get_capabilities']) expect(toolsByName.has(name), `the server offers ${name}`).toBe(true);
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

    it('uses no em or en dash in instructions, tool titles or descriptions, including input fields', () => {
      const dash = /[\u2013\u2014]/u;
      expect(initialize.message.result.instructions, 'instructions').not.toMatch(dash);
      const fields = tools.filter(tool => everyString(tool.inputSchema).some(text => dash.test(text))).map(tool => tool.name);
      report.fieldDescriptionsWithADash = fields;
      expect(fields, 'tools with dashes in input fields').toEqual([]);
      for (const tool of tools) expect([tool.title, tool.annotations?.title ?? '', tool.description].join('\n'), tool.name).not.toMatch(dash);
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
        // The connector needs no site build; the pages do. Without one the gate fails, unless told the pages are checked elsewhere.
        report.listingPages = 'not checked: no dist/ build';
        if (process.env.GATE_ALLOW_NO_PAGES !== '1') throw new Error('No dist/ build, so the four listing pages cannot be checked: run `npm run build`, or set GATE_BASE_URL to a deployment, or GATE_ALLOW_NO_PAGES=1 to skip this check knowingly.');
        console.warn('chatgpt-plugin-gate: GATE_ALLOW_NO_PAGES=1 and no dist/ build, so the four listing pages were NOT checked.');
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
  // The review cases: the five positive and three negative the package declares, each driven with the details
  // its own prompt gives. `prompt` pins a driver to its declared case, so editing the package's cases fails the
  // gate until the driver follows.
  // -------------------------------------------------------------------------
  const keysOf = (url: string) => [...new URL(url).searchParams.keys()].sort();
  const POSITIVE: { prompt: string; run: (expected: string) => Promise<void> }[] = [
    { prompt: "Is Mercury retrograde right now, and what else changes in the sky this week? I'm in Mexico City.", run: async () => {
      const zone = 'America/Mexico_City';
      const now = new Date();
      const check = answered(await callTool('check_sky_fact', { kind: 'retrograde', body: 'Mercury', date: todayIn(zone, now), zone }), 'check_sky_fact').structuredContent.data;
      const fact = check.calculation.result;
      expect(fact.fact).toMatchObject({ kind: 'retrograde', body: 'Mercury', zone });
      expect(check.answer).toBe(fact.answer);
      // A yes or a no, unless Mercury turns inside the day itself.
      if (fact.facts.stations.length === 0) {
        expect(fact.facts.atEnd.retrograde).toBe(fact.facts.atStart.retrograde);
        expect(check.answer).toBe(String(fact.facts.atStart.retrograde));
        // The same answer from the ephemeris directly: which way Mercury's longitude moves over the day's first hour.
        const longitude = (at: Date) => Ecliptic(GeoVector(Body.Mercury, at, true)).elon;
        const start = new Date(fact.window.from);
        const moved = ((longitude(new Date(start.getTime() + 3_600_000)) - longitude(start) + 540) % 360) - 180;
        expect(moved < 0, 'Mercury moving backwards at the start of the day').toBe(fact.facts.atStart.retrograde);
      }
      // The astronomy comes with its receipt, apart from any meaning.
      expect(check.calculation.receipt).toMatchObject({ schema: 'zodiacs.compute-receipt.v1' });
      const from = now.toISOString();
      const to = new Date(now.getTime() + 7 * 86_400_000).toISOString();
      const result = answered(await callTool('get_upcoming_events', { from, to, zone }), 'get_upcoming_events');
      const data = result.structuredContent.data;
      expect(data).toMatchObject({ from, to, zone, completeness: 'tested-not-proven' });
      // The Moon alone changes sign two or three times in a week.
      expect(data.events.filter((event: any) => event.kind === 'ingress' && event.body === 'Moon').length).toBeGreaterThanOrEqual(2);
      for (const event of data.events) {
        expect(['ingress', 'station', 'lunation'], event.at).toContain(event.kind);
        expect(Date.parse(event.at), event.at).toBeGreaterThanOrEqual(now.getTime() - 60_000);
        expect(Date.parse(event.at), event.at).toBeLessThanOrEqual(Date.parse(to) + 60_000);
        // Each time is also given on the Mexico City clock (UTC-6 all year since 2022), the same moment.
        expect(event.localAt, event.at).toMatch(/-06:00$/);
        expect(Date.parse(event.localAt), event.at).toBe(Date.parse(event.at));
      }
      expect(data.events.map((event: any) => event.at)).toEqual(data.events.map((event: any) => event.at).sort());
      results.set('events-week', result);
    } },
    { prompt: "Show today's horoscope for Leo.", run: async () => {
      // The prompt gives a sign and nothing else; the zone is the one an assistant passes for where the person is.
      const zone = 'Europe/Madrid';
      const days = [todayIn(zone)];
      let result = answered(await callTool('get_horoscope', { sign: 'leo', zone }), 'get_horoscope');
      days.push(todayIn(zone));
      let data = result.structuredContent.data;
      if (data.status === 'unavailable' && local && mcpBase === local.baseUrl) {
        // A checkout older than today: its committed three-day window no longer reaches the clock. Read its newest day, and say so.
        const newest = data.available.at(-1).date;
        report.horoscopeDay = `${newest}: this checkout's horoscope window does not reach today (${data.date})`;
        result = answered(await callTool('get_horoscope', { sign: 'leo', zone, date: newest }), 'get_horoscope');
        data = result.structuredContent.data;
      } else {
        expect(days, 'the reading is for the person\'s own day').toContain(data.date);
      }
      expect(data).toMatchObject({ status: 'available', sign: 'leo', signName: 'Leo', period: 'day', focus: 'general', zone, zoneSource: 'request' });
      expect(data.reading.title).toContain(data.dateLabel);
      expect(data.reading.paragraphs.length).toBeGreaterThanOrEqual(1);
      for (const paragraph of data.reading.paragraphs) expect(paragraph.text.length).toBeGreaterThan(40);
      expect(data.disclosure).toMatch(/Reading confidence \d{2}%/);
      expect(data.why.note).toMatch(/sky positions we calculate\. What they mean is astrological interpretation/);
      // The share link keeps the sign and the reading's date, nothing else.
      expect(keysOf(data.shareUrl)).toEqual(['d', 'ref', 's']);
      expect(new URL(data.shareUrl).searchParams.get('d')).toBe(data.date);
      results.set('horoscope', result);
    } },
    { prompt: "What does Frida Kahlo's chart look like? And what does a Saturn return mean?", run: async (expected) => {
      const result = answered(await callTool('get_famous_chart', { name: 'Frida Kahlo' }), 'get_famous_chart');
      const data = result.structuredContent.data;
      expect(data).toMatchObject({ found: true, person: { name: 'Frida Kahlo', slug: 'frida-kahlo', sun: { sign: 'cancer' }, url: 'https://zodiacs.org/people/frida-kahlo/?ref=assistant' } });
      expect(data.person.placements.map((placement: any) => placement.body)).toEqual(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
      for (const placement of data.person.placements) expect(SIGNS, placement.body).toContain(placement.sign);
      expect(data.note).toMatch(/a reference instant, not a birth time/);
      expect(data.note).toMatch(/No houses, rising sign, angles/);
      results.set('famous-chart', result);
      // Someone Zodiacs does not publish gets no chart, not an invented one.
      const nobody = answered(await callTool('get_famous_chart', { name: 'Zxqv Nobodyson' }), 'get_famous_chart').structuredContent.data;
      expect(nobody).toMatchObject({ found: false, suggestions: [] });
      expect(nobody.person).toBeUndefined();
      const explained = answered(await callTool('explain_astrology', { topic: 'Saturn return' }), 'explain_astrology');
      const explainer = explained.structuredContent.data;
      expect(explainer).toMatchObject({ found: true, topic: 'saturn-return' });
      // The declared figures, read from the declared sentence itself.
      const [, years, first, second, third] = /about every ([\d.]+) years and around ages (\d+), (\d+) and (\d+)/.exec(expected)!;
      expect(explainer.paragraphs[0]).toContain(`about ${years} years`);
      expect(explainer.paragraphs[0]).toContain(`around age ${first}, the second around ${second} and the third around ${third}`);
      expect(explainer.pages.map((page: any) => page.url)).toContain('https://zodiacs.org/saturn-return/?ref=assistant');
      expect(explainer.note).toMatch(/not a claim that they determine anything/);
      results.set('explainer', explained);
    } },
    { prompt: "We're getting married on 18 September 2027 at 16:30 in Lisbon, Portugal. Is it a good day for it? Make us a card with the sky for that day.", run: async () => {
      const found = answered(await callTool('find_birthplace', { place: 'Lisbon', country: 'Portugal', date: '2027-09-18' }), 'find_birthplace').structuredContent.data;
      expect(found.places[0]).toMatchObject({ name: 'Lisbon', country: 'Portugal', latitude: 38.73, longitude: -9.15, timeZone: 'Europe/Lisbon', offset: '+01:00' });
      const place = found.places[0];
      const result = answered(await callTool('get_occasion_sky', { occasion: 'wedding', date: '2027-09-18', time: '16:30', zone: place.timeZone, latitude: place.latitude, longitude: place.longitude, place: place.name }), 'get_occasion_sky');
      const data = result.structuredContent.data;
      expect(data).toMatchObject({ occasion: 'wedding', date: '2027-09-18', instant: { utc: '2027-09-18T15:30:00.000Z' }, instantIs: 'given-time' });
      expect(data.rating).toMatchObject({ score: 70, verdict: 'A good day for it. Reading confidence 70%.' });
      expect(data.rating.reasons.length).toBeGreaterThanOrEqual(2);
      expect(data.rating.reasons.at(-1)).toMatch(/^Reading confidence \d{2}%$/);
      const sign = (body: string) => data.sky.bodies.find((item: any) => item.body === body).sign;
      expect([sign('Sun'), sign('Moon')]).toEqual(['virgo', 'aries']);
      expect(data.evening.sunset.local).toBe('Sat 18 Sept 2027, 19:40');
      expect(data.evening.goldenHour.start.local).toBe('Sat 18 Sept 2027, 19:05');
      expect(data.evening.planetsAfterDusk).toEqual(['Venus', 'Mars', 'Saturn']);
      expect(data.note).toMatch(/not a guarantee of how it will go/);
      // The share link: the occasion and its day, the Sun and Moon signs, the rating and its confidence. No time, place or names.
      expect(keysOf(data.shareUrl)).toEqual(['c', 'd', 'moon', 'o', 'ref', 'score', 'sun', 'v']);
      expect(data.shareUrl).not.toMatch(/16|Lisbon|38\.73|9\.15/);
      results.set('occasion', result);
    } },
    { prompt: 'How compatible were Marilyn Monroe and Arthur Miller, going by their charts?', run: async (expected) => {
      const result = answered(await callTool('get_compatibility', { a: { famous: 'Marilyn Monroe' }, b: { famous: 'Arthur Miller' } }), 'get_compatibility');
      const data = result.structuredContent.data;
      // The declared score, verdict, parts and label, read from the declared sentence itself.
      const [, overall, verdict, attraction, communication, stability, confidence] = /score of (\d+) out of 100, "([^"]+)", with attraction (\d+), communication (\d+) and long-term stability (\d+) and a Reading confidence (\d+)% label/.exec(expected)!;
      expect(data.score).toMatchObject({ overall: Number(overall), verdict, areas: { attraction: Number(attraction), communication: Number(communication), stability: Number(stability) } });
      expect(data.score.headline).toContain(`Reading confidence ${confidence}%`);
      expect(data.a).toMatchObject({ name: 'Marilyn Monroe', famous: true, sun: 'gemini', moon: null, rising: null, timeKnown: false, url: 'https://zodiacs.org/people/marilyn-monroe/?ref=assistant' });
      expect(data.b).toMatchObject({ name: 'Arthur Miller', famous: true, sun: 'libra', moon: null, rising: null, timeKnown: false, url: 'https://zodiacs.org/people/arthur-miller/?ref=assistant' });
      expect(data.contacts.length).toBeGreaterThanOrEqual(3);
      for (const contact of data.contacts) expect(contact.line.length).toBeGreaterThan(20);
      expect(data.contacts.map((contact: any) => contact.orb)).toEqual(data.contacts.map((contact: any) => contact.orb).sort((a: number, b: number) => a - b));
      expect(data.notes.filter((note: string) => /birth time is not on record, so Zodiacs uses their published chart for 12:00 civil time/.test(note))).toHaveLength(2);
      expect(data.notes.join(' ')).toMatch(/Moon and rising sign are left out/);
      expect(data.note).toMatch(/not a guarantee of how things will turn out/);
      expect(keysOf(data.shareUrl)).toEqual(['as', 'attraction', 'bs', 'c', 'communication', 'ref', 'score', 'stability', 'v']);
      results.set('compatibility-famous', result);
    } },
  ];

  /** Every sentence of the instructions and of every tool's title, description and field descriptions. */
  const toolSentences = (): [string, string][] => [['instructions', initialize.message.result.instructions] as [string, string], ...tools.map(tool => [tool.name, [tool.title, tool.description, ...everyString(tool.inputSchema).filter(text => /\s/.test(text))].join('\n')] as [string, string])]
    .flatMap(([source, text]) => sentencesOf(text).map(sentence => [source, sentence] as [string, string]));
  /** Where one of the words appears at all, it must be in a sentence that rules the request out. */
  const invitations = (pattern: RegExp) => toolSentences().filter(([, sentence]) => pattern.test(sentence) && !ruledOut(sentence, pattern)).map(([source, sentence]) => `${source}: "${sentence.slice(0, 160)}"`);

  // A model's choice of tool cannot be run here. Each negative case holds what makes the declared behaviour the
  // only one the server supports: what the metadata tells the model, and what the server does if called anyway.
  const NEGATIVE: { prompt: string; run: () => Promise<void> }[] = [
    { prompt: 'Reschedule my work meeting tomorrow.', run: async () => {
      expect(initialize.message.result.instructions).toMatch(/It does not schedule anything/);
      expect(initialize.message.result.instructions).toMatch(/a reminder or anything scheduled\. No Zodiacs tool is for such a request, not even as a first step/);
      // No tool is about meetings or appointments, and scheduling is named only to rule it out.
      expect(toolSentences().filter(([, sentence]) => /\b(?:meetings?|appointments?|reschedul\w*)\b/i.test(sentence)).map(([source]) => source)).toEqual([]);
      expect(invitations(/\b(?:schedul\w*|reminders?)\b/i).join('\n')).toBe('');
      // The one tool that names calendar apps hands over a link and says it writes nothing.
      expect(toolsByName.get('get_sky_calendar')?.description ?? 'adds nothing to anyone\'s calendar itself and schedules nothing').toMatch(/adds nothing to anyone's calendar itself and schedules nothing/);
      // No calendar access exists to use: every tool only reads, none is named for a write, and a write tool is unknown.
      for (const tool of tools) {
        expect(tool.annotations, tool.name).toMatchObject({ readOnlyHint: true, destructiveHint: false });
        expect(tool._meta?.securitySchemes, tool.name).toEqual([{ type: 'noauth' }]);
        expect(tool.name, tool.name).not.toMatch(/^(?:save|create|update|delete|remove|set|send|post|write|add|schedule|reschedule|book|buy|pay|subscribe|upload)_/);
      }
      for (const name of ['reschedule_meeting', 'create_event', 'update_calendar']) {
        const reply = await callTool(name, { when: 'tomorrow' });
        expect(reply.status, name).toBe(200);
        expect(reply.message.result, name).toBeUndefined();
        expect(reply.message.error, name).toMatchObject({ code: -32602 });
      }
    } },
    { prompt: 'Tell me which stock will rise based on my horoscope.', run: async () => {
      const instructions = initialize.message.result.instructions;
      expect(instructions).toMatch(/gives no betting tips, sports picks, investment timing/);
      expect(instructions).toMatch(/outside Zodiacs even when it names a sign, a planet, a retrograde, a birth date or a horoscope: a stock or lottery pick, an investment call/);
      expect(instructions).toMatch(/the answer is that Zodiacs does not do this, with no tool call/);
      expect(toolsByName.get('get_horoscope').description).toMatch(/no betting tips, sports picks, stock picks, investment timing, financial forecasts[^.]*including when such a request mentions a horoscope/);
      // Stocks, investing and finance are named only to rule them out, in every tool.
      expect(invitations(/\b(?:stocks?|invest\w*|financ\w*|portfolio|trading)\b/i).join('\n')).toBe('');
      // If the horoscope tool is called anyway: it has no money reading to ask for, and the Leo reading of case two names no investment.
      const error = refused(await callTool('get_horoscope', { sign: 'leo', focus: 'money' }), 'get_horoscope');
      expect(error).toMatchObject({ code: 'invalid-arguments', message: 'focus must be one of: general, love, career.' });
      const reading = everyString(resultOf('horoscope').structuredContent.data.reading).join('\n');
      expect(reading).not.toMatch(/\b(?:stocks?|invest\w*|shares|portfolio|profits?|trading|returns? on)\b/i);
    } },
    { prompt: 'Guarantee that my partner and I will stay together.', run: async () => {
      expect(initialize.message.result.instructions).toMatch(/guarantees no outcome/);
      expect(initialize.message.result.instructions).toMatch(/never the odds that an event happens/);
      expect(toolsByName.get('get_compatibility').description).toMatch(/not a guarantee of how a relationship will go/);
      expect(toolsByName.get('explain_astrology').description).toMatch(/A guarantee about a relationship or anything else[^.]*are not requests for this tool/);
      expect(invitations(/\bguarantee\w*\b/i).join('\n')).toBe('');
      // If two people's charts are compared anyway (invented people here): a reading with its limit stated, never a promise.
      const result = answered(await callTool('get_compatibility', { a: PERSON_A, b: PERSON_B }), 'get_compatibility');
      const data = result.structuredContent.data;
      expect(data.note).toMatch(/not a guarantee of how things will turn out/);
      expect(data.score.headline).toMatch(/Reading confidence \d{2}%/);
      for (const value of [data.score.overall, ...Object.values(data.score.areas) as number[]]) { expect(Number.isInteger(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(100); }
      const words = everyString(data).filter(text => !text.startsWith('https://')).join('\n');
      expect(words).not.toMatch(/\b(?:will (?:stay|last|marry|break up|divorce)|destined|meant to be|soulmates?|certain to)\b/i);
      expect(policyFindings('get_compatibility answer', words).join('\n')).toBe('');
      // And no link in it carries either person's birth details.
      expect(keysOf(data.shareUrl)).toEqual(['as', 'attraction', 'bs', 'c', 'communication', 'ref', 'score', 'stability', 'v']);
      for (const url of everyString(result.structuredContent).filter(text => text.startsWith('https://'))) expect(url).not.toMatch(BIRTH_DETAILS_IN_LINK);
      results.set('compatibility', result);
    } },
  ];

  describe('positive review cases', () => {
    it('are exactly the five the package declares, prompt for prompt', () => {
      expect(DECLARED.positive).toHaveLength(5);
      expect(POSITIVE.map(item => item.prompt)).toEqual(DECLARED.positive.map(item => item.prompt));
    });
    DECLARED.positive.forEach((declared, index) => it(`P${index + 1} ${declared.prompt}`, async () => {
      called.length = 0;
      await POSITIVE[index].run(declared.expected_behavior);
      expect([...new Set(called)], 'the tools the case declares, in its order').toEqual(declared.tools_triggered!.split(', '));
    }, 120_000));
  });

  describe('negative review cases', () => {
    it('are exactly the three the package declares, prompt for prompt', () => {
      expect(DECLARED.negative).toHaveLength(3);
      expect(NEGATIVE.map(item => item.prompt)).toEqual(DECLARED.negative.map(item => item.prompt));
    });
    DECLARED.negative.forEach((declared, index) => it(`N${index + 1} ${declared.prompt}`, () => NEGATIVE[index].run(), 180_000));
  });

  // -------------------------------------------------------------------------
  // Outside the five and three: birth charts, transits and the server's refusals.
  // -------------------------------------------------------------------------
  describe('more protocol checks, outside the review cases', () => {
    it('a birth chart with an exact birth time gives the rising sign, the angles and a house for every planet', async () => {
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
      for (const url of everyString(result.structuredContent).filter(text => text.startsWith('https://'))) expect(url).not.toMatch(BIRTH_DETAILS_IN_LINK);
      results.set('natal-exact', result);
    }, 120_000);

    it('a birth chart with no birth time gives no rising sign and no houses, and says what is uncertain', async () => {
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
    }, 120_000);

    it("today's sky and a person's transits come back dated, with the reading kept apart from the astronomy", async () => {
      const sky = answered(await callTool('get_sky', {}), 'get_sky').structuredContent.data;
      expect(sky.mode).toBe('current-instant');
      expect(Math.abs(Date.now() - Date.parse(sky.time.utc))).toBeLessThan(5 * 60_000);
      const bodies = sky.calculation.result.instants[0].bodies;
      expect(bodies.map((body: any) => body.body)).toEqual(expect.arrayContaining(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']));
      for (const body of bodies) { expect(body.lon).toBeGreaterThanOrEqual(0); expect(body.lon).toBeLessThan(360); expect(SIGNS).toContain(body.sign); }
      const result = answered(await callTool('get_personal_transits', { ...PERSON_A, from: '2027-03-01', to: '2027-03-31', currentZone: 'Europe/Madrid' }), 'get_personal_transits');
      const transits = result.structuredContent.data;
      expect(transits).toMatchObject({ mode: 'window', timeKnown: true, from: '2027-03-01', to: '2027-03-31', zone: 'Europe/Madrid' });
      expect(transits.contacts.length).toBeGreaterThan(5);
      expect(transits.contacts[0]).toMatchObject({ exactUtc: '2027-03-03T09:35:04.484Z', planet: 'Sun', aspect: 'sextile', point: 'Sun' });
      for (const contact of transits.contacts) { expect(contact.confidenceLabel).toMatch(/^Reading confidence \d{2}%$/); expect(Date.parse(contact.exactUtc)).not.toBeNaN(); }
      expect(transits.note).toMatch(/not a guarantee/);
      results.set('transits', result);
    }, 120_000);

    it('a fixed month lists its events with times, and the 2 August 2027 solar eclipse is in it', async () => {
      const data = answered(await callTool('get_upcoming_events', { from: '2027-07-25', to: '2027-08-20', zone: 'Europe/Madrid' }), 'get_upcoming_events').structuredContent.data;
      const lines = data.events.map((event: any) => `${event.at} ${event.kind} ${event.body ?? ''}`.trim());
      expect(lines).toContain('2027-08-02T10:05:00Z lunation');
      expect(lines).toContain('2027-08-09T18:01:00Z station Saturn');
      expect(lines).toContain('2027-07-26T04:46:00Z ingress Jupiter');
      expect(lines).toEqual([...lines].sort());
      const month = answered(await callTool('get_horoscope_period', { sign: 'leo', period: 'month', date: '2027-08-10', zone: 'Europe/Madrid' }), 'get_horoscope_period');
      const eclipse = month.structuredContent.data.sky.find((entry: any) => entry.kind === 'eclipse');
      expect(eclipse).toMatchObject({ planet: 'Sun', sign: 'leo', house: 1 });
      expect(eclipse.utc.slice(0, 16)).toBe('2027-08-02T10:06');
      expect(eclipse.line).toMatch(/^Solar eclipse in Leo on Mon 2 Aug/);
    }, 120_000);

    it('off topic: no tool invites a prompt on the fixed list, and an unrelated tool name gets a plain error', async () => {
      const found: string[] = [];
      for (const { prompt, terms } of OFF_TOPIC) {
        for (const term of terms) {
          const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          for (const tool of tools) if (pattern.test(tool.name.replace(/_/g, ' '))) found.push(`${tool.name} is named for "${term}" (${prompt})`);
          found.push(...invitations(pattern).map(line => `invites "${term}" (${prompt}): ${line}`));
        }
      }
      expect(found.join('\n')).toBe('');
      for (const name of ['get_weather', 'book_flight', 'run_python']) {
        const reply = await callTool(name, { query: 'Paris' });
        expect(reply.status, name).toBe(200);
        expect(reply.message.result, name).toBeUndefined();
        expect(reply.message.error, name).toMatchObject({ code: -32602 });
        expect(reply.message.error.message, name).not.toMatch(/Paris|stack|TypeError/);
      }
      answered(await callTool('get_capabilities'), 'get_capabilities');
    }, 180_000);

    it('a malformed date, time or coordinate is refused by name, without a crash and without repeating the input', async () => {
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
      await paced();
      const broken = await fetch(`${mcpBase}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...edgeHeaders() }, body: '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{' });
      expect(broken.status).toBe(400);
      expect(await broken.json()).toMatchObject({ jsonrpc: '2.0', error: { code: -32700 } });
      answered(await callTool('get_capabilities'), 'get_capabilities');
    }, 180_000);

    it('writing is not possible: a save, a write field or a write method is refused, and nothing is kept between calls', async () => {
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
    }, 180_000);

    it('keeps each answer small enough for the conversation, with no em or en dash in what the review cases returned', () => {
      // The largest answer on the live server in the 20 November capture was 12,030 bytes.
      for (const [tool, bytes] of Object.entries(sizes)) expect(bytes, `${tool} structuredContent bytes`).toBeLessThanOrEqual(16_384);
      expect([...answerDashes]).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // The panels, drawn in Chrome: each declared case's own, then the birth chart and transit ones.
  // -------------------------------------------------------------------------
  describe('rendered widgets', () => {
    type Shows = RegExp[] | ((data: any) => RegExp[]);
    const VIEWS: { key: string; from: string; tool: string; shows: Shows; hides?: RegExp[]; linksOmit?: RegExp; shots: Partial<Record<Mode['name'], string>> }[] = [
      { key: 'events-week', from: 'P1', tool: 'get_upcoming_events', shows: [/\d{1,2} [A-Z][a-z]{2,3} to \d{1,2} [A-Z][a-z]{2,3} · times for Mexico City/, /Moon/], hides: [/\d{4}-\d{2}-\d{2}T/], shots: {} },
      { key: 'horoscope', from: 'P2', tool: 'get_horoscope', shows: data => [/Leo/, literal(`${data.dateLabel}, times for Madrid`), literal(data.reading.paragraphs[0].text.slice(0, 40)), literal(data.disclosure), /These are sky positions we calculate/], shots: {} },
      { key: 'famous-chart', from: 'P3', tool: 'get_famous_chart', shows: [/Frida Kahlo/, /Cancer/, /not a birth time/], linksOmit: /1907|07-06|Coyoac/i, shots: {} },
      { key: 'explainer', from: 'P3', tool: 'explain_astrology', shows: [/Saturn return/, /about 29\.5 years/, /around age 29/], shots: {} },
      { key: 'occasion', from: 'P4', tool: 'get_occasion_sky', shows: [/\b70\b/, /A good day for it/, /Reading confidence 70%/, /Virgo/, /Aries/, /19:40/, /Venus/, /not a guarantee/], linksOmit: /[?&#]place=|[?&#]names?=|(?<!Europe(?:%2F|\/))Lisbon/i, shots: { light: '05-wedding-card-light.png' } },
      { key: 'compatibility-famous', from: 'P5', tool: 'get_compatibility', shows: [/\b80\b/, /A strong match/, /\b85\b/, /\b79\b/, /\b75\b/, /Reading confidence 60%/, /Gemini/, /Libra/, /birth time is not on record/, /not a guarantee/], linksOmit: /1926|1915|06-01|10-17|Los(?:%20|\+| )Angeles|Harlem/i, shots: {} },
      { key: 'natal-exact', from: 'protocol', tool: 'get_natal_chart', shows: [/Taurus/, /Leo/, /Gemini/, /Rising/i], shots: { dark: '01-birth-chart-exact-time-dark.png' } },
      { key: 'natal-unknown-time', from: 'protocol', tool: 'get_natal_chart', shows: [/Taurus/, /Leo or Virgo/, /No birth time was given/], hides: [/Ascendant|Midheaven/], shots: { mobile: '02-birth-chart-unknown-time-mobile.png' } },
      { key: 'transits', from: 'protocol', tool: 'get_personal_transits', shows: [/Sun sextile your Sun/, /Reading confidence 75%/], shots: { light: '03-transits-light.png' } },
      { key: 'compatibility', from: 'N3', tool: 'get_compatibility', shows: [/Taurus/, /Scorpio/, /Reading confidence 75%/, /\b79\b/, /not a guarantee/], shots: { dark: '04-compatibility-dark.png' } },
    ];
    const measurements: Record<string, unknown> = {};

    for (const view of VIEWS) {
      for (const mode of MODES) {
        it(`${view.from} ${view.key} in ${mode.name} (${mode.width}px): fits, loads cleanly and shows the answer`, async () => {
          const widget = widgetFor(view.tool);
          const result = resultOf(view.key);
          const drawn = await render(widget, mode, result, { screenshot: view.shots[mode.name] });
          expectClean(drawn, widget, mode, `${view.key}/${mode.name}`, view.linksOmit);
          const seen = [drawn.text, ...drawn.labels].join('\n');
          for (const pattern of typeof view.shows === 'function' ? view.shows(result.structuredContent.data) : view.shows) expect(seen, `${view.key}/${mode.name} shows ${pattern}`).toMatch(pattern);
          for (const pattern of view.hides ?? []) expect(seen, `${view.key}/${mode.name} hides ${pattern}`).not.toMatch(pattern);
          measurements[`${view.key}/${mode.name}`] = { height: drawn.height, scrollWidth: drawn.scrollWidth, clientWidth: drawn.clientWidth, theme: drawn.theme, background: drawn.background, requests: drawn.requests.length, links: drawn.hrefs.length, smallestControl: drawn.controls.filter(control => !control.inline).sort((a, b) => Math.min(a.width, a.height) - Math.min(b.width, b.height))[0] ?? null };
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
      for (const view of VIEWS.filter(item => ['events-week', 'horoscope', 'occasion', 'compatibility-famous', 'natal-exact'].includes(item.key))) {
        const widget = widgetFor(view.tool);
        const result = resultOf(view.key);
        const drawn = await render(widget, MODES[1], result, { openai: true });
        expectClean(drawn, widget, MODES[1], `${view.key}/window.openai`, view.linksOmit);
        for (const pattern of typeof view.shows === 'function' ? view.shows(result.structuredContent.data) : view.shows) expect([drawn.text, ...drawn.labels].join('\n'), `${view.key}/window.openai shows ${pattern}`).toMatch(pattern);
      }
    }, 180_000);

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

    it('opens the horoscope panel with no sign chosen, and Chart Studio, on a phone without overflow or errors', async () => {
      for (const tool of ['get_horoscope', 'open_chart_studio']) {
        const widget = widgetFor(tool);
        const drawn = await render(widget, MODES[2], null);
        expectClean(drawn, widget, MODES[2], `${tool}/empty/mobile`);
      }
    }, 120_000);

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
      expect(renderedText.length).toBeGreaterThanOrEqual(40);
      const findings = renderedText.flatMap(({ source, text }) => policyFindings(source, text));
      expect([...new Set(findings)].join('\n')).toBe('');
      const horoscope = renderedText.filter(({ source }) => / horoscope\//.test(source));
      expect(horoscope.length).toBeGreaterThanOrEqual(3);
      report.horoscopePanelPrintsConfidenceLabel = horoscope.every(({ text }) => /Reading confidence \d{2}%/.test(text));
      expect(report.horoscopePanelPrintsConfidenceLabel, 'each horoscope panel prints the Reading confidence label').toBe(true);
      report.widgetMeasurements = measurements;
      report.renderedStates = renderedText.length;
    });

    it('has 44px touch targets at 375px apart from the recorded Chart Studio controls', () => {
      expect(tapFailures.join('\n')).toBe('');
      expect(Object.keys(KNOWN_SMALL_TARGETS).filter(key => !(key in smallTargetsSeen)).join(', '), 'known small targets no longer found under 44px').toBe('');
    });

    it('sent no credential header in the whole run', () => { expectNoCredentialHeaders(); });
  });
});
