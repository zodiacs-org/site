/**
 * The assistant cards' mark, owner-chosen 2026-10-18: the twelve dots seen
 * tilted, as a carousel on an ellipse (rx 10, ry 4) in a viewBox of
 * -2 4 28 16. Dots nearer the viewer are larger and fully opaque, the far
 * ones small and faint, in deeper tones of the sign hues so the mark reads
 * on both the light and the dark card. Listed back to front, so nearer dots
 * paint over farther ones. The share images draw the same mark.
 */
export const TILTED_RING_VIEWBOX = '-2 4 28 16';
export const TILTED_RING_DOTS: readonly { cx: number; cy: number; r: number; fill: string; opacity: number }[] = [
  { cx: 12, cy: 8, r: 1.2, fill: '#D9694F', opacity: 0.45 },
  { cx: 17, cy: 8.54, r: 1.33, fill: '#5E9E70', opacity: 0.49 },
  { cx: 7, cy: 8.54, r: 1.33, fill: '#4CA88F', opacity: 0.49 },
  { cx: 3.34, cy: 10, r: 1.67, fill: '#7A57B0', opacity: 0.59 },
  { cx: 20.66, cy: 10, r: 1.67, fill: '#8463BC', opacity: 0.59 },
  { cx: 22, cy: 12, r: 2.15, fill: '#4A8FBD', opacity: 0.73 },
  { cx: 2, cy: 12, r: 2.15, fill: '#7FB24C', opacity: 0.73 },
  { cx: 20.66, cy: 14, r: 2.62, fill: '#CC6C84', opacity: 0.86 },
  { cx: 3.34, cy: 14, r: 2.62, fill: '#CF8B3A', opacity: 0.86 },
  { cx: 17, cy: 15.46, r: 2.97, fill: '#5FA352', opacity: 0.96 },
  { cx: 7, cy: 15.46, r: 2.97, fill: '#3FA0BD', opacity: 0.96 },
  { cx: 12, cy: 16, r: 3.1, fill: '#A764C0', opacity: 1 },
];

/** The tilted mark, drawn at `width`; its height follows the 7:4 viewBox. */
export function TiltedRing({ width = 35 }: { width?: number }) {
  return <svg class="tilted-ring" viewBox={TILTED_RING_VIEWBOX} width={width} height={Math.round(width * 4 / 7)} fill="none" aria-hidden="true">
    {TILTED_RING_DOTS.map((dot) => <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill={dot.fill} opacity={dot.opacity}/>)}
  </svg>;
}
