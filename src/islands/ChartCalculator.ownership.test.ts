import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Execute the actual component's ownership functions with controlled async
// boundaries. The browser driver separately verifies rendered interactions.
const source = readFileSync(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('ChartCalculator.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = [
  'clearReceiptExport', 'advanceInputRevision', 'resultIsCurrent', 'currentResultOwner',
  'clearResult', 'invalidateProfileHandoff', 'runChart', 'openShareOptions',
  'shareChartFromAction', 'closeShareDialog', 'closeSavePrompt', 'chartIdentity', 'commitSave',
  'startTour', 'selectLens', 'toggleDepth', 'resetLens', 'exitTour', 'requestChartControls', 'openSavePrompt',
];
const declarations = new Map<string, string>();
let cleanupExpression = '', revokeExpression = '', initializeExpression = '';
function visit(node: ts.Node): void {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) {
    declarations.set(node.name.text, node.getText(ast));
  }
  if (ts.isCallExpression(node)) {
    const name = node.expression.getText(ast);
    const expression = node.arguments[0]?.getText(ast) ?? '';
    if (name === 'useEffect' && expression.includes('runChartIdRef.current += 1')
      && expression.includes('receiptExportRef.current = null')) cleanupExpression = expression;
    if (name === 'useEffect' && expression.includes("params.has('p')")) initializeExpression = expression;
    if (name === 'useProfileAccessGeneration') revokeExpression = expression;
  }
  ts.forEachChild(node, visit);
}
visit(ast);
function deferred<T = any>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const input = (date = '1990-06-15') => ({ date, time: '14:30', timeKnown: true,
  city: { name: 'Synthetic place', admin1: '', country: '', tz: 'UTC', lat: 0, lon: 0, pop: 0 }, houseSystem: 'whole' });
function harness() {
  const state: Record<string, any> = {
    chart: null, receiptExport: null, signature: null, computedInput: null, shareInput: null,
    card: 'idle', saved: 'idle', busy: false, error: '', chartActionDockModule: {},
    date: '1990-06-15', time: '14:30', city: input().city, timeKnown: true, houseSystem: 'whole',
    tourOpen: false, depthOpen: false, depthMod: null, lens: 'natal', lensMod: null, tourMod: null, selection: null,
    matchedName: null, autoName: 'Synthetic owner', subjectMode: 'self', sunSign: { slug: 'aries' },
  };
  const calls: string[] = [], frames: (() => void)[] = [], modules = new Map<string, Promise<any>>();
  const context: Record<string, any> = {
    ENGINE_VERSION: '0.1.1-rc.6', mode: 'full', showsEnglishInterpretation: true, locale: 'en', ...state,
    frames, calls, modules, allowed: true, crypto: { randomUUID: () => '12345678-1234-4234-8234-123456789abc' },
    navigator: { userAgent: 'Synthetic browser' }, localStorage: {},
    document: { activeElement: null, body: {} }, HTMLElement: class {},
    window: { location: { hash: '', pathname: '/birth-chart/', search: '' }, dispatchEvent: () => { calls.push('computed-event'); }, matchMedia: () => ({ matches: false }), removeEventListener() {} },
    history: { replaceState() {} }, subjectModeFromHash: () => 'other', mineHandoffFromHash: () => ({ kind: 'profile', id: 'synthetic-profile-id' }), profileHandoffOriginsFromHash: () => ({ mine: true }),
    NAME_MAX: 24, linkName: null, isAutoName: () => true,
    CustomEvent: class {}, matchMedia: () => ({ matches: true }),
    requestAnimationFrame: (callback: () => void) => { frames.push(callback); },
    console: { error: () => {} }, t: () => 'Generic error', calculationError: () => 'Generic calculation error',
    profileAccessAllowed: () => context.allowed,
    clearPostChartContext: () => { context.postContext = null; },
    publishPostChartContext: (value: unknown) => { context.postContext = value; },
    requestChartControls: () => {}, resetLens: () => {}, exitTour: () => {},
    cancelSpotlightArrival: () => {}, isConnectedSaveControl: () => false, saveFocusFallback: () => null,
    keepWheelAboveTour: () => {}, applySelect: () => {}, loadPushOptIn: () => {},
    readFirstReadingProgress: () => ({}),
    track: () => {}, signForLongitude: () => ({ slug: 'aries' }),
    prepareLocalTime: () => Promise.resolve(),
    resolveLocalToUtc: (date: string) => ({ utc: new Date(date + 'T14:30:00Z'), offsetMinutes: 0, flags: [] }),
    assessLocalDateReference: () => ({ referenceStatus: 'member' }),
    moonIsUncertain: (chart: any) => chart.moonSignCandidates?.length !== 1,
  };
  for (const name of ['inputRevision', 'runChartId', 'chartContextId', 'profileAccessGeneration', 'profileHandoffId', 'savePromptGeneration']) context[name + (name === 'profileAccessGeneration' ? '' : 'Ref')] = { current: 0 };
  for (const name of ['primaryProfileOrigin', 'mineProfileOrigin', 'focusAfterCompute']) context[name + 'Ref'] = { current: false };
  for (const name of ['resultOwner', 'receiptExport', 'primaryProfileChartId', 'result', 'shareReturn', 'saveReturn', 'wheelbox']) context[name + 'Ref'] = { current: null };
  context.shareRuntimeRef = { current: {} }; context.saveOriginRef = { current: 'free' };
  const setterNames = [...source.matchAll(/\b(set[A-Z]\w*)\b/g)].map((match) => match[1]);
  for (const setter of new Set(setterNames)) {
    const key = setter[3].toLowerCase() + setter.slice(4);
    context[setter] = (value: unknown) => {
      const next = typeof value === 'function' ? value(context[key]) : value;
      context[key] = state[key] = next;
    };
  }
  const chart = (calculation: any) => ({ input: calculation, bodies: [{ body: 'Sun', lon: 1 }, { body: 'Moon', lon: 2 }], flags: [], houses: null, angles: null, aspects: [] });
  const engine = { computeChart: (calculation: any) => { calls.push('legacy-natal'); return chart(calculation); }, computeBodies: () => [] };
  context.loadEngine = () => Promise.resolve(engine);
  context.loadChartControls = () => Promise.resolve({ default: () => null });
  context.loadCalculatorReceipt = () => Promise.resolve({ computeCalculatorReceipt: (calculation: any) => { calls.push('portable-natal'); return { chart: chart(calculation), envelopeJson: 'synthetic exact envelope' }; } });
  context.importModule = (path: string) => modules.get(path) ?? Promise.resolve(
    path === '../lib/chart-signature' ? { chartSignature: () => ({ title: 'Synthetic signature' }) }
      : path === './PositionsShareSurface' ? { preparePrimaryShareArtifact: async () => ({ synthetic: true }), sharePrimaryArtifact: async () => 'saved' }
      : path === '../lib/profile/store' ? { saveChart: () => { calls.push('save-write'); return 'saved'; }, findMatchingChart: () => null }
      : { default: () => null },
  );
  const functions = names.map((name) => declarations.get(name) ?? '').join('\n').replace(/\bimport\(/g, 'importModule(');
  const output = ts.transpile(functions + `\nreturn { ${names.filter((name) => declarations.has(name)).join(',')} };`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
  Object.assign(context, new Function('context', `with(context){${output}}`)(context));
  const bind = (expression: string) => new Function('context', `with(context){return (${ts.transpile(expression.replace(/\bimport\(/g, 'importModule('), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }).trim().replace(/;$/, '')});}`)(context);
  context.unmount = bind(cleanupExpression)(); context.revoke = bind(revokeExpression); context.initialize = bind(initializeExpression);
  return { context, state, calls, modules, frames, engine };
}
function expectEmpty(context: Record<string, any>) {
  for (const key of ['chart', 'computedInput', 'shareInput', 'receiptExport', 'signature']) expect(context[key], key).toBeNull();
  expect(context.shareRuntimeRef.current.primary).toBeUndefined();
  expect(context.postContext).toBeNull(); expect(context.card).toBe('idle');
}

describe('ChartCalculator result ownership', () => {
  it.each(['engine', 'receipt'])('rejects late completion after an edit during the %s loader', async (boundary) => {
    const h = harness(), pending = deferred();
    if (boundary === 'engine') h.context.loadEngine = () => pending.promise;
    else h.context.loadCalculatorReceipt = () => pending.promise;
    const work = h.context.runChart(input(), true); await flush();
    h.context.invalidateProfileHandoff(); h.context.setDate('1991-06-15');
    expect(h.context.busy).toBe(false);
    pending.resolve(boundary === 'engine' ? h.engine : { computeCalculatorReceipt: () => { throw Error('Obsolete calculation executed'); } });
    await work; await flush(); expectEmpty(h.context);
    expect(h.calls).not.toContain('legacy-natal'); expect(h.calls).not.toContain('portable-natal');
    expect(h.context.date).toBe('1991-06-15');
  });

  it('lets a replacement run finish while the obsolete loader remains pending', async () => {
    const h = harness(), older = deferred(); let loads = 0;
    h.context.loadEngine = () => ++loads === 1 ? older.promise : Promise.resolve(h.engine);
    const oldRun = h.context.runChart(input(), false); await flush();
    h.context.invalidateProfileHandoff(); await h.context.runChart(input('1991-06-15'), false); await flush();
    const currentChart = h.context.chart; older.resolve(h.engine); await oldRun; await flush();
    expect(h.context.chart).toBe(currentChart); expect(h.context.computedInput.date).toBe('1991-06-15');
    expect(h.calls.filter((call) => call === 'portable-natal')).toHaveLength(1);
  });

  it.each(['calculation', 'local-date reference'])('clears prior result on a new %s failure and recovers without changing typed fields', async (boundary) => {
    const h = harness(); await h.context.runChart(input(), true); await flush();
    const workingLoader = h.context.loadCalculatorReceipt;
    if (boundary === 'calculation') h.context.loadCalculatorReceipt = () => Promise.resolve({ computeCalculatorReceipt: () => { throw Error('Synthetic private failure'); } });
    else h.context.assessLocalDateReference = () => { throw Error('Synthetic reference failure'); };
    await h.context.runChart({ ...input('1991-06-15'), timeKnown: boundary !== 'local-date reference' }, true); await flush();
    expectEmpty(h.context); expect(h.context.error).toBe(boundary === 'calculation' ? 'Generic calculation error' : 'Generic error'); expect(h.context.busy).toBe(false);
    expect(h.context.date).toBe('1990-06-15'); expect(h.context.time).toBe('14:30');
    h.context.loadCalculatorReceipt = workingLoader;
    h.context.assessLocalDateReference = () => ({ referenceStatus: 'member' });
    await h.context.runChart(input('1992-06-15'), true); await flush();
    expect(h.context.computedInput.date).toBe('1992-06-15'); expect(h.context.error).toBe('');
  });

  it('preserves the optional pre-calculation module fallback with exactly one legacy natal calculation', async () => {
    const h = harness(); h.context.loadCalculatorReceipt = () => Promise.reject(Error('Synthetic download failed'));
    await h.context.runChart(input(), true); await flush();
    expect(h.calls.filter((call) => call === 'legacy-natal')).toHaveLength(1);
    expect(h.calls).not.toContain('portable-natal'); expect(h.context.chart).not.toBeNull(); expect(h.context.receiptExport).toBeNull();
  });

  it.each(['signature', 'prepared-share'])('does not publish delayed %s for a newer input', async (boundary) => {
    const h = harness(), pending = deferred();
    if (boundary === 'signature') h.modules.set('../lib/chart-signature', pending.promise);
    else h.modules.set('./PositionsShareSurface', Promise.resolve({ preparePrimaryShareArtifact: () => pending.promise, sharePrimaryArtifact: async () => 'saved' }));
    await h.context.runChart(input(), true); await flush(); h.context.invalidateProfileHandoff();
    pending.resolve(boundary === 'signature' ? { chartSignature: () => ({ title: 'Obsolete' }) } : { obsolete: true }); await flush();
    expectEmpty(h.context);
  });

  it.each(['dialog', 'share-completion'])('ignores a delayed %s after a replacement result', async (boundary) => {
    const h = harness(), pending = deferred(); await h.context.runChart(input(), false); await flush();
    let action: Promise<unknown> | undefined;
    if (boundary === 'dialog') { h.modules.set('./ChartShareDialog', pending.promise); action = h.context.openShareOptions(); }
    else { h.context.shareRuntimeRef.current.primary.share = () => pending.promise; h.context.shareChartFromAction(); }
    await h.context.runChart(input('1991-06-15'), false); await flush();
    pending.resolve(boundary === 'dialog' ? { default: () => null } : 'saved'); await action; await flush();
    expect(h.context.shareDialogOpen).toBe(false); expect(h.context.card).toBe('idle');
  });

  it('does not relabel a newer result when an explicitly requested save completes', async () => {
    const h = harness(), pending = deferred(); await h.context.runChart(input(), false); await flush();
    h.modules.set('../lib/profile/store', pending.promise); const saving = h.context.commitSave(undefined, 'skip');
    await h.context.runChart(input('1991-06-15'), false); await flush();
    pending.resolve({ saveChart: () => { h.calls.push('save-write'); return 'saved'; }, findMatchingChart: () => ({ name: 'Old owner' }) });
    await saving; await flush();
    expect(h.calls.filter((call) => call === 'save-write')).toHaveLength(1);
    expect(h.context.saved).toBe('idle'); expect(h.context.matchedName).toBeNull(); expect(h.context.postContext).toBeNull();
  });

  it.each(['tour', 'lens', 'depth'])('fences delayed %s controls after an edit', async (kind) => {
    const h = harness(), pending = deferred(); await h.context.runChart(input(), false); await flush();
    const path = kind === 'tour' ? './explorer/tour' : kind === 'lens' ? './explorer/lens/ChartLens' : './chart3d/EclipticView';
    h.modules.set(path, pending.promise);
    const action = kind === 'tour' ? h.context.startTour() : kind === 'lens' ? h.context.selectLens('sky') : h.context.toggleDepth();
    h.context.invalidateProfileHandoff(); pending.resolve({ default: () => null }); await action;
    expect(h.context.tourOpen).toBe(false); expect(h.context.depthOpen).toBe(false); expect(h.context.lens).toBe('natal');
  });

  it.each(['unmount', 'profile-revoke'])('rejects pending calculations after %s', async (boundary) => {
    const h = harness(), pending = deferred(); h.context.primaryProfileOriginRef.current = boundary === 'profile-revoke';
    h.context.loadEngine = () => pending.promise; const work = h.context.runChart(input(), true); await flush();
    if (boundary === 'unmount') h.context.unmount();
    else { h.context.allowed = false; h.context.profileAccessGeneration.current++; h.context.revoke(); }
    pending.resolve(h.engine); await work; await flush();
    expect(h.context.chart).toBeNull(); expect(h.calls).not.toContain('portable-natal'); expect(h.calls).not.toContain('computed-event');
    if (boundary === 'profile-revoke') { expect(h.context.date).toBe(''); expect(h.context.city).toBeNull(); expect(h.context.busy).toBe(false); }
  });

  it('does not move focus when old share and save dialogs close before an edit', async () => {
    const h = harness(); await h.context.runChart(input(), false); await flush();
    let focused = 0;
    h.context.wheelboxRef.current = { focus: () => { focused++; } };
    h.context.saveFocusFallback = () => ({ focus: () => { focused++; } });
    h.context.closeShareDialog(); h.context.closeSavePrompt();
    h.context.invalidateProfileHandoff(); for (const frame of h.frames) frame();
    expect(focused).toBe(0);
  });

  it.each(['before-completion', 'before-frame'])('keeps a stale controls retry from taking newer focus %s', async (phase) => {
    const h = harness(), pending = deferred(); await h.context.runChart(input(), false); await flush();
    let focused = 0; const module = { default: () => null };
    h.context.resultRef.current = { scrollIntoView() {}, querySelector: () => ({ focus: () => { focused++; } }) };
    h.context.loadChartControls = () => pending.promise;
    h.context.requestChartControls(true);
    if (phase === 'before-frame') { pending.resolve(module); await flush(); }
    h.context.invalidateProfileHandoff(); await h.context.runChart(input('1991-06-15'), false); await flush();
    if (phase === 'before-completion') { pending.resolve(module); await flush(); }
    for (const frame of h.frames) frame();
    expect(focused).toBe(0); expect(h.context.chartActionDockModule).toBe(module);
  });

  it('does not focus or erase a replacement save target after mine-only revocation', async () => {
    const h = harness(); await h.context.runChart(input(), false); await flush();
    let focused = 0; h.context.saveFocusFallback = () => ({ focus: () => { focused++; } });
    h.context.closeSavePrompt(); h.context.mineProfileOriginRef.current = true;
    h.context.allowed = false; h.context.profileAccessGeneration.current++; h.context.revoke();
    const replacement = {}; h.context.saveReturnRef.current = replacement;
    for (const frame of h.frames) frame();
    expect(h.context.chart).not.toBeNull(); expect(focused).toBe(0); expect(h.context.saveReturnRef.current).toBe(replacement);
  });

  it('preserves a newer prompt on the same result while an earlier save completes once', async () => {
    const h = harness(), pending = deferred(); await h.context.runChart(input(), false); await flush();
    h.context.subjectMode = 'other'; h.context.openSavePrompt();
    h.modules.set('../lib/profile/store', pending.promise); const saving = h.context.commitSave(undefined, 'prompt');
    h.context.openSavePrompt();
    pending.resolve({ saveChart: () => { h.calls.push('save-write'); return 'saved'; }, findMatchingChart: () => null });
    await saving; await flush();
    expect(h.calls.filter(call => call === 'save-write')).toHaveLength(1); expect(h.context.savePromptOpen).toBe(true); expect(h.context.saved).toBe('idle');
  });

  it('keeps current close focus and a committed save hint working', async () => {
    const h = harness(); await h.context.runChart(input(), false); await flush();
    let focused = 0, claimed = 0;
    h.context.saveFocusFallback = () => ({ focus: () => { focused++; } });
    h.modules.set('../lib/a2hs', Promise.resolve({ claimA2hsHint: () => { claimed++; return { platform: 'ios' }; } }));
    h.context.subjectMode = 'other'; h.context.openSavePrompt();
    await h.context.commitSave('Synthetic name', 'prompt'); await flush();
    for (const frame of h.frames) frame();
    expect(h.calls.filter(call => call === 'save-write')).toHaveLength(1);
    expect(focused).toBe(1); expect(claimed).toBe(1); expect(h.context.a2hsHint).toEqual({ platform: 'ios' });
    expect(h.context.savePromptOpen).toBe(false); expect(h.context.saved).toBe('saved');
  });

  it.each(['revoke', 'revoke-regrant', 'unchanged', 'public-mine'])('retains positions while admitting only current mine context: %s', async (change) => {
    const h = harness(), pending = deferred(); h.context.window.location.hash = '#p=synthetic';
    if (change === 'public-mine') h.context.profileHandoffOriginsFromHash = () => ({ mine: false });
    h.modules.set('./PositionsShareSurface', pending.promise); h.context.initialize();
    if (change !== 'unchanged') { h.context.allowed = false; h.context.profileAccessGeneration.current++; h.context.revoke(); }
    if (change === 'revoke-regrant') { h.context.allowed = true; h.context.profileAccessGeneration.current++; }
    pending.resolve({ decodePositionsToken: () => ({ publicPositions: true }) }); await flush();
    expect(h.context.positionsOnly).toEqual({ publicPositions: true });
    expect(h.context.mineHandoff).toEqual(change === 'unchanged' || change === 'public-mine' ? { kind: 'profile', id: 'synthetic-profile-id' } : null);
  });

  it('does not refill share state or scroll after a synchronous result event edits the form', async () => {
    const h = harness(); h.context.window.dispatchEvent = () => h.context.invalidateProfileHandoff();
    let scrolled = false; h.context.resultRef.current = { scrollIntoView: () => { scrolled = true; } };
    await h.context.runChart(input(), true); await flush(); for (const frame of h.frames) frame();
    expectEmpty(h.context); expect(scrolled).toBe(false);
  });
});
