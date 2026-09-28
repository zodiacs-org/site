import { useMemo, useState } from 'preact/hooks';
import { buildAspectPatternModel, patternDegrees, patternEdgeReceipt, selectedPatternCard, type AspectPatternModel, type SelectedPatternCard } from '../../lib/aspect-pattern-model';
import { chartForImage } from '../../lib/chart-image-sky';
import type { AspectPatternFeatureProps } from './AspectPatternFeature';
import { AspectPatternDiagram } from './AspectPatternDiagram';
import AspectPatternActions from './AspectPatternActions';
import { PATTERN_NAMES, PATTERN_ORBS, patternReading, patternRole } from './copy';

export default function AspectPatternPanel(props: AspectPatternFeatureProps) {
  const model = useMemo(() => buildAspectPatternModel(props), [props.context, props.sourceKey, props.timeKnown, props.points, props.aspects]);
  // A share image is found again in the sky it is drawn from (imageOf, imageSky).
  const imageCard = async (id: string): Promise<SelectedPatternCard | null> => {
    const sky = props.imageSky ? await props.imageSky()
      : props.imageOf ? await chartForImage(props.imageOf).then((drawn) => ({ points: drawn.bodies, aspects: drawn.aspects }))
        : null;
    return sky ? selectedPatternCard(buildAspectPatternModel({ ...props, ...sky }), id) : selectedPatternCard(model, id);
  };
  return <PatternSelection key={model.identity} model={model} onSelectBody={props.onSelectBody} imageCard={imageCard} />;
}
export function PatternSelection({ model, onSelectBody, imageCard }: {
  model: AspectPatternModel;
  onSelectBody: AspectPatternFeatureProps['onSelectBody'];
  imageCard?: (id: string) => Promise<SelectedPatternCard | null>;
}) {
  const [selectedId, setSelectedId] = useState(model.roots[0]?.id ?? '');
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const detection = model.detection;
  const selected = detection.status === 'ready' ? detection.patterns.find((p) => p.id === selectedId) ?? model.roots[0] : null;
  const card = useMemo(() => selected ? selectedPatternCard(model, selected.id) : null, [model, selected?.id]);
  function choose(id: string) { setSelectedId(id); setSelectedEdge(null); }
  const title = (id: string) => {
    const pattern = detection.status === 'ready' ? detection.patterns.find((p) => p.id === id) : null;
    return pattern ? `${PATTERN_NAMES[pattern.kind]} · ${pattern.members.join(', ')}` : '';
  };
  const parents = selected ? model.roots.filter((p) => model.included[p.id].some((inner) => inner.id === selected.id)) : [];
  return <div class="apat__content" data-pattern-panel>
    <p data-pattern-scope>{model.scope}</p>
    {detection.status === 'unavailable' ? <p role="status" data-pattern-unavailable>Pattern geometry is unavailable: {detection.reason}</p>
      : !selected ? <p data-pattern-absence>{model.absence}</p> : <>
        <p data-pattern-count>{model.roots.length} {model.roots.length === 1 ? 'pattern group' : 'pattern groups'} · {detection.patterns.length} total including contained patterns.</p>
        <label class="field__label">Choose a pattern
          <select class="field__input" data-pattern-select value={selected.id} onChange={(event) => choose(event.currentTarget.value)}>
            {model.roots.map((pattern) => <option value={pattern.id} key={pattern.id}>{title(pattern.id)}</option>)}
            {detection.patterns.filter((p) => !model.roots.includes(p)).map((pattern) => <option value={pattern.id} key={pattern.id}>Included: {title(pattern.id)}</option>)}
          </select>
        </label>
        <p class="sr-only" role="status" data-pattern-announcement>{title(selected.id)} selected.{selectedEdge ? ` ${patternEdgeReceipt(selected.edges.find((e) => e.key === selectedEdge)!)} highlighted in the pattern diagram.` : ''}</p>
        <h3 data-pattern-title>{PATTERN_NAMES[selected.kind]}</h3>
        <p data-pattern-role>{patternRole(selected)}</p>
        <div class="apat__grid">
          <AspectPatternDiagram pattern={selected} points={detection.points} selectedEdge={selectedEdge} />
          <div>
            <h4>Members</h4>
            <ul class="apat__list" data-pattern-members>{selected.members.map((body) => <li key={body}>
              <button type="button" class="apat__pick" data-pattern-body={body} onClick={() => onSelectBody(body)}>
                <span>{body} · {patternDegrees(detection.points.find((p) => p.body === body)!.lon)}</span><span>Show on chart →</span>
              </button>
            </li>)}</ul>
            <h4>Required edges</h4>
            <p class="field__help">Select an edge to highlight it in this diagram. It includes wide contacts that the main wheel may omit.</p>
            <ul class="apat__list" data-pattern-edges>{selected.edges.map((edge) => <li key={edge.key}>
              <button type="button" class="apat__pick" data-pattern-edge={edge.key} data-pattern-orb={edge.orb}
                aria-pressed={selectedEdge === edge.key} onClick={() => setSelectedEdge(selectedEdge === edge.key ? null : edge.key)}>{patternEdgeReceipt(edge)}</button>
            </li>)}</ul>
          </div>
        </div>
        {model.included[selected.id]?.length > 0 && <details class="apat__included" data-pattern-included>
          <summary>Included patterns ({model.included[selected.id].length})</summary>
          <ul class="apat__list">{model.included[selected.id].map((p) => <li key={p.id}><button class="apat__pick" type="button" onClick={(event) => { choose(p.id); event.currentTarget.closest('[data-pattern-panel]')?.querySelector<HTMLSelectElement>('[data-pattern-select]')?.focus(); }}>{title(p.id)}</button></li>)}</ul>
        </details>}
        {parents.length > 0 && <div data-pattern-parents><p>Included in:</p>{parents.map((p) => <button key={p.id} class="apat__pick" type="button" onClick={(event) => { choose(p.id); event.currentTarget.closest('[data-pattern-panel]')?.querySelector<HTMLSelectElement>('[data-pattern-select]')?.focus(); }}>{title(p.id)}</button>)}</div>}
        {model.timeKnown ? <p class="apat__reading" data-pattern-reading>{patternReading(selected, model.context)}</p>
          : <p data-pattern-withheld>Add known birth times for a symbolic reading or a share image. The reference geometry above does not establish a whole-day pattern.</p>}
        {card && <AspectPatternActions key={card.identity} card={card} imageCard={imageCard ? () => imageCard(card.pattern.id) : undefined} />}
      </>}
    <details class="apat__policy"><summary>Which bodies and orb limits?</summary><p>{PATTERN_ORBS}</p><p>Only the Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune and Pluto can be members. An unknown-time Moon is excluded. Every required edge must qualify; extra contacts do not cancel a pattern.</p></details>
  </div>;
}
