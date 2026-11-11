import { describe, expect, it, vi } from 'vitest';
import type { SavedChart } from '../profile/schema';
import {
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

  const OPTED_IN = new Set([preference.user_id]);

  it('sends the chart edition only to an opted-in account and reads only its own chart', async () => {
    const loadChart = vi.fn(async (userId: string) => (userId === preference.user_id ? chart : null));
    const result = await selectChartRecipients({
      preferences: [preference],
      optedIn: OPTED_IN,
      loadChart,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T11:13:00Z'),
      getAuthEmail: vi.fn().mockResolvedValue(' Person@Example.com '),
      recipientHashForEmail: (email) => dailyRecipientHash(email, HASH_SECRET),
    });
    expect(loadChart).toHaveBeenCalledTimes(1);
    expect(loadChart).toHaveBeenCalledWith(preference.user_id);
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0]).toMatchObject({
      tier: 'chart', email: 'person@example.com', chartId: chart.id,
      userId: preference.user_id, timezone: 'America/New_York',
    });
    expect(result.suppressSunEmails).toEqual(new Set(['person@example.com']));
    expect(result.suppressSunRecipientHashes).toEqual(new Set([preference.recipient_hash]));
  });

  it('leaves an account without chart emails to the Sun tier and never decrypts it', async () => {
    const loadChart = vi.fn();
    const getAuthEmail = vi.fn();
    const result = await selectChartRecipients({
      preferences: [preference],
      optedIn: new Set(),
      loadChart,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T11:13:00Z'),
      getAuthEmail,
      recipientHashForEmail: (email) => dailyRecipientHash(email, HASH_SECRET),
    });
    expect(result.recipients).toEqual([]);
    expect(result.notOptedIn).toBe(1);
    expect(result.suppressSunRecipientHashes).toEqual(new Set());
    expect(loadChart).not.toHaveBeenCalled();
    expect(getAuthEmail).not.toHaveBeenCalled();
  });

  it('suppresses the Sun tier for an opted-in account even before its chart timezone is due', async () => {
    const getAuthEmail = vi.fn().mockResolvedValue('same@example.com');
    const result = await selectChartRecipients({
      preferences: [{
        ...preference,
        recipient_hash: dailyRecipientHash('same@example.com', HASH_SECRET),
      }],
      optedIn: OPTED_IN,
      loadChart: vi.fn().mockResolvedValue(chart),
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
      getAuthEmail,
      recipientHashForEmail: (email) => dailyRecipientHash(email, HASH_SECRET),
    });
    expect(result.recipients).toEqual([]);
    expect(getAuthEmail).not.toHaveBeenCalled();
    expect(result.suppressSunEmails).toEqual(new Set());
    expect(result.suppressSunRecipientHashes).toEqual(new Set([
      dailyRecipientHash('same@example.com', HASH_SECRET),
    ]));
    const merged = mergeDailyEmailRecipients({
      chart: [],
      sun: [{
        tier: 'sun_sign', email: 'same@example.com', sign: 'aries',
        contactId: 'contact_same_1', timezone: 'UTC',
      }],
      suppressSunEmails: result.suppressSunEmails,
      suppressSunRecipientHashes: result.suppressSunRecipientHashes,
      recipientHashForEmail: (email) => dailyRecipientHash(email, HASH_SECRET),
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
    });
    expect(merged).toEqual([]);
  });

  it('falls back to the Sun tier when an opted-in chart cannot be decrypted', async () => {
    const result = await selectChartRecipients({
      preferences: [preference],
      optedIn: OPTED_IN,
      loadChart: vi.fn().mockRejectedValue(new Error('no key')),
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
      getAuthEmail: vi.fn(),
      recipientHashForEmail: (email) => dailyRecipientHash(email, HASH_SECRET),
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
      recipientHashForEmail: (email) => dailyRecipientHash(email, HASH_SECRET),
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
    })).toEqual([sun]);
  });

  it('treats a paused or retired v1 preference as paused and lets the Sun tier resume', async () => {
    const getAuthEmail = vi.fn();
    const loadChart = vi.fn();
    const result = await selectChartRecipients({
      preferences: [{ ...preference, chart_id: null }],
      optedIn: OPTED_IN,
      loadChart,
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
      getAuthEmail,
      recipientHashForEmail: (email) => dailyRecipientHash(email, HASH_SECRET),
    });
    expect(result.recipients).toEqual([]);
    expect(result.suppressSunRecipientHashes).toEqual(new Set());
    expect(getAuthEmail).not.toHaveBeenCalled();
    expect(loadChart).not.toHaveBeenCalled();

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
      recipientHashForEmail: (email) => dailyRecipientHash(email, HASH_SECRET),
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
    })).toEqual([sun]);
  });

  it('keeps provider routing identity out of the chart tier', () => {
    const chartRecipient = {
      tier: 'chart' as const,
      email: 'same@example.com',
      userId: preference.user_id,
      chartId: chart.id,
      chart,
      timezone: 'UTC',
    };
    const merged = mergeDailyEmailRecipients({
      chart: [chartRecipient],
      sun: [{
        tier: 'sun_sign', email: 'same@example.com', sign: 'aries',
        contactId: 'contact_same_1', timezone: 'UTC',
      }],
      suppressSunEmails: new Set(['same@example.com']),
      suppressSunRecipientHashes: new Set(),
      recipientHashForEmail: (email) => dailyRecipientHash(email, HASH_SECRET),
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T07:13:00Z'),
    });
    expect(merged).toEqual([chartRecipient]);
  });

  it('holds a malformed decrypted chart without substitution', async () => {
    const result = await selectChartRecipients({
      preferences: [preference],
      optedIn: OPTED_IN,
      loadChart: vi.fn().mockResolvedValue({ ...chart, summary: { ...chart.summary, bodies: [] } }),
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T11:13:00Z'),
      getAuthEmail: vi.fn().mockResolvedValue('person@example.com'),
      recipientHashForEmail: (email) => dailyRecipientHash(email, HASH_SECRET),
    });
    expect(result.recipients).toEqual([]);
    expect(result.invalidCharts).toEqual([{ userId: preference.user_id, chartId: chart.id }]);
    expect(isDailyEmailSavedChart({ ...chart, summary: { ...chart.summary, bodies: [] } })).toBe(false);
  });

  it('holds a stale auth identity while its opaque hash still suppresses the old Sun tier', async () => {
    const result = await selectChartRecipients({
      preferences: [preference],
      optedIn: OPTED_IN,
      loadChart: vi.fn().mockResolvedValue(chart),
      editionDate: '2026-07-20',
      at: new Date('2026-07-20T11:13:00Z'),
      getAuthEmail: vi.fn().mockResolvedValue('changed@example.com'),
      recipientHashForEmail: (email) => dailyRecipientHash(email, HASH_SECRET),
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
      recipientHashForEmail: (email) => dailyRecipientHash(email, HASH_SECRET),
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
