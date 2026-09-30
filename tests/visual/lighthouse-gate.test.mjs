/**
 * Which Lighthouse samples count (audit finding F-51), with Lighthouse
 * stubbed: when a sample is set aside and retaken, when a route fails, and
 * that the budgets the valid samples meet are the gate's own.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  budgets, calibrations, describeMisses, gateRoute, MAX_STALL_RETAKES, stallSummary,
} from './lighthouse-gate.mjs';

const trace = (name) => JSON.parse(readFileSync(new URL(`./fixtures/runner-stalls/${name}.json`, import.meta.url), 'utf8'));
const route = { name: 'horoscopes', path: '/horoscopes/' };

/** A Lighthouse result with the given values and trace; every other value passes. */
function result(values = {}, traceName = 'genuine') {
  const { performance = 0.99, accessibility = 1, seo = 1, lcp = 1_800, cls = 0, tbt = 0, crawlable = 1 } = values;
  return {
    lhr: {
      categories: {
        performance: { score: performance },
        accessibility: { score: accessibility },
        seo: { score: seo, auditRefs: [{ id: 'is-crawlable', weight: 4.6 }, { id: 'document-title', weight: 1 }] },
      },
      audits: {
        'largest-contentful-paint': { numericValue: lcp },
        'cumulative-layout-shift': { numericValue: cls },
        'total-blocking-time': { numericValue: tbt },
        'is-crawlable': { score: crawlable },
        'document-title': { score: 1 },
      },
    },
    artifacts: traceName ? { Trace: trace(traceName) } : {},
  };
}

// #603's /horoscopes/ sample 1: 2,518 ms of blocking time in a load the runner stalled.
const stalledFailure = () => result({ performance: 0.71, tbt: 2_518 }, 'stall');
// #603's /thesis/ sample 2: a stall that left the sample within budget.
const stalledPass = () => result({ tbt: 144 }, 'stall');
const genuineFailure = () => result({ performance: 0.88, tbt: 369 }, 'genuine');
const pass = () => result({}, 'genuine');

/** Run the gate on stubbed samples, in the order Lighthouse would return them. */
async function gate(samples, options = {}) {
  const takeSample = vi.fn(async (take) => {
    if (take > samples.length) throw new Error(`sample ${take} was not expected`);
    return samples[take - 1]();
  });
  const record = vi.fn(async () => {});
  const verdict = await gateRoute({ route, runs: 3, takeSample, record, ...options });
  return { verdict, takeSample, record };
}
const takes = (samples) => samples.map((sample) => sample.take);

describe('Lighthouse gate samples', () => {
  it('sets aside a failing sample whose trace shows a runner stall, and retakes it', async () => {
    const { verdict, takeSample, record } = await gate([stalledFailure, pass, pass, pass]);
    expect(takeSample).toHaveBeenCalledTimes(4);
    expect(takes(verdict.setAside)).toEqual([1]);
    expect(verdict.setAside[0]).toMatchObject({
      misses: ['performance', 'tbt'],
      stalls: [{ wallMs: 119.3, cpuMs: 0.2 }],
    });
    expect(record.mock.calls[0][1]).toMatchObject({ status: 'stalled', index: 1, retaken: true });
    expect(takes(verdict.valid)).toEqual([2, 3, 4]);
    expect(verdict).toMatchObject({ failed: false, complete: true, retakes: 1 });
    expect(verdict.values.tbt).toBe(0);
  });

  it('counts a failing sample without a stall, and fails the route without a retake', async () => {
    const { verdict, takeSample } = await gate([genuineFailure, pass, pass]);
    expect(takeSample).toHaveBeenCalledTimes(3);
    expect(verdict.setAside).toEqual([]);
    expect(verdict).toMatchObject({ failed: true, complete: true, misses: ['performance', 'tbt'] });
    expect(verdict.values.tbt).toBe(369);
  });

  it('never excuses a miss that a stall cannot cause', async () => {
    const accessibility = await gate([() => result({ accessibility: 0.9, performance: 0.71, tbt: 2_518 }, 'stall'), pass, pass]);
    expect(accessibility.verdict.setAside).toEqual([]);
    expect(accessibility.verdict).toMatchObject({ failed: true, misses: ['performance', 'accessibility', 'tbt'] });

    const cls = await gate([() => result({ cls: 0.056 }, 'stall'), pass, pass]);
    expect(cls.verdict.setAside).toEqual([]);
    expect(cls.verdict).toMatchObject({ failed: true, misses: ['cls'] });

    // A protected page that became crawlable, in a stalled load, beside two private ones.
    const stillPrivate = () => result({ crawlable: 0 }, 'genuine');
    const noindex = await gate([() => result({ tbt: 204, crawlable: 1 }, 'stall'), stillPrivate, stillPrivate], {
      route: { name: 'ru-sign-guide', path: '/ru/aries/', intentionalNoindex: true },
    });
    expect(noindex.verdict.setAside).toEqual([]);
    expect(noindex.verdict).toMatchObject({ failed: true, misses: ['noindex', 'tbt'] });
  });

  it('fails a route whose retakes stall too, and names the stall', async () => {
    const { verdict, takeSample } = await gate(Array(6).fill(stalledFailure));
    // The fourth stall makes three valid samples impossible, so the gate stops there.
    expect(takeSample).toHaveBeenCalledTimes(1 + MAX_STALL_RETAKES);
    expect(verdict).toMatchObject({ failed: true, complete: false, valid: [], values: null, retakes: MAX_STALL_RETAKES });
    expect(stallSummary(verdict)).toBe('runner stalled in 4 of 4 samples');
  });

  it('never passes a route on fewer valid samples than it needs', async () => {
    const { verdict, takeSample } = await gate([stalledFailure, pass, stalledFailure, stalledFailure, pass, stalledFailure]);
    expect(takeSample).toHaveBeenCalledTimes(6);
    expect(takes(verdict.valid)).toEqual([2, 5]);
    // Both valid samples pass; the route still fails.
    expect(verdict).toMatchObject({ failed: true, complete: false, misses: [] });
    expect(stallSummary(verdict)).toBe('runner stalled in 4 of 6 samples');
  });

  it('takes at most three extra samples per route', async () => {
    const { verdict, takeSample } = await gate([stalledFailure, stalledFailure, stalledFailure, pass, pass, pass]);
    expect(takeSample).toHaveBeenCalledTimes(3 + MAX_STALL_RETAKES);
    expect(takes(verdict.valid)).toEqual([4, 5, 6]);
    expect(verdict).toMatchObject({ failed: false, complete: true, retakes: 3 });
  });

  it('keeps a sample with a stall that still meets every budget', async () => {
    const { verdict, takeSample } = await gate([stalledPass, pass, pass]);
    expect(takeSample).toHaveBeenCalledTimes(3);
    expect(verdict.setAside).toEqual([]);
    expect(takes(verdict.valid)).toEqual([1, 2, 3]);
    expect(verdict.failed).toBe(false);
    // The summary line reports the worst valid sample, stall and all.
    expect(verdict.values.tbt).toBe(144);
  });

  it('counts a failing sample whose trace is missing', async () => {
    const { verdict } = await gate([() => result({ performance: 0.71, tbt: 2_518 }, null), pass, pass]);
    expect(verdict.setAside).toEqual([]);
    expect(verdict.failed).toBe(true);
  });

  it('holds the valid samples to the budgets and calibrations the gate had', async () => {
    expect(budgets).toEqual({ score: 0.95, lcp: 2_500, cls: 0, tbt: 200 });
    expect(calibrations).toEqual({ home: { lcp: 3_100, performance: 0.90 }, 'birth-chart': { lcp: 2_800, performance: 0.93 } });
    const tbt = (value) => () => result({ tbt: value }, 'genuine');
    expect((await gate([tbt(200), pass, pass])).verdict.failed).toBe(false);
    expect((await gate([tbt(201), pass, pass])).verdict.failed).toBe(true);
    // A retake is held to the same 200 ms.
    expect((await gate([stalledFailure, tbt(201), pass, pass])).verdict.failed).toBe(true);
  });

  it('gates a single sample per route the same way', async () => {
    expect((await gate([stalledFailure, pass], { runs: 1 })).verdict).toMatchObject({ failed: false, taken: 2 });
    expect((await gate([genuineFailure], { runs: 1 })).verdict).toMatchObject({ failed: true, taken: 1 });
    const stalled = await gate(Array(4).fill(stalledFailure), { runs: 1 });
    expect(stallSummary(stalled.verdict)).toBe('runner stalled in 4 of 4 samples');
    expect(stalled.verdict.failed).toBe(true);
  });

  it('numbers valid and set-aside samples apart, so their files keep their names', async () => {
    const { record } = await gate([pass, stalledFailure, pass, stalledFailure, pass]);
    expect(record.mock.calls.map(([, sample]) => `${sample.status}-${sample.index}`))
      .toEqual(['valid-1', 'stalled-1', 'valid-2', 'stalled-2', 'valid-3']);
  });

  it('describes a miss beside its budget', () => {
    expect(describeMisses({ performance: 0.71, tbt: 2_518.4 }, ['performance', 'tbt'], route))
      .toBe('performance 71 (floor 95), TBT 2518 ms (budget 200 ms)');
    expect(describeMisses({ lcp: 3_210 }, ['lcp'], { name: 'home' })).toBe('LCP 3.21 s (budget 3.10 s)');
  });
});
