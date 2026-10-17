/**
 * Full-length captures of every assistant card: the occasions panel's seven
 * cards and the horoscope panel, filled with real tool results on a fixed
 * clock, at a desktop host width (760px) and a phone (390px), in the light
 * and the dark host theme. Real Chromium, synthetic host bridge, no network.
 * Manual, not part of CI: it is how before-and-after reviews are made.
 *
 *   npx vite-node --script tests/ai-cards-capture.ts -- --out <dir>
 *     [--occasions <module>] [--horoscopes <module>]
 *
 * --occasions and --horoscopes name a generated panel module (default: this
 * build's integrations/generated/ files), so an earlier build can be captured
 * with the same results. Writes <card>-<width>-<theme>.png and captures.json.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { executeAiTool, type AiCallContext } from '../src/ai-tools/tools';
import type { AiToolName } from '../src/ai-tools/contracts';
import type { HoroscopeWindow } from '../src/ai-tools/horoscope/window';

const argv = process.argv.slice(2);
const option = (name: string) => { const index = argv.indexOf(`--${name}`); return index >= 0 ? argv[index + 1] : undefined; };
const out = option('out');
if (!out) throw new Error('Give --out <dir> for the captures.');
// A generated module is one exported JSON string, read as text so a copy outside the repo loads too.
const load = async (path: string | undefined, fallback: string, name: string) => {
  const source = await readFile(path ? resolve(path) : new URL(fallback, import.meta.url), 'utf8');
  const match = source.match(new RegExp(`export const ${name} = ("(?:[^"\\\\]|\\\\.)*");`, 'u'));
  assert.ok(match, `${name} in ${path ?? fallback}`);
  return JSON.parse(match[1]) as string;
};
const OCCASIONS = await load(option('occasions'), '../integrations/generated/occasions.mjs', 'OCCASIONS_HTML');
const HOROSCOPES = await load(option('horoscopes'), '../integrations/generated/horoscopes.mjs', 'HOROSCOPES_HTML');

const NOW = new Date('2026-10-17T12:00:00Z');
async function result(tool: AiToolName, args: Record<string, unknown>) {
  const answer = await executeAiTool(tool, args, { occasions: true, now: () => NOW });
  assert.equal(answer.ok, true, `${tool} answered`);
  return { structuredContent: answer, _meta: undefined as unknown };
}
const window = JSON.parse(await readFile(new URL('../src/data/horoscope-window.json', import.meta.url), 'utf8')) as HoroscopeWindow;
async function horoscope(args: Record<string, unknown>) {
  const context: AiCallContext = {};
  const answer = await executeAiTool('get_horoscope', args, { now: () => new Date(`${window.generatedFor}T05:00:00Z`), horoscopeWindow: async () => window }, context);
  assert.equal(answer.ok, true);
  return { structuredContent: answer, _meta: context.horoscopePanel ? { 'zodiacs/horoscope': context.horoscopePanel } : undefined };
}

// The same people and days the listing screenshots and the drives use.
const ana = { name: 'Ana', birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038 };
const CARDS: { card: string; html: string; result: () => Promise<{ structuredContent: unknown; _meta: unknown }> }[] = [
  { card: 'chart-comparison', html: OCCASIONS, result: () => result('get_compatibility', { a: ana, b: { name: 'Luis', birthDate: '1992-08-10', time: '21:15', zone: 'America/Mexico_City', latitude: 19.4326, longitude: -99.1332 } }) },
  { card: 'wedding', html: OCCASIONS, result: () => result('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12', time: '17:00', zone: 'Europe/Rome', latitude: 43.7696, longitude: 11.2558, place: 'Florence, Italy', names: 'Ana & Luis' }) },
  { card: 'birthday', html: OCCASIONS, result: () => result('get_birthday', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid' }) },
  { card: 'chart-twins', html: OCCASIONS, result: () => result('find_chart_twins', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid' }) },
  { card: 'famous-chart', html: OCCASIONS, result: () => result('get_famous_chart', { name: 'Frida Kahlo' }) },
  { card: 'milestones', html: OCCASIONS, result: () => result('get_life_milestones', { birthDate: '1997-03-15' }) },
  { card: 'sky-calendar', html: OCCASIONS, result: () => result('get_sky_calendar', {}) },
  { card: 'horoscope', html: HOROSCOPES, result: () => horoscope({ sign: 'leo', zone: 'Asia/Bangkok' }) },
  // Two more shapes of the first two cards.
  { card: 'chart-comparison-famous', html: OCCASIONS, result: () => result('get_compatibility', { a: { name: 'Sam', birthDate: '1994-02-01' }, b: { famous: 'Frida Kahlo' } }) },
  { card: 'wedding-best-days', html: OCCASIONS, result: () => result('get_occasion_sky', { occasion: 'wedding', searchFrom: '2027-06-01', searchTo: '2027-06-30', zone: 'Europe/Rome', latitude: 43.7696, longitude: 11.2558, place: 'Florence, Italy' }) },
];
const WIDTHS = [{ name: 'desktop', width: 760 }, { name: 'phone', width: 390 }];
const THEMES = ['light', 'dark'] as const;

async function deliver(page: Page, value: { structuredContent: unknown; _meta: unknown }, theme: string) {
  await page.evaluate(([content, theme]) => {
    (window as any).openai = { toolOutput: content.structuredContent, toolResponseMetadata: content._meta, theme };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: content.structuredContent, toolResponseMetadata: content._meta, theme } } }));
  }, [value, theme] as const);
}

await mkdir(resolve(out), { recursive: true });
const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS, headless: true });
const captures: { file: string; card: string; width: number; theme: string; height: number; overflow: boolean }[] = [];
try {
  for (const { card, html, result: make } of CARDS) {
    const value = await make();
    for (const { name, width } of WIDTHS) {
      for (const theme of THEMES) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, colorScheme: theme, timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
        await context.clock.setFixedTime(new Date(`${window.generatedFor}T05:00:00Z`));
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        let network = 0;
        page.on('request', (request) => { if (!request.url().startsWith('data:')) network++; });
        await page.setContent(html);
        await deliver(page, value, theme);
        await page.locator('h1').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(150);
        // Size the page to its content, as an MCP Apps host does from the panel's size reports.
        const height = await page.evaluate(() => {
          const root = document.documentElement, previous = root.style.height;
          root.style.height = 'max-content';
          const value = Math.ceil(root.getBoundingClientRect().height);
          root.style.height = previous;
          return value;
        });
        await page.setViewportSize({ width, height });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        const file = `${card}-${name}-${theme}.png`;
        await page.screenshot({ path: resolve(out, file), fullPage: true });
        assert.deepEqual(errors, [], `${file}: no page errors`);
        assert.equal(network, 0, `${file}: no network requests`);
        captures.push({ file, card, width, theme, height, overflow });
        await context.close();
      }
    }
  }
} finally { await browser.close(); }
await writeFile(resolve(out, 'captures.json'), JSON.stringify({ clock: `${window.generatedFor}T05:00:00Z`, timezone: 'Asia/Bangkok', deviceScaleFactor: 2, captures }, null, 2) + '\n');
console.log(`Captured ${captures.length} cards in ${out}.`);
