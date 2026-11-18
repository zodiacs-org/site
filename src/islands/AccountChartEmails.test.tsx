import { h } from 'preact';
import render from 'preact-render-to-string';
import { describe, expect, it, vi } from 'vitest';
import type { DailyChartPreference } from '../lib/profile/daily-email-client';
import {
  AccountChartEmailsView,
  dailyChartEmailView,
  saveChartEmailsChoice,
  type AccountChartEmailsViewProps,
} from './AccountChartEmails';

const CHART_A = '10000000-0000-4000-8000-0000000000aa';
const CHART_B = '10000000-0000-4000-8000-0000000000bb';

const confirmed: DailyChartPreference = {
  enabled: true,
  pending: false,
  paused: false,
  requiresConfirmation: false,
  chartId: CHART_A,
  timezone: 'Europe/Rome',
  confirmedAt: '2026-11-01T00:00:00.000Z',
  maskedEmail: null,
};

const noop = () => {};
function view(overrides: Partial<AccountChartEmailsViewProps>): string {
  return render(h(AccountChartEmailsView, {
    consent: 'granted',
    syncedChartId: CHART_A,
    locked: false,
    daily: confirmed,
    dailyView: 'on',
    timezone: 'Europe/Rome',
    timezoneChoices: ['Europe/Rome', 'UTC'],
    message: '',
    onToggle: noop,
    onTimezone: noop,
    onStart: noop,
    onStop: noop,
    onResend: noop,
    ...overrides,
  }));
}

describe('Use my chart for my emails', () => {
  it('records a grant and a withdrawal as the chart_emails decisions the server returns', async () => {
    const record = vi.fn()
      .mockResolvedValueOnce({ outcome: 'granted' })
      .mockResolvedValueOnce({ outcome: 'withdrawn' });
    await expect(saveChartEmailsChoice(true, record, () => 'request-1'))
      .resolves.toEqual({ consent: 'granted', message: 'Chart emails are on.' });
    await expect(saveChartEmailsChoice(false, record, () => 'request-2'))
      .resolves.toEqual({
        consent: 'withdrawn',
        message: 'Chart emails are off. Emails you get no longer use your chart.',
      });
    expect(record.mock.calls).toEqual([['grant', 'request-1'], ['withdraw', 'request-2']]);
  });

  it('keeps the recorded state when the server refuses or cannot be reached', async () => {
    for (const record of [
      vi.fn().mockResolvedValue({ outcome: 'stale_policy' }),
      vi.fn().mockRejectedValue(new Error('offline')),
    ]) {
      await expect(saveChartEmailsChoice(false, record, () => 'request'))
        .resolves.toEqual({ consent: null, message: 'That did not save. Please try again.' });
    }
  });

  it('cannot be turned on without a synced chart, and can always be turned off', () => {
    const withoutChart = view({ consent: 'pending', syncedChartId: null, dailyView: 'needs_consent', daily: null });
    expect(withoutChart).toMatch(/<input type="checkbox" disabled/u);
    expect(withoutChart).toContain('Sync your own chart above first.');
    const grantedWithoutChart = view({ consent: 'granted', syncedChartId: null, dailyView: 'paused_chart' });
    expect(grantedWithoutChart).toMatch(/<input type="checkbox" checked(?! disabled)/u);
    expect(grantedWithoutChart).not.toContain('Sync your own chart above first.');
  });

  it('says plainly what the choice does, with no dashes', () => {
    const markup = view({});
    expect(markup).toContain('Use my chart for my emails');
    expect(markup).toContain('Zodiacs decrypts it only to write those emails.');
    expect(markup).not.toMatch(/[–—]/u);
  });
});

describe('daily chart email on the v2 profile', () => {
  const state = (daily: DailyChartPreference | null, granted: boolean, syncedChartId: string | null = CHART_A) => (
    dailyChartEmailView({ lifecycle: true, loadState: 'ready', daily, granted, syncedChartId })
  );

  it('is on only while chart emails are on and the preference names the synced chart', () => {
    expect(state(confirmed, true)).toBe('on');
    expect(view({ dailyView: 'on' })).toContain('On. Sent each morning in Europe/Rome, using your synced chart.');
  });

  it('is paused after chart A was removed and chart B synced, and restarts only with chart B', () => {
    expect(state(confirmed, true, CHART_B)).toBe('paused_chart');
    expect(state({ ...confirmed, chartId: null }, true, CHART_B)).toBe('paused_chart');
    const markup = view({ syncedChartId: CHART_B, dailyView: 'paused_chart' });
    expect(markup).toContain('Your daily chart email is paused.');
    expect(markup).toContain('Restart with my synced chart');
    expect(markup).not.toContain(CHART_A);
  });

  it('is paused when chart emails are withdrawn, and says the Daily Sun keeps arriving', () => {
    expect(state(confirmed, false)).toBe('paused_consent');
    const markup = view({ consent: 'withdrawn', dailyView: 'paused_consent' });
    expect(markup).toContain('paused until chart emails are on');
    expect(markup).toContain('Daily Sun email, that keeps arriving');
    expect(markup).not.toContain('Restart with my synced chart');
  });

  it('asks again after the account email changed, before anything is sent', () => {
    expect(state({ ...confirmed, requiresConfirmation: true }, true)).toBe('needs_confirmation');
    expect(view({ dailyView: 'needs_confirmation' })).toContain('Send a confirmation link');
  });

  it('offers the double opt-in only with chart emails on and a synced chart', () => {
    const none: DailyChartPreference = { ...confirmed, enabled: false, chartId: null, confirmedAt: null };
    expect(state(none, true)).toBe('offer');
    expect(state(none, false)).toBe('needs_consent');
    expect(state(none, true, null)).toBe('needs_consent');
    expect(view({ dailyView: 'offer', daily: none })).toContain('Email me a confirmation link');
    expect(state({ ...none, pending: true, maskedEmail: 'p…@example.com' }, true)).toBe('pending');
  });

  it('shows nothing without the daily email service and reports a failed check', () => {
    expect(dailyChartEmailView({ lifecycle: false, loadState: 'ready', daily: confirmed, granted: true, syncedChartId: CHART_A }))
      .toBe('hidden');
    expect(view({ dailyView: 'hidden' })).not.toContain('Daily chart email');
    expect(dailyChartEmailView({ lifecycle: true, loadState: 'error', daily: null, granted: true, syncedChartId: CHART_A }))
      .toBe('error');
  });
});
