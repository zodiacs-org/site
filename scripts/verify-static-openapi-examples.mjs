import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSkyApi } from '../src/lib/sky-api/files.ts';
import { loadSkyApiSources } from '../src/lib/sky-api/sources.ts';
const build = buildSkyApi(await loadSkyApiSources(resolve('.')), { generatedAt: '2026-09-07T00:00:00.000Z' });
const openapi = JSON.parse(build.files.get('openapi.json'));
const operations = Object.entries(openapi.paths).filter(([, item]) => item.get).map(([path, item]) => {
  const example = item.get.responses['200'].content['application/json'].examples.generated;
  const bytes = Buffer.from(JSON.stringify(example.value, null, 2) + '\n');
  return { path, source: example.summary.slice('Generated payload: '.length),
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
if (operations.length !== 11) throw new Error('Static GET coverage changed');
const report = { producer: { repository: process.env.GITHUB_REPOSITORY,
  head: process.env.PRODUCER_HEAD, checkout: process.env.GITHUB_SHA,
  run: process.env.GITHUB_RUN_ID, node: process.version },
  generatedAt: '2026-09-07T00:00:00.000Z', operations };
writeFileSync('static-openapi-examples.json', JSON.stringify(report, null, 2) + '\n');
const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
console.log('PROGRAMME_FILE ' + JSON.stringify({ path: 'static-openapi-examples.json',
  size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), base64: bytes.toString('base64') }));
