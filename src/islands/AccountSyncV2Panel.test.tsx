import { h } from 'preact';
import render from 'preact-render-to-string';
import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountSyncV2Panel, {
  accountDeletionCompletionMessage,
  CLEAR_ALL_CALENDARS_NOTE,
  displayAccountV2Error,
  planSavedRecordErasure,
  RECORDS_BLOCKED_MESSAGE,
  reconcileBootstrapConsentMetadata,
  reconcilePulledConsent,
  runPlannedSavedRecordErasure,
  type SavedRecordAccessLoad,
} from './AccountSyncV2Panel';
import { AccountV2ClientError } from '../lib/account-v2/client';
import type { AccountV2Storage } from '../lib/account-v2/local-state';
import { clearAllZodiacsDataFromDevice } from '../lib/account-v2/profile-boundary';
import { CALENDAR_FEEDS_STORAGE_KEY } from '../lib/calendar-feed/client';
import type { AccountSyncMetadataV1 } from '../lib/account-v2/types';

describe('AccountSyncV2Panel server-safe shell', () => {
  it('renders nothing unless the server-computed flag is exactly enabled', () => {
    expect(render(h(AccountSyncV2Panel, { enabled: false }))).toBe('');
  });

  it('states the account-free, private, self-chart-only promise before hydration', () => {
    const markup = render(h(AccountSyncV2Panel, { enabled: true }));
    expect(markup).toContain('Optional Zodiacs account');
    expect(markup).toContain('Charts work without an account');
    expect(markup).toContain('one self chart');
    expect(markup).toContain('Nothing becomes public');
    expect(markup.toLowerCase()).not.toContain('astrofolio');
  });

  it('explains that an unknown result keeps a reconciliation-safe retry identity', () => {
    const message = displayAccountV2Error(
      new AccountV2ClientError('network_unavailable', 0),
      true,
    );
    expect(message).toContain('may have completed');
    expect(message).toContain('saved request identity');
    expect(message).toContain('only when nothing changed');
  });

  it('removes phantom cloud selection after a lost withdrawal response', () => {
    const metadata: AccountSyncMetadataV1 = {
      version: 1,
      accountId: '11111111-1111-4111-8111-111111111111',
      deviceId: '22222222-2222-4222-8222-222222222222',
      serverCursor: '4',
      pendingConsentOperation: {
        version: 1,
        operation: 'consent',
        decision: 'withdraw',
        mutationId: '33333333-3333-4333-8333-333333333333',
        semanticFingerprint: 'a'.repeat(64),
      },
      charts: [{
        chartId: '44444444-4444-4444-8444-444444444444',
        selectedForSync: true,
        serverRevision: 2,
        pendingOperation: {
          version: 1,
          operation: 'delete_chart',
          mutationId: '55555555-5555-4555-8555-555555555555',
          chartId: '44444444-4444-4444-8444-444444444444',
          baseRevision: 2,
          semanticFingerprint: 'b'.repeat(64),
        },
      }],
    };

    const reconciled = reconcileBootstrapConsentMetadata(metadata, 'withdrawn');
    expect(reconciled?.pendingConsentOperation).toBeNull();
    expect(reconciled?.charts[0]).toMatchObject({
      selectedForSync: false,
      pendingOperation: null,
    });
  });

  it('reconciles consent changed on another device before advancing the pull cursor', () => {
    const metadata: AccountSyncMetadataV1 = {
      version: 1,
      accountId: '11111111-1111-4111-8111-111111111111',
      deviceId: '22222222-2222-4222-8222-222222222222',
      serverCursor: '4',
      pendingConsentOperation: null,
      charts: [{
        chartId: '44444444-4444-4444-8444-444444444444',
        selectedForSync: true,
        serverRevision: 2,
        pendingOperation: null,
      }],
    };

    const withdrawn = reconcilePulledConsent(metadata, 'withdraw');
    expect(withdrawn?.consent).toBe('withdrawn');
    expect(withdrawn?.metadata.charts[0]).toMatchObject({
      selectedForSync: false,
      pendingOperation: null,
    });
    expect(reconcilePulledConsent(withdrawn!.metadata, 'grant')?.consent)
      .toBe('granted');
  });

  it('keeps cloud reconciliation available while local consent is off', async () => {
    const source = await readFile(new URL('./AccountSyncV2Panel.tsx', import.meta.url), 'utf8');
    expect(source).toContain('setAccount({ ...account, ...refreshed });');
    expect(source).toContain('disabled={busy}>Check cloud</button>');
  });

  it('keeps an age-ineligible chart local and clears the pending retry', async () => {
    const source = await readFile(new URL('./AccountSyncV2Panel.tsx', import.meta.url), 'utf8');
    expect(source).toContain("result.outcome === 'ineligible_age'");
    expect(source).toContain('pendingOperation: null');
    expect(source).toContain('limited to adults aged 18 or older');
  });

  it('revalidates profile access and ownership immediately before an upload', async () => {
    const source = await readFile(new URL('./AccountSyncV2Panel.tsx', import.meta.url), 'utf8');
    const upload = source.slice(
      source.indexOf('async function onPutChart('),
      source.indexOf('async function onDeleteSyncedChart('),
    );
    const send = upload.indexOf('await putSelfChart(session.access_token, wire)');
    expect(upload).toContain('const accessGeneration = profileAccessGeneration.current;');
    const checks = [...upload.matchAll(/assertActiveProfileBoundaryCurrent\(/gu)]
      .map((match) => match.index);
    expect(checks.length).toBeGreaterThanOrEqual(3);
    expect(send).toBeGreaterThan(checks[1]);
    expect(send).toBeLessThan(checks[2]);
  });

  it('does not recreate account metadata after an access-only device clear', async () => {
    const source = await readFile(new URL('./AccountSyncV2Panel.tsx', import.meta.url), 'utf8');
    const helper = source.slice(
      source.indexOf('function activeProfileBoundaryCurrent('),
      source.indexOf('function beginAuthTransition('),
    );
    expect(source).toContain('return generation === profileAccessGeneration.current;');
    expect(helper).toContain('!profileAccessGenerationCurrent(generation)');
    expect(helper).toContain('!profileAccessAllowed()');
    expect(helper).toContain('const owner = readLocalAccountOwner(storage);');
    expect(helper).toContain("owner.status === 'ready' && owner.accountId === accountId");

    for (const action of ['onConsent', 'onPutChart', 'onDeleteCloud']) {
      const start = source.indexOf(`async function ${action}(`);
      const next = source.indexOf('\n  async function ', start + 1);
      const body = source.slice(start, next === -1 ? undefined : next);
      expect(body, action).toContain('const accessGeneration = profileAccessGeneration.current;');
      expect(body.match(/assertActiveProfileBoundaryCurrent\(/gu)?.length, action)
        .toBeGreaterThanOrEqual(2);
    }
  });

  it('does not overclaim Daily Sun cleanup after a recovered deletion response', () => {
    expect(accountDeletionCompletionMessage(false, {
      dailySunRevoked: false,
      dailySunReconciliationRequired: true,
    })).toContain('cleanup could not be confirmed');
    expect(accountDeletionCompletionMessage(true, {
      dailySunRevoked: true,
      dailySunReconciliationRequired: false,
    })).toContain('subscription for this email was deleted');
  });

  it('retries a completed receipt and retains its recovery proof while provider cleanup is pending', async () => {
    const source = await readFile(new URL('./AccountSyncV2Panel.tsx', import.meta.url), 'utf8');
    expect(source).toContain("!completed || deletionReceipt?.dailySunReconciliationRequired");
    expect(source).toContain("status.outcome === 'prepared' || status.dailySunReconciliationRequired");
    expect(source).toContain('preserveRecovery || clearConfirmedAccountDeletionRequest');
  });

  it('gates the records hand-off only for an empty-looking browser and authorizes deletion erasure by its own transition', async () => {
    const source = await readFile(new URL('./AccountSyncV2Panel.tsx', import.meta.url), 'utf8');
    const initialize = source.slice(source.indexOf('const recordsAccess = await loadSavedRecordAccess();'), source.indexOf('const waitForProfileAccess'));
    expect(initialize).toContain("const emptyLookingBrowser = nextBoundary.status === 'ready' && nextBoundary.localOwnerAccountId === null;");
    // A records module that cannot load is as opaque as unavailable storage.
    expect(initialize).toContain(": { status: 'unavailable', guestRecords: 0 };");
    expect(initialize).toContain("if (emptyLookingBrowser && (records.status === 'pending' || records.status === 'unavailable')) {");
    expect(initialize).not.toContain("records.status === 'unsupported'");
    expect(initialize).not.toContain('sign-in stays locked here');
    const deletion = source.slice(source.indexOf('async function completeConfirmedDeletionOnDevice('), source.indexOf('\n  async function ', source.indexOf('async function completeConfirmedDeletionOnDevice(') + 1));
    const epoch = deletion.indexOf('const epoch = authEpoch.current;');
    const plan = deletion.indexOf('await planSavedRecordErasure(');
    expect(epoch).toBeGreaterThan(-1);
    expect(epoch).toBeLessThan(plan);
    expect(deletion).toContain("if (plan.status === 'blocked' || authEpoch.current !== epoch) return false;");
    expect(deletion).toContain('() => authEpoch.current === epoch');
  });

  it('says beside the sign-out that clears this browser that its calendars can then be removed only by email', async () => {
    expect(CLEAR_ALL_CALENDARS_NOTE).toContain('“Sign out · clear all Zodiacs data”');
    expect(CLEAR_ALL_CALENDARS_NOTE).toContain('only by sending its address to admin@zodiacs.org');
    const source = await readFile(new URL('./AccountSyncV2Panel.tsx', import.meta.url), 'utf8');
    const button = source.indexOf('onClick={() => void onSignOut(true)}>Sign out · clear all Zodiacs data</button>');
    const note = source.indexOf('<p>{CLEAR_ALL_CALENDARS_NOTE}</p>');
    expect(button).toBeGreaterThan(0);
    expect(note).toBeGreaterThan(button);
    expect(source.slice(button, note)).not.toContain('<section');

    // Why the note is needed: that sign-out deletes the calendars' removal keys.
    class MemoryStorage implements AccountV2Storage {
      readonly values = new Map<string, string>();
      get length() { return this.values.size; }
      getItem(key: string) { return this.values.get(key) ?? null; }
      key(index: number) { return [...this.values.keys()][index] ?? null; }
      removeItem(key: string) { this.values.delete(key); }
      setItem(key: string, value: string) { this.values.set(key, value); }
    }
    const local = new MemoryStorage();
    local.setItem(CALENDAR_FEEDS_STORAGE_KEY, JSON.stringify({ version: 1, feeds: [] }));
    expect(clearAllZodiacsDataFromDevice(local, new MemoryStorage()).ok).toBe(true);
    expect(local.getItem(CALENDAR_FEEDS_STORAGE_KEY)).toBeNull();
  });

  it('keeps export, withdrawal, and permanent deletion reachable when sync bootstrap is unavailable', async () => {
    const source = await readFile(new URL('./AccountSyncV2Panel.tsx', import.meta.url), 'utf8');
    expect(source).toContain('Account privacy controls remain available');
    expect(source).toContain('onClick={() => void onPrivacyWithdraw()}');
    expect(source).toContain("onClick={() => setView('deleting')}");
    expect(source.match(/Download account export/gu)?.length).toBeGreaterThanOrEqual(4);
    expect(source.match(/Permanently delete/gu)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain("result.outcome === 'not_bootstrapped'");
    expect(source).toContain("result.outcome === 'device_limit_reached'");
    expect(source).toContain('persistAccountPrivacyWithdrawal');
  });
});

describe('records erasure plan for sign-out, boundary clear and confirmed deletion', () => {
  afterEach(() => {
    vi.doUnmock('../lib/profile/saved-record-access');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('skips only when the feature is not built in; an enabled module that cannot load blocks the action', async () => {
    expect(await planSavedRecordErasure('device', async () => ({ status: 'disabled' }))).toEqual({ status: 'none' });
    expect(await planSavedRecordErasure('device', async () => ({ status: 'unavailable' })))
      .toEqual({ status: 'blocked', message: RECORDS_BLOCKED_MESSAGE });
    expect(await runPlannedSavedRecordErasure({ status: 'none' }, () => true)).toBe('skipped');
    // A blocked plan never reaches a transition; if one did, it would still refuse.
    expect(await runPlannedSavedRecordErasure({ status: 'blocked', message: RECORDS_BLOCKED_MESSAGE }, () => true)).toBe('failed');
  });

  it('keeps cleanup working after a rollback: flag off with records still on the device', async () => {
    // The build flag gates writing and the record surfaces, never cleanup. A
    // device that kept records while the feature was on must still have them
    // removed by a destructive account action after the flag goes off again.
    vi.stubEnv('PUBLIC_SAVED_RECORDS_ENABLED', '');
    const present = vi.fn(async () => [{ name: 'zodiacs-saved-natal-v1' }]);
    vi.stubGlobal('indexedDB', { databases: present });
    const retainedDeps = { enabled: true, rights: 'read-only' } as never;
    const api = {
      retainedSavedRecordDeps: vi.fn(() => retainedDeps),
      prepareSavedRecordErasure: vi.fn(async () => ({
        status: 'ready' as const,
        ticket: { target: '*', expected: 1, expectedDevice: 1, guestRecords: 0 },
      })),
      eraseSavedRecords: vi.fn(async () => ({ ok: true as const, value: 'erased' as const })),
      confirmSavedRecordsAbsent: vi.fn(),
    };
    vi.doMock('../lib/profile/saved-record-access', () => api);
    vi.resetModules();
    const panel = await import('./AccountSyncV2Panel');

    const plan = await panel.planSavedRecordErasure('device');
    expect(present).toHaveBeenCalled();
    expect(plan.status).toBe('ready');
    expect(api.prepareSavedRecordErasure).toHaveBeenCalledWith('device', retainedDeps);
    expect(await panel.runPlannedSavedRecordErasure(plan, () => true)).toBe('erased');
    expect(api.eraseSavedRecords).toHaveBeenCalledWith(expect.anything(), expect.any(Function), retainedDeps);

    // A device that never had the feature on keeps exactly today's behaviour:
    // nothing is imported and the plan skips.
    present.mockResolvedValueOnce([{ name: 'some-other-database' }]);
    expect(await panel.planSavedRecordErasure('device')).toEqual({ status: 'none' });
  });

  it('uses the real loader: flag off is disabled, flag on with a failed import is unavailable', async () => {
    vi.stubEnv('PUBLIC_SAVED_RECORDS_ENABLED', '');
    vi.stubGlobal('indexedDB', { databases: async () => [] });
    vi.doMock('../lib/profile/saved-record-access', () => { throw new Error('chunk load failed'); });
    vi.resetModules();
    const off = await import('./AccountSyncV2Panel');
    expect(await off.planSavedRecordErasure('device')).toEqual({ status: 'none' });
    vi.stubEnv('PUBLIC_SAVED_RECORDS_ENABLED', '1');
    vi.resetModules();
    const on = await import('./AccountSyncV2Panel');
    expect(await on.planSavedRecordErasure('device')).toEqual({ status: 'blocked', message: on.RECORDS_BLOCKED_MESSAGE });
    expect(await on.planSavedRecordErasure({ accountId: '11111111-1111-4111-8111-111111111111' }))
      .toEqual({ status: 'blocked', message: on.RECORDS_BLOCKED_MESSAGE });
  });

  it('carries an observed absence into the transition and refuses when it no longer holds', async () => {
    const api = {
      prepareSavedRecordErasure: vi.fn(async () => ({ status: 'absent' as const })),
      confirmSavedRecordsAbsent: vi.fn(async () => ({ ok: false as const, code: 'stale' as const, mayHaveCommitted: false })),
      eraseSavedRecords: vi.fn(),
    };
    const load = async (): Promise<SavedRecordAccessLoad> => ({ status: 'ready', api: api as never });
    const plan = await planSavedRecordErasure('device', load);
    expect(plan).toMatchObject({ status: 'absent', target: 'device' });
    const authorized = () => true;
    expect(await runPlannedSavedRecordErasure(plan, authorized)).toBe('failed');
    expect(api.confirmSavedRecordsAbsent).toHaveBeenCalledWith('device', authorized, undefined);
    api.confirmSavedRecordsAbsent.mockResolvedValueOnce({ ok: true, value: 'absent' } as never);
    expect(await runPlannedSavedRecordErasure(plan, authorized)).toBe('skipped');
    expect(api.eraseSavedRecords).not.toHaveBeenCalled();
    // Every destructive handler stops on a failed records outcome before touching legacy stores.
    const source = await readFile(new URL('./AccountSyncV2Panel.tsx', import.meta.url), 'utf8');
    for (const handler of ['onBoundaryDecision', 'onSignOut', 'completeConfirmedDeletionOnDevice']) {
      const start = source.indexOf(`async function ${handler}(`);
      const next = source.indexOf('\n  async function ', start + 1);
      const body = source.slice(start, next === -1 ? undefined : next);
      expect(body, handler).toContain('runPlannedSavedRecordErasure(plan, () => authEpoch.current === epoch)');
      expect(body, handler).toMatch(/=== 'failed'\) return/u);
      expect(body, handler).toContain("plan.status === 'blocked'");
    }
  });
});
