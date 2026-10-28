/**
 * Writes the developer demo's answers.
 *
 *   npx vite-node --script scripts/build-developer-demo.ts           # write src/data/developer-demo.json
 *   npx vite-node --script scripts/build-developer-demo.ts --check   # fail if it no longer matches
 *
 * Runs each of the demo's preset questions (src/lib/developer-demo.ts) through
 * the real code: the birth chart and the Mercury stations through the compute
 * API's dispatch (src/lib/compute-api/playground.ts, held to the hosted
 * handler by tests/api/compute-api-playground.test.ts), and the comparison of
 * two charts through the hosted MCP server's get_compatibility tool
 * (src/ai-tools/tools.ts), as production offers it with the occasion tools on.
 * /developers/demo/ shows what it writes before a visitor edits a question.
 *
 * A receipt names the runtime that read local times, Node and the tzdb release
 * its Intl reads, so --check compares as the playground does and accepts a
 * difference that is the runtime's alone, with the citation digest that follows
 * from it. scripts/developer-demo.test.ts runs the same check.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { executeAiTool } from '../src/ai-tools/tools';
import { answerHere } from '../src/lib/compute-api/playground';
import { differences, verdict } from '../src/lib/developer-playground';
import {
  CHART_PRESET,
  COMPATIBILITY_PRESET,
  DEMO_DATA_SCHEMA,
  MERCURY_MAX_WINDOWS,
  MERCURY_PRESET,
  chartBody,
  mercuryAnswered,
  mercuryBody,
} from '../src/lib/developer-demo';

export const DEMO_DATA_PATH = 'src/data/developer-demo.json';

export async function computeDemo() {
  const chartRequest = chartBody(CHART_PRESET);
  const chart = await answerHere('chart', JSON.stringify(chartRequest));
  if (chart.status !== 200) throw new Error(`chart preset refused: ${JSON.stringify(chart.body)}`);

  const requests = [];
  const answers = [];
  for (let index = 0; index < MERCURY_MAX_WINDOWS && !mercuryAnswered(answers); index += 1) {
    const request = mercuryBody(MERCURY_PRESET, index);
    const answer = await answerHere('events', JSON.stringify(request));
    if (answer.status !== 200) throw new Error(`events preset refused: ${JSON.stringify(answer.body)}`);
    requests.push(request);
    answers.push(answer.body);
  }
  if (!mercuryAnswered(answers)) throw new Error('no Mercury retrograde and direct station in the preset windows');

  const compatibilityArguments = { a: COMPATIBILITY_PRESET.a, b: COMPATIBILITY_PRESET.b };
  const compatibility = await executeAiTool('get_compatibility', compatibilityArguments, { occasions: true });
  if (!compatibility.ok) throw new Error(`get_compatibility refused the preset: ${JSON.stringify(compatibility)}`);

  return {
    schema: DEMO_DATA_SCHEMA,
    generatedBy: 'scripts/build-developer-demo.ts',
    chart: { input: CHART_PRESET, request: chartRequest, answer: chart.body },
    mercury: { input: MERCURY_PRESET, requests, answers },
    compatibility: { input: COMPATIBILITY_PRESET, arguments: compatibilityArguments, result: compatibility },
  };
}

export function serializeDemo(demo: unknown): string {
  return `${JSON.stringify(demo, null, 2)}\n`;
}

type Demo = Awaited<ReturnType<typeof computeDemo>>;

/**
 * Where the committed answers differ from fresh ones for a reason other than
 * the runtime that computed them, or the last digits a runtime's own sine and
 * cosine can move: each compute API answer is compared as the playground
 * compares two (its receipt paths are the answer's own), and everything else
 * must be the same.
 */
export function demoDrift(committed: Demo, fresh: Demo): string[] {
  const drift: string[] = [];
  const answer = (name: string, left: unknown, right: unknown) => {
    const found = differences(left, right);
    if (verdict(found) === 'different') {
      for (const { path, left: was, right: now } of found.filter(({ kind }) => kind === 'value')) {
        drift.push(`${name}${path}: ${JSON.stringify(was)} -> ${JSON.stringify(now)}`);
      }
    }
  };
  answer('/chart/answer', committed.chart?.answer, fresh.chart.answer);
  const windows = Math.max(committed.mercury?.answers?.length ?? 0, fresh.mercury.answers.length);
  for (let index = 0; index < windows; index += 1) {
    answer(`/mercury/answers/${index}`, committed.mercury?.answers?.[index], fresh.mercury.answers[index]);
  }
  answer('/compatibility/result', committed.compatibility?.result, fresh.compatibility.result);
  const rest = (demo: Demo) => JSON.stringify({
    ...demo,
    chart: { ...demo.chart, answer: null },
    mercury: { ...demo.mercury, answers: null },
    compatibility: { ...demo.compatibility, result: null },
  });
  if (rest(committed) !== rest(fresh)) drift.push('the inputs or requests changed');
  return drift;
}

const root = fileURLToPath(new URL('../', import.meta.url));
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const fresh = await computeDemo();
  if (process.argv.includes('--check')) {
    const committed = JSON.parse(await readFile(`${root}${DEMO_DATA_PATH}`, 'utf8'));
    const drift = demoDrift(committed, fresh);
    if (drift.length) {
      console.error(`build-developer-demo: ${DEMO_DATA_PATH} is stale; run npx vite-node --script scripts/build-developer-demo.ts`);
      for (const line of drift.slice(0, 20)) console.error(`  ${line}`);
      process.exit(1);
    }
    console.log(`build-developer-demo: ${DEMO_DATA_PATH} matches`);
  } else {
    await writeFile(`${root}${DEMO_DATA_PATH}`, serializeDemo(fresh), 'utf8');
    console.log(`build-developer-demo: wrote ${DEMO_DATA_PATH}`);
  }
}
