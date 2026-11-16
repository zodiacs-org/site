import { describe, expect, it } from 'vitest';
import { birthdayReminderEnabled } from './config';

const ENV = { BIRTHDAY_REMINDER_ENABLED: '1', PUBLIC_BIRTHDAY_REMINDER_ENABLED: '1', PUBLIC_YEAR_SCORE_ENABLED: '1', PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service', RESEND_API_KEY: 'resend', RESEND_FROM_EMAIL: 'Zodiacs.org <hello@zodiacs.org>', BIRTHDAY_REMINDER_SECRET: 'x'.repeat(40) };

describe('the birthday reminder switches', () => {
  it('keep the reminder off unless both public switches are exactly 1, so the server cannot run ahead of the privacy page', () => {
    expect(birthdayReminderEnabled(ENV)).toBe(true);
    for (const key of ['PUBLIC_BIRTHDAY_REMINDER_ENABLED', 'PUBLIC_YEAR_SCORE_ENABLED'] as const) {
      for (const value of [undefined, '', '0', 'true', ' 1']) {
        expect(birthdayReminderEnabled({ ...ENV, [key]: value }), `${key}=${String(value)}`).toBe(false);
      }
    }
  });
});
