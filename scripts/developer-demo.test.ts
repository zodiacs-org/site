import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INPUT_SCHEMAS } from '../src/ai-tools/contracts';
import { SUCCESS_EXAMPLES } from '../src/lib/compute-api/examples';
import { differences, verdict } from '../src/lib/developer-playground';
import {
  CHART_PRESET,
  COMPATIBILITY_PRESET,
  MERCURY_WINDOW_DAYS,
  chartBody,
  computeCurl,
  mcpCall,
  mcpCurl,
  mercuryAnswered,
  mercuryBody,
  mercuryStations,
  offsetLabel,
  utcMinute,
} from '../src/lib/developer-demo';
import { NATAL_INPUT } from '../src/mcp/tools';
import { TIME_INPUT } from '../src/mcp/time-tools';
import { EVENTS_INPUT } from '../src/mcp/sky-tools';
import { DEMO_DATA_PATH, computeDemo, demoDrift } from './build-developer-demo';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const committed = JSON.parse(read(DEMO_DATA_PATH));
const examples = JSON.parse(read('src/lib/compute-api/examples.json'));

describe('the developer demo answers', () => {
  it('are what the compute API and get_compatibility answer now, but for the runtime that computed them', async () => {
    expect(demoDrift(committed, await computeDemo())).toEqual([]);
  }, 60_000);

  it('ask the birth chart question as the documented local-time example, and get its answer', () => {
    expect(committed.chart.request).toEqual(SUCCESS_EXAMPLES.chart.local.body);
    expect(chartBody(CHART_PRESET)).toEqual(SUCCESS_EXAMPLES.chart.local.body);
    expect(verdict(differences(examples.success.chart.local, committed.chart.answer))).not.toBe('different');
  });

  it('find the next Mercury retrograde station and the direct station after it', () => {
    const { retrograde, direct } = mercuryStations(committed.mercury.answers);
    expect(retrograde?.at.slice(0, 10)).toBe('2027-02-09');
    expect(direct?.at.slice(0, 10)).toBe('2027-03-03');
    expect(mercuryAnswered(committed.mercury.answers)).toBe(true);
    // The first window holds only the end of the retrograde under way on 2026-11-01.
    expect(committed.mercury.answers[0].result.events.map((event: { type: string }) => event.type)).toEqual(['direct']);
  });

  it('compare two synthetic births with the hosted tool, whose result keeps its own caveat', () => {
    const { result } = committed.compatibility;
    expect(result.ok).toBe(true);
    expect(result.tool).toBe('get_compatibility');
    expect(result.data.note).toMatch(/not a guarantee/u);
    expect(result.data.a.sun).toBe('pisces');
    expect(result.data.b.sun).toBe('scorpio');
  });
});

describe('the developer demo requests', () => {
  it('ask Mercury window by window, each window as long as the events budget allows', () => {
    const first = mercuryBody({ after: '2026-11-01' }, 0);
    const second = mercuryBody({ after: '2026-11-01' }, 1);
    expect(first).toEqual({ from: '2026-11-01T00:00:00Z', to: '2027-02-01T00:00:00Z', bodies: ['Mercury'], kinds: ['station'] });
    expect(second.from).toBe(first.to);
    expect((Date.parse(first.to) - Date.parse(first.from)) / 86_400_000).toBe(MERCURY_WINDOW_DAYS);
  });

  it('pick the first retrograde station, then the first direct one after it, whatever order the answers list them', () => {
    const station = (at: string, type: string) => ({ kind: 'station', body: 'Mercury', at, type, lon: 0, sign: 'aries', degree: 0 });
    const answers = [
      { result: { events: [station('2027-03-03T00:00:00Z', 'direct'), station('2026-11-13T00:00:00Z', 'direct')] } },
      { result: { events: [station('2027-02-09T00:00:00Z', 'retrograde')] } },
    ];
    expect(mercuryStations(answers).retrograde?.at).toBe('2027-02-09T00:00:00Z');
    expect(mercuryStations(answers).direct?.at).toBe('2027-03-03T00:00:00Z');
    expect(mercuryAnswered(answers.slice(0, 1))).toBe(false);
  });

  it('are MCP calls the tools accept', () => {
    const chart = committed.chart.answer.result;
    expect(TIME_INPUT.safeParse({ local: chartBody(CHART_PRESET).local, longitude: CHART_PRESET.longitude }).success).toBe(true);
    expect(NATAL_INPUT.safeParse({ utc: chart.instant, latitude: CHART_PRESET.latitude, longitude: CHART_PRESET.longitude, houseSystem: 'whole' }).success).toBe(true);
    for (const request of committed.mercury.requests) {
      expect(INPUT_SCHEMAS.get_upcoming_events.safeParse(request).success).toBe(true);
      expect(EVENTS_INPUT.safeParse(request).success).toBe(true);
    }
    expect(INPUT_SCHEMAS.get_compatibility.safeParse(COMPATIBILITY_PRESET).success).toBe(true);
    expect(mcpCall('get_compatibility', COMPATIBILITY_PRESET)).toEqual({
      jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_compatibility', arguments: COMPATIBILITY_PRESET },
    });
  });

  it('are cURL commands a shell reads back to the same body', () => {
    const curl = mcpCurl('get_compatibility', { a: { place: "Dun Laoghaire's pier" } });
    expect(curl).toContain('https://zodiacs.org/mcp');
    expect(curl).toContain("--header 'Accept: application/json, text/event-stream'");
    expect(curl).toContain("Dun Laoghaire'\\''s pier");
    expect(computeCurl('chart', chartBody(CHART_PRESET))).toContain('https://zodiacs.org/api/v1/chart');
  });

  it('say instants and offsets in plain words', () => {
    expect(utcMinute('2027-02-09T17:35:47.590Z')).toBe('9 February 2027, 17:35 UTC');
    expect(offsetLabel(120)).toBe('UTC+2');
    expect(offsetLabel(-210)).toBe('UTC-3:30');
    expect(offsetLabel(0)).toBe('UTC');
  });
});

describe('the developer demo copy', () => {
  const files = ['src/islands/DeveloperDemo.tsx', 'src/lib/developer-demo.ts', 'src/pages/developers/demo/index.astro'];

  it('uses no em or en dash', () => {
    for (const path of files) expect(read(path), path).not.toMatch(/[–—]|&[mn]dash;/u);
  });

  it('calls a measured difference a sample maximum and never a guarantee', () => {
    const island = read('src/islands/DeveloperDemo.tsx');
    expect(island).toContain('A sample maximum is the largest difference found in the cases measured. It is not a bound for every date.');
    for (const path of files) expect(read(path), path).not.toMatch(/\bguarantee/iu);
  });
});
