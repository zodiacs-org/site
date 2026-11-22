/**
 * Motion evidence harness (ZOD-294).
 *
 * A before and after screenshot cannot show motion: both are taken at rest,
 * and at rest a correct motion change looks identical. This harness takes two
 * running builds of the site and, for each page in
 * `motion-evidence.routes.json`, at 390 x 844 (driven by touch) and
 * 1440 x 900 (driven by the wheel), records:
 *
 * 1. the rest state (the page settled, one scroll-through, every entrance
 *    finished, then a full-page screenshot) and, with two builds, the pixels
 *    that differ;
 * 2. a film strip of the first view: the page's finite animations (CSS
 *    transitions included) are paused and sought to fixed times, so each
 *    frame is exact and repeatable;
 * 3. a film strip after each step the route lists (a scroll, or a form fill
 *    and a click);
 * 4. numbers: layout shift (a hard number taken after the page settles, and a
 *    report-only number taken from `load`), LCP, the largest above-the-fold
 *    block, paint and entrance timing under throttling, long frames (report
 *    only), animated properties, mark counts, whether every mark is rendered
 *    and shown (at rest, with reduced motion and with scripting off), and the
 *    reload, primary-action and step checks.
 *
 * Usage:
 *
 *   node tests/motion-evidence.mjs --before http://127.0.0.1:4391 \
 *     [--after http://127.0.0.1:4392] [--routes /numerology/,/compatibility/] \
 *     [--marks-removed /tools/] [--frame-loads 5] \
 *     [--out tests/visual/artifacts/motion] [--check]
 *
 * `--before` alone is single-build mode: everything is measured, and the
 * hard checks that need no second build apply. `--check` makes the process
 * exit 1 when a hard check fails on the "after" build (or on the only build),
 * when a route answers with a status outside 2xx on either build, or when the
 * route list resolves to no routes. A measurement that could not be taken is
 * a failure, never a pass. Long frames and the layout shift taken from `load`
 * are printed for a person to read and never fail the run.
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
/** Viewports this narrow are a phone: touch is enabled and every scroll-through is a touch gesture. */
export const TOUCH_MAX_WIDTH = 600;
export const STRIP_TIMES = [0, 100, 200, 300, 440, 700, 1100, 1600, 2200];
export const ALLOWED_PROPERTIES = ['opacity', 'transform', 'stroke-dashoffset'];
export const DAILY_SELECTORS = ['.skyticker', '.tbs__stamp'];
export const PIXEL_THRESHOLD = 0.1;
/**
 * Rest state: at most this many differing pixels (pixelmatch, threshold 0.1,
 * which already leaves out pixels it classifies as antialiasing) on an
 * "identical" route, however long the page. Hiding one icon at rest on
 * /tools/ changed 81 and 91 pixels (a 32 px line icon) and 13 pixels (the
 * 19 px profile outline in the header), so nothing is tolerated. A capture
 * that differs is retaken (see restVerdict).
 */
export const MAX_REST_PIXELS = 0;
/** Long frames are reported, never judged: the share of loads over this is printed. */
export const LONG_FRAME_MS = 50;
export const LONG_FRAME_WINDOW_MS = 2500;
/** Throttled loads per build, route and size for the long-frame report. */
export const FRAME_LOADS = 5;
/**
 * "Quiet": no request in flight and none finished, no DOM mutation and no
 * layout-shift entry for this long, after `load` and with the fonts ready.
 */
export const QUIET_MS = 500;
export const QUIET_CAP_MS = 10000;
/** Layout shift, settled then scroll: takes per build, and how closely they must agree. */
export const SETTLED_TAKES = 3;
export const SHIFT_AGREEMENT = 0.002;
/** Two builds: the after build may exceed the before build by at most this. */
export const SHIFT_MARGIN = 0.002;
/** One build: the tool's own bar, not a web standard (field CLS "good" is 0.1 over a whole visit). */
export const SHIFT_SINGLE_BAR = 0.02;
/** Layout shift, scroll from load: report-only takes per build. */
export const FROM_LOAD_TAKES = 5;
export const STEP_FRACTION = 0.8;
/** The scroll from load steps every 150 ms, as the harness always has. */
export const FAST_STEP_MS = 150;
/**
 * The settled scroll dwells at each step for at least 400 ms and then until
 * the page has been still (no mutation, no shift) for 300 ms, at most 2 s,
 * so a block that moves a few hundred ms after it comes into view moves
 * while it is still on screen.
 */
export const SETTLED_STEP_MIN_MS = 400;
export const SETTLED_STEP_QUIET_MS = 300;
export const SETTLED_STEP_CAP_MS = 2000;
/** A touch drag scrolls this much less than the finger moves (the slop before a scroll starts). */
export const TOUCH_SLOP = 24;
/** Rest images saved on a failure or an unstable capture: margin around the change, size cap. */
export const REST_IMAGE_MARGIN = 32;
export const REST_IMAGE_MAX_BYTES = 400 * 1024;
/** After a reload, the scroll position must be within this many px of the one before it. */
export const RELOAD_SCROLL_TOLERANCE = 4;
export const PRIMARY_ACTION_MARGIN = 100;
export const SHEET_MAX_BYTES = 400 * 1024;
export const SETTLE_MAX_MS = 4000;
/** A browser context still busy after this long is closed, and what it was measuring is unmeasured (a failure, never a pass). */
export const CONTEXT_WATCHDOG_MS = 300000;
export const THROTTLE = {
  latency: 150,
  downloadThroughput: Math.round((1.6 * 1024 * 1024) / 8),
  uploadThroughput: Math.round((750 * 1024) / 8),
  cpuRate: 4,
};

/** Date.now() in every rest-state and layout-shift load, the same for both builds. */
const RUN_STARTED_AT = Date.now();

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
export const DEFAULT_OUT = 'tests/visual/artifacts/motion';
export const DEFAULT_ROUTES_FILE = resolve(here, 'motion-evidence.routes.json');

/* ------------------------------------------------------------------ */
/* Pure helpers (covered by tests/motion-evidence.test.mjs)            */
/* ------------------------------------------------------------------ */

export function parseArgs(argv) {
  const options = { before: null, after: null, routes: null, out: DEFAULT_OUT, check: false, marksRemoved: [], frameLoads: FRAME_LOADS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const value = () => {
      if (inline !== undefined) return inline;
      i += 1;
      if (i >= argv.length || argv[i].startsWith('--')) throw new Error(`${flag} needs a value`);
      return argv[i];
    };
    const list = (v) => v.split(',').map((p) => p.trim()).filter(Boolean);
    if (flag === '--before') options.before = value();
    else if (flag === '--after') options.after = value();
    else if (flag === '--routes') options.routes = list(value());
    else if (flag === '--marks-removed') options.marksRemoved = list(value()).map(normalizePath);
    else if (flag === '--frame-loads') {
      const n = Number(value());
      if (!Number.isInteger(n) || n < 1) throw new Error('--frame-loads needs a whole number of 1 or more');
      options.frameLoads = n;
    } else if (flag === '--out') options.out = value();
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

/** touch for a phone-sized viewport, wheel otherwise. */
export function inputFor(viewport) {
  return viewport.width <= TOUCH_MAX_WIDTH ? 'touch' : 'wheel';
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

export function median(values) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * Long requestAnimationFrame gaps in the window (start, start + durationMs].
 * A gap that ends inside the window counts in full; a gap that starts inside
 * the window and ends after it counts up to the window's end. When the frames
 * stop before the window ends, the time from the last frame to the window's
 * end (or to `observedUntil`, when the frames were read) is a gap too. No gap
 * in the window at all is "unmeasured".
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

/**
 * The long-frame report for one build: the longest frame of each load's
 * entrance window, their median and maximum, and how many loads had a frame
 * over 50 ms. Never a verdict.
 */
export function summarizeLongFrames(takes) {
  if (!takes || !takes.length) return null;
  const applicable = takes.filter((t) => t && !t.notApplicable);
  if (!applicable.length) return { loads: takes.length, notApplicable: takes.find((t) => t?.notApplicable)?.notApplicable ?? 'no marks' };
  const measured = applicable.filter((t) => t.longest != null);
  const longest = measured.map((t) => t.longest);
  return {
    loads: takes.length,
    measured: measured.length,
    unmeasured: applicable.length - measured.length,
    median: longest.length ? Math.round(median(longest) * 10) / 10 : null,
    max: longest.length ? Math.max(...longest) : null,
    over: longest.filter((v) => v > LONG_FRAME_MS).length,
    longest,
    anchoredOn: [...new Set(measured.map((t) => t.anchoredOn).filter(Boolean))],
  };
}

/**
 * Layout shift, settled then scroll, for one build: SETTLED_TAKES takes that
 * must each be measured and agree within SHIFT_AGREEMENT. The value is the
 * largest take. Anything else is unmeasured, with the reason.
 */
export function settledShift(takes) {
  const list = takes ?? [];
  if (list.length < SETTLED_TAKES) return { value: null, unmeasured: `${list.length} of ${SETTLED_TAKES} takes were taken` };
  const missing = list.find((t) => t == null || t.value == null);
  if (missing) return { value: null, unmeasured: missing?.unmeasured ?? 'a take was not measured' };
  const values = list.map((t) => t.value);
  const spread = Math.max(...values) - Math.min(...values);
  if (spread > SHIFT_AGREEMENT + 1e-9) {
    return { value: null, unmeasured: `the ${list.length} takes disagree by more than ${SHIFT_AGREEMENT}: ${values.map((v) => v.toFixed(4)).join(', ')}` };
  }
  return { value: Math.max(...values), values };
}

/**
 * The hard layout-shift check. Two builds: fail when the after build exceeds
 * the before build by more than SHIFT_MARGIN. One build: fail above
 * SHIFT_SINGLE_BAR. Unmeasured on either build fails.
 */
export function settledShiftVerdict(subjectTakes, baselineTakes = null) {
  const after = settledShift(subjectTakes);
  const fmt = (s) => `${s.value.toFixed(4)} (takes ${s.values.map((v) => v.toFixed(4)).join(', ')})`;
  if (after.value == null) return { status: 'fail', detail: `unmeasured: ${after.unmeasured}` };
  if (baselineTakes) {
    const before = settledShift(baselineTakes);
    if (before.value == null) return { status: 'fail', detail: `unmeasured on the before build: ${before.unmeasured}; after ${fmt(after)}` };
    const delta = after.value - before.value;
    const detail = `before ${fmt(before)}, after ${fmt(after)}`;
    if (delta > SHIFT_MARGIN + 1e-9) return { status: 'fail', detail: `${detail}: the after build exceeds the before build by ${delta.toFixed(4)}, more than ${SHIFT_MARGIN}` };
    return { status: 'pass', detail };
  }
  if (after.value > SHIFT_SINGLE_BAR + 1e-9) return { status: 'fail', detail: `${fmt(after)}, above ${SHIFT_SINGLE_BAR} (the tool's own bar for a single build)` };
  return { status: 'pass', detail: `${fmt(after)} (bar ${SHIFT_SINGLE_BAR}, the tool's own)` };
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

/** The box around the drawn pixels of a diff mask, or null. */
export function maskBounds(mask, width, height) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -1; let y1 = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[(y * width + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/**
 * Compare two rest-state screenshots ({width, height, data} RGBA). A height
 * (or width) change is reported and the diff covers the common area.
 */
export function compareRest(a, b, { threshold = PIXEL_THRESHOLD, dailyRects = [], keepMask = false } = {}) {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const mask = Buffer.alloc(width * height * 4);
  const differing = pixelmatch(cropRGBA(a, width, height), cropRGBA(b, width, height), mask, width, height, {
    threshold, diffMask: true, diffColor: [255, 0, 255],
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
    ...(keepMask ? { mask } : {}),
  };
}

/** One rest comparison: "same" (0 px), "daily" (every differing pixel inside the daily data) or "differs". */
export function restTakeKind(take) {
  if (!take) return 'differs';
  if (take.widthChanged || take.heightChanged) return 'differs';
  if (take.differing <= MAX_REST_PIXELS) return 'same';
  if (take.outsideDaily != null && take.outsideDaily <= MAX_REST_PIXELS) return 'daily';
  return 'differs';
}

/**
 * Whether the rest comparison needs another pair of captures. A first pair
 * that differs is retaken once; when the retake is the same, a third pair
 * decides whether the difference recurs.
 */
export function restNeedsRetake(takes) {
  const kinds = takes.map(restTakeKind);
  if (kinds.length === 1) return kinds[0] === 'differs';
  if (kinds.length === 2) return kinds[0] === 'differs' && kinds[1] !== 'differs';
  return false;
}

/**
 * The rest verdict over the takes. pass: the first pair is the same. fail:
 * the first two pairs both differ, or a difference that went away on the
 * retake came back on the third pair, or a needed retake is missing.
 * unstable: it appeared once in three pairs (reported and listed, not a
 * failure). note: only the daily data differs.
 */
export function restVerdict(takes) {
  const fmt = (t) => {
    if (!t) return 'not taken';
    const size = t.widthChanged ? `width ${t.widthChanged.from} to ${t.widthChanged.to} px` : t.heightChanged ? `height ${t.heightChanged.from} to ${t.heightChanged.to} px` : null;
    return `${t.differing} px${size ? ` and ${size}` : ''}`;
  };
  const counts = takes.map((t, i) => `take ${i + 1}: ${fmt(t)}`).join(', ');
  if (!takes.length || !takes[0]) return { status: 'fail', detail: 'rest state not compared' };
  const kinds = takes.map(restTakeKind);
  if (kinds[0] === 'same') return { status: 'pass', detail: `0 px differ (limit ${MAX_REST_PIXELS})` };
  if (kinds[0] === 'daily') {
    return { status: 'note', detail: `daily data: ${takes[0].differing} px differ, ${takes[0].outsideDaily} outside ${DAILY_SELECTORS.join(' or ')} (limit ${MAX_REST_PIXELS})` };
  }
  if (kinds.length < 2) return { status: 'fail', detail: `${counts}; the retake was not taken` };
  if (kinds[1] === 'differs') return { status: 'fail', detail: `differs on both pairs (${counts}; limit ${MAX_REST_PIXELS})` };
  if (kinds.length < 3) return { status: 'fail', detail: `${counts}; the third pair was not taken` };
  if (kinds[2] === 'differs') return { status: 'fail', detail: `differs again on the third pair (${counts}; limit ${MAX_REST_PIXELS})` };
  return { status: 'unstable', detail: `unstable capture: differed once in three pairs (${counts})` };
}

/**
 * Mark counts per route and size. Two builds: any change is listed; going
 * from more than zero to zero fails unless the route is in --marks-removed.
 * One build: fewer than the route's minMarks fails.
 */
export function markCountCheck({ route, subjectCount, baselineCount = null, twoBuilds = false, marksRemoved = [] }) {
  if (twoBuilds) {
    if (subjectCount == null || baselineCount == null) return { status: 'fail', detail: `not measured (before ${baselineCount ?? 'n/a'}, after ${subjectCount ?? 'n/a'})` };
    const detail = `before ${baselineCount}, after ${subjectCount}`;
    if (baselineCount > 0 && subjectCount === 0) {
      if (marksRemoved.includes(route.path)) return { status: 'pass', detail: `${detail} (all marks removed, as --marks-removed says)` };
      return { status: 'fail', detail: `${detail}: every mark is gone; pass --marks-removed ${route.path} if that is intended` };
    }
    return { status: 'pass', detail };
  }
  if (route.minMarks == null) return subjectCount == null ? null : { status: 'pass', detail: `${subjectCount} (no minimum listed)` };
  if (subjectCount == null) return { status: 'fail', detail: `not measured (minMarks ${route.minMarks})` };
  if (subjectCount < route.minMarks) return { status: 'fail', detail: `${subjectCount} marks, fewer than the ${route.minMarks} that motion-evidence.routes.json lists for this route` };
  return { status: 'pass', detail: `${subjectCount} (minMarks ${route.minMarks})` };
}

export const MODES = [
  ['rest', 'at rest'],
  ['reducedMotion', 'under reduced motion'],
  ['noScript', 'with scripting off'],
];

/**
 * Whether each mark is rendered in the same modes. Every mark (by its path in
 * the DOM) that is rendered in one mode and not in another is a problem,
 * naming the element and the mode. A mark not rendered in any mode is
 * legitimately absent. A mark missing from one mode's DOM is not rendered there.
 */
export function compareRendered(modes) {
  const keys = new Map();
  for (const [mode] of MODES) {
    for (const m of modes[mode]?.marks ?? []) if (!keys.has(m.key)) keys.set(m.key, m.name);
  }
  const problems = [];
  let absentInAll = 0;
  for (const [key, name] of keys) {
    const states = MODES.map(([mode, label]) => {
      const m = (modes[mode]?.marks ?? []).find((x) => x.key === key);
      return { mode, label, rendered: Boolean(m?.rendered), why: m ? m.absent : 'not in the DOM' };
    });
    const renderedIn = states.filter((s) => s.rendered);
    if (!renderedIn.length) { absentInAll += 1; continue; }
    for (const s of states) {
      if (!s.rendered) problems.push({ key, name, mode: s.mode, detail: `${name} is not rendered ${s.label} (${s.why}) but is rendered ${renderedIn.map((r) => r.label).join(' and ')}` });
    }
  }
  const counts = Object.fromEntries(MODES.map(([mode]) => [mode, modes[mode] ? (modes[mode].marks ?? []).filter((m) => m.rendered).length : null]));
  const dom = Object.fromEntries(MODES.map(([mode]) => [mode, modes[mode] ? modes[mode].total : null]));
  return { problems, counts, dom, absentInAll, union: keys.size };
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
const fmtShift = (v) => (v == null ? 'n/a' : v === 0 ? '0' : v.toFixed(4));
const isOk = (status) => status >= 200 && status < 300;

function fmtLongFrames(lf) {
  if (!lf) return 'n/a';
  if (lf.notApplicable) return `not applicable: ${lf.notApplicable}`;
  if (lf.median == null) return `unmeasured in all ${lf.loads} loads`;
  const anchor = lf.anchoredOn?.length ? `; window from the first mark shown after ${lf.anchoredOn.join(' or ')}` : '';
  const unmeasured = lf.unmeasured ? `; ${lf.unmeasured} unmeasured` : '';
  return `median ${lf.median} ms, max ${lf.max} ms; ${lf.over} of ${lf.measured} loads over ${LONG_FRAME_MS} ms (${lf.longest.join(', ')})${anchor}${unmeasured}`;
}

function fmtShown(s) {
  if (!s) return 'n/a';
  const unrendered = s.total - s.rendered;
  return `${s.rendered - s.notShown} of ${s.rendered} shown${unrendered ? ` (${unrendered} not rendered)` : ''}`;
}

function fmtSettled(takes) {
  if (!takes) return 'n/a';
  const s = settledShift(takes);
  const each = takes.map((t) => (t?.value == null ? 'unmeasured' : t.value.toFixed(4))).join(', ');
  if (s.value == null) return `unmeasured (${each}): ${s.unmeasured}`;
  return `${fmtShift(s.value)} (takes ${each})`;
}

/** One build's numbers for one viewport, as table cells. */
export function formatNumbers(n) {
  if (!n) return {};
  return {
    http: n.http ? (n.http.status != null ? String(n.http.status) : `error: ${n.http.error}`) : 'n/a',
    shiftSettled: fmtSettled(n.shiftSettled),
    shiftFromLoad: n.shiftFromLoad ? n.shiftFromLoad.map((t) => (t?.value == null ? 'unmeasured' : fmtShift(t.value))).join(', ') : 'n/a',
    lcp: n.lcp ? `${fmtMs(n.lcp.time)} \`${n.lcp.selector ?? '?'}\`` : 'n/a',
    lcpMarked: n.lcpMarked == null ? 'n/a' : String(n.lcpMarked),
    largest: n.largest ? `\`${n.largest.selector ?? '?'}\` (${n.largest.kind}, ${n.largest.area} px²)${n.largest.marked ? ', marked' : ''}` : 'n/a',
    firstPaint: fmtMs(n.throttled?.firstPaint),
    domContentLoaded: fmtMs(n.throttled?.domContentLoaded),
    firstMarkShown: n.throttled?.firstMarkShown == null
      ? (n.markedCount === 0 ? 'n/a (no marks)' : 'none')
      : `${fmtMs(n.throttled.firstMarkShown)} (+${Math.round(n.throttled.firstMarkShown - (n.throttled.firstPaint ?? 0))} after paint${n.throttled.scrolledToFirstMark ? ', after scrolling to it' : ''})`,
    longFrames: fmtLongFrames(n.longFrames),
    entrancesPlayed: n.entrancesPlayed == null ? 'n/a' : `${n.entrancesPlayed} (${n.input}${n.input === 'touch' ? `, ${n.touches ?? 0} touchstart events` : ''})`,
    animatedProperties: n.animatedProperties ? (n.animatedProperties.join(', ') || 'none') : 'n/a',
    markedCount: fmtCount(n.markedCount),
    nestedMarks: fmtCount(n.nestedMarks),
    rootMarked: n.rootMarked == null ? 'n/a' : String(n.rootMarked),
    shownAtRest: fmtShown(n.shownAtRest),
    marksRendered: n.shownAtRest || n.reducedMotion || n.noScript
      ? `${MODES.map(([mode]) => { const m = n[mode === 'rest' ? 'shownAtRest' : mode]; return m?.marks ? m.marks.filter((x) => x.rendered).length : 'n/a'; }).join(' / ')} of ${n.shownAtRest?.total ?? 'n/a'} in the DOM`
      : 'n/a',
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
  ['shiftSettled', 'Layout shift, settled then scroll (hard)'],
  ['shiftFromLoad', 'Layout shift, scroll from load (report only, each take)'],
  ['lcp', 'LCP entry at load'],
  ['lcpMarked', 'Any LCP entry on a marked element'],
  ['largest', 'Largest above-the-fold block (geometry)'],
  ['firstPaint', 'First paint (throttled)'],
  ['domContentLoaded', 'DOMContentLoaded (throttled)'],
  ['firstMarkShown', 'First mark shown (throttled)'],
  ['longFrames', 'Longest frame in the entrance window, 4x CPU (report only)'],
  ['entrancesPlayed', 'Entrances played during the scroll-through'],
  ['animatedProperties', 'Animated properties (marked)'],
  ['markedCount', 'Marked elements'],
  ['nestedMarks', 'Nested marks'],
  ['rootMarked', 'html has is-in'],
  ['shownAtRest', 'Marks shown at rest'],
  ['marksRendered', 'Marks rendered (rest / reduced motion / no script)'],
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
 * `rest` is { takes } from the rest comparison. Status is pass, fail, note
 * (reported, not failed), unstable (a rest capture that differed once in
 * three pairs, listed, not failed) or n/a (not applicable). Long frames and
 * the layout shift from load are never checks.
 */
export function evaluateChecks({ route, viewport, subject, baseline = null, rest = null, marksRemoved = [] }) {
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
  // layout shift, settled then scroll
  const shift = settledShiftVerdict(subject.shiftSettled, baseline ? (baseline.shiftSettled ?? []) : null);
  add('layoutShift', shift.status, shift.detail);
  // mark counts
  const marks = markCountCheck({ route, subjectCount: subject.markedCount ?? null, baselineCount: baseline?.markedCount ?? null, twoBuilds: Boolean(baseline), marksRemoved });
  if (marks) add('marks', marks.status, marks.detail);
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
  // every rendered mark ends up shown
  const shown = (check, s, extra = '') => {
    if (!s) add(check, 'fail', 'not measured');
    else add(check, s.notShown === 0 && !extra ? 'pass' : 'fail', `${extra}${shownDetail(s)}`);
  };
  shown('marksShownAtRest', subject.shownAtRest);
  shown('reducedMotion', subject.reducedMotion, subject.reducedMotion?.running ? `${subject.reducedMotion.running} entrances running; ` : '');
  shown('noScript', subject.noScript);
  // the same marks rendered in all three modes
  const modes = { rest: subject.shownAtRest, reducedMotion: subject.reducedMotion, noScript: subject.noScript };
  const missing = MODES.filter(([mode]) => !modes[mode]?.marks).map(([, label]) => label);
  if (missing.length) add('marksRendered', 'fail', `not measured ${missing.join(', ')}`);
  else {
    const r = compareRendered(modes);
    const counts = `${r.counts.rest} / ${r.counts.reducedMotion} / ${r.counts.noScript} rendered (rest / reduced motion / no script) of ${r.union} in the DOM, ${r.absentInAll} absent in all three`;
    if (r.problems.length) add('marksRendered', 'fail', `${r.problems.slice(0, 5).map((p) => p.detail).join('; ')}${r.problems.length > 5 ? `; and ${r.problems.length - 5} more` : ''} (${counts})`);
    else add('marksRendered', 'pass', counts);
  }
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
    const v = restVerdict(rest?.takes ?? []);
    add('rest', v.status, v.detail);
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
    else if (after > limit) add('primaryAction', 'note', `top ${after} px, below the ${limit} px line (nothing to compare with in single-build mode)`);
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

export const LONG_FRAME_NOTE = `Long frames are for a person to read: the tool does not fail on them. On this kind of runner the longest frame of the same page differs by 2x or more from one load to the next (frames arrive in 16.7 ms steps, and a page measured 14 times at 1440 x 900 was over ${LONG_FRAME_MS} ms in 8), so any threshold would fail clean pages and pass real regressions at random. Each build is loaded the same way several times; compare the medians and the maxima side by side.`;

export const FROM_LOAD_NOTE = 'Layout shift, scroll from load, is report only: it never fails the run. It starts the scroll-through at `load`, so it catches pages whose own late styles or hydration move content under an early scroller; that is timing dependent by nature, and a wide spread between takes, or a value that is sometimes 0, means exactly that.';

const READING_NOTE = [
  'How to read the numbers.',
  `A page that keeps the browser busy for more than ${CONTEXT_WATCHDOG_MS / 1000} s in one measurement is stopped, and that measurement is unmeasured (and failed) with a note.`,
  `Quiet: after \`load\`, with the fonts ready, no request in flight or finished, no DOM mutation and no layout-shift entry for ${QUIET_MS} ms (at most ${QUIET_CAP_MS / 1000} s; a page that never goes quiet leaves the measurements that need it unmeasured, and failed).`,
  `Input: at ${VIEWPORTS.filter((v) => inputFor(v) === 'touch').map(viewportKey).join(', ')} the context has touch enabled and every scroll-through is a real touch drag sent through the DevTools protocol (the runtime's touchstart path); at ${VIEWPORTS.filter((v) => inputFor(v) === 'wheel').map(viewportKey).join(', ')} it announces itself with one synthetic \`wheel\` event and scrolls by script. Steps are ${STEP_FRACTION} of the screen. "Entrances played" counts the marks whose entrance started during the scroll-through. On a touch viewport Chrome stops reporting LCP entries at the first touch, as on a phone, so "Any LCP entry on a marked element" covers the load and the settled first screen there.`,
  `Layout shift, settled then scroll (hard): every layout-shift entry from the moment the page is quiet until it is quiet again after one scroll-through, entries Chrome marks as following input included, with \`Date\` fixed to the run's start. The scroll dwells at each step for at least ${SETTLED_STEP_MIN_MS} ms and until the page has been still for ${SETTLED_STEP_QUIET_MS} ms. Taken ${SETTLED_TAKES} times per build; the takes must agree within ${SHIFT_AGREEMENT} or the check is unmeasured and fails. Two builds: fails when the after build exceeds the before build by more than ${SHIFT_MARGIN}. One build: fails above ${SHIFT_SINGLE_BAR}, a bar this tool sets for itself (field CLS calls 0.1 over a whole visit "good"). Neither is CLS as field tools define it.`,
  FROM_LOAD_NOTE,
  'LCP: Chrome reports no LCP entry for an element while it is at opacity 0 and reports a new one when it fades in, so the entry read at load can miss a hidden marked hero. "Any LCP entry on a marked element" therefore watches every entry until the end of the scroll-through, and "Largest above-the-fold block" measures the largest image or text block in the first screen by geometry, whatever its opacity; both must be unmarked.',
  'First mark shown: the first element with the mark attribute that gains is-in (the site-wide `.reveal` heading entrance also adds is-in and is not counted). When a mark is in the first screen it gets 5 s to show; when none is there, or none showed, the harness scrolls the first mark into view and says so.',
  LONG_FRAME_NOTE,
  `Long frames, how: requestAnimationFrame gaps in the ${LONG_FRAME_WINDOW_MS / 1000} s after the first mark is shown, under 4x CPU and a throttled network. When the page has no marks at load, the window starts at the first mark shown after hydration or after the route's scripted steps; with no marks at all it is not applicable.`,
  'Marks shown: every rendered element with the mark attribute must end at opacity 1 with no transform left over (rise, disc), and every `.motion-stroke` in a draw must end at stroke-dashoffset 0; checked after the scroll-through, with reduced motion and with scripting off.',
  'Marks rendered: a mark is rendered when it and every ancestor are `visibility: visible`, none is `display: none`, and its box is not empty. Each mark must be rendered in the same modes (at rest, reduced motion, scripting off): one rendered in one mode and not in another fails, naming the element and the mode. A mark rendered in none of the three is legitimately absent.',
  'Mark counts: with two builds, a route whose count changes is listed, and a route that goes from some marks to none fails unless `--marks-removed` names it. With one build, a route with `minMarks` in motion-evidence.routes.json fails below it.',
  `Hidden above after reload: measured with the scroll restore made instant; the position after the reload must be within ${RELOAD_SCROLL_TOLERANCE} px of the one before it (native restore), otherwise the harness restores it itself (explicit restore) and says so, and if neither holds the check is unmeasured and fails.`,
  `Rest diff: full-page screenshots taken once the page is quiet after the scroll-through, with \`Date\` fixed to the run's start, finite animations finished, infinite ones paused on their first frame, videos paused on their first frame, the text caret hidden, every image loaded and decoded, and the shot repeated until two in a row are identical. At most ${MAX_REST_PIXELS} differing pixels (pixelmatch threshold ${PIXEL_THRESHOLD}) on a route marked identical, and any change of page width or height counts. A pair that differs is retaken; it fails when the retake differs too, and a difference seen once in three pairs is listed as an unstable capture. The images of every failing or unstable pair are saved, cropped to the change.`,
].join(' ');

function restCell(rest) {
  if (!rest?.takes?.length) return 'n/a';
  return rest.takes.map((t, i) => {
    const width = t.widthChanged ? `, width ${t.widthChanged.from} to ${t.widthChanged.to} px` : '';
    const height = t.heightChanged ? `, height ${t.heightChanged.from} to ${t.heightChanged.to} px` : '';
    const daily = t.differing > 0 && t.outsideDaily != null && t.outsideDaily !== t.differing ? ` (${t.outsideDaily} outside daily data)` : '';
    return `${rest.takes.length > 1 ? `take ${i + 1}: ` : ''}${t.differing} px${daily}${width}${height}`;
  }).join('; ');
}

function columnsFor(report) {
  const columns = [];
  for (const vp of report.viewports) {
    columns.push({ vp, build: 'before' });
    if (report.after) columns.push({ vp, build: 'after' });
  }
  return columns;
}

/** summary.md: one table per route, before and after side by side. */
export function renderSummary(report) {
  const both = Boolean(report.after);
  const lines = [];
  lines.push('# Motion evidence');
  lines.push('');
  lines.push(`- Before: ${report.before}`);
  if (both) lines.push(`- After: ${report.after}`);
  else lines.push('- Mode: single build (nothing compared between builds)');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Viewports: ${report.viewports.join(', ')}. Strip times: ${STRIP_TIMES.join(', ')} ms.`);
  lines.push(`- Hard checks on the ${both ? '"after"' : 'only'} build: ${report.failures.length === 0 ? 'all pass' : `${report.failures.length} failing`}.`);
  lines.push('');
  lines.push(LONG_FRAME_NOTE);
  lines.push('');
  lines.push(FROM_LOAD_NOTE);
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
  const unstable = report.unstable ?? [];
  lines.push('## Unstable captures');
  lines.push('');
  if (unstable.length) for (const u of unstable) lines.push(`- ${u.path} ${u.viewport}: ${u.detail}`);
  else lines.push('None.');
  lines.push('');
  if (both) {
    const changed = report.markCounts?.filter((m) => m.before !== m.after) ?? [];
    lines.push('## Mark counts that changed between builds');
    lines.push('');
    if (changed.length) for (const m of changed) lines.push(`- ${m.path} ${m.viewport}: ${m.before ?? 'n/a'} to ${m.after ?? 'n/a'}`);
    else lines.push('None.');
    lines.push('');
  }
  const images = report.restImages ?? [];
  if (images.length) {
    lines.push('## Rest images (failing or unstable pairs)');
    lines.push('');
    for (const im of images) lines.push(`- ${im.path} ${im.viewport} take ${im.take} (${im.differing} px): [before](${im.before}), [after](${im.after}), [diff](${im.diff})${im.note ? `, ${im.note}` : ''}`);
    lines.push('');
  }
  for (const route of report.routes) {
    lines.push(`## ${route.path} (rest: ${route.rest})`);
    lines.push('');
    const columns = columnsFor(report);
    lines.push(`| | ${columns.map((c) => `${c.build} ${c.vp}`).join(' | ')} |`);
    lines.push(`|---|${columns.map(() => '---').join('|')}|`);
    if (both) {
      lines.push(`| Rest diff | ${columns.map((c) => (c.build === 'before' ? '' : restCell(route.viewports[c.vp]?.rest))).join(' | ')} |`);
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
      lines.push(`Loops (paused on their first frame for the rest capture, never sought or waited for): ${loops.map(([build, list]) => `${build}: ${list.join('; ')}`).join('. ')}.`);
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
  parts.push('<style>body{background:#0b0c10;color:#e8e6e1;font:14px/1.5 system-ui,sans-serif;margin:24px}table{border-collapse:collapse;margin:8px 0 16px}td,th{border:1px solid #333;padding:4px 8px;text-align:left;vertical-align:top}th{background:#16181d}code{color:#c9b98a}.fail{color:#ff7a7a}.note,.unstable{color:#e6c66a}img{max-width:100%;display:block;margin:8px 0 24px;border:1px solid #333}h2{margin-top:40px}</style></head><body>');
  parts.push('<h1>Motion evidence</h1>');
  parts.push(`<p>Before: <code>${escapeHtml(report.before)}</code>${both ? `. After: <code>${escapeHtml(report.after)}</code>` : '. Single-build mode.'} Generated ${escapeHtml(report.generatedAt)}.</p>`);
  parts.push(`<p>${escapeHtml(LONG_FRAME_NOTE)}</p><p>${escapeHtml(FROM_LOAD_NOTE)}</p><p>${escapeHtml(PROXY_NOTE)}</p>`);
  parts.push(`<p>${report.failures.length === 0 ? 'All hard checks pass.' : `${report.failures.length} failing checks:`}</p>`);
  if (report.failures.length) {
    parts.push(`<ul>${report.failures.map((f) => `<li class="fail">${escapeHtml(`${f.path} ${f.viewport} ${f.check}: ${f.detail}`)}</li>`).join('')}</ul>`);
  }
  if (report.unstable?.length) parts.push(`<p>Unstable captures:</p><ul>${report.unstable.map((u) => `<li class="unstable">${escapeHtml(`${u.path} ${u.viewport}: ${u.detail}`)}</li>`).join('')}</ul>`);
  for (const im of report.restImages ?? []) {
    parts.push(`<p>${escapeHtml(`${im.path} ${im.viewport} take ${im.take} (${im.differing} px)`)}: <a href="${escapeHtml(im.before)}">before</a>, <a href="${escapeHtml(im.after)}">after</a>, <a href="${escapeHtml(im.diff)}">diff</a></p><img loading="lazy" src="${escapeHtml(im.diff)}" alt="${escapeHtml(`${im.path} rest diff`)}">`);
  }
  for (const route of report.routes) {
    parts.push(`<h2>${escapeHtml(route.path)} <small>(rest: ${escapeHtml(route.rest)})</small></h2>`);
    const columns = columnsFor(report);
    parts.push(`<table><tr><th></th>${columns.map((c) => `<th>${c.build} ${c.vp}</th>`).join('')}</tr>`);
    if (both) {
      parts.push(`<tr><td>Rest diff</td>${columns.map((c) => (c.build === 'before' ? '<td></td>' : `<td>${escapeHtml(restCell(route.viewports[c.vp]?.rest))}</td>`)).join('')}</tr>`);
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
    shifts: [], lastActivity: 0, lcp: null, lcpMarked: false, lcpMarkedElement: null, firstPaint: null, firstContentfulPaint: null,
    firstMarkShown: null, frames: [], props: {}, verbs: {}, describe, scrollStartedAt: null, played: 0, touches: 0,
  };
  Object.defineProperty(window, '__motionEvidence', { value: state, enumerable: false });
  const now = () => performance.now();
  const observe = (type, fn) => {
    try { new PerformanceObserver((list) => fn(list.getEntries())).observe({ type, buffered: true }); } catch { /* unsupported */ }
  };
  // Every entry is kept, those Chrome marks as following input too: the harness's own scroll is the only input.
  observe('layout-shift', (entries) => {
    for (const e of entries) {
      if (state.shifts.length < 5000) state.shifts.push({ t: e.startTime, value: e.value, recent: e.hadRecentInput });
      state.lastActivity = now();
    }
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
      state.firstMarkShown = now();
      break;
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  // Any change to the document is activity, for the quiet wait.
  new MutationObserver(() => { state.lastActivity = now(); })
    .observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  if (cfg.frames) {
    const tick = (t) => { if (state.frames.length < 50000) state.frames.push(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  addEventListener('touchstart', () => { state.touches += 1; }, { capture: true, passive: true });
  const played = new WeakSet();
  const record = (target, names) => {
    const owner = target && target.closest ? target.closest(mark) : null;
    if (!owner) return;
    for (const n of names) state.props[n] = true;
    if (names.length) state.verbs[owner.getAttribute(cfg.mark)] = true;
    if (state.scrollStartedAt != null && !played.has(owner)) {
      played.add(owner);
      state.played += 1;
    }
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
  // Bounded: a page that stops producing frames must not stall the run.
  return new Promise((r) => { setTimeout(r, 1000); requestAnimationFrame(() => requestAnimationFrame(() => r())); });
}

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

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

/** Requests in flight and the time of the last request event, for the quiet wait. */
function trackNetwork(page) {
  const net = { inflight: 0, last: Date.now() };
  const pending = new Set();
  page.on('request', (r) => { pending.add(r); net.inflight = pending.size; net.last = Date.now(); });
  const done = (r) => { pending.delete(r); net.inflight = pending.size; net.last = Date.now(); };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  return net;
}

/**
 * Wait until the page is quiet (see QUIET_MS). Returns { quiet: true, at }
 * with the page's clock at that moment, or { quiet: false, reason } at the cap.
 */
async function waitForQuiet(page, net, { quietMs = QUIET_MS, capMs = QUIET_CAP_MS } = {}) {
  const started = Date.now();
  const fonts = await Promise.race([
    page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => true) : true)).catch(() => false),
    sleep(capMs).then(() => false),
  ]);
  for (;;) {
    const s = await page.evaluate(() => ({ now: performance.now(), last: window.__motionEvidence?.lastActivity ?? 0 }));
    const pageQuiet = s.now - s.last >= quietMs;
    const netQuiet = net.inflight === 0 && Date.now() - net.last >= quietMs;
    if (fonts && pageQuiet && netQuiet) return { quiet: true, at: s.now, waited: Date.now() - started };
    if (Date.now() - started >= capMs) {
      const why = [!fonts && 'fonts not ready', !pageQuiet && 'the DOM or layout still changing', !netQuiet && `${net.inflight} requests in flight or recent`].filter(Boolean).join(', ');
      return { quiet: false, reason: `not quiet within ${capMs / 1000} s (${why})` };
    }
    await sleep(100);
  }
}

/**
 * Tell the page the reader is scrolling (wheel input only). The site's
 * runtime plays entrances only for the reader's own scroll (wheel, touch, key
 * or pointer), and shows everything at once for a scroll the browser made by
 * itself. Synthetic events do not count as input for layout shift.
 */
function announceReaderScroll() {
  window.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 1 }));
}

/** One touch drag upward of `distance` px through the DevTools protocol; the finger stops before it lifts, so nothing flings. */
async function touchDrag(cdp, viewport, distance, x = Math.round(viewport.width / 2)) {
  const y0 = Math.round(viewport.height * 0.9);
  const d = Math.min(Math.round(distance), Math.round(viewport.height * 0.85));
  const n = Math.max(2, Math.ceil(d / 60));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let k = 1; k <= n; k += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - Math.round((d * k) / n) }] });
    await sleep(16);
  }
  await sleep(100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** After a settled step: at least SETTLED_STEP_MIN_MS, then until the page is still for SETTLED_STEP_QUIET_MS. */
async function dwell(page, cadence) {
  if (cadence === 'fast') {
    await page.waitForTimeout(FAST_STEP_MS);
    return;
  }
  const started = Date.now();
  await page.waitForTimeout(SETTLED_STEP_MIN_MS);
  while (Date.now() - started < SETTLED_STEP_CAP_MS) {
    const s = await page.evaluate(() => ({ now: performance.now(), last: window.__motionEvidence?.lastActivity ?? 0 }));
    if (s.now - s.last >= SETTLED_STEP_QUIET_MS) return;
    await sleep(50);
  }
}

/**
 * One scroll-through, top to bottom, by the viewport's input: touch drags at
 * a phone size, the wheel announcement and scripted scrolls otherwise.
 * Returns whether it reached the bottom.
 */
async function scrollThrough(page, { viewport, cdp = null, cadence, onStep = null }) {
  const input = inputFor(viewport);
  await page.evaluate(() => { window.__motionEvidence.scrollStartedAt = performance.now(); });
  if (input === 'wheel') await page.evaluate(announceReaderScroll);
  let stalls = 0;
  let steps = 0;
  for (let guard = 0; guard < 400; guard += 1) {
    const { y, max, step } = await page.evaluate((fraction) => ({
      y: scrollY,
      max: document.documentElement.scrollHeight - innerHeight,
      step: Math.round(innerHeight * fraction),
    }), STEP_FRACTION);
    if (y >= max - 1) return { reachedEnd: true, steps, input };
    if (input === 'touch') {
      // A drag that starts on an element that keeps the touch for itself
      // (touch-action: none) does not scroll the page: try the screen's edges.
      for (const x of [Math.round(viewport.width / 2), 12, viewport.width - 12]) {
        await touchDrag(cdp, viewport, Math.min(step, max - y) + TOUCH_SLOP, x);
        if (await page.evaluate(() => scrollY) > y) break;
      }
    } else await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), Math.min(y + step, max));
    await dwell(page, cadence);
    steps += 1;
    if (onStep) await onStep();
    const after = await page.evaluate(() => scrollY);
    stalls = after <= y ? stalls + 1 : 0;
    if (stalls >= 2) return { reachedEnd: false, steps, input, reason: `the ${input} scroll stopped at ${Math.round(after)} px of ${Math.round(max)} px` };
  }
  return { reachedEnd: false, steps, input, reason: 'more than 400 steps' };
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
      await new Promise((r) => { setTimeout(r, 1000); requestAnimationFrame(() => requestAnimationFrame(() => r())); });
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
    hasTouch: inputFor(viewport) === 'touch',
    ...extra,
  };
}

async function withPage(browser, viewport, extra, init, fn) {
  const context = await browser.newContext(contextOptions(viewport, extra));
  let timedOut = false;
  const watchdog = setTimeout(() => { timedOut = true; context.close().catch(() => {}); }, CONTEXT_WATCHDOG_MS);
  try {
    const page = await context.newPage();
    const net = trackNetwork(page);
    if (init) await page.addInitScript(initScript, init);
    return await fn(page, context, net);
  } catch (error) {
    if (timedOut) throw new Error(`still busy after ${CONTEXT_WATCHDOG_MS / 1000} s, so it was stopped (${String(error.message).split('\n')[0]})`);
    throw error;
  } finally {
    clearTimeout(watchdog);
    await context.close().catch(() => {});
  }
}

export const baseCfg = (extra = {}) => ({ mark: MARK_ATTRIBUTE, shown: SHOWN_CLASS, frames: false, ...extra });

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

/** The layout shift from the quiet moment `from` on, from the init script's log. */
async function shiftSince(page, from) {
  return page.evaluate((t0) => {
    const list = window.__motionEvidence.shifts.filter((e) => e.t >= t0);
    return { value: Math.round(list.reduce((s, e) => s + e.value, 0) * 1e6) / 1e6, entries: list.length, recent: list.filter((e) => e.recent).length };
  }, from);
}

/**
 * In the page, just before the rest capture: finish the finite animations,
 * pause the infinite ones and every video on their first frame, hide the
 * caret, and wait for every image to load and decode and for the fonts.
 */
async function freezeForCapture() {
  const style = document.createElement('style');
  style.textContent = '*, *::before, *::after { caret-color: transparent !important; }';
  document.head.appendChild(style);
  for (const a of document.getAnimations()) {
    try {
      if (a.effect?.getTiming?.().iterations === Infinity) {
        a.pause();
        a.currentTime = 0;
      } else if (a.playState !== 'finished') a.finish();
    } catch { /* cancelled meanwhile */ }
  }
  await Promise.all([...document.querySelectorAll('video')].map((video) => new Promise((done) => {
    video.pause();
    if (video.currentTime === 0) { done(); return; }
    const timer = setTimeout(done, 3000);
    video.addEventListener('seeked', () => { clearTimeout(timer); done(); }, { once: true });
    video.currentTime = 0;
  })));
  await Promise.all([...document.images].filter((img) => img.currentSrc || img.getAttribute('src')).map((img) => (img.complete
    ? Promise.resolve()
    : new Promise((done) => {
      const timer = setTimeout(done, 5000);
      const finish = () => { clearTimeout(timer); done(); };
      img.addEventListener('load', finish, { once: true });
      img.addEventListener('error', finish, { once: true });
    })).then(() => (img.naturalWidth
    ? Promise.race([img.decode().catch(() => {}), new Promise((done) => { setTimeout(done, 5000); })])
    : null))));
  if (document.fonts) await Promise.race([document.fonts.ready, new Promise((done) => { setTimeout(done, 5000); })]);
}

/**
 * The rest capture: back at the top, quiet, frozen, and the full page shot
 * until two shots in a row are identical (at most 4 shots).
 */
async function captureRest(page, net) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const quiet = await waitForQuiet(page, net);
  const dailyRects = await page.evaluate((selectors) => [...document.querySelectorAll(selectors.join(','))].map((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.floor(r.left + scrollX), y: Math.floor(r.top + scrollY), width: Math.ceil(r.width) + 1, height: Math.ceil(r.height) + 1 };
  }), DAILY_SELECTORS);
  await page.evaluate(freezeForCapture);
  await page.evaluate(twoFrames);
  await page.waitForTimeout(250);
  const shot = () => page.screenshot({ fullPage: true, type: 'png', animations: 'allow', caret: 'hide' });
  let png = await shot();
  let shots = 1;
  let stable = false;
  while (shots < 4) {
    await page.waitForTimeout(250);
    const next = await shot();
    shots += 1;
    if (next.equals(png)) { stable = true; break; }
    png = next;
  }
  return { png, dailyRects, quiet, shots, stable };
}

/**
 * The rest load: quiet, one settled scroll-through (which is the first take
 * of the hard layout-shift number), quiet again, the marks inspected, then the
 * rest capture. With `captureOnly`, only what a rest retake needs.
 */
async function measureRest(browser, url, route, viewport, loops, notes, { captureOnly = false } = {}) {
  const cfg = baseCfg();
  return withPage(browser, viewport, {}, cfg, async (page, context, net) => {
    // Both builds see the same clock, so a live sky wheel (the home page's)
    // draws the same positions in each rest-state screenshot. Timers run.
    await context.clock.setFixedTime(RUN_STARTED_AT);
    await gotoPage(page, url, { notes });
    const quiet1 = await waitForQuiet(page, net);
    if (!quiet1.quiet) notes.push(`rest load: ${quiet1.reason}`);
    const atQuiet = await page.evaluate(({ mark, primary }) => {
      const marked = [...document.querySelectorAll(`[${mark}]`)];
      const action = primary ? document.querySelector(primary) : null;
      return {
        markedCount: marked.length,
        nestedMarks: marked.filter((el) => !el.closest('svg') && el.parentElement && el.parentElement.closest(`[${mark}]`)).length,
        primaryActionTop: action ? Math.round(action.getBoundingClientRect().top + scrollY) : null,
      };
    }, { mark: MARK_ATTRIBUTE, primary: route.primaryAction ?? null });
    const largest = captureOnly ? null : await page.evaluate(largestAboveFold, { mark: `[${MARK_ATTRIBUTE}]` });
    if (!captureOnly) await page.waitForFunction(() => window.__motionEvidence.lcp != null, null, { timeout: 5000 }).catch(() => {});
    const lcp = await page.evaluate(() => window.__motionEvidence.lcp);
    if (!lcp && !captureOnly) notes.push('no largest-contentful-paint entry within 5 s of load');
    for (const l of await page.evaluate(sampleAnimations, cfg)) loops.add(l);
    const cdp = inputFor(viewport) === 'touch' ? await context.newCDPSession(page) : null;
    const scroll = await scrollThrough(page, {
      viewport, cdp, cadence: 'settled',
      onStep: async () => { for (const l of await page.evaluate(sampleAnimations, cfg)) loops.add(l); },
    });
    const settled = await settle(page);
    if (settled.remaining) notes.push(`rest: ${settled.remaining} finite animations still running after ${SETTLE_MAX_MS / 1000} s`);
    const quiet2 = await waitForQuiet(page, net);
    let shiftTake;
    if (!quiet1.quiet) shiftTake = { value: null, unmeasured: `before the scroll: ${quiet1.reason}` };
    else if (!scroll.reachedEnd) shiftTake = { value: null, unmeasured: `the scroll-through did not reach the bottom: ${scroll.reason}` };
    else if (!quiet2.quiet) shiftTake = { value: null, unmeasured: `after the scroll: ${quiet2.reason}` };
    else shiftTake = await shiftSince(page, quiet1.at);
    const shownAtRest = captureOnly ? null : await page.evaluate(inspectMarks, { mark: MARK_ATTRIBUTE });
    const after = await page.evaluate((shown) => ({
      rootMarked: document.documentElement.classList.contains(shown),
      props: Object.keys(window.__motionEvidence.props),
      verbs: Object.keys(window.__motionEvidence.verbs),
      lcpMarked: window.__motionEvidence.lcpMarked,
      lcpMarkedElement: window.__motionEvidence.lcpMarkedElement,
      played: window.__motionEvidence.played,
      touches: window.__motionEvidence.touches,
    }), SHOWN_CLASS);
    const capture = await captureRest(page, net);
    if (!capture.stable) notes.push(`rest capture: no two shots in a row were identical in ${capture.shots} shots`);
    if (!capture.quiet.quiet) notes.push(`rest capture: ${capture.quiet.reason}`);
    if (after.played === 0 && atQuiet.markedCount > 0 && shownAtRest && shownAtRest.rendered > 0) {
      notes.push(`the ${scroll.input} scroll-through played no entrance on a page with ${atQuiet.markedCount} marks (fine only if every mark was already shown before it)`);
    }
    return {
      png: capture.png,
      dailyRects: capture.dailyRects,
      captureReady: capture.quiet.quiet,
      shiftTake,
      scroll: { reachedEnd: scroll.reachedEnd, steps: scroll.steps, input: scroll.input },
      rootMarked: after.rootMarked, props: after.props, verbs: after.verbs, ...atQuiet,
      entrancesPlayed: after.played,
      touches: after.touches,
      markedVerbs: shownAtRest?.renderedVerbs ?? null,
      shownAtRest,
      lcp: lcp ? { time: Math.round(lcp.time), selector: shortSelector(lcp.element) } : null,
      lcpMarked: after.lcpMarked,
      lcpMarkedSelector: after.lcpMarkedElement ? shortSelector(after.lcpMarkedElement) : null,
      largest: largest ? { kind: largest.kind, area: largest.area, selector: shortSelector(largest.descriptor), marked: largest.marked } : null,
    };
  });
}

/** One more take of the hard layout-shift number: quiet, a settled scroll-through, quiet. */
async function measureSettledShift(browser, url, viewport, notes) {
  return withPage(browser, viewport, {}, baseCfg(), async (page, context, net) => {
    await context.clock.setFixedTime(RUN_STARTED_AT);
    await gotoPage(page, url, { notes });
    const quiet1 = await waitForQuiet(page, net);
    if (!quiet1.quiet) return { value: null, unmeasured: `before the scroll: ${quiet1.reason}` };
    const cdp = inputFor(viewport) === 'touch' ? await context.newCDPSession(page) : null;
    const scroll = await scrollThrough(page, { viewport, cdp, cadence: 'settled' });
    if (!scroll.reachedEnd) return { value: null, unmeasured: `the scroll-through did not reach the bottom: ${scroll.reason}` };
    await settle(page);
    const quiet2 = await waitForQuiet(page, net);
    if (!quiet2.quiet) return { value: null, unmeasured: `after the scroll: ${quiet2.reason}` };
    return shiftSince(page, quiet1.at);
  });
}

/** Report only: every layout shift from navigation on, with the scroll-through starting at `load`. */
async function measureShiftFromLoad(browser, url, viewport, notes) {
  return withPage(browser, viewport, {}, baseCfg(), async (page, context) => {
    await context.clock.setFixedTime(RUN_STARTED_AT);
    const cdp = inputFor(viewport) === 'touch' ? await context.newCDPSession(page) : null;
    await gotoPage(page, url, { notes });
    const scroll = await scrollThrough(page, { viewport, cdp, cadence: 'fast' });
    await settle(page);
    const take = await shiftSince(page, 0);
    return scroll.reachedEnd ? take : { ...take, partial: scroll.reason };
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

/** Run one scripted step on a loaded page. Returns { skipped } when it could not run. */
async function runStep(page, step) {
  const selectors = [step.scrollTo, ...Object.keys(step.fill ?? {}), step.click].filter(Boolean);
  for (const selector of selectors) {
    if (await page.locator(selector).count() === 0) return { skipped: `${selector} not found` };
  }
  if (step.scrollTo) {
    await page.evaluate(announceReaderScroll);
    await page.locator(step.scrollTo).first().evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  }
  for (const [selector, value] of Object.entries(step.fill ?? {})) {
    try {
      await page.locator(selector).first().fill(value, { timeout: 5000 });
    } catch (error) {
      return { skipped: `${selector} could not be filled (${String(error.message).split('\n')[0]})` };
    }
  }
  if (step.click) {
    try {
      await page.locator(step.click).first().click({ timeout: 5000 });
    } catch (error) {
      return { skipped: `${step.click} could not be clicked (${String(error.message).split('\n')[0]})` };
    }
  }
  return {};
}

async function measureStep(browser, url, viewport, step, loops, notes, props, verbs) {
  const cfg = baseCfg();
  return withPage(browser, viewport, {}, cfg, async (page) => {
    await gotoPage(page, url, { notes });
    await settle(page);
    // Islands hydrate after `load`; a form filled before that keeps its
    // submit button disabled. Wait for the network to go quiet first.
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const ran = await runStep(page, step);
    if (ran.skipped) {
      notes.push(`step "${stepLabel(step)}" did not run: ${ran.skipped}`);
      return { skipped: ran.skipped };
    }
    const strip = await filmStrip(page, cfg, loops);
    const seen = await page.evaluate(() => ({ props: Object.keys(window.__motionEvidence.props), verbs: Object.keys(window.__motionEvidence.verbs) }));
    for (const p of seen.props) props.add(p);
    for (const v of seen.verbs) verbs.add(v);
    return strip;
  });
}

/**
 * A throttled load: network and 4x CPU. Paint, entrance timing, and the
 * longest frame in the LONG_FRAME_WINDOW_MS after the first mark is shown.
 * When the page has no marks at load, it waits for hydration, then runs the
 * route's steps, and anchors the window on the first mark shown after them.
 * With no marks at all, long frames are not applicable.
 */
async function measureThrottled(browser, url, route, viewport, notes) {
  const cfg = baseCfg({ frames: true });
  return withPage(browser, viewport, {}, cfg, async (page, context, net) => {
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
    const count = () => page.evaluate((mark) => document.querySelectorAll(`[${mark}]`).length, MARK_ATTRIBUTE);
    const paint = () => page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const s = window.__motionEvidence;
      return { firstPaint: s.firstPaint ?? s.firstContentfulPaint, domContentLoaded: nav ? nav.domContentLoadedEventStart : null, firstMarkShown: s.firstMarkShown };
    });
    let anchoredOn = 'load';
    if (await count() === 0) {
      await waitForQuiet(page, net, { capMs: 20000 });
      anchoredOn = 'hydration';
    }
    for (const [i, step] of (route.steps ?? []).entries()) {
      if (await count() > 0) break;
      const ran = await runStep(page, step);
      if (ran.skipped) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        const state = await paint();
        return { throttled: { firstPaint: round(state.firstPaint), domContentLoaded: round(state.domContentLoaded), firstMarkShown: null }, longFrames: { unmeasured: `step ${i + 1} did not run: ${ran.skipped}` } };
      }
      await waitForQuiet(page, net, { capMs: 20000 });
      anchoredOn = `step ${i + 1}`;
    }
    if (await count() === 0) {
      const state = await paint();
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      return {
        throttled: { firstPaint: round(state.firstPaint), domContentLoaded: round(state.domContentLoaded), firstMarkShown: null },
        longFrames: { notApplicable: route.steps?.length ? 'no marks at load, after hydration or after the steps' : 'no marks at load or after hydration' },
      };
    }
    let scrolledAt = null;
    // A mark in the first screen gets up to 5 s to show; with none there, or
    // after that, the first mark is brought into view.
    const inView = await page.evaluate((mark) => [...document.querySelectorAll(`[${mark}]`)].some((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.width > 0 && r.height > 0;
    }), MARK_ATTRIBUTE);
    if (inView) await page.waitForFunction(() => window.__motionEvidence.firstMarkShown != null, null, { timeout: 5000 }).catch(() => {});
    if (await page.evaluate(() => window.__motionEvidence.firstMarkShown == null)) {
      scrolledAt = await page.evaluate((mark) => {
        window.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 1 }));
        const first = document.querySelector(`[${mark}]`);
        if (first) first.scrollIntoView({ block: 'center', behavior: 'instant' });
        return performance.now();
      }, MARK_ATTRIBUTE);
      await page.waitForFunction(() => window.__motionEvidence.firstMarkShown != null, null, { timeout: 5000 }).catch(() => {});
    }
    const state = await paint();
    const throttled = {
      firstPaint: round(state.firstPaint),
      domContentLoaded: round(state.domContentLoaded),
      firstMarkShown: round(state.firstMarkShown),
      ...(scrolledAt != null ? { scrolledToFirstMark: true } : {}),
    };
    if (state.firstMarkShown == null) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      return { throttled, longFrames: { unmeasured: 'marked elements exist but none was shown, even after scrolling to the first' } };
    }
    await page.waitForFunction((end) => performance.now() > end, state.firstMarkShown + LONG_FRAME_WINDOW_MS + 100, { timeout: 30000, polling: 200 });
    const { frames, now } = await page.evaluate(() => ({ frames: window.__motionEvidence.frames.slice(), now: performance.now() }));
    const longFrames = { ...longFrameStats(frames, state.firstMarkShown, LONG_FRAME_WINDOW_MS, LONG_FRAME_MS, now), anchoredOn };
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
 * In the page: is every mark rendered, and is every rendered mark shown?
 * Rendered: the mark and every ancestor are visibility visible, none is
 * display none, and its box is not empty. Shown: rise and disc at computed
 * opacity 1 with no transform left over (an SVG element may keep its own
 * transform attribute); draw at opacity 1 with every .motion-stroke at
 * stroke-dashoffset 0. Each mark is listed by its path in the DOM, so the
 * modes can be compared mark by mark. Also counts finite entrance animations
 * still running.
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
  const keyOf = (el) => {
    const parts = [];
    for (let e = el; e && e.parentElement && e !== document.body; e = e.parentElement) {
      let i = 1;
      for (let s = e.previousElementSibling; s; s = s.previousElementSibling) i += 1;
      parts.unshift(`${e.tagName.toLowerCase()}:${i}`);
    }
    return parts.join('>');
  };
  const absentWhy = (el) => {
    if (el.getClientRects().length === 0) return 'display none or no box';
    for (let e = el; e && e.tagName; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const on = e === el ? '' : ` on ${name(e)}`;
      if (cs.display === 'none') return `display none${on}`;
      if (cs.visibility !== 'visible') return `visibility ${cs.visibility}${on}`;
    }
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return `empty box (${r.width} x ${r.height})`;
    return null;
  };
  let rendered = 0;
  const examples = [];
  const renderedVerbs = new Set();
  const marks = [];
  let notShown = 0;
  for (const el of marked) {
    const absent = absentWhy(el);
    marks.push({ key: keyOf(el), name: name(el), rendered: !absent, ...(absent ? { absent } : {}) });
    if (absent) continue;
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
  return { total: marked.length, rendered, notShown, examples, running, renderedVerbs: [...renderedVerbs].sort(), marks };
}

async function measureReducedMotion(browser, url, viewport, notes) {
  return withPage(browser, viewport, { reducedMotion: 'reduce' }, baseCfg(), async (page, context) => {
    await gotoPage(page, url, { notes });
    await page.evaluate(twoFrames);
    const first = await page.evaluate(inspectMarks, { mark: MARK_ATTRIBUTE });
    let running = first.running;
    let worst = first;
    // Scroll through too, so an entrance that ignores the preference is caught when it would start.
    const cdp = inputFor(viewport) === 'touch' ? await context.newCDPSession(page) : null;
    await scrollThrough(page, {
      viewport, cdp, cadence: 'fast',
      onStep: async () => {
        const now = await page.evaluate(inspectMarks, { mark: MARK_ATTRIBUTE });
        running = Math.max(running, now.running);
        if (now.notShown > worst.notShown) worst = now;
      },
    });
    const last = await page.evaluate(inspectMarks, { mark: MARK_ATTRIBUTE });
    if (last.notShown > worst.notShown) worst = last;
    return { ...worst, running, marks: last.marks };
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
async function measureBuild(browser, baseURL, route, viewport, options) {
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
  const shiftSettled = [rest ? rest.shiftTake : { value: null, unmeasured: 'the rest load failed' }];
  while (shiftSettled.length < SETTLED_TAKES) {
    shiftSettled.push(await safely(notes, 'layout shift take', () => measureSettledShift(browser, url, viewport, notes)) ?? { value: null, unmeasured: 'the load failed (see notes)' });
  }
  const shiftFromLoad = [];
  for (let i = 0; i < FROM_LOAD_TAKES; i += 1) {
    shiftFromLoad.push(await safely(notes, 'layout shift from load', () => measureShiftFromLoad(browser, url, viewport, notes)) ?? { value: null });
  }
  const firstView = await safely(notes, 'first-view strip', () => measureFirstView(browser, url, viewport, loops, notes, props, verbs));
  const steps = [];
  for (const step of route.steps ?? []) {
    steps.push(await safely(notes, `step "${stepLabel(step)}"`, () => measureStep(browser, url, viewport, step, loops, notes, props, verbs)) ?? { skipped: 'the step threw (see notes)' });
  }
  const frameTakes = [];
  let throttled = null;
  for (let i = 0; i < options.frameLoads; i += 1) {
    const t = await safely(notes, 'throttled load', () => measureThrottled(browser, url, route, viewport, notes));
    if (i === 0) throttled = t?.throttled ?? null;
    frameTakes.push(t?.longFrames ?? { unmeasured: 'the throttled load failed' });
    if (t?.longFrames?.notApplicable) break;
  }
  const reload = await safely(notes, 'reload', () => measureReload(browser, url, viewport, notes));
  const reducedMotion = await safely(notes, 'reduced motion', () => measureReducedMotion(browser, url, viewport, notes));
  const noScript = await safely(notes, 'no script', () => measureNoScript(browser, url, viewport, notes));
  const numbers = {
    http,
    input: inputFor(viewport),
    shiftSettled,
    shiftFromLoad,
    lcp: rest?.lcp ?? null,
    lcpMarked: rest ? rest.lcpMarked : null,
    lcpMarkedSelector: rest?.lcpMarkedSelector ?? null,
    largest: rest?.largest ?? null,
    throttled,
    longFrames: summarizeLongFrames(frameTakes),
    entrancesPlayed: rest?.entrancesPlayed ?? null,
    touches: rest?.touches ?? null,
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
    rest: rest ? { png: rest.png, dailyRects: rest.dailyRects, ready: rest.captureReady } : null,
    firstView: firstView?.frames ?? null,
    steps: steps.map((s) => s?.frames ?? null),
  };
}

function stripVerbs({ renderedVerbs, ...rest }) {
  return rest;
}

/** A new rest capture of one build, for a retake. */
async function retakeRest(browser, baseURL, route, viewport, notes) {
  const r = await safely(notes, 'rest retake', () => measureRest(browser, `${baseURL}${route.path}`, route, viewport, new Set(), notes, { captureOnly: true }));
  return r ? { png: r.png, dailyRects: r.dailyRects, ready: r.captureReady } : null;
}

/** Compare two rest captures; null when either is missing or was taken on a page that never went quiet. */
function compareCaptures(a, b) {
  if (!a || !b || !a.ready || !b.ready) return { result: null };
  const A = PNG.sync.read(a.png);
  const B = PNG.sync.read(b.png);
  const result = compareRest(A, B, { dailyRects: [...a.dailyRects, ...b.dailyRects], keepMask: true });
  return { result, A, B };
}

/**
 * Save before.png, after.png and a diff (changed pixels in magenta over a
 * dimmed after image), each cropped to the changed area plus a margin and
 * scaled down until it is within REST_IMAGE_MAX_BYTES.
 */
async function saveRestImages(out, base, { A, B, result }) {
  const width = Math.max(A.width, B.width);
  const height = Math.max(A.height, B.height);
  let box = maskBounds(result.mask, result.width, result.height);
  if (!box) {
    // Only the size changed: show where the shorter page ends.
    const y = Math.max(0, Math.min(A.height, B.height) - 200);
    box = { x: 0, y, width, height: height - y };
  }
  const left = Math.max(0, box.x - REST_IMAGE_MARGIN);
  const top = Math.max(0, box.y - REST_IMAGE_MARGIN);
  const right = Math.min(width, box.x + box.width + REST_IMAGE_MARGIN);
  const bottom = Math.min(height, box.y + box.height + REST_IMAGE_MARGIN);
  const region = (img) => {
    const r = { left, top, width: Math.min(right, img.width) - left, height: Math.min(bottom, img.height) - top };
    return r.width > 0 && r.height > 0 ? r : null;
  };
  const diff = new PNG({ width: B.width, height: B.height });
  for (let i = 0; i < B.data.length; i += 4) {
    diff.data[i] = Math.round(B.data[i] * 0.35);
    diff.data[i + 1] = Math.round(B.data[i + 1] * 0.35);
    diff.data[i + 2] = Math.round(B.data[i + 2] * 0.35);
    diff.data[i + 3] = 255;
  }
  for (let y = 0; y < result.height; y += 1) {
    for (let x = 0; x < result.width; x += 1) {
      if (result.mask[(y * result.width + x) * 4 + 3] === 0) continue;
      const j = (y * B.width + x) * 4;
      diff.data[j] = 255; diff.data[j + 1] = 0; diff.data[j + 2] = 255;
    }
  }
  const files = {};
  let scaled = false;
  for (const [name, img] of [['before', A], ['after', B], ['diff', diff]]) {
    const r = region(img);
    const file = `${base}-${name}.png`;
    let buffer;
    if (!r) buffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#000' } }).png().toBuffer();
    else {
      const source = sharp(PNG.sync.write(img)).extract(r);
      const raw = await source.png({ compressionLevel: 9 }).toBuffer();
      buffer = raw;
      let w = r.width;
      while (buffer.length > REST_IMAGE_MAX_BYTES && w > 64) {
        w = Math.floor(w * 0.8);
        buffer = await sharp(raw).resize({ width: w, kernel: 'nearest' }).png({ compressionLevel: 9, palette: true }).toBuffer();
        scaled = true;
      }
    }
    await writeFile(resolve(out, file), buffer);
    files[name] = file;
  }
  return { ...files, region: { x: left, y: top, width: right - left, height: bottom - top }, scaled };
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
  const runOptions = { frameLoads: options.frameLoads ?? FRAME_LOADS };

  const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  const report = {
    generatedAt: new Date().toISOString(),
    before: options.before,
    after: options.after ?? null,
    markAttribute: MARK_ATTRIBUTE,
    viewports: VIEWPORTS.map(viewportKey),
    stripTimes: STRIP_TIMES,
    throttle: THROTTLE,
    marksRemoved: options.marksRemoved ?? [],
    routes: [],
    failures: [],
    unstable: [],
    markCounts: [],
    restImages: [],
  };
  if (routes.length === 0) {
    report.failures.push({ path: '(none)', viewport: '-', check: 'routes', detail: options.routes ? 'the route list resolved to no routes: --routes named no path' : 'the routes file lists no routes' });
  }
  try {
    for (const route of routes) {
      const entry = { path: route.path, rest: route.rest, primaryAction: route.primaryAction ?? null, minMarks: route.minMarks ?? null, loops: {}, sheets: [], viewports: {} };
      if (route.unlisted) entry.unlisted = true;
      const loops = Object.fromEntries(builds.map((b) => [b, new Set()]));
      const slug = routeSlug(route.path);
      for (const viewport of VIEWPORTS) {
        const key = viewportKey(viewport);
        console.log(`${route.path} ${key}`);
        const measured = {};
        for (const build of builds) {
          const started = Date.now();
          measured[build] = await measureBuild(browser, urls[build], route, viewport, runOptions);
          for (const l of measured[build].loops) loops[build].add(l);
          console.log(`  ${build}: ${((Date.now() - started) / 1000).toFixed(1)} s`);
        }
        const vpEntry = Object.fromEntries(builds.map((b) => [b, measured[b].numbers]));
        // Rest state: compared on every route, retaken only where it is judged.
        if (options.after && measured.before.rest && measured.after.rest) {
          const takes = [];
          let pair = { before: measured.before.rest, after: measured.after.rest };
          for (;;) {
            const c = compareCaptures(pair.before, pair.after);
            if (!c.result) {
              takes.push(null);
              break;
            }
            const { mask, ...kept } = c.result;
            takes.push({ ...kept, comparedArea: `${kept.width}x${kept.height}` });
            if (route.rest === 'identical' && restTakeKind(kept) === 'differs') {
              const images = await saveRestImages(out, `rest-${slug}-${key}-take${takes.length}`, c);
              report.restImages.push({ path: route.path, viewport: key, take: takes.length, differing: kept.differing, ...images, ...(images.scaled ? { note: 'scaled down to stay within 400 KB' } : {}) });
              console.log(`  rest take ${takes.length}: ${kept.differing} px differ; saved ${images.before}, ${images.after}, ${images.diff} in ${out}`);
            }
            if (route.rest !== 'identical' || !restNeedsRetake(takes)) break;
            const notes = [];
            pair = {
              before: await retakeRest(browser, urls.before, route, viewport, notes),
              after: await retakeRest(browser, urls.after, route, viewport, notes),
            };
            vpEntry.after.notes.push(...notes);
          }
          vpEntry.rest = { takes };
        } else if (options.after) {
          vpEntry.rest = { takes: [null] };
        }
        const subject = vpEntry[subjectBuild];
        const baseline = options.after ? vpEntry.before : null;
        if (options.after) report.markCounts.push({ path: route.path, viewport: key, before: vpEntry.before.markedCount ?? null, after: vpEntry.after.markedCount ?? null });
        vpEntry.checks = evaluateChecks({ route, viewport, subject, baseline, rest: vpEntry.rest ?? null, marksRemoved: options.marksRemoved ?? [] });
        for (const c of vpEntry.checks) {
          if (c.status === 'fail') report.failures.push({ path: route.path, viewport: key, check: c.check, detail: c.detail });
          if (c.status === 'unstable') report.unstable.push({ path: route.path, viewport: key, detail: c.detail });
        }
        entry.viewports[key] = vpEntry;
        // Sheets.
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
  for (const im of report.restImages) console.log(`Rest images: ${im.path} ${im.viewport} take ${im.take}: ${resolve(out, im.before)}, ${resolve(out, im.after)}, ${resolve(out, im.diff)}`);
  for (const u of report.unstable) console.log(`Unstable capture: ${u.path} ${u.viewport}: ${u.detail}`);
  const changed = report.markCounts.filter((m) => m.before !== m.after);
  for (const m of changed) console.log(`Mark count changed: ${m.path} ${m.viewport}: ${m.before} to ${m.after}`);
  if (report.failures.length) {
    console.log(`${report.failures.length} hard checks fail:`);
    for (const f of report.failures) console.log(`  ${f.path} ${f.viewport} ${f.check}: ${f.detail}`);
  } else {
    console.log('All hard checks pass.');
  }
  console.log(LONG_FRAME_NOTE);
  process.exit(checkExitCode(report, options));
}
