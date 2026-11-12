import { getAccountV2BrowserStorage } from './browser-storage';
import {
  inspectLocalAccountBoundary,
  lockCurrentAccountProfile,
  readLocalAccountOwner,
  readRetainedAccountOwner,
  recordCompletedAccountBoundaryDecision,
  retainedProfileAccessAllowed,
} from './local-state';
import {
  hasAccountBoundLocalProfileData,
  sanitizeLegacyFirstReadingIdentity,
} from './profile-boundary';
import {
  clearProfileAccessGrant,
  ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT,
  setProfileAccessGrant,
  setProfileAccessLeaseActive,
  setRetainedProfileAccessGrant,
} from './profile-access';
import {
  acquireAccountProfileReadLease,
  onAccountProfileLeaseRevocation,
  runExclusiveAccountProfileTransition,
  type AccountProfileReadLease,
} from './profile-lease';
import { savedRecordsEnabled, savedRecordsRetainedOnDevice } from '../profile/saved-record-flags';

/**
 * Receipt-only guest data lives in IndexedDB and is invisible to the
 * synchronous five-key legacy check. Before binding an apparently empty
 * browser to an account, discover it (content-free, erase-only recovery).
 * With the feature off nothing is loaded and the result is always 'empty'.
 */
async function discoverSavedRecords(): Promise<'empty' | 'decision' | 'unavailable'> {
  if (!savedRecordsEnabled()) {
    // The feature is not built in, but records kept while it was may still be
    // here. Binding such a browser to an account silently would record a clear
    // decision the visitor never made, so the hand-off is required instead.
    // Probing enumerates databases and creates nothing.
    return await savedRecordsRetainedOnDevice() ? 'decision' : 'empty';
  }
  try {
    const api = await import('../profile/saved-record-access');
    const discovery = await api.discoverSavedRecordBoundary();
    // Unsupported storage (no `indexedDB.databases()`, or an unreadable
    // schema) can hold nothing this client kept, so it never blocks binding;
    // a pending or failed discovery on a supported runtime does.
    return discovery.status === 'empty' || discovery.status === 'unsupported' ? 'empty'
      : discovery.status === 'guest-records' ? 'decision' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

function announceAccessChange(): void {
  window.dispatchEvent(new Event('zodiacs:profile-access'));
  window.dispatchEvent(new Event('zodiacs:profile'));
}

/**
 * The tab-lifetime shared lease required by every private profile reader and
 * writer. This is the only code that activates the lease or writes a grant.
 * `onDecided` runs each time no evaluation is in flight any more, so a waiting
 * save can read `profileAccessAllowed()` knowing the coordinator has decided.
 */
function runProfileAccessBootstrap(onDecided: () => void): () => void {
  let live = true;
  let unsubscribeAuth = () => {};
  let unsubscribeRevocation = () => {};
  let authVersion = 0;
  let accessVersion = 0;
  let evaluations = 0;
  let currentAccountId: string | null = null;
  let lease: AccountProfileReadLease | null = null;
  const browserStorage = getAccountV2BrowserStorage();

  const revoke = () => {
    accessVersion += 1;
    setProfileAccessLeaseActive(false);
    if (browserStorage) clearProfileAccessGrant(browserStorage.session);
    lease?.release();
    lease = null;
    announceAccessChange();
  };

  unsubscribeRevocation = onAccountProfileLeaseRevocation(revoke);
  if (!browserStorage) {
    revoke();
    onDecided();
    return () => {
      live = false;
      unsubscribeRevocation();
    };
  }
  const { local, session } = browserStorage;

  const grant = async (
    mode: 'unowned' | 'retained' | 'account',
    accountId: string | null,
    expectedAuthVersion: number,
  ) => {
    const expectedAccessVersion = accessVersion;
    const nextLease = await acquireAccountProfileReadLease();
    if (!nextLease
      || !live
      || authVersion !== expectedAuthVersion
      || accessVersion !== expectedAccessVersion) {
      nextLease?.release();
      return;
    }
    const owner = readLocalAccountOwner(local);
    const stateStillValid = mode === 'unowned'
      ? owner.status === 'missing'
      : accountId !== null
        && owner.status === 'ready'
        && owner.accountId === accountId
        && (mode !== 'retained' || retainedProfileAccessAllowed(local, accountId));
    const stored = stateStillValid && (
      mode === 'retained'
        ? setRetainedProfileAccessGrant(session, accountId!)
        : setProfileAccessGrant(session, mode === 'account' ? accountId : null)
    );
    if (!stored || !setProfileAccessLeaseActive(true)) {
      clearProfileAccessGrant(session);
      nextLease.release();
      announceAccessChange();
      return;
    }
    lease = nextLease;
    announceAccessChange();
  };

  const evaluate = async (accountId: string | null, expectedAuthVersion: number) => {
    revoke();
    if (!live || authVersion !== expectedAuthVersion) return;
    // Remove the exact UTC/coordinate residue written by a brief v1 client
    // before granting any account, retained, or account-free profile lease.
    if (!sanitizeLegacyFirstReadingIdentity(local)) return;

    if (accountId === null) {
      const owner = readLocalAccountOwner(local);
      if (owner.status === 'missing') {
        await grant('unowned', null, expectedAuthVersion);
      } else if (owner.status === 'ready' && retainedProfileAccessAllowed(local, owner.accountId)) {
        await grant('retained', owner.accountId, expectedAuthVersion);
      }
      return;
    }

    let boundary = inspectLocalAccountBoundary(
      local,
      accountId,
      hasAccountBoundLocalProfileData(local),
    );
    if (boundary.status !== 'ready') return;

    if (boundary.localOwnerAccountId === null) {
      // Guest calculation records require the same explicit hand-off as
      // legacy charts; the account panel presents it. Unavailable or
      // pending record storage keeps this tab locked rather than binding.
      if (await discoverSavedRecords() !== 'empty') return;
      if (!live || authVersion !== expectedAuthVersion) return;
      const transition = await runExclusiveAccountProfileTransition(local, async () => {
        if (!live || authVersion !== expectedAuthVersion) return false;
        const current = inspectLocalAccountBoundary(
          local,
          accountId,
          hasAccountBoundLocalProfileData(local),
        );
        if (current.status !== 'ready' || current.localOwnerAccountId !== null) return false;
        // A count sampled before the lock is not proof; recheck under it.
        if (await discoverSavedRecords() !== 'empty') return false;
        if (!live || authVersion !== expectedAuthVersion) return false;
        return recordCompletedAccountBoundaryDecision(local, accountId, 'clear');
      });
      if (!transition.ok || !transition.value) return;
      boundary = inspectLocalAccountBoundary(local, accountId, hasAccountBoundLocalProfileData(local));
      if (boundary.status !== 'ready' || boundary.localOwnerAccountId !== accountId) return;
    } else {
      const retained = readRetainedAccountOwner(local);
      if (retained.status === 'invalid' || retained.status === 'unavailable') return;
      if (retained.status === 'ready') {
        if (retained.accountId !== accountId) return;
        const transition = await runExclusiveAccountProfileTransition(
          local,
          () => live
            && authVersion === expectedAuthVersion
            && lockCurrentAccountProfile(local, accountId),
        );
        if (!transition.ok || !transition.value) return;
      }
    }
    if (!live || authVersion !== expectedAuthVersion) return;
    await grant('account', accountId, expectedAuthVersion);
  };

  // Counts evaluations so a waiting save hears only the settled verdict, never
  // the revoke that opens a newer evaluation.
  const runEvaluation = async (accountId: string | null, expectedAuthVersion: number) => {
    evaluations += 1;
    try {
      await evaluate(accountId, expectedAuthVersion);
    } finally {
      evaluations -= 1;
      if (evaluations === 0) onDecided();
    }
  };

  void import('../profile/sync').then(async (api) => {
    if (!live || !api.isSupabaseConfigured()) {
      revoke();
      onDecided();
      return;
    }
    // Subscribe before reading the snapshot so a stale async read can never
    // restore the previous account's lease.
    unsubscribeAuth = api.onSyncAuthChange((next) => {
      authVersion += 1;
      currentAccountId = next?.user.id ?? null;
      void runEvaluation(currentAccountId, authVersion);
    });
    const snapshotVersion = authVersion;
    const current = await api.getSyncSession();
    if (!live || authVersion !== snapshotVersion) return;
    currentAccountId = current?.user.id ?? null;
    await runEvaluation(currentAccountId, snapshotVersion);
  }).catch(() => {
    revoke();
    onDecided();
  });

  const reevaluate = () => { void runEvaluation(currentAccountId, authVersion); };
  window.addEventListener(ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT, reevaluate);

  return () => {
    live = false;
    authVersion += 1;
    revoke();
    unsubscribeAuth();
    unsubscribeRevocation();
    window.removeEventListener(ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT, reevaluate);
  };
}

interface RunningBootstrap {
  holders: number;
  stop: () => void;
  decided: Promise<void>;
}

let running: RunningBootstrap | null = null;

/**
 * Starts the one bootstrap this tab runs, or joins it. The eager island and
 * the on-demand loader share it, so a page never runs two coordinators.
 * The returned release stops it once nothing holds it any more.
 */
export function startProfileAccessBootstrap(): () => void {
  if (!running) {
    let markDecided = () => {};
    const decided = new Promise<void>((resolve) => { markDecided = resolve; });
    const current: RunningBootstrap = { holders: 0, stop: () => {}, decided };
    running = current;
    current.stop = runProfileAccessBootstrap(() => markDecided());
  }
  const current = running;
  current.holders += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    current.holders -= 1;
    if (current.holders > 0 || running !== current) return;
    running = null;
    current.stop();
  };
}

/**
 * Resolves once the running bootstrap has made its first decision (a grant,
 * or staying locked). Access itself is still read from `profileAccessAllowed()`.
 */
export function profileAccessDecision(): Promise<void> {
  return running?.decided ?? Promise.resolve();
}
