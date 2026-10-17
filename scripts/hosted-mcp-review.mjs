#!/usr/bin/env node
/**
 * Reviews the hosted MCP server with the official tools (P3.6):
 *
 * - The MCP Inspector CLI lists the tools with --strict, which reports every tool-schema portability problem and
 *   exits 6 on an error-severity one, then calls each tool once with synthetic inputs. Each structured result must
 *   validate against the outputSchema the tool advertises, as a client that validates would check it.
 * - The MCP conformance suite runs every server scenario. A scenario passes, fails, or does not apply: some need a
 *   capability this server does not offer, and some call the conformance reference server's own test tools,
 *   prompts and resources. A scenario counts as not applicable only when it fails in the way its reason predicts,
 *   so a real failure is never explained away.
 *
 * The hosted server limits how often one address may call it and answers 429 past that ("try again in a minute").
 * A step it limits is retried after a minute, up to three times, and each conformance scenario runs on its own,
 * so the limit slows a review down but never decides it.
 *
 * It writes report.json beside the tools' raw output and exits 1 when anything applicable fails.
 *
 *   node scripts/hosted-mcp-review.mjs --url https://zodiacs.org/mcp --out hosted-mcp-review
 *
 * The tools run through npx at pinned versions; HOSTED_MCP_REVIEW_TOOLS can name a directory where they are
 * already installed (its node_modules/.bin is used instead).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export const INSPECTOR = '@modelcontextprotocol/inspector@2.10.1';
export const CONFORMANCE = '@modelcontextprotocol/conformance@0.1.16';

/** One call per tool production offers, with synthetic inputs (Inspector --tool-arg pairs; JSON values are parsed). */
export const CALLS = {
  get_capabilities: [],
  get_sky: ['instant=2026-10-18T03:00:00Z', 'zone=Asia/Bangkok'],
  get_upcoming_events: [],
  check_sky_fact: ['kind=retrograde', 'body=Mercury', 'date=2026-11-20', 'zone=Europe/London'],
  get_horoscope: ['sign=leo', 'zone=Asia/Bangkok'],
  open_chart_studio: [],
  get_occasion_sky: ['occasion=wedding', 'date=2027-06-12'],
  get_life_milestones: ['birthDate=1990-06-15'],
  get_compatibility: ['a={"name":"Alex","birthDate":"1990-06-15"}', 'b={"name":"Sam","birthDate":"1992-01-20"}'],
  find_chart_twins: ['birthDate=1990-06-15'],
  get_famous_chart: ['name=Florence Nightingale'],
  get_birthday: ['birthDate=1990-06-15'],
  get_sky_calendar: [],
};

const CAPABILITY = 'needs a capability this server does not offer (logging, completions, prompts or resource subscriptions); the server answers that the operation is not supported';
const FIXTURE = 'calls the conformance reference server\'s own test tools, prompts or resources, which this server does not have';
const LOCAL = 'expects a server on a local machine to accept a localhost Host and Origin; this server answers only for its own hostname and the assistant origins it allows';
const LOCAL_ONLY = 'runs only against a server at a localhost address, and this review is of a deployed one';

/** Conformance scenarios that do not apply here, each with its reason. */
export const NOT_APPLICABLE = {
  'logging-set-level': CAPABILITY,
  'completion-complete': CAPABILITY,
  'tools-call-with-logging': CAPABILITY,
  'resources-subscribe': CAPABILITY,
  'resources-unsubscribe': CAPABILITY,
  'prompts-list': CAPABILITY,
  'prompts-get-simple': CAPABILITY,
  'prompts-get-with-args': CAPABILITY,
  'prompts-get-embedded-resource': CAPABILITY,
  'prompts-get-with-image': CAPABILITY,
  'tools-call-simple-text': FIXTURE,
  'tools-call-image': FIXTURE,
  'tools-call-audio': FIXTURE,
  'tools-call-embedded-resource': FIXTURE,
  'tools-call-mixed-content': FIXTURE,
  'tools-call-error': FIXTURE,
  'tools-call-with-progress': FIXTURE,
  'tools-call-sampling': FIXTURE,
  'tools-call-elicitation': FIXTURE,
  'elicitation-sep1034-defaults': FIXTURE,
  'elicitation-sep1330-enums': FIXTURE,
  'json-schema-2020-12': FIXTURE,
  'resources-read-text': FIXTURE,
  'resources-read-binary': FIXTURE,
  'resources-templates-read': FIXTURE,
  // Against a localhost address it runs, and its check that a foreign Host is refused must pass.
  'dns-rebinding-protection': LOCAL_ONLY,
};
/** Single checks that do not apply, inside a scenario that otherwise does. */
export const NOT_APPLICABLE_CHECKS = { 'localhost-host-valid-accepted': LOCAL };
/** How a scenario that does not apply must fail; any other failure is a real one. */
const EXPECTED_FAILURE = {
  [CAPABILITY]: /MCP error -32601/,
  [FIXTURE]: /MCP error -32602|not found/,
  [LOCAL]: /Expected HTTP 2xx for valid localhost/,
  [LOCAL_ONLY]: /require a localhost server URL/,
};

/**
 * A scenario's verdict from its checks: not-applicable when it is listed and every failed check fails as its reason
 * predicts; fail when any other check fails; pass when a check succeeds and none fails; warnings-only when nothing
 * failed but nothing was confirmed either, only warned about (warnings are kept with the verdict).
 */
export function classify(scenario, checks) {
  const failures = checks.filter((check) => check.status === 'FAILURE');
  const reason = NOT_APPLICABLE[scenario];
  if (reason && failures.length > 0 && failures.every((check) => EXPECTED_FAILURE[reason].test(check.errorMessage ?? ''))) {
    return { scenario, verdict: 'not-applicable', reason };
  }
  const real = failures.filter((check) => {
    const why = NOT_APPLICABLE_CHECKS[check.id];
    return !(why && EXPECTED_FAILURE[why].test(check.errorMessage ?? ''));
  });
  const excused = failures.filter((check) => !real.includes(check)).map((check) => ({ check: check.id, reason: NOT_APPLICABLE_CHECKS[check.id] }));
  const passed = checks.filter((check) => check.status === 'SUCCESS').length;
  return {
    scenario,
    verdict: real.length ? 'fail' : passed > 0 ? 'pass' : 'warnings-only',
    passed,
    warnings: checks.filter((check) => check.status === 'WARNING').map((check) => check.id),
    ...(excused.length ? { notApplicableChecks: excused } : {}),
    ...(real.length ? { failures: real.map((check) => ({ check: check.id, message: check.errorMessage })) } : {}),
  };
}

/** The Inspector's --strict findings, from its stderr: one per problem, with severity, tool, path and issue. */
export function strictFindings(text) {
  const findings = [];
  const pattern = /^(Warning|Error|Info): tool "([^"]+)"\n\s+Path: (.*)\n\s+Issue: (.*)$/gmu;
  for (const match of text.matchAll(pattern)) {
    findings.push({ severity: match[1].toLowerCase(), tool: match[2], path: match[3], issue: match[4] });
  }
  return findings;
}

function tool(binary, packageSpec) {
  const installed = process.env.HOSTED_MCP_REVIEW_TOOLS;
  return installed ? [join(installed, 'node_modules/.bin', binary)] : ['npx', '--yes', '--package', packageSpec, binary];
}

function run(command, args, env = {}) {
  const [file, ...prefix] = command;
  const result = spawnSync(file, [...prefix, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const firstJson = (text) => JSON.parse(text.slice(text.indexOf('{')));

/** The hosted server's answer when one address calls it too often: HTTP 429, "Zodiacs is busy. Try again in a minute." */
export const RATE_LIMITED = /\b429\b|rate-limited|Zodiacs is busy/u;
const RETRY_AFTER_MS = 61_000;
const ATTEMPTS = 4;
const sleep = (ms) => new Promise((done) => { setTimeout(done, ms); });

/** Runs a step again after a minute while the server says it is rate limited; returns the last attempt and how many waits. */
async function paced(step, limited) {
  let waits = 0;
  for (;;) {
    const result = step();
    if (!limited(result) || waits + 1 >= ATTEMPTS) return { ...result, waits };
    waits += 1;
    await sleep(RETRY_AFTER_MS);
  }
}

export async function review({ url, out }) {
  mkdirSync(out, { recursive: true });
  // The Inspector keeps a catalog of servers; keep it with this run's output, not in the home directory.
  const inspectorEnv = { MCP_CATALOG_PATH: resolve(out, 'inspector-catalog.json') };
  const inspector = (args) => run(tool('mcp-inspector', INSPECTOR), ['--cli', url, '--transport', 'http', ...args], inspectorEnv);

  const limitedRun = (result) => RATE_LIMITED.test(`${result.stdout}\n${result.stderr}`) && result.status !== 0;
  const listed = await paced(() => inspector(['--method', 'tools/list', '--strict']), limitedRun);
  writeFileSync(join(out, 'tools-list.json'), listed.stdout);
  writeFileSync(join(out, 'tools-list.strict.txt'), listed.stderr);
  const tools = firstJson(listed.stdout).tools;
  const findings = strictFindings(listed.stderr);

  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const calls = [];
  for (const { name, outputSchema } of tools) {
    const args = CALLS[name];
    if (!args) { calls.push({ tool: name, ok: false, problem: 'no synthetic call for this tool' }); continue; }
    const called = await paced(() => inspector(['--method', 'tools/call', '--tool-name', name, ...(args.length ? ['--tool-arg', ...args] : [])]), limitedRun);
    writeFileSync(join(out, `call-${name}.json`), called.stdout);
    let result;
    try { result = firstJson(called.stdout); } catch { calls.push({ tool: name, ok: false, problem: `unreadable answer (exit ${called.status}): ${called.stderr.slice(0, 300)}` }); continue; }
    const validate = ajv.compile(outputSchema);
    const valid = validate(result.structuredContent);
    const answered = result.isError === false && result.structuredContent?.ok === true;
    calls.push({
      tool: name, ok: called.status === 0 && answered && valid, exit: called.status, rateLimitWaits: called.waits, isError: result.isError,
      resultOk: result.structuredContent?.ok ?? null, matchesOutputSchema: valid,
      ...(valid ? {} : { schemaErrors: ajv.errorsText(validate.errors).slice(0, 500) }),
    });
  }
  const missing = Object.keys(CALLS).filter((name) => !tools.some((listedTool) => listedTool.name === name));

  const conformanceTool = tool('conformance', CONFORMANCE);
  const listing = run(conformanceTool, ['list', '--server']);
  const names = [...listing.stdout.matchAll(/^\s+- ([a-z0-9-]+) \[/gmu)].map((match) => match[1]);
  const scenarios = [];
  const log = [];
  for (const scenario of names) {
    // Each scenario writes its own folder; a rate-limited attempt is run again into a fresh one.
    const checksOf = (dir) => {
      const folder = existsSync(dir) ? readdirSync(dir).find((entry) => entry.startsWith(`server-${scenario}-`)) : undefined;
      return folder ? JSON.parse(readFileSync(join(dir, folder, 'checks.json'), 'utf8')) : [];
    };
    let attempt = 0;
    const result = await paced(() => {
      attempt += 1;
      const dir = join(out, 'conformance', `${scenario}.${attempt}`);
      const ran = run(conformanceTool, ['server', '--url', url, '--scenario', scenario, '-o', dir]);
      return { ...ran, checks: checksOf(dir) };
    }, (ran) => ran.checks.some((check) => check.status === 'FAILURE' && RATE_LIMITED.test(check.errorMessage ?? '')));
    log.push(`== ${scenario} (attempts ${result.waits + 1})\n${result.stdout}${result.stderr}`);
    scenarios.push({ ...classify(scenario, result.checks), ...(result.waits ? { rateLimitWaits: result.waits } : {}) });
  }
  writeFileSync(join(out, 'conformance.log'), log.join('\n'));

  const errors = findings.filter((finding) => finding.severity === 'error');
  const report = {
    schema: 'zodiacs.hosted-mcp-review.v1',
    url,
    at: new Date().toISOString(),
    tools: { inspector: INSPECTOR, conformance: CONFORMANCE },
    inspector: {
      strictExit: listed.status,
      tools: tools.map((listedTool) => listedTool.name),
      findings: { errors: errors.length, warnings: findings.filter((finding) => finding.severity === 'warning').length, byIssue: countBy(findings) },
      calls,
      missing,
    },
    conformance: {
      scenarios: scenarios.length,
      passed: scenarios.filter((scenario) => scenario.verdict === 'pass').map((scenario) => scenario.scenario),
      warningsOnly: scenarios.filter((scenario) => scenario.verdict === 'warnings-only').map((scenario) => scenario.scenario),
      notApplicable: scenarios.filter((scenario) => scenario.verdict === 'not-applicable').length,
      failed: scenarios.filter((scenario) => scenario.verdict === 'fail').map((scenario) => scenario.scenario),
      detail: scenarios,
    },
  };
  report.ok = listed.status === 0 && errors.length === 0 && tools.length > 0 && missing.length === 0
    && calls.every((call) => call.ok) && scenarios.length > 0 && report.conformance.failed.length === 0;
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

function countBy(findings) {
  const counts = {};
  for (const { severity, issue } of findings) {
    const key = `${severity}: ${issue.split('. ')[0]}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const option = (name, fallback) => { const index = process.argv.indexOf(name); return index > 0 ? process.argv[index + 1] : fallback; };
  const report = await review({ url: option('--url', 'https://zodiacs.org/mcp'), out: option('--out', 'hosted-mcp-review') });
  const { inspector, conformance } = report;
  console.log(`${report.url}: Inspector --strict exit ${inspector.strictExit} (${inspector.findings.errors} errors, ${inspector.findings.warnings} warnings), `
    + `${inspector.calls.filter((call) => call.ok).length} of ${inspector.calls.length} tools answered within their schemas; `
    + `conformance ${conformance.passed.length} passed, ${conformance.warningsOnly.length} with warnings only, `
    + `${conformance.notApplicable} not applicable, ${conformance.failed.length} failed of ${conformance.scenarios}`);
  if (!report.ok) process.exitCode = 1;
}
