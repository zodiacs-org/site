/**
 * The compute API's calculations as the developer playground runs them in the
 * browser (/developers/playground/). scripts/build-playground-engine.mjs
 * bundles this file, with the engine and its local-time resolver, into
 * public/developers/playground/engine.mjs, which the page imports only when
 * asked to run a request here. Nothing on a page imports this file.
 *
 * It reads a body as the handler does once the HTTP checks have passed (its
 * size, then its JSON) and answers as the handler's dispatch does
 * (src/lib/compute-api/handler.ts), with the same parsers, calculations and
 * refusals. tests/api/compute-api-playground.test.ts holds the two to the same
 * answer for every documented example. The one thing that differs is what a
 * receipt says about its runtime: in a browser it names the browser, and a
 * browser does not report the tzdb release its Intl reads, so `runtimeTzdb` is
 * null here (runtimeIdentity in local-time.ts).
 */
import { TZDB, prepareLocalTime, resolveLocalToUtc } from '@zodiacs/engine/geo';
import { canonicalZoneName } from '../time/zone-names';
import { receiptDigest } from '../receipt-digest.js';
import { COMPUTE_ENDPOINTS, MAX_BODY_BYTES, type ComputeEndpoint } from './constants.js';
import {
  computeChart,
  computeEvents,
  computeHouses,
  computePositions,
  computeSkyFact,
  computeTime,
  type ComputeDependencies,
} from './endpoints.js';
import { computeElections } from './elections.js';
import { requestedBackend, selectBackend } from './backend.js';
import { ComputeApiError, calculationFailed, invalidJson, notFound, payloadTooLarge } from './errors.js';
import type { LocalTimeModule } from './local-time.js';
import {
  parseElectionsRequest,
  parseEventsRequest,
  parsePlaceInstantRequest,
  parsePositionsRequest,
  parseSkyFactRequest,
  parseTimeRequest,
  type ZoneNames,
} from './validate.js';

export { receiptDigest };

const localTime: LocalTimeModule = { TZDB, prepareLocalTime, resolveLocalToUtc, canonicalZoneName };
const dependencies: ComputeDependencies = { localTime };
const zones: ZoneNames = (name) => localTime.canonicalZoneName(name);

/**
 * The handler's dispatch, endpoint by endpoint. A browser has no DE440 pack,
 * so a request naming `de440` is answered as a deployment without one answers
 * it (backend-unavailable); the hosted API computes it.
 */
async function dispatch(endpoint: ComputeEndpoint, body: unknown): Promise<unknown> {
  const { name, rest } = requestedBackend(endpoint, body);
  switch (endpoint) {
    case 'chart': {
      const request = await parsePlaceInstantRequest(rest, zones);
      return computeChart(request, dependencies, await selectBackend(name, {}));
    }
    case 'houses': return computeHouses(await parsePlaceInstantRequest(rest, zones), dependencies);
    case 'positions': {
      const request = parsePositionsRequest(rest);
      return computePositions(request, await selectBackend(name, {}));
    }
    case 'events': {
      const request = parseEventsRequest(rest);
      return computeEvents(request, await selectBackend(name, {}));
    }
    case 'time': return computeTime(await parseTimeRequest(rest, zones), dependencies);
    case 'sky-fact': {
      const request = await parseSkyFactRequest(rest, zones);
      return computeSkyFact(request, dependencies, await selectBackend(name, {}));
    }
    case 'elections': {
      const request = parseElectionsRequest(rest);
      return computeElections(request, await selectBackend(name, {}));
    }
  }
}

export interface PlaygroundAnswer {
  /** The status the hosted API answers the same request with. */
  status: number;
  body: unknown;
}

/** What the compute API answers `text`, sent as a JSON body to `endpoint`, computed in this runtime. */
export async function answerHere(endpoint: string, text: string): Promise<PlaygroundAnswer> {
  try {
    if (!(COMPUTE_ENDPOINTS as readonly string[]).includes(endpoint)) throw notFound();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw payloadTooLarge();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw invalidJson();
    }
    return { status: 200, body: await dispatch(endpoint as ComputeEndpoint, body) };
  } catch (error) {
    const refusal = error instanceof ComputeApiError ? error : calculationFailed();
    return { status: refusal.status, body: { error: refusal.detail } };
  }
}
