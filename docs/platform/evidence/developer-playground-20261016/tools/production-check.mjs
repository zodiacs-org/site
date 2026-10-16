// What zodiacs.org serves of the compute API playground (P3.8), against what the repository builds.
// The drive (tests/developer-playground-drive.mjs --base-url) checks the page's behaviour; this checks
// that every part of it is served, and that the browser bundle is the one the sources build.
//   node production-check.mjs <site clone with a build of the merge> <out.json> [base URL]
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [clone, out, base = 'https://zodiacs.org'] = process.argv.slice(2);
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` · ${JSON.stringify(detail)}`}`);
};
async function get(path) {
  try {
    const response = await fetch(`${base}${path}`, { redirect: 'manual', headers: { 'User-Agent': 'zodiacs-programme-check' } });
    return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
  } catch (error) {
    return { status: 0, bytes: Buffer.alloc(0), error: String(error) };
  }
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const built = JSON.parse(await readFile(join(clone, 'dist/developers/playground/examples.json'), 'utf8'));
const offered = [...built.examples, ...built.refusals];

const page = await get('/developers/playground/');
check('the page is served, with the playground on it', page.status === 200 && page.bytes.toString('utf8').includes('data-playground'), { status: page.status });

const examples = await get('/developers/playground/examples.json');
let servedExamples = null;
try {
  servedExamples = JSON.parse(examples.bytes.toString('utf8'));
} catch {}
check('examples.json is the one the merge builds: every documented request with its documented answer', examples.status === 200 && JSON.stringify(servedExamples) === JSON.stringify(built), { status: examples.status, served: servedExamples ? [...servedExamples.examples ?? [], ...servedExamples.refusals ?? []].length : null, built: offered.length });

const twin = await get('/developers/playground.md');
const twinText = twin.bytes.toString('utf8');
const missing = offered.filter((example) => !twinText.includes(example.id)).map((example) => example.id);
check('the Markdown twin lists every request, each with a cURL command that sends its text as typed', twin.status === 200 && missing.length === 0 && (twinText.match(/--data-raw '/gu) ?? []).length >= offered.length && !twinText.includes("--data '"), { status: twin.status, missing });

const engine = await get('/developers/playground/engine.mjs');
const source = await readFile(join(clone, 'public/developers/playground/engine.mjs'));
check('the browser bundle is byte for byte the one its sources build', engine.status === 200 && sha256(engine.bytes) === sha256(source), { status: engine.status, served: engine.status === 200 ? sha256(engine.bytes) : null, built: sha256(source) });

const llms = await get('/llms.txt');
check('llms.txt lists the playground, its twin and examples.json', llms.status === 200 && ['/developers/playground/', '/developers/playground.md', '/developers/playground/examples.json'].every((path) => llms.bytes.toString('utf8').includes(path)), { status: llms.status });

const sitemap = await get('/sitemap.xml');
check('the sitemap lists the page', sitemap.status === 200 && sitemap.bytes.toString('utf8').includes(`<loc>https://zodiacs.org/developers/playground/</loc>`), { status: sitemap.status });

for (const path of ['/developers/', '/developers/compute/']) {
  const linking = await get(path);
  check(`${path} links to the playground`, linking.status === 200 && linking.bytes.toString('utf8').includes('href="/developers/playground/"'), { status: linking.status });
}

const failed = results.filter(({ ok }) => !ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed against ${base}.`);
if (out) await writeFile(out, `${JSON.stringify({ base, checkedAt: new Date().toISOString(), results }, null, 2)}\n`);
process.exitCode = failed ? 1 : 0;
