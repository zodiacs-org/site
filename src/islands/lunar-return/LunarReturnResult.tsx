import { CheckOurMath, ResultOpening } from '../ChartTrust';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { ComponentType } from 'preact';
import type { WheelProps } from '../../lib/wheel/Wheel';
import { houseOf } from '../../lib/engine/houses';
import { formatLongitude, signForLongitude } from '../../lib/signs';
import type { LunarReturnResultData } from './compute';
import { lunarReturnExportModel } from './export-model';
import LunarReturnActions from './LunarReturnActions';
import EvidenceDisclosure from '../EvidenceDisclosure';

export interface LunarReturnResultProps { result: LunarReturnResultData; Wheel: ComponentType<WheelProps> }
const utcLabel = (iso: string) => iso.slice(0, 19).replace('T', ' · ') + ' UTC';

export function LunarReturnResult({ result, Wheel }: LunarReturnResultProps) {
  const model = useMemo(() => lunarReturnExportModel(result), [result]);
  // Images and calendar files start from the natal Moon at the whole minute.
  const shared = useMemo(() => (result.shared ? lunarReturnExportModel({ ...result, chart: result.shared }) : model), [result, model]);
  const { wheel } = model;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [model]);
  return <div class="sr-result" data-lunar-return-result data-lr-instant={model.instantUtc} data-lr-reference={model.referenceUtc} data-lr-asc={wheel.angles!.asc}>
    <ResultOpening kind="return" />
    <CheckOurMath utc={model.instantUtc} basis="return" />
    <section class="shell sr-result__reading" aria-labelledby="lunar-return-reading-title">
      <div class="core sr-result__core">
        <p class="kicker">Your next lunar return</p>
        <h2 id="lunar-return-reading-title" ref={heading} tabIndex={-1}>A moment to check in</h2>
        <p class="sr-result__instant mono" data-lr-event-label>{utcLabel(model.instantUtc)}</p>
        <p class="field__help" data-lr-reference-label>First return after {utcLabel(model.referenceUtc)}.</p>
        {model.reading.map((reading) => <p key={reading.kind} class="sr-result__line" data-lr-reading={reading.kind}>{reading.text}</p>)}
        <p class="field__help">{model.notes[0]}</p>
      </div>
    </section>
    <section class="calc__wheel shell" aria-label="Lunar return chart">
      <div class="core calc__wheel-core"><div aria-hidden="true"><Wheel
        bodies={wheel.bodies.filter((body) => body.body !== 'South Node')}
        asc={wheel.angles!.asc} mc={wheel.angles!.mc} cusps={wheel.houses!.cusps}
        aspects={wheel.aspects.filter((aspect) => aspect.orb < 6)} animate={false} />
      </div></div>
    </section>
    <LunarReturnActions model={shared} />
    <EvidenceDisclosure label="Return chart details" variant="panel" className="shell sr-result__details">
      <div class="sr-result__details-content">
        <p class="sr-result__instant mono">Return · {utcLabel(model.instantUtc)}<br />Reference · {utcLabel(model.referenceUtc)}<br />Your time · {new Date(model.instantUtc).toLocaleString('en', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' })}</p>
        <p class="sr-result__instant mono" data-lr-reading-basis>Reading basis · {model.readingBasis.join(' · ')}</p>
        <p class="field__help">The Moon returns to its natal tropical longitude. The birthplace supplies the default return location. {wheel.houses!.system === 'whole' ? 'Whole-sign' : 'Placidus'} houses.</p>
        {model.notes.slice(1).map((note) => <p class="notice" key={note}>{note}</p>)}
        {result.natalLocalMeanTime
          ? <p class="notice">The birth time is read on the birthplace's own local mean time, set by its longitude.</p>
          : result.natalTimeFlags.includes('lmt') && <p class="notice">The birth time is read on the local mean time its time zone kept then.</p>}
        <h2>Return placements</h2>
        <div class="calc__table-wrap"><table class="calc__table">
          <caption class="sr-only">Lunar return placements</caption>
          <thead><tr><th scope="col">Body</th><th scope="col">Sign</th><th scope="col">Degree</th><th scope="col">House</th></tr></thead>
          <tbody>{wheel.bodies.map((body) => <tr key={body.body}><th scope="row">{body.body}</th><td>{signForLongitude(body.lon).name}</td><td class="mono">{formatLongitude(body.lon).split(' ')[0]}</td><td class="mono">{houseOf(body.lon, wheel.houses!.cusps)}</td></tr>)}</tbody>
        </table></div>
      </div>
    </EvidenceDisclosure>
    <div class="calc__actions"><a class="btn btn--ghost" href="/birth-chart/">Open your birth chart →</a><a class="btn btn--ghost" href="/transits/">Explore today’s transits →</a></div>
  </div>;
}
