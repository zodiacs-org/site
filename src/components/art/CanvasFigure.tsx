/**
 * Draws a code-made scene (./scenes/) into a canvas inside a panel. The
 * figure's box is sized by the page's stylesheet before anything loads, so
 * nothing moves when it draws. Decoration only: hidden from assistive
 * technology.
 *
 * The scene's code and images are fetched only when the box nears the
 * viewport. The canvas is drawn at the box's size times the device pixel
 * ratio (up to 2), and redrawn when the box resizes. The animation runs on
 * requestAnimationFrame only while the box is on screen and the tab is
 * visible, and its clock stops while it is paused. Under
 * prefers-reduced-motion the scene's still frame is drawn once instead.
 * The canvas fades in once its first frame is drawn (src/styles/panel-figures.css).
 */
import { useEffect, useRef } from 'preact/hooks';
import type { Scene, ScenePalette, SceneView } from './scenes/scene';
import '../../styles/panel-figures.css';

interface Props {
  load: () => Promise<{ default: Scene }>;
  name: string;
  class?: string;
}

const MAX_DPR = 2;
/** The longest step the clock takes after a dropped frame, in seconds. */
const MAX_STEP = 0.1;

function tokenRgb(element: Element, token: string, fallback: string): string {
  const value = getComputedStyle(element).getPropertyValue(token).trim();
  const hex = /^#([0-9a-f]{6})$/iu.exec(value)?.[1];
  if (!hex) return fallback;
  const n = Number.parseInt(hex, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export default function CanvasFigure({ load, name, class: className }: Props) {
  const frame = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = frame.current;
    const surface = canvas.current;
    const ctx = surface?.getContext('2d');
    if (!box || !surface || !ctx || typeof IntersectionObserver === 'undefined') return;

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let alive = true;
    let scene: Scene | null = null;
    let images: HTMLImageElement[] = [];
    let palette: ScenePalette = { ink: '238,241,247', line: '142,150,171' };
    let onScreen = false;
    let requested = false;
    let raf = 0;
    let last = 0;
    let clock = 0;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;

    const fit = () => {
      if (!scene) return false;
      const { width, height } = box.getBoundingClientRect();
      if (width < 1 || height < 1) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if (surface.width !== pixelWidth) surface.width = pixelWidth;
      if (surface.height !== pixelHeight) surface.height = pixelHeight;
      scale = Math.min(pixelWidth / scene.width, pixelHeight / scene.height);
      offsetX = (pixelWidth - scene.width * scale) / 2;
      offsetY = (pixelHeight - scene.height * scale) / 2;
      return true;
    };

    const paint = (t: number) => {
      if (!scene || !alive) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, surface.width, surface.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      const view: SceneView = { x0: -offsetX / scale, y0: -offsetY / scale, w: surface.width / scale, h: surface.height / scale };
      scene.draw(ctx, t, view, { images, palette });
      box.classList.add('is-drawn');
    };

    const moving = () => alive && scene !== null && onScreen && !document.hidden && !still?.matches;
    const now = () => (still?.matches ? scene?.still ?? 0 : clock);

    const tick = (time: number) => {
      raf = 0;
      if (!moving()) return;
      clock += Math.min((time - last) / 1000, MAX_STEP);
      last = time;
      paint(clock);
      raf = requestAnimationFrame(tick);
    };

    const update = () => {
      if (moving()) {
        if (!raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
        return;
      }
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (scene && still?.matches) paint(now());
    };

    /** Redraw the current frame when nothing else will (paused, or reduced motion). */
    const refresh = () => {
      if (!scene || !fit()) return;
      if (!raf) paint(now());
    };

    const start = async () => {
      try {
        const loaded = (await load()).default;
        if (!alive) return;
        scene = loaded;
        clock = loaded.start ?? 0;
        palette = { ink: tokenRgb(box, '--ink-0', palette.ink), line: tokenRgb(box, '--ink-2', palette.line) };
        images = (scene.images ?? []).map((src) => {
          const image = new Image();
          image.decoding = 'async';
          image.onload = refresh;
          image.src = src;
          return image;
        });
        if (!fit()) return;
        paint(now());
        update();
      } catch {
        // A scene that fails to load leaves the box empty; the panel still reads.
      }
    };

    const watch = new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      if (onScreen && !requested) {
        requested = true;
        void start();
      }
      update();
    }, { rootMargin: '120px 0px' });
    watch.observe(box);
    const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refresh);
    resized?.observe(box);
    document.addEventListener('visibilitychange', update);
    still?.addEventListener?.('change', update);

    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      watch.disconnect();
      resized?.disconnect();
      document.removeEventListener('visibilitychange', update);
      still?.removeEventListener?.('change', update);
      for (const image of images) image.onload = null;
    };
  }, [load]);

  return (
    <span ref={frame} class={className ? `pf-figure ${className}` : 'pf-figure'} aria-hidden="true" data-figure={name}>
      <canvas ref={canvas} />
    </span>
  );
}
