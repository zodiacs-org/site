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
const args=process.argv.slice(2);
const option=name=>args[args.indexOf('--'+name)+1];
assert.ok(args.includes('--out')&&args.includes('--preflight'),'Use --out <new folder> --preflight <live preflight folder>');
const out=resolve(option('out')), preflight=resolve(option('preflight'));
try{await access(out);throw Error('Output already exists. Use a fresh folder.');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(out,{recursive:true});
const hash=value=>createHash('sha256').update(value).digest('hex');
const images=[];
for(const [name,file] of [['comparison','zodiacs-comparison-card-0.5.1.png'],['wedding','zodiacs-wedding-card-0.5.1.png']]){
 const source=await readFile(new URL('../../public/assets/ai/review/'+file,import.meta.url));
 const bytes=await sharp(source).webp({quality:92,effort:6}).toBuffer();
 await writeFile(out+'/'+name+'.webp',bytes);
 const {width,height}=await sharp(bytes).metadata();images.push({name,file:name+'.webp',width,height,bytes:bytes.length,sha256:hash(bytes),source:'/assets/ai/review/'+file,sourceSha256:hash(source)});
}
const report=JSON.parse(await readFile(preflight+'/preflight.json','utf8'));
const browser=await chromium.launch({executablePath:await findChromium(),args:STABLE_CHROMIUM_ARGS,headless:true});
try{
 for(const [name,html,uri] of [['chart',STUDIO_HTML,'ui://zodiacs/chart-studio-v6.html'],['horoscope',HOROSCOPES_HTML,'ui://zodiacs/horoscopes-v6.html']]){
  assert.equal(hash(html),report.resources.find(r=>r.uri===uri)?.sha256,name+' local HTML equals live resource');
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
   const result=JSON.parse(await readFile(preflight+'/get_horoscope.json','utf8'));
   await page.evaluate(result=>{window.openai={toolOutput:result.structuredContent,toolResponseMetadata:result._meta,theme:'dark'};window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:window.openai}}));},result);
   await page.getByRole('heading',{name:'Leo',exact:true}).waitFor();
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
const posterPng=execFileSync('ffmpeg',['-v','error','-ss','6','-i',new URL('../../public/assets/ai/review/zodiacs-sky-0.5.1.mp4',import.meta.url).pathname,'-frames:v','1','-vf','scale=648:-1','-f','image2pipe','-vcodec','png','pipe:1'],{maxBuffer:10_000_000});
const poster=await sharp(posterPng).webp({quality:88}).toBuffer();
await writeFile(out+'/demo-poster.webp',poster);
const posterMeta=await sharp(poster).metadata();
const demoPoster={file:'demo-poster.webp',width:posterMeta.width,height:posterMeta.height,bytes:poster.length,sha256:hash(poster),source:'/assets/ai/review/zodiacs-sky-0.5.1.mp4',atSeconds:6};
await writeFile(out+'/captures.json',JSON.stringify({demoPoster,capturedAt:new Date().toISOString(),syntheticExamples:true,source:'https://zodiacs.org/mcp',images},null,2)+'\n');
console.log(JSON.stringify(images.map(({name,width,height,bytes})=>({name,width,height,bytes}))));
