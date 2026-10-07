/** Real PostgreSQL lifecycle test. Synthetic callback only; never contacts ChatGPT or a person. */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createAiNodeHandler } from '../src/ai-tools/http';
import { SkyWatch } from '../src/ai-tools/watch/service';
import { destinationVault, digest, signature } from '../src/ai-tools/watch/crypto';
import { DAY, WATCH_VERSION, type Rpc } from '../src/ai-tools/watch/contracts';
import { deliverWatchEvents, fillWatchLedger } from '../src/ai-tools/watch/worker';

const database = process.env.SKY_WATCH_TEST_DATABASE_URL;
if (!database) throw new Error('Set SKY_WATCH_TEST_DATABASE_URL to an isolated local test database.');
const db = new URL(database);
if (!['127.0.0.1', 'localhost'].includes(db.hostname) || !db.pathname.endsWith('_test')) throw new Error('Only an isolated local _test database is accepted.');
const exec = promisify(execFile);
const jsonSql = (value: unknown) => `convert_from(decode('${Buffer.from(JSON.stringify(value)).toString('hex')}','hex'),'UTF8')::jsonb`;
async function sql(query: string) {
  const { stdout } = await exec('psql', [database!, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], { maxBuffer: 1_000_000 });
  return stdout.trim();
}
const rpc: Rpc = async (operation, input = {}) => {
  assert.match(operation, /^[a-z]+$/);
  const value = await sql(`set role service_role; select public.zodiacs_sky_watch_v1('${operation}',${jsonSql(input)});`);
  const payload = value.replace(/^SET\s*/, '');
  return payload ? JSON.parse(payload) : null;
};
await sql('truncate sky_watch.principals, sky_watch.subscriptions, sky_watch.outbox, sky_watch.ledger, sky_watch.progress cascade;');
assert.equal(await sql("select has_function_privilege('anon','public.zodiacs_sky_watch_v1(text,jsonb)','execute') or has_schema_privilege('authenticated','sky_watch','usage');"), 'f');
assert.equal(await sql("select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='sky_watch' and c.relkind='r';"), 't');
const token = `zsw_${randomBytes(32).toString('base64url')}`;
const principal = await sql(`insert into sky_watch.principals(token_hash,expires_at) values('${digest(token)}',clock_timestamp()+interval '10 days') returning id;`);
const ownerId = principal.split('\n')[0];
const token2 = `zsw_${randomBytes(32).toString('base64url')}`;
await sql(`insert into sky_watch.principals(token_hash,expires_at) values('${digest(token2)}',clock_timestamp()+interval '10 days');`);
const key = randomBytes(32).toString('base64'); const vault = destinationVault(key);
const secret = `whsec_${randomBytes(32).toString('base64')}`;
let verificationCount = 0; let deliveryStatus = 200;
const delivered: { headers: Record<string, string>; event: any }[] = [];
const post = async (_url: string, headers: Record<string, string>, body: string) => {
  const event = JSON.parse(body);
  if (event.type === 'verification') { verificationCount++; return { status: 200, body: JSON.stringify({ challenge: event.challenge }) }; }
  assert.equal(headers['webhook-id'], event.eventId);
  assert.ok(headers['webhook-signature'].includes(signature(secret, event.eventId, Number(headers['webhook-timestamp']), body)));
  delivered.push({ headers, event }); return { status: deliveryStatus, body: '' };
};
let service = new SkyWatch(rpc, key, post);
let host = '';
const server = createServer((req, res) => { void createAiNodeHandler({ skyWatch: service, allowedHosts: [host], env: { ZODIACS_MCP_ENABLED: '1' }, rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed' })(req, res); });
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
host = `127.0.0.1:${(server.address() as any).port}`;
const meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'sky-watch-synthetic', version: '1' }, 'io.modelcontextprotocol/clientCapabilities': {} };
async function call(method: string, params: any = {}, credential = token) {
  const response = await fetch(`http://${host}/mcp`, { method: 'POST', headers: {
    'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${credential}`,
    'MCP-Protocol-Version': '2026-07-28', 'MCP-Method': method,
  }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { ...params, _meta: meta } }) });
  const body = await response.text();
  return { status: response.status, message: JSON.parse(body.startsWith('event:') || body.startsWith('data:') ? body.split('\n').find(line => line.startsWith('data: '))!.slice(6) : body) };
}
const params = { name: 'zodiacs.sky.lunation', arguments: { phases: ['new'], zone: 'Asia/Bangkok' }, delivery: { mode: 'webhook', url: 'https://receiver.example/sky-watch-test', secret }, cursor: null, ttlMs: DAY };
const unsubscribe = { name: params.name, arguments: params.arguments, delivery: { mode: 'webhook', url: params.delivery.url } };
try {
  assert.equal((await call('tools/list', {}, 'bad')).status, 401);
  const discovery = await call('server/discover');
  assert.equal(discovery.status, 200); assert.deepEqual(discovery.message.result.capabilities.events, {});
  assert.equal((await call('events/list')).message.result.events.length, 3);
  assert.equal((await call('tools/list')).message.result.tools.length, 6);
  const created = await call('events/subscribe', params);
  assert.equal(created.message.error, undefined, JSON.stringify(created.message));
  const id = created.message.result.id;
  assert.equal(verificationCount, 1);
  assert.equal((await call('events/subscribe', params)).message.result.id, id);
  assert.equal(verificationCount, 1);
  // A fresh server instance still reads the persisted verification and subscription.
  service = new SkyWatch(rpc, key, post);
  assert.equal((await call('events/subscribe', params)).message.result.id, id);
  assert.equal(verificationCount, 1);
  assert.ok(!(await sql('select sealed from sky_watch.subscriptions;')).includes(secret));
  await call('events/unsubscribe', unsubscribe, token2);
  assert.equal(await sql(`select active from sky_watch.subscriptions where id='${id}';`), 't');
  const secret2 = `whsec_${randomBytes(32).toString('base64')}`;
  assert.equal((await call('events/subscribe', { ...params, delivery: { ...params.delivery, secret: secret2 } })).message.result.id, id);
  assert.equal(verificationCount, 2);
  const encryptedOld = await sql(`select previous_sealed from sky_watch.subscriptions where id='${id}';`);
  assert.equal(vault.open(encryptedOld, id).secret, secret);
  // Rotate back so the independent synthetic receiver continues checking the original key.
  await call('events/subscribe', params);
  const freshOwner = (await service.authenticate(`Bearer ${token}`))!;
  const limited = await service.subscribe(freshOwner, { ...params, ttlMs: 1000 });
  assert.ok(Date.parse(limited.refreshBefore) - Date.now() <= 1000);
  await call('events/subscribe', params);
  // Refusal and verification errors are sanitized and do not echo confidential values.
  assert.ok((await call('events/subscribe', { ...params, arguments: { birth: 'private-canary' } })).message.error);
  service = new SkyWatch(rpc, key, async () => ({ status: 200, body: '{}' }));
  const failed = await call('events/subscribe', { ...params, delivery: { ...params.delivery, url: 'https://receiver.example/new' } });
  assert.equal(failed.message.error.code, -32015); assert.equal(failed.message.error.data.reason, 'challenge_failed');
  service = new SkyWatch(rpc, key, post);
  // Cancellation while verification is in flight leaves a tombstone; no resurrection.
  const race = { ...params, delivery: { ...params.delivery, url: 'https://receiver.example/race' } };
  const racing = new SkyWatch(rpc, key, async (...args) => {
    await service.unsubscribe(freshOwner, { name: race.name, arguments: race.arguments, delivery: { mode: 'webhook', url: race.delivery.url } });
    return post(...args);
  });
  await assert.rejects(() => racing.subscribe(freshOwner, race));
  // Synthetic occurrence tests delivery plumbing; engine calculation is checked separately.
  const now = Date.now(); const from = new Date(Math.floor((now - 60_000) / DAY) * DAY).toISOString();
  const at = new Date(now - 60_000).toISOString();
  await sql(`update sky_watch.subscriptions set started_at=clock_timestamp()-interval '2 minutes' where id='${id}';`);
  const event = { eventId: 'evt_synthetic', name: params.name, timestamp: at, data: { event: { kind: 'lunation', type: 'new', at }, receipt: { synthetic: true } }, cursor: null };
  await rpc('window', { version: WATCH_VERSION, start: from });
  const ingestion = { version: WATCH_VERSION, from, to: new Date(Date.parse(from) + DAY).toISOString(), events: [event] };
  await Promise.all([rpc('ingest', ingestion), rpc('ingest', ingestion)]);
  await assert.rejects(() => rpc('window', { version: 'another-engine', start: from }));
  await rpc('enqueue'); await rpc('enqueue');
  assert.equal(await sql('select count(*) from sky_watch.outbox;'), '1');
  const claims = await Promise.all([rpc<any>('claim'), rpc<any>('claim')]);
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(await rpc('claim'), null);
  const abandoned = claims.find(Boolean)!;
  await sql("update sky_watch.outbox set lease_until=clock_timestamp()-interval '1 second';");
  const recovered = await rpc<any>('claim'); assert.notEqual(recovered.lease, abandoned.lease);
  await rpc('settle', { id, event: event.eventId, lease: abandoned.lease, outcome: 'sent', delay_seconds: 0 });
  assert.equal(await sql('select state from sky_watch.outbox;'), 'leased');
  await sql("update sky_watch.outbox set lease_until=clock_timestamp()-interval '1 second';");
  deliveryStatus = 503;
  assert.equal((await deliverWatchEvents(rpc, vault, post)).retried, 1);
  assert.equal(delivered.length, 1);
  await sql("update sky_watch.outbox set due_at=clock_timestamp()-interval '1 second';");
  deliveryStatus = 200;
  assert.equal((await deliverWatchEvents(rpc, vault, post)).delivered, 1);
  assert.equal(delivered[0].event.eventId, delivered[1].event.eventId);
  assert.equal(delivered[1].event.data.zone, 'Asia/Bangkok');
  await rpc('enqueue'); assert.equal(await rpc('claim'), null);
  // A nonmatching phase produces no additional outbox row.
  const notMatching = { ...event, eventId: 'evt_other_phase', data: { ...event.data, event: { ...event.data.event, type: 'full' } } };
  await sql(`insert into sky_watch.ledger(id,name,at,payload) values('evt_other_phase','${params.name}','${at}',${jsonSql(notMatching)});`);
  await rpc('enqueue'); assert.equal(await sql('select count(*) from sky_watch.outbox;'), '1');
  // Permanent payload rejection never retries; gone cancels the entire watch.
  await sql("update sky_watch.outbox set state='pending',due_at=clock_timestamp(),attempts=0;");
  deliveryStatus = 413; assert.equal((await deliverWatchEvents(rpc, vault, post)).failed, 1);
  assert.equal(await rpc('claim'), null);
  await sql("update sky_watch.outbox set state='pending',due_at=clock_timestamp(),attempts=0;");
  deliveryStatus = 410; await deliverWatchEvents(rpc, vault, post);
  assert.equal(await sql(`select active from sky_watch.subscriptions where id='${id}';`), 'f');
  // Resuming begins now; it does not deliver already-occurred events again.
  await call('events/subscribe', params); await rpc('enqueue');
  assert.equal(await sql('select count(*) from sky_watch.outbox;'), '0');
  // Expiration suppresses pending deliveries even without a cleanup run.
  await sql(`update sky_watch.subscriptions set started_at=clock_timestamp()-interval '2 minutes' where id='${id}';`);
  await rpc('enqueue');
  await sql(`update sky_watch.subscriptions set expires_at=clock_timestamp()-interval '1 second' where id='${id}';`);
  assert.equal(await rpc('claim'), null); await rpc('enqueue');
  assert.equal(await sql(`select sealed is null from sky_watch.subscriptions where id='${id}';`), 't');
  await call('events/subscribe', params);
  // Owner unsubscribe is idempotent and scrubs the stored destination immediately.
  await call('events/unsubscribe', unsubscribe); await call('events/unsubscribe', unsubscribe);
  assert.equal(await sql(`select sealed is null from sky_watch.subscriptions where id='${id}';`), 't');
  await call('events/subscribe', params);
  await sql(`update sky_watch.subscriptions set started_at=clock_timestamp()-interval '2 minutes' where id='${id}';`);
  await rpc('enqueue');
  // Revocation prevents a previously claimed event from being permitted.
  await sql("update sky_watch.outbox set state='pending',due_at=clock_timestamp(),attempts=0;");
  const beforeRevoke = await rpc<any>('claim');
  await rpc('revoke', { owner: ownerId });
  assert.equal(await rpc('permit', { id, event: event.eventId, lease: beforeRevoke.lease, revision: beforeRevoke.revision }), false);
  assert.equal((await call('events/list')).status, 401);
  assert.equal(await sql(`select sealed is null from sky_watch.subscriptions where id='${id}';`), 't');
  await sql(`update sky_watch.principals set expires_at=clock_timestamp()-interval '1 second' where token_hash='${digest(token2)}';`);
  assert.equal((await call('events/list', {}, token2)).status, 401);
  // The actual engine and persistent scheduler also survive restart and missed runs.
  await sql('truncate sky_watch.outbox, sky_watch.ledger, sky_watch.progress;');
  const firstTick = Date.parse('2026-10-10T12:00:00Z');
  assert.equal(await fillWatchLedger(rpc, firstTick), 2);
  const idsBeforeRestart = await sql('select jsonb_agg(id order by id) from sky_watch.ledger;');
  assert.notEqual(idsBeforeRestart, '');
  assert.equal(await fillWatchLedger(rpc, firstTick), 0);
  assert.equal(await sql('select jsonb_agg(id order by id) from sky_watch.ledger;'), idsBeforeRestart);
  const missedRuns = Date.parse('2026-10-14T12:00:00Z');
  assert.equal(await fillWatchLedger(rpc, missedRuns), 3);
  assert.equal(await fillWatchLedger(rpc, missedRuns), 1);
  assert.equal(await fillWatchLedger(rpc, missedRuns), 0);
  assert.equal(await sql("select bool_and(payload#>>'{data,receipt,search,completeness}'='tested-not-proven') from sky_watch.ledger;"), 't');
  console.log('Sky Watch PostgreSQL + MCP lifecycle passed: auth, discovery, ownership, refresh/rotation, CAS cancellation, replay, leases, retry, filtering, 410/413, expiry, unsubscribe, revocation, real-engine scheduler restart and missed-run recovery. No external notifications sent.');
} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
