/// <reference lib="webworker" />
import type {BirthWindowInput} from '@zodiacs/engine/window';
self.onmessage=async(event:MessageEvent<{id:number;input:BirthWindowInput;engineUrl:string}>)=>{
 const {id,input,engineUrl}=event.data;
 try{
  const url=new URL(engineUrl);
  if(url.origin!==self.location.origin)throw new TypeError('Invalid engine boundary origin');
  const engine=await import(/* @vite-ignore */ url.href);
  if(engine.browserEngineModuleUrl!==url.href||typeof engine.birthWindow!=='function')throw new TypeError('Invalid engine boundary module');
  const result=await engine.birthWindow(input);
  self.postMessage({id,result});
 }catch(error){self.postMessage({id,error:{budget:error instanceof Error&&error.name==='WindowBudgetError'}});}
};
