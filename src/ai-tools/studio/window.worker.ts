import { birthWindow, WindowBudgetError, type BirthWindowInput } from '@zodiacs/engine/window';

// Runs in a dedicated, bundled worker. No network, host bridge or persistence.
const worker = self as unknown as { onmessage: ((event: MessageEvent<BirthWindowInput>) => void) | null; postMessage: (value: unknown) => void };
worker.onmessage = event => {
  try { worker.postMessage({ ok: true, result: birthWindow(event.data) }); }
  catch (error) { worker.postMessage({ ok: false, error: error instanceof WindowBudgetError
    ? 'This window exceeds the calculation budget. Try a shorter window.'
    : 'This window could not be calculated. Check its UTC bounds and coordinates.' }); }
};
