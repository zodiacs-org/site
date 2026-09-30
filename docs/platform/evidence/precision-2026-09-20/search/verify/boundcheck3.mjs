// The component ends are Swiss's, from the removed transit-window fixture:
// give it from outside the repository (lib/backends.mjs, swissWindowFixture).
import { coreBackend, deBackend, circular, swissDComponents } from '../lib/backends.mjs';
import { measureDerivativeBounds } from '../lib/astro-harness.mjs';
const h=600000;
const core=await coreBackend(), de=await deBackend();
function mk(lon,body,target){const c=new Map();return ms=>{const t=Math.round(ms);if(c.has(t))return c.get(t);const y=circular(lon(body,t),target);c.set(t,y);return y};}
const [c1, c2] = swissDComponents();
const windows = {
 'component-2 (used for the reported verdicts)': [c2.startUtc, c2.endUtc],
 'component-1': [c1.startUtc, c1.endUtc],
 'full declared window': ['2019-01-01T00:00:00Z','2020-12-31T00:00:00Z'],
};
for (const [wname,[fs,ts]] of Object.entries(windows)){
 const a=Date.parse(fs), b=Date.parse(ts);
 for (const [id,lon] of [['core',core.lon],['de',de.lon]]) {
  const f=mk(lon,'Uranus',32.6940395);
  const g=measureDerivativeBounds({f,a,b,samples:400,h});
  let m2=0,m3=0,m4=0,t4=0;
  for(let t=a;t<=b;t+=1800000){
    const [ym2,ym1,y0,yp1,yp2]=[t-2*h,t-h,t,t+h,t+2*h].map(f);
    m2=Math.max(m2,Math.abs((yp1-2*y0+ym1)/(h*h)));
    m3=Math.max(m3,Math.abs((yp2-2*yp1+2*ym1-ym2)/(2*h**3)));
    const v4=Math.abs((yp2-4*yp1+6*y0-4*ym1+ym2)/(h**4)); if(v4>m4){m4=v4;t4=t;}
  }
  const V=(d,bd)=>d>bd?'VIOLATED':'ok';
  console.log(`${wname} / ${id}: f''=${V(m2,g.bounds.secondDerivativeBound)} (x${(m2/g.bounds.secondDerivativeBound).toFixed(2)}), f'''=${V(m3,g.bounds.thirdDerivativeBound)} (x${(m3/g.bounds.thirdDerivativeBound).toFixed(2)}), f''''=${V(m4,g.bounds.fourthDerivativeBound)} (x${(m4/g.bounds.fourthDerivativeBound).toFixed(2)}) argmax4 ${new Date(t4).toISOString()}`);
 }
}
