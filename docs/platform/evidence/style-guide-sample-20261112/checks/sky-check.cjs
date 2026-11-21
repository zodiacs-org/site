// Independent recomputation of the sky facts the sampled readings assert.
// Library: astronomy-engine (path given as argv[2]); geocentric apparent ecliptic longitude of date.
const A = require(process.argv[2]);
const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
function lon(body, d) {
  const t = A.MakeTime(d);
  if (body === 'Sun') return A.SunPosition(t).elon;
  if (body === 'Moon') return A.EclipticGeoMoon(t).lon;
  return A.Ecliptic(A.GeoVector(A.Body[body], t, true)).elon;
}
const fmt = (l) => { const s = Math.floor(l/30), x = l - 30*s; const dd = Math.floor(x), mm = Math.floor((x-dd)*60); return `${x.toFixed(2)}° (${dd}°${String(mm).padStart(2,'0')}′) ${SIGNS[s]}`; };
const speed = (b, d) => { const h = 0.01*86400e3; let a = lon(b, new Date(+d+h)) - lon(b, new Date(+d-h)); a = ((a+540)%360)-180; return a/0.02; };
const norm = (a) => ((a+540)%360)-180;
function bisect(f, t0, t1) { let a=+t0, b=+t1, fa=f(new Date(a)); for (let i=0;i<60;i++){ const m=(a+b)/2, fm=f(new Date(m)); if ((fa<0)===(fm<0)) {a=m;fa=fm;} else b=m; } return new Date((a+b)/2); }
function scan(f, from, to, stepH=6) { const out=[]; let p=f(new Date(from)); for (let t=+new Date(from)+stepH*3600e3; t<=+new Date(to); t+=stepH*3600e3){ const c=f(new Date(t)); if ((p<0)!==(c<0) && Math.abs(c-p)<90) out.push(bisect(f,new Date(t-stepH*3600e3),new Date(t))); p=c; } return out; }
const iso = (d) => d.toISOString().slice(0,16)+'Z';
const out = [];
const P = (s) => { out.push(s); console.log(s); };
P('## Positions at noon UTC');
for (const day of ['2026-11-09','2026-11-11','2026-11-12','2026-11-15']) {
  const d = new Date(day+'T12:00:00Z');
  P(`### ${day} 12:00 UTC`);
  for (const b of ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto']) P(`${b}: ${fmt(lon(b,d))}${b!=='Sun'&&b!=='Moon'&&speed(b,d)<0?' retrograde':''}`);
  const el = ((lon('Moon',d)-lon('Sun',d))%360+360)%360; P(`Moon elongation ${el.toFixed(1)}°, illuminated ${(100*(1-Math.cos(el*Math.PI/180))/2).toFixed(1)}%`);
}
P('## Moon phases');
let q = A.SearchMoonQuarter(A.MakeTime(new Date('2026-11-01T00:00:00Z')));
for (let i=0;i<8;i++){ P(`${['New','First quarter','Full','Last quarter'][q.quarter]}: ${iso(q.time.date)} Moon ${fmt(lon('Moon',q.time.date))}`); q = A.NextMoonQuarter(q); }
P('## Stations (speed changes sign), 2026-10-01 to 2027-12-31');
for (const b of ['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'])
  for (const t of scan((d)=>speed(b,d), '2026-10-01T00:00:00Z', '2027-12-31T00:00:00Z', 12)) P(`${b} ${speed(b,new Date(+t+3600e3))>0?'direct':'retrograde'}: ${iso(t)} at ${fmt(lon(b,t))}`);
P('## Ingresses, 2026-11-01 to 2027-12-31 (Sun, Mercury, Venus, Mars, Jupiter)');
for (const b of ['Sun','Mercury','Venus','Mars','Jupiter'])
  for (let s=0;s<12;s++) for (const t of scan((d)=>norm(lon(b,d)-30*s), '2026-11-01T00:00:00Z', b==='Jupiter'||b==='Mars'?'2027-12-31T00:00:00Z':'2026-12-31T00:00:00Z', 6)) P(`${b} crosses 0° ${SIGNS[s]}: ${iso(t)}`);
P('## Exact aspects, November 2026');
const asp = [['Venus','Jupiter',60],['Mars','Jupiter',0],['Sun','Jupiter',90],['Sun','Neptune',120],['Sun','Pluto',60],['Sun','Uranus',180],['Uranus','Pluto',120],['Sun','Saturn',120],['Venus','Mars',60],['Neptune','Pluto',60]];
for (const [a,b,ang] of asp) for (const sgn of [1,-1]) { if ((ang===0||ang===180)&&sgn<0) continue;
  for (const t of scan((d)=>norm(lon(a,d)-lon(b,d)-sgn*ang), '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', 6)) P(`${a} ${ang}° ${b}: ${iso(t)} ${a} ${fmt(lon(a,t))}, ${b} ${fmt(lon(b,t))}`); }
P('## Aspect separations at 2026-11-11 12:00 UTC');
{ const d=new Date('2026-11-11T12:00:00Z'); for (const [a,b,ang] of [['Venus','Mars',60],['Uranus','Pluto',120],['Neptune','Pluto',60],['Mars','Jupiter',0]]) { const sep=Math.abs(norm(lon(a,d)-lon(b,d))); P(`${a}-${b}: separation ${sep.toFixed(2)}°, ${Math.abs(sep-ang).toFixed(2)}° from ${ang}°`); } }
P('## Eclipses 2027');
let se = A.SearchGlobalSolarEclipse(A.MakeTime(new Date('2027-01-01T00:00:00Z')));
for (let i=0;i<3 && se.peak.date.getUTCFullYear()===2027;i++){ P(`Solar ${se.kind}: ${iso(se.peak.date)} Sun ${fmt(lon('Sun',se.peak.date))}`); se = A.NextGlobalSolarEclipse(se.peak); }
let le = A.SearchLunarEclipse(A.MakeTime(new Date('2027-01-01T00:00:00Z')));
for (let i=0;i<4 && le.peak.date.getUTCFullYear()===2027;i++){ P(`Lunar ${le.kind}: ${iso(le.peak.date)} Moon ${fmt(lon('Moon',le.peak.date))}`); le = A.NextLunarEclipse(le.peak); }
P('## Sun at noon UTC on 12 November, 1940 to 2030');
{ let mn=999,mx=0,my,xy; for (let y=1940;y<=2030;y++){ const l=lon('Sun',new Date(Date.UTC(y,10,12,12))); if(l<mn){mn=l;my=y} if(l>mx){mx=l;xy=y} } P(`min ${fmt(mn)} (${my}), max ${fmt(mx)} (${xy})`); }
P('## Synthetic chart 1990-05-03 12:00 UTC and transits used by the connector sample');
{ const n=new Date('1990-05-03T12:00:00Z'); const nat={}; for (const b of ['Sun','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto']) { nat[b]=lon(b,n); P(`natal ${b}: ${fmt(nat[b])}`); }
  for (const [tb,ang,nb] of [['Sun',60,'Saturn'],['Mercury',120,'Jupiter'],['Mercury',120,'Mars'],['Mercury',60,'Uranus'],['Sun',120,'Venus']]) for (const sgn of [1,-1]) for (const t of scan((d)=>norm(lon(tb,d)-nat[nb]-sgn*ang), '2026-11-11T00:00:00Z','2026-11-26T00:00:00Z',3)) P(`transit ${tb} ${ang}° natal ${nb}: ${iso(t)}`);
  const d=new Date('2026-11-11T12:00:00Z'); for (const [tb,ang,nb] of [['Saturn',90,'Uranus'],['Saturn',90,'Jupiter'],['Venus',90,'Saturn']]) P(`transit ${tb} to natal ${nb} at 2026-11-11 12:00 UTC: ${Math.abs(Math.abs(norm(lon(tb,d)-nat[nb]))-ang).toFixed(2)}° from ${ang}°`); }
P('## Synthetic pair 1988-02-14 and 1991-09-30, noon UTC');
{ const a=new Date('1988-02-14T12:00:00Z'), b=new Date('1991-09-30T12:00:00Z'); P(`A Sun ${fmt(lon('Sun',a))}; B Sun ${fmt(lon('Sun',b))}`);
  for (const [x,y,ang] of [['Jupiter','Venus',120],['Mercury','Pluto',90],['Venus','Sun',180],['Sun','Venus',180],['Mercury','Mars',120],['Mars','Venus',120],['Venus','Mercury',180],['Neptune','Sun',90]]) P(`A ${x} to B ${y}: orb ${Math.abs(Math.abs(norm(lon(x,a)-lon(y,b)))-ang).toFixed(1)}° from ${ang}°`); }
require('fs').writeFileSync('sky-check-output.txt', out.join('\n')+'\n');
