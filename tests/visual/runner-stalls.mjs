/**
 * Runner stalls in a Lighthouse trace (audit finding F-51).
 *
 * The mobile audit simulates a phone's slower CPU. Lighthouse takes each task
 * on the page's main thread at its observed wall-clock duration, multiplies it
 * by 4 and computes blocking time from the result. When the shared CI runner
 * holds that thread off the CPU partway through a task, the task's wall time
 * grows while its CPU time does not, and the simulation charges the page four
 * times the stall: a 119.3 ms task that ran for 0.2 ms of CPU becomes a 477 ms
 * long task. Chrome records both clocks for every task, wall time as `dur` and
 * the thread's CPU time as `tdur`, in microseconds, so the trace shows it.
 *
 * A stall task is a RunTask on the page's renderer main thread that lasted at
 * least 50 ms and spent less than 25 % of that time on the CPU. The thresholds
 * come from Site Check's own traces: 270 samples in three runs, #600's
 * 36602076607 (both attempts) and #603's 36712798339.
 *
 * - Stalls. Every task of 50 ms or more on that thread, 38 in all, spent
 *   0.1–16.3 % of its wall time on the CPU (median 3.0 %). In each, one
 *   stretch with no trace event at all covers 83–100 % of the task. In 17 it
 *   falls inside ScriptCatchup, where V8 copies a script's source into the
 *   trace, a step whose median is 3 µs over 17,846 of them; none falls inside
 *   the page's script.
 * - The page's own work runs on the CPU. The longest task above half CPU in
 *   any sample lasted 42.9 ms, at 99.9 %, and the 41 tasks of 30–50 ms above
 *   half CPU ran at a median 99.9 %. A control page whose tasks are fixed
 *   amounts of JavaScript ran tasks of 124–519 ms at 95.3–99.0 % under the
 *   gate's settings.
 * - 25 % leaves room on both sides: the most CPU a stall task used was 16.3 %,
 *   and a stall task is one that was off the CPU for more than three quarters
 *   of its time.
 * - 50 ms is the long-task threshold before the slowdown. Shorter tasks that
 *   waited off the CPU occur in ordinary loads (the #600 re-run's /thesis/
 *   sample 1 has a 14.6 ms task that used 0.9 ms of CPU) and are not called
 *   stalls. Several short stalls can still fail a sample, which then counts as
 *   it always did.
 *
 * The trace shows that the thread was not running, not why. A task that waits
 * without the CPU for the page's own reasons looks the same: a synchronous
 * XMLHttpRequest, or a synchronous call into another process such as creating
 * a WebGL context. The audited routes make no such wait. The site's client
 * code has no XMLHttpRequest (runner-stalls.test.mjs fails if one appears).
 * The one bundled with Supabase's client, Phoenix's long-poll fallback, opens
 * its requests asynchronously, and no audited load in those runs fetched that
 * chunk. The only WebGL call on an audited route, /thesis/'s gallery probe,
 * ran for 1.0–2.6 ms in each of the nine /thesis/ samples.
 *
 * A task without `tdur` (Chrome omits it where the platform has no thread CPU
 * clock), a thread whose clock never advanced, and a trace that does not name
 * the page's process all yield no stalls, and the gate then treats a failing
 * sample as it always did.
 */

/** A stall task lasts at least this long on the wall clock, in milliseconds. */
export const STALL_MIN_WALL_MS = 50;

/** A stall task spends less than this share of its wall time on the CPU. */
export const STALL_MAX_CPU_SHARE = 0.25;

const threadKey = (event) => `${event.pid}:${event.tid}`;

/**
 * The renderer main thread Lighthouse measures: CrRendererMain in the process
 * the main frame committed in, or, without a commit, the process
 * TracingStartedInBrowser names for the main frame. This follows Lighthouse's
 * own TraceProcessor.findMainFramePidTids. Empty when the trace does not say,
 * so a trace of unknown shape yields no stalls.
 */
export function pageMainThreads(events) {
  const started = events.find((event) => event?.name === 'TracingStartedInBrowser');
  const mainFrame = started?.args?.data?.frames?.find((frame) => !frame.parent);
  if (!mainFrame?.frame) return new Set();
  const committed = events
    .filter((event) => (event?.name === 'FrameCommittedInBrowser' || event?.name === 'ProcessReadyInBrowser')
      && event.args?.data?.frame === mainFrame.frame && event.args.data.processId)
    .map((event) => event.args.data.processId);
  const pids = new Set(committed.length > 0 ? committed : [mainFrame.processId]);
  return new Set(events
    .filter((event) => event?.ph === 'M' && event.name === 'thread_name'
      && event.args?.name === 'CrRendererMain' && pids.has(event.pid))
    .map(threadKey));
}

/**
 * The tasks on the page's main thread that the runner held off the CPU:
 * RunTask events that lasted at least STALL_MIN_WALL_MS (`dur`) and spent
 * less than STALL_MAX_CPU_SHARE of that on the CPU (`tdur`). A task without
 * `tdur`, or on a thread whose CPU clock never advanced, is never a stall.
 *
 * @param {{traceEvents?: object[]} | undefined} trace Lighthouse's Trace artifact
 * @returns {{ts: number, wallMs: number, cpuMs: number}[]} in trace order
 */
export function findRunnerStalls(trace) {
  const events = Array.isArray(trace?.traceEvents) ? trace.traceEvents : [];
  const threads = pageMainThreads(events);
  const tasks = events.filter((event) => event?.name === 'RunTask' && event.ph === 'X'
    && threads.has(threadKey(event)));
  const clocked = new Set(tasks.filter((task) => Number.isFinite(task.tdur) && task.tdur > 0).map(threadKey));
  return tasks
    .filter((task) => clocked.has(threadKey(task))
      && Number.isFinite(task.dur) && Number.isFinite(task.tdur)
      && task.dur >= STALL_MIN_WALL_MS * 1000
      && task.tdur < STALL_MAX_CPU_SHARE * task.dur)
    .sort((a, b) => a.ts - b.ts)
    .map((task) => ({ ts: task.ts, wallMs: task.dur / 1000, cpuMs: task.tdur / 1000 }));
}

/** "117.7 ms wall / 7.3 ms CPU, 105.1 ms wall / 0.9 ms CPU" */
export function describeStalls(stalls) {
  return stalls
    .map(({ wallMs, cpuMs }) => `${wallMs.toFixed(1)} ms wall / ${cpuMs.toFixed(1)} ms CPU`)
    .join(', ');
}
