/**
 * Motion evidence harness (ZOD-294).
 *
 * A before and after screenshot cannot show motion: both are taken at rest,
 * and at rest a correct motion change looks identical. This harness takes two
 * running builds of the site and, for each page in
 * `motion-evidence.routes.json`, at 390 x 844 and 1440 x 900, records:
 *
 * 1. the rest state (every entrance triggered by a scroll through the page,
 *    then a full-page screenshot) and, with two builds, the share of pixels
 *    that differ;
 * 2. a film strip of the first view: the page's finite animations (CSS
 *    transitions included) are paused and sought to fixed times, so each
 *    frame is exact and repeatable;
 * 3. a film strip after each step the route lists (a scroll, or a form fill
 *    and a click);
 * 4. numbers: the sum of layout shifts over load and one scroll-through, LCP,
 *    the largest above-the-fold block, paint and entrance timing under
 *    throttling, long frames, animated properties, whether every mark ends up
 *    shown (at rest, with reduced motion and with scripting off), and the
 *    reload, primary-action and step checks.
 *
 * Usage:
 *
 *   node tests/motion-evidence.mjs --before http://127.0.0.1:4391 \
 *     [--after http://127.0.0.1:4392] [--routes /numerology/,/compatibility/] \
 *     [--out tests/visual/artifacts/motion] [--check]
 *
 * `--before` alone is baseline mode: everything is measured, nothing is
 * compared. `--check` makes the process exit 1 when a hard check fails on the
 * "after" build (or on the only build), when a route answers with a status
 * outside 2xx on either build, or when the route list resolves to no routes.
 * A measurement that could not be taken is a failure, never a pass.
 *
 * The harness does not build the site or start servers. Build each worktree,
 * then run `npx astro preview --port N --host 127.0.0.1` in it and pass the
 * resulting URLs.
 *
 * The 4x CPU numbers are a proxy, not a phone: headless Chromium on a shared
 * machine with a slowed main thread, as tests/visual/README.md says of its
 * frame test.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';

/**
 * The entrance marker. PR #1096 marks elements with data-enter="rise|draw|disc"
 * and switches the page on with html[data-entrance="on"]. It was data-motion
 * until 79330a2e; data-motion belongs to other features and is never matched.
 */
export const MARK_ATTRIBUTE = 'data-enter';
/** The class an entrance gains when it is shown. */
export const SHOWN_CLASS = 'is-in';

export const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];
export const STRIP_TIMES = [0, 100, 200, 300, 440, 700, 1100, 1600, 2200];
export const ALLOWED_PROPERTIES = ['opacity', 'transform', 'stroke-dashoffset'];
export const DAILY_SELECTORS = ['.skyticker', '.tbs__stamp'];
export const PIXEL_THRESHOLD = 0.1;
/**
 * Rest state: at most this many differing pixels (pixelmatch, threshold 0.1,
 * which already leaves out pixels it classifies as antialiasing) on an
 * "identical" route, however long the page. The same build compared with
 * itself differed by 0 pixels in all 72 comparisons of three full runs on
 * 2026-11-22 (12 routes, 2 sizes): that is the noise floor, so nothing more
 * is tolerated. Hiding one icon at rest on /tools/ changed 81 and 91 pixels
 * (a 32 px line icon) and 13 pixels (the 19 px profile outline in the header).
 */
export const MAX_REST_PIXELS = 0;
export const LONG_FRAME_MS = 50;
export const LONG_FRAME_WINDOW_MS = 2500;
/**
 * Long frames on a slow runner. The reference is the same build, reloaded
 * with its marks removed and measured over the same window. The subject fails
 * when its longest frame exceeds max(50 ms, reference x 1.5 + one 60 Hz
 * frame): frame gaps come in steps of 16.7 ms, and the same page measured
 * twice on this runner differed by up to that ratio (see the PR).
 */
export const LONG_FRAME_RATIO = 1.5;
export const FRAME_MS = 1000 / 60;
/** After a reload, the scroll position must be within this many px of the one before it. */
export const RELOAD_SCROLL_TOLERANCE = 4;
/** Marks with their attribute renamed to this, for the reference load without marks. */
export const STRIPPED_ATTRIBUTE = 'data-evidence-stripped';
export const CLS_RETAKE_BELOW = 0.002;
export const PRIMARY_ACTION_MARGIN = 100;
export const SHEET_MAX_BYTES = 400 * 1024;
export const SETTLE_MAX_MS = 4000;
export const THROTTLE = {
  latency: 150,
  downloadThroughput: Math.round((1.6 * 1024 * 1024) / 8),
  uploadThroughput: Math.round((750 * 1024) / 8),
  cpuRate: 4,
};

/** Date.now() in every rest-state load, the same for both builds. */
const RUN_STARTED_AT = Date.now();

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
export const DEFAULT_OUT = 'tests/visual/artifacts/motion';
export const DEFAULT_ROUTES_FILE = resolve(here, 'motion-evidence.routes.json');

/* ------------------------------------------------------------------ */
/* Pure helpers (covered by tests/motion-evidence.test.mjs)            */
/* ------------------------------------------------------------------ */

export function parseArgs(argv) {
  const options = { before: null, after: null, routes: null, out: DEFAULT_OUT, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const value = () => {
      if (inline !== undefined) return inline;
      i += 1;
      if (i >= argv.length || argv[i].startsWith('--')) throw new Error(`${flag} needs a value`);
      return argv[i];
    };
    if (flag === '--before') options.before = value();
    else if (flag === '--after') options.after = value();
    else if (flag === '--routes') options.routes = value().split(',').map((p) => p.trim()).filter(Boolean);
    else if (flag === '--out') options.out = value();
    else if (flag === '--check') options.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.before) throw new Error('--before <url> is required');
  for (const key of ['before', 'after']) {
    if (options[key]) options[key] = options[key].replace(/\/+$/u, '');
  }
  return options;
}

export function normalizePath(path) {
  let p = path.startsWith('/') ? path : `/${path}`;
  if (!p.endsWith('/') && !/\.[a-z0-9]+$/iu.test(p)) p = `${p}/`;
  return p;
}

/** Routes from the file, narrowed to `--routes` when given. Unknown paths are added with rest "changed". */
export function selectRoutes(all, wanted) {
  if (!wanted) return all;
  return wanted.map((path) => {
    const p = normalizePath(path);
    return all.find((route) => route.path === p) ?? { path: p, rest: 'changed', unlisted: true };
  });
}

export function routeSlug(path) {
  const slug = path.replace(/^\/+|\/+$/gu, '').replace(/[^a-z0-9]+/giu, '-').toLowerCase();
  return slug || 'home';
}

export function viewportKey(viewport) {
  return `${viewport.width}x${viewport.height}`;
}

/** "h1#title.a.b" from {tag, id, classes}; at most two classes. */
export function shortSelector(descriptor) {
  if (!descriptor) return null;
  const tag = String(descriptor.tag ?? '').toLowerCase() || '*';
  const id = descriptor.id ? `#${descriptor.id}` : '';
  const classes = (descriptor.classes ?? []).filter(Boolean).slice(0, 2).map((c) => `.${c}`).join('');
  return `${tag}${id}${classes}`;
}

export function toKebab(property) {
  if (property.startsWith('--')) return property;
  return property.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`);
}

export function disallowedProperties(properties, allowed = ALLOWED_PROPERTIES) {
  return [...new Set(properties.map(toKebab))].filter((p) => !allowed.includes(p)).sort();
}

/**
 * Long requestAnimationFrame gaps in the window (start, start + durationMs].
 * A gap that ends inside the window counts in full; a gap that starts inside
 * the window and ends after it counts up to the window's end. When the frames
 * stop before the window ends, the time from the last frame to the window's
 * end (or to `observedUntil`, when the frames were read) is a gap too. No gap
 * in the window at all is "unmeasured", never a pass.
 */
export function longFrameStats(timestamps, start, durationMs = LONG_FRAME_WINDOW_MS, thresholdMs = LONG_FRAME_MS, observedUntil = null) {
  const end = start + durationMs;
  let count = 0;
  let longest = 0;
  let frames = 0;
  const consider = (gap) => {
    frames += 1;
    if (gap > thresholdMs) count += 1;
    if (gap > longest) longest = gap;
  };
  for (let i = 1; i < timestamps.length; i += 1) {
    const t = timestamps[i];
    const previous = timestamps[i - 1];
    if (t <= start) continue;
    if (previous >= end) break;
    consider(Math.min(t, end) - previous);
  }
  const last = timestamps[timestamps.length - 1];
  if (observedUntil != null && last != null && last < end && observedUntil > last && last >= start) {
    consider(Math.min(observedUntil, end) - last);
  }
  if (frames === 0) return { count: 0, longest: null, frames: 0, unmeasured: 'no frame was recorded in the window' };
  return { count, longest: Math.round(longest * 10) / 10, frames };
}

/** The longest frame allowed against a reference measured without marks. */
export function longFrameLimit(referenceLongest) {
  return Math.round(Math.max(LONG_FRAME_MS, referenceLongest * LONG_FRAME_RATIO + FRAME_MS) * 10) / 10;
}

/**
 * pass: the longest frame is within the absolute 50 ms bar.
 * note: over 50 ms, but the reference is over 50 ms too and the subject is
 *   within longFrameLimit(reference): the runner is too slow for the
 *   absolute bar and the marks did not make it materially worse.
 * fail: over 50 ms while the reference is within it, over the relative
 *   limit, or no reference was measured.
 */
export function longFrameVerdict(longest, referenceLongest) {
  if (longest <= LONG_FRAME_MS) return 'pass';
  if (referenceLongest == null) return 'fail';
  if (longest > longFrameLimit(referenceLongest)) return 'fail';
  return referenceLongest > LONG_FRAME_MS ? 'note' : 'fail';
}

/** Copy the top-left width x height area of an RGBA image. */
export function cropRGBA(image, width, height) {
  if (image.width === width && image.height === height) return image.data;
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    image.data.copy(out, y * width * 4, y * image.width * 4, y * image.width * 4 + width * 4);
  }
  return out;
}

/** Count the drawn pixels of a pixelmatch diff mask that fall outside every rect. */
export function countOutsideRects(mask, width, height, rects) {
  let outside = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[(y * width + x) * 4 + 3] === 0) continue;
      const inside = rects.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
      if (!inside) outside += 1;
    }
  }
  return outside;
}

/**
 * Compare two rest-state screenshots ({width, height, data} RGBA). A height
 * (or width) change is reported and the diff covers the common area.
 */
export function compareRest(a, b, { threshold = PIXEL_THRESHOLD, dailyRects = [] } = {}) {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const mask = Buffer.alloc(width * height * 4);
  const differing = pixelmatch(cropRGBA(a, width, height), cropRGBA(b, width, height), mask, width, height, {
    threshold, diffMask: true, diffColor: [255, 0, 0],
  });
  const outsideDaily = differing > 0 && dailyRects.length > 0
    ? countOutsideRects(mask, width, height, dailyRects)
    : differing;
  return {
    differing,
    outsideDaily,
    share: width * height > 0 ? differing / (width * height) : 0,
    width,
    height,
    heightChanged: a.height !== b.height ? { from: a.height, to: b.height } : null,
    widthChanged: a.width !== b.width ? { from: a.width, to: b.width } : null,
    dailyOnly: differing > 0 && dailyRects.length > 0 && outsideDaily === 0,
  };
}

/** Frame width for a sheet: start wide, shrink by 15 % while the sheet is too big. */
export function initialFrameWidth(viewport) {
  return viewport.width <= 600 ? 260 : 360;
}
export function nextFrameWidth(width) {
  return Math.max(40, Math.floor(width * 0.85));
}

export const SHEET_GAP = 8;
export const SHEET_ROW_LABEL = 28;
export const SHEET_TIME_LABEL = 24;

/** Geometry of a film-strip sheet: one row per build, frames left to right. */
export function sheetLayout({ viewport, frameWidth, frameCount, rowCount }) {
  const frameHeight = Math.round((viewport.height * frameWidth) / viewport.width);
  const rowHeight = SHEET_ROW_LABEL + frameHeight + SHEET_TIME_LABEL;
  const width = SHEET_GAP + frameCount * (frameWidth + SHEET_GAP);
  const height = SHEET_GAP + rowCount * (rowHeight + SHEET_GAP);
  const frame = (row, index) => ({
    left: SHEET_GAP + index * (frameWidth + SHEET_GAP),
    top: SHEET_GAP + row * (rowHeight + SHEET_GAP) + SHEET_ROW_LABEL,
  });
  return { width, height, frameWidth, frameHeight, rowHeight, frame };
}

const fmtMs = (v) => (v == null ? 'n/a' : `${Math.round(v)} ms`);
const fmtCount = (v) => (v == null ? 'n/a' : String(v));
const isOk = (status) => status >= 200 && status < 300;

function fmtLongFrames(n) {
  const lf = n.longFrames;
  if (!lf) return 'n/a';
  if (lf.notApplicable) return `not applicable: ${lf.notApplicable}`;
  if (lf.unmeasured) return `unmeasured: ${lf.unmeasured}`;
  const retake = n.longFramesRetake?.longest != null ? ` (retake ${n.longFramesRetake.longest} ms)` : '';
  const reference = n.longFramesReference?.longest != null ? `; without marks ${n.longFramesReference.longest} ms` : '';
  return `${lf.count}, longest ${lf.longest} ms${retake}${reference}`;
}

function fmtShown(s) {
  if (!s) return 'n/a';
  const unrendered = s.total - s.rendered;
  return `${s.rendered - s.notShown} of ${s.rendered} shown${unrendered ? ` (${unrendered} not rendered)` : ''}`;
}

/** One build's numbers for one viewport, as table cells. */
export function formatNumbers(n) {
  if (!n) return {};
  return {
    http: n.http ? (n.http.status != null ? String(n.http.status) : `error: ${n.http.error}`) : 'n/a',
    cls: n.cls == null ? 'n/a' : `${n.cls.toFixed(4)}${n.clsRetake != null ? ` (retake ${n.clsRetake.toFixed(4)})` : ''}`,
    lcp: n.lcp ? `${fmtMs(n.lcp.time)} \`${n.lcp.selector ?? '?'}\`` : 'n/a',
    lcpMarked: n.lcpMarked == null ? 'n/a' : String(n.lcpMarked),
    largest: n.largest ? `\`${n.largest.selector ?? '?'}\` (${n.largest.kind}, ${n.largest.area} px²)${n.largest.marked ? ', marked' : ''}` : 'n/a',
    firstPaint: fmtMs(n.throttled?.firstPaint),
    domContentLoaded: fmtMs(n.throttled?.domContentLoaded),
    firstMarkShown: n.throttled?.firstMarkShown == null
      ? (n.markedCount === 0 ? 'n/a (no marks)' : 'none')
      : `${fmtMs(n.throttled.firstMarkShown)} (+${Math.round(n.throttled.firstMarkShown - (n.throttled.firstPaint ?? 0))} after paint${n.throttled.scrolledToFirstMark ? ', after scrolling to it' : ''})`,
    longFrames: fmtLongFrames(n),
    animatedProperties: n.animatedProperties ? (n.animatedProperties.join(', ') || 'none') : 'n/a',
    markedCount: fmtCount(n.markedCount),
    nestedMarks: fmtCount(n.nestedMarks),
    rootMarked: n.rootMarked == null ? 'n/a' : String(n.rootMarked),
    shownAtRest: fmtShown(n.shownAtRest),
    hiddenAboveAfterReload: n.hiddenAboveAfterReload == null
      ? `unmeasured${n.reload?.reason ? `: ${n.reload.reason}` : ''}`
      : `${n.hiddenAboveAfterReload}${n.reload ? ` (scroll ${n.reload.before} to ${n.reload.after} px, ${n.reload.path})` : ''}`,
    primaryActionTop: n.primaryActionTop == null ? 'n/a' : `${n.primaryActionTop} px`,
    reducedMotion: n.reducedMotion ? `${n.reducedMotion.running} running, ${fmtShown(n.reducedMotion)}` : 'n/a',
    noScript: n.noScript ? fmtShown(n.noScript) : 'n/a',
    stripAnimations: n.strip ? `${n.strip.animations}${n.strip.lost ? ` (${n.strip.lost} lost)` : ''}` : 'n/a',
  };
}

export const NUMBER_ROWS = [
  ['http', 'HTTP status'],
  ['cls', 'Layout shift sum (load + one scroll-through)'],
  ['lcp', 'LCP entry at load'],
  ['lcpMarked', 'Any LCP entry on a marked element'],
  ['largest', 'Largest above-the-fold block (geometry)'],
  ['firstPaint', 'First paint (throttled)'],
  ['domContentLoaded', 'DOMContentLoaded (throttled)'],
  ['firstMarkShown', 'First mark shown (throttled)'],
  ['longFrames', 'Long frames > 50 ms (4x CPU)'],
  ['animatedProperties', 'Animated properties (marked)'],
  ['markedCount', 'Marked elements'],
  ['nestedMarks', 'Nested marks'],
  ['rootMarked', 'html has is-in'],
  ['shownAtRest', 'Marks shown at rest'],
  ['hiddenAboveAfterReload', 'Hidden above after reload'],
  ['primaryActionTop', 'Primary action top'],
  ['reducedMotion', 'Reduced motion'],
  ['noScript', 'No script'],
  ['stripAnimations', 'Animations in first-view strip'],
];

function shownDetail(s) {
  const base = fmtShown(s);
  return s.notShown ? `${base}; not shown: ${s.examples.join('; ')}` : base;
}

/**
 * Hard checks for one route and viewport, applied to `subject` (the "after"
 * build, or the only build). `baseline` is the "before" build or null.
 * The long-frame reference is `subject.longFramesReference`: the same build
 * reloaded with its marks removed and measured over the same window.
 * Status is pass, fail, note (reported, not failed) or n/a (not applicable).
 */
export function evaluateChecks({ route, viewport, subject, baseline = null, rest = null }) {
  const out = [];
  const add = (check, status, detail) => out.push({ check, status, detail });
  if (!subject) {
    add('measured', 'fail', 'no numbers were measured');
    return out;
  }
  // HTTP status of the route on each build: an error page is never measured as the page.
  const httpDetail = (n) => (n.http?.status != null
    ? `${n.http.url} returned HTTP ${n.http.status}`
    : `${n.http?.url ?? route.path} could not be fetched${n.http?.error ? ` (${n.http.error})` : ''}`);
  if (baseline && !(baseline.http && isOk(baseline.http.status))) add('http (before)', 'fail', httpDetail(baseline));
  if (!(subject.http && isOk(subject.http.status))) {
    add('http', 'fail', httpDetail(subject));
    return out;
  }
  add('http', 'pass', String(subject.http.status));
  // layout shift (the sum over load and one scroll-through, not field CLS)
  if (subject.cls == null) add('cls', 'fail', 'not measured');
  else if (subject.cls === 0) add('cls', 'pass', '0');
  else if (subject.cls < CLS_RETAKE_BELOW && subject.clsRetake === 0) add('cls', 'pass', `${subject.cls.toFixed(4)} on the first take, 0 on the retake`);
  else add('cls', 'fail', `${subject.cls.toFixed(4)}${subject.clsRetake != null ? `, retake ${subject.clsRetake.toFixed(4)}` : ''}`);
  // simple flags
  const flag = (check, value, ok, detail) => {
    if (value == null) add(check, 'fail', 'not measured');
    else add(check, ok ? 'pass' : 'fail', detail);
  };
  flag('lcpMarked', subject.lcpMarked, subject.lcpMarked === false, subject.lcpMarked
    ? `an LCP entry fell on a marked element (${subject.lcpMarkedSelector ?? '?'})`
    : `no LCP entry on a marked element (at load: ${subject.lcp?.selector ?? 'none'})`);
  const largest = subject.largest;
  flag('largestMarked', largest ? largest.marked : null, largest?.marked === false, largest
    ? `largest above-the-fold ${largest.kind} \`${largest.selector}\` (${largest.area} px²) ${largest.marked ? 'is or sits inside a marked element' : 'is not marked'}`
    : 'not measured');
  flag('rootMarked', subject.rootMarked, subject.rootMarked === false, `html ${subject.rootMarked ? 'has' : 'does not have'} ${SHOWN_CLASS}`);
  // Nested marks are reported, not failed: a disc inside a risen card shares the card's step
  // and reads as one entrance (docs/MOTION.md, the rule of 18 Nov).
  if (subject.hiddenAboveAfterReload == null) add('hiddenAboveAfterReload', 'fail', `unmeasured: ${subject.reload?.reason ?? 'not measured'}`);
  else if (subject.reload?.notApplicable) add('hiddenAboveAfterReload', 'n/a', `not applicable: no marks on the page after the reload (scroll ${subject.reload.before} to ${subject.reload.after} px)`);
  else {
    const how = subject.reload ? ` (scroll ${subject.reload.before} to ${subject.reload.after} px, ${subject.reload.path})` : '';
    add('hiddenAboveAfterReload', subject.hiddenAboveAfterReload === 0 ? 'pass' : 'fail', `${subject.hiddenAboveAfterReload}${how}`);
  }
  // every mark ends up shown
  const shown = (check, s, extra = '') => {
    if (!s) add(check, 'fail', 'not measured');
    else add(check, s.notShown === 0 && !extra ? 'pass' : 'fail', `${extra}${shownDetail(s)}`);
  };
  shown('marksShownAtRest', subject.shownAtRest);
  shown('reducedMotion', subject.reducedMotion, subject.reducedMotion?.running ? `${subject.reducedMotion.running} entrances running; ` : '');
  shown('noScript', subject.noScript);
  // animated properties: only the allowed ones, and every kind of mark actually sampled
  if (subject.animatedProperties == null) add('animatedProperties', 'fail', 'not measured');
  else {
    const bad = disallowedProperties(subject.animatedProperties);
    const unsampled = (subject.markedVerbs ?? []).filter((verb) => !(subject.sampledVerbs ?? []).includes(verb));
    if (bad.length) add('animatedProperties', 'fail', `not allowed: ${bad.join(', ')}`);
    else if (subject.markedVerbs == null) add('animatedProperties', 'fail', 'unmeasured: the kinds of mark on the page were not recorded');
    else if (unsampled.length) add('animatedProperties', 'fail', `unmeasured: no entrance was sampled for ${unsampled.join(', ')} (rendered marks of that kind exist)`);
    else add('animatedProperties', 'pass', subject.markedVerbs.length ? (subject.animatedProperties.join(', ') || 'none') : 'none (no rendered marks)');
  }
  // long frames
  const lf = subject.longFrames;
  if (!lf) add('longFrames', 'fail', 'not measured');
  else if (lf.notApplicable) add('longFrames', 'n/a', `not applicable: ${lf.notApplicable}`);
  else if (lf.unmeasured) add('longFrames', 'fail', `unmeasured: ${lf.unmeasured}`);
  else {
    const retake = subject.longFramesRetake?.longest;
    const longest = retake != null ? Math.min(lf.longest, retake) : lf.longest;
    const takes = `longest ${lf.longest} ms${retake != null ? `, retake ${retake} ms` : ''}`;
    const reference = subject.longFramesReference;
    const refLongest = reference?.longest ?? null;
    const verdict = longFrameVerdict(longest, refLongest);
    if (verdict === 'pass') add('longFrames', 'pass', takes);
    else if (refLongest == null) add('longFrames', 'fail', `${takes}, and no reference without marks was measured${reference?.unmeasured ? ` (${reference.unmeasured})` : ''}`);
    else {
      const limit = longFrameLimit(refLongest);
      const refText = `${refLongest} ms with marks removed (same build, same window)`;
      if (verdict === 'note') add('longFrames', 'note', `runner too slow for the absolute ${LONG_FRAME_MS} ms bar: ${takes}, ${refText}; within ${limit} ms, so not materially worse`);
      else if (longest > limit) add('longFrames', 'fail', `${takes}, over ${limit} ms (${LONG_FRAME_RATIO} x ${refText}, plus one frame)`);
      else add('longFrames', 'fail', `${takes}, over ${LONG_FRAME_MS} ms while ${refText}`);
    }
  }
  // scripted steps: a step that did not run is a failure on either build
  (subject.steps ?? []).forEach((step, i) => {
    if (step.skipped) add(`step ${i + 1}`, 'fail', `"${step.label}" did not run: ${step.skipped}`);
  });
  if (baseline) {
    (baseline.steps ?? []).forEach((step, i) => {
      if (step.skipped) add(`step ${i + 1} (before)`, 'fail', `"${step.label}" did not run on the before build: ${step.skipped}`);
    });
  }
  // rest state
  if (baseline && route.rest === 'identical') {
    if (!rest) add('rest', 'fail', 'rest state not compared');
    else if (rest.widthChanged) add('rest', 'fail', `width changed: ${rest.widthChanged.from} to ${rest.widthChanged.to} px`);
    else if (rest.heightChanged) add('rest', 'fail', `height changed: ${rest.heightChanged.from} to ${rest.heightChanged.to} px (${rest.differing} px of the common area differ)`);
    else if (rest.differing <= MAX_REST_PIXELS) add('rest', 'pass', `${rest.differing} px differ (limit ${MAX_REST_PIXELS})`);
    else if (rest.outsideDaily != null && rest.outsideDaily <= MAX_REST_PIXELS) add('rest', 'note', `daily data: ${rest.differing} px differ, ${rest.outsideDaily} outside ${DAILY_SELECTORS.join(' or ')} (limit ${MAX_REST_PIXELS})`);
    else add('rest', 'fail', `${rest.differing} px differ${rest.outsideDaily != null && rest.outsideDaily !== rest.differing ? `, ${rest.outsideDaily} outside the daily data` : ''} (limit ${MAX_REST_PIXELS})`);
  }
  // primary action
  if (route.primaryAction) {
    const limit = viewport.height - PRIMARY_ACTION_MARGIN;
    const after = subject.primaryActionTop;
    if (baseline) {
      const before = baseline.primaryActionTop;
      if (before == null && after == null) add('primaryAction', 'fail', `${route.primaryAction} not found on either build`);
      else if (before == null) add('primaryAction', 'fail', `unmeasured: ${route.primaryAction} not found on the before build (after: ${after} px)`);
      else if (after == null) add('primaryAction', 'fail', `${route.primaryAction} found on the before build at ${before} px, missing on the after build`);
      else if (before <= limit && after > limit) add('primaryAction', 'fail', `top moved from ${before} to ${after} px, below ${limit} px`);
      else add('primaryAction', 'pass', `top ${before} to ${after} px (limit ${limit} px)`);
    } else if (after == null) add('primaryAction', 'fail', `${route.primaryAction} not found`);
    else if (after > limit) add('primaryAction', 'note', `top ${after} px, below the ${limit} px line (nothing to compare with in baseline mode)`);
    else add('primaryAction', 'pass', `top ${after} px (limit ${limit} px)`);
  }
  return out;
}

/** The exit code of a run: 1 under --check when any hard check failed or nothing was measured. */
export function checkExitCode(report, { check = false } = {}) {
  if (!check) return 0;
  return report.failures.length > 0 || report.routes.length === 0 ? 1 : 0;
}

export function stepLabel(step) {
  const parts = [];
  if (step.scrollTo) parts.push(`scroll to ${step.scrollTo}`);
  if (step.fill) parts.push(`fill ${Object.keys(step.fill).join(', ')}`);
  if (step.click) parts.push(`click ${step.click}`);
  return parts.join(', then ') || 'step';
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/gu, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const PROXY_NOTE = 'The 4x CPU and throttled-network numbers are a proxy, not a phone: headless Chromium on a shared machine with a slowed main thread and an emulated slow connection. Compare them between builds measured on the same machine, not against real devices.';

const READING_NOTE = [
  'How to read the numbers.',
  'Layout shift sum: the sum of every layout shift during load and one scroll-through that starts at `load` (steps of 0.8 of the screen, 150 ms apart). It is not CLS as field tools define it (the worst five-second session window of a real visit); it is a stricter sum over a scripted visit. Measured with `Date` fixed to the run\'s start; on this Chrome a fixed clock left the layout-shift and LCP entries unchanged (same sources, same sizes).',
  'The scroll-through announces itself as the reader\'s own scroll (one synthetic `wheel` event first), so a runtime that plays entrances only for a reader\'s scroll plays them here too.',
  'LCP: Chrome reports no LCP entry for an element while it is at opacity 0 and reports a new one when it fades in, so the entry read at load can miss a hidden marked hero. "Any LCP entry on a marked element" therefore watches every entry until the end of the scroll-through, and "Largest above-the-fold block" measures the largest image or text block in the first screen by geometry, whatever its opacity; both must be unmarked.',
  'First mark shown: the first element with the mark attribute that gains is-in (the site-wide `.reveal` heading entrance also adds is-in and is not counted). When no mark shows within 5 s of load, the harness scrolls the first mark into view and says so.',
  `Long frames: requestAnimationFrame gaps over ${LONG_FRAME_MS} ms in the ${LONG_FRAME_WINDOW_MS / 1000} s after the first mark is shown, under 4x CPU. With no marks on the page the check is not applicable. Over ${LONG_FRAME_MS} ms, the same build is reloaded with its marks removed and measured over the same window; the check fails above max(${LONG_FRAME_MS} ms, ${LONG_FRAME_RATIO} x that reference + one 60 Hz frame), and is a note ("runner too slow for the absolute bar") only when the reference itself is over ${LONG_FRAME_MS} ms and the page is within that limit. One retake is allowed before a failure stands.`,
  'Marks shown: every rendered element with the mark attribute must end at opacity 1 with no transform left over (rise, disc), and every `.motion-stroke` in a draw must end at stroke-dashoffset 0; checked after the scroll-through, with reduced motion and with scripting off.',
  `Hidden above after reload: measured with the scroll restore made instant; the position after the reload must be within ${RELOAD_SCROLL_TOLERANCE} px of the one before it (native restore), otherwise the harness restores it itself (explicit restore) and says so, and if neither holds the check is unmeasured and fails.`,
  `Rest diff: full-page screenshots with every finite animation finished, infinite loops on their first frame, videos on their first frame and \`Date\` fixed to the run's start in both builds; at most ${MAX_REST_PIXELS} differing pixels (pixelmatch threshold ${PIXEL_THRESHOLD}) on a route marked identical, and any change of page width or height fails.`,
].join(' ');

function restCell(rest) {
  const width = rest.widthChanged ? `, width changed: ${rest.widthChanged.from} to ${rest.widthChanged.to} px` : '';
  const height = rest.heightChanged ? `, height changed: ${rest.heightChanged.from} to ${rest.heightChanged.to} px` : '';
  const daily = rest.differing > 0 && rest.outsideDaily != null && rest.outsideDaily !== rest.differing ? ` (${rest.outsideDaily} outside daily data)` : '';
  return `${rest.differing} px${daily}${width}${height}`;
}

/** summary.md: one table per route, before and after side by side. */
export function renderSummary(report) {
  const both = Boolean(report.after);
  const lines = [];
  lines.push('# Motion evidence');
  lines.push('');
  lines.push(`- Before: ${report.before}`);
  if (both) lines.push(`- After: ${report.after}`);
  else lines.push('- Mode: baseline (one build, nothing compared)');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Viewports: ${report.viewports.join(', ')}. Strip times: ${STRIP_TIMES.join(', ')} ms.`);
  lines.push(`- Checks applied to the ${both ? '"after"' : 'only'} build: ${report.failures.length === 0 ? 'all pass' : `${report.failures.length} failing`}.`);
  lines.push('');
  lines.push(PROXY_NOTE);
  lines.push('');
  lines.push(READING_NOTE);
  lines.push('');
  if (report.failures.length) {
    lines.push('## Failing checks');
    lines.push('');
    for (const f of report.failures) lines.push(`- ${f.path} ${f.viewport} ${f.check}: ${f.detail}`);
    lines.push('');
  }
  for (const route of report.routes) {
    lines.push(`## ${route.path} (rest: ${route.rest})`);
    lines.push('');
    const columns = [];
    for (const vp of report.viewports) {
      columns.push({ vp, build: 'before' });
      if (both) columns.push({ vp, build: 'after' });
    }
    lines.push(`| | ${columns.map((c) => `${c.build} ${c.vp}`).join(' | ')} |`);
    lines.push(`|---|${columns.map(() => '---').join('|')}|`);
    if (both) {
      lines.push(`| Rest diff | ${columns.map((c) => {
        if (c.build === 'before') return '';
        const rest = route.viewports[c.vp]?.rest;
        if (!rest) return 'n/a';
        return restCell(rest);
      }).join(' | ')} |`);
    }
    const cells = columns.map((c) => formatNumbers(route.viewports[c.vp]?.[c.build]));
    for (const [key, label] of NUMBER_ROWS) {
      lines.push(`| ${label} | ${cells.map((cell) => String(cell[key] ?? 'n/a').replace(/\|/gu, '\\|')).join(' | ')} |`);
    }
    lines.push('');
    const checkLines = [];
    for (const vp of report.viewports) {
      for (const c of route.viewports[vp]?.checks ?? []) {
        if (c.status !== 'pass') checkLines.push(`- ${vp} ${c.check}: ${c.status.toUpperCase()}, ${c.detail}`);
      }
    }
    lines.push(checkLines.length ? 'Checks not passing:' : 'Checks: all pass.');
    if (checkLines.length) lines.push('', ...checkLines);
    lines.push('');
    const loops = Object.entries(route.loops ?? {}).filter(([, list]) => list.length);
    if (loops.length) {
      lines.push(`Loops (never paused, sought or waited for): ${loops.map(([build, list]) => `${build}: ${list.join('; ')}`).join('. ')}.`);
      lines.push('');
    }
    const notes = [];
    for (const vp of report.viewports) {
      for (const build of ['before', 'after']) {
        for (const note of route.viewports[vp]?.[build]?.notes ?? []) notes.push(`- ${build} ${vp}: ${note}`);
      }
    }
    if (notes.length) lines.push('Notes:', '', ...notes, '');
    if (route.sheets.length) {
      lines.push(`Sheets: ${route.sheets.map((s) => `[${s.label}](${s.file})`).join(', ')}`);
      lines.push('');
    }
  }
  return `${lines.join('\n')}\n`;
}

/** report.html: the same tables, with the sheets inline by relative path. */
export function renderReport(report) {
  const both = Boolean(report.after);
  const parts = [];
  parts.push('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Motion evidence</title>');
  parts.push('<style>body{background:#0b0c10;color:#e8e6e1;font:14px/1.5 system-ui,sans-serif;margin:24px}table{border-collapse:collapse;margin:8px 0 16px}td,th{border:1px solid #333;padding:4px 8px;text-align:left;vertical-align:top}th{background:#16181d}code{color:#c9b98a}.fail{color:#ff7a7a}.note{color:#e6c66a}img{max-width:100%;display:block;margin:8px 0 24px;border:1px solid #333}h2{margin-top:40px}</style></head><body>');
  parts.push('<h1>Motion evidence</h1>');
  parts.push(`<p>Before: <code>${escapeHtml(report.before)}</code>${both ? `. After: <code>${escapeHtml(report.after)}</code>` : '. Baseline mode.'} Generated ${escapeHtml(report.generatedAt)}.</p>`);
  parts.push(`<p>${escapeHtml(PROXY_NOTE)}</p>`);
  parts.push(`<p>${report.failures.length === 0 ? 'All checks pass.' : `${report.failures.length} failing checks:`}</p>`);
  if (report.failures.length) {
    parts.push(`<ul>${report.failures.map((f) => `<li class="fail">${escapeHtml(`${f.path} ${f.viewport} ${f.check}: ${f.detail}`)}</li>`).join('')}</ul>`);
  }
  for (const route of report.routes) {
    parts.push(`<h2>${escapeHtml(route.path)} <small>(rest: ${escapeHtml(route.rest)})</small></h2>`);
    const columns = [];
    for (const vp of report.viewports) {
      columns.push({ vp, build: 'before' });
      if (both) columns.push({ vp, build: 'after' });
    }
    parts.push(`<table><tr><th></th>${columns.map((c) => `<th>${c.build} ${c.vp}</th>`).join('')}</tr>`);
    if (both) {
      parts.push(`<tr><td>Rest diff</td>${columns.map((c) => {
        if (c.build === 'before') return '<td></td>';
        const rest = route.viewports[c.vp]?.rest;
        if (!rest) return '<td>n/a</td>';
        return `<td>${escapeHtml(restCell(rest))}</td>`;
      }).join('')}</tr>`);
    }
    const cells = columns.map((c) => formatNumbers(route.viewports[c.vp]?.[c.build]));
    for (const [key, label] of NUMBER_ROWS) {
      parts.push(`<tr><td>${escapeHtml(label)}</td>${cells.map((cell) => `<td>${escapeHtml(cell[key] ?? 'n/a').replace(/`([^`]*)`/gu, '<code>$1</code>')}</td>`).join('')}</tr>`);
    }
    parts.push('</table>');
    const checks = report.viewports.flatMap((vp) => (route.viewports[vp]?.checks ?? []).filter((c) => c.status !== 'pass').map((c) => ({ ...c, vp })));
    if (checks.length) parts.push(`<ul>${checks.map((c) => `<li class="${c.status}">${escapeHtml(`${c.vp} ${c.check}: ${c.status.toUpperCase()}, ${c.detail}`)}</li>`).join('')}</ul>`);
    else parts.push('<p>Checks: all pass.</p>');
    const loops = Object.entries(route.loops ?? {}).filter(([, list]) => list.length);
    if (loops.length) parts.push(`<p>Loops: ${escapeHtml(loops.map(([build, list]) => `${build}: ${list.join('; ')}`).join('. '))}</p>`);
    for (const sheet of route.sheets) {
      parts.push(`<h3>${escapeHtml(sheet.label)}</h3><img loading="lazy" src="${escapeHtml(sheet.file)}" alt="${escapeHtml(`${route.path} ${sheet.label}`)}">`);
    }
  }
  parts.push('</body></html>');
  return parts.join('\n');
}

/* ------------------------------------------------------------------ */
/* Browser side                                                        */
/* ------------------------------------------------------------------ */

/** Runs in the page before any of its own scripts. Exported for the unit tests only. */
export function initScript(cfg) {
  const mark = `[${cfg.mark}]`;
  const describe = (el) => {
    if (!el || !el.tagName) return null;
    const cls = typeof el.className === 'string' ? el.className : el.className?.baseVal ?? '';
    return { tag: el.tagName, id: el.id || '', classes: cls.split(/\s+/u).filter(Boolean) };
  };
  const state = {
    cls: 0, shifts: 0, lcp: null, lcpMarked: false, lcpMarkedElement: null, firstPaint: null, firstContentfulPaint: null,
    firstMarkShown: null, frames: [], props: {}, verbs: {}, describe,
  };
  Object.defineProperty(window, '__motionEvidence', { value: state, enumerable: false });
  const observe = (type, fn) => {
    try { new PerformanceObserver((list) => fn(list.getEntries())).observe({ type, buffered: true }); } catch { /* unsupported */ }
  };
  observe('layout-shift', (entries) => {
    for (const e of entries) if (!e.hadRecentInput) { state.cls += e.value; state.shifts += 1; }
  });
  // Chrome reports no entry for an element at opacity 0 and a new one when it
  // fades in, so every entry is watched: any entry on a marked element counts.
  observe('largest-contentful-paint', (entries) => {
    for (const e of entries) {
      const marked = Boolean(e.element && e.element.closest && e.element.closest(mark));
      if (marked && !state.lcpMarked) {
        state.lcpMarked = true;
        state.lcpMarkedElement = describe(e.element);
      }
    }
    const e = entries[entries.length - 1];
    if (!e) return;
    state.lcp = { time: e.startTime, element: describe(e.element), marked: Boolean(e.element && e.element.closest && e.element.closest(mark)) };
  });
  observe('paint', (entries) => {
    for (const e of entries) {
      if (e.name === 'first-paint' && state.firstPaint == null) state.firstPaint = e.startTime;
      if (e.name === 'first-contentful-paint' && state.firstContentfulPaint == null) state.firstContentfulPaint = e.startTime;
    }
  });
  // Only an element with the mark attribute counts: the site-wide .reveal
  // heading entrance (src/layouts/Base.astro) adds the same class.
  new MutationObserver((records) => {
    if (state.firstMarkShown != null) return;
    for (const r of records) {
      const el = r.target;
      if (el === document.documentElement || !el.classList || !el.classList.contains(cfg.shown)) continue;
      if (!el.matches || !el.matches(mark)) continue;
      if (String(r.oldValue ?? '').split(/\s+/u).includes(cfg.shown)) continue;
      state.firstMarkShown = performance.now();
      break;
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  if (cfg.frames) {
    const tick = (t) => { if (state.frames.length < 50000) state.frames.push(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  const record = (target, names) => {
    const owner = target && target.closest ? target.closest(mark) : null;
    if (!owner) return;
    for (const n of names) state.props[n] = true;
    if (names.length) state.verbs[owner.getAttribute(cfg.mark)] = true;
  };
  addEventListener('transitionrun', (e) => record(e.target, [e.propertyName]), true);
  addEventListener('animationstart', (e) => {
    const names = [];
    for (const a of e.target.getAnimations ? e.target.getAnimations() : []) {
      if (a.animationName !== e.animationName) continue;
      for (const k of a.effect?.getKeyframes?.() ?? []) {
        for (const key of Object.keys(k)) if (!['offset', 'computedOffset', 'easing', 'composite'].includes(key)) names.push(key);
      }
    }
    record(e.target, names);
  }, true);
  if (cfg.stripMarks) {
    // The attribute is renamed, not dropped, so the reference load can
    // scroll to the same element the measured load scrolled to.
    const unmark = (el) => {
      el.setAttribute(cfg.stripped, el.getAttribute(cfg.mark));
      el.removeAttribute(cfg.mark);
    };
    const strip = (root) => {
      if (root.nodeType !== 1) return;
      if (root.hasAttribute(cfg.mark)) unmark(root);
      for (const el of root.querySelectorAll ? root.querySelectorAll(mark) : []) unmark(el);
    };
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') strip(r.target);
        for (const n of r.addedNodes ?? []) strip(n);
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: [cfg.mark] });
    addEventListener('DOMContentLoaded', () => strip(document.documentElement), true);
  }
}

/** In the page: sample the animations, record loops and marked properties. */
function sampleAnimations(cfg) {
  const s = window.__motionEvidence;
  const mark = `[${cfg.mark}]`;
  const loops = [];
  for (const a of document.getAnimations()) {
    const target = a.effect?.target;
    const iterations = a.effect?.getTiming?.().iterations;
    const name = a.animationName || a.transitionProperty || a.id || 'animation';
    if (iterations === Infinity) {
      const d = s?.describe(target);
      loops.push(`${name} on ${d ? `${d.tag.toLowerCase()}${d.classes.slice(0, 2).map((c) => `.${c}`).join('')}` : '?'}`);
      continue;
    }
    const owner = s && target && target.closest ? target.closest(mark) : null;
    if (!owner) continue;
    s.verbs[owner.getAttribute(cfg.mark)] = true;
    if (a.transitionProperty) s.props[a.transitionProperty] = true;
    for (const k of a.effect?.getKeyframes?.() ?? []) {
      for (const key of Object.keys(k)) if (!['offset', 'computedOffset', 'easing', 'composite'].includes(key)) s.props[key] = true;
    }
  }
  for (const video of document.querySelectorAll('video')) {
    if (video.paused || !video.loop) continue;
    const d = s?.describe(video);
    loops.push(`looping video on ${d ? `video${d.classes.slice(0, 2).map((c) => `.${c}`).join('')}` : 'video'}`);
  }
  return loops;
}

function twoFrames() {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

/** Load a page; a response outside 2xx throws, so an error page is never measured as the page. */
async function gotoPage(page, url, { timeout = 30000, notes } = {}) {
  let response;
  try {
    response = await page.goto(url, { waitUntil: 'load', timeout });
  } catch (error) {
    if (!/Timeout/iu.test(error.message)) throw error;
    await page.waitForLoadState('domcontentloaded', { timeout });
    await page.waitForTimeout(2000);
    notes?.push(`load did not fire within ${timeout / 1000} s; used domcontentloaded plus 2 s`);
    return;
  }
  if (!response) throw new Error(`${url} gave no response`);
  if (!response.ok()) throw new Error(`${url} returned HTTP ${response.status()}`);
}

/** The route's HTTP status on a build, redirects followed. */
async function probeStatus(url) {
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
    await response.arrayBuffer();
    return { url, status: response.status, ...(response.url !== url ? { finalUrl: response.url } : {}) };
  } catch (error) {
    return { url, status: null, error: String(error.cause?.code ?? error.message).split('\n')[0] };
  }
}

/**
 * Tell the page the reader is scrolling. The site's runtime plays entrances
 * only for the reader's own scroll (wheel, touch, key or pointer), and shows
 * everything at once for a scroll the browser made by itself; a scripted
 * scroll would otherwise never play an entrance below the first screen.
 * Synthetic events do not count as input for layout shift.
 */
function announceReaderScroll() {
  window.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 1 }));
}

async function reloadPage(page, { timeout = 30000, notes } = {}) {
  try {
    const response = await page.reload({ waitUntil: 'load', timeout });
    if (response && !response.ok()) throw new Error(`reload returned HTTP ${response.status()}`);
  } catch (error) {
    if (!/Timeout/iu.test(error.message)) throw error;
    await page.waitForLoadState('domcontentloaded', { timeout });
    await page.waitForTimeout(2000);
    notes?.push(`reload: load did not fire within ${timeout / 1000} s; used domcontentloaded plus 2 s`);
  }
}

/** Wait until no unfinished finite animation remains, at most maxMs. */
async function settle(page, maxMs = SETTLE_MAX_MS) {
  return page.evaluate(async (max) => {
    const start = performance.now();
    const pending = () => document.getAnimations().filter((a) => a.effect?.getTiming?.().iterations !== Infinity
      && (a.playState === 'running' || a.playState === 'paused'));
    while (pending().length && performance.now() - start < max) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return { waited: Math.round(performance.now() - start), remaining: pending().length };
  }, maxMs);
}

async function scrollThrough(page, cfg, loops) {
  await page.evaluate(announceReaderScroll);
  let y = 0;
  for (let guard = 0; guard < 400; guard += 1) {
    const { max, step } = await page.evaluate(() => ({
      max: document.documentElement.scrollHeight - innerHeight,
      step: Math.round(innerHeight * 0.8),
    }));
    if (y >= max) break;
    y = Math.min(y + step, max);
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(150);
    for (const l of await page.evaluate(sampleAnimations, cfg)) loops.add(l);
  }
}

/** Pause the finite animations, seek through STRIP_TIMES, screenshot each. */
async function filmStrip(page, cfg, loops) {
  await page.evaluate(twoFrames);
  const info = await page.evaluate(() => {
    const frozen = [];
    for (const a of document.getAnimations()) {
      const iterations = a.effect?.getTiming?.().iterations;
      if (iterations === Infinity) continue;
      if (a.playState === 'finished' || a.playState === 'idle') continue;
      a.pause();
      frozen.push(a);
    }
    Object.defineProperty(window, '__motionEvidenceFrozen', { value: frozen, configurable: true });
    return { count: frozen.length };
  });
  for (const l of await page.evaluate(sampleAnimations, cfg)) loops.add(l);
  const frames = [];
  let lost = 0;
  for (const t of STRIP_TIMES) {
    lost = await page.evaluate(async (time) => {
      const list = window.__motionEvidenceFrozen ?? [];
      for (const a of list) {
        try { a.currentTime = time; } catch { /* cancelled */ }
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      return list.filter((a) => a.playState === 'idle').length;
    }, t);
    frames.push(await page.screenshot({ type: 'png' }));
  }
  return { frames, animations: info.count, lost };
}

function contextOptions(viewport, extra = {}) {
  return {
    viewport,
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
    reducedMotion: 'no-preference',
    ...extra,
  };
}

async function withPage(browser, viewport, extra, init, fn) {
  const context = await browser.newContext(contextOptions(viewport, extra));
  try {
    const page = await context.newPage();
    if (init) await page.addInitScript(initScript, init);
    return await fn(page, context);
  } finally {
    await context.close();
  }
}

export const baseCfg = (extra = {}) => ({ mark: MARK_ATTRIBUTE, shown: SHOWN_CLASS, stripped: STRIPPED_ATTRIBUTE, frames: false, stripMarks: false, ...extra });

/**
 * In the page, at the top: the largest image or text block in the first
 * screen, by geometry and whatever its opacity, as LCP would rank it if
 * nothing were hidden. Chrome skips an element at opacity 0 when it picks the
 * LCP element, so a marked hero hidden at load can make the LCP entry point
 * elsewhere; this does not depend on that.
 */
function largestAboveFold({ mark }) {
  const vw = innerWidth;
  const vh = innerHeight;
  const clipped = (r) => Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  const visible = (el) => {
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && el.getClientRects().length > 0;
  };
  const candidates = [];
  for (const el of document.querySelectorAll('img, video, image')) {
    if (!visible(el)) continue;
    let area = clipped(el.getBoundingClientRect());
    const natural = el.naturalWidth && el.naturalHeight ? el.naturalWidth * el.naturalHeight : null;
    const shown = el.getBoundingClientRect();
    if (natural && shown.width * shown.height > natural) area *= natural / (shown.width * shown.height);
    if (area > 0) candidates.push({ el, kind: 'image', area });
  }
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('svg')) continue;
    const bg = getComputedStyle(el).backgroundImage;
    if (!bg || !bg.includes('url(') || !visible(el)) continue;
    const area = clipped(el.getBoundingClientRect());
    if (area > 0) candidates.push({ el, kind: 'background image', area });
  }
  // Text: each text node is credited to its nearest block-level ancestor.
  const blocks = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.data.trim()) continue;
    let block = node.parentElement;
    if (!block || block.closest('script, style, noscript, template, svg')) continue;
    if (!visible(block)) continue;
    while (block.parentElement && block !== document.body && ['inline', 'contents'].includes(getComputedStyle(block).display)) block = block.parentElement;
    const range = document.createRange();
    range.selectNodeContents(node);
    let area = 0;
    for (const r of range.getClientRects()) area += clipped(r);
    if (area > 0) blocks.set(block, (blocks.get(block) ?? 0) + area);
  }
  for (const [el, area] of blocks) candidates.push({ el, kind: 'text block', area });
  candidates.sort((a, b) => b.area - a.area);
  const top = candidates[0];
  if (!top) return null;
  const cls = typeof top.el.className === 'string' ? top.el.className : top.el.className?.baseVal ?? '';
  return {
    kind: top.kind,
    area: Math.round(top.area),
    descriptor: { tag: top.el.tagName, id: top.el.id || '', classes: cls.split(/\s+/u).filter(Boolean) },
    marked: Boolean(top.el.closest(mark)),
  };
}

/** Step 1 alone: load, scroll, settle, screenshot. Also cls, lcp and the static counts. */
async function measureRest(browser, url, route, viewport, loops, notes) {
  const cfg = baseCfg();
  return withPage(browser, viewport, {}, cfg, async (page, context) => {
    // Both builds see the same clock, so a live sky wheel (the home page's)
    // draws the same positions in each rest-state screenshot. Timers run.
    // A fixed clock left this Chrome's layout-shift and LCP entries unchanged.
    await context.clock.setFixedTime(RUN_STARTED_AT);
    await gotoPage(page, url, { notes });
    const atLoad = await page.evaluate(({ mark, primary }) => {
      const marked = [...document.querySelectorAll(`[${mark}]`)];
      const action = primary ? document.querySelector(primary) : null;
      return {
        markedCount: marked.length,
        nestedMarks: marked.filter((el) => !el.closest('svg') && el.parentElement && el.parentElement.closest(`[${mark}]`)).length,
        primaryActionTop: action ? Math.round(action.getBoundingClientRect().top + scrollY) : null,
      };
    }, { mark: MARK_ATTRIBUTE, primary: route.primaryAction ?? null });
    const largest = await page.evaluate(largestAboveFold, { mark: `[${MARK_ATTRIBUTE}]` });
    await page.evaluate(twoFrames);
    await page.evaluate(() => document.fonts?.ready);
    // `load` can fire before the first paint is reported; give LCP up to 5 s.
    await page.waitForFunction(() => window.__motionEvidence.lcp != null, null, { timeout: 5000 }).catch(() => {});
    const lcp = await page.evaluate(() => window.__motionEvidence.lcp);
    if (!lcp) notes.push('no largest-contentful-paint entry within 5 s of load');
    for (const l of await page.evaluate(sampleAnimations, cfg)) loops.add(l);
    await scrollThrough(page, cfg, loops);
    const settled = await settle(page);
    if (settled.remaining) notes.push(`rest: ${settled.remaining} finite animations still running after ${SETTLE_MAX_MS / 1000} s`);
    const shownAtRest = await page.evaluate(inspectMarks, { mark: MARK_ATTRIBUTE });
    const after = await page.evaluate((shown) => ({
      cls: window.__motionEvidence.cls,
      rootMarked: document.documentElement.classList.contains(shown),
      props: Object.keys(window.__motionEvidence.props),
      verbs: Object.keys(window.__motionEvidence.verbs),
      lcpMarked: window.__motionEvidence.lcpMarked,
      lcpMarkedElement: window.__motionEvidence.lcpMarkedElement,
    }), SHOWN_CLASS);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.evaluate(twoFrames);
    await page.waitForTimeout(200);
    const dailyRects = await page.evaluate((selectors) => [...document.querySelectorAll(selectors.join(','))].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.floor(r.left + scrollX), y: Math.floor(r.top + scrollY), width: Math.ceil(r.width) + 1, height: Math.ceil(r.height) + 1 };
    }), DAILY_SELECTORS);
    // Infinite loops restart from their first frame for this one capture, so
    // the rest state does not depend on when the shutter fell. Finite
    // animations have already finished by now. A playing video (the home
    // page's hero film) is held on its first frame for the same reason.
    await page.evaluate(() => Promise.all([...document.querySelectorAll('video')]
      .filter((video) => !video.paused || video.currentTime > 0)
      .map((video) => new Promise((done) => {
        video.pause();
        if (video.currentTime === 0) { done(); return; }
        const timer = setTimeout(done, 3000);
        video.addEventListener('seeked', () => { clearTimeout(timer); done(); }, { once: true });
        video.currentTime = 0;
      }))));
    await page.evaluate(twoFrames);
    const png = await page.screenshot({ fullPage: true, type: 'png', animations: 'disabled' });
    return {
      png, dailyRects, cls: after.cls, rootMarked: after.rootMarked, props: after.props, verbs: after.verbs, ...atLoad,
      markedVerbs: shownAtRest.renderedVerbs,
      shownAtRest,
      lcp: lcp ? { time: Math.round(lcp.time), selector: shortSelector(lcp.element) } : null,
      lcpMarked: after.lcpMarked,
      lcpMarkedSelector: after.lcpMarkedElement ? shortSelector(after.lcpMarkedElement) : null,
      largest: largest ? { kind: largest.kind, area: largest.area, selector: shortSelector(largest.descriptor), marked: largest.marked } : null,
    };
  });
}

async function measureFirstView(browser, url, viewport, loops, notes, props, verbs) {
  const cfg = baseCfg();
  return withPage(browser, viewport, {}, cfg, async (page) => {
    await gotoPage(page, url, { notes });
    const strip = await filmStrip(page, cfg, loops);
    const seen = await page.evaluate(() => ({ props: Object.keys(window.__motionEvidence.props), verbs: Object.keys(window.__motionEvidence.verbs) }));
    for (const p of seen.props) props.add(p);
    for (const v of seen.verbs) verbs.add(v);
    return strip;
  });
}

async function measureStep(browser, url, viewport, step, loops, notes, props, verbs) {
  const cfg = baseCfg();
  return withPage(browser, viewport, {}, cfg, async (page) => {
    await gotoPage(page, url, { notes });
    await settle(page);
    // Islands hydrate after `load`; a form filled before that keeps its
    // submit button disabled. Wait for the network to go quiet first.
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const selectors = [step.scrollTo, ...Object.keys(step.fill ?? {}), step.click].filter(Boolean);
    const skip = (reason) => {
      notes.push(`step "${stepLabel(step)}" did not run: ${reason}`);
      return { skipped: reason };
    };
    for (const selector of selectors) {
      if (await page.locator(selector).count() === 0) return skip(`${selector} not found`);
    }
    if (step.scrollTo) {
      await page.evaluate(announceReaderScroll);
      await page.locator(step.scrollTo).first().evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    }
    for (const [selector, value] of Object.entries(step.fill ?? {})) {
      try {
        await page.locator(selector).first().fill(value, { timeout: 5000 });
      } catch (error) {
        return skip(`${selector} could not be filled (${String(error.message).split('\n')[0]})`);
      }
    }
    if (step.click) {
      try {
        await page.locator(step.click).first().click({ timeout: 5000 });
      } catch (error) {
        return skip(`${step.click} could not be clicked (${String(error.message).split('\n')[0]})`);
      }
    }
    const strip = await filmStrip(page, cfg, loops);
    const seen = await page.evaluate(() => ({ props: Object.keys(window.__motionEvidence.props), verbs: Object.keys(window.__motionEvidence.verbs) }));
    for (const p of seen.props) props.add(p);
    for (const v of seen.verbs) verbs.add(v);
    return strip;
  });
}

/**
 * A throttled load: network and 4x CPU. Paint, entrance timing, long frames.
 * The long-frame window starts when the first marked element is shown. With no
 * marks the check is not applicable. With `stripMarks` the marks are renamed
 * before they can be shown and the window starts at `anchorAt` (the measured
 * load's first mark shown), scrolling where the measured load scrolled: the
 * same page over the same window, without marks.
 */
async function measureThrottled(browser, url, viewport, notes, { stripMarks = false, anchorAt = null, scrollAt = null } = {}) {
  const cfg = baseCfg({ frames: true, stripMarks });
  return withPage(browser, viewport, {}, cfg, async (page, context) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: THROTTLE.latency,
      downloadThroughput: THROTTLE.downloadThroughput,
      uploadThroughput: THROTTLE.uploadThroughput,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE.cpuRate });
    await gotoPage(page, url, { timeout: 120000, notes });
    const round = (v) => (v == null ? null : Math.round(v));
    const scrollToFirst = (attribute) => page.evaluate(({ attr }) => {
      window.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 1 }));
      const first = document.querySelector(`[${attr}]`);
      if (first) first.scrollIntoView({ block: 'center', behavior: 'instant' });
      return performance.now();
    }, { attr: attribute });
    let scrolledAt = null;
    if (stripMarks) {
      if (scrollAt != null) {
        await page.waitForFunction((t) => performance.now() >= t, scrollAt, { timeout: 30000, polling: 50 });
        scrolledAt = await scrollToFirst(STRIPPED_ATTRIBUTE);
      }
    } else {
      const marked = await page.evaluate((mark) => document.querySelectorAll(`[${mark}]`).length, MARK_ATTRIBUTE);
      if (marked === 0) {
        const state = await page.evaluate(() => {
          const nav = performance.getEntriesByType('navigation')[0];
          const s = window.__motionEvidence;
          return { firstPaint: s.firstPaint ?? s.firstContentfulPaint, domContentLoaded: nav ? nav.domContentLoadedEventStart : null };
        });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        return {
          throttled: { firstPaint: round(state.firstPaint), domContentLoaded: round(state.domContentLoaded), firstMarkShown: null },
          longFrames: { notApplicable: 'no marks' },
        };
      }
      // Give a late entrance up to 5 s to show; then bring the first mark into view.
      await page.waitForFunction(() => window.__motionEvidence.firstMarkShown != null, null, { timeout: 5000 }).catch(() => {});
      if (await page.evaluate(() => window.__motionEvidence.firstMarkShown == null)) {
        scrolledAt = await scrollToFirst(MARK_ATTRIBUTE);
        await page.waitForFunction(() => window.__motionEvidence.firstMarkShown != null, null, { timeout: 5000 }).catch(() => {});
      }
    }
    const state = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const s = window.__motionEvidence;
      return {
        firstPaint: s.firstPaint ?? s.firstContentfulPaint,
        domContentLoaded: nav ? nav.domContentLoadedEventStart : null,
        firstMarkShown: s.firstMarkShown,
      };
    });
    const throttled = {
      firstPaint: round(state.firstPaint),
      domContentLoaded: round(state.domContentLoaded),
      firstMarkShown: round(state.firstMarkShown),
      ...(scrolledAt != null ? { scrolledToFirstMark: true, scrolledAt: Math.round(scrolledAt) } : {}),
    };
    const anchor = stripMarks ? anchorAt : state.firstMarkShown;
    if (anchor == null) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      return { throttled, longFrames: { unmeasured: stripMarks ? 'no window to measure against' : 'marked elements exist but none was shown within 10 s, even after scrolling to the first' } };
    }
    await page.waitForFunction((end) => performance.now() > end, anchor + LONG_FRAME_WINDOW_MS + 100, { timeout: 30000, polling: 200 });
    const { frames, now } = await page.evaluate(() => ({ frames: window.__motionEvidence.frames.slice(), now: performance.now() }));
    const longFrames = longFrameStats(frames, anchor, LONG_FRAME_WINDOW_MS, LONG_FRAME_MS, now);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    return { throttled, longFrames };
  });
}

/**
 * The site sets `html { scroll-behavior: smooth }`. When Chrome restores the
 * scroll position at `load`, it then animates the restore from the top, so
 * every entrance on the way down is passed and shown, and the count is 0
 * whatever the page does. Safari and Firefox restore at once. For this one
 * measurement the restore is made instant, so the count shows what a reader
 * who returns to the bottom of the page finds above the screen.
 */
function instantScrollRestore() {
  const add = () => {
    const style = document.createElement('style');
    style.textContent = 'html { scroll-behavior: auto !important; }';
    document.documentElement.appendChild(style);
  };
  if (document.documentElement) add();
  else {
    new MutationObserver((_, observer) => {
      if (!document.documentElement) return;
      observer.disconnect();
      add();
    }).observe(document, { childList: true });
  }
}

/**
 * Marks hidden above the screen after a reload at the bottom of the page.
 * At scroll 0 nothing can be above, so the count means something only when
 * the position came back: natively (within RELOAD_SCROLL_TOLERANCE px), or,
 * failing that, by the harness scrolling there itself without reader input,
 * as a browser restore does. Otherwise the result is unmeasured.
 */
async function measureReload(browser, url, viewport, notes) {
  return withPage(browser, viewport, {}, baseCfg(), async (page) => {
    await page.addInitScript(instantScrollRestore);
    await gotoPage(page, url, { notes });
    const before = await page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
      return Math.round(scrollY);
    });
    await page.waitForTimeout(300);
    await reloadPage(page, { notes });
    await page.waitForTimeout(600);
    const count = () => page.evaluate(({ mark, shown }) => ({
      scrollY: Math.round(scrollY),
      marked: document.querySelectorAll(`[${mark}]`).length,
      hidden: [...document.querySelectorAll(`body [${mark}]:not(.${shown})`)].filter((el) => el.getBoundingClientRect().bottom < 0).length,
    }), { mark: MARK_ATTRIBUTE, shown: SHOWN_CLASS });
    let result = await count();
    const near = (y) => Math.abs(y - before) <= RELOAD_SCROLL_TOLERANCE;
    // With no marked element on the page nothing can be hidden, wherever the scroll is.
    if (result.marked === 0) return { hidden: 0, before, after: result.scrollY, path: 'no marks', notApplicable: true };
    if (before === 0) return { hidden: result.hidden, before, after: result.scrollY, path: 'page does not scroll' };
    if (near(result.scrollY)) return { hidden: result.hidden, before, after: result.scrollY, path: 'native restore' };
    // Fallback: scroll back without reader input, as a browser restore does,
    // retrying while the page is still growing to its full height (up to 5 s).
    const native = result.scrollY;
    const started = Date.now();
    do {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), before);
      await page.waitForTimeout(250);
      result = await count();
    } while (!near(result.scrollY) && Date.now() - started < 5000);
    if (near(result.scrollY)) {
      notes.push(`reload restored the scroll to ${native} px, not ${before} px; the harness scrolled back itself (explicit restore)`);
      return { hidden: result.hidden, before, after: result.scrollY, path: `explicit restore (native gave ${native} px)` };
    }
    return { hidden: null, before, after: result.scrollY, path: 'unmeasured', reason: `scroll was ${before} px before the reload, ${native} px after it and ${result.scrollY} px after scrolling back for 5 s (tolerance ${RELOAD_SCROLL_TOLERANCE} px)` };
  });
}

/**
 * In the page: is every rendered mark shown? rise and disc: computed opacity
 * 1 and no transform left over (an SVG element may keep its own transform
 * attribute); draw: opacity 1 and every .motion-stroke at stroke-dashoffset
 * 0. A mark with no box (display none, a closed details) is not rendered and
 * is counted apart. Also counts finite entrance animations still running.
 */
export function inspectMarks({ mark }) {
  const sel = `[${mark}]`;
  const marked = [...document.querySelectorAll(sel)];
  const running = document.getAnimations().filter((a) => a.effect?.getTiming?.().iterations !== Infinity
    && a.playState === 'running' && a.effect?.target?.closest?.(sel)).length;
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  const matrixOf = (t) => {
    if (!t || t === 'none') return [1, 0, 0, 1, 0, 0];
    const m = t.match(/^matrix(3d)?\((.*)\)$/u);
    if (!m) return null;
    const v = m[2].split(',').map(Number);
    if (!m[1]) return v;
    const flat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    if (![2, 3, 6, 7, 8, 9, 11, 14].every((i) => near(v[i], flat[i])) || !near(v[10], 1)) return null;
    return [v[0], v[1], v[4], v[5], v[12], v[13]];
  };
  const own = (el) => {
    const t = el.transform?.baseVal?.consolidate?.();
    return t ? [t.matrix.a, t.matrix.b, t.matrix.c, t.matrix.d, t.matrix.e, t.matrix.f] : [1, 0, 0, 1, 0, 0];
  };
  const name = (el) => {
    const cls = typeof el.className === 'string' ? el.className : el.className?.baseVal ?? '';
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls.split(/\s+/u).filter(Boolean).slice(0, 2).map((c) => `.${c}`).join('')}`;
  };
  let rendered = 0;
  const examples = [];
  const renderedVerbs = new Set();
  let notShown = 0;
  for (const el of marked) {
    if (el.getClientRects().length === 0) continue;
    rendered += 1;
    const verb = el.getAttribute(mark);
    renderedVerbs.add(verb);
    const cs = getComputedStyle(el);
    const why = [];
    if (!near(Number(cs.opacity), 1)) why.push(`opacity ${cs.opacity}`);
    if (verb === 'draw') {
      for (const stroke of el.querySelectorAll('.motion-stroke')) {
        const offset = parseFloat(getComputedStyle(stroke).strokeDashoffset);
        if (!near(Number.isFinite(offset) ? offset : 0, 0)) {
          why.push(`stroke-dashoffset ${getComputedStyle(stroke).strokeDashoffset} on ${name(stroke)}`);
          break;
        }
      }
    } else {
      const m = matrixOf(cs.transform);
      const expected = own(el);
      if (!m || !m.every((x, i) => near(x, expected[i]))) why.push(`transform ${cs.transform}`);
    }
    if (why.length) {
      notShown += 1;
      if (examples.length < 5) examples.push(`${name(el)} (${verb}): ${why.join(', ')}`);
    }
  }
  return { total: marked.length, rendered, notShown, examples, running, renderedVerbs: [...renderedVerbs].sort() };
}

async function measureReducedMotion(browser, url, viewport, notes) {
  return withPage(browser, viewport, { reducedMotion: 'reduce' }, baseCfg(), async (page) => {
    await gotoPage(page, url, { notes });
    await page.evaluate(twoFrames);
    const first = await page.evaluate(inspectMarks, { mark: MARK_ATTRIBUTE });
    let running = first.running;
    let worst = first;
    // Scroll through too, so an entrance that ignores the preference is caught when it would start.
    await page.evaluate(announceReaderScroll);
    let y = 0;
    for (let guard = 0; guard < 400; guard += 1) {
      const { max, step } = await page.evaluate(() => ({ max: document.documentElement.scrollHeight - innerHeight, step: Math.round(innerHeight * 0.8) }));
      if (y >= max) break;
      y = Math.min(y + step, max);
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
      await page.waitForTimeout(150);
      const now = await page.evaluate(inspectMarks, { mark: MARK_ATTRIBUTE });
      running = Math.max(running, now.running);
      if (now.notShown > worst.notShown) worst = now;
    }
    return { ...worst, running };
  });
}

async function measureNoScript(browser, url, viewport, notes) {
  return withPage(browser, viewport, { javaScriptEnabled: false }, null, async (page) => {
    await gotoPage(page, url, { notes });
    return page.evaluate(inspectMarks, { mark: MARK_ATTRIBUTE });
  });
}

async function safely(notes, label, fn) {
  try {
    return await fn();
  } catch (error) {
    notes.push(`${label} failed: ${String(error.message).split('\n')[0]}`);
    return null;
  }
}

/** Everything for one build, one route, one viewport. */
async function measureBuild(browser, baseURL, route, viewport) {
  const url = `${baseURL}${route.path}`;
  const notes = [];
  const loops = new Set();
  const props = new Set();
  const verbs = new Set();
  const http = await probeStatus(url);
  if (!(http.status >= 200 && http.status < 300)) {
    notes.push(http.status != null ? `${url} returned HTTP ${http.status}; nothing else was measured` : `${url} could not be fetched (${http.error}); nothing else was measured`);
    return {
      numbers: { http, steps: (route.steps ?? []).map((step) => ({ label: stepLabel(step), skipped: 'the page did not load' })), notes },
      loops: [], rest: null, firstView: null, steps: (route.steps ?? []).map(() => null),
    };
  }
  const rest = await safely(notes, 'rest state', () => measureRest(browser, url, route, viewport, loops, notes));
  if (rest) {
    for (const p of rest.props) props.add(p);
    for (const v of rest.verbs) verbs.add(v);
  }
  const firstView = await safely(notes, 'first-view strip', () => measureFirstView(browser, url, viewport, loops, notes, props, verbs));
  const steps = [];
  for (const step of route.steps ?? []) {
    steps.push(await safely(notes, `step "${stepLabel(step)}"`, () => measureStep(browser, url, viewport, step, loops, notes, props, verbs)) ?? { skipped: 'the step threw (see notes)' });
  }
  const throttled = await safely(notes, 'throttled load', () => measureThrottled(browser, url, viewport, notes));
  const reload = await safely(notes, 'reload', () => measureReload(browser, url, viewport, notes));
  const reducedMotion = await safely(notes, 'reduced motion', () => measureReducedMotion(browser, url, viewport, notes));
  const noScript = await safely(notes, 'no script', () => measureNoScript(browser, url, viewport, notes));
  const numbers = {
    http,
    cls: rest ? Math.round(rest.cls * 1e6) / 1e6 : null,
    lcp: rest?.lcp ?? null,
    lcpMarked: rest ? rest.lcpMarked : null,
    lcpMarkedSelector: rest?.lcpMarkedSelector ?? null,
    largest: rest?.largest ?? null,
    throttled: throttled?.throttled ?? null,
    longFrames: throttled?.longFrames ?? null,
    // Not measured unless both the rest pass and the first-view strip ran.
    animatedProperties: rest && firstView ? [...new Set([...props].map(toKebab))].sort() : null,
    markedVerbs: rest?.markedVerbs ?? null,
    sampledVerbs: [...verbs].sort(),
    markedCount: rest?.markedCount ?? null,
    nestedMarks: rest?.nestedMarks ?? null,
    rootMarked: rest?.rootMarked ?? null,
    shownAtRest: rest?.shownAtRest ? stripVerbs(rest.shownAtRest) : null,
    hiddenAboveAfterReload: reload ? reload.hidden : null,
    reload: reload ? { before: reload.before, after: reload.after, path: reload.path, ...(reload.reason ? { reason: reload.reason } : {}), ...(reload.notApplicable ? { notApplicable: true } : {}) } : null,
    primaryActionTop: rest?.primaryActionTop ?? null,
    reducedMotion: reducedMotion ? stripVerbs(reducedMotion) : null,
    noScript: noScript ? stripVerbs(noScript) : null,
    strip: firstView ? { animations: firstView.animations, lost: firstView.lost } : null,
    steps: (route.steps ?? []).map((step, i) => ({
      label: stepLabel(step),
      ...(steps[i]?.skipped ? { skipped: steps[i].skipped } : { animations: steps[i]?.animations ?? 0, lost: steps[i]?.lost ?? 0 }),
    })),
    notes,
  };
  return {
    numbers,
    loops: [...loops].sort(),
    rest: rest ? { png: rest.png, dailyRects: rest.dailyRects } : null,
    firstView: firstView?.frames ?? null,
    steps: steps.map((s) => s?.frames ?? null),
  };
}

function stripVerbs({ renderedVerbs, ...rest }) {
  return rest;
}

async function retakeCls(browser, baseURL, route, viewport) {
  const notes = [];
  const rest = await safely(notes, 'cls retake', () => measureRest(browser, `${baseURL}${route.path}`, route, viewport, new Set(), notes));
  return rest ? Math.round(rest.cls * 1e6) / 1e6 : null;
}

/* ------------------------------------------------------------------ */
/* Sheets                                                              */
/* ------------------------------------------------------------------ */

function sheetSvg(layout, rows, frameCount) {
  const text = [];
  rows.forEach((row, r) => {
    const top = SHEET_GAP + r * (layout.rowHeight + SHEET_GAP);
    text.push(`<text x="${SHEET_GAP}" y="${top + 19}" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" font-weight="bold" fill="#f0ead8">${escapeHtml(row.label)}</text>`);
    for (let i = 0; i < frameCount; i += 1) {
      const { left, top: frameTop } = layout.frame(r, i);
      const y = frameTop + layout.frameHeight + 17;
      text.push(`<text x="${left + layout.frameWidth / 2}" y="${y}" text-anchor="middle" font-family="DejaVu Sans Mono, monospace" font-size="14" fill="#e8e6e1">${STRIP_TIMES[i]} ms</text>`);
      if (!row.frames) {
        text.push(`<text x="${left + layout.frameWidth / 2}" y="${frameTop + layout.frameHeight / 2}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="13" fill="#999">${escapeHtml(row.missing ?? 'not captured')}</text>`);
      }
    }
  });
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}">${text.join('')}</svg>`);
}

/** Join frames into rows (before above after), times printed under each, WebP at most maxBytes. */
export async function buildSheet({ rows, viewport, maxBytes = SHEET_MAX_BYTES }) {
  const frameCount = STRIP_TIMES.length;
  let frameWidth = initialFrameWidth(viewport);
  for (;;) {
    const layout = sheetLayout({ viewport, frameWidth, frameCount, rowCount: rows.length });
    const composites = [];
    for (let r = 0; r < rows.length; r += 1) {
      for (let i = 0; i < frameCount; i += 1) {
        const { left, top } = layout.frame(r, i);
        const source = rows[r].frames?.[i];
        const input = source
          ? await sharp(source).resize(layout.frameWidth, layout.frameHeight, { fit: 'fill' }).png().toBuffer()
          : await sharp({ create: { width: layout.frameWidth, height: layout.frameHeight, channels: 3, background: '#1b1d22' } }).png().toBuffer();
        composites.push({ input, left, top });
      }
    }
    composites.push({ input: sheetSvg(layout, rows, frameCount), left: 0, top: 0 });
    const buffer = await sharp({ create: { width: layout.width, height: layout.height, channels: 3, background: '#0b0c10' } })
      .composite(composites)
      .webp({ quality: 80, effort: 5 })
      .toBuffer();
    if (buffer.length <= maxBytes || frameWidth <= 40) return { buffer, frameWidth };
    frameWidth = nextFrameWidth(frameWidth);
  }
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

export async function run(options) {
  const routesFile = JSON.parse(await readFile(DEFAULT_ROUTES_FILE, 'utf8'));
  const routes = selectRoutes(routesFile, options.routes);
  const out = resolve(repoRoot, options.out);
  await mkdir(out, { recursive: true });
  const builds = options.after ? ['before', 'after'] : ['before'];
  const urls = { before: options.before, after: options.after };
  const subjectBuild = options.after ? 'after' : 'before';

  const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  const report = {
    generatedAt: new Date().toISOString(),
    before: options.before,
    after: options.after ?? null,
    markAttribute: MARK_ATTRIBUTE,
    viewports: VIEWPORTS.map(viewportKey),
    stripTimes: STRIP_TIMES,
    throttle: THROTTLE,
    routes: [],
    failures: [],
  };
  if (routes.length === 0) {
    report.failures.push({ path: '(none)', viewport: '-', check: 'routes', detail: options.routes ? 'the route list resolved to no routes: --routes named no path' : 'the routes file lists no routes' });
  }
  try {
    for (const route of routes) {
      const entry = { path: route.path, rest: route.rest, primaryAction: route.primaryAction ?? null, loops: {}, sheets: [], viewports: {} };
      if (route.unlisted) entry.unlisted = true;
      const loops = Object.fromEntries(builds.map((b) => [b, new Set()]));
      for (const viewport of VIEWPORTS) {
        const key = viewportKey(viewport);
        console.log(`${route.path} ${key}`);
        const measured = {};
        for (const build of builds) {
          const started = Date.now();
          measured[build] = await measureBuild(browser, urls[build], route, viewport);
          for (const l of measured[build].loops) loops[build].add(l);
          console.log(`  ${build}: ${((Date.now() - started) / 1000).toFixed(1)} s`);
        }
        const vpEntry = Object.fromEntries(builds.map((b) => [b, measured[b].numbers]));
        // Rest state comparison.
        if (options.after && measured.before.rest && measured.after.rest) {
          const a = PNG.sync.read(measured.before.rest.png);
          const b = PNG.sync.read(measured.after.rest.png);
          const rest = compareRest(a, b, { dailyRects: [...measured.before.rest.dailyRects, ...measured.after.rest.dailyRects] });
          vpEntry.rest = {
            share: rest.share, differing: rest.differing, outsideDaily: rest.outsideDaily, heightChanged: rest.heightChanged, widthChanged: rest.widthChanged,
            dailyOnly: rest.dailyOnly, comparedArea: `${rest.width}x${rest.height}`,
          };
        }
        const subject = vpEntry[subjectBuild];
        const baseline = options.after ? vpEntry.before : null;
        // One retake for a micro layout shift.
        if (subject.cls != null && subject.cls > 0 && subject.cls < CLS_RETAKE_BELOW) {
          subject.clsRetake = await retakeCls(browser, urls[subjectBuild], route, viewport);
        }
        // Long frames over the absolute bar: measure the same build with its
        // marks removed over the same window (in either mode), then allow one
        // retake of the subject before a failure stands.
        if (subject.longFrames?.longest != null && subject.longFrames.longest > LONG_FRAME_MS) {
          const notes = [];
          const subjectURL = `${urls[subjectBuild]}${route.path}`;
          const reference = await safely(notes, 'long-frame reference without marks', () => measureThrottled(browser, subjectURL, viewport, notes, {
            stripMarks: true, anchorAt: subject.throttled.firstMarkShown, scrollAt: subject.throttled.scrolledAt ?? null,
          }));
          subject.longFramesReference = reference?.longFrames ?? { unmeasured: 'the reference load failed' };
          if (longFrameVerdict(subject.longFrames.longest, subject.longFramesReference.longest ?? null) === 'fail') {
            const retake = await safely(notes, 'long-frame retake', () => measureThrottled(browser, subjectURL, viewport, notes));
            subject.longFramesRetake = retake?.longFrames ?? { unmeasured: 'the retake failed' };
          }
          subject.notes.push(...notes);
        }
        vpEntry.checks = evaluateChecks({ route, viewport, subject, baseline, rest: vpEntry.rest ?? null });
        for (const c of vpEntry.checks) {
          if (c.status === 'fail') report.failures.push({ path: route.path, viewport: key, check: c.check, detail: c.detail });
        }
        entry.viewports[key] = vpEntry;
        // Sheets.
        const slug = routeSlug(route.path);
        const strips = [{ id: 'first-view', label: `${key} first view`, frames: (b) => measured[b].firstView }];
        (route.steps ?? []).forEach((step, i) => {
          strips.push({ id: `step-${i + 1}`, label: `${key} after step ${i + 1}: ${stepLabel(step)}`, frames: (b) => measured[b].steps[i], step: i });
        });
        for (const strip of strips) {
          const rows = builds.map((b) => {
            const skipped = strip.step != null ? vpEntry[b].steps[strip.step]?.skipped : null;
            return { label: `${b}  ${urls[b]}${route.path}`, frames: strip.frames(b), missing: skipped ? `skipped: ${skipped}` : 'not captured' };
          });
          const file = `${slug}-${key}-${strip.id}.webp`;
          const { buffer, frameWidth } = await buildSheet({ rows, viewport });
          await writeFile(resolve(out, file), buffer);
          entry.sheets.push({ label: strip.label, file, bytes: buffer.length, frameWidth });
        }
      }
      entry.loops = Object.fromEntries(builds.map((b) => [b, [...loops[b]].sort()]));
      report.routes.push(entry);
      await writeOutputs(out, report);
    }
  } finally {
    await browser.close();
  }
  await writeOutputs(out, report);
  return report;
}

async function writeOutputs(out, report) {
  await writeFile(resolve(out, 'numbers.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(resolve(out, 'summary.md'), renderSummary(report));
  await writeFile(resolve(out, 'report.html'), renderReport(report));
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const report = await run(options);
  const out = resolve(repoRoot, options.out);
  console.log(`\nWrote ${out}/summary.md, report.html, numbers.json and ${report.routes.reduce((n, r) => n + r.sheets.length, 0)} sheets.`);
  if (report.failures.length) {
    console.log(`${report.failures.length} hard checks fail:`);
    for (const f of report.failures) console.log(`  ${f.path} ${f.viewport} ${f.check}: ${f.detail}`);
  } else {
    console.log('All hard checks pass.');
  }
  process.exit(checkExitCode(report, options));
}
