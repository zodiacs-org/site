/**
 * Which pages may make or remove a calendar feed. A browser sends the
 * page's origin with every POST and DELETE; the origin must be the host the
 * request was sent to, and one this deployment accepts:
 *
 * - Production (VERCEL_ENV=production): https://zodiacs.org and
 *   https://www.zodiacs.org only, not the deployment's own vercel.app
 *   addresses.
 * - A preview: only its own deployment's addresses, VERCEL_URL and
 *   VERCEL_BRANCH_URL. A page on another preview cannot write through it,
 *   even where a preview holds the production database's key.
 * - Development (VERCEL_ENV=development, as under `vercel dev`): localhost
 *   only.
 * - Anywhere else, nothing.
 */
import { requestHeader } from '../email/request.js';

type Environment = Record<string, unknown>;

export const CALENDAR_FEED_PRODUCTION_ORIGINS: readonly string[] = [
  'https://zodiacs.org',
  'https://www.zodiacs.org',
];

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function value(env: Environment, key: string): string {
  const candidate = env[key];
  return typeof candidate === 'string' ? candidate.trim() : '';
}

/** The https origin of a deployment host such as VERCEL_URL; null if it is not a bare host. */
function deploymentOrigin(host: string): string | null {
  if (!host || /[/?#@\s]/u.test(host)) return null;
  try {
    return new URL(`https://${host}`).origin;
  } catch {
    return null;
  }
}

function requestHostname(req: any): string {
  const header = requestHeader(req, 'x-forwarded-host') || requestHeader(req, 'host');
  const candidate = header.split(',')[0]?.trim().toLowerCase() ?? '';
  if (!candidate) return '';
  try {
    return new URL(`https://${candidate}`).hostname;
  } catch {
    return '';
  }
}

/** The origins a deployment accepts writes from, for the tests and the runbook. */
export function calendarFeedWriteOrigins(env: Environment): { origins: string[]; localhost: boolean } {
  const stage = value(env, 'VERCEL_ENV');
  if (stage === 'production') return { origins: [...CALENDAR_FEED_PRODUCTION_ORIGINS], localhost: false };
  if (stage === 'preview') {
    const origins = [value(env, 'VERCEL_URL'), value(env, 'VERCEL_BRANCH_URL')]
      .map(deploymentOrigin)
      .filter((origin): origin is string => origin !== null);
    return { origins: [...new Set(origins)], localhost: false };
  }
  if (stage === 'development') return { origins: [], localhost: true };
  return { origins: [], localhost: false };
}

export function isAllowedCalendarFeedWrite(req: any, env: Environment): boolean {
  const source = requestHeader(req, 'origin') || requestHeader(req, 'referer');
  if (!source) return false;
  let origin: URL;
  try {
    origin = new URL(source);
  } catch {
    return false;
  }
  if (origin.protocol !== 'https:' && origin.protocol !== 'http:') return false;
  if (origin.hostname.toLowerCase() !== requestHostname(req)) return false;
  const accepted = calendarFeedWriteOrigins(env);
  if (accepted.localhost) return LOCAL_HOSTNAMES.has(origin.hostname.toLowerCase());
  return origin.protocol === 'https:' && accepted.origins.includes(origin.origin);
}
