import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT, ACCOUNT_V2_PROFILE_ACCESS_KEY } from '../lib/account-v2/profile-access';
import { ACCOUNT_V2_PROFILE_REVOKE_EVENT } from '../lib/account-v2/profile-lease';
import { ACCOUNT_V2_LOCAL_OWNER_KEY, ACCOUNT_V2_RETAINED_OWNER_KEY } from '../lib/account-v2/storage-identity';

/**
 * A first-time guest with encrypted account sync on: empty storage, not
 * signed in, and a page that has not loaded the access bootstrap. Clicking
 * save on /birth-chart/ (ChartCalculator) and on /compatibility/
 * (SynastryCalculator) must still save. Like ChartCalculator.ownership.test,
 * this runs the islands' own save functions, here over the real chain: Base's
 * pre-hydration reader, the on-demand loader, the bootstrap, store and pairs.
 * Each island's own revoke callback is installed through the real
 * useProfileAccessGeneration hook, exactly as it runs in production, so the
 * bootstrap's access events reach the save as they would on the page. Only
 * the Supabase session is mocked (signed out).
 */
const sync = vi.hoisted(() => ({
  listeners: [] as ((session: { user: { id: string } } | null) => void)[],
  session: null as Promise<null> | null,
}));
vi.mock('../lib/profile/sync', () => ({
  isSupabaseConfigured: () => true,
  getSyncSession: async () => (sync.session ? sync.session : null),
  onSyncAuthChange: (listener: (session: { user: { id: string } } | null) => void) => {
    sync.listeners.push(listener);
    return () => { sync.listeners.splice(sync.listeners.indexOf(listener), 1); };
  },
}));

// The hook's own effect runs at once; its cleanup is kept for afterEach.
const hooks = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }));
vi.mock('preact/hooks', () => ({
  useRef: (value: unknown) => ({ current: value }),
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (typeof cleanup === 'function') hooks.cleanups.push(cleanup);
  },
}));

class MemoryStorage {
  readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

let local: MemoryStorage;
let session: MemoryStorage;
let win: EventTarget & { zodiacsProfileAccess?: { canRead(): boolean } };
let importBootstrap: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  sync.listeners = [];
  sync.session = null;
  local = new MemoryStorage();
  session = new MemoryStorage();
  win = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  vi.stubGlobal('window', win);
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('document', { documentElement: { hasAttribute: (name: string) => name === 'data-account-sync-v2' } });
  vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, callback: () => unknown) => callback() } });
  vi.stubEnv('PUBLIC_ACCOUNT_SYNC_V2_ENABLED', '1');
  vi.stubEnv('PUBLIC_SUPABASE_URL', '');
  // The exact inline reader Base.astro puts in every v2 page head.
  const base = readFileSync(new URL('../layouts/Base.astro', import.meta.url), 'utf8');
  const start = base.indexOf('profileRetainedOwnerKey: ACCOUNT_V2_RETAINED_OWNER_KEY,');
  const open = base.indexOf('}}>', start) + 3;
  new Function('window', 'localStorage', 'sessionStorage', 'profileAccessKey', 'profileOwnerKey', 'profileRetainedOwnerKey',
    base.slice(open, base.indexOf('</script>', open)))(
    win, local, session, ACCOUNT_V2_PROFILE_ACCESS_KEY, ACCOUNT_V2_LOCAL_OWNER_KEY, ACCOUNT_V2_RETAINED_OWNER_KEY,
  );
  // Count the on-demand loads while keeping the real bootstrap.
  const request = await import('../lib/account-v2/profile-access-request');
  importBootstrap = vi.fn(() => import('../lib/account-v2/profile-access-autostart'));
  request.setProfileAccessBootstrapImporterForTests(importBootstrap);
});

afterEach(() => {
  for (const cleanup of hooks.cleanups.splice(0)) cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function parse(file: string) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** The named functions of an island, compiled to run against `context`. */
function islandFunctions(file: string, names: string[], context: Record<string, unknown>) {
  const ast = parse(file);
  const declarations = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) {
      declarations.set(node.name.text, node.getText(ast));
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  expect([...declarations.keys()].sort()).toEqual([...names].sort());
  const code = names.map((name) => declarations.get(name)).join('\n').replace(/\bimport\(/g, 'importModule(');
  const output = ts.transpile(`${code}\nreturn { ${names.join(', ')} };`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
  return new Function('context', `with(context){${output}}`)(context) as Record<string, (...args: unknown[]) => unknown>;
}

/**
 * Installs the island's own revoke callback (the function it passes to
 * useProfileAccessGeneration) through the real hook, and puts the hook's
 * generation where the island's save reads it. Names the callback uses that
 * the test does not model (other setters, refs and helpers) are inert stand-ins.
 */
async function installAccessListeners(file: string, context: Record<string, any>) {
  const ast = parse(file);
  let callback = '';
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === 'useProfileAccessGeneration' && node.arguments[0]) {
      callback = node.arguments[0].getText(ast);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  expect(callback).toMatch(/^\(\) => \{/u);
  const scope = new Proxy(context, {
    has: (_target, key) => typeof key === 'string',
    get: (target, key) => {
      if (typeof key !== 'string') return undefined;
      if (key in target) return target[key];
      if (key in globalThis) return (globalThis as Record<string, unknown>)[key];
      return () => undefined;
    },
    set: (target, key, value) => { target[key as string] = value; return true; },
  });
  const output = ts.transpile(`return (${callback});`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
  const onRevoke = new Function('scope', `with(scope){${output}}`)(scope) as () => void;
  const { useProfileAccessGeneration } = await import('../lib/hooks/useProfileAccessGeneration');
  context.profileAccessGeneration = useProfileAccessGeneration(onRevoke);
}

const flush = async () => { for (let index = 0; index < 20; index += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };

/** Another tab (or this tab's account panel) starting an owner transition. */
const ownerTransition = () => win.dispatchEvent(new Event(ACCOUNT_V2_PROFILE_REVOKE_EVENT));

async function chartContext(overrides: Record<string, unknown> = {}) {
  const { profileAccessAllowed } = await import('../lib/account-v2/profile-access-reader');
  const computedInput = { date: '2000-01-01', time: '12:00', timeKnown: true, houseSystem: 'whole',
    city: { name: 'Synthetic place', admin1: '', country: '', lat: 1, lon: 2, tz: 'UTC', pop: 0 } };
  const chart = { input: { utc: new Date('2000-01-01T12:00:00Z') }, bodies: [{ body: 'Sun', lon: 280, retrograde: false }],
    houses: null, angles: null, flags: [] };
  const owner = { runId: 0, inputRevision: 0, requiresProfileAccess: false, chart };
  const context: Record<string, any> = {
    chart, computedInput, subjectMode: 'self', autoName: 'Synthetic chart', matchedName: null, saved: 'idle',
    savePromptOpen: false, locale: 'en', ENGINE_VERSION: 'synthetic', sunSign: { slug: 'capricorn' },
    resultOwnerRef: { current: owner }, runChartIdRef: { current: 0 }, inputRevisionRef: { current: 0 },
    savePromptGenerationRef: { current: 0 }, saveOriginRef: { current: 'free' },
    saveReturnRef: { current: null }, saveButtonRef: { current: null }, resultRef: { current: null },
    chartContextIdRef: { current: 0 }, HTMLElement: class {}, document: { activeElement: null },
    crypto: { randomUUID: () => '44444444-4444-4444-8444-444444444444' },
    requestAnimationFrame: () => {},
    profileAccessAllowed, track: vi.fn(), publishPostChartContext: vi.fn(), loadPushOptIn: vi.fn(),
    setA2hsHint: vi.fn(), t: (_locale: string, key: string) => key,
    importModule: (path: string) => path === '../lib/account-v2/profile-access-request'
      ? import('../lib/account-v2/profile-access-request')
      : path === '../lib/profile/store' ? import('../lib/profile/store')
        : Promise.resolve({}),
    ...overrides,
  };
  for (const name of ['Saved', 'MatchedName', 'SavePromptOpen']) {
    context[`set${name}`] = (value: unknown) => { context[name[0]!.toLowerCase() + name.slice(1)] = value; };
  }
  await installAccessListeners('./ChartCalculator.tsx', context);
  Object.assign(context, islandFunctions('./ChartCalculator.tsx', [
    'resultIsCurrent', 'currentResultOwner', 'chartIdentity', 'isConnectedSaveControl',
    'saveFocusFallback', 'closeSavePrompt', 'commitSave',
  ], context));
  return context;
}

async function pairContext(overrides: Record<string, unknown> = {}) {
  const reader = await import('../lib/account-v2/profile-access-reader');
  const request = await import('../lib/account-v2/profile-access-request');
  const pairs = await import('../lib/profile/pairs');
  const context: Record<string, any> = {
    result: { sides: [
      { kind: 'input', label: 'Synthetic A', input: { date: '2000-01-01', time: '12:00', timeKnown: true, lat: 1, lon: 2, tz: 'UTC', houseSystem: 'whole' } },
      { kind: 'input', label: 'Synthetic B', input: { date: '2001-02-03', time: null, timeKnown: false, lat: 3, lon: 4, tz: 'UTC', houseSystem: 'whole' } },
    ] },
    requestRef: { current: 0 }, locale: 'en', pairSave: 'idle', pairAnnounce: '',
    crypto: { randomUUID: () => '55555555-5555-4555-8555-555555555555' },
    savePair: pairs.savePair, profileAccessAllowed: reader.profileAccessAllowed,
    ensureProfileWriteAccess: request.ensureProfileWriteAccess, runAfterProfileAccess: request.runAfterProfileAccess,
    pc: (_locale: string, key: string) => key, t: (_locale: string, key: string) => key, track: vi.fn(),
    setPairSave: (value: string) => { context.pairSave = value; },
    setPairAnnounce: (value: string) => { context.pairAnnounce = value; },
    setResult: (value: unknown) => { context.result = value; },
    ...overrides,
  };
  await installAccessListeners('./SynastryCalculator.tsx', context);
  Object.assign(context, islandFunctions('./SynastryCalculator.tsx', [
    'announcePairSaveUnavailable', 'pairWriteMayProceed', 'onSavePair',
  ], context));
  return context;
}

describe('first-time guest save with account sync on', () => {
  it('saves a chart from /birth-chart/ (ChartCalculator "Save this chart")', async () => {
    const context = await chartContext();
    expect(local.length).toBe(0);
    expect(context.profileAccessAllowed()).toBe(false);
    await context.commitSave(undefined, 'skip');
    await flush();

    expect(importBootstrap).toHaveBeenCalledTimes(1);
    expect(context.saved).toBe('saved');
    const stored = JSON.parse(local.getItem('zodiacs.profile.v1')!);
    expect(stored.charts).toHaveLength(1);
    expect(stored.charts[0].relationship).toBe('self');
    expect(local.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toBeNull();
    // The island's revoke callback was live throughout: a real revocation now reaches it.
    const generation = context.savePromptGenerationRef.current;
    ownerTransition();
    expect(context.savePromptGenerationRef.current).toBe(generation + 1);
    expect(context.saved).toBe('idle');
  });

  it('shows the save-could-not-start message when the bootstrap cannot load, and writes nothing', async () => {
    const request = await import('../lib/account-v2/profile-access-request');
    request.setProfileAccessBootstrapImporterForTests(() => Promise.reject(new Error('chunk failed')));
    const context = await chartContext();
    await context.commitSave(undefined, 'skip');
    expect(context.saved).toBe('unavailable');
    expect(local.getItem('zodiacs.profile.v1')).toBeNull();
  });

  it('cancels a chart save when access is revoked after the wait, before the write', async () => {
    let revokeBeforeStore = true;
    const context = await chartContext({
      importModule: (path: string) => {
        if (path === '../lib/account-v2/profile-access-request') return import('../lib/account-v2/profile-access-request');
        if (path === '../lib/profile/store') {
          if (revokeBeforeStore) {
            revokeBeforeStore = false;
            ownerTransition();
            win.dispatchEvent(new Event(ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT));
          }
          return import('../lib/profile/store');
        }
        return Promise.resolve({});
      },
    });
    await context.commitSave(undefined, 'skip');
    await flush();
    expect(revokeBeforeStore).toBe(false);
    expect(context.profileAccessAllowed()).toBe(true);
    expect(local.getItem('zodiacs.profile.v1')).toBeNull();
    expect(context.saved).toBe('idle');
  });

  it('saves a comparison from /compatibility/ (SynastryCalculator "Save this comparison")', async () => {
    const context = await pairContext();
    expect(local.length).toBe(0);
    context.onSavePair();
    expect(context.pairSave).toBe('idle');
    await flush();

    expect(importBootstrap).toHaveBeenCalledTimes(1);
    expect(context.pairSave).toBe('saved');
    expect(context.pairAnnounce).toBe('pairSaved');
    expect(JSON.parse(local.getItem('zodiacs.pairs.v1')!)).toHaveLength(1);
    expect(context.track).toHaveBeenCalledWith('chart_saved', { source: 'pair' });
    // The island's revoke callback was live throughout: a real revocation now reaches it.
    const request = context.requestRef.current;
    ownerTransition();
    expect(context.requestRef.current).toBe(request + 1);
    expect(context.result).toBeNull();
  });

  it('shows the save-could-not-start message for a comparison when the bootstrap cannot load', async () => {
    const request = await import('../lib/account-v2/profile-access-request');
    request.setProfileAccessBootstrapImporterForTests(() => Promise.reject(new Error('chunk failed')));
    const savePair = vi.fn();
    const context = await pairContext({
      result: { sides: [{ kind: 'chart', chartId: 'a', label: 'A' }, { kind: 'chart', chartId: 'b', label: 'B' }] },
      crypto: { randomUUID: () => 'x' }, savePair,
    });
    context.onSavePair();
    await flush();
    expect(savePair).not.toHaveBeenCalled();
    expect(context.pairSave).toBe('unavailable');
    expect(context.pairAnnounce).toBe('profileSaveUnavailable');
  });
});
