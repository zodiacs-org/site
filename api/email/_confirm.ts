// Bundled by the public email lifecycle entrypoint; not a standalone Function.
import { createHash, randomUUID } from 'node:crypto';
import {
  createEmailSubscriptionAdapter,
  type EmailSubscriptionAdapter,
} from '../../src/lib/email/provider.js';
import {
  emailConfirmationSecret,
  environmentValue,
  hasStandaloneWeeklyEmailCapture,
} from '../../src/lib/email/config.js';
import {
  EMAIL_CONFIRMATION_TOKEN_MAX_CHARS,
  verifyEmailOptInToken,
} from '../../src/lib/email/opt-in-token.js';
import { requestHeader } from '../../src/lib/email/request.js';
import { emailStatusPage } from '../../src/lib/email/server-page.js';
import type { Locale } from '../../src/lib/i18n/core';
import { dailyEmailFeatureEnabled, hasDailyChartEmailProvider, hasDailySunEmailProvider } from '../../src/lib/email/daily-config.js';
import { verifyDailyChartOptInToken } from '../../src/lib/email/daily-chart-token.js';
import { dailyEmailPage } from '../../src/lib/email/daily-page.js';
import {
  consumePendingDailyChartPreference,
  getDailyChartPreference,
  getOwnedDailyChart,
  type DailyChartPreference,
} from '../../src/lib/email/daily-server.js';
import { verifyDailySunOptInToken } from '../../src/lib/email/daily-sun-token.js';
import {
  beginDailySunProviderMutation,
  claimPendingDailySunConfirmation,
  completeClaimedDailySunConfirmation,
  finishDailySunProviderMutation,
  getDailySunPreference,
  inspectDailySunConfirmation,
  keepCurrentDailySunSign,
  releaseClaimedDailySunConfirmation,
} from '../../src/lib/email/daily-sun-server.js';
import { getAdminEmailUser } from '../../src/lib/email/daily-server.js';
import { dailyRecipientHash } from '../../src/lib/daily-email/identity.js';
import { removeDailySunSegment } from '../../src/lib/email/daily-resend.js';
import { signBySlug } from '../../src/lib/signs.js';
import {
  dailyEmailAdminBootstrapEnvironment,
  isDailyEmailAdminBootstrapAddress,
  isDailyEmailAdminBootstrapRecipientHash,
} from '../../src/lib/email/daily-admin-bootstrap.js';

type Environment = Record<string, unknown>;

function sendJson(res: any, status: number, body: Record<string, string | boolean>): void {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function send(res: any, status: number, body: string): void {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(body);
}

function tokenFromBody(body: unknown): string {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as { token?: unknown };
      if (typeof parsed.token === 'string') return parsed.token;
    } catch {
      return new URLSearchParams(body).get('token') ?? '';
    }
  }
  if (body && typeof body === 'object' && typeof (body as { token?: unknown }).token === 'string') {
    return (body as { token: string }).token;
  }
  return '';
}

function decisionFromBody(body: unknown): string {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as { decision?: unknown };
      if (typeof parsed.decision === 'string') return parsed.decision;
    } catch {
      return new URLSearchParams(body).get('decision') ?? '';
    }
  }
  if (body && typeof body === 'object' && typeof (body as { decision?: unknown }).decision === 'string') {
    return (body as { decision: string }).decision;
  }
  return '';
}

function wantsJson(req: any): boolean {
  return requestHeader(req, 'accept').includes('application/json');
}

function sendUnavailable(req: any, res: any, locale: Locale): void {
  if (wantsJson(req)) sendJson(res, 503, { error: 'disabled' });
  else send(res, 503, emailStatusPage(locale, 'emailCaptureErrorTitle', 'emailCaptureError'));
}

async function currentDailySunAuthority(email: string) {
  return getDailySunPreference(
    dailyRecipientHash(
      email,
      process.env.DAILY_EMAIL_RECIPIENT_HASH_SECRET ?? '',
    ),
  );
}

/**
 * Provider membership is derived routing state, never consent authority. Read
 * the committed authority before and after each provider mutation so a
 * concurrent confirmation or unsubscribe always has a worker that converges
 * routing on the newest database version.
 */
async function synchronizeDailySunProvider(
  email: string,
  confirm: NonNullable<EmailSubscriptionAdapter['confirm']>,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await currentDailySunAuthority(email);
    if (before) {
      const leaseId = randomUUID();
      const lease = await beginDailySunProviderMutation(before, leaseId);
      if (lease !== 'ready') {
        throw new Error('Daily Sun provider authority is busy or no longer current.');
      }

      // A thrown/ambiguous provider response deliberately leaves the bounded
      // lease behind. Deletion cleanup will wait for expiry before it can make
      // a successful removal claim.
      let providerFailure: unknown;
      for (let providerAttempt = 0; providerAttempt < 2; providerAttempt += 1) {
        try {
          await confirm(email, before.sign, 'daily');
          providerFailure = undefined;
          break;
        } catch (error) {
          providerFailure = error;
        }
      }
      if (providerFailure) throw providerFailure;
      const after = await currentDailySunAuthority(email);
      if (before.sign === after?.sign
        && before.confirmedAt === after?.confirmedAt
        && before.confirmedByAttemptId === after?.confirmedByAttemptId) {
        await finishDailySunProviderMutation(before, leaseId);
        return after;
      }
      await finishDailySunProviderMutation(before, leaseId);
      continue;
    }

    await removeDailySunSegment({ email });
    const after = await currentDailySunAuthority(email);
    if (!after) return null;
  }
  throw new Error('Daily Sun provider authority changed during reconciliation.');
}

function matchesPendingChartRequest(
  preference: DailyChartPreference | null,
  claim: NonNullable<ReturnType<typeof verifyDailyChartOptInToken>>,
  token: string,
): boolean {
  return Boolean(preference?.pending
    && preference.chartId === claim.chartId
    && preference.recipientHash === claim.recipientHash
    && preference.timezone === claim.timezone
    && preference.confirmationTokenHash === createHash('sha256').update(token).digest('hex'));
}

async function matchesAdminBootstrapChartIdentity(
  claim: NonNullable<ReturnType<typeof verifyDailyChartOptInToken>>,
  env: Environment,
): Promise<boolean> {
  const user = await getAdminEmailUser(claim.userId, env);
  if (!user || !isDailyEmailAdminBootstrapAddress(user.email, env)) return false;
  try {
    return dailyRecipientHash(
      user.email,
      environmentValue(env, 'DAILY_EMAIL_RECIPIENT_HASH_SECRET'),
    ) === claim.recipientHash;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    send(res, 405, emailStatusPage('en', 'emailConfirmInvalidTitle', 'emailConfirmInvalidBody'));
    return;
  }
  const token = req.method === 'GET'
    ? (typeof req.query?.token === 'string' ? req.query.token : '')
    : tokenFromBody(req.body);
  if (token.length === 0 || token.length > EMAIL_CONFIRMATION_TOKEN_MAX_CHARS) {
    send(res, 400, emailStatusPage('en', 'emailConfirmInvalidTitle', 'emailConfirmInvalidBody'));
    return;
  }
  const secret = emailConfirmationSecret(process.env);
  const claim = secret ? verifyEmailOptInToken(token, secret) : null;
  const publicDaily = dailyEmailFeatureEnabled(process.env);
  const candidateSunClaim = secret ? verifyDailySunOptInToken(token, secret) : null;
  const candidateChartClaim = secret ? verifyDailyChartOptInToken(token, secret) : null;
  const bootstrapEnv = dailyEmailAdminBootstrapEnvironment(process.env);
  const bootstrapDaily = Boolean(candidateSunClaim
    && bootstrapEnv
    && isDailyEmailAdminBootstrapAddress(candidateSunClaim.email, process.env));
  const bootstrapChart = Boolean(!publicDaily
    && candidateChartClaim
    && bootstrapEnv
    && isDailyEmailAdminBootstrapRecipientHash(
      candidateChartClaim.recipientHash,
      process.env,
    ));
  const dailyEnv = publicDaily
    ? process.env
    : bootstrapDaily
      ? bootstrapEnv
      : null;
  const chartClaim = publicDaily || bootstrapChart ? candidateChartClaim : null;
  const chartEnv = chartClaim
    ? publicDaily ? process.env : bootstrapEnv
    : null;
  const daily = dailyEnv !== null || chartEnv !== null;
  const sunClaim = daily ? candidateSunClaim : null;
  const configured = chartClaim
    ? hasDailyChartEmailProvider(chartEnv!)
    : sunClaim
      ? hasDailySunEmailProvider(dailyEnv!)
      : claim
        ? hasStandaloneWeeklyEmailCapture(process.env)
        : daily
          ? hasDailySunEmailProvider(dailyEnv!)
          : hasStandaloneWeeklyEmailCapture(process.env);
  if (!configured) {
    if (daily) {
      if (wantsJson(req)) sendJson(res, 503, { error: 'disabled' });
      else send(res, 503, dailyEmailPage('Not available yet', 'Daily email is not ready just yet.'));
    } else sendUnavailable(req, res, claim?.locale ?? 'en');
    return;
  }
  if (!claim && !chartClaim && !sunClaim) {
    if (daily) send(res, 400, dailyEmailPage(
      'This link is not valid.',
      'It may have expired — links work for 48 hours — or already been used. Request a fresh one from any daily signup on the site.',
      { kind: 'link', href: '/horoscopes/#daily-email', label: 'Request a new link' },
    ));
    else send(res, 400, emailStatusPage('en', 'emailConfirmInvalidTitle', 'emailConfirmInvalidBody'));
    return;
  }

  // GET never changes state: link scanners can safely inspect it. The human
  // confirms with the POST button rendered below.
  if (req.method === 'GET') {
    if (chartClaim || sunClaim) {
      let chartName = 'your saved chart';
      if (chartClaim) {
        try {
          const preference = await getDailyChartPreference(chartClaim.userId, chartEnv!);
          if (!matchesPendingChartRequest(preference, chartClaim, token)) {
            send(res, 400, dailyEmailPage(
              'This link is not valid.',
              'It may have expired — links work for 48 hours — or already been used. Request a fresh one from any daily signup on the site.',
              { kind: 'link', href: '/profile/#daily-brief', label: 'Request a new link' },
            ));
            return;
          }
          const chart = await getOwnedDailyChart(
            chartClaim.userId,
            chartClaim.chartId,
            chartEnv!,
          );
          if (bootstrapChart && (!chart
            || !await matchesAdminBootstrapChartIdentity(chartClaim, chartEnv!))) {
            send(res, 400, dailyEmailPage(
              'This link is not valid.',
              'It may have expired — links work for 48 hours — or already been used. Request a fresh one from your profile.',
              { kind: 'link', href: '/profile/#daily-brief', label: 'Request a new link' },
            ));
            return;
          }
          chartName = chart?.name ?? chartName;
        } catch {
          if (bootstrapChart) {
            send(res, 502, dailyEmailPage(
              'Please try again',
              'We could not check your personal daily brief just now.',
            ));
            return;
          }
          // Public enrollment keeps its scanner-safe fallback; POST still
          // revalidates ownership and current account identity before consent.
        }
      }
      if (sunClaim) {
        try {
          const current = await inspectDailySunConfirmation(
            sunClaim.email,
            sunClaim.sign,
            token,
          );
          if (!current) {
            send(res, 400, dailyEmailPage(
              'This link is not valid.',
              'It may have expired — links work for 48 hours — or already been used. Request a fresh one from any daily signup on the site.',
              { kind: 'link', href: '/horoscopes/#daily-email', label: 'Request a new link' },
            ));
            return;
          }
          if (current.requestKind === 'sign_change' && current.activeSign) {
            const oldSign = signBySlug(current.activeSign).name;
            const newSign = signBySlug(sunClaim.sign).name;
            send(res, 200, dailyEmailPage(
              'One last check.',
              `This address already gets the daily as ${oldSign}. Switch it to ${newSign}?`,
              {
                action: '/api/email/confirm',
                token,
                label: `Switch to ${newSign}`,
                decision: 'switch',
                secondary: { label: `Keep ${oldSign}`, decision: 'keep' },
              },
            ));
            return;
          }
        } catch {
          send(res, 502, dailyEmailPage('Please try again', 'We could not check your daily subscription just now.'));
          return;
        }
      }
      send(res, 200, dailyEmailPage(
        'One last check.',
        chartClaim
          ? `Confirm this subscription to start the personal daily brief for ${chartName}. Until you do, nothing is sent.`
          : 'Confirm this subscription to start the free daily forecast. Until you do, nothing is active.',
        { action: '/api/email/confirm', token, label: 'Confirm subscription' },
      ));
    }
    else if (claim) send(res, 200, emailStatusPage(claim.locale, 'emailConfirmTitle', 'emailConfirmBody', { token }));
    return;
  }

  if (chartClaim) {
    try {
      const preference = await getDailyChartPreference(chartClaim.userId, chartEnv!);
      if (!matchesPendingChartRequest(preference, chartClaim, token)) {
        send(res, 409, dailyEmailPage(
          'This link is not valid.',
          'It may have expired — links work for 48 hours — or already been used. Request a fresh one from your profile.',
          { kind: 'link', href: '/profile/#daily-brief', label: 'Request a new link' },
        ));
        return;
      }
      const chart = await getOwnedDailyChart(
        chartClaim.userId,
        chartClaim.chartId,
        chartEnv!,
      );
      if (!chart) {
        send(res, 409, dailyEmailPage(
          'Chart emails are off for this account',
          'Nothing was turned on. To get a personal daily brief, sync your chart and turn on "Use my chart for my emails" in your profile, then ask for a new link.',
        ));
        return;
      }
      const user = await getAdminEmailUser(chartClaim.userId, chartEnv!);
      const currentHash = user
        ? dailyRecipientHash(
          user.email,
          environmentValue(chartEnv!, 'DAILY_EMAIL_RECIPIENT_HASH_SECRET'),
        )
        : null;
      if (!currentHash
        || currentHash !== chartClaim.recipientHash
        || (bootstrapChart && !isDailyEmailAdminBootstrapAddress(user?.email ?? '', chartEnv!))) {
        send(res, 409, dailyEmailPage(
          'Request a fresh link',
          'Your account email changed after this link was sent, so nothing was turned on.',
        ));
        return;
      }
      const consumed = await consumePendingDailyChartPreference(
        chartClaim.userId,
        chartClaim.chartId,
        chartClaim.recipientHash,
        createHash('sha256').update(token).digest('hex'),
        chartClaim.timezone,
        chartEnv!,
      );
      if (!consumed) {
        send(res, 409, dailyEmailPage(
          'This link is not valid.',
          'It may have expired — links work for 48 hours — or already been used. Request a fresh one from your profile.',
          { kind: 'link', href: '/profile/#daily-brief', label: 'Request a new link' },
        ));
        return;
      }
      send(res, 200, dailyEmailPage(
        'Subscription confirmed.',
        `The personal daily brief for ${chart.name} starts tomorrow morning. Manage it anytime in your profile.`,
      ));
    } catch {
      send(res, 502, dailyEmailPage('Please try again', 'We could not save your daily brief just now.'));
    }
    return;
  }

  const adapter = createEmailSubscriptionAdapter(
    sunClaim && dailyEnv ? dailyEnv : process.env,
  );
  if (!adapter?.confirm) {
    if (sunClaim) send(res, 503, dailyEmailPage('Not available yet', 'Daily email is not ready just yet.'));
    else send(res, 503, emailStatusPage(claim!.locale, 'emailCaptureErrorTitle', 'emailCaptureError'));
    return;
  }
  if (sunClaim) {
    const decision = decisionFromBody(req.body);
    if (decision && decision !== 'confirm' && decision !== 'switch' && decision !== 'keep') {
      send(res, 400, dailyEmailPage(
        'This link is not valid.',
        'It may have expired — links work for 48 hours — or already been used. Request a fresh one from any daily signup on the site.',
        { kind: 'link', href: '/horoscopes/#daily-email', label: 'Request a new link' },
      ));
      return;
    }
    if (decision === 'keep') {
      try {
        const current = await inspectDailySunConfirmation(sunClaim.email, sunClaim.sign, token);
        if (!current || current.requestKind !== 'sign_change' || !current.activeSign
          || !await keepCurrentDailySunSign(sunClaim.email, token)) {
          send(res, 409, dailyEmailPage(
            'This link is not valid.',
            'It may have expired — links work for 48 hours — or already been used. Request a fresh one from any daily signup on the site.',
            { kind: 'link', href: '/horoscopes/#daily-email', label: 'Request a new link' },
          ));
          return;
        }
        send(res, 200, dailyEmailPage(
          'Subscription confirmed.',
          `Your ${signBySlug(current.activeSign).name} daily starts tomorrow morning. Every email includes an unsubscribe link.`,
        ));
      } catch {
        send(res, 502, dailyEmailPage('Please try again', 'We could not save your daily brief just now.'));
      }
      return;
    }

    const attemptId = randomUUID();
    let claimed = false;
    const synchronizeProvider = () => synchronizeDailySunProvider(
      sunClaim.email,
      adapter.confirm!.bind(adapter),
    );
    try {
      const claimResult = await claimPendingDailySunConfirmation(
        sunClaim.email,
        sunClaim.sign,
        token,
        attemptId,
      );
      if (claimResult.outcome !== 'claimed') {
        // A completed request can lose its HTTP response. The signed link may
        // safely finish provider synchronization only while its sign remains
        // the active database authority.
        if (claimResult.outcome === 'unavailable') {
          const authority = await currentDailySunAuthority(sunClaim.email);
          if (authority?.sign === sunClaim.sign) {
            await synchronizeProvider();
            send(res, 200, dailyEmailPage(
              'Subscription confirmed.',
              `Your ${signBySlug(sunClaim.sign).name} daily starts tomorrow morning. Every email includes an unsubscribe link.`,
            ));
            return;
          }
        }
        send(res, 409, dailyEmailPage(
          claimResult.outcome === 'busy' ? 'Confirmation in progress.' : 'This link is not valid.',
          claimResult.outcome === 'busy'
            ? 'This subscription is already being confirmed. Wait a moment, then try again.'
            : 'It may have expired — links work for 48 hours — or already been used. Request a fresh one from any daily signup on the site.',
          { kind: 'link', href: '/horoscopes/#daily-email', label: 'Request a new link' },
        ));
        return;
      }
      claimed = true;

      // Commit consent first. A stale or reclaimed worker therefore cannot
      // mutate provider routing. Delivery remains fail-closed until the
      // provider is reconciled to this committed authority.
      const completion = await completeClaimedDailySunConfirmation(
        sunClaim.email,
        token,
        attemptId,
      );
      if (completion.outcome !== 'completed') {
        send(res, 409, dailyEmailPage(
          'This link is not valid.',
          'A newer request or unsubscribe replaced it, so nothing was turned on.',
          { kind: 'link', href: '/horoscopes/#daily-email', label: 'Request a new link' },
        ));
        return;
      }
      await synchronizeProvider();
      send(res, 200, dailyEmailPage(
        'Subscription confirmed.',
        `Your ${signBySlug(sunClaim.sign).name} daily starts tomorrow morning. Every email includes an unsubscribe link.`,
      ));
    } catch {
      if (claimed) {
        try {
          await releaseClaimedDailySunConfirmation(sunClaim.email, token, attemptId);
        } catch {
          // A reclaimed lease or unsubscribe already fenced this worker out.
        }
      }
      try {
        const authority = await currentDailySunAuthority(sunClaim.email);
        if (authority?.sign === sunClaim.sign) {
          await synchronizeProvider();
          send(res, 200, dailyEmailPage(
            'Subscription confirmed.',
            `Your ${signBySlug(sunClaim.sign).name} daily starts tomorrow morning. Every email includes an unsubscribe link.`,
          ));
          return;
        }
      } catch {
        // Database authority remains fail-closed if provider repair must retry.
      }
      send(res, 502, dailyEmailPage('Please try again', 'We could not save your daily brief just now.'));
    }
    return;
  }
  try {
    await adapter.confirm(claim!.email, claim!.sign ?? undefined, 'weekly');
    send(res, 200, emailStatusPage(claim!.locale, 'emailConfirmedTitle', 'emailConfirmedBody'));
  } catch {
    if (daily) send(res, 502, dailyEmailPage('Please try again', 'We could not save your daily brief just now.'));
    else send(res, 502, emailStatusPage(claim!.locale, 'emailCaptureErrorTitle', 'emailCaptureError'));
  }
}
