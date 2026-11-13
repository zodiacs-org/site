import type { WeekRequest, YourWeek } from './week';
import { computeYourWeek } from './week-local';
declare const STUDIO_WEEK_WORKER: string;

export type WeekReply = { ok: true; result: YourWeek } | { ok: false; error: string };
export interface WeekPort {
  onmessage: ((event: MessageEvent<WeekReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(request: WeekRequest): void;
  terminate(): void;
}
export function createWeekPort(): WeekPort {
  const url = URL.createObjectURL(new Blob([STUDIO_WEEK_WORKER], { type: 'text/javascript' }));
  try {
    const worker = new Worker(url);
    return {
      set onmessage(handler) { worker.onmessage = handler; }, get onmessage() { return worker.onmessage; },
      set onerror(handler) { worker.onerror = handler; }, get onerror() { return worker.onerror; },
      postMessage: request => worker.postMessage(request),
      terminate() { worker.terminate(); URL.revokeObjectURL(url); },
    };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

const FAILED = 'Your week could not be worked out here.';

/**
 * Works out the week in the panel's own worker. Where a host refuses workers,
 * the same calculation runs on the page instead: it takes a few milliseconds.
 */
export class WeekCalculator {
  private stop: (() => void) | null = null;
  constructor(
    private factory: () => WeekPort = createWeekPort,
    private local: (request: WeekRequest) => YourWeek = computeYourWeek,
  ) {}
  cancel() { this.stop?.(); }
  calculate(request: WeekRequest): Promise<YourWeek> {
    this.cancel();
    return new Promise((resolve, reject) => {
      let settled = false;
      let port: WeekPort | null = null;
      let pending: ReturnType<typeof setTimeout> | undefined;
      const finish = (result?: YourWeek) => {
        if (settled) return;
        settled = true; clearTimeout(timer); clearTimeout(pending); port?.terminate(); port = null; this.stop = null;
        if (result) resolve(result); else reject(new Error(FAILED));
      };
      const onPage = () => {
        if (settled) return;
        port?.terminate(); port = null;
        // A tick first, so the waiting line is painted before the page is busy.
        pending = setTimeout(() => { try { finish(this.local(request)); } catch { finish(); } }, 0);
      };
      const timer = setTimeout(() => finish(), 15_000);
      this.stop = () => finish();
      try { port = this.factory(); } catch { onPage(); return; }
      port.onmessage = event => event.data.ok ? finish(event.data.result) : finish();
      port.onerror = () => onPage();
      try { port.postMessage(request); } catch { onPage(); }
    });
  }
}
