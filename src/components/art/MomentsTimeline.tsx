/**
 * A timeline that leads to today, drawn in code for the Living Chart's
 * "no moments saved yet" panel (owner-chosen 2026-11-28, option M-D): a
 * hairline with small ticks, five moments in sign hues on short stems,
 * alternating above and below, and today at the right as a white dot whose
 * ring pulses outward. Past today the line turns to dashes.
 *
 * Decoration only: hidden from assistive technology, no words. Motion lives
 * in src/styles/panel-figures.css (the moments appear one after another,
 * the ring pulses) and stops under prefers-reduced-motion, where every
 * moment shows. The box's size comes from the page's stylesheet.
 */
import { signBySlug } from '../../lib/signs';
import '../../styles/panel-figures.css';

const LINE_Y = 75;
const START = 25;
const STEP = 25;
const TODAY = 300;
const END = 336;
const STEM = 34;

/** A tick every 25 units up to today, every fourth one longer. */
const TICKS = Array.from({ length: (TODAY - START) / STEP }, (_, index) => {
  const x = START + index * STEP;
  const half = index % 4 === 0 ? 6.5 : 3.5;
  return `M${x} ${LINE_Y - half}V${LINE_Y + half}`;
}).join('');

/** Five moments, each on a tick, alternating above and below the line. */
const MOMENTS = (['gemini', 'cancer', 'leo', 'capricorn', 'libra'] as const).map((slug, index) => {
  const x = START + STEP * (1 + index * 2);
  const up = index % 2 === 0;
  return { hue: signBySlug(slug).hue, x, dotY: up ? LINE_Y - STEM - 6 : LINE_Y + STEM + 6, stemY: up ? LINE_Y - STEM : LINE_Y + STEM };
});

export default function MomentsTimeline({ class: className }: { class?: string }) {
  return (
    <span class={className ? `pf-figure ${className}` : 'pf-figure'} aria-hidden="true" data-figure="moments-timeline">
      <svg class="zf zf-timeline" viewBox="0 0 356 150" preserveAspectRatio="xMidYMid meet" focusable="false">
        <path class="zf-line" d={`M${START} ${LINE_Y}H${TODAY}`} fill="none" />
        <path class="zf-line zf-line--ahead" d={`M${TODAY + 10} ${LINE_Y}H${END}`} fill="none" />
        <path class="zf-tick" d={TICKS} fill="none" />
        {MOMENTS.map(({ hue, x, dotY, stemY }, index) => (
          <g key={x} class={`zf-moment zf-moment--${index}`}>
            <path d={`M${x} ${LINE_Y}V${stemY}`} stroke={hue} stroke-opacity="0.7" stroke-width="1" fill="none" />
            <circle cx={x} cy={dotY} r="6" fill={hue} />
          </g>
        ))}
        <circle class="zf-today-ring" cx={TODAY} cy={LINE_Y} r="9.5" fill="none" />
        <circle class="zf-today-pulse" cx={TODAY} cy={LINE_Y} r="5" fill="none" />
        <circle class="zf-today" cx={TODAY} cy={LINE_Y} r="5" />
      </svg>
    </span>
  );
}
