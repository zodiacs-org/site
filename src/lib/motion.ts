/**
 * Island-side hook into the shared entrance motion (docs/MOTION.md).
 *
 * <Motion /> (src/components/Motion.astro) owns the observer. Islands that
 * render marked nodes after the page has loaded, such as a calculator's
 * result, call motionScan(container) once those nodes are in the DOM. On a
 * page without <Motion />, or for readers who ask for reduced motion, this
 * does nothing and the nodes simply show.
 */

export type MotionVerb = 'rise' | 'draw' | 'disc';

interface MotionRuntime {
  scan(root?: ParentNode, instant?: boolean): void;
}

export function motionScan(root?: ParentNode, instant?: boolean): void {
  if (typeof window === 'undefined') return;
  const runtime = (window as unknown as { zodiacsMotion?: MotionRuntime }).zodiacsMotion;
  runtime?.scan(root, instant);
}

/**
 * Spread onto an element in JSX: {...motion('rise')}. Elements that come into view
 * together are staggered in document order by the runtime; set --motion-i
 * yourself only to override that order.
 */
export function motion(verb: MotionVerb): { 'data-enter': MotionVerb } {
  return { 'data-enter': verb };
}
