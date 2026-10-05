/**
 * Jupiter order/execute client for the Registry trade panel.
 *
 * The site never builds, signs, or broadcasts a transaction. Jupiter returns
 * a transaction it built, the visitor's wallet signs it, and Jupiter submits
 * it. What is left for us is the part that protects the visitor: proving that
 * the order Jupiter returned is the order the page displayed, before any of
 * it reaches a wallet for signing.
 *
 * Since the ratified 2026-08-31 migration record the client speaks Swap V2's
 * meta-aggregator (`/swap/v2/order` + `/swap/v2/execute`, keyless) — the
 * contract-identical successor to the legacy Ultra path. Internal `ULTRA_*`
 * identifiers stay, like the internal `exchange` names, for compatibility.
 *
 * Amounts are exact integers throughout. A float would round a balance.
 */

export const ULTRA_BASE_URL = 'https://api.jup.ag';
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
export const VENUE_REQUEST_SPACING_MS = 2_100;
export const VENUE_REQUEST_DEADLINE_MS = 12_000;
export const VENUE_EXECUTE_DEADLINE_MS = 20_000;

/** Solana's native mint carries nine decimals; every Zodiac carries six. */
export const SOL_DECIMALS = 9;

/**
 * Jupiter's own Ultra fee was 10 bps when this panel was written. We display
 * whatever the order reports rather than a hardcoded figure, but refuse an
 * order whose fee exceeds the ratified 10 bps phase boundary: that shape is
 * either a changed venue contract or a mistakenly configured referral, and
 * either one requires a fresh owner decision before a wallet sees it.
 */
export const VENUE_FEE_CEILING_BPS = 10;

export const TRADE_ERROR_CODES = Object.freeze([
  'invalid_amount',
  'no_route',
  'unavailable',
  'rate_limited',
  'order_mismatch',
  'unexpected_fee',
  'network',
  'execute_unconfirmed',
  'execute_failed',
]);

export class TradeError extends Error {
  constructor(code, message, { cause, retryAfterMs = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'TradeError';
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

function fail(code, message, options) {
  throw new TradeError(code, message, options);
}

const REQUEST_PRIORITY = Object.freeze({ background: 0, quote: 1, trade: 2 });
const VENUE_GATE_KEY = Symbol.for('zodiacs.registry.jupiter-request-gate');

function abortError() {
  return Object.assign(new Error('The request was cancelled.'), { name: 'AbortError' });
}

/**
 * One conservative page-wide queue shared by the exchange and trade
 * bundles. Wallet-bound work outranks a panel quote, and a panel quote
 * outranks an explicitly requested ladder sample.
 */
export function createVenueRequestGate({
  spacingMs = VENUE_REQUEST_SPACING_MS,
  now = Date.now,
  setTimeout: setT = setTimeout,
  clearTimeout: clearT = clearTimeout,
} = {}) {
  let sequence = 0;
  let active = false;
  let timer = null;
  let lastStartedAt = Number.NEGATIVE_INFINITY;
  const queue = [];

  function remove(entry) {
    const index = queue.indexOf(entry);
    if (index >= 0) queue.splice(index, 1);
    entry.signal?.removeEventListener?.('abort', entry.onAbort);
  }

  function pick() {
    let best = 0;
    for (let index = 1; index < queue.length; index += 1) {
      const candidate = queue[index];
      const current = queue[best];
      const candidatePriority = REQUEST_PRIORITY[candidate.requestClass];
      const currentPriority = REQUEST_PRIORITY[current.requestClass];
      if (candidatePriority > currentPriority
        || (candidatePriority === currentPriority && candidate.sequence < current.sequence)) {
        best = index;
      }
    }
    return queue.splice(best, 1)[0];
  }

  function pump() {
    if (active || timer) return;
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      if (!queue[index].signal?.aborted) continue;
      const entry = queue[index];
      remove(entry);
      entry.reject(abortError());
    }
    if (!queue.length) return;

    const waitMs = Math.max(0, lastStartedAt + spacingMs - now());
    if (waitMs > 0) {
      timer = setT(() => {
        timer = null;
        pump();
      }, waitMs);
      return;
    }

    const entry = pick();
    entry.started = true;
    entry.signal?.removeEventListener?.('abort', entry.onAbort);
    active = true;
    lastStartedAt = now();
    Promise.resolve()
      .then(() => entry.task())
      .then(entry.resolve, entry.reject)
      .finally(() => {
        active = false;
        pump();
      });
  }

  function schedule(task, { requestClass = 'quote', signal } = {}) {
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
      const entry = {
        task,
        requestClass: Object.prototype.hasOwnProperty.call(REQUEST_PRIORITY, requestClass)
          ? requestClass
          : 'quote',
        signal,
        sequence: sequence += 1,
        started: false,
        resolve,
        reject,
        onAbort: null,
      };
      entry.onAbort = () => {
        if (entry.started) return;
        remove(entry);
        reject(abortError());
        if (!queue.length && timer) {
          clearT(timer);
          timer = null;
        }
        pump();
      };
      signal?.addEventListener?.('abort', entry.onAbort, { once: true });
      queue.push(entry);
      pump();
    });
  }

  return Object.freeze({ schedule });
}

function browserVenueGate() {
  if (typeof window === 'undefined') return null;
  if (!globalThis[VENUE_GATE_KEY]) {
    globalThis[VENUE_GATE_KEY] = createVenueRequestGate();
  }
  return globalThis[VENUE_GATE_KEY];
}

function scheduleVenueRequest(task, options) {
  const gate = browserVenueGate();
  return gate ? gate.schedule(task, options) : task();
}

function boundedRequest(parentSignal, deadlineMs) {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (parentSignal?.aborted) controller.abort();
  else parentSignal?.addEventListener?.('abort', onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deadlineMs);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup() {
      clearTimeout(timer);
      parentSignal?.removeEventListener?.('abort', onAbort);
    },
  };
}

export function parseVenueRetryAfter(response, nowMs = Date.now()) {
  const raw = response?.headers?.get?.('retry-after');
  if (!raw) return null;
  const seconds = Number(raw);
  const delay = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(raw) - nowMs;
  if (!Number.isFinite(delay) || delay < 0) return null;
  return Math.min(120_000, Math.round(delay));
}

/**
 * "0.35" at 9 decimals → 350000000n. Rejects anything that is not a plain
 * decimal, and anything carrying more precision than the token can hold —
 * silently truncating a visitor's amount is not an option here.
 */
export function atomicFromDecimal(value, decimals) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d+)?$|^\.\d+$|^\d+\.$/.test(text)) {
    fail('invalid_amount', 'Enter an amount using digits and a single decimal point.');
  }
  const [whole = '', fraction = ''] = text.split('.');
  if (fraction.length > decimals) {
    fail('invalid_amount', `That amount is finer than this token's ${decimals} decimals.`);
  }
  const atomic = BigInt((whole || '0') + fraction.padEnd(decimals, '0'));
  if (atomic <= 0n) fail('invalid_amount', 'Enter an amount greater than zero.');
  return atomic;
}

/** 350000000n at 9 decimals → "0.35". Trailing zeros are dropped. */
export function decimalFromAtomic(atomic, decimals, { maxFractionDigits = decimals } = {}) {
  const value = BigInt(atomic);
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  let fraction = decimals > 0 ? digits.slice(digits.length - decimals) : '';
  if (maxFractionDigits < fraction.length) fraction = fraction.slice(0, maxFractionDigits);
  fraction = fraction.replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/**
 * Pool depth for these assets is thin, so impact is a headline number, not a
 * footnote. The bands drive how loudly the panel says so.
 */
export function priceImpactBand(pct) {
  const value = Number(pct);
  if (!Number.isFinite(value)) return 'unknown';
  const magnitude = Math.abs(value);
  if (magnitude < 1) return 'low';
  if (magnitude < 5) return 'notable';
  return 'severe';
}

function orderUrl(baseUrl, params) {
  const url = new URL('/swap/v2/order', baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    fail('unavailable', 'The venue did not return a readable answer.', { cause: error });
  }
  return undefined;
}

/**
 * Ask Ultra for a price. Called without a taker to quote, and with the
 * connected address to obtain the transaction Jupiter has built.
 */
export async function fetchOrder({
  inputMint,
  outputMint,
  amount,
  taker,
  baseUrl = ULTRA_BASE_URL,
  fetchImpl = globalThis.fetch,
  signal,
  requestClass = taker ? 'trade' : 'quote',
  deadlineMs = VENUE_REQUEST_DEADLINE_MS,
}) {
  const url = orderUrl(baseUrl, { inputMint, outputMint, amount: String(amount), taker });
  let bounded = null;
  try {
    let response;
    try {
      response = await scheduleVenueRequest(
        () => {
          // Queue time is not network time. A wallet-bound request that waits
          // behind one active ladder sample still receives its full deadline.
          bounded = boundedRequest(signal, deadlineMs);
          return fetchImpl(url, {
            method: 'GET', signal: bounded.signal, headers: { accept: 'application/json' },
          });
        },
        { requestClass, signal },
      );
    } catch (error) {
      if (error?.name === 'AbortError' && !bounded?.timedOut()) throw error;
      fail('network', 'The price could not be reached just now.', { cause: error });
    }
    if (response.status === 429) {
      fail('rate_limited', 'The venue is rate limiting requests. Try again shortly.', {
        retryAfterMs: parseVenueRetryAfter(response),
      });
    }
    if (response.status >= 500) fail('unavailable', 'The venue did not answer.');

    let payload;
    try {
      payload = await readJson(response);
    } catch (error) {
      if (error?.name === 'AbortError' && bounded?.timedOut()) {
        fail('network', 'The price could not be reached just now.', { cause: error });
      }
      throw error;
    }
    // Ultra reports a routing failure as 200 + {error}, and a bad request as 4xx.
    if (payload?.error || !response.ok) {
      const message = typeof payload?.error === 'string' ? payload.error : 'no route';
      if (/quote|route|liquidity/i.test(message)) {
        fail('no_route', 'No route is available for that amount right now.');
      }
      fail('unavailable', 'The venue could not price that trade.');
    }
    return normalizeOrder(payload);
  } catch (error) {
    if (error instanceof TradeError || error?.name === 'AbortError') throw error;
    fail('network', 'The price could not be reached just now.', { cause: error });
  } finally {
    bounded?.cleanup();
  }
}

/** Reduce Ultra's response to the fields the panel shows and checks. */
export function normalizeOrder(payload) {
  if (!payload || typeof payload !== 'object') fail('unavailable', 'The venue returned no order.');
  const { inputMint, outputMint, inAmount, outAmount, requestId } = payload;
  if (!inputMint || !outputMint || !inAmount || !outAmount) {
    fail('unavailable', 'The venue returned an incomplete order.');
  }
  let inAtomic;
  let outAtomic;
  try {
    inAtomic = BigInt(inAmount);
    outAtomic = BigInt(outAmount);
  } catch (error) {
    fail('unavailable', 'The venue returned unreadable amounts.', { cause: error });
  }
  const feeValue = payload.platformFee?.feeBps ?? payload.feeBps;
  const feeReadable = typeof feeValue === 'number'
    || (typeof feeValue === 'string' && feeValue.trim() !== '');
  const feeBps = Number(feeValue);
  if (!feeReadable
    || !Number.isInteger(feeBps)
    || feeBps < 0
    || feeBps > VENUE_FEE_CEILING_BPS) {
    fail('unexpected_fee', 'The venue quoted an unexpected fee, so nothing was sent to your wallet.');
  }
  const impactValue = payload.priceImpactPct;
  const impactReadable = typeof impactValue === 'number'
    || (typeof impactValue === 'string' && impactValue.trim() !== '');
  const priceImpactPct = Number(impactValue);
  if (!impactReadable || !Number.isFinite(priceImpactPct)) {
    fail('unavailable', 'The venue returned no readable price impact.');
  }
  return {
    inputMint,
    outputMint,
    inAmount: inAtomic,
    outAmount: outAtomic,
    priceImpactPct,
    feeBps,
    routeLabels: Array.isArray(payload.routePlan)
      ? payload.routePlan.map((leg) => leg?.swapInfo?.label).filter(Boolean)
      : [],
    requestId: requestId ?? null,
    transaction: payload.transaction ?? null,
    inUsdValue: Number(payload.inUsdValue ?? 0),
    outUsdValue: Number(payload.outUsdValue ?? 0),
  };
}

/**
 * The guard that earns this module its keep. A wallet prompt is the last
 * moment a visitor can catch a substitution, and by then they are reading a
 * base64 blob. Refuse anything that is not exactly what the panel showed.
 */
export function assertOrderMatches(order, expected) {
  if (order.inputMint !== expected.inputMint || order.outputMint !== expected.outputMint) {
    fail('order_mismatch', 'The venue answered for a different token than the one shown.');
  }
  if (order.inAmount !== BigInt(expected.amount)) {
    fail('order_mismatch', 'The venue answered for a different amount than the one entered.');
  }
  if (order.outAmount <= 0n) {
    fail('order_mismatch', 'The venue returned an empty amount.');
  }
  if (!Number.isInteger(order.feeBps)
    || order.feeBps < 0
    || order.feeBps > VENUE_FEE_CEILING_BPS) {
    fail('unexpected_fee', 'The venue quoted an unexpected fee, so nothing was sent to your wallet.');
  }
  return order;
}

/** A quote can be displayed without a taker; only a signable order has both. */
export function isSignable(order) {
  return typeof order.transaction === 'string'
    && order.transaction.length > 0
    && typeof order.requestId === 'string'
    && order.requestId.length > 0;
}

/**
 * Hand the wallet-signed transaction back to Ultra, which submits it. The
 * site never touches a write RPC; this is the whole of its involvement.
 */
export async function executeOrder() {
  throw new TradeError('unavailable', 'transaction_submission_disabled');
}
