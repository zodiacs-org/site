/**
 * The assistant cards' tilted twelve-dot mark. Its numbers live in
 * src/lib/tilted-mark.ts, so the share images draw the same mark.
 */
import { TILTED_RING_DOTS, TILTED_RING_VIEWBOX } from '../../lib/tilted-mark';

export { TILTED_RING_DOTS, TILTED_RING_VIEWBOX };

/** The tilted mark, drawn at `width`; its height follows the 7:4 viewBox. */
export function TiltedRing({ width = 35 }: { width?: number }) {
  return <svg class="tilted-ring" viewBox={TILTED_RING_VIEWBOX} width={width} height={Math.round(width * 4 / 7)} fill="none" aria-hidden="true">
    {TILTED_RING_DOTS.map((dot) => <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill={dot.fill} opacity={dot.opacity}/>)}
  </svg>;
}
