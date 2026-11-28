/**
 * The figure in the Living Chart's "no moments saved yet" panel: "the path
 * to today" (./scenes/path-to-today.ts). One component per piece, so the
 * drawing can change without touching the island that places it.
 */
import CanvasFigure from './CanvasFigure';

const load = () => import('./scenes/path-to-today');

export default function MomentsFigure({ class: className }: { class?: string }) {
  return <CanvasFigure load={load} name="moments" class={className} />;
}
