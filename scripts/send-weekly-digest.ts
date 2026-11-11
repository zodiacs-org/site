#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  createDigestUnsubscribeCapability,
  hashDigestUnsubscribeCapability,
} from '../src/lib/server/digest-unsubscribe';
import { computeBodies } from '../src/lib/engine/full';
import { findInterAspects, type InterAspect, type MinimalBody } from '../src/lib/engine/synastry';
import { BODY_ROLE } from '../src/lib/compat';
import {
  renderEmailHtml,
  renderEmailText,
  type EmailDocument,
  type EmailSection,
} from '../src/lib/email/template';
import { SIGNS } from '../src/lib/signs';
import { loadChartEmailSources } from '../src/lib/account-api/chart-sources';
import {
  authorizeWithFreshContent,
  decryptDigestChart,
  type DigestChart,
  type DigestChartReference,
} from '../src/lib/weekly-digest/chart-edition';
import { futurePublishedEvents } from '../src/lib/events/site-publication';
import {
  buildWeeklyDigestRequestEnvelope,
  createWeeklyDigestResendRequest,
  openWeeklyDigestRequestEnvelope,
  sealWeeklyDigestRequestEnvelope,
  sendWeeklyDigestEnvelope,
  WeeklyDigestProviderAbortError,
  weeklyDigestEnvelopeDigest,
  type WeeklyDigestProviderResult,
  type WeeklyDigestRequestEnvelope,
} from '../src/lib/weekly-digest/delivery';
import { ResendRequestWithdrawnError } from '../src/lib/daily-email/resend-request';
import {
  dispatchWeeklyWithRecheck,
  weeklyAttemptGuard,
  weeklyDispatchRecheck,
  WeeklyDispatchRecheckError,
  type WeeklyDispatchOutcome,
  type WeeklyDispatchRecheck,
} from '../src/lib/weekly-digest/dispatch-recheck';

/** Rebuilding a released delivery failed; its reservation was cancelled. */
class WeeklyPreparationError extends Error {
  constructor() {
    super('Weekly digest preparation failed after its reservation was cancelled.');
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DIGEST_ORB = 3;
const HARD_SEND_CEILING = 80;
const DEFAULT_LIMIT = HARD_SEND_CEILING;
const DEFAULT_CHARTS_PER_USER = 5;
const UNSUBSCRIBE_TOKEN_TTL_DAYS = 400;
const DRY_RUN_UNSUBSCRIBE_TOKEN = 'A'.repeat(43);
const MAX_CHARTS_PER_USER = 5;
const MAX_SEALED_ENVELOPE_CHARS = 262_144;
const RESEND_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1_000;
const RESEND_IDEMPOTENCY_SAFETY_MARGIN_MS = 60 * 1_000;
const SAFE_PROVIDER_CODE = /^[a-z][a-z0-9_]{0,63}$/u;
const SHA256_HEX = /^[0-9a-f]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;

const TRANSIT_BODIES = new Set(['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);

interface CliOptions {
  dryRun: boolean;
  /** Send to exactly the recipient named by DIGEST_CANARY_TO, or to nobody. */
  canary: boolean;
  fixture: boolean;
  recoveryOnly: boolean;
  limit: number | null;
  weekStart: Date | null;
}

/** The content snapshot, as weekly_digest_content_v1 returns it; nothing decrypted. */
interface RecipientContent {
  userId: string;
  email: string;
  /** Present only while the account holds chart_sync and chart_emails. */
  chartReference: DigestChartReference | null;
  contentDigest: string;
}

interface RecipientDigest extends RecipientContent {
  /** The decrypted chart for this run (zero or one); empty means the sky edition. */
  charts: DigestChart[];
}

/** Counts only; never a label, a birth field or an address. */
const chartDecryption = { attempted: 0, failed: 0 };

interface WeeklyReservation {
  leaseToken: string;
  unsubscribeToken: string;
}

type WeeklyRecovery =
  | { outcome: 'reconciliation' }
  | {
    outcome: 'claimed';
    weekStart: string;
    userId: string;
    leaseToken: string;
    idempotencyKey: string;
    envelopeDigest: string;
    sealedEnvelope: string;
    dispatchStartedAt: string;
  };

interface DigestTransit {
  date: Date;
  aspect: InterAspect;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    canary: false,
    fixture: false,
    recoveryOnly: false,
    limit: null,
    weekStart: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--canary') options.canary = true;
    else if (arg === '--fixture') options.fixture = true;
    else if (arg === '--recovery-only') options.recoveryOnly = true;
    else if (arg === '--limit') options.limit = positiveInt(argv[++i], '--limit');
    else if (arg === '--week-start') options.weekStart = parseDate(requiredValue(argv[++i], '--week-start'));
    else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.fixture && !options.dryRun) {
    throw new Error('--fixture is synthetic output and requires --dry-run.');
  }
  if (options.recoveryOnly && options.dryRun) {
    throw new Error('--recovery-only is available only for live fenced deliveries.');
  }
  if (options.canary) {
    // The canary is the runbook's limit-one owner send made first-class: it
    // can only ever reach the one recipient named in the environment, and
    // a typo in --limit cannot widen it.
    if (options.fixture) throw new Error('--canary selects a real candidate; it cannot be combined with --fixture.');
    if (options.recoveryOnly) throw new Error('--canary creates one new delivery; it cannot be combined with --recovery-only.');
    if (options.limit !== null && options.limit !== 1) throw new Error('--canary always sends at most one message; drop --limit or set it to 1.');
    options.limit = 1;
  }

  return options;
}

/** The canary recipient comes from a secret, never the command line, and is only ever logged as a hash prefix. */
function canaryRecipient(value: string | undefined, name: string): string {
  const email = (value ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new Error(`${name} must hold the canary recipient's email address when --canary is used.`);
  }
  return email;
}

function recipientHashPrefix(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);
}

/** Narrow this week's bounded candidates to the one canary recipient, or send to nobody. */
async function canaryCandidates(
  supabase: DigestSupabase,
  candidateIds: string[],
  maxCharts: number,
  canaryTo: string,
): Promise<string[]> {
  for (const userId of candidateIds) {
    const recipient = await readRecipientContent(supabase, userId, maxCharts);
    if (recipient && recipient.email.trim().toLowerCase() === canaryTo) return [userId];
  }
  throw new Error(
    `weekly-digest: the canary recipient is not among this week's ${candidateIds.length} bounded candidate(s); nothing sent`,
  );
}

function requiredValue(value: string | undefined, flag: string): string {
  if (!value) throw new Error(`${flag} needs a value`);
  return value;
}

function positiveInt(value: string | undefined, flag: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} needs a positive integer`);
  return n;
}

function envInt(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n > maximum) {
    throw new Error(`${name} must be an integer from 1 through ${maximum}.`);
  }
  return n;
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('--week-start must be YYYY-MM-DD');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('--week-start must be a real date');
  }
  if (date.getUTCDay() !== 1) throw new Error('--week-start must be a Monday');
  return date;
}

function editionDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mondayFor(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

function liveCreationWindow(date: Date): boolean {
  // Every new fence must be followed by the bounded Monday/Tuesday recovery
  // cadence. Recovery-only runs remain valid outside this creation window.
  return date.getUTCDay() === 1 && date.getUTCHours() < 19;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function monthDay(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function rangeLabel(start: Date): string {
  const end = addDays(start, 6);
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}-${end.getUTCDate()}`;
  }
  return `${monthDay(start)}-${monthDay(end)}`;
}

function chartBodies(chart: DigestChart): MinimalBody[] {
  return chart.bodies;
}

function transitBodies(date: Date): MinimalBody[] {
  return computeBodies(date)
    .filter((body) => TRANSIT_BODIES.has(body.body))
    .map((body) => ({ body: body.body, lon: body.lon }));
}

function topTransits(chart: DigestChart, weekStart: Date): DigestTransit[] {
  const natal = chartBodies(chart);
  const best = new Map<string, DigestTransit>();

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(weekStart, offset);
    const aspects = findInterAspects(transitBodies(date), natal);
    for (const aspect of aspects) {
      if (aspect.orb > DIGEST_ORB) continue;
      const key = `${aspect.a}:${aspect.type}:${aspect.b}`;
      const current = best.get(key);
      if (!current || aspect.orb < current.aspect.orb) best.set(key, { date, aspect });
    }
  }

  return [...best.values()]
    .sort((a, b) => a.aspect.orb - b.aspect.orb || a.date.getTime() - b.date.getTime())
    .slice(0, 3);
}

function transitSentence(hit: DigestTransit): string {
  const { aspect } = hit;
  const role = BODY_ROLE[aspect.b] ?? aspect.b.toLowerCase();
  const phrase: Record<string, string> = {
    conjunction: 'puts focus on',
    sextile: 'opens a workable door for',
    square: 'presses on',
    trine: 'backs up',
    opposition: 'pulls against',
  };
  const verb = phrase[aspect.type] ?? 'meets';
  return `${monthDay(hit.date)}: ${aspect.a} ${verb} your ${role}.`;
}

function receiptLine(hit: DigestTransit): string {
  const { aspect } = hit;
  return `Receipt: transiting ${aspect.a} ${aspect.type} natal ${aspect.b}, ${aspect.orb.toFixed(1)} deg orb.`;
}

function baseUrl(): string {
  return (process.env.DIGEST_BASE_URL || 'https://zodiacs.org').replace(/\/+$/, '');
}

function assertLiveBaseUrl(): void {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl());
  } catch {
    throw new Error('DIGEST_BASE_URL must be an HTTPS origin.');
  }
  if (parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || baseUrl() !== parsed.origin) {
    throw new Error('DIGEST_BASE_URL must be an HTTPS origin.');
  }
}

function unsubscribeUrl(token: string): string {
  return `${baseUrl()}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** The Sun's sign in a saved chart — sets the accent hue and header disc. */
function chartSunSign(chart: DigestChart): string | undefined {
  const sun = chart.bodies.find((body) => body.body === 'Sun');
  if (!sun || typeof sun.lon !== 'number') return undefined;
  const index = Math.floor(((sun.lon % 360) + 360) % 360 / 30);
  return SIGNS[index]?.slug;
}

function weekEvents(weekStart: Date) {
  // Published event pages dated Monday through Sunday of this week.
  return futurePublishedEvents(editionDate(addDays(weekStart, -1)), { days: 7, limit: 6 });
}

function renderDigest(
  recipient: RecipientDigest,
  weekStart: Date,
  unsubscribeToken: string,
  maxCharts: number,
  postalAddress: string,
): { subject: string; text: string; html: string; unsubscribe: string } {
  const label = rangeLabel(weekStart);
  const charts = recipient.charts.slice(0, maxCharts);
  const unsubscribe = unsubscribeUrl(unsubscribeToken);
  const footerLines = [
    'You receive this because you asked for the Monday digest.',
    postalAddress,
  ];

  if (charts.length === 0) {
    // The sky edition: for every subscriber who has not turned on chart
    // emails, or whose chart could not be read this week. No chart is used.
    const events = weekEvents(weekStart);
    const doc: EmailDocument = {
      preheader: `The sky, ${label}: this week's notable events.`,
      eyebrow: `Weekly digest · ${label}`,
      title: `The sky, ${label}`,
      intro: 'The notable events in the sky this week, with a page for each.',
      sections: [{
        heading: 'This week',
        rows: events.map((event) => ({
          label: monthDay(new Date(event.anchor)),
          body: event.summary || event.title,
        })),
        empty: 'A quiet week: no major events are published for these seven days.',
      }],
      cta: { label: 'Read your sign\u2019s horoscope', url: `${baseUrl()}/horoscopes/` },
      links: events.slice(0, 4).map((event) => ({ label: event.title, url: `${baseUrl()}${event.path}` })),
      footerLines,
      unsubscribeUrl: unsubscribe,
    };
    return {
      subject: `The sky, ${label}`,
      text: renderEmailText(doc),
      html: renderEmailHtml(doc, baseUrl()),
      unsubscribe,
    };
  }

  const sections: EmailSection[] = charts.map((chart) => {
    const hits = topTransits(chart, weekStart);
    return {
      heading: chart.name,
      rows: hits.map((hit) => ({
        label: monthDay(hit.date),
        body: transitSentence(hit).replace(`${monthDay(hit.date)}: `, ''),
        receipt: receiptLine(hit).replace(/^Receipt: /, ''),
      })),
      empty: `Nothing within ${DIGEST_ORB}° of exact this week, a quiet one for this chart.`,
    };
  });

  const doc: EmailDocument = {
    preheader: `Your chart, ${label}: the closest transits, with orbs.`,
    eyebrow: `Weekly digest · ${label}`,
    title: `Your sky, ${label}`,
    sign: charts[0] ? chartSunSign(charts[0]) : undefined,
    identity: charts[0].name,
    intro: 'The closest aspects to your synced chart this week, with the orb each one is measured at.',
    sections,
    cta: { label: 'Read all transits', url: `${baseUrl()}/transits/` },
    footerLines: [
      'You receive this because you asked for the Monday digest and turned on chart emails.',
      postalAddress,
    ],
    unsubscribeUrl: unsubscribe,
  };

  return {
    subject: `Your sky, ${label}`,
    text: renderEmailText(doc),
    html: renderEmailHtml(doc, baseUrl()),
    unsubscribe,
  };
}

function adminClient() {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required without --fixture.');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type DigestSupabase = ReturnType<typeof adminClient>;

function databaseFailure(label: string, error: unknown): Error {
  const rawCode = error && typeof error === 'object'
    ? (error as { code?: unknown }).code
    : null;
  const code = typeof rawCode === 'string' && /^[A-Za-z0-9_-]{1,32}$/u.test(rawCode)
    ? rawCode
    : 'unknown';
  return new Error(`${label} failed (${code}).`);
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 3
    && Buffer.byteLength(value, 'utf8') <= 320
    && value === value.trim()
    && !CONTROL_CHARACTER.test(value)
    && /^[^\s@]+@[^\s@]+$/u.test(value);
}

function chartReference(value: unknown): DigestChartReference | null | undefined {
  if (value === null) return null;
  const reference = objectValue(value);
  if (!reference
    || Object.keys(reference).sort().join(',') !== 'chart_id,revision'
    || typeof reference.chart_id !== 'string'
    || !UUID.test(reference.chart_id)
    || !Number.isSafeInteger(reference.revision)
    || (reference.revision as number) < 1) return undefined;
  return { chartId: reference.chart_id.toLowerCase(), revision: reference.revision as number };
}

function recipientContent(
  value: unknown,
  userId: string,
): RecipientContent | null {
  const result = objectValue(value);
  const snapshot = objectValue(result?.snapshot);
  if (!result
    || !snapshot
    || Object.keys(snapshot).sort().join(',') !== 'chart,email'
    || typeof result.digest !== 'string'
    || !SHA256_HEX.test(result.digest)
    || !validEmail(snapshot.email)) return null;
  const reference = chartReference(snapshot.chart);
  if (reference === undefined) return null;
  return {
    userId,
    email: snapshot.email,
    chartReference: reference,
    contentDigest: result.digest,
  };
}

/**
 * Adds the decrypted self chart when the snapshot names one, after a fresh
 * read shows the account is still eligible with that same chart and
 * revision. Any failure means the sky edition. Counts only are kept.
 */
async function withDigestCharts(content: RecipientContent): Promise<RecipientDigest> {
  const result = await decryptDigestChart(content.chartReference, {
    env: process.env,
    loadSource: async () => (await loadChartEmailSources([content.userId], {
      supabaseUrl: process.env.PUBLIC_SUPABASE_URL ?? '',
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    })).get(content.userId.toLowerCase()) ?? null,
  });
  if (result.outcome !== 'sky') chartDecryption.attempted += 1;
  if (result.outcome === 'fell_back') chartDecryption.failed += 1;
  return { ...content, charts: result.charts };
}

async function loadCandidateIds(
  supabase: DigestSupabase,
  weekStart: Date,
  limit: number,
): Promise<string[]> {
  const { data, error } = await supabase.rpc('weekly_digest_candidates_v1', {
    candidate_week_start: editionDate(weekStart),
    candidate_limit: limit,
  });
  if (error) throw databaseFailure('Weekly candidate selection', error);
  if (!Array.isArray(data) || data.length > limit || data.length > HARD_SEND_CEILING) {
    throw new Error('Weekly candidate selection returned an invalid result.');
  }
  const userIds = data.map((row) => objectValue(row)?.user_id);
  if (userIds.some((userId) => typeof userId !== 'string' || !UUID.test(userId))) {
    throw new Error('Weekly candidate selection returned an invalid account identifier.');
  }
  const unique = new Set(userIds as string[]);
  if (unique.size !== userIds.length) {
    throw new Error('Weekly candidate selection returned duplicate accounts.');
  }
  return [...unique];
}

/** The content snapshot only; no chart is read or decrypted. */
async function readRecipientContent(
  supabase: DigestSupabase,
  userId: string,
  maxCharts: number,
): Promise<RecipientContent | null> {
  const { data, error } = await supabase.rpc('weekly_digest_content_v1', {
    candidate_user_id: userId,
    candidate_max_charts: maxCharts,
  });
  if (error) throw databaseFailure('Weekly recipient content', error);
  if (data === null) return null;
  const parsed = recipientContent(data, userId);
  if (!parsed) throw new Error('Weekly recipient content returned an invalid result.');
  return parsed;
}

async function loadRecipientContent(
  supabase: DigestSupabase,
  userId: string,
  maxCharts: number,
): Promise<RecipientDigest | null> {
  const content = await readRecipientContent(supabase, userId, maxCharts);
  return content ? withDigestCharts(content) : null;
}

async function booleanRpc(
  supabase: DigestSupabase,
  name: string,
  parameters: Record<string, unknown>,
  label: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(name, parameters);
  if (error) throw databaseFailure(label, error);
  if (typeof data !== 'boolean') throw new Error(`${label} returned an invalid result.`);
  return data;
}

async function pruneWeeklyDeliveryState(supabase: DigestSupabase): Promise<void> {
  const { data, error } = await supabase.rpc('weekly_digest_prune_v1');
  if (error) throw databaseFailure('Weekly delivery cleanup', error);
  if (!Number.isInteger(data) || Number(data) < 0) {
    throw new Error('Weekly delivery cleanup returned an invalid result.');
  }
}

async function reserveWeeklyDelivery(
  supabase: DigestSupabase,
  weekStart: Date,
  userId: string,
  now: Date,
): Promise<WeeklyReservation | null> {
  const leaseToken = randomUUID();
  const unsubscribeToken = createDigestUnsubscribeCapability();
  const reserved = await booleanRpc(
    supabase,
    'weekly_digest_issue_v1',
    {
      candidate_week_start: editionDate(weekStart),
      candidate_user_id: userId,
      candidate_lease_token: leaseToken,
      candidate_token_hash: hashDigestUnsubscribeCapability(unsubscribeToken),
      candidate_expires_at: addDays(now, UNSUBSCRIBE_TOKEN_TTL_DAYS).toISOString(),
    },
    'Weekly delivery reservation',
  );
  return reserved ? { leaseToken, unsubscribeToken } : null;
}

async function authorizeWeeklyDelivery(
  supabase: DigestSupabase,
  weekStart: Date,
  userId: string,
  leaseToken: string,
  envelope: WeeklyDigestRequestEnvelope,
  contentDigest: string,
  sealedEnvelope: string,
  maxCharts: number,
): Promise<boolean> {
  return booleanRpc(supabase, 'weekly_digest_authorized_v1', {
    candidate_week_start: editionDate(weekStart),
    candidate_user_id: userId,
    candidate_lease_token: leaseToken,
    candidate_idempotency_key: envelope.idempotencyKey,
    candidate_envelope_digest: weeklyDigestEnvelopeDigest(envelope),
    candidate_content_digest: contentDigest,
    candidate_sealed_envelope: sealedEnvelope,
    candidate_max_charts: maxCharts,
  }, 'Weekly delivery authorization');
}

async function cancelWeeklyDelivery(
  supabase: DigestSupabase,
  weekStart: Date,
  userId: string,
  leaseToken: string,
): Promise<boolean> {
  return booleanRpc(supabase, 'weekly_digest_cancel_v1', {
    candidate_week_start: editionDate(weekStart),
    candidate_user_id: userId,
    candidate_lease_token: leaseToken,
  }, 'Weekly delivery cancellation');
}

/**
 * Asked by the provider queue after every wait, immediately before each POST
 * attempt of a chart edition or a recovery retry (see
 * weekly_digest_dispatch_recheck_v1).
 */
async function recheckWeeklyDelivery(
  supabase: DigestSupabase,
  weekStart: Date,
  userId: string,
  leaseToken: string,
): Promise<WeeklyDispatchRecheck> {
  const { data, error } = await supabase.rpc('weekly_digest_dispatch_recheck_v1', {
    candidate_week_start: editionDate(weekStart),
    candidate_user_id: userId,
    candidate_lease_token: leaseToken,
  });
  if (error) throw databaseFailure('Weekly delivery recheck', error);
  return weeklyDispatchRecheck(data);
}

async function finishWeeklyDelivery(
  supabase: DigestSupabase,
  weekStart: Date,
  userId: string,
  leaseToken: string,
  providerResult: WeeklyDigestProviderResult,
): Promise<boolean> {
  return booleanRpc(supabase, 'weekly_digest_finish_v1', {
    candidate_week_start: editionDate(weekStart),
    candidate_user_id: userId,
    candidate_lease_token: leaseToken,
    candidate_delivered: providerResult.kind === 'sent',
    candidate_provider_receipt: providerResult.kind === 'sent' ? providerResult.receipt : null,
    candidate_provider_status: providerResult.kind === 'rejected' ? providerResult.status : null,
    candidate_provider_code: providerResult.kind === 'rejected' ? providerResult.code : null,
  }, 'Weekly delivery finalization');
}

function parseRecovery(value: unknown): WeeklyRecovery | null {
  if (value === null) return null;
  const recovery = objectValue(value);
  if (!recovery) throw new Error('Weekly delivery recovery returned an invalid result.');
  if (recovery.outcome === 'reconciliation') return { outcome: 'reconciliation' };
  if (recovery.outcome !== 'claimed'
    || typeof recovery.weekStart !== 'string'
    || editionDate(parseDate(recovery.weekStart)) !== recovery.weekStart
    || typeof recovery.userId !== 'string'
    || !UUID.test(recovery.userId)
    || typeof recovery.leaseToken !== 'string'
    || !UUID.test(recovery.leaseToken)
    || typeof recovery.idempotencyKey !== 'string'
    || !/^weekly-digest-v1\/[0-9a-f]{64}$/u.test(recovery.idempotencyKey)
    || typeof recovery.envelopeDigest !== 'string'
    || !SHA256_HEX.test(recovery.envelopeDigest)
    || typeof recovery.sealedEnvelope !== 'string'
    || recovery.sealedEnvelope.length < 32
    || recovery.sealedEnvelope.length > MAX_SEALED_ENVELOPE_CHARS
    || /[\s\u0000-\u001f\u007f]/u.test(recovery.sealedEnvelope)
    || typeof recovery.dispatchStartedAt !== 'string'
    || Number.isNaN(Date.parse(recovery.dispatchStartedAt))) {
    throw new Error('Weekly delivery recovery returned an invalid result.');
  }
  return {
    outcome: 'claimed',
    weekStart: recovery.weekStart,
    userId: recovery.userId,
    leaseToken: recovery.leaseToken,
    idempotencyKey: recovery.idempotencyKey,
    envelopeDigest: recovery.envelopeDigest,
    sealedEnvelope: recovery.sealedEnvelope,
    dispatchStartedAt: recovery.dispatchStartedAt,
  };
}

async function claimWeeklyRecovery(supabase: DigestSupabase): Promise<WeeklyRecovery | null> {
  const { data, error } = await supabase.rpc('weekly_digest_recover_v1', {
    candidate_lease_token: randomUUID(),
  });
  if (error) throw databaseFailure('Weekly delivery recovery', error);
  return parseRecovery(data);
}

function fixtureRecipients(): RecipientDigest[] {
  const bodies = computeBodies(new Date('1990-07-13T12:00:00.000Z')).map((body) => ({
    body: body.body,
    lon: body.lon,
  }));

  return [{
    userId: '00000000-0000-4000-8000-000000000000',
    email: 'fixture@example.com',
    chartReference: { chartId: '00000000-0000-4000-8000-000000000001', revision: 1 },
    contentDigest: '0'.repeat(64),
    charts: [{
      name: 'Fixture chart',
      bodies,
    }],
  }, {
    userId: '00000000-0000-4000-8000-000000000002',
    email: 'fixture-sky@example.com',
    chartReference: null,
    contentDigest: '1'.repeat(64),
    charts: [],
  }];
}

function prepareWeeklyEnvelope(
  recipient: RecipientDigest,
  weekStart: Date,
  unsubscribeToken: string,
  maxCharts: number,
  postalAddress: string,
  from: string,
  envelopeSecret: string,
): { envelope: WeeklyDigestRequestEnvelope; sealedEnvelope: string } {
  const rendered = renderDigest(
    recipient,
    weekStart,
    unsubscribeToken,
    maxCharts,
    postalAddress,
  );
  const context = { weekStart: editionDate(weekStart), userId: recipient.userId };
  const envelope = buildWeeklyDigestRequestEnvelope({
    ...context,
    from,
    to: recipient.email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    unsubscribe: rendered.unsubscribe,
  });
  const sealedEnvelope = sealWeeklyDigestRequestEnvelope(
    envelope,
    context,
    envelopeSecret,
  );
  if (sealedEnvelope.length > MAX_SEALED_ENVELOPE_CHARS) {
    throw new Error('Weekly digest sealed envelope exceeds its storage limit.');
  }
  return { envelope, sealedEnvelope };
}

function abortProviderBatch(error: WeeklyDigestProviderAbortError): never {
  const status = Number.isInteger(error.status) && error.status! >= 100 && error.status! <= 599
    ? String(error.status)
    : 'none';
  const code = typeof error.code === 'string' && SAFE_PROVIDER_CODE.test(error.code)
    ? error.code
    : 'none';
  console.error(
    `weekly-digest: provider batch abort reason=${error.reason} status=${status} code=${code}; exact sealed replay retained`,
  );
  throw new Error('Weekly digest stopped after a non-terminal provider outcome.');
}

/**
 * Replays a recovered envelope. Its first attempt goes out as claimed (the
 * claim rechecked consent and content, and the original dispatch may already
 * have been accepted under this idempotency key); every retry after an
 * explicit 429 is rechecked first, and a replay whose content moved is
 * quarantined instead of sent.
 */
async function replayAndFinalize(
  supabase: DigestSupabase,
  weekStart: Date,
  userId: string,
  leaseToken: string,
  envelope: WeeklyDigestRequestEnvelope,
  resendKey: string,
  resendRequest: ReturnType<typeof createWeeklyDigestResendRequest>,
): Promise<WeeklyDigestProviderResult | { kind: 'withdrawn'; recheck: WeeklyDispatchRecheck }> {
  const guard = weeklyAttemptGuard(
    () => recheckWeeklyDelivery(supabase, weekStart, userId, leaseToken),
    { fromAttempt: 1 },
  );
  let providerResult: WeeklyDigestProviderResult;
  try {
    providerResult = await sendWeeklyDigestEnvelope(envelope, resendKey, resendRequest, guard.control);
  } catch (error) {
    if (error instanceof WeeklyDigestProviderAbortError) abortProviderBatch(error);
    if (error instanceof ResendRequestWithdrawnError) {
      const answer = guard.last();
      if (answer === null || answer === 'failed' || answer === 'dispatch') {
        throw new Error('Weekly recovery recheck failed before a retry; nothing more was sent.');
      }
      return { kind: 'withdrawn', recheck: answer };
    }
    throw new Error('Weekly digest provider dispatch failed before finalization.');
  }
  return finalize(supabase, weekStart, userId, leaseToken, providerResult);
}

async function finalize(
  supabase: DigestSupabase,
  weekStart: Date,
  userId: string,
  leaseToken: string,
  providerResult: WeeklyDigestProviderResult,
): Promise<WeeklyDigestProviderResult> {
  const finalized = await finishWeeklyDelivery(
    supabase,
    weekStart,
    userId,
    leaseToken,
    providerResult,
  );
  if (!finalized) {
    throw new Error('Weekly delivery provider result could not be finalized; sealed replay remains available.');
  }
  return providerResult;
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const runStartedAt = new Date();
  const maxSends = Math.min(
    envInt('DIGEST_MAX_SENDS', DEFAULT_LIMIT, HARD_SEND_CEILING),
    HARD_SEND_CEILING,
  );
  const limit = Math.min(options.limit ?? maxSends, maxSends, HARD_SEND_CEILING);
  const canaryTo = options.canary ? canaryRecipient(process.env.DIGEST_CANARY_TO, 'DIGEST_CANARY_TO') : null;
  const maxCharts = envInt(
    'DIGEST_MAX_CHARTS_PER_USER',
    DEFAULT_CHARTS_PER_USER,
    MAX_CHARTS_PER_USER,
  );
  const currentWeek = mondayFor(runStartedAt);
  const weekStart = options.weekStart ?? currentWeek;
  const resendKey = process.env.RESEND_API_KEY;
  const envelopeSecret = process.env.EMAIL_CONFIRM_SECRET;
  if (!options.dryRun && !resendKey) throw new Error('RESEND_API_KEY is required when sending.');
  if (!options.dryRun
    && (!envelopeSecret
      || envelopeSecret.length < 32
      || Buffer.byteLength(envelopeSecret, 'utf8') < 32
      || Buffer.byteLength(envelopeSecret, 'utf8') > 4_096)) {
    throw new Error('EMAIL_CONFIRM_SECRET must be 32 to 4096 UTF-8 bytes when sending.');
  }
  if (!options.dryRun && editionDate(weekStart) !== editionDate(currentWeek)) {
    throw new Error('Live weekly delivery is limited to the current UTC week.');
  }
  if (!options.dryRun && !options.recoveryOnly && !liveCreationWindow(runStartedAt)) {
    throw new Error('New live weekly deliveries are limited to Monday before 19:00 UTC.');
  }
  if (!options.dryRun) assertLiveBaseUrl();

  // Same posture as the daily pipeline: a live commercial send carries the
  // sender's physical postal address or does not go out at all.
  const postalAddress = process.env.DAILY_EMAIL_POSTAL_ADDRESS
    || (options.dryRun ? 'Zodiacs.org · Test-send postal address' : '');
  if (!postalAddress) throw new Error('DAILY_EMAIL_POSTAL_ADDRESS is required when sending.');

  const supabase = options.fixture ? null : adminClient();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let reconciliation = 0;
  let attempts = 0;

  if (options.dryRun) {
    const fixtures = options.fixture ? fixtureRecipients() : [];
    let candidateIds = options.fixture
      ? fixtures.map((fixture) => fixture.userId)
      : await loadCandidateIds(supabase!, weekStart, limit);
    if (canaryTo) candidateIds = await canaryCandidates(supabase!, candidateIds, maxCharts, canaryTo);
    console.log(`weekly-digest: ${candidateIds.length} bounded candidate(s), week ${rangeLabel(weekStart)}, dryRun=true`);
    for (const [candidateIndex, userId] of candidateIds.entries()) {
      const recipient = options.fixture
        ? fixtures[candidateIndex]!
        : await loadRecipientContent(supabase!, userId, maxCharts);
      if (!recipient) {
        skipped += 1;
        continue;
      }
      const rendered = renderDigest(
        recipient,
        weekStart,
        DRY_RUN_UNSUBSCRIBE_TOKEN,
        maxCharts,
        postalAddress,
      );
      if (options.fixture) {
        console.log(`\n--- fixture | ${rendered.subject} ---\n${rendered.text}\n`);
      } else {
        console.log(`weekly-digest: rendered recipient ${candidateIndex + 1}/${candidateIds.length} (all personalized fields redacted)`);
      }
    }
    console.log(`weekly-digest: chart editions decrypted=${chartDecryption.attempted - chartDecryption.failed} fellBackToSky=${chartDecryption.failed}`);
    console.log(`weekly-digest: done, sent=0, failed=0, skipped=${skipped}, reconciliation=0, attempted=0, dryRun=true`);
    if (canaryTo) console.log(`weekly-digest: canary receipt sent=0 recipient=sha256:${recipientHashPrefix(canaryTo)} dryRun=true`);
    return;
  }

  // Every live operation goes through narrow service-role RPCs. A missing
  // migration fails closed before Resend sees a recipient.
  await pruneWeeklyDeliveryState(supabase!);
  const resendRequest = createWeeklyDigestResendRequest(fetch);

  // Recover ambiguous <=24-hour dispatches first. The opened object contains
  // the exact original body and idempotency key; no personalized field is
  // queried or rebuilt for replay.
  let recoveryScans = 0;
  let recoveryRequest: ReturnType<typeof createWeeklyDigestResendRequest> | null = null;
  let recoveryRequestDeadline = 0;
  while (attempts < limit && recoveryScans < HARD_SEND_CEILING) {
    const recovery = await claimWeeklyRecovery(supabase!);
    if (!recovery) break;
    recoveryScans += 1;
    if (recovery.outcome === 'reconciliation') {
      reconciliation += 1;
      continue;
    }
    const context = { weekStart: recovery.weekStart, userId: recovery.userId };
    const envelope = openWeeklyDigestRequestEnvelope(
      recovery.sealedEnvelope,
      context,
      envelopeSecret!,
    );
    if (!envelope
      || envelope.idempotencyKey !== recovery.idempotencyKey
      || weeklyDigestEnvelopeDigest(envelope) !== recovery.envelopeDigest) {
      throw new Error('Weekly delivery recovery integrity validation failed; no request was sent.');
    }
    const providerDeadline = Date.parse(recovery.dispatchStartedAt)
      + RESEND_IDEMPOTENCY_WINDOW_MS
      - RESEND_IDEMPOTENCY_SAFETY_MARGIN_MS;
    if (Date.now() >= providerDeadline) {
      throw new Error('Weekly delivery recovery no longer has a safe provider replay window; no request was sent.');
    }
    if (!recoveryRequest) {
      // Recovery claims are oldest-first. Reuse the first (earliest) absolute
      // deadline for one serialized provider queue, preserving team-wide
      // pacing while remaining conservative for every later envelope.
      recoveryRequestDeadline = providerDeadline;
      recoveryRequest = createWeeklyDigestResendRequest(fetch, {
        absoluteDeadlineMs: recoveryRequestDeadline,
      });
    } else if (providerDeadline < recoveryRequestDeadline) {
      throw new Error('Weekly recovery ordering changed during the run; no later request was sent.');
    }

    attempts += 1;
    const result = await replayAndFinalize(
      supabase!,
      parseDate(recovery.weekStart),
      recovery.userId,
      recovery.leaseToken,
      envelope,
      resendKey!,
      recoveryRequest,
    );
    if (result.kind === 'withdrawn') {
      if (result.recheck === 'reconciliation') reconciliation += 1;
      else skipped += 1;
      console.log(`weekly-digest: recovered delivery no longer eligible before a retry (${result.recheck}); nothing more sent`);
      continue;
    }
    if (result.kind === 'sent') {
      sent += 1;
      console.log(`weekly-digest: recovered and finalized ${sent}/${attempts} attempted delivery(s)`);
    } else {
      failed += 1;
      console.error(`weekly-digest: recovered delivery rejected status=${result.status} code=${result.code}`);
    }
  }

  const candidateLimit = limit - attempts;
  let candidateIds = !options.recoveryOnly && candidateLimit > 0
    ? await loadCandidateIds(supabase!, weekStart, candidateLimit)
    : [];
  if (canaryTo) candidateIds = await canaryCandidates(supabase!, candidateIds, maxCharts, canaryTo);
  console.log(`weekly-digest: ${candidateIds.length} bounded new candidate(s), week ${rangeLabel(weekStart)}, dryRun=false`);

  for (const [candidateIndex, userId] of candidateIds.entries()) {
    if (attempts >= limit) break;

    const reservation = await reserveWeeklyDelivery(
      supabase!,
      weekStart,
      userId,
      runStartedAt,
    );
    if (!reservation) {
      skipped += 1;
      continue;
    }

    let recipient: RecipientDigest | null;
    try {
      recipient = await loadRecipientContent(supabase!, userId, maxCharts);
    } catch {
      await cancelWeeklyDelivery(supabase!, weekStart, userId, reservation.leaseToken);
      throw new Error('Weekly recipient lookup failed after its reservation was cancelled.');
    }
    if (!recipient) {
      await cancelWeeklyDelivery(supabase!, weekStart, userId, reservation.leaseToken);
      skipped += 1;
      continue;
    }

    let prepared: ReturnType<typeof prepareWeeklyEnvelope> | null = null;
    let authorized = false;
    const authorizeFrom = (initial: RecipientDigest) => authorizeWithFreshContent({
      initial,
      readContent: () => readRecipientContent(supabase!, userId, maxCharts),
      withCharts: withDigestCharts,
      prepare: (current) => prepareWeeklyEnvelope(
        current,
        weekStart,
        reservation.unsubscribeToken,
        maxCharts,
        postalAddress,
        process.env.DIGEST_FROM_EMAIL || 'Zodiacs.org <hello@zodiacs.org>',
        envelopeSecret!,
      ),
      authorize: (current, content) => authorizeWeeklyDelivery(
        supabase!,
        weekStart,
        userId,
        reservation.leaseToken,
        current.envelope,
        content.contentDigest,
        current.sealedEnvelope,
        maxCharts,
      ),
    });
    try {
      // Re-read the content after rendering and immediately before the
      // authorization RPC, which itself recomputes the content (consents,
      // chart id and revision) under the profile row lock just before
      // dispatch. If the content moved, or the authorization is refused
      // because it moved in between (for example chart emails withdrawn
      // during the run), the digest is rebuilt from the new content, so the
      // subscriber gets the sky edition; a second movement is skipped.
      const outcome = await authorizeFrom(recipient);
      if (outcome.authorized) {
        authorized = true;
        prepared = outcome.prepared;
        recipient = outcome.recipient;
      }
    } catch {
      await cancelWeeklyDelivery(supabase!, weekStart, userId, reservation.leaseToken);
      throw new Error('Weekly digest preparation failed after its reservation was cancelled.');
    }

    if (!authorized || !prepared) {
      await cancelWeeklyDelivery(supabase!, weekStart, userId, reservation.leaseToken);
      skipped += 1;
      continue;
    }

    attempts += 1;
    // A chart edition is checked again inside the provider queue, after its
    // pacing wait and every 429 backoff, immediately before each POST. If it
    // is no longer what was authorized, nothing more is sent: the delivery
    // is released and rebuilt from current content (the sky edition), or
    // cancelled.
    let dispatched: WeeklyDispatchOutcome<RecipientDigest, ReturnType<typeof prepareWeeklyEnvelope>>;
    try {
      dispatched = await dispatchWeeklyWithRecheck({
        authorized: { recipient, prepared },
        reauthorize: async (previous) => {
          try {
            return await authorizeFrom(previous);
          } catch {
            await cancelWeeklyDelivery(supabase!, weekStart, userId, reservation.leaseToken);
            throw new WeeklyPreparationError();
          }
        },
        isChartEdition: (current) => current.charts.length > 0,
        recheck: () => recheckWeeklyDelivery(supabase!, weekStart, userId, reservation.leaseToken),
        apiKey: resendKey!,
        request: resendRequest,
      });
    } catch (error) {
      if (error instanceof WeeklyDigestProviderAbortError) abortProviderBatch(error);
      if (error instanceof WeeklyDispatchRecheckError) {
        throw new Error('Weekly delivery recheck failed before a provider attempt; nothing was sent and the dispatch is left for recovery.');
      }
      if (error instanceof WeeklyPreparationError) throw error;
      throw new Error('Weekly digest provider dispatch failed before finalization.');
    }
    if (dispatched.kind === 'withdrawn') {
      if (dispatched.recheck === 'released') {
        await cancelWeeklyDelivery(supabase!, weekStart, userId, reservation.leaseToken);
      }
      skipped += 1;
      console.log(
        `weekly-digest: recipient ${candidateIndex + 1}/${candidateIds.length} chart edition no longer eligible at dispatch (${dispatched.recheck}); nothing sent`,
      );
      continue;
    }
    if (dispatched.recipient !== recipient) {
      console.log(
        `weekly-digest: recipient ${candidateIndex + 1}/${candidateIds.length} chart edition no longer eligible at dispatch; rebuilt from current content`,
      );
    }
    const providerResult = await finalize(
      supabase!,
      weekStart,
      userId,
      reservation.leaseToken,
      dispatched.result,
    );
    if (providerResult.kind === 'rejected') {
      failed += 1;
      console.error(
        `weekly-digest: recipient ${candidateIndex + 1}/${candidateIds.length} rejected status=${providerResult.status} code=${providerResult.code}`,
      );
      continue;
    }

    sent += 1;
    console.log(`weekly-digest: sent ${sent}/${attempts} attempted delivery(s)`);
  }

  console.log(`weekly-digest: chart editions decrypted=${chartDecryption.attempted - chartDecryption.failed} fellBackToSky=${chartDecryption.failed}`);
  console.log(`weekly-digest: done, sent=${sent}, failed=${failed}, skipped=${skipped}, reconciliation=${reconciliation}, attempted=${attempts}, dryRun=false`);
  if (canaryTo) console.log(`weekly-digest: canary receipt sent=${sent} recipient=sha256:${recipientHashPrefix(canaryTo)} dryRun=false`);
  if (failed > 0) throw new Error(`weekly-digest: ${failed} explicit provider rejection(s)`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Weekly digest failed with an unknown error.');
  process.exit(1);
});
