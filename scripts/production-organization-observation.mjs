import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const checker=readFileSync('./scripts/organization-identity.mjs');
assert.equal(hash(checker),'4bed7177cdffa26f83a6232f69e12902147da54165bc86075c8d0cae2f75ea38');
const {organizationIdentityErrors,ORGANIZATION_ID}=await import('./scripts/organization-identity.mjs');
const paths=['/','/es/','/pt/','/fr/','/it/','/ru/','/developers/','/developers/engine/','/developers/mcp/','/developers/compute/','/developers/conformance/','/developers/sky-benchmark/','/about/','/astrofolio/','/terminal/','/thesis/'];
const observations=[];
let failure=null;
try {
 for(const path of paths){
  const response=await fetch('https://zodiacs.org'+path,{redirect:'error',cache:'no-store',headers:{accept:'text/html','user-agent':'Zodiacs.org-public-organization-verification'},signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,path+' status');
  const chunks=[],reader=response.body.getReader();let size=0;
  try{for(;;){const n=await reader.read();if(n.done)break;size+=n.value.byteLength;assert.ok(size<=2*1024*1024,'HTML response bound');chunks.push(n.value);}}
  finally{await reader.cancel();}
  const bytes=Buffer.concat(chunks),html=bytes.toString('utf8'),nodes=[];
  for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
   const doc=JSON.parse(match[1]);nodes.push(...(Array.isArray(doc)?doc:doc['@graph']??[doc]));
  }
  const errors=organizationIdentityErrors(nodes,{required:path!=='/thesis/'});
  const references=[];
  const seen=new Set();
  function collect(v){if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);if(v['@id']===ORGANIZATION_ID)references.push({id:v['@id'],type:v['@type']??null,name:v.name??null,url:v.url??null,sameAs:v.sameAs??null});for(const c of Object.values(v))collect(c);}
  nodes.forEach(collect);
  observations.push({path,status:response.status,bytes:bytes.length,sha256:hash(bytes),entityReferences:references,errors});
  assert.ok(references.length>0,path+' common identity reference');assert.deepEqual(errors,[],path+' Organization identity');
 }
} catch(error){failure={name:error.name,message:String(error.message).slice(0,1000)};}
const report={schema:'zodiacs.production-organization-identities.v1',observedAt:new Date().toISOString(),expectedMergedSource:process.env.EXPECTED_MERGE_SHA,producer:{source:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,node:process.version},checkerSha256:hash(checker),observations,passed:failure===null&&observations.length===paths.length,failure,limitations:['Anonymous canonical HTML observations only; deployment source and domain assignment require separate Vercel metadata verification.','No account authentication, package installation, private clearance or publication claim.']};
const path='docs/platform/evidence/platform-identities-20261009/production-observation.json',bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');mkdirSync('docs/platform/evidence/platform-identities-20261009',{recursive:true});writeFileSync(path,bytes);
console.log('PROGRAMME_FILE '+JSON.stringify({path,size:bytes.length,sha256:hash(bytes),base64:bytes.toString('base64')}));
if(!report.passed)process.exitCode=1;
