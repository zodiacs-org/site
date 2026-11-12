export const DAILY_EMAIL_USER_AGENT = 'Zodiacs.org-daily-email/1.0 (+https://zodiacs.org)';
export const RESEND_MIN_INTERVAL_MS = 250;
export const RESEND_MAX_RETRIES = 3;
export const RESEND_MAX_RETRY_AFTER_MS = 10_000;

/**
 * Called by the queue after pacing (and after any 429 backoff), immediately
 * before each provider attempt, with the attempt number (0 for the first).
 * Returning false sends nothing more: the request rejects with
 * ResendRequestWithdrawnError. A guard that throws also sends nothing; the
 * request rejects with what it threw.
 */
export type ResendAttemptGuard = (attempt: number) => Promise<boolean>;

export interface ResendRequestControl {
  beforeAttempt?: ResendAttemptGuard;
}

export type ResendRequest = (
  input: string | URL,
  init?: RequestInit,
  control?: ResendRequestControl,
) => Promise<Response>;

/**
 * The request's beforeAttempt guard declined an attempt. Every earlier
 * attempt of this request, if any, was an explicit 429 rejection, so the
 * provider accepted nothing under it.
 */
export class ResendRequestWithdrawnError extends Error {
  readonly outcome = 'withdrawn' as const;
  readonly attempt: number;

  constructor(attempt: number) {
    super('Provider request withdrawn before an attempt; nothing was sent.');
    this.name = 'ResendRequestWithdrawnError';
    this.attempt = attempt;
  }
}

interface RateLimitedRequestOptions {
  minIntervalMs?: number;
  maxRetries?: number;
  maxRetryAfterMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}
const defaultSleep = (milliseconds: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, milliseconds);
});

function retryAfterMs(response: Response, now: number, maximum: number): number {
  const raw = response.headers.get('retry-after')?.trim();
  if (!raw) return Math.min(1_000, maximum);
  const seconds = Number(raw);
  const requested = Number.isFinite(seconds) && seconds >= 0
    ? seconds * 1_000
    : Date.parse(raw) - now;
  if (!Number.isFinite(requested) || requested < 0) return Math.min(1_000, maximum);
  return Math.min(Math.max(0, Math.ceil(requested)), maximum);
}

/**
 * A single serialized queue stays below Resend's team-wide request rate and
 * retries only explicit 429 responses. Retry-After is honored with a hard cap
 * so a workflow can never hang indefinitely. An optional per-request
 * beforeAttempt guard is consulted immediately before every attempt.
 */
export function createRateLimitedResendRequest(
  fetchImpl: typeof fetch,
  options: RateLimitedRequestOptions = {},
): ResendRequest {
  const minIntervalMs = options.minIntervalMs ?? RESEND_MIN_INTERVAL_MS;
  const maxRetries = options.maxRetries ?? RESEND_MAX_RETRIES;
  const maximum = options.maxRetryAfterMs ?? RESEND_MAX_RETRY_AFTER_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  let nextRequestAt = 0;
  let queue: Promise<void> = Promise.resolve();

  const execute = async (
    input: string | URL,
    init?: RequestInit,
    control?: ResendRequestControl,
  ): Promise<Response> => {
    for (let attempt = 0; ; attempt += 1) {
      const pacingDelay = Math.max(0, nextRequestAt - now());
      if (pacingDelay > 0) await sleep(pacingDelay);
      // The guard runs after every wait, so a state change during pacing or
      // a 429 backoff is seen before the next POST, not after it.
      if (control?.beforeAttempt && !await control.beforeAttempt(attempt)) {
        throw new ResendRequestWithdrawnError(attempt);
      }
      const headers = new Headers(init?.headers);
      headers.set('User-Agent', DAILY_EMAIL_USER_AGENT);
      const response = await fetchImpl(input, { ...init, headers });
      nextRequestAt = now() + minIntervalMs;
      if (response.status !== 429 || attempt >= maxRetries) return response;
      const retryDelay = Math.max(minIntervalMs, retryAfterMs(response, now(), maximum));
      try {
        await response.arrayBuffer();
      } catch {
        // Draining is best-effort; the bounded retry still applies.
      }
      await sleep(retryDelay);
      nextRequestAt = now();
    }
  };

  return (input, init, control) => {
    const request = queue.then(() => execute(input, init, control));
    queue = request.then(() => undefined, () => undefined);
    return request;
  };
}
