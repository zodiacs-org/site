/**
 * The Birthday report's share link, read by src/server/result-preview.ts.
 * It carries the Sun sign, the score and the tarot year card. The card
 * narrows the birthday to a few dates within the sign; it never carries a
 * date, a time, a place or a name. Each key once, each value from a fixed
 * pattern. Pure.
 */
import { readShareRef, SHARE_SIGNS, type ShareRef, type ShareSign } from '../share-results.js';

export const BIRTHDAY_REPORT_SHARE_PATH = '/share/birthday-report/';
export const BIRTHDAY_REPORT_SHARE_IMAGE_PATH = '/api/og/birthday-report-image';
export const BIRTHDAY_REPORT_SHARE_KEYS: readonly string[] = Object.freeze(['s', 'v', 't', 'ref']);

export interface BirthdayReportShare { sun: ShareSign; score: number; card: number; ref: ShareRef | null }

const isSign = (value: unknown): value is ShareSign => typeof value === 'string' && (SHARE_SIGNS as readonly string[]).includes(value);

export function birthdayReportQuery(share: BirthdayReportShare, withRef = false): string {
  const params = new URLSearchParams({ s: share.sun, v: share.score.toFixed(1), t: String(share.card) });
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function birthdayReportShareUrl(origin: string, report: { sun: string; score: number; card: number }): string | null {
  if (!isSign(report.sun) || !(report.score >= 0 && report.score <= 10) || !Number.isInteger(report.card) || report.card < 0 || report.card > 21) return null;
  return `${origin}${BIRTHDAY_REPORT_SHARE_PATH}?${birthdayReportQuery({ sun: report.sun, score: Math.round(report.score * 10) / 10, card: report.card, ref: null })}`;
}

export function parseBirthdayReportShare(params: URLSearchParams): BirthdayReportShare | null {
  const fields = new Map<string, string>();
  for (const [key, value] of params) {
    if (!BIRTHDAY_REPORT_SHARE_KEYS.includes(key) || fields.has(key)) return null;
    fields.set(key, value);
  }
  const [sun, score, card, ref] = ['s', 'v', 't', 'ref'].map((key) => fields.get(key));
  if (!isSign(sun) || !score || !/^(?:10\.0|\d\.\d)$/u.test(score) || !card || !/^(?:1?\d|2[01])$/u.test(card)) return null;
  const shareRef = readShareRef(ref);
  if (shareRef === undefined) return null;
  return { sun, score: Number(score), card: Number(card), ref: shareRef };
}
