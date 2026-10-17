import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import webPush from 'web-push';

const EVENTS_PATH = new URL('../src/data/events-publication.json', import.meta.url);
const EVENTS_SCHEMA = 'zodiacs.events-publication.v1';
const LIVE_EVENT_ORIGIN = 'https://zodiacs.org';
const DAY_MS = 86_400_000;
const EVENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,159}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ALERT_TITLE_MAX = 32;
const ALERT_BODY_MAX = 140;
const EVENT_PATH_MAX = 512;
const EVENT_PATH_PREFIXES = Object.freeze([
  '/eclipses/',
  '/events/',
  '/full-moon/',
  '/mars-retrograde/',
  '/mercury-retrograde/',
  '/new-moon/',
  '/retrogrades/',
  '/venus-retrograde/',
]);

const EVENT_PRIORITY = Object.freeze({
  eclipse: 1,
  ingress: 2,
  aspect: 3,
  station: 4,
  lunation: 5,
});
const SUBTYPE_PRIORITY = Object.freeze({
  eclipse: Object.freeze({ solar: 0, lunar: 1 }),
  ingress: Object.freeze({ ingress: 0 }),
  aspect: Object.freeze({ conjunction: 0, opposition: 1, square: 2, trine: 3, sextile: 4 }),
  station: Object.freeze({ retrograde: 0, direct: 1 }),
  lunation: Object.freeze({ full: 0, new: 1 }),
});
const SLOW_BODIES = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
const STATION_BODIES = new Set([
  'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
]);
const ELIGIBLE_ASPECTS = new Set(['conjunction', 'opposition', 'square', 'trine']);

function utcDay(value) {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : '';
}

function utcTime(value) {
  return new Date(value).toISOString().slice(11, 16);
}

export function eventFamilyRank(event) {
  return EVENT_PRIORITY[event.family] ?? Number.MAX_SAFE_INTEGER;
}

function subtypeRank(event) {
  return SUBTYPE_PRIORITY[event.family]?.[event.subtype] ?? Number.MAX_SAFE_INTEGER;
}

function supportedSubtype(event) {
  if (event.family === 'lunation') return event.subtype === 'full' || event.subtype === 'new';
  if (event.family === 'eclipse') return event.subtype === 'solar' || event.subtype === 'lunar';
  if (event.family === 'station') return event.subtype === 'direct' || event.subtype === 'retrograde';
  if (event.family === 'ingress') return event.subtype === 'ingress';
  return event.family === 'aspect'
    && Object.hasOwn(SUBTYPE_PRIORITY.aspect, event.subtype);
}

function validEvent(event) {
  const safePath = typeof event?.path === 'string'
    && event.path.length <= EVENT_PATH_MAX
    && event.path.startsWith('/')
    && !event.path.startsWith('//')
    && !event.path.includes('?')
    && !/[\\\u0000-\u001f\u007f]/u.test(event.path)
    && EVENT_PATH_PREFIXES.some((prefix) => event.path.startsWith(prefix));
  let exactLocalPath = false;
  if (safePath) {
    try {
      const parsed = new URL(event.path, 'https://zodiacs.org');
      exactLocalPath = parsed.origin === 'https://zodiacs.org'
        && `${parsed.pathname}${parsed.hash}` === event.path
        && /^\/[a-z0-9/-]+\/$/iu.test(parsed.pathname)
        && (!parsed.hash || /^#[a-z0-9-]+$/iu.test(parsed.hash));
    } catch {
      exactLocalPath = false;
    }
  }
  return Boolean(
    event
    && typeof event.id === 'string'
    && EVENT_ID_PATTERN.test(event.id)
    && typeof event.title === 'string'
    && event.title.trim().length > 0
    && event.title.length <= 240
    && !/[\u0000-\u001f\u007f]/u.test(event.title)
    && typeof event.anchor === 'string'
    && Number.isFinite(Date.parse(event.anchor))
    && exactLocalPath
    && typeof event.family === 'string'
    && Object.hasOwn(EVENT_PRIORITY, event.family)
    && typeof event.subtype === 'string'
    && supportedSubtype(event)
    && Array.isArray(event.bodies)
    && Array.isArray(event.signs)
    && typeof event.summary === 'string'
    && event.summary.trim().length > 0
    && event.summary.length <= 1_000
    && !/[\u0000-\u001f\u007f]/u.test(event.summary),
  );
}

export function eligibleEvent(event) {
  if (!validEvent(event)) return false;
  if (event.family === 'ingress') return SLOW_BODIES.has(event.bodies[0]);
  if (event.family === 'aspect') {
    return ELIGIBLE_ASPECTS.has(event.subtype)
      && event.bodies.length === 2
      && event.bodies.every((body) => SLOW_BODIES.has(body));
  }
  if (event.family === 'station') return STATION_BODIES.has(event.bodies[0]);
  return true;
}

export function compareEligibleEvents(left, right) {
  return eventFamilyRank(left) - eventFamilyRank(right)
    || left.anchor.localeCompare(right.anchor)
    || subtypeRank(left) - subtypeRank(right)
    || left.id.localeCompare(right.id);
}

function checkedAlert(alert) {
  const title = typeof alert?.title === 'string' ? alert.title.trim() : '';
  const body = typeof alert?.body === 'string' ? alert.body.trim() : '';
  if (!title
    || title.length > ALERT_TITLE_MAX
    || !body
    || body.length > ALERT_BODY_MAX
    || /[\u0000-\u001f\u007f]/u.test(title)
    || /[\u0000-\u001f\u007f]/u.test(body)) {
    throw new Error('Published event produced an invalid Sky Alert payload.');
  }
  return { title, body, url: alert.url };
}

/** Select exactly one eligible published event on the run's UTC day. */
export function selectEventForDay(publication, date = new Date()) {
  if (publication?.schema !== EVENTS_SCHEMA
    || publication.locale !== 'en'
    || !Array.isArray(publication.timeline)) {
    throw new Error('Push delivery requires the verified events publication schema.');
  }
  const day = utcDay(date);
  if (!day) throw new Error('Push delivery date is invalid.');

  const candidates = publication.timeline
    .filter(eligibleEvent)
    .filter((event) => utcDay(event.anchor) === day);
  return candidates
    .sort(compareEligibleEvents)[0] ?? null;
}

/** Return the best family rank within the next six UTC dates, if any. */
export function upcomingBestRankWithinSixDays(publication, event, date) {
  if (!eligibleEvent(event)) throw new Error('Cannot reserve for an ineligible Sky Alert event.');
  const day = utcDay(date);
  if (!day || utcDay(event.anchor) !== day) {
    throw new Error('Sky Alert reservation date must match the selected event.');
  }
  const start = Date.parse(`${day}T00:00:00.000Z`);
  let bestRank = null;
  for (let offset = 1; offset <= 6; offset += 1) {
    const candidate = selectEventForDay(publication, new Date(start + (offset * DAY_MS)));
    if (candidate) {
      const rank = eventFamilyRank(candidate);
      bestRank = bestRank === null ? rank : Math.min(bestRank, rank);
    }
  }
  return bestRank;
}

/** English-only payload formulas using only the committed event receipt. */
export function buildEventAlert(event) {
  if (!eligibleEvent(event)) throw new Error('Cannot build a push alert from an ineligible event.');
  const time = utcTime(event.anchor);
  const planet = event.bodies[0] ?? '';
  const summary = event.summary.trim();

  if (event.family === 'lunation' && event.subtype === 'full') {
    return checkedAlert({
      title: new Date(event.anchor).getUTCHours() >= 12 ? 'Full moon tonight' : 'Full moon today',
      body: `${summary} Exact at ${time} UTC. Where it lands for you:`,
      url: event.path,
    });
  }
  if (event.family === 'lunation' && event.subtype === 'new') {
    return checkedAlert({
      title: 'New moon today',
      body: summary,
      url: event.path,
    });
  }
  if (event.family === 'eclipse') {
    const label = event.title.split(/\s+in\s+/iu)[0].trim();
    return checkedAlert({
      title: `${label} today`,
      body: `${summary} Exact at ${time} UTC.`,
      url: event.path,
    });
  }
  if (event.family === 'station') {
    return checkedAlert({
      title: `${planet} turns ${event.subtype} today`,
      body: `${summary} Exact at ${time} UTC.`,
      url: event.path,
    });
  }
  if (event.family === 'aspect') {
    return checkedAlert({
      title: 'A rare exact alignment today',
      body: summary,
      url: event.path,
    });
  }
  return checkedAlert({
    title: `${event.title.split(/,\s|\s+—/u)[0].trim()} today`,
    body: summary,
    url: event.path,
  });
}

function quotedAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'iu'));
  return match?.[2] ?? null;
}

/** Fail closed unless the selected event is already live at its exact canonical. */
export async function verifyEventLive(
  event,
  fetchImpl = fetch,
  origin = LIVE_EVENT_ORIGIN,
) {
  if (!eligibleEvent(event)) throw new Error('Cannot verify an ineligible Sky Alert event.');
  const expected = new URL(event.path, origin);
  expected.hash = '';
  if (expected.origin !== origin) throw new Error('Sky Alert live origin is invalid.');

  const response = await fetchImpl(expected.href, {
    headers: { Accept: 'text/html' },
    redirect: 'manual',
  });
  if (!response.ok) {
    throw new Error(`Sky Alert destination is not live (${response.status}).`);
  }
  const contentType = response.headers?.get?.('content-type') ?? '';
  if (!/^text\/html(?:;|$)/iu.test(contentType)) {
    throw new Error('Sky Alert destination did not return HTML.');
  }
  const html = await response.text();
  const canonicals = (html.match(/<link\b[^>]*>/giu) ?? [])
    .filter((tag) => (quotedAttribute(tag, 'rel') ?? '')
      .toLowerCase().split(/\s+/u).includes('canonical'))
    .map((tag) => quotedAttribute(tag, 'href'));
  if (canonicals.length !== 1 || canonicals[0] !== expected.href) {
    throw new Error(`Sky Alert destination canonical is not ${expected.href}.`);
  }
  return expected.href;
}

function serviceHeaders(serviceKey, prefer) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

async function responseDetail(response) {
  return String(await response.text().catch(() => '')).slice(0, 300);
}

export function parseSubscriptionIdAllowlist(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  const ids = value.split(',').map((part) => part.trim());
  if (ids.length > 50
    || ids.some((part) => !/^[1-9][0-9]*$/u.test(part)
      || !Number.isSafeInteger(Number(part)))) {
    throw new Error('PUSH_TEST_SUBSCRIPTION_IDS must contain 1 to 50 positive integer ids.');
  }
  return [...new Set(ids.map(Number))];
}

export function authorizeRealDelivery(env = process.env) {
  const subscriptionIds = parseSubscriptionIdAllowlist(env.PUSH_TEST_SUBSCRIPTION_IDS);
  if (env.PUSH_ENABLED !== 'true' && subscriptionIds.length === 0) {
    throw new Error('Real push requires PUSH_ENABLED=true or an explicit test subscription allowlist.');
  }
  return subscriptionIds;
}

export async function readSubscriptions(
  fetchImpl,
  url,
  serviceKey,
  limit,
  subscriptionIds = [],
) {
  const filter = subscriptionIds.length > 0
    ? `&subscription_id=in.(${subscriptionIds.join(',')})`
    : '';
  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/push_subscriptions?select=subscription_id,endpoint,p256dh,auth,lang,updated_at&order=created_at.asc&limit=${limit}${filter}`;
  const response = await fetchImpl(endpoint, { headers: serviceHeaders(serviceKey, 'return=representation') });
  if (!response.ok) throw new Error(`Could not read push subscriptions (${response.status}).`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Push subscription response was not an array.');
  return rows;
}

function emptyReport(event = null) {
  return {
    event: event?.id ?? null,
    schedule: event ? 'pending' : 'none',
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

function deliveryTtlSeconds(now) {
  const dayStart = Date.parse(`${utcDay(now)}T00:00:00.000Z`);
  return Math.max(0, Math.floor((dayStart + DAY_MS - now.getTime()) / 1_000));
}

/**
 * Select one global editorial send, then deliver it to a bounded subscription
 * batch. Both durable stores are consulted before Web Push. Dry runs are
 * render-only and call neither store.
 */
export async function sendDailyPush({
  subscriptions,
  publication,
  date,
  now = new Date(),
  dryRun = false,
  schedule,
  claims,
  sendNotification,
  log = console.log,
}) {
  const event = selectEventForDay(publication, date);
  const report = emptyReport(event);
  if (!event) return report;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error('Push delivery clock is invalid.');
  }

  const alert = buildEventAlert(event);
  const eventDate = utcDay(event.anchor);
  const currentRank = eventFamilyRank(event);
  const upcomingBestRank = upcomingBestRankWithinSixDays(publication, event, date);
  const payload = JSON.stringify(alert);
  if (subscriptions.length === 0) {
    report.schedule = 'empty';
    return report;
  }
  if (!dryRun) {
    const selection = await schedule.select(eventDate, event.id, currentRank, upcomingBestRank);
    report.schedule = selection.outcome;
    if (selection.outcome === 'conflict') {
      throw new Error(`Sky Alert schedule conflicts with the selected event on ${eventDate}.`);
    }
    if (selection.outcome !== 'selected') {
      if (selection.outcome === 'held_7d') report.held = 1;
      if (selection.outcome === 'capped_7d') report.capped = 1;
      return report;
    }
  } else {
    report.schedule = 'dry_run';
  }
  for (const row of subscriptions) {
    report.considered += 1;
    if (dryRun) {
      report.dryRun += 1;
      log(`sky-alert: dry-run en event=${event.id} ${payload}`);
      continue;
    }

    let claim;
    try {
      claim = await claims.claim(row.subscription_id, event.id, row.updated_at);
    } catch (error) {
      report.failed += 1;
      log(`sky-alert: claim failed ${error instanceof Error ? error.message : 'unknown'}`);
      continue;
    }
    if (claim.outcome !== 'reserved') {
      if (claim.outcome === 'capped_24h' || claim.outcome === 'capped_7d') report.capped += 1;
      else if (claim.outcome === 'duplicate') report.duplicate += 1;
      else if (claim.outcome === 'stale') report.stale += 1;
      else report.missing += 1;
      continue;
    }
    report.reserved += 1;

    let response;
    let acceptedStatus;
    try {
      response = await sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      }, payload, { TTL: deliveryTtlSeconds(now), urgency: 'normal' });
      const resolvedStatus = Number(response?.statusCode ?? response?.status);
      if (!Number.isInteger(resolvedStatus) || resolvedStatus < 200 || resolvedStatus > 299) {
        throw Object.assign(new Error(`Web Push returned ${resolvedStatus || 'an invalid status'}.`), {
          statusCode: Number.isInteger(resolvedStatus) ? resolvedStatus : undefined,
        });
      }
      acceptedStatus = resolvedStatus;
    } catch (error) {
      const status = Number(error?.statusCode ?? error?.status);
      const expired = status === 404 || status === 410;
      let receiptFailed = false;
      try {
        const completion = await claims.complete(
          row.subscription_id,
          event.id,
          claim.claimToken,
          expired ? 'expired' : 'failed',
          Number.isFinite(status) && status > 0 ? status : null,
        );
        if (expired && completion.outcome === 'expired') report.pruned += 1;
      } catch (completionError) {
        receiptFailed = true;
        log(`sky-alert: receipt failed ${completionError instanceof Error ? completionError.message : 'unknown'}`);
      }
      if (!expired || receiptFailed) report.failed += 1;
      if (!expired) log(`sky-alert: delivery failed ${status || 'unknown'}`);
      continue;
    }

    try {
      await claims.complete(
        row.subscription_id,
        event.id,
        claim.claimToken,
        'sent',
        acceptedStatus,
      );
      report.sent += 1;
    } catch (completionError) {
      // The provider may already have accepted the alert. Leave the durable
      // reservation in place so a retry cannot break the promised caps.
      report.failed += 1;
      log(`sky-alert: receipt failed ${completionError instanceof Error ? completionError.message : 'unknown'}`);
    }
  }
  return report;
}

export function parseOptions(argv) {
  const options = {
    dryRun: false,
    fixture: false,
    verifyLiveOnly: false,
    limit: 500,
    date: new Date(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--fixture') options.fixture = true;
    else if (arg === '--verify-live-only') options.verifyLiveOnly = true;
    else if (arg === '--limit') options.limit = Number(argv[++index]);
    else if (arg === '--date') {
      const raw = argv[++index];
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(raw ?? '')) throw new Error('--date must be YYYY-MM-DD.');
      options.date = new Date(`${raw}T12:00:00.000Z`);
      if (utcDay(options.date) !== raw) throw new Error('--date must be a real UTC calendar date.');
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 10_000) {
    throw new Error('--limit must be an integer from 1 to 10000.');
  }
  if (Number.isNaN(options.date.getTime())) throw new Error('--date must be YYYY-MM-DD.');
  if (options.fixture && !options.dryRun) throw new Error('--fixture is render-only and requires --dry-run.');
  if (options.verifyLiveOnly && (options.dryRun || options.fixture)) {
    throw new Error('--verify-live-only cannot be combined with --dry-run or --fixture.');
  }
  return options;
}

function parseRpcObject(value, label) {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') throw new Error(`${label} returned an invalid response.`);
  return row;
}

async function postRpcWithTransportRetry(fetchImpl, url, init) {
  try {
    return await fetchImpl(url, init);
  } catch {
    return fetchImpl(url, init);
  }
}

export function createPushClaimStore(
  fetchImpl,
  url,
  serviceKey,
  { randomId = randomUUID } = {},
) {
  const root = url.replace(/\/+$/, '');
  return {
    async claim(subscriptionId, eventId, subscriptionUpdatedAt) {
      if (!Number.isSafeInteger(subscriptionId) || subscriptionId < 1) {
        throw new Error('Push delivery requires a valid subscription id.');
      }
      if (typeof eventId !== 'string' || !EVENT_ID_PATTERN.test(eventId)) {
        throw new Error('Push delivery requires a valid event id.');
      }
      if (typeof subscriptionUpdatedAt !== 'string'
        || !Number.isFinite(Date.parse(subscriptionUpdatedAt))) {
        throw new Error('Push delivery requires the listed subscription version.');
      }
      const claimToken = randomId();
      if (typeof claimToken !== 'string' || !UUID_PATTERN.test(claimToken)) {
        throw new Error('Push delivery requires a valid claim token.');
      }
      const rpcUrl = `${root}/rest/v1/rpc/reserve_push_delivery`;
      const init = {
        method: 'POST',
        headers: serviceHeaders(serviceKey, 'return=representation'),
        body: JSON.stringify({
          candidate_subscription_id: subscriptionId,
          candidate_event_id: eventId,
          candidate_subscription_updated_at: subscriptionUpdatedAt,
          candidate_claim_token: claimToken,
        }),
      };
      const response = await postRpcWithTransportRetry(fetchImpl, rpcUrl, init);
      if (!response.ok) {
        throw new Error(`Could not claim push delivery (${response.status}): ${await responseDetail(response)}`);
      }
      const result = parseRpcObject(await response.json(), 'Push delivery claim');
      const outcomes = new Set(['reserved', 'duplicate', 'capped_24h', 'capped_7d', 'missing', 'stale']);
      if (!outcomes.has(result.outcome)) throw new Error('Push delivery claim returned an unknown outcome.');
      if (result.outcome === 'reserved' && result.claim_token !== claimToken) {
        throw new Error('Push delivery claim was not owned by this worker.');
      }
      return {
        outcome: result.outcome,
        claimToken: result.claim_token,
      };
    },
    async complete(subscriptionId, eventId, claimToken, outcome, providerStatus) {
      if (!Number.isSafeInteger(subscriptionId) || subscriptionId < 1
        || typeof eventId !== 'string' || !EVENT_ID_PATTERN.test(eventId)
        || typeof claimToken !== 'string' || !UUID_PATTERN.test(claimToken)
        || !['sent', 'failed', 'expired'].includes(outcome)
        || (outcome === 'sent' && (!Number.isInteger(providerStatus) || providerStatus < 200 || providerStatus > 299))
        || (outcome === 'expired' && providerStatus !== 404 && providerStatus !== 410)
        || (outcome === 'failed' && providerStatus !== null
          && (!Number.isInteger(providerStatus) || providerStatus < 100 || providerStatus > 599))) {
        throw new Error('Push delivery completion arguments are invalid.');
      }
      const rpcUrl = `${root}/rest/v1/rpc/finalize_push_delivery`;
      const init = {
        method: 'POST',
        headers: serviceHeaders(serviceKey, 'return=representation'),
        body: JSON.stringify({
          candidate_subscription_id: subscriptionId,
          candidate_event_id: eventId,
          candidate_claim_token: claimToken,
          candidate_outcome: outcome,
          candidate_provider_status: providerStatus,
        }),
      };
      const response = await postRpcWithTransportRetry(fetchImpl, rpcUrl, init);
      if (!response.ok) {
        throw new Error(`Could not complete push delivery (${response.status}): ${await responseDetail(response)}`);
      }
      const result = parseRpcObject(await response.json(), 'Push delivery completion');
      const expected = outcome === 'expired' ? 'expired' : 'finalized';
      if (result.outcome !== expected
        || (expected === 'finalized' && result.status !== outcome)) {
        throw new Error('Push delivery receipt was not finalized by its owner.');
      }
      return result;
    },
  };
}

export function createPushScheduleStore(fetchImpl, url, serviceKey) {
  const root = url.replace(/\/+$/, '');
  return {
    async select(eventDate, eventId, familyRank, upcomingBestRank) {
      if (typeof eventDate !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/u.test(eventDate)
        || utcDay(`${eventDate}T00:00:00.000Z`) !== eventDate
        || typeof eventId !== 'string'
        || !EVENT_ID_PATTERN.test(eventId)
        || !Number.isInteger(familyRank)
        || familyRank < 1
        || familyRank > 5
        || (upcomingBestRank !== null
          && (!Number.isInteger(upcomingBestRank) || upcomingBestRank < 1 || upcomingBestRank > 5))) {
        throw new Error('Sky Alert schedule selection arguments are invalid.');
      }
      const rpcUrl = `${root}/rest/v1/rpc/select_push_alert_event`;
      const init = {
        method: 'POST',
        headers: serviceHeaders(serviceKey, 'return=representation'),
        body: JSON.stringify({
          candidate_utc_date: eventDate,
          candidate_event_id: eventId,
          candidate_family_rank: familyRank,
          candidate_upcoming_best_rank: upcomingBestRank,
        }),
      };
      const response = await postRpcWithTransportRetry(fetchImpl, rpcUrl, init);
      if (!response.ok) {
        throw new Error(`Could not select Sky Alert schedule (${response.status}): ${await responseDetail(response)}`);
      }
      const result = parseRpcObject(await response.json(), 'Sky Alert schedule selection');
      const outcomes = new Set(['selected', 'capped_7d', 'held_7d', 'conflict']);
      if (!outcomes.has(result.outcome)) {
        throw new Error('Sky Alert schedule selection returned an unknown outcome.');
      }
      return result;
    },
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const publication = JSON.parse(await readFile(EVENTS_PATH, 'utf8'));
  const event = selectEventForDay(publication, options.date);
  if (!event) {
    console.log(`sky-alert: no published event on ${utcDay(options.date)}; nothing sent`);
    return;
  }

  if (!options.dryRun) {
    if (utcDay(options.date) !== utcDay(new Date())) {
      throw new Error('A real push may only send the current UTC day; use --dry-run for historical dates.');
    }
    const liveUrl = await verifyEventLive(event);
    console.log(`sky-alert: live destination verified ${liveUrl}`);
    if (options.verifyLiveOnly) return;
  }

  const url = process.env.PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let subscriptions;
  if (options.fixture) {
    subscriptions = [{
      endpoint: 'https://push.example.test/subscription',
      subscription_id: 1,
      p256dh: 'fixture-public-key',
      auth: 'fixture-auth-key',
      lang: 'en',
    }];
  } else {
    if (!url || !serviceKey) throw new Error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    const subscriptionIds = options.dryRun ? [] : authorizeRealDelivery();
    subscriptions = await readSubscriptions(fetch, url, serviceKey, options.limit, subscriptionIds);
  }

  if (!options.dryRun) {
    const subject = process.env.VAPID_SUBJECT;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!url || !serviceKey || !subject || !publicKey || !privateKey) {
      throw new Error('Supabase and VAPID configuration are required to send.');
    }
    webPush.setVapidDetails(subject, publicKey, privateKey);
  }

  const claims = options.dryRun
    ? { claim: async () => { throw new Error('Dry run attempted to claim.'); }, complete: async () => {} }
    : createPushClaimStore(fetch, url, serviceKey);
  const schedule = options.dryRun
    ? { select: async () => { throw new Error('Dry run attempted to select a schedule.'); } }
    : createPushScheduleStore(fetch, url, serviceKey);
  const report = await sendDailyPush({
    subscriptions,
    publication,
    date: options.date,
    now: new Date(),
    dryRun: options.dryRun,
    schedule,
    claims,
    sendNotification: webPush.sendNotification.bind(webPush),
  });
  console.log(
    `sky-alert: done event=${report.event ?? 'none'} schedule=${report.schedule} considered=${report.considered} reserved=${report.reserved} `
    + `sent=${report.sent} capped=${report.capped} held=${report.held} duplicate=${report.duplicate} missing=${report.missing} stale=${report.stale} `
    + `pruned=${report.pruned} failed=${report.failed} dryRun=${report.dryRun}`,
  );
  if (report.failed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
