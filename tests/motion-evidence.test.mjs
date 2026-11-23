/**
 * The motion evidence harness's pure helpers (ZOD-294): argument parsing,
 * route selection, the rest-state comparison and its retakes, the
 * layout-shift agreement rule, mark counts, rendered marks, long-frame
 * counting and its report, sheet geometry, the hard checks and the exit code.
 * Two in-page functions (the init script's first-mark watcher and the marks
 * inspection) run here against small stand-ins for the DOM; the rest of the
 * browser side is exercised by running the harness against two builds.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_PROPERTIES, baseCfg, checkExitCode, compareRendered, compareRest, countOutsideRects, disallowedProperties, evaluateChecks,
  firstViewCaptureNote, formatNumbers, FROM_LOAD_NOTE, initScript, inputFor, inspectMarks, LONG_FRAME_NOTE, longFrameStats, MARK_ATTRIBUTE, markCountCheck,
  maskBounds, MAX_REST_PIXELS, median, nextFrameWidth, normalizePath, parseArgs, renderReport, renderSummary, restNeedsRetake, restTakeKind, restVerdict,
  routeSlug, selectRoutes, settledShift, settledShiftVerdict, SETTLED_TAKES, SHIFT_AGREEMENT, SHIFT_MARGIN, SHIFT_SINGLE_BAR, sheetLayout,
  shortSelector, STRIP_TIMES, summarizeLongFrames, toKebab,
} from './motion-evidence.mjs';

const routesFile = JSON.parse(readFileSync(new URL('./motion-evidence.routes.json', import.meta.url), 'utf8'));

const solid = (width, height, rgb = [10, 10, 10]) => {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set([...rgb, 255], i * 4);
  return { width, height, data };
};
const paint = (image, x, y, w, h, rgb) => {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) image.data.set([...rgb, 255], (yy * image.width + xx) * 4);
  }
  return image;
};

const marksList = (n, rendered = true) => Array.from({ length: n }, (_, i) => ({ key: `main:1>ul:1>li:${i + 1}`, name: 'li.card', rendered }));
const shownAll = (n = 4) => ({ total: n, rendered: n, notShown: 0, examples: [], running: 0, marks: marksList(n) });
const zero = () => [{ value: 0 }, { value: 0 }, { value: 0 }];
const clean = {
  http: { url: 'http://127.0.0.1:4391/x/', status: 200 },
  input: 'touch',
  shiftSettled: zero(),
  shiftFromLoad: [{ value: 0 }, { value: 0.3 }, { value: 0 }, { value: 0.31 }, { value: 0 }],
  lcp: { time: 400, selector: 'h1.display' },
  lcpMarked: false,
  largest: { kind: 'text block', area: 40000, selector: 'h1.display', marked: false },
  longFrames: summarizeLongFrames([{ count: 0, longest: 33.4, frames: 70, anchoredOn: 'load' }]),
  entrancesPlayed: 4,
  touches: 9,
  animatedProperties: ['opacity', 'transform'],
  markedVerbs: ['rise'],
  sampledVerbs: ['rise'],
  markedCount: 4,
  nestedMarks: 0,
  rootMarked: false,
  shownAtRest: shownAll(),
  hiddenAboveAfterReload: 0,
  reload: { before: 3000, after: 3000, path: 'native restore' },
  primaryActionTop: 600,
  reducedMotion: shownAll(),
  noScript: shownAll(),
  throttled: { firstPaint: 500, domContentLoaded: 700, firstMarkShown: 850 },
  strip: { animations: 8, lost: 0 },
  steps: [],
  notes: [],
};
const viewport = { width: 390, height: 844 };
const statusOf = (checks, name) => checks.find((c) => c.check === name)?.status;
const detailOf = (checks, name) => checks.find((c) => c.check === name)?.detail;
const same = { differing: 0, outsideDaily: 0, share: 0, heightChanged: null, widthChanged: null };
const differs = (n = 55) => ({ ...same, differing: n, outsideDaily: n });
const sameRest = { takes: [same] };

describe('motion evidence: configuration', () => {
  it('keeps the marker in one constant and never matches data-motion', () => {
    expect(MARK_ATTRIBUTE).toBe('data-enter');
    const source = readFileSync(new URL('./motion-evidence.mjs', import.meta.url), 'utf8');
    expect(source).not.toMatch(/\[data-motion/u);
    expect(source.match(/['"`]data-enter['"`]/gu)).toHaveLength(1);
    expect(source).not.toMatch(/\[data-enter/u);
  });

  it('uses the strip times and allowed properties of the ticket', () => {
    expect(STRIP_TIMES).toEqual([0, 100, 200, 300, 440, 700, 1100, 1600, 2200]);
    expect(ALLOWED_PROPERTIES).toEqual(['opacity', 'transform', 'stroke-dashoffset']);
  });

  it('has a well-formed routes file with a minimum mark count on every default route', () => {
    expect(routesFile.length).toBe(12);
    for (const route of routesFile) {
      expect(route.path).toMatch(/^\/(?:.*\/)?$/u);
      expect(['changed', 'identical']).toContain(route.rest);
      expect(Number.isInteger(route.minMarks) && route.minMarks >= 0, route.path).toBe(true);
    }
    expect(new Set(routesFile.map((r) => r.path)).size).toBe(routesFile.length);
    // What main had on 2026-11-22 (3e6bcbd3): marks on these two routes only.
    expect(Object.fromEntries(routesFile.filter((r) => r.minMarks > 0).map((r) => [r.path, r.minMarks]))).toEqual({ '/numerology/': 39, '/tools/': 31 });
  });

  it('drives a phone-sized viewport by touch and the desktop by the wheel', () => {
    expect(inputFor({ width: 390, height: 844 })).toBe('touch');
    expect(inputFor({ width: 1440, height: 900 })).toBe('wheel');
  });
});

describe('motion evidence: arguments and routes', () => {
  it('parses the command line', () => {
    expect(parseArgs(['--before', 'http://127.0.0.1:4391/', '--after=http://127.0.0.1:4392', '--routes', '/numerology/,compatibility', '--check'])).toEqual({
      before: 'http://127.0.0.1:4391',
      after: 'http://127.0.0.1:4392',
      routes: ['/numerology/', 'compatibility'],
      out: 'tests/visual/artifacts/motion',
      check: true,
      marksRemoved: [],
      frameLoads: 5,
    });
  });

  it('parses --marks-removed into normalized paths and --frame-loads into a count', () => {
    const options = parseArgs(['--before', 'http://x', '--marks-removed', 'tools, /numerology/', '--frame-loads=3']);
    expect(options.marksRemoved).toEqual(['/tools/', '/numerology/']);
    expect(options.frameLoads).toBe(3);
    expect(() => parseArgs(['--before', 'http://x', '--frame-loads', '0'])).toThrow(/frame-loads/u);
    expect(() => parseArgs(['--before', 'http://x', '--frame-loads', 'many'])).toThrow(/frame-loads/u);
  });

  it('requires --before and rejects unknown flags', () => {
    expect(() => parseArgs(['--after', 'http://x'])).toThrow(/--before/u);
    expect(() => parseArgs(['--before', 'http://x', '--update'])).toThrow(/Unknown/u);
    expect(() => parseArgs(['--before'])).toThrow(/needs a value/u);
  });

  it('narrows the routes file and keeps unlisted paths', () => {
    expect(normalizePath('compatibility')).toBe('/compatibility/');
    const chosen = selectRoutes(routesFile, ['compatibility', '/nowhere/']);
    expect(chosen[0]).toEqual({ path: '/compatibility/', minMarks: 0, rest: 'identical' });
    expect(chosen[1]).toEqual({ path: '/nowhere/', rest: 'changed', unlisted: true });
    expect(selectRoutes(routesFile, null)).toBe(routesFile);
  });

  it('resolves --routes "," to no routes, which the run reports as a failure', () => {
    const options = parseArgs(['--before', 'http://x', '--routes', ',', '--check']);
    expect(options.routes).toEqual([]);
    expect(selectRoutes(routesFile, options.routes)).toEqual([]);
  });

  it('names files after the route', () => {
    expect(routeSlug('/')).toBe('home');
    expect(routeSlug('/learn/aspects/opposition/')).toBe('learn-aspects-opposition');
  });
});

describe('motion evidence: small helpers', () => {
  it('builds a short selector', () => {
    expect(shortSelector({ tag: 'H1', id: '', classes: ['display', 'hero__title', 'x'] })).toBe('h1.display.hero__title');
    expect(shortSelector({ tag: 'IMG', id: 'poster', classes: [] })).toBe('img#poster');
    expect(shortSelector(null)).toBeNull();
  });

  it('normalises property names and finds the disallowed ones', () => {
    expect(toKebab('strokeDashoffset')).toBe('stroke-dashoffset');
    expect(disallowedProperties(['opacity', 'strokeDashoffset', 'transform'])).toEqual([]);
    expect(disallowedProperties(['opacity', 'filter', 'clipPath', 'filter'])).toEqual(['clip-path', 'filter']);
  });

  it('lays out a sheet with rows below one another', () => {
    const layout = sheetLayout({ viewport, frameWidth: 195, frameCount: 9, rowCount: 2 });
    expect(layout.frameHeight).toBe(422);
    expect(layout.frame(1, 0).top).toBeGreaterThan(layout.frame(0, 0).top + layout.frameHeight);
    expect(layout.frame(0, 8).left + layout.frameWidth).toBeLessThan(layout.width);
    expect(nextFrameWidth(260)).toBe(221);
    expect(nextFrameWidth(41)).toBe(40);
  });

  it('takes a median', () => {
    expect(median([50, 16.7, 33.4])).toBe(33.4);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('motion evidence: long frames (report only)', () => {
  it('counts the gaps in the window and clips one that runs past its end', () => {
    const frames = [0, 16, 32, 100, 116, 132, 250, 266, 3000];
    // Window (20, 2520]: gaps ending at 32 (16), 100 (68), 116, 132, 250 (118), 266, and
    // 266 to 3000, which starts inside and is counted up to the end: 2254 ms.
    expect(longFrameStats(frames, 20)).toEqual({ count: 3, longest: 2254, frames: 7 });
  });

  it('counts a gap that starts before the window and ends inside it in full', () => {
    expect(longFrameStats([0, 90, 106], 50, 100)).toEqual({ count: 1, longest: 90, frames: 2 });
  });

  it('counts frames that stop before the window ends, up to when they were read', () => {
    expect(longFrameStats([0, 16, 32], 0, 500, 50, 400)).toEqual({ count: 1, longest: 368, frames: 3 });
    expect(longFrameStats([0, 16, 32], 0, 500, 50, 900)).toEqual({ count: 1, longest: 468, frames: 3 });
  });

  it('calls a window with no frames unmeasured', () => {
    expect(longFrameStats([], 0)).toMatchObject({ frames: 0, longest: null, unmeasured: expect.any(String) });
    expect(longFrameStats([0, 16, 32], 5000)).toMatchObject({ frames: 0, unmeasured: expect.any(String) });
  });

  it('reports the median, the maximum and the loads over 50 ms', () => {
    const takes = [50.1, 66.7, 33.4, 83.4, 50].map((longest) => ({ count: 1, longest, frames: 60, anchoredOn: 'load' }));
    expect(summarizeLongFrames(takes)).toMatchObject({ loads: 5, measured: 5, median: 50.1, max: 83.4, over: 3, anchoredOn: ['load'] });
    expect(summarizeLongFrames([{ notApplicable: 'no marks at load or after hydration' }])).toEqual({ loads: 1, notApplicable: 'no marks at load or after hydration' });
    expect(summarizeLongFrames([{ unmeasured: 'x' }, { longest: 40, anchoredOn: 'step 2' }])).toMatchObject({ unmeasured: 1, measured: 1, median: 40, anchoredOn: ['step 2'] });
  });

  it('never makes long frames a check, however long, and prints them side by side', () => {
    const route = { path: '/x/', rest: 'changed' };
    const slow = { ...clean, longFrames: summarizeLongFrames([{ count: 9, longest: 900, frames: 30, anchoredOn: 'load' }]) };
    const checks = evaluateChecks({ route, viewport, subject: slow, baseline: clean });
    expect(checks.find((c) => /long/iu.test(c.check))).toBeUndefined();
    expect(checks.filter((c) => c.status === 'fail')).toEqual([]);
    expect(formatNumbers(slow).longFrames).toBe('median 900 ms, max 900 ms; 1 of 1 loads over 50 ms (900); window from the first mark shown after load');
  });
});

describe('motion evidence: layout shift', () => {
  it('needs three measured takes that agree within 0.002', () => {
    expect(SETTLED_TAKES).toBe(3);
    expect(SHIFT_AGREEMENT).toBe(0.002);
    expect(settledShift(zero())).toEqual({ value: 0, values: [0, 0, 0] });
    expect(settledShift([{ value: 0.001 }, { value: 0.003 }, { value: 0.002 }])).toMatchObject({ value: 0.003 });
    expect(settledShift([{ value: 0 }, { value: 0.0025 }, { value: 0 }])).toMatchObject({ value: null, unmeasured: expect.stringMatching(/disagree/u) });
    expect(settledShift([{ value: 0 }, { value: null, unmeasured: 'not quiet within 10 s' }, { value: 0 }])).toMatchObject({ value: null, unmeasured: 'not quiet within 10 s' });
    expect(settledShift([{ value: 0 }, { value: 0 }])).toMatchObject({ value: null });
  });

  it('fails a page that never went quiet, or whose takes disagree, on either build', () => {
    const route = { path: '/x/', rest: 'changed' };
    const notQuiet = { ...clean, shiftSettled: [{ value: null, unmeasured: 'before the scroll: not quiet within 10 s' }, { value: 0 }, { value: 0 }] };
    expect(statusOf(evaluateChecks({ route, viewport, subject: notQuiet }), 'layoutShift')).toBe('fail');
    expect(detailOf(evaluateChecks({ route, viewport, subject: notQuiet }), 'layoutShift')).toMatch(/^unmeasured: before the scroll/u);
    const disagree = { ...clean, shiftSettled: [{ value: 0.49 }, { value: 0 }, { value: 0.49 }] };
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: disagree }), 'layoutShift')).toBe('fail');
    expect(detailOf(evaluateChecks({ route, viewport, subject: clean, baseline: disagree }), 'layoutShift')).toMatch(/unmeasured on the before build/u);
  });

  it('two builds: fails when the after build exceeds the before build by more than 0.002', () => {
    const t = (v) => [{ value: v }, { value: v }, { value: v }];
    expect(SHIFT_MARGIN).toBe(0.002);
    expect(settledShiftVerdict(t(0.302), t(0.3)).status).toBe('pass');
    expect(settledShiftVerdict(t(0.3025), t(0.3)).status).toBe('fail');
    expect(settledShiftVerdict(t(0.0574), t(0)).status).toBe('fail');
    expect(settledShiftVerdict(t(0), t(0.2)).status).toBe('pass');
  });

  it('one build: fails above the tool\'s own bar of 0.02 and says it is the tool\'s own', () => {
    const t = (v) => [{ value: v }, { value: v }, { value: v }];
    expect(SHIFT_SINGLE_BAR).toBe(0.02);
    expect(settledShiftVerdict(t(0.02)).status).toBe('pass');
    expect(settledShiftVerdict(t(0.0201))).toMatchObject({ status: 'fail', detail: expect.stringMatching(/tool's own/u) });
  });

  it('never judges the layout shift from load, whatever its spread', () => {
    const route = { path: '/x/', rest: 'changed' };
    const spread = { ...clean, shiftFromLoad: [0.49, 0, 0.49, 0.52, 0.28].map((value) => ({ value })) };
    expect(evaluateChecks({ route, viewport, subject: spread, baseline: clean }).filter((c) => c.status === 'fail')).toEqual([]);
    expect(formatNumbers(spread).shiftFromLoad).toBe('0.4900, 0, 0.4900, 0.5200, 0.2800');
  });
});

describe('motion evidence: mark counts', () => {
  const route = { path: '/tools/', rest: 'identical', minMarks: 31 };
  it('fails a route whose marks all go, unless --marks-removed names it', () => {
    expect(markCountCheck({ route, subjectCount: 0, baselineCount: 31, twoBuilds: true })).toMatchObject({ status: 'fail', detail: expect.stringMatching(/before 31, after 0.*--marks-removed \/tools\//u) });
    expect(markCountCheck({ route, subjectCount: 0, baselineCount: 31, twoBuilds: true, marksRemoved: ['/tools/'] }).status).toBe('pass');
    expect(markCountCheck({ route, subjectCount: 30, baselineCount: 31, twoBuilds: true }).status).toBe('pass');
    expect(markCountCheck({ route, subjectCount: 3, baselineCount: 0, twoBuilds: true }).status).toBe('pass');
    expect(markCountCheck({ route, subjectCount: null, baselineCount: 31, twoBuilds: true }).status).toBe('fail');
  });

  it('one build: fails below the route\'s minMarks', () => {
    expect(markCountCheck({ route, subjectCount: 30 })).toMatchObject({ status: 'fail', detail: expect.stringMatching(/fewer than the 31/u) });
    expect(markCountCheck({ route, subjectCount: 31 }).status).toBe('pass');
    expect(markCountCheck({ route, subjectCount: null }).status).toBe('fail');
    expect(markCountCheck({ route: { path: '/new/', rest: 'changed' }, subjectCount: 0 }).status).toBe('pass');
  });

  it('turns 31 marks to 0 into a failing run (exit 1)', () => {
    const checks = evaluateChecks({ route, viewport, subject: { ...clean, markedCount: 0 }, baseline: { ...clean, markedCount: 31 }, rest: sameRest });
    expect(statusOf(checks, 'marks')).toBe('fail');
    expect(checkExitCode({ failures: checks.filter((c) => c.status === 'fail'), routes: [{}] }, { check: true })).toBe(1);
  });
});

/**
 * Run the init script against stand-ins: a MutationObserver whose callback
 * the test drives, and elements that answer classList and matches().
 */
function runInitScript() {
  const observers = [];
  const sandbox = {
    document: { documentElement: { tagName: 'HTML' } },
    performance: { now: () => 1234 },
    MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} },
    PerformanceObserver: class { observe() {} },
    addEventListener() {},
    requestAnimationFrame() {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`(${initScript.toString()})(${JSON.stringify(baseCfg())})`, sandbox);
  const element = (classes, marked) => ({
    tagName: 'DIV',
    classList: { contains: (c) => classes.includes(c) },
    matches: (selector) => marked && selector === `[${MARK_ATTRIBUTE}]`,
  });
  const fire = (target, oldValue = '') => observers[0].fn([{ target, oldValue }]);
  return { state: sandbox.__motionEvidence, fire, element, observers };
}

/**
 * Run the init script with holdEntrances against a document whose
 * getAnimations() the test fills, and a requestAnimationFrame the test
 * steps one frame at a time.
 */
function runHoldScript(cfg = baseCfg({ holdEntrances: true })) {
  const frames = [];
  const animations = [];
  const sandbox = {
    document: { documentElement: { tagName: 'HTML' }, getAnimations: () => animations },
    performance: { now: () => 0 },
    MutationObserver: class { observe() {} },
    PerformanceObserver: class { observe() {} },
    addEventListener() {},
    requestAnimationFrame: (fn) => { frames.push(fn); },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`(${initScript.toString()})(${JSON.stringify(cfg)})`, sandbox);
  const step = () => { const pending = frames.splice(0); for (const fn of pending) fn(0); };
  const copies = [];
  const target = (marked) => ({
    tagName: 'DIV',
    closest: (selector) => (marked && selector === `[${MARK_ATTRIBUTE}]` ? {} : null),
    animate(keyframes, timing) {
      const copy = { keyframes, timing, currentTime: null, paused: false, pause() { this.paused = true; } };
      copies.push(copy);
      return copy;
    },
  });
  const css = ({ marked = true, iterations = 1, playState = 'running', kind = 'transition' } = {}) => ({
    ...(kind === 'transition' ? { transitionProperty: 'opacity' } : kind === 'animation' ? { animationName: 'spin' } : {}),
    playState,
    effect: { target: target(marked), getTiming: () => ({ delay: 120, duration: 440, iterations, fill: 'backwards' }), getKeyframes: () => [{ opacity: '0' }, { opacity: '1' }] },
  });
  return { state: sandbox.__motionEvidence, animations, step, copies, css, frames };
}

describe('motion evidence: first-view entrances held from document start', () => {
  it('copies each new finite entrance on a mark once, paused at 0 with its own timing, until told to stop', () => {
    const { state, animations, step, copies, css, frames } = runHoldScript();
    expect(state.holding).toBe(true);
    const rise = css();
    animations.push(rise);
    step();
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ paused: true, currentTime: 0, timing: { delay: 120, duration: 440, iterations: 1 } });
    expect(copies[0].keyframes).toEqual([{ opacity: '0' }, { opacity: '1' }]);
    expect(state.held).toHaveLength(1);
    expect(state.heldOriginals.has(rise)).toBe(true);
    step();
    expect(copies).toHaveLength(1);
    // a CSS animation on a stroke inside a mark counts too
    animations.push(css({ kind: 'animation' }));
    step();
    expect(copies).toHaveLength(2);
    state.holding = false;
    animations.push(css());
    step();
    expect(copies).toHaveLength(2);
    expect(frames).toHaveLength(0);
  });

  it('leaves unmarked, infinite, finished and script animations alone (its own copies included)', () => {
    const { animations, step, copies, css } = runHoldScript();
    animations.push(css({ marked: false }), css({ iterations: Infinity }), css({ playState: 'finished' }), css({ playState: 'idle' }), css({ kind: 'script' }));
    step();
    expect(copies).toHaveLength(0);
  });

  it('does nothing without holdEntrances, as in every measurement but the first view', () => {
    const { state, frames } = runHoldScript(baseCfg());
    expect(state.holding).toBeUndefined();
    expect(state.held).toBeUndefined();
    expect(frames).toHaveLength(0);
  });

  it('says so when marks were in the first screen at load and no entrance was held', () => {
    expect(firstViewCaptureNote({ held: 0, marksInView: 3 })).toBe('first-view entrances not captured');
    expect(firstViewCaptureNote({ held: 2, marksInView: 3 })).toBeNull();
    expect(firstViewCaptureNote({ held: 0, marksInView: 0 })).toBeNull();
    expect(firstViewCaptureNote({ held: null, marksInView: 0 })).toBeNull();
    expect(formatNumbers({ ...clean, strip: { animations: 0, lost: 0, held: 0, note: 'first-view entrances not captured' } }).stripAnimations).toBe('0; first-view entrances not captured');
    expect(formatNumbers(clean).stripAnimations).toBe('8');
  });
});

describe('motion evidence: first mark shown', () => {
  it('ignores a .reveal heading that gains is-in', () => {
    const { state, fire, element } = runInitScript();
    fire(element(['reveal', 'is-in'], false));
    expect(state.firstMarkShown).toBeNull();
  });

  it('counts the first marked element that gains is-in, once', () => {
    const { state, fire, element } = runInitScript();
    fire(element(['card', 'is-in'], true), 'card is-in');
    expect(state.firstMarkShown).toBeNull();
    fire(element(['card', 'is-in'], true), 'card');
    expect(state.firstMarkShown).toBe(1234);
  });

  it('records any mutation as activity for the quiet wait', () => {
    const { state, observers } = runInitScript();
    expect(state.lastActivity).toBe(0);
    observers[1].fn([{ type: 'childList' }]);
    expect(state.lastActivity).toBe(1234);
  });

  it('formats no marks as not applicable rather than "none"', () => {
    expect(formatNumbers({ ...clean, markedCount: 0, throttled: { firstPaint: 500, firstMarkShown: null } }).firstMarkShown).toBe('n/a (no marks)');
  });
});

/** Run inspectMarks against stand-in elements with fixed computed styles. */
function inspect(elements, { ancestor = {} } = {}) {
  const styles = new Map();
  const body = { tagName: 'BODY', id: '', className: '', parentElement: null };
  styles.set(body, { display: 'block', visibility: 'visible' });
  const wrapper = { tagName: 'UL', id: '', className: 'list', parentElement: body, previousElementSibling: null };
  styles.set(wrapper, { display: 'block', visibility: 'visible', ...ancestor });
  let previous = null;
  const make = ({ verb = null, opacity = '1', transform = 'none', strokes = [], rendered = true, own = null, visibility = 'visible', display = 'block', box = [100, 40] }) => {
    const strokeEls = strokes.map((offset) => {
      const s = { tagName: 'circle', className: { baseVal: 'motion-stroke' }, id: '' };
      styles.set(s, { strokeDashoffset: offset });
      return s;
    });
    const el = {
      tagName: verb === 'draw' ? 'g' : 'LI',
      id: '',
      className: 'card',
      parentElement: wrapper,
      previousElementSibling: previous,
      getAttribute: () => verb,
      getClientRects: () => (rendered ? [{}] : []),
      getBoundingClientRect: () => ({ width: box[0], height: box[1] }),
      querySelectorAll: () => strokeEls,
      ...(own ? { transform: { baseVal: { consolidate: () => ({ matrix: own }) } } } : {}),
    };
    previous = el;
    styles.set(el, { opacity, transform, visibility, display });
    return el;
  };
  const marked = elements.map(make);
  const sandbox = {
    document: { body, querySelectorAll: () => marked, getAnimations: () => [] },
    getComputedStyle: (el) => styles.get(el),
  };
  vm.createContext(sandbox);
  return vm.runInContext(`(${inspectMarks.toString()})(${JSON.stringify({ mark: MARK_ATTRIBUTE })})`, sandbox);
}

describe('motion evidence: marks shown and rendered', () => {
  it('passes rise, disc and draw marks that are fully shown', () => {
    const result = inspect([
      { verb: 'rise' },
      { verb: 'disc', transform: 'matrix(1, 0, 0, 1, 0, 0)' },
      { verb: 'draw', strokes: ['0', '0px'] },
      { verb: 'disc', transform: 'matrix(1, 0, 0, 1, 40, 12)', own: { a: 1, b: 0, c: 0, d: 1, e: 40, f: 12 } },
    ]);
    expect(result).toMatchObject({ total: 4, rendered: 4, notShown: 0, renderedVerbs: ['disc', 'draw', 'rise'] });
    expect(result.marks.map((m) => m.key)).toEqual(['ul:1>li:1', 'ul:1>li:2', 'ul:1>g:3', 'ul:1>li:4']);
  });

  it('fails a rise left transparent or offset, and a disc left scaled', () => {
    const result = inspect([
      { verb: 'rise', opacity: '0' },
      { verb: 'rise', transform: 'matrix(1, 0, 0, 1, 0, 10)' },
      { verb: 'disc', opacity: '1', transform: 'matrix(0.6, 0, 0, 0.6, 0, 0)' },
    ]);
    expect(result.notShown).toBe(3);
    expect(result.examples.join(' ')).toMatch(/opacity 0/u);
    expect(result.examples.join(' ')).toMatch(/matrix\(1, 0, 0, 1, 0, 10\)/u);
  });

  it('fails a draw whose strokes are not drawn, even at opacity 1', () => {
    const result = inspect([{ verb: 'draw', opacity: '1', strokes: ['0', '1px'] }]);
    expect(result.notShown).toBe(1);
    expect(result.examples[0]).toMatch(/stroke-dashoffset 1px/u);
  });

  it('does not count as rendered a mark with no box, visibility hidden (its own or an ancestor\'s), display none or an empty box', () => {
    expect(inspect([{ verb: 'rise', opacity: '0', rendered: false }]).marks[0]).toMatchObject({ rendered: false, absent: 'display none or no box' });
    expect(inspect([{ verb: 'rise', visibility: 'hidden' }]).marks[0]).toMatchObject({ rendered: false, absent: 'visibility hidden' });
    expect(inspect([{ verb: 'rise' }], { ancestor: { visibility: 'collapse' } }).marks[0]).toMatchObject({ rendered: false, absent: 'visibility collapse on ul.list' });
    expect(inspect([{ verb: 'rise', display: 'none' }]).marks[0]).toMatchObject({ rendered: false, absent: 'display none' });
    expect(inspect([{ verb: 'rise', box: [0, 40] }]).marks[0]).toMatchObject({ rendered: false, absent: 'empty box (0 x 40)' });
    // A hidden mark is not "shown" either: it is left out of the shown count and judged by the rendered comparison.
    expect(inspect([{ verb: 'rise', visibility: 'hidden', opacity: '0' }])).toMatchObject({ total: 1, rendered: 0, notShown: 0 });
  });

  it('passes the same marks rendered in all three modes, and marks absent in all three', () => {
    const marks = [...marksList(3), { key: 'details:1>li:1', name: 'li.closed', rendered: false, absent: 'display none' }];
    const mode = { total: 4, marks };
    const r = compareRendered({ rest: mode, reducedMotion: mode, noScript: mode });
    expect(r).toMatchObject({ problems: [], counts: { rest: 3, reducedMotion: 3, noScript: 3 }, absentInAll: 1, union: 4 });
  });

  it('fails a mark hidden under reduced motion only, naming the element and the mode', () => {
    const rest = { total: 3, marks: marksList(3) };
    const reduced = { total: 3, marks: [marksList(3)[0], { ...marksList(3)[1], rendered: false, absent: 'visibility hidden' }, marksList(3)[2]] };
    const r = compareRendered({ rest, reducedMotion: reduced, noScript: rest });
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatchObject({ mode: 'reducedMotion', detail: 'li.card is not rendered under reduced motion (visibility hidden) but is rendered at rest and with scripting off' });
    const checks = evaluateChecks({ route: { path: '/x/', rest: 'changed' }, viewport, subject: { ...clean, shownAtRest: { ...shownAll(3), marks: rest.marks }, reducedMotion: { ...shownAll(3), rendered: 2, marks: reduced.marks }, noScript: { ...shownAll(3), marks: rest.marks } } });
    expect(statusOf(checks, 'marksRendered')).toBe('fail');
    expect(detailOf(checks, 'marksRendered')).toMatch(/under reduced motion \(visibility hidden\)/u);
    expect(checkExitCode({ failures: checks.filter((c) => c.status === 'fail'), routes: [{}] }, { check: true })).toBe(1);
  });

  it('fails a mark that is display none with scripting off, or missing from that DOM', () => {
    const rest = { total: 2, marks: marksList(2) };
    const none = compareRendered({ rest, reducedMotion: rest, noScript: { total: 2, marks: [marksList(2)[0], { ...marksList(2)[1], rendered: false, absent: 'display none' }] } });
    expect(none.problems.map((p) => p.mode)).toEqual(['noScript']);
    expect(none.problems[0].detail).toMatch(/with scripting off \(display none\)/u);
    const gone = compareRendered({ rest, reducedMotion: rest, noScript: { total: 1, marks: [marksList(2)[0]] } });
    expect(gone.problems[0].detail).toMatch(/with scripting off \(not in the DOM\)/u);
  });

  it('fails the rendered check when a mode was not measured', () => {
    const checks = evaluateChecks({ route: { path: '/x/', rest: 'changed' }, viewport, subject: { ...clean, noScript: null } });
    expect(statusOf(checks, 'marksRendered')).toBe('fail');
    expect(detailOf(checks, 'marksRendered')).toMatch(/not measured with scripting off/u);
  });
});

describe('motion evidence: rest state', () => {
  it('reports identical pages as 0', () => {
    const result = compareRest(solid(20, 30), solid(20, 30));
    expect(result).toMatchObject({ differing: 0, share: 0, heightChanged: null, dailyOnly: false });
  });

  it('compares the common area when the height changes', () => {
    const a = solid(20, 30);
    const b = paint(solid(20, 40), 0, 30, 20, 10, [250, 250, 250]);
    const result = compareRest(a, b);
    expect(result.heightChanged).toEqual({ from: 30, to: 40 });
    expect(result.height).toBe(30);
    expect(result.differing).toBe(0);
  });

  it('calls a diff inside the daily-data boxes daily data', () => {
    const a = solid(40, 40);
    const b = paint(solid(40, 40), 5, 5, 10, 4, [240, 200, 20]);
    const inside = compareRest(a, b, { dailyRects: [{ x: 4, y: 4, width: 12, height: 6 }] });
    expect(inside.differing).toBeGreaterThan(0);
    expect(inside.dailyOnly).toBe(true);
    expect(inside.outsideDaily).toBe(0);
    const outside = compareRest(a, paint(b, 30, 30, 4, 4, [240, 200, 20]), { dailyRects: [{ x: 4, y: 4, width: 12, height: 6 }] });
    expect(outside.dailyOnly).toBe(false);
    expect(outside.outsideDaily).toBe(16);
  });

  it('counts mask pixels outside rects and finds the box around them', () => {
    const mask = Buffer.alloc(4 * 4 * 4);
    mask[(1 * 4 + 1) * 4 + 3] = 255;
    mask[(3 * 4 + 3) * 4 + 3] = 255;
    expect(countOutsideRects(mask, 4, 4, [{ x: 0, y: 0, width: 2, height: 2 }])).toBe(1);
    expect(maskBounds(mask, 4, 4)).toEqual({ x: 1, y: 1, width: 3, height: 3 });
    expect(maskBounds(Buffer.alloc(16 * 4), 4, 4)).toBeNull();
    const kept = compareRest(solid(10, 10), paint(solid(10, 10), 2, 3, 2, 2, [250, 250, 250]), { keepMask: true });
    expect(maskBounds(kept.mask, 10, 10)).toEqual({ x: 2, y: 3, width: 2, height: 2 });
  });

  it('fails a missing 24 x 24 icon on a long page on both pairs', () => {
    const route = { path: '/x/', rest: 'identical' };
    const a = paint(solid(390, 4000), 100, 2000, 24, 24, [220, 220, 220]);
    const take = compareRest(a, solid(390, 4000));
    expect(take.differing).toBe(576);
    expect(MAX_REST_PIXELS).toBe(0);
    expect(restNeedsRetake([take])).toBe(true);
    expect(restNeedsRetake([take, take])).toBe(false);
    const checks = evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest: { takes: [take, take] } });
    expect(statusOf(checks, 'rest')).toBe('fail');
    expect(detailOf(checks, 'rest')).toBe('differs on both pairs (take 1: 576 px, take 2: 576 px; limit 0)');
  });

  it('classifies a take as same, daily or differs', () => {
    expect(restTakeKind(same)).toBe('same');
    expect(restTakeKind(differs(1))).toBe('differs');
    expect(restTakeKind({ ...same, differing: 300, outsideDaily: 0 })).toBe('daily');
    expect(restTakeKind({ ...same, heightChanged: { from: 10, to: 20 } })).toBe('differs');
    expect(restTakeKind({ ...same, widthChanged: { from: 390, to: 400 } })).toBe('differs');
    expect(restTakeKind(null)).toBe('unmeasured');
  });

  it('retakes a differing pair once, and a third time only when the retake was the same', () => {
    expect(restNeedsRetake([same])).toBe(false);
    expect(restNeedsRetake([{ ...same, differing: 300, outsideDaily: 0 }])).toBe(false);
    expect(restNeedsRetake([differs()])).toBe(true);
    expect(restNeedsRetake([differs(), differs()])).toBe(false);
    expect(restNeedsRetake([differs(), same])).toBe(true);
    expect(restNeedsRetake([differs(), same, same])).toBe(false);
    expect(restNeedsRetake([differs(), same, differs()])).toBe(false);
  });

  it('decides pass, fail and unstable over the takes, and reports every count', () => {
    expect(restVerdict([same]).status).toBe('pass');
    expect(restVerdict([differs(55), differs(55)])).toEqual({ status: 'fail', detail: 'differs on both pairs (take 1: 55 px, take 2: 55 px; limit 0)' });
    expect(restVerdict([differs(55), same, differs(40)])).toEqual({ status: 'fail', detail: 'differs again on the third pair (take 1: 55 px, take 2: 0 px, take 3: 40 px; limit 0)' });
    expect(restVerdict([differs(55), same, same])).toEqual({ status: 'unstable', detail: 'unstable capture: differed once in three pairs (take 1: 55 px, take 2: 0 px, take 3: 0 px)' });
    // A needed take that is missing never passes.
    expect(restVerdict([differs(55)]).status).toBe('fail');
    expect(restVerdict([differs(55), same]).status).toBe('fail');
    expect(restVerdict([differs(55), null]).status).toBe('fail');
    expect(restVerdict([null]).status).toBe('fail');
    expect(restVerdict([]).status).toBe('fail');
    expect(restVerdict([{ ...same, heightChanged: { from: 4000, to: 3800 } }, { ...same, heightChanged: { from: 4000, to: 3800 } }]).detail).toMatch(/height 4000 to 3800 px/u);
  });

  it('lists an unstable capture without failing the run, and fails one that recurs', () => {
    const route = { path: '/x/', rest: 'identical' };
    const unstable = evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest: { takes: [differs(55), same, same] } });
    expect(statusOf(unstable, 'rest')).toBe('unstable');
    expect(checkExitCode({ failures: unstable.filter((c) => c.status === 'fail'), routes: [{}] }, { check: true })).toBe(0);
    const recurs = evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest: { takes: [differs(55), same, differs(55)] } });
    expect(checkExitCode({ failures: recurs.filter((c) => c.status === 'fail'), routes: [{}] }, { check: true })).toBe(1);
  });

  it('notes daily data only when the pixels outside it are within the bar', () => {
    const route = { path: '/x/', rest: 'identical' };
    const rest = { takes: [{ ...same, differing: 5000, outsideDaily: 0 }] };
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest }), 'rest')).toBe('note');
    expect(restNeedsRetake([{ ...same, differing: 5000, outsideDaily: 13 }])).toBe(true);
  });

  it('judges the rest state only for identical routes with two builds', () => {
    const route = { path: '/x/', rest: 'identical' };
    const over = { takes: [differs(900), differs(900)] };
    expect(statusOf(evaluateChecks({ route: { ...route, rest: 'changed' }, viewport, subject: clean, baseline: clean, rest: over }), 'rest')).toBeUndefined();
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, rest: over }), 'rest')).toBeUndefined();
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest: null }), 'rest')).toBe('fail');
  });
});

describe('motion evidence: hard checks', () => {
  const route = { path: '/x/', rest: 'identical', primaryAction: 'form button[type=submit]' };

  it('passes a clean build', () => {
    const checks = evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest: sameRest });
    expect(checks.filter((c) => c.status !== 'pass')).toEqual([]);
    expect(checks.map((c) => c.check)).toEqual(['http', 'layoutShift', 'marks', 'lcpMarked', 'largestMarked', 'rootMarked', 'hiddenAboveAfterReload',
      'marksShownAtRest', 'reducedMotion', 'noScript', 'marksRendered', 'animatedProperties', 'rest', 'primaryAction']);
  });

  it('fails the defects found in PR #1096', () => {
    const subject = { ...clean, nestedMarks: 12, hiddenAboveAfterReload: 25, rootMarked: true, lcpMarked: true, primaryActionTop: 839 };
    const checks = evaluateChecks({ route, viewport, subject, baseline: { ...clean, primaryActionTop: 689 }, rest: sameRest });
    for (const name of ['hiddenAboveAfterReload', 'rootMarked', 'lcpMarked', 'primaryAction']) {
      expect(statusOf(checks, name), name).toBe('fail');
    }
    expect(statusOf(checks, 'nestedMarks')).toBeUndefined();
  });

  it('fails a marked largest above-the-fold block even when the LCP entry missed it', () => {
    const subject = { ...clean, lcpMarked: false, largest: { kind: 'text block', area: 90000, selector: 'h1.hero', marked: true } };
    const checks = evaluateChecks({ route, viewport, subject });
    expect(statusOf(checks, 'lcpMarked')).toBe('pass');
    expect(statusOf(checks, 'largestMarked')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, largest: null } }), 'largestMarked')).toBe('fail');
  });

  it('fails a property outside opacity, transform and stroke-dashoffset', () => {
    const checks = evaluateChecks({ route, viewport, subject: { ...clean, animatedProperties: ['filter', 'opacity'] } });
    expect(statusOf(checks, 'animatedProperties')).toBe('fail');
  });

  it('does not pass animated properties for a kind of mark it never sampled', () => {
    const subject = { ...clean, markedVerbs: ['draw', 'rise'], sampledVerbs: ['rise'] };
    const checks = evaluateChecks({ route, viewport, subject });
    expect(statusOf(checks, 'animatedProperties')).toBe('fail');
    expect(detailOf(checks, 'animatedProperties')).toMatch(/no entrance was sampled for draw/u);
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, markedVerbs: ['rise'], sampledVerbs: [], animatedProperties: [] } }), 'animatedProperties')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, markedVerbs: [], sampledVerbs: [], animatedProperties: [] } }), 'animatedProperties')).toBe('pass');
  });

  it('fails marks left hidden at rest, with reduced motion or without scripting', () => {
    const hidden = { ...shownAll(), notShown: 1, examples: ['g (draw): stroke-dashoffset 1px'] };
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, shownAtRest: hidden } }), 'marksShownAtRest')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, shownAtRest: null } }), 'marksShownAtRest')).toBe('fail');
    const checks = evaluateChecks({ route, viewport, subject: { ...clean, reducedMotion: { ...shownAll(), running: 2 }, noScript: hidden } });
    expect(statusOf(checks, 'reducedMotion')).toBe('fail');
    expect(statusOf(checks, 'noScript')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, reducedMotion: hidden } }), 'reducedMotion')).toBe('fail');
  });

  it('fails a reload whose scroll position was not restored', () => {
    const subject = { ...clean, hiddenAboveAfterReload: null, reload: { before: 3000, after: 0, path: 'unmeasured', reason: 'scroll was 3000 px before the reload, 0 px after it' } };
    const checks = evaluateChecks({ route, viewport, subject });
    expect(statusOf(checks, 'hiddenAboveAfterReload')).toBe('fail');
    expect(detailOf(checks, 'hiddenAboveAfterReload')).toMatch(/^unmeasured: scroll was 3000 px/u);
    const noMarks = evaluateChecks({ route, viewport, subject: { ...clean, hiddenAboveAfterReload: 0, reload: { before: 3000, after: 0, path: 'no marks', notApplicable: true } } });
    expect(statusOf(noMarks, 'hiddenAboveAfterReload')).toBe('n/a');
    const explicit = evaluateChecks({ route, viewport, subject: { ...clean, reload: { before: 3000, after: 3000, path: 'explicit restore (native gave 0 px)' } } });
    expect(statusOf(explicit, 'hiddenAboveAfterReload')).toBe('pass');
    expect(detailOf(explicit, 'hiddenAboveAfterReload')).toContain('explicit restore');
  });

  it('fails a primary action that is missing on the after build, or on either', () => {
    const lost = evaluateChecks({ route, viewport, subject: { ...clean, primaryActionTop: null }, baseline: clean, rest: sameRest });
    expect(statusOf(lost, 'primaryAction')).toBe('fail');
    expect(detailOf(lost, 'primaryAction')).toMatch(/missing on the after build/u);
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: { ...clean, primaryActionTop: null }, rest: sameRest }), 'primaryAction')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, primaryActionTop: null } }), 'primaryAction')).toBe('fail');
  });

  it('fails a scripted step that did not run, on either build', () => {
    const skipped = [{ label: 'click form button[type=submit]', skipped: 'form button[type=submit] not found' }];
    const checks = evaluateChecks({ route, viewport, subject: { ...clean, steps: skipped }, baseline: clean, rest: sameRest });
    expect(statusOf(checks, 'step 1')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: { ...clean, steps: skipped }, rest: sameRest }), 'step 1 (before)')).toBe('fail');
  });

  it('fails an error page on either build and measures nothing else on it', () => {
    const notFound = { http: { url: 'http://127.0.0.1:4391/nowhere/', status: 404 }, steps: [], notes: [] };
    const checks = evaluateChecks({ route, viewport, subject: notFound });
    expect(checks).toEqual([{ check: 'http', status: 'fail', detail: 'http://127.0.0.1:4391/nowhere/ returned HTTP 404' }]);
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: notFound, rest: null }), 'http (before)')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, http: { url: 'x', status: null, error: 'ECONNREFUSED' } } }), 'http')).toBe('fail');
  });

  it('fails reduced-motion and no-script measurements that are missing', () => {
    const checks = evaluateChecks({ route, viewport, subject: { ...clean, noScript: null, rootMarked: null } });
    expect(statusOf(checks, 'noScript')).toBe('fail');
    expect(statusOf(checks, 'rootMarked')).toBe('fail');
  });
});

describe('motion evidence: exit code', () => {
  const report = (failures, routes = [{ path: '/x/' }]) => ({ failures, routes });
  it('exits 1 under --check on any failure, 0 otherwise', () => {
    expect(checkExitCode(report([]), { check: true })).toBe(0);
    expect(checkExitCode(report([{ check: 'layoutShift' }]), { check: true })).toBe(1);
    expect(checkExitCode(report([{ check: 'layoutShift' }]), { check: false })).toBe(0);
  });

  it('exits 1 under --check when no route was measured', () => {
    expect(checkExitCode(report([], []), { check: true })).toBe(1);
  });

  it('exits 1 for a run whose only problem is an unmeasured layout shift, and 0 for a run with only report-only numbers', () => {
    const route = { path: '/x/', rest: 'changed' };
    const fails = (subject) => evaluateChecks({ route, viewport, subject }).filter((c) => c.status === 'fail');
    const unmeasured = fails({ ...clean, shiftSettled: [{ value: 0 }, { value: 0.01 }, { value: 0 }] });
    expect(unmeasured.map((c) => c.check)).toEqual(['layoutShift']);
    expect(checkExitCode(report(unmeasured), { check: true })).toBe(1);
    const noisy = fails({ ...clean, longFrames: summarizeLongFrames([{ longest: 200 }, { longest: 16.7 }]), shiftFromLoad: [{ value: 0.5 }, { value: 0 }] });
    expect(checkExitCode(report(noisy), { check: true })).toBe(0);
  });
});

describe('motion evidence: summary', () => {
  it('puts before and after side by side, says which numbers are report only and uses no long dashes', () => {
    const report = {
      generatedAt: '2026-11-22T00:00:00.000Z',
      before: 'http://127.0.0.1:4391',
      after: 'http://127.0.0.1:4392',
      viewports: ['390x844'],
      failures: [],
      unstable: [{ path: '/x/', viewport: '390x844', detail: 'unstable capture: differed once in three pairs (take 1: 55 px, take 2: 0 px, take 3: 0 px)' }],
      markCounts: [{ path: '/x/', viewport: '390x844', before: 31, after: 30 }],
      restImages: [{ path: '/x/', viewport: '390x844', take: 1, differing: 55, before: 'rest-x-390x844-take1-before.png', after: 'rest-x-390x844-take1-after.png', diff: 'rest-x-390x844-take1-diff.png' }],
      routes: [{
        path: '/x/', rest: 'identical', loops: { before: ['drift on img.poster'], after: [] }, sheets: [{ label: 'first view', file: 'x.webp' }],
        viewports: { '390x844': { before: clean, after: clean, rest: sameRest, checks: [] } },
      }],
    };
    const md = renderSummary(report);
    expect(md).toContain('| | before 390x844 | after 390x844 |');
    expect(md).toContain('| Rest diff |  | 0 px |');
    expect(md).toContain('| Layout shift, settled then scroll (hard) | 0 (takes 0.0000, 0.0000, 0.0000) |');
    expect(md).toContain('| Layout shift, scroll from load (report only, each take) | 0, 0.3000, 0, 0.3100, 0 |');
    expect(md).toContain(LONG_FRAME_NOTE);
    expect(md).toContain(FROM_LOAD_NOTE);
    expect(LONG_FRAME_NOTE).toMatch(/the tool does not fail on them/u);
    expect(FROM_LOAD_NOTE).toMatch(/late styles or hydration/u);
    expect(FROM_LOAD_NOTE).toMatch(/sometimes 0/u);
    expect(md).toContain('## Unstable captures');
    expect(md).toContain('- /x/ 390x844: unstable capture: differed once in three pairs');
    expect(md).toContain('- /x/ 390x844: 31 to 30');
    expect(md).toContain('[diff](rest-x-390x844-take1-diff.png)');
    expect(md).toContain('drift on img.poster');
    expect(md).toContain('a proxy, not a phone');
    expect(md).toContain('| Entrances played during the scroll-through | 4 (touch, 9 touchstart events) |');
    expect(md).toContain('| Marks rendered (rest / reduced motion / no script) | 4 / 4 / 4 of 4 in the DOM |');
    expect(md).not.toMatch(/[–—]/u);
    expect(formatNumbers(clean).firstMarkShown).toBe('850 ms (+350 after paint)');
    expect(formatNumbers(clean).shownAtRest).toBe('4 of 4 shown');
  });
});

describe('motion evidence: unmeasured takes in the reports', () => {
  const route = { path: '/x/', rest: 'identical' };
  const reportFor = (rest, subject = clean) => {
    const checks = evaluateChecks({ route, viewport, subject, baseline: clean, rest });
    return {
      checks,
      report: {
        generatedAt: '2026-11-23T00:00:00.000Z',
        before: 'http://127.0.0.1:4391',
        after: 'http://127.0.0.1:4392',
        viewports: ['390x844'],
        failures: checks.filter((c) => c.status === 'fail').map((c) => ({ path: '/x/', viewport: '390x844', check: c.check, detail: c.detail })),
        unstable: [],
        markCounts: [],
        restImages: [],
        routes: [
          { path: '/x/', rest: 'identical', loops: {}, sheets: [], viewports: { '390x844': { before: clean, after: subject, rest, checks } } },
          { path: '/y/', rest: 'identical', loops: {}, sheets: [], viewports: { '390x844': { before: clean, after: clean, rest: sameRest, checks: [] } } },
        ],
      },
    };
  };
  const section = (md, path) => md.slice(md.indexOf(`## ${path} `), md.indexOf('## /y/ '));
  const cases = [
    ['[null]', [null], /unmeasured/u],
    ['[{ unmeasured }]', [{ unmeasured: 'the after page never became quiet' }], /not compared \(the after page never became quiet\)/u],
    ['[null, take]', [null, same], /unmeasured/u],
    ['[differs, null]', [differs(55), null], /take 2: unmeasured/u],
    ['[differs, { unmeasured }]', [differs(55), { unmeasured: 'the before capture failed' }], /take 2: unmeasured \(the before capture failed\)/u],
    ['[differs, same, null]', [differs(55), same, null], /take 3: unmeasured/u],
  ];
  for (const [name, takes, pattern] of cases) {
    it(`renders rest takes ${name} as unmeasured, fails the rest check and exits 1, and still reports the next route`, () => {
      const { checks, report } = reportFor({ takes });
      let md;
      expect(() => { md = renderSummary(report); }).not.toThrow();
      let html;
      expect(() => { html = renderReport(report); }).not.toThrow();
      expect(statusOf(checks, 'rest')).toBe('fail');
      expect(detailOf(checks, 'rest')).toMatch(/^unmeasured/u);
      expect(detailOf(checks, 'rest')).toMatch(pattern);
      expect(checkExitCode(report, { check: true })).toBe(1);
      expect(section(md, '/x/')).toMatch(/\| Rest diff \|  \| [^|]*unmeasured/u);
      expect(md).toContain('## /y/ (rest: identical)');
      expect(md).toMatch(/## \/y\/ \(rest: identical\)[\s\S]*\| Rest diff \|  \| 0 px \|/u);
      expect(html).toMatch(/<td>Rest diff<\/td><td><\/td><td>[^<]*unmeasured/u);
      expect(html).toContain('<h2>/y/ <small>');
      const json = JSON.parse(JSON.stringify(report));
      expect(json.routes[0].viewports['390x844'].rest.takes).toHaveLength(takes.length);
    });
  }

  it('never passes, retakes or reads as a difference an unmeasured take', () => {
    expect(restTakeKind(null)).toBe('unmeasured');
    expect(restTakeKind({ unmeasured: 'x' })).toBe('unmeasured');
    expect(restNeedsRetake([null])).toBe(false);
    expect(restNeedsRetake([{ unmeasured: 'x' }])).toBe(false);
    expect(restVerdict([differs(55), null]).detail).not.toMatch(/differs on both pairs/u);
    expect(restVerdict([]).detail).toMatch(/^unmeasured/u);
  });

  it('renders null layout-shift takes and failed throttled loads as unmeasured without throwing', () => {
    const subject = { ...clean, shiftSettled: [null, { value: 0 }, { value: null, unmeasured: 'the load failed (see notes)' }], shiftFromLoad: [null, { value: 0 }], longFrames: summarizeLongFrames([null, { unmeasured: 'the throttled load failed' }]), strip: null };
    const { checks, report } = reportFor(sameRest, subject);
    expect(statusOf(checks, 'layoutShift')).toBe('fail');
    expect(detailOf(checks, 'layoutShift')).toMatch(/^unmeasured/u);
    expect(checkExitCode(report, { check: true })).toBe(1);
    const n = formatNumbers(subject);
    expect(n.shiftSettled).toMatch(/^unmeasured \(unmeasured, 0\.0000, unmeasured\)/u);
    expect(n.shiftFromLoad).toBe('unmeasured, 0');
    expect(n.longFrames).toBe('unmeasured in all 2 loads');
    expect(() => renderSummary(report)).not.toThrow();
    expect(() => renderReport(report)).not.toThrow();
  });
});
