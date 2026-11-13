/**
 * "Remember my sign": the visitor's Sun sign, kept only on this device. It is
 * a single sign slug, never a birth date, time or place, so it can be used
 * anywhere on the site (and typed into a Guide question) without revealing
 * birth details. Inline scripts on the homepage read the same key; keep
 * `MY_SIGN_KEY` and `MY_SIGN_EVENT` in step with them.
 */
export const MY_SIGN_KEY = 'zodiacs.my-sign.v1';
/** Fired on window whenever the remembered sign changes in this tab. */
export const MY_SIGN_EVENT = 'zodiacs:my-sign';

export const SIGN_SLUGS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const;
export type SignSlug = (typeof SIGN_SLUGS)[number];

export function isSignSlug(value: unknown): value is SignSlug {
  return typeof value === 'string' && (SIGN_SLUGS as readonly string[]).includes(value);
}

export function readMySign(): SignSlug | null {
  try {
    const value = localStorage.getItem(MY_SIGN_KEY);
    return isSignSlug(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberMySign(sign: SignSlug | null): boolean {
  try {
    if (sign) localStorage.setItem(MY_SIGN_KEY, sign);
    else localStorage.removeItem(MY_SIGN_KEY);
  } catch {
    return false;
  }
  try { window.dispatchEvent(new CustomEvent(MY_SIGN_EVENT, { detail: sign })); } catch { /* old browsers */ }
  return true;
}
