import type { BirthWindow, BirthWindowInput } from '@zodiacs/engine/window';
declare const STUDIO_WINDOW_WORKER: string;

export interface WindowPort {
  onmessage: ((event: MessageEvent<{ ok: true; result: BirthWindow } | { ok: false; error: string }>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(input: BirthWindowInput): void;
  terminate(): void;
}
export function createWindowPort(): WindowPort {
  const url = URL.createObjectURL(new Blob([STUDIO_WINDOW_WORKER], { type: 'text/javascript' }));
  try {
    const worker = new Worker(url);
    return {
      set onmessage(handler) { worker.onmessage = handler; }, get onmessage() { return worker.onmessage; },
      set onerror(handler) { worker.onerror = handler; }, get onerror() { return worker.onerror; },
      postMessage: input => worker.postMessage(input),
      terminate() { worker.terminate(); URL.revokeObjectURL(url); },
    };
  } catch { URL.revokeObjectURL(url); throw new Error('This host does not allow the local window calculator. Open the standalone preview to use it.'); }
}

export class WindowCalculator {
  private stop: (() => void) | null = null;
  constructor(private factory = createWindowPort) {}
  cancel() { this.stop?.(); }
  calculate(input: BirthWindowInput): Promise<BirthWindow> {
    this.cancel();
    return new Promise((resolve, reject) => {
      let port: WindowPort;
      try { port = this.factory(); } catch (error) { reject(error); return; }
      let settled = false;
      const finish = (result?: BirthWindow, error?: string) => {
        if (settled) return;
        settled = true; clearTimeout(timer); port.terminate(); this.stop = null;
        if (result) resolve(result); else reject(new Error(error));
      };
      const timer = setTimeout(() => finish(undefined, 'The calculation took too long and was stopped. Try a shorter window.'), 15_000);
      this.stop = () => finish(undefined, 'Calculation cancelled.');
      port.onmessage = event => event.data.ok ? finish(event.data.result) : finish(undefined, event.data.error);
      port.onerror = () => finish(undefined, 'The local calculator could not start. This host may block browser workers.');
      try { port.postMessage(input); } catch { finish(undefined, 'The local calculator could not start.'); }
    });
  }
}
