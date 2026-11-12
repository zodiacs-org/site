import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('weekly digest operational boundary', () => {
  it('enforces the ceiling, sealed recovery, and least-privilege boundaries', async () => {
    const [sender, workflow, endpoint, delivery, migration, sqlHarness] = await Promise.all([
      readFile(resolve(root, 'scripts/send-weekly-digest.ts'), 'utf8'),
      readFile(resolve(root, '.github/workflows/weekly-digest.yml'), 'utf8'),
      readFile(resolve(root, 'api/unsubscribe.ts'), 'utf8'),
      readFile(resolve(root, 'src/lib/weekly-digest/delivery.ts'), 'utf8'),
      readFile(resolve(root, 'supabase/migrations/20260827090000_weekly_digest_unsubscribe_capability.sql'), 'utf8'),
      readFile(resolve(root, 'scripts/test-phase3-delivery-sql.sh'), 'utf8'),
    ]);

    expect(sender).toContain('const HARD_SEND_CEILING = 80;');
    expect(sender).toContain("envInt('DIGEST_MAX_SENDS', DEFAULT_LIMIT, HARD_SEND_CEILING)");
    expect(sender).toContain('Math.min(options.limit ?? maxSends, maxSends, HARD_SEND_CEILING)');
    expect(sender).toContain("'weekly_digest_candidates_v1'");
    expect(sender).toContain("'weekly_digest_content_v1'");
    expect(sender).toContain("'weekly_digest_issue_v1'");
    expect(sender).toContain("'weekly_digest_authorized_v1'");
    expect(sender).toContain("'weekly_digest_recover_v1'");
    expect(sender).toContain("'weekly_digest_finish_v1'");
    expect(sender).toContain('buildWeeklyDigestRequestEnvelope(');
    expect(sender).toContain('weeklyDigestEnvelopeDigest(');
    expect(sender).toContain('sealWeeklyDigestRequestEnvelope(');
    expect(sender).toContain('openWeeklyDigestRequestEnvelope(');
    // The opened envelope is replayed by replayWeeklyRecovery, which sends it
    // with sendWeeklyDigestEnvelope (src/lib/weekly-digest/dispatch-recheck.ts).
    expect(sender).toContain('replayed = await replayWeeklyRecovery({');
    expect(sender).toContain('createWeeklyDigestResendRequest(fetch)');
    expect(sender).toContain('const RESEND_IDEMPOTENCY_SAFETY_MARGIN_MS = 60 * 1_000;');
    expect(sender).toContain('Date.now() >= providerDeadline');
    expect(sender).toContain('let recoveryRequest: ReturnType<typeof createWeeklyDigestResendRequest> | null = null;');
    expect(sender).toContain('absoluteDeadlineMs: recoveryRequestDeadline');
    expect(sender).not.toContain('.from(');
    expect(sender).not.toContain('.auth.admin.');
    expect(sender).not.toContain('PROFILE_PAGE_SIZE');
    expect(sender).not.toContain('CHART_QUERY_CHUNK');
    expect(sender).not.toContain('loadRecipients(');
    expect(sender).not.toContain("arg === '--to'");
    expect(sender).toContain("arg === '--recovery-only'");
    expect(sender).toContain('function liveCreationWindow(date: Date): boolean');
    expect(sender).toContain('!options.recoveryOnly && !liveCreationWindow(runStartedAt)');

    expect(delivery).toContain('export function buildWeeklyDigestRequestEnvelope(');
    expect(delivery).toContain('export function weeklyDigestEnvelopeDigest(');
    expect(delivery).toContain('export function sealWeeklyDigestRequestEnvelope(');
    expect(delivery).toContain('export function openWeeklyDigestRequestEnvelope(');
    expect(delivery).toContain('export async function sendWeeklyDigestEnvelope(');
    expect(delivery).toContain('export function createWeeklyDigestResendRequest(');
    expect(delivery).toContain('absoluteDeadlineMs?: number;');
    expect(migration).toContain('create or replace function public.weekly_digest_recover_v1(');
    expect(migration).toContain("dispatch_started_at > claimed_at - interval '23 hours 55 minutes'");

    expect(workflow).toContain('DIGEST_MAX_SENDS: "80"');
    expect(workflow).toContain('default: "80"');
    expect(workflow).toContain("if: github.event_name != 'schedule' || vars.DIGEST_ENABLED == 'true'");
    expect(workflow).toContain('- cron: "15 6 * * 1"');
    expect(workflow).toContain('- cron: "0 7,10,18 * * 1"');
    expect(workflow).toContain('- cron: "0,15 5,6,7,10,17 * * 2"');
    expect(workflow).toContain('ARGS+=(--recovery-only)');
    expect(workflow).toContain('environment: weekly-digest-production');
    expect(workflow).toContain('recovery_only:');
    expect(workflow).toContain(
      "EMAIL_CONFIRM_SECRET: ${{ (github.event_name == 'schedule' || inputs.dry_run == false) && secrets.EMAIL_CONFIRM_SECRET || '' }}",
    );
    expect(workflow).toContain(
      "RESEND_API_KEY: ${{ (github.event_name == 'schedule' || inputs.dry_run == false) && secrets.RESEND_API_KEY || '' }}",
    );
    expect(workflow).not.toContain('DIGEST_UNSUBSCRIBE_SECRET');
    const fixtureStep = workflow.slice(
      workflow.indexOf('- name: Smoke dry run'),
      workflow.indexOf('- name: Run weekly digest'),
    );
    expect(fixtureStep).not.toContain('EMAIL_CONFIRM_SECRET');
    const unsubscribeSql = sqlHarness.indexOf('supabase/tests/weekly_digest_unsubscribe.sql');
    const concurrencySql = sqlHarness.indexOf('supabase/tests/weekly_digest_concurrency.sql');
    expect(unsubscribeSql).toBeGreaterThan(-1);
    expect(concurrencySql).toBeGreaterThan(unsubscribeSql);
    expect(endpoint).toContain('/rest/v1/rpc/weekly_digest_unsubscribe_v1');
    expect(endpoint).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('prints rendered bodies only for the synthetic fixture', async () => {
    const sender = await readFile(resolve(root, 'scripts/send-weekly-digest.ts'), 'utf8');
    expect(sender).toContain('--fixture is synthetic output and requires --dry-run.');
    expect(sender).toMatch(/if \(options\.dryRun\) \{[\s\S]*?if \(options\.fixture\) \{[\s\S]*?rendered\.text/u);
    expect(sender).toContain('(all personalized fields redacted)');
    expect(sender.match(/rendered\.text/g)).toHaveLength(2);
  });
});

describe('weekly digest canary', () => {
  it('can only reach the one recipient named in a secret and never logs an address', async () => {
    const [sender, workflow] = await Promise.all([
      readFile(resolve(root, 'scripts/send-weekly-digest.ts'), 'utf8'),
      readFile(resolve(root, '.github/workflows/weekly-digest.yml'), 'utf8'),
    ]);

    // The flag forces limit 1 and refuses the modes that would widen or fake it.
    expect(sender).toContain("else if (arg === '--canary') options.canary = true;");
    expect(sender).toContain("if (options.limit !== null && options.limit !== 1) throw new Error('--canary always sends at most one message");
    expect(sender).toContain("if (options.fixture) throw new Error('--canary selects a real candidate");
    expect(sender).toContain("if (options.recoveryOnly) throw new Error('--canary creates one new delivery");
    // The recipient comes from the environment, and the candidate set collapses to that one person or to nobody.
    expect(sender).toContain("canaryRecipient(process.env.DIGEST_CANARY_TO, 'DIGEST_CANARY_TO')");
    expect(sender).toContain('if (canaryTo) candidateIds = await canaryCandidates(supabase!, candidateIds, maxCharts, canaryTo);');
    expect(sender).toContain("is not among this week's ${candidateIds.length} bounded candidate(s); nothing sent");
    // The receipt is machine-checkable and carries a hash prefix, not the address.
    expect(sender).toContain('canary receipt sent=${sent} recipient=sha256:${recipientHashPrefix(canaryTo)}');
    expect(sender).not.toMatch(/console\.(?:log|error)\([^\n]*\.email\b/u);

    // The workflow passes the flag from a boolean input and the recipient from a secret only.
    expect(workflow).toContain('canary:\n        description: "Send to the DIGEST_CANARY_TO recipient only (limit 1), or to nobody"');
    expect(workflow).toContain("DIGEST_CANARY_TO: ${{ inputs.canary == true && secrets.DIGEST_CANARY_TO || '' }}");
    expect(workflow).toContain('ARGS=(--canary)');
    expect(workflow).not.toMatch(/--canary\s+"?\$/u);
  });
});
