import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  assertDailyEmailSendInterlocks,
  dailyRecipientUnsubscribeClaim,
  canaryRecipient,
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
import type { ChartRecipient, DailyEmailRecipient } from '../src/lib/daily-email/types';
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
      considered: 2, reserved: 0, sent: 0, failed: 0, duplicate: 0, dryRun: 2,
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
      chartId: chart.id, chart, timezone: 'UTC',
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
