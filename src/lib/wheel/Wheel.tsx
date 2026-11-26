/**
 * The chart wheel — hand-built SVG, shared by the calculator, the homepage
 * demo chart, and the share-card renderer. Standard orientation: the
 * Ascendant sits at the left (9 o'clock) and the zodiac runs
 * counterclockwise. Without known angles it renders 0° Aries on the left
 * with no house spokes.
 *
 * Two personalities, one component:
 *  - Legacy/static (share card, demo): pass bodies/asc/mc/cusps/aspects and
 *    nothing else. The rendered markup is pinned byte-for-byte by
 *    wheel-serialization.test.ts — every previously shared card depends on
 *    it staying identical.
 *  - Interactive (Chart Explorer): additionally pass `interactive` with the
 *    scene model, selection, emphasis, and onSelect. Marks become hit
 *    targets (data-entity), chords weight by orb and dash when separating,
 *    and everything not selected dims to the emphasis floor.
 */
import { Fragment, type ComponentChildren } from 'preact';
import { SIGNS } from '../signs';
import { PLANET_GLYPH } from '../glyphs/paths';
import type { BodyName } from '../engine/types';
import type { ChartSceneModel, EntityRef, SceneEmphasis, SignSlug } from '../scene/types';
import { entityId } from '../scene/types';
import { collisionNudge } from '../scene/layout';
import { emphasisOpacity } from '../scene/emphasis';
import { bodyLeaderPath } from './body-leader';

/**
 * Geometry handed to an overlay slot so a second ring (transits, synastry)
 * can position marks in the same frame as the natal wheel WITHOUT its
 * rendering code landing in the shared Wheel chunk — the overlay renderer
 * lives in the caller's (lazy) chunk and receives these primitives.
 */
export interface WheelGeometry {
  cx: number;
  cy: number;
  size: number;
  /** Rotation anchor longitude (matches the natal wheel). */
  anchor: number;
  rSigns: number;
  rSignsIn: number;
  rBodies: number;
  rAspects: number;
  rOuter: number;
  rOuterSeat: number;
  /** Ecliptic longitude → SVG point at radius r. */
  pt: (lon: number, r: number) => { x: number; y: number };
}

export interface WheelBody {
  body: string;
  lon: number;
  retrograde?: boolean;
}

export interface WheelInteraction {
  scene: ChartSceneModel;
  selection: EntityRef | null;
  emphasis: SceneEmphasis;
  onSelect: (e: EntityRef | null) => void;
  /** Accessible name for the interactive group (localized by the caller). */
  label: string;
  /** One-shot visual arrival cue used by Reading Path actions. */
  spotlight?: {
    id: string;
    run: number;
    phase: 'primed' | 'settled';
    motion: 'animated' | 'instant';
  } | null;
}

export interface WheelProps {
  bodies: WheelBody[];
  asc?: number | null;
  mc?: number | null;
  cusps?: number[] | null;
  aspects?: { a: string; b: string; type: string }[];
  size?: number;
  /** Stage the first result, or use the short whole-wheel entrance. */
  animate?: boolean | 'fade';
  /** Server-rendered homepage layer hooks; omitted everywhere else. */
  preview?: boolean;
  /**
   * Serve the sign-disc <image> hrefs as data-href so the SSR'd wheel
   * fetches nothing at page load; the embedding page promotes them as the
   * wheel nears the viewport. SVG <image> has no working lazy-load in
   * Chromium, and the homepage demo sits below the fold — without this,
   * every homepage view pays twelve icon fetches during the hero paint.
   * The share card and the live calculator keep the default eager hrefs.
   */
  deferIcons?: boolean;
  /** Chart Explorer mode — omit for the pinned static rendering. */
  interactive?: WheelInteraction;
  /**
   * A second, outer ring drawn around this (natal) wheel — the transiting
   * sky (later, a synastry partner). Purely additive: when omitted, every
   * pixel is identical to the pinned static/interactive rendering. When
   * present the viewBox grows to seat the outer ring and this slot renders
   * after the natal marks, given the wheel's geometry. The overlay's own
   * rendering lives in the caller's chunk, so it never weighs on the shared
   * Wheel bundle (the homepage demo, the share card, the birth chart).
   */
  renderOverlay?: (geo: WheelGeometry) => ComponentChildren;
  /** Caller-specific accessible name; the historical default is unchanged. */
  ariaLabel?: string;
}


const ASPECT_COLOR: Record<string, string> = {
  conjunction: 'rgba(238,241,247,0.5)',
  sextile: 'rgba(169,212,196,0.55)',
  trine: 'rgba(182,212,228,0.6)',
  square: 'rgba(222,142,121,0.6)',
  opposition: 'rgba(224,169,180,0.6)',
};

const ASPECT_FOCUS_COLOR: Record<string, string> = {
  conjunction: 'rgba(238,241,247,0.92)',
  sextile: 'rgba(169,212,196,0.92)',
  trine: 'rgba(182,212,228,0.94)',
  square: 'rgba(222,142,121,0.94)',
  opposition: 'rgba(224,169,180,0.94)',
};

/** Orb-weight class → chord stroke width (interactive mode only). */
const ASPECT_STROKE = [0.9, 1.3, 1.8] as const;

/**
 * The wheel's frame: its centre, its ring radii, and longitude → point, for
 * a wheel of `size` turned so `anchor` sits at 9 o'clock. Wheel draws with
 * it, so anything laid over a rendered wheel (the horoscope pages' entrance
 * veil) can take the same numbers instead of copying them.
 */
export function wheelFrame(size: number, anchor: number) {
  const cx = size / 2;
  const cy = size / 2;
  /** Ecliptic longitude → SVG point at radius r. */
  const pt = (lon: number, r: number) => {
    const phi = ((180 + (lon - anchor)) * Math.PI) / 180;
    return { x: cx + r * Math.cos(phi), y: cy - r * Math.sin(phi) };
  };
  return {
    cx,
    cy,
    rSigns: size * 0.475,      // outer edge of sign ring
    rSignsIn: size * 0.395,    // inner edge of sign ring
    rBodies: size * 0.31,      // planet markers
    rAspects: size * 0.235,    // aspect hub
    /** Planet marker radius. */
    rMarker: size * 0.033,
    /** The padding round the wheel in its viewBox (without an overlay ring). */
    pad: size * 0.05,
    pt,
  };
}

export default function Wheel({
  bodies, asc = null, mc = null, cusps = null, aspects = [], size = 420, animate = false,
  interactive, preview = false, deferIcons = false, renderOverlay, ariaLabel = 'Birth chart wheel',
}: WheelProps) {
  const anchor = interactive ? interactive.scene.anchor.lon : (asc ?? 0);
  const { cx, cy, rSigns, rSignsIn, rBodies, rAspects, rMarker, pt } = wheelFrame(size, anchor);

  const ix = interactive ?? null;
  const opacityOf = (id: string) => (ix ? emphasisOpacity(ix.emphasis, id) : 1);
  const toggleSelect = (e: EntityRef) => {
    ix?.onSelect(ix.selection && entityId(ix.selection) === entityId(e) ? null : e);
  };
  const select = (e: EntityRef) => (ev: Event) => {
    ev.stopPropagation();
    toggleSelect(e);
  };
  /** Test/styling marker for an entity's visible mark (interactive only). */
  const mark = (e: EntityRef) => (ix ? {
    'data-entity': entityId(e),
    'data-selected': ix.selection && entityId(ix.selection) === entityId(e) ? 'true' : undefined,
  } : {});
  const selectedId = ix?.selection ? entityId(ix.selection) : null;
  const isSelected = (id: string) => selectedId === id;
  const isSpotlight = (id: string) => ix?.spotlight?.id === id;
  const spotlightKey = (id: string) => `${id}:${isSpotlight(id) ? ix?.spotlight?.run ?? 0 : 'stable'}`;
  const spotlightMark = (id: string, kind: EntityRef['kind']) => ({
    class: `wheel__focus-mark${isSpotlight(id) ? ' wheel__focus-mark--arrival' : ''}`,
    'data-spotlight-target': isSpotlight(id) ? id : undefined,
    'data-spotlight-kind': isSpotlight(id) ? kind : undefined,
  });

  /**
   * One geometric hit test for the whole wheel (interactive mode). Marks on
   * a fanned wheel sit closer together than any honest touch target, so
   * per-mark invisible circles steal each other's taps; instead the svg
   * resolves every click by radius band, then angle:
   *   sign ring        → the sign segment
   *   planet band      → the nearest body within 10° (else the house there)
   *   inner wedge band → the house at that longitude
   *   aspect hub       → the chords' own wide hit-strokes (they stopPropagation)
   *   anywhere else    → clear
   */
  const resolveClick = ix ? (ev: MouseEvent) => {
    const svg = ev.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const scale = (size + pad * 2) / rect.width;
    const x = (ev.clientX - rect.left) * scale - pad;
    const y = (ev.clientY - rect.top) * scale - pad;
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    const phi = (Math.atan2(-dy, dx) * 180) / Math.PI;
    const lon = ((anchor + phi - 180) % 360 + 360) % 360;

    const houseAt = (l: number) => ix.scene.houses?.find((hs) => {
      const into = ((l - hs.cuspLon) % 360 + 360) % 360;
      return into < hs.spanDeg;
    });

    if (r >= rSignsIn && r <= rSigns + 2) {
      toggleSelect({ kind: 'sign', sign: ix.scene.signs[Math.floor(lon / 30)].slug });
      return;
    }
    if (Math.abs(r - rBodies) <= size * 0.055) {
      let best: { body: BodyName; dist: number } | null = null;
      for (const b of ix.scene.bodies) {
        const d = Math.abs((((b.drawLon - lon) % 360) + 540) % 360 - 180);
        if (!best || d < best.dist) best = { body: b.body, dist: d };
      }
      if (best && best.dist <= 10) {
        toggleSelect({ kind: 'body', body: best.body });
        return;
      }
      const hs = cusps ? houseAt(lon) : undefined;
      if (hs) { toggleSelect({ kind: 'house', house: hs.index }); return; }
      ix.onSelect(null);
      return;
    }
    if (r > rAspects + 2 && r < rSignsIn && cusps) {
      const hs = houseAt(lon);
      if (hs) { toggleSelect({ kind: 'house', house: hs.index }); return; }
    }
    ix.onSelect(null);
  } : undefined;

  const arcPath = (from: number, to: number, r: number) => {
    const a = pt(from, r);
    const b = pt(to, r);
    // 30° segments only — always the small arc, sweep flips for the
    // counterclockwise zodiac (SVG sweep=0 is counterclockwise in this
    // y-down coordinate system when angles increase).
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 0 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  };

  /** An interactive-only annular wedge, used to make a selected house legible. */
  const annularSectorPath = (from: number, span: number, inner: number, outer: number) => {
    const safeSpan = Math.max(0.1, Math.min(359.9, span));
    const to = from + safeSpan;
    const outerA = pt(from, outer);
    const outerB = pt(to, outer);
    const innerB = pt(to, inner);
    const innerA = pt(from, inner);
    const large = safeSpan > 180 ? 1 : 0;
    return [
      `M ${outerA.x.toFixed(2)} ${outerA.y.toFixed(2)}`,
      `A ${outer} ${outer} 0 ${large} 0 ${outerB.x.toFixed(2)} ${outerB.y.toFixed(2)}`,
      `L ${innerB.x.toFixed(2)} ${innerB.y.toFixed(2)}`,
      `A ${inner} ${inner} 0 ${large} 1 ${innerA.x.toFixed(2)} ${innerA.y.toFixed(2)}`,
      'Z',
    ].join(' ');
  };

  // Interactive drawing and hit-testing use the scene's spaced markers.
  // The static/share path retains its pinned historical layout.
  const drawLon = ix
    ? new Map(ix.scene.bodies.map((b) => [b.body, b.drawLon]))
    : collisionNudge(bodies);

  // Overlay chord hit strokes are painted above natal markers. A tap inside
  // a visible natal circle belongs to that body, even where a chord ends.
  // Outside those circles the overlay keeps its own native hit targets.
  const captureMarkerClick = ix && renderOverlay ? (ev: MouseEvent) => {
    const svg = ev.currentTarget as SVGSVGElement;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(matrix.inverse());
    for (const body of ix.scene.bodies) {
      const marker = pt(body.drawLon, rBodies);
      if (Math.hypot(point.x - marker.x, point.y - marker.y) <= size * 0.033) {
        ev.stopPropagation();
        toggleSelect({ kind: 'body', body: body.body });
        return;
      }
    }
  } : undefined;

  // Padding keeps the ASC/MC labels inside the viewBox; with an overlay
  // ring it grows to seat the outer ring. Non-overlay padding is unchanged,
  // so the pinned share-card viewBox never shifts.
  const pad = size * (renderOverlay ? 0.115 : 0.05);

  // House-number placement: interactive mode fixes the wedge-midpoint defect
  // (the number belongs at cusp + span/2 — under Placidus at high latitude a
  // wedge can be far narrower than 30°, and the old cusp+15° put the numeral
  // in the neighbouring house). The static path keeps the historical
  // cusp+15° so pinned share-card output never shifts.
  const houseMid = (lon: number, i: number) =>
    ix?.scene.houses ? ix.scene.houses[i].midLon : lon + 15;

  // Rank the actual longitudes without changing SVG paint or hit-test order.
  const staged = animate === true;
  const Layer = staged ? 'g' : Fragment;
  const revealOrder = staged ? [...bodies].sort((a, b) =>
    Number(b.body === 'Sun') - Number(a.body === 'Sun') || a.lon - b.lon
  ) : null;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`}
      width="100%"
      // Interactive mode: the wrapping wheelbox carries the group role and
      // label; hiding the SVG from AT avoids double-announcing it, and the
      // placements table remains the canonical accessible structure.
      role={ix ? undefined : 'img'}
      aria-hidden={ix ? 'true' : undefined}
      aria-label={ix ? undefined : ariaLabel}
      class={[
        animate ? 'wheel wheel--animate' : 'wheel',
        staged ? 'wheel--settle' : '',
        ix ? 'wheel--interactive' : '',
      ].filter(Boolean).join(' ')}
      onClick={resolveClick}
      onClickCapture={captureMarkerClick}
    >
      <Layer class={staged ? 'wheel__sign-ring' : undefined}>
        {/* Ring backgrounds */}
        <circle cx={cx} cy={cy} r={rSigns} fill="none" stroke="rgba(198,204,218,0.16)" stroke-width="1" />
        <circle cx={cx} cy={cy} r={rSignsIn} fill="none" stroke="rgba(198,204,218,0.16)" stroke-width="1" />
        <circle cx={cx} cy={cy} r={rAspects} fill="none" stroke="rgba(198,204,218,0.08)" stroke-width="1" />

        {/* Sign ring: pastel arcs + the pastel disc icons (the same icon set
            as the homepage wheel). The disc <image> refs stay external for the
            live wheel; the share-card renderer inlines them as data URIs before
            rasterizing, so the serialized SVG is self-contained. */}
        {SIGNS.map((s, i) => {
          const from = i * 30;
          const mid = from + 15;
          const c = pt(mid, (rSigns + rSignsIn) / 2);
          const disc = size * 0.068;
          const signRef: EntityRef = { kind: 'sign', sign: s.slug as SignSlug };
          const signId = entityId(signRef);
          return (
            <g key={s.slug} {...(ix ? { opacity: opacityOf(`sign:${s.slug}`), ...mark(signRef) } : {})}>
              <path
                d={arcPath(from + 1.5, from + 28.5, (rSigns + rSignsIn) / 2)}
                fill="none"
                stroke={s.hue}
                stroke-opacity="0.12"
                stroke-width={rSigns - rSignsIn - 6}
              />
              <path
                d={arcPath(from + 1.5, from + 28.5, rSigns - 1)}
                fill="none"
                stroke={s.hue}
                stroke-opacity="0.8"
                stroke-width="2"
                stroke-linecap="round"
              />
              <image
                {...(deferIcons
                  ? { 'data-href': `/assets/zodiac-icons/128/${s.slug}.webp` }
                  : { href: `/assets/zodiac-icons/128/${s.slug}.webp` })}
                x={(c.x - disc / 2).toFixed(2)}
                y={(c.y - disc / 2).toFixed(2)}
                width={disc.toFixed(2)}
                height={disc.toFixed(2)}
              >
                <title>{s.name}</title>
              </image>
              {isSelected(signId) && (
                <g key={spotlightKey(signId)} {...spotlightMark(signId, 'sign')}>
                  <path
                    d={arcPath(from + 2, from + 28, rSigns - size * 0.012)}
                    fill="none"
                    stroke={s.hue}
                    stroke-opacity="0.95"
                    stroke-width={size * 0.011}
                    stroke-linecap="round"
                    pointer-events="none"
                  />
                </g>
              )}
            </g>
          );
        })}

        {/* Sign boundaries */}
        {SIGNS.map((_, i) => {
          const a = pt(i * 30, rSignsIn);
          const b = pt(i * 30, rSigns);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(198,204,218,0.22)" stroke-width="1" />;
        })}
      </Layer>

      {/* House cusps */}
      {cusps?.map((lon, i) => {
        const a = pt(lon, rAspects);
        const b = pt(lon, rSignsIn);
        const isAngle = i === 0 || i === 3 || i === 6 || i === 9;
        const num = pt(houseMid(lon, i), (rAspects + rBodies) / 2 - size * 0.02);
        const houseRef: EntityRef = { kind: 'house', house: i + 1 };
        const houseId = entityId(houseRef);
        const sceneHouse = ix?.scene.houses?.[i];
        return (
          <g key={i} class={preview ? 'wheel__house' : undefined} {...(ix ? { opacity: opacityOf(`house:${i + 1}`), ...mark(houseRef) } : {})}>
            {isSelected(houseId) && sceneHouse && (
              <g key={spotlightKey(houseId)} {...spotlightMark(houseId, 'house')}>
                <path
                  d={annularSectorPath(
                    sceneHouse.cuspLon + 0.6,
                    Math.max(0.1, sceneHouse.spanDeg - 1.2),
                    rAspects + size * 0.012,
                    rSignsIn - size * 0.012,
                  )}
                  class="wheel__focus-house"
                  pointer-events="none"
                />
              </g>
            )}
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={isAngle ? 'rgba(238,241,247,0.4)' : 'rgba(198,204,218,0.14)'}
              stroke-width={isAngle ? 1.4 : 1}
            />
            <text x={num.x} y={num.y} text-anchor="middle" dominant-baseline="central" font-size={size * 0.021} fill="rgba(95,103,121,0.9)">
              {i + 1}
            </text>
          </g>
        );
      })}

      {/* ASC / MC labels */}
      {asc !== null && (() => {
        const p = pt(asc, rSigns + size * 0.012);
        if (!ix) return (
          <text x={p.x - size * 0.012} y={p.y} text-anchor="end" dominant-baseline="central" font-size={size * 0.026} fill="rgba(238,241,247,0.75)" font-family="var(--font-mono)">ASC</text>
        );
        const ref: EntityRef = { kind: 'angle', angle: 'asc' };
        const id = entityId(ref);
        const axisStart = pt(asc, rAspects);
        const axisEnd = pt(asc, rSigns + size * 0.006);
        return (
          <g {...mark(ref)} onClick={select(ref)} class="wheel__hit" opacity={opacityOf(id)}>
            {isSelected(id) && (
              <g key={spotlightKey(id)} {...spotlightMark(id, 'angle')}>
                <line
                  x1={axisStart.x} y1={axisStart.y} x2={axisEnd.x} y2={axisEnd.y}
                  class="wheel__focus-angle"
                  pointer-events="none"
                />
                <circle
                  cx={p.x - size * 0.02} cy={p.y} r={size * 0.034}
                  class="wheel__focus-angle-node"
                  pointer-events="none"
                />
              </g>
            )}
            <text x={p.x - size * 0.012} y={p.y} text-anchor="end" dominant-baseline="central" font-size={size * 0.026} fill="rgba(238,241,247,0.75)" font-family="var(--font-mono)">ASC</text>
          </g>
        );
      })()}
      {mc !== null && mc !== undefined && (() => {
        const p = pt(mc, rSigns + size * 0.028);
        if (!ix) return (
          <text x={p.x} y={p.y} text-anchor="middle" dominant-baseline="central" font-size={size * 0.026} fill="rgba(238,241,247,0.6)" font-family="var(--font-mono)">MC</text>
        );
        const ref: EntityRef = { kind: 'angle', angle: 'mc' };
        const id = entityId(ref);
        const axisStart = pt(mc, rAspects);
        const axisEnd = pt(mc, rSigns + size * 0.012);
        return (
          <g {...mark(ref)} onClick={select(ref)} class="wheel__hit" opacity={opacityOf(id)}>
            {isSelected(id) && (
              <g key={spotlightKey(id)} {...spotlightMark(id, 'angle')}>
                <line
                  x1={axisStart.x} y1={axisStart.y} x2={axisEnd.x} y2={axisEnd.y}
                  class="wheel__focus-angle"
                  pointer-events="none"
                />
                <circle
                  cx={p.x} cy={p.y - size * 0.006} r={size * 0.034}
                  class="wheel__focus-angle-node"
                  pointer-events="none"
                />
              </g>
            )}
            <text x={p.x} y={p.y} text-anchor="middle" dominant-baseline="central" font-size={size * 0.026} fill="rgba(238,241,247,0.6)" font-family="var(--font-mono)">MC</text>
          </g>
        );
      })()}

      <Layer class={staged ? 'wheel__aspect-lines' : undefined}>
        {/* Aspect lines */}
        {aspects.map((a, i) => {
          const A = bodies.find((b) => b.body === a.a);
          const B = bodies.find((b) => b.body === a.b);
          if (!A || !B) return null;
          const p1 = pt(A.lon, rAspects);
          const p2 = pt(B.lon, rAspects);
          if (!ix) {
            return (
              <line
                key={i}
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={ASPECT_COLOR[a.type] ?? 'rgba(198,204,218,0.3)'}
                stroke-width="1"
                class={preview ? 'wheel__aspect' : undefined}
              />
            );
          }
          const sceneAspect = ix.scene.aspects.find((sa) => sa.a === a.a && sa.b === a.b && sa.type === a.type);
          const aspectRef: EntityRef = { kind: 'aspect', a: a.a as any, b: a.b as any, type: a.type as any };
          const id = entityId(aspectRef);
          return (
            <g key={i} opacity={opacityOf(id)} {...mark(aspectRef)}>
              <line
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={ASPECT_COLOR[a.type] ?? 'rgba(198,204,218,0.3)'}
                stroke-width={ASPECT_STROKE[sceneAspect?.weight ?? 0]}
                stroke-dasharray={sceneAspect && !sceneAspect.applying ? '3 3' : undefined}
                pointer-events="none"
              />
              {isSelected(id) && (
                <g key={spotlightKey(id)} {...spotlightMark(id, 'aspect')}>
                  <line
                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke={ASPECT_FOCUS_COLOR[a.type] ?? 'rgba(238,241,247,0.9)'}
                    stroke-width={ASPECT_STROKE[sceneAspect?.weight ?? 0] + 2.2}
                    stroke-linecap="round"
                    class="wheel__focus-aspect"
                    pointer-events="none"
                  />
                  <circle cx={p1.x} cy={p1.y} r={size * 0.018} class="wheel__focus-aspect-node" pointer-events="none" />
                  <circle cx={p2.x} cy={p2.y} r={size * 0.018} class="wheel__focus-aspect-node" pointer-events="none" />
                </g>
              )}
              {/* Wide invisible twin makes the 1px chord tappable. */}
              <line
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke="transparent"
                stroke-width={size * 0.028}
                onClick={select(aspectRef)}
                class="wheel__hit"
              />
            </g>
          );
        })}
      </Layer>

      {/* Bodies */}
      {bodies.map((b) => {
        const lonDraw = drawLon.get(b.body) ?? b.lon;
        const p = pt(lonDraw, rBodies);
        const tick1 = pt(b.lon, rSignsIn);
        const tick2 = pt(b.lon, rSignsIn - size * 0.014);
        const sign = SIGNS[Math.floor(((b.lon % 360) + 360) % 360 / 30)];
        const bodyRef: EntityRef = { kind: 'body', body: b.body as any };
        const id = `body:${b.body}`;
        const selected = ix?.selection && entityId(ix.selection) === id;
        const leader = ix ? bodyLeaderPath(b.lon, lonDraw, rSignsIn - size * 0.014, rBodies + size * 0.033, pt) : null;
        const insetRx = ix && b.retrograde;
        const glyphSize = size * (insetRx ? 0.042 : 0.05);
        return (
          <g
            key={b.body}
            class={preview ? 'wheel__body wheel__planet' : 'wheel__body'}
            style={revealOrder ? `--i:${revealOrder.indexOf(b)}` : undefined}
            data-preview-body={preview ? b.body : undefined}
            {...(ix ? { opacity: opacityOf(id), ...mark(bodyRef) } : {})}
          >
            <line x1={tick1.x} y1={tick1.y} x2={tick2.x} y2={tick2.y} stroke={sign.hue} stroke-width="1.4" />
            {leader && <path data-body-leader={b.body} d={leader} fill="none" stroke={sign.hue} stroke-opacity="0.6" stroke-width="1" pointer-events="none" />}
            {selected && (
              <g key={spotlightKey(id)} {...spotlightMark(id, 'body')}>
                <circle
                  cx={p.x} cy={p.y} r={size * 0.055}
                  fill={sign.hue} fill-opacity="0.12"
                  stroke="none"
                  class="wheel__focus-body-halo"
                  pointer-events="none"
                />
                <circle
                  cx={p.x} cy={p.y} r={size * 0.044}
                  fill="none" stroke={sign.hue} stroke-width="1.8"
                  class="wheel__sel-ring"
                  pointer-events="none"
                />
              </g>
            )}
            <circle data-body-marker={ix ? b.body : undefined} cx={p.x} cy={p.y} r={rMarker} fill="rgba(15,18,26,0.92)" stroke={sign.hue} stroke-opacity="0.55" stroke-width="1" />
            <g
              data-body-glyph={ix ? b.body : undefined}
              transform={`translate(${p.x} ${insetRx ? p.y - size * 0.011 : p.y}) scale(${glyphSize / 24}) translate(-12 -12)`}
              fill="none"
              stroke="#EEF1F7"
              stroke-width={1.4 * 24 / glyphSize}
              stroke-linecap="round"
              stroke-linejoin="round"
              style="color:#EEF1F7"
              dangerouslySetInnerHTML={{ __html: PLANET_GLYPH[b.body] ?? '' }}
            />
            {b.retrograde && (
              <text data-body-retrograde={ix ? b.body : undefined} x={insetRx ? p.x : p.x + size * 0.032} y={p.y + size * (insetRx ? 0.022 : 0.028)} text-anchor="middle" font-size={size * (insetRx ? 0.015 : 0.017)} fill={ix ? sign.hue : 'rgba(224,176,128,0.9)'} font-family="var(--font-mono)">Rx</text>
            )}
          </g>
        );
      })}

      {/* Overlay slot — the outer ring (transits / synastry). Additive: with
          no renderOverlay the markup is byte-identical to the pinned wheel.
          The renderer lives in the caller's chunk (given the geometry), so
          none of its weight lands on the shared Wheel bundle. */}
      {renderOverlay?.({
        cx, cy, size, anchor, rSigns, rSignsIn, rBodies, rAspects,
        rOuter: size * 0.55, rOuterSeat: size * 0.5, pt,
      })}
    </svg>
  );
}
