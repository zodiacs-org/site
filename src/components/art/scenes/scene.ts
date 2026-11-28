/**
 * The contract between CanvasFigure and the scenes it draws. A scene is
 * drawn in its own design space (width × height units), fitted inside the
 * figure's box and centred; `view` is the part of the design space the box
 * shows, which is larger than the design space when the box's shape
 * differs, so a background (the star field) can fill the whole box.
 */
export interface SceneView {
  x0: number;
  y0: number;
  w: number;
  h: number;
}

export interface ScenePalette {
  /** --ink-0, as "r,g,b". */
  ink: string;
  /** --ink-2, as "r,g,b". */
  line: string;
}

export interface SceneAssets {
  /** The scene's images, in the order of `images`; an image may not have loaded yet. */
  images: HTMLImageElement[];
  palette: ScenePalette;
}

export interface Scene {
  width: number;
  height: number;
  /** Image URLs the scene draws (fetched when the figure nears the viewport). */
  images?: readonly string[];
  /** The time, in seconds, of the still frame drawn under reduced motion. */
  still: number;
  /** The time, in seconds, the animation opens at (default 0). */
  start?: number;
  draw(ctx: CanvasRenderingContext2D, t: number, view: SceneView, assets: SceneAssets): void;
}

const TAU = Math.PI * 2;

/** "#RRGGBB" to "r,g,b". */
export function rgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** A small seeded generator, so a scene's stars stay where they are. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export interface Star {
  u: number;
  v: number;
  size: number;
  phase: number;
  tint: number;
}

export function makeStars(seed: number, count: number): Star[] {
  const random = seeded(seed);
  return Array.from({ length: count }, () => ({ u: random(), v: random(), size: 0.3 + random() * 1.1, phase: random() * TAU, tint: random() }));
}

/**
 * Twinkling stars spread over a rectangle of the design space. A few take a
 * pale sign hue (`tints`); the rest are ink.
 */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: readonly Star[],
  t: number,
  area: SceneView,
  ink: string,
  tints: readonly [string, string],
  fade?: (x: number, y: number) => number,
): void {
  for (const star of stars) {
    const x = area.x0 + star.u * area.w;
    const y = area.y0 + star.v * area.h;
    const alpha = (0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.9 + star.phase))) * (fade ? fade(x, y) : 1);
    if (alpha <= 0.01) continue;
    const colour = star.tint > 0.86 ? tints[0] : star.tint > 0.72 ? tints[1] : ink;
    ctx.fillStyle = `rgba(${colour},${colour === ink ? alpha * 0.8 : alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, star.size * 0.6, 0, TAU);
    ctx.fill();
  }
}

export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, colour: string, alpha: number): void {
  if (radius <= 0 || alpha <= 0) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${colour},${alpha})`);
  gradient.addColorStop(1, `rgba(${colour},0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

/** A glow with a bright centre and a long, gentle falloff (no hard rim). */
export function softGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, colour: string, alpha: number): void {
  if (radius <= 0 || alpha <= 0) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${colour},${alpha})`);
  gradient.addColorStop(0.18, `rgba(${colour},${alpha * 0.55})`);
  gradient.addColorStop(0.45, `rgba(${colour},${alpha * 0.18})`);
  gradient.addColorStop(1, `rgba(${colour},0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

export { TAU };
