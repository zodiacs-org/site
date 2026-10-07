import { decodePositionsLink, encodeSharedPositionsLink, type PositionsShareInput } from '../share-positions';
import { timedSharedPositions, untimedSharedPositions } from '../share-positions-noon';

export async function privateInviteToken(input: PositionsShareInput, instant: { utc: Date | string } | { birthDate: string }): Promise<string> {
  const { computeBodies } = await import('../engine/full');
  const shared = 'utc' in instant
    ? timedSharedPositions(input, instant.utc, computeBodies)
    : untimedSharedPositions(input, instant.birthDate, computeBodies);
  if (!shared) throw new RangeError('invalid invitation basis');
  const token = encodeSharedPositionsLink(shared);
  if (!token) throw new RangeError('invalid invitation positions');
  return token;
}

/** Strict fragment-only arrival. Unknown or repeated keys do not become an invitation. */
export function readPrivateInvite(fragment: string) {
  if (fragment.length > 280) return null;
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  if (params.getAll('p').length !== 1 || [...params.keys()].some((key) => key !== 'p')) return null;
  return decodePositionsLink(params.get('p')!);
}
