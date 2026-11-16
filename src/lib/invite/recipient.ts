/**
 * The invite recipient's side, in the browser: how old the birth date they
 * typed for themselves is, and their own daily email opt-in. The date
 * never leaves the page; only the band decides what is offered:
 *
 * - under 13: refused before anything is worked out, and nothing is sent;
 * - 13 to 17: refused the same way, as get_compatibility gives no reading
 *   under 18 (ZOD-22): the synastry result speaks of attraction and romance;
 * - 18 and over: the result, then a separate daily email opt-in if they want it.
 *
 * An invitation opened from a link or pasted positions has no birth date to
 * check, so it asks for the recipient's own date instead.
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
export const UNDER_18_INVITE = 'Zodiacs does not give compatibility readings for anyone under 18. Nothing you typed has been sent anywhere.';
export const NO_DATE_INVITE = 'To open this invitation, enter your own birth date rather than a link, so we can check it is for you.';
/**
 * Whether an invitation's reading may be worked out for this recipient, from
 * the birth date they gave for themselves (YYYY-MM-DD, or nothing for a link
 * or pasted positions) and today on this device. Only an adult gets a reading;
 * everyone else gets a fixed message and nothing is worked out or sent.
 */
export type InviteRecipientGate = { allowed: true; band: 'adult' } | { allowed: false; band: RecipientBand | null; message: string };
export function inviteRecipientGate(ownDate: string | null | undefined, today: string): InviteRecipientGate {
  if (typeof ownDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(ownDate)) return { allowed: false, band: null, message: NO_DATE_INVITE };
  const band = recipientBand(ownDate, today);
  if (band === 'under13') return { allowed: false, band, message: UNDER_13_INVITE };
  if (band === 'minor') return { allowed: false, band, message: UNDER_18_INVITE };
  return { allowed: true, band };
}

export const RECIPIENT_CONSENT_LABEL = 'These are my own birth details, and I am 13 or older.';

export type DailySignupOutcome = 'sent' | 'error';

/**
 * The recipient's own daily horoscope email, after their reading: a plain
 * opt-in through the same public subscribe route as every daily signup form
 * on the site (api/email/subscribe.ts), with its own double opt-in. It carries
 * the address, the sign they chose and the two yeses they ticked; no invite
 * handle, session or birth detail, so it has no link to the invitation, which
 * completed when the reading was made.
 */
export async function requestDailySignup(email: string, sign: string, fetcher: typeof fetch = fetch): Promise<DailySignupOutcome> {
  try {
    const response = await fetcher('/api/email/subscribe', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, sign, consent: true, adult: true }),
    });
    return response.ok ? 'sent' : 'error';
  } catch {
    return 'error';
  }
}
