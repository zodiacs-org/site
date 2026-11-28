// Extra recomputations for the connector sample (same library and method as sky-check.cjs).
const A = require(process.argv[2]);
const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
function lon(body, d) { const t = A.MakeTime(d); if (body==='Sun') return A.SunPosition(t).elon; if (body==='Moon') return A.EclipticGeoMoon(t).lon; return A.Ecliptic(A.GeoVector(A.Body[body], t, true)).elon; }
const fmt = (l) => { const s=Math.floor(l/30), x=l-30*s; return `${x.toFixed(3)}° ${SIGNS[s]}`; };
const norm = (a) => ((a+540)%360)-180;
const speed = (b,d) => norm(lon(b,new Date(+d+864e3))-lon(b,new Date(+d-864e3)))/0.02;
function bisect(f,t0,t1){let a=+t0,b=+t1,fa=f(new Date(a));for(let i=0;i<60;i++){const m=(a+b)/2,fm=f(new Date(m));if((fa<0)===(fm<0)){a=m;fa=fm}else b=m}return new Date((a+b)/2)}
function scan(f,from,to,stepH=3){const out=[];let p=f(new Date(from));for(let t=+new Date(from)+stepH*3600e3;t<=+new Date(to);t+=stepH*3600e3){const c=f(new Date(t));if((p<0)!==(c<0)&&Math.abs(c-p)<90)out.push(bisect(f,new Date(t-stepH*3600e3),new Date(t)));p=c}return out}
const iso=(d)=>d.toISOString().slice(0,16)+'Z';
const out=[]; const P=(s)=>{out.push(s);console.log(s)};
P('## get_sky instant 2026-11-11T18:17:55.962Z');
{ const d=new Date('2026-11-11T18:17:55.962Z'); for (const b of ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto']) P(`${b}: ${fmt(lon(b,d))}${b!=='Sun'&&b!=='Moon'&&speed(b,d)<0?' retrograde':''}`); const el=((lon('Moon',d)-lon('Sun',d))%360+360)%360; P(`Moon elongation ${el.toFixed(2)}°, illuminated ${((1-Math.cos(el*Math.PI/180))/2).toFixed(4)}`); }
P('## Synthetic chart 1990-05-03');
{ const n=new Date('1990-05-03T12:00:00Z'); const nat={}; for (const b of ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto']) { nat[b]=lon(b,n); P(`${b} at noon UTC: ${fmt(nat[b])}${b!=='Sun'&&b!=='Moon'&&speed(b,n)<0?' retrograde':''}`); }
  for (const b of ['Moon','Venus']) for (let s=0;s<12;s++) for (const t of scan((d)=>norm(lon(b,d)-30*s),'1990-05-02T00:00:00Z','1990-05-05T00:00:00Z',1)) P(`${b} crosses 0° ${SIGNS[s]}: ${iso(t)}`);
  for (const [x,y,ang] of [['Mars','Uranus',60],['Sun','Mercury',0],['Mercury','Neptune',120],['Sun','Neptune',120],['Neptune','Pluto',60],['Mars','Jupiter',120],['Jupiter','Uranus',180],['Mercury','Pluto',180]]) P(`${x}-${y}: ${Math.abs(Math.abs(norm(nat[x]-nat[y]))-ang).toFixed(2)}° from ${ang}°`);
  for (const [tb,ang,nb] of [['Mercury',180,'Sun'],['Mercury',180,'Mercury'],['Venus',90,'Saturn'],['Mercury',60,'Neptune']]) for (const sgn of (ang===180?[1]:[1,-1])) for (const t of scan((d)=>norm(lon(tb,d)-nat[nb]-sgn*ang),'2026-11-11T00:00:00Z','2026-11-26T00:00:00Z',3)) P(`transit ${tb} ${ang}° natal ${nb}: ${iso(t)}`); }
require('fs').writeFileSync('sky-check-extra-output.txt', out.join('\n')+'\n');
