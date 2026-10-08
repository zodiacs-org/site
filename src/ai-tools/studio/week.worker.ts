import type { WeekRequest } from './week';
import { computeYourWeek } from './week-local';

// Runs in a dedicated, bundled worker. No network, host bridge or persistence.
const worker = self as unknown as { onmessage: ((event: MessageEvent<WeekRequest>) => void) | null; postMessage: (value: unknown) => void };
worker.onmessage = event => {
  try { worker.postMessage({ ok: true, result: computeYourWeek(event.data) }); }
  catch { worker.postMessage({ ok: false, error: 'Your week could not be worked out.' }); }
};
