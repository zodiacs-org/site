import { describe, expect, it, vi } from 'vitest';
import { createComputeApiHandler } from '../../src/lib/compute-api/handler';
import * as localTime from '../../src/lib/compute-api/local-time-source';
import { run } from '../../scripts/lib/compute-api-harness';

/*
 * The evaluation budgets that bound the crossing searches as they run cannot
 * be reached by a request inside the window budget (see the measurements in
 * docs/platform/evidence/compute-api-2026-09-29/), so this file lowers them to
 * show what spending one does: the whole request is refused, with no partial
 * list of events, never a timeout.
 */
vi.mock('../../src/lib/compute-api/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/compute-api/constants')>();
  const BUDGETS = Object.freeze({ ...actual.BUDGETS, 'events.samples': 200, 'sky-fact.samples': 2 });
  return {
    ...actual,
    BUDGETS,
    BUDGET_MESSAGES: Object.freeze({
      ...actual.BUDGET_MESSAGES,
      'events.samples': 'The event searches would need more than 200 evaluations.',
      'sky-fact.samples': "The fact's searches would need more than 2 evaluations.",
    }),
  };
});

const handler = createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' });

describe('compute API evaluation budgets', () => {
  it('refuses a whole events request whose searches would pass the budget, returning no events', async () => {
    const small = await run(handler, { endpoint: 'events', body: { from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z', bodies: ['Sun'], kinds: ['ingress'] } });
    expect(small.status).toBe(200);
    expect(small.json.receipt.search.samples).toBeLessThanOrEqual(200);
    const large = await run(handler, { endpoint: 'events', body: { from: '2026-01-01T00:00:00Z', to: '2026-03-31T00:00:00Z' } });
    expect(large.status).toBe(422);
    expect(large.json).toEqual({ error: {
      code: 'budget-exhausted',
      message: 'The event searches would need more than 200 evaluations.',
      limit: 'events.samples',
      max: 200,
    } });
    expect(large.text).not.toContain('"events"');
  });

  it('refuses a fact whose searches would pass its budget', async () => {
    const response = await run(handler, { endpoint: 'sky-fact', body: { kind: 'phase', phase: 'full', date: '2026-10-26' } });
    expect(response.status).toBe(422);
    expect(response.json.error).toMatchObject({ code: 'budget-exhausted', limit: 'sky-fact.samples', max: 2 });
    const instant = await run(handler, { endpoint: 'sky-fact', body: { kind: 'sign', body: 'Sun', sign: 'libra', instant: '2026-09-29T12:00:00Z' } });
    expect(instant.status).toBe(200);
  });
});
