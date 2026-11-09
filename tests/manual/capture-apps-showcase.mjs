/** Capture the current released panels with synthetic examples. Never overwrite a public asset. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { findChromium, STABLE_CHROMIUM_ARGS } from '../visual/browser.mjs';
import { STUDIO_HTML } from '../../integrations/generated/chart-studio.mjs';
import { HOROSCOPES_HTML } from '../../integrations/generated/horoscopes.mjs';
import { OCCASIONS_HTML } from '../../integrations/generated/occasions.mjs';
const args=process.argv.slice(2);
assert.ok(args.includes('--out'),'Use --out <new folder>');
const out=resolve(args[args.indexOf('--out')+1]);
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
const rpc=async(method,params)=>{
 const response=await fetch(source,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-06-18'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 assert.equal(response.status,200,method+' answered');
 const text=await response.text(),line=text.split('\n').find(row=>row.startsWith('data: '));
 const body=JSON.parse(line?line.slice(6):text);
 assert.equal(body.error,undefined,method+' succeeded');
 return body.result;
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
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getClientRects().length).map(i=>i.decode()));});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' no overflow');
  assert.deepEqual(errors,[],name+' browser errors');
  const png=await page.screenshot({fullPage:true});
  const bytes=await sharp(png).resize({width:name==='chart'?1600:750,withoutEnlargement:true}).webp({quality:92,effort:6}).toBuffer();
  const {width:pixelWidth,height}=await sharp(bytes).metadata();await writeFile(out+'/'+name+'.webp',bytes);
  images.push({name,file:name+'.webp',width:pixelWidth,height,bytes:bytes.length,sha256:hash(bytes),resourceUri:uri,htmlSha256:hash(html),synthetic:true,noBrowserErrors:true,noOverflow:true});
  await context.close();
 }
}finally{await browser.close();}
// The poster is the movie's wedding card, which carries no Person A and Person B labels.
const POSTER_AT=30;
const posterPng=execFileSync('ffmpeg',['-v','error','-ss',String(POSTER_AT),'-i',new URL('../../public/assets/ai/review/zodiacs-sky-0.5.1.mp4',import.meta.url).pathname,'-frames:v','1','-vf','scale=648:-1','-f','image2pipe','-vcodec','png','pipe:1'],{maxBuffer:10_000_000});
const poster=await sharp(posterPng).webp({quality:88}).toBuffer();
await writeFile(out+'/demo-poster.webp',poster);
const posterMeta=await sharp(poster).metadata();
const demoPoster={file:'demo-poster.webp',width:posterMeta.width,height:posterMeta.height,bytes:poster.length,sha256:hash(poster),source:'/assets/ai/review/zodiacs-sky-0.5.1.mp4',atSeconds:POSTER_AT};
await writeFile(out+'/captures.json',JSON.stringify({demoPoster,capturedAt:new Date().toISOString(),syntheticExamples:true,source,images},null,2)+'\n');
console.log(JSON.stringify(images.map(({name,width,height,bytes})=>({name,width,height,bytes}))));
