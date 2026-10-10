#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dailyData from '../src/data/daily.json';
import dailyPublicationData from '../src/data/daily-publication.json';
import horoscopeProgramData from '../src/data/horoscope-program.json';
import type { Daily } from '../src/lib/daily';
import type { DailyPublication } from '../src/lib/daily-publication';
import { dailyUnsubscribeUrl } from '../src/lib/email/daily-unsubscribe-token';
import { normalizeEmail } from '../src/lib/email/input';
import {
  futurePublishedEvents,
  singlePublishedEventSign,
  type PublishedEventDescriptor,
} from '../src/lib/events/publication';
import type { HoroscopeProgram } from '../src/lib/horoscope-program';
import { resolveSavedChart, type SavedChartEngineLoader } from '../src/lib/profile/resolve';
import type { SavedChart } from '../src/lib/profile/schema';
import {
  assertLiveDailyEmailEdition,
  createResendDelivery,
  createSupabaseDeliveryReceiptStore,
  deliverDailyEmails,
  type DeliveryReceiptStore,
  type ResendDelivery,
} from '../src/lib/daily-email/delivery';
import { renderDailyEmail, validateDailyEmailSources } from '../src/lib/daily-email/content';
import { dailyRecipientHash } from '../src/lib/daily-email/identity';
import {
  filterDailyEmailCohort,
  mergeDailyEmailRecipients,
  parseTestAllowlist,
  selectChartRecipients,
  type ChartPreferenceRow,
  type SyncedChartRow,
} from '../src/lib/daily-email/recipients';
import { isDailyEmailDue } from '../src/lib/daily-email/schedule';
import {
  createRateLimitedResendRequest,
  type ResendRequest,
} from '../src/lib/daily-email/resend-request';
import { loadDailySunContacts, requireDailySunSegmentId } from '../src/lib/daily-email/segments';
import { loadAuthorizedSunRecipients } from '../src/lib/daily-email/sun-authority';
import type { DailyEmailRecipient } from '../src/lib/daily-email/types';

const daily = dailyData as Daily;
const publication = dailyPublicationData as DailyPublication;
const program = horoscopeProgramData as HoroscopeProgram;
const DEFAULT_LIMIT = 200;
const PAGE_SIZE = 500;

export interface DailyEmailCliOptions {
  dryRun: boolean;
  fixture: boolean;
  /** Send to exactly the recipient named by DAILY_EMAIL_CANARY_TO, or to nobody. */
  canary: boolean;
  at: Date | null;
  limit: number;
  to: string | null;
}

export type DailyEmailCohort = 'test' | 'all';

export function selectDailyEmailNearbyEvents(
  events: readonly PublishedEventDescriptor[],
): { sunSign: PublishedEventDescriptor | null; chart: PublishedEventDescriptor | null } {
  return {
    sunSign: events[0] ?? null,
    chart: events.find((event) => singlePublishedEventSign(event) !== null) ?? null,
  };
}

function requiredValue(value: string | undefined, flag: string): string {
  if (!value) throw new Error(`${flag} needs a value.`);
  return value;
}

function positiveInt(value: string | undefined, flag: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > 10_000) {
    throw new Error(`${flag} must be an integer from 1 to 10000.`);
  }
  return number;
}

function instant(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) {
    throw new Error('--at must be an ISO instant with an explicit timezone.');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('--at must be a real ISO instant.');
  return date;
}

export function parseDailyEmailArgs(argv: string[]): DailyEmailCliOptions {
  const options: DailyEmailCliOptions = {
    dryRun: false,
    fixture: false,
    canary: false,
    at: null,
    limit: DEFAULT_LIMIT,
    to: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--canary') options.canary = true;
    else if (arg === '--fixture') options.fixture = true;
    else if (arg === '--at') options.at = instant(requiredValue(argv[++index], '--at'));
    else if (arg === '--limit') options.limit = positiveInt(argv[++index], '--limit');
    else if (arg === '--to') {
      const email = normalizeEmail(requiredValue(argv[++index], '--to'));
      if (!email) throw new Error('--to must be a valid email.');
      options.to = email;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.canary) {
    // The runbook's limit-one owner send made first-class: the recipient
    // comes from DAILY_EMAIL_CANARY_TO, never the command line, and a typo
    // in --limit cannot widen the send.
    if (options.to) throw new Error('--canary reads DAILY_EMAIL_CANARY_TO; do not pass --to.');
    options.limit = 1;
  }
  return options;
}

/** The canary recipient comes from a secret and is only ever logged as a hash prefix. */
export function canaryRecipient(value: string | undefined, name: string): string {
  const email = normalizeEmail((value ?? '').trim());
  if (!email) throw new Error(`${name} must hold the canary recipient's email address when --canary is used.`);
  return email;
}

export function recipientHashPrefix(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function requireResendCapabilities(env: NodeJS.ProcessEnv): {
  sendingKey: string;
  contactsKey: string;
} {
  const sendingKey = requiredEnv(env, 'RESEND_API_KEY');
  const contactsKey = requiredEnv(env, 'RESEND_CONTACTS_API_KEY');
  if (sendingKey === contactsKey) {
    throw new Error('RESEND_API_KEY and RESEND_CONTACTS_API_KEY must be distinct capability keys.');
  }
  return { sendingKey, contactsKey };
}

function dailyEmailCohort(env: NodeJS.ProcessEnv): DailyEmailCohort {
  const cohort = requiredEnv(env, 'DAILY_EMAIL_COHORT');
  if (cohort !== 'test' && cohort !== 'all') {
    throw new Error('DAILY_EMAIL_COHORT must be test or all.');
  }
  return cohort;
}

/** A broad send needs its own explicit approval in addition to the kill switch. */
export function assertDailyEmailSendInterlocks(env: NodeJS.ProcessEnv): DailyEmailCohort {
  if (env.DAILY_EMAIL_ENABLED !== '1') {
    throw new Error('Real daily email is disabled; DAILY_EMAIL_ENABLED must equal 1.');
  }
  const cohort = dailyEmailCohort(env);
  if (cohort === 'all' && env.DAILY_EMAIL_ALL_APPROVED !== '1') {
    throw new Error('The all-recipient cohort is locked; DAILY_EMAIL_ALL_APPROVED must equal 1.');
  }
  return cohort;
}

function fixtureChart(): SavedChart {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Fixture chart',
    createdAt: `${publication.date}T00:00:00.000Z`,
    updatedAt: `${publication.date}T00:00:00.000Z`,
    birth: {
      date: '1990-01-01',
      time: '12:00',
      timeKnown: true,
      place: null,
    },
    summary: {
      engineVersion: 'fixture',
      utcISO: '1990-01-01T12:00:00.000Z',
      houseSystem: 'whole',
      bodies: daily.bodies.map((body, index) => ({
        body: body.body,
        lon: index === 0 ? body.lon : (body.lon + 11.25) % 360,
        retrograde: false,
      })),
      angles: null,
      flags: [],
    },
  };
}

function fixtureRecipients(to: string | null): DailyEmailRecipient[] {
  const chartEmail = to ?? 'chart-fixture@example.com';
  const recipients: DailyEmailRecipient[] = [{
    tier: 'chart',
    email: chartEmail,
    userId: '10000000-0000-4000-8000-000000000002',
    chartId: '10000000-0000-4000-8000-000000000001',
    chart: fixtureChart(),
    timezone: 'UTC',
  }];
  if (!to) {
    recipients.push({
      tier: 'sun_sign',
      email: 'sun-fixture@example.com',
      sign: 'aries',
      contactId: 'fixture_contact_aries',
      timezone: 'UTC',
    });
  }
  return recipients;
}

async function readConfirmedPreferences(client: ReturnType<typeof createClient>): Promise<ChartPreferenceRow[]> {
  const rows: ChartPreferenceRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('daily_chart_preferences')
      .select('user_id,chart_id,recipient_hash,timezone,confirmed_at')
      .not('confirmed_at', 'is', null)
      .order('user_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as ChartPreferenceRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function readSelectedCharts(
  client: ReturnType<typeof createClient>,
  preferences: readonly ChartPreferenceRow[],
): Promise<SyncedChartRow[]> {
  const rows: SyncedChartRow[] = [];
  for (let offset = 0; offset < preferences.length; offset += 100) {
    const batch = preferences.slice(offset, offset + 100);
    const users = batch.map((row) => row.user_id);
    const chartIds = batch.flatMap((row) => row.chart_id ? [row.chart_id] : []);
    if (users.length === 0 || chartIds.length === 0) continue;
    const { data, error } = await client
      .from('charts')
      .select('id,user_id,payload')
      .in('user_id', users)
      .in('id', chartIds);
    if (error) throw error;
    rows.push(...((data ?? []) as SyncedChartRow[]));
  }
  const selected = new Set(preferences.flatMap((row) => (
    row.chart_id ? [`${row.user_id}:${row.chart_id}`] : []
  )));
  return rows.filter((row) => selected.has(`${row.user_id}:${row.id}`));
}

async function loadProductionRecipients({
  env,
  at,
  fetchImpl,
  resendRequest,
}: {
  env: NodeJS.ProcessEnv;
  at: Date;
  fetchImpl: typeof fetch;
  resendRequest: ResendRequest;
}): Promise<{ recipients: DailyEmailRecipient[]; diagnostics: string[] }> {
  const supabaseUrl = requiredEnv(env, 'PUBLIC_SUPABASE_URL');
  const serviceKey = requiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const { contactsKey } = requireResendCapabilities(env);
  const hashSecret = requiredEnv(env, 'DAILY_EMAIL_RECIPIENT_HASH_SECRET');
  const client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const preferences = await readConfirmedPreferences(client);
  const duePreferences = preferences.filter((preference) => (
    isDailyEmailDue(publication.date, at, preference.timezone)
  ));
  const charts = await readSelectedCharts(client, duePreferences);
  const chart = await selectChartRecipients({
    preferences,
    charts,
    editionDate: publication.date,
    at,
    async getAuthEmail(userId) {
      const result = await client.auth.admin.getUserById(userId);
      if (result.error) throw result.error;
      return result.data.user?.email ?? null;
    },
    recipientHashForEmail: (email) => dailyRecipientHash(email, hashSecret),
  });

  const diagnostics: string[] = [];
  const segment = requireDailySunSegmentId(
    requiredEnv(env, 'RESEND_DAILY_SEGMENT_ID'),
    env.RESEND_SEGMENT_ID,
  );
  const sun = await loadDailySunContacts({
    fetchImpl,
    apiKey: contactsKey,
    segment,
    request: resendRequest,
  });
  const authorizedSun = await loadAuthorizedSunRecipients({
    contacts: sun.contacts,
    fetchImpl,
    supabaseUrl,
    serviceKey,
    hashSecret,
  });
  const sunRecipients = authorizedSun.recipients;
  if (sun.duplicates.length) diagnostics.push(`${sun.duplicates.length} address(es) map to multiple provider contacts`);
  if (authorizedSun.rejected) diagnostics.push(`${authorizedSun.rejected} Sun contact(s) lack matching confirmed database consent`);
  if (chart.invalidCharts.length) diagnostics.push(`${chart.invalidCharts.length} selected chart(s) are missing or invalid`);
  if (chart.invalidIdentities.length) diagnostics.push(`${chart.invalidIdentities.length} chart recipient identity record(s) are stale or unavailable`);
  return {
    recipients: mergeDailyEmailRecipients({
      chart: chart.recipients,
      sun: sunRecipients,
      suppressSunEmails: chart.suppressSunEmails,
      suppressSunRecipientHashes: chart.suppressSunRecipientHashes,
      recipientHashForEmail: (email) => dailyRecipientHash(email, hashSecret),
      editionDate: publication.date,
      at,
    }),
    diagnostics,
  };
}

/**
 * A synced chart carries the summary its device computed, which can predate
 * the current engine or birthplace clock or keep the legacy polar ASC. Each
 * chart recipient is read the way the site reads it, recomputed from the
 * birth input when needed, so a subscriber who never returns still gets the
 * current chart. A chart that cannot be recomputed keeps its stored summary.
 */
export async function resolveChartRecipients(
  recipients: readonly DailyEmailRecipient[],
  loadEngine: SavedChartEngineLoader = () => import('../src/lib/engine/full'),
): Promise<DailyEmailRecipient[]> {
  return Promise.all(recipients.map(async (recipient) => {
    if (recipient.tier !== 'chart') return recipient;
    const { summary } = await resolveSavedChart(recipient.chart, loadEngine);
    return { ...recipient, chart: { ...recipient.chart, summary } };
  }));
}

export function dailyRecipientUnsubscribeClaim(
  recipient: DailyEmailRecipient,
  hashSecret: string,
) {
  const recipientHash = dailyRecipientHash(recipient.email, hashSecret);
  return recipient.tier === 'sun_sign'
    ? { kind: 'sun' as const, contactId: recipient.contactId, recipientHash }
    : {
      kind: 'chart' as const,
      userId: recipient.userId,
      recipientHash,
    };
}

const dryReceiptStore: DeliveryReceiptStore = {
  reserve: async () => { throw new Error('Dry-run receipt store was called.'); },
  markSent: async () => { throw new Error('Dry-run receipt store was called.'); },
  markFailed: async () => { throw new Error('Dry-run receipt store was called.'); },
  sentBefore: async () => { throw new Error('Dry-run receipt store was called.'); },
};

const dryResend: ResendDelivery = {
  send: async () => { throw new Error('Dry-run Resend adapter was called.'); },
};

export async function runDailyEmail({
  options,
  env = process.env,
  fetchImpl = fetch,
  log = console.log,
}: {
  options: DailyEmailCliOptions;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}): Promise<ReturnType<typeof deliverDailyEmails> extends Promise<infer Report> ? Report : never> {
  validateDailyEmailSources({ daily, publication, program });
  if (options.fixture && !options.dryRun) {
    throw new Error('--fixture is a smoke mode and requires --dry-run.');
  }
  if (options.canary) {
    options.to = canaryRecipient(env.DAILY_EMAIL_CANARY_TO, 'DAILY_EMAIL_CANARY_TO');
    options.limit = 1;
  }
  const cohort = options.fixture
    ? null
    : (options.dryRun ? dailyEmailCohort(env) : assertDailyEmailSendInterlocks(env));
  const at = options.at ?? (options.fixture
    ? new Date(`${publication.date}T07:13:00.000Z`)
    : new Date());
  const baseUrl = (env.DAILY_EMAIL_BASE_URL || 'https://zodiacs.org').replace(/\/+$/u, '');
  const hashSecret = env.DAILY_EMAIL_RECIPIENT_HASH_SECRET
    || (options.dryRun ? 'daily-email-dry-run-secret-32-chars-minimum' : '');
  if (!hashSecret) throw new Error('DAILY_EMAIL_RECIPIENT_HASH_SECRET is required when sending.');
  // Segment reads and sends share one serialized queue so the entire job—not
  // merely each phase independently—stays within the provider request rate.
  const resendRequest = createRateLimitedResendRequest(fetchImpl);

  if (!options.dryRun) {
    await assertLiveDailyEmailEdition({
      fetchImpl,
      endpoint: env.DAILY_EMAIL_LIVE_URL || undefined,
      daily,
      publication,
      program,
    });
  }

  let recipients: DailyEmailRecipient[];
  let diagnostics: string[] = [];
  if (options.fixture) {
    recipients = fixtureRecipients(options.to);
  } else {
    const loaded = await loadProductionRecipients({ env, at, fetchImpl, resendRequest });
    recipients = loaded.recipients;
    diagnostics = loaded.diagnostics;
    recipients = filterDailyEmailCohort(
      recipients,
      cohort!,
      parseTestAllowlist(env.DAILY_EMAIL_TEST_ALLOWLIST),
      options.to,
    );
  }
  recipients = await resolveChartRecipients(recipients);
  for (const diagnostic of diagnostics) log(`daily-email: held — ${diagnostic}`);

  const nearbyEvents = selectDailyEmailNearbyEvents(futurePublishedEvents(
    publication.date,
    { days: 9, limit: Number.MAX_SAFE_INTEGER },
  ));
  const unsubscribeSecret = env.DAILY_EMAIL_UNSUBSCRIBE_SECRET
    || (options.dryRun ? 'daily-email-dry-run-unsubscribe-secret' : '');
  if (!unsubscribeSecret) throw new Error('DAILY_EMAIL_UNSUBSCRIBE_SECRET is required when sending.');
  const senderPostalAddress = env.DAILY_EMAIL_POSTAL_ADDRESS
    || (options.dryRun ? 'Zodiacs.org · Test-send postal address' : '');
  if (!senderPostalAddress) throw new Error('DAILY_EMAIL_POSTAL_ADDRESS is required when sending.');
  const supabaseUrl = options.dryRun ? '' : requiredEnv(env, 'PUBLIC_SUPABASE_URL');
  const serviceKey = options.dryRun ? '' : requiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const receipts = options.dryRun ? dryReceiptStore : createSupabaseDeliveryReceiptStore({
    fetchImpl,
    supabaseUrl,
    serviceKey,
  });
  const resend = options.dryRun ? dryResend : createResendDelivery({
    fetchImpl,
    apiKey: requiredEnv(env, 'RESEND_API_KEY'),
    from: requiredEnv(env, 'DAILY_EMAIL_FROM'),
    request: resendRequest,
  });

  log(`daily-email: edition=${publication.date} at=${at.toISOString()} recipients=${recipients.length} dryRun=${options.dryRun}`);
  const report = await deliverDailyEmails({
    recipients,
    editionDate: publication.date,
    limit: options.limit,
    dryRun: options.dryRun,
    hashSecret,
    receipts,
    resend,
    render(recipient, { firstDelivery }) {
      const claim = dailyRecipientUnsubscribeClaim(recipient, hashSecret);
      return renderDailyEmail({
        recipient,
        daily,
        publication,
        program,
        nearbyEvent: recipient.tier === 'chart' ? nearbyEvents.chart : nearbyEvents.sunSign,
        baseUrl,
        unsubscribeUrl: dailyUnsubscribeUrl(baseUrl, claim, unsubscribeSecret),
        senderPostalAddress,
        firstDelivery,
      });
    },
    log,
  });
  log(`daily-email: done considered=${report.considered} reserved=${report.reserved} sent=${report.sent} failed=${report.failed} duplicate=${report.duplicate} dryRun=${report.dryRun}`);
  if (options.canary && options.to) {
    log(`daily-email: canary receipt sent=${report.sent} recipient=sha256:${recipientHashPrefix(options.to)} dryRun=${report.dryRun}`);
  }
  return report;
}

async function main(): Promise<void> {
  const options = parseDailyEmailArgs(process.argv.slice(2));
  const report = await runDailyEmail({ options });
  if (report.failed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
