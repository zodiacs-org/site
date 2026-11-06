import { describe, expect, it, vi } from 'vitest';
import sky from '../src/data/sky.json';
import { lunationForDay, moonSignAt, runLunationReminders } from './send-lunation-reminders';

const moons = (sky as { moons: { type: 'new' | 'full'; at: string }[] }).moons;
const row = (id: number) => ({
  subscription_id: id,
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
  p256dh: 'public-key',
  auth: 'auth-key',
  lang: 'en',
  updated_at: '2026-11-01T00:00:00.000Z',
});

describe('Moon journal reminder sender', () => {
  it('reads the sign from the full engine, as the journal page does', () => {
    expect(moonSignAt('2026-11-09T07:02:05.269Z')).toBe('scorpio');
    expect(lunationForDay(moons, new Date('2026-11-24T07:00:00.000Z'))).toMatchObject({ type: 'full', sign: 'gemini' });
  });

  it('reads no subscription and sends nothing on a day without a new or full Moon', async () => {
    const loadSubscriptions = vi.fn();
    const sendNotification = vi.fn();
    const report = await runLunationReminders({
      moons,
      date: new Date('2026-11-10T07:00:00.000Z'),
      loadSubscriptions,
      claims: {},
      sendNotification,
      log: () => {},
    });
    expect(report.event).toBeNull();
    expect(loadSubscriptions).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('dry-runs the day\'s reminder without touching a store', async () => {
    const log = vi.fn();
    const claims = { claim: vi.fn(), complete: vi.fn() };
    const report = await runLunationReminders({
      moons,
      date: new Date('2026-11-09T07:00:00.000Z'),
      dryRun: true,
      loadSubscriptions: async () => [row(1)],
      claims,
      sendNotification: vi.fn(),
      log,
    });
    expect(report).toMatchObject({ event: 'moon-journal-new-2026-11-09', considered: 1, dryRun: 1, sent: 0 });
    expect(claims.claim).not.toHaveBeenCalled();
    expect(log.mock.calls[0][0]).toContain('"title":"New Moon in Scorpio today"');
    expect(log.mock.calls[0][0]).toContain('"url":"/moon-journal/"');
  });

  it('claims each endpoint under the shared caps before sending, and counts capped ones', async () => {
    const claims = {
      claim: vi.fn(async (id: number) => (id === 2
        ? { outcome: 'capped_24h' }
        : { outcome: 'reserved', claimToken: '00000000-0000-4000-8000-000000000001' })),
      complete: vi.fn(async () => ({ outcome: 'finalized', status: 'sent' })),
    };
    const sendNotification = vi.fn(async () => ({ statusCode: 201 }));
    const report = await runLunationReminders({
      moons,
      date: new Date('2026-11-09T07:00:00.000Z'),
      now: new Date('2026-11-09T07:05:00.000Z'),
      loadSubscriptions: async () => [row(1), row(2)],
      claims,
      sendNotification,
      log: () => {},
    });
    expect(report).toMatchObject({ considered: 2, reserved: 1, sent: 1, capped: 1, failed: 0 });
    expect(claims.claim).toHaveBeenCalledWith(1, 'moon-journal-new-2026-11-09', '2026-11-01T00:00:00.000Z');
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [subscription, payload, options] = sendNotification.mock.calls[0] as unknown as [
      { endpoint: string }, string, { TTL: number },
    ];
    expect(subscription.endpoint).toBe('https://fcm.googleapis.com/fcm/send/1');
    expect(JSON.parse(payload)).toEqual({
      title: 'New Moon in Scorpio today',
      body: 'Exact at 07:02 UTC. Your journal question is waiting.',
      url: '/moon-journal/',
    });
    // Expires at the end of the UTC day, so a late delivery never says "today" tomorrow.
    expect(options.TTL).toBe((24 * 60 - (7 * 60 + 5)) * 60);
  });
});
