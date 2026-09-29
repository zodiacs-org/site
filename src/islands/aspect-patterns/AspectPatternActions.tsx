import { useEffect, useRef, useState } from 'preact/hooks';
import type { SelectedPatternCard } from '../../lib/aspect-pattern-model';
import type { PreparedChartCard } from '../../lib/share-card';
import { loadModule, ModuleLoadError } from '../../lib/module-load';
import CalculationReload, { calculationLoadMessage } from '../CalculationReload';

type Renderer = typeof import('../../lib/aspect-pattern-card');
interface PreparedImage { source: object; card: PreparedChartCard; renderer: Renderer; url: string }
const loadRenderer = () => loadModule(() => import('../../lib/aspect-pattern-card'));

/**
 * `card` is the page's pattern; `imageCard`, when given, finds the same
 * pattern in the sky the image is drawn from, which shows no more than the
 * chart's link (AspectPatternPanel).
 */
export default function AspectPatternActions({ card, imageCard }: {
  card: SelectedPatternCard;
  imageCard?: () => Promise<SelectedPatternCard | null>;
}) {
  const [open, setOpen] = useState<object | null>(null);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(false);
  const identity = useRef({ key: card.identity });
  // Replace ownership during render: an old handler cannot run before effects flush.
  if (identity.current.key !== card.identity) identity.current = { key: card.identity };
  const source = identity.current;
  const mounted = useRef(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const preview = useRef<string | null>(null);
  const sharePending = useRef(false);
  const trigger = useRef<HTMLButtonElement | null>(null);

  function release() {
    generation.current += 1;
    controller.current?.abort(new Error('pattern_image_closed'));
    controller.current = null;
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = null;
    sharePending.current = false;
  }

  useEffect(() => {
    mounted.current = true;
    setOpen(null); setPrepared(null); setPreparing(false); setSharing(false);
    setError(''); setMessage(''); setReload(false);
    return () => { mounted.current = false; release(); };
  }, [source]);

  const current = prepared?.source === source ? prepared : null;
  const expanded = open === source;

  async function prepare() {
    if (!mounted.current || identity.current !== source || (controller.current && !controller.current.signal.aborted)) return;
    release();
    const request = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    const isCurrent = () => mounted.current && identity.current === source && generation.current === request;
    setOpen(source); setPrepared(null); setPreparing(true); setSharing(false);
    setError(''); setMessage(''); setReload(false);
    let importing = true;
    let rejectStop!: (cause: unknown) => void;
    const stopped = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
    const onAbort = () => rejectStop(abort.signal.reason);
    abort.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => abort.abort(new Error('pattern_prepare_timeout')), 15_000);
    try {
      const result = await Promise.race([Promise.resolve().then(async () => {
        abort.signal.throwIfAborted();
        const [renderer, drawn] = await Promise.all([loadRenderer(), imageCard ? imageCard() : card]);
        abort.signal.throwIfAborted(); importing = false;
        // A pattern at an orb limit can fall out at the whole minute; then there is no image.
        if (!drawn) throw new Error('pattern_image_unavailable');
        const image = await renderer.prepareAspectPatternCard(drawn, abort.signal);
        abort.signal.throwIfAborted();
        return { renderer, image };
      }), stopped]);
      if (!isCurrent()) return;
      const url = URL.createObjectURL(result.image.blob);
      preview.current = url;
      setPrepared({ source, card: result.image, renderer: result.renderer, url });
      setMessage('Your selected pattern image is ready.');
    } catch (cause) {
      if (!isCurrent()) return;
      setError('The image could not be prepared. Your chart and pattern reading are still available.');
      setReload(importing || cause instanceof ModuleLoadError);
    } finally {
      clearTimeout(timer); abort.signal.removeEventListener('abort', onAbort); abort.abort();
      if (isCurrent()) { controller.current = null; setPreparing(false); }
    }
  }

  function close() {
    if (!mounted.current || identity.current !== source) return;
    release(); setPrepared(null); setOpen(null); setPreparing(false); setSharing(false);
    setError(''); setMessage(''); setReload(false);
    trigger.current?.focus({ preventScroll: true });
  }

  async function share() {
    if (!mounted.current || identity.current !== source || !current || sharePending.current) return;
    const request = generation.current;
    const isCurrent = () => mounted.current && identity.current === source && generation.current === request;
    sharePending.current = true; setSharing(true); setError(''); setMessage('');
    try {
      // No import or rendering before the native share invocation in this tap.
      const outcome = await current.renderer.shareAspectPatternCard(current.card, isCurrent);
      if (isCurrent()) setMessage(outcome === 'shared' ? 'Image shared.' : outcome === 'downloaded' ? 'Image download started.' : '');
    } catch {
      if (isCurrent()) setError('The image could not be shared. Try Save image.');
    } finally {
      if (isCurrent()) { sharePending.current = false; setSharing(false); }
    }
  }

  function download() {
    if (!mounted.current || identity.current !== source || !current || sharePending.current) return;
    setError(''); setMessage('');
    try { current.renderer.downloadAspectPatternCard(current.card); setMessage('Image download started.'); }
    catch { setError('The image download could not start. Try Save image again.'); }
  }

  return <section aria-label="Image of the selected aspect pattern">
    <div class="apat__actions">
      <button ref={trigger} type="button" class="btn btn--ghost" data-pattern-export
        aria-expanded={expanded} disabled={expanded && preparing} onClick={prepare}>{expanded && preparing ? 'Preparing image…' : current ? 'Prepare image again' : 'Create image'}</button>
      {expanded && <button type="button" class="btn btn--ghost" data-pattern-export-close onClick={close}>Close image</button>}
    </div>
    {expanded && <>
      {current && <>
        <img class="apat__image" data-pattern-image src={current.url} width="1080" height="1350"
          alt={`${card.title}: ${card.pattern.members.join(', ')}. The image includes the selected pattern’s contacts, reading and scope.`} />
        <div class="apat__actions">
          <button type="button" class="btn btn--primary" data-pattern-download disabled={sharing} onClick={download}>Save image</button>
          <button type="button" class="btn btn--ghost" data-pattern-share disabled={sharing} onClick={share}>{sharing ? 'Sharing…' : 'Share image'}</button>
        </div>
      </>}
      <p class="field__help" role="status" data-pattern-export-status>{preparing ? 'Preparing your selected pattern image…' : message}</p>
      {error && <p class="calc__error" role="alert" data-pattern-export-error>{error}</p>}
      <CalculationReload error={reload ? calculationLoadMessage('en') : ''} locale="en" />
    </>}
  </section>;
}
