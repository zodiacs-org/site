import type { CatalogLocale } from './i18n';
import { CATALOG_LOCALES } from './i18n';
import { CONTEXT_CONVENTION } from './chart-shape';
import type { ContextSection } from '../islands/explorer/chart-context-copy';
import { CONTEXT_SECTIONS } from '../islands/explorer/chart-context-copy';
import { drawShareBrandLockup, PORTRAIT_SHARE_CARD_BRAND_LAYOUT } from './share-card-brand';
import { downloadPreparedChartCard, type PreparedChartCard, type CardOutcome } from './share-card';

/** Only displayed section facts cross this boundary; never input/revision keys. */
export interface ChartContextCard {
  locale: CatalogLocale;
  section: ContextSection;
  title: string;
  lines: readonly string[];
  convention: typeof CONTEXT_CONVENTION;
}
export const CHART_CONTEXT_CARD_SIZE = Object.freeze({width:1080,height:1350});
export const downloadChartContextCard = downloadPreparedChartCard;
export async function shareChartContextCard(card:PreparedChartCard,isCurrent:()=>boolean):Promise<CardOutcome> {
  if(!isCurrent())return 'cancelled';
  const file=new File([card.blob],card.filename,{type:'image/png'});
  try {
    if(navigator.canShare?.({files:[file]})) {
      await navigator.share({files:[file]});return isCurrent()?'shared':'cancelled';
    }
  } catch(cause) { if((cause as DOMException)?.name==='AbortError')return 'cancelled'; }
  return isCurrent()?downloadPreparedChartCard(card):'cancelled';
}
const SERIF='"EB Garamond", Georgia, serif',SANS='"Instrument Sans", sans-serif';
function wrap(ctx:CanvasRenderingContext2D,text:string,width:number):string[] {
  const result:string[]=[];let line='';
  for(const word of text.split(/\s+/u)) {
    if(ctx.measureText(word).width>width)throw new Error('context_word_overflow');
    const next=line?`${line} ${word}`:word;
    if(ctx.measureText(next).width>width){result.push(line);line=word;}else line=next;
  }
  if(line)result.push(line);return result;
}
export async function prepareChartContextCard(payload:ChartContextCard,parent?:AbortSignal):Promise<PreparedChartCard> {
  if(!CATALOG_LOCALES.includes(payload.locale)||!CONTEXT_SECTIONS.includes(payload.section)||payload.convention!==CONTEXT_CONVENTION
    ||!payload.title||payload.title.length>160||payload.lines.length>60||payload.lines.some(x=>typeof x!=='string'||x.length>2000))throw new Error('context_card_invalid');
  // Reconstruct the permitted payload so extra runtime keys never affect a file.
  const facts={locale:payload.locale,section:payload.section,title:payload.title,lines:[...payload.lines],convention:payload.convention};
  const controller=new AbortController(),signal=controller.signal;
  let canvas:HTMLCanvasElement|undefined;
  let rejectStop!:(reason:unknown)=>void;
  const stopped=new Promise<never>((_,reject)=>{rejectStop=reject;});
  const stop=()=>{controller.abort(parent?.aborted?parent.reason:new Error('context_prepare_timeout'));rejectStop(signal.reason);};
  const cleanup=()=>{if(canvas){canvas.width=0;canvas.height=0;}};
  const timer=setTimeout(stop,15_000);parent?.addEventListener('abort',stop,{once:true});signal.addEventListener('abort',cleanup,{once:true});
  if(parent?.aborted)stop();
  try {
    return await Promise.race([Promise.resolve().then(async()=>{
      signal.throwIfAborted();
      const faces=await Promise.all([document.fonts.load(`500 50px ${SERIF}`),document.fonts.load(`500 24px ${SANS}`)]);
      signal.throwIfAborted();if(faces.some(list=>!list.length||list.some(face=>face.status!=='loaded')))throw new Error('context_fonts_unavailable');
      canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('context_canvas_unavailable');
      ctx.fillStyle='#060709';ctx.fillRect(0,0,1080,1350);ctx.fillStyle='#EEF1F7';ctx.textBaseline='top';
      ctx.font=`500 50px ${SERIF}`;const title=wrap(ctx,facts.title,952);
      if(title.length>2)throw new Error('context_title_overflow');title.forEach((line,i)=>ctx.fillText(line,64,62+i*56));
      const start=90+title.length*56;
      ctx.strokeStyle='#B9D4BE';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(64,start-12);ctx.lineTo(1016,start-12);ctx.stroke();
      // Short sections should use the portrait card's available space. Dense
      // ruler/chain sections retain the same minimum size and overflow guard.
      let rows:string[][]=[],size=42,height=0;
      for(;size>=22;size-=2){ctx.font=`500 ${size}px ${SANS}`;rows=facts.lines.map(line=>wrap(ctx,line,952));height=rows.reduce((total,r)=>total+r.length*(size+7)+10,0);if(start+height<=1210)break;}
      if(size<22)throw new Error('context_text_overflow');
      let y=start;ctx.fillStyle='#C6CCDA';
      for(const paragraph of rows){for(const line of paragraph){ctx.fillText(line,64,y);y+=size+7;}y+=10;}
      ctx.font=`500 18px ${SANS}`;ctx.fillStyle='#8E96AB';ctx.fillText(facts.convention,64,1238);
      // The brand lockup draws its own ring, so the card loads no image for it.
      drawShareBrandLockup(ctx,null,PORTRAIT_SHARE_CARD_BRAND_LAYOUT);
      const output=await new Promise<Blob>((resolve,reject)=>canvas!.toBlob(value=>value?resolve(value):reject(new Error('context_png_unavailable')),'image/png'));
      signal.throwIfAborted();
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(facts)));signal.throwIfAborted();
      const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('').slice(0,16);
      return {blob:output,filename:`zodiacs-${facts.section}-${facts.locale}-${hash}.png`};
    }),stopped]);
  } finally {clearTimeout(timer);parent?.removeEventListener('abort',stop);signal.removeEventListener('abort',cleanup);controller.abort();cleanup();}
}
