// The hosted compute API: POST /api/v1/chart, /positions, /houses, /events,
// /time, /sky-fact and /elections. vercel.json rewrites each to
// api/compatibility.ts with the __zodiacs_compute parameter, and that function
// hands the request here before any route of its own, so the seven endpoints
// add no deployed function;
// the underscore keeps this directory from deploying as one. The handler and
// its limits are src/lib/compute-api/, bundled with the engine into
// ./compute.mjs by scripts/build-compute-handler.mjs: on a Node that does not
// detect module syntax, the engine's named imports from astronomy-engine fail
// to load, as they did at the first deploy. The local-time resolver is the
// site's own, bundled with its tables into ./local-time.mjs by
// scripts/build-compute-local-time.mjs, because the function's file trace
// does not carry the tables the resolver's source loads on demand.
import { readFile } from 'node:fs/promises';
import { createComputeApiHandler, de440FromFile } from './compute.mjs';
import { createLocalTimeModule } from './local-time.mjs';

// The sealed DE440 pack the deploy builds (scripts/build-precision-pack.mjs),
// never committed. The literal URL lets the function's file trace carry it;
// without it, backend de440 answers backend-unavailable (P4.1).
const DE440_PACK = new URL('./precision/de440-1790-2210.zeph', import.meta.url);
const precision = de440FromFile(async () => {
  try {
    return new Uint8Array(await readFile(DE440_PACK));
  } catch {
    return null;
  }
});

// The async timezone resolver owns a fresh set of caches for each request.
// Sharing and then clearing them would race another request between prepare
// and resolve. The compute bundle separately clears its synchronous engine memos.
export default async function computeApi(req: any, res: any): Promise<void> {
  const localTime = createLocalTimeModule();
  try {
    await createComputeApiHandler({ localTime, precision })(req, res);
  } finally {
    localTime.dispose();
  }
}
