import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildChartContext, type ChartContextInput } from '../../lib/chart-context';
import type { CatalogLocale } from '../../lib/i18n';
import { planetLabel } from '../../lib/i18n/astrology';
import { entityId, type EntityRef, type SignSlug } from '../../lib/scene/types';
import { signBySlug, signName } from '../../lib/signs';
import type { BodyName } from '../../lib/engine/types';
import { CONTEXT_COPY, CONTEXT_SECTIONS, SHAPE_RULE_COPY, DIGNITY_RULE_COPY, contextSectionLines, type ContextSection } from './chart-context-copy';
import { loadModule } from '../../lib/module-load';
import type { PreparedChartCard } from '../../lib/share-card';
import type { ChartContextCard } from '../../lib/chart-context-card';
import { chartForImage, type ChartImageSource } from '../../lib/chart-image-sky';
import CalculationReload, { calculationLoadMessage } from '../CalculationReload';
import './ChartContext.css';

export interface ChartContextProps {
  input: ChartContextInput;
  locale: CatalogLocale;
  inputRevision: number;
  isInputCurrent: (revision: number) => boolean;
  selection: EntityRef | null;
  onShowOnChart: (entity: EntityRef, behavior: 'instant') => void;
  /**
   * The chart a section image is drawn from, as share-card's imageChart draws
   * it, so it shows no more than the chart's link. Absent, the image is the page's.
   */
  imageOf?: ChartImageSource;
}

/** A section's lines as its image shows them: from the chart an image draws (imageOf). */
async function imageLines(props: ChartContextProps, section: ContextSection, model: ReturnType<typeof buildChartContext>): Promise<string[]> {
  if (!props.imageOf) return contextSectionLines(model, section, props.locale);
  const drawn = await chartForImage(props.imageOf);
  return contextSectionLines(buildChartContext({
    bodies: drawn.bodies, timeKnown: props.input.timeKnown, moonSignCandidates: drawn.moonSignCandidates,
    angles: drawn.angles, houses: drawn.houses,
  }), section, props.locale);
}
/** Full-result-only context; the original reading and wheel keep their owners. */
export default function ChartContext(props: ChartContextProps) {
  const model=useMemo(()=>buildChartContext(props.input),[props.input]);
  const c=CONTEXT_COPY[props.locale];
  const source=JSON.stringify([model.identity,props.locale,props.inputRevision]);
  const sourceRef=useRef(source);sourceRef.current=source;
  const sections=useRef<Partial<Record<ContextSection,HTMLDetailsElement>>>({});
  const mounted=useRef(false),generation=useRef(0),controller=useRef<AbortController|null>(null);
  const preview=useRef<string|null>(null),pendingShare=useRef(false);
  const active=useRef<ContextSection|null>(null);
  type Renderer=typeof import('../../lib/chart-context-card');
  const [view,setView]=useState<{source:string;section:ContextSection;card?:PreparedChartCard;renderer?:Renderer;url?:string;busy:boolean;message:string;error:string;reload?:boolean}|null>(null);
  function release(){generation.current+=1;controller.current?.abort();controller.current=null;if(preview.current)URL.revokeObjectURL(preview.current);preview.current=null;pendingShare.current=false;}
  useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;release();};},[]);
  useLayoutEffect(()=>{setView(null);active.current=null;return release;},[source]);
  function owns(request:number,section:ContextSection){return mounted.current&&sourceRef.current===source&&generation.current===request
    &&active.current===section&&props.isInputCurrent(props.inputRevision)&&sections.current[section]?.open===true;}
  function close(section:ContextSection,restoreFocus=true){
    if(active.current!==section)return;release();active.current=null;setView(null);
    if(restoreFocus)sections.current[section]?.querySelector<HTMLButtonElement>('[data-context-create]')?.focus({preventScroll:true});
  }
  async function prepare(section:ContextSection){
    if(!mounted.current||sourceRef.current!==source||!props.isInputCurrent(props.inputRevision)||!sections.current[section]?.open
      ||(active.current===section&&controller.current))return;
    release();active.current=section;const request=generation.current;
    const abort=new AbortController();controller.current=abort;
    setView({source,section,busy:true,message:c.preparing,error:''});
    const card={locale:props.locale,section,title:c[section],convention:model.convention};
    let rejectStop!:(cause:unknown)=>void;
    const stopped=new Promise<never>((_,reject)=>{rejectStop=reject;});
    const onAbort=()=>rejectStop(abort.signal.reason);abort.signal.addEventListener('abort',onAbort,{once:true});
    const timer=setTimeout(()=>abort.abort(new Error('context_image_timeout')),15_000);
    let importing=true;
    try{
      const result=await Promise.race([Promise.resolve().then(async()=>{
        abort.signal.throwIfAborted();const [renderer,lines]=await Promise.all([loadModule(()=>import('../../lib/chart-context-card')),imageLines(props,section,model)]);
        abort.signal.throwIfAborted();importing=false;const payload:ChartContextCard={...card,lines};
        const image=await renderer.prepareChartContextCard(payload,abort.signal);
        abort.signal.throwIfAborted();return {renderer,card:image};
      }),stopped]);
      if(!owns(request,section))return;
      const url=URL.createObjectURL(result.card.blob);preview.current=url;
      setView({source,section,...result,url,busy:false,message:c.ready,error:''});
    }catch{if(owns(request,section))setView({source,section,busy:false,message:'',error:c.failed,reload:importing});}
    finally{clearTimeout(timer);abort.signal.removeEventListener('abort',onAbort);abort.abort();if(generation.current===request)controller.current=null;}
  }
  async function deliver(download:boolean){
    if(!view?.card||!view.renderer||view.source!==source||pendingShare.current)return;
    const request=generation.current,section=view.section;if(!owns(request,section))return;
    pendingShare.current=true;setView({...view,busy:true,message:'',error:''});
    try{
      const outcome=download?view.renderer.downloadChartContextCard(view.card):await view.renderer.shareChartContextCard(view.card,()=>owns(request,section));
      if(owns(request,section))setView({...view,busy:false,message:outcome==='shared'?c.shared:outcome==='downloaded'?c.downloaded:'',error:''});
    }catch{if(owns(request,section))setView({...view,busy:false,message:'',error:c.deliveryFailed});}
    finally{if(generation.current===request)pendingShare.current=false;}
  }
  function control(entity: EntityRef, label: string) {
    return <button type="button" class="cctx__pick" data-context-entity={entityId(entity)}
      aria-pressed={props.selection !== null && entityId(props.selection)===entityId(entity)}
      onClick={()=>props.onShowOnChart(entity,'instant')}>{label} · {c.show}</button>;
  }
  return <section class="cctx" lang={props.locale} aria-label={c.title} data-chart-context>
    <h2>{c.title}</h2>
    {CONTEXT_SECTIONS.map(section=><details key={section} data-context-section={section}
      ref={element=>{if(element)sections.current[section]=element;else delete sections.current[section];}}
      onToggle={event=>{if(!event.currentTarget.open)close(section,false);}}>
      <summary>{c[section]}</summary>
      <div class="cctx__content">
        <div data-context-facts>{contextSectionLines(model,section,props.locale).map((line,i)=><p key={i}>{line}</p>)}</div>
        {section==='shape' && <details><summary>{c.convention}</summary>{SHAPE_RULE_COPY[props.locale].map((line,i)=><p key={i}>{line}</p>)}</details>}
        {section==='dignities' && DIGNITY_RULE_COPY[props.locale].map((line,i)=><p key={i}>{line}</p>)}
        <div class="cctx__controls">
          {section==='shape' && model.shape.points.map(p=>control({kind:'body',body:p.body as BodyName},planetLabel(props.locale,p.body)))}
          {section==='rulers' && <>
            {model.rulers.chart && <>
              {control({kind:'angle',angle:'asc'},c.chartRuler)}
              {control({kind:'body',body:model.rulers.chart.ruler},planetLabel(props.locale,model.rulers.chart.ruler))}
            </>}
            {model.rulers.houses.map(h=><div class="cctx__row" key={h.house}>
              {control({kind:'house',house:h.house!},`${c.house} ${h.house}`)}
              {control({kind:'body',body:h.ruler},planetLabel(props.locale,h.ruler))}
            </div>)}
          </>}
          {section==='dispositors' && model.dispositors.chains.map(chain=><ol class="cctx__chain" key={chain.body}>
            {chain.members.map((body,i)=><li key={`${body}:${i}`}>{control({kind:'body',body},planetLabel(props.locale,body))}</li>)}
          </ol>)}
          {section==='dignities' && model.placements.filter(p=>p.sign).map(p=><div class="cctx__row" key={p.body}>
            {control({kind:'body',body:p.body as BodyName},planetLabel(props.locale,p.body))}
            {control({kind:'sign',sign:p.sign as SignSlug},signName(signBySlug(p.sign!),props.locale))}
          </div>)}
        </div>
        <p class="cctx__convention">{c.convention}: {model.convention}</p>
        <div class="cctx__actions">
          <button class="btn btn--glass" type="button" data-context-create={section}
            disabled={view?.source===source&&view.section===section&&view.busy&&!view.card}
            onClick={()=>prepare(section)}>{c.create}</button>
          {view?.source===source&&view.section===section&&<button class="btn btn--glass" type="button" data-context-close onClick={()=>close(section)}>{c.close}</button>}
        </div>
        {view?.source===source&&view.section===section&&<div data-context-export>
          {view.url&&<img class="cctx__image" data-context-image src={view.url} width="1080" height="1350" alt={c[section]} />}
          {view.card&&<div class="cctx__actions">
            <button class="btn btn--glass" type="button" data-context-save disabled={view.busy} onClick={()=>deliver(true)}>{c.save}</button>
            <button class="btn btn--glass" type="button" data-context-share disabled={view.busy} onClick={()=>deliver(false)}>{c.share}</button>
          </div>}
          <p role="status" data-context-status>{view.message}</p>
          {view.error&&<p role="alert">{view.error}</p>}
          <CalculationReload error={view.reload?calculationLoadMessage(props.locale):''} locale={props.locale} />
        </div>}
      </div>
    </details>)}
  </section>;
}
