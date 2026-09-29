import { useEffect, useRef, useState } from 'preact/hooks';
import type { PreparedChartCard } from '../../lib/share-card';
import { loadModule, ModuleLoadError } from '../../lib/module-load';
import CalculationReload, { calculationLoadMessage } from '../CalculationReload';
import type { LunarReturnExportModel } from './export-model';

type Renderer = typeof import('../../lib/lunar-return-card');
interface PreparedImage { card: PreparedChartCard; renderer: Renderer; url: string }
interface State {
  source: LunarReturnExportModel;
  prepared: PreparedImage | null; preparing: boolean; sharing: boolean;
  imageError: string; imageMessage: string; imageReload: boolean;
  calendarBusy: boolean; calendarError: string; calendarMessage: string; calendarReload: boolean;
}
const empty = (source: LunarReturnExportModel): State => ({
  source, prepared: null, preparing: false, sharing: false, imageError: '', imageMessage: '', imageReload: false,
  calendarBusy: false, calendarError: '', calendarMessage: '', calendarReload: false,
});
const loadRenderer = () => loadModule(() => import('../../lib/lunar-return-card'));
const loadCalendar = () => loadModule(() => Promise.all([
  import('../../lib/lunar-return-ical'), import('../../lib/ical-download'),
]));

export default function LunarReturnActions({ model }: { model: LunarReturnExportModel }) {
  const [owned, setOwned] = useState<State>(() => empty(model));
  const identity = useRef(model);
  // Invalidate old handlers during render, before effect cleanup can run.
  identity.current = model;
  const source = model;
  const state = owned.source === source ? owned : empty(source);
  const mounted = useRef(false);
  const lifetime = useRef(0);
  const imageGeneration = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const calendarController = useRef<AbortController | null>(null);
  const preview = useRef<string | null>(null);
  const sharePending = useRef(false);
  const calendarPending = useRef(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const isSource = () => mounted.current && identity.current === source;
  const write = (patch: Partial<State>) => setOwned((value) => ({ ...(value.source === source ? value : empty(source)), ...patch }));

  function releaseImage() {
    imageGeneration.current += 1;
    controller.current?.abort(new Error('lunar_image_replaced')); controller.current = null;
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = null; sharePending.current = false;
  }

  useEffect(() => {
    mounted.current = true; lifetime.current += 1;
    setOwned(empty(source));
    return () => {
      mounted.current = false; lifetime.current += 1; releaseImage();
      calendarController.current?.abort(new Error('lunar_source_replaced')); calendarController.current = null;
      calendarPending.current = false;
    };
  }, [source]);

  async function prepareImage() {
    if (!isSource() || controller.current || sharePending.current) return;
    releaseImage();
    const request = imageGeneration.current;
    const live = lifetime.current;
    const isCurrent = () => isSource() && lifetime.current === live && imageGeneration.current === request;
    const abort = new AbortController(); controller.current = abort;
    write({ prepared: null, preparing: true, sharing: false, imageError: '', imageMessage: '', imageReload: false });
    let importing = true;
    let rejectStop!: (cause: unknown) => void;
    const stopped = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
    const onAbort = () => rejectStop(abort.signal.reason);
    abort.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => abort.abort(new Error('lunar_prepare_timeout')), 15_000);
    try {
      const result = await Promise.race([Promise.resolve().then(async () => {
        abort.signal.throwIfAborted();
        const renderer = await loadRenderer();
        abort.signal.throwIfAborted(); importing = false;
        const card = await renderer.prepareLunarReturnCard(model, abort.signal);
        abort.signal.throwIfAborted(); return { renderer, card };
      }), stopped]);
      if (!isCurrent()) return;
      const url = URL.createObjectURL(result.card.blob); preview.current = url;
      write({ prepared: { ...result, url }, imageMessage: 'Your lunar return image is ready.' });
    } catch (cause) {
      if (!isCurrent()) return;
      write({ imageError: 'The image could not be prepared. Your return chart and calendar are still available.', imageReload: importing || cause instanceof ModuleLoadError });
    } finally {
      clearTimeout(timer); abort.signal.removeEventListener('abort', onAbort); abort.abort();
      if (isCurrent()) { controller.current = null; write({ preparing: false }); }
    }
  }

  function closeImage() {
    if (!isSource()) return;
    releaseImage();
    write({ prepared: null, preparing: false, sharing: false, imageError: '', imageMessage: '', imageReload: false });
    trigger.current?.focus({ preventScroll: true });
  }

  async function shareImage() {
    if (!isSource() || !state.prepared || preview.current !== state.prepared.url || controller.current || sharePending.current) return;
    const request = imageGeneration.current, live = lifetime.current;
    const isCurrent = () => isSource() && lifetime.current === live && imageGeneration.current === request;
    sharePending.current = true; write({ sharing: true, imageError: '', imageMessage: '' });
    try {
      // File creation and native sharing happen in this click, without awaiting an import.
      const outcome = await state.prepared.renderer.shareLunarReturnCard(state.prepared.card, isCurrent);
      if (isCurrent()) write({ imageMessage: outcome === 'shared' ? 'Image shared.' : outcome === 'downloaded' ? 'Image download started.' : '' });
    } catch {
      if (isCurrent()) write({ imageError: 'The image could not be shared. Try Save image.' });
    } finally {
      if (isCurrent()) { sharePending.current = false; write({ sharing: false }); }
    }
  }

  function saveImage() {
    if (!isSource() || !state.prepared || preview.current !== state.prepared.url || controller.current || sharePending.current) return;
    write({ imageError: '', imageMessage: '' });
    try { state.prepared.renderer.downloadLunarReturnCard(state.prepared.card); write({ imageMessage: 'Image download started.' }); }
    catch { write({ imageError: 'The image download could not start. Try Save image again.' }); }
  }

  async function saveCalendar() {
    if (!isSource() || calendarPending.current) return;
    calendarPending.current = true;
    const live = lifetime.current, abort = new AbortController(); calendarController.current = abort;
    const isCurrent = () => isSource() && lifetime.current === live && calendarController.current === abort;
    write({ calendarBusy: true, calendarError: '', calendarMessage: '', calendarReload: false });
    let rejectStop!: (cause: unknown) => void;
    const stopped = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
    const onAbort = () => rejectStop(abort.signal.reason);
    abort.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => abort.abort(new Error('lunar_calendar_timeout')), 15_000);
    let importing = true;
    try {
      const [calendar, download] = await Promise.race([loadCalendar(), stopped]);
      abort.signal.throwIfAborted(); importing = false;
      if (!isCurrent()) return;
      download.downloadCalendarFile(calendar.buildLunarReturnCalendar(model, new Date()), calendar.lunarReturnCalendarFilename(model));
      write({ calendarMessage: 'Calendar download started.' });
    } catch (cause) {
      if (isCurrent()) write({ calendarError: 'The calendar download could not start. Try Add to calendar again.', calendarReload: importing || cause instanceof ModuleLoadError });
    } finally {
      clearTimeout(timer); abort.signal.removeEventListener('abort', onAbort); abort.abort();
      if (isCurrent()) { calendarPending.current = false; calendarController.current = null; write({ calendarBusy: false }); }
    }
  }

  return <section class="sr-result__exports" data-lr-exports aria-label="Save this lunar return">
    <div class="calc__actions">
      <button ref={trigger} class="btn btn--primary" type="button" data-lr-create-image
        disabled={state.preparing || state.sharing} aria-expanded={!!state.prepared || state.preparing} onClick={prepareImage}>
        {state.preparing ? 'Preparing image…' : state.prepared || state.imageError ? 'Prepare image again' : 'Create image'}
      </button>
      <button class="btn btn--ghost" type="button" data-lr-calendar disabled={state.calendarBusy} onClick={saveCalendar}>
        {state.calendarBusy ? 'Preparing calendar…' : 'Add to calendar'}
      </button>
      {(state.prepared || state.preparing) && <button class="btn btn--ghost" type="button" data-lr-close-image onClick={closeImage}>Close image</button>}
    </div>
    <p class="field__help">The image shows this return chart and reading, with the return to the whole minute, the angles to the whole degree and no Placidus houses. The calendar marks the return to the whole minute. Names and birth details are left out.</p>
    {state.prepared && <>
      <img data-lr-image class="sr-result__image" src={state.prepared.url} width="1080" height="1350"
        style={{ display: 'block', width: '100%', maxWidth: '540px', height: 'auto' }}
        alt="Lunar return chart, return time, recorded reference and reading." />
      <div class="calc__actions">
        <button class="btn btn--primary" type="button" data-lr-download disabled={state.sharing} onClick={saveImage}>Save image</button>
        <button class="btn btn--ghost" type="button" data-lr-share disabled={state.sharing} onClick={shareImage}>{state.sharing ? 'Sharing…' : 'Share image'}</button>
      </div>
    </>}
    <p class="field__help" role="status" data-lr-image-status>{state.preparing ? 'Preparing your return image…' : state.imageMessage}</p>
    {state.imageError && <p class="calc__error" role="alert" data-lr-image-error>{state.imageError}</p>}
    <p class="field__help" role="status" data-lr-calendar-status>{state.calendarMessage}</p>
    {state.calendarError && <p class="calc__error" role="alert" data-lr-calendar-error>{state.calendarError}</p>}
    <CalculationReload error={state.imageReload || state.calendarReload ? calculationLoadMessage('en') : ''} locale="en" />
  </section>;
}
