// Component 1's ends are Swiss's, from the removed transit-window fixture:
// give it from outside the repository (lib/backends.mjs, swissWindowFixture).
import { coreBackend, circular, swissDComponents } from '../lib/backends.mjs';
import { measureDerivativeBounds } from '../lib/astro-harness.mjs';
const h=600000;
const core=await coreBackend();
function mk(lon,body,target){const c=new Map();return ms=>{const t=Math.round(ms);if(c.has(t))return c.get(t);const y=circular(lon(body,t),target);c.set(t,y);return y};}
const f=mk(core.lon,'Uranus',32.6940395);
const [c1] = swissDComponents();
const a=Date.parse(c1.startUtc), b=Date.parse(c1.endUtc);
const g=measureDerivativeBounds({f,a,b,samples:400,h});
console.log('declared 10x bounds  f\'\'\'',g.bounds.thirdDerivativeBound.toExponential(4),' f\'\'\'\'',g.bounds.fourthDerivativeBound.toExponential(4));
for (const stepMin of [30, 10, 5, 1]){
  let m3=0,m4=0;
  for(let t=a;t<=b;t+=stepMin*60000){
    const [ym2,ym1,y0,yp1,yp2]=[t-2*h,t-h,t,t+h,t+2*h].map(f);
    m3=Math.max(m3,Math.abs((yp2-2*yp1+2*ym1-ym2)/(2*h**3)));
    m4=Math.max(m4,Math.abs((yp2-4*yp1+6*y0-4*ym1+ym2)/(h**4)));
  }
  console.log(`dense step ${stepMin} min: f'''=${m3.toExponential(4)} (x${(m3/g.bounds.thirdDerivativeBound).toFixed(2)} of bound)  f''''=${m4.toExponential(4)} (x${(m4/g.bounds.fourthDerivativeBound).toFixed(2)} of bound)`);
}
