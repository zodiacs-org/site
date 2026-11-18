import { afterAll } from 'vitest';
import { defaultEphemeris, setDefaultEphemeris } from '@zodiacs/engine';

/** Match the site browser bundle when running its tests in Node. */
export function useBrowserEphemeris() {
  const original = defaultEphemeris().name;
  setDefaultEphemeris('astronomy-engine');
  afterAll(() => setDefaultEphemeris(original));
}

/** Replay an astronomy engine reference without changing the other tests in its file. */
export async function withBrowserEphemeris<T>(run: () => T | Promise<T>): Promise<T> {
  const original = defaultEphemeris().name;
  setDefaultEphemeris('astronomy-engine');
  try {
    return await run();
  } finally {
    setDefaultEphemeris(original);
  }
}
