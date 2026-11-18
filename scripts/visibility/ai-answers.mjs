#!/usr/bin/env node
// Ask the fifty questions in docs/visibility/questions.json to ChatGPT (OpenAI),
// Gemini, Claude and Grok through their APIs with web search switched on, and
// record each answer, its cited sources and whether zodiacs.org is named or cited.
//
//   node scripts/visibility/ai-answers.mjs --label 2026-11-08 [--runs 3]
//        [--providers openai,gemini,anthropic,xai] [--only q01,q02] [--dry-run]
//
// Keys come from the shell only: OPENAI_API_KEY, GEMINI_API_KEY,
// ANTHROPIC_API_KEY (or an `ant auth login` profile), XAI_API_KEY. A provider
// without a key is skipped and reported. Model names can be pinned with
// OPENAI_MODEL, GEMINI_MODEL, ANTHROPIC_MODEL, XAI_MODEL; the model each API
// says it used is recorded with every answer, so a re-run can match it.
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
import Anthropic from '@anthropic-ai/sdk';
import { loadQuestions, parseAnthropicResponse, parseGeminiResponse, parseResponsesApi, planAnswers, scoreAnswer, VIS_DIR } from './lib.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
const label = args.label || new Date().toISOString().slice(0, 10);
const runs = Number(args.runs || 1);
const wanted = String(args.providers || 'openai,gemini,anthropic,xai').split(',');
const only = args.only ? new Set(String(args.only).split(',')) : null;
const questions = loadQuestions().filter((q) => !only || only.has(q.id));
const outDir = path.join(VIS_DIR, 'baseline', label, 'ai');

// Answers should look like what a person in the United States sees.
const LOCATION = { country: 'US' };

async function postJson(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const providers = {
  openai: {
    ready: () => !!process.env.OPENAI_API_KEY,
    async ask(question) {
      const json = await postJson('https://api.openai.com/v1/responses', { authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, {
        model: process.env.OPENAI_MODEL || 'gpt-5',
        tools: [{ type: 'web_search', user_location: { type: 'approximate', ...LOCATION } }],
        input: question,
      });
      return parseResponsesApi(json);
    },
  },
  gemini: {
    ready: () => !!process.env.GEMINI_API_KEY,
    async ask(question) {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const json = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { 'x-goog-api-key': process.env.GEMINI_API_KEY }, {
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
      this.client ||= new Anthropic();
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
