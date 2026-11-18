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
import { browserProfileAccessReader } from './profile-access-reader';
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

/** True while this tab can read its profile (the pre-hydration reader's verdict). */
function readerCanRead(): boolean {
  try {
    return browserProfileAccessReader()?.canRead() === true;
  } catch {
    return false;
  }
}

type SyncModule = Pick<
  typeof import('../profile/sync'),
  'isSupabaseConfigured' | 'getSyncSession' | 'onSyncAuthChange'
>;
const importSync = (): Promise<SyncModule> => import('../profile/sync');
let syncImporter: () => Promise<SyncModule> = importSync;

/** Test seam: replaces the bootstrap's import of profile/sync. Passing nothing restores it. */
export function setProfileSyncImporterForTests(next?: () => Promise<SyncModule>): void {
  syncImporter = next ?? importSync;
}

/**
 * - `pending`: the bootstrap is starting, or its current evaluation is in flight.
 * - `settled`: the current evaluation has ended; `profileAccessAllowed()` is
 *   the verdict. Obsolete work may still be finishing, but it can no longer
 *   grant anything, so it never holds the verdict back.
 * - `failed`: the bootstrap could not start (its sync module did not load, or
 *   reading the session failed). The tab stays locked until a retry succeeds.
 */
type ProfileAccessState = 'pending' | 'settled' | 'failed';

interface BootstrapControl {
  state(): ProfileAccessState;
  /** Starts again after a failed start; does nothing otherwise. */
  retry(): void;
  stop(): void;
}

/**
 * The tab-lifetime shared lease required by every private profile reader and
 * writer. This is the only code that activates the lease or writes a grant.
 * `onSettled` runs each time the current evaluation ends (settled or failed),
 * so a waiting save can read `profileAccessAllowed()` knowing the coordinator
 * has decided.
 */
function runProfileAccessBootstrap(onSettled: () => void): BootstrapControl {
  let live = true;
  let unsubscribeAuth = () => {};
  let unsubscribeRevocation = () => {};
  let authVersion = 0;
  let accessVersion = 0;
  // The start and every evaluation each open a generation, and only the
  // newest is current. Settlement follows the current generation alone: a
  // superseded session read or lease request still in flight never holds the
  // verdict back, and every step checks its generation, so obsolete work can
  // neither activate a lease nor write a grant once a newer one has begun.
  let generation = 0;
  let decidedGeneration = 0;
  let failed = false;
  // True from a start until it learns the session (its snapshot, or an auth
  // event). A reevaluation then waits for the start's own evaluation, which
  // has not begun and reads the state afresh, rather than replacing it with
  // one for an account not yet known.
  let awaitingSession = false;
  // The start whose auth subscription is live; 0 when none is. A listener
  // left over from a start that failed and dropped its subscription is then
  // ignored even if the sync module calls it late.
  let subscribedStart = 0;
  let currentAccountId: string | null = null;
  // The account the last evaluation was for; undefined before the first.
  let evaluatedAccountId: string | null | undefined;
  let ownTransition = false;
  let lease: AccountProfileReadLease | null = null;
  const browserStorage = getAccountV2BrowserStorage();

  /**
   * Withdraws access. Listeners hear it when access was actually held, or when
   * `changed` says the owner or the account changed; a revoke on a tab that
   * was already locked, such as the one that opens every evaluation, changes
   * nothing and announces nothing. A save waiting for the first decision is
   * therefore not cancelled by the bootstrap starting.
   */
  const revoke = (changed = false) => {
    const held = lease !== null || readerCanRead();
    accessVersion += 1;
    setProfileAccessLeaseActive(false);
    if (browserStorage) clearProfileAccessGrant(browserStorage.session);
    lease?.release();
    lease = null;
    if (held || changed) announceAccessChange();
  };

  const begin = () => {
    generation += 1;
    return generation;
  };
  const end = (opened: number) => {
    if (opened !== generation) return;
    decidedGeneration = opened;
    onSettled();
  };
  const pending = () => decidedGeneration !== generation;
  const isCurrent = (expectedAuthVersion: number, expectedGeneration: number) => live
    && authVersion === expectedAuthVersion
    && generation === expectedGeneration;

  // Another tab's owner transition, or one this tab's account panel runs, is
  // an owner change. This bootstrap's own transitions follow the revoke that
  // opened their evaluation, so they withdraw nothing new.
  unsubscribeRevocation = onAccountProfileLeaseRevocation(() => revoke(!ownTransition));
  if (!browserStorage) {
    revoke();
    return {
      state: () => 'settled',
      retry: () => {},
      stop: () => {
        live = false;
        unsubscribeRevocation();
      },
    };
  }
  const { local, session } = browserStorage;

  const runOwnTransition = <T>(transition: () => Promise<T> | T) => {
    ownTransition = true;
    try {
      // The lease revocation is broadcast synchronously, before the first await.
      return runExclusiveAccountProfileTransition(local, transition);
    } finally {
      ownTransition = false;
    }
  };

  const grant = async (
    mode: 'unowned' | 'retained' | 'account',
    accountId: string | null,
    expectedAuthVersion: number,
    expectedGeneration: number,
  ) => {
    const expectedAccessVersion = accessVersion;
    const nextLease = await acquireAccountProfileReadLease();
    if (!nextLease
      || !isCurrent(expectedAuthVersion, expectedGeneration)
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

  const evaluate = async (
    accountId: string | null,
    expectedAuthVersion: number,
    expectedGeneration: number,
  ) => {
    const stillCurrent = () => isCurrent(expectedAuthVersion, expectedGeneration);
    // An evaluation for another account than the last one is an account
    // change even on a tab that held nothing.
    const accountChanged = evaluatedAccountId !== undefined && evaluatedAccountId !== accountId;
    evaluatedAccountId = accountId;
    revoke(accountChanged);
    if (!stillCurrent()) return;
    // Remove the exact UTC/coordinate residue written by a brief v1 client
    // before granting any account, retained, or account-free profile lease.
    if (!sanitizeLegacyFirstReadingIdentity(local)) return;

    if (accountId === null) {
      const owner = readLocalAccountOwner(local);
      if (owner.status === 'missing') {
        await grant('unowned', null, expectedAuthVersion, expectedGeneration);
      } else if (owner.status === 'ready' && retainedProfileAccessAllowed(local, owner.accountId)) {
        await grant('retained', owner.accountId, expectedAuthVersion, expectedGeneration);
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
      if (!stillCurrent()) return;
      const transition = await runOwnTransition(async () => {
        if (!stillCurrent()) return false;
        const current = inspectLocalAccountBoundary(
          local,
          accountId,
          hasAccountBoundLocalProfileData(local),
        );
        if (current.status !== 'ready' || current.localOwnerAccountId !== null) return false;
        // A count sampled before the lock is not proof; recheck under it.
        if (await discoverSavedRecords() !== 'empty') return false;
        if (!stillCurrent()) return false;
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
        const transition = await runOwnTransition(
          () => stillCurrent() && lockCurrentAccountProfile(local, accountId),
        );
        if (!transition.ok || !transition.value) return;
      }
    }
    if (!stillCurrent()) return;
    await grant('account', accountId, expectedAuthVersion, expectedGeneration);
  };

  const runEvaluation = async (accountId: string | null, expectedAuthVersion: number) => {
    const opened = begin();
    try {
      await evaluate(accountId, expectedAuthVersion, opened);
    } finally {
      end(opened);
    }
  };

  // The start is itself in flight until its first evaluation ends, so a save
  // never reads the locked state the tab opens with as a decision.
  //
  // Every step that changes state after an await first checks that this
  // start's generation is still the current one. An auth event that arrives
  // while the session read is in flight opens a newer generation, which then
  // owns the verdict, the subscription and the auth version: a late answer or
  // a late failure of the superseded read changes none of them.
  const start = () => {
    failed = false;
    awaitingSession = true;
    const opened = begin();
    const startCurrent = () => live && generation === opened;
    void syncImporter().then(async (api) => {
      if (!startCurrent()) return;
      if (!api.isSupabaseConfigured()) {
        awaitingSession = false;
        revoke();
        return;
      }
      // Subscribe before reading the snapshot so a stale async read can never
      // restore the previous account's lease.
      subscribedStart = opened;
      unsubscribeAuth = api.onSyncAuthChange((next) => {
        if (!live || subscribedStart !== opened) return;
        authVersion += 1;
        currentAccountId = next?.user.id ?? null;
        awaitingSession = false;
        void runEvaluation(currentAccountId, authVersion);
      });
      const snapshotVersion = authVersion;
      const current = await api.getSyncSession();
      if (!startCurrent() || authVersion !== snapshotVersion) return;
      currentAccountId = current?.user.id ?? null;
      awaitingSession = false;
      await evaluate(currentAccountId, snapshotVersion, opened);
    }).catch(() => {
      // A newer evaluation began after this start (an auth event during the
      // session read): its verdict, its subscription and its auth version are
      // current, so the superseded start's failure changes nothing.
      if (!startCurrent()) return;
      // This start is still the current work and could not finish. Stay
      // locked, drop anything it set in motion, and report it as unavailable
      // so the next save starts again.
      awaitingSession = false;
      subscribedStart = 0;
      unsubscribeAuth();
      unsubscribeAuth = () => {};
      authVersion += 1;
      revoke();
      failed = true;
    }).finally(() => end(opened));
  };
  start();

  // A failed start keeps the tab locked until a retry starts again: with no
  // auth subscription there is no current session to evaluate, so a
  // reevaluation would decide for an account this tab may no longer hold.
  const reevaluate = () => {
    if (awaitingSession || failed) return;
    void runEvaluation(currentAccountId, authVersion);
  };
  window.addEventListener(ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT, reevaluate);

  return {
    state: () => (pending() ? 'pending' : failed ? 'failed' : 'settled'),
    retry: () => {
      if (live && failed && !pending()) start();
    },
    stop: () => {
      live = false;
      authVersion += 1;
      revoke();
      unsubscribeAuth();
      unsubscribeRevocation();
      window.removeEventListener(ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT, reevaluate);
    },
  };
}

interface RunningBootstrap {
  holders: number;
  control: BootstrapControl | null;
  waiters: Set<() => void>;
}

let running: RunningBootstrap | null = null;

function wake(bootstrap: RunningBootstrap): void {
  const waiting = [...bootstrap.waiters];
  bootstrap.waiters.clear();
  for (const resolve of waiting) resolve();
}

/**
 * Starts the one bootstrap this tab runs, or joins it. The eager island and
 * the on-demand loader share it, so a page never runs two coordinators.
 * The returned release stops it once nothing holds it any more.
 */
export function startProfileAccessBootstrap(): () => void {
  if (!running) {
    const created: RunningBootstrap = { holders: 0, control: null, waiters: new Set() };
    running = created;
    created.control = runProfileAccessBootstrap(() => wake(created));
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
    current.control?.stop();
    wake(current);
  };
}

/** Raised to a waiting save when the bootstrap could not start. */
export class ProfileAccessStartError extends Error {
  constructor() {
    super('The profile access bootstrap could not start.');
    this.name = 'ProfileAccessStartError';
  }
}

/**
 * True when the current evaluation has ended, so `profileAccessAllowed()` is
 * the current verdict. Read it in the same step as the verdict: an evaluation
 * that starts later makes it false again.
 */
export function profileAccessSettled(): boolean {
  return running?.control?.state() !== 'pending';
}

/**
 * Resolves once the bootstrap's current evaluation has decided (a grant, or
 * staying locked). When a newer evaluation starts before a waiter resumes, it
 * waits for that one too, so it never reports an earlier verdict. It rejects
 * with ProfileAccessStartError when the bootstrap could not start; a call made
 * after such a failure starts it again first. Access itself is still read from
 * `profileAccessAllowed()`.
 */
export async function profileAccessDecision(): Promise<void> {
  const initial = running?.control;
  if (initial?.state() === 'failed') initial.retry();
  for (;;) {
    const current = running;
    const state = current?.control?.state();
    if (!current || state === undefined || state === 'settled') return;
    if (state === 'failed') throw new ProfileAccessStartError();
    await new Promise<void>((resolve) => { current.waiters.add(resolve); });
  }
}
