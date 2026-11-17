/**
 * The motion evidence harness's pure helpers (ZOD-294): argument parsing,
 * route selection, the rest-state comparison, long-frame counting, sheet
 * geometry and the hard checks. The browser side is exercised by running
 * the harness against two builds.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_PROPERTIES, compareRest, countOutsideRects, disallowedProperties, evaluateChecks, formatNumbers,
  longFrameStats, MARK_ATTRIBUTE, nextFrameWidth, normalizePath, parseArgs, renderSummary, routeSlug,
  selectRoutes, sheetLayout, shortSelector, STRIP_TIMES, toKebab,
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

const clean = {
  cls: 0,
  lcp: { time: 400, selector: 'h1.display' },
  lcpMarked: false,
  longFrames: { count: 0, longest: 33.4, frames: 70 },
  animatedProperties: ['opacity', 'transform'],
  markedCount: 4,
  nestedMarks: 0,
  rootMarked: false,
  hiddenAboveAfterReload: 0,
  primaryActionTop: 600,
  reducedMotion: { running: 0, notOpaque: 0 },
  noScript: { notOpaque: 0 },
  throttled: { firstPaint: 500, domContentLoaded: 700, firstMarkShown: 850 },
  strip: { animations: 8, lost: 0 },
  notes: [],
};
const viewport = { width: 390, height: 844 };
const statusOf = (checks, name) => checks.find((c) => c.check === name)?.status;

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

  it('counts long frames only inside the window', () => {
    const frames = [0, 16, 32, 100, 116, 132, 250, 266, 3000];
    // Window [20, 2520]: gaps ending at 32 (16), 100 (68), 116, 132, 250 (118), 266.
    expect(longFrameStats(frames, 20)).toEqual({ count: 2, longest: 118, frames: 6 });
    expect(longFrameStats([], 0)).toEqual({ count: 0, longest: 0, frames: 0 });
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
    const outside = compareRest(a, paint(b, 30, 30, 4, 4, [240, 200, 20]), { dailyRects: [{ x: 4, y: 4, width: 12, height: 6 }] });
    expect(outside.dailyOnly).toBe(false);
  });

  it('counts mask pixels outside rects', () => {
    const mask = Buffer.alloc(4 * 4 * 4);
    mask[(1 * 4 + 1) * 4 + 3] = 255;
    mask[(3 * 4 + 3) * 4 + 3] = 255;
    expect(countOutsideRects(mask, 4, 4, [{ x: 0, y: 0, width: 2, height: 2 }])).toBe(1);
  });
});

describe('motion evidence: hard checks', () => {
  const route = { path: '/x/', rest: 'identical', primaryAction: 'form button[type=submit]' };

  it('passes a clean build', () => {
    const checks = evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest: { share: 0, heightChanged: null, dailyOnly: false } });
    expect(checks.filter((c) => c.status !== 'pass')).toEqual([]);
  });

  it('fails the defects found in PR #1096', () => {
    const subject = { ...clean, nestedMarks: 12, hiddenAboveAfterReload: 25, rootMarked: true, lcpMarked: true, primaryActionTop: 839 };
    const checks = evaluateChecks({ route, viewport, subject, baseline: { ...clean, primaryActionTop: 689 }, rest: { share: 0, heightChanged: null } });
    for (const name of ['nestedMarks', 'hiddenAboveAfterReload', 'rootMarked', 'lcpMarked', 'primaryAction']) {
      expect(statusOf(checks, name), name).toBe('fail');
    }
  });

  it('fails a property outside opacity, transform and stroke-dashoffset', () => {
    const checks = evaluateChecks({ route, viewport, subject: { ...clean, animatedProperties: ['filter', 'opacity'] } });
    expect(statusOf(checks, 'animatedProperties')).toBe('fail');
  });

  it('fails reduced-motion and no-script leaks', () => {
    const checks = evaluateChecks({ route, viewport, subject: { ...clean, reducedMotion: { running: 2, notOpaque: 0 }, noScript: { notOpaque: 3 } } });
    expect(statusOf(checks, 'reducedMotion')).toBe('fail');
    expect(statusOf(checks, 'noScript')).toBe('fail');
  });

  it('allows one retake for a micro layout shift', () => {
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, cls: 0.001, clsRetake: 0 } }), 'cls')).toBe('pass');
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, cls: 0.001, clsRetake: 0.001 } }), 'cls')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: { ...clean, cls: 0.01 } }), 'cls')).toBe('fail');
  });

  it('sets aside long frames when the page without marks is just as slow', () => {
    const slow = { ...clean, longFrames: { count: 2, longest: 90, frames: 60 } };
    expect(statusOf(evaluateChecks({ route, viewport, subject: slow, baselineLongest: 120 }), 'longFrames')).toBe('note');
    expect(statusOf(evaluateChecks({ route, viewport, subject: slow, baselineLongest: 33 }), 'longFrames')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: slow }), 'longFrames')).toBe('fail');
  });

  it('judges the rest state only for identical routes with two builds', () => {
    const over = { share: 0.02, heightChanged: null, dailyOnly: false };
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest: over }), 'rest')).toBe('fail');
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest: { ...over, dailyOnly: true } }), 'rest')).toBe('note');
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, baseline: clean, rest: { share: 0, heightChanged: { from: 10, to: 20 } } }), 'rest')).toBe('fail');
    expect(statusOf(evaluateChecks({ route: { ...route, rest: 'changed' }, viewport, subject: clean, baseline: clean, rest: over }), 'rest')).toBeUndefined();
    expect(statusOf(evaluateChecks({ route, viewport, subject: clean, rest: over }), 'rest')).toBeUndefined();
  });

  it('fails a missing measurement instead of passing it', () => {
    const checks = evaluateChecks({ route, viewport, subject: { ...clean, noScript: null, nestedMarks: null } });
    expect(statusOf(checks, 'noScript')).toBe('fail');
    expect(statusOf(checks, 'nestedMarks')).toBe('fail');
  });
});

describe('motion evidence: summary', () => {
  it('puts before and after side by side and uses no long dashes', () => {
    const report = {
      generatedAt: '2026-11-17T00:00:00.000Z',
      before: 'http://127.0.0.1:4391',
      after: 'http://127.0.0.1:4392',
      viewports: ['390x844'],
      failures: [],
      routes: [{
        path: '/x/', rest: 'identical', loops: { before: ['drift on img.poster'], after: [] }, sheets: [{ label: 'first view', file: 'x.webp' }],
        viewports: { '390x844': { before: clean, after: clean, rest: { share: 0, heightChanged: null }, checks: [] } },
      }],
    };
    const md = renderSummary(report);
    expect(md).toContain('| | before 390x844 | after 390x844 |');
    expect(md).toContain('| Rest diff |  | 0.000% |');
    expect(md).toContain('drift on img.poster');
    expect(md).toContain('a proxy, not a phone');
    expect(md).not.toMatch(/[\u2013\u2014]/u);
    expect(formatNumbers(clean).firstMarkShown).toBe('850 ms (+350 after paint)');
  });
});
