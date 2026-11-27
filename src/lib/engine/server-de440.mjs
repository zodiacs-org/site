/**
 * Server and build-time calculations read JPL DE440.
 *
 * Up to 2.1.0 the engine loaded its DE440 pack on import. From 3.0.0 its root
 * computes on astronomy-engine until a caller installs the pack it ships
 * (2,489,664 bytes, 1790 to 2210), and every entry point that shares the
 * root's ephemeris follows. Importing this module installs it for the rest of
 * the process: positions inside the pack's years come from DE440, as before.
 *
 * Each server entry imports it before anything that computes or reads the
 * default, because src/lib/compute-api/receipt.ts names the ephemeris when it
 * loads: the compute API (src/lib/compute-api/handler.ts), the hosted AI
 * runtime and Sky Watch (src/ai-tools/http.ts, src/ai-tools/watch/runtime.ts),
 * the local MCP adapter (src/mcp/server.ts), the Astro build
 * (astro.config.mjs), the data and publishing scripts, and the tests
 * (vitest.config.mts).
 *
 * Server only. The browser computes on astronomy-engine, the engine's default,
 * and never loads the pack: scripts/lib/browser-engine.mjs refuses this module
 * and the pack in every browser build, and scripts/report-bundles.mjs fails a
 * build whose browser files carry the pack.
 */
import { useDe440 } from '@zodiacs/engine/de440/pack';

useDe440();
