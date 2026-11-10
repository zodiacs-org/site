/**
 * The hosted path, in process: POST /api/v1/<endpoint> through the compute
 * handler the site deploys (api/_compute/compute.mjs, the frozen bundle), with
 * the deploy's sealed DE440 pack opened by the deployed opener (de440FromFile,
 * which accepts only the pinned digest) and a fresh local-time resolver per
 * request, as api/_compute/handler.ts gives one. No network, no rate limit.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PACK_SHA256 = '51428874d9a47213abc0ff42cbcec65f338624eaa2d8831f0e6ddc3654bf1fa7';
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function openApi(root, packPath) {
  const bundlePath = join(root, 'api/_compute/compute.mjs');
  const bundle = readFileSync(bundlePath);
  const compute = await import(pathToFileURL(bundlePath).href);
  const { createLocalTimeModule } = await import(pathToFileURL(join(root, 'api/_compute/local-time.mjs')).href);
  const pack = new Uint8Array(readFileSync(packPath));
  if (sha256(pack) !== PACK_SHA256) throw new Error(`the pack at ${packPath} is not the pinned one`);
  const precision = compute.de440FromFile(async () => pack);
  let requests = 0;

  /** One request; returns { status, body }. */
  async function call(endpoint, body, options = {}) {
    const localTime = createLocalTimeModule();
    let text = '';
    const response = { statusCode: 0, setHeader() {}, end(value) { text = value ?? ''; } };
    try {
      const handler = compute.createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed', precision, ...options });
      await handler({ method: 'POST', query: { __zodiacs_compute: endpoint }, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, response);
    } finally {
      localTime.dispose();
    }
    requests += 1;
    return { status: response.statusCode, body: text ? JSON.parse(text) : null };
  }

  /**
   * /positions for any number of instants (in requests of at most 100), every
   * row checked: a refusal, a missing body or a non-finite number is returned
   * as a failure of that row, never dropped.
   */
  async function positions(instants, bodies, backend = 'de440') {
    const out = [];
    for (let i = 0; i < instants.length; i += 100) {
      const slice = instants.slice(i, i + 100);
      const answer = await call('positions', { instants: slice, ...(bodies ? { bodies } : {}), backend });
      if (answer.status !== 200) {
        for (const instant of slice) out.push({ instant, refused: `${answer.status} ${answer.body?.error?.code ?? ''}`.trim() });
        continue;
      }
      if (answer.body.backend.ephemeris.name !== (backend === 'de440' ? 'jpl-de440' : 'astronomy-engine')) {
        throw new Error(`answered from ${answer.body.backend.ephemeris.name}, not ${backend}`);
      }
      if (backend === 'de440' && answer.body.backend.ephemeris.version !== PACK_SHA256) throw new Error('answered from another pack');
      answer.body.result.instants.forEach((row, index) => out.push({ instant: slice[index], ...row }));
    }
    return out;
  }

  return { call, positions, bundleSha256: sha256(bundle), packSha256: sha256(pack), packBytes: pack.byteLength, get requests() { return requests; } };
}

/** A row's body, or a failure reason (refused, absent, non-finite). */
export function bodyOf(row, body) {
  if (row.refused) return { fail: `refused: ${row.refused}` };
  const hit = row.bodies?.find((candidate) => candidate.body === body);
  if (!hit) return { fail: 'absent' };
  if (![hit.lon, hit.lat].every(Number.isFinite)) return { fail: 'non-finite' };
  return hit;
}
