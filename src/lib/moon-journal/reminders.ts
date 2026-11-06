/**
 * The Moon journal's opt-in reminder: one notification on the UTC day of each
 * new and full Moon, linking back to /moon-journal/. Composed here from public
 * sky facts only (the lunation's phase, sign and exact instant). Nothing about
 * a reader's journal, chart or birth goes into it, and the sender reads
 * nothing but the push subscriptions that opted in.
 *
 * The scheduled sender (scripts/send-lunation-reminders.ts) runs once a day
 * with the Sky Alerts job and sends only when the day holds a lunation.
 */
import { MOON_JOURNAL_COPY, type MoonJournalLocale } from './copy';
import { lunationKey } from './cycle';
import type { Lunation, SignSlug } from './types';

/** Where every reminder opens. The service worker allows this path. */
export const REMINDER_URL = '/moon-journal/';
/** The service worker's limits for a notification's title and body. */
export const REMINDER_TITLE_MAX = 32;
export const REMINDER_BODY_MAX = 140;

export interface SkyMoon {
  type: 'new' | 'full';
  /** Exact instant, UTC ISO. */
  at: string;
}

export interface LunationReminder {
  title: string;
  body: string;
  url: string;
}

function utcDay(value: Date | string): string {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : '';
}

/**
 * The new or full Moon whose exact instant falls on a UTC calendar day, or
 * null. Lunations are about 14.8 days apart, so a day holds at most one.
 */
export function lunationOnUtcDay(moons: readonly SkyMoon[], date: Date): SkyMoon | null {
  const day = utcDay(date);
  if (!day) throw new Error('Lunation reminder date is invalid.');
  return moons.find((moon) => (moon.type === 'new' || moon.type === 'full') && utcDay(moon.at) === day) ?? null;
}

/**
 * The delivery ledger's event id: 'moon-journal-new-2026-11-09'. Distinct
 * from the Sky Alert ids ('new-moon-2026-11-09'), so the per-endpoint ledger
 * can tell the two apart while still capping both together.
 */
export function reminderEventId(lunation: Pick<Lunation, 'type' | 'at'>): string {
  return `moon-journal-${lunationKey(lunation)}`;
}

/** The notification for one lunation, checked against the worker's limits. */
export function buildLunationReminder(
  lunation: Lunation,
  signName: (slug: SignSlug) => string,
  locale: MoonJournalLocale = 'en',
): LunationReminder {
  const copy = MOON_JOURNAL_COPY[locale];
  const time = new Date(lunation.at).toISOString().slice(11, 16);
  const title = copy.reminder.title(copy.lunationTitle(lunation.type, signName(lunation.sign)));
  const body = copy.reminder.body(time);
  if (!title || title.length > REMINDER_TITLE_MAX || !body || body.length > REMINDER_BODY_MAX
    || /[\u0000-\u001f\u007f]/u.test(title + body)) {
    throw new Error('Lunation reminder does not fit a notification.');
  }
  return { title, body, url: REMINDER_URL };
}
