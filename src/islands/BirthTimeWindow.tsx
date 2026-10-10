import {useEffect,useMemo,useRef,useState} from 'preact/hooks';
import type {BirthWindow} from '@zodiacs/engine/window';
import type {HouseSystem} from '../lib/engine/types';
import {birthWindowSummary,birthWindowChange,birthWindowShare,birthWindowSignName} from '../lib/birth-time-window';
import '../styles/birth-time-window.css';
export interface BirthTimeWindowProps{
 utc:Date;latitude:number;longitude:number;houseSystem:HouseSystem;timeZone:string;
}
export function BirthTimeWindow({utc,latitude,longitude,houseSystem,timeZone}:BirthTimeWindowProps){
 const [minutes,setMinutes]=useState(10),[result,setResult]=useState<BirthWindow|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const worker=useRef<Worker|null>(null),generation=useRef(0);
 function cancel(){generation.current++;worker.current?.terminate();worker.current=null;}
 useEffect(()=>()=>cancel(),[]);
 // The parent keys this surface to its current committed chart. A new chart
 // unmounts the old surface and terminates work before a stale result can render.
 function changeMinutes(value:number){cancel();setBusy(false);setResult(null);setError('');setMinutes(value);}
 function check(){
  cancel();setResult(null);setError('');setBusy(true);
  const id=generation.current;
  let active:Worker|undefined;
  function fail(message:string){
   if(id!==generation.current)return;
   active?.terminate();worker.current=null;setBusy(false);setError(message);
  }
  try{
   active=new Worker(new URL('./birth-window.worker.ts',import.meta.url),{type:'module'});
   worker.current=active;
   active.onmessage=(event:MessageEvent<{id:number;result?:BirthWindow;error?:{budget:boolean}}>)=>{
    if(id!==generation.current||event.data.id!==id)return;
    active?.terminate();worker.current=null;setBusy(false);
    if(event.data.result)setResult(event.data.result);
    else setError(event.data.error?.budget?'The check reached its limit. Try a shorter window.':'The window could not be checked. No uncertainty result is shown.');
   };
   active.onerror=()=>fail('The window could not be checked. No uncertainty result is shown.');
   active.onmessageerror=()=>fail('The window result could not be read. Try again.');
   active.postMessage({id,input:{at:utc,minutes,latitude,longitude,houseSystem}});
  }catch{fail('The window could not be checked. No uncertainty result is shown.');}
 }
 const formatter=useMemo(()=>new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'shortOffset',hourCycle:'h23'}),[timeZone]);
 const format=(date:Date)=>formatter.format(date);
 return <aside class="birth-window" data-birth-window>
  <p data-birth-window-summary role="status">{result?birthWindowSummary(result):'Check a window around the time used for this chart.'}</p>
  <details open={!result}>
   <summary>{result?'See the time window and changes':'Choose a time window'}</summary>
   <label class="birth-window__choice">The time may be off by
    <select value={minutes} onChange={event=>changeMinutes(Number(event.currentTarget.value))} aria-label="Minutes either side of the entered birth time">
     {[1,5,10,15,30,60,120].map(value=><option key={value} value={value}>{value} {value===1?'minute':'minutes'} either side</option>)}
    </select>
   </label>
   <p class="birth-window__note">The window counts elapsed minutes before and after {format(utc)}. Daylight-saving changes follow the birthplace’s clock.</p>
   <button type="button" class="btn btn--secondary" onClick={check} disabled={busy}>{busy?'Checking the window…':'Check this window'}</button>
   {busy&&<button type="button" class="btn btn--secondary" onClick={()=>{cancel();setBusy(false);}}>Cancel</button>}
   {error&&<p role="alert">{error}</p>}
   {result&&<>
    <p data-birth-window-verification>{result.verification}.</p>
    {result.flags.includes('polar-fallback')&&<p>The requested house system is undefined here; affected cells use whole-sign houses.</p>}
    {result.unresolved.length>0&&<p>Some node signs or houses could not be resolved. They are marked unresolved below.</p>}
    <p>Each share is the fraction of this window’s duration, assuming equal weight for every instant. It does not state how likely your birth time is.</p>
    <p>The displayed chart, saved chart and shared links still use the entered time. This window check does not replace that chart.</p>
    <details><summary>Sun, Moon, rising sign, houses and aspects ({result.cells.length} intervals)</summary>
     <ol class="birth-window__cells">{result.cells.map((cell,index)=><li key={index} class="birth-window__cell">
      <p class="mono"><time dateTime={cell.start.toISOString()}>{format(cell.start)}</time> to <time dateTime={cell.end.toISOString()}>{format(cell.end)}</time></p>
      <p>Start included; end excluded. Share of the window: {birthWindowShare(cell.share)}.</p>
      <dl><dt>Sun</dt><dd>{cell.features.signs.Sun===null?'unresolved':birthWindowSignName(cell.features.signs.Sun)}</dd><dt>Moon</dt><dd>{cell.features.signs.Moon===null?'unresolved':birthWindowSignName(cell.features.signs.Moon)}</dd><dt>Rising sign</dt><dd>{birthWindowSignName(cell.features.ascendant)}</dd><dt>House system</dt><dd>{cell.features.houseSystem}</dd></dl>
      <details><summary>Houses and aspects in this interval</summary>
       <dl>{Object.entries(cell.features.houses).map(([body,house])=><div key={body}><dt>{body}</dt><dd>{house??'unresolved'}</dd></div>)}</dl>
       {cell.features.aspects.length?<ul>{cell.features.aspects.map((aspect,i)=><li key={i}>{aspect.a} / {aspect.b}: {aspect.type}</li>)}</ul>:<p>No aspects within the engine’s configured orbs.</p>}
      </details>
     </li>)}</ol>
    </details>
    <details><summary>When features change ({result.switches.length} instants)</summary>
     {result.switches.length?<ol>{result.switches.map((change,index)=><li key={index}>
      <time class="mono" dateTime={change.at.toISOString()}>{format(change.at)}</time>
      <ul>{change.changes.map((feature,i)=><li key={i}>{birthWindowChange(feature)}</li>)}</ul>
     </li>)}</ol>:<p>No changes were found in this window.</p>}
    </details>
   </>}
  </details>
 </aside>;
}
