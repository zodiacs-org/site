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
import { createComputeApiHandler } from './compute.mjs';
import { createLocalTimeModule } from './local-time.mjs';

// The async timezone resolver owns a fresh set of caches for each request.
// Sharing and then clearing them would race another request between prepare
// and resolve. The compute bundle separately clears its synchronous engine memos.
export default async function computeApi(req: any, res: any): Promise<void> {
  const localTime = createLocalTimeModule();
  try {
    await createComputeApiHandler({ localTime })(req, res);
  } finally {
    localTime.dispose();
  }
}
