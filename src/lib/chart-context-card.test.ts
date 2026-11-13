import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./share-card',()=>({downloadPreparedChartCard:vi.fn(()=> 'downloaded')}));
import { prepareChartContextCard, shareChartContextCard, type ChartContextCard } from './chart-context-card';
import { buildChartContext } from './chart-context';
import { SHAPE_BODIES } from './chart-shape';
import { CONTEXT_COPY, CONTEXT_SECTIONS, contextSectionLines } from '../islands/explorer/chart-context-copy';
import { downloadPreparedChartCard } from './share-card';
const model=buildChartContext({bodies:SHAPE_BODIES.map((body,i)=>({body,lon:i*30})),timeKnown:true,angles:{asc:5},houses:{system:'whole',cusps:Array.from({length:12},(_,i)=>i*30)}});
let fontLoad:ReturnType<typeof vi.fn>,bitmap:{close:ReturnType<typeof vi.fn>},ctx:Record<string,any>,canvas:Record<string,any>;
function payload(section:ChartContextCard['section']='rulers',locale:ChartContextCard['locale']='en'):ChartContextCard {
  return {section,locale,title:CONTEXT_COPY[locale][section],lines:contextSectionLines(model,section,locale),convention:model.convention};
}
beforeEach(()=>{
  fontLoad=vi.fn(async()=>[{status:'loaded'}]);bitmap={close:vi.fn()};
  ctx={font:'',fillText:vi.fn(),fillRect:vi.fn(),save:vi.fn(),restore:vi.fn(),drawImage:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn(),
    arc:vi.fn(),fill:vi.fn(),globalAlpha:1,letterSpacing:'0px',
    measureText:(text:string)=>({width:text.length*(Number(ctx.font.match(/(\d+)px/)?.[1])||24)*.52})};
  canvas={width:0,height:0,getContext:()=>ctx,toBlob:(cb:(b:Blob|null)=>void)=>cb(new Blob(['test-only-png'],{type:'image/png'}))};
  vi.stubGlobal('document',{fonts:{load:fontLoad},createElement:()=>canvas});
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,blob:async()=>new Blob(['icon'])})));
  vi.stubGlobal('createImageBitmap',vi.fn(async()=>bitmap));
  vi.stubGlobal('navigator',{canShare:()=>false});vi.mocked(downloadPreparedChartCard).mockClear();
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('four section card boundaries',()=>{
  it.each(CONTEXT_SECTIONS.flatMap(section=>(['en','es','pt','fr','it','ru']as const).map(locale=>({section,locale}))))('$section in $locale preserves every fact and releases its canvas',async({section,locale})=>{
    const facts=payload(section,locale);const image=await prepareChartContextCard(facts);
    expect(image.filename).toMatch(new RegExp(`^zodiacs-${section}-${locale}-[a-f0-9]{16}\\.png$`));
    expect(image.blob.type).toBe('image/png');expect(canvas.width).toBe(0);
    // The brand lockup draws its own ring: no image is fetched or decoded for it.
    expect(fetch).not.toHaveBeenCalled();expect(createImageBitmap).not.toHaveBeenCalled();expect(ctx.drawImage).not.toHaveBeenCalled();
    const text=ctx.fillText.mock.calls.map((x:unknown[])=>x[0]).join(' ');
    expect(text).toContain('ZODIACS · ORG');expect(text).not.toContain('Zodiacs.org');
    for(const line of facts.lines)expect(text).toContain(line.replace(/\s+/g,' '));
    expect(text).toContain(model.convention);
  });
  it('ignores extra input fields in both rendered text and deterministic filename',async()=>{
    const a=await prepareChartContextCard(payload());ctx.fillText.mockClear();
    const b=await prepareChartContextCard({...payload(),name:'PRIVATE_NAME',inputRevision:77,birthDate:'PRIVATE_DATE'} as ChartContextCard);
    expect(a.filename).toBe(b.filename);expect(JSON.stringify(ctx.fillText.mock.calls)).not.toContain('PRIVATE');
  });
  it('keeps failed font loads retryable and does not silently substitute missing faces',async()=>{
    fontLoad.mockResolvedValueOnce([]);await expect(prepareChartContextCard(payload())).rejects.toThrow('context_fonts_unavailable');
    await expect(prepareChartContextCard(payload())).resolves.toHaveProperty('filename');
  });
  it('bounds a stalled font operation without painting late',async()=>{
    vi.useFakeTimers();fontLoad.mockImplementation(()=>new Promise(()=>{}));
    const result=prepareChartContextCard(payload());const assertion=expect(result).rejects.toThrow('context_prepare_timeout');
    await vi.advanceTimersByTimeAsync(15_000);await assertion;expect(ctx.fillText).not.toHaveBeenCalled();
  });
  it('rejects a failed encoder, releases the canvas and permits retry',async()=>{
    canvas.toBlob=(cb:(b:Blob|null)=>void)=>cb(null);await expect(prepareChartContextCard(payload())).rejects.toThrow('context_png_unavailable');expect(canvas.width).toBe(0);
  });
  it('never renders an already-aborted request',async()=>{
    const abort=new AbortController();abort.abort(new Error('source_changed'));
    await expect(prepareChartContextCard(payload(),abort.signal)).rejects.toThrow('source_changed');expect(fontLoad).not.toHaveBeenCalled();
  });
  it('reports cancelled native delivery neutrally without an unsolicited download',async()=>{
    vi.stubGlobal('navigator',{canShare:()=>true,share:vi.fn(async()=>{throw new DOMException('cancel','AbortError');})});
    expect(await shareChartContextCard({blob:new Blob(['png']),filename:'test.png'},()=>true)).toBe('cancelled');
    expect(downloadPreparedChartCard).not.toHaveBeenCalled();
  });
  it('does not download for revoked ownership after a failed share',async()=>{
    let current=true;vi.stubGlobal('navigator',{canShare:()=>true,share:vi.fn(async()=>{current=false;throw new Error('delivery');})});
    expect(await shareChartContextCard({blob:new Blob(['png']),filename:'test.png'},()=>current)).toBe('cancelled');expect(downloadPreparedChartCard).not.toHaveBeenCalled();
  });
});
