/**
 * The story figures as short vertical clips: each story that plays once on
 * the site (docs/MOTION.md, "Stories") rendered as a silent 1080 x 1920 clip
 * that ends on the brand end card, so the graphic doubles as a post.
 *
 *   npm run dev                                   (in another terminal)
 *   node scripts/build-story-clips.mjs --out <dir>      (the default sample set)
 *   node scripts/build-story-clips.mjs --out <dir> sign-guide:leo,virgo compatibility:cancer-pisces
 *
 * Each clip is the story figure large and centred on the void, the figure's
 * own heading (or the first sentence of its caption) above it in EB Garamond,
 * the page's address below it, half a second of the waiting figure, the
 * story, a hold on the finished figure and the end card
 * (public/assets/brand/end-card/, reused as published). CLIP_TIMELINE sets
 * the seconds; every clip runs the same length.
 *
 * The figure is the page's own: Chromium opens the page from a running site
 * (`--base`, the dev server by default; `npm run build && npm run preview`
 * works the same), and the story plays through the page's own CSS. The
 * harness never changes what a visitor gets. It only:
 *   - keeps the shared entrance runtime from starting this one story, by not
 *     handing its mark to IntersectionObserver (every other mark and every
 *     lazy loader on the page work as usual);
 *   - adds .is-in to the mark itself, which starts the story's transitions
 *     exactly as the runtime would, then pauses every one of them and draws
 *     each frame by setting their currentTime, so each frame is a pure
 *     function of its time, as in scripts/build-thesis-film.mjs;
 *   - never adds .is-done, so nothing cancels the paused transitions;
 *   - on a horoscope page, arms the wheel's veil (.is-armed) as the page's
 *     own script does when the image loads below the screen.
 *
 * Every word and number in a clip is read from the rendered page, so it is
 * the page's data by construction. The builder refuses to render a clip when:
 * the caption is missing, has a dash, names token or market words or the
 * word "born"; a word in the figure is drawn in a fallback face instead of
 * the self-hosted one; an image in the figure has not loaded; the story runs
 * past the runtime's 2.6 s; or the last frame is not the finished picture
 * (the same figure with motion off, as the server drew it).
 *
 * Writes <out>/<story>-<sample>.mp4 (H.264, yuv420p, 30 fps, +faststart, no
 * audio) and <out>/<story>-<sample>.jpg (the last story frame). The clips
 * are deliverables, not site files: they are written outside the repository
 * by default, and the encodes are not byte-stable across platforms.
 * scripts/story-clips.test.mjs checks the pure parts (the timeline, the plan
 * and the caption rules).
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const SIGN_SLUGS = Object.freeze([
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
]);
const MONTH_SLUGS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const CLIP = Object.freeze({
  width: 1080,
  height: 1920,
  fps: 30,
  /** Where platform UI sits: no words above this line or below the bottom one. */
  safeTop: 220,
  safeBottom: 320,
  /** The figure's largest width on the frame. */
  figureWidth: 960,
  /** The page is opened as a phone sees it, at three device pixels per CSS pixel. */
  viewport: { width: 430, height: 932 },
  scale: 3,
  /** CSS pixels of the page kept round the figure, faded out at the edges. */
  pad: 18,
  background: '#060709',
  ink: '#EEF1F7',
  muted: '#8E96AB',
  endCard: '/assets/brand/end-card/zodiacs-end-card-9x16.mp4',
  endCardSeconds: 2,
  /** The shared runtime settles every mark at 2.6 s (src/components/Motion.astro). */
  storyLimitMs: 2600,
  maxBytes: 3 * 1024 * 1024,
});

/** Seconds: the waiting figure, then the story and its hold, then the end card. */
export const CLIP_TIMELINE = Object.freeze({ lead: 0.5, story: 5.5, minHold: 1.5 });

/**
 * The time, in ms of the story, of every frame before the end card: the
 * waiting figure for `lead`, the story at one frame per 1/fps, then the
 * finished figure held to the end of the section.
 */
export function frameTimes(storyMs, { fps = CLIP.fps, lead = CLIP_TIMELINE.lead, story = CLIP_TIMELINE.story } = {}) {
  if (!(storyMs > 0)) throw new Error('story clips: the story has no motion to render');
  if (storyMs > CLIP.storyLimitMs) throw new Error(`story clips: the story runs ${storyMs} ms, past the runtime's ${CLIP.storyLimitMs} ms`);
  const total = Math.round(story * fps);
  const leadFrames = Math.round(lead * fps);
  const step = 1000 / fps;
  const times = [];
  for (let index = 0; index < total; index += 1) times.push(Math.min(storyMs, Math.max(0, (index - leadFrames) * step)));
  // The last moving frame lands on the story's end exactly.
  const firstStill = times.indexOf(storyMs);
  const hold = (total - firstStill) / fps;
  if (hold < CLIP_TIMELINE.minHold) throw new Error(`story clips: only ${hold.toFixed(2)} s to hold the finished figure`);
  return times;
}

/** The clip's whole length in seconds, end card included. */
export const clipSeconds = () => CLIP_TIMELINE.story + CLIP.endCardSeconds;

const isSign = (value) => SIGN_SLUGS.includes(value);

/** A pair as the site spells it: the two signs in zodiac order. */
export function pairSample(value) {
  const parts = String(value).split('-');
  if (parts.length !== 2 || !parts.every(isSign)) throw new Error(`story clips: "${value}" is not a pair of two signs, such as aries-leo`);
  const [a, b] = parts.sort((x, y) => SIGN_SLUGS.indexOf(x) - SIGN_SLUGS.indexOf(y));
  return `${a}-${b}`;
}

export function birthdaySample(value) {
  const match = /^([a-z]+)-(\d{1,2})$/u.exec(String(value));
  const month = match ? MONTH_SLUGS.indexOf(match[1]) : -1;
  const day = match ? Number(match[2]) : 0;
  if (month < 0 || day < 1 || day > MONTH_DAYS[month] || match[2].startsWith('0')) {
    throw new Error(`story clips: "${value}" is not a birthday page, such as october-31`);
  }
  return `${MONTH_SLUGS[month]}-${day}`;
}

const signSample = (value) => {
  if (!isSign(value)) throw new Error(`story clips: "${value}" is not a sign`);
  return value;
};
const onlyPage = (value) => {
  if (value !== 'page') throw new Error(`story clips: this story has one page; leave the sample out`);
  return value;
};

/**
 * The stories, one per figure in docs/MOTION.md, "The stories that exist".
 * `figure` is what the clip shows (several selectors make one box round
 * them all), `go` the story's one mark, `caption` the words the page prints
 * for that figure.
 */
export const STORIES = Object.freeze({
  'sign-guide': {
    path: (sign) => `/${sign}/`,
    sample: signSample,
    samples: SIGN_SLUGS,
    figure: ['.sunyear .sy-wheel'],
    go: '.sunyear .sy-go',
    caption: '#sunyear-title',
    source: 'the Sun\'s year plate\'s heading (src/lib/sun-year-words.ts, heading)',
  },
  compatibility: {
    path: (pair) => `/compatibility/${pair}/`,
    sample: pairSample,
    samples: ['aries-leo'],
    figure: ['.pairangle .pa-wheel'],
    go: '.pairangle .pa-go',
    caption: '#pairangle-title',
    source: 'the angle plate\'s heading (src/lib/pair-angle-words.ts)',
  },
  horoscope: {
    path: (sign) => `/horoscopes/${sign}/`,
    sample: signSample,
    samples: ['sagittarius'],
    figure: ['.hz-wheel__box'],
    go: '.hz-wheel__box .hw-go',
    caption: '.hz-cta__wheel figcaption',
    sentences: 1,
    arm: '.hz-wheel__box',
    source: 'the first sentence of the sky wheel\'s figcaption (wheelCaption in src/components/HoroscopeProgramPage.astro)',
  },
  'full-moon': {
    path: () => '/full-moon-calendar/',
    sample: onlyPage,
    samples: ['page'],
    figure: ['.fullmoons .fm-figure'],
    go: '.fullmoons .fm-go',
    caption: '.fullmoons .fm-plate h2',
    source: 'the full Moon year plate\'s heading (src/components/sky/FullMoonYearPlate.astro)',
  },
  'mercury-retrograde': {
    path: () => '/mercury-retrograde/',
    sample: onlyPage,
    samples: ['page'],
    figure: ['.mercyear .my-figure'],
    go: '.mercyear .my-go',
    caption: '.mercyear .my-plate h2',
    source: 'Mercury\'s year plate\'s heading (src/components/sky/MercuryYearPlate.astro)',
  },
  'rising-sign': {
    path: () => '/rising-sign/',
    sample: onlyPage,
    samples: ['page'],
    // The phone's two half days, without the notes under them (they say
    // "Born at", which a clip never shows).
    figure: ['.rs-day--m .rs-sub', '.rs-day--m .rs-track', '.rs-day--m .rs-axis', '.rs-day--m .rs-pin__l'],
    go: '.rs-days > .rs-go',
    caption: '.rs-day--m .rs-day__head p',
    source: 'the line under the day strip\'s heading (src/pages/rising-sign/index.astro); the heading itself carries the example\'s date',
  },
  birthday: {
    path: (slug) => `/birthday/${slug}/`,
    sample: birthdaySample,
    samples: ['november-28'],
    figure: ['.bday-dial'],
    go: '.bday-dial .bday-dial__go',
    caption: '#bday-measure-title',
    source: 'the "Where the Sun stands" heading (src/pages/birthday/[slug].astro)',
  },
  'birth-chart': {
    path: () => '/birth-chart/',
    sample: onlyPage,
    samples: ['page'],
    figure: ['.bc-anat__wheel'],
    go: '.bc-anat__wheel .bca-go',
    caption: '.bc-what .section-head h2',
    source: 'the "What you get" section heading (src/pages/birth-chart/index.astro)',
  },
});

/**
 * Which clips to render. No arguments: every sign guide and one sample of
 * each other story. Otherwise `story` (its default samples) or
 * `story:sample,sample`.
 */
export function planClips(args = []) {
  const wanted = args.length ? args : Object.keys(STORIES);
  const plan = [];
  for (const arg of wanted) {
    const [key, list] = String(arg).split(':');
    const story = STORIES[key];
    if (!story) throw new Error(`story clips: no story "${key}"; the stories are ${Object.keys(STORIES).join(', ')}`);
    const samples = list ? list.split(',').filter(Boolean).map(story.sample) : story.samples;
    for (const sample of samples) {
      const name = sample === 'page' ? key : `${key}-${sample}`;
      if (!plan.some((clip) => clip.name === name)) plan.push({ key, sample, name, path: story.path(sample) });
    }
  }
  return plan;
}

const BANNED = /\b(token|coin|crypto|market|price|buy|sell|trade|wallet|invest|profit|born)\b/iu;

/**
 * The caption, as the page prints it: whitespace folded, and cut to its
 * first sentences where the story asks for that. Throws when it cannot be
 * shown as it is.
 */
export function captionFrom(text, { sentences } = {}) {
  let words = String(text ?? '').replace(/\s+/gu, ' ').trim();
  if (sentences) {
    const parts = words.match(/[^.!?]+[.!?]+(?=\s|$)/gu) ?? [words];
    words = parts.slice(0, sentences).join(' ').trim();
  }
  if (!words) throw new Error('story clips: the page prints no caption for this figure');
  if (/[\u2013\u2014]/u.test(words)) throw new Error(`story clips: the caption "${words}" has a dash`);
  if (BANNED.test(words)) throw new Error(`story clips: the caption "${words}" has words a clip never shows`);
  if (words.length > 90) throw new Error(`story clips: the caption "${words}" is too long for a clip`);
  return words;
}

async function fontUrl(path) {
  return `data:font/woff2;base64,${(await readFile(resolve(root, path))).toString('base64')}`;
}

/** The still frame round the figure: the void, the caption and the address. */
function stageHtml({ fonts }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'EB Garamond'; src: url('${fonts.serif}') format('woff2'); font-weight: 500; }
@font-face { font-family: 'JetBrains Mono'; src: url('${fonts.mono}') format('woff2-variations'); font-weight: 300 600; }
html, body { margin: 0; width: ${CLIP.width}px; height: ${CLIP.height}px; overflow: hidden; background: ${CLIP.background}; }
.stage { position: absolute; left: 60px; right: 60px; top: ${CLIP.safeTop + 40}px; bottom: ${CLIP.safeBottom + 30}px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 56px; }
.caption { margin: 0; max-width: 900px; font: 500 66px/1.12 'EB Garamond', serif; color: ${CLIP.ink}; text-align: center; text-wrap: balance; letter-spacing: -0.005em; }
.figure { flex: none; }
.where { margin: 0; font: 400 26px/1.3 'JetBrains Mono', monospace; color: ${CLIP.muted}; letter-spacing: -0.01em; }
</style></head><body><div class="stage"><p class="caption"></p><div class="figure"></div><p class="where"></p></div><script>
window.layout = async ({ ground, caption, where, aspect, maxWidth }) => {
  document.documentElement.style.background = ground;
  document.body.style.background = ground;
  for (const f of ['500 66px "EB Garamond"', '400 26px "JetBrains Mono"']) {
    await document.fonts.load(f, caption + where);
    if (!document.fonts.check(f)) throw new Error('font did not load: ' + f);
  }
  document.querySelector('.caption').textContent = caption;
  document.querySelector('.where').textContent = where;
  const stage = document.querySelector('.stage').getBoundingClientRect();
  const used = document.querySelector('.caption').offsetHeight + document.querySelector('.where').offsetHeight + 56 * 2;
  const room = stage.height - used;
  let width = Math.min(maxWidth, stage.width);
  if (width / aspect > room) width = room * aspect;
  const figure = document.querySelector('.figure');
  figure.style.width = Math.round(width) + 'px';
  figure.style.height = Math.round(width / aspect) + 'px';
  const box = figure.getBoundingClientRect();
  const lines = Math.round(document.querySelector('.caption').offsetHeight / (66 * 1.12));
  const words = [...document.querySelectorAll('.caption, .where')].map((el) => el.getBoundingClientRect());
  return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), lines,
    wordsTop: Math.min(...words.map((r) => r.top)), wordsBottom: Math.max(...words.map((r) => r.bottom)) };
};
</script></body></html>`;
}

/** Runs before any page script: keeps the entrance runtime off this one story's mark. */
function harnessInit(goSelector) {
  const Real = window.IntersectionObserver;
  if (!Real) return;
  window.IntersectionObserver = class extends Real {
    observe(element) {
      if (element && element.matches && element.matches(goSelector)) return;
      super.observe(element);
    }
  };
}

/** Brings the figure to the middle of the screen and waits until all of it has loaded. */
async function prepareFigure(page, story) {
  await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel')));
  await page.evaluate(({ figure, arm }) => {
    const boxes = figure.flatMap((s) => [...document.querySelectorAll(s)]).map((el) => el.getBoundingClientRect());
    if (!boxes.length) throw new Error('the page has no figure ' + figure.join(', '));
    const top = Math.min(...boxes.map((b) => b.top)) + scrollY;
    const bottom = Math.max(...boxes.map((b) => b.bottom)) + scrollY;
    // The page's own lazy loaders see the figure come near and load it.
    window.scrollTo({ top: Math.max(0, (top + bottom) / 2 - innerHeight / 2), behavior: 'instant' });
    if (arm) document.querySelector(arm)?.classList.add('is-armed');
  }, story);
  await page.waitForFunction(({ figure }) => {
    const els = figure.flatMap((s) => [...document.querySelectorAll(s)]);
    return els.every((el) => !el.querySelector('img[data-src], image[data-href]')
      && [...el.querySelectorAll('img')].every((img) => img.complete && img.naturalWidth > 0));
  }, story, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

/** Every word the figure draws must be in a self-hosted face that has loaded. */
async function checkFigure(page, story) {
  return page.evaluate(({ figure }) => {
    const faces = [...document.fonts].filter((face) => face.status === 'loaded');
    const range = (w) => { const [a, b = a] = String(w).split(/\s+/u).map((x) => (x === 'normal' ? 400 : x === 'bold' ? 700 : Number(x))); return [a, b]; };
    const problems = [];
    const texts = [];
    for (const el of figure.flatMap((s) => [...document.querySelectorAll(s)])) {
      for (const node of [el, ...el.querySelectorAll('*')]) {
        const own = [...node.childNodes].filter((c) => c.nodeType === 3 && c.textContent.trim()).map((c) => c.textContent.trim()).join(' ');
        if (!own) continue;
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        texts.push(own);
        const family = style.fontFamily.split(',')[0].trim().replace(/^["']|["']$/gu, '');
        const weight = Number(style.fontWeight);
        const ok = faces.some((face) => {
          const [lo, hi] = range(face.weight);
          return face.family.replace(/^["']|["']$/gu, '') === family && weight >= lo && weight <= hi && (face.style === style.fontStyle || face.style === 'normal');
        });
        if (!ok) problems.push(`"${own}" in ${family} ${weight}`);
      }
      for (const img of el.querySelectorAll('img')) if (!img.complete || !img.naturalWidth) problems.push(`image ${img.currentSrc || img.src} not loaded`);
    }
    return { problems, text: texts.join(' ') };
  }, story);
}

/** The box round the figure, in CSS pixels of the screen, with the page kept round it. */
async function figureBox(page, story) {
  const box = await page.evaluate(({ figure }) => {
    const rects = figure.flatMap((s) => [...document.querySelectorAll(s)]).map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height);
    const left = Math.min(...rects.map((r) => r.left)), top = Math.min(...rects.map((r) => r.top));
    return { x: left, y: top, width: Math.max(...rects.map((r) => r.right)) - left, height: Math.max(...rects.map((r) => r.bottom)) - top, vw: innerWidth, vh: innerHeight };
  }, story);
  const x = Math.max(0, Math.floor(box.x - CLIP.pad));
  const y = Math.max(0, Math.floor(box.y - CLIP.pad));
  const clip = { x, y, width: Math.min(box.vw, Math.ceil(box.x + box.width + CLIP.pad)) - x, height: Math.min(box.vh, Math.ceil(box.y + box.height + CLIP.pad)) - y };
  if (box.y < 0 || box.y + box.height > box.vh) throw new Error('the figure is taller than the screen');
  return clip;
}

/** Starts the story as the runtime would, then holds every transition still at 0. */
async function startStory(page, story) {
  return page.evaluate(({ go }) => {
    const mark = document.querySelector(go);
    if (!mark) throw new Error('the page has no story mark ' + go);
    if (document.documentElement.getAttribute('data-entrance') !== 'on') throw new Error('motion is off on this page');
    if (mark.classList.contains('is-in')) throw new Error('the story has already played');
    mark.classList.add('is-in');
    void document.body.offsetHeight;
    const scope = mark.parentElement;
    const all = document.getAnimations();
    all.forEach((a) => { a.pause(); a.currentTime = 0; });
    const mine = all.filter((a) => a.effect && a.effect.target && scope.contains(a.effect.target));
    window.__storyAnimations = all;
    return Math.max(0, ...mine.map((a) => { const t = a.effect.getComputedTiming(); return t.delay + t.activeDuration; }));
  }, story);
}

const seek = (page, ms) => page.evaluate((t) => { for (const a of window.__storyAnimations) a.currentTime = t; }, ms);

/** Shows the finished picture, as without motion, for the last-frame check. */
const finishedPicture = (page) => page.evaluate(() => {
  for (const a of window.__storyAnimations) a.cancel();
  document.documentElement.setAttribute('data-entrance', 'off');
});

/** The page's own surface round the figure: the median of the kept border's pixels. */
export async function edgeColour(png, border) {
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = [[], [], []];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (x >= border && y >= border && x < info.width - border && y < info.height - border) continue;
      const at = (y * info.width + x) * info.channels;
      for (let c = 0; c < 3; c += 1) channels[c].push(data[at + c]);
    }
  }
  const median = (list) => list.sort((a, b) => a - b)[Math.floor(list.length / 2)];
  return `#${channels.map((list) => median(list).toString(16).padStart(2, '0')).join('')}`;
}

async function meanDifference(a, b) {
  const { default: sharp } = await import('sharp');
  const [x, y] = await Promise.all([a, b].map((buf) => sharp(buf).removeAlpha().raw().toBuffer()));
  if (x.length !== y.length) return 255;
  let sum = 0;
  for (let i = 0; i < x.length; i += 1) sum += Math.abs(x[i] - y[i]);
  return sum / x.length;
}

const COLOUR = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv'];

async function renderClip({ browser, base, clip, out, fonts, log }) {
  const { default: sharp } = await import('sharp');
  const { sample, samples, path, ...story } = STORIES[clip.key];
  const page = await browser.newPage({ viewport: CLIP.viewport, deviceScaleFactor: CLIP.scale, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(harnessInit, story.go);
  const work = await mkdtemp(join(tmpdir(), `zodiacs-story-${clip.name}-`));
  try {
    const response = await page.goto(new URL(clip.path, base).href, { waitUntil: 'load', timeout: 120_000 });
    if (!response || response.status() !== 200) throw new Error(`${clip.path} answered ${response?.status()}`);
    // The dev server's toolbar is not part of the page.
    await page.addStyleTag({ content: 'astro-dev-toolbar, vite-error-overlay { display: none !important; }' });
    await prepareFigure(page, story);
    const caption = captionFrom(await page.locator(story.caption).first().textContent(), story);
    const figure = await checkFigure(page, story);
    if (figure.problems.length) throw new Error(`the figure is not drawn as published: ${figure.problems.join('; ')}`);
    if (/\bborn\b/iu.test(figure.text)) throw new Error('the figure shows a birth');
    const box = await figureBox(page, story);
    const storyMs = Math.round(await startStory(page, story));
    const times = frameTimes(storyMs);
    // The clip's ground is the page's own surface round the figure, so the
    // figure sits on it without a seam.
    const ground = await edgeColour(await page.screenshot({ clip: box, type: 'png' }), Math.round((CLIP.pad * CLIP.scale) / 3));

    // The still frame round the figure.
    const stagePage = await browser.newPage({ viewport: { width: CLIP.width, height: CLIP.height }, deviceScaleFactor: 1 });
    await stagePage.setContent(stageHtml({ fonts }), { waitUntil: 'load' });
    const where = `zodiacs.org${clip.path}`;
    const place = await stagePage.evaluate((args) => window.layout(args), { ground, caption, where, aspect: box.width / box.height, maxWidth: CLIP.figureWidth });
    if (place.wordsTop < CLIP.safeTop || place.wordsBottom > CLIP.height - CLIP.safeBottom) throw new Error('the words leave the safe area');
    const stage = await stagePage.screenshot({ type: 'png' });
    await stagePage.close();
    // The figure's edges fade into the void over the kept page round it.
    const feather = Math.round((CLIP.pad * place.width) / box.width);
    const mask = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${place.width}" height="${place.height}"><rect x="${feather}" y="${feather}" width="${place.width - feather * 2}" height="${place.height - feather * 2}" rx="${feather}" fill="#fff"/></svg>`))
      .blur(Math.max(1, feather / 2.5)).png().toBuffer();

    const frames = join(work, 'frames');
    await mkdir(frames);
    const frameFile = (index) => join(frames, `f-${String(index).padStart(4, '0')}.png`);
    let last = null;
    let lastShot = null;
    for (let index = 0; index < times.length; index += 1) {
      if (last !== null && times[index] === times[index - 1]) {
        await copyFile(frameFile(index - 1), frameFile(index));
        continue;
      }
      await seek(page, times[index]);
      const shot = await page.screenshot({ clip: box, type: 'png' });
      const art = await sharp(shot).resize(place.width, place.height, { kernel: 'lanczos3' }).ensureAlpha()
        .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
      await sharp(stage).composite([{ input: art, left: place.x, top: place.y }]).png().toFile(frameFile(index));
      last = index;
      lastShot = shot;
    }
    // The last frame must be the finished picture, as the server drew it.
    await finishedPicture(page);
    await page.waitForTimeout(100);
    const finished = await page.screenshot({ clip: box, type: 'png' });
    const difference = await meanDifference(lastShot, finished);
    if (difference > 1.5) throw new Error(`the last frame is not the finished figure (mean difference ${difference.toFixed(2)})`);
    if (errors.length) throw new Error(`the page failed: ${errors.join('; ')}`);

    await mkdir(out, { recursive: true });
    const mp4 = join(out, `${clip.name}.mp4`);
    const jpg = join(out, `${clip.name}.jpg`);
    await sharp(frameFile(times.length - 1)).flatten({ background: ground }).jpeg({ quality: 88, mozjpeg: true }).toFile(jpg);
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-framerate', String(CLIP.fps), '-i', join(frames, 'f-%04d.png'),
      '-i', resolve(root, `public${CLIP.endCard}`),
      '-filter_complex', `[0:v]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1[a];[1:v]fps=${CLIP.fps},format=yuv420p,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]`,
      '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', ...COLOUR,
      '-r', String(CLIP.fps), '-movflags', '+faststart', '-an', '-map_metadata', '-1', mp4,
    ]);
    const bytes = (await stat(mp4)).size;
    if (bytes > CLIP.maxBytes) throw new Error(`${mp4} is ${bytes} bytes, over the ${CLIP.maxBytes} budget`);
    log(`${clip.name}: ${storyMs} ms story, ${clipSeconds()} s, ${(bytes / 1024).toFixed(0)} KB, "${caption}"`);
    return { name: clip.name, mp4, jpg, bytes, storyMs, caption, path: clip.path, lines: place.lines, ground };
  } finally {
    await page.close();
    if (process.env.STORY_CLIPS_KEEP_FRAMES) log(`${clip.name}: frames kept in ${work}`);
    else await rm(work, { recursive: true, force: true });
  }
}

export async function renderClips({ base = 'http://localhost:4321', out = join(tmpdir(), 'zodiacs-story-clips'), args = [], log = console.log } = {}) {
  const plan = planClips(args);
  await mkdir(out, { recursive: true });
  try {
    await fetch(base);
  } catch {
    throw new Error(`story clips: nothing answers at ${base}. Start the site first (npm run dev, or npm run build && npm run preview) and pass --base.`);
  }
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
  const executablePath = process.env.CHROMIUM_PATH
    ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const fonts = {
    serif: await fontUrl('public/fonts/eb-garamond-latin-500-normal.woff2'),
    mono: await fontUrl('public/fonts/jetbrains-mono-latin-wght-normal.woff2'),
  };
  const browser = await chromium.launch({ executablePath });
  const done = [];
  const failed = [];
  try {
    for (const clip of plan) {
      try {
        // A dev server that reloads the page mid-render (a watched file
        // changed) gets one more try; any other failure is a refusal.
        done.push(await renderClip({ browser, base, clip, out, fonts, log }).catch((error) => {
          if (!/context was destroyed|navigation/iu.test(error.message)) throw error;
          return renderClip({ browser, base, clip, out, fonts, log });
        }));
      } catch (error) {
        failed.push({ name: clip.name, error: error.message });
        log(`${clip.name}: refused, ${error.message}`);
      }
    }
  } finally {
    await browser.close();
  }
  await writeFile(join(out, 'clips.json'), `${JSON.stringify({ base, clips: done, failed }, null, 2)}\n`);
  return { out, done, failed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const take = (flag) => {
    const at = argv.indexOf(flag);
    if (at < 0) return undefined;
    const [, value] = argv.splice(at, 2);
    return value;
  };
  const base = take('--base');
  const out = take('--out');
  const { out: dir, done, failed } = await renderClips({ base, out: out && resolve(out), args: argv });
  console.log(`${done.length} story clips in ${dir}${failed.length ? `; ${failed.length} refused` : ''}.`);
  if (failed.length) process.exitCode = 1;
}
