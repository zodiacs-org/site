import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execute = promisify(execFile);
const guides = JSON.parse(await readFile('src/data/developer-guides.json', 'utf8'));
const source = guides.find((guide) => guide.slug === 'python').sections.find((section) => section.code).code.source;
const examples = JSON.parse(await readFile('src/lib/compute-api/examples.json', 'utf8'));
const scratch = await mkdtemp(join(tmpdir(), 'zodiacs-python-guide-'));
const file = join(scratch, 'guide.py');
const outcomes = [];
try {
  await writeFile(file, source);
  const cases = [
    { name: 'success', status: 200, headers: {}, response: examples.success.positions.two },
    ...['invalid-request', 'budget-exhausted', 'payload-too-large', 'rate-limited'].map((name) => ({ name, ...examples.refusals[name] })),
  ];
  for (const fixture of cases) {
    let received = false;
    const server = createServer(async (request, response) => {
      try {
        assert.equal(request.method, 'POST');
        assert.equal(request.url, '/api/v1/positions');
        assert.equal(request.headers['content-type'], 'application/json');
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString('utf8')), {
          instants: ['2026-09-29T12:00:00Z', '2026-12-31T00:00:00-05:00'], bodies: ['Sun', 'Moon', 'Mercury'],
        });
        received = true;
        response.writeHead(fixture.status, { ...fixture.headers, 'Content-Type': 'application/json' });
        response.end(JSON.stringify(fixture.response));
      } catch {
        response.writeHead(500);
        response.end('{}');
      }
    });
    await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
    try {
      let result;
      try {
        result = { ...(await execute('python3', [file], {
          env: { ...process.env, ZODIACS_COMPUTE_ORIGIN: 'http://127.0.0.1:' + server.address().port },
          timeout: 20000, maxBuffer: 1048576,
        })), code: 0 };
      } catch (error) {
        assert.equal(typeof error.code, 'number', 'Python execution failed');
        result = error;
      }
      assert.ok(received, 'Documented request reached the mock');
      assert.equal(result.code, fixture.status === 200 ? 0 : 1);
      if (fixture.status === 200) {
        assert.deepEqual(JSON.parse(result.stdout), fixture.response);
        assert.equal(result.stderr, '');
      } else {
        const failure = JSON.parse(result.stderr);
        assert.equal(failure.status, fixture.status);
        assert.deepEqual(failure.response, fixture.response);
        const retryHeader = Object.entries(fixture.headers).find(([key]) => key.toLowerCase() === 'retry-after');
        assert.equal(failure.retryAfter, retryHeader?.[1] ?? null);
        assert.equal(result.stdout, '');
      }
      outcomes.push({ case: fixture.name, status: fixture.status, exitCode: result.code, result: 'pass' });
    } finally {
      await new Promise((closed) => server.close(closed));
    }
  }
  const version = (await execute('python3', ['--version'])).stdout.trim();
  console.log(JSON.stringify({ schema: 'zodiacs.python-guide.v1', runtime: version, outcomes,
    limitations: ['Actual documented snippet against committed public contract fixtures over local HTTP; no live service or private input.'] }, null, 2));
} finally {
  await rm(scratch, { recursive: true, force: true });
}
