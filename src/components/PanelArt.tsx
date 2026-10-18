/**
 * A painted piece inside a profile panel (src/lib/art.ts). Decoration only:
 * hidden from assistive technology, lazy, at a fixed intrinsic size so the
 * panel holds its shape before the picture arrives. The frame and the mask
 * that fades it into the panel live in src/styles/profile-page.css
 * (.pf-art), so the edges dissolve on any background.
 */
import { ART, artSrc, artSrcset, type ArtName } from '../lib/art';

interface Props {
  name: ArtName;
  /** Layout hint for the browser's choice between the 720 and 1200 widths. */
  sizes?: string;
  class?: string;
}

export default function PanelArt({ name, sizes = '(min-width: 760px) 420px, 100vw', class: className }: Props) {
  const { width, height } = ART[name];
  return (
    <span class={className ? `pf-art ${className}` : 'pf-art'} aria-hidden="true" data-art={name}>
      <img
        src={artSrc(name)}
        srcset={artSrcset(name)}
        sizes={sizes}
        width={width}
        height={height}
        alt=""
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
