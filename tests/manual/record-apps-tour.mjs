/**
 * Record the /apps/ tour: the live Zodiacs cards with synthetic examples, played frame by frame.
 * Each scene types the question, brings in the real card from https://zodiacs.org/mcp, then
 * scrolls, opens details or switches tabs inside it. The question, footer and closing words are
 * drawn over the card's own page; nothing here imitates ChatGPT or Claude.
 * Run: node tests/manual/record-apps-tour.mjs --out <new folder> [--keep-frames]
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { findChromium, STABLE_CHROMIUM_ARGS } from '../visual/browser.mjs';
import { STUDIO_HTML } from '../../integrations/generated/chart-studio.mjs';
import { HOROSCOPES_HTML } from '../../integrations/generated/horoscopes.mjs';
import { OCCASIONS_HTML } from '../../integrations/generated/occasions.mjs';

const args = process.argv.slice(2);
const outArgument = args.includes('--out') ? args[args.indexOf('--out') + 1] : undefined;
assert.ok(outArgument && !outArgument.startsWith('--'), 'Use --out <new folder>');
const out = resolve(outArgument);
try { await access(out); throw Error('Output already exists. Use a fresh folder.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(`${out}/frames`, { recursive: true });

const source = 'https://zodiacs.org/mcp';
const FPS = 30;
const WIDTH = 540;
const HEIGHT = 675;
const TOP = 150;
const FOOT = 46;
const started = Date.now();
const log = (...parts) => console.error(`[${((Date.now() - started) / 1000).toFixed(1)}s]`, ...parts);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const rpc = async (method, params, attempt = 1) => {
  const response = await fetch(source, { method: 'POST', signal: AbortSignal.timeout(60_000), headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  if (response.status === 429 && attempt < 3) {
    await new Promise((done) => setTimeout(done, Math.min(Number(response.headers.get('retry-after')) || 30, 60) * 1000));
    return rpc(method, params, attempt + 1);
  }
  assert.equal(response.status, 200, `${method} answered`);
  const text = await response.text();
  const events = text.split('\n').filter((row) => row.startsWith('data: ')).map((row) => JSON.parse(row.slice(6)));
  const body = (events.length ? events : [JSON.parse(text)]).find((message) => 'result' in message || 'error' in message);
  assert.ok(body, `${method} returned a response`);
  assert.equal(body.error, undefined, `${method} succeeded`);
  return body.result;
};

// The same synthetic examples as the showcase pictures.
const SCENES = [
  {
    name: 'comparison', html: OCCASIONS_HTML, uri: 'ui://zodiacs/occasions-v8.html', heading: 'Lucía and Mateo',
    prompt: 'Compare our charts, with our names on the card. I’m Lucía, born 3 May 1990 at 8:30 in Madrid. Mateo was born 10 August 1992.',
    tool: 'get_compatibility', arguments: { a: { name: 'Lucía', birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038, place: 'Madrid, Spain' }, b: { name: 'Mateo', birthDate: '1992-08-10' } },
    steps: [['hold', 0.5], ['scrollTo', '.hero', 0.7], ['hold', 0.8], ['open', 'summary', 0.5], ['scrollBy', 520, 1.5], ['hold', 0.4]],
  },
  {
    name: 'wedding', html: OCCASIONS_HTML, uri: 'ui://zodiacs/occasions-v8.html', heading: 'Lucía and Mateo',
    prompt: 'Make a wedding card with our names for 12 June 2027 at 17:00 in Florence, Italy.',
    tool: 'get_occasion_sky', arguments: { occasion: 'wedding', date: '2027-06-12', time: '17:00', zone: 'Europe/Rome', latitude: 43.7696, longitude: 11.2558, place: 'Florence, Italy', names: 'Lucía and Mateo' },
    steps: [['hold', 0.5], ['scrollTo', '.hero', 0.7], ['hold', 1.0]],
  },
  {
    name: 'horoscope', html: HOROSCOPES_HTML, uri: 'ui://zodiacs/horoscopes-v6.html', heading: 'Leo',
    prompt: 'What does today hold for Leo?',
    tool: 'get_horoscope', arguments: { sign: 'leo', zone: 'Asia/Bangkok' },
    steps: [['hold', 0.6], ['scrollTo', 'button:has-text("Today")', 0.7], ['click', 'Tomorrow', 0.8], ['click', 'Love', 0.9], ['hold', 0.4]],
  },
  {
    name: 'chart', html: STUDIO_HTML, uri: 'ui://zodiacs/chart-studio-v6.html', heading: 'Chart Studio',
    prompt: 'Open Chart Studio and show me the example chart.',
    tool: null, before: { click: 'See an example chart (not yours)', scrollTo: 'section.chart-area' },
    steps: [['hold', 0.8], ['scrollTo', 'select:has(option:has-text("Venus"))', 0.8], ['choose', 'Venus', 0.8], ['hold', 1.4]],
  },
];

// Drawn over each card's page: the question at the top, a footer, a tap mark and the closing words.
// The card itself is the real panel, pushed below the question.
const fontFaces = (OCCASIONS_HTML.match(/@font-face\{[^}]*\}/g) ?? []).join('\n');
assert.ok(fontFaces.includes('EB Garamond') && fontFaces.includes('Instrument Sans'), 'card fonts found');
const OVERLAY_CSS = `${fontFaces}
html{background:#0b0c10 !important;}
body{padding:${TOP + 6}px ${(WIDTH - 400) / 2}px ${FOOT + 30}px !important;background:#0b0c10 !important;transform-origin:50% 0;}
#zt-top{position:fixed;left:0;right:0;top:0;height:${TOP}px;z-index:2147483000;background:linear-gradient(#0b0c10 82%,rgba(11,12,16,0));pointer-events:none;}
#zt-glow{position:absolute;left:-10%;right:-10%;top:-60%;height:160%;background:radial-gradient(55% 55% at 50% 0%,rgba(196,160,255,.16),transparent 70%);}
#zt-ask{position:absolute;left:44px;right:44px;top:28px;}
#zt-label{font:600 10.5px/1 'Instrument Sans',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#a9a3b8;margin-bottom:12px;}
#zt-prompt{font:italic 400 20px/1.32 'EB Garamond',serif;color:#f1ece2;}
#zt-caret{display:inline-block;width:1.5px;height:19px;margin-left:2px;vertical-align:-3px;background:#cdb7ff;}
#zt-foot{position:fixed;left:0;right:0;bottom:0;height:${FOOT}px;z-index:2147483000;background:linear-gradient(rgba(11,12,16,0),#0b0c10 40%);display:flex;align-items:flex-end;justify-content:space-between;padding:0 44px 16px;box-sizing:border-box;font:500 11px/1 'Instrument Sans',sans-serif;color:#8d8799;letter-spacing:.02em;pointer-events:none;}
#zt-tap{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(214,196,255,.35);border:1.5px solid rgba(240,232,255,.85);z-index:2147483001;pointer-events:none;opacity:0;}
#zt-end{position:fixed;inset:0;z-index:2147483002;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;opacity:0;background:#0b0c10;pointer-events:none;}
#zt-end h1{font:400 44px/1.05 'EB Garamond',serif;margin:0 0 14px;color:#f3eee4;letter-spacing:-.01em;}
#zt-end h1 em{color:#d7c2ff;}
#zt-end p{font:500 15px/1.45 'Instrument Sans',sans-serif;color:#b9b3c4;margin:0 48px;}
#zt-end .zt-url{margin-top:26px;font:600 13px/1 'Instrument Sans',sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#e9e5dc;}`;
const addOverlay = (css) => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  const root = document.documentElement;
  root.insertAdjacentHTML('beforeend', '<div id="zt-top"><div id="zt-glow"></div><div id="zt-ask"><div id="zt-label">You ask</div><div id="zt-prompt"><span id="zt-typed"></span><span id="zt-caret"></span></div></div></div>'
    + '<div id="zt-foot"><span>Real Zodiacs cards · example details</span><span>zodiacs.org</span></div><div id="zt-tap"></div>'
    + '<div id="zt-end"><h1>A little sky in your<br><em>conversation.</em></h1><p>Birth charts, two charts compared and the sky on a day that matters.</p><div class="zt-url">zodiacs.org</div></div>');
};

const settle = async (limit) => {
  for (const image of document.images) image.loading = 'eager';
  const loaded = Promise.all([document.fonts.ready, ...[...document.images].map((image) => image.decode().catch(() => {}))]);
  await Promise.race([loaded, new Promise((_, fail) => setTimeout(() => fail(new Error(`fonts or pictures did not load in ${limit / 1000} s`)), limit))]);
};
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS, headless: true });
let frame = 0;
let posterFrame = null;
const errors = [];
const report = [];
try {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2, colorScheme: 'dark', reducedMotion: 'reduce', timezoneId: 'Asia/Bangkok' });
  context.setDefaultTimeout(30_000);
  await context.route('https://zodiacs.org/assets/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    try {
      await route.fulfill({ body: await readFile(new URL(`../../public${pathname}`, import.meta.url)), contentType: pathname.endsWith('.avif') ? 'image/avif' : pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/webp' });
    } catch { await route.continue(); }
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const shoot = async () => { await page.screenshot({ path: `${out}/frames/${String(frame).padStart(5, '0')}.png`, animations: 'disabled', caret: 'hide' }); frame += 1; };
  const hold = async (seconds) => { for (let i = 0; i < Math.round(seconds * FPS); i += 1) await shoot(); };
  const setBody = (style) => page.evaluate((css) => Object.assign(document.body.style, css), style);
  const scrollPage = async (target, seconds) => {
    const from = await page.evaluate(() => scrollY);
    const to = await page.evaluate((y) => Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight)), target);
    const count = Math.max(1, Math.round(seconds * FPS));
    for (let i = 1; i <= count; i += 1) { await page.evaluate((y) => scrollTo(0, y), from + (to - from) * ease(i / count)); await shoot(); }
  };
  const tapAt = async (box, seconds, act) => {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const count = Math.round(seconds * FPS);
    for (let i = 0; i < count; i += 1) {
      const t = i / count;
      await page.evaluate(([px, py, scale, opacity]) => Object.assign(document.getElementById('zt-tap').style, { left: `${px}px`, top: `${py}px`, transform: `scale(${scale})`, opacity: String(opacity) }), [x, y, 0.6 + 0.6 * Math.min(1, t * 2), t < 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) * 2.5)]);
      if (i === Math.round(count * 0.35)) await act();
      await shoot();
    }
    await page.evaluate(() => { document.getElementById('zt-tap').style.opacity = '0'; });
  };
  let previousPrompt = '';
  for (const [index, scene] of SCENES.entries()) {
    log(scene.name, 'start');
    // Fade the last card out before the next question.
    if (index > 0) for (let i = 1; i <= 8; i += 1) { await setBody({ opacity: String(1 - i / 8) }); await shoot(); }
    const result = scene.tool ? await rpc('tools/call', { name: scene.tool, arguments: scene.arguments }) : null;
    if (result) assert.equal(result.structuredContent?.ok, true, `${scene.name} returned a card`);
    const live = (await rpc('resources/read', { uri: scene.uri })).contents[0].text;
    assert.equal(hash(scene.html), hash(live), `${scene.name} local HTML equals live resource`);
    await page.setContent(scene.html);
    await page.evaluate(addOverlay, OVERLAY_CSS);
    await page.evaluate((text) => { document.getElementById('zt-typed').textContent = text; }, previousPrompt);
    await setBody({ opacity: '0', transform: 'translateY(26px)' });
    if (result) await page.evaluate((value) => { window.openai = { toolOutput: value.structuredContent, toolResponseMetadata: value._meta, theme: 'dark' }; window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: window.openai } })); }, result);
    if (scene.tool) await page.getByRole('heading', { name: scene.heading, exact: true }).first().waitFor();
    else await page.getByRole('button', { name: 'See an example chart (not yours)', exact: true }).waitFor();
    // Lazy pictures below the fold would never load in a still page, so load them all now (20 s at most).
    await page.evaluate(settle, 20_000);
    if (scene.before) {
      await page.getByRole('button', { name: scene.before.click, exact: true }).click();
      await page.locator(scene.before.scrollTo).first().waitFor();
      await page.evaluate(settle, 20_000);
      const top = await page.locator(scene.before.scrollTo).first().evaluate((element, offset) => element.getBoundingClientRect().top + scrollY - offset, TOP + 10);
      await page.evaluate((y) => scrollTo(0, y), top);
    }
    log(scene.name, 'card rendered');
    // Type the question at about 95 characters a second; the card rises in once half of it is typed.
    const perFrame = 95 / FPS;
    const typingFrames = Math.ceil(scene.prompt.length / perFrame);
    const riseFrom = Math.round(typingFrames * 0.5);
    for (let i = 1; i <= Math.max(typingFrames, riseFrom + 12); i += 1) {
      const rise = ease(Math.min(1, Math.max(0, (i - riseFrom) / 12)));
      await page.evaluate(([text, opacity, shift]) => { document.getElementById('zt-typed').textContent = text; Object.assign(document.body.style, { opacity: String(opacity), transform: `translateY(${shift}px)` }); }, [scene.prompt.slice(0, Math.ceil(i * perFrame)), rise, 26 * (1 - rise)]);
      await shoot();
    }
    previousPrompt = scene.prompt;
    await setBody({ opacity: '1', transform: 'none' });
    // The poster is the first card fully in, with its question above it.
    if (posterFrame === null) posterFrame = frame - 1;
    for (const [kind, target, seconds] of scene.steps) {
      if (kind === 'hold') await hold(target);
      else if (kind === 'scrollTo') {
        const top = await page.locator(target).first().evaluate((element, offset) => element.getBoundingClientRect().top + scrollY - offset, TOP + 10);
        await scrollPage(top, seconds);
      } else if (kind === 'scrollBy') {
        await scrollPage((await page.evaluate(() => scrollY)) + target, seconds);
      } else if (kind === 'open') {
        const summary = page.locator(target).first();
        await tapAt(await summary.boundingBox(), seconds, () => summary.click());
      } else if (kind === 'click') {
        const button = page.getByRole('button', { name: target, exact: true }).first();
        await tapAt(await button.boundingBox(), seconds, () => button.click());
      } else if (kind === 'choose') {
        const select = page.locator('select').filter({ hasText: target }).first();
        await tapAt(await select.boundingBox(), seconds, () => select.selectOption({ label: target }));
      }
    }
    report.push({ name: scene.name, resourceUri: scene.uri, htmlSha256: hash(scene.html), endFrame: frame });
    log(scene.name, 'done at frame', frame);
  }
  // The closing words.
  for (let i = 1; i <= 10; i += 1) { await page.evaluate((o) => { document.getElementById('zt-end').style.opacity = String(o); }, ease(i / 10)); await shoot(); }
  await hold(1.6);
  await context.close();
} catch (error) {
  // A failed run leaves no frames behind unless they were asked for.
  if (!args.includes('--keep-frames')) await rm(`${out}/frames`, { recursive: true, force: true });
  throw error;
} finally {
  await browser.close();
}
assert.deepEqual(errors, [], 'browser errors');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${out}/frames/%05d.png`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/tour.mp4`]);
log('encoded', frame, 'frames,', (frame / FPS).toFixed(2), 'seconds');
const video = await readFile(`${out}/tour.mp4`);
const poster = await sharp(`${out}/frames/${String(posterFrame).padStart(5, '0')}.png`).resize({ width: 648 }).webp({ quality: 88, effort: 6 }).toBuffer();
await writeFile(`${out}/demo-poster.webp`, poster);
const posterMeta = await sharp(poster).metadata();
const manifest = {
  recordedAt: new Date().toISOString(), syntheticExamples: true, source,
  file: 'tour.mp4', width: WIDTH * 2, height: HEIGHT * 2, fps: FPS, frames: frame, seconds: Number((frame / FPS).toFixed(3)), bytes: video.length, sha256: hash(video),
  poster: { file: 'demo-poster.webp', width: posterMeta.width, height: posterMeta.height, bytes: poster.length, sha256: hash(poster), frame: posterFrame },
  scenes: report,
};
await writeFile(`${out}/tour.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ frames: frame, seconds: manifest.seconds, posterFrame }));
if (!args.includes('--keep-frames')) await rm(`${out}/frames`, { recursive: true });
