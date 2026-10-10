import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const observations=[];
function ownedLink(value){
 if(typeof value!=='string')return false;
 try{const url=new URL(value.replace(/^git\+/,'').replace(/\.git$/,''));return !url.username&&!url.password&&url.protocol==='https:'&&(url.hostname==='zodiacs.org'||url.hostname==='www.zodiacs.org'||(url.hostname==='github.com'&&/^\/zodiacs-org\/(engine|site|sdk)(?:\/|$)/i.test(url.pathname)));}
 catch{return false;}
}

async function publicJson(url){
 const response=await fetch(url,{redirect:'error',cache:'no-store',headers:{accept:'application/json','user-agent':'Zodiacs.org-public-identity-observation'},signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,200,'Published identity status');
 const reader=response.body.getReader(),chunks=[];let count=0;
 try{for(;;){const next=await reader.read();if(next.done)break;count+=next.value.byteLength;assert.ok(count<=2*1024*1024,'Metadata response too large');chunks.push(next.value);}}
 finally{await reader.cancel();}
 const bytes=Buffer.concat(chunks);return {json:JSON.parse(bytes),observed:{url,status:200,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}};
}
const repo=await publicJson('https://api.github.com/repos/zodiacs-org/engine');
assert.equal(repo.json.full_name,'zodiacs-org/engine');assert.equal(repo.json.private,false);assert.equal(repo.json.html_url,'https://github.com/zodiacs-org/engine');
observations.push({...repo.observed,identityUrl:repo.json.html_url,name:repo.json.full_name,public:true});
const npm=await publicJson('https://registry.npmjs.org/@zodiacs%2fengine/latest');
assert.equal(npm.json.name,'@zodiacs/engine');assert.match(npm.json.version,/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);assert.ok(npm.json.dist?.tarball);
const npmRepository=typeof npm.json.repository==='string'?npm.json.repository:npm.json.repository?.url;
assert.ok(ownedLink(npmRepository)||ownedLink(npm.json.homepage),'npm metadata must link to the known organization');
observations.push({...npm.observed,identityUrl:'https://www.npmjs.com/package/@zodiacs/engine',name:npm.json.name,version:npm.json.version,license:npm.json.license,tarball:npm.json.dist.tarball,repository:npmRepository??null,homepage:npm.json.homepage??null,associationChecked:true});
const python=await publicJson('https://pypi.org/pypi/zodiacs/json');
assert.equal(python.json.info.name,'zodiacs');assert.ok(python.json.info.version);assert.ok(python.json.urls.length>0);
const pythonProjectUrls=python.json.info.project_urls??{};
assert.ok(ownedLink(python.json.info.home_page)||Object.values(pythonProjectUrls).some(ownedLink),'PyPI metadata must link to the known organization');
observations.push({...python.observed,identityUrl:'https://pypi.org/project/zodiacs/',name:python.json.info.name,version:python.json.info.version,projectUrl:python.json.info.project_url,homepage:python.json.info.home_page??null,projectUrls:pythonProjectUrls,associationChecked:true});
const report={schema:'zodiacs.published-platform-identities.v1',observedAt:new Date().toISOString(),producer:{source:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,node:process.version},observations,passed:true,limitations:['Public metadata existence and organization cross-links; not publisher-account authentication, package installation, archive/provenance verification or stable publication.','Only existing identities are listed; MCP Registry publication remains unfinished.','No private scanner, credentials, access or infrastructure change.']};
const content=Buffer.from(JSON.stringify(report,null,2)+'\n'),path='platform-identities-association.json';
writeFileSync(path,content);console.log('PROGRAMME_FILE '+JSON.stringify({path:'docs/platform/evidence/platform-identities-20261009/association.json',size:content.length,sha256:createHash('sha256').update(content).digest('hex'),base64:content.toString('base64')}));
