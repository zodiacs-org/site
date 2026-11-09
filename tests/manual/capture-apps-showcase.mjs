/** Capture the current released panels with synthetic examples. Never overwrite a public asset. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { findChromium, STABLE_CHROMIUM_ARGS } from '../visual/browser.mjs';
import { STUDIO_HTML } from '../../integrations/generated/chart-studio.mjs';
import { HOROSCOPES_HTML } from '../../integrations/generated/horoscopes.mjs';
import { OCCASIONS_HTML } from '../../integrations/generated/occasions.mjs';
const args=process.argv.slice(2);
const outArgument=args.includes('--out')?args[args.indexOf('--out')+1]:undefined;
assert.ok(outArgument&&!outArgument.startsWith('--'),'Use --out <new folder>');
const out=resolve(outArgument);
const source='https://zodiacs.org/mcp';
try{await access(out);throw Error('Output already exists. Use a fresh folder.');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(out,{recursive:true});
const hash=value=>createHash('sha256').update(value).digest('hex');
const images=[];
// Every example is synthetic. The comparison and wedding examples carry made-up first names,
// so the cards show names the way people ask for them instead of Person A and Person B.
const EXAMPLES={
 comparison:{tool:'get_compatibility',heading:'Lucía and Mateo',arguments:{a:{name:'Lucía',birthDate:'1990-05-03',time:'08:30',zone:'Europe/Madrid',latitude:40.4168,longitude:-3.7038,place:'Madrid, Spain'},b:{name:'Mateo',birthDate:'1992-08-10'}}},
 wedding:{tool:'get_occasion_sky',heading:'Lucía and Mateo',arguments:{occasion:'wedding',date:'2027-06-12',time:'17:00',zone:'Europe/Rome',latitude:43.7696,longitude:11.2558,place:'Florence, Italy',names:'Lucía and Mateo'}},
 horoscope:{tool:'get_horoscope',heading:'Leo',arguments:{sign:'leo',zone:'Asia/Bangkok'}},
};
const rpc=async(method,params,attempt=1)=>{
 const response=await fetch(source,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-06-18'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 if(response.status===429&&attempt<3){
  await new Promise(done=>setTimeout(done,Math.min(Number(response.headers.get('retry-after'))||30,60)*1000));
  return rpc(method,params,attempt+1);
 }
 assert.equal(response.status,200,method+' answered');
 const text=await response.text(),events=text.split('\n').filter(row=>row.startsWith('data: ')).map(row=>JSON.parse(row.slice(6)));
 const body=(events.length?events:[JSON.parse(text)]).find(message=>'result' in message||'error' in message);
 assert.ok(body,method+' returned a response');
 assert.equal(body.error,undefined,method+' succeeded');
 return body.result;
};
// Page previews: each card's artwork, sign discs, names and score (or tabs), whole and unclipped,
// padded with the card's own background to a fixed shape and faded where the card continues.
const regionsOf=name=>{
 const doc=element=>{const box=element.getBoundingClientRect();return{left:box.left+scrollX,top:box.top+scrollY,right:box.right+scrollX,bottom:box.bottom+scrollY};};
 // Portrait previews hug the card and run 72px past the last kept line, so the page's
 // "View full card" button sits on the faded part, never on the score or tabs.
 const card=document.querySelector('article.card'),edge=card?doc(card):{left:0,right:document.documentElement.clientWidth};
 const top=bottom=>({x:edge.left-6,y:0,w:edge.right-edge.left+12,h:bottom});
 if(name==='chart'){const area=doc(document.querySelector('section.chart-area'));return{preview:{x:area.left-16,y:area.top-16,w:area.right-area.left+32,h:area.bottom-area.top+32}};}
 if(name==='horoscope'){const career=[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Career');return{preview:top(doc(career).bottom+96)};}
 const regions={preview:top(doc(document.querySelector('.hero-row')).bottom+96)};
 if(name==='comparison')regions.hero=top(doc(document.querySelector('header.keepsake')).bottom+20);
 return regions;
};
const SHAPES={preview:4/5,hero:1};
const makePreview=async(png,region,shape,fade)=>{
 const {width:fullWidth,height:fullHeight}=await sharp(png).metadata();
 const left=Math.max(0,Math.round(region.x*2)),top=Math.max(0,Math.round(region.y*2));
 const width=Math.min(Math.round(region.w*2),fullWidth-left),height=Math.min(Math.round(region.h*2),fullHeight-top);
 const data=await sharp(png).extract({left:2,top:2,width:1,height:1}).raw().toBuffer();
 const [r,g,b]=data,background={r,g,b,alpha:1};
 const padX=width/height<shape?Math.round((height*shape-width)/2):0,padY=width/height<shape?0:Math.round((width/shape-height)/2);
 const W=width+2*padX,H=height+2*padY,fadeHeight=Math.round(H*0.14);
 const framed=await sharp(png).extract({left,top,width,height}).extend({left:padX,right:padX,top:padY,bottom:padY,background}).png().toBuffer();
 const veil=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${fadeHeight}"><defs><linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(${r},${g},${b})" stop-opacity="0"/><stop offset="1" stop-color="rgb(${r},${g},${b})" stop-opacity="1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`;
 const faded=fade?await sharp(framed).composite([{input:Buffer.from(veil),top:H-fadeHeight,left:0}]).png().toBuffer():framed;
 return sharp(faded).resize({width:Math.min(W,1200),withoutEnlargement:true}).webp({quality:90,effort:6}).toBuffer();
};
const browser=await chromium.launch({executablePath:await findChromium(),args:STABLE_CHROMIUM_ARGS,headless:true});
try{
 for(const [name,html,uri] of [['comparison',OCCASIONS_HTML,'ui://zodiacs/occasions-v8.html'],['wedding',OCCASIONS_HTML,'ui://zodiacs/occasions-v8.html'],['chart',STUDIO_HTML,'ui://zodiacs/chart-studio-v6.html'],['horoscope',HOROSCOPES_HTML,'ui://zodiacs/horoscopes-v6.html']]){
  assert.equal(hash(html),hash((await rpc('resources/read',{uri})).contents[0].text),name+' local HTML equals live resource');
  const width=name==='chart'?1000:375;
  const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:2,colorScheme:'dark',reducedMotion:'reduce',timezoneId:'Asia/Bangkok'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://zodiacs.org/assets/**',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   await route.fulfill({body:await readFile(new URL('../../public'+pathname,import.meta.url)),contentType:pathname.endsWith('.avif')?'image/avif':pathname.endsWith('.svg')?'image/svg+xml':'image/webp'});
  });
  await page.setContent(html);
  if(name==='chart'){
   await page.getByRole('button',{name:'See an example chart (not yours)',exact:true}).click();
   await page.getByRole('heading',{name:'Chart Studio',exact:true}).waitFor();
   await page.locator('.wheel-wrap svg').waitFor();
  }else{
   const example=EXAMPLES[name],result=await rpc('tools/call',{name:example.tool,arguments:example.arguments});
   assert.equal(result.structuredContent?.ok,true,name+' returned a card');
   await page.evaluate(result=>{window.openai={toolOutput:result.structuredContent,toolResponseMetadata:result._meta,theme:'dark'};window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:window.openai}}));},result);
   await page.getByRole('heading',{name:example.heading,exact:true}).first().waitFor();
  }
  await page.evaluate(async()=>{for(const image of document.images)image.loading='eager';await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getClientRects().length).map(i=>i.decode()));});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' no overflow');
  assert.deepEqual(errors,[],name+' browser errors');
  const png=await page.screenshot({fullPage:true});
  const bytes=await sharp(png).resize({width:name==='chart'?1600:750,withoutEnlargement:true}).webp({quality:92,effort:6}).toBuffer();
  const {width:pixelWidth,height}=await sharp(bytes).metadata();await writeFile(out+'/'+name+'.webp',bytes);
  const entry={name,file:name+'.webp',width:pixelWidth,height,bytes:bytes.length,sha256:hash(bytes),resourceUri:uri,htmlSha256:hash(html),synthetic:true,noBrowserErrors:true,noOverflow:true};
  for(const [variant,region] of Object.entries(await page.evaluate(regionsOf,name))){
   const preview=await makePreview(png,region,SHAPES[variant],name!=='chart');
   const meta=await sharp(preview).metadata(),file=name+'-'+variant+'.webp';
   await writeFile(out+'/'+file,preview);
   entry[variant]={file,width:meta.width,height:meta.height,bytes:preview.length,sha256:hash(preview)};
  }
  images.push(entry);
  await context.close();
 }
}finally{await browser.close();}
// The tour video and its poster come from tests/manual/record-apps-tour.mjs.
await writeFile(out+'/captures.json',JSON.stringify({capturedAt:new Date().toISOString(),syntheticExamples:true,source,images},null,2)+'\n');
console.log(JSON.stringify(images.map(({name,width,height,bytes,preview,hero})=>({name,width,height,bytes,preview:preview&&[preview.width,preview.height],hero:hero&&[hero.width,hero.height]}))));
