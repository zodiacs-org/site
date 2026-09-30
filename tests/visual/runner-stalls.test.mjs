/**
 * The runner-stall classifier (audit finding F-51) on hand-made traces in
 * fixtures/runner-stalls/, and a guard on the one kind of wait the classifier
 * cannot tell from a stall that the site's own code could start.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  describeStalls, findRunnerStalls, pageMainThreads, STALL_MAX_CPU_SHARE, STALL_MIN_WALL_MS,
} from './runner-stalls.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/runner-stalls/${name}.json`, import.meta.url), 'utf8'));
const pageTasks = (trace) => {
  const threads = pageMainThreads(trace.traceEvents);
  return trace.traceEvents.filter((event) => event.name === 'RunTask' && threads.has(`${event.pid}:${event.tid}`));
};

describe('runner-stall classifier', () => {
  it('uses the thresholds its documentation derives', () => {
    expect(STALL_MIN_WALL_MS).toBe(50);
    expect(STALL_MAX_CPU_SHARE).toBe(0.25);
  });

  it('finds a task the runner held off the CPU', () => {
    expect(findRunnerStalls(fixture('stall'))).toEqual([{ ts: 1_503_000, wallMs: 119.3, cpuMs: 0.2 }]);
  });

  it("leaves the page's own long tasks alone", () => {
    const trace = fixture('genuine');
    // The fixture's tasks are long enough to count; only their CPU time keeps them out.
    expect(pageTasks(trace).filter((task) => task.dur >= STALL_MIN_WALL_MS * 1000).length).toBeGreaterThanOrEqual(2);
    expect(findRunnerStalls(trace)).toEqual([]);
  });

  it('calls nothing a stall without thread CPU time', () => {
    const trace = fixture('missing-tdur');
    expect(findRunnerStalls(trace)).toEqual([]);
    // The same 265.9 ms task is a stall once the trace says how little CPU it used.
    pageTasks(trace).find((task) => task.dur === 265_900).tdur = 600;
    expect(findRunnerStalls(trace)).toEqual([{ ts: 3_452_000, wallMs: 265.9, cpuMs: 0.6 }]);
  });

  it('ignores tasks under 50 ms, however little CPU they used', () => {
    expect(findRunnerStalls(fixture('short'))).toEqual([]);
  });

  it("picks from a mixed trace only the page's stalls, at the thresholds, in time order", () => {
    expect(findRunnerStalls(fixture('mixed'))).toEqual([
      { ts: 1_032_000, wallMs: 195.8, cpuMs: 12.6 },
      { ts: 2_000_000, wallMs: 50, cpuMs: 12.49 },
    ]);
  });

  it('follows the page into the process its navigation committed in', () => {
    const trace = fixture('stall');
    trace.traceEvents.find((event) => event.name === 'FrameCommittedInBrowser').args.data.processId = 300;
    // The stall is left behind in the about:blank renderer, which Lighthouse does not measure.
    expect(findRunnerStalls(trace)).toEqual([]);
    for (const task of trace.traceEvents.filter((event) => event.name === 'RunTask')) Object.assign(task, { pid: 300, tid: 300 });
    expect(findRunnerStalls(trace)).toEqual([{ ts: 1_503_000, wallMs: 119.3, cpuMs: 0.2 }]);
  });

  it('calls nothing a stall on a thread whose CPU clock never advanced', () => {
    const trace = fixture('stall');
    for (const task of pageTasks(trace)) task.tdur = 0;
    expect(findRunnerStalls(trace)).toEqual([]);
  });

  it("calls nothing a stall when the trace does not name the page's process", () => {
    const trace = fixture('stall');
    trace.traceEvents = trace.traceEvents.filter((event) => event.name !== 'TracingStartedInBrowser');
    expect(findRunnerStalls(trace)).toEqual([]);
    expect(findRunnerStalls(undefined)).toEqual([]);
    expect(findRunnerStalls({})).toEqual([]);
  });

  it('describes each stall by its wall and CPU time', () => {
    expect(describeStalls(findRunnerStalls(fixture('mixed'))))
      .toBe('195.8 ms wall / 12.6 ms CPU, 50.0 ms wall / 12.5 ms CPU');
  });
});

describe('what the classifier cannot tell from a stall', () => {
  // A task that waits without using the CPU looks the same as one the runner
  // held off it. The page's own such wait is a synchronous XMLHttpRequest
  // (open(method, url, false)), which holds the main thread until the
  // response arrives. Whether a request is synchronous cannot be read
  // reliably from source, so this holds the line the site already keeps: its
  // client code makes no XMLHttpRequest at all and uses fetch, which never
  // blocks the main thread. If XMLHttpRequest is ever needed, keep it
  // asynchronous and narrow this test to that call.
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const clientCode = /\.(?:astro|cjs|html|js|jsx|mdx|mjs|ts|tsx)$/u;
  const testFile = /\.(?:test|spec)\.[^.]+$/u;

  it("finds no XMLHttpRequest in the site's client code", () => {
    const scanned = [];
    const offenders = [];
    for (const directory of ['src', 'public']) {
      for (const entry of readdirSync(join(root, directory), { recursive: true, withFileTypes: true })) {
        if (!entry.isFile() || !clientCode.test(entry.name) || testFile.test(entry.name)) continue;
        const path = join(entry.parentPath, entry.name);
        scanned.push(path);
        if (readFileSync(path, 'utf8').includes('XMLHttpRequest')) offenders.push(relative(root, path));
      }
    }
    expect(scanned.length).toBeGreaterThan(1_000);
    expect(offenders).toEqual([]);
  });
});
