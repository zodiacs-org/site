import { describe, expect, it } from 'vitest';
import { birthdayEmail, birthdayEmailKey, birthdaysOn, birthdaysToSend, confirmationEmail, hashToken, newConfirmToken, parseReminderRequest, readUnsubscribeToken, unsubscribeToken } from './core';
import { birthdayReminderEnabled } from './config';

const SECRET = 'x'.repeat(40);
const ENV = { BIRTHDAY_REMINDER_ENABLED: '1', PUBLIC_BIRTHDAY_REMINDER_ENABLED: '1', PUBLIC_YEAR_SCORE_ENABLED: '1', PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service', RESEND_API_KEY: 'resend', RESEND_FROM_EMAIL: 'Zodiacs.org <hello@zodiacs.org>', BIRTHDAY_REMINDER_SECRET: SECRET };

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
    const texts = [confirmationEmail('https://zodiacs.org/api/email/birthday-reminder?confirm=t', 'https://zodiacs.org/api/email/birthday-reminder?unsubscribe=u'), birthdayEmail('https://zodiacs.org', 'https://zodiacs.org/api/email/birthday-reminder?unsubscribe=u', 'Zodiacs.org, Test Address')];
    for (const email of texts) expect(`${email.subject} ${email.text}`).not.toMatch(/[\u2013\u2014‒―]/u);
    expect(texts[1].text).toContain('https://zodiacs.org/year-score/');
    expect(texts[1].text).toContain('Stop these birthday emails');
  });
  it('ends the birthday email with the postal address and says nothing false about the solar return', () => {
    const { text } = birthdayEmail('https://zodiacs.org', 'https://zodiacs.org/api/email/birthday-reminder?unsubscribe=u', 'Zodiacs.org, Test Address');
    expect(text.split('\n').slice(-2)).toEqual(['', 'Zodiacs.org, Test Address']);
    expect(text).toContain('Your solar return falls on or within a day of your birthday: the Sun comes back to where it was when you were born, and a new year of your chart begins.');
    expect(text).not.toContain('has come round');
    expect(text).not.toMatch(/[\u2013\u2014‒―]/u);
  });
  it('asks for yesterday’s birthdays too, so a skipped run is caught up the next day', () => {
    const key = (days: { month: number; day: number }[]) => days.map(({ month, day }) => `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`).sort();
    // 1 March of a year without a 29th: what 28 February would have sent, the 29th included.
    expect(key(birthdaysToSend('2027-03-01'))).toEqual(['02-28', '02-29', '03-01']);
    expect(key(birthdaysToSend('2028-03-01'))).toEqual(['02-29', '03-01']);
    expect(key(birthdaysToSend('2027-02-28'))).toEqual(['02-27', '02-28', '02-29']);
    expect(key(birthdaysToSend('2027-01-01'))).toEqual(['01-01', '12-31']);
    expect(key(birthdaysToSend('2026-11-16'))).toEqual(['11-15', '11-16']);
  });
  it('keys each email on the birthday it celebrates, so a catch-up across the new year cannot send twice', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    // A 31 December birthday: the run on the day and the 1 January catch-up share one key.
    expect(birthdayEmailKey(id, '2026-12-31', 12, 31)).toBe(`birthday-reminder/${id}/2026-12-31`);
    expect(birthdayEmailKey(id, '2027-01-01', 12, 31)).toBe(`birthday-reminder/${id}/2026-12-31`);
    expect(birthdayEmailKey(id, '2027-01-01', 1, 1)).toBe(`birthday-reminder/${id}/2027-01-01`);
    // A 29 February birthday in a year without one is celebrated on the 28th, on the day or caught up on 1 March.
    expect(birthdayEmailKey(id, '2027-02-28', 2, 29)).toBe(`birthday-reminder/${id}/2027-02-28`);
    expect(birthdayEmailKey(id, '2027-03-01', 2, 29)).toBe(`birthday-reminder/${id}/2027-02-28`);
    // The next year's birthday is a new key.
    expect(birthdayEmailKey(id, '2027-12-31', 12, 31)).not.toBe(birthdayEmailKey(id, '2026-12-31', 12, 31));
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
