/// <reference lib="webworker" />
import {birthWindow,type BirthWindowInput} from '@zodiacs/engine/window';
self.onmessage=(event:MessageEvent<{id:number;input:BirthWindowInput}>)=>{
 const {id,input}=event.data;
 try{self.postMessage({id,result:birthWindow(input)});}
 catch(error){self.postMessage({id,error:{budget:error instanceof Error&&error.name==='WindowBudgetError'}});}
};
