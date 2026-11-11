import {
  ResendRequestWithdrawnError,
  type ResendRequest,
  type ResendRequestControl,
} from '../daily-email/resend-request.js';
import type { WeeklyAuthorization } from './chart-edition.js';
import {
  sendWeeklyDigestEnvelope,
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

/** The recheck could not be read. Nothing was sent; the delivery is unchanged. */
export class WeeklyDispatchRecheckError extends Error {
  constructor() {
    super('Weekly delivery recheck failed before a provider attempt; nothing was sent.');
    this.name = 'WeeklyDispatchRecheckError';
  }
}

export interface WeeklyAttemptGuard {
  control: ResendRequestControl;
  /** The last answer, or `failed` when the recheck itself failed. */
  last: () => WeeklyDispatchRecheck | 'failed' | null;
}

/**
 * A beforeAttempt guard for the provider queue. With `fromAttempt: 1` the
 * first attempt goes out unchecked: that is only for a recovery replay, whose
 * claim (`weekly_digest_recover_v1`) has just made the same check, and whose
 * first dispatch may already have been accepted under the same idempotency
 * key. Every retry after an explicit 429 is checked.
 */
export function weeklyAttemptGuard(
  recheck: () => Promise<WeeklyDispatchRecheck>,
  { fromAttempt = 0 }: { fromAttempt?: 0 | 1 } = {},
): WeeklyAttemptGuard {
  let last: WeeklyDispatchRecheck | 'failed' | null = null;
  return {
    control: {
      async beforeAttempt(attempt) {
        if (attempt < fromAttempt) return true;
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
 */
export async function dispatchWeeklyWithRecheck<
  Recipient,
  Prepared extends { envelope: WeeklyDigestRequestEnvelope },
>({
  authorized,
  reauthorize,
  isChartEdition,
  recheck,
  apiKey,
  request,
  rebuilds = 1,
}: {
  authorized: { recipient: Recipient; prepared: Prepared };
  /** Builds and authorizes again from current content after a release. */
  reauthorize: (previous: Recipient) => Promise<WeeklyAuthorization<Recipient, Prepared>>;
  isChartEdition: (recipient: Recipient) => boolean;
  recheck: () => Promise<WeeklyDispatchRecheck>;
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
      if (!(error instanceof ResendRequestWithdrawnError) || !guard) throw error;
    }
    const answer = guard.last();
    if (answer === null || answer === 'failed' || answer === 'dispatch') {
      throw new WeeklyDispatchRecheckError();
    }
    if (answer !== 'released' || round >= rebuilds) return { kind: 'withdrawn', recheck: answer };
    const next = await reauthorize(current.recipient);
    if (!next.authorized) return { kind: 'withdrawn', recheck: 'released' };
    current = next;
  }
}
