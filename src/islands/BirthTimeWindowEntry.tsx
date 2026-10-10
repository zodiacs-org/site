import {useEffect,useRef,useState} from 'preact/hooks';
import type {BirthTimeWindowProps} from './BirthTimeWindow';
type Surface=typeof import('./BirthTimeWindow');
/** Keep the optional window surface outside the calculator's initial closure. */
export function BirthTimeWindowEntry(props:BirthTimeWindowProps){
 const [surface,setSurface]=useState<Surface|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function open(){
  if(busy)return;setBusy(true);setError(false);
  try{const module=await import('./BirthTimeWindow');if(mounted.current)setSurface(module);}
  catch{if(mounted.current)setError(true);}
  finally{if(mounted.current)setBusy(false);}
 }
 if(surface)return <surface.BirthTimeWindow {...props}/>;
 return <aside data-birth-window-entry style={{display:'grid',gap:'0.75rem'}}>
  <p style={{margin:0,lineHeight:'1.5rem'}}>If your birth time is approximate, check which parts of the chart could change.</p>
  <button type="button" class="btn btn--secondary" style={{justifySelf:'start',margin:0,lineHeight:'1.5rem'}} onClick={open} disabled={busy}>{busy?'Opening…':'Check a time window'}</button>
  {error&&<p role="status">The window check could not open. Try again.</p>}
 </aside>;
}
