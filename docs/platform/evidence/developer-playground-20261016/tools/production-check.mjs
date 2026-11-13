// What zodiacs.org serves of the compute API playground (P3.8), against what the deployment's own commit builds.
// Run from a clean clone checked out at the commit the zodiacs.org alias's deployment was built from, after
// `npm run build` there:
//   node production-check.mjs <alias.json> <merge commit> <out.json> [base URL]
// alias.json holds what Vercel reported for the zodiacs.org alias and its deployment just before: deploymentId,
// aliasUpdatedAt, readyState, target, githubCommitSha; nothing else is read from it. Against zodiacs.org the first
// check fails unless that deployment is READY in production, built from this clone's commit, which must contain
// the merge, and the clone has no change to a tracked file. Against another base (a control on a local build) that
// check is left out. The output records the deployment, the merge, the clone's commit and its build's receipt.
// The drive (tests/developer-playground-drive.mjs --base-url) checks the page's behaviour; this checks that every
// part of it is served, and that the browser bundle is the one the sources build.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const [aliasPath, merge, out, base = 'https://zodiacs.org'] = process.argv.slice(2);
if (!aliasPath || !/^[0-9a-f]{40}$/u.test(merge ?? '') || !out) {
  throw new Error('usage: production-check.mjs <alias.json> <40-hex merge commit> <out.json> [base URL]');
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const gitBytes = (...args) => execFileSync('git', args, { maxBuffer: 256 * 1024 * 1024 });
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

const raw = JSON.parse(await readFile(aliasPath, 'utf8'));
const deployment = Object.fromEntries(['deploymentId', 'aliasUpdatedAt', 'readyState', 'target', 'githubCommitSha'].map((key) => [key, raw[key]]));
const head = git('rev-parse', 'HEAD').trim();
const clean = git('status', '--porcelain', '--untracked-files=no').trim() === '';
let containsMerge = false;
try {
  git('merge-base', '--is-ancestor', merge, head);
  containsMerge = true;
} catch {}
let receipt = null;
try {
  receipt = JSON.parse(await readFile('dist/.phase1-build-receipt.json', 'utf8'));
} catch {}
const clone = { head, clean, containsMerge, builtAt: receipt?.builtAt ?? null, templateSourceSha256: receipt?.templateSourceSha256 ?? null };

if (base === 'https://zodiacs.org') {
  check('the zodiacs.org alias names a READY production deployment built from this clean clone\'s commit, which contains the merge',
    deployment.readyState === 'READY' && deployment.target === 'production' && deployment.githubCommitSha === head && clean && containsMerge,
    { deployment, clone });
}

const built = JSON.parse(await readFile('dist/developers/playground/examples.json', 'utf8'));
const offered = [...built.examples, ...built.refusals];

const page = await get('/developers/playground/');
check('the page is served, with the playground on it', page.status === 200 && page.bytes.toString('utf8').includes('data-playground'), { status: page.status });

const examples = await get('/developers/playground/examples.json');
let servedExamples = null;
try {
  servedExamples = JSON.parse(examples.bytes.toString('utf8'));
} catch {}
check('examples.json is the one the commit builds: every documented request with its documented answer', examples.status === 200 && JSON.stringify(servedExamples) === JSON.stringify(built), { status: examples.status, served: servedExamples ? [...servedExamples.examples ?? [], ...servedExamples.refusals ?? []].length : null, built: offered.length });

// The twin has one "### <id>: <summary>" section per request. Each must hold that request's endpoint, documented
// status and link, the cURL command that sends its own body as typed, and its documented citation digest, and there
// must be no section for anything else.
const twin = await get('/developers/playground.md');
const twinText = twin.bytes.toString('utf8');
const sections = twinText.split('\n### ').slice(1).map((section) => section.split('\n## ')[0]);
const wrong = [];
for (const example of offered) {
  const own = sections.filter((section) => section.startsWith(`${example.id}: `));
  const text = typeof example.body === 'string' ? example.body : JSON.stringify(example.body);
  const command = [
    `curl --silent --show-error https://zodiacs.org/api/v1/${example.endpoint} \\`,
    "  --header 'Content-Type: application/json' \\",
    `  --data-raw '${text.replaceAll("'", "'\\''")}'`,
  ].join('\n');
  const digest = example.answer?.cite?.receipt;
  const section = own[0] ?? '';
  const parts = {
    one: own.length === 1,
    request: section.includes(`POST /api/v1/${example.endpoint}, documented status ${example.status}.`),
    link: section.includes(`https://zodiacs.org/developers/playground/?example=${example.id}`),
    command: section.includes(command),
    digest: digest ? section.includes(`Documented citation digest: \`${digest}\``) : true,
  };
  if (!Object.values(parts).every(Boolean)) wrong.push({ id: example.id, ...parts });
}
check('the Markdown twin gives each request its own section, with its endpoint, status, link, digest and the cURL command that sends its body as typed, and nothing else', twin.status === 200 && wrong.length === 0 && sections.length === offered.length, { status: twin.status, sections: sections.length, offered: offered.length, wrong });

// The commit's own file, which the build copies unchanged.
const engine = await get('/developers/playground/engine.mjs');
const committed = gitBytes('show', `${head}:public/developers/playground/engine.mjs`);
const copied = await readFile('dist/developers/playground/engine.mjs');
check('the browser bundle is byte for byte the commit\'s, which its sources build', engine.status === 200 && sha256(engine.bytes) === sha256(committed) && sha256(copied) === sha256(committed), { status: engine.status, served: engine.status === 200 ? sha256(engine.bytes) : null, committed: sha256(committed) });

const llms = await get('/llms.txt');
check('llms.txt lists the playground, its twin and examples.json', llms.status === 200 && ['/developers/playground/', '/developers/playground.md', '/developers/playground/examples.json'].every((path) => llms.bytes.toString('utf8').includes(path)), { status: llms.status });

const sitemap = await get('/sitemap.xml');
check('the sitemap lists the page', sitemap.status === 200 && sitemap.bytes.toString('utf8').includes(`<loc>https://zodiacs.org/developers/playground/</loc>`), { status: sitemap.status });

for (const path of ['/developers/', '/developers/compute/']) {
  const linking = await get(path);
  check(`${path} links to the playground`, linking.status === 200 && linking.bytes.toString('utf8').includes('href="/developers/playground/"'), { status: linking.status });
}

const passed = results.filter(({ ok }) => ok).length;
console.log(`\n${passed} of ${results.length} checks passed against ${base}.`);
await writeFile(out, `${JSON.stringify({
  schema: 'zodiacs.developer-playground-production.v1',
  base,
  mergeCommit: merge,
  deployment: base === 'https://zodiacs.org' ? deployment : null,
  clone,
  readAt: new Date().toISOString(),
  passed,
  of: results.length,
  checks: results,
}, null, 2)}\n`);
process.exitCode = passed === results.length ? 0 : 1;
