/**
 * The motion evidence harness's pure helpers (ZOD-294): argument parsing,
 * route selection, the rest-state comparison, long-frame counting, sheet
 * geometry, the hard checks and the exit code. Two in-page functions (the
 * init script's first-mark watcher and the marks-shown inspection) run here
 * against small stand-ins for the DOM; the rest of the browser side is
 * exercised by running the harness against two builds.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_PROPERTIES, baseCfg, checkExitCode, compareRest, countOutsideRects, disallowedProperties, evaluateChecks, formatNumbers,
  initScript, inspectMarks, LONG_FRAME_MS, longFrameLimit, longFrameStats, longFrameVerdict, MARK_ATTRIBUTE, MAX_REST_PIXELS,
  nextFrameWidth, normalizePath, parseArgs, renderSummary, routeSlug, selectRoutes, sheetLayout, shortSelector, STRIP_TIMES, toKebab,
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

const shownAll = (n = 4) => ({ total: n, rendered: n, notShown: 0, examples: [], running: 0 });
const clean = {
  http: { url: 'http://127.0.0.1:4391/x/', status: 200 },
  cls: 0,
  lcp: { time: 400, selector: 'h1.display' },
  lcpMarked: false,
  largest: { kind: 'text block', area: 40000, selector: 'h1.display', marked: false },
  longFrames: { count: 0, longest: 33.4, frames: 70 },
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
const sameRest = { differing: 0, outsideDaily: 0, share: 0, heightChanged: null, widthChanged: null };

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

  it('has a well-formed routes file', () => {
    expect(routesFile.length).toBe(12);
    for (const route of routesFile) {
      expect(route.path).toMatch(/^\/(?:.*\/)?$/u);
      expect(['changed', 'identical']).toContain(route.rest);
    }
    expect(new Set(routesFile.map((r) => r.path)).size).toBe(routesFile.length);
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
    });
  });

  it('requires --before and rejects unknown flags', () => {
    expect(() => parseArgs(['--after', 'http://x'])).toThrow(/--before/u);
    expect(() => parseArgs(['--before', 'http://x', '--update'])).toThrow(/Unknown/u);
    expect(() => parseArgs(['--before'])).toThrow(/needs a value/u);
  });

  it('narrows the routes file and keeps unlisted paths', () => {
    expect(normalizePath('compatibility')).toBe('/compatibility/');
    const chosen = selectRoutes(routesFile, ['compatibility', '/nowhere/']);
    expect(chosen[0]).toEqual({ path: '/compatibility/', rest: 'identical' });
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
});

describe('motion evidence: long frames', () => {
  it('counts the gaps in the window and clips one that runs past its end', () => {
    const frames = [0, 16, 32, 100, 116, 132, 250, 266, 3000];
    // Window (20, 2520]: gaps ending at 32 (16), 100 (68), 116, 132, 250 (118), 266, and
    // 266 to 3000, which starts inside and is counted up to the end: 2254 ms.
    // The old code dropped that last gap and reported { count: 2, longest: 118, frames: 6 }.
    expect(longFrameStats(frames, 20)).toEqual({ count: 3, longest: 2254, frames: 7 });
  });

  it('counts a gap that starts before the window and ends inside it in full', () => {
    expect(longFrameStats([0, 90, 106], 50, 100)).toEqual({ count: 1, longest: 90, frames: 2 });
  });

  it('counts frames that stop before the window ends, up to when they were read', () => {
    expect(longFrameStats([0, 16, 32], 0, 500, 50, 400)).toEqual({ count: 1, longest: 368, frames: 3 });
    expect(longFrameStats([0, 16, 32], 0, 500, 50, 900)).toEqual({ count: 1, longest: 468, frames: 3 });
  });

  it('calls a window with no frames unmeasured, never a pass', () => {
    // The old code returned { count: 0, longest: 0, frames: 0 }, which the checks passed.
    expect(longFrameStats([], 0)).toMatchObject({ frames: 0, longest: null, unmeasured: expect.any(String) });
    expect(longFrameStats([0, 16, 32], 5000)).toMatchObject({ frames: 0, unmeasured: expect.any(String) });
    const checks = evaluateChecks({ route: { path: '/x/', rest: 'changed' }, viewport, subject: { ...clean, longFrames: longFrameStats([], 0) } });
    expect(statusOf(checks, 'longFrames')).toBe('fail');
    expect(detailOf(checks, 'longFrames')).toMatch(/^unmeasured/u);
  });

  it('allows max(50 ms, reference x 1.5 + one frame)', () => {
    expect(longFrameLimit(20)).toBe(50);
    expect(longFrameLimit(33.4)).toBe(66.8);
    expect(longFrameLimit(60)).toBe(106.7);
    expect(longFrameLimit(116.7)).toBe(191.7);
  });

  it('decides pass, note and fail at the boundaries', () => {
    expect(longFrameVerdict(50, null)).toBe('pass');
    expect(longFrameVerdict(50.1, null)).toBe('fail');
    // Reference within the bar: the absolute 50 ms bar holds.
    expect(longFrameVerdict(50.1, 33.4)).toBe('fail');
    expect(longFrameVerdict(60, 50)).toBe('fail');
    // Reference over the bar: a note while not materially worse, a failure beyond the limit.
    expect(longFrameVerdict(106.7, 60)).toBe('note');
    expect(longFrameVerdict(106.8, 60)).toBe('fail');
    expect(longFrameVerdict(900, 60)).toBe('fail');
    expect(longFrameVerdict(40, 60)).toBe('pass');
  });

  it('fails a much worse page on a slow runner (60 ms without marks, 900 ms with them)', () => {
    // The old check set this aside as "runner too slow to judge" and exited 0.
    const route = { path: '/x/', rest: 'changed' };
    const subject = { ...clean, longFrames: { count: 9, longest: 900, frames: 30 }, longFramesReference: { count: 1, longest: 60, frames: 140 } };
    const checks = evaluateChecks({ route, viewport, subject });
    expect(statusOf(checks, 'longFrames')).toBe('fail');
    expect(detailOf(checks, 'longFrames')).toContain('over 106.7 ms');
    expect(detailOf(checks, 'longFrames')).toContain('with marks removed');
  });

  it('notes a slow runner only when the page is not materially worse, and says what the reference is', () => {
    const route = { path: '/x/', rest: 'changed' };
    const subject = { ...clean, longFrames: { count: 2, longest: 90, frames: 60 }, longFramesReference: { count: 2, longest: 83.3, frames: 60 } };
    const checks = evaluateChecks({ route, viewport, subject });
    expect(statusOf(checks, 'longFrames')).toBe('note');
    expect(detailOf(checks, 'longFrames')).toMatch(/runner too slow for the absolute 50 ms bar/u);
    expect(detailOf(checks, 'longFrames')).toMatch(/83\.3 ms with marks removed \(same build, same window\)/u);
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...subject, longFramesReference: { count: 0, longest: 33, frames: 70 } } }), 'longFrames')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...subject, longFramesReference: null } }), 'longFrames')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...subject, longFramesReference: { unmeasured: 'x' } } }), 'longFrames')).toBe('fail');
  });

  it('takes the better of the first take and the retake', () => {
    const route = { path: '/x/', rest: 'changed' };
    const subject = { ...clean, longFrames: { count: 3, longest: 300, frames: 40 }, longFramesReference: { longest: 83.3, count: 1, frames: 60 }, longFramesRetake: { longest: 100, count: 1, frames: 60 } };
    expect(statusOf(evaluateChecks({ route, viewport, subject }), 'longFrames')).toBe('note');
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...subject, longFramesRetake: { longest: 250, count: 2, frames: 60 } } }), 'longFrames')).toBe('fail');
  });

  it('reports long frames as not applicable on a page with no marks', () => {
    const route = { path: '/x/', rest: 'changed' };
    const checks = evaluateChecks({ route, viewport, subject: { ...clean, markedCount: 0, markedVerbs: [], sampledVerbs: [], longFrames: { notApplicable: 'no marks' } } });
    expect(statusOf(checks, 'longFrames')).toBe('n/a');
    expect(detailOf(checks, 'longFrames')).toBe('not applicable: no marks');
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
  return { state: sandbox.__motionEvidence, fire, element };
}

describe('motion evidence: first mark shown', () => {
  it('ignores a .reveal heading that gains is-in', () => {
    // The old watcher counted any element gaining is-in, so this read 1234 ms.
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

  it('formats no marks as not applicable rather than "none"', () => {
    expect(formatNumbers({ ...clean, markedCount: 0, throttled: { firstPaint: 500, firstMarkShown: null } }).firstMarkShown).toBe('n/a (no marks)');
  });
});

/** Run inspectMarks against stand-in elements with fixed computed styles. */
function inspect(elements) {
  const styles = new Map();
  const make = ({ verb = null, opacity = '1', transform = 'none', strokes = [], rendered = true, own = null }) => {
    const strokeEls = strokes.map((offset) => {
      const s = { tagName: 'circle', className: { baseVal: 'motion-stroke' }, id: '' };
      styles.set(s, { strokeDashoffset: offset });
      return s;
    });
    const el = {
      tagName: verb === 'draw' ? 'g' : 'DIV',
      id: '',
      className: 'card',
      getAttribute: () => verb,
      getClientRects: () => (rendered ? [{}] : []),
      querySelectorAll: () => strokeEls,
      ...(own ? { transform: { baseVal: { consolidate: () => ({ matrix: own }) } } } : {}),
    };
    styles.set(el, { opacity, transform });
    return el;
  };
  const marked = elements.map(make);
  const sandbox = {
    document: { querySelectorAll: () => marked, getAnimations: () => [] },
    getComputedStyle: (el) => styles.get(el),
  };
  vm.createContext(sandbox);
  return vm.runInContext(`(${inspectMarks.toString()})(${JSON.stringify({ mark: MARK_ATTRIBUTE })})`, sandbox);
}

describe('motion evidence: marks shown', () => {
  it('passes rise, disc and draw marks that are fully shown', () => {
    const result = inspect([
      { verb: 'rise' },
      { verb: 'disc', transform: 'matrix(1, 0, 0, 1, 0, 0)' },
      { verb: 'draw', strokes: ['0', '0px'] },
      { verb: 'disc', transform: 'matrix(1, 0, 0, 1, 40, 12)', own: { a: 1, b: 0, c: 0, d: 1, e: 40, f: 12 } },
    ]);
    expect(result).toMatchObject({ total: 4, rendered: 4, notShown: 0, renderedVerbs: ['disc', 'draw', 'rise'] });
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
    // The old check read only the marked element's opacity, which a draw never changes.
    const result = inspect([{ verb: 'draw', opacity: '1', strokes: ['0', '1px'] }]);
    expect(result.notShown).toBe(1);
    expect(result.examples[0]).toMatch(/stroke-dashoffset 1px/u);
  });

  it('counts a mark with no box apart, as not rendered', () => {
    expect(inspect([{ verb: 'rise', opacity: '0', rendered: false }])).toMatchObject({ total: 1, rendered: 0, notShown: 0 });
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

  it('counts mask pixels outside rects', () => {
    const mask = Buffer.alloc(4 * 4 * 4);
    mask[(1 * 4 + 1) * 4 + 3] = 255;
    mask[(3 * 4 + 3) * 4 + 3] = 255;
    expect(countOutsideRects(mask, 4, 4, [{ x: 0, y: 0, width: 2, height: 2 }])).toBe(1);
  });

  it('fails a missing 24 x 24 icon on a long page, which the old 0.1% share allowed', () => {
    const route = { path: '/x/', rest: 'identical' };
    const a = paint(solid(390, 4000), 100, 2000, 24, 24, [220, 220, 220]);
    const rest = compareRest(a, solid(390, 4000));
    expect(rest.differing).toBe(576);
    expect(rest.share).toBeLessThan(0.001);
    expect(MAX_REST_PIXELS).toBeLessThan(576);
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest }), 'rest')).toBe('fail');
  });

  it('passes a difference within the noise bar and fails one above it', () => {
    const route = { path: '/x/', rest: 'identical' };
    const at = (differing) => statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest: { ...sameRest, differing, outsideDaily: differing } }), 'rest');
    expect(at(MAX_REST_PIXELS)).toBe('pass');
    expect(at(MAX_REST_PIXELS + 1)).toBe('fail');
  });

  it('fails a width or height change', () => {
    const route = { path: '/x/', rest: 'identical' };
    const widthChanged = compareRest(solid(390, 100), solid(400, 100));
    expect(widthChanged.widthChanged).toEqual({ from: 390, to: 400 });
    expect(widthChanged.differing).toBe(0);
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest: widthChanged }), 'rest')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest: { ...sameRest, heightChanged: { from: 10, to: 20 } } }), 'rest')).toBe('fail');
  });

  it('notes daily data only when the pixels outside it are within the bar', () => {
    const route = { path: '/x/', rest: 'identical' };
    const rest = { ...sameRest, differing: 5000, outsideDaily: 0 };
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest }), 'rest')).toBe('note');
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest: { ...rest, outsideDaily: 600 } }), 'rest')).toBe('fail');
  });

  it('judges the rest state only for identical routes with two builds', () => {
    const route = { path: '/x/', rest: 'identical' };
    const over = { ...sameRest, differing: 900, outsideDaily: 900 };
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
    const hidden = { total: 4, rendered: 4, notShown: 1, examples: ['g (draw): stroke-dashoffset 1px'], running: 0 };
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

  it('allows one retake for a micro layout shift', () => {
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, cls: 0.001, clsRetake: 0 } }), 'cls')).toBe('pass');
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, cls: 0.001, clsRetake: 0.001 } }), 'cls')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, cls: 0.01 } }), 'cls')).toBe('fail');
  });
});

describe('motion evidence: exit code', () => {
  const report = (failures, routes = [{ path: '/x/' }]) => ({ failures, routes });
  it('exits 1 under --check on any failure, 0 otherwise', () => {
    expect(checkExitCode(report([]), { check: true })).toBe(0);
    expect(checkExitCode(report([{ check: 'cls' }]), { check: true })).toBe(1);
    expect(checkExitCode(report([{ check: 'cls' }]), { check: false })).toBe(0);
  });

  it('exits 1 under --check when no route was measured', () => {
    expect(checkExitCode(report([], []), { check: true })).toBe(1);
  });

  it('exits 1 for a run whose only problem is a long-frame or unmeasured failure', () => {
    const route = { path: '/x/', rest: 'changed' };
    const failures = evaluateChecks({ route, viewport, subject: { ...clean, longFrames: { count: 9, longest: 900, frames: 30 }, longFramesReference: { longest: 60, count: 1, frames: 140 } } })
      .filter((c) => c.status === 'fail');
    expect(failures.map((c) => c.check)).toEqual(['longFrames']);
    expect(checkExitCode(report(failures), { check: true })).toBe(1);
    const notApplicable = evaluateChecks({ route, viewport, subject: { ...clean, longFrames: { notApplicable: 'no marks' } } }).filter((c) => c.status === 'fail');
    expect(checkExitCode(report(notApplicable), { check: true })).toBe(0);
    expect(LONG_FRAME_MS).toBe(50);
  });
});

describe('motion evidence: summary', () => {
  it('puts before and after side by side, labels the layout-shift sum and uses no long dashes', () => {
    const report = {
      generatedAt: '2026-11-17T00:00:00.000Z',
      before: 'http://127.0.0.1:4391',
      after: 'http://127.0.0.1:4392',
      viewports: ['390x844'],
      failures: [],
      routes: [{
        path: '/x/', rest: 'identical', loops: { before: ['drift on img.poster'], after: [] }, sheets: [{ label: 'first view', file: 'x.webp' }],
        viewports: { '390x844': { before: clean, after: clean, rest: sameRest, checks: [] } },
      }],
    };
    const md = renderSummary(report);
    expect(md).toContain('| | before 390x844 | after 390x844 |');
    expect(md).toContain('| Rest diff |  | 0 px |');
    expect(md).toContain('| Layout shift sum (load + one scroll-through) |');
    expect(md).toContain('not CLS as field tools define it');
    expect(md).toContain('drift on img.poster');
    expect(md).toContain('a proxy, not a phone');
    expect(md).not.toMatch(/[\u2013\u2014]/u);
    expect(formatNumbers(clean).firstMarkShown).toBe('850 ms (+350 after paint)');
    expect(formatNumbers(clean).shownAtRest).toBe('4 of 4 shown');
  });
});
