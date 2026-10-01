import { PROFILE_DELETIONS_KEY } from '../profile/deletions';
import { PAIRS_KEY } from '../profile/pairs';
import { PROFILE_KEY } from '../profile/schema';
import { CIRCLE_KEY, ME_KEY } from '../profile/page-keys';
import { LIVING_CHART_GUEST_VAULT_KEY } from '../living-chart/owner';
import { livingChartSyncMetadataKeys } from '../living-chart/sync-metadata';
import {
  invalidateLivingChartAccess,
  requestLivingChartClear,
} from '../living-chart/store';
import type { LivingChartOwnerScope } from '../living-chart/types';
import { CALENDAR_FEED_CHANGE_CHANNEL, clearCalendarFeedStore } from '../calendar-feed/browser-store';
import {
  ACCOUNT_V2_LOCAL_OWNER_KEY,
  ACCOUNT_V2_RETAINED_OWNER_KEY,
  accountSyncMetadataKey,
  clearCurrentAccountV2Metadata,
  isAccountV2Id,
  readLocalAccountOwner,
  readRetainedAccountOwner,
  recordCompletedAccountBoundaryDecision,
  retainCurrentAccountProfile,
  type AccountV2Storage,
} from './local-state';
import type { AccountBoundaryDecision, AccountBoundaryState } from './types';

const YEAR_AHEAD_CACHE_KEY = 'zodiacs.yearahead.v1';
const DAILY_CHART_SELECTION_KEY = 'zodiacs.daily-chart-selection.v1';
const FIRST_READING_STORAGE_KEY = 'zodiacs.first-reading.v1';
const ARCHIVE_PREFIX = 'zodiacs.local-profile.account.';
const ARCHIVE_VERSION = 1 as const;
const MAX_ARCHIVE_BYTES = 5 * 1024 * 1024;

export const ACCOUNT_BOUNDARY_PROFILE_KEYS = [
  PROFILE_KEY,
  PROFILE_DELETIONS_KEY,
  PAIRS_KEY,
  YEAR_AHEAD_CACHE_KEY,
  DAILY_CHART_SELECTION_KEY,
  // Your-page name and picture, and cards received from other people.
  ME_KEY,
  CIRCLE_KEY,
] as const;

interface LocalProfileArchiveV1 {
  version: typeof ARCHIVE_VERSION;
  accountId: string;
  values: Partial<Record<(typeof ACCOUNT_BOUNDARY_PROFILE_KEYS)[number], string>>;
}

export interface LocalProfileBoundaryResult {
  ok: boolean;
  restoredPreviousArchive: boolean;
}

export function localProfileArchiveKey(accountId: string): string | null {
  return isAccountV2Id(accountId) ? `${ARCHIVE_PREFIX}${accountId}.v1` : null;
}

/**
 * A short-lived v1 client stored exact UTC/coordinates in guided-reading
 * progress. Keep the account-free status/step preference, but destroy that
 * legacy identity before any account lease, archive, hand-off, or deletion.
 */
export function sanitizeLegacyFirstReadingIdentity(storage: AccountV2Storage): boolean {
  try {
    const raw = storage.getItem(FIRST_READING_STORAGE_KEY);
    if (raw === null) return true;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      storage.removeItem(FIRST_READING_STORAGE_KEY);
      return storage.getItem(FIRST_READING_STORAGE_KEY) === null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      storage.removeItem(FIRST_READING_STORAGE_KEY);
      return storage.getItem(FIRST_READING_STORAGE_KEY) === null;
    }

    const record = parsed as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, 'chartKey')) return true;
    const sanitized = { ...record };
    delete sanitized.chartKey;
    const serialized = JSON.stringify(sanitized);
    storage.setItem(FIRST_READING_STORAGE_KEY, serialized);
    return storage.getItem(FIRST_READING_STORAGE_KEY) === serialized;
  } catch {
    return false;
  }
}

/** Treat any account-sensitive local profile surface as data that needs a hand-off choice. */
export function hasAccountBoundLocalProfileData(storage: AccountV2Storage): boolean {
  try {
    return ACCOUNT_BOUNDARY_PROFILE_KEYS.some((key) => {
      const value = storage.getItem(key);
      if (value === null || value === '' || value === '[]' || value === '{}') return false;
      if (key !== PROFILE_KEY) return true;
      try {
        const parsed = JSON.parse(value) as { charts?: unknown };
        return Array.isArray(parsed?.charts) && parsed.charts.length > 0;
      } catch {
        // Malformed profile storage may still contain sensitive data. Never treat it as empty.
        return true;
      }
    });
  } catch {
    // Storage failure must force the safer decision-required path.
    return true;
  }
}

/**
 * Archives the current account's local profile surfaces and restores the next
 * account's prior archive, if one exists. Nothing is uploaded by this action.
 */
export function isolateLocalProfileForAccountSwitch(
  storage: AccountV2Storage,
  currentAccountId: string,
  nextAccountId: string,
): LocalProfileBoundaryResult {
  const currentArchiveKey = localProfileArchiveKey(currentAccountId);
  const nextArchiveKey = localProfileArchiveKey(nextAccountId);
  if (!currentArchiveKey || !nextArchiveKey || currentAccountId === nextAccountId) {
    return { ok: false, restoredPreviousArchive: false };
  }

  let before: Map<string, string | null> | null = null;
  let nextArchive: LocalProfileArchiveV1 | null;
  try {
    before = snapshot(storage, [
      ...ACCOUNT_BOUNDARY_PROFILE_KEYS,
      currentArchiveKey,
      FIRST_READING_STORAGE_KEY,
    ]);
    if (!sanitizeLegacyFirstReadingIdentity(storage)) throw new Error('legacy identity cleanup failed');
    nextArchive = parseArchive(storage.getItem(nextArchiveKey), nextAccountId);
    if (storage.getItem(nextArchiveKey) !== null && nextArchive === null) {
      return { ok: false, restoredPreviousArchive: false };
    }

    const currentArchive: LocalProfileArchiveV1 = {
      version: ARCHIVE_VERSION,
      accountId: currentAccountId,
      values: activeValues(storage),
    };
    const serialized = JSON.stringify(currentArchive);
    if (utf8Bytes(serialized) > MAX_ARCHIVE_BYTES) {
      return { ok: false, restoredPreviousArchive: false };
    }
    storage.setItem(currentArchiveKey, serialized);
    replaceActiveValues(storage, nextArchive?.values ?? {});
  } catch {
    if (before) restoreSnapshot(storage, before);
    return { ok: false, restoredPreviousArchive: false };
  }

  invalidateLivingChartForBoundary(storage);
  return { ok: true, restoredPreviousArchive: nextArchive !== null };
}

/** Clears only account-sensitive local profile surfaces; unrelated storage remains. */
export function clearAccountBoundLocalProfileData(
  storage: AccountV2Storage,
): LocalProfileBoundaryResult {
  const livingChartOwner = livingChartOwnerForBoundary(storage);
  let before: Map<string, string | null> | null = null;
  try {
    before = snapshot(storage, [...ACCOUNT_BOUNDARY_PROFILE_KEYS, FIRST_READING_STORAGE_KEY]);
    if (!sanitizeLegacyFirstReadingIdentity(storage)) throw new Error('legacy identity cleanup failed');
    replaceActiveValues(storage, {});
  } catch {
    if (before) restoreSnapshot(storage, before);
    return { ok: false, restoredPreviousArchive: false };
  }
  clearLivingChartForBoundary(storage, livingChartOwner);
  return { ok: true, restoredPreviousArchive: false };
}

/** Clears the active profile surfaces and this account's isolated archive. */
export function clearAccountBoundLocalProfileEverywhere(
  storage: AccountV2Storage,
  accountId: string,
): LocalProfileBoundaryResult {
  const archiveKey = localProfileArchiveKey(accountId);
  if (!archiveKey) return { ok: false, restoredPreviousArchive: false };
  const livingSyncKeys = livingChartSyncMetadataKeys(accountId);
  let before: Map<string, string | null> | null = null;
  try {
    before = snapshot(storage, [
      ...ACCOUNT_BOUNDARY_PROFILE_KEYS,
      archiveKey,
      FIRST_READING_STORAGE_KEY,
      ...livingSyncKeys,
    ]);
    if (!sanitizeLegacyFirstReadingIdentity(storage)) throw new Error('legacy identity cleanup failed');
    replaceActiveValues(storage, {});
    storage.removeItem(archiveKey);
    livingSyncKeys.forEach((key) => storage.removeItem(key));
  } catch {
    if (before) restoreSnapshot(storage, before);
    return { ok: false, restoredPreviousArchive: false };
  }
  clearLivingChartForBoundary(storage, { kind: 'account', accountId });
  return { ok: true, restoredPreviousArchive: false };
}

/** Atomically clears active/profile archives plus this account's sync metadata. */
export function clearAccountDataFromDevice(
  storage: AccountV2Storage,
  accountId: string,
): LocalProfileBoundaryResult {
  const archiveKey = localProfileArchiveKey(accountId);
  const metadataKey = accountSyncMetadataKey(accountId);
  if (!archiveKey || !metadataKey) return { ok: false, restoredPreviousArchive: false };
  const keys = [
    ...ACCOUNT_BOUNDARY_PROFILE_KEYS,
    archiveKey,
    metadataKey,
    ACCOUNT_V2_LOCAL_OWNER_KEY,
    ACCOUNT_V2_RETAINED_OWNER_KEY,
    FIRST_READING_STORAGE_KEY,
    ...livingChartSyncMetadataKeys(accountId),
  ];
  let before: Map<string, string | null> | null = null;
  try {
    before = snapshot(storage, keys);
    const owner = storage.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY);
    if (owner === null) throw new Error('missing owner authority');
    const parsed = JSON.parse(owner) as { version?: unknown; accountId?: unknown };
    if (parsed.version !== 1 || parsed.accountId !== accountId) throw new Error('owner mismatch');
    if (!sanitizeLegacyFirstReadingIdentity(storage)) throw new Error('legacy identity cleanup failed');
    replaceActiveValues(storage, {});
    storage.removeItem(archiveKey);
    storage.removeItem(metadataKey);
    storage.removeItem(ACCOUNT_V2_LOCAL_OWNER_KEY);
    storage.removeItem(ACCOUNT_V2_RETAINED_OWNER_KEY);
    livingChartSyncMetadataKeys(accountId).forEach((key) => storage.removeItem(key));
  } catch {
    if (before) restoreSnapshot(storage, before);
    return { ok: false, restoredPreviousArchive: false };
  }
  clearLivingChartForBoundary(storage, { kind: 'account', accountId });
  return { ok: true, restoredPreviousArchive: false };
}

/** Completes profile hand-off and owner rebinding as one rollback-safe action. */
export function completeAccountBoundaryDecision(
  storage: AccountV2Storage,
  boundary: AccountBoundaryState,
  decision: AccountBoundaryDecision,
): LocalProfileBoundaryResult {
  if (boundary.status !== 'decision-required'
    || decision === 'cancel'
    || !boundary.decisions.includes(decision as never)) {
    return { ok: false, restoredPreviousArchive: false };
  }
  const currentArchive = boundary.localOwnerAccountId
    ? localProfileArchiveKey(boundary.localOwnerAccountId)
    : null;
  const nextArchive = localProfileArchiveKey(boundary.authenticatedAccountId);
  if (!nextArchive) return { ok: false, restoredPreviousArchive: false };
  const keys = [
    ...ACCOUNT_BOUNDARY_PROFILE_KEYS,
    ACCOUNT_V2_LOCAL_OWNER_KEY,
    FIRST_READING_STORAGE_KEY,
    nextArchive,
    ...(currentArchive ? [currentArchive] : []),
  ];
  let before: Map<string, string | null> | null = null;
  try {
    const currentOwner = readLocalAccountOwner(storage);
    const ownerStillMatches = boundary.localOwnerAccountId === null
      ? currentOwner.status === 'missing'
      : currentOwner.status === 'ready'
        && currentOwner.accountId === boundary.localOwnerAccountId;
    if (!ownerStillMatches) throw new Error('stale boundary');
    before = snapshot(storage, keys);
    if (!sanitizeLegacyFirstReadingIdentity(storage)) throw new Error('legacy identity cleanup failed');
    let changed: LocalProfileBoundaryResult = { ok: true, restoredPreviousArchive: false };
    if (decision === 'isolate') {
      if (!boundary.localOwnerAccountId) throw new Error('missing owner');
      changed = isolateLocalProfileForAccountSwitch(
        storage,
        boundary.localOwnerAccountId,
        boundary.authenticatedAccountId,
      );
    } else if (decision === 'clear') {
      changed = boundary.localOwnerAccountId
        ? clearAccountBoundLocalProfileEverywhere(storage, boundary.localOwnerAccountId)
        : clearAccountBoundLocalProfileData(storage);
    }
    if (!changed.ok || !recordCompletedAccountBoundaryDecision(
      storage,
      boundary.authenticatedAccountId,
      decision,
    )) throw new Error('boundary incomplete');
    return changed;
  } catch {
    if (before) restoreSnapshot(storage, before);
    return { ok: false, restoredPreviousArchive: false };
  }
}

/**
 * After remote account deletion, retained local charts keep their former owner
 * marker so a later account can never import them as account-free data.
 */
export function retainAccountBoundProfileAfterDeletion(
  storage: AccountV2Storage,
  accountId: string,
): LocalProfileBoundaryResult {
  const metadataKey = accountSyncMetadataKey(accountId);
  if (!metadataKey) return { ok: false, restoredPreviousArchive: false };
  let before: Map<string, string | null> | null = null;
  try {
    const owner = readLocalAccountOwner(storage);
    if (owner.status !== 'ready' || owner.accountId !== accountId) {
      throw new Error('owner mismatch');
    }
    before = snapshot(storage, [
      metadataKey,
      ACCOUNT_V2_LOCAL_OWNER_KEY,
      ACCOUNT_V2_RETAINED_OWNER_KEY,
      FIRST_READING_STORAGE_KEY,
      ...livingChartSyncMetadataKeys(accountId),
    ]);
    if (!sanitizeLegacyFirstReadingIdentity(storage)) throw new Error('legacy identity cleanup failed');
    const cleared = clearCurrentAccountV2Metadata(storage, accountId, { preserveOwner: true });
    if (!cleared.ok || !retainCurrentAccountProfile(storage, accountId)) {
      throw new Error('retention failed');
    }
    livingChartSyncMetadataKeys(accountId).forEach((key) => storage.removeItem(key));
    invalidateLivingChartForBoundary(storage);
    return { ok: true, restoredPreviousArchive: false };
  } catch {
    if (before) restoreSnapshot(storage, before);
    return { ok: false, restoredPreviousArchive: false };
  }
}

/**
 * Completes browser cleanup for a deleted account without touching a different
 * account's active profile. An inactive archive stays account-tagged when the
 * user keeps it, so it can never become importable as account-free data.
 */
export function completeDeletedAccountLocalData(
  storage: AccountV2Storage,
  accountId: string,
  removeFromDevice: boolean,
): LocalProfileBoundaryResult {
  const archiveKey = localProfileArchiveKey(accountId);
  const metadataKey = accountSyncMetadataKey(accountId);
  if (!archiveKey || !metadataKey) return { ok: false, restoredPreviousArchive: false };
  const owner = readLocalAccountOwner(storage);
  if (owner.status === 'invalid' || owner.status === 'unavailable') {
    return { ok: false, restoredPreviousArchive: false };
  }
  if (owner.status === 'ready' && owner.accountId === accountId) {
    return removeFromDevice
      ? clearAccountDataFromDevice(storage, accountId)
      : retainAccountBoundProfileAfterDeletion(storage, accountId);
  }

  let before: Map<string, string | null> | null = null;
  try {
    before = snapshot(storage, [
      archiveKey,
      metadataKey,
      ACCOUNT_V2_RETAINED_OWNER_KEY,
      FIRST_READING_STORAGE_KEY,
      ...livingChartSyncMetadataKeys(accountId),
    ]);
    if (!sanitizeLegacyFirstReadingIdentity(storage)) throw new Error('legacy identity cleanup failed');
    const cleared = clearCurrentAccountV2Metadata(storage, accountId, { preserveOwner: true });
    if (!cleared.ok) throw new Error('metadata cleanup failed');
    if (removeFromDevice) storage.removeItem(archiveKey);
    livingChartSyncMetadataKeys(accountId).forEach((key) => storage.removeItem(key));
    const retained = readRetainedAccountOwner(storage);
    if (retained.status === 'invalid' || retained.status === 'unavailable') {
      throw new Error('retention boundary unavailable');
    }
    if (retained.status === 'ready' && retained.accountId === accountId) {
      storage.removeItem(ACCOUNT_V2_RETAINED_OWNER_KEY);
    }
    if (removeFromDevice) {
      clearLivingChartForBoundary(storage, { kind: 'account', accountId });
    }
    return { ok: true, restoredPreviousArchive: false };
  } catch {
    if (before) restoreSnapshot(storage, before);
    return { ok: false, restoredPreviousArchive: false };
  }
}

/** Explicit sign-out cleanup: removes every Zodiacs-owned local/session key. */
export async function clearAllZodiacsDataFromDevice(
  local: AccountV2Storage,
  session: AccountV2Storage,
): Promise<LocalProfileBoundaryResult> {
  const browserLocal = isBrowserLocalStorage(local);
  if (browserLocal) {
    // The caller holds the exclusive profile boundary. A successful result
    // must include the canonical calendar fence/record transaction committing.
    let cleared = false;
    try { cleared = await clearCalendarFeedStore(window.indexedDB); } catch { /* Fail closed. */ }
    if (!cleared) return { ok: false, restoredPreviousArchive: false };
  }
  const stores = [local, session];
  let ok = true;
  for (const storage of stores) {
    let keys: string[];
    try {
      keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
        .filter((key): key is string => (
          key?.startsWith('zodiacs.') === true || key?.startsWith('zodiacs:') === true
        ));
    } catch {
      ok = false;
      continue;
    }
    for (const key of keys) {
      try {
        storage.removeItem(key);
      } catch {
        ok = false;
      }
    }
  }
  // Record the IndexedDB deletion after enumerating localStorage. Otherwise
  // this same cleanup loop removes the durable retry marker it just created.
  clearLivingChartForBoundary(local, 'all');
  // Calendar removal keys can also live only in this document when storage
  // refused them. Clear those and fence late requests before sign-out/reload.
  if (ok && browserLocal) {
    window.dispatchEvent(new Event('zodiacs:calendar-feeds-cleared'));
    // Cross-document messages request an authoritative read; they never
    // replace the transaction fence or leave a retained storage marker.
    try {
      if (window.BroadcastChannel) {
        const channel = new window.BroadcastChannel(CALENDAR_FEED_CHANGE_CHANNEL);
        channel.postMessage('changed');
        channel.close();
      }
    } catch { /* A resumed document refreshes from IndexedDB directly. */ }
  }
  return { ok, restoredPreviousArchive: false };
}

function isBrowserLocalStorage(storage: AccountV2Storage): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return storage === window.localStorage;
  } catch {
    return false;
  }
}

function livingChartOwnerForBoundary(
  storage: AccountV2Storage,
): LivingChartOwnerScope | null {
  if (!isBrowserLocalStorage(storage)) return null;
  const owner = readLocalAccountOwner(storage);
  if (owner.status === 'ready') return { kind: 'account', accountId: owner.accountId };
  if (owner.status !== 'missing') return null;
  try {
    const raw = storage.getItem(LIVING_CHART_GUEST_VAULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: unknown; vaultId?: unknown };
    return parsed.version === 1 && isAccountV2Id(parsed.vaultId)
      ? { kind: 'guest', vaultId: parsed.vaultId.toLowerCase() }
      : null;
  } catch {
    return null;
  }
}

/** Mounted timelines must never retain records across an ownership transition. */
function invalidateLivingChartForBoundary(storage: AccountV2Storage): void {
  if (!isBrowserLocalStorage(storage)) return;
  invalidateLivingChartAccess();
}

/**
 * Starts a content-free, durable IndexedDB clear from the already-authorized
 * exclusive boundary, even after shared read leases are revoked. Invalidation
 * remains the fail-closed fallback when the request marker cannot be recorded.
 */
function clearLivingChartForBoundary(
  storage: AccountV2Storage,
  target: LivingChartOwnerScope | 'all' | null,
): void {
  if (!isBrowserLocalStorage(storage)) return;
  if (!target || !requestLivingChartClear(target, { boundaryAuthorized: true })) {
    invalidateLivingChartAccess();
  }
}

function activeValues(
  storage: AccountV2Storage,
): LocalProfileArchiveV1['values'] {
  const values: LocalProfileArchiveV1['values'] = {};
  for (const key of ACCOUNT_BOUNDARY_PROFILE_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return values;
}

function replaceActiveValues(
  storage: AccountV2Storage,
  values: LocalProfileArchiveV1['values'],
): void {
  for (const key of ACCOUNT_BOUNDARY_PROFILE_KEYS) {
    const value = values[key];
    if (typeof value === 'string') storage.setItem(key, value);
    else storage.removeItem(key);
  }
}

function parseArchive(serialized: string | null, accountId: string): LocalProfileArchiveV1 | null {
  if (serialized === null || utf8Bytes(serialized) > MAX_ARCHIVE_BYTES) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'accountId,values,version'
    || record.version !== ARCHIVE_VERSION
    || record.accountId !== accountId
    || !record.values
    || typeof record.values !== 'object'
    || Array.isArray(record.values)) return null;

  const rawValues = record.values as Record<string, unknown>;
  if (Object.keys(rawValues).some((key) => !ACCOUNT_BOUNDARY_PROFILE_KEYS.includes(
    key as (typeof ACCOUNT_BOUNDARY_PROFILE_KEYS)[number],
  ))) return null;
  if (Object.values(rawValues).some((value) => typeof value !== 'string')) return null;
  return {
    version: ARCHIVE_VERSION,
    accountId,
    values: rawValues as LocalProfileArchiveV1['values'],
  };
}

function snapshot(storage: AccountV2Storage, keys: readonly string[]): Map<string, string | null> {
  return new Map(keys.map((key) => [key, storage.getItem(key)]));
}

function restoreSnapshot(storage: AccountV2Storage, values: Map<string, string | null>): void {
  for (const [key, value] of values) {
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch {
      // Continue restoring independent keys even if one storage surface is blocked.
    }
  }
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
