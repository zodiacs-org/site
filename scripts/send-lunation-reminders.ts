/**
 * Moon journal reminders: on the UTC day of a new or full Moon, one
 * notification to each browser that opted in on /moon-journal/, linking back
 * to the journal. On every other day it sends nothing and reads nothing.
 *
 *   npx vite-node --script scripts/send-lunation-reminders.ts --dry-run --fixture --date 2026-11-09
 *
 * Reuses the Sky Alerts delivery path in send-daily-push.mjs: the same
 * push_subscriptions rows (only those with lunation_reminders), the same
 * durable per-endpoint claim (one notification a UTC day, two a rolling week,
 * shared with Sky Alerts) and the same real-send gates (PUSH_ENABLED=true or
 * an explicit PUSH_TEST_SUBSCRIPTION_IDS allowlist, current UTC day only).
 *
 * The lunation instants are the committed sky data (src/data/sky.json); the
 * sign is read from the full engine at that instant, exactly as the journal
 * page reads it at build time.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import webPush from 'web-push';
import sky from '../src/data/sky.json';
import { bodyLongitude } from '../src/lib/engine/full';
import { SIGNS, signForLongitude } from '../src/lib/signs';
import {
  buildLunationReminder,
  lunationOnUtcDay,
  reminderEventId,
  type SkyMoon,
} from '../src/lib/moon-journal/reminders';
import type { Lunation, SignSlug } from '../src/lib/moon-journal/types';
import {
  authorizeRealDelivery,
  createPushClaimStore,
  deliverToSubscriptions,
  parseOptions,
  readSubscriptions,
} from './send-daily-push.mjs';

const LABEL = 'moon-journal';

export interface LunationReport {
  event: string | null;
  considered: number;
  reserved: number;
  capped: number;
  held: number;
  duplicate: number;
  missing: number;
  stale: number;
  sent: number;
  pruned: number;
  failed: number;
  dryRun: number;
}

function emptyReport(event: string | null): LunationReport {
  return {
    event,
    considered: 0,
    reserved: 0,
    capped: 0,
    held: 0,
    duplicate: 0,
    missing: 0,
    stale: 0,
    sent: 0,
    pruned: 0,
    failed: 0,
    dryRun: 0,
  };
}

/** The Moon's sign at an instant, from the full engine. */
export function moonSignAt(at: string): SignSlug {
  return signForLongitude(bodyLongitude('Moon', new Date(at))).slug as SignSlug;
}

const SIGN_NAMES = Object.fromEntries(SIGNS.map((sign) => [sign.slug, sign.name])) as Record<SignSlug, string>;

/** The lunation on a UTC day, with its sign, or null when the day has none. */
export function lunationForDay(
  moons: readonly SkyMoon[],
  date: Date,
  signOf: (at: string) => SignSlug = moonSignAt,
): Lunation | null {
  const moon = lunationOnUtcDay(moons, date);
  return moon ? { type: moon.type, at: moon.at, sign: signOf(moon.at) } : null;
}

interface RunOptions {
  moons: readonly SkyMoon[];
  date: Date;
  now?: Date;
  dryRun?: boolean;
  /** Read only when the day holds a lunation. */
  loadSubscriptions: () => Promise<unknown[]>;
  claims: unknown;
  sendNotification: unknown;
  signOf?: (at: string) => SignSlug;
  log?: (line: string) => void;
}

/**
 * Send the day's reminder, if the day has a lunation. A day without one
 * returns before any subscription is read.
 */
export async function runLunationReminders({
  moons,
  date,
  now = new Date(),
  dryRun = false,
  loadSubscriptions,
  claims,
  sendNotification,
  signOf = moonSignAt,
  log = console.log,
}: RunOptions): Promise<LunationReport> {
  const lunation = lunationForDay(moons, date, signOf);
  if (!lunation) return emptyReport(null);
  const eventId = reminderEventId(lunation);
  const report = emptyReport(eventId);
  const payload = JSON.stringify(buildLunationReminder(lunation, (slug) => SIGN_NAMES[slug] ?? slug));
  const subscriptions = await loadSubscriptions();
  await deliverToSubscriptions({
    subscriptions,
    eventId,
    payload,
    now,
    dryRun,
    claims,
    sendNotification,
    report,
    log,
    label: LABEL,
  });
  return report;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (options.verifyLiveOnly) throw new Error('--verify-live-only applies to Sky Alerts only.');
  const moons = (sky as { moons: SkyMoon[] }).moons;
  const day = options.date.toISOString().slice(0, 10);
  if (!lunationOnUtcDay(moons, options.date)) {
    console.log(`${LABEL}: no new or full Moon on ${day}; nothing sent`);
    return;
  }
  if (!options.dryRun && day !== new Date().toISOString().slice(0, 10)) {
    throw new Error('A real reminder may only send the current UTC day; use --dry-run for other dates.');
  }

  const url = process.env.PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const loadSubscriptions = async () => {
    if (options.fixture) {
      return [{
        endpoint: 'https://push.example.test/subscription',
        subscription_id: 1,
        p256dh: 'fixture-public-key',
        auth: 'fixture-auth-key',
        lang: 'en',
      }];
    }
    if (!url || !serviceKey) throw new Error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    const subscriptionIds = options.dryRun ? [] : authorizeRealDelivery();
    return readSubscriptions(fetch, url, serviceKey, options.limit, subscriptionIds, 'lunation');
  };

  if (!options.dryRun) {
    const subject = process.env.VAPID_SUBJECT;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!url || !serviceKey || !subject || !publicKey || !privateKey) {
      throw new Error('Supabase and VAPID configuration are required to send.');
    }
    webPush.setVapidDetails(subject, publicKey, privateKey);
  }

  const claims = options.dryRun || !url || !serviceKey
    ? { claim: async () => { throw new Error('Dry run attempted to claim.'); }, complete: async () => {} }
    : createPushClaimStore(fetch, url, serviceKey);
  const report = await runLunationReminders({
    moons,
    date: options.date,
    now: new Date(),
    dryRun: options.dryRun,
    loadSubscriptions,
    claims,
    sendNotification: webPush.sendNotification.bind(webPush),
  });
  console.log(
    `${LABEL}: done event=${report.event ?? 'none'} considered=${report.considered} reserved=${report.reserved} `
    + `sent=${report.sent} capped=${report.capped} duplicate=${report.duplicate} missing=${report.missing} stale=${report.stale} `
    + `pruned=${report.pruned} failed=${report.failed} dryRun=${report.dryRun}`,
  );
  if (report.failed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
