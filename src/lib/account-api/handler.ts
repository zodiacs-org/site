import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { authenticateEmailUser } from '../email/daily-server.js';
import {
  accountApiAction,
  accountRequestHeader,
  hasNoRequestBody,
  hasRecentNonRefreshAuthentication,
  isExactAccountOrigin,
  parseDeletionPrepareRequest,
  parseDeletionReceiptProof,
  strictBearerToken,
  verifiedAccessClaims,
} from './request.js';
import {
  AccountServerFailure,
  accountDeletionStatus,
  accountSupabaseOrigin,
  buildAccountExport,
  cleanupExpiredAccountDeletionReceipts,
  finishAccountDeletion,
  prepareAccountDeletion,
} from './server.js';
import { executeAccountSync } from './sync-server.js';
import {
  parseAccountSyncInput,
  type AccountSyncAction,
} from './sync-wire.js';
import type { AccountApiErrorBody, AccountApiErrorCode } from './types.js';

type Environment = Record<string, unknown>;
type Fetch = typeof fetch;

const ACCOUNT_RECEIPT_CLEANUP_BATCH = 256;

function accountReceiptCleanupSecret(env: Environment): string {
  const candidate = env.ACCOUNT_SYNC_V2_CLEANUP_SECRET;
  if (typeof candidate !== 'string') return '';
  const secret = candidate.trim();
  return secret.length >= 32 && secret.length <= 512 ? secret : '';
}

function cleanupBearer(req: any): string {
  const authorization = accountRequestHeader(req, 'authorization');
  if (Buffer.byteLength(authorization, 'utf8') > 1_024) return '';
  return /^Bearer ([A-Za-z0-9+/=._~-]{32,512})$/u.exec(authorization)?.[1] ?? '';
}

function cleanupSecretMatches(candidate: string, expected: string): boolean {
  if (!candidate || !expected) return false;
  const left = Buffer.from(candidate, 'utf8');
  const right = Buffer.from(expected, 'utf8');
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

function hasEmptyCleanupBody(req: any): boolean {
  if (req.body === undefined || req.body === null || req.body === '') return true;
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > 2) return false;
    return req.body === '{}';
  }
  return typeof req.body === 'object'
    && !Array.isArray(req.body)
    && Object.keys(req.body).length === 0;
}

export interface AccountApiDependencies {
  env?: Environment;
  fetcher?: Fetch;
  now?: () => number;
}

function sendJson(
  res: any,
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): void {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Vary', 'Authorization, Origin');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

function sendError(res: any, status: number, error: AccountApiErrorCode): void {
  sendJson(res, status, { error } satisfies AccountApiErrorBody);
}

function serverFailure(res: any, error: AccountServerFailure, action: 'export' | 'deletion'): void {
  if (error.code === 'deletion_conflict') {
    sendError(res, 409, 'deletion_conflict');
    return;
  }
  if (error.code === 'deletion_blocked') {
    sendError(res, 409, 'deletion_blocked');
    return;
  }
  if (error.code === 'deletion_receipt_not_found') {
    sendError(res, 404, 'deletion_receipt_not_found');
    return;
  }
  if (error.code === 'deletion_receipt_expired') {
    sendError(res, 410, 'deletion_receipt_expired');
    return;
  }
  sendError(res, 503, action === 'export' ? 'export_unavailable' : 'deletion_unavailable');
}

export async function handleAccountApi(
  req: any,
  res: any,
  dependencies: AccountApiDependencies = {},
): Promise<void> {
  const env = dependencies.env ?? process.env;
  const fetcher = dependencies.fetcher ?? fetch;
  const now = dependencies.now ?? Date.now;

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendError(res, 405, 'method_not_allowed');
    return;
  }
  const action = accountApiAction(req);
  if (!action) {
    sendError(res, 404, 'invalid_action');
    return;
  }
  if (action === 'cleanup-receipts') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      sendError(res, 405, 'method_not_allowed');
      return;
    }
    const expected = accountReceiptCleanupSecret(env);
    if (!cleanupSecretMatches(cleanupBearer(req), expected)) {
      sendError(res, 404, 'invalid_action');
      return;
    }
    if (!hasEmptyCleanupBody(req)) {
      sendError(res, 400, 'invalid_request');
      return;
    }
    let retention: Awaited<ReturnType<typeof cleanupExpiredAccountDeletionReceipts>>;
    try {
      retention = await cleanupExpiredAccountDeletionReceipts(
        ACCOUNT_RECEIPT_CLEANUP_BATCH,
        env,
        fetcher,
      );
    } catch {
      sendError(res, 503, 'deletion_unavailable');
      return;
    }
    const counts = {
      removed: retention.removed,
      reaped: retention.reaped,
      limit: ACCOUNT_RECEIPT_CLEANUP_BATCH,
    };
    if (retention.reapFailed > 0 || retention.overdue > 0) {
      // A deletion past its seven days that the pass could not finish. Fail
      // the scheduled caller loudly; the counts carry no account detail.
      sendJson(res, 500, {
        error: 'retention_incomplete',
        ...counts,
        reap_failed: retention.reapFailed,
        overdue: retention.overdue,
      });
      return;
    }
    sendJson(res, 200, counts);
    return;
  }
  const lifecycleAction = action === 'export'
    || action === 'delete-prepare'
    || action === 'delete-status'
    || action === 'delete-finish';
  const requiredMethod = action === 'export' ? 'GET' : 'POST';
  if (req.method !== requiredMethod) {
    res.setHeader('Allow', requiredMethod);
    sendError(res, 405, 'method_not_allowed');
    return;
  }
  if (!isExactAccountOrigin(req, env)) {
    sendError(res, 403, 'forbidden');
    return;
  }
  if (action === 'export' && !hasNoRequestBody(req)) {
    sendError(res, 400, 'invalid_request');
    return;
  }
  const deletionPrepare = action === 'delete-prepare' ? parseDeletionPrepareRequest(req) : null;
  const deletionProof = action === 'delete-status' || action === 'delete-finish'
    ? parseDeletionReceiptProof(req)
    : null;
  if ((action === 'delete-prepare' && !deletionPrepare)
    || ((action === 'delete-status' || action === 'delete-finish') && !deletionProof)) {
    sendError(res, 400, 'invalid_request');
    return;
  }
  const syncInput = !lifecycleAction
    ? parseAccountSyncInput(action as AccountSyncAction, req)
    : null;
  if (!lifecycleAction && !syncInput) {
    sendError(res, 400, 'invalid_request');
    return;
  }
  // The kill switch controls enrollment and ordinary sync mutation. It must
  // never revoke lifecycle rights or existing-state privacy controls during a
  // rollback: consent withdrawal (any purpose) and remote-chart deletion stay
  // callable.
  const rollbackPrivacyControl = syncInput?.action === 'chart-delete'
    || (syncInput?.action === 'consent' && syncInput.decision === 'withdraw');
  if (!lifecycleAction
    && !rollbackPrivacyControl
    && env.ACCOUNT_SYNC_V2_API_ENABLED !== '1') {
    sendError(res, 404, 'disabled');
    return;
  }

  // Receipt possession replaces authentication only after an authenticated,
  // recently reauthenticated prepare created the short-lived capability.
  if ((action === 'delete-status' || action === 'delete-finish') && deletionProof) {
    try {
      const receipt = action === 'delete-status'
        ? await accountDeletionStatus(
            deletionProof.requestId,
            deletionProof.recoverySecret,
            env,
            fetcher,
          )
        : await finishAccountDeletion(
            deletionProof.requestId,
            deletionProof.recoverySecret,
            env,
            fetcher,
          );
      sendJson(res, 200, action === 'delete-status'
        ? {
            outcome: receipt.outcome,
            requestId: receipt.requestId,
            preparedAt: receipt.preparedAt,
            expiresAt: receipt.expiresAt,
            completedAt: receipt.completedAt,
            dailySunRevoked: receipt.dailySunRevoked,
            dailySunReconciliationRequired: receipt.dailySunReconciliationRequired,
          }
        : {
            outcome: 'completed',
            requestId: receipt.requestId,
            completedAt: receipt.completedAt,
            dailySunRevoked: receipt.dailySunRevoked,
            dailySunReconciliationRequired: receipt.dailySunReconciliationRequired,
          });
    } catch (error) {
      serverFailure(
        res,
        error instanceof AccountServerFailure
          ? error
          : new AccountServerFailure('deletion_unavailable'),
        'deletion',
      );
    }
    return;
  }

  const token = strictBearerToken(req);
  if (!token) {
    sendError(res, 401, 'unauthorized');
    return;
  }

  let user;
  try {
    user = await authenticateEmailUser(req, env, fetcher);
  } catch {
    sendError(res, 503, 'authentication_unavailable');
    return;
  }
  if (!user) {
    sendError(res, 401, 'unauthorized');
    return;
  }

  // Every signed-in account is admitted. Remote chart storage still requires
  // the chart_sync consent, the self attestation, and the 18+ birth-date gate
  // in chart-put, which also refuses every under-13 chart.

  if (action === 'export') {
    try {
      const accountExport = await buildAccountExport(user, env, fetcher, now);
      sendJson(res, 200, accountExport as unknown as Record<string, unknown>, {
        'Content-Disposition': 'attachment; filename="zodiacs-account-export.json"',
      });
    } catch (error) {
      serverFailure(
        res,
        error instanceof AccountServerFailure ? error : new AccountServerFailure('export_unavailable'),
        action,
      );
    }
    return;
  }

  if (syncInput) {
    try {
      sendJson(res, 200, await executeAccountSync(user, syncInput, env, fetcher, now()));
    } catch {
      sendError(res, 503, 'sync_unavailable');
    }
    return;
  }

  if (action !== 'delete-prepare' || !deletionPrepare) {
    sendError(res, 400, 'invalid_request');
    return;
  }

  let issuer: string;
  try {
    issuer = `${accountSupabaseOrigin(env)}/auth/v1`;
  } catch {
    sendError(res, 503, 'deletion_unavailable');
    return;
  }
  const claims = verifiedAccessClaims(token, user.id, issuer, now());
  if (!claims || !hasRecentNonRefreshAuthentication(claims, now())) {
    sendError(res, 403, 'reauthentication_required');
    return;
  }

  try {
    const receipt = await prepareAccountDeletion(
      user,
      deletionPrepare.requestId,
      deletionPrepare.recoverySecret,
      env,
      fetcher,
    );
    sendJson(res, 200, {
      outcome: receipt.outcome,
      requestId: receipt.requestId,
      preparedAt: receipt.preparedAt,
      expiresAt: receipt.expiresAt,
      dailySunRevoked: receipt.dailySunRevoked,
      dailySunReconciliationRequired: receipt.dailySunReconciliationRequired,
    });
  } catch (error) {
    serverFailure(
      res,
      error instanceof AccountServerFailure ? error : new AccountServerFailure('deletion_unavailable'),
      'deletion',
    );
  }
}
