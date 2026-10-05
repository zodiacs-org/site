/**
 * The Explorer inspector — a beginner-first explanation for the selected
 * chart entity. Meaning comes before measurement; exact degrees and motion
 * remain available in a compact disclosure.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import PlanetGlyph from '../../components/PlanetGlyph';
import AspectGlyph from '../../components/AspectGlyph';
import AstroTerm from '../AstroTerm';
import {
  formatLongitude, signBySlug, signDates, signEssence, signForLongitude,
  signName, signPrepositional, elementLabel, modalityLabel,
} from '../../lib/signs';
import { signIcon } from '../../lib/sign-icon';
import { NATAL_HOUSE_THEME, natalAspectLine, planetInHouseLine } from '../../lib/natal';
import { placementContext } from '../../lib/natal-context';
import { moonCandidates, moonIsUncertain, moonLabel } from '../../lib/moon-certainty';
import { aspectLabel, planetLabel } from '../../lib/i18n/astrology';
import { localizePath, t, type CatalogLocale as Locale } from '../../lib/i18n';
import type { AspectType } from '../../lib/engine/types';
import type { ChartSceneModel, EntityRef, SignSlug } from '../../lib/scene/types';
import { entityId, parseEntityId } from '../../lib/scene/types';

const HOUSE_SLUG = [
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
  'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
];

const DIGNITY_KEY = {
  domicile: 'dignityDomicile',
  exaltation: 'dignityExaltation',
  detriment: 'dignityDetriment',
  fall: 'dignityFall',
} as const;

const ASPECT_CONTEXT: Record<AspectType, string> = {
  conjunction: 'A conjunction brings two parts of the chart together so closely that they tend to act as one.',
  sextile: 'A sextile is a supportive 60° connection. It describes an opportunity for two parts of the chart to cooperate.',
  square: 'A square is a 90° connection that creates friction, pressure, and a reason to develop a new response.',
  trine: 'A trine is a flowing 120° connection. Its strengths can feel so natural that they are easy to overlook.',
  opposition: 'An opposition places two parts of the chart across from one another, asking for balance instead of choosing one side.',
};

const ANGLE_CONTEXT = {
  asc: {
    what: 'The Ascendant is the exact point rising on the eastern horizon when you were born.',
    why: 'Astrologers use it to describe first impressions, your approach to new situations, and the starting point of the houses.',
  },
  dsc: {
    what: 'The Descendant is the point setting on the western horizon, directly opposite the Ascendant.',
    why: 'Astrologers use it to describe the qualities you meet through close partnerships and one-to-one relationships.',
  },
  mc: {
    what: 'The Midheaven is the chart’s upper meridian point, often shortened to MC.',
    why: 'Astrologers connect it with public life, reputation, vocation, and the direction you are seen moving toward.',
  },
  ic: {
    what: 'The IC is the chart’s lower meridian point, directly opposite the Midheaven.',
    why: 'Astrologers connect it with home, roots, private life, and the conditions that help you feel grounded.',
  },
} as const;

const DETENT_LABELS = {
  en: { expand: 'Expand chart explanation', collapse: 'Collapse chart explanation' },
  es: { expand: 'Ampliar la explicación de la carta', collapse: 'Contraer la explicación de la carta' },
  pt: { expand: 'Expandir a explicação do mapa', collapse: 'Recolher a explicação do mapa' },
  fr: { expand: 'Développer l’explication du thème', collapse: 'Réduire l’explication du thème' },
  it: { expand: 'Espandi la spiegazione del tema', collapse: 'Riduci la spiegazione del tema' },
  ru: { expand: 'Развернуть объяснение карты', collapse: 'Свернуть объяснение карты' },
} as const satisfies Record<Locale, { expand: string; collapse: string }>;

interface Props {
  scene: ChartSceneModel;
  selection: EntityRef | null;
  onSelect: (e: EntityRef | null) => void;
  locale: Locale;
  /** Optional slot above the heading — the tour's “Back to the tour” link. */
  banner?: ComponentChildren;
}

function SignDisc({ slug, size = 20 }: { slug: string; size?: number }) {
  return (
    <picture class="insp__disc">
      <img src={signIcon(48, slug)} width={size} height={size} alt="" decoding="async" />
    </picture>
  );
}

function Receipt({ label, children }: { label: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="insp__row">
      <span class="mono--label">{label}</span>
      <span class="mono insp__val">{children}</span>
    </div>
  );
}

function Insight({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <section class="insp__insight">
      <h4 class="mono--label">{label}</h4>
      <div class="insp__read">{children}</div>
    </section>
  );
}

function ExactData({ children }: { children: ComponentChildren }) {
  return (
    <details class="insp__exact">
      <summary>Exact chart data</summary>
      <div class="insp__exact-body">{children}</div>
    </details>
  );
}

function Related({ children }: { children: ComponentChildren }) {
  return (
    <div class="insp__related">
      <span class="mono--label">Explore next</span>
      <div class="insp__related-actions">{children}</div>
    </div>
  );
}

function isNode(body: string): boolean {
  return body === 'North Node' || body === 'South Node';
}

export default function Inspector({ scene, selection, onSelect, locale, banner }: Props) {
  const showsEnglishInterpretation = locale === 'en';
  const [detent, setDetent] = useState<'half' | 'full'>('half');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dragFrom = useRef<number | null>(null);
  const activePointer = useRef<number | null>(null);
  const suppressHandleClick = useRef(false);
  const instantSwap = useRef(false);
  const selectionKey = selection ? entityId(selection) : 'none';

  // A different entity reopens the mobile sheet at its useful half detent.
  useEffect(() => { setDetent('half'); }, [selectionKey]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => { instantSwap.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [selectionKey]);

  if (!selection) {
    return (
      <div class="insp insp--hint" data-explorer-inspector>
        <p class="insp__hint">{t(locale, 'explorerHint')}</p>
      </div>
    );
  }

  const selectRelated = (ref: EntityRef, event: MouseEvent) => {
    instantSwap.current = event.detail === 0;
    onSelect(ref);
    requestAnimationFrame(() => headingRef.current?.focus());
  };
  const learn = (path: string, label: string, englishOnly = true) => (
    <a
      class="insp__more"
      href={path}
      title={locale === 'ru' && englishOnly ? 'Материал пока доступен по-английски' : undefined}
    >{label}{locale === 'ru' && englishOnly ? ' — пока по-английски' : ''} →</a>
  );
  const signButton = (slug: SignSlug, label: string) => {
    const sign = signBySlug(slug);
    return (
      <button
        class="insp__chip"
        type="button"
        style={`--sign:${sign.hue}`}
        onClick={(event) => selectRelated({ kind: 'sign', sign: slug }, event)}
      >
        <SignDisc slug={slug} size={16} /> {label}
      </button>
    );
  };

  let title: ComponentChildren = null;
  let body: ComponentChildren = null;

  switch (selection.kind) {
    case 'body': {
      const sb = scene.bodies.find((candidate) => candidate.body === selection.body);
      if (!sb) return null;
      if (sb.body === 'Moon' && moonIsUncertain(scene)) {
        title = <><PlanetGlyph body="Moon" size={17} class="insp__pg" />{planetLabel(locale, 'Moon')}</>;
        body = (
          <>
            <p class="insp__note" data-moon-uncertain><strong>{moonLabel(scene, locale)}</strong>{moonCandidates(scene).length > 0 && ` · ${t(locale, 'needsBirthTime')}`}</p>
            {showsEnglishInterpretation && <Insight label="Where it shows up">{placementContext(sb.body, sb.sign, sb.house, sb.speed).where}</Insight>}
            <Related>{moonCandidates(scene).map((slug) => signButton(slug as SignSlug, signName(signBySlug(slug), locale)))}</Related>
            <ExactData><p>{t(locale, 'noTimeNotice')}</p><Receipt label={t(locale, 'position')}>{formatLongitude(sb.lon, locale)}</Receipt></ExactData>
          </>
        );
        break;
      }
      const sign = signBySlug(sb.sign);
      const context = placementContext(sb.body, sb.sign, sb.house, sb.speed);
      const node = isNode(sb.body);
      const relatedAspects = node ? [] : sb.aspects;
      const bodyLabel = planetLabel(locale, sb.body);
      const exact = (
        <>
          <Receipt label={t(locale, 'position')}>{formatLongitude(sb.lon, locale)}</Receipt>
          <Receipt label={t(locale, 'sign')}><SignDisc slug={sb.sign} size={16} /> {signName(sign, locale)}</Receipt>
          {sb.house != null && <Receipt label={t(locale, 'house')}>{sb.house}</Receipt>}
          <Receipt label={t(locale, 'speed')}>
            {sb.speed >= 0 ? '+' : '−'}{Math.abs(sb.speed).toFixed(2)}°/{t(locale, 'day')}
          </Receipt>
          {sb.dignity && (
            <Receipt label={t(locale, 'dignity')}>
              {showsEnglishInterpretation
                ? <AstroTerm term={sb.dignity} label={t(locale, DIGNITY_KEY[sb.dignity])} surface="chart-inspector" whyItMatters="This is a traditional kind of support—not a verdict that the placement is good or bad." />
                : t(locale, DIGNITY_KEY[sb.dignity])}
            </Receipt>
          )}
        </>
      );
      const related = (
        <>
          {signButton(sb.sign, signName(sign, locale))}
          {sb.house != null && (
            <button class="insp__chip" type="button" onClick={(event) => selectRelated({ kind: 'house', house: sb.house! }, event)}>
              {t(locale, 'house')} {sb.house}
            </button>
          )}
          {relatedAspects.map((id) => {
            const ref = parseEntityId(id);
            if (!ref || ref.kind !== 'aspect') return null;
            const partner = ref.a === sb.body ? ref.b : ref.a;
            const sa = scene.aspects.find((candidate) => (
              candidate.a === ref.a && candidate.b === ref.b && candidate.type === ref.type
            ));
            return (
              <button class="insp__chip" type="button" key={id} onClick={(event) => selectRelated(ref, event)}>
                <AspectGlyph type={ref.type} size={12} class="insp__pg" />
                {aspectLabel(locale, ref.type)} · {planetLabel(locale, partner)}
                {sa && <span class="insp__orb"> · {sa.orb.toFixed(1)}°</span>}
              </button>
            );
          })}
        </>
      );

      title = (
        <>
          <PlanetGlyph body={sb.body} size={17} class="insp__pg" />
          {node && showsEnglishInterpretation
            ? <AstroTerm term={sb.body === 'North Node' ? 'north-node' : 'south-node'} label={bodyLabel} surface="chart-inspector" />
            : bodyLabel}
          {sb.retrograde && (
            <span class="mono insp__rx">{' '}
              {showsEnglishInterpretation && !node
                ? <AstroTerm term="retrograde" label="Rx" surface="chart-inspector" whyItMatters="This mark tells you the planet appeared to move backward when you were born." />
                : 'Rx'}
            </span>
          )}
        </>
      );
      body = showsEnglishInterpretation ? (
        <>
          <div class="insp__story">
            <Insight label="What it represents">{context.what}</Insight>
            <Insight label="How the sign shapes it">{context.how}</Insight>
            <Insight label="Where it shows up">{context.where}</Insight>
            <Insight label="Why it matters here">{context.synthesis}</Insight>
            {context.motionNote && <p class="insp__note">{context.motionNote}</p>}
          </div>
          <Related>{related}</Related>
          <ExactData>{exact}</ExactData>
          {node
            ? learn(`/learn/glossary/#${sb.body === 'North Node' ? 'north-node' : 'south-node'}`, `Learn about the ${sb.body}`)
            : learn(`/learn/placements/${sb.body.toLowerCase().replace(' ', '-')}-in-${sb.sign}/`, `${bodyLabel} ${t(locale, 'readIn')} ${signName(sign, locale)}`)}
        </>
      ) : (
        <>
          {exact}
          {sb.house != null && locale !== 'ru' && <p class="insp__read">{planetInHouseLine(sb.body, sb.house)}</p>}
          <div class="insp__related-actions">{related}</div>
          {!node && learn(`/learn/placements/${sb.body.toLowerCase().replace(' ', '-')}-in-${sb.sign}/`, `${bodyLabel} ${t(locale, 'readIn')} ${locale === 'ru' ? signPrepositional(sign) : signName(sign, locale)}`)}
        </>
      );
      break;
    }

    case 'sign': {
      const sign = signBySlug(selection.sign);
      const uncertainMoon = moonIsUncertain(scene);
      const possibleMoon = uncertainMoon && moonCandidates(scene).includes(selection.sign);
      const occupants = scene.bodies.filter((candidate) => candidate.sign === selection.sign
        && (candidate.body !== 'Moon' || !uncertainMoon));
      const occupantNames = occupants.map((candidate) => planetLabel(locale, candidate.body));
      const signWhere = [
        occupants.length > 0
          ? `${occupantNames.join(', ')} ${occupants.length === 1 ? 'uses' : 'use'} this style in your chart.`
          : possibleMoon ? 'The Moon may occupy this sign; a birth time is needed to confirm it.'
            : 'No confirmed planet or chart point occupies this sign.',
        scene.houses == null
          ? 'A birth time is needed to show which area of life carries that style.'
          : occupants.length === 0
            ? 'It still shapes the house that begins here.'
            : '',
      ].filter(Boolean).join(' ');
      const exact = (
        <>
          <Receipt label={t(locale, 'dates')}>{signDates(sign, locale)}</Receipt>
          <Receipt label={t(locale, 'element')}>
            {showsEnglishInterpretation
              ? <AstroTerm term="element" label={elementLabel(sign.element, locale)} surface="chart-inspector" />
              : elementLabel(sign.element, locale)}
          </Receipt>
          <Receipt label={locale === 'ru' ? 'Модальность' : 'Modality'}>
            {showsEnglishInterpretation
              ? <AstroTerm term={sign.modality} label={modalityLabel(sign.modality, locale)} surface="chart-inspector" />
              : modalityLabel(sign.modality, locale)}
          </Receipt>
          <Receipt label={t(locale, 'ruler')}>{planetLabel(locale, sign.ruler)}</Receipt>
        </>
      );
      const occupantButtons = occupants.map((candidate) => (
        <button class="insp__chip" type="button" key={candidate.body} onClick={(event) => selectRelated({ kind: 'body', body: candidate.body }, event)}>
          <PlanetGlyph body={candidate.body} size={12} class="insp__pg" />
          {planetLabel(locale, candidate.body)} · {formatLongitude(candidate.lon, locale).split(' ')[0]}
        </button>
      ));
      const moonNote = possibleMoon ? <p class="insp__note">{planetLabel(locale, 'Moon')} · {moonLabel(scene, locale)} · {t(locale, 'needsBirthTime')}</p> : null;
      title = <><SignDisc slug={selection.sign} size={22} /> {signName(sign, locale)}</>;
      body = showsEnglishInterpretation ? (
        <>
          <div class="insp__story">
            <Insight label="What it represents">A sign describes the style a planet or chart point uses. It is the “how,” not a separate personality by itself.</Insight>
            <Insight label="How this sign works">{signEssence(sign)} It belongs to the {sign.element} element and the {sign.modality} modality.</Insight>
            <Insight label="Where it shows up">{signWhere}</Insight>
            <Insight label="Why it matters here">{occupants.length > 1 ? `With ${occupants.length} chart bodies here, ${sign.name} is a repeating tone rather than a one-off detail.` : 'Read the sign together with the selected planet or point to understand what is being expressed in this style.'}</Insight>
          </div>
          {occupants.length > 0 && <Related>{occupantButtons}</Related>}
          {moonNote}
          <ExactData>{exact}</ExactData>
          {learn(localizePath(locale, `/${selection.sign}/`), `${t(locale, 'read')} ${signName(sign, locale)}`, false)}
        </>
      ) : (
        <>
          {exact}
          {occupants.length > 0 && <div class="insp__aspects"><span class="mono--label">{t(locale, 'inThisSign')}</span><div class="insp__related-actions">{occupantButtons}</div></div>}
          {moonNote}
          {learn(localizePath(locale, `/${selection.sign}/`), `${t(locale, 'read')} ${signName(sign, locale)}`, false)}
        </>
      );
      break;
    }

    case 'house': {
      const house = scene.houses?.find((candidate) => candidate.index === selection.house);
      if (!house) return null;
      const occupantNames = house.occupants.map((name) => planetLabel(locale, name));
      const occupantButtons = house.occupants.map((name) => (
        <button class="insp__chip" type="button" key={name} onClick={(event) => selectRelated({ kind: 'body', body: name }, event)}>
          <PlanetGlyph body={name} size={12} class="insp__pg" /> {planetLabel(locale, name)}
        </button>
      ));
      const exact = (
        <>
          <Receipt label={showsEnglishInterpretation ? <AstroTerm term="cusp" label={t(locale, 'cusp')} surface="chart-inspector" whyItMatters="This is the exact point where the house begins." /> : t(locale, 'cusp')}>
            {formatLongitude(house.cuspLon, locale)}
          </Receipt>
          <Receipt label={t(locale, 'span')}>{house.spanDeg.toFixed(1)}°</Receipt>
        </>
      );
      title = <>{showsEnglishInterpretation ? <AstroTerm term="house" label={t(locale, 'house')} surface="chart-inspector" /> : t(locale, 'house')} {house.index}</>;
      body = showsEnglishInterpretation ? (
        <>
          <div class="insp__story">
            <Insight label="What it represents">A house is an area of life. It tells you where a planet’s topic is most likely to become concrete and noticeable.</Insight>
            <Insight label="How this house works">House {house.index} covers {NATAL_HOUSE_THEME[house.index] ?? 'a specific area of everyday life'}.</Insight>
            <Insight label="Where it shows up">{house.occupants.length > 0 ? `${occupantNames.join(', ')} ${house.occupants.length === 1 ? 'lands' : 'land'} here in your chart.` : 'No planet was in this house when you were born. Empty does not mean inactive; its sign and ruler still describe the area.'}</Insight>
            <Insight label="Why it matters here">{house.occupants.length > 0 ? 'Each planet here brings its own needs and habits into the same life area, so this house deserves an early read.' : 'An empty house is not a missing part of life. It simply is not led by a natal planet.'}</Insight>
          </div>
          {house.occupants.length > 0 && <Related>{occupantButtons}</Related>}
          <ExactData>{exact}</ExactData>
          {learn(`/learn/houses/${HOUSE_SLUG[house.index - 1]}-house/`, `${t(locale, 'house')} ${house.index}`)}
        </>
      ) : (
        <>
          {exact}
          {house.occupants.length > 0
            ? <div class="insp__aspects"><span class="mono--label">{t(locale, 'inThisHouse')}</span><div class="insp__related-actions">{occupantButtons}</div></div>
            : <p class="insp__read">{t(locale, 'emptyHouseNote')}</p>}
          {learn(`/learn/houses/${HOUSE_SLUG[house.index - 1]}-house/`, `${t(locale, 'house')} ${house.index}`)}
        </>
      );
      break;
    }

    case 'aspect': {
      const sa = scene.aspects.find((candidate) => (
        candidate.a === selection.a && candidate.b === selection.b && candidate.type === selection.type
      ));
      if (!sa) return null;
      const name = aspectLabel(locale, sa.type);
      const exact = (
        <Receipt label={showsEnglishInterpretation ? <AstroTerm term="orb" label={t(locale, 'orb')} surface="chart-inspector" whyItMatters="A smaller number usually makes the aspect more noticeable." /> : t(locale, 'orb')}>
          {sa.orb.toFixed(1)}° · {showsEnglishInterpretation
            ? <AstroTerm term={sa.applying ? 'applying' : 'separating'} label={sa.applying ? t(locale, 'applying') : t(locale, 'separating')} surface="chart-inspector" />
            : sa.applying ? t(locale, 'applying') : t(locale, 'separating')}
        </Receipt>
      );
      const bodyButtons = (
        <>
          <button class="insp__chip" type="button" onClick={(event) => selectRelated({ kind: 'body', body: sa.a }, event)}>
            <PlanetGlyph body={sa.a} size={12} class="insp__pg" /> {planetLabel(locale, sa.a)}
          </button>
          <button class="insp__chip" type="button" onClick={(event) => selectRelated({ kind: 'body', body: sa.b }, event)}>
            <PlanetGlyph body={sa.b} size={12} class="insp__pg" /> {planetLabel(locale, sa.b)}
          </button>
        </>
      );
      title = (
        <>
          <PlanetGlyph body={sa.a} size={15} class="insp__pg" /> {planetLabel(locale, sa.a)}
          <span class="insp__aspect-name"><AspectGlyph type={sa.type} size={14} class="insp__pg" /> {name}</span>
          <PlanetGlyph body={sa.b} size={15} class="insp__pg" /> {planetLabel(locale, sa.b)}
        </>
      );
      if ((sa.a === 'Moon' || sa.b === 'Moon') && moonIsUncertain(scene)) {
        body = <>
          <p class="insp__note">{t(locale, 'moon')} · {moonLabel(scene, locale)} · {t(locale, 'needsBirthTime')}</p>
          <Related>{bodyButtons}</Related>
          <ExactData><p class="insp__note">{t(locale, 'noTimeNotice')}</p>{exact}</ExactData>
          {learn(`/learn/aspects/${sa.type}/`, name)}
        </>;
        break;
      }
      body = showsEnglishInterpretation ? (
        <>
          <div class="insp__story">
            <Insight label="What it represents">{ASPECT_CONTEXT[sa.type]}</Insight>
            <Insight label="How it works here">This {name.toLowerCase()} connects your {planetLabel(locale, sa.a)} with your {planetLabel(locale, sa.b)}.</Insight>
            <Insight label="Where it shows up">{natalAspectLine(sa.a, sa.type, sa.b)}</Insight>
            <Insight label="Why it matters here">At {sa.orb.toFixed(1)}° from exact, this connection is {sa.orb <= 1.5 ? 'especially tight and likely to be noticeable' : sa.orb <= 3.5 ? 'close enough to carry real weight' : 'a wider background pattern'}. It describes an inner relationship, not a guaranteed event.</Insight>
          </div>
          <Related>{bodyButtons}</Related>
          <ExactData>{exact}</ExactData>
          {learn(`/learn/aspects/${sa.type}/`, name)}
        </>
      ) : (
        <>{exact}<div class="insp__related-actions">{bodyButtons}</div>{learn(`/learn/aspects/${sa.type}/`, name)}</>
      );
      break;
    }

    case 'angle': {
      if (!scene.angles) return null;
      const lon = scene.angles[selection.angle];
      const sign = signForLongitude(lon);
      const angle = ANGLE_CONTEXT[selection.angle];
      const KEY = { asc: 'angleAscNote', dsc: 'angleDscNote', mc: 'angleMcNote', ic: 'angleIcNote' } as const;
      const angleLabel = selection.angle.toUpperCase();
      const exact = (
        <>
          <Receipt label={t(locale, 'position')}>{formatLongitude(lon, locale)}</Receipt>
          <Receipt label={t(locale, 'sign')}><SignDisc slug={sign.slug} size={16} /> {signName(sign, locale)}</Receipt>
        </>
      );
      title = <>
        {showsEnglishInterpretation && selection.angle === 'asc'
          ? <AstroTerm term="ascendant" label="ASC" surface="chart-inspector" />
          : showsEnglishInterpretation && selection.angle === 'mc'
            ? <AstroTerm term="midheaven" label="MC" surface="chart-inspector" />
            : angleLabel}
      </>;
      body = showsEnglishInterpretation ? (
        <>
          <div class="insp__story">
            <Insight label="What it represents">{angle.what}</Insight>
            <Insight label="How the sign shapes it">In {sign.name}, this angle takes on this style: {signEssence(sign)}</Insight>
            <Insight label="Where it shows up">{t(locale, KEY[selection.angle])}</Insight>
            <Insight label="Why it matters here">{angle.why}</Insight>
          </div>
          <Related>{signButton(sign.slug as SignSlug, signName(sign, locale))}</Related>
          <ExactData>{exact}</ExactData>
          {selection.angle === 'asc' && learn(localizePath(locale, '/rising-sign/'), `${signName(sign, locale)} ${t(locale, 'rising').toLowerCase()}`, false)}
        </>
      ) : (
        <>{exact}<p class="insp__read">{t(locale, KEY[selection.angle])}</p>{selection.angle === 'asc' && learn(localizePath(locale, '/rising-sign/'), locale === 'ru' ? `${t(locale, 'rising')} в ${signPrepositional(sign)}` : `${signName(sign, locale)} ${t(locale, 'rising').toLowerCase()}`, false)}</>
      );
      break;
    }
  }

  const onHandlePointerDown = (event: PointerEvent) => {
    if (activePointer.current != null) return;
    activePointer.current = event.pointerId;
    dragFrom.current = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onHandlePointerUp = (event: PointerEvent) => {
    if (activePointer.current !== event.pointerId || dragFrom.current == null) return;
    const deltaY = event.clientY - dragFrom.current;
    activePointer.current = null;
    dragFrom.current = null;
    suppressHandleClick.current = Math.abs(deltaY) > 5;
    if (deltaY < -40) setDetent('full');
    else if (deltaY > 40) (detent === 'full' ? setDetent('half') : onSelect(null));
  };
  const onHandlePointerCancel = (event: PointerEvent) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    dragFrom.current = null;
    suppressHandleClick.current = false;
  };

  return (
    <div
      class={`insp insp--card insp--${detent}${instantSwap.current ? ' insp--instant-swap' : ''}`}
      data-explorer-inspector
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onSelect(null);
        }
      }}
    >
      <button
        type="button"
        class="insp__handle"
        onPointerDown={onHandlePointerDown}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerCancel}
        onClick={() => {
          if (suppressHandleClick.current) {
            suppressHandleClick.current = false;
            return;
          }
          setDetent((current) => current === 'half' ? 'full' : 'half');
        }}
        aria-label={detent === 'half' ? DETENT_LABELS[locale].expand : DETENT_LABELS[locale].collapse}
        aria-expanded={detent === 'full'}
      />
      {banner}
      <div class="insp__head">
        <h3 class="insp__title" tabIndex={-1} ref={headingRef} data-inspector-heading>{title}</h3>
        <button class="insp__close" type="button" onClick={() => onSelect(null)} aria-label={t(locale, 'inspectorClose')}>×</button>
      </div>
      <div class="insp__body" key={selectionKey}>{body}</div>
    </div>
  );
}
