import { normalizeEmail } from '../email/input';
import type { SavedChart } from '../profile/schema';
import { isDailyEmailDue, localDeliveryTime } from './schedule';
import type { ChartRecipient, DailyEmailRecipient, SunSignRecipient } from './types';

export interface ChartPreferenceRow {
  user_id: string;
  chart_id: string | null;
  recipient_hash: string;
  timezone: string | null;
  confirmed_at: string;
}

export interface ChartRecipientSelection {
  recipients: ChartRecipient[];
  suppressSunEmails: Set<string>;
  suppressSunRecipientHashes: Set<string>;
  /** Opted-in accounts whose chart could not be read; they fall back to Sun. */
  invalidCharts: Array<{ userId: string; chartId: string }>;
  invalidIdentities: string[];
  /** Confirmed chart preferences whose account does not hold chart_emails. */
  notOptedIn: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function validInstant(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim() === value
    && Number.isFinite(Date.parse(value));
}

function validCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validClockTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{2}):(\d{2})$/u.exec(value);
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
}

function validTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.trim() !== value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function validSavedPlace(value: unknown): boolean {
  if (value === null) return true;
  return isRecord(value)
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && typeof value.admin1 === 'string'
    && typeof value.country === 'string'
    && value.country.trim().length > 0
    && typeof value.lat === 'number'
    && Number.isFinite(value.lat)
    && value.lat >= -90
    && value.lat <= 90
    && typeof value.lon === 'number'
    && Number.isFinite(value.lon)
    && value.lon >= -180
    && value.lon <= 180
    && validTimezone(value.tz);
}

export function isDailyEmailSavedChart(value: unknown): value is SavedChart {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || value.id.length === 0
    || typeof value.name !== 'string'
    || !validInstant(value.createdAt)
    || !validInstant(value.updatedAt)
    || !isRecord(value.birth)
    || !validCalendarDate(value.birth.date)
    || typeof value.birth.timeKnown !== 'boolean'
    || (value.birth.timeKnown
      ? !validClockTime(value.birth.time)
      : value.birth.time !== null)
    || !validSavedPlace(value.birth.place)
    || !isRecord(value.summary)
    || typeof value.summary.engineVersion !== 'string'
    || value.summary.engineVersion.length === 0
    || !validInstant(value.summary.utcISO)
    || (value.summary.houseSystem !== 'whole' && value.summary.houseSystem !== 'placidus')
    || !Array.isArray(value.summary.flags)
    || !value.summary.flags.every((flag) => (
      flag === 'dst-gap'
      || flag === 'dst-fold'
      || flag === 'lmt'
      || flag === 'no-time'
      || flag === 'polar-fallback'
    ))
    || !Array.isArray(value.summary.bodies)) return false;
  const angles = value.summary.angles;
  const validAngles = angles === null || (
    isRecord(angles)
    && typeof angles.asc === 'number'
    && Number.isFinite(angles.asc)
    && angles.asc >= 0
    && angles.asc < 360
    && typeof angles.mc === 'number'
    && Number.isFinite(angles.mc)
    && angles.mc >= 0
    && angles.mc < 360
  );
  return validAngles && value.summary.bodies.length > 0 && value.summary.bodies.every((body) => (
    isRecord(body)
    && typeof body.body === 'string'
    && body.body.length > 0
    && typeof body.lon === 'number'
    && Number.isFinite(body.lon)
    && body.lon >= 0
    && body.lon < 360
    && typeof body.retrograde === 'boolean'
  ));
}

/**
 * The chart edition goes only to an account that has a confirmed daily chart
 * preference (double opt-in, timezone) whose chart_id names a v2 chart AND
 * that currently holds chart_sync and chart_emails (`optedIn`, from
 * account_v2_chart_email_sources). Its chart is the account's encrypted self
 * chart, decrypted by `loadChart` in this job and nowhere stored.
 *
 * Everyone else is left to the Sun tier: a preference paused when v1 chart
 * sync was retired (chart_id null), an account without chart_emails, and an
 * opted-in account whose chart cannot be decrypted right now. Their Sun
 * edition is not suppressed, so a confirmed Sun subscriber still gets it.
 * Auth emails are resolved only during this send operation. They are never
 * copied into preference rows or delivery receipts.
 */
export async function selectChartRecipients({
  preferences,
  optedIn,
  loadChart,
  editionDate,
  at,
  getAuthEmail,
  recipientHashForEmail,
}: {
  preferences: readonly ChartPreferenceRow[];
  optedIn: ReadonlySet<string>;
  /** Decrypts the account's self chart; null when it cannot be read. */
  loadChart: (userId: string) => Promise<SavedChart | null>;
  editionDate: string;
  at: Date;
  getAuthEmail: (userId: string) => Promise<string | null>;
  recipientHashForEmail: (email: string) => string;
}): Promise<ChartRecipientSelection> {
  const recipients: ChartRecipient[] = [];
  const suppressSunEmails = new Set<string>();
  const suppressSunRecipientHashes = new Set<string>();
  const invalidCharts: Array<{ userId: string; chartId: string }> = [];
  const invalidIdentities: string[] = [];
  let notOptedIn = 0;
  const sunDue = isDailyEmailDue(editionDate, at, 'UTC');

  for (const preference of [...preferences].sort((a, b) => a.user_id.localeCompare(b.user_id))) {
    if (!preference.confirmed_at) continue;
    // A null chart id is the paused state (a removed chart, or a v1 chart
    // retired at launch). It must not suppress a separately confirmed Sun.
    if (!preference.chart_id) continue;
    if (!optedIn.has(preference.user_id.toLowerCase())) {
      notOptedIn += 1;
      continue;
    }
    const due = isDailyEmailDue(editionDate, at, preference.timezone);
    // Decrypt only when this run sends either edition this account could get.
    if (!due && !sunDue) {
      suppressSunRecipientHashes.add(preference.recipient_hash);
      continue;
    }
    let chart: SavedChart | null = null;
    try {
      chart = await loadChart(preference.user_id);
    } catch {
      chart = null;
    }
    if (!chart || !isDailyEmailSavedChart(chart)) {
      // Fall back: the Sun tier stays unsuppressed for this account.
      invalidCharts.push({ userId: preference.user_id, chartId: preference.chart_id });
      continue;
    }
    // The opaque preference hash is enough to suppress a matching Sun tier.
    // Avoid reading Auth identity until this timezone is due.
    suppressSunRecipientHashes.add(preference.recipient_hash);
    if (!due) continue;
    let authEmail: string | null = null;
    try {
      authEmail = await getAuthEmail(preference.user_id);
    } catch {
      invalidIdentities.push(preference.user_id);
      continue;
    }
    const email = normalizeEmail(authEmail);
    if (!email) {
      invalidIdentities.push(preference.user_id);
      continue;
    }
    if (preference.recipient_hash !== recipientHashForEmail(email)) {
      invalidIdentities.push(preference.user_id);
      continue;
    }
    suppressSunEmails.add(email);
    const timezone = localDeliveryTime(at, preference.timezone).timezone;
    recipients.push({
      tier: 'chart',
      email,
      userId: preference.user_id,
      chartId: chart.id,
      chart,
      timezone,
    });
  }

  return {
    recipients,
    suppressSunEmails,
    suppressSunRecipientHashes,
    invalidCharts,
    invalidIdentities,
    notOptedIn,
  };
}

export function mergeDailyEmailRecipients({
  chart,
  sun,
  suppressSunEmails,
  suppressSunRecipientHashes,
  recipientHashForEmail,
  editionDate,
  at,
}: {
  chart: readonly ChartRecipient[];
  sun: readonly SunSignRecipient[];
  suppressSunEmails: ReadonlySet<string>;
  suppressSunRecipientHashes: ReadonlySet<string>;
  recipientHashForEmail: (email: string) => string;
  editionDate: string;
  at: Date;
}): DailyEmailRecipient[] {
  const recipients: DailyEmailRecipient[] = [...chart];
  if (isDailyEmailDue(editionDate, at, 'UTC')) {
    recipients.push(...sun.filter((recipient) => (
      !suppressSunEmails.has(recipient.email)
      && !suppressSunRecipientHashes.has(recipientHashForEmail(recipient.email))
    )));
  }
  return recipients.sort((left, right) => (
    left.email.localeCompare(right.email) || left.tier.localeCompare(right.tier)
  ));
}

export function parseTestAllowlist(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  let entries: unknown;
  try {
    entries = raw.trim().startsWith('[') ? JSON.parse(raw) : raw.split(/[\s,]+/u);
  } catch {
    throw new Error('DAILY_EMAIL_TEST_ALLOWLIST must be JSON or a comma-separated list.');
  }
  if (!Array.isArray(entries)) {
    throw new Error('DAILY_EMAIL_TEST_ALLOWLIST must be an array or comma-separated list.');
  }
  const result = new Set<string>();
  for (const entry of entries) {
    const email = normalizeEmail(entry);
    if (!email) throw new Error('DAILY_EMAIL_TEST_ALLOWLIST contains an invalid email.');
    result.add(email);
  }
  return result;
}

export function filterDailyEmailCohort(
  recipients: readonly DailyEmailRecipient[],
  cohort: string,
  allowlist: ReadonlySet<string>,
  onlyEmail?: string | null,
): DailyEmailRecipient[] {
  if (cohort !== 'test' && cohort !== 'all') {
    throw new Error('DAILY_EMAIL_COHORT must be test or all.');
  }
  const only = onlyEmail ? normalizeEmail(onlyEmail) : null;
  if (onlyEmail && !only) throw new Error('--to must be a valid subscribed email.');
  if (cohort === 'test' && allowlist.size === 0) {
    throw new Error('The test cohort requires DAILY_EMAIL_TEST_ALLOWLIST.');
  }
  return recipients.filter((recipient) => (
    (cohort === 'all' || allowlist.has(recipient.email))
    && (!only || recipient.email === only)
  ));
}
