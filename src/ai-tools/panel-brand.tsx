import { BRAND_RING_DOTS } from './brand-ring';
import './panel-brand.css';

export function BrandRing({ size = 32 }: { size?: number }) {
  return <svg class="panel-brand-ring" viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">{BRAND_RING_DOTS.map(dot => <circle cx={dot.cx} cy={dot.cy} r="1.9" fill={dot.hue}/>)}</svg>;
}

export function BrandLink({ href = 'https://zodiacs.org/' }: { href?: string }) {
  return <a class="panel-brand" href={href} target="_blank" rel="noreferrer"><BrandRing/>Zodiacs·org</a>;
}
