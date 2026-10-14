import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APPLIES, NOT_APPLICABLE, TOOL_INPUTS, judgeConformance, readConformanceResults } from './remote-mcp-review.mjs';

let dir;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'remote-mcp-review-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function result(scenario, statuses, stamp = '2026-10-15T01-02-03-456Z') {
  const folder = join(dir, `server-${scenario}-${stamp}`);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'checks.json'), JSON.stringify(statuses.map((status, index) => ({
    id: `${scenario}-${index}`, name: `${scenario} check ${index}`, status, errorMessage: status === 'FAILURE' ? 'refused' : undefined,
  }))));
}

describe('the conformance results', () => {
  it('reads each scenario the suite wrote, by its result folder, and counts its checks', async () => {
    await result('server-initialize', ['SUCCESS']);
    await result('tools-call-simple-text', ['FAILURE']);
    await mkdir(join(dir, 'unrelated'));
    const scenarios = readConformanceResults(dir);
    expect([...scenarios.keys()].sort()).toEqual(['server-initialize', 'tools-call-simple-text']);
    expect(scenarios.get('tools-call-simple-text')).toEqual({ counts: { FAILURE: 1 }, failed: ['tools-call-simple-text check 0: refused'], checks: 1 });
  });

  it('passes when every scenario that applies passes, and records the others with their reason', async () => {
    for (const name of APPLIES.keys()) await result(name, ['SUCCESS', 'WARNING']);
    await result('tools-call-simple-text', ['FAILURE']);
    await result('dns-rebinding-protection', ['FAILURE', 'FAILURE']);
    await result('server-sse-multiple-streams', ['WARNING']);
    const verdict = judgeConformance(readConformanceResults(dir));
    expect(verdict.passed).toBe(true);
    expect(verdict.scenarios.find((row) => row.scenario === 'tools-list')).toMatchObject({ applies: true, outcome: 'WARNING' });
    expect(verdict.scenarios.find((row) => row.scenario === 'dns-rebinding-protection')).toMatchObject({ applies: false, outcome: 'FAILURE' });
    expect(verdict.scenarios.find((row) => row.scenario === 'dns-rebinding-protection').reason).toMatch(/localhost/);
  });

  it('fails when a scenario that applies fails or is missing, and when one is not classified', async () => {
    await result('server-initialize', ['SUCCESS']);
    await result('ping', ['FAILURE']);
    await result('tools-list', ['SUCCESS']);
    await result('a-new-scenario', ['SUCCESS']);
    const verdict = judgeConformance(readConformanceResults(dir));
    expect(verdict.passed).toBe(false);
    expect(verdict.problems).toEqual([
      'resources-list did not run',
      'a-new-scenario is not classified: read the scenario and add it to APPLIES or NOT_APPLICABLE',
      'ping: ping check 0: refused',
    ]);
  });

  it('classifies every active server scenario of the pinned suite', () => {
    const active = ['server-initialize', 'logging-set-level', 'ping', 'completion-complete', 'tools-list',
      'tools-call-simple-text', 'tools-call-image', 'tools-call-audio', 'tools-call-embedded-resource', 'tools-call-mixed-content',
      'tools-call-with-logging', 'tools-call-error', 'tools-call-with-progress', 'tools-call-sampling', 'tools-call-elicitation',
      'server-sse-multiple-streams', 'resources-list', 'resources-read-text', 'resources-read-binary', 'resources-templates-read',
      'resources-subscribe', 'resources-unsubscribe', 'prompts-list', 'prompts-get-simple', 'prompts-get-with-args',
      'prompts-get-embedded-resource', 'prompts-get-with-image', 'dns-rebinding-protection'];
    for (const name of active) {
      expect(APPLIES.has(name) || NOT_APPLICABLE.some(([pattern]) => pattern.test(name)), name).toBe(true);
    }
    expect(NOT_APPLICABLE.some(([pattern]) => pattern.test('resources-list'))).toBe(false);
  });

  it('has an input for each tool the hosted server lists', () => {
    expect(Object.keys(TOOL_INPUTS).sort()).toEqual(['check_sky_fact', 'get_capabilities', 'get_horoscope', 'get_sky', 'get_upcoming_events', 'open_chart_studio']);
  });
});
