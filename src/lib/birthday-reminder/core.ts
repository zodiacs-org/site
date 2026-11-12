/**
 * Birthday check-back: after someone scores their year, they can ask for one
 * email a year, on their birthday, inviting them to score the year again.
 *
 * What is kept, and only with consent: the email address and the birthday's
 * month and day. Never the birth year, time or place, never a name. The
 * month and day travel in a POST body, never in a link, and nothing here logs.
 * The sign-up asks the person to confirm they are 13 or older, and the site
 * offers it only after a score whose birth date passed the under-13 check.
 * Sign-ups are double opt-in: nothing is sent but the confirmation until the
 * link in it is followed, and an unconfirmed request is deleted after 48 hours.
 * Unsubscribing deletes the row.
 *
 * Off unless BIRTHDAY_REMINDER_ENABLED=1 (src/lib/birthday-reminder/config.ts);
 * the daily send runs only where its own switch is on. Pure: parsing, dates,
 * tokens and the email's words. Storage and sending live in ./store.ts and
 * ./send.ts.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { normalizeEmail } from '../email/input.js';

export const CONFIRM_HOURS = 48;
const KEYS = ['email', 'month', 'day', 'consent', 'adult'] as const;

export interface ReminderRequest {
  email: string;
  month: number;
  day: number;
}

export type ReminderRefusal = 'invalid-email' | 'invalid-date' | 'consent-required' | 'adult-required' | 'unexpected-field';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function validMonthDay(month: number, day: number): boolean {
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}

/**
 * The sign-up body: the email, the birthday's month and day, and two explicit
 * yeses. Any other field, a birth year above all, is refused rather than
 * dropped, so a client cannot send more than is kept.
 */
export function parseReminderRequest(body: unknown): ReminderRequest | { refused: ReminderRefusal } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { refused: 'unexpected-field' };
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => !(KEYS as readonly string[]).includes(key))) return { refused: 'unexpected-field' };
  const email = normalizeEmail(record.email);
  if (!email) return { refused: 'invalid-email' };
  const month = record.month;
  const day = record.day;
  if (typeof month !== 'number' || typeof day !== 'number' || !validMonthDay(month, day)) return { refused: 'invalid-date' };
  if (record.consent !== true) return { refused: 'consent-required' };
  if (record.adult !== true) return { refused: 'adult-required' };
  return { email, month, day };
}

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * The birthdays that fall on a UTC date: its own month and day, and on 28
 * February of a year without a 29th, the 29 February birthdays too.
 */
export function birthdaysOn(date: string): { month: number; day: number }[] {
  const [year, month, day] = date.split('-').map(Number);
  const days = [{ month, day }];
  if (month === 2 && day === 28 && !isLeap(year)) days.push({ month: 2, day: 29 });
  return days;
}

/** A random confirmation token, and the hash that is stored in its place. */
export function newConfirmToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * An unsubscribe token for a reminder's row id: the id and an HMAC of it under
 * the reminder secret, so the email can carry it and nothing extra is stored.
 */
export function unsubscribeToken(id: string, secret: string): string {
  return `${id}.${createHmac('sha256', secret).update(`birthday-reminder-unsubscribe:${id}`).digest('base64url')}`;
}

/** The row id an unsubscribe token names, or null when its signature does not match. */
export function readUnsubscribeToken(token: string, secret: string): string | null {
  const match = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/u.exec(token);
  if (!match) return null;
  const expected = Buffer.from(unsubscribeToken(match[1], secret));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given) ? match[1] : null;
}

/** The confirmation email: what was asked for, what is kept, and the way out from the start. */
export function confirmationEmail(confirmUrl: string, stopUrl: string): { subject: string; text: string } {
  return {
    subject: 'Confirm your Zodiacs.org birthday reminder',
    text: [
      'You asked Zodiacs.org to email you once a year, on your birthday, to score your year ahead again.',
      '',
      `Confirm the reminder: ${confirmUrl}`,
      '',
      `The link works for ${CONFIRM_HOURS} hours. If you did not ask for this, ignore this email and nothing will be kept.`,
      '',
      'We keep only this email address and your birthday’s month and day, never your birth year, time or place.',
      '',
      `Stop and delete it at any time, before or after confirming: ${stopUrl}`,
    ].join('\n'),
  };
}

/** The birthday email itself: one line of greeting, the link to score the new year, and the way out. */
export function birthdayEmail(origin: string, unsubscribeUrl: string): { subject: string; text: string } {
  return {
    subject: 'Happy birthday from Zodiacs.org: your new year ahead',
    text: [
      'Happy birthday.',
      '',
      'Your solar return has come round: the Sun is back where it was when you were born, and a new year of your chart starts here.',
      '',
      `Score the twelve months ahead: ${origin}/year-score/`,
      '',
      `Stop these birthday emails: ${unsubscribeUrl}`,
    ].join('\n'),
  };
}
