import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const plugin = await json('plugins/zodiacs-developer/.codex-plugin/plugin.json');
const portable = await json('plugins/zodiacs-developer/plugin.json');
assert.deepEqual(portable.extensions['com.openai'].interface, plugin.interface);
assert.equal(portable.version, plugin.version);
assert.deepEqual(portable.extensions['com.openai'], { ...plugin.extensions['com.openai'], interface: plugin.interface });
const marketplace = await json('.agents/plugins/marketplace.json');
assert.equal(marketplace.plugins[0].name, plugin.name);
assert.equal(marketplace.plugins[0].source.path, './plugins/zodiacs-developer');
assert.equal(marketplace.plugins[1].name, 'zodiacs-sky');
assert.equal(marketplace.plugins[1].source.path, './plugins/zodiacs-sky');
for (const name of ['zodiacs-developer', 'zodiacs-sky']) {
  const manifest = await json(`plugins/${name}/plugin.json`);
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  const info = manifest.extensions['com.openai'].interface;
  assert.ok(info.displayName.length <= 30 && info.shortDescription.length <= 30 && info.longDescription.length <= 4000);
  assert.ok(info.developerName.length > 0 && info.developerName.length <= 80);
  const prompts = typeof info.defaultPrompt === 'string' ? [info.defaultPrompt] : info.defaultPrompt ?? [];
  assert.ok(prompts.length <= 3, `${name}: at most three starter prompts`);
  assert.equal(new Set(prompts).size, prompts.length, `${name}: unique starter prompts`);
  for (const prompt of prompts) assert.ok(typeof prompt === 'string' && prompt.trim() && prompt.length <= 128);
  const settings = manifest.extensions['com.openai'];
  assert.ok(settings.onboardingSkill.startsWith('./skills/') && !settings.onboardingSkill.includes('..'));
  await access(new URL(`plugins/${name}/${settings.onboardingSkill.slice(2)}`, root));
  assert.ok(settings.publication.release_notes.trim());
  assert.ok(!('test_credentials' in (settings.review ?? {})) && !('reviewer_instructions' in (settings.review ?? {})));
  for (const key of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
    const url = new URL(info[key]); assert.equal(url.protocol, 'https:'); assert.equal(url.origin, 'https://zodiacs.org'); assert.ok(!url.search && !url.hash && !url.username && !url.password);
    await access(new URL(`src/pages${url.pathname}index.astro`, root));
  }
  for (const key of ['composerIcon', 'logo']) {
    assert.ok(info[key].startsWith('./') && !info[key].includes('..'));
    await access(new URL(`plugins/${name}/${info[key].slice(2)}`, root));
  }
  const mcp = await json(`plugins/${name}/mcp.json`);
  assert.equal(mcp.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
  assert.equal(Object.keys(mcp.mcpServers).length, 1);
}
const sky = await json('plugins/zodiacs-sky/plugin.json');
const skyCompatibility = await json('plugins/zodiacs-sky/.codex-plugin/plugin.json');
assert.equal(skyCompatibility.version, sky.version);
const { interface: skyInterface, ...skySettings } = sky.extensions['com.openai'];
assert.deepEqual(skyCompatibility.interface, skyInterface);
assert.deepEqual(skyCompatibility.extensions['com.openai'], skySettings);
assert.deepEqual((await json('plugins/zodiacs-sky/.mcp.json')).mcpServers['zodiacs-sky'], { url: 'https://zodiacs.org/mcp' });
const review = sky.extensions['com.openai'].review;
assert.equal(review.test_cases.positive.length, 5); assert.equal(review.test_cases.negative.length, 3);
for (const entry of review.test_cases.positive) {
  for (const key of ['description', 'prompt', 'tools_triggered', 'expected_behavior']) assert.ok(entry[key]?.trim());
}
assert.ok(!sky.apps && !sky.hooks && !sky.extensions['com.openai'].apps && !sky.extensions['com.openai'].hooks);
assert.deepEqual((await json('plugins/zodiacs-sky/mcp.json')).mcpServers['zodiacs-sky'], { type: 'streamable-http', url: 'https://zodiacs.org/mcp' });
assert.deepEqual((await json('plugins/zodiacs-developer/mcp.json')).mcpServers['zodiacs-developer'], { type: 'stdio', command: 'node', cwd: './', args: ['${PLUGIN_ROOT}/mcp/server.mjs'] });
const submission = await json('integrations/chatgpt/chatgpt-app-submission.json');
const names = ['get_capabilities', 'get_sky', 'get_upcoming_events', 'check_sky_fact', 'search_zodiacs', 'open_chart_studio'];
assert.deepEqual(Object.keys(submission.tools), names);
assert.equal(submission.schema_version, 1); assert.ok(submission.app_info.subtitle.length <= 30);
assert.equal(submission.test_cases.length, 5); assert.equal(submission.negative_test_cases.length, 3);
for (const name of names) {
  assert.deepEqual(submission.tools[name].annotations, { readOnlyHint: true, openWorldHint: false, destructiveHint: false });
  for (const key of ['read_only_justification', 'open_world_justification', 'destructive_justification']) assert.ok(submission.tools[name].justifications[key]);
}
const coveredTools = new Set();
for (const [index, entry] of submission.test_cases.entries()) {
  assert.equal(entry.user_prompt, review.test_cases.positive[index].prompt);
  assert.equal(entry.expected_output, review.test_cases.positive[index].expected_behavior);
  assert.equal(entry.tools_triggered, review.test_cases.positive[index].tools_triggered);
  for (const name of entry.tools_triggered.split(',').map(value => value.trim())) {
    assert.ok(names.includes(name)); coveredTools.add(name);
  }
}
assert.deepEqual([...coveredTools].sort(), [...names].sort(), 'Five review scenarios still cover all six tools');
for (const entry of submission.negative_test_cases) assert.equal(entry.tools_triggered, null);
assert.equal((await json('integrations/chatgpt/evaluation-cases.json')).length, 40);
const vercel = await json('vercel.json');
for (const [source, route] of [['/mcp', '1'], ['/mcp/', '1'], ['/mcp/health', 'health'], ['/mcp/health/', 'health']]) {
  assert.ok(vercel.rewrites.some(entry => entry.source === source && entry.destination === `/api/compatibility?__zodiacs_ai=${route}`));
}
const slashRedirect = vercel.redirects.find(entry => entry.destination === '/:path/');
const slashPattern = new RegExp(`^${slashRedirect.source.slice('/:path('.length, -1)}$`);
for (const path of ['mcp', 'mcp/health']) assert.equal(slashPattern.test(path), false, `MCP must not redirect: /${path}`);
assert.equal(slashPattern.test('moon-sign'), true, 'Consumer canonical redirects remain active');
// Curated URLs must map to existing consumer pages; do not create dead referrals.
const catalog = await readFile(new URL('src/ai-tools/catalog.ts', root), 'utf8');
for (const match of catalog.matchAll(/path: '([^']+)'/g)) await access(new URL(`src/pages${match[1]}index.astro`, root));
const packageInfo = await json('plugins/zodiacs-developer/package.json');
assert.equal(packageInfo.dependencies['@zodiacs/engine'], '0.1.1-rc.16');
assert.equal(packageInfo.dependencies['@modelcontextprotocol/server'], '2.0.0');
// Site/embedded runtime follows the reviewed candidate; external recipes keep the published release.
const site = await json('package.json'); assert.equal(site.dependencies['@zodiacs/engine'], 'file:vendor/zodiacs-engine-0.1.1-rc.17.tgz');
console.log('AI package contracts: manifests, submission cases, versions, routes and canonical links verified.');
