import { useEffect, useState } from 'preact/hooks';
import { ASSET_CLASSES, CATALOG_VERSION, INSTRUMENTS, isInstrumentId, searchCatalog, instrumentAvailability } from './catalog';
import type { AssetClass } from './types';

export default function AssetPicker({value,onChange}:{value:string;onChange:(id:string)=>void}) {
  const [category,setCategory]=useState<AssetClass|''>('');
  const [query,setQuery]=useState('');
  const [favorites,setFavorites]=useState<string[]>([]);
  const [onlyFavorites,setOnlyFavorites]=useState(false);
  const [ready,setReady]=useState(false);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('zodiacs-lens-favorites-v1')??'null');if(saved?.schema===1&&Array.isArray(saved.ids))setFavorites([...new Set<string>(saved.ids.filter(isInstrumentId))].slice(0,100));}catch{/* Optional view preferences. */}setReady(true);},[]);
  useEffect(()=>{if(ready)try{localStorage.setItem('zodiacs-lens-favorites-v1',JSON.stringify({schema:1,ids:favorites}));}catch{/* Optional view preferences. */}},[favorites,ready]);
  const rows=searchCatalog(query,category||undefined,onlyFavorites?favorites:undefined),i=INSTRUMENTS[value];
  return <section class="lens-asset-picker" aria-label="Asset catalog">
    <div class="lens-segments" aria-label="Asset class">{['',...ASSET_CLASSES].map(c=><button key={c} type="button" aria-pressed={category===c} onClick={()=>setCategory(c as AssetClass|'')}>{c?({crypto:'Crypto',stocks:'Stocks',indices:'Index exposure',fx:'FX',commodities:'Commodities'}[c]):'All assets'}</button>)}</div>
    <div class="lens-toolbar"><label class="lens-field">Search assets<input type="search" value={query} placeholder="Name, symbol or exchange" onInput={e=>setQuery(e.currentTarget.value)} /></label>
      <label class="lens-field">Instrument<select data-testid="lens-instrument" value={value} onChange={e=>onChange(e.currentTarget.value)}>
        {!rows.some(r=>r.id===value)&&<option value={value}>{i.name} · current selection</option>}
        {rows.map(row=><option key={row.id} value={row.id}>{row.name} · {row.id}</option>)}
      </select></label>
      <button type="button" class="lens-button" aria-pressed={favorites.includes(value)} onClick={()=>setFavorites(current=>current.includes(value)?current.filter(id=>id!==value):[...current,value].slice(-100))}>{favorites.includes(value)?'Remove favorite':'Add favorite'}</button>
      <label class="lens-check"><input type="checkbox" checked={onlyFavorites} onChange={()=>setOnlyFavorites(!onlyFavorites)} />Favorites only</label>
    </div>
    <p class="lens-muted" role="status">{rows.length} matching assets · {instrumentAvailability(i)}</p>
    <details class="lens-method"><summary>Instrument &amp; coverage</summary><p>{i.kind} · {i.venue} · {i.quote} quote · {i.timeZone} · {i.calendar}. {i.proxyFor&&`Exposure: ${i.proxyFor}. `}{i.roll}</p><p>Tick: {i.tickSize??'verification pending'} · lot: {i.lotSize??'verification pending'} · multiplier: {i.multiplier}. Catalog {CATALOG_VERSION}; eligibility reviewed {i.eligibility?.asOf}, status: {i.eligibility?.status}. {i.eligibility?.benchmark}.</p><p>{i.eligibility?.liquidity}</p><a href={i.sourceUrl} target="_blank" rel="noopener noreferrer">Instrument source</a></details>
  </section>;
}
