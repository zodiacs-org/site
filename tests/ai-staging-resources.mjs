/** Isolated synthetic preview measurements. Credentials never enter evidence. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const url = new URL(process.env.ZODIACS_STAGING_MCP_URL);
assert.equal(url.protocol, 'https:'); assert.ok(url.hostname.endsWith('.vercel.app'));
assert.equal(url.pathname, '/mcp'); assert.equal(url.search, '');
const jar = await readFile(process.env.ZODIACS_STAGING_COOKIE_FILE, 'utf8');
const cookie = jar.split('\n').filter(line => line && (!line.startsWith('#') || line.startsWith('#HttpOnly_')))
  .map(line => line.replace(/^#HttpOnly_/, '').split('\t'))
  .filter(fields => fields.length === 7 && fields[0].replace(/^\./, '') === url.hostname)
  .map(fields => `${fields[5]}=${fields[6]}`).join('; ');
assert.ok(cookie);
const phase = process.env.ZODIACS_STAGING_RESOURCE_PHASE;
assert.ok(['latency', 'event-concurrency', 'request-concurrency'].includes(phase));
const client = new Client({ name: 'zodiacs-resource-review', version: '1' });
const evidence = { schema: 'zodiacs.staging-resources.v1', phase, startedAt: new Date().toISOString(), url: url.href,
  sourceCommit: process.env.ZODIACS_STAGING_SOURCE_COMMIT, observations: [] };
await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Cookie: cookie } } }));
try {
  const call = async (name, args) => {
    const start = performance.now();
    try {
      const result = await client.callTool({ name, arguments: args });
      const value = result.structuredContent;
      return { name, elapsedMs: Math.round((performance.now() - start) * 100) / 100,
        ok: value?.ok === true, errorCode: value?.error?.code ?? null,
        engine: value?.data?.calculation?.cite?.version ?? value?.data?.engine?.version ?? null,
        resultBytes: Buffer.byteLength(JSON.stringify(result)) };
    } catch (error) {
      // HTTP request-ceiling rejection has no tool result. Keep only its
      // stable numeric status; transport diagnostics may contain auth headers.
      const status = error?.status ?? error?.data?.status ?? error?.code ?? null;
      return { name, elapsedMs: Math.round((performance.now() - start) * 100) / 100,
        ok: false, transportStatus: typeof status === 'number' ? status : null };
    }
  };
  if (phase === 'latency') {
    const cases = [
      ['get_capabilities', {}],
      ['get_sky', { instant: '2026-10-01T06:00:00Z', zone: 'Asia/Bangkok' }],
      ['get_upcoming_events', { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', zone: 'UTC' }],
      ['get_upcoming_events', { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z', zone: 'America/New_York' }],
      ['check_sky_fact', { kind: 'ingress', body: 'Sun', sign: 'libra', date: '2026-09-23', zone: 'Asia/Bangkok' }],
      ['search_zodiacs', { query: 'Moon sign' }],
    ];
    for (let repetition = 1; repetition <= 3; repetition++) {
      for (const [caseIndex, [name, args]] of cases.entries()) {
        const observation = await call(name, args);
        evidence.observations.push({ repetition, caseIndex, ...observation });
        assert.equal(observation.ok, true, `${name} must return a supported complete result`);
        if (observation.engine) assert.equal(observation.engine, '0.1.1-rc.16');
      }
    }
    evidence.scope = '18 sequential synthetic completions plus SDK protocol overhead, isolated preview. RTT includes client network, two Japan database admissions for expensive tools, engine and transport. Not a provider cold-start classification or invoice.';
  } else {
    const event = phase === 'event-concurrency';
    const count = event ? 12 : 48;
    evidence.observations = await Promise.all(Array.from({ length: count }, () => call(event ? 'get_upcoming_events' : 'get_capabilities', event
      ? { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', kinds: ['lunation'] } : {})));
    const allowed = evidence.observations.filter(row => row.ok).length;
    const failed = evidence.observations.filter(row => !row.ok);
    assert.ok(allowed > 0 && allowed <= (event ? 10 : 40), 'No concurrent quota overshoot');
    assert.ok(failed.length > 0, 'Concurrent burst must encounter the ceiling');
    evidence.admitted = allowed; evidence.refused = failed.length;
    evidence.refusalCounts = Object.fromEntries([...new Set(failed.map(row => row.errorCode ?? row.transportStatus))]
      .map(code => [String(code), failed.filter(row => (row.errorCode ?? row.transportStatus) === code).length]));
    evidence.finishedAt = new Date().toISOString();
    // Preserve observed refusals even when an unexpected transport fails.
    await writeFile(process.env.ZODIACS_STAGING_EVIDENCE_FILE, JSON.stringify(evidence, null, 2) + '\n');
    for (const row of failed) assert.ok(row.errorCode === 'rate-limited' || [429, 503].includes(row.transportStatus), 'Only quota or fail-closed availability refusals are acceptable');
    evidence.strictCeilingPassed = true;
    evidence.availabilityAtBurstPassed = !failed.some(row => row.transportStatus === 503);
    evidence.scope = 'Quiet expired preview window. Existing per-address Firewall and global atomic budget both apply. SDK initialization also uses incoming slots, so general-call successes may be below 40. Exact 10/40 atomic counts are separately proved by PostgreSQL and REST contention tests.';
  }
  evidence.finishedAt = new Date().toISOString();
  await writeFile(process.env.ZODIACS_STAGING_EVIDENCE_FILE, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ phase, observations: evidence.observations.length, admitted: evidence.admitted, refused: evidence.refused }));
} finally { await client.close(); }
