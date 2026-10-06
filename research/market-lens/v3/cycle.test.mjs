import {it,expect} from 'vitest';
import {planCycle} from './cycle.mjs';
import {hash} from './runtime.mjs';
it('schedules upcoming sessions and eligible unsettled receipts, without backfilling missed decisions',()=>{
 const p={start:'2030-01-01T00:00:00Z',endExclusive:'2030-07-01T00:00:00Z',leadSeconds:900,publicationDelaySeconds:300,assets:[{id:'test',sessions:[{id:'past',open:1893456000,close:1893457000},{id:'soon',open:1893459600,close:1893463200},{id:'late',open:1893458000,close:1893459000}]}]};
 const has=key=>key===`${hash('test').slice(0,16)}-past`;
 expect(planCycle(p,1893457800,has,()=>false).map(t=>[t.kind,t.session])).toEqual([['settle','past'],['record-witness','soon']]);
 expect(planCycle(p,1893457800,()=>false,()=>false).map(t=>t.session)).toEqual(['soon']);
 expect(planCycle(p,1893457800,has,()=>true).map(t=>t.session)).toEqual(['soon']);
});
