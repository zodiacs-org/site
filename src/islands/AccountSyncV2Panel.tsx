import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Session } from '@supabase/supabase-js';
import { useProfile } from '../lib/hooks/useProfile';
import { useProfileAccessGeneration } from '../lib/hooks/useProfileAccessGeneration';
import { loadProfile, replaceProfile } from '../lib/profile/store';
import { MAX_CHARTS, type SavedChart } from '../lib/profile/schema';
import {
  AccountV2ClientError,
  CHART_SYNC_POLICY_VERSION,
  bootstrapAccountV2,
  deleteSyncedChart,
  downloadAccountExport,
  finishZodiacsAccountDeletion,
  getSyncedChart,
  getZodiacsAccountDeletionStatus,
  prepareZodiacsAccountDeletion,
  pullAccountChanges,
  putSelfChart,
  recordChartSyncConsent,
} from '../lib/account-v2/client';
import { selfChartPutWire } from '../lib/account-v2/chart-wire';
import {
  clearConfirmedAccountDeletionRequest,
  clearConfirmedAccountPrivacyWithdrawal,
  createAccountSyncMetadata,
  inspectLocalAccountBoundary,
  listAccountDeletionRequests,
  persistAccountDeletionRequest,
  persistAccountPrivacyWithdrawal,
  persistAccountSyncMetadata,
  readAccountDeletionRequest,
  readAccountPrivacyWithdrawal,
  readAccountSyncMetadata,
  readLocalAccountOwner,
  lockCurrentAccountProfile,
  retainCurrentAccountProfile,
  withAccountSyncCursor,
  withChartSyncMetadata,
  withPendingConsentOperation,
  type AccountV2Storage,
} from '../lib/account-v2/local-state';
import type {
  AccountBoundaryDecision,
  AccountBoundaryState,
  AccountDeletionRequestV1,
  AccountSyncMetadataV1,
} from '../lib/account-v2/types';
import {
  clearAllZodiacsDataFromDevice,
  completeDeletedAccountLocalData,
  completeAccountBoundaryDecision,
  hasAccountBoundLocalProfileData,
} from '../lib/account-v2/profile-boundary';
import { savedChartFromRemote } from '../lib/account-v2/remote-chart';
import {
  consentMutationFingerprintV1,
  deleteChartMutationFingerprintV1,
  putChartMutationFingerprintV1,
} from '../lib/account-v2/mutation-fingerprint';
import {
  samePendingChartOperation,
  samePendingConsentOperation,
} from '../lib/account-v2/pending-operation';
import { createAccountDeletionRecoverySecret } from '../lib/account-v2/deletion-recovery';
import {
  assertAccountAuthEpochCurrent,
  beginAccountAuthEpoch,
  readAccountAuthSnapshotAtCurrentEpoch,
} from '../lib/account-v2/auth-epoch';
import { getAccountV2BrowserStorage } from '../lib/account-v2/browser-storage';
import {
  ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT,
  profileAccessAllowed,
  waitForProfileAccess,
} from '../lib/account-v2/profile-access';
import { runExclusiveAccountProfileTransition } from '../lib/account-v2/profile-lease';
import { savedRecordsEnabled, savedRecordsRetainedOnDevice } from '../lib/profile/saved-record-flags';

type SyncModule = typeof import('../lib/profile/sync');
type SavedRecordAccess = typeof import('../lib/profile/saved-record-access');
type SavedRecordEraseTicket = import('../lib/profile/saved-record-access').SavedRecordEraseTicket;
type SavedRecordEraseTarget = import('../lib/profile/saved-record-access').SavedRecordEraseTarget;
type SavedRecordDiscovery = import('../lib/profile/saved-record-access').SavedRecordDiscovery;
type SavedRecordDeps = import('../lib/profile/saved-record-access').SavedRecordDeps;

/**
 * Loaded when the local calculation-record lifecycle is built in, and also when
 * it is not but records kept while it was are still on this device: the build
 * flag gates writing and the record surfaces, never cleanup. With the module
 * needed, one that fails to load (a lost chunk after a deploy, a blocked
 * request) is `unavailable`, never the same as `disabled`: the records on this
 * device cannot be inspected, so no destructive action may report that it
 * removed them. `deps` is present only for the retained-data mode, where it
 * caps every operation to find, export and remove.
 */
export type SavedRecordAccessLoad =
  | { status: 'disabled' }
  | { status: 'unavailable' }
  | { status: 'ready'; api: SavedRecordAccess; deps?: SavedRecordDeps };
async function loadSavedRecordAccess(): Promise<SavedRecordAccessLoad> {
  const enabled = savedRecordsEnabled();
  // Probing enumerates databases and creates nothing, so a device that never
  // had the feature on takes exactly the path it takes today.
  const retained = enabled ? false : await savedRecordsRetainedOnDevice();
  if (!enabled && !retained) return { status: 'disabled' };
  try {
    const api = await import('../lib/profile/saved-record-access');
    return { status: 'ready', api, ...(retained ? { deps: api.retainedSavedRecordDeps() } : {}) };
  } catch {
    return { status: 'unavailable' };
  }
}

export type SavedRecordErasePlan =
  | { status: 'none' }
  | { status: 'absent'; target: SavedRecordEraseTarget; api: SavedRecordAccess; deps?: SavedRecordDeps }
  | { status: 'ready'; ticket: SavedRecordEraseTicket; api: SavedRecordAccess; deps?: SavedRecordDeps }
  | { status: 'blocked'; message: string };

export const RECORDS_BLOCKED_MESSAGE = 'Calculation records on this device could not be prepared for removal safely, so nothing was removed. Try again, or clear this site’s data in browser settings.';

/**
 * "Clear all Zodiacs data" removes every zodiacs.* key, and with them the
 * keys this browser keeps for removing the transit calendars it subscribed
 * to (src/lib/calendar-feed/client.ts); the server keeps only their digests.
 */
export const CLEAR_ALL_CALENDARS_NOTE = '“Sign out · clear all Zodiacs data” also deletes the keys this browser keeps for removing the transit calendars you subscribed to here. After that, you can remove such a calendar only by sending its address to admin@zodiacs.org.';

/**
 * Pins a records erasure before the exclusive transition. `none` means the
 * feature is not built in; an observed absence is carried into the transition
 * and re-checked there, never treated as proof that nothing needs removing.
 */
export async function planSavedRecordErasure(
  target: SavedRecordEraseTarget,
  load: () => Promise<SavedRecordAccessLoad> = loadSavedRecordAccess,
): Promise<SavedRecordErasePlan> {
  const loaded = await load();
  if (loaded.status === 'disabled') return { status: 'none' };
  if (loaded.status === 'unavailable') return { status: 'blocked', message: RECORDS_BLOCKED_MESSAGE };
  const { api, deps } = loaded;
  const prepared = await api.prepareSavedRecordErasure(target, deps);
  if (prepared.status === 'ready') return { status: 'ready', ticket: prepared.ticket, api, deps };
  if (prepared.status === 'absent') return { status: 'absent', target, api, deps };
  if (prepared.status === 'disabled') return { status: 'none' };
  return { status: 'blocked', message: RECORDS_BLOCKED_MESSAGE };
}

/**
 * Two-phase erasure inside the transition: a failure before intent stops the
 * caller, and so does an absence that no longer holds under the transition
 * (`failed`, nothing removed). Only a `none` plan skips without looking.
 */
export async function runPlannedSavedRecordErasure(
  plan: SavedRecordErasePlan,
  authorized: () => boolean,
): Promise<SavedRecordEraseOutcome> {
  if (plan.status === 'none') return 'skipped';
  if (plan.status === 'blocked') return 'failed';
  if (plan.status === 'absent') {
    const confirmed = await plan.api.confirmSavedRecordsAbsent(plan.target, authorized, plan.deps);
    return confirmed.ok ? 'skipped' : 'failed';
  }
  const result = await plan.api.eraseSavedRecords(plan.ticket, authorized, plan.deps);
  if (result.ok) return 'erased';
  return result.mayHaveCommitted ? 'pending' : 'failed';
}

export type SavedRecordEraseOutcome = 'skipped' | 'erased' | 'pending' | 'failed';
type ConsentState = 'pending' | 'granted' | 'withdrawn';
type ViewState = 'loading' | 'signed-out' | 'boundary' | 'legacy' | 'deleting' | 'ready' | 'error';

interface ReadyAccount {
  deviceId: string;
  metadata: AccountSyncMetadataV1;
  consent: ConsentState;
}

interface CloudRefreshResult {
  metadata: AccountSyncMetadataV1;
  consent: ConsentState;
  terminal: boolean;
}

interface AccountSyncV2PanelProps {
  /** Server-computed exact feature flag. Client code cannot enable this surface. */
  enabled?: boolean;
}

interface DailySunDeletionTruth {
  dailySunRevoked: boolean;
  dailySunReconciliationRequired: boolean;
}

function safeRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function displayAccountV2Error(error: unknown, hasDurableMutation = false): string {
  if (error instanceof AccountV2ClientError) {
    if (error.code === 'reauthentication_required') {
      return 'For security, sign out and use a fresh sign-in link before deleting the account.';
    }
    if (error.code === 'network_unavailable') {
      return hasDurableMutation
        ? 'The server may have completed this action, but this browser could not confirm it. Retry the same action safely or check cloud status; the saved request identity is reused only when nothing changed.'
        : 'The connection ended before the server response could be confirmed. Check your connection and try again.';
    }
    if (error.status >= 500 || error.code === 'invalid_response') {
      return hasDurableMutation
        ? 'The outcome is unknown. This browser kept the pending request so an unchanged retry is safe; check cloud status before choosing a different action.'
        : 'The server response could not be confirmed. Check your connection and try again.';
    }
    if (error.code === 'disabled') return 'The private account canary is not enabled on the server.';
    if (error.code === 'canary_not_allowed') return 'This account is not in the private sync canary. No chart was uploaded.';
    if (error.code === 'deletion_receipt_not_found') {
      return 'The saved deletion request has not been prepared on the server. Sign in again to continue with this same request.';
    }
    if (error.code === 'deletion_receipt_expired') {
      return 'The deletion recovery window expired before completion. The local recovery record was kept; contact support before starting another deletion.';
    }
  }
  return hasDurableMutation
    ? 'That result could not be confirmed. This browser kept the pending request for a reconciliation-safe retry.'
    : 'That action could not be completed safely. Nothing else will happen until you try again.';
}

export function accountDeletionCompletionMessage(
  removeFromDevice: boolean,
  dailySun: DailySunDeletionTruth,
): string {
  const accountResult = removeFromDevice
    ? 'The account, cloud charts, and this account’s charts in this browser were deleted.'
    : 'The account and cloud charts were deleted. Device-only charts remain in this browser.';
  if (dailySun.dailySunReconciliationRequired) {
    return `${accountResult} Daily Sun cleanup could not be confirmed. This browser kept the recovery proof so you can retry; if emails continue, use their unsubscribe link or contact support.`;
  }
  return dailySun.dailySunRevoked
    ? `${accountResult} The Daily Sun subscription for this email was deleted.`
    : `${accountResult} No matching Daily Sun subscription needed removal.`;
}

/** Reconciles a lost consent response without preserving a phantom cloud chart. */
export function reconcileBootstrapConsentMetadata(
  metadata: AccountSyncMetadataV1,
  consent: ConsentState,
): AccountSyncMetadataV1 | null {
  const pendingConsent = metadata.pendingConsentOperation;
  const consentWasReconciled = pendingConsent !== null && (
    (pendingConsent.decision === 'grant' && consent === 'granted')
    || (pendingConsent.decision === 'withdraw' && consent === 'withdrawn')
  );
  let reconciled = consentWasReconciled
    ? withPendingConsentOperation(metadata, null)
    : metadata;
  if (!reconciled) return null;

  // Withdrawal deletes the remote source transactionally. A response can be
  // lost after that commit, so bootstrap must not leave the UI claiming that
  // an encrypted cloud copy or chart mutation still exists.
  if (consent === 'withdrawn') {
    reconciled = {
      ...reconciled,
      charts: reconciled.charts.map((chart) => ({
        ...chart,
        selectedForSync: false,
        pendingOperation: null,
      })),
    };
  }
  return reconciled;
}

export function reconcilePulledConsent(
  metadata: AccountSyncMetadataV1,
  operation: 'grant' | 'withdraw',
): CloudRefreshResult | null {
  const nextConsent = operation === 'grant' ? 'granted' : 'withdrawn';
  const reconciled = reconcileBootstrapConsentMetadata(metadata, nextConsent);
  return reconciled ? { metadata: reconciled, consent: nextConsent, terminal: false } : null;
}

function freshUuid(): string | null {
  return typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : null;
}

export default function AccountSyncV2Panel({ enabled = false }: AccountSyncV2PanelProps) {
  const { profile } = useProfile();
  const browserStorage = useMemo(
    () => enabled ? getAccountV2BrowserStorage() : null,
    [enabled],
  );
  const accountStorage = browserStorage?.local ?? null;
  const [view, setView] = useState<ViewState>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [syncApi, setSyncApi] = useState<SyncModule | null>(null);
  const [account, setAccount] = useState<ReadyAccount | null>(null);
  const [boundary, setBoundary] = useState<AccountBoundaryState | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [attestedChartId, setAttestedChartId] = useState<string | null>(null);
  const [withdrawArmed, setWithdrawArmed] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [clearDeviceOnDelete, setClearDeviceOnDelete] = useState(true);
  const [pendingDeletions, setPendingDeletions] = useState<AccountDeletionRequestV1[]>([]);
  const [recordsBoundary, setRecordsBoundary] = useState<SavedRecordDiscovery | null>(null);
  const authEpoch = useRef(0);
  const profileAccessGeneration = useProfileAccessGeneration(() => {
    setAttestedChartId(null);
  });

  function profileAccessGenerationCurrent(generation: number): boolean {
    return generation === profileAccessGeneration.current;
  }

  function activeProfileBoundaryCurrent(
    generation: number,
    storage: AccountV2Storage,
    accountId: string,
  ): boolean {
    if (!profileAccessGenerationCurrent(generation) || !profileAccessAllowed()) return false;
    const owner = readLocalAccountOwner(storage);
    return owner.status === 'ready' && owner.accountId === accountId;
  }

  function assertActiveProfileBoundaryCurrent(
    generation: number,
    storage: AccountV2Storage,
    accountId: string,
  ): void {
    if (!activeProfileBoundaryCurrent(generation, storage, accountId)) {
      throw new Error('stale-profile-boundary');
    }
  }

  function beginAuthTransition(): number {
    return beginAccountAuthEpoch(authEpoch);
  }

  function assertActionCurrent(epoch: number): void {
    assertAccountAuthEpochCurrent(authEpoch, epoch);
  }

  async function initialize(nextSession: Session): Promise<void> {
    const epoch = beginAuthTransition();
    setBusy(false);
    setSession(nextSession);
    setAccount(null);
    setBoundary(null);
    setMessage('');
    setView('loading');

    const storage = browserStorage?.local;
    if (!storage) {
      setMessage('This browser blocks private local storage. Cloud privacy controls remain available, but chart sync is locked.');
      setView('error');
      return;
    }
    let nextBoundary = inspectLocalAccountBoundary(
      storage,
      nextSession.user.id,
      hasAccountBoundLocalProfileData(storage),
    );
    if (nextBoundary.status === 'blocked') {
      setMessage('This browser’s account boundary is unavailable. No chart was uploaded.');
      setView('error');
      return;
    }
    // Guest calculation records are invisible to the synchronous legacy check.
    // Discover them (content-free) before the browser can be treated as empty.
    const recordsAccess = await loadSavedRecordAccess();
    if (authEpoch.current !== epoch) return;
    let records: SavedRecordDiscovery | null = null;
    if (recordsAccess.status !== 'disabled') {
      // A module that cannot load is as opaque as unavailable storage: this
      // browser cannot be shown to be empty, so it is not bound.
      records = recordsAccess.status === 'ready'
        ? await recordsAccess.api.discoverSavedRecordBoundary(recordsAccess.deps)
        : { status: 'unavailable', guestRecords: 0 };
      if (authEpoch.current !== epoch) return;
      // Only an empty-looking browser is gated on discovery (the bootstrap
      // applies the same rule before auto-binding). A bound or mismatched
      // browser keeps its legacy hand-off; the records panel reports its own
      // failure state there.
      // Unsupported record storage (no readable database) means this client
      // could not have kept guest records there, so it never gates the hand-off.
      const emptyLookingBrowser = nextBoundary.status === 'ready' && nextBoundary.localOwnerAccountId === null;
      if (emptyLookingBrowser && (records.status === 'pending' || records.status === 'unavailable')) {
        setMessage(records.status === 'pending'
          ? 'Calculation records on this device are still being removed. Open Profile again in a moment; no chart was uploaded.'
          : 'Calculation records on this device could not be checked safely, so this browser cannot be bound to the account yet. No chart was uploaded.');
        setView('error');
        return;
      }
      if (records.status === 'guest-records' && emptyLookingBrowser) {
        nextBoundary = {
          status: 'decision-required',
          reason: 'unowned-local-data',
          authenticatedAccountId: nextSession.user.id,
          localOwnerAccountId: null,
          decisions: ['import', 'clear', 'cancel'],
        };
      }
    }
    setRecordsBoundary(records);
    if (nextBoundary.status === 'decision-required') {
      setBoundary(nextBoundary);
      setView('boundary');
      return;
    }
    const accessReady = await waitForProfileAccess(5_000, () => {
      const owner = readLocalAccountOwner(storage);
      return owner.status === 'ready' && owner.accountId === nextSession.user.id;
    });
    if (authEpoch.current !== epoch) return;
    if (!accessReady) {
      setMessage('This browser could not acquire the private profile lease. Close other Zodiacs tabs and try again; no chart was uploaded.');
      setView('error');
      return;
    }
    const accessGeneration = profileAccessGeneration.current;
    if (!activeProfileBoundaryCurrent(accessGeneration, storage, nextSession.user.id)) return;

    const stored = readAccountSyncMetadata(storage, nextSession.user.id);
    const newDeviceId = stored.status === 'missing' ? freshUuid() : null;
    let metadata = stored.status === 'ready'
      ? stored.metadata
      : stored.status === 'missing'
        ? newDeviceId && createAccountSyncMetadata(nextSession.user.id, newDeviceId)
        : null;
    if (!metadata || !persistAccountSyncMetadata(storage, metadata)) {
      setMessage('The account’s local sync metadata is invalid or unavailable. No chart was uploaded.');
      setView('error');
      return;
    }

    try {
      const result = await bootstrapAccountV2(nextSession.access_token, metadata.deviceId);
      if (authEpoch.current !== epoch) return;
      if (!activeProfileBoundaryCurrent(accessGeneration, storage, nextSession.user.id)) return;
      if (result.outcome === 'legacy_migration_required') {
        setMessage('This account has charts from the earlier cloud system. They were not copied, encrypted, or deleted. Export them before an explicit migration is offered.');
        setView('legacy');
        return;
      }
      if (result.outcome === 'deleting') {
        setMessage('Your private data deletion was prepared, but the sign-in identity still needs to be removed. You can safely finish it below.');
        setView('deleting');
        return;
      }
      if (result.outcome === 'device_limit_reached') {
        setMessage('This account has reached the private-sync device limit. Export, withdrawal, and permanent deletion remain available below; contact support before adding another device.');
        setView('error');
        return;
      }
      if (result.outcome !== 'ready'
        || (result.chart_sync_consent !== 'pending'
          && result.chart_sync_consent !== 'granted'
          && result.chart_sync_consent !== 'withdrawn')) {
        throw new Error('bootstrap');
      }
      const reconciled = reconcileBootstrapConsentMetadata(
        metadata,
        result.chart_sync_consent,
      );
      if (authEpoch.current !== epoch) return;
      if (!activeProfileBoundaryCurrent(accessGeneration, storage, nextSession.user.id)) return;
      if (!reconciled) throw new Error('metadata');
      if (reconciled !== metadata && !persistAccountSyncMetadata(storage, reconciled)) {
        throw new Error('metadata');
      }
      metadata = reconciled;
      const ready: ReadyAccount = {
        deviceId: metadata.deviceId,
        metadata,
        consent: result.chart_sync_consent,
      };
      setAccount(ready);
      setView('ready');
      if (ready.consent === 'granted') {
        const refreshed = await refreshFromCloud(nextSession, ready, false, epoch);
        if (authEpoch.current !== epoch) return;
        setAccount({ ...ready, ...refreshed });
        if (refreshed.terminal) {
          setMessage('Account deletion has started. Cloud synchronization is locked; finish the confirmed deletion below.');
          setView('deleting');
        }
      }
    } catch (error) {
      if (authEpoch.current !== epoch) return;
      setMessage(displayAccountV2Error(error));
      setView('error');
    }
  }

  function showSignedOutState(): void {
    beginAuthTransition();
    setBusy(false);
    const pending = browserStorage
      ? listAccountDeletionRequests(browserStorage.local)
      : { status: 'unavailable' as const };
    setSession(null);
    setAccount(null);
    setBoundary(null);
    if (pending.status === 'ready') {
      setPendingDeletions(pending.requests);
    } else {
      setPendingDeletions([]);
      setMessage('A saved deletion recovery record is unreadable. Sign in to review the account, or clear this site’s data in browser settings.');
    }
    setView('signed-out');
  }

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    let unsubscribe = () => {};
    void import('../lib/profile/sync').then(async (api) => {
      if (!live || !api.isSupabaseConfigured()) {
        if (live) {
          setMessage('Account sign-in is not configured. Your charts remain on this device.');
          setView('error');
        }
        return;
      }
      setSyncApi(api);
      unsubscribe = api.onSyncAuthChange((next) => {
        if (!live) return;
        if (next) void initialize(next);
        else showSignedOutState();
      });
      const snapshot = await readAccountAuthSnapshotAtCurrentEpoch(
        authEpoch,
        () => api.getSyncSession(),
      );
      if (!live || snapshot.status === 'stale') return;
      if (snapshot.status === 'error') {
        setMessage('Account sign-in is unavailable. Your charts remain on this device.');
        setView('error');
        return;
      }
      if (snapshot.value) void initialize(snapshot.value);
      else showSignedOutState();
    }).catch(() => {
      if (live) {
        setMessage('Account sign-in is unavailable. Your charts remain on this device.');
        setView('error');
      }
    });
    return () => {
      live = false;
      beginAuthTransition();
      unsubscribe();
    };
  }, [enabled]);

  function saveMetadata(metadata: AccountSyncMetadataV1): boolean {
    const storage = browserStorage?.local;
    if (!account || !storage || !persistAccountSyncMetadata(storage, metadata)) {
      setMessage('Local sync metadata could not be saved. The cloud action was stopped.');
      return false;
    }
    setAccount({ ...account, metadata });
    return true;
  }

  async function refreshFromCloud(
    activeSession = session,
    readyAccount = account,
    announce = true,
    epoch = authEpoch.current,
  ): Promise<CloudRefreshResult> {
    if (!activeSession || !readyAccount) throw new Error('not ready');
    if (authEpoch.current !== epoch) throw new Error('stale-auth-transition');
    const afterCursor = readyAccount.metadata.serverCursor === null
      ? 0
      : Number(readyAccount.metadata.serverCursor);
    if (!Number.isSafeInteger(afterCursor) || afterCursor < 0) throw new Error('cursor');
    const result = await pullAccountChanges(activeSession.access_token, {
      deviceId: readyAccount.deviceId,
      afterCursor,
      limit: 100,
    });
    if (authEpoch.current !== epoch) throw new Error('stale-auth-transition');
    if (result.outcome === 'deleting') {
      if (announce) {
        setMessage('Account deletion has started. Cloud synchronization is locked; finish the confirmed deletion below.');
      }
      return {
        metadata: readyAccount.metadata,
        consent: readyAccount.consent,
        terminal: true,
      };
    }
    if (result.outcome !== 'ready'
      || !Array.isArray(result.changes)
      || !safeRevision(result.next_cursor)
      || typeof result.has_more !== 'boolean') throw new Error('pull');

    let metadata = readyAccount.metadata;
    let consent = readyAccount.consent;
    let terminal = false;
    if (!profileAccessAllowed()) throw new Error('profile-access-locked');
    const local = loadProfile();
    let localChanged = false;
    let keptLocalConflict = false;
    for (const change of result.changes) {
      if (!change || typeof change !== 'object' || Array.isArray(change)) throw new Error('change');
      const row = change as Record<string, unknown>;
      if (row.entity_type === 'account') {
        if (row.entity_id !== null || row.operation !== 'delete' || !safeRevision(row.revision)) {
          throw new Error('change');
        }
        terminal = true;
        continue;
      }
      if (row.entity_type === 'consent') {
        if (row.entity_id !== null
          || !safeRevision(row.revision)
          || (row.operation !== 'grant' && row.operation !== 'withdraw')) throw new Error('change');
        const reconciled = reconcilePulledConsent(metadata, row.operation);
        if (!reconciled) throw new Error('metadata');
        metadata = reconciled.metadata;
        consent = reconciled.consent;
        continue;
      }
      if (row.entity_type !== 'chart') continue;
      if (typeof row.entity_id !== 'string' || !safeRevision(row.revision)) {
        throw new Error('change');
      }
      if (row.operation !== 'upsert' && row.operation !== 'delete') {
        throw new Error('change');
      }
      const existingMeta = metadata.charts.find((chart) => chart.chartId === row.entity_id);
      if (row.operation === 'delete') {
        if (existingMeta && row.revision < existingMeta.serverRevision) continue;
        const pendingOperation = existingMeta?.pendingOperation ?? null;
        const next = withChartSyncMetadata(metadata, {
          chartId: row.entity_id,
          selectedForSync: false,
          serverRevision: row.revision,
          pendingOperation: pendingOperation && row.revision <= pendingOperation.baseRevision
            ? pendingOperation
            : null,
        });
        if (!next) throw new Error('metadata');
        metadata = next;
        continue;
      }
      if (row.operation !== 'upsert') continue;

      if (existingMeta && row.revision < existingMeta.serverRevision) continue;

      const localIndex = local.charts.findIndex((chart) => chart.id === row.entity_id);
      if (localIndex < 0) {
        const remote = await getSyncedChart(activeSession.access_token, {
          deviceId: readyAccount.deviceId,
          chartId: row.entity_id,
        });
        if (authEpoch.current !== epoch) throw new Error('stale-auth-transition');
        const restored = await savedChartFromRemote(remote);
        if (authEpoch.current !== epoch) throw new Error('stale-auth-transition');
        if (!restored || local.charts.length >= MAX_CHARTS) throw new Error('restore');
        local.charts.unshift(restored.chart);
        localChanged = true;
      } else if (existingMeta && existingMeta.serverRevision < row.revision) {
        // Never silently overwrite a locally present birth record.
        keptLocalConflict = true;
      }
      const next = withChartSyncMetadata(metadata, {
        chartId: row.entity_id,
        selectedForSync: true,
        serverRevision: row.revision,
        pendingOperation: existingMeta?.pendingOperation
          && row.revision <= existingMeta.pendingOperation.baseRevision
          ? existingMeta.pendingOperation
          : null,
      });
      if (!next) throw new Error('metadata');
      metadata = next;
    }
    const withCursor = withAccountSyncCursor(metadata, String(result.next_cursor));
    if (!withCursor) throw new Error('metadata');
    // Write restored source data before consuming its server cursor. If the
    // profile write fails, the same change remains eligible for a safe retry.
    if (authEpoch.current !== epoch || !profileAccessAllowed()) {
      throw new Error('stale-profile-access');
    }
    // A terminal account row wins over every earlier chart row in the same
    // page. Never materialize a cloud chart after deletion has begun.
    if (localChanged && !terminal && !replaceProfile(local)) throw new Error('local profile');
    if (authEpoch.current !== epoch) throw new Error('stale-auth-transition');
    const storage = browserStorage?.local;
    if (!storage || !persistAccountSyncMetadata(storage, withCursor)) throw new Error('metadata');
    if (authEpoch.current !== epoch) throw new Error('stale-auth-transition');
    if (announce) {
      setMessage(consent !== readyAccount.consent
        ? consent === 'withdrawn'
          ? 'Sync consent was withdrawn on another device. The cloud birth record was erased; local charts remain here.'
          : 'Private chart sync was turned on from another device. Nothing uploads here until you choose and confirm one self chart.'
        : keptLocalConflict
          ? 'Cloud changes were found. This device kept its local birth record. Restore the cloud copy here, or explicitly update the cloud from this device.'
          : localChanged
            ? 'Your encrypted self chart was restored to this device.'
            : 'This device is up to date.');
    }
    return { metadata: withCursor, consent, terminal };
  }

  async function onSendLink(event: Event) {
    event.preventDefault();
    if (!syncApi || !email.trim()) return;
    setBusy(true);
    setMessage('');
    const epoch = authEpoch.current;
    try {
      const result = await syncApi.sendMagicLink(email.trim());
      if (authEpoch.current !== epoch) return;
      setMessage(result.ok
        ? 'Check your email for the private sign-in link. No chart has been uploaded.'
        : result.message);
    } finally {
      if (authEpoch.current === epoch) setBusy(false);
    }
  }

  async function onBoundaryDecision(decision: AccountBoundaryDecision) {
    if (!boundary
      || boundary.status !== 'decision-required'
      || !session
      || !syncApi
      || !accountStorage) return;
    setBusy(true);
    setMessage('');
    const epoch = authEpoch.current;
    try {
      if (decision === 'cancel') {
        await syncApi.signOutOfSyncLocal();
        if (authEpoch.current === epoch) showSignedOutState();
        return;
      }
      assertActionCurrent(epoch);
      // Clearing erases the same owner's calculation records (guest, or the
      // other account); keeping leaves guest records as guest records.
      const plan = decision === 'clear'
        ? await planSavedRecordErasure(boundary.localOwnerAccountId ? { accountId: boundary.localOwnerAccountId } : 'guest')
        : { status: 'none' as const };
      assertActionCurrent(epoch);
      if (plan.status === 'blocked') {
        setMessage(plan.message);
        return;
      }
      const transition = await runExclusiveAccountProfileTransition(
        accountStorage,
        async () => {
          if (authEpoch.current !== epoch) return { ok: false, restoredPreviousArchive: false };
          const records = await runPlannedSavedRecordErasure(plan, () => authEpoch.current === epoch);
          if (records === 'failed') return { ok: false, restoredPreviousArchive: false };
          return completeAccountBoundaryDecision(accountStorage, boundary, decision);
        },
      );
      if (!transition.ok || !transition.value.ok) throw new Error('bind');
      assertActionCurrent(epoch);
      window.location.reload();
    } catch {
      if (authEpoch.current !== epoch) return;
      setMessage('The browser hand-off could not be completed safely. No chart was uploaded.');
    } finally {
      if (authEpoch.current === epoch) setBusy(false);
    }
  }

  async function onConsent(decision: 'grant' | 'withdraw') {
    if (!session || !account || !accountStorage) return;
    const epoch = authEpoch.current;
    const accessGeneration = profileAccessGeneration.current;
    let pendingSaved = false;
    setBusy(true);
    setMessage('');
    try {
      const semanticFingerprint = await consentMutationFingerprintV1(decision === 'grant'
        ? { decision, policyVersion: CHART_SYNC_POLICY_VERSION }
          : { decision });
      assertActionCurrent(epoch);
      assertActiveProfileBoundaryCurrent(
        accessGeneration,
        accountStorage,
        session.user.id,
      );
      const semantics = decision === 'grant'
        ? {
            operation: 'consent' as const,
            decision,
            policyVersion: CHART_SYNC_POLICY_VERSION,
            semanticFingerprint,
          }
        : {
            operation: 'consent' as const,
            decision,
            semanticFingerprint,
          };
      const existing = account.metadata.pendingConsentOperation;
      const mutationId = samePendingConsentOperation(existing, semantics)
        ? existing.mutationId
        : freshUuid();
      if (!mutationId) {
        setMessage('Secure browser randomness is unavailable. Nothing was changed.');
        return;
      }
      const pendingMetadata = withPendingConsentOperation(account.metadata, {
        version: 1,
        mutationId,
        ...semantics,
      });
      if (!pendingMetadata || !saveMetadata(pendingMetadata)) return;
      pendingSaved = true;

      const result = await recordChartSyncConsent(session.access_token, decision, mutationId);
      assertActionCurrent(epoch);
      assertActiveProfileBoundaryCurrent(
        accessGeneration,
        accountStorage,
        session.user.id,
      );
      if (result.outcome === 'mutation_conflict') {
        const cleared = withPendingConsentOperation(pendingMetadata, null);
        if (!cleared || !persistAccountSyncMetadata(accountStorage, cleared)) throw new Error('metadata');
        setAccount({ ...account, metadata: cleared });
        setMessage('That saved retry identity was already used for a different request. Nothing new was changed; try this consent choice again to create a fresh request.');
        return;
      }
      if (result.outcome !== (decision === 'grant' ? 'granted' : 'withdrawn')) {
        throw new Error('consent');
      }
      const confirmed = withPendingConsentOperation(pendingMetadata, null);
      if (!confirmed) throw new Error('metadata');
      const metadata = decision === 'withdraw'
        ? {
            ...confirmed,
            charts: confirmed.charts.map((chart) => ({
              ...chart,
              selectedForSync: false,
              pendingOperation: null,
            })),
          }
        : confirmed;
      if (!persistAccountSyncMetadata(accountStorage, metadata)) throw new Error('metadata');
      setAccount({ ...account, consent: decision === 'grant' ? 'granted' : 'withdrawn', metadata });
      setWithdrawArmed(false);
      setMessage(decision === 'grant'
        ? 'Private chart sync is on. Nothing uploads until you choose and confirm one self chart below.'
        : 'Sync consent was withdrawn and the remote birth record was erased. Local charts remain here.');
    } catch (error) {
      if (authEpoch.current !== epoch) return;
      setMessage(displayAccountV2Error(error, pendingSaved));
    } finally {
      if (authEpoch.current === epoch) setBusy(false);
    }
  }

  async function onPrivacyWithdraw() {
    if (!session) return;
    const epoch = authEpoch.current;
    const accessGeneration = profileAccessGeneration.current;
    let pendingSaved = false;
    setBusy(true);
    setMessage('');
    try {
      const semanticFingerprint = await consentMutationFingerprintV1({ decision: 'withdraw' });
      assertActionCurrent(epoch);
      if (!profileAccessGenerationCurrent(accessGeneration)) return;
      const stored = accountStorage
        ? readAccountPrivacyWithdrawal(accountStorage, session.user.id)
        : { status: 'unavailable' as const };
      const mutationId = stored.status === 'ready'
        && stored.request.semanticFingerprint === semanticFingerprint
        ? stored.request.mutationId
        : freshUuid();
      if (!mutationId) throw new Error('randomness');
      pendingSaved = accountStorage ? persistAccountPrivacyWithdrawal(accountStorage, {
        version: 1,
        accountId: session.user.id,
        mutationId,
        semanticFingerprint,
      }) : false;
      const result = await recordChartSyncConsent(session.access_token, 'withdraw', mutationId);
      assertActionCurrent(epoch);
      if (!profileAccessGenerationCurrent(accessGeneration)) return;
      if (result.outcome !== 'withdrawn' && result.outcome !== 'not_bootstrapped') {
        throw new Error('consent');
      }
      if (pendingSaved && (!accountStorage || !clearConfirmedAccountPrivacyWithdrawal(
        accountStorage,
        session.user.id,
        mutationId,
      ))) {
        throw new Error('metadata');
      }
      setMessage(result.outcome === 'not_bootstrapped'
        ? 'No encrypted sync record existed for this account, so there was nothing to withdraw or erase.'
        : pendingSaved
          ? 'Sync consent was withdrawn and the remote birth record was erased. Local charts remain here.'
          : 'The server confirmed sync withdrawal and remote-chart erasure. This browser could not save a retry record beforehand, so future network failures in this privacy control would require checking again.');
    } catch (error) {
      if (authEpoch.current !== epoch) return;
      setMessage(pendingSaved
        ? displayAccountV2Error(error, true)
        : 'The withdrawal result could not be confirmed, and this browser could not save a retry identity. It is safe to try withdrawal again; you can also export or permanently delete the account.');
    } finally {
      if (authEpoch.current === epoch) setBusy(false);
    }
  }

  async function onPutChart(chart: SavedChart) {
    if (!session
      || !account
      || !accountStorage
      || account.consent !== 'granted'
      || attestedChartId !== chart.id) return;
    const current = account.metadata.charts.find((entry) => entry.chartId === chart.id);
    const selectedOther = account.metadata.charts.find((entry) => (
      entry.selectedForSync && entry.chartId !== chart.id
    ));
    if (selectedOther) {
      setMessage('Only one self chart can be synced in this canary. Remove the current cloud copy first.');
      return;
    }
    const baseRevision = current?.serverRevision ?? 0;
    const provisionalWire = selfChartPutWire(
      chart,
      account.deviceId,
      chart.id,
      baseRevision,
    );
    if (!provisionalWire) {
      setMessage('This chart needs to be reopened and recalculated before it can be synchronized.');
      return;
    }
    setBusy(true);
    setMessage('');
    const epoch = authEpoch.current;
    const accessGeneration = profileAccessGeneration.current;
    let pendingSaved = false;
    try {
      const semanticFingerprint = await putChartMutationFingerprintV1({
        chartId: provisionalWire.chartId,
        baseRevision: provisionalWire.baseRevision,
        label: provisionalWire.label,
        birth: provisionalWire.birth,
        derived: provisionalWire.derived,
      });
      assertActionCurrent(epoch);
      assertActiveProfileBoundaryCurrent(
        accessGeneration,
        accountStorage,
        session.user.id,
      );
      const semantics = {
        operation: 'put_chart' as const,
        chartId: chart.id,
        baseRevision,
        semanticFingerprint,
      };
      const mutationId = samePendingChartOperation(current?.pendingOperation ?? null, semantics)
        ? current!.pendingOperation!.mutationId
        : freshUuid();
      if (!mutationId) {
        setMessage('Secure browser randomness is unavailable. Nothing was uploaded.');
        return;
      }
      const wire = { ...provisionalWire, mutationId };
      const pending = withChartSyncMetadata(account.metadata, {
        chartId: chart.id,
        selectedForSync: current?.selectedForSync ?? false,
        serverRevision: baseRevision,
        pendingOperation: { version: 1, mutationId, ...semantics },
      });
      if (!pending || !saveMetadata(pending)) return;
      pendingSaved = true;

      assertActiveProfileBoundaryCurrent(
        accessGeneration,
        accountStorage,
        session.user.id,
      );
      const result = await putSelfChart(session.access_token, wire);
      assertActionCurrent(epoch);
      assertActiveProfileBoundaryCurrent(
        accessGeneration,
        accountStorage,
        session.user.id,
      );
      if (result.outcome === 'saved' && safeRevision(result.revision)) {
        const saved = withChartSyncMetadata(pending, {
          chartId: chart.id,
          selectedForSync: true,
          serverRevision: result.revision,
          pendingOperation: null,
        });
        if (!saved || !persistAccountSyncMetadata(accountStorage, saved)) throw new Error('metadata');
        setAccount({ ...account, metadata: saved });
        setAttestedChartId(null);
        setMessage('Your self chart is encrypted and synchronized. It is still private.');
      } else if (result.outcome === 'conflict' && safeRevision(result.current_revision)) {
        const conflict = withChartSyncMetadata(pending, {
          chartId: chart.id,
          selectedForSync: result.deleted !== true,
          serverRevision: result.current_revision,
          pendingOperation: null,
        });
        if (!conflict || !persistAccountSyncMetadata(accountStorage, conflict)) throw new Error('metadata');
        setAccount({ ...account, metadata: conflict });
        setMessage('The cloud copy changed first. Restore it to this device, or review the local chart and choose Update again to replace the cloud copy.');
      } else if (result.outcome === 'chart_limit_reached') {
        const cleared = withChartSyncMetadata(pending, {
          ...pending.charts.find((entry) => entry.chartId === chart.id)!,
          pendingOperation: null,
        });
        if (!cleared || !persistAccountSyncMetadata(accountStorage, cleared)) throw new Error('metadata');
        setAccount({ ...account, metadata: cleared });
        setMessage('One self chart is already synchronized. Remove it before choosing another.');
      } else if (result.outcome === 'ineligible_age' && result.minimum_age === 18) {
        const cleared = withChartSyncMetadata(pending, {
          ...pending.charts.find((entry) => entry.chartId === chart.id)!,
          pendingOperation: null,
        });
        if (!cleared || !persistAccountSyncMetadata(accountStorage, cleared)) throw new Error('metadata');
        setAccount({ ...account, metadata: cleared });
        setAttestedChartId(null);
        setMessage('Encrypted account sync is limited to adults aged 18 or older in this preview. The chart remains only on this device.');
      } else if (result.outcome === 'mutation_conflict') {
        const cleared = withChartSyncMetadata(pending, {
          ...pending.charts.find((entry) => entry.chartId === chart.id)!,
          pendingOperation: null,
        });
        if (!cleared || !persistAccountSyncMetadata(accountStorage, cleared)) throw new Error('metadata');
        setAccount({ ...account, metadata: cleared });
        setMessage('That retry identity belongs to a different request. Nothing new was uploaded; choose Update again to create a fresh request.');
      } else {
        throw new Error('put');
      }
    } catch (error) {
      if (authEpoch.current !== epoch) return;
      setMessage(displayAccountV2Error(error, pendingSaved));
    } finally {
      if (authEpoch.current === epoch) setBusy(false);
    }
  }

  async function onDeleteCloud(chartId: string) {
    if (!session || !account || !accountStorage) return;
    const current = account.metadata.charts.find((entry) => entry.chartId === chartId);
    if (!current) return;
    setBusy(true);
    setMessage('');
    const epoch = authEpoch.current;
    const accessGeneration = profileAccessGeneration.current;
    let pendingSaved = false;
    try {
      const semanticFingerprint = await deleteChartMutationFingerprintV1({
        chartId,
        baseRevision: current.serverRevision,
      });
      assertActionCurrent(epoch);
      assertActiveProfileBoundaryCurrent(
        accessGeneration,
        accountStorage,
        session.user.id,
      );
      const semantics = {
        operation: 'delete_chart' as const,
        chartId,
        baseRevision: current.serverRevision,
        semanticFingerprint,
      };
      const mutationId = samePendingChartOperation(current.pendingOperation, semantics)
        ? current.pendingOperation.mutationId
        : freshUuid();
      if (!mutationId) {
        setMessage('Secure browser randomness is unavailable. Nothing was removed.');
        return;
      }
      const pending = withChartSyncMetadata(account.metadata, {
        ...current,
        pendingOperation: { version: 1, mutationId, ...semantics },
      });
      if (!pending || !saveMetadata(pending)) return;
      pendingSaved = true;

      assertActiveProfileBoundaryCurrent(
        accessGeneration,
        accountStorage,
        session.user.id,
      );
      const result = await deleteSyncedChart(session.access_token, {
        deviceId: account.deviceId,
        chartId,
        baseRevision: current.serverRevision,
        mutationId,
      });
      assertActionCurrent(epoch);
      assertActiveProfileBoundaryCurrent(
        accessGeneration,
        accountStorage,
        session.user.id,
      );
      if ((result.outcome === 'deleted' || result.outcome === 'already_deleted')
        && safeRevision(result.revision)) {
        const removed = withChartSyncMetadata(pending, {
          chartId,
          selectedForSync: false,
          serverRevision: result.revision,
          pendingOperation: null,
        });
        if (!removed || !persistAccountSyncMetadata(accountStorage, removed)) throw new Error('metadata');
        setAccount({ ...account, metadata: removed });
        setMessage('The remote encrypted copy was removed. The chart remains on this device.');
      } else if (result.outcome === 'conflict' && safeRevision(result.current_revision)) {
        const conflict = withChartSyncMetadata(pending, {
          chartId,
          selectedForSync: result.deleted !== true,
          serverRevision: result.current_revision,
          pendingOperation: null,
        });
        if (!conflict || !persistAccountSyncMetadata(accountStorage, conflict)) throw new Error('metadata');
        setAccount({ ...account, metadata: conflict });
        setMessage('The cloud copy changed first. Review and try the removal again.');
      } else if (result.outcome === 'mutation_conflict') {
        const cleared = withChartSyncMetadata(pending, {
          ...current,
          pendingOperation: null,
        });
        if (!cleared || !persistAccountSyncMetadata(accountStorage, cleared)) throw new Error('metadata');
        setAccount({ ...account, metadata: cleared });
        setMessage('That retry identity belongs to a different request. Nothing new was removed; choose Remove again to create a fresh request.');
      } else throw new Error('delete');
    } catch (error) {
      if (authEpoch.current !== epoch) return;
      setMessage(displayAccountV2Error(error, pendingSaved));
    } finally {
      if (authEpoch.current === epoch) setBusy(false);
    }
  }

  async function onRefresh() {
    if (!session || !account) return;
    setBusy(true);
    setMessage('');
    const epoch = authEpoch.current;
    try {
      const refreshed = await refreshFromCloud(session, account, true, epoch);
      if (authEpoch.current !== epoch) return;
      setAccount({ ...account, ...refreshed });
      if (refreshed.terminal) setView('deleting');
    } catch (error) {
      if (authEpoch.current !== epoch) return;
      setMessage(displayAccountV2Error(error));
    } finally {
      if (authEpoch.current === epoch) setBusy(false);
    }
  }

  async function onRestoreCloud(chartId: string) {
    if (!session || !account || !accountStorage || !profileAccessAllowed()) return;
    const epoch = authEpoch.current;
    setBusy(true);
    setMessage('');
    try {
      const remote = await getSyncedChart(session.access_token, {
        deviceId: account.deviceId,
        chartId,
      });
      assertActionCurrent(epoch);
      const restored = await savedChartFromRemote(remote);
      assertActionCurrent(epoch);
      if (!profileAccessAllowed()) throw new Error('profile-access-locked');
      if (!restored) throw new Error('restore');
      const local = loadProfile();
      const index = local.charts.findIndex((chart) => chart.id === chartId);
      if (index >= 0) local.charts[index] = restored.chart;
      else {
        if (local.charts.length >= MAX_CHARTS) throw new Error('profile full');
        local.charts.unshift(restored.chart);
      }
      const metadata = withChartSyncMetadata(account.metadata, {
        chartId,
        selectedForSync: true,
        serverRevision: restored.revision,
        pendingOperation: null,
      });
      assertActionCurrent(epoch);
      if (!metadata || !persistAccountSyncMetadata(accountStorage, metadata)) throw new Error('metadata');
      assertActionCurrent(epoch);
      if (!profileAccessAllowed()) throw new Error('profile-access-locked');
      if (!replaceProfile(local)) {
        persistAccountSyncMetadata(accountStorage, account.metadata);
        throw new Error('local profile');
      }
      assertActionCurrent(epoch);
      setAccount({ ...account, metadata });
      setAttestedChartId(null);
      setMessage('The encrypted cloud copy replaced this device’s chart after your explicit choice.');
    } catch (error) {
      if (authEpoch.current !== epoch) return;
      setMessage(displayAccountV2Error(error));
    } finally {
      if (authEpoch.current === epoch) setBusy(false);
    }
  }

  async function onExport() {
    if (!session) return;
    const epoch = authEpoch.current;
    const accessGeneration = profileAccessGeneration.current;
    setBusy(true);
    setMessage('');
    try {
      const exported = await downloadAccountExport(session.access_token);
      assertActionCurrent(epoch);
      if (!profileAccessGenerationCurrent(accessGeneration)) return;
      const url = URL.createObjectURL(new Blob([exported.json], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = exported.filename;
      anchor.rel = 'noopener';
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('Your account export was downloaded to this device.');
    } catch (error) {
      if (authEpoch.current !== epoch) return;
      setMessage(displayAccountV2Error(error));
    } finally {
      if (authEpoch.current === epoch) setBusy(false);
    }
  }

  async function onSignOut(removeFromDevice: boolean) {
    if (!session || !syncApi) return;
    setBusy(true);
    const epoch = beginAuthTransition();
    setMessage('');
    if (!browserStorage || !accountStorage) {
      try {
        await syncApi.signOutOfSyncLocal();
        showSignedOutState();
      } catch {
        setMessage('Sign-out could not be confirmed. This browser remains locked; try again.');
        setBusy(false);
      }
      return;
    }
    const accountId = session.user.id;
    // "Clear all Zodiacs data" is whole-device: every calculation-record
    // namespace on this device, not only the signed-in account's.
    const plan = removeFromDevice ? await planSavedRecordErasure('device') : { status: 'none' as const };
    if (authEpoch.current !== epoch) return;
    if (plan.status === 'blocked') {
      setMessage(`${plan.message} Sign-out was stopped.`);
      setBusy(false);
      return;
    }
    const outcome = { records: 'skipped' as SavedRecordEraseOutcome };
    const transition = await runExclusiveAccountProfileTransition(
      accountStorage,
      async () => {
        if (authEpoch.current !== epoch) return { ok: false };
        if (!removeFromDevice) return { ok: retainCurrentAccountProfile(accountStorage, accountId) };
        // Record intent commits before the legacy stores are touched; a
        // failure before intent stops sign-out with nothing removed.
        outcome.records = await runPlannedSavedRecordErasure(plan, () => authEpoch.current === epoch);
        if (outcome.records === 'failed') return { ok: false };
        return clearAllZodiacsDataFromDevice(accountStorage, browserStorage.session);
      },
    );
    if (authEpoch.current !== epoch) return;
    if (!transition.ok || !transition.value.ok) {
      setMessage(outcome.records === 'failed'
        ? `${RECORDS_BLOCKED_MESSAGE} Sign-out was stopped and nothing else was removed.`
        : 'The browser profile could not be prepared safely, so sign-out was stopped. Close other Zodiacs tabs and try again.');
      setBusy(false);
      return;
    }
    try {
      await syncApi.signOutOfSyncLocal();
      if (removeFromDevice) window.location.reload();
      else showSignedOutState();
    } catch {
      if (!removeFromDevice) {
        await runExclusiveAccountProfileTransition(
          accountStorage,
          () => lockCurrentAccountProfile(accountStorage, accountId),
        );
      }
      window.location.reload();
    }
  }

  async function onDeleteAccount() {
    if (!session || deleteText !== 'DELETE') return;
    if (!accountStorage) {
      setMessage('This browser cannot save the required deletion recovery proof. Use a browser that permits local site storage or contact support.');
      return;
    }
    const epoch = authEpoch.current;
    const accessGeneration = profileAccessGeneration.current;
    let deletionRequestSaved = false;
    let deletionReceipt: DailySunDeletionTruth | null = null;
    setBusy(true);
    setMessage('');
    try {
      const storedRequest = readAccountDeletionRequest(accountStorage, session.user.id);
      if (storedRequest.status === 'invalid' || storedRequest.status === 'unavailable') {
        setMessage('The saved deletion request could not be read safely. Nothing new was deleted; clear this site’s local storage or contact support before retrying.');
        return;
      }
      const requestId = storedRequest.status === 'ready'
        ? storedRequest.request.requestId
        : freshUuid();
      const recoverySecret = storedRequest.status === 'ready'
        ? storedRequest.request.recoverySecret
        : createAccountDeletionRecoverySecret();
      deletionRequestSaved = storedRequest.status === 'ready';
      if (!requestId || !recoverySecret) {
        setMessage('Secure browser randomness is unavailable. Nothing was deleted.');
        return;
      }
      if (storedRequest.status === 'missing' && !persistAccountDeletionRequest(accountStorage, {
        version: 1,
        accountId: session.user.id,
        requestId,
        recoverySecret,
      })) {
        setMessage('The deletion request could not be saved safely, so account deletion was stopped.');
        return;
      }
      deletionRequestSaved = true;

      const recovery = { requestId, recoverySecret };
      let needsPrepare = storedRequest.status === 'missing';
      let completed = false;
      if (!needsPrepare) {
        try {
          const status = await getZodiacsAccountDeletionStatus(recovery);
          assertActionCurrent(epoch);
          if (!profileAccessGenerationCurrent(accessGeneration)) return;
          deletionReceipt = status;
          completed = status.outcome === 'completed';
        } catch (error) {
          assertActionCurrent(epoch);
          if (!profileAccessGenerationCurrent(accessGeneration)) return;
          if (error instanceof AccountV2ClientError
            && error.code === 'deletion_receipt_not_found') needsPrepare = true;
          else throw error;
        }
      }
      if (needsPrepare) {
        deletionReceipt = await prepareZodiacsAccountDeletion(session.access_token, recovery);
        assertActionCurrent(epoch);
        if (!profileAccessGenerationCurrent(accessGeneration)) return;
      }
      if (!completed || deletionReceipt?.dailySunReconciliationRequired) {
        deletionReceipt = await finishZodiacsAccountDeletion(recovery);
        assertActionCurrent(epoch);
        if (!profileAccessGenerationCurrent(accessGeneration)) return;
      }
      if (!deletionReceipt) throw new Error('deletion-receipt-unavailable');

      const descriptor: AccountDeletionRequestV1 = {
        version: 1,
        accountId: session.user.id,
        requestId,
        recoverySecret,
      };
      const localClearFailed = !await completeConfirmedDeletionOnDevice(
        descriptor,
        clearDeviceOnDelete,
        deletionReceipt.dailySunReconciliationRequired,
      );
      const completionMessage = localClearFailed
        ? 'The account and cloud data were confirmed deleted, but browser cleanup could not finish. The saved deletion request was kept; clear this site’s data in browser settings.'
        : accountDeletionCompletionMessage(clearDeviceOnDelete, deletionReceipt);
      setMessage(completionMessage);
      setSession(null);
      setAccount(null);
      const remaining = listAccountDeletionRequests(accountStorage);
      setPendingDeletions(remaining.status === 'ready' ? remaining.requests : [descriptor]);
      setView('signed-out');
      setBusy(false);
      await syncApi?.signOutOfSyncLocal().catch(() => {});
    } catch (error) {
      if (authEpoch.current !== epoch) return;
      setMessage(displayAccountV2Error(error, deletionRequestSaved));
    } finally {
      if (authEpoch.current === epoch) setBusy(false);
    }
  }

  async function onResumeDeletion(request: AccountDeletionRequestV1) {
    if (!accountStorage) {
      setMessage('This browser cannot read the saved deletion recovery proof. Clear site data manually or contact support.');
      return;
    }
    const epoch = authEpoch.current;
    const accessGeneration = profileAccessGeneration.current;
    setBusy(true);
    setMessage('');
    try {
      const recovery = {
        requestId: request.requestId,
        recoverySecret: request.recoverySecret,
      };
      const status = await getZodiacsAccountDeletionStatus(recovery);
      assertActionCurrent(epoch);
      if (!profileAccessGenerationCurrent(accessGeneration)) return;
      let deletionReceipt: DailySunDeletionTruth = status;
      if (status.outcome === 'prepared' || status.dailySunReconciliationRequired) {
        deletionReceipt = await finishZodiacsAccountDeletion(recovery);
        assertActionCurrent(epoch);
        if (!profileAccessGenerationCurrent(accessGeneration)) return;
      }
      if (!await completeConfirmedDeletionOnDevice(
        request,
        clearDeviceOnDelete,
        deletionReceipt.dailySunReconciliationRequired,
      )) {
        setMessage('Account deletion was confirmed, but browser cleanup could not finish. The recovery record remains on this device; clear this site’s data in browser settings.');
        return;
      }
      setMessage(accountDeletionCompletionMessage(clearDeviceOnDelete, deletionReceipt));
      window.dispatchEvent(new Event(ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT));
    } catch (error) {
      if (authEpoch.current !== epoch) return;
      setMessage(displayAccountV2Error(error, true));
    } finally {
      if (authEpoch.current !== epoch) return;
      const remaining = listAccountDeletionRequests(accountStorage);
      if (remaining.status === 'ready') setPendingDeletions(remaining.requests);
      setBusy(false);
    }
  }

  async function completeConfirmedDeletionOnDevice(
    request: AccountDeletionRequestV1,
    removeFromDevice: boolean,
    preserveRecovery: boolean,
  ): Promise<boolean> {
    if (!accountStorage) return false;
    // Only the deleted account's own record namespace is removed; an active
    // different account and guest records stay untouched. The erasure is
    // authorized by the transition this call started under, sampled before
    // the asynchronous plan, never by whatever transition is current later.
    const epoch = authEpoch.current;
    const plan = removeFromDevice ? await planSavedRecordErasure({ accountId: request.accountId }) : { status: 'none' as const };
    if (plan.status === 'blocked' || authEpoch.current !== epoch) return false;
    const transition = await runExclusiveAccountProfileTransition(accountStorage, async () => {
      const recordsOutcome = await runPlannedSavedRecordErasure(plan, () => authEpoch.current === epoch);
      if (recordsOutcome === 'failed') return false;
      const localCompletion = completeDeletedAccountLocalData(
        accountStorage,
        request.accountId,
        removeFromDevice,
      );
      return localCompletion.ok && (preserveRecovery || clearConfirmedAccountDeletionRequest(
        accountStorage,
        request.accountId,
        request.requestId,
      ));
    });
    return transition.ok && transition.value;
  }

  const selectedChartId = useMemo(() => account?.metadata.charts.find(
    (chart) => chart.selectedForSync,
  )?.chartId ?? null, [account]);
  const cloudOnlySelected = selectedChartId
    && !profile.charts.some((chart) => chart.id === selectedChartId)
    ? account?.metadata.charts.find((chart) => chart.chartId === selectedChartId) ?? null
    : null;

  if (!enabled) return null;

  return (
    <aside class="pf-sync pf-account-v2 shell" id="profile-sync">
      <div class="core pf-sync__core">
        <div class="pf-account-v2__intro">
          <span class="mono--label pf-sync__label">Optional Zodiacs account</span>
          <strong>{session ? 'Private continuity across devices' : 'Keep charts on this device—or choose one to sync'}</strong>
          <p>
            Charts work without an account. If you opt in, one self chart can be encrypted for recovery and future app access.
            Nothing becomes public.
          </p>
          {message && <p class="pf-sync__message" role="status" aria-live="polite">{message}</p>}
        </div>

        {view === 'loading' && <p class="pf-loading" role="status">Checking this device’s private account boundary…</p>}

        {view === 'signed-out' && (
          <>
            {pendingDeletions.length > 0 && (
              <section class="pf-account-v2__section" aria-labelledby="pending-account-deletion-heading">
                <h2 id="pending-account-deletion-heading">Finish a deletion you already confirmed</h2>
                <p>
                  This browser kept a private recovery proof because the final server response was not confirmed.
                  Checking it does not require signing in and never starts a different deletion request.
                </p>
                <label class="pf-digest">
                  <input
                    type="checkbox"
                    checked={clearDeviceOnDelete}
                    onChange={(event) => setClearDeviceOnDelete((event.target as HTMLInputElement).checked)}
                  />
                  <span><strong>Also remove this account’s charts from this browser</strong><small>Uncheck to keep its device-only charts separate from future accounts.</small></span>
                </label>
                {pendingDeletions.map((request) => (
                  <button
                    key={request.requestId}
                    class="pf-chart__action pf-chart__action--danger"
                    type="button"
                    disabled={busy}
                    onClick={() => void onResumeDeletion(request)}
                  >
                    Check and finish confirmed deletion
                  </button>
                ))}
              </section>
            )}
            <form class="pf-sync__form" onSubmit={onSendLink}>
              <input
                class="field__input"
                type="email"
                inputMode="email"
                autocomplete="email"
                placeholder="you@example.com"
                value={email}
                onInput={(event) => setEmail((event.target as HTMLInputElement).value)}
                aria-label="Email for optional chart synchronization"
                required
              />
              <button class="btn btn--primary" type="submit" disabled={busy || !syncApi}>
                <span>{busy ? 'Working…' : 'Send private sign-in link'}</span><span class="orb">↗</span>
              </button>
            </form>
          </>
        )}

        {view === 'error' && session && (
          <section class="pf-account-v2__section" aria-labelledby="unavailable-account-controls-heading">
            <h2 id="unavailable-account-controls-heading">Account privacy controls remain available</h2>
            <p>Sync is unavailable, but you can still export, withdraw remote-chart consent, or permanently delete the account.</p>
            <div class="pf-sync__actions">
              <button class="pf-chart__action" type="button" onClick={() => void initialize(session)} disabled={busy}>Try sync again</button>
              <button class="pf-chart__action" type="button" onClick={() => void onExport()} disabled={busy}>Download account export</button>
              <button class="pf-chart__action pf-chart__action--danger" type="button" onClick={() => void onPrivacyWithdraw()} disabled={busy}>Withdraw sync and erase remote chart</button>
              <button class="pf-chart__action pf-chart__action--danger" type="button" onClick={() => setView('deleting')} disabled={busy}>Permanently delete account</button>
              <button class="pf-chart__action" type="button" onClick={() => void onSignOut(false)} disabled={busy}>Sign out</button>
            </div>
          </section>
        )}

        {view === 'legacy' && session && (
          <section class="pf-account-v2__section" aria-labelledby="legacy-account-heading">
            <h2 id="legacy-account-heading">Earlier cloud charts need a separate choice</h2>
            <p>
              Zodiacs will not silently move old cloud charts into the encrypted system. This canary is paused for this account until a chart-by-chart migration and deletion review is available.
              Earlier cloud data can still be exported or permanently deleted; there is no v2 sync consent to withdraw yet.
            </p>
            <div class="pf-sync__actions">
              <button class="pf-chart__action" type="button" disabled={busy} onClick={() => void onExport()}>Download account export</button>
              <button class="pf-chart__action pf-chart__action--danger" type="button" disabled={busy} onClick={() => setView('deleting')}>Permanently delete account</button>
              <button class="pf-chart__action" type="button" disabled={busy} onClick={() => void onSignOut(false)}>Sign out</button>
            </div>
          </section>
        )}

        {view === 'deleting' && session && (
          <section class="pf-account-v2__section" aria-labelledby="finish-account-deletion-heading">
            <h2 id="finish-account-deletion-heading">Delete account</h2>
            <p>Prepare or finish permanent removal of cloud charts, account access, and linked email authority. Provider cleanup is retried separately and never delays account erasure.</p>
            <label class="pf-account-v2__delete-label" for="finish-account-delete-confirmation">Type DELETE to confirm</label>
            <input
              id="finish-account-delete-confirmation"
              class="field__input"
              value={deleteText}
              autocomplete="off"
              onInput={(event) => setDeleteText((event.target as HTMLInputElement).value)}
            />
            <label class="pf-digest">
              <input
                type="checkbox"
                checked={clearDeviceOnDelete}
                onChange={(event) => setClearDeviceOnDelete((event.target as HTMLInputElement).checked)}
              />
              <span><strong>Also remove this account’s charts from this browser</strong><small>Recommended on shared devices.</small></span>
            </label>
            <button class="pf-chart__action pf-chart__action--danger" type="button" disabled={busy || deleteText !== 'DELETE'} onClick={() => void onDeleteAccount()}>
              Prepare or finish permanent deletion
            </button>
          </section>
        )}

        {view === 'boundary' && boundary?.status === 'decision-required' && (
          <section class="pf-account-v2__section" aria-labelledby="account-boundary-heading">
            <h2 id="account-boundary-heading">Choose what happens to charts already in this browser</h2>
            <p>
              {boundary.reason === 'unowned-local-data'
                ? 'These charts are not attached to an account. You may make them available for individual selection, clear them, or cancel sign-in.'
                : 'These charts belong to a different signed-in account on this browser. They will never be claimed by the new account.'}
            </p>
            {recordsBoundary?.status === 'guest-records' && (
              <p data-records-boundary>
                {boundary.reason === 'unowned-local-data'
                  ? `${recordsBoundary.guestRecords === 1 ? 'One calculation record was' : `${recordsBoundary.guestRecords} calculation records were`} kept on this device before sign-in. Keeping leaves ${recordsBoundary.guestRecords === 1 ? 'it' : 'them'} on this device as guest records, separate from the account and hidden while you are signed in; clearing removes ${recordsBoundary.guestRecords === 1 ? 'it' : 'them'} from this device.`
                  : 'Calculation records kept on this device as a guest are not affected by this choice.'}
              </p>
            )}
            <div class="pf-sync__actions">
              {boundary.reason === 'unowned-local-data' ? (
                <button class="btn btn--primary" type="button" disabled={busy} onClick={() => void onBoundaryDecision('import')}>
                  Keep for individual selection
                </button>
              ) : (
                <button class="btn btn--primary" type="button" disabled={busy} onClick={() => void onBoundaryDecision('isolate')}>
                  Keep both accounts separate
                </button>
              )}
              <button class="pf-chart__action pf-chart__action--danger" type="button" disabled={busy} onClick={() => void onBoundaryDecision('clear')}>
                Clear charts from this browser
              </button>
              <button class="pf-chart__action" type="button" disabled={busy} onClick={() => void onBoundaryDecision('cancel')}>Cancel sign-in</button>
            </div>
            <div class="pf-account-v2__section" aria-labelledby="boundary-account-privacy-heading">
              <h3 id="boundary-account-privacy-heading">Signed-in account privacy controls</h3>
              <p>These controls apply only to the signed-in account. Keeping this browser unchecked during deletion leaves the other account’s local charts untouched.</p>
              <div class="pf-sync__actions">
                <button class="pf-chart__action" type="button" disabled={busy} onClick={() => void onExport()}>Download account export</button>
                <button class="pf-chart__action pf-chart__action--danger" type="button" disabled={busy} onClick={() => void onPrivacyWithdraw()}>Withdraw sync and erase remote chart</button>
                <button class="pf-chart__action pf-chart__action--danger" type="button" disabled={busy} onClick={() => {
                  setClearDeviceOnDelete(false);
                  setView('deleting');
                }}>Permanently delete signed-in account</button>
              </div>
            </div>
          </section>
        )}

        {view === 'ready' && session && account && (
          <>
            <div class="pf-sync__actions pf-account-v2__session">
              <span class="pf-account-v2__email">{session.user.email ?? 'Signed in'}</span>
              <button class="pf-chart__action" type="button" onClick={() => void onRefresh()} disabled={busy}>Check cloud</button>
            </div>

            <section class="pf-account-v2__section" aria-labelledby="chart-sync-consent-heading">
              <h2 id="chart-sync-consent-heading">Encrypted chart sync</h2>
              {account.consent !== 'granted' ? (
                <>
                  <p>
                    Off by default. Turning this on permits Zodiacs to store one encrypted private chart record containing your saved label, birth source, and placements.
                    It does not permit public sharing, advertising, or AI processing.
                  </p>
                  <button class="btn btn--primary" type="button" disabled={busy} onClick={() => void onConsent('grant')}>
                    {account.metadata.pendingConsentOperation?.decision === 'grant'
                      ? 'Retry turning on sync safely'
                      : 'Turn on private chart sync'}
                  </button>
                </>
              ) : (
                <>
                  <p>On · one self chart maximum · manual, chart-by-chart selection.</p>
                  {!withdrawArmed ? (
                    <button class="pf-chart__action pf-chart__action--danger" type="button" disabled={busy} onClick={() => setWithdrawArmed(true)}>
                      Withdraw sync consent
                    </button>
                  ) : (
                    <div class="pf-sync__actions">
                      <button class="pf-chart__action pf-chart__action--danger" type="button" disabled={busy} onClick={() => void onConsent('withdraw')}>
                        {account.metadata.pendingConsentOperation?.decision === 'withdraw'
                          ? 'Retry erase and withdrawal safely'
                          : 'Erase remote chart and withdraw'}
                      </button>
                      <button class="pf-chart__action" type="button" disabled={busy} onClick={() => setWithdrawArmed(false)}>Keep sync on</button>
                    </div>
                  )}
                </>
              )}
            </section>

            {account.consent === 'granted' && (
              <section class="pf-account-v2__section" aria-labelledby="self-chart-heading">
                <h2 id="self-chart-heading">Choose your self chart</h2>
                <p>No chart is selected automatically. This adult-only preview accepts only your own chart. Charts belonging to partners, family, clients, or children must stay device-only.</p>
                <div class="pf-account-v2__charts">
                  {profile.charts.map((chart) => {
                    const metadata = account.metadata.charts.find((entry) => entry.chartId === chart.id);
                    const selected = metadata?.selectedForSync === true;
                    const anotherSelected = selectedChartId !== null && selectedChartId !== chart.id;
                    const valid = selfChartPutWire(
                      chart,
                      account.deviceId,
                      chart.id,
                      metadata?.serverRevision ?? 0,
                    ) !== null;
                    return (
                      <article class={`pf-account-v2__chart${selected ? ' pf-account-v2__chart--selected' : ''}`} key={chart.id}>
                        <div>
                          <strong>{chart.name}</strong>
                          <small>{selected ? `Encrypted cloud copy · revision ${metadata?.serverRevision}` : 'Device only'}</small>
                        </div>
                        <details>
                          <summary>Review exactly what would be stored</summary>
                          <div class="pf-account-v2__preview">
                            <p><b>Encrypted chart source:</b> {chart.name} · {birthPreview(chart)}</p>
                            <p><b>Encrypted placement data:</b> 12 placements, {chart.summary.angles ? 'Ascendant and Midheaven' : 'no angles'}, {chart.summary.houseSystem} houses, engine {chart.summary.engineVersion}.</p>
                            <p>The database receives ciphertext plus sync routing metadata. Nothing is public or included in discovery.</p>
                          </div>
                        </details>
                        <label class="pf-digest">
                          <input
                            type="checkbox"
                            checked={attestedChartId === chart.id}
                            disabled={busy || anotherSelected || !valid}
                            onChange={(event) => setAttestedChartId(
                              (event.target as HTMLInputElement).checked ? chart.id : null,
                            )}
                          />
                          <span>
                            <strong>I am 18 or older, and this is my own birth chart.</strong>
                            <small>I am not uploading another person’s birth information.</small>
                          </span>
                        </label>
                        <div class="pf-sync__actions">
                          <button
                            class="btn btn--primary"
                            type="button"
                            disabled={busy || anotherSelected || !valid || attestedChartId !== chart.id}
                            onClick={() => void onPutChart(chart)}
                          >
                            {metadata?.pendingOperation?.operation === 'put_chart'
                              ? 'Safely retry or update encrypted copy'
                              : selected ? 'Update encrypted copy' : 'Encrypt and sync this chart'}
                          </button>
                          {selected && (
                            <>
                              <button class="pf-chart__action" type="button" disabled={busy} onClick={() => void onRestoreCloud(chart.id)}>
                                Restore cloud copy to this device
                              </button>
                              <button class="pf-chart__action pf-chart__action--danger" type="button" disabled={busy} onClick={() => void onDeleteCloud(chart.id)}>
                                {metadata?.pendingOperation?.operation === 'delete_chart'
                                  ? 'Retry cloud removal safely'
                                  : 'Remove cloud copy'}
                              </button>
                            </>
                          )}
                        </div>
                        {!valid && <p class="pf-sync__message">Reopen this chart to refresh its complete placement summary before syncing.</p>}
                      </article>
                    );
                  })}
                  {profile.charts.length === 0 && <p>Save your own chart on this device first. Account creation is not required to do that.</p>}
                  {cloudOnlySelected && (
                    <div class="pf-account-v2__chart">
                      <strong>Cloud chart not currently on this device</strong>
                      <div class="pf-sync__actions">
                        <button class="pf-chart__action" type="button" disabled={busy} onClick={() => void onRestoreCloud(cloudOnlySelected.chartId)}>
                          Restore encrypted copy
                        </button>
                        <button class="pf-chart__action pf-chart__action--danger" type="button" disabled={busy} onClick={() => void onDeleteCloud(cloudOnlySelected.chartId)}>
                          Remove cloud copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section class="pf-account-v2__section" aria-labelledby="account-controls-heading">
              <h2 id="account-controls-heading">Account controls</h2>
              <p>Export or delete the account at any time. Deletion removes any linked Daily Sun subscription when that cleanup can be confirmed; otherwise Zodiacs shows a manual unsubscribe warning without delaying account erasure.</p>
              <div class="pf-sync__actions">
                <button class="pf-chart__action" type="button" disabled={busy} onClick={() => void onExport()}>Download account export</button>
                <button class="pf-chart__action" type="button" disabled={busy} onClick={() => void onSignOut(false)}>Sign out · keep this device</button>
                <button class="pf-chart__action" type="button" disabled={busy} onClick={() => void onSignOut(true)}>Sign out · clear all Zodiacs data</button>
              </div>
              <p>{CLEAR_ALL_CALENDARS_NOTE}</p>
              <details class="pf-account-v2__delete">
                <summary>Delete Zodiacs account</summary>
                <p>This permanently deletes cloud charts, consent records where legally permitted, and account access. Zodiacs also removes a linked Daily Sun subscription when it can confirm the match; otherwise it reports that manual unsubscribe may be needed. Apple subscriptions, when introduced, will require separate cancellation.</p>
                <p>If the connection drops, this browser keeps one account-scoped recovery proof. It can check and finish that exact request after reload—even after sign-in access has been removed—and clears the proof only after completion is confirmed.</p>
                <label class="pf-account-v2__delete-label" for="account-delete-confirmation">Type DELETE to confirm</label>
                <input
                  id="account-delete-confirmation"
                  class="field__input"
                  value={deleteText}
                  autocomplete="off"
                  onInput={(event) => setDeleteText((event.target as HTMLInputElement).value)}
                />
                <label class="pf-digest">
                  <input
                    type="checkbox"
                    checked={clearDeviceOnDelete}
                    onChange={(event) => setClearDeviceOnDelete((event.target as HTMLInputElement).checked)}
                  />
                  <span><strong>Also remove this account’s charts from this browser</strong><small>Recommended on shared devices.</small></span>
                </label>
                <button class="pf-chart__action pf-chart__action--danger" type="button" disabled={busy || deleteText !== 'DELETE'} onClick={() => void onDeleteAccount()}>
                  Permanently delete account
                </button>
              </details>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

function birthPreview(chart: SavedChart): string {
  const place = chart.birth.place;
  const time = chart.birth.timeKnown && chart.birth.time ? chart.birth.time : 'time unknown';
  return place
    ? `${chart.birth.date} · ${time} · ${place.name}, ${place.country} · ${place.lat.toFixed(4)}, ${place.lon.toFixed(4)} · ${place.tz}`
    : `${chart.birth.date} · ${time} · no saved place`;
}
