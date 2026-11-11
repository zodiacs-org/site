import { describe, expect, it, vi } from 'vitest';
import type { SavedChart } from '../profile/schema';
import {
  dailySunFallbacks,
  filterDailyEmailCohort,
  isDailyEmailSavedChart,
  mergeDailyEmailRecipients,
  parseTestAllowlist,
  selectChartRecipients,
  type ChartPreferenceRow,
} from './recipients';
import { dailyRecipientHash } from './identity';

const HASH_SECRET = 'recipient-hash-secret-that-is-long-enough';

const chart = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Selected chart',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  birth: { date: '1990-01-01', time: '12:00', timeKnown: true, place: null },
  summary: {
    engineVersion: 'fixture', utcISO: '1990-01-01T12:00:00.000Z', houseSystem: 'whole',
    bodies: [{ body: 'Sun', lon: 10, retrograde: false }], angles: null, flags: [],
  },
} satisfies SavedChart;

const preference: ChartPreferenceRow = {
  user_id: '10000000-0000-4000-8000-000000000002',
  chart_id: chart.id,
  recipient_hash: dailyRecipientHash('person@example.com', HASH_SECRET),
  timezone: 'America/New_York',
  confirmed_at: '2026-07-01T00:00:00.000Z',
};

describe('daily email recipient selection', () => {
  it('validates every required birth field before a synced chart can render', () => {
    const place = {
      name: 'Bangkok', admin1: 'Bangkok', country: 'Thailand',
      lat: 13.7563, lon: 100.5018, tz: 'Asia/Bangkok',
    };
    expect(isDailyEmailSavedChart({ ...chart, birth: { ...chart.birth, place } })).toBe(true);
    expect(isDailyEmailSavedChart({
      ...chart, birth: { date: '1990-02-30', time: '12:00', timeKnown: true, place: null },
    })).toBe(false);
    expect(isDailyEmailSavedChart({
      ...chart, birth: { date: '1990-01-01', time: null, timeKnown: true, place: null },
    })).toBe(false);
    expect(isDailyEmailSavedChart({
      ...chart, birth: { date: '1990-01-01', time: '12:00', timeKnown: false, place: null },
    })).toBe(false);
    expect(isDailyEmailSavedChart({
      ...chart, birth: { date: '1990-01-01', time: '24:00', timeKnown: true, place: null },
    })).toBe(false);
    for (const invalidPlace of [
      { ...place, name: '' },
      { ...place, admin1: undefined },
      { ...place, country: '' },
      { ...place, lat: 91 },
      { ...place, lon: 181 },
      { ...place, tz: 'Not/A_Timezone' },
    ]) {
      expect(isDailyEmailSavedChart({
        ...chart, birth: { ...chart.birth, place: invalidPlace },
      })).toBe(false);
    }
  });

  /** The account's current eligible self chart, as account_v2_chart_email_sources returns it. */
  const SOURCE = { chartId: chart.id, revision: 3 };
  const hashFor = (email: string) => dailyRecipientHash(email, HASH_SECRET);

  it('sends the chart edition only to an eligible account and decrypts only its own chart', async () => {
    const loadSource = vi.fn(async (userId: string) => (userId === preference.user_id ? SOURCE : null));
    const decrypt = vi.fn(async () => chart);
    const result = await selectChartRecipients({
      preferences: [preference],
      loadSource,
      decrypt,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T11:13:00Z'),
      getAuthEmail: vi.fn().mockResolvedValue(' Person@Example.com '),
      recipientHashForEmail: hashFor,
    });
    expect(loadSource).toHaveBeenCalledTimes(1);
    expect(loadSource).toHaveBeenCalledWith(preference.user_id);
    expect(decrypt).toHaveBeenCalledWith(SOURCE);
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0]).toMatchObject({
      tier: 'chart', email: 'person@example.com', chartId: chart.id, revision: 3,
      userId: preference.user_id, timezone: 'America/New_York',
    });
    expect(result.suppressSunEmails).toEqual(new Set(['person@example.com']));
    expect(result.suppressSunRecipientHashes).toEqual(new Set([preference.recipient_hash]));
  });

  it('asks for eligibility immediately before each decryption, not from an earlier list', async () => {
    // Two accounts: the second withdraws chart emails while the first is
    // being decrypted. Its eligibility is read after that, so it is never
    // decrypted and its Sun edition is not held back.
    const second: ChartPreferenceRow = {
      ...preference,
      user_id: '10000000-0000-4000-8000-000000000009',
      recipient_hash: hashFor('second@example.com'),
    };
    const eligible = new Set([preference.user_id, second.user_id]);
    const order: string[] = [];
    const loadSource = vi.fn(async (userId: string) => {
      order.push(`eligibility:${userId}`);
      return eligible.has(userId) ? SOURCE : null;
    });
    const decrypt = vi.fn(async () => {
      order.push('decrypt');
      eligible.delete(second.user_id);
      return chart;
    });
    const result = await selectChartRecipients({
      preferences: [second, preference],
      loadSource,
      decrypt,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T11:13:00Z'),
      getAuthEmail: vi.fn().mockResolvedValue('person@example.com'),
      recipientHashForEmail: hashFor,
    });
    expect(order).toEqual([
      `eligibility:${preference.user_id}`,
      'decrypt',
      `eligibility:${second.user_id}`,
    ]);
    expect(decrypt).toHaveBeenCalledTimes(1);
    expect(result.recipients.map((recipient) => recipient.userId)).toEqual([preference.user_id]);
    expect(result.notOptedIn).toBe(1);
    expect(result.suppressSunRecipientHashes.has(second.recipient_hash)).toBe(false);
  });

  it('pauses a preference that names a removed chart A after chart B was synced', async () => {
    // Chart A was deleted and chart B synced; the preference still names A.
    // The account is eligible, but its self chart is B: nothing is
    // decrypted, no chart edition is sent, and the Sun tier is not held back.
    const chartB = { chartId: '10000000-0000-4000-8000-0000000000bb', revision: 1 };
    const decrypt = vi.fn();
    const getAuthEmail = vi.fn();
    const result = await selectChartRecipients({
      preferences: [preference],
      loadSource: vi.fn().mockResolvedValue(chartB),
      decrypt,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T11:13:00Z'),
      getAuthEmail,
      recipientHashForEmail: hashFor,
    });
    expect(result.recipients).toEqual([]);
    expect(result.pausedCharts).toBe(1);
    expect(result.suppressSunRecipientHashes).toEqual(new Set());
    expect(result.suppressSunEmails).toEqual(new Set());
    expect(decrypt).not.toHaveBeenCalled();
    expect(getAuthEmail).not.toHaveBeenCalled();
    const sun = {
      tier: 'sun_sign' as const, email: 'person@example.com', sign: 'aries',
      contactId: 'contact_person_1', timezone: 'UTC' as const,
    };
    expect(mergeDailyEmailRecipients({
      chart: result.recipients,
      sun: [sun],
      suppressSunEmails: result.suppressSunEmails,
      suppressSunRecipientHashes: result.suppressSunRecipientHashes,
      recipientHashForEmail: hashFor,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T11:13:00Z'),
    })).toEqual([sun]);
  });

  it('leaves an account without chart emails to the Sun tier and never decrypts it', async () => {
    const decrypt = vi.fn();
    const getAuthEmail = vi.fn();
    const result = await selectChartRecipients({
      preferences: [preference],
      loadSource: vi.fn().mockResolvedValue(null),
      decrypt,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T11:13:00Z'),
      getAuthEmail,
      recipientHashForEmail: hashFor,
    });
    expect(result.recipients).toEqual([]);
    expect(result.notOptedIn).toBe(1);
    expect(result.suppressSunRecipientHashes).toEqual(new Set());
    expect(decrypt).not.toHaveBeenCalled();
    expect(getAuthEmail).not.toHaveBeenCalled();
  });

  it('falls back to the Sun tier when eligibility cannot be read', async () => {
    const decrypt = vi.fn();
    const result = await selectChartRecipients({
      preferences: [preference],
      loadSource: vi.fn().mockRejectedValue(new Error('offline')),
      decrypt,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T11:13:00Z'),
      getAuthEmail: vi.fn(),
      recipientHashForEmail: hashFor,
    });
    expect(result.recipients).toEqual([]);
    expect(result.unavailable).toBe(1);
    expect(result.suppressSunRecipientHashes).toEqual(new Set());
    expect(decrypt).not.toHaveBeenCalled();
  });

  it('suppresses the Sun tier for an eligible account even before its chart timezone is due', async () => {
    const getAuthEmail = vi.fn().mockResolvedValue('same@example.com');
    const result = await selectChartRecipients({
      preferences: [{
        ...preference,
        recipient_hash: hashFor('same@example.com'),
      }],
      loadSource: vi.fn().mockResolvedValue(SOURCE),
      decrypt: vi.fn().mockResolvedValue(chart),
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
      getAuthEmail,
      recipientHashForEmail: hashFor,
    });
    expect(result.recipients).toEqual([]);
    expect(getAuthEmail).not.toHaveBeenCalled();
    expect(result.suppressSunEmails).toEqual(new Set());
    expect(result.suppressSunRecipientHashes).toEqual(new Set([hashFor('same@example.com')]));
    const merged = mergeDailyEmailRecipients({
      chart: [],
      sun: [{
        tier: 'sun_sign', email: 'same@example.com', sign: 'aries',
        contactId: 'contact_same_1', timezone: 'UTC',
      }],
      suppressSunEmails: result.suppressSunEmails,
      suppressSunRecipientHashes: result.suppressSunRecipientHashes,
      recipientHashForEmail: hashFor,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
    });
    expect(merged).toEqual([]);
  });

  it('reads nothing for an account when neither edition is due in this run', async () => {
    const loadSource = vi.fn();
    const result = await selectChartRecipients({
      preferences: [preference],
      loadSource,
      decrypt: vi.fn(),
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T03:13:00Z'),
      getAuthEmail: vi.fn(),
      recipientHashForEmail: hashFor,
    });
    expect(result.recipients).toEqual([]);
    expect(loadSource).not.toHaveBeenCalled();
  });

  it('falls back to the Sun tier when an eligible chart cannot be decrypted', async () => {
    const result = await selectChartRecipients({
      preferences: [preference],
      loadSource: vi.fn().mockResolvedValue(SOURCE),
      decrypt: vi.fn().mockRejectedValue(new Error('no key')),
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
      getAuthEmail: vi.fn(),
      recipientHashForEmail: hashFor,
    });
    expect(result.recipients).toEqual([]);
    expect(result.invalidCharts).toEqual([{ userId: preference.user_id, chartId: chart.id }]);
    expect(result.suppressSunRecipientHashes).toEqual(new Set());
    const sun = {
      tier: 'sun_sign' as const, email: 'person@example.com', sign: 'aries',
      contactId: 'contact_person_1', timezone: 'UTC' as const,
    };
    expect(mergeDailyEmailRecipients({
      chart: [],
      sun: [sun],
      suppressSunEmails: result.suppressSunEmails,
      suppressSunRecipientHashes: result.suppressSunRecipientHashes,
      recipientHashForEmail: hashFor,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
    })).toEqual([sun]);
  });

  it('treats a paused or retired v1 preference as paused and lets the Sun tier resume', async () => {
    const getAuthEmail = vi.fn();
    const loadSource = vi.fn();
    const decrypt = vi.fn();
    const result = await selectChartRecipients({
      preferences: [{ ...preference, chart_id: null }],
      loadSource,
      decrypt,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
      getAuthEmail,
      recipientHashForEmail: hashFor,
    });
    expect(result.recipients).toEqual([]);
    expect(result.suppressSunRecipientHashes).toEqual(new Set());
    expect(getAuthEmail).not.toHaveBeenCalled();
    expect(loadSource).not.toHaveBeenCalled();
    expect(decrypt).not.toHaveBeenCalled();

    const sun = {
      tier: 'sun_sign' as const,
      email: 'person@example.com',
      sign: 'aries',
      contactId: 'contact_person_1',
      timezone: 'UTC' as const,
    };
    expect(mergeDailyEmailRecipients({
      chart: [],
      sun: [sun],
      suppressSunEmails: result.suppressSunEmails,
      suppressSunRecipientHashes: result.suppressSunRecipientHashes,
      recipientHashForEmail: hashFor,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
    })).toEqual([sun]);
  });

  it('keeps provider routing identity out of the chart tier and remembers the held Sun edition', () => {
    const chartRecipient = {
      tier: 'chart' as const,
      email: 'same@example.com',
      userId: preference.user_id,
      chartId: chart.id,
      revision: 3,
      chart,
      timezone: 'UTC',
    };
    const sun = {
      tier: 'sun_sign' as const, email: 'same@example.com', sign: 'aries',
      contactId: 'contact_same_1', timezone: 'UTC' as const,
    };
    const other = { ...sun, email: 'other@example.com', contactId: 'contact_other_1' };
    const merged = mergeDailyEmailRecipients({
      chart: [chartRecipient],
      sun: [sun, other],
      suppressSunEmails: new Set(['same@example.com']),
      suppressSunRecipientHashes: new Set(),
      recipientHashForEmail: hashFor,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
    });
    expect(merged).toEqual([other, chartRecipient]);
    const fallbacks = dailySunFallbacks({
      chart: [chartRecipient],
      sun: [sun, other],
      recipientHashForEmail: hashFor,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
    });
    expect([...fallbacks.entries()]).toEqual([[hashFor('same@example.com'), sun]]);
    // Before the Sun edition is due there is nothing to fall back to.
    expect(dailySunFallbacks({
      chart: [chartRecipient],
      sun: [sun],
      recipientHashForEmail: hashFor,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T03:13:00Z'),
    }).size).toBe(0);
  });

  it('holds a malformed decrypted chart without substitution', async () => {
    const result = await selectChartRecipients({
      preferences: [preference],
      loadSource: vi.fn().mockResolvedValue(SOURCE),
      decrypt: vi.fn().mockResolvedValue({ ...chart, summary: { ...chart.summary, bodies: [] } }),
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T11:13:00Z'),
      getAuthEmail: vi.fn().mockResolvedValue('person@example.com'),
      recipientHashForEmail: hashFor,
    });
    expect(result.recipients).toEqual([]);
    expect(result.invalidCharts).toEqual([{ userId: preference.user_id, chartId: chart.id }]);
    expect(isDailyEmailSavedChart({ ...chart, summary: { ...chart.summary, bodies: [] } })).toBe(false);
  });

  it('holds a stale auth identity while its opaque hash still suppresses the old Sun tier', async () => {
    const result = await selectChartRecipients({
      preferences: [preference],
      loadSource: vi.fn().mockResolvedValue(SOURCE),
      decrypt: vi.fn().mockResolvedValue(chart),
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T11:13:00Z'),
      getAuthEmail: vi.fn().mockResolvedValue('changed@example.com'),
      recipientHashForEmail: hashFor,
    });
    expect(result.recipients).toEqual([]);
    expect(result.invalidIdentities).toEqual([preference.user_id]);
    const merged = mergeDailyEmailRecipients({
      chart: [],
      sun: [{
        tier: 'sun_sign', email: 'person@example.com', sign: 'aries',
        contactId: 'contact_person_1', timezone: 'UTC',
      }],
      suppressSunEmails: result.suppressSunEmails,
      suppressSunRecipientHashes: result.suppressSunRecipientHashes,
      recipientHashForEmail: hashFor,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
    });
    expect(merged).toEqual([]);
  });

  it('applies test/all cohort gates and an exact subscribed-address filter', () => {
    const recipients = [{
      tier: 'sun_sign' as const, email: 'one@example.com', sign: 'aries',
      contactId: 'contact_one_1', timezone: 'UTC' as const,
    }, {
      tier: 'sun_sign' as const, email: 'two@example.com', sign: 'taurus',
      contactId: 'contact_two_1', timezone: 'UTC' as const,
    }];
    const allowlist = parseTestAllowlist('["one@example.com"]');
    expect(filterDailyEmailCohort(recipients, 'test', allowlist)).toEqual([recipients[0]]);
    expect(filterDailyEmailCohort(recipients, 'all', new Set(), 'two@example.com'))
      .toEqual([recipients[1]]);
    expect(() => filterDailyEmailCohort(recipients, 'test', new Set())).toThrow(/allowlist/iu);
  });
});
