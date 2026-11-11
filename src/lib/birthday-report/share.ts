/**
 * The Birthday report's share link, read by src/server/result-preview.ts. It
 * carries what its picture shows and nothing that leads back to a birth date:
 * the Sun sign, the Year Ahead Score, the Personal Year number (1 to 9) and
 * the tarot year card's number (0 to 21). Never a date, a time, a place or a
 * name. Each key once, each value from a fixed pattern. Pure.
 */
import { SHARE_SIGNS, type ShareRef, type ShareSign } from '../share-results.js';

export const BIRTHDAY_REPORT_SHARE_PATH = '/share/birthday-report/';
export const BIRTHDAY_REPORT_SHARE_IMAGE_PATH = '/api/og/birthday-report-image';
export const BIRTHDAY_REPORT_SHARE_KEYS: readonly string[] = Object.freeze(['s', 'v', 'py', 't', 'ref']);

export interface BirthdayReportShare { sun: ShareSign; score: number; personalYear: number; card: number; ref: ShareRef | null }

const isSign = (value: unknown): value is ShareSign => typeof value === 'string' && (SHARE_SIGNS as readonly string[]).includes(value);

export function birthdayReportQuery(share: BirthdayReportShare, withRef = false): string {
  const params = new URLSearchParams({ s: share.sun, v: share.score.toFixed(1), py: String(share.personalYear), t: String(share.card) });
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function birthdayReportShareUrl(origin: string, report: { sun: string; score: number; personalYear: number; card: number }): string | null {
  if (!isSign(report.sun) || !(report.score >= 0 && report.score <= 10) || !Number.isInteger(report.personalYear) || report.personalYear < 1 || report.personalYear > 9 || !Number.isInteger(report.card) || report.card < 0 || report.card > 21) return null;
  return `${origin}${BIRTHDAY_REPORT_SHARE_PATH}?${birthdayReportQuery({ sun: report.sun, score: Math.round(report.score * 10) / 10, personalYear: report.personalYear, card: report.card, ref: null })}`;
}

export function parseBirthdayReportShare(params: URLSearchParams): BirthdayReportShare | null {
  const fields = new Map<string, string>();
  for (const [key, value] of params) {
    if (!BIRTHDAY_REPORT_SHARE_KEYS.includes(key) || fields.has(key)) return null;
    fields.set(key, value);
  }
  const [sun, score, py, card, ref] = ['s', 'v', 'py', 't', 'ref'].map((key) => fields.get(key));
  if (!isSign(sun) || !score || !/^(?:10\.0|\d\.\d)$/u.test(score) || !py || !/^[1-9]$/u.test(py) || !card || !/^(?:1?\d|2[01])$/u.test(card)) return null;
  if (ref !== undefined && ref !== 'chatgpt' && ref !== 'assistant') return null;
  return { sun, score: Number(score), personalYear: Number(py), card: Number(card), ref: (ref ?? null) as ShareRef | null };
}
