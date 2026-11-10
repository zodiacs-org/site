/**
 * Rule (vi)'s one bundle: the engine's DE440 positions, built once by
 * esbuild from the vendored engine and run unchanged in every runtime with
 * the same pack bytes.
 */
import { positions, withEphemeris } from '@zodiacs/engine';
import { openDe440Pack } from '@zodiacs/engine/de440';

export async function de440Rows(packBytes, digest, instants) {
  const source = await openDe440Pack(packBytes, { expectDigest: digest });
  return withEphemeris(source, () => instants.map((utc) => ({ utc, bodies: positions(utc).map(({ body, lon, lat }) => ({ body, lon, lat })) })));
}
