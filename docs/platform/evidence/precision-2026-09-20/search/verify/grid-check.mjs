import { execFileSync } from 'node:child_process';
// Component 2's ends are Swiss's, from the removed transit-window fixture:
// give it from outside the repository (../lib/backends.mjs, swissWindowFixture).
import { swissDComponents } from '../lib/backends.mjs';
import { DeBackend } from '/home/user/site/docs/platform/evidence/swiss-benchmark/prototype/apparent.mjs';
const eng = new DeBackend('/tmp/claude-0/swisslab/de440s.bsp');
const { bodyLongitude } = await import('@zodiacs/engine/internal');
const circ=(a,b)=>{let d=(a-b)%360;if(d>180)d-=360;if(d<=-180)d+=360;return d};
const q=(s,p)=>{const i=(s.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(i-lo)};
const stats=(v)=>{const a=v.map(Math.abs).sort((x,y)=>x-y);return {n:a.length,max:a[a.length-1],p50:q(a,0.5),p95:q(a,0.95)}};
function grid(from,to,step){const xs=[];for(let t=Date.parse(from);t<=Date.parse(to);t+=step)xs.push(t);return xs}
function swiss(ms){
  const utc=ms.map(m=>new Date(m).toISOString().replace('Z',''));
  const out=execFileSync('/tmp/claude-0/swisslab/venv/bin/python3',['/home/user/precision/search/lib/swiss-longitudes.py'],{input:JSON.stringify({body:'Uranus',utc,ephe:'/tmp/claude-0/swisslab/ephe'}),encoding:'utf8',maxBuffer:1<<28});
  return JSON.parse(out).rows.map(r=>r.lon);
}
for (const [label,g] of [['hourly 2019-12-23..2020-01-30', grid('2019-12-23T00:00:00Z','2020-01-30T00:00:00Z',3600000)],
                          ['6-hourly component', grid(swissDComponents()[1].startUtc,swissDComponents()[1].endUtc,6*3600000)]]) {
  const S=swiss(g);
  const dS=[],cS=[];
  g.forEach((ms,i)=>{dS.push(circ(eng.apparentEclipticLongitude('Uranus',new Date(ms),69.184),S[i])*3600);
                     cS.push(circ(bodyLongitude('Uranus',new Date(ms)),S[i])*3600)});
  console.log(label);
  console.log('  DE-Swiss  ', JSON.stringify(stats(dS)));
  console.log('  core-Swiss', JSON.stringify(stats(cS)));
}
