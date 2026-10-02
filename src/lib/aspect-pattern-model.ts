import { patternContainment } from '@zodiacs/engine/techniques';
import { detectAspectPatterns, type AspectPattern, type PatternBody, type PatternDetection, type PatternEdgeInput, type PatternPoint } from './engine/aspect-patterns';
import { patternReading, PATTERN_NAMES } from '../islands/aspect-patterns/copy';

export interface AspectPatternInput {
  context: 'natal' | 'composite';
  points: readonly PatternPoint[];
  aspects: readonly PatternEdgeInput[];
  /** Explicit completed-source certainty; Moon sign stability is not enough. */
  timeKnown: boolean;
  sourceKey: string;
}
export interface AspectPatternModel {
  identity: string;
  context: 'natal' | 'composite';
  timeKnown: boolean;
  detection: PatternDetection;
  roots: readonly AspectPattern[];
  included: Readonly<Record<string, readonly AspectPattern[]>>;
  scope: string;
  absence: string;
}
export interface SelectedPatternCard {
  readonly identity: string;
  readonly context: 'natal' | 'composite';
  readonly locale: 'en';
  readonly pattern: AspectPattern;
  readonly points: readonly { body: PatternBody; lon: number }[];
  readonly title: string;
  readonly scope: string;
  readonly reading: string;
  readonly receipt: readonly string[];
}

/**
 * Which patterns lie inside which: @zodiacs/engine's, sorted by size, kind and
 * then id in code-unit order (the site sorted ids with localeCompare, which no
 * body name makes differ).
 */
export { patternContainment };

export function buildAspectPatternModel(input: AspectPatternInput): AspectPatternModel {
  const points = input.points.filter((p) => input.timeKnown || p.body !== 'Moon');
  const aspects = input.aspects.filter((e) => input.timeKnown || (e.a !== 'Moon' && e.b !== 'Moon'));
  const detection = detectAspectPatterns(points, aspects);
  const containment = patternContainment(detection.status === 'ready' ? detection.patterns : []);
  const reference = input.context === 'natal'
    ? 'At the reference positions; birth time unknown; Moon excluded.'
    : 'At the reference midpoint positions; one or both birth times unknown; Moon excluded.';
  const scope = input.timeKnown
    ? input.context === 'natal' ? 'Sun–Pluto only. Nodes, angles and houses are excluded.'
      : 'Sun–Pluto midpoint positions only. This is a relationship model, not an event chart.'
    : `${reference} These patterns have not been checked across the whole birth day.`;
  return {
    identity: JSON.stringify([input.context, input.sourceKey, input.timeKnown, input.points, input.aspects, 'en']),
    context: input.context, timeKnown: input.timeKnown, detection, ...containment, scope,
    absence: input.timeKnown ? 'No grand trine, T-square, grand cross or kite among the included positions at the stated orb limits.'
      : 'No patterns among the included reference positions. An unknown-time Moon could form another pattern.',
  };
}

/** Lossless degree values keep boundary receipts distinct; qualification is never rounded. */
export const patternDegrees = (value: number): string => `${value}°`;
export const patternEdgeReceipt = (edge: AspectPattern['edges'][number]): string =>
  `${edge.a} ${edge.type} ${edge.b} · orb ${patternDegrees(edge.orb)} · limit ${edge.limit}°`;

/** Snapshot without names, birth details, locations or reconstructable source keys. */
export function selectedPatternCard(model: AspectPatternModel, id: string): SelectedPatternCard | null {
  if (!model.timeKnown || model.detection.status !== 'ready') return null;
  const pattern = model.detection.patterns.find((p) => p.id === id);
  if (!pattern) return null;
  const copy = JSON.parse(JSON.stringify(pattern)) as AspectPattern;
  for (const edge of copy.edges) { Object.freeze(edge.sourceIds); Object.freeze(edge); }
  Object.freeze(copy.edges); Object.freeze(copy.members); Object.freeze(copy.oppositions);
  if (copy.triangle) Object.freeze(copy.triangle);
  Object.freeze(copy);
  return Object.freeze({
    identity: `${model.identity}:${id}`, context: model.context, locale: 'en', pattern: copy,
    points: Object.freeze(model.detection.points.filter((p) => pattern.members.includes(p.body)).map((p) => Object.freeze({ ...p }))),
    title: PATTERN_NAMES[pattern.kind], scope: model.scope, reading: patternReading(pattern, model.context),
    receipt: Object.freeze(pattern.edges.map(patternEdgeReceipt)),
  });
}
