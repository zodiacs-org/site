#!/usr/bin/env node
// Ask the fifty questions in docs/visibility/questions.json to Gemini, Claude
// and Grok through their APIs with web search switched on, and record each
// answer, its cited sources and whether zodiacs.org is named or cited.
//
//   node scripts/visibility/ai-answers.mjs --label 2026-11-08 [--runs 3]
//        [--providers gemini,anthropic,xai] [--only q01,q02] [--questions file] [--dry-run]
//
// The OpenAI API is not used: the owner has not approved OpenAI API spend
// (ZOD-207). Any --providers value naming openai stops before any request,
// with no override; so does an unknown provider. Every outbound request, the
// Anthropic SDK's own sign-in and token calls included, goes through one
// guarded fetch that allows only https to api.anthropic.com,
// generativelanguage.googleapis.com and api.x.ai, and refuses redirects.
// Gateways (ANTHROPIC_BASE_URL or a profile's base_url) are not supported.
//
// Keys come from the shell only: GEMINI_API_KEY, ANTHROPIC_API_KEY (or an
// `ant auth login` profile), XAI_API_KEY. A provider without a key is skipped
// and reported. Model names can be pinned with GEMINI_MODEL, ANTHROPIC_MODEL,
// XAI_MODEL; the model each API says it used is recorded with every answer,
// so a re-run can match it.
//
// Output: docs/visibility/baseline/<label>/ai/<provider>.json. The script
// resumes: successful answers to a question's current wording are kept and
// not asked again. A failed call is never treated as done: the next run asks
// it again and the new attempt replaces the error entry (the report never
// counts errors). Answers to older wording move to `superseded`, which the
// report ignores, and the question is asked again in its current wording.
// The questions carry no personal data and the prompts carry no birth details.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { loadQuestions, parseAnthropicResponse, parseGeminiResponse, parseResponsesApi, planAnswers, scoreAnswer, VIS_DIR } from './lib.mjs';

// Accepts `--name value` and `--name=value`.
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const eq = a.indexOf('=');
  if (eq > 2) args[a.slice(2, eq)] = a.slice(eq + 1);
  else args[a.slice(2)] = process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true;
}
const KNOWN = ['gemini', 'anthropic', 'xai'];
const OPENAI_REFUSAL = 'The OpenAI API is not used: the owner has not approved OpenAI API spend (ZOD-207). Use gemini, anthropic or xai instead.';
// Every --providers value, in both forms and from every occurrence, is
// checked for openai before the questions are read or any request is made,
// --dry-run included. Only then is the union validated.
const providerValues = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--providers=')) providerValues.push(a.slice('--providers='.length));
  else if (a === '--providers' && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--')) providerValues.push(process.argv[i + 1]);
}
const entries = providerValues.flatMap((v) => v.split(',')).map((p) => p.trim().toLowerCase()).filter(Boolean);
if (entries.some((p) => p.includes('openai'))) {
  console.error(OPENAI_REFUSAL);
  process.exit(1);
}
const wanted = providerValues.length ? [...new Set(entries)] : KNOWN;
const unknown = wanted.filter((p) => !KNOWN.includes(p));
if (unknown.length || !wanted.length) {
  console.error(`Unknown or missing provider: ${unknown.join(', ') || '(none)'}. Use gemini, anthropic or xai.`);
  process.exit(1);
}
const label = args.label || new Date().toISOString().slice(0, 10);
const runs = Number(args.runs || 1);
const only = args.only ? new Set(String(args.only).split(',')) : null;
const questions = loadQuestions(typeof args.questions === 'string' ? args.questions : undefined).filter((q) => !only || only.has(q.id));
const outDir = path.join(VIS_DIR, 'baseline', label, 'ai');

// Answers should look like what a person in the United States sees.
const LOCATION = { country: 'US' };

// One guarded fetch for every outbound request, including the Anthropic
// SDK's (messages, OAuth refresh and OIDC exchange alike): https only, these
// exact hostnames only, no redirects. Anything else throws before sending.
const ALLOWED_HOSTS = new Set(['api.anthropic.com', 'generativelanguage.googleapis.com', 'api.x.ai']);
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

async function guardedFetch(input, init = {}) {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing to call ${url.protocol}//${url.host}: only https to ${[...ALLOWED_HOSTS].join(', ')} is allowed (ZOD-207)`);
  }
  return fetch(input, { ...init, redirect: 'error' });
}

async function postJson(url, headers, body) {
  const res = await guardedFetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const providers = {
  gemini: {
    ready: () => !!process.env.GEMINI_API_KEY,
    async ask(question) {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const json = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': process.env.GEMINI_API_KEY }, {
        contents: [{ role: 'user', parts: [{ text: question }] }],
        tools: [{ google_search: {} }],
      });
      return parseGeminiResponse(json, model);
    },
  },
  anthropic: {
    // The SDK also finds an `ant auth login` profile when no key is exported.
    ready: () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE),
    client: null,
    async ask(question) {
      // An explicit baseURL, and the guarded fetch for every SDK request,
      // sign-in and token calls included: a gateway or a profile's base_url
      // on any other host is refused.
      if (!this.client) {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        this.client = new Anthropic({ baseURL: ANTHROPIC_BASE_URL, fetch: guardedFetch });
      }
      const messages = [{ role: 'user', content: question }];
      let response;
      // Server-side web search can pause a long turn; send it back to continue.
      for (let i = 0; i < 4; i++) {
        response = await this.client.beta.messages.create({
          model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5, user_location: { type: 'approximate', ...LOCATION } }],
          messages,
        });
        if (response.stop_reason !== 'pause_turn') break;
        messages.push({ role: 'assistant', content: response.content });
      }
      return parseAnthropicResponse(response);
    },
  },
  xai: {
    ready: () => !!process.env.XAI_API_KEY,
    async ask(question) {
      const json = await postJson('https://api.x.ai/v1/responses', { authorization: `Bearer ${process.env.XAI_API_KEY}` }, {
        model: process.env.XAI_MODEL || 'grok-4',
        tools: [{ type: 'web_search' }],
        input: question,
      });
      return parseResponsesApi(json);
    },
  },
};

async function runProvider(name) {
  const p = providers[name];
  if (!p) throw new Error(`Unknown provider ${name}`);
  const file = path.join(outDir, `${name}.json`);
  const doc = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { provider: name, label, answers: [] };
  // Failed calls are retried and answers to older wording are asked again;
  // only successful answers to the current wording are reused.
  const plan = planAnswers(doc, questions, runs);
  const { todo } = plan;
  if (args['dry-run']) return { name, ready: p.ready(), todo: todo.length };
  if (!p.ready()) return { name, ready: false, todo: todo.length };
  doc.answers = plan.answers;
  if (plan.superseded.length) doc.superseded = plan.superseded;
  mkdirSync(outDir, { recursive: true });
  for (const [q, r] of todo) {
    let entry;
    try {
      const res = await p.ask(q.question);
      entry = { id: q.id, run: r, question: q.question, at: new Date().toISOString(), model: res.model, refused: !!res.refused, text: res.text, citations: res.citations, ...scoreAnswer(res.text, res.citations) };
    } catch (err) {
      entry = { id: q.id, run: r, question: q.question, at: new Date().toISOString(), error: String(err.message || err).slice(0, 300) };
    }
    doc.answers.push(entry);
    writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
    process.stdout.write(`${name} ${q.id}#${r} ${entry.error ? 'error' : entry.cited ? 'CITED' : entry.mentioned ? 'named' : '-'}\n`);
  }
  const failed = doc.answers.filter((a) => a.error).length;
  return { name, ready: true, todo: todo.length, failed };
}

const results = await Promise.all(wanted.map(runProvider));
for (const r of results) {
  if (!r.ready) console.log(`${r.name}: skipped, no credentials in the shell (${r.todo} answers still to collect)`);
  else if (args['dry-run']) console.log(`${r.name}: ready, ${r.todo} answers to collect`);
  else if (r.failed) console.log(`${r.name}: ${r.failed} call(s) failed and are not counted; run again to retry them`);
}
if (args['dry-run']) console.log(`Plan: ${questions.length} questions x ${runs} run(s) per provider into ${path.relative(process.cwd(), outDir)}`);
