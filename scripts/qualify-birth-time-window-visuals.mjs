import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
const main=process.env.QUALIFIED_MAIN;
assert.match(main??'',/^[a-f0-9]{40}$/);
assert.equal(process.platform,'linux','This prepared reference protocol is Linux-only');
const originalPath='tests/visual/visual-regression.mjs',original=readFileSync(originalPath,'utf8');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readMain=path=>execFileSync('git',['show',main+':'+path],{maxBuffer:32*1024*1024});
assert.deepEqual(Buffer.from(original),readMain(originalPath),'Original visual driver is unchanged');
const calculatorDiff=execFileSync('git',['diff','--unified=0',main,'--','src/islands/ChartCalculator.tsx'],{encoding:'utf8'});
const lines=calculatorDiff.split('\n');
assert.equal(lines.filter(line=>line.startsWith('-')&&!line.startsWith('---')).length,0,'Calculator calculation/ownership source is not removed or replaced');
assert.deepEqual(lines.filter(line=>line.startsWith('+')&&!line.startsWith('+++')).map(line=>line.slice(1)),["import { BirthTimeWindowEntry } from './BirthTimeWindowEntry';","          {locale === 'en' && mode === 'full' && chart.input.timeKnown","            && !chart.flags.includes('no-time') && computedInput && (","            <BirthTimeWindowEntry key={String(chartContextIdRef.current)}","              utc={chart.input.utc} latitude={computedInput.city.lat} longitude={computedInput.city.lon}","              houseSystem={chart.input.houseSystem} />","          )}"],'Only the known optional entry is added to the existing calculator');
const baselineRoot='tests/visual/baselines/linux/',stems=['birth-chart-kahlo-desktop','birth-chart-kahlo-mobile','birth-chart-kahlo-desktop-reduced-motion'];
const before=new Map(stems.map(stem=>[stem,readMain(baselineRoot+stem+'.png')]));
const probe="\nasync function birthWindowGeometry(page,testCase){\n if(!testCase.result)return;\n const observed=await page.evaluate(()=>{\n  const entries=[...document.querySelectorAll('[data-birth-window-entry]')];\n  if(entries.length!==1)throw new Error('One visible optional uncertainty entry is required');\n  const entry=entries[0],button=entry.querySelector('button');\n  if(!button||button.textContent!=='Check a time window')throw new Error('Expected unopened uncertainty action');\n  if(document.querySelector('[data-birth-window]'))throw new Error('The window surface must remain unopened');\n  if(!entry.previousElementSibling||!entry.nextElementSibling)throw new Error('Bounded insertion needs adjacent elements');\n  const rect=element=>{const r=element.getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY,left:r.left,right:r.right,width:r.width,height:r.height};};\n  return {entry:rect(entry),previous:rect(entry.previousElementSibling),next:rect(entry.nextElementSibling),text:entry.textContent,viewport:innerWidth,documentWidth:document.documentElement.scrollWidth};\n });\n await writeFile(resolve(artifactRoot,fileStem(testCase)+'.b2-geometry.json'),JSON.stringify(observed,null,2));\n}\n";

const anchor='  await settlePage(page, testCase);';
assert.equal(original.split(anchor).length,2);
const instrumented=original.replace(anchor,anchor+'\n  await birthWindowGeometry(page,testCase);')+probe;
const prefixSuffix=[],unchanged=[];
function region(expected,actual,oldY,newY,height){
 assert.ok(height>0&&oldY>=0&&newY>=0&&oldY+height<=expected.height&&newY+height<=actual.height);
 const a=new PNG({width:expected.width,height}),b=new PNG({width:actual.width,height});
 const row=expected.width*4;
 for(let y=0;y<height;y++){
  a.data.set(expected.data.subarray((oldY+y)*row,(oldY+y+1)*row),y*row);
  b.data.set(actual.data.subarray((newY+y)*row,(newY+y+1)*row),y*row);
 }
 const differences=pixelmatch(a.data,b.data,null,a.width,a.height,{threshold:0.1,includeAA:false});
 return {oldY,newY,height,pixels:a.width*a.height,differences,ratio:differences/(a.width*a.height)};
}
try{
 writeFileSync(originalPath,instrumented);
 execFileSync(process.execPath,[originalPath,'--update'],{stdio:'inherit',env:{...process.env,VISUAL_ROUTES:'birth-chart-kahlo'}});
}finally{writeFileSync(originalPath,original);}
assert.equal(sha(readFileSync(originalPath)),sha(Buffer.from(original)),'Read-only probe is removed before the actual full comparison');
for(const stem of stems){
 const path=baselineRoot+stem+'.png',bytes=readFileSync(path),expected=PNG.sync.read(before.get(stem)),actual=PNG.sync.read(bytes);
 const geometry=JSON.parse(readFileSync('tests/visual/artifacts/visual/'+stem+'.b2-geometry.json','utf8'));
 assert.equal(actual.width,expected.width);assert.equal(geometry.documentWidth,geometry.viewport);
 const delta=actual.height-expected.height;assert.ok(delta>0,'The intentional added entry increases this complete chart height');
 assert.ok(geometry.entry.height>0&&geometry.entry.left>=-1&&geometry.entry.right<=geometry.viewport+1);
 assert.ok(geometry.previous.bottom<=geometry.entry.top+1&&geometry.next.top>=geometry.entry.bottom-1);
 const prefixHeight=Math.floor(geometry.previous.bottom),afterY=Math.ceil(geometry.next.top);
 const prefix=region(expected,actual,0,0,prefixHeight);
 const suffix=region(expected,actual,afterY-delta,afterY,actual.height-afterY);
 assert.ok(prefix.ratio<=0.001,'Before the insertion stays within the original 0.1% pixel budget');
 assert.ok(suffix.ratio<=0.001,'After the insertion stays within the original 0.1% pixel budget after aligning its measured height change');
 prefixSuffix.push({stem,previousDimensions:{width:expected.width,height:expected.height},actualDimensions:{width:actual.width,height:actual.height},addedHeight:delta,geometry,prefix,suffix,path,bytes:bytes.length,sha256:sha(bytes),previousSha256:sha(before.get(stem))});
}
const all=['home','birth-chart-kahlo','aries','events-hub','event-full-moon'].flatMap(name=>[name+'-desktop',name+'-mobile',name+'-desktop-reduced-motion']);
for(const stem of all.filter(stem=>!stems.includes(stem))){
 const path=baselineRoot+stem+'.png',old=readMain(path);
 assert.deepEqual(readFileSync(path),old,'Unrelated original visual reference remains exact');
 unchanged.push({path,bytes:old.length,sha256:sha(old)});
}
const darwinUnchanged=all.map(stem=>{
 const path='tests/visual/baselines/darwin/'+stem+'.png',old=readMain(path);
 assert.deepEqual(readFileSync(path),old,'Every Darwin reference remains exact');
 return {path,bytes:old.length,sha256:sha(old)};
});
execFileSync(process.execPath,[originalPath],{stdio:'inherit',env:{...process.env,VISUAL_ROUTES:''}});
const report={schema:'zodiacs.birth-time-window-visual-insertion.v1',producer:{source:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,node:process.version},checkedOutSource:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),qualifiedMain:main,originalDriver:{path:originalPath,sha256:sha(Buffer.from(original)),probeSha256:sha(Buffer.from(probe)),restoredBeforeFullComparison:true},prefixSuffix,unchangedReferences:unchanged,darwinUnchanged,originalFullImageComparison:{cases:15,tolerance:0.001,passed:true},limitations:['The region comparisons diagnose the predefined entry insertion, without replacing the final original fifteen-case full-image gate.','Only three intended Linux birth-chart references are refreshed; twelve unrelated Linux and every Darwin reference remain unchanged.','No browser timing or independent numerical accuracy claim.']};
const path='docs/platform/evidence/birth-time-window-ui-20261010/visual-insertion.json',bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');mkdirSync('docs/platform/evidence/birth-time-window-ui-20261010',{recursive:true});writeFileSync(path,bytes);
console.log('PROGRAMME_FILE '+JSON.stringify({path,size:bytes.length,sha256:sha(bytes),base64:bytes.toString('base64')}));
