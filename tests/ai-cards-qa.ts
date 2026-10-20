/**
 * Accessibility and layout checks for every assistant card, at 760px and
 * 390px in the light and dark host themes: rendered text contrast (every
 * text element against the surface it sits on, WCAG AA), hero art that is
 * decorative with no text over it, shows the twin for the host theme and
 * fades into the card on every side with no frame, no sideways overflow, every link and
 * button reachable by Tab with a visible focus ring, and no motion when the
 * system asks for reduced motion.
 * Real Chromium, synthetic host bridge, no network.
 *
 *   npx vite-node --script tests/ai-cards-qa.ts [-- --out <report.json>]
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { OCCASIONS_HTML } from '../integrations/generated/occasions.mjs';
import { HOROSCOPES_HTML } from '../integrations/generated/horoscopes.mjs';
import { executeAiTool, type AiCallContext } from '../src/ai-tools/tools';
import type { AiToolName } from '../src/ai-tools/contracts';
import type { HoroscopeWindow } from '../src/ai-tools/horoscope/window';

const argv = process.argv.slice(2);
const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : undefined;
const NOW = new Date('2026-10-17T12:00:00Z');
const result = async (tool: AiToolName, args: Record<string, unknown>) => ({ structuredContent: await executeAiTool(tool, args, { occasions: true, now: () => NOW }), _meta: undefined as unknown });
const window = JSON.parse(await readFile(new URL('../src/data/horoscope-window.json', import.meta.url), 'utf8')) as HoroscopeWindow;
async function horoscope(args: Record<string, unknown>) {
  const context: AiCallContext = {};
  const answer = await executeAiTool('get_horoscope', args, { now: () => new Date(`${window.generatedFor}T05:00:00Z`), horoscopeWindow: async () => window }, context);
  return { structuredContent: answer, _meta: context.horoscopePanel ? { 'zodiacs/horoscope': context.horoscopePanel } : undefined };
}
const ana = { name: 'Ana', birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038 };
const CARDS: [string, string, () => Promise<{ structuredContent: unknown; _meta: unknown }>][] = [
  ['chart-comparison', OCCASIONS_HTML, () => result('get_compatibility', { a: ana, b: { name: 'Luis', birthDate: '1992-08-10', time: '21:15', zone: 'America/Mexico_City', latitude: 19.4326, longitude: -99.1332 } })],
  // Long names step the title down so the main action stays on the card's first screen.
  ['chart-comparison-long-names', OCCASIONS_HTML, () => result('get_compatibility', { a: { ...ana, name: 'Maximilien Robespierre' }, b: { name: 'Wilhelmina Featherstonehaugh', birthDate: '1992-08-10' } })],
  ['chart-comparison-famous', OCCASIONS_HTML, () => result('get_compatibility', { a: { name: 'Sam', birthDate: '1994-02-01' }, b: { famous: 'Frida Kahlo' } })],
  ['wedding', OCCASIONS_HTML, () => result('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12', time: '17:00', zone: 'Europe/Rome', latitude: 43.7696, longitude: 11.2558, place: 'Florence, Italy', names: 'Ana & Luis' })],
  ['wedding-best-days', OCCASIONS_HTML, () => result('get_occasion_sky', { occasion: 'wedding', searchFrom: '2027-06-01', searchTo: '2027-06-30', zone: 'Europe/Rome', latitude: 43.7696, longitude: 11.2558, place: 'Florence, Italy' })],
  ['birthday', OCCASIONS_HTML, () => result('get_birthday', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid' })],
  ['birthday-cusp', OCCASIONS_HTML, () => result('get_birthday', { date: '03-20' })],
  ['chart-twins', OCCASIONS_HTML, () => result('find_chart_twins', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid' })],
  ['famous-chart', OCCASIONS_HTML, () => result('get_famous_chart', { name: 'Frida Kahlo' })],
  ['milestones', OCCASIONS_HTML, () => result('get_life_milestones', { birthDate: '1997-03-15' })],
  ['sky-calendar', OCCASIONS_HTML, () => result('get_sky_calendar', {})],
  ['horoscope', HOROSCOPES_HTML, () => horoscope({ sign: 'leo', zone: 'Asia/Bangkok' })],
  ['horoscope-picker', HOROSCOPES_HTML, () => horoscope({})],
];

async function deliver(page: Page, value: { structuredContent: unknown; _meta: unknown }, theme: string) {
  await page.evaluate(([content, theme]) => {
    (window as any).openai = { toolOutput: content.structuredContent, toolResponseMetadata: content._meta, theme };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: content.structuredContent, toolResponseMetadata: content._meta, theme } } }));
  }, [value, theme] as const);
}

/** The lowest text contrast on the page: each element with its own text, against the nearest opaque background behind it. */
const lowestContrast = (page: Page) => page.evaluate(() => {
  const parse = (value: string) => { const m = value.match(/rgba?\(([^)]+)\)/u); if (!m) return null; const [r, g, b, a = '1'] = m[1].split(/[ ,/]+/u).filter(Boolean); return [Number(r), Number(g), Number(b), Number(a)]; };
  const lum = ([r, g, b]: number[]) => { const c = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b); };
  const background = (element: Element | null): number[] => {
    for (let node = element; node; node = node.parentElement) {
      const color = parse(getComputedStyle(node).backgroundColor);
      if (color && color[3] >= 0.99) return color;
    }
    return parse(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1];
  };
  let lowest = { ratio: 99, text: '', color: '', on: '' };
  for (const element of document.querySelectorAll('body *')) {
    const own = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent!.trim());
    const style = getComputedStyle(element);
    if (!own || style.visibility === 'hidden' || (element as HTMLElement).offsetParent === null && style.position !== 'fixed') continue;
    const fg = parse(style.color)!, bg = background(element);
    const blended = fg[3] < 1 ? fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3])) : fg;
    const [hi, lo] = [lum(blended), lum(bg)].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    if (ratio < lowest.ratio) lowest = { ratio: Math.round(ratio * 100) / 100, text: element.textContent!.trim().slice(0, 40), color: style.color, on: `rgb(${bg.slice(0, 3).join(', ')})` };
  }
  return lowest;
});

const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS, headless: true });
const report: Record<string, unknown>[] = [];
try {
  for (const [card, html, make] of CARDS) {
    const value = await make();
    for (const width of [760, 390]) {
      for (const theme of ['light', 'dark'] as const) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
        await context.clock.setFixedTime(new Date(`${window.generatedFor}T05:00:00Z`));
        const page = await context.newPage();
        let network = 0;
        page.on('request', (request) => { if (!request.url().startsWith('data:')) network++; });
        await page.setContent(html);
        await deliver(page, value, theme);
        await page.locator('h1').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        // Open every disclosure so folded rows are checked too.
        await page.locator('details').evaluateAll((items) => items.forEach((item) => { (item as HTMLDetailsElement).open = true; }));
        const contrast = await lowestContrast(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth
          || [...document.querySelectorAll('.card *, .shell *')].some((element) => { const box = element.getBoundingClientRect(); return box.width > 0 && box.right > innerWidth + 0.5; }));
        // Hero art: decorative (empty alt, hidden from assistive technology, its size set), no text over it,
        // exactly one twin shown (the daylight twin in the light theme), and faded on every side with no frame.
        const art = await page.evaluate((theme) => {
          const frames = [...document.querySelectorAll('.art-frame')];
          const boxes = frames.map((frame) => frame.getBoundingClientRect());
          const textOver = [...document.querySelectorAll('body *')].filter((element) => {
            if (element.closest('.art')) return false;
            if (![...element.childNodes].some((node) => node.nodeType === 3 && node.textContent!.trim())) return false;
            const box = element.getBoundingClientRect();
            return boxes.some((frame) => box.left < frame.right && box.right > frame.left && box.top < frame.bottom && box.bottom > frame.top);
          }).length;
          const decorative = frames.every((frame) => frame.closest('[aria-hidden="true"]') && [...frame.querySelectorAll('img')].every((img) => img.getAttribute('alt') === '' && img.getAttribute('width')));
          const twin = frames.every((frame) => {
            const shown = [...frame.querySelectorAll('img')].filter((img) => getComputedStyle(img).display !== 'none');
            return shown.length === 1 && frame.classList.contains('art-twins') && shown[0].classList.contains(theme === 'light' ? 'art-light' : 'art-dark');
          });
          const faded = frames.every((frame) => {
            const style = getComputedStyle(frame);
            const mask = style.maskImage || style.getPropertyValue('-webkit-mask-image');
            return (mask.match(/linear-gradient/g) ?? []).length === 2 && style.borderTopWidth === '0px' && style.boxShadow === 'none' && style.backgroundImage === 'none' && parseFloat(style.borderTopLeftRadius) === 0;
          });
          return { frames: frames.length, textOver, decorative, twin, faded };
        }, theme);
        // Keyboard: Tab reaches every link, button and disclosure, each with a visible focus ring.
        const focusable = await page.locator('a[href], button:not([disabled]), summary').count();
        const reached: string[] = [];
        let unringed = 0;
        for (let step = 0; step < focusable + 2; step++) {
          await page.keyboard.press('Tab');
          const focused = await page.evaluate(() => {
            const element = document.activeElement as HTMLElement | null;
            if (!element || element === document.body) return null;
            const style = getComputedStyle(element);
            return { key: `${element.tagName}:${element.textContent?.trim().slice(0, 30)}:${(element as HTMLAnchorElement).href ?? ''}`, ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2 };
          });
          if (!focused) continue;
          if (!reached.includes(focused.key)) { reached.push(focused.key); if (!focused.ring) unringed++; }
        }
        // Reduced motion: hovering the nameplate starts nothing, and nothing transitions.
        await page.locator('.nameplate').first().hover();
        const motion = await page.evaluate(() => ({
          animations: document.getAnimations().filter((animation) => animation.playState === 'running').length,
          transitions: [...document.querySelectorAll('*')].filter((element) => getComputedStyle(element).transitionDuration.split(',').some((value) => parseFloat(value) > 0)).length,
        }));
        const row = { card, width, theme, lowestContrast: contrast, overflow, artFrames: art.frames, textOverArt: art.textOver, focusable, reachedByTab: reached.length, focusWithoutRing: unringed, runningAnimations: motion.animations, transitions: motion.transitions, network };
        report.push(row);
        assert.ok(contrast.ratio >= 4.5, `${card} ${width} ${theme}: text contrast ${contrast.ratio}:1 for "${contrast.text}" (${contrast.color} on ${contrast.on})`);
        assert.equal(overflow, false, `${card} ${width} ${theme}: nothing runs off the side`);
        assert.equal(art.textOver, 0, `${card} ${width} ${theme}: no text over the hero art`);
        assert.ok(art.decorative, `${card} ${width} ${theme}: hero art is decorative, with its size set`);
        assert.ok(art.twin, `${card} ${width} ${theme}: hero art shows its ${theme} twin, and only that one`);
        assert.ok(art.faded, `${card} ${width} ${theme}: hero art fades into the card on every side, with no frame`);
        if (!['horoscope-picker'].includes(card)) assert.ok(art.frames > 0, `${card} ${width} ${theme}: the card has its hero art`);
        assert.equal(reached.length, focusable, `${card} ${width} ${theme}: Tab reaches all ${focusable} controls (reached ${reached.length})`);
        assert.equal(unringed, 0, `${card} ${width} ${theme}: every focused control shows a ring`);
        assert.equal(motion.animations + motion.transitions, 0, `${card} ${width} ${theme}: no motion under reduced motion`);
        assert.equal(network, 0, `${card} ${width} ${theme}: no network requests`);
        if (card.endsWith('long-names')) {
          const lines = await page.evaluate(() => { const title = document.querySelector('h1')!; return title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight); });
          assert.ok(lines <= 2.05, `${card} ${width} ${theme}: the long names take ${lines.toFixed(1)} lines, not more than two`);
        }
        await context.close();
      }
    }
  }
  // The cards' tilted mark (owner-chosen 2026-10-18) is still: even with motion allowed, hovering the nameplate starts nothing.
  const context = await browser.newContext({ viewport: { width: 760, height: 900 } });
  const page = await context.newPage();
  await page.setContent(OCCASIONS_HTML);
  await deliver(page, await CARDS[2][2](), 'light');
  await page.locator('h1').waitFor();
  await page.locator('.nameplate').hover();
  assert.equal(await page.locator('.nameplate svg.tilted-ring circle').count(), 12, 'The nameplate draws the tilted twelve-dot mark');
  assert.equal(await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length), 0, 'The mark does not move on hover');
  await context.close();
} finally { await browser.close(); }
const lowest = report.reduce((min, row: any) => Math.min(min, row.lowestContrast.ratio), 99);
if (out) await writeFile(out, JSON.stringify({ checked: report.length, lowestTextContrast: lowest, rows: report }, null, 2) + '\n');
console.log(`Assistant card QA passed: ${report.length} renders, lowest text contrast ${lowest}:1, hero art on every card in its theme's twin, faded on every side with no text over it, no overflow, every control reachable by Tab with a focus ring, no motion under reduced motion.`);
