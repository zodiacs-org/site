import type { SelfChartPutWire } from './chart-wire';
import {
  ACCOUNT_SYNC_V2_CHART_EMAILS_POLICY_VERSION,
  ACCOUNT_SYNC_V2_CHART_SYNC_POLICY_VERSION,
} from './policy';

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const ACCESS_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const ACCOUNT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DELETION_RECOVERY_SECRET = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;

export const CHART_SYNC_POLICY_VERSION = ACCOUNT_SYNC_V2_CHART_SYNC_POLICY_VERSION;
export const CHART_EMAILS_POLICY_VERSION = ACCOUNT_SYNC_V2_CHART_EMAILS_POLICY_VERSION;

export type AccountV2Outcome = Record<string, unknown> & { outcome: string };

export interface AccountDeletionRecoveryInput {
  requestId: string;
  recoverySecret: string;
}

export interface AccountDeletionPreparedResult {
  outcome: 'prepared';
  requestId: string;
  preparedAt: string;
  expiresAt: string;
  dailySunRevoked: boolean;
  dailySunReconciliationRequired: boolean;
}

export interface AccountDeletionStatusResult {
  outcome: 'prepared' | 'completed';
  requestId: string;
  preparedAt: string;
  expiresAt: string;
  completedAt: string | null;
  dailySunRevoked: boolean;
  dailySunReconciliationRequired: boolean;
}

export interface AccountDeletionCompletedResult {
  outcome: 'completed';
  requestId: string;
  completedAt: string;
  dailySunRevoked: boolean;
  dailySunReconciliationRequired: boolean;
}

export class AccountV2ClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'AccountV2ClientError';
  }
}

type Fetcher = typeof fetch;

export async function bootstrapAccountV2(
  accessToken: string,
  deviceId: string,
  fetcher: Fetcher = fetch,
): Promise<AccountV2Outcome> {
  return postAction('bootstrap', accessToken, { deviceId, platform: 'web' }, fetcher);
}

export async function recordChartSyncConsent(
  accessToken: string,
  decision: 'grant' | 'withdraw',
  mutationId: string,
  fetcher: Fetcher = fetch,
): Promise<AccountV2Outcome> {
  const body: Record<string, unknown> = {
    mutationId,
    decision,
  };
  // Withdrawal is intentionally independent of whatever policy version a
  // stale client remembers. Only a grant asserts the policy being accepted.
  if (decision === 'grant') body.policyVersion = CHART_SYNC_POLICY_VERSION;
  return postAction('consent', accessToken, body, fetcher);
}

/** "Use my chart for my emails". Independent of chart_sync, off by default. */
export async function recordChartEmailsConsent(
  accessToken: string,
  decision: 'grant' | 'withdraw',
  mutationId: string,
  fetcher: Fetcher = fetch,
): Promise<AccountV2Outcome> {
  const body: Record<string, unknown> = {
    mutationId,
    decision,
    purpose: 'chart_emails',
  };
  if (decision === 'grant') body.policyVersion = CHART_EMAILS_POLICY_VERSION;
  return postAction('consent', accessToken, body, fetcher);
}

export async function putSelfChart(
  accessToken: string,
  chart: SelfChartPutWire,
  fetcher: Fetcher = fetch,
): Promise<AccountV2Outcome> {
  return postAction('chart-put', accessToken, {
    deviceId: chart.deviceId,
    chartId: chart.chartId,
    baseRevision: chart.baseRevision,
    mutationId: chart.mutationId,
    label: chart.label,
    subjectKind: chart.subjectKind,
    selfAttestation: chart.selfAttestation,
    birth: chart.birth,
    derived: chart.derived,
  }, fetcher);
}

export async function deleteSyncedChart(
  accessToken: string,
  input: {
    deviceId: string;
    chartId: string;
    baseRevision: number;
    mutationId: string;
  },
  fetcher: Fetcher = fetch,
): Promise<AccountV2Outcome> {
  return postAction('chart-delete', accessToken, {
    deviceId: input.deviceId,
    chartId: input.chartId,
    baseRevision: input.baseRevision,
    mutationId: input.mutationId,
  }, fetcher);
}

export async function pullAccountChanges(
  accessToken: string,
  input: { deviceId: string; afterCursor: number; limit?: number },
  fetcher: Fetcher = fetch,
): Promise<AccountV2Outcome> {
  return postAction('pull', accessToken, input, fetcher);
}

export async function getSyncedChart(
  accessToken: string,
  input: { deviceId: string; chartId: string },
  fetcher: Fetcher = fetch,
): Promise<AccountV2Outcome> {
  return postAction('chart-get', accessToken, input, fetcher);
}

export async function downloadAccountExport(
  accessToken: string,
  fetcher: Fetcher = fetch,
): Promise<{ json: string; filename: string }> {
  const response = await request('/api/account/export', accessToken, { method: 'GET' }, fetcher);
  const json = await boundedText(response);
  try {
    const parsed = JSON.parse(json) as { schema?: unknown };
    if (parsed?.schema !== 'zodiacs.account.export.v1') throw new Error('schema');
  } catch {
    throw new AccountV2ClientError('invalid_response', 502);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = /filename="([A-Za-z0-9._-]{1,120})"/u.exec(disposition)?.[1]
    ?? 'zodiacs-account-export.json';
  return { json, filename };
}

export async function prepareZodiacsAccountDeletion(
  accessToken: string,
  input: AccountDeletionRecoveryInput,
  fetcher: Fetcher = fetch,
): Promise<AccountDeletionPreparedResult> {
  requireDeletionRecoveryInput(input);
  const response = await request('/api/account/delete-prepare', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      confirmation: 'DELETE',
      requestId: input.requestId,
      recoverySecret: input.recoverySecret,
    }),
  }, fetcher);
  const body = await parseJsonResponse(response);
  if (!hasExactKeys(body, [
    'outcome', 'requestId', 'preparedAt', 'expiresAt',
    'dailySunRevoked', 'dailySunReconciliationRequired',
  ])
    || body.outcome !== 'prepared'
    || body.requestId !== input.requestId
    || !isIsoInstant(body.preparedAt)
    || !isIsoInstant(body.expiresAt)
    || typeof body.dailySunRevoked !== 'boolean'
    || typeof body.dailySunReconciliationRequired !== 'boolean') {
    throw new AccountV2ClientError('invalid_response', 502);
  }
  return body as unknown as AccountDeletionPreparedResult;
}

export async function getZodiacsAccountDeletionStatus(
  input: AccountDeletionRecoveryInput,
  fetcher: Fetcher = fetch,
): Promise<AccountDeletionStatusResult> {
  requireDeletionRecoveryInput(input);
  const response = await requestWithoutAuthorization('/api/account/delete-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }, fetcher);
  const body = await parseJsonResponse(response);
  if (!hasExactKeys(body, [
    'outcome', 'requestId', 'preparedAt', 'expiresAt', 'completedAt',
    'dailySunRevoked', 'dailySunReconciliationRequired',
  ])
    || (body.outcome !== 'prepared' && body.outcome !== 'completed')
    || body.requestId !== input.requestId
    || !isIsoInstant(body.preparedAt)
    || !isIsoInstant(body.expiresAt)
    || typeof body.dailySunRevoked !== 'boolean'
    || typeof body.dailySunReconciliationRequired !== 'boolean'
    || (body.outcome === 'prepared' && body.completedAt !== null)
    || (body.outcome === 'completed' && !isIsoInstant(body.completedAt))) {
    throw new AccountV2ClientError('invalid_response', 502);
  }
  return body as unknown as AccountDeletionStatusResult;
}

export async function finishZodiacsAccountDeletion(
  input: AccountDeletionRecoveryInput,
  fetcher: Fetcher = fetch,
): Promise<AccountDeletionCompletedResult> {
  requireDeletionRecoveryInput(input);
  const response = await requestWithoutAuthorization('/api/account/delete-finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }, fetcher);
  const body = await parseJsonResponse(response);
  if (!hasExactKeys(body, [
    'outcome', 'requestId', 'completedAt',
    'dailySunRevoked', 'dailySunReconciliationRequired',
  ])
    || body.outcome !== 'completed'
    || body.requestId !== input.requestId
    || !isIsoInstant(body.completedAt)
    || typeof body.dailySunRevoked !== 'boolean'
    || typeof body.dailySunReconciliationRequired !== 'boolean') {
    throw new AccountV2ClientError('invalid_response', 502);
  }
  return body as unknown as AccountDeletionCompletedResult;
}

async function postAction(
  action: string,
  accessToken: string,
  body: Record<string, unknown>,
  fetcher: Fetcher,
): Promise<AccountV2Outcome> {
  const response = await request(`/api/account/${action}`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, fetcher);
  const parsed = await parseJsonResponse(response);
  return typeof parsed.outcome === 'string'
    ? parsed as AccountV2Outcome
    : (() => { throw new AccountV2ClientError('invalid_response', 502); })();
}

async function request(
  url: string,
  accessToken: string,
  init: RequestInit,
  fetcher: Fetcher,
): Promise<Response> {
  if (!ACCESS_TOKEN.test(accessToken)) throw new AccountV2ClientError('unauthorized', 401);
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      credentials: 'same-origin',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    });
  } catch {
    throw new AccountV2ClientError('network_unavailable', 0);
  }
  if (!response.ok) {
    let code = `http_${response.status}`;
    try {
      const body = await parseJsonResponse(response);
      if (typeof body.error === 'string') code = body.error;
    } catch {
      // Status remains authoritative when an intermediary returns non-JSON.
    }
    throw new AccountV2ClientError(code, response.status);
  }
  return response;
}

async function requestWithoutAuthorization(
  url: string,
  init: RequestInit,
  fetcher: Fetcher,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      credentials: 'same-origin',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        ...init.headers,
      },
    });
  } catch {
    throw new AccountV2ClientError('network_unavailable', 0);
  }
  if (!response.ok) {
    let code = `http_${response.status}`;
    try {
      const body = await parseJsonResponse(response);
      if (typeof body.error === 'string') code = body.error;
    } catch {
      // Status remains authoritative when an intermediary returns non-JSON.
    }
    throw new AccountV2ClientError(code, response.status);
  }
  return response;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isIsoInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value));
}

function requireDeletionRecoveryInput(input: AccountDeletionRecoveryInput): void {
  if (!ACCOUNT_UUID.test(input.requestId) || !DELETION_RECOVERY_SECRET.test(input.recoverySecret)) {
    throw new AccountV2ClientError('invalid_request', 400);
  }
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await boundedText(response);
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to one stable client error.
  }
  throw new AccountV2ClientError('invalid_response', 502);
}

async function boundedText(response: Response): Promise<string> {
  const announced = response.headers.get('content-length');
  if (announced && /^\d+$/u.test(announced) && Number(announced) > MAX_RESPONSE_BYTES) {
    throw new AccountV2ClientError('response_too_large', 502);
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new AccountV2ClientError('response_too_large', 502);
  }
  return text;
}
