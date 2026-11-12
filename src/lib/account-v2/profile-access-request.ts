import { profileAccessAllowed } from './profile-access-reader';

/**
 * Lets a save wait for the profile access bootstrap instead of failing
 * because it has not loaded yet.
 *
 * With encrypted account sync on, most pages do not load the bootstrap up
 * front. A save that finds this tab locked asks for it here (one shared
 * dynamic import), waits until it has decided, and then calls the writer,
 * which still refuses unless `profileAccessAllowed()` is true. Nothing here
 * grants access: the bootstrap remains the only code that activates the
 * lease or writes a grant.
 */

/** Import, auth snapshot and the bootstrap's own 5 s owner-transition lock, with room to spare. */
export const PROFILE_ACCESS_WAIT_MS = 12_000;

/**
 * - `allowed`: this tab may write now.
 * - `denied`: the bootstrap decided and this tab stays locked; the writer refuses as before.
 * - `unavailable`: the bootstrap could not load or did not decide in time.
 */
export type ProfileWriteAccess = 'allowed' | 'denied' | 'unavailable';

interface BootstrapEntry {
  profileAccessDecision(): Promise<void>;
}

const importBootstrap = (): Promise<BootstrapEntry> => import('./profile-access-autostart');
let importer: () => Promise<BootstrapEntry> = importBootstrap;
let loading: Promise<BootstrapEntry> | null = null;

/** Test seam: replaces the dynamic import. Passing nothing restores it. */
export function setProfileAccessBootstrapImporterForTests(
  next?: () => Promise<BootstrapEntry>,
): void {
  importer = next ?? importBootstrap;
  loading = null;
}

/**
 * Loads and starts the bootstrap once per tab. A failed load is forgotten so
 * the next save can try again.
 */
export function requestProfileAccessBootstrap(): Promise<BootstrapEntry> {
  if (!loading) {
    const attempt = importer();
    loading = attempt;
    attempt.catch(() => {
      if (loading === attempt) loading = null;
    });
  }
  return loading;
}

/**
 * Resolves once this tab may write, or once it is known that it may not.
 * With account sync off, or with access already granted, it answers at once
 * and loads nothing.
 */
export async function ensureProfileWriteAccess(
  timeoutMs = PROFILE_ACCESS_WAIT_MS,
): Promise<ProfileWriteAccess> {
  if (profileAccessAllowed()) return 'allowed';
  if (typeof window === 'undefined') return 'denied';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  try {
    const decided = requestProfileAccessBootstrap()
      .then((entry) => entry.profileAccessDecision())
      .then(() => 'decided' as const);
    if (await Promise.race([decided, timedOut]) === 'timeout') {
      return profileAccessAllowed() ? 'allowed' : 'unavailable';
    }
  } catch {
    return profileAccessAllowed() ? 'allowed' : 'unavailable';
  } finally {
    clearTimeout(timer);
  }
  return profileAccessAllowed() ? 'allowed' : 'denied';
}

/**
 * Runs a synchronous write after access is decided. When access is already
 * granted (or account sync is off) it runs at once, in the same task, as it
 * always has. Otherwise it waits; if the bootstrap could not load or decide,
 * `onUnavailable` runs and the write does not. A denied tab still runs the
 * write, which refuses exactly as before.
 */
export function runAfterProfileAccess(write: () => void, onUnavailable: () => void): void {
  if (profileAccessAllowed()) {
    write();
    return;
  }
  void ensureProfileWriteAccess().then((access) => {
    if (access === 'unavailable') onUnavailable();
    else write();
  });
}
