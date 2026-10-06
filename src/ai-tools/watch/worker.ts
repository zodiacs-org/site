import { executeAiTool, displayTime } from '../tools';
import { DAY, WATCH_VERSION, type Delivery, type Rpc } from './contracts';
import { digest, type destinationVault } from './crypto';
import { signedHeaders, type CallbackPost } from './callback';

export async function calculateWindow(from: string, to: string) {
  from = new Date(from).toISOString(); to = new Date(to).toISOString();
  const result = await executeAiTool('get_upcoming_events', { from, to, zone: 'UTC', kinds: ['ingress', 'station', 'lunation'] }, {});
  if (!result.ok || result.tool !== 'get_upcoming_events') throw new Error('search-refused');
  const data = result.data as any;
  if (data.completeness !== 'tested-not-proven') throw new Error('search-incomplete');
  return data.events.map(({ localAt: _localAt, ...event }: any) => ({
    eventId: `evt_${digest(JSON.stringify([WATCH_VERSION, from, event]))}`,
    name: `zodiacs.sky.${event.kind}`, timestamp: event.at, data: { event, receipt: data.calculation.receipt }, cursor: null,
  }));
}

/** Fixed UTC-day partitions, persisted cursor, compare-and-swap ingestion and bounded catch-up.
 * Replaying the same day produces identical IDs; engine changes refuse the existing ledger.
 */
export async function fillWatchLedger(rpc: Rpc, now = Date.now(), calculate = calculateWindow) {
  let filled = 0;
  for (; filled < 3; filled++) {
    const from = await rpc<string>('window', { version: WATCH_VERSION, start: new Date(Math.floor(now / DAY) * DAY).toISOString() });
    if (Date.parse(from) >= Math.floor(now / DAY) * DAY + 2 * DAY) break;
    const to = new Date(Date.parse(from) + DAY).toISOString();
    const events = await calculate(from, to); // A refusal leaves the cursor untouched.
    await rpc('ingest', { version: WATCH_VERSION, from, to, events });
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
        localAt: displayTime(row.payload.timestamp, row.filters.zone), methodUrl: 'https://zodiacs.org/developers/compute/#events' } };
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
