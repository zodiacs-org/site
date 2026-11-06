const GUIDE_MINUTE_LIMIT = 5;
const GUIDE_MINUTE_WINDOW_MS = 60_000;
const GUIDE_DAILY_LIMIT = 30;
const GUIDE_GLOBAL_DAILY_LIMIT = 3_000;
const GUIDE_GLOBAL_DAILY_LIMIT_MAX = 10_000;
const GUIDE_QUOTA_TIMEOUT_MS = 5_000;
const GUIDE_PRINCIPAL_CONCURRENCY = 2;

type Environment = Record<string, unknown>;

export type GuideQuotaFailure =
  | 'rate_limited'
  | 'operation_replay'
  | 'temporarily_unavailable'
  | 'cancelled';

export class GuideQuotaError extends Error {
  readonly code: GuideQuotaFailure;

  constructor(code: GuideQuotaFailure) {
    super('Guide quota reservation failed');
    this.name = 'GuideQuotaError';
    this.code = code;
  }
}

export interface GuideQuotaLease {
  release: () => void;
}

export interface GuideQuotaReservation {
  quotaHash: string;
  principalHash: string;
  conversationId: string;
  /** Server-derived HMAC; raw protocol IDs never cross the quota boundary. */
  operationHash: string;
  now: number;
  env: Environment;
  signal: AbortSignal;
}

function boundedPositiveInteger(value: unknown, fallback: number, maximum: number): number {
  const parsed = typeof value === 'string' && /^\d{1,5}$/u.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

function parseCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/u.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

export type GuideQuotaStatus =
  | 'reserved'
  | 'operation_replay'
  | 'visitor_limit'
  | 'global_limit';

export interface GuideQuotaResult {
  status: GuideQuotaStatus;
  visitor: number;
  global: number;
}

export function parseGuideQuotaResult(value: unknown): GuideQuotaResult | null {
  const candidate = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const record = candidate as Record<string, unknown>;
  const status = record.status;
  const visitor = parseCount(record.visitor);
  const global = parseCount(record.global);
  return (status !== 'reserved' && status !== 'operation_replay'
    && status !== 'visitor_limit' && status !== 'global_limit')
    || visitor === null || global === null
    ? null
    : { status, visitor, global };
}

/**
 * The service-role RPC endpoint for a Guide function, or null when the
 * Supabase URL or service key is missing or malformed. Shared by the quota
 * reservation and the daily feedback count.
 */
export function guideServiceRpc(
  env: Environment,
  name: string,
): { url: string; headers: Record<string, string> } | null {
  const supabaseUrl = env.PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (typeof supabaseUrl !== 'string' || !/^https:\/\/[A-Za-z0-9.-]+$/u.test(supabaseUrl)
    || typeof serviceKey !== 'string' || serviceKey.length < 24 || serviceKey.length > 2_048) return null;
  const headers: Record<string, string> = {
    apikey: serviceKey,
    'cache-control': 'no-store',
    'content-type': 'application/json',
  };
  if (!serviceKey.startsWith('sb_secret_')) headers.authorization = `Bearer ${serviceKey}`;
  return { url: `${supabaseUrl.replace(/\/+$/u, '')}/rest/v1/rpc/${name}`, headers };
}

async function bumpQuota(
  fetcher: typeof fetch,
  env: Environment,
  visitorHash: string,
  operationHash: string,
  globalLimit: number,
  signal: AbortSignal,
): Promise<GuideQuotaResult | null> {
  const rpc = guideServiceRpc(env, 'guide_quota_reserve_v1');
  if (!rpc) return null;
  const timeout = AbortSignal.timeout(GUIDE_QUOTA_TIMEOUT_MS);
  try {
    const response = await fetcher(
      rpc.url,
      {
        method: 'POST',
        headers: rpc.headers,
        body: JSON.stringify({
          visitor_hash: visitorHash,
          operation_hash: operationHash,
          global_limit: globalLimit,
        }),
        signal: AbortSignal.any([signal, timeout]),
      },
    );
    if (!response.ok) return null;
    return parseGuideQuotaResult(await response.json());
  } catch {
    return null;
  }
}

/** Best-effort per-instance burst and concurrency guard plus durable daily RPC. */
export class GuideQuotaController {
  private readonly minuteRequests = new Map<string, number[]>();
  private readonly principalActive = new Map<string, number>();
  private readonly conversationActive = new Set<string>();
  private readonly recentOperations = new Map<string, number>();
  private checks = 0;

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  /**
   * Reserves only the cheap process-local burst and concurrency guard. Crisis
   * guidance uses this path so it stays available without a database call but
   * cannot be replayed concurrently or without a bounded burst ceiling.
   */
  reserveLocal(
    input: GuideQuotaReservation,
    bucket: 'standard' | 'crisis' = 'standard',
  ): GuideQuotaLease {
    if (input.signal.aborted) throw new GuideQuotaError('cancelled');
    const conversationKey = `${input.quotaHash}:${input.conversationId}`;
    const operationKey = input.operationHash;
    const minuteKey = `${input.quotaHash}:${bucket}`;
    const cutoff = input.now - GUIDE_MINUTE_WINDOW_MS;
    this.checks += 1;
    if (this.checks % 256 === 0) {
      for (const [key, times] of this.minuteRequests) {
        if (!times.length || times[times.length - 1]! <= cutoff) this.minuteRequests.delete(key);
      }
      for (const [key, time] of this.recentOperations) {
        if (time <= cutoff) this.recentOperations.delete(key);
      }
    }
    const recent = (this.minuteRequests.get(minuteKey) ?? []).filter((time) => time > cutoff);
    if (recent.length >= GUIDE_MINUTE_LIMIT) {
      this.minuteRequests.set(minuteKey, recent);
      throw new GuideQuotaError('rate_limited');
    }
    if ((this.recentOperations.get(operationKey) ?? 0) > cutoff) {
      throw new GuideQuotaError('operation_replay');
    }
    if (this.conversationActive.has(conversationKey)
      || (this.principalActive.get(input.principalHash) ?? 0) >= GUIDE_PRINCIPAL_CONCURRENCY) {
      throw new GuideQuotaError('rate_limited');
    }

    recent.push(input.now);
    this.minuteRequests.set(minuteKey, recent);
    this.conversationActive.add(conversationKey);
    this.recentOperations.set(operationKey, input.now);
    this.principalActive.set(input.principalHash, (this.principalActive.get(input.principalHash) ?? 0) + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.conversationActive.delete(conversationKey);
      const remaining = (this.principalActive.get(input.principalHash) ?? 1) - 1;
      if (remaining <= 0) this.principalActive.delete(input.principalHash);
      else this.principalActive.set(input.principalHash, remaining);
    };

    return { release };
  }

  async reserve(input: GuideQuotaReservation): Promise<GuideQuotaLease> {
    const localLease = this.reserveLocal(input);
    const operationKey = input.operationHash;
    const forgetUnacceptedOperation = () => {
      if (this.recentOperations.get(operationKey) === input.now) {
        this.recentOperations.delete(operationKey);
      }
    };
    const globalLimit = boundedPositiveInteger(
      input.env.GUIDE_GLOBAL_DAILY_LIMIT,
      GUIDE_GLOBAL_DAILY_LIMIT,
      GUIDE_GLOBAL_DAILY_LIMIT_MAX,
    );
    const quota = await bumpQuota(
      this.fetcher,
      input.env,
      input.quotaHash,
      input.operationHash,
      globalLimit,
      input.signal,
    );
    if (!quota) {
      localLease.release();
      forgetUnacceptedOperation();
      throw new GuideQuotaError(input.signal.aborted ? 'cancelled' : 'temporarily_unavailable');
    }
    if (quota.status === 'operation_replay') {
      localLease.release();
      // This operation was durably accepted by another request. Retain the
      // local replay marker so this instance also remains fail-closed.
      throw new GuideQuotaError('operation_replay');
    }
    if (quota.status === 'visitor_limit') {
      localLease.release();
      forgetUnacceptedOperation();
      throw new GuideQuotaError('rate_limited');
    }
    if (quota.status === 'global_limit') {
      localLease.release();
      forgetUnacceptedOperation();
      throw new GuideQuotaError('temporarily_unavailable');
    }
    if (quota.visitor < 1 || quota.visitor > GUIDE_DAILY_LIMIT
      || quota.global < 1 || quota.global > globalLimit) {
      localLease.release();
      forgetUnacceptedOperation();
      throw new GuideQuotaError('temporarily_unavailable');
    }
    if (input.signal.aborted) {
      localLease.release();
      forgetUnacceptedOperation();
      throw new GuideQuotaError('cancelled');
    }
    return localLease;
  }
}
