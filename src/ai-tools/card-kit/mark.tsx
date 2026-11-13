/**
 * The assistant cards' tilted twelve-dot mark. Its numbers live in
 * src/lib/tilted-mark.ts, so the share images draw the same mark.
 */
import { TILTED_RING_DOTS, TILTED_RING_VIEWBOX, tiltedRingDots } from '../../lib/tilted-mark';

export { TILTED_RING_DOTS, TILTED_RING_VIEWBOX };

/**
 * The tilted mark, drawn at `width`; its height follows the 7:4 viewBox. A
 * card made for one person passes their Sun sign as `front` and the ring
 * turns to bring it forward, as the site's images do; without one it is the
 * brand's own ring.
 */
export function TiltedRing({ width = 35, front = null }: { width?: number; front?: string | null }) {
  return <svg class="tilted-ring" viewBox={TILTED_RING_VIEWBOX} width={width} height={Math.round(width * 4 / 7)} fill="none" aria-hidden="true">
    {tiltedRingDots(front).map((dot) => <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill={dot.fill} opacity={dot.opacity}/>)}
  </svg>;
}
