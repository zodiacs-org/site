/**
 * Birthday reminder storage: five service-role RPCs from
 * supabase/migrations/20261112090000_birthday_reminders.sql. The table holds
 * the email, the month and day, the confirmation hash and two dates; nothing
 * else. Errors carry status codes only, never a request's values.
 */
type Environment = Record<string, unknown>;
type Fetch = typeof fetch;

const value = (env: Environment, key: string) => (typeof env[key] === 'string' ? (env[key] as string).trim() : '');

async function rpc<T>(name: string, body: Record<string, unknown>, env: Environment, fetcher: Fetch): Promise<T> {
  const url = new URL(value(env, 'PUBLIC_SUPABASE_URL'));
  if (url.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS.');
  const key = value(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetcher(`${url.origin}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Birthday reminder storage failed (${response.status}).`);
  return await response.json() as T;
}

/** Records a pending reminder. 'requested', or 'capped' when the same address asked within the last minute. */
export function requestReminder(email: string, month: number, day: number, confirmHash: string, env: Environment = process.env, fetcher: Fetch = fetch) {
  return rpc<'requested' | 'capped'>('birthday_reminder_request', { p_email: email, p_month: month, p_day: day, p_confirm_hash: confirmHash }, env, fetcher);
}

/** Confirms the reminder a token's hash belongs to, within 48 hours. */
export function confirmReminder(confirmHash: string, env: Environment = process.env, fetcher: Fetch = fetch) {
  return rpc<boolean>('birthday_reminder_confirm', { p_confirm_hash: confirmHash }, env, fetcher);
}

/** Deletes the reminder. True when there was one. */
export function deleteReminder(id: string, env: Environment = process.env, fetcher: Fetch = fetch) {
  return rpc<boolean>('birthday_reminder_delete', { p_id: id }, env, fetcher);
}

/** Confirmed reminders for these birthdays not yet sent this year, after deleting unconfirmed requests older than 48 hours. */
export function dueReminders(days: { month: number; day: number }[], env: Environment = process.env, fetcher: Fetch = fetch) {
  return rpc<{ id: string; email: string }[]>('birthday_reminders_due', { p_days: days }, env, fetcher);
}

export function markReminderSent(id: string, env: Environment = process.env, fetcher: Fetch = fetch) {
  return rpc<boolean>('birthday_reminder_sent', { p_id: id }, env, fetcher);
}
