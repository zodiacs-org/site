import { TILTED_RING_DOTS, TILTED_RING_VIEWBOX } from '../lib/brand-lockup.mjs';
import './panel-brand.css';

/** The brand lockup's tilted twelve-dot ring (DESIGN.md, "Brand Lockup"), `size` px wide; its height is 4/7 of it. */
export function BrandRing({ size = 34 }: { size?: number }) {
  return <svg class="panel-brand-ring" viewBox={TILTED_RING_VIEWBOX} width={size} height={Math.round((size * 4) / 7)} fill="none" aria-hidden="true">{TILTED_RING_DOTS.map(dot => <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill={dot.fill} opacity={dot.opacity}/>)}</svg>;
}

/** The brand lockup: the tilted ring and ZODIACS · ORG in the nav serif's capitals, the dot muted and ORG a step dimmer. Its link is named Zodiacs.org. */
export function BrandLink({ href = 'https://zodiacs.org/' }: { href?: string }) {
  return <a class="panel-brand" href={href} target="_blank" rel="noreferrer" aria-label="Zodiacs.org"><BrandRing/><span class="panel-brand-name" aria-hidden="true">Zodiacs<span class="panel-brand-sep">·</span><span class="panel-brand-tld">org</span></span></a>;
}
