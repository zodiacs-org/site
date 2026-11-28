/**
 * An empty chart wheel, drawn in code for the profile's "no saved chart yet"
 * panel (owner-chosen 2026-11-28, option S-D). The sign ring follows the
 * site's chart wheel (src/lib/wheel/Wheel.tsx): Aries begins at the left,
 * the signs run counterclockwise in their own hues, hairline ring edges and
 * sign boundaries. Inside, three dashed places wait for planets.
 *
 * Decoration only: hidden from assistive technology, no words. The geometry
 * is computed once when the module loads, so the island carries static
 * markup and nothing of the wheel's code. Motion lives in
 * src/styles/panel-figures.css (the ring turns once in 140 s and the places
 * breathe) and stops under prefers-reduced-motion. The box's size comes
 * from the page's stylesheet, so the panel holds its shape before anything
 * draws.
 */
import { SIGNS } from '../../lib/signs';
import '../../styles/panel-figures.css';

/** The ring's outer edge; the viewBox leaves a margin around it. */
const R_RING = 96;
const R_RING_IN = 88;
const R_BODIES_OUT = 64;
const R_HUB = 30;
const R_PLACES = 47;

/** Ecliptic longitude to a point, Aries 0° at the left, counterclockwise. */
function point(longitude: number, radius: number): [number, number] {
  const angle = (longitude * Math.PI) / 180;
  return [-radius * Math.cos(angle), radius * Math.sin(angle)];
}

const fixed = (value: number) => (Math.abs(value) < 0.005 ? '0' : value.toFixed(2));

function arc(from: number, to: number, radius: number): string {
  const [x0, y0] = point(from, radius);
  const [x1, y1] = point(to, radius);
  return `M${fixed(x0)} ${fixed(y0)}A${radius} ${radius} 0 0 0 ${fixed(x1)} ${fixed(y1)}`;
}

const RING_RADIUS = (R_RING + R_RING_IN) / 2 + 1;
const SEGMENTS = SIGNS.map((sign, index) => ({
  hue: sign.hue,
  d: arc(index * 30 + 1.6, index * 30 + 28.4, RING_RADIUS),
}));

/** Every 5°, inward from the ring; every 30° (a sign boundary) runs longer. */
const TICKS = Array.from({ length: 72 }, (_, index) => {
  const longitude = index * 5;
  const [x0, y0] = point(longitude, R_RING_IN);
  const [x1, y1] = point(longitude, R_RING_IN - (index % 6 === 0 ? 8 : 4));
  return `M${fixed(x0)} ${fixed(y0)}L${fixed(x1)} ${fixed(y1)}`;
}).join('');

const PLACES = [128, 250, 352].map((longitude) => point(longitude, R_PLACES));

export default function EmptyChartWheel({ class: className }: { class?: string }) {
  return (
    <span class={className ? `pf-figure ${className}` : 'pf-figure'} aria-hidden="true" data-figure="empty-chart-wheel">
      <svg class="zf zf-wheel" viewBox="-110 -110 220 220" preserveAspectRatio="xMidYMid meet" focusable="false">
        <g class="zf-wheel__ring">
          <circle r={R_RING + 2} fill="none" stroke="none" />
          {SEGMENTS.map(({ hue, d }) => (
            <path key={hue} d={d} fill="none" stroke={hue} stroke-width={R_RING - R_RING_IN - 1} />
          ))}
          <path class="zf-tick" d={TICKS} fill="none" />
        </g>
        <circle class="zf-hair" r={R_RING_IN} fill="none" />
        <circle class="zf-hair" r={R_BODIES_OUT} fill="none" />
        <circle class="zf-hair zf-hair--faint" r={R_HUB} fill="none" />
        {PLACES.map(([x, y], index) => (
          <circle key={index} class={`zf-place zf-place--${index}`} cx={fixed(x)} cy={fixed(y)} r="7.5" fill="none" />
        ))}
      </svg>
    </span>
  );
}
