import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import { POSITION_BODY_ORDER } from '../share-positions';
import {
  ACCOUNT_CHART_BODY_ORDER,
  AccountChartSourceFailure,
  accountChartBodies,
  decryptAccountChartSource,
  loadChartEmailSources,
  loadOwnerSelfChartSource,
} from './chart-sources.js';
import { encryptAccountPrivatePayload } from './encryption.js';
import { serializeAccountPrivateChartPayload } from './sync-wire.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '55555555-5555-4555-8555-555555555555';
const CHART_ID = '22222222-2222-4222-8222-222222222222';
const KEY = Buffer.alloc(32, 0x42).toString('base64');
const ENV = {
  ACCOUNT_SYNC_V2_ENCRYPTION_KEYS: JSON.stringify({ 4: KEY }),
  ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION: '4',
};
const CONNECTION = {
  supabaseUrl: 'https://project-ref.supabase.co',
  serviceKey: 'sb_secret_test_service_role_value',
};

const payload = {
  label: 'Private label',
  birth: {
    date: '1990-01-01',
    time: '08:45',
    timeKnown: true,
    place: {
      name: 'Bangkok', admin1: 'Bangkok', country: 'Thailand',
      lat: 13.7563, lon: 100.5018, tz: 'Asia/Bangkok',
    },
  },
  derived: {
    positions: {
      b: [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345],
      a: [100, 190] as [number, number],
      h: 'w' as const,
      v: '3.2.1',
    },
    timeKnown: true,
    sunSign: 'aries' as const,
    engineVersion: '3.2.1',
    houseSystem: 'whole' as const,
  },
};

/** Postgres encode(..., 'base64') wraps every 76 characters. */
function postgresBase64(value: Buffer): string {
  return value.toString('base64').replace(/(.{76})/gu, '$1\n');
}

function sourceRow(userId = USER_ID, revision = 3) {
  const envelope = encryptAccountPrivatePayload(
    serializeAccountPrivateChartPayload(payload),
    { userId, chartId: CHART_ID, revision },
    ENV,
  );
  return {
    user_id: userId,
    chart_id: CHART_ID,
    revision,
    ciphertext: postgresBase64(envelope.ciphertext),
    nonce: envelope.nonce.toString('base64'),
    format: 'opaque_v1',
    key_scope: 'service',
    key_version: 4,
    wrapped_key: postgresBase64(envelope.wrappedKey),
  };
}

function fetcherReturning(body: unknown) {
  return vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(
    JSON.stringify(body),
    { status: 200, headers: { 'content-type': 'application/json' } },
  ));
}

describe('account chart sources', () => {
  it('keeps the stored body order identical to the shared positions codec', () => {
    expect([...ACCOUNT_CHART_BODY_ORDER]).toEqual([...POSITION_BODY_ORDER]);
  });

  it('loads opted-in sources by id only and decrypts them in memory', async () => {
    const fetcher = fetcherReturning([sourceRow()]);
    const sources = await loadChartEmailSources([USER_ID, OTHER_USER_ID], { ...CONNECTION, fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [input, init] = fetcher.mock.calls[0]!;
    expect(String(input)).toBe('https://project-ref.supabase.co/rest/v1/rpc/account_v2_chart_email_sources');
    expect(JSON.parse(String(init?.body))).toEqual({ candidate_user_ids: [USER_ID, OTHER_USER_ID] });
    expect([...sources.keys()]).toEqual([USER_ID]);

    const decrypted = decryptAccountChartSource(sources.get(USER_ID)!, ENV);
    expect(decrypted).toEqual(payload);
    expect(accountChartBodies(decrypted!)[0]).toEqual({ body: 'Sun', lon: 15 });
    expect(accountChartBodies(decrypted!)).toHaveLength(12);
  });

  it('returns null rather than a detail when decryption fails', async () => {
    const sources = await loadChartEmailSources([USER_ID], {
      ...CONNECTION,
      fetcher: fetcherReturning([sourceRow()]),
    });
    const source = sources.get(USER_ID)!;
    expect(decryptAccountChartSource(source, {})).toBeNull();
    expect(decryptAccountChartSource(source, {
      ACCOUNT_SYNC_V2_ENCRYPTION_KEYS: JSON.stringify({ 4: Buffer.alloc(32, 0x24).toString('base64') }),
      ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION: '4',
    })).toBeNull();
    expect(decryptAccountChartSource({ ...source, revision: source.revision + 1 }, ENV)).toBeNull();
    expect(decryptAccountChartSource({ ...source, userId: OTHER_USER_ID }, ENV)).toBeNull();
  });

  it('fails closed on rows for accounts that were not asked for, duplicates, or bad envelopes', async () => {
    await expect(loadChartEmailSources([USER_ID], {
      ...CONNECTION,
      fetcher: fetcherReturning([sourceRow(OTHER_USER_ID)]),
    })).rejects.toBeInstanceOf(AccountChartSourceFailure);
    await expect(loadChartEmailSources([USER_ID, OTHER_USER_ID], {
      ...CONNECTION,
      fetcher: fetcherReturning([sourceRow(), sourceRow()]),
    })).rejects.toBeInstanceOf(AccountChartSourceFailure);
    await expect(loadChartEmailSources([USER_ID], {
      ...CONNECTION,
      fetcher: fetcherReturning([{ ...sourceRow(), key_scope: 'client' }]),
    })).rejects.toBeInstanceOf(AccountChartSourceFailure);
    await expect(loadChartEmailSources(['not-a-uuid'], CONNECTION))
      .rejects.toBeInstanceOf(AccountChartSourceFailure);
  });

  it('batches at the database bound and skips the call for an empty list', async () => {
    const fetcher = fetcherReturning([]);
    const ids = Array.from({ length: 501 }, (_, index) => (
      `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    ));
    await loadChartEmailSources(ids, { ...CONNECTION, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body)).candidate_user_ids).toHaveLength(500);
    const none = fetcherReturning([]);
    expect((await loadChartEmailSources([], { ...CONNECTION, fetcher: none })).size).toBe(0);
    expect(none).not.toHaveBeenCalled();
  });

  it('reads the owner self chart for invitations and treats not_found as none', async () => {
    const row = sourceRow();
    const ready = await loadOwnerSelfChartSource(USER_ID, {
      ...CONNECTION,
      fetcher: fetcherReturning({
        outcome: 'ready',
        chart_id: CHART_ID,
        revision: 3,
        encrypted_source: {
          ciphertext: row.ciphertext,
          nonce: row.nonce,
          format: 'opaque_v1',
          key_scope: 'service',
          key_version: 4,
          wrapped_key: row.wrapped_key,
        },
      }),
    });
    expect(decryptAccountChartSource(ready!, ENV)?.label).toBe('Private label');
    expect(await loadOwnerSelfChartSource(USER_ID, {
      ...CONNECTION,
      fetcher: fetcherReturning({ outcome: 'not_found' }),
    })).toBeNull();
  });
});
