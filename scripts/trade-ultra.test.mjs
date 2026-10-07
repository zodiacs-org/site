import { describe, expect, it, vi } from 'vitest';
import {
  assertOrderMatches,
  atomicFromDecimal,
  createVenueRequestGate,
  decimalFromAtomic,
  executeOrder,
  fetchOrder,
  isSignable,
  normalizeOrder,
  parseVenueRetryAfter,
  priceImpactBand,
  SOL_DECIMALS,
  TradeError,
  VENUE_FEE_CEILING_BPS,
  VENUE_REQUEST_SPACING_MS,
  WSOL_MINT,
} from '../src/trade/ultra.mjs';

const ARIES = 'GhFiFrExPY3proVF96oth1gESWA5QPQzdtb8cy8b1YZv';
const TAURUS = 'EjkkxYpfSwS6TAtKKuiJuNMMngYvumc1t1v9ZX1WJKMp';
const ZODIAC_DECIMALS = 6;

/** Shaped after a real 0.1 SOL → ARIES response captured on 2026-08-02. */
function orderPayload(overrides = {}) {
  return {
    inputMint: WSOL_MINT,
    outputMint: ARIES,
    inAmount: '100000000',
    outAmount: '105937985569',
    priceImpactPct: '0.010113282234297822',
    routePlan: [{ swapInfo: { label: 'Raydium CP' } }],
    platformFee: { feeBps: 10, feeMint: WSOL_MINT },
    requestId: '019fc3b0-269f-709b-bada-915ed5c6b672',
    transaction: null,
    inUsdValue: 7.324,
    outUsdValue: 7.398,
    ...overrides,
  };
}

function jsonResponse(body, { status = 200, ok = status < 400 } = {}) {
  return { ok, status, json: async () => body };
}

function expectTradeError(run, code) {
  try {
    const result = run();
    if (result && typeof result.then === 'function') {
      return result.then(
        () => { throw new Error(`expected a ${code} TradeError, got success`); },
        (error) => {
          expect(error, String(error)).toBeInstanceOf(TradeError);
          expect(error.code).toBe(code);
        },
      );
    }
  } catch (error) {
    expect(error, String(error)).toBeInstanceOf(TradeError);
    expect(error.code).toBe(code);
    return undefined;
  }
  throw new Error(`expected a ${code} TradeError, got success`);
}

describe('amounts stay exact', () => {
  it('converts decimal input to atomic units without floating point', () => {
    expect(atomicFromDecimal('0.1', SOL_DECIMALS)).toBe(100000000n);
    expect(atomicFromDecimal('1', SOL_DECIMALS)).toBe(1000000000n);
    expect(atomicFromDecimal('0.000000001', SOL_DECIMALS)).toBe(1n);
    // 0.1 + 0.2 is the classic float trap; as integers it is exact.
    expect(atomicFromDecimal('0.3', SOL_DECIMALS))
      .toBe(atomicFromDecimal('0.1', SOL_DECIMALS) + atomicFromDecimal('0.2', SOL_DECIMALS));
    // A large balance stays exact well past Number.MAX_SAFE_INTEGER.
    expect(atomicFromDecimal('9007199.254740993', SOL_DECIMALS)).toBe(9007199254740993n);
  });

  it('round-trips through the display formatter', () => {
    for (const value of ['0.1', '1', '12.345678', '0.000001', '1000000']) {
      expect(decimalFromAtomic(atomicFromDecimal(value, ZODIAC_DECIMALS), ZODIAC_DECIMALS))
        .toBe(value.replace(/\.0+$/, ''));
    }
    expect(decimalFromAtomic(105937985569n, ZODIAC_DECIMALS)).toBe('105937.985569');
    expect(decimalFromAtomic(105937985569n, ZODIAC_DECIMALS, { maxFractionDigits: 2 }))
      .toBe('105937.98');
    expect(decimalFromAtomic(100000000n, SOL_DECIMALS)).toBe('0.1');
    expect(decimalFromAtomic(0n, SOL_DECIMALS)).toBe('0');
  });

  it('refuses amounts it cannot honour exactly', () => {
    // More precision than the token carries would have to be truncated.
    expectTradeError(() => atomicFromDecimal('0.0000001', ZODIAC_DECIMALS), 'invalid_amount');
    for (const bad of ['', ' ', '.', 'abc', '1,5', '-1', '1e9', '0', '0.0', '1.2.3', '  ']) {
      expectTradeError(() => atomicFromDecimal(bad, SOL_DECIMALS), 'invalid_amount');
    }
  });
});

describe('price impact bands', () => {
  it('separates a quiet trade from one that moves a thin pool', () => {
    expect(priceImpactBand('0.010113282234297822')).toBe('low');
    expect(priceImpactBand(0.99)).toBe('low');
    expect(priceImpactBand(1)).toBe('notable');
    expect(priceImpactBand(4.9)).toBe('notable');
    expect(priceImpactBand(5)).toBe('severe');
    expect(priceImpactBand(42)).toBe('severe');
    expect(priceImpactBand(-7)).toBe('severe');
    expect(priceImpactBand('not a number')).toBe('unknown');
  });
});

describe('order normalisation', () => {
  it('keeps amounts as integers and surfaces the venue fee and route', () => {
    const order = normalizeOrder(orderPayload());
    expect(order.inAmount).toBe(100000000n);
    expect(order.outAmount).toBe(105937985569n);
    expect(order.feeBps).toBe(10);
    expect(order.routeLabels).toEqual(['Raydium CP']);
    expect(order.priceImpactPct).toBeCloseTo(0.0101, 4);
  });

  it('reads the fee from either shape the venue uses', () => {
    expect(normalizeOrder(orderPayload({ platformFee: undefined, feeBps: 10 })).feeBps).toBe(10);
    for (const feeBps of [undefined, '', '  ', -1, 0.5, 11, 'not-a-number']) {
      expectTradeError(
        () => normalizeOrder(orderPayload({ platformFee: undefined, feeBps })),
        'unexpected_fee',
      );
    }
  });

  it('rejects an incomplete order rather than displaying blanks', () => {
    expectTradeError(() => normalizeOrder(null), 'unavailable');
    expectTradeError(() => normalizeOrder(orderPayload({ outAmount: undefined })), 'unavailable');
    expectTradeError(() => normalizeOrder(orderPayload({ inAmount: 'not-an-integer' })), 'unavailable');
    for (const priceImpactPct of [undefined, '', 'not-a-number']) {
      expectTradeError(() => normalizeOrder(orderPayload({ priceImpactPct })), 'unavailable');
    }
  });

  it('treats a quote as unsignable until it carries a transaction', () => {
    expect(isSignable(normalizeOrder(orderPayload()))).toBe(false);
    expect(isSignable(normalizeOrder(orderPayload({ transaction: 'AQAB...' })))).toBe(true);
    expect(isSignable(normalizeOrder(orderPayload({ transaction: 'AQAB...', requestId: null })))).toBe(false);
  });
});

describe('the substitution guard', () => {
  const expected = { inputMint: WSOL_MINT, outputMint: ARIES, amount: 100000000n };

  it('accepts the order the panel displayed', () => {
    expect(assertOrderMatches(normalizeOrder(orderPayload()), expected).outAmount)
      .toBe(105937985569n);
  });

  it('refuses an order for a different token', () => {
    expectTradeError(
      () => assertOrderMatches(normalizeOrder(orderPayload({ outputMint: TAURUS })), expected),
      'order_mismatch',
    );
    expectTradeError(
      () => assertOrderMatches(normalizeOrder(orderPayload({ inputMint: TAURUS })), expected),
      'order_mismatch',
    );
  });

  it('refuses an order that would spend a different amount', () => {
    expectTradeError(
      () => assertOrderMatches(normalizeOrder(orderPayload({ inAmount: '900000000' })), expected),
      'order_mismatch',
    );
  });

  it('refuses an order that returns nothing', () => {
    expectTradeError(
      () => assertOrderMatches(normalizeOrder(orderPayload({ outAmount: '0' })), expected),
      'order_mismatch',
    );
  });

  it('refuses a fee above the ratified 10 bps phase boundary', () => {
    expect(VENUE_FEE_CEILING_BPS).toBe(10);
    const inflated = orderPayload({ platformFee: { feeBps: VENUE_FEE_CEILING_BPS + 1 } });
    expectTradeError(() => assertOrderMatches(normalizeOrder(inflated), expected), 'unexpected_fee');
    // The venue's own 10 bps passes; the site adds none of its own.
    expect(assertOrderMatches(normalizeOrder(orderPayload()), expected).feeBps).toBe(10);
  });

  it('refuses a fee it cannot read rather than waving it through as zero', () => {
    const malformed = orderPayload({ platformFee: { feeBps: 'not-a-number' } });
    expectTradeError(() => assertOrderMatches(normalizeOrder(malformed), expected), 'unexpected_fee');
  });
});

describe('the browser-wide venue queue', () => {
  it('paces starts and lets wallet work overtake quotes and ladder samples', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const gate = createVenueRequestGate();
      const starts = [];
      const run = (label, requestClass) => gate.schedule(async () => {
        starts.push([label, Date.now()]);
        return label;
      }, { requestClass });

      const first = run('first-background', 'background');
      const background = run('second-background', 'background');
      const quote = run('panel-quote', 'quote');
      const trade = run('wallet-trade', 'trade');
      await vi.advanceTimersByTimeAsync(0);
      await first;
      await vi.advanceTimersByTimeAsync(VENUE_REQUEST_SPACING_MS);
      await trade;
      await vi.advanceTimersByTimeAsync(VENUE_REQUEST_SPACING_MS);
      await quote;
      await vi.advanceTimersByTimeAsync(VENUE_REQUEST_SPACING_MS);
      await background;

      expect(starts.map(([label]) => label)).toEqual([
        'first-background', 'wallet-trade', 'panel-quote', 'second-background',
      ]);
      expect(starts.map(([, at]) => at)).toEqual([
        0,
        VENUE_REQUEST_SPACING_MS,
        VENUE_REQUEST_SPACING_MS * 2,
        VENUE_REQUEST_SPACING_MS * 3,
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops a superseded queued quote before it reaches the network', async () => {
    let release;
    const gate = createVenueRequestGate({ spacingMs: 0 });
    const first = gate.schedule(() => new Promise((resolve) => { release = resolve; }));
    const controller = new AbortController();
    const task = vi.fn(async () => 'stale');
    const stale = gate.schedule(task, { signal: controller.signal });
    controller.abort();
    await expect(stale).rejects.toMatchObject({ name: 'AbortError' });
    release('done');
    await first;
    expect(task).not.toHaveBeenCalled();
  });

  it('gives queued wallet work a fresh network deadline after a stalled ladder request', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const key = Symbol.for('zodiacs.registry.jupiter-request-gate');
    const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
    const previousWindow = globalThis.window;
    const previousGate = globalThis[key];
    globalThis.window = {};
    globalThis[key] = createVenueRequestGate({ spacingMs: 0 });
    try {
      const background = fetchOrder({
        inputMint: WSOL_MINT,
        outputMint: ARIES,
        amount: 100000000n,
        requestClass: 'background',
        deadlineMs: 80,
        fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('background stalled'), { name: 'AbortError' }));
          }, { once: true });
        }),
      }).catch((error) => error);
      await vi.advanceTimersByTimeAsync(10);

      const tradeFetch = vi.fn(async () => new Promise((resolve) => {
        setTimeout(() => resolve(jsonResponse(orderPayload())), 30);
      }));
      const trade = fetchOrder({
        inputMint: WSOL_MINT,
        outputMint: ARIES,
        amount: 100000000n,
        taker: 'Wa11et',
        deadlineMs: 80,
        fetchImpl: tradeFetch,
      });

      await vi.advanceTimersByTimeAsync(70);
      expect((await background).code).toBe('network');
      expect(tradeFetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(30);
      await expect(trade).resolves.toMatchObject({ outputMint: ARIES });
    } finally {
      if (previousGate === undefined) delete globalThis[key];
      else globalThis[key] = previousGate;
      if (hadWindow) globalThis.window = previousWindow;
      else delete globalThis.window;
      vi.useRealTimers();
    }
  });
});

describe('fetching an order', () => {
  it('quotes without a taker and asks for a transaction with one', async () => {
    const seen = [];
    const fetchImpl = async (url) => { seen.push(url); return jsonResponse(orderPayload()); };
    await fetchOrder({ inputMint: WSOL_MINT, outputMint: ARIES, amount: 100000000n, fetchImpl });
    await fetchOrder({ inputMint: WSOL_MINT, outputMint: ARIES, amount: 100000000n, taker: 'Wa11et', fetchImpl });

    expect(seen[0]).toContain('/swap/v2/order');
    expect(seen[0]).toContain(`inputMint=${WSOL_MINT}`);
    expect(seen[0]).toContain(`outputMint=${ARIES}`);
    expect(seen[0]).toContain('amount=100000000');
    // No address leaves the browser merely to show a price.
    expect(seen[0]).not.toContain('taker=');
    expect(seen[1]).toContain('taker=Wa11et');
    // The site never asks the venue to attach a fee on its behalf.
    for (const url of seen) {
      expect(url).not.toMatch(/referral|feeAccount|platformFeeBps/i);
    }
  });

  it('maps venue failures onto codes the panel can speak', async () => {
    const cases = [
      [jsonResponse({ error: 'Failed to get quotes' }), 'no_route'],
      [jsonResponse({}, { status: 429 }), 'rate_limited'],
      [jsonResponse({}, { status: 503 }), 'unavailable'],
      [jsonResponse({ error: 'bad request' }, { status: 400 }), 'unavailable'],
    ];
    for (const [response, code] of cases) {
      await expectTradeError(
        () => fetchOrder({ inputMint: WSOL_MINT, outputMint: ARIES, amount: 1n, fetchImpl: async () => response }),
        code,
      );
    }
  });

  it('carries a bounded Retry-After hint on rate limiting', async () => {
    const response = jsonResponse({}, { status: 429 });
    response.headers = { get: (name) => name === 'retry-after' ? '45' : null };
    await expect(fetchOrder({
      inputMint: WSOL_MINT,
      outputMint: ARIES,
      amount: 1n,
      fetchImpl: async () => response,
    })).rejects.toMatchObject({ code: 'rate_limited', retryAfterMs: 45_000 });
    expect(parseVenueRetryAfter({ headers: { get: () => '999' } })).toBe(120_000);
  });

  it('reports a dropped connection as a network problem', async () => {
    await expectTradeError(
      () => fetchOrder({
        inputMint: WSOL_MINT,
        outputMint: ARIES,
        amount: 1n,
        fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
      }),
      'network',
    );
  });

  it('lets an abort propagate untouched so a stale quote can be cancelled', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    await expect(fetchOrder({
      inputMint: WSOL_MINT,
      outputMint: ARIES,
      amount: 1n,
      fetchImpl: async () => { throw abort; },
    })).rejects.toBe(abort);
  });

  it('keeps the deadline alive while the venue body is being read', async () => {
    const fetchImpl = async (_url, { signal }) => ({
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('body stalled'), { name: 'AbortError' }));
        }, { once: true });
      }),
    });
    await expect(fetchOrder({
      inputMint: WSOL_MINT,
      outputMint: ARIES,
      amount: 1n,
      fetchImpl,
      deadlineMs: 5,
    })).rejects.toMatchObject({ code: 'network' });
  });
});

describe('retired transaction submission', () => {
  it('refuses stale submission calls without contacting any service', async () => {
    let calls = 0;
    await expect(executeOrder({ signedTransaction: 'synthetic', requestId: 'synthetic', fetchImpl: async () => { calls++; } })).rejects.toThrow('transaction_submission_disabled');
    expect(calls).toBe(0);
  });
});
