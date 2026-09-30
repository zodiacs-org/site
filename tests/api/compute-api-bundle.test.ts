import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createComputeApiHandler as bundledHandler } from '../../api/_compute/compute.mjs';
import { createComputeApiHandler as sourceHandler } from '../../src/lib/compute-api/handler';
import { SUCCESS_EXAMPLES } from '../../src/lib/compute-api/examples';
import * as localTime from '../../src/lib/compute-api/local-time-source';
import { run, withoutRuntime } from '../../scripts/lib/compute-api-harness';
import {
  ALLOWED_RUNTIME_IMPORTS,
  BUNDLE_PATH,
  TYPES_PATH,
  buildComputeHandlerBundle,
  externalImports,
} from '../../scripts/build-compute-handler.mjs';

/*
 * The compute function runs api/_compute/compute.mjs, the handler bundled with
 * the engine. At the first deploy (2026-09-30) it ran the handler's sources,
 * and every endpoint answered 500: on the Node Vercel ran, which did not
 * detect module syntax, the engine's named imports from astronomy-engine
 * failed to load (FINDINGS F-58). These tests hold the bundle to its sources,
 * to what it may load at run time, to loading on such a Node, and to the
 * source handler's answers.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url));
const NO_DETECTION = ['--no-experimental-detect-module', '--input-type=module', '-e'];

describe("the compute API's handler bundle", () => {
  it('is what scripts/build-compute-handler.mjs builds from its sources', async () => {
    const { bytes, types } = await buildComputeHandlerBundle();
    expect(read(BUNDLE_PATH).equals(bytes), 'stale: run node scripts/build-compute-handler.mjs').toBe(true);
    expect(read(TYPES_PATH).equals(types), 'stale: run node scripts/build-compute-handler.mjs').toBe(true);
  }, 60_000);

  it("loads nothing at run time but Node's own modules and the Firewall SDK", () => {
    expect(externalImports(read(BUNDLE_PATH).toString('utf8'))).toEqual(ALLOWED_RUNTIME_IMPORTS);
  });

  it('loads on a Node that does not detect module syntax, where the engine it bundles does not', () => {
    const bundleUrl = new URL('../../api/_compute/compute.mjs', import.meta.url).href;
    const bundle = spawnSync(process.execPath, [
      ...NO_DETECTION,
      `const m = await import(${JSON.stringify(bundleUrl)}); if (typeof m.createComputeApiHandler !== 'function') process.exit(2);`,
    ], { cwd: ROOT, encoding: 'utf8' });
    expect(bundle.status, bundle.stderr).toBe(0);
    // The control: the engine loaded as the function first loaded it fails on
    // the same Node, as it did in production.
    const engine = spawnSync(process.execPath, [...NO_DETECTION, "await import('@zodiacs/engine');"], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(engine.status).not.toBe(0);
    expect(engine.stderr).toMatch(/Named export 'Body' not found|does not provide an export named 'Body'/u);
  });

  it('answers every documented example as the source handler does', async () => {
    const options = { localTime, env: {}, rateLimit: async () => 'allowed' as const };
    const fromBundle = bundledHandler(options);
    const fromSource = sourceHandler(options);
    let compared = 0;
    for (const [endpoint, examples] of Object.entries(SUCCESS_EXAMPLES)) {
      for (const [name, example] of Object.entries(examples)) {
        const bundled = await run(fromBundle, { endpoint: endpoint as never, body: example.body });
        const source = await run(fromSource, { endpoint: endpoint as never, body: example.body });
        expect(bundled.status, `${endpoint}.${name}`).toBe(200);
        expect(withoutRuntime(bundled.json), `${endpoint}.${name}`).toEqual(withoutRuntime(source.json));
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThanOrEqual(6);
  }, 60_000);
});
