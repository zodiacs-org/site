// The hosted compute API: POST /api/v1/chart, /positions, /houses, /events,
// /time and /sky-fact. vercel.json rewrites each to api/compatibility.ts with
// the __zodiacs_compute parameter, and that function hands the request here
// before any route of its own, so the six endpoints add no deployed function;
// the underscore keeps this directory from deploying as one. The handler and
// its limits are src/lib/compute-api/; the local-time resolver is the site's
// own, bundled with its tables into ./local-time.mjs by
// scripts/build-compute-local-time.mjs, because the function's file trace
// does not carry the tables the resolver's source loads on demand.
import { createComputeApiHandler } from '../../src/lib/compute-api/handler.js';
import * as localTime from './local-time.mjs';

export default createComputeApiHandler({ localTime });
