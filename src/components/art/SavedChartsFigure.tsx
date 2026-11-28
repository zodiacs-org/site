/**
 * The figure in the profile's "no saved chart yet" panel: "the ring in
 * space" (./scenes/ring-in-space.ts). One component per piece, so the
 * drawing can change without touching the island that places it.
 */
import CanvasFigure from './CanvasFigure';

const load = () => import('./scenes/ring-in-space');

export default function SavedChartsFigure({ class: className }: { class?: string }) {
  return <CanvasFigure load={load} name="saved-charts" class={className} />;
}
