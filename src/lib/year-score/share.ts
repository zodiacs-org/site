/**
 * Share links for the Year Ahead Score, read by the share page and preview
 * image in src/server/result-preview.ts. As with the site's other share links
 * (src/ai-tools/share-links.ts), a query carries only what its picture shows:
 *
 * - a person's own score: the Sun sign and the score, nothing else. Never a
 *   birth date, a time, a place or a name;
 * - a public figure from the Year Ahead directory: the slug, and the month the
 *   twelve months start from (m=YYYY-MM), so a posted card keeps its number
 *   when the month turns. The server scores the figure itself, so a link
 *   cannot put a made-up number beside a real person's name. A month is
 *   accepted only with a slug, and only from 11 months back up to this month
 *   (UTC); an older link without m scores from this month.
 *
 * Every value is checked against a fixed vocabulary or pattern, each key once;
 * a query with anything else is not a share. Pure: no network, storage or
 * logging.
 */
import { readShareRef, SHARE_SIGNS, type ShareRef, type ShareSign } from '../share-results.js';

export const YEAR_SCORE_SHARE_PATH = '/share/year-score/';
export const YEAR_SCORE_SHARE_IMAGE_PATH = '/api/og/year-score-image';
export const YEAR_SCORE_SHARE_KEYS: readonly string[] = Object.freeze(['s', 'v', 'p', 'm', 'ref']);

export type YearScoreShare =
  | { kind: 'self'; sun: ShareSign; score: number; ref: ShareRef | null }
  | { kind: 'figure'; slug: string; month: string | null; ref: ShareRef | null };

const SCORE_RE = /^(?:10\.0|\d\.\d)$/u;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MONTH_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/u;

/** The oldest and newest start month a figure's link may carry: 11 months back up to this month, UTC. */
export function figureShareMonthWindow(now: Date): { oldest: string; newest: string } {
  const newest = now.toISOString().slice(0, 7);
  const oldestDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  return { oldest: oldestDate.toISOString().slice(0, 7), newest };
}
const monthInWindow = (month: string, now: Date) => {
  if (!MONTH_RE.test(month)) return false;
  const { oldest, newest } = figureShareMonthWindow(now);
  return month >= oldest && month <= newest;
};
const isSign = (value: unknown): value is ShareSign => typeof value === 'string' && (SHARE_SIGNS as readonly string[]).includes(value);

export function yearScoreQuery(share: YearScoreShare, withRef = false): string {
  const params = share.kind === 'self' ? new URLSearchParams({ s: share.sun, v: share.score.toFixed(1) }) : new URLSearchParams({ p: share.slug });
  if (share.kind === 'figure' && share.month) params.set('m', share.month);
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

/** A person's own score: the Sun sign and the score only. Null without a settled Sun or a score in range. */
export function yearScoreShareUrl(origin: string, you: { sun: string | null; score: number }): string | null {
  if (!isSign(you.sun) || !Number.isFinite(you.score) || you.score < 0 || you.score > 10) return null;
  return `${origin}${YEAR_SCORE_SHARE_PATH}?${yearScoreQuery({ kind: 'self', sun: you.sun, score: Math.round(you.score * 10) / 10, ref: null })}`;
}

/** A directory figure's score: the slug, and the month the twelve months start from (YYYY-MM) when given. */
export function figureYearScoreShareUrl(origin: string, slug: string, month?: string): string | null {
  if (!SLUG_RE.test(slug) || slug.length > 64 || (month !== undefined && !MONTH_RE.test(month))) return null;
  return `${origin}${YEAR_SCORE_SHARE_PATH}?${yearScoreQuery({ kind: 'figure', slug, month: month ?? null, ref: null })}`;
}

export function parseYearScoreShare(params: URLSearchParams, now: Date = new Date()): YearScoreShare | null {
  const fields = new Map<string, string>();
  for (const [key, value] of params) {
    if (!YEAR_SCORE_SHARE_KEYS.includes(key) || fields.has(key)) return null;
    fields.set(key, value);
  }
  const shareRef = readShareRef(fields.get('ref'));
  if (shareRef === undefined) return null;
  const slug = fields.get('p');
  if (slug !== undefined) {
    // A figure's link carries the slug and at most a start month: its sign and score come from the server.
    if (fields.has('s') || fields.has('v') || slug.length > 64 || !SLUG_RE.test(slug)) return null;
    const month = fields.get('m');
    if (month !== undefined && !monthInWindow(month, now)) return null;
    return { kind: 'figure', slug, month: month ?? null, ref: shareRef };
  }
  // A start month belongs to a figure's link only.
  if (fields.has('m')) return null;
  const sun = fields.get('s');
  const score = fields.get('v');
  if (!isSign(sun) || score === undefined || !SCORE_RE.test(score)) return null;
  return { kind: 'self', sun, score: Number(score), ref: shareRef };
}
