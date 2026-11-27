import { defineConfig } from 'vitest/config';

// Tests calculate as the server does, on JPL DE440 (src/lib/engine/server-de440.mjs).
// A test of what a page calculates in the browser switches to astronomy-engine
// itself (tests/helpers/browser-ephemeris.ts, src/ai-tools/personal/page-ephemeris.ts).
export default defineConfig({
  test: { setupFiles: ['./src/lib/engine/server-de440.mjs'] },
});
