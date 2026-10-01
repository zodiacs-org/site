import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(resolve(root, '.github/workflows/calendar-feed-sweep.yml'), 'utf8');

/** The step's `run: |` script and its plain env values, read from the workflow text. */
function sweepStep() {
  const lines = workflow.split('\n');
  const start = lines.findIndex((line) => /^\s+run: \|\s*$/u.test(line));
  if (start < 0) throw new Error('no run block in calendar-feed-sweep.yml');
  const keyIndent = lines[start].search(/\S/u);
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== '' && line.search(/\S/u) <= keyIndent) break;
    body.push(line);
  }
  const indent = Math.min(...body.filter((line) => line.trim()).map((line) => line.search(/\S/u)));
  const env = Object.fromEntries(
    [...workflow.matchAll(/^\s+(SWEEP_[A-Z_]+): "?([^"\n]+)"?$/gmu)].map((match) => [match[1], match[2]]),
  );
  return { script: body.map((line) => line.slice(indent)).join('\n'), env };
}

// A stand-in curl: answers each call from a plan of "<status> <body>" lines
// and records the Authorization header it was given. Nothing leaves the machine.
const FAKE_CURL = `#!/usr/bin/env bash
set -euo pipefail
out=""
auth=""
while [ $# -gt 0 ]; do
  case "$1" in
    --output) out="$2"; shift 2 ;;
    --header) case "$2" in Authorization:*) auth="$2" ;; esac; shift 2 ;;
    --write-out|--retry|--max-time|--request|--data) shift 2 ;;
    *) shift ;;
  esac
done
n=$(( $(cat "$FAKE_CURL_DIR/calls" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$FAKE_CURL_DIR/calls"
printf '%s\\n' "$auth" >> "$FAKE_CURL_DIR/auth"
line="$(sed -n "\${n}p" "$FAKE_CURL_DIR/plan")"
[ -n "$line" ] || line="$(tail -n 1 "$FAKE_CURL_DIR/plan")"
printf '%s' "\${line#* }" > "$out"
printf '%s' "\${line%% *}"
`;

const SECRET = 'synthetic-sweep-secret-'.padEnd(40, 'x');
let scratch = '';

afterEach(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
  scratch = '';
});

function sweep(secret, plan) {
  scratch = mkdtempSync(join(tmpdir(), 'calendar-sweep-'));
  const bin = join(scratch, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'curl'), FAKE_CURL);
  chmodSync(join(bin, 'curl'), 0o755);
  writeFileSync(join(scratch, 'plan'), `${plan.join('\n')}\n`);
  const { script, env } = sweepStep();
  const run = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: scratch,
      TMPDIR: scratch,
      FAKE_CURL_DIR: scratch,
      CALENDAR_FEED_SWEEP_SECRET: secret,
      ...env,
    },
  });
  const read = (name) => {
    try {
      return readFileSync(join(scratch, name), 'utf8');
    } catch {
      return '';
    }
  };
  return {
    status: run.status,
    output: `${run.stdout}${run.stderr}`,
    calls: Number(read('calls') || 0),
    auth: read('auth').split('\n').filter(Boolean),
  };
}

const reply = (pruned, more) => `200 ${JSON.stringify({ pruned, batches: 1, more })}`;

describe('the calendar feed sweep workflow', () => {
  it('runs in its protected environment, reads its secret there, and posts to the sweep route', () => {
    expect(workflow).toContain('environment: calendar-feed-production');
    expect(workflow).toContain('CALENDAR_FEED_SWEEP_SECRET: ${{ secrets.CALENDAR_FEED_SWEEP_SECRET }}');
    expect(sweepStep().env).toEqual({
      SWEEP_URL: 'https://zodiacs.org/api/calendar/feed-sweep',
      SWEEP_MAX_CALLS: '10',
    });
  });

  it('fails, saying what to set, when the secret or its environment is missing', () => {
    for (const secret of ['', 'x'.repeat(31)]) {
      const run = sweep(secret, [reply(0, false)]);
      expect(run.status).toBe(1);
      expect(run.calls).toBe(0);
      expect(run.output).toContain('::error::CALENDAR_FEED_SWEEP_SECRET is missing or shorter than 32 characters');
      expect(run.output).toContain('the GitHub environment calendar-feed-production');
      expect(run.output).toContain('CALENDAR_FEED_SWEEP_SECRET in Vercel Production');
    }
  });

  it('fails when the site does not have the secret or the store', () => {
    const run = sweep(SECRET, ['404 {"error":"not_found"}']);
    expect(run.status).toBe(1);
    expect(run.calls).toBe(1);
    expect(run.output).toContain('::error::The site answered 404');
  });

  it('fails on any other answer the sweep does not give', () => {
    for (const plan of [
      ['503 {"error":"unavailable"}'],
      ['200 <html>not the sweep</html>'],
      ['200 {"pruned":"3","batches":1,"more":false}'],
      ['200 {"pruned":3,"batches":1}'],
    ]) {
      const run = sweep(SECRET, plan);
      expect(run.status, plan[0]).toBe(1);
      expect(run.output, plan[0]).toMatch(/::error::The sweep answered (?:HTTP 503|with an unexpected body)/u);
    }
  });

  it('sweeps once when nothing more is due, with the secret as a bearer', () => {
    const run = sweep(SECRET, [reply(3, false)]);
    expect(run.status).toBe(0);
    expect(run.calls).toBe(1);
    expect(run.auth).toEqual([`Authorization: Bearer ${SECRET}`]);
    expect(run.output).toContain('Deleted 3 feeds in 1 batches.');
    expect(run.output).toContain('No more feeds are due.');
  });

  it('calls again while the sweep says more are due', () => {
    const run = sweep(SECRET, [reply(8192, true), reply(8192, true), reply(12, false)]);
    expect(run.status).toBe(0);
    expect(run.calls).toBe(3);
  });

  it('fails, saying so, when more are still due after its last call', () => {
    const run = sweep(SECRET, [reply(8192, true)]);
    expect(run.status).toBe(1);
    expect(run.calls).toBe(10);
    expect(run.output).toContain('::error::More feeds were due than 10 sweep requests delete.');
  });
});
