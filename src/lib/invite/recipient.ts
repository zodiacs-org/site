/**
 * The invite recipient's side, in the browser: how old the birth date they
 * typed for themselves is, and their request for the opt-in signup. The date
 * never leaves the page; only the band decides what is offered:
 *
 * - under 13: refused before anything is worked out, and nothing is sent;
 * - 13 to 17: the result, and no signup offered;
 * - 18 and over: the result, then the opt-in signup if they want it.
 *
 * The same rule as src/ai-tools/features/reading-guards.ts (isUnderAge), kept
 * here because pages may not import the assistant tools.
 */
export type RecipientBand = 'under13' | 'minor' | 'adult';

/** Under `years` on `today` (both YYYY-MM-DD): the birthday that many years on has not come, or the date is still to come. */
function isUnderAge(birthDate: string, today: string, years: number): boolean {
  return birthDate > `${String(Number(today.slice(0, 4)) - years).padStart(4, '0')}${today.slice(4)}`;
}

export function recipientBand(birthDate: string, today: string): RecipientBand {
  if (isUnderAge(birthDate, today, 13)) return 'under13';
  return isUnderAge(birthDate, today, 18) ? 'minor' : 'adult';
}

/** Today's date on this device's clock, as YYYY-MM-DD. */
export function deviceToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const UNDER_13_INVITE = 'Zodiacs is not directed at children under 13, so this reading is not worked out for a birth date less than 13 years ago. Nothing you typed has been sent anywhere.';
export const RECIPIENT_CONSENT_LABEL = 'These are my own birth details, and I am 13 or older.';

export type InviteSignupOutcome = 'pending' | 'unavailable' | 'error';

/** Ask for the opt-in signup. The body is the address, their own Sun sign and the two yeses; nothing else. */
export async function requestInviteSignup(handle: string, email: string, sign: string, fetcher: typeof fetch = fetch): Promise<InviteSignupOutcome> {
  if (!/^[A-Za-z0-9_-]{22}$/u.test(handle)) return 'unavailable';
  try {
    const response = await fetcher(`/api/compatibility/invite-signup?session=${encodeURIComponent(handle)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, sign, consent: true, adult: true }),
    });
    if (!response.ok) return 'error';
    const value = await response.json() as { outcome?: unknown };
    return value.outcome === 'pending' ? 'pending' : 'unavailable';
  } catch {
    return 'error';
  }
}
