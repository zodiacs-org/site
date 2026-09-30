/**
 * Writes the compute API's documented responses.
 *
 *   npx vite-node --script scripts/build-compute-examples.mjs
 *
 * Runs every request in src/lib/compute-api/examples.ts through the real
 * handler and writes what it answers to src/lib/compute-api/examples.json,
 * which the OpenAPI document and the developer page show. The engine's
 * numbers change only with an engine release, so a new release, or any
 * change to the handler's output, means running this again.
 * tests/api/compute-api-openapi.test.ts fails while the committed file
 * differs from what the handler answers.
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAMPLES_PATH, computeExamples, serializeExamples } from './lib/compute-api-examples.ts';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const set = await computeExamples();
await writeFile(resolve(root, EXAMPLES_PATH), serializeExamples(set), 'utf8');
const successes = Object.values(set.success).reduce((sum, examples) => sum + Object.keys(examples).length, 0);
console.log(`build-compute-examples: wrote ${EXAMPLES_PATH} (${successes} responses, ${Object.keys(set.refusals).length} refusals, ${set.engine})`);
