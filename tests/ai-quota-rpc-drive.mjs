/** Explicit synthetic preview-only test; authentication stays in a private file. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const env = JSON.parse(await readFile(process.env.ZODIACS_QUOTA_PRIVATE_FILE, 'utf8'));
const url = new URL(env.PUBLIC_SUPABASE_URL);
assert.equal(url.protocol, 'https:');
assert.ok(url.hostname.endsWith('.supabase.co'));
const key = env.SUPABASE_SERVICE_ROLE_KEY;
assert.equal(typeof key, 'string');
const headers = { apikey: key, 'Content-Type': 'application/json' };
if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
const evidence = { schema: 'zodiacs.atomic-quota-rpc.v1', capturedAt: new Date().toISOString(), scope: 'preview', budgets: [] };
for (const [kind, maximum] of [['event', 10], ['request', 40]]) {
  const started = performance.now();
  const results = await Promise.all(Array.from({ length: 48 }, async () => {
    const response = await fetch(new URL('/rest/v1/rpc/zodiacs_mcp_quota_reserve_v1', url), {
      method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ quota_scope: 'preview', quota_kind: kind }),
    });
    assert.equal(response.status, 200, 'RPC authentication/permissions must pass');
    const value = await response.json(); assert.equal(typeof value, 'boolean'); return value;
  }));
  const admitted = results.filter(Boolean).length;
  assert.equal(admitted, maximum, 'Run in a quiet, newly expired preview window');
  evidence.budgets.push({ kind, simultaneousRequests: results.length, admitted, refused: results.length - admitted, elapsedMs: Math.round(performance.now() - started) });
}
evidence.limits = 'Real concurrent REST requests to the shared database; preview-only aggregate counters. Separate SQL tests force contention in independent PostgreSQL sessions. No public capacity or per-user fairness claim.';
await writeFile(process.env.ZODIACS_QUOTA_EVIDENCE_FILE, JSON.stringify(evidence, null, 2) + '\n');
console.log('Preview atomic RPC passed: exact 10/48 event and 40/48 incoming ceilings.');
