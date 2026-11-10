import { describe, expect, it } from 'vitest';
import { birthdayEmail, birthdaysOn, confirmationEmail, hashToken, newConfirmToken, parseReminderRequest, readUnsubscribeToken, unsubscribeToken } from './core';
import { birthdayReminderEnabled } from './config';

const SECRET = 'x'.repeat(40);
const ENV = { BIRTHDAY_REMINDER_ENABLED: '1', PUBLIC_YEAR_SCORE_ENABLED: '1', PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service', RESEND_API_KEY: 'resend', RESEND_FROM_EMAIL: 'Zodiacs.org <hello@zodiacs.org>', BIRTHDAY_REMINDER_SECRET: SECRET };

describe('a birthday reminder sign-up', () => {
  it('keeps only the email and the birthday’s month and day, with both yeses', () => {
    expect(parseReminderRequest({ email: ' Ana@Example.com ', month: 5, day: 3, consent: true, adult: true })).toEqual({ email: 'ana@example.com', month: 5, day: 3 });
  });
  it('refuses a birth year or any other extra field rather than dropping it', () => {
    expect(parseReminderRequest({ email: 'a@b.co', month: 5, day: 3, year: 1990, consent: true, adult: true })).toEqual({ refused: 'unexpected-field' });
    expect(parseReminderRequest({ email: 'a@b.co', month: 5, day: 3, birthDate: '1990-05-03', consent: true, adult: true })).toEqual({ refused: 'unexpected-field' });
  });
  it('needs consent and a yes to being 13 or older, and a real month and day', () => {
    expect(parseReminderRequest({ email: 'a@b.co', month: 5, day: 3, adult: true })).toEqual({ refused: 'consent-required' });
    expect(parseReminderRequest({ email: 'a@b.co', month: 5, day: 3, consent: true, adult: false })).toEqual({ refused: 'adult-required' });
    expect(parseReminderRequest({ email: 'a@b.co', month: 2, day: 30, consent: true, adult: true })).toEqual({ refused: 'invalid-date' });
    expect(parseReminderRequest({ email: 'a@b.co', month: 2, day: 29, consent: true, adult: true })).toEqual({ email: 'a@b.co', month: 2, day: 29 });
    expect(parseReminderRequest({ email: 'not-an-email', month: 5, day: 3, consent: true, adult: true })).toEqual({ refused: 'invalid-email' });
  });
});

describe('the birthday send', () => {
  it('sends 29 February birthdays on 28 February in other years', () => {
    expect(birthdaysOn('2027-02-28')).toEqual([{ month: 2, day: 28 }, { month: 2, day: 29 }]);
    expect(birthdaysOn('2028-02-28')).toEqual([{ month: 2, day: 28 }]);
    expect(birthdaysOn('2028-02-29')).toEqual([{ month: 2, day: 29 }]);
  });
  it('signs unsubscribe tokens so nothing extra is stored, and refuses a forged one', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const token = unsubscribeToken(id, SECRET);
    expect(readUnsubscribeToken(token, SECRET)).toBe(id);
    expect(readUnsubscribeToken(token, 'y'.repeat(40))).toBeNull();
    expect(readUnsubscribeToken(`${id}.${'A'.repeat(43)}`, SECRET)).toBeNull();
  });
  it('stores only a hash of the confirmation token', () => {
    const { token, hash } = newConfirmToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
  });
  it('words both emails plainly, with no dashes and no birth details', () => {
    const texts = [confirmationEmail('https://zodiacs.org/api/email/birthday-reminder?confirm=t'), birthdayEmail('https://zodiacs.org', 'https://zodiacs.org/api/email/birthday-reminder?unsubscribe=u')];
    for (const email of texts) expect(`${email.subject} ${email.text}`).not.toMatch(/[–—]/u);
    expect(texts[1].text).toContain('https://zodiacs.org/year-score/');
    expect(texts[1].text).toContain('Stop these birthday emails');
  });
});

describe('the switch', () => {
  it('is off unless BIRTHDAY_REMINDER_ENABLED is exactly 1 and everything it needs is set', () => {
    expect(birthdayReminderEnabled({})).toBe(false);
    expect(birthdayReminderEnabled({ ...ENV, BIRTHDAY_REMINDER_ENABLED: 'true' })).toBe(false);
    expect(birthdayReminderEnabled({ ...ENV, BIRTHDAY_REMINDER_SECRET: 'short' })).toBe(false);
    expect(birthdayReminderEnabled({ ...ENV, PUBLIC_YEAR_SCORE_ENABLED: undefined })).toBe(false);
    expect(birthdayReminderEnabled({ ...ENV, PUBLIC_YEAR_SCORE_ENABLED: 'true' })).toBe(false);
    expect(birthdayReminderEnabled(ENV)).toBe(true);
  });
});
