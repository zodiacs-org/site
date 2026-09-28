import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import AspectGlyph from '../../components/AspectGlyph';
import PlanetGlyph from '../../components/PlanetGlyph';
import type { Aspect, BodyName } from '../../lib/engine/types';
import { natalAspectLine, type ChartWeather } from '../../lib/natal';
import { SIGNS, signForLongitude, signName } from '../../lib/signs';
import { signIcon } from '../../lib/sign-icon';
import { entityId, type EntityRef, type SignSlug } from '../../lib/scene/types';
import { moonCandidates, moonLabel } from '../../lib/moon-certainty';
import './ReadingPath.css';
import LearningPractice, { type PracticeSource } from './LearningPractice';
import type { HouseSystem } from '../../lib/engine/types';

export interface ReadingPathPlacement {
  body: BodyName;
  lon: number;
  house: number | null;
}

export type ReadingScrollBehavior = 'instant' | 'smooth';

export interface ReadingPathProps {
  practiceSource?: PracticeSource | null;
  timeKnown?: boolean;
  effectiveHouseSystem?: HouseSystem | null;
  polarFallback?: boolean;
  placements: readonly ReadingPathPlacement[];
  topAspects: readonly Aspect[];
  weather: ChartWeather;
  risingLon: number | null;
  housesKnown: boolean;
  moonSignCandidates?: readonly string[];
  selection?: EntityRef | null;
  onShowOnChart: (selection: EntityRef, scrollBehavior: ReadingScrollBehavior) => void;
}

const ELEMENTS = [
  ['fire', 'Fire'],
  ['earth', 'Earth'],
  ['air', 'Air'],
  ['water', 'Water'],
] as const;

const MODALITIES = [
  ['cardinal', 'Cardinal'],
  ['fixed', 'Fixed'],
  ['mutable', 'Mutable'],
] as const;

const BIG_THREE_ROLE = {
  Sun: 'The part of you that chooses a direction',
  Moon: 'What you need in order to feel steady',
  Rising: 'How people first meet you',
} as const;

/**
 * Pointer clicks may use a spatial scroll back to the wheel. Keyboard
 * activations and reduced-motion users get an immediate jump instead.
 */
export function readingScrollBehavior(
  clickDetail: number,
  reducedMotion: boolean,
): ReadingScrollBehavior {
  return clickDetail > 0 && !reducedMotion ? 'smooth' : 'instant';
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function selected(selection: EntityRef | null | undefined, ref: EntityRef): boolean {
  return selection != null && entityId(selection) === entityId(ref);
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

interface ShowButtonProps {
  entity: EntityRef;
  subject: string;
  selection?: EntityRef | null;
  onShow: ReadingPathProps['onShowOnChart'];
}

function ShowButton({ entity, subject, selection, onShow }: ShowButtonProps) {
  const isSelected = selected(selection, entity);
  const action = entity.kind === 'aspect'
    ? 'Trace this aspect'
    : entity.kind === 'angle'
      ? 'Spotlight rising'
      : entity.kind === 'body'
        ? `Spotlight ${entity.body}`
        : entity.kind === 'house'
          ? 'Spotlight this house'
          : 'Spotlight this sign';
  return (
    <button
      class="reading-path__show"
      type="button"
      aria-label={`Show on chart: ${subject}`}
      aria-pressed={isSelected}
      data-selected={isSelected ? 'true' : undefined}
      onClick={(event) => onShow(
        entity,
        readingScrollBehavior(event.detail, prefersReducedMotion()),
      )}
    >
      <span>{isSelected ? 'Highlighted on chart' : action}</span>
      <span class="reading-path__show-icon" aria-hidden="true">{isSelected ? '✓' : '↑'}</span>
    </button>
  );
}

interface StoryCardProps {
  number: string;
  slug: string;
  title: string;
  intro: string;
  children: ComponentChildren;
}

function StoryCard({ number, slug, title, intro, children }: StoryCardProps) {
  return (
    <li class="reading-path__step" data-reading-card={slug} data-reading-reveal>
      <article class="reading-path__card">
        <header class="reading-path__card-head">
          <span class="reading-path__number" aria-hidden="true">{number}</span>
          <h3>{title}</h3>
          <p>{intro}</p>
        </header>
        <div class="reading-path__card-body">{children}</div>
      </article>
    </li>
  );
}

interface BigThreeTileProps {
  label: keyof typeof BIG_THREE_ROLE;
  lon: number | null;
  entity: EntityRef | null;
  selection?: EntityRef | null;
  onShow: ReadingPathProps['onShowOnChart'];
  moonSignCandidates?: readonly string[];
}

function BigThreeTile({ label, lon, entity, selection, onShow, moonSignCandidates }: BigThreeTileProps) {
  if (label === 'Moon' && moonSignCandidates?.length !== 1) {
    return (
      <li class="reading-path__big-tile reading-path__big-tile--missing" data-moon-uncertain>
        <span class="reading-path__big-label">Moon</span>
        <span class="reading-path__sign-disc reading-path__sign-disc--missing" aria-hidden="true">?</span>
        <strong>{moonLabel({ bodies: [], moonSignCandidates: moonSignCandidates ?? [] })}</strong>
        <p>A birth time is needed to settle your Moon sign.</p>
        {entity && <ShowButton entity={entity} subject="Moon at the reference time" selection={selection} onShow={onShow} />}
      </li>
    );
  }
  if (lon == null || entity == null) {
    return (
      <li class="reading-path__big-tile reading-path__big-tile--missing">
        <span class="reading-path__big-label">{label}</span>
        <span class="reading-path__sign-disc reading-path__sign-disc--missing" aria-hidden="true">?</span>
        <strong>Birth time needed</strong>
        <p>{BIG_THREE_ROLE[label]}</p>
      </li>
    );
  }

  const sign = signForLongitude(lon);
  const isSelected = selected(selection, entity);
  return (
    <li
      class="reading-path__big-tile"
      style={`--sign:${sign.hue}`}
      data-selected={isSelected ? 'true' : undefined}
    >
      <span class="reading-path__big-label">{label}</span>
      <picture class="reading-path__sign-disc" aria-hidden="true">
        <img
          src={signIcon(48, sign.slug)}
          width="40"
          height="40"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </picture>
      <strong>{signName(sign)}</strong>
      <p>{BIG_THREE_ROLE[label]}.</p>
      <ShowButton
        entity={entity}
        subject={`${label} in ${signName(sign)}`}
        selection={selection}
        onShow={onShow}
      />
    </li>
  );
}

interface PlacementListProps {
  placements: readonly ReadingPathPlacement[];
  housesKnown: boolean;
  selection?: EntityRef | null;
  onShow: ReadingPathProps['onShowOnChart'];
  moonSignCandidates?: readonly string[];
}

function PlacementList({ placements, housesKnown, selection, onShow, moonSignCandidates }: PlacementListProps) {
  return (
    <details class="reading-path__placements">
      <summary>
        <span>See all placements</span>
        <span class="reading-path__details-icon" aria-hidden="true" />
      </summary>
      <ul>
        {placements.map((placement) => {
          const sign = signForLongitude(placement.lon);
          const entity: EntityRef = { kind: 'body', body: placement.body };
          const uncertainMoon = placement.body === 'Moon' && moonSignCandidates?.length !== 1;
          const place = uncertainMoon
            ? `${moonLabel({ bodies: [], moonSignCandidates: moonSignCandidates ?? [] })} · Birth time needed`
            : housesKnown && placement.house != null
            ? `${signName(sign)} · House ${placement.house}`
            : signName(sign);
          return (
            <li
              key={placement.body}
              data-selected={selected(selection, entity) ? 'true' : undefined}
            >
              <span class="reading-path__placement-identity">
                <PlanetGlyph body={placement.body} size={18} />
                <span>
                  <strong>{placement.body}</strong>
                  <small>{place}</small>
                </span>
              </span>
              <ShowButton
                entity={entity}
                subject={uncertainMoon ? 'Moon at the reference time' : `${placement.body} in ${signName(sign)}`}
                selection={selection}
                onShow={onShow}
              />
            </li>
          );
        })}
      </ul>
    </details>
  );
}

interface PlaceMapProps extends PlacementListProps {}

function HouseMap({ placements, housesKnown, selection, onShow, moonSignCandidates }: PlaceMapProps) {
  if (!housesKnown) {
    return (
      <>
        <p class="reading-path__no-time">
          Birth time is unknown, so houses are not shown. This sign view still shows where your
          planets gather; add a birth time later to see the life areas they occupy.
        </p>
        <ul class="reading-path__room-map reading-path__room-map--signs" aria-label="Planets grouped by sign">
          {SIGNS.map((sign) => {
            const occupants = placements.filter((placement) => !(placement.body === 'Moon' && moonSignCandidates?.length !== 1)
              && signForLongitude(placement.lon).slug === sign.slug);
            const entity: EntityRef = { kind: 'sign', sign: sign.slug as SignSlug };
            const hasSelectedBody = selection?.kind === 'body'
              && occupants.some((placement) => placement.body === selection.body);
            const entitySelected = selected(selection, entity);
            const isHighlighted = entitySelected || hasSelectedBody;
            return (
              <li key={sign.slug} data-reading-sign={sign.slug}>
                <button
                  type="button"
                  style={`--sign:${sign.hue}`}
                  aria-label={`Show ${signName(sign)} on chart${occupants.length ? `: ${occupants.map((p) => p.body).join(', ')}` : ''}`}
                  aria-pressed={entitySelected}
                  data-selected={isHighlighted ? 'true' : undefined}
                  onClick={(event) => onShow(
                    entity,
                    readingScrollBehavior(event.detail, prefersReducedMotion()),
                  )}
                >
                  <span class="reading-path__room-title">
                    <span aria-hidden="true">{sign.glyph}</span>
                    {signName(sign)}
                  </span>
                  <span class="reading-path__room-bodies" aria-hidden="true">
                    {occupants.map((placement) => (
                      <PlanetGlyph key={placement.body} body={placement.body} size={17} />
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <PlacementList
          placements={placements}
          moonSignCandidates={moonSignCandidates}
          housesKnown={housesKnown}
          selection={selection}
          onShow={onShow}
        />
      </>
    );
  }

  return (
    <>
      <ul class="reading-path__room-map" aria-label="The twelve houses and their planets">
        {Array.from({ length: 12 }, (_, index) => index + 1).map((house) => {
          const occupants = placements.filter((placement) => placement.house === house);
          const entity: EntityRef = { kind: 'house', house };
          const hasSelectedBody = selection?.kind === 'body'
            && occupants.some((placement) => placement.body === selection.body);
          const entitySelected = selected(selection, entity);
          const isHighlighted = entitySelected || hasSelectedBody;
          return (
            <li key={house} data-reading-house={house}>
              <button
                type="button"
                aria-label={`Show House ${house} on chart${occupants.length ? `: ${occupants.map((p) => p.body).join(', ')}` : ''}`}
                aria-pressed={entitySelected}
                data-selected={isHighlighted ? 'true' : undefined}
                onClick={(event) => onShow(
                  entity,
                  readingScrollBehavior(event.detail, prefersReducedMotion()),
                )}
              >
                <span class="reading-path__room-title">House {house}</span>
                <span class="reading-path__room-bodies" aria-hidden="true">
                  {occupants.map((placement) => {
                    const sign = signForLongitude(placement.lon);
                    return (
                      <span key={placement.body} style={`--sign:${sign.hue}`}>
                        <PlanetGlyph body={placement.body} size={17} />
                      </span>
                    );
                  })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <PlacementList
        placements={placements}
        moonSignCandidates={moonSignCandidates}
        housesKnown={housesKnown}
        selection={selection}
        onShow={onShow}
      />
    </>
  );
}

interface AspectCardsProps {
  aspects: readonly Aspect[];
  selection?: EntityRef | null;
  onShow: ReadingPathProps['onShowOnChart'];
}

function AspectCards({ aspects, selection, onShow }: AspectCardsProps) {
  if (aspects.length === 0) {
    return <p class="reading-path__empty">There are no major aspects to lead with in this chart.</p>;
  }

  return (
    <ul class="reading-path__aspect-list">
      {aspects.map((aspect, index) => {
        const entity: EntityRef = {
          kind: 'aspect',
          a: aspect.a,
          b: aspect.b,
          type: aspect.type,
        };
        const title = `${aspect.a} ${aspect.type} ${aspect.b}`;
        return (
          <li
            key={`${aspect.a}-${aspect.type}-${aspect.b}`}
            style={`--item-delay:${index * 40}ms`}
            data-selected={selected(selection, entity) ? 'true' : undefined}
          >
            <div class="reading-path__connection" aria-hidden="true">
              <span class="reading-path__planet-node">
                <PlanetGlyph body={aspect.a} size={19} />
                <span>{aspect.a}</span>
              </span>
              <span class="reading-path__connection-line">
                <span class="reading-path__line" />
                <span class="reading-path__aspect-node"><AspectGlyph type={aspect.type} size={17} /></span>
                <span class="reading-path__line reading-path__line--end" />
              </span>
              <span class="reading-path__planet-node">
                <PlanetGlyph body={aspect.b} size={19} />
                <span>{aspect.b}</span>
              </span>
            </div>
            <h4>{title}</h4>
            <p>{natalAspectLine(aspect.a, aspect.type, aspect.b)}</p>
            <span class="reading-path__orb">{cap(aspect.type)} · {aspect.orb.toFixed(1)}° orb</span>
            <ShowButton
              entity={entity}
              subject={title}
              selection={selection}
              onShow={onShow}
            />
          </li>
        );
      })}
    </ul>
  );
}

interface BalanceGroupProps {
  label: string;
  values: readonly (readonly [string, string, number])[];
}

function BalanceGroup({ label, values }: BalanceGroupProps) {
  return (
    <section class="reading-path__balance-group" aria-label={label}>
      <h4>{label}</h4>
      <ul>
        {values.map(([key, name, count], index) => {
          const value = Math.max(0, Math.min(1, count / 10));
          return (
            <li key={key} data-pattern-key={key} style={`--bar-delay:${index * 40}ms`}>
              <span class="reading-path__bar-label"><span>{name}</span><strong>{count}</strong></span>
              <span class="reading-path__bar-track" aria-hidden="true">
                <span class="reading-path__bar-fill" style={`--bar-value:${value.toFixed(2)}`} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function ReadingPath({
  placements,
  topAspects,
  weather,
  risingLon,
  housesKnown,
  moonSignCandidates,
  selection = null,
  onShowOnChart,
  practiceSource = null,
  timeKnown = false,
  effectiveHouseSystem = null,
  polarFallback = false,
}: ReadingPathProps) {
  const rootRef = useRef<HTMLElement>(null);
  const sun = placements.find((placement) => placement.body === 'Sun') ?? null;
  const moon = placements.find((placement) => placement.body === 'Moon') ?? null;
  const possibleMoonSigns = moonCandidates({ bodies: placements, angles: housesKnown ? {} : null, moonSignCandidates });
  const uncertainMoon = possibleMoonSigns.length !== 1;
  const settledPlacements = placements.filter((placement) => placement.body !== 'Moon');
  const shownElements = uncertainMoon
    ? Object.fromEntries(ELEMENTS.map(([key]) => [key, settledPlacements.filter((placement) => signForLongitude(placement.lon).element === key).length]))
    : weather.elements;
  const shownModalities = uncertainMoon
    ? Object.fromEntries(MODALITIES.map(([key]) => [key, settledPlacements.filter((placement) => signForLongitude(placement.lon).modality === key).length]))
    : weather.modalities;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-reading-reveal]'));
    const reveal = (card: HTMLElement) => { card.dataset.visible = 'true'; };
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      cards.forEach(reveal);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const card = entry.target as HTMLElement;
        reveal(card);
        observer.unobserve(card);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <section class="reading-path" aria-labelledby="reading-path-title" ref={rootRef}>
      <header class="reading-path__head">
        <h2 id="reading-path-title">Read your chart, one step at a time.</h2>
        <p>
          Locate your big three, explore where your planets gather, then read the connections
          between them. Each highlight takes you back to the wheel.
        </p>
      </header>

      <ol class="reading-path__steps">
        <StoryCard
          number="01"
          slug="big-three"
          title="Locate your big three"
          intro="Use these three reference points to find your way around the wheel."
        >
          <ul class="reading-path__big-three">
            <BigThreeTile
              label="Sun"
              lon={sun?.lon ?? null}
              entity={sun ? { kind: 'body', body: 'Sun' } : null}
              selection={selection}
              onShow={onShowOnChart}
            />
            <BigThreeTile
              label="Moon"
              moonSignCandidates={possibleMoonSigns}
              lon={moon?.lon ?? null}
              entity={moon ? { kind: 'body', body: 'Moon' } : null}
              selection={selection}
              onShow={onShowOnChart}
            />
            <BigThreeTile
              label="Rising"
              lon={risingLon}
              entity={risingLon != null ? { kind: 'angle', angle: 'asc' } : null}
              selection={selection}
              onShow={onShowOnChart}
            />
          </ul>
          {possibleMoonSigns.map((slug) => (
            <a key={slug} class="reading-path__placement-link" href={`/learn/placements/moon-in-${slug}/`}>
              Read Moon in {signName(SIGNS.find((sign) => sign.slug === slug)!)} →
            </a>
          ))}
        </StoryCard>

        <StoryCard
          number="02"
          slug="places"
          title="See where life happens"
          intro={housesKnown
            ? 'Houses are the life areas where each planet gets expressed. Filled rooms carry more of the story.'
            : 'Without a birth time, signs still show which energies gather together.'}
        >
          <HouseMap
            placements={placements}
            moonSignCandidates={possibleMoonSigns}
            housesKnown={housesKnown}
            selection={selection}
            onShow={onShowOnChart}
          />
        </StoryCard>

        <StoryCard
          number="03"
          slug="aspects"
          title="Find your strongest push-pulls"
          intro="Aspects are conversations between planets. The tightest ones tend to speak the loudest."
        >
          {uncertainMoon && <p class="reading-path__no-time">Moon aspects need a birth time and are left out of this reading.</p>}
          <AspectCards aspects={topAspects.filter((aspect) => !uncertainMoon || (aspect.a !== 'Moon' && aspect.b !== 'Moon'))} selection={selection} onShow={onShowOnChart} />
        </StoryCard>

        <StoryCard
          number="04"
          slug="pattern"
          title="Read your overall pattern"
          intro="Elements show your natural fuel. Modalities show how you start, sustain, and adapt."
        >
          <div class="reading-path__balance">
            <BalanceGroup
              label="Elements"
              values={ELEMENTS.map(([key, label]) => [key, label, shownElements[key]] as const)}
            />
            <BalanceGroup
              label="Ways of moving"
              values={MODALITIES.map(([key, label]) => [key, label, shownModalities[key]] as const)}
            />
          </div>
          {uncertainMoon && <p class="reading-path__no-time">The Moon is left out of these totals until its sign is settled.</p>}
          {!uncertainMoon && weather.lines.length > 0 && (
            <ul class="reading-path__weather">
              {weather.lines.slice(0, 2).map((line) => <li key={line}>{line}</li>)}
            </ul>
          )}
        </StoryCard>
      </ol>
      {practiceSource && <LearningPractice
        key={`${practiceSource.id}:${practiceSource.run}:${practiceSource.inputRevision}`}
        source={practiceSource} placements={placements} topAspects={topAspects}
        timeKnown={timeKnown} risingLon={risingLon} housesKnown={housesKnown}
        moonSignCandidates={moonSignCandidates} effectiveHouseSystem={effectiveHouseSystem}
        requestedHouseSystem={null} polarFallback={polarFallback} onShow={onShowOnChart} />}
    </section>
  );
}
