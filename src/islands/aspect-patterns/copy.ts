import type { AspectPattern, PatternKind } from '../../lib/engine/aspect-patterns';

export const PATTERN_NAMES: Record<PatternKind, string> = {
  'grand-trine': 'Grand trine', 't-square': 'T-square', 'grand-cross': 'Grand cross', kite: 'Kite',
};
export const PATTERN_ORBS = 'Each required edge uses the chart’s existing inclusive limit: sextile 4°, square/trine 7°, opposition 8°. When Sun or Moon is an endpoint: 5°, 8° and 10°, respectively. Positions are checked before any display rounding.';

export function patternRole(pattern: AspectPattern): string {
  if (pattern.kind === 't-square') return `${pattern.oppositions[0].join(' opposite ')}; ${pattern.apex} is the square apex.`;
  if (pattern.kind === 'grand-cross') return `${pattern.oppositions.map((pair) => pair.join(' opposite ')).join('; ')}. Four squares complete the cross.`;
  if (pattern.kind === 'kite') return `${pattern.triangle!.join(', ')} form the trine triangle. ${pattern.opposedVertex} opposes ${pattern.axisVertex} and sextiles the other two triangle members.`;
  return `${pattern.members.join(', ')} form a triangle of three trines.`;
}

export function patternReading(pattern: AspectPattern, context: 'natal' | 'composite'): string {
  const role = patternRole(pattern);
  const natal: Record<PatternKind, string> = {
    'grand-trine': 'In traditional astrology, this is read as an easy exchange between these parts of your life. Ease can become a habit; consider where a deliberate challenge would help you use it.',
    't-square': `Traditionally, the opposition describes competing needs, with ${pattern.apex} offering a focus for action. When you feel pulled between them, what small, concrete choice gives that part of you a useful task?`,
    'grand-cross': 'Traditionally, the two oppositions describe demands that can compete for your attention. Try choosing what needs action now and what can wait, rather than requiring every part of life to move together.',
    kite: `Traditionally, the trine triangle offers familiar resources while the ${pattern.axisVertex}-${pattern.opposedVertex} opposition asks you to use them in response to a tension. What practical step would turn an easy ability into something you choose to do?`,
  };
  const composite: Record<PatternKind, string> = {
    'grand-trine': 'In composite astrology, this is read as an easy shared rhythm between these themes. Ask which familiar strength helps you work together, and where comfort might make an important conversation easier to postpone.',
    't-square': `In composite astrology, the opposition describes two themes that can pull your shared attention in different directions. ${pattern.apex} is the focal theme. What action could you agree on together when those priorities compete?`,
    'grand-cross': 'In composite astrology, the two oppositions describe several shared priorities asking for attention. Discuss which responsibility belongs to whom and which decision needs to come first; the pattern does not grade the relationship.',
    kite: `In composite astrology, the trine triangle suggests familiar ways of cooperating. The ${pattern.axisVertex}-${pattern.opposedVertex} opposition offers a theme to discuss: how could you use a shared strength when your priorities differ?`,
  };
  return `${role} ${context === 'natal' ? natal[pattern.kind] : composite[pattern.kind]} This is a symbolic reflection, not a prediction.`;
}
