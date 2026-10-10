import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex'),observations=[];
let failure=null;
let footerSource=null;
async function get(url,limit=2*1024*1024){
 const response=await fetch(url,{redirect:'error',cache:'no-store',headers:{'user-agent':'Zodiacs.org-public-source-verification'},signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,new URL(url).pathname+' status');
 const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const n=await reader.read();if(n.done)break;size+=n.value.byteLength;assert.ok(size<=limit,'Response bound');chunks.push(n.value);}}finally{await reader.cancel();}
 const bytes=Buffer.concat(chunks);observations.push({url,status:response.status,bytes:bytes.length,sha256:hash(bytes)});return bytes;
}
try {
 const thesis=(await get('https://zodiacs.org/thesis/')).toString('utf8');
 const footer=[...thesis.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)].filter(m=>/\bdata-canonical-thesis-footer\b/.test(m[1]));assert.equal(footer.length,1);
 assert.match(process.env.EXPECTED_MERGE_SHA??'',/^[a-f0-9]{40}$/,'Exact accepted merge source');
 const footerSourceUrl='https://raw.githubusercontent.com/zodiacs-org/site/'+process.env.EXPECTED_MERGE_SHA+'/src/styles/site-footer.css';
 const expectedFooter=await get(footerSourceUrl);
 assert.equal(footer[0][2],expectedFooter.toString('utf8'),'Exact accepted-source canonical footer CSS');
 footerSource={url:footerSourceUrl,bytes:expectedFooter.length,sha256:hash(expectedFooter)};
 assert.ok(!/<link\b[^>]*href=["'][^"']*site-footer\.css(?:[?"'])/i.test(thesis));
 const preloadTags=[...thesis.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]).filter(t=>/rel=["']preload["']/i.test(t));
 assert.ok(!preloadTags.some(t=>/eb-garamond.*(?:500|italic)/i.test(t)));
 assert.ok(preloadTags.some(t=>t.includes('/assets/art/zodiac-clock-768.avif')&&/fetchpriority=["']high["']/.test(t)));
 for(const file of ['eb-garamond-latin-500-normal.woff2','eb-garamond-latin-400-italic.woff2'])assert.ok(thesis.includes('/fonts/'+file),'Retained existing font face');
 const styles=[...thesis.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
 assert.match(styles,/\.essay__rail\s+\.label\s*\{\s*line-height:\s*1\.6\s*;?\s*\}/);
 const heroScripts=[...thesis.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/\b(?:src|type)\s*=/.test(m[1])&&m[2].includes('.hero video.hero__media'));
 assert.equal(heroScripts.length,1);assert.equal(Buffer.byteLength(heroScripts[0][2]),23686);assert.equal(hash(heroScripts[0][2]),'e5bfa20e13b187ba081be6175250513534185cb3f212ff2f91e46e335cebe169');
 const video=thesis.match(/<video\b[^>]*class=["'][^"']*hero__media[^"']*["'][^>]*>/i)?.[0];assert.ok(video);
 for(const name of ['muted','loop','playsinline'])assert.match(video,new RegExp('\\b'+name+'(?:\\s|>|=)'));
 assert.match(video,/\bpreload=["']none["']/);assert.match(video,/\bfetchpriority=["']high["']/);assert.ok(!/\bautoplay\b/.test(video));
 const poster=video.match(/\bposter=["']([^"']+)["']/)?.[1];assert.ok(poster);
 const mediaSource=thesis.match(/<source\b[^>]*src=["']([^"']+\.mp4(?:\?[^"']*)?)["']/)?.[1];assert.ok(mediaSource);
 for(const [path,size,gitSha] of [[poster,13476,'6d72c93a29ab53dfb9e0d641b64792a37953b266'],[mediaSource,2136544,'c8af06736dfc26fe7eb29a08776d206496ffdfe6']]){
  const url=new URL(path,'https://zodiacs.org');assert.equal(url.origin,'https://zodiacs.org');const bytes=await get(url.href,4*1024*1024);assert.equal(bytes.length,size);const actual=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');assert.equal(actual,gitSha);observations.at(-1).gitBlobSha1=actual;
 }
 const frozen=[
 ['items.json',64964,'8521a288178929e18f9598bda34d7c70f975e9b168a4b7107920ee657f6fe532'],
 ['key.json',100497,'4d1ec5f76cce20830962d9bb0c876ad03fc85a9ace8a24a78f28ff4bd36abcb2'],
 ['tool-answers.json',793254,'7477701a8aeb90b23fe5102b66696017f02a47c1a7f131a91937c536f8ac092c'],
 ['scorer.mjs',25047,'728355f27bccf8713b09125f08044895c85e66b54edc77c7eea4e39c0df28217']
 ];
 for(const [file,size,digest] of frozen){const bytes=await get('https://zodiacs.org/developers/sky-benchmark/v0/'+file);assert.equal(bytes.length,size);assert.equal(hash(bytes),digest);}
 const archive=await get('https://raw.githubusercontent.com/zodiacs-org/engine/e790362bddf28016405df4164e66baea057c4f19/artifacts/zodiacs-engine-1.0.0-rc.2.tgz',4*1024*1024);
 assert.equal(archive.length,287011);assert.equal(hash(archive),'4cd834b2dca085cd5732ecad6edbd82b61d7625d9a0647900c160a0747810002');
 const engine=(await get('https://zodiacs.org/developers/engine/')).toString('utf8');
 for(const text of ['1.0.0-rc.2','4cd834b2dca085cd5732ecad6edbd82b61d7625d9a0647900c160a0747810002','7fa964d2a77d09dbb819b5733b36e303fc7fc513'])assert.ok(engine.includes(text),'Engine source/archive identity');
 const openapi=JSON.parse(await get('https://zodiacs.org/api/v1/openapi.json'));assert.equal(openapi.openapi,'3.1.0');
 assert.equal(Object.values(openapi.paths).filter(v=>v.get).length,11);assert.equal(Object.values(openapi.paths).filter(v=>v.post).length,7);
} catch(error){failure={name:error.name,message:String(error.message).slice(0,1000)};}
const report={schema:'zodiacs.checkpoint23-production-source.v1',observedAt:new Date().toISOString(),expectedMergedSource:process.env.EXPECTED_MERGE_SHA,producer:{source:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,node:process.version},footerSource,observations,passed:failure===null&&observations.length===11,failure,limitations:['Eleven anonymous GET observations including the exact merged source canonical footer CSS; 11 GET and seven POST are OpenAPI operation counts, not requests made.','Source assets and advertised metadata only; no browser timing, private clearance, independent accuracy, registry publication or assistant trial claim.','Exact deployment source and domain assignment require separate Vercel metadata verification.']};
const path='docs/platform/evidence/checkpoint23-20261009/production-source-observation.json',bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');mkdirSync('docs/platform/evidence/checkpoint23-20261009',{recursive:true});writeFileSync(path,bytes);
console.log('PROGRAMME_FILE '+JSON.stringify({path,size:bytes.length,sha256:hash(bytes),base64:bytes.toString('base64')}));
if(!report.passed)process.exitCode=1;
