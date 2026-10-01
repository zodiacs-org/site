import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import * as localTime from '../api/_compute/local-time.mjs';
import { executeAiTool } from '../src/ai-tools/tools';
import type { AiToolName } from '../src/ai-tools/contracts';
import { natalChart, ENGINE_VERSION } from '@zodiacs/engine';
import { createNatalEnvelope } from '@zodiacs/engine/receipt';
import { scanTransitContacts } from '../src/lib/engine/transit-scan';

const cases = JSON.parse(await readFile(new URL('../integrations/chatgpt/evaluation-cases.json', import.meta.url), 'utf8'));
assert.equal(cases.length, 40);
const timings: number[] = [], results = [];
for (const entry of cases) {
  const start = performance.now();
  const result = await executeAiTool(entry.tool as AiToolName, entry.args, { localTime, now: () => new Date('2026-10-01T06:00:00Z') });
  timings.push(performance.now() - start);
  assert.equal(result.ok, entry.ok, `${entry.id}: expected ${entry.ok}, received ${JSON.stringify(result)}`);
  assert.ok(!JSON.stringify(result).includes('private-canary'));
  if (result.ok) {
    if (entry.answer && result.tool === 'check_sky_fact') assert.equal(result.data.answer, entry.answer);
    if (entry.empty && result.tool === 'get_upcoming_events') assert.equal(result.data.events.length, 0);
    for (const link of result.links) { const url = new URL(link.url); assert.equal(url.origin, 'https://zodiacs.org'); assert.equal(url.search, ''); }
  }
  results.push({ id: entry.id, passed: true, tool: entry.tool });
}
// Synthetic concept only: no consumer personal-chart endpoint or data collection.
const chart = natalChart({ utc: new Date('1990-06-15T12:00:00Z'), timeKnown: false });
const envelope = createNatalEnvelope(chart, { reference: 'utc-noon' });
const contacts = scanTransitContacts(chart, new Date('2026-10-01T00:00:00Z'), new Date('2026-10-08T00:00:00Z'), { includeMoon: true, transitBodies: ['Sun', 'Moon', 'Mercury', 'Venus'], natalPoints: ['Sun', 'Moon'], aspects: ['conjunction', 'sextile', 'square', 'trine', 'opposition'] });
assert.ok(contacts.length > 0, 'The synthetic demonstration should contain numerical contacts to inspect.');
timings.sort((a, b) => a - b);
const report = { schema: 'zodiacs.ai-evaluation.v1', scope: 'Local adapter with preselected tools and synthetic inputs; not LLM routing, host acceptance, accuracy-reference, load or production latency testing.', engine: ENGINE_VERSION, cases: results, localMilliseconds: { median: timings[Math.floor(timings.length / 2)], p95: timings[Math.floor(timings.length * 0.95)] }, unverified: ['Actual ChatGPT and Codex host acceptance', 'Hosted cold/warm latency, cost and capacity', 'Hosting-layer retention', 'Consenting beta panel and repeat use', 'Public submission and approval'] };
const out = new URL('../docs/platform/zodiacs-ai/evidence/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL('evaluation.json', out), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(new URL('synthetic-personal-week.json', out), `${JSON.stringify({ synthetic: true, description: 'Concept demonstration only; arbitrary date, unknown time, no angles or houses. Contacts are numerical facts, not predictions. Scanner completeness is not proven.', engine: ENGINE_VERSION, natal: envelope, from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', contacts }, null, 2)}\n`);
console.log(`AI adapter evaluation: ${results.length}/40 passed; synthetic personal-week concept generated.`);
