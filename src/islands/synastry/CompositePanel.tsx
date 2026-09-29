import { useEffect, useRef, useState } from 'preact/hooks';
import AspectPatternFeature from '../aspect-patterns/AspectPatternFeature';
import AspectGlyph from '../../components/AspectGlyph';
import PlanetGlyph from '../../components/PlanetGlyph';
import { aspectLabel, planetLabel } from '../../lib/i18n/astrology';
import { t, type CatalogLocale as Locale } from '../../lib/i18n';
import { formatLongitude } from '../../lib/signs';
import { createModuleLoader } from '../../lib/module-load';
import type { PreparedChartCard } from '../../lib/share-card';
import CalculationReload, { calculationError } from '../CalculationReload';
import { CompositeWheel } from './CompositeWheel';
import { COMPOSITE_COPY } from './compositeCopy';
import { compositeReading } from './compositeReadings';
import { buildCompositeTabData, compositeAspectId, compositeBodyId, compositeSelection, type CompositeTabData } from './relationshipData';
import type { PicturePerson } from '../../lib/share-positions-noon';
export { COMPOSITE_NOTE } from './compositeCopy';

type CardModule = typeof import('../../lib/composite-card');
const loadCard = createModuleLoader(() => import('../../lib/composite-card'));
interface ReadyCard { source: string; prepared: PreparedChartCard; module: CardModule; url: string }
interface CompositePanelProps {
  locale: Locale;
  data: CompositeTabData;
  /** The two charts as the calculator knows them: a picture draws each as its link carries it. */
  people?: { a: PicturePerson; b: PicturePerson };
  sourceKey: string;
  /** Both original chart times, independent of which midpoint bodies exist. */
  sourceTimesKnown: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * The composite a picture draws: each person as their link carries them
 * (share-positions-noon's pictureBodies), so the picture shows no more of
 * either than their link. The page's own composite is `data`.
 */
export async function compositePictureData(
  data: CompositeTabData,
  people: CompositePanelProps['people'],
): Promise<CompositeTabData> {
  const changes = (person: PicturePerson) => !person.timeKnown
    || (person.utc !== undefined && new Date(person.utc).getTime() % 60_000 !== 0);
  if (!people || (!changes(people.a) && !changes(people.b))) return data;
  const [{ computeBodies }, { pictureBodies }] = await Promise.all([
    import('../../lib/engine/full'),
    import('../../lib/share-positions-noon'),
  ]);
  return buildCompositeTabData(pictureBodies(people.a, computeBodies), pictureBodies(people.b, computeBodies), {
    aTimeKnown: people.a.timeKnown, bTimeKnown: people.b.timeKnown,
  });
}

export function CompositePanel({ locale, data, people, sourceKey, sourceTimesKnown, selectedId, onSelect }: CompositePanelProps) {
  const c = COMPOSITE_COPY[locale];
  const selected = compositeSelection(data, selectedId);
  const reading = compositeReading(data, selectedId);
  const identity = `${locale}:${sourceKey}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const generation = useRef(0);
  const mounted = useRef(true);
  const panel = useRef<HTMLDivElement>(null);
  const delivering = useRef(false);
  const creating = useRef<string | null>(null);
  const cardUrl = useRef<string | null>(null);
  const [exportOwner, setExportOwner] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<ReadyCard | null>(null);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<'shared' | 'downloaded' | 'cancelled' | null>(null);
  const exportOpen = open && exportOwner === identity;
  const image = ready?.source === identity ? ready : null;

  function releasePreview() {
    if (cardUrl.current) URL.revokeObjectURL(cardUrl.current);
    cardUrl.current = null;
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      creating.current = null;
      delivering.current = false;
      releasePreview();
    };
  }, [identity]);

  async function prepareImage() {
    if (!mounted.current || currentIdentity.current !== identity || !data.points.length || creating.current === identity || delivering.current) return;
    const request = ++generation.current;
    const current = () => mounted.current && generation.current === request && currentIdentity.current === identity;
    creating.current = identity;
    setExportOwner(identity); setOpen(true); setBusy(true); setError(''); setOutcome(null);
    releasePreview(); setReady(null);
    try {
      const [module, picture] = await Promise.all([loadCard(), compositePictureData(data, people)]);
      if (!current()) return;
      const prepared = await module.prepareCompositeCard(picture, locale, { noTime: !sourceTimesKnown });
      if (!current()) return;
      const url = URL.createObjectURL(prepared.blob);
      cardUrl.current = url;
      setReady({ source: identity, prepared, module, url });
    } catch (cause) {
      if (current()) setError(calculationError(cause, locale, c.shareError));
    } finally {
      if (current()) { creating.current = null; setBusy(false); }
    }
  }

  function closeImage() {
    if (!mounted.current || currentIdentity.current !== identity) return;
    generation.current += 1;
    delivering.current = false;
    creating.current = null;
    releasePreview(); setReady(null); setOpen(false); setBusy(false); setError(''); setOutcome(null);
  }

  async function deliver(download: boolean) {
    if (!mounted.current || !image || busy || delivering.current || currentIdentity.current !== identity) return;
    delivering.current = true;
    const request = generation.current;
    setBusy(true); setError(''); setOutcome(null);
    try {
      // Prepared bytes and transport are already loaded before this native tap.
      const next = await (download
        ? image.module.downloadCompositeCard(image.prepared)
        : image.module.shareCompositeCard(image.prepared));
      if (mounted.current && request === generation.current && currentIdentity.current === identity) setOutcome(next);
    } catch {
      if (mounted.current && request === generation.current && currentIdentity.current === identity) setError(c.shareError);
    } finally {
      if (mounted.current && request === generation.current && currentIdentity.current === identity) { delivering.current = false; setBusy(false); }
    }
  }

  const choose = (id: string) => onSelect(id === selectedId ? null : id);
  function clearSelection() {
    // The clear control disappears with the detail; return focus to its receipt.
    panel.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();
    onSelect(null);
  }
  return (
    <div class="rcomp" data-composite-panel ref={panel}>
      <h3 class="rcomp__title" id="relationship-composite-title">{c.title}</h3>
      <div class="tring__wheelbox rcomp__wheel" data-composite-wheel>
        <CompositeWheel data={data} label={c.wheelLabel} selection={selectedId} onSelect={choose} />
      </div>
      <p class="rcomp__note" data-composite-note>{c.note}</p>
      <p class="rcomp__note">{c.oppositeConvention}</p>
      {data.moonProvisional && <p class="notice" data-composite-provisional>{c.moonTimeNotice}</p>}
      <p class="field__help">{c.selectionHint}</p>

      <div class="rcomp__lists">
        <section aria-labelledby="composite-placements-heading">
          <h4 class="mono--label" id="composite-placements-heading">{c.placements}</h4>
          {data.points.length ? <ul class="rcomp__placements mono" role="list">
            {data.points.map((point) => {
              const id = compositeBodyId(point.body);
              return <li key={id}>
                <button type="button" class="rcomp__pick" data-composite-point={point.body}
                  data-composite-longitude={point.lon} aria-pressed={selectedId === id}
                  aria-controls="composite-selected-detail" onClick={() => choose(id)}>
                  <span><PlanetGlyph body={point.body} size={13} class="pg-inline" /> {planetLabel(locale, point.body)}</span>
                  <span>{formatLongitude(point.lon, locale)}{point.body === 'Moon' && data.moonProvisional ? ` · ${c.provisionalMoon}` : ''}</span>
                </button>
              </li>;
            })}
          </ul> : <p class="field__help">{c.noPlacements}</p>}
        </section>
        <section aria-labelledby="composite-aspects-heading">
          <h4 class="mono--label" id="composite-aspects-heading">{c.aspects}</h4>
          {data.aspects.length ? <ul class="rcomp__aspects mono" role="list">
            {data.aspects.map((aspect) => {
              const id = compositeAspectId(aspect);
              const provisional = data.moonProvisional && (aspect.a === 'Moon' || aspect.b === 'Moon');
              return <li key={id}>
                <button type="button" class="rcomp__pick" data-composite-aspect={id}
                  data-composite-orb={aspect.orb} aria-pressed={selectedId === id}
                  aria-controls="composite-selected-detail" onClick={() => choose(id)}>
                  <span><PlanetGlyph body={aspect.a} size={13} class="pg-inline" /> {planetLabel(locale, aspect.a)}
                    {' '}<AspectGlyph type={aspect.type} size={13} class="pg-inline" /> {aspectLabel(locale, aspect.type)}
                    {' '}<PlanetGlyph body={aspect.b} size={13} class="pg-inline" /> {planetLabel(locale, aspect.b)}</span>
                  <span>{t(locale, 'orb')} {aspect.orb.toFixed(1)}°{provisional ? ` · ${c.referenceContact}` : ''}</span>
                </button>
              </li>;
            })}
          </ul> : <p class="field__help">{c.noAspects}</p>}
        </section>
      </div>

      <section id="composite-selected-detail" class="rcomp__detail" data-composite-detail aria-live="polite" aria-atomic="true">
        {selected ? <>
          <div class="rcomp__detail-head">
            <h4>{selected.kind === 'body' ? <>{planetLabel(locale, selected.point.body)} · {formatLongitude(selected.point.lon, locale)}</>
              : <>{planetLabel(locale, selected.aspect.a)} {aspectLabel(locale, selected.aspect.type)} {planetLabel(locale, selected.aspect.b)} · {t(locale, 'orb')} {selected.aspect.orb.toFixed(1)}°</>}</h4>
            <button class="btn btn--glass" type="button" onClick={clearSelection} data-composite-clear>{c.clearSelection}</button>
          </div>
          {selected.provisional ? <p>{c.moonTimeNotice}</p> : reading && <>
            {locale !== 'en' && <p class="field__help">{c.englishNarrative}</p>}
            <div data-composite-reading lang="en">
              {reading.role && <p><span class="mono--label" lang={locale}>{c.roleTitle}</span>{reading.role}</p>}
              {reading.theme && <p><span class="mono--label" lang={locale}>{c.pairTitle}</span>{reading.theme}</p>}
              {reading.prompt && <p><span class="mono--label" lang={locale}>{c.promptTitle}</span>{reading.prompt}</p>}
            </div>
          </>}
        </> : <p class="field__help">{t(locale, 'selectionCleared')}</p>}
      </section>

      {locale === 'en' && <AspectPatternFeature context="composite" points={data.points} aspects={data.aspects}
        timeKnown={sourceTimesKnown} sourceKey={sourceKey} onSelectBody={(body) => onSelect(compositeBodyId(body))}
        imageSky={() => compositePictureData(data, people)} />}

      <div class="rcomp__export">
        <button class="btn btn--glass" type="button" data-composite-export disabled={!data.points.length || (exportOpen && busy)} onClick={prepareImage}>
          {exportOpen && !image && error ? c.retry : c.imageAction}
        </button>
        {!sourceTimesKnown && <p class="field__help" data-composite-image-no-time>{c.imageNoTime}</p>}
        {exportOpen && <section class="rcomp__image-panel" aria-label={c.imageTitle}>
          <div class="rcomp__detail-head">
            <h4>{c.imageTitle}</h4>
            <button class="btn btn--glass" type="button" data-composite-export-close onClick={closeImage}>{c.closeImage}</button>
          </div>
          {image && <img data-composite-image class="rcomp__image" src={image.url} width="1080" height="1350" alt={c.imageAlt} />}
          {image && <div class="rcomp__image-actions">
            <button class="btn btn--glass" type="button" data-composite-share disabled={busy} onClick={() => deliver(false)}>{c.shareAction}</button>
            <button class="btn btn--glass" type="button" data-composite-download disabled={busy} onClick={() => deliver(true)}>{c.downloadAction}</button>
          </div>}
          <p class="field__help" role="status" data-composite-export-status>{busy ? c.shareBusy : outcome ? c[outcome] : image ? c.imageReady : ''}</p>
          {error && <p class="calc__error" role="alert">{error}</p>}
          <CalculationReload error={error} locale={locale} />
        </section>}
      </div>
    </div>
  );
}
