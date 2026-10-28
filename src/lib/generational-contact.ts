/**
 * Which contacts between two charts are generational. Import-free, so the
 * synastry ranking (engine/synastry.ts) and the contact wording
 * (contact-line.ts) share one rule without either pulling in the other.
 *
 * They are the contacts that say when two people were born rather than who they are to
 * each other. Uranus, Neptune and Pluto take seven to thirty years to cross
 * a sign, so any aspect among the three between two charts is shared by most
 * people born within a few years of each other: Neptune sextile Pluto, for
 * one, held for most of the twentieth century. A slow planet conjunct its own
 * counterpart is the same kind of fact: Pluto conjunct Pluto for anyone born
 * a few years apart, Jupiter and Saturn over shorter spans.
 *
 * Any other contact between slow planets (Saturn square Uranus, say) still
 * varies enough to be worth its orb, and keeps its place in the ranking.
 */
const SLOW_BODIES = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
const OUTER_BODIES = new Set(['Uranus', 'Neptune', 'Pluto']);

export function isGenerationalContact(
  aspect: { a: string; b: string; type: string },
): boolean {
  if (OUTER_BODIES.has(aspect.a) && OUTER_BODIES.has(aspect.b)) return true;
  return aspect.type === 'conjunction'
    && aspect.a === aspect.b
    && SLOW_BODIES.has(aspect.a);
}
