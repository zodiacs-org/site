/**
 * A painted piece inside a profile panel (src/lib/art.ts). Decoration only:
 * hidden from assistive technology, and never the page's largest paint. The
 * picture is drawn into a canvas, which Largest Contentful Paint does not
 * count, because on the translated pages the first panel sits in the first
 * screen; an <img> or a CSS background there would become the page's LCP.
 * The WebP is fetched only when the panel nears the viewport, at the width
 * the box needs, cropped like object-fit: cover around the box's --focus,
 * and faded in once drawn. The box's size comes from the stylesheet, so the
 * panel holds its shape before anything arrives. The frame and the mask that
 * fades it into the panel live in src/styles/profile-page.css (.pf-art).
 */
import { useEffect, useRef } from 'preact/hooks';
import { ART_WIDTHS, artSrc, type ArtName } from '../lib/art';

interface Props {
  name: ArtName;
  class?: string;
}

/** "62% 46%" → [0.62, 0.46]; anything else centres the crop. */
function focusOf(element: Element): [number, number] {
  const parts = getComputedStyle(element).getPropertyValue('--focus').trim().split(/\s+/u);
  const share = (value: string | undefined) => {
    const number = Number.parseFloat(value ?? '');
    return Number.isFinite(number) && value?.endsWith('%') ? Math.min(Math.max(number / 100, 0), 1) : 0.5;
  };
  return [share(parts[0]), share(parts[1])];
}

export default function PanelArt({ name, class: className }: Props) {
  const frame = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = frame.current;
    const surface = canvas.current;
    if (!box || !surface || typeof IntersectionObserver === 'undefined') return;
    let alive = true;
    let picture: HTMLImageElement | null = null;

    const draw = () => {
      if (!alive || !picture?.naturalWidth) return;
      const { width, height } = box.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * scale);
      const pixelHeight = Math.round(height * scale);
      const context = surface.getContext('2d');
      if (!context) return;
      surface.width = pixelWidth;
      surface.height = pixelHeight;
      const cover = Math.max(pixelWidth / picture.naturalWidth, pixelHeight / picture.naturalHeight);
      const drawnWidth = picture.naturalWidth * cover;
      const drawnHeight = picture.naturalHeight * cover;
      const [x, y] = focusOf(box);
      context.imageSmoothingQuality = 'high';
      context.drawImage(picture, (pixelWidth - drawnWidth) * x, (pixelHeight - drawnHeight) * y, drawnWidth, drawnHeight);
      box.classList.add('is-drawn');
    };

    const load = () => {
      const wanted = box.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 2);
      const width = ART_WIDTHS.find((candidate) => candidate >= wanted) ?? ART_WIDTHS[ART_WIDTHS.length - 1];
      picture = new Image();
      picture.decoding = 'async';
      picture.onload = draw;
      picture.src = artSrc(name, width);
    };

    const near = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      near.disconnect();
      load();
    }, { rootMargin: '600px 0px' });
    near.observe(box);
    const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw);
    resized?.observe(box);

    return () => {
      alive = false;
      near.disconnect();
      resized?.disconnect();
      if (picture) picture.onload = null;
    };
  }, [name]);

  return (
    <span
      ref={frame}
      class={className ? `pf-art ${className}` : 'pf-art'}
      aria-hidden="true"
      data-art={name}
    >
      <canvas ref={canvas} />
    </span>
  );
}
