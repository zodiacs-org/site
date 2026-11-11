import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  assertDailyEmailSendInterlocks,
  dailyRecipientUnsubscribeClaim,
  canaryRecipient,
  createChartDispatchCheck,
  loadCurrentChartEmailSource,
  parseDailyEmailArgs,
  recipientHashPrefix,
  requireResendCapabilities,
  resolveChartRecipients,
  runDailyEmail,
  selectDailyEmailNearbyEvents,
} from './send-daily-email';
import dailyData from '../src/data/daily.json';
import publicationData from '../src/data/daily-publication.json';
import programData from '../src/data/horoscope-program.json';
import { houseLine, wholeSignHouseFromAsc, type Daily } from '../src/lib/daily';
import { renderDailyEmail } from '../src/lib/daily-email/content';
import {
  createResendDelivery,
  deliverDailyEmails,
  type DeliveryReceiptStore,
} from '../src/lib/daily-email/delivery';
import { dailyRecipientHash } from '../src/lib/daily-email/identity';
import { createRateLimitedResendRequest } from '../src/lib/daily-email/resend-request';
import type { ChartRecipient, DailyEmailRecipient, SunSignRecipient } from '../src/lib/daily-email/types';
import type { DailyPublication } from '../src/lib/daily-publication';
import legacyPolar from '../src/lib/engine/fixtures/legacy-polar-saved.json';
import * as engine from '../src/lib/engine/full';
import { ENGINE_VERSION } from '../src/lib/engine/types';
import { futurePublishedEvents } from '../src/lib/events/site-publication';
import type { HoroscopeProgram } from '../src/lib/horoscope-program';
import type { SavedChart } from '../src/lib/profile/schema';
import { signForLongitude } from '../src/lib/signs';

describe('daily email CLI', () => {
  it('parses every bounded operator mode and rejects ambiguous instants', () => {
    expect(parseDailyEmailArgs([
      '--fixture', '--dry-run', '--at', '2026-07-20T07:13:00+00:00',
      '--limit', '12', '--to', ' Test@Example.com ',
    ])).toMatchObject({
      fixture: true, dryRun: true, limit: 12, to: 'test@example.com',
      at: new Date('2026-07-20T07:13:00Z'),
    });
    expect(() => parseDailyEmailArgs(['--at', '2026-07-20'])).toThrow(/ISO instant/u);
    // The canary forces limit one and refuses a command-line recipient.
    expect(parseDailyEmailArgs(['--canary', '--dry-run', '--limit', '50'])).toMatchObject({
      canary: true, dryRun: true, limit: 1, to: null,
    });
    expect(() => parseDailyEmailArgs(['--canary', '--to', 'someone@example.com']))
      .toThrow(/DAILY_EMAIL_CANARY_TO/u);
    expect(canaryRecipient('  Owner@Example.com ', 'DAILY_EMAIL_CANARY_TO')).toBe('owner@example.com');
    expect(() => canaryRecipient('', 'DAILY_EMAIL_CANARY_TO')).toThrow(/DAILY_EMAIL_CANARY_TO/u);
    expect(recipientHashPrefix('Owner@Example.com')).toBe(recipientHashPrefix('owner@example.com'));
    expect(recipientHashPrefix('owner@example.com')).toMatch(/^[0-9a-f]{12}$/u);
    expect(() => parseDailyEmailArgs(['--limit', '0'])).toThrow(/1 to 10000/u);
    expect(() => parseDailyEmailArgs(['--unknown'])).toThrow(/Unknown option/u);
  });

  it('runs the always-safe fixture smoke with no network or credentials', async () => {
    const fetcher = vi.fn();
    const report = await runDailyEmail({
      options: parseDailyEmailArgs(['--fixture', '--dry-run', '--limit', '2']),
      env: {},
      fetchImpl: fetcher as unknown as typeof fetch,
      log: vi.fn(),
    });
    expect(report).toEqual({
      considered: 2, reserved: 0, sent: 0, failed: 0, duplicate: 0, dryRun: 2, fellBack: 0, withdrawn: 0,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps the first future event for Sun mail but skips ambiguous aspects for chart mail', () => {
    const selection = selectDailyEmailNearbyEvents(futurePublishedEvents(
      '2026-07-21',
      { days: 9, limit: Number.MAX_SAFE_INTEGER },
    ));
    expect(selection.sunSign?.id).toBe('neptune-sextile-pluto-2026-07-24');
    expect(selection.sunSign?.signs).toEqual(['aries', 'aquarius']);
    expect(selection.chart?.id).toBe('full-moon-2026-07-29');
    expect(selection.chart?.signs).toEqual(['aquarius']);
  });

  it('fails closed before network when real delivery is not enabled', async () => {
    const fetcher = vi.fn();
    await expect(runDailyEmail({
      options: parseDailyEmailArgs([]),
      env: { DAILY_EMAIL_RECIPIENT_HASH_SECRET: 'recipient-hash-secret-that-is-long-enough' },
      fetchImpl: fetcher as unknown as typeof fetch,
      log: vi.fn(),
    })).rejects.toThrow(/disabled/u);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requires an independent explicit approval only for real all-recipient sends', () => {
    expect(assertDailyEmailSendInterlocks({
      DAILY_EMAIL_ENABLED: '1',
      DAILY_EMAIL_COHORT: 'test',
    })).toBe('test');
    expect(() => assertDailyEmailSendInterlocks({
      DAILY_EMAIL_ENABLED: '1',
      DAILY_EMAIL_COHORT: 'all',
    })).toThrow(/DAILY_EMAIL_ALL_APPROVED/u);
    expect(() => assertDailyEmailSendInterlocks({
      DAILY_EMAIL_ENABLED: '1',
      DAILY_EMAIL_COHORT: 'all',
      DAILY_EMAIL_ALL_APPROVED: 'true',
    })).toThrow(/must equal 1/u);
    expect(assertDailyEmailSendInterlocks({
      DAILY_EMAIL_ENABLED: '1',
      DAILY_EMAIL_COHORT: 'all',
      DAILY_EMAIL_ALL_APPROVED: '1',
    })).toBe('all');
  });

  it('requires distinct sending and contacts capabilities', () => {
    expect(requireResendCapabilities({
      RESEND_API_KEY: 're_sending_test',
      RESEND_CONTACTS_API_KEY: 're_contacts_test',
    })).toEqual({ sendingKey: 're_sending_test', contactsKey: 're_contacts_test' });
    expect(() => requireResendCapabilities({ RESEND_API_KEY: 're_sending_test' }))
      .toThrow(/RESEND_CONTACTS_API_KEY is required/u);
    expect(() => requireResendCapabilities({
      RESEND_API_KEY: 're_same',
      RESEND_CONTACTS_API_KEY: 're_same',
    })).toThrow(/must be distinct capability keys/u);
  });

  it('never permits a fake fixture identity to become a real delivery', async () => {
    await expect(runDailyEmail({
      options: parseDailyEmailArgs(['--fixture']),
      env: {},
      fetchImpl: vi.fn() as unknown as typeof fetch,
      log: vi.fn(),
    })).rejects.toThrow(/requires --dry-run/u);
  });

  it('reads each chart recipient on the current engine and birthplace clock before rendering', async () => {
    const daily = dailyData as Daily;
    const moon = daily.bodies.find((body) => body.body === 'Moon')!;
    const moonHouse = (rising: string) => houseLine(moon, wholeSignHouseFromAsc(moon.sign, rising)).text;
    const text = (recipient: DailyEmailRecipient) => renderDailyEmail({
      recipient,
      daily,
      publication: publicationData as DailyPublication,
      program: programData as HoroscopeProgram,
      baseUrl: 'https://zodiacs.org',
      unsubscribeUrl: 'https://zodiacs.org/api/email/unsubscribe?token=test',
    }).text;
    const chartRecipient = (chart: SavedChart): ChartRecipient => ({
      tier: 'chart', email: 'chart@example.com', userId: '10000000-0000-4000-8000-000000000002',
      chartId: chart.id, revision: 1, chart, timezone: 'UTC',
    });
    // Synced from a browser that read Stockholm on Berlin's summer time in
    // July 1947: 10:00Z for a noon birth, where Sweden's +1:00 gives 11:00Z.
    const stale = engine.computeChart({
      utc: new Date('1947-07-01T10:00:00.000Z'), latitude: 59.33, longitude: 18.07,
      houseSystem: 'whole', timeKnown: true, flags: [],
    });
    const stockholm = chartRecipient({
      id: '10000000-0000-4000-8000-000000000001', name: 'Stockholm chart',
      createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
      birth: {
        date: '1947-07-01', time: '12:00', timeKnown: true,
        place: { name: 'Stockholm', admin1: 'Stockholm', country: 'SE', lat: 59.33, lon: 18.07, tz: 'Europe/Stockholm' },
      },
      summary: {
        engineVersion: stale.engineVersion, utcISO: '1947-07-01T10:00:00.000Z', houseSystem: 'whole',
        bodies: stale.bodies.map(({ body, lon, retrograde }) => ({ body, lon, retrograde })),
        angles: { asc: stale.angles!.asc, mc: stale.angles!.mc }, flags: stale.flags,
      },
    });
    // The package before 2026-08-24 stored the setting ASC, in Libra, for
    // part of the polar day; the rising one is in Aries.
    const polarCase = legacyPolar.cases.find((row) => row.latitude === 78.2232 && row.hour === 9)!;
    const polar = chartRecipient({
      id: '10000000-0000-4000-8000-000000000003', name: 'Polar chart',
      createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
      birth: {
        date: '2001-12-21', time: '09:00', timeKnown: true,
        place: { name: 'Polar fixture', admin1: '', country: 'SJ', lat: 78.2232, lon: 15.6267, tz: 'UTC' },
      },
      summary: structuredClone(polarCase.summary) as SavedChart['summary'],
    });
    const sun: DailyEmailRecipient = {
      tier: 'sun_sign', email: 'sun@example.com', sign: 'aries', contactId: 'contact_aries', timezone: 'UTC',
    };

    const [resolvedStockholm, resolvedPolar, resolvedSun] = await resolveChartRecipients([stockholm, polar, sun]);

    expect(resolvedSun).toBe(sun);
    const stockholmSummary = (resolvedStockholm as ChartRecipient).chart.summary;
    expect(resolvedStockholm).toEqual({ ...stockholm, chart: { ...stockholm.chart, summary: stockholmSummary } });
    expect(stockholmSummary.utcISO).toBe('1947-07-01T11:00:00.000Z');
    expect(signForLongitude(stale.angles!.asc).slug).toBe('virgo');
    expect(text(stockholm)).toContain(moonHouse('virgo'));
    expect(text(resolvedStockholm)).toContain(moonHouse('libra'));
    expect(text(resolvedStockholm)).not.toContain(moonHouse('virgo'));

    const polarSummary = (resolvedPolar as ChartRecipient).chart.summary;
    expect(polar.chart.summary.angles!.asc).toBeCloseTo(203.872, 3);
    expect(polarSummary.angles!.asc).toBeCloseTo(23.872, 3);
    expect(polarSummary.engineVersion).toBe(ENGINE_VERSION);
    expect(text(polar)).toContain(moonHouse('libra'));
    expect(text(resolvedPolar)).toContain(moonHouse('aries'));
  });

  it('binds both tier unsubscribe claims to the same opaque recipient hash', () => {
    const secret = 'recipient-hash-secret-that-is-long-enough';
    const sun = dailyRecipientUnsubscribeClaim({
      tier: 'sun_sign', email: 'same@example.com', sign: 'aries',
      contactId: 'contact_same_1', timezone: 'UTC',
    }, secret);
    const chart = dailyRecipientUnsubscribeClaim({
      tier: 'chart', email: 'SAME@example.com', userId: '10000000-0000-4000-8000-000000000002',
      chartId: '10000000-0000-4000-8000-000000000001',
      revision: 1,
      chart: {
        id: '10000000-0000-4000-8000-000000000001', name: 'Chart',
        createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
        birth: { date: '1990-01-01', time: null, timeKnown: false, place: null },
        summary: {
          engineVersion: 'fixture', utcISO: '1990-01-01T12:00:00Z', houseSystem: 'whole',
          bodies: [{ body: 'Sun', lon: 1, retrograde: false }], angles: null, flags: [],
        },
      },
      timezone: 'UTC',
    }, secret);
    expect(chart.recipientHash).toBe(sun.recipientHash);
    expect(chart).toEqual({
      kind: 'chart',
      userId: '10000000-0000-4000-8000-000000000002',
      recipientHash: sun.recipientHash,
    });
  });

  it('pins the hourly minute-13 workflow, smoke, live gate, and feature flag', async () => {
    const workflow = await readFile(new URL('../.github/workflows/daily-email.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('cron: "13 * * * *"');
    expect(workflow).toContain('scripts/send-daily-email.ts --fixture --dry-run');
    expect(workflow).toContain('npm run editorial:daily:verify-live');
    expect(workflow).toContain("vars.DAILY_EMAIL_ENABLED == '1'");
    expect(workflow).toContain('Enforce test-list-only release state');
    expect(workflow).toContain('DAILY_EMAIL_COHORT: test');
    expect(workflow).not.toContain('inputs.cohort');
    expect(workflow).not.toMatch(/^\s+- all\s*$/mu);
    expect(workflow).toContain('RESEND_DAILY_SEGMENT_ID');
    expect(workflow).toContain('RESEND_SEGMENT_ID');
    expect(workflow).toContain('RESEND_CONTACTS_API_KEY');
    expect(workflow).not.toContain('RESEND_DAILY_SIGN_SEGMENTS_JSON');
    expect(workflow).toContain('DAILY_EMAIL_COHORT');
  });
});

describe('daily chart email dispatch check', () => {
  const HASH_SECRET = 'recipient-hash-secret-that-is-long-enough';
  const hashFor = (email: string) => dailyRecipientHash(email, HASH_SECRET);
  const userId = '10000000-0000-4000-8000-000000000002';
  const chartA = '10000000-0000-4000-8000-0000000000aa';
  const chartB = '10000000-0000-4000-8000-0000000000bb';
  const recipient: ChartRecipient = {
    tier: 'chart', email: 'person@example.com', userId, chartId: chartA, revision: 4,
    chart: {
      id: chartA, name: 'Chart',
      createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
      birth: { date: '1990-01-01', time: null, timeKnown: false, place: null },
      summary: {
        engineVersion: 'fixture', utcISO: '1990-01-01T12:00:00Z', houseSystem: 'whole',
        bodies: [{ body: 'Sun', lon: 1, retrograde: false }], angles: null, flags: [],
      },
    },
    timezone: 'UTC',
  };
  const sun: SunSignRecipient = {
    tier: 'sun_sign', email: 'Person@Example.com', sign: 'aries', contactId: 'contact_person_1', timezone: 'UTC',
  };
  const withSun = new Map([[hashFor('person@example.com'), sun]]);

  it('keeps the chart edition only while the same chart and revision are still eligible', async () => {
    const loadSource = vi.fn().mockResolvedValue({ chartId: chartA.toUpperCase(), revision: 4 });
    const check = createChartDispatchCheck({ loadSource, sunFallbacks: withSun, recipientHashForEmail: hashFor });
    await expect(check(recipient)).resolves.toBe(recipient);
    expect(loadSource).toHaveBeenCalledWith(userId);
  });

  it('falls back to the Sun edition, or to nothing, once the account is no longer eligible', async () => {
    for (const current of [
      null, // chart emails or chart sync withdrawn, chart removed, or account in deletion
      { chartId: chartA, revision: 5 }, // the chart changed after it was decrypted
      { chartId: chartB, revision: 1 }, // chart A deleted and chart B synced
    ]) {
      const loadSource = vi.fn().mockResolvedValue(current);
      const withFallback = createChartDispatchCheck({ loadSource, sunFallbacks: withSun, recipientHashForEmail: hashFor });
      await expect(withFallback(recipient)).resolves.toEqual({ ...sun, email: 'person@example.com' });
      const without = createChartDispatchCheck({ loadSource, sunFallbacks: new Map(), recipientHashForEmail: hashFor });
      await expect(without(recipient)).resolves.toBeNull();
    }
    const failing = createChartDispatchCheck({
      loadSource: vi.fn().mockRejectedValue(new Error('database down')),
      sunFallbacks: new Map(),
      recipientHashForEmail: hashFor,
    });
    await expect(failing(recipient)).resolves.toBeNull();
  });

  it('asks the database for exactly one account each time', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    await expect(loadCurrentChartEmailSource(userId, {
      supabaseUrl: 'https://project.supabase.co', serviceKey: 'service-key', fetcher,
    })).resolves.toBeNull();
    expect(String(fetcher.mock.calls[0][0])).toBe('https://project.supabase.co/rest/v1/rpc/account_v2_chart_email_sources');
    expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({ candidate_user_ids: [userId] });
  });

  /**
   * The real job wiring: the dispatch check above, the delivery loop, the
   * Resend adapter and the one serialized provider queue. Only fetch, the
   * clock and the receipt store are stand-ins. The account withdraws while
   * its chart edition waits in the queue.
   */
  function throughProviderQueue({
    responses,
    sunFallbacks,
  }: {
    responses: Array<() => Response>;
    sunFallbacks: Map<string, SunSignRecipient>;
  }) {
    let eligible = true;
    let time = 1_000;
    const posts: Array<{ tier: string; to: string }> = [];
    const queued = [...responses];
    const fetcher = vi.fn(async (_input: string | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { to: string[]; tags: Array<{ name: string; value: string }> };
      posts.push({ tier: body.tags.find((tag) => tag.name === 'tier')!.value, to: body.to[0]! });
      return (queued.shift() ?? (() => new Response(JSON.stringify({ id: 're_sent' }), { status: 200 })))();
    });
    const sleep = vi.fn(async (milliseconds: number) => {
      time += milliseconds;
      // Chart emails are withdrawn while the queue waits.
      eligible = false;
    });
    const request = createRateLimitedResendRequest(fetcher as typeof fetch, {
      now: () => time,
      sleep,
      minIntervalMs: 250,
      maxRetries: 3,
    });
    const loadSource = vi.fn(async () => (eligible ? { chartId: chartA, revision: 4 } : null));
    const leases = [
      '30000000-0000-4000-8000-000000000003',
      '30000000-0000-4000-8000-000000000004',
      '30000000-0000-4000-8000-000000000005',
    ];
    const receipts: DeliveryReceiptStore = {
      reserve: vi.fn(async () => leases.shift() ?? null),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      sentBefore: vi.fn().mockResolvedValue(true),
    };
    const run = (recipients: DailyEmailRecipient[]) => deliverDailyEmails({
      recipients,
      editionDate: publicationData.date,
      limit: 10,
      dryRun: false,
      hashSecret: HASH_SECRET,
      receipts,
      resend: createResendDelivery({
        fetchImpl: fetcher as typeof fetch,
        apiKey: 're_test',
        from: 'Zodiacs.org <daily@zodiacs.org>',
        request,
      }),
      render: () => ({
        subject: 'Daily', preheader: 'Today', text: 'Today', html: '<p>Today</p>',
        unsubscribeUrl: 'https://zodiacs.org/api/email/unsubscribe?token=test',
      }),
      confirmBeforeDispatch: createChartDispatchCheck({ loadSource, sunFallbacks, recipientHashForEmail: hashFor }),
      log: vi.fn(),
    });
    return { run, posts, loadSource, receipts, sleep };
  }
  const otherSun: SunSignRecipient = {
    tier: 'sun_sign', email: 'other@example.com', sign: 'leo', contactId: 'contact_other_1', timezone: 'UTC',
  };

  it('sends no chart email when chart emails are withdrawn during the initial pacing wait', async () => {
    for (const sunFallbacks of [withSun, new Map<string, SunSignRecipient>()]) {
      const queue = throughProviderQueue({ responses: [], sunFallbacks });
      // The Sun email ahead of it makes the chart edition wait for pacing.
      const report = await queue.run([otherSun, recipient]);
      expect(queue.sleep).toHaveBeenCalledWith(250);
      expect(queue.posts.filter((post) => post.tier === 'chart')).toEqual([]);
      if (sunFallbacks.size) {
        expect(queue.posts).toEqual([
          { tier: 'sun_sign', to: 'other@example.com' },
          { tier: 'sun_sign', to: 'person@example.com' },
        ]);
        expect(report).toMatchObject({ sent: 2, fellBack: 1, withdrawn: 0, failed: 0 });
      } else {
        expect(queue.posts).toEqual([{ tier: 'sun_sign', to: 'other@example.com' }]);
        expect(report).toMatchObject({ sent: 1, fellBack: 0, withdrawn: 1, failed: 0 });
      }
      // Checked before the queue and again after its wait.
      expect(queue.loadSource).toHaveBeenCalledTimes(2);
    }
  });

  it('sends no chart email when chart emails are withdrawn during a 429 backoff', async () => {
    for (const sunFallbacks of [withSun, new Map<string, SunSignRecipient>()]) {
      const queue = throughProviderQueue({
        responses: [() => new Response('slow down', { status: 429, headers: { 'Retry-After': '1' } })],
        sunFallbacks,
      });
      const report = await queue.run([recipient]);
      expect(queue.sleep).toHaveBeenCalledWith(1_000);
      // The one chart POST is the attempt the provider rejected with 429.
      expect(queue.posts.filter((post) => post.tier === 'chart')).toHaveLength(1);
      expect(queue.posts[0]).toEqual({ tier: 'chart', to: 'person@example.com' });
      if (sunFallbacks.size) {
        expect(queue.posts.slice(1)).toEqual([{ tier: 'sun_sign', to: 'person@example.com' }]);
        expect(report).toMatchObject({ sent: 1, fellBack: 1, withdrawn: 0, failed: 0 });
        expect(queue.receipts.reserve).toHaveBeenNthCalledWith(2, publicationData.date, hashFor('person@example.com'), 'sun_sign');
      } else {
        expect(queue.posts).toHaveLength(1);
        expect(report).toMatchObject({ sent: 0, fellBack: 0, withdrawn: 1, failed: 0 });
        expect(queue.receipts.markSent).not.toHaveBeenCalled();
      }
      expect(queue.receipts.markFailed).toHaveBeenCalledOnce();
      // Before the queue, before the first POST, and after the backoff.
      expect(queue.loadSource).toHaveBeenCalledTimes(3);
    }
  });

  it('keeps sending the chart edition through a 429 retry while it stays eligible', async () => {
    let time = 0;
    const posts: string[] = [];
    const fetcher = vi.fn(async (_input: string | URL, init?: RequestInit) => {
      posts.push(JSON.parse(String(init?.body)).tags[1].value);
      return posts.length === 1
        ? new Response('', { status: 429 })
        : new Response(JSON.stringify({ id: 're_sent' }), { status: 200 });
    });
    const loadSource = vi.fn().mockResolvedValue({ chartId: chartA, revision: 4 });
    const report = await deliverDailyEmails({
      recipients: [recipient],
      editionDate: publicationData.date,
      limit: 10,
      dryRun: false,
      hashSecret: HASH_SECRET,
      receipts: {
        reserve: vi.fn().mockResolvedValue('30000000-0000-4000-8000-000000000003'),
        markSent: vi.fn().mockResolvedValue(undefined),
        markFailed: vi.fn().mockResolvedValue(undefined),
        sentBefore: vi.fn().mockResolvedValue(true),
      },
      resend: createResendDelivery({
        fetchImpl: fetcher as typeof fetch,
        apiKey: 're_test',
        from: 'Zodiacs.org <daily@zodiacs.org>',
        request: createRateLimitedResendRequest(fetcher as typeof fetch, {
          now: () => time,
          sleep: async (milliseconds) => { time += milliseconds; },
        }),
      }),
      render: () => ({
        subject: 'Daily', preheader: 'Today', text: 'Today', html: '<p>Today</p>',
        unsubscribeUrl: 'https://zodiacs.org/api/email/unsubscribe?token=test',
      }),
      confirmBeforeDispatch: createChartDispatchCheck({ loadSource, sunFallbacks: withSun, recipientHashForEmail: hashFor }),
      log: vi.fn(),
    });
    expect(posts).toEqual(['chart', 'chart']);
    expect(report).toMatchObject({ sent: 1, fellBack: 0, withdrawn: 0 });
    expect(loadSource).toHaveBeenCalledTimes(3);
  });

  /**
   * The daily job keeps no sealed message to replay: a chart edition the
   * provider rejected (429s until the queue gives up) leaves its receipt
   * failed, and the next run selects, checks and renders it afresh through
   * the same guarded path. Receipts follow the store's rules: a failed
   * receipt may be reserved again, any other may not.
   */
  it('sends no chart after exhausted 429s when chart emails are withdrawn during the next run\'s pacing wait', async () => {
    for (const sunFallbacks of [withSun, new Map<string, SunSignRecipient>()]) {
      let eligible = true;
      const loadSource = vi.fn(async () => (eligible ? { chartId: chartA, revision: 4 } : null));
      const rows = new Map<string, { status: 'reserved' | 'sent' | 'failed'; lease: string }>();
      let leaseCount = 0;
      const receipts: DeliveryReceiptStore = {
        reserve: vi.fn(async (_edition: string, hash: string) => {
          if (rows.has(hash) && rows.get(hash)!.status !== 'failed') return null;
          leaseCount += 1;
          const lease = `30000000-0000-4000-8000-${String(leaseCount).padStart(12, '0')}`;
          rows.set(hash, { status: 'reserved', lease });
          return lease;
        }),
        markSent: vi.fn(async (_edition: string, hash: string) => { rows.get(hash)!.status = 'sent'; }),
        markFailed: vi.fn(async (_edition: string, hash: string) => { rows.get(hash)!.status = 'failed'; }),
        sentBefore: vi.fn().mockResolvedValue(true),
      };
      const senderRun = (responses: Array<() => Response>, onWait: () => void) => {
        let time = 1_000;
        const posts: Array<{ tier: string; to: string; status: number }> = [];
        const queued = [...responses];
        const fetcher = vi.fn(async (_input: string | URL, init?: RequestInit) => {
          const body = JSON.parse(String(init?.body)) as { to: string[]; tags: Array<{ name: string; value: string }> };
          const response = (queued.shift() ?? (() => new Response(JSON.stringify({ id: 're_sent' }), { status: 200 })))();
          posts.push({ tier: body.tags.find((tag) => tag.name === 'tier')!.value, to: body.to[0]!, status: response.status });
          return response;
        });
        const request = createRateLimitedResendRequest(fetcher as typeof fetch, {
          now: () => time,
          sleep: async (milliseconds) => {
            time += milliseconds;
            onWait();
          },
          minIntervalMs: 250,
          maxRetries: 3,
        });
        const run = (recipients: DailyEmailRecipient[]) => deliverDailyEmails({
          recipients,
          editionDate: publicationData.date,
          limit: 10,
          dryRun: false,
          hashSecret: HASH_SECRET,
          receipts,
          resend: createResendDelivery({
            fetchImpl: fetcher as typeof fetch,
            apiKey: 're_test',
            from: 'Zodiacs.org <daily@zodiacs.org>',
            request,
          }),
          render: () => ({
            subject: 'Daily', preheader: 'Today', text: 'Today', html: '<p>Today</p>',
            unsubscribeUrl: 'https://zodiacs.org/api/email/unsubscribe?token=test',
          }),
          confirmBeforeDispatch: createChartDispatchCheck({ loadSource, sunFallbacks, recipientHashForEmail: hashFor }),
          log: vi.fn(),
        });
        return { run, posts };
      };
      const rateLimited = () => new Response('slow down', { status: 429, headers: { 'Retry-After': '1' } });

      // First run: still eligible, but every attempt is rejected with 429.
      const first = senderRun([rateLimited, rateLimited, rateLimited, rateLimited], () => undefined);
      await expect(first.run([recipient])).resolves.toMatchObject({ sent: 0, failed: 1 });
      expect(first.posts).toEqual(Array.from({ length: 4 }, () => ({ tier: 'chart', to: 'person@example.com', status: 429 })));
      expect(rows.get(hashFor('person@example.com'))?.status).toBe('failed');

      // Next run: the chart edition is selected again and checked before the
      // queue, then chart emails are withdrawn while it waits for pacing
      // behind another recipient's email.
      loadSource.mockClear();
      const next = senderRun([], () => {
        eligible = false;
      });
      const report = await next.run([otherSun, recipient]);
      expect(next.posts.filter((post) => post.tier === 'chart')).toEqual([]);
      if (sunFallbacks.size) {
        expect(next.posts).toEqual([
          { tier: 'sun_sign', to: 'other@example.com', status: 200 },
          { tier: 'sun_sign', to: 'person@example.com', status: 200 },
        ]);
        expect(report).toMatchObject({ sent: 2, fellBack: 1, withdrawn: 0, failed: 0 });
      } else {
        expect(next.posts).toEqual([{ tier: 'sun_sign', to: 'other@example.com', status: 200 }]);
        expect(report).toMatchObject({ sent: 1, fellBack: 0, withdrawn: 1, failed: 0 });
      }
      // Checked before the queue and again after its wait.
      expect(loadSource).toHaveBeenCalledTimes(2);
    }
  });
});
