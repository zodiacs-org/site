/**
 * Which ephemeris a compute request is answered from (P4.1,
 * docs/platform/evidence/de440-hosted-20261109/PREREGISTRATION.md).
 *
 * `astronomy-engine` is the engine as the site has always run it. `de440` is
 * the engine with its DE440 source (`@zodiacs/engine/de440`) in place for
 * every body position, through `withEphemeris`, from the sealed pack the
 * deploy builds and the handler opens (api/_compute/handler.ts). A request
 * names one in its `backend` field; one that names none gets
 * DEFAULT_BACKEND. A backend runs the request's synchronous engine calls
 * (`run`) and names itself in the response and the receipts.
 */
import { ENGINE_VERSION, EPHEMERIS, withEphemeris } from '@zodiacs/engine';
import type { De440Source } from '@zodiacs/engine/de440';
import type { ComputeEndpoint } from './constants.js';
import { MESSAGES, backendUnavailable, invalidRequest } from './errors.js';

export const BACKEND_NAMES = Object.freeze(['astronomy-engine', 'de440'] as const);
export type BackendName = (typeof BACKEND_NAMES)[number];

/** Until P4.1 is recorded validated, a request that names no backend is answered by astronomy-engine. */
export const DEFAULT_BACKEND: BackendName = 'astronomy-engine';

/** The SHA-256 of the sealed DE440 pack the deploy builds (1790 to 2210, compiler 2.0.0); the handler opens no other. */
export const DE440_PACK_SHA256 = '51428874d9a47213abc0ff42cbcec65f338624eaa2d8831f0e6ddc3654bf1fa7';

/** What a response's `backend` and a compute receipt's `engine` say. */
export interface BackendIdentity {
  readonly name: '@zodiacs/engine';
  readonly version: string;
  readonly ephemeris: { readonly name: string; readonly version: string };
  /** With DE440: the pack the positions came from. */
  readonly pack?: {
    readonly sha256: string;
    readonly startEtSecTdb: number;
    readonly stopEtSecTdb: number;
    readonly compiler: { readonly name: string; readonly version: string } | null;
  };
  /** When a request that named no backend was answered by astronomy-engine because this deployment has no DE440 pack. */
  readonly fallback?: { readonly from: 'de440'; readonly reason: 'pack-unavailable' };
}

export interface ComputeBackend {
  readonly name: BackendName;
  readonly identity: BackendIdentity;
  /** Run synchronous engine calls with this backend's positions. */
  run<T>(fn: () => T): T;
}

const ENGINE_IDENTITY = Object.freeze({
  name: '@zodiacs/engine' as const,
  version: ENGINE_VERSION,
  ephemeris: Object.freeze({ name: EPHEMERIS.name, version: EPHEMERIS.version }),
});

export const ASTRONOMY_ENGINE_BACKEND: ComputeBackend = Object.freeze({
  name: 'astronomy-engine' as const,
  identity: ENGINE_IDENTITY,
  run: <T>(fn: () => T): T => fn(),
});

/** astronomy-engine, saying that it stands in for DE440, which this deployment cannot open. */
export const FALLBACK_BACKEND: ComputeBackend = Object.freeze({
  name: 'astronomy-engine' as const,
  identity: Object.freeze({ ...ENGINE_IDENTITY, fallback: Object.freeze({ from: 'de440' as const, reason: 'pack-unavailable' as const }) }),
  run: <T>(fn: () => T): T => fn(),
});

/** The endpoints that give body positions, and so take a `backend`. */
export const BACKEND_ENDPOINTS: ReadonlySet<ComputeEndpoint> = new Set<ComputeEndpoint>(['chart', 'positions', 'events', 'sky-fact', 'elections']);

/**
 * The backend a request names, read off its body before the endpoint's own
 * parser sees it: `astronomy-engine`, `de440`, or none (null), with the body
 * the parser then reads. An endpoint that gives no position leaves the field
 * to its parser, which refuses it as one it does not accept.
 */
export function requestedBackend(endpoint: ComputeEndpoint, body: unknown): { name: BackendName | null; rest: unknown } {
  if (!BACKEND_ENDPOINTS.has(endpoint) || body === null || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(body, 'backend')) {
    return { name: null, rest: body };
  }
  const { backend, ...rest } = body as Record<string, unknown>;
  if (typeof backend !== 'string' || !(BACKEND_NAMES as readonly string[]).includes(backend)) {
    throw invalidRequest('/backend', MESSAGES.backend);
  }
  return { name: backend as BackendName, rest };
}

export interface BackendChoice {
  /** Opens this runtime's DE440 source, or gives null when it has no pack. Absent: none. */
  precision?: () => Promise<De440Source | null>;
  /** The backend for a request that names none; DEFAULT_BACKEND unless given. */
  defaultBackend?: BackendName;
}

/**
 * The backend that answers: the one named, else the default. DE440 named
 * where no source opens is refused (backend-unavailable); DE440 as the
 * default there is astronomy-engine, saying so (FALLBACK_BACKEND).
 */
export async function selectBackend(name: BackendName | null, choice: BackendChoice): Promise<ComputeBackend> {
  const wanted = name ?? choice.defaultBackend ?? DEFAULT_BACKEND;
  if (wanted === 'astronomy-engine') return ASTRONOMY_ENGINE_BACKEND;
  const source = choice.precision ? await choice.precision() : null;
  if (source) return de440Backend(source);
  if (name === 'de440') throw backendUnavailable();
  return FALLBACK_BACKEND;
}

export function de440Backend(source: De440Source): ComputeBackend {
  const identity: BackendIdentity = Object.freeze({
    name: '@zodiacs/engine' as const,
    version: ENGINE_VERSION,
    ephemeris: Object.freeze({ name: source.ephemeris.name, version: source.ephemeris.version }),
    pack: Object.freeze({
      sha256: source.pack.sha256,
      startEtSecTdb: source.pack.startEtSecTdb,
      stopEtSecTdb: source.pack.stopEtSecTdb,
      compiler: source.pack.compiler,
    }),
  });
  return Object.freeze({
    name: 'de440' as const,
    identity,
    run: <T>(fn: () => T): T => withEphemeris(source, fn),
  });
}
