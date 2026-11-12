import { CheckOurMath, ResultOpening } from '../ChartTrust';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { ComponentType } from 'preact';
import type { WheelProps } from '../../lib/wheel/Wheel';
import { houseOf } from '../../lib/engine/houses';
import { SIGNS, formatLongitude, signForLongitude } from '../../lib/signs';
import type { SolarReturnResultData } from './compute';
import { SR_COPY } from './copy';
import { solarReturnExportModel } from './export-model';
import SolarReturnActions from './SolarReturnActions';
import EvidenceDisclosure from '../EvidenceDisclosure';
import { solarReturnThemes } from '../../lib/solar-return/themes';
import { solarReturnShareUrl } from '../../lib/solar-return/share';

export interface SolarReturnResultProps {
  result: SolarReturnResultData;
  Wheel: ComponentType<WheelProps>;
  /** The themes block and share link, behind PUBLIC_SOLAR_RETURN_SHARE_ENABLED (src/lib/launch-flags.ts). */
  themes?: boolean;
  /** The button to /year-score/, behind PUBLIC_YEAR_SCORE_ENABLED. */
  yearScoreLink?: boolean;
  /** The button to /birthday-report/, behind PUBLIC_BIRTHDAY_REPORT_ENABLED. */
  birthdayReportLink?: boolean;
}

export function SolarReturnResult({ result, Wheel, themes: themesOn = false, yearScoreLink = false, birthdayReportLink = false }: SolarReturnResultProps) {
  const { chart } = result;
  const model = useMemo(() => solarReturnExportModel(result), [result]);
  // Images and calendar files start from the natal Sun at the whole minute.
  const shared = useMemo(() => (result.shared ? solarReturnExportModel({ ...result, chart: result.shared }) : model), [result, model]);
  const { wheel } = model;
  const sun = chart.bodies.find((body) => body.body === 'Sun')!;
  const planetsOnly = model.reading[0]?.kind === 'planets-only';
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The year's main themes, from the same reading as the get_solar_return tool (src/lib/solar-return/themes.ts).
  // The rising sign and the Sun's house are already in the opening, so the list adds the rest.
  const themes = useMemo(() => solarReturnThemes({
    bodies: chart.bodies, aspects: chart.aspects,
    asc: wheel.angles?.asc ?? null, cusps: wheel.houses?.cusps ?? null, timeKnown: !result.noTime,
  }).filter((theme) => theme.kind !== 'rising' && theme.kind !== 'sun-house' && !(planetsOnly && theme.kind === 'aspect')), [chart, wheel, result.noTime, planetsOnly]);
  // The share link carries the Sun sign, the year and the rising and Jupiter signs only, never a birth detail.
  // Without a birth time, only when the birth day settles the Sun sign (result.sunSign); no sign is guessed.
  const sunSlug = result.noTime ? (typeof result.sunSign === 'number' ? SIGNS[result.sunSign].slug : null) : signForLongitude(sun.lon).slug;
  const shareUrl = useMemo(() => {
    const jupiter = chart.bodies.find((body) => body.body === 'Jupiter');
    return jupiter && sunSlug ? solarReturnShareUrl(location.origin, {
      sun: sunSlug, year: result.returnYear,
      rising: wheel.angles ? signForLongitude(wheel.angles.asc).slug : null, jupiter: signForLongitude(jupiter.lon).slug,
    }) : null;
  }, [chart, sunSlug, result.returnYear, wheel.angles]);

  useEffect(() => {
    (window as typeof window & {
      zodiacsAnalytics?: { track?: (name: string, props: { via: string }) => void };
    }).zodiacsAnalytics?.track?.('srchart_view', { via: 'page' });
    headingRef.current?.focus();
  }, [chart.input.utc]);

  return (
    <div class="sr-result" data-solar-return-result data-sr-asc={wheel.angles?.asc ?? undefined} data-sr-sun={sun.lon} data-sr-no-time={result.noTime} data-sr-no-place={result.noPlace}>
      <ResultOpening kind="return" />
      <CheckOurMath utc={chart.input.utc} basis={result.noTime ? 'approximate-return' : 'return'} />
      <section class="shell sr-result__reading" aria-labelledby="solar-return-reading-title">
        <div class="core sr-result__core">
          <span class="mono--label">Your {result.returnYear} return</span>
          <h2 id="solar-return-reading-title" ref={headingRef} tabIndex={-1}>Your year, at a glance</h2>
          {model.reading.map((reading) => <p key={reading.kind} class="sr-result__line" data-sr-corpus={reading.kind}>{reading.text}</p>)}
        </div>
      </section>

      {result.noTime && <p class="notice" data-noon-notice>{SR_COPY.noon}</p>}
      {result.noPlace && <p class="notice">{SR_COPY.noPlace}</p>}

      <section class="calc__wheel shell">
        <div class="core calc__wheel-core">
          <div aria-hidden="true">
            <Wheel
              bodies={wheel.bodies.filter((body) => body.body !== 'South Node')}
              asc={wheel.angles?.asc ?? null}
              mc={wheel.angles?.mc ?? null}
              cusps={wheel.houses?.cusps ?? null}
              aspects={wheel.aspects.filter((aspect) => aspect.orb < 6)}
              animate
            />
          </div>
        </div>
      </section>

      {themesOn && themes.length > 0 && (
        <section class="sr-themes" aria-labelledby="solar-return-themes-title">
          {/* Without house cusps the themes read the planets by sign, the same for everyone with a birthday near this one. */}
          {wheel.houses?.cusps ? <h2 id="solar-return-themes-title">The year’s main themes</h2> : <>
            <h2 id="solar-return-themes-title">This birthday season's sky</h2>
            <p data-sr-themes-shared>Shared by everyone with a birthday near yours. A birth time and place make it yours.</p>
          </>}
          <ul class="sr-themes__list">
            {themes.map((theme) => (
              <li key={theme.kind} class="tile sr-themes__item" data-sr-theme={theme.kind}>
                <h3>{theme.title}</h3>
                <p>{theme.line}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SolarReturnActions model={shared} />

      <div class="calc__actions">
        {themesOn && shareUrl && <a class="btn btn--primary" href={shareUrl} data-sr-share-link>Share your solar return ↗</a>}
        {yearScoreLink && <a class="btn btn--ghost" href="/year-score/">Score the year ahead →</a>}
        {birthdayReportLink && <a class="btn btn--ghost" href="/birthday-report/">Your birthday report →</a>}
        <a class="btn btn--ghost" href="/birth-chart/">Open your full birth chart →</a>
        <a class="btn btn--ghost" href="/transits/">See today’s transits →</a>
      </div>

      <EvidenceDisclosure label="Return chart details" variant="panel" className="shell sr-result__details">
        <div class="sr-result__details-content">
          <p class="sr-result__instant mono" data-return-instant>
            Sun · {formatLongitude(sun.lon)}
            {/* Without a birth time the return is a date, a day either side, never a clock time. */}
            {result.noTime ? <><br />UTC date · {chart.input.utc.toISOString().slice(0, 10)}</> : <>
              <br />UTC · {chart.input.utc.toISOString().slice(0, 19).replace('T', ' · ')}
              <br />Your time · {chart.input.utc.toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
              })}
            </>}
          </p>
          {planetsOnly && (
            <p class="sr-result__instant mono" data-sr-planets-only-receipt>
              Reading basis · {model.readingBasis.join(' · ')}
            </p>
          )}
          {!planetsOnly && (
            <p class="sr-result__instant mono" data-sr-reading-basis>
              Reading basis
              {` · ${model.readingBasis.join(' · ')}`}
            </p>
          )}
          <h2>Return placements</h2>
          <div class="calc__table-wrap">
            <table class="calc__table">
              <caption class="sr-only">Solar return placements</caption>
              <thead><tr><th>Body</th><th>Sign</th><th>Degree</th>{wheel.houses && <th>House</th>}</tr></thead>
              <tbody>
                {chart.bodies.map((body) => {
                  const sign = signForLongitude(body.lon);
                  const degree = formatLongitude(body.lon).split(' ')[0];
                  return <tr key={body.body}><td>{body.body}</td><td>{sign.name}</td><td class="mono">{degree}</td>{wheel.houses && <td class="mono">{houseOf(body.lon, wheel.houses.cusps)}</td>}</tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </EvidenceDisclosure>
    </div>
  );
}
