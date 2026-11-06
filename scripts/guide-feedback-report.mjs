#!/usr/bin/env node
/**
 * Prints Guide's daily answer votes (public.guide_feedback_daily, migration
 * 20261106015900_guide_feedback_daily.sql) for the last 7 or 30 UTC days.
 * Read only: one GET through the Supabase REST API with the service role.
 *
 *   PUBLIC_SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/guide-feedback-report.mjs [--days 7|30]
 *
 * The key is read from the environment and only ever sent to that URL; it is
 * never printed, and neither is the URL.
 */
import { pathToFileURL } from 'node:url';

export const REPORT_DAYS = [7, 30];

export function parseDays(argv) {
  const index = argv.indexOf('--days');
  if (index < 0) return 7;
  const days = Number(argv[index + 1]);
  if (!REPORT_DAYS.includes(days)) throw new Error('--days must be 7 or 30');
  return days;
}

/** The first UTC day of a window of `days` days ending today, as YYYY-MM-DD. */
export function windowStart(now, days) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - (days - 1) * 86_400_000).toISOString().slice(0, 10);
}

export function serviceRequest(env) {
  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (typeof url !== 'string' || !/^https:\/\/[A-Za-z0-9.-]+\/?$/u.test(url)) {
    throw new Error('Set PUBLIC_SUPABASE_URL to the project URL (https://<project>.supabase.co).');
  }
  if (typeof key !== 'string' || key.length < 24) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY in the environment.');
  }
  const headers = { apikey: key, accept: 'application/json', 'cache-control': 'no-store' };
  if (!key.startsWith('sb_secret_')) headers.authorization = `Bearer ${key}`;
  return { base: url.replace(/\/+$/u, ''), headers };
}

/** One line per day, oldest first, with every day of the window shown. */
export function formatReport(rows, now, days) {
  const start = windowStart(now, days);
  const byDay = new Map();
  for (const row of rows) {
    if (typeof row?.day !== 'string' || (row.vote !== 'up' && row.vote !== 'down')) continue;
    const votes = Number(row.votes);
    if (!Number.isSafeInteger(votes) || votes < 0) continue;
    const entry = byDay.get(row.day) ?? { up: 0, down: 0 };
    entry[row.vote] += votes;
    byDay.set(row.day, entry);
  }
  const lines = [`Guide answer votes, last ${days} UTC days`, '', 'Day          Up  Down'];
  let up = 0;
  let down = 0;
  for (let index = 0; index < days; index += 1) {
    const day = new Date(Date.parse(`${start}T00:00:00Z`) + index * 86_400_000).toISOString().slice(0, 10);
    const entry = byDay.get(day) ?? { up: 0, down: 0 };
    up += entry.up;
    down += entry.down;
    lines.push(`${day} ${String(entry.up).padStart(5)} ${String(entry.down).padStart(5)}`);
  }
  const total = up + down;
  lines.push('', `Total      ${String(up).padStart(5)} ${String(down).padStart(5)}`);
  lines.push(total ? `Up share   ${Math.round((up / total) * 100)}% of ${total} votes` : 'No votes in this window.');
  return lines.join('\n');
}

export async function fetchRows({ env, fetcher = fetch, now = new Date(), days = 7 }) {
  const { base, headers } = serviceRequest(env);
  const query = new URLSearchParams({ select: 'day,vote,votes', day: `gte.${windowStart(now, days)}`, order: 'day.asc' });
  const response = await fetcher(`${base}/rest/v1/guide_feedback_daily?${query}`, { headers });
  if (!response.ok) throw new Error(`Supabase answered ${response.status}; is the guide_feedback_daily migration applied?`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Unexpected response from Supabase.');
  return rows;
}

async function main() {
  const days = parseDays(process.argv.slice(2));
  const now = new Date();
  const rows = await fetchRows({ env: process.env, now, days });
  console.log(formatReport(rows, now, days));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    // Our own messages only: never echo a request, header or key.
    console.error(`guide-feedback-report: ${error instanceof Error ? error.message : 'failed'}`);
    process.exit(1);
  });
}
