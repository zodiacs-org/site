/**
 * Birthday reminder storage: service-role RPCs from
 * supabase/migrations/20261112090000_birthday_reminders.sql.
 * Errors carry status codes only, never a request's values.
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

/**
 * Records a pending reminder. 'requested' with the row id (for the stop link); 'capped' when the same address
 * asked within the last minute or has had six confirmation emails in the last 24 hours; or 'confirmed' when
 * the address already has a confirmed reminder, which a request never changes.
 */
export type ReminderRequestOutcome = { outcome: 'requested'; id: string } | { outcome: 'capped' | 'confirmed' };
export function requestReminder(email: string, month: number, day: number, confirmHash: string, env: Environment = process.env, fetcher: Fetch = fetch) {
  return rpc<ReminderRequestOutcome>('birthday_reminder_request', { p_email: email, p_month: month, p_day: day, p_confirm_hash: confirmHash }, env, fetcher);
}

/** Confirms the reminder a token's hash belongs to, within 48 hours. Its row id (for the stop link), or null. */
export async function confirmReminder(confirmHash: string, env: Environment = process.env, fetcher: Fetch = fetch): Promise<string | null> {
  const id = await rpc<unknown>('birthday_reminder_confirm', { p_confirm_hash: confirmHash }, env, fetcher);
  return typeof id === 'string' && /^[0-9a-f-]{36}$/u.test(id) ? id : null;
}

/** Deletes the reminder. True when there was one. */
export function deleteReminder(id: string, env: Environment = process.env, fetcher: Fetch = fetch) {
  return rpc<boolean>('birthday_reminder_delete', { p_id: id }, env, fetcher);
}

/** Confirmed reminders for these birthdays not sent in the last 300 days, with the birthday each one matched. Reads only. */
export function dueReminders(days: { month: number; day: number }[], env: Environment = process.env, fetcher: Fetch = fetch) {
  return rpc<{ id: string; email: string; month: number; day: number }[]>('birthday_reminders_due', { p_days: days.map(({ month, day }) => ({ month, day })) }, env, fetcher);
}

/** Deletes unconfirmed requests older than 48 hours. The number deleted. */
export function sweepExpiredRequests(env: Environment = process.env, fetcher: Fetch = fetch) {
  return rpc<number>('birthday_reminders_sweep', {}, env, fetcher);
}

/** Reserve this reminder. An interrupted worker's reservation expires after 20 minutes. */
export function claimReminder(id: string, env: Environment = process.env, fetcher: Fetch = fetch) {
  return rpc<string | null>('birthday_reminder_claim', { p_id: id }, env, fetcher);
}

export function dispatchReminder(id: string, claim: string, on: string, hash: string, env: Environment = process.env, fetcher: Fetch = fetch) {
  return rpc<boolean>('birthday_reminder_dispatch', { p_id: id, p_claim: claim, p_on: on, p_hash: hash }, env, fetcher);
}

export function completeReminder(id: string, claim: string, env: Environment = process.env, fetcher: Fetch = fetch) {
  return rpc<boolean>('birthday_reminder_complete', { p_id: id, p_claim: claim }, env, fetcher);
}

export function releaseReminder(id: string, claim: string, rejected: boolean, env: Environment = process.env, fetcher: Fetch = fetch) {
  return rpc<boolean>('birthday_reminder_release', { p_id: id, p_claim: claim, p_rejected: rejected }, env, fetcher);
}
