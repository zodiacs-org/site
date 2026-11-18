import { afterAll } from 'vitest';
import { defaultEphemeris, setDefaultEphemeris } from '@zodiacs/engine';

/** Match the site browser bundle when running its tests in Node. */
export function useBrowserEphemeris() {
  const original = defaultEphemeris().name;
  setDefaultEphemeris('astronomy-engine');
  afterAll(() => setDefaultEphemeris(original));
}
