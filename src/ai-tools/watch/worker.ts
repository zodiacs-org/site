import { executeAiTool } from '../tools';
import type { computeEvents } from '../../lib/compute-api/endpoints';
import { localMinuteIso } from '../clear-time';
import { DAY, WATCH_MATCH_DAYS, WATCH_VERSION, type Delivery, type EventName, type Rpc, type WatchIdentity } from './contracts';
import { digest, type destinationVault } from './crypto';
import { signedHeaders, type CallbackPost } from './callback';

const timingVersion = WATCH_VERSION.replace('sky-watch-v1:', 'sky-watch-v2:');
type Calculation = ReturnType<typeof computeEvents>;
type SearchReceipt = Pick<Calculation['receipt'], 'search'> & Record<string, unknown>;

function eventSignature(name: EventName, event: Record<string, unknown>) {
  switch (name) {
    case 'zodiacs.sky.ingress': return JSON.stringify([name, event.body, event.sign, event.retrograde]);
    case 'zodiacs.sky.station': return JSON.stringify([name, event.body, event.type]);
    case 'zodiacs.sky.lunation': return JSON.stringify([name, event.type]);
    default: throw new Error('unknown-watch-event');
  }
}

export async function calculateWindow(from: string, to: string, existing: readonly WatchIdentity[] = []) {
  from = new Date(from).toISOString(); to = new Date(to).toISOString();
  const result = await executeAiTool('get_upcoming_events', { from, to, zone: 'UTC', kinds: ['ingress', 'station', 'lunation'] }, {});
  if (!result.ok || result.tool !== 'get_upcoming_events') throw new Error('search-refused');
  const data = result.data;
  if (data.completeness !== 'tested-not-proven') throw new Error('search-incomplete');
  const solved = data.calculation.result.events as Calculation['result']['events'];
  if (solved.length !== data.events.length) throw new Error('search-mismatch');
  return reconcileWatchEvents(data.events.map(({ localAt: _localAt, ...listed }, index) => {
    if (listed.kind !== solved[index].kind) throw new Error('search-mismatch');
    const event = { ...listed, at: solved[index].at };
    const name = `zodiacs.sky.${event.kind}` as EventName;
    return { name, timestamp: event.at, data: { event, receipt: data.calculation.receipt as SearchReceipt }, cursor: null };
  }), existing);
}

/** A stored ID survives corrections to the time, position and UTC partition. */
export function reconcileWatchEvents<T extends Omit<WatchIdentity, 'eventId'>>(events: T[], existing: readonly WatchIdentity[]) {
  const candidates = existing.map(({ eventId, name, timestamp, data }) => ({
    eventId, at: Date.parse(timestamp), signature: eventSignature(name, data.event),
  }));
  const used = new Set<string>();
  return events.map(event => {
    const signature = eventSignature(event.name, event.data.event);
    const at = Date.parse(event.timestamp);
    const matches = candidates.filter(candidate => candidate.signature === signature
      && Math.abs(candidate.at - at) <= WATCH_MATCH_DAYS * DAY);
    if (matches.length > 1) throw new Error('ambiguous-watch-event');
    // The first observation allocates the ID. Later solves reuse the persisted ID.
    const eventId = matches[0]?.eventId ?? `evt_${digest(JSON.stringify(['sky-watch-event-v2', signature, event.timestamp]))}`;
    if (used.has(eventId)) throw new Error('duplicate-watch-event');
    used.add(eventId);
    return { eventId, ...event };
  });
}

/** Fixed UTC-day partitions, persisted cursor, compare-and-swap ingestion and bounded catch-up.
 * A clock revision replays the boundary and reconciles with neighboring ledger rows.
 */
export async function fillWatchLedger(rpc: Rpc, now = Date.now(), calculate = calculateWindow) {
  let filled = 0;
  for (; filled < 3; filled++) {
    const { from, existing } = await rpc<{ from: string; existing: WatchIdentity[] }>('timingwindow', {
      version: timingVersion, start: new Date(Math.floor(now / DAY) * DAY).toISOString(),
    });
    if (Date.parse(from) >= Math.floor(now / DAY) * DAY + 2 * DAY) break;
    const to = new Date(Date.parse(from) + DAY).toISOString();
    const events = await calculate(from, to, existing); // A refusal leaves the cursor untouched.
    if (!await rpc<boolean>('timingingest', { version: timingVersion, from, to, events })) break;
  }
  await rpc('enqueue');
  return filled;
}

export function deliveryOutcome(status: number, attempts: number) {
  if (status >= 200 && status < 300) return { outcome: 'sent', delay_seconds: 0 };
  if (status === 410) return { outcome: 'gone', delay_seconds: 0 };
  const transient = status === 0 || status === 408 || status === 429 || status >= 500;
  return transient && attempts < 8 ? { outcome: 'retry', delay_seconds: Math.min(3600, 30 * 2 ** (attempts - 1)) }
    : { outcome: 'failed', delay_seconds: 0 };
}

export async function deliverWatchEvents(rpc: Rpc, vault: ReturnType<typeof destinationVault>, post: CallbackPost, now = Date.now) {
  let delivered = 0, failed = 0, retried = 0;
  // Claim one at a time: a slow batch cannot consume another row's lease before sending.
  for (let i = 0; i < 10; i++) {
    const row = await rpc<Delivery | null>('claim');
    if (!row) break;
    // Fresh ownership, expiry and lease check immediately before the external action.
    if (!await rpc('permit', { id: row.subscription_id, event: row.event_id, lease: row.lease, revision: row.revision })) continue;
    let status = 0;
    try {
      const destination = vault.open(row.sealed, row.subscription_id);
      const previous = row.previous_sealed && Date.parse(row.rotate_until ?? '') > now() ? vault.open(row.previous_sealed, row.subscription_id).secret : undefined;
      const event = { ...row.payload, data: { ...row.payload.data, zone: row.filters.zone,
        localAt: localMinuteIso(row.payload.timestamp, row.filters.zone), methodUrl: 'https://zodiacs.org/developers/compute/#events' } };
      const body = JSON.stringify(event);
      if (Buffer.byteLength(body) > 262_144) status = 413;
      else status = (await post(destination.url, signedHeaders(destination.secret, row.event_id, row.subscription_id, body, now(), previous), body)).status;
    } catch { /* Network errors retry; secrets and response bodies never enter logs. */ }
    const outcome = deliveryOutcome(status, row.attempts);
    await rpc('settle', { id: row.subscription_id, event: row.event_id, lease: row.lease, ...outcome });
    if (outcome.outcome === 'sent') delivered++; else if (outcome.outcome === 'retry') retried++; else failed++;
  }
  return { delivered, failed, retried };
}
