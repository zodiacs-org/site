/**
 * The birthday reminder's switches. Sign-ups are taken only with
 * BIRTHDAY_REMINDER_ENABLED=1 and the storage, sending and secret it needs;
 * the site shows the offer only with PUBLIC_BIRTHDAY_REMINDER_ENABLED=1; the
 * daily send runs only where its workflow's repository variable
 * BIRTHDAY_REMINDERS_SENDING=1 is set. All three are off: the owner switches
 * them on.
 */
import { environmentValue } from '../email/config.js';

type Environment = Record<string, unknown>;

export const BIRTHDAY_REMINDER_SWITCH = 'BIRTHDAY_REMINDER_ENABLED';
export const BIRTHDAY_REMINDER_PUBLIC_SWITCH = 'PUBLIC_BIRTHDAY_REMINDER_ENABLED';

export function birthdayReminderSecret(env: Environment = process.env): string {
  return environmentValue(env, 'BIRTHDAY_REMINDER_SECRET');
}

/** Sign-ups are open: the switch is exactly '1' and storage, sending and the token secret are configured. */
export function birthdayReminderEnabled(env: Environment = process.env): boolean {
  return environmentValue(env, BIRTHDAY_REMINDER_SWITCH) === '1'
    && !!environmentValue(env, 'PUBLIC_SUPABASE_URL')
    && !!environmentValue(env, 'SUPABASE_SERVICE_ROLE_KEY')
    && !!environmentValue(env, 'RESEND_API_KEY')
    && !!environmentValue(env, 'RESEND_FROM_EMAIL')
    && birthdayReminderSecret(env).length >= 32;
}
