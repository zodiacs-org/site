/** Separate warm run of every allowed house system in every supported year.
 * Uses the generated, guarded production bundle. Local synthetic requests;
 * rate-limit calls are injected as allowed. No production service is called.
 */
import { createComputeApiHandler } from '../../../../../api/_compute/compute.mjs';
import { createLocalTimeModule } from '../../../../../api/_compute/local-time.mjs';
import { run } from '../../../../../scripts/lib/compute-api-harness';
import { HOUSE_SYSTEM_NAMES } from '../../../../../src/lib/compute-api/constants';
import { cpus } from 'node:os';
const handler=createComputeApiHandler({localTime:createLocalTimeModule(),env:{},rateLimit:async()=> 'allowed'});
const make=(year:number,houseSystem:string)=>({utc:`${year}-06-15T13:37:00Z`,latitude:59.9,longitude:10.7,houseSystem});
for(const system of HOUSE_SYSTEM_NAMES)await run(handler,{endpoint:'houses',body:make(2000,system)});
const cpu:number[]=[],wall:number[]=[];
for(let year=1800;year<=2199;year++)for(const system of HOUSE_SYSTEM_NAMES){
 const start=performance.now(),before=process.cpuUsage();
 const result=await run(handler,{endpoint:'houses',body:make(year,system)});
 const used=process.cpuUsage(before);cpu.push((used.user+used.system)/1000);wall.push(performance.now()-start);
 if(result.status!==200)throw Error('houses request failed');
}
const summarize=(values:number[])=>{values.sort((a,b)=>a-b);const at=(q:number)=>+values[Math.min(values.length-1,Math.ceil(values.length*q)-1)].toFixed(1);return{p50:at(.5),p95:at(.95),max:at(1)}};
console.log(JSON.stringify({measured:new Date().toISOString(),what:'separate warm houses sweep, generated production bundle, 13 systems in each year 1800–2199, injected admission',node:process.version,cpu:cpus()[0].model,requests:cpu.length,cpuMs:summarize(cpu),wallMs:summarize(wall)},null,2));
