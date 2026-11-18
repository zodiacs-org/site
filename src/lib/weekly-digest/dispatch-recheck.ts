import {
  ResendRequestWithdrawnError,
  type ResendRequest,
  type ResendRequestControl,
} from '../daily-email/resend-request.js';
import type { WeeklyAuthorization } from './chart-edition.js';
import {
  sendWeeklyDigestEnvelope,
  WeeklyDigestProviderAbortError,
  type WeeklyDigestProviderResult,
  type WeeklyDigestRequestEnvelope,
} from './delivery.js';

/**
 * The answers of `weekly_digest_dispatch_recheck_v1`, asked after every
 * provider queue wait and immediately before each POST attempt:
 * - dispatch: unchanged, send.
 * - released: back to reserved under the same lease; rebuild or cancel it.
 * - cancelled: an unsubscribe marked it; it is cancelled.
 * - reconciliation: a recovery replay that changed; quarantined.
 * - missing: no dispatching row under this lease.
 */
export const WEEKLY_DISPATCH_RECHECKS = [
  'dispatch',
  'released',
  'cancelled',
  'reconciliation',
  'missing',
] as const;
export type WeeklyDispatchRecheck = (typeof WEEKLY_DISPATCH_RECHECKS)[number];

export function weeklyDispatchRecheck(value: unknown): WeeklyDispatchRecheck {
  if (typeof value === 'string' && (WEEKLY_DISPATCH_RECHECKS as readonly string[]).includes(value)) {
    return value as WeeklyDispatchRecheck;
  }
  throw new Error('Weekly delivery recheck returned an invalid result.');
}

/**
 * The answers of `weekly_digest_release_rejected_v1`, asked when the provider
 * definitively rejected a new chart edition (or its recheck could not be
 * read), so nothing was accepted under it:
 * - released: back to reserved under the same lease; the next run that may
 *   create deliveries builds it again from current content.
 * - cancelled: an unsubscribe marked it; it is cancelled.
 * - missing: no never-recovered dispatching row under this lease.
 */
export const WEEKLY_REJECTED_RELEASES = ['released', 'cancelled', 'missing'] as const;
export type WeeklyRejectedRelease = (typeof WEEKLY_REJECTED_RELEASES)[number];

export function weeklyRejectedRelease(value: unknown): WeeklyRejectedRelease {
  if (typeof value === 'string' && (WEEKLY_REJECTED_RELEASES as readonly string[]).includes(value)) {
    return value as WeeklyRejectedRelease;
  }
  throw new Error('Weekly delivery release returned an invalid result.');
}

/**
 * The recheck could not be read. Nothing more was sent. For a new chart
 * edition `release` says what became of the delivery (`failed` when the
 * release could not be made either); `null` means none was asked for.
 */
export class WeeklyDispatchRecheckError extends Error {
  readonly release: WeeklyRejectedRelease | 'failed' | null;

  constructor(release: WeeklyRejectedRelease | 'failed' | null = null) {
    super('Weekly delivery recheck failed before a provider attempt; nothing was sent.');
    this.name = 'WeeklyDispatchRecheckError';
    this.release = release;
  }
}

/**
 * The provider definitively rejected a new chart edition (see
 * WeeklyDigestProviderAbortError.definitive). Nothing was accepted, so the
 * delivery was released, and the next run that may create deliveries builds
 * it again from current content. `release` is `failed` when the release
 * could not be made; the batch stops either way, and the recovery replay,
 * which rechecks every attempt, finds it.
 */
export class WeeklyChartRejectedError extends Error {
  readonly abort: WeeklyDigestProviderAbortError;
  readonly release: WeeklyRejectedRelease | 'failed';

  constructor(abort: WeeklyDigestProviderAbortError, release: WeeklyRejectedRelease | 'failed') {
    super('Weekly chart edition definitively rejected by the provider; nothing was accepted.');
    this.name = 'WeeklyChartRejectedError';
    this.abort = abort;
    this.release = release;
  }
}

async function releaseOrFailed(
  release: () => Promise<WeeklyRejectedRelease>,
): Promise<WeeklyRejectedRelease | 'failed'> {
  try {
    return await release();
  } catch {
    return 'failed';
  }
}

export interface WeeklyAttemptGuard {
  control: ResendRequestControl;
  /** The last answer, or `failed` when the recheck itself failed. */
  last: () => WeeklyDispatchRecheck | 'failed' | null;
}

/**
 * A beforeAttempt guard for the provider queue. It rechecks every attempt,
 * the first included, and allows the POST only when the answer is
 * `dispatch`. There is no unchecked attempt anywhere: the weekly sender keeps
 * no durable record that a provider POST for an envelope was actually sent
 * with an unknown outcome, so a delivery's recovery state cannot prove that a
 * replay would only repeat an accepted request (see replayWeeklyRecovery).
 */
export function weeklyAttemptGuard(recheck: () => Promise<WeeklyDispatchRecheck>): WeeklyAttemptGuard {
  let last: WeeklyDispatchRecheck | 'failed' | null = null;
  return {
    control: {
      async beforeAttempt() {
        try {
          last = await recheck();
        } catch {
          last = 'failed';
          return false;
        }
        return last === 'dispatch';
      },
    },
    last: () => last,
  };
}

export type WeeklyDispatchOutcome<Recipient, Prepared> =
  | { kind: 'provider'; result: WeeklyDigestProviderResult; recipient: Recipient; prepared: Prepared }
  /**
   * Nothing was sent. `released` leaves the delivery reserved under the
   * caller's lease (the caller cancels it); the other answers need nothing.
   */
  | { kind: 'withdrawn'; recheck: Exclude<WeeklyDispatchRecheck, 'dispatch'> };

/**
 * Sends an authorized weekly digest. A chart edition is rechecked by the
 * provider queue after its pacing wait and after every 429 backoff,
 * immediately before each POST. If it is no longer what was authorized
 * (chart emails or chart sync withdrawn, chart removed or replaced, account
 * deleting, digest opted out), nothing more is sent: the delivery is
 * released, rebuilt from the current content (normally the sky edition) and
 * sent once more, or, failing that, left for the caller to cancel. The sky
 * edition holds no chart, so it is not rechecked here; its authorization
 * already checked it.
 *
 * When the provider definitively rejects a chart edition (an explicit 4xx,
 * an exhausted run of 429s included), or its recheck cannot be read, nothing
 * was accepted under it, so the delivery is released (`releaseRejected`) and
 * the next run rebuilds it from current content, and this rejects with
 * WeeklyChartRejectedError or WeeklyDispatchRecheckError. An ambiguous
 * outcome (transport, 5xx, 408, 409, a malformed success) is rethrown as it
 * came and left for recovery. Neither path depends on the release for
 * privacy: a delivery left in dispatching (a failed release included) is
 * replayed only through replayWeeklyRecovery, which rechecks every attempt.
 */
export async function dispatchWeeklyWithRecheck<
  Recipient,
  Prepared extends { envelope: WeeklyDigestRequestEnvelope },
>({
  authorized,
  reauthorize,
  isChartEdition,
  recheck,
  releaseRejected,
  apiKey,
  request,
  rebuilds = 1,
}: {
  authorized: { recipient: Recipient; prepared: Prepared };
  /** Builds and authorizes again from current content after a release. */
  reauthorize: (previous: Recipient) => Promise<WeeklyAuthorization<Recipient, Prepared>>;
  isChartEdition: (recipient: Recipient) => boolean;
  recheck: () => Promise<WeeklyDispatchRecheck>;
  /** Releases a chart edition the provider definitively rejected. */
  releaseRejected: () => Promise<WeeklyRejectedRelease>;
  apiKey: string;
  request: ResendRequest;
  rebuilds?: number;
}): Promise<WeeklyDispatchOutcome<Recipient, Prepared>> {
  let current = authorized;
  for (let round = 0; ; round += 1) {
    const guard = isChartEdition(current.recipient) ? weeklyAttemptGuard(recheck) : null;
    try {
      const result = await sendWeeklyDigestEnvelope(
        current.prepared.envelope,
        apiKey,
        request,
        guard?.control,
      );
      return { kind: 'provider', result, ...current };
    } catch (error) {
      if (guard && error instanceof WeeklyDigestProviderAbortError && error.definitive) {
        throw new WeeklyChartRejectedError(error, await releaseOrFailed(releaseRejected));
      }
      if (!(error instanceof ResendRequestWithdrawnError) || !guard) throw error;
    }
    const answer = guard.last();
    if (answer === null || answer === 'failed' || answer === 'dispatch') {
      throw new WeeklyDispatchRecheckError(await releaseOrFailed(releaseRejected));
    }
    if (answer !== 'released' || round >= rebuilds) return { kind: 'withdrawn', recheck: answer };
    const next = await reauthorize(current.recipient);
    if (!next.authorized) return { kind: 'withdrawn', recheck: 'released' };
    current = next;
  }
}

/**
 * Replays a recovered envelope byte for byte, under its original idempotency
 * key. Recovery is default-deny: an unchecked replay would be safe only with
 * a positive, durable record that a POST of this exact envelope was sent and
 * its outcome is unknown, and the sender keeps no such record. A recovered
 * delivery may never have been sent at all (its recheck or its release
 * failed before any POST, or every attempt was an explicit 429), so the
 * replay is rechecked immediately before every attempt, the first included,
 * like a new chart edition. When it is no longer what was authorized it is
 * quarantined (`reconciliation`) and nothing is sent; a recheck that cannot
 * be read sends nothing. A replay is never released, whatever the provider
 * answers it.
 */
export async function replayWeeklyRecovery({
  envelope,
  recheck,
  apiKey,
  request,
}: {
  envelope: WeeklyDigestRequestEnvelope;
  recheck: () => Promise<WeeklyDispatchRecheck>;
  apiKey: string;
  request: ResendRequest;
}): Promise<
  | { kind: 'provider'; result: WeeklyDigestProviderResult }
  | { kind: 'withdrawn'; recheck: Exclude<WeeklyDispatchRecheck, 'dispatch'> }
> {
  const guard = weeklyAttemptGuard(recheck);
  try {
    return { kind: 'provider', result: await sendWeeklyDigestEnvelope(envelope, apiKey, request, guard.control) };
  } catch (error) {
    if (!(error instanceof ResendRequestWithdrawnError)) throw error;
  }
  const answer = guard.last();
  if (answer === null || answer === 'failed' || answer === 'dispatch') {
    throw new WeeklyDispatchRecheckError();
  }
  return { kind: 'withdrawn', recheck: answer };
}
