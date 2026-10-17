import { dignityFor, type Dignity } from './dignities';
import type { Aspect, BodyName, Chart } from './engine/types';
import type { Locale } from './i18n';
import { natalAspectLine } from './natal';
import { moonCandidates, moonIsUncertain, moonLabel } from './moon-certainty';
import {
  elementLabel,
  modalityLabel,
  signForLongitude,
  signName,
  type Element,
  type Modality,
} from './signs';

export type ChartSignatureKind =
  | 'dignity'
  | 'aspect'
  | 'stellium'
  | 'element'
  | 'modality'
  | 'big-three';

/** Compact enough for the wheel dock, complete enough for a social card. */
export interface ChartSignature {
  kind: ChartSignatureKind;
  eyebrow: 'Standout in your chart';
  title: string;
  summary: string;
  detail: string | null;
  signSlugs: string[];
  bodies: BodyName[];
}

const PLANET_ORDER: BodyName[] = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
];
const PLANET_SET = new Set<BodyName>(PLANET_ORDER);
const PERSONAL = new Set<BodyName>(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars']);
const POSITIVE_DIGNITIES = new Set<Dignity>(['exaltation', 'domicile']);
const POSITIVE_CONJUNCTIONS = new Set([
  'Moon|Sun',
  'Mars|Venus',
  'Mercury|Sun',
]);
const POSITIVE_CONJUNCTION_ORDER: Record<string, [BodyName, BodyName]> = {
  'Moon|Sun': ['Sun', 'Moon'],
  'Mars|Venus': ['Venus', 'Mars'],
  'Mercury|Sun': ['Sun', 'Mercury'],
};

const DIGNITY_STRENGTH: Partial<Record<BodyName, string>> = {
  Sun: 'Identity and direction have a clear channel here.',
  Moon: 'Emotional instinct and self-trust have a strong native rhythm here.',
  Mercury: 'Precision, pattern recognition, and language have a strong channel here.',
  Venus: 'Taste, connection, and social intelligence have a strong channel here.',
  Mars: 'Drive, courage, and follow-through have a strong channel here.',
  Jupiter: 'Perspective, growth, and generosity have a strong channel here.',
  Saturn: 'Discipline, standards, and long-game thinking have a strong channel here.',
};

const ELEMENT_STRENGTH: Record<Element, string> = {
  fire: 'Initiative is one of this chart’s clearest resources: it knows how to begin and create momentum.',
  earth: 'Practical follow-through is one of this chart’s clearest resources: ideas become tangible and durable.',
  air: 'Pattern recognition is one of this chart’s clearest resources: language and perspective keep things moving.',
  water: 'Emotional perception is one of this chart’s clearest resources: it notices the room before the memo.',
};

const MODALITY_STRENGTH: Record<Modality, string> = {
  cardinal: 'Starting is one of this chart’s clearest strengths: it creates movement before consensus arrives.',
  fixed: 'Staying power is one of this chart’s clearest strengths: commitment becomes difficult to dislodge.',
  mutable: 'Adaptability is one of this chart’s clearest strengths: it can change shape without losing the thread.',
};

type ChartBody = Chart['bodies'][number];

function planets(chart: Pick<Chart, 'bodies'>): ChartBody[] {
  return chart.bodies.filter((body) => PLANET_SET.has(body.body));
}

function bodyByName(chart: Pick<Chart, 'bodies'>, body: BodyName): ChartBody | null {
  return chart.bodies.find((candidate) => candidate.body === body) ?? null;
}

function signSlugForBody(chart: Pick<Chart, 'bodies'>, body: BodyName): string | null {
  const placement = bodyByName(chart, body);
  return placement ? signForLongitude(placement.lon).slug : null;
}

function uniqueWinner<T extends string>(counts: Record<T, number>): [T, number] | null {
  const entries = Object.entries(counts) as [T, number][];
  const max = Math.max(...entries.map(([, count]) => count));
  const winners = entries.filter(([, count]) => count === max);
  return winners.length === 1 ? winners[0] : null;
}

function dignitySignature(
  chart: Pick<Chart, 'bodies'>,
  locale: Locale,
): ChartSignature | null {
  const ranked = planets(chart).flatMap((body) => {
    const sign = signForLongitude(body.lon);
    const dignity = dignityFor(body.body, sign.slug);
    if (!dignity || !POSITIVE_DIGNITIES.has(dignity)) return [];
    const dignityRank = dignity === 'exaltation' ? 100 : 60;
    const bodyRank = Math.max(0, PLANET_ORDER.length - PLANET_ORDER.indexOf(body.body));
    return [{ body, sign, dignity, score: dignityRank + bodyRank }];
  }).sort((a, b) => b.score - a.score);
  const winner = ranked[0];
  if (!winner) return null;
  const standing = winner.dignity === 'exaltation'
    ? 'Tradition calls it exalted: an honored-guest placement working with unusual support.'
    : 'Tradition calls it domicile: the planet is in one of its home signs and works with the grain.';
  return {
    kind: 'dignity',
    eyebrow: 'Standout in your chart',
    title: `${winner.body.body} in ${signName(winner.sign, locale)}`,
    summary: `${DIGNITY_STRENGTH[winner.body.body] ?? 'This placement has a strong channel here.'} ${standing}`,
    detail: winner.dignity,
    signSlugs: [winner.sign.slug],
    bodies: [winner.body.body],
  };
}

function aspectSignature(
  chart: Pick<Chart, 'bodies' | 'aspects'>,
): ChartSignature | null {
  const isPositiveConjunction = (aspect: Aspect) => aspect.type === 'conjunction'
    && POSITIVE_CONJUNCTIONS.has([aspect.a, aspect.b].sort().join('|'));
  const supported = chart.aspects
    .filter((aspect) => (aspect.type === 'trine' || aspect.type === 'sextile' || isPositiveConjunction(aspect))
      && aspect.orb <= 2
      && PLANET_SET.has(aspect.a)
      && PLANET_SET.has(aspect.b)
      && (PERSONAL.has(aspect.a) || PERSONAL.has(aspect.b)))
    .sort((a, b) => {
      const luminaryA = a.a === 'Sun' || a.a === 'Moon' || a.b === 'Sun' || a.b === 'Moon';
      const luminaryB = b.a === 'Sun' || b.a === 'Moon' || b.b === 'Sun' || b.b === 'Moon';
      const scoreA = a.orb - (luminaryA ? 1.5 : 0);
      const scoreB = b.orb - (luminaryB ? 1.5 : 0);
      return scoreA - scoreB;
    });
  const winner: Aspect | undefined = supported[0];
  if (!winner) return null;
  const conjunctionKey = [winner.a, winner.b].sort().join('|');
  const [a, b] = winner.type === 'conjunction'
    ? (POSITIVE_CONJUNCTION_ORDER[conjunctionKey] ?? [winner.a, winner.b])
    : [winner.a, winner.b];
  const signSlugs = [
    signSlugForBody(chart, a),
    signSlugForBody(chart, b),
  ].filter((slug): slug is string => slug != null);
  return {
    kind: 'aspect',
    eyebrow: 'Standout in your chart',
    title: `${a} ${winner.type} ${b}`,
    summary: natalAspectLine(a, winner.type, b),
    detail: `${winner.orb.toFixed(1)}° orb`,
    signSlugs: [...new Set(signSlugs)],
    bodies: [a, b],
  };
}

function stelliumSignature(
  chart: Pick<Chart, 'bodies'>,
  locale: Locale,
): ChartSignature | null {
  const groups = new Map<string, ChartBody[]>();
  for (const body of planets(chart)) {
    const slug = signForLongitude(body.lon).slug;
    groups.set(slug, [...(groups.get(slug) ?? []), body]);
  }
  const winner = [...groups.entries()]
    .filter(([, members]) => members.length >= 3)
    .sort((a, b) => b[1].length - a[1].length
      || signForLongitude(a[1][0].lon).house - signForLongitude(b[1][0].lon).house)[0];
  if (!winner) return null;
  const [slug, members] = winner;
  const sign = signForLongitude(members[0].lon);
  return {
    kind: 'stellium',
    eyebrow: 'Standout in your chart',
    title: `${members.length}-planet ${signName(sign, locale)} stellium`,
    summary: `${members.map(({ body }) => body).join(', ')} all sit in ${signName(sign, locale)}. That sign’s agenda gets ${members.length} votes in this chart.`,
    detail: 'Three or more planets concentrated in one sign',
    signSlugs: [slug],
    bodies: members.map(({ body }) => body),
  };
}

function balanceSignature(
  chart: Pick<Chart, 'bodies'>,
  locale: Locale,
): ChartSignature | null {
  const elementCounts: Record<Element, number> = { fire: 0, earth: 0, air: 0, water: 0 };
  const modalityCounts: Record<Modality, number> = { cardinal: 0, fixed: 0, mutable: 0 };
  for (const body of planets(chart)) {
    const sign = signForLongitude(body.lon);
    elementCounts[sign.element] += 1;
    modalityCounts[sign.modality] += 1;
  }
  const element = uniqueWinner(elementCounts);
  if (element && element[1] >= 4) {
    const bodies = planets(chart).filter((body) => signForLongitude(body.lon).element === element[0]);
    return {
      kind: 'element',
      eyebrow: 'Standout in your chart',
      title: `${elementLabel(element[0], locale)} leads the chart`,
      summary: ELEMENT_STRENGTH[element[0]],
      detail: `${element[1]} of 10 planets`,
      signSlugs: [...new Set(bodies.map((body) => signForLongitude(body.lon).slug))].slice(0, 3),
      bodies: bodies.map(({ body }) => body),
    };
  }
  const modality = uniqueWinner(modalityCounts);
  if (modality && modality[1] >= 5) {
    const bodies = planets(chart).filter((body) => signForLongitude(body.lon).modality === modality[0]);
    return {
      kind: 'modality',
      eyebrow: 'Standout in your chart',
      title: `${modalityLabel(modality[0], locale)} energy leads`,
      summary: MODALITY_STRENGTH[modality[0]],
      detail: `${modality[1]} of 10 planets`,
      signSlugs: [...new Set(bodies.map((body) => signForLongitude(body.lon).slug))].slice(0, 3),
      bodies: bodies.map(({ body }) => body),
    };
  }
  return null;
}

function bigThreeSignature(
  chart: Pick<Chart, 'bodies' | 'angles' | 'moonSignCandidates'>,
  locale: Locale,
): ChartSignature {
  const rows = [
    { body: 'Sun' as const, placement: bodyByName(chart, 'Sun'), suffix: 'Sun' },
    { body: 'Moon' as const, placement: bodyByName(chart, 'Moon'), suffix: 'Moon' },
  ];
  const uncertainMoon = moonIsUncertain(chart);
  const titles = rows.flatMap(({ placement, suffix }) => placement
    ? [`${suffix === 'Moon' ? moonLabel(chart, locale) : signName(signForLongitude(placement.lon), locale)} ${suffix}`]
    : []);
  const slugs = rows.flatMap(({ placement, body }) => placement
    ? body === 'Moon' ? [...moonCandidates(chart)] : [signForLongitude(placement.lon).slug]
    : []);
  const bodies: BodyName[] = rows.flatMap(({ placement, body }) => placement ? [body] : []);
  if (chart.angles) {
    const rising = signForLongitude(chart.angles.asc);
    titles.push(`${signName(rising, locale)} Rising`);
    slugs.push(rising.slug);
  }
  return {
    kind: 'big-three',
    eyebrow: 'Standout in your chart',
    title: titles.join(' · ') || 'A chart all its own',
    summary: 'Your core direction, emotional needs, and first impression form a chart fingerprint no single Sun-sign label can explain.',
    detail: uncertainMoon
      ? chart.angles ? 'Moon sign needs a birth time' : 'Moon sign and Rising need a birth time'
      : chart.angles ? 'Your Big Three' : 'Sun and Moon · Rising needs a birth time',
    signSlugs: [...new Set(slugs)],
    bodies,
  };
}

/**
 * Pick one positive, evidence-backed signature without consulting birth input.
 * Priority is deterministic and never calls a pattern rare without population
 * data: tight flowing (or explicitly curated positive conjunction) aspect,
 * supported dignity, stellium, clear balance, then an honest Big Three fallback.
 */
export function chartSignature(
  chart: Pick<Chart, 'bodies' | 'angles' | 'aspects' | 'moonSignCandidates'>,
  locale: Locale = 'en',
): ChartSignature {
  const uncertainMoon = moonIsUncertain(chart);
  const settled = uncertainMoon ? {
    ...chart,
    bodies: chart.bodies.filter((body) => body.body !== 'Moon'),
    aspects: chart.aspects.filter((aspect) => aspect.a !== 'Moon' && aspect.b !== 'Moon'),
  } : chart;
  return aspectSignature(settled)
    ?? dignitySignature(settled, locale)
    ?? stelliumSignature(settled, locale)
    ?? (uncertainMoon ? null : balanceSignature(chart, locale))
    ?? bigThreeSignature(chart, locale);
}
