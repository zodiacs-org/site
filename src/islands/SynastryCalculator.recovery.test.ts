import type { VNode } from 'preact';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import CalculationReload, { calculationLoadMessage } from './CalculationReload';

const harness = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0,
  effects: [] as Array<{ dependencies: unknown[]; cleanup?: () => void }>, effectCursor: 0,
  pendingEffects: [] as Array<() => void>,
  access: { current: 0 }, revoke: undefined as undefined | (() => void),
  writes: vi.fn(), load: vi.fn(), openSession: vi.fn(), decode: vi.fn(), summarize: vi.fn(),
  savePair: vi.fn(), track: vi.fn(),
  profile: { charts: [] },
  arrivalView: vi.fn(), returnView: vi.fn(), sendCard: vi.fn(), wheel: vi.fn(),
  copyLink: vi.fn(), compatShare: vi.fn(),
  allowed: true, complete: vi.fn(), replay: vi.fn(), beacon: vi.fn(),
}));

vi.mock('../lib/hooks/useProfile', () => ({ useProfile: () => ({ profile: harness.profile, ready: false }) }));
vi.mock('../lib/hooks/useEngine', () => ({ useEngine: () => vi.fn() }));
vi.mock('../lib/hooks/useProfileAccessGeneration', () => ({
  useProfileAccessGeneration: (revoke: () => void) => { harness.revoke = revoke; return harness.access; },
}));
vi.mock('../lib/account-v2/profile-access-reader', () => ({ profileAccessAllowed: () => harness.allowed }));
vi.mock('../lib/profile/pairs', () => ({
  MAX_PAIRS: 12, loadPairs: () => [], hasPair: () => false, positionsPairSide: () => null,
  pairSideLabels: () => [], deletePair: vi.fn(), prunePairs: vi.fn(), savePair: harness.savePair,
}));
vi.mock('../lib/share', () => ({ encodeChartLink: () => 'chart', decodeChartLink: vi.fn() }));
vi.mock('../lib/share-synastry', () => ({ decodeSynastryLink: harness.decode }));
vi.mock('../lib/engine/synastry', () => ({ summarizePair: harness.summarize }));
vi.mock('./synastry/RelationshipWheel', async () => ({
  default: harness.wheel,
  ...await import('./ChartTrust'),
}));
vi.mock('./CopyLinkButton', () => ({ CopyLinkButton: harness.copyLink }));
vi.mock('./CompatibilityShareControl', () => ({ CompatibilityShareControl: harness.compatShare, CompatibilityPairingCta: vi.fn() }));
vi.mock('./synastry/InviteExperience', () => ({ InviteArrival: harness.arrivalView, InvitePanel: vi.fn() }));
vi.mock('./synastry/SendBackExperience', () => ({ SendBackCard: harness.sendCard, ReturnBand: harness.returnView, InvitationConversionCard: vi.fn() }));
vi.mock('./synastry/inviteClient', () => ({
  openInviteSession: harness.openSession,
  beaconPendingCompletion: harness.beacon, replayPendingCompletion: harness.replay, completeInvite: harness.complete,
}));
vi.mock('../lib/module-load', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/module-load')>();
  return { ...original, loadModule: (load: () => Promise<unknown>) => original.loadModule(() => harness.load(load)) };
});
vi.mock('preact/hooks', () => ({
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = initial;
    return [harness.slots[slot], (value: unknown) => {
      harness.writes(slot, value);
      harness.slots[slot] = typeof value === 'function' ? value(harness.slots[slot]) : value;
    }];
  },
  useRef: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = { current: initial };
    return harness.slots[slot];
  },
  useMemo: (compute: () => unknown) => compute(),
  useEffect: (effect: () => void | (() => void), dependencies: unknown[]) => {
    const index = harness.effectCursor++;
    const prior = harness.effects[index];
    if (prior && dependencies.every((value, i) => Object.is(value, prior.dependencies[i]))) return;
    harness.pendingEffects.push(() => {
      prior?.cleanup?.();
      const cleanup = effect();
      harness.effects[index] = { dependencies, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
    });
  },
}));

let SynastryCalculator: typeof import('./SynastryCalculator')['default'];
const chart = {
  bodies: [{ body: 'Sun', lon: 30 }, { body: 'Moon', lon: 75 }],
  angles: { asc: 120, mc: 30 }, houseSystem: 'whole', engineVersion: 'test',
};
const handle = 'abcdefghijklmnopqrstuv';
const payload = { label: 'Their chart', positions: chart, sunSign: 'taurus', timeKnown: true, expiresAt: '2026-12-01T00:00:00.000Z' };
const ready = { state: 'ready', handle, payload };
const unmount = () => harness.effects.forEach((effect) => effect.cleanup?.());
function revoke() {
  harness.allowed = false;
  harness.access.current += 1;
  harness.revoke?.();
  window.dispatchEvent(new Event('zodiacs:profile-access'));
}
function render() {
  harness.cursor = 0;
  harness.effectCursor = 0;
  const view = SynastryCalculator({ locale: 'en' });
  harness.pendingEffects.splice(0).forEach((effect) => effect());
  return view;
}
function nodes(value: unknown): VNode<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as VNode<Record<string, any>>;
  return [node, ...nodes(node.props.children)];
}
const view = () => nodes(render());
const recovery = (area: string) => view().find((node) => node.props.area === area);
const arrival = () => view().find((node) => node.type === harness.arrivalView);
const result = () => view().find((node) => node.type === harness.wheel);
async function settle() {
  await vi.dynamicImportSettled();
  await Promise.resolve();
  render();
  await vi.dynamicImportSettled();
  await Promise.resolve();
}
function compare(): Promise<void> {
  for (const idPrefix of ['syn-a', 'syn-b']) {
    view().find((node) => node.props.idPrefix === idPrefix)!.props.setSlot((prior: object) => ({
      ...prior, source: 'positions', positions: { chart, label: idPrefix },
    }));
  }
  return view().find((node) => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function loadDependency(load: () => Promise<unknown>): Promise<unknown> {
  if (load.toString().includes('inviteClient')) return Promise.resolve({
    openInviteSession: harness.openSession, completeInvite: harness.complete,
    replayPendingCompletion: harness.replay, beaconPendingCompletion: harness.beacon,
  });
  return load();
}
function intercept(path: string, replace: () => Promise<unknown>) {
  harness.load.mockImplementation((load: () => Promise<unknown>) => load.toString().includes(path) ? replace() : loadDependency(load));
}
function assertReload(node: VNode<Record<string, any>>, reopen: boolean) {
  expect(node.props.error).toBe(calculationLoadMessage('en'));
  expect(node.props.reopenLink === true).toBe(reopen);
  const expanded = nodes((node.type as Function)(node.props));
  const reload = expanded.find((item) => item.type === CalculationReload)!;
  expect(CalculationReload({ error: reload.props.error, locale: reload.props.locale })).not.toBeNull();
}

beforeAll(async () => {
  vi.stubEnv('PUBLIC_COMPAT_INVITES_ENABLED', '1');
  ({ default: SynastryCalculator } = await import('./SynastryCalculator'));
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => {
  harness.slots = []; harness.cursor = 0; harness.effects = []; harness.effectCursor = 0; harness.pendingEffects = [];
  harness.access.current = 0; harness.revoke = undefined;
  harness.allowed = true;
  harness.complete.mockReset(); harness.replay.mockReset(); harness.beacon.mockReset();
  harness.writes.mockClear(); harness.track.mockReset(); harness.savePair.mockReset();
  harness.load.mockReset().mockImplementation(loadDependency);
  harness.openSession.mockReset().mockResolvedValue(ready);
  harness.decode.mockReset().mockReturnValue({ sides: [{ chart, label: 'First' }, { chart, label: 'Second' }] });
  harness.summarize.mockReset().mockReturnValue({ aspects: [] });
  const target = new EventTarget();
  const location = { pathname: '/compatibility/', search: '', hash: '', origin: 'https://zodiacs.org' };
  vi.stubGlobal('window', Object.assign(target, {
    location, matchMedia: () => ({ matches: true }), zodiacsAnalytics: { track: harness.track },
  }));
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('history', { replaceState: vi.fn(() => { location.hash = ''; }) });
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  vi.stubGlobal('localStorage', { setItem: vi.fn(), removeItem: vi.fn(), getItem: vi.fn() });
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe('compatibility optional sharing and invitation recovery', () => {
  it('keeps independent invitation controls when SendBack fails, then retries only the UI', async () => {
    window.location.hash = `#invite=${handle}`;
    intercept('SendBackExperience', () => Promise.reject(new TypeError('offline')));
    render();
    await settle();
    expect(arrival()?.props.view.state).toBe('ready');
    assertReload(recovery('invite-ui')!, false);
    harness.load.mockImplementation(loadDependency);
    recovery('invite-ui')!.props.onRetry();
    render();
    await settle();
    expect(recovery('invite-ui')).toBeUndefined();
    expect(harness.openSession).toHaveBeenCalledOnce();
  });

  it('preserves a valid comparison and successful sharing modules when another optional module fails', async () => {
    // Outside the English invite route, SendBack is loaded with the result.
    window.location.pathname = '/es/compatibility/';
    intercept('SendBackExperience', () => Promise.reject(new TypeError('offline')));
    await compare();
    await settle();
    expect(result()).toBeDefined();
    assertReload(recovery('sharing')!, false);
    // Successful modules are retained even though the aggregate load failed.
    const loadedModules = harness.slots.filter((slot) => slot && typeof slot === 'object');
    expect(loadedModules.some((slot) => 'CopyLinkButton' in (slot as object))).toBe(true);
    expect(loadedModules.some((slot) => 'CompatibilityShareControl' in (slot as object))).toBe(true);
    const comparisons = harness.summarize.mock.calls.length;
    harness.load.mockImplementation(loadDependency);
    recovery('sharing')!.props.onRetry();
    render();
    await settle();
    expect(recovery('sharing')).toBeUndefined();
    expect(harness.summarize).toHaveBeenCalledTimes(comparisons);
    expect(view().some((node) => node.type === harness.sendCard)).toBe(true);
  });

  it('ends an arrival spinner after a module failure and retries the scrubbed handle in memory', async () => {
    window.location.hash = `#invite=${handle}`;
    intercept('inviteClient', () => Promise.reject(new TypeError('chunk missing')));
    render();
    await settle();
    expect(window.location.hash).toBe('');
    expect(arrival()).toBeUndefined();
    assertReload(recovery('arrival')!, true);
    expect(harness.openSession).not.toHaveBeenCalled();
    harness.load.mockImplementation(loadDependency);
    recovery('arrival')!.props.onRetry();
    await settle();
    expect(harness.openSession).toHaveBeenCalledWith(handle);
    expect(arrival()?.props.view.state).toBe('ready');
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(harness.savePair).not.toHaveBeenCalled();
    expect(history.replaceState).toHaveBeenCalledOnce();
  });

  it('keeps a failed invitation request recoverable without claiming its link is invalid', async () => {
    window.location.hash = `#invite=${handle}`;
    harness.openSession.mockRejectedValueOnce(new TypeError('network failed'));
    render();
    await settle();
    expect(recovery('arrival')?.props.error).toContain('could not be opened');
    expect(arrival()).toBeUndefined();
    recovery('arrival')!.props.onRetry();
    await settle();
    expect(arrival()?.props.view.state).toBe('ready');
    expect(harness.openSession).toHaveBeenCalledTimes(2);
  });

  it('does not call a failed returned-link download invalid, and retries its scrubbed token', async () => {
    window.location.hash = '#s=private-return-token';
    intercept('share-synastry', () => Promise.reject(new TypeError('offline')));
    render();
    await settle();
    expect(window.location.hash).toBe('');
    expect(view().some((node) => node.type === harness.returnView)).toBe(false);
    assertReload(recovery('return')!, true);
    harness.load.mockImplementation(loadDependency);
    recovery('return')!.props.onRetry();
    await settle();
    expect(harness.decode).toHaveBeenCalledWith('private-return-token');
    expect(result()).toBeDefined();
    expect(view().find((node) => node.type === harness.returnView)?.props.invalid).toBe(false);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(history.replaceState).toHaveBeenCalledOnce();
  });

  it('marks an actually undecodable returned link invalid', async () => {
    window.location.hash = '#s=broken';
    harness.decode.mockReturnValue(null);
    render();
    await settle();
    expect(view().find((node) => node.type === harness.returnView)?.props.invalid).toBe(true);
    expect(recovery('return')).toBeUndefined();
    expect(result()).toBeUndefined();
  });

  it('opens a returned reading even when its optional send-back UI cannot download', async () => {
    window.location.hash = '#s=private-return-token';
    intercept('SendBackExperience', () => Promise.reject(new TypeError('offline')));
    render();
    await settle();
    expect(result()).toBeDefined();
    expect(recovery('return')).toBeUndefined();
    expect(recovery('invite-ui')).toBeDefined();
    expect(recovery('sharing')).toBeDefined();
  });

  it.each(['grant', 'revoke and restore'])('recovers optional bootstrap across an access %s without reviving revoked handles', async (boundary) => {
    window.location.hash = `#invite=${handle}`;
    const pending = deferred<unknown>();
    let first = true;
    harness.load.mockImplementation((load: () => Promise<unknown>) => {
      if (first && load.toString().includes('InviteExperience')) { first = false; return pending.promise; }
      return load();
    });
    render();
    await settle();
    expect(arrival()).toBeUndefined();
    if (boundary === 'revoke and restore') revoke();
    harness.allowed = true;
    harness.access.current += 1;
    window.dispatchEvent(new Event('zodiacs:profile-access'));
    await settle();
    const installed = harness.slots.some((slot) => slot && typeof slot === 'object' && 'InviteArrival' in slot);
    expect(installed).toBe(true);
    expect(arrival()?.props.view.state).toBe(boundary === 'grant' ? 'ready' : undefined);
    const writes = harness.writes.mock.calls.length;
    pending.resolve({ InviteArrival: harness.arrivalView });
    await vi.dynamicImportSettled();
    await Promise.resolve();
    expect(harness.writes).toHaveBeenCalledTimes(writes);
    expect(harness.openSession).toHaveBeenCalledOnce();
  });

  it.each(['unmount', 'revoke', 'new comparison'])('rejects a late arrival payload after %s', async (boundary) => {
    window.location.hash = `#invite=${handle}`;
    const pending = deferred<unknown>();
    harness.openSession.mockReturnValueOnce(pending.promise);
    render();
    await settle();
    if (boundary === 'unmount') unmount();
    else if (boundary === 'revoke') { revoke(); await settle(); }
    else { await compare(); await settle(); }
    const writes = harness.writes.mock.calls.length;
    pending.resolve(ready);
    await vi.dynamicImportSettled();
    await Promise.resolve();
    expect(harness.writes).toHaveBeenCalledTimes(writes);
    expect(harness.track).not.toHaveBeenCalledWith('invite_opened', { state: 'ready' });
  });

  it.each(['unmount', 'revoke', 'new comparison'])('rejects a late returned-link import after %s', async (boundary) => {
    window.location.hash = '#s=private-return-token';
    const pending = deferred<unknown>();
    intercept('share-synastry', () => pending.promise);
    render();
    await settle();
    if (boundary === 'unmount') unmount();
    else if (boundary === 'revoke') { revoke(); await settle(); }
    else { await compare(); await settle(); }
    const writes = harness.writes.mock.calls.length;
    pending.resolve({ decodeSynastryLink: harness.decode });
    await vi.dynamicImportSettled();
    await Promise.resolve();
    expect(harness.writes).toHaveBeenCalledTimes(writes);
    expect(harness.decode).not.toHaveBeenCalled();
  });

  it('keeps only the newest arrival request and cannot reuse its handle after revocation', async () => {
    window.location.hash = `#invite=${handle}`;
    const pending = deferred<unknown>();
    harness.openSession.mockReturnValueOnce(pending.promise);
    render();
    await settle();
    const retry = arrival()!.props.onRetry;
    retry();
    await settle();
    expect(arrival()?.props.view.state).toBe('ready');
    pending.resolve({ state: 'unavailable' });
    await settle();
    expect(arrival()?.props.view.state).toBe('ready');
    revoke();
    retry();
    await settle();
    expect(harness.openSession).toHaveBeenCalledTimes(2);
    expect(arrival()).toBeUndefined();
  });

  it.each(['unmount', 'revoke'])('does not accept optional sharing modules after %s', async (boundary) => {
    window.location.pathname = '/es/compatibility/';
    const pending = deferred<unknown>();
    intercept('SendBackExperience', () => pending.promise);
    await compare();
    await settle();
    if (boundary === 'unmount') unmount();
    else { revoke(); await settle(); }
    const writes = harness.writes.mock.calls.length;
    pending.resolve({ SendBackCard: harness.sendCard });
    await vi.dynamicImportSettled();
    await Promise.resolve();
    expect(harness.writes).toHaveBeenCalledTimes(writes);
  });

  it.each(['clear arrival', 'access grant'])('allows a fresh comparison after %s cancels a pending one', async (boundary) => {
    window.location.hash = `#invite=${handle}`;
    render();
    await settle();
    const clearArrival = arrival()!.props.onClear;
    const pending = deferred<unknown>();
    intercept('engine/synastry', () => pending.promise);
    const stale = compare();
    await settle();
    expect(view().find((node) => node.type === 'form')!.props['aria-busy']).toBe(true);
    if (boundary === 'clear arrival') clearArrival();
    else {
      harness.access.current += 1;
      window.dispatchEvent(new Event('zodiacs:profile-access'));
    }
    expect(view().find((node) => node.type === 'form')!.props['aria-busy']).toBe(false);
    harness.load.mockImplementation(loadDependency);
    await compare();
    await settle();
    expect(result()).toBeDefined();
    expect(harness.summarize).toHaveBeenCalledOnce();
    const writes = harness.writes.mock.calls.length;
    pending.resolve({ summarizePair: harness.summarize });
    await stale;
    expect(harness.summarize).toHaveBeenCalledOnce();
    expect(harness.writes).toHaveBeenCalledTimes(writes);
  });

  it('reinstalls completion replay and beacons on grants, while revocation blocks both', async () => {
    render();
    await settle();
    expect(harness.replay).toHaveBeenCalledOnce();
    harness.access.current += 1;
    window.dispatchEvent(new Event('zodiacs:profile-access'));
    await settle();
    expect(harness.replay).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event('pagehide'));
    await settle();
    expect(harness.beacon).toHaveBeenCalledOnce();
    revoke();
    await settle();
    window.dispatchEvent(new Event('pagehide'));
    await settle();
    expect(harness.replay).toHaveBeenCalledTimes(2);
    expect(harness.beacon).toHaveBeenCalledOnce();
    harness.allowed = true;
    harness.access.current += 1;
    window.dispatchEvent(new Event('zodiacs:profile-access'));
    await settle();
    window.dispatchEvent(new Event('pagehide'));
    await settle();
    expect(harness.replay).toHaveBeenCalledTimes(3);
    expect(harness.beacon).toHaveBeenCalledTimes(2);
  });

  it.each(['grant', 'revoke'])('handles a completion import interrupted by access %s without a false completion marker', async (boundary) => {
    window.location.hash = `#invite=${handle}`;
    render();
    await settle();
    const pending = deferred<unknown>();
    intercept('inviteClient', () => pending.promise);
    view().find((node) => node.props.idPrefix === 'syn-b')!.props.setSlot((prior: object) => ({
      ...prior, source: 'positions', positions: { chart, label: 'Mine' },
    }));
    await view().find((node) => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() });
    await settle();
    expect(result()).toBeDefined();
    expect(harness.track).toHaveBeenCalledWith('compat_computed', { source: 'invite' });
    expect(harness.complete).not.toHaveBeenCalled();
    expect(harness.track).not.toHaveBeenCalledWith('invite_completed');
    harness.load.mockImplementation(loadDependency);
    if (boundary === 'revoke') revoke();
    else {
      harness.access.current += 1;
      window.dispatchEvent(new Event('zodiacs:profile-access'));
    }
    await settle();
    await vi.waitFor(() => expect(harness.complete).toHaveBeenCalledTimes(boundary === 'grant' ? 1 : 0));
    if (boundary === 'grant') expect(harness.complete).toHaveBeenCalledWith(handle, payload.expiresAt);
    pending.resolve({ completeInvite: harness.complete });
    await settle();
    expect(harness.complete).toHaveBeenCalledTimes(boundary === 'grant' ? 1 : 0);
  });
});
