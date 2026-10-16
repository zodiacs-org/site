import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COMPUTE_FUNCTION_PATH, COMPUTE_ROUTE_PARAM } from '../../src/lib/compute-api/constants';
import { createComputeApiHandler } from '../../src/lib/compute-api/handler';
import * as localTime from '../../src/lib/compute-api/local-time-source';
import { LANGUAGES, codeSamples, type Language } from '../../src/lib/developer-playground';
import { playgroundExamples } from '../../src/lib/developer-playground-examples';
import { run } from '../../scripts/lib/compute-api-harness';

const exec = promisify(execFile);
const handler = createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' });

// How each language's code runs, and the file it is written to.
const RUNNERS: Record<Language, { command: string; file: string; args: (file: string) => string[] }> = {
  curl: { command: 'sh', file: 'request.sh', args: (file) => [file] },
  javascript: { command: process.execPath, file: 'request.mjs', args: (file) => [file] },
  python: { command: 'python3', file: 'request.py', args: (file) => ['-I', file] },
  swift: { command: 'swift', file: 'request.swift', args: (file) => [file] },
  ruby: { command: 'ruby', file: 'request.rb', args: (file) => [file] },
};

async function available(language: Language): Promise<boolean> {
  if (language === 'javascript') return true;
  const probe = { curl: ['curl', ['--version']], python: ['python3', ['--version']], swift: ['swift', ['--version']], ruby: ['ruby', ['--version']] }[language] as [string, string[]];
  try {
    await exec(probe[0], probe[1], { timeout: 60_000 });
    return true;
  } catch {
    return false;
  }
}

let server: Server;
let origin = '';
let dir = '';

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'playground-code-'));
  // The compute API as Vercel serves it: /api/v1/<endpoint> rewritten to the function with the route parameter.
  server = createServer((req, res) => {
    const endpoint = /^\/api\/v1\/([a-z-]+)$/u.exec(req.url ?? '')?.[1];
    (req as any).url = `${COMPUTE_FUNCTION_PATH}?${COMPUTE_ROUTE_PARAM}=${endpoint ?? ''}`;
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});

describe('the code the playground shows', () => {
  it('runs in every language this machine has, and prints the answer the API gives', async () => {
    const languages: Language[] = [];
    for (const language of LANGUAGES) if (await available(language)) languages.push(language);
    // cURL, JavaScript and Python are on every machine the suite runs on.
    expect(languages).toEqual(expect.arrayContaining(['curl', 'javascript', 'python']));
    const offered = playgroundExamples();
    for (const example of [...offered.examples, ...offered.refusals]) {
      const text = typeof example.body === 'string' ? example.body : JSON.stringify(example.body);
      const expected = await run(handler, { endpoint: example.endpoint, body: text });
      const samples = codeSamples(example.endpoint, text, origin);
      // Swift compiles each file, so it sends one request per endpoint.
      const first = offered.examples.find((candidate) => candidate.endpoint === example.endpoint) === example;
      for (const language of languages) {
        if (language === 'swift' && !first) continue;
        const runner = RUNNERS[language];
        const file = join(dir, runner.file);
        await writeFile(file, `${samples[language]}\n`);
        const { stdout } = await exec(runner.command, runner.args(file), { timeout: 120_000, cwd: dir, maxBuffer: 16 * 1024 * 1024 });
        expect(JSON.parse(stdout), `${language} ${example.id}`).toEqual(expected.json);
      }
    }
    console.log(`playground code ran in: ${languages.join(', ')}`);
  }, 600_000);
});
