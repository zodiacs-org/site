export { RelationshipTrust } from '../ChartTrust';
/**
 * The Relationship Wheel's lazy result module. It owns all three comparison
 * views so the /compatibility/ form stays light: the original bi-wheel, a
 * chart-A-by-chart-B aspect grid, and a house-free composite wheel.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Wheel from '../../lib/wheel/Wheel';
import PlanetGlyph from '../../components/PlanetGlyph';
import AspectGlyph from '../../components/AspectGlyph';
import type { InterAspect, PairSummary } from '../../lib/engine/synastry';
import { buildTransitOverlay } from '../../lib/scene/overlay';
import { collisionNudge } from '../../lib/scene/layout';
import { overlayBodyId } from '../../lib/scene/types';
import { renderTransitOverlay } from '../transit/renderTransitOverlay';
import { synastryLine } from '../../lib/compat';
import { elementLabel, formatLongitude, signForLongitude, signName } from '../../lib/signs';
import { aspectLabel, planetLabel } from '../../lib/i18n/astrology';
import { t, tp, type CatalogLocale as Locale } from '../../lib/i18n';
import { russianRuntime } from '../../lib/i18n/ru-runtime';
import { AspectGrid, formatRelationshipCopy, RelationshipContactPoint } from './AspectGrid';
import { CompositePanel } from './CompositePanel';
import {
  buildCompositeTabData,
  compositeDataKey,
  compositeSelection,
  buildRelationshipGrid,
  relationshipContactId,
  type RelationshipContact,
} from './relationshipData';
import { renderRelationshipAngleContact } from './renderRelationshipAngleContact';
import {
  MERCURY_ELEMENT_PAIRS,
  mercuryElementPairKey,
  NO_CONTACT,
  synastryCorpusLine,
} from './synastryLines';
import './relationship.css';
import EvidenceDisclosure from '../EvidenceDisclosure';
import CalculationReload, { calculationError } from '../CalculationReload';
import { loadModule } from '../../lib/module-load';

export interface WheelPerson {
  label: string;
  /** Bodies with retrograde where known — the ring draws from these. */
  bodies: { body: string; lon: number; retrograde?: boolean }[];
  /**
   * Bodies with ecliptic latitude, for the sphere view — present when this
   * side came through the engine, null when a share token carried only
   * longitudes (the sphere then sits that side on the band and says so).
   */
  depth?: { body: string; lon: number; lat: number; retrograde?: boolean }[] | null;
  asc: number | null;
  mc: number | null;
  cusps: number[] | null;
  timeKnown: boolean;
  /** A chart computed here without a birth time: its civil date, for a picture's noon-UTC sky. */
  untimedDate?: string;
  /** A chart computed here with a birth time: its UTC instant, for a picture's whole minute. */
  utc?: Date | string;
}

export interface RelationshipWheelProps {
  locale: Locale;
  a: WheelPerson;
  b: WheelPerson;
  summary: PairSummary;
}

const COPY = {
  en: {
    caption: 'Inner wheel: {a}. Outer ring: {b}. The lines between are where their charts touch.',
    swap: 'Put {name} inside',
    tapHint: 'Tap a connecting line — or a row below — to read that contact. Tap a planet on the outer ring for its position.',
    ringLabel: "{name}'s chart, on the outer ring",
    tally: 'cross-chart aspects',
    easeful: 'easeful',
    charged: 'charged',
    loudest: 'The loudest contacts:',
    views: 'Relationship chart views',
    wheel: 'Wheel',
    grid: 'Grid',
    composite: 'Composite',
    depth: 'In 3D',
    depthCaption: 'Both charts on one sphere: {a} solid, {b} dashed, and the lines between them are where the charts touch — drawn through space, not around a rim.',
    exactDetails: 'Exact relationship details',
    outerPositions: 'Outer-ring positions',
    contactOrbs: 'Contact orbs',
  },
  es: {
    caption: 'Rueda interior: {a}. Anillo exterior: {b}. Las líneas entre ambos marcan dónde se tocan sus cartas.',
    swap: 'Poner a {name} dentro',
    tapHint: 'Toca una línea de conexión — o una fila abajo — para leer ese contacto. Toca un planeta del anillo exterior para ver su posición.',
    ringLabel: 'La carta de {name}, en el anillo exterior',
    tally: 'aspectos entre cartas',
    easeful: 'fáciles',
    charged: 'tensos',
    loudest: 'Los contactos más fuertes:',
    views: 'Vistas de la relación',
    wheel: 'Rueda',
    grid: 'Cuadrícula',
    composite: 'Compuesta',
    depth: 'En 3D',
    depthCaption: 'Las dos cartas en una esfera: {a} en trazo continuo, {b} en discontinuo, y las líneas entre ambas marcan dónde se tocan — trazadas por el espacio, no por el borde.',
    exactDetails: 'Detalles exactos de la relación',
    outerPositions: 'Posiciones del anillo exterior',
    contactOrbs: 'Orbes de los contactos',
  },
  pt: {
    caption: 'Roda interna: {a}. Anel externo: {b}. As linhas entre eles mostram onde os mapas se encontram.',
    swap: 'Colocar {name} dentro',
    tapHint: 'Toque em uma linha de conexão — ou em uma linha abaixo — para ler esse contato. Toque em um planeta no anel externo para ver sua posição.',
    ringLabel: 'Mapa de {name}, no anel externo',
    tally: 'aspectos entre mapas',
    easeful: 'harmoniosos',
    charged: 'tensos',
    loudest: 'Os contatos mais fortes:',
    views: 'Visualizações da relação',
    wheel: 'Roda',
    grid: 'Grade',
    composite: 'Composito',
    depth: 'Em 3D',
    depthCaption: 'Os dois mapas em uma esfera: {a} em traço contínuo, {b} tracejado, e as linhas entre eles mostram onde os mapas se tocam — traçadas pelo espaço, não pela borda.',
    exactDetails: 'Detalhes exatos da relação',
    outerPositions: 'Posições do anel externo',
    contactOrbs: 'Orbes dos contatos',
  },
  fr: {
    caption: 'Roue intérieure\u00a0: {a}. Anneau extérieur\u00a0: {b}. Les lignes entre les deux indiquent où les thèmes se rejoignent.',
    swap: 'Placer {name} à l’intérieur',
    tapHint: 'Touche une ligne de liaison — ou une ligne ci-dessous — pour lire ce contact. Touche une planète de l’anneau extérieur pour voir sa position.',
    ringLabel: 'Thème de {name}, sur l’anneau extérieur',
    tally: 'aspects entre les thèmes',
    easeful: 'fluides',
    charged: 'tendus',
    loudest: 'Les contacts les plus marqués\u00a0:',
    views: 'Vues de la relation',
    wheel: 'Roue',
    grid: 'Grille',
    composite: 'Composite',
    depth: 'En 3D',
    depthCaption: 'Les deux thèmes sur une même sphère\u00a0: {a} en trait plein, {b} en pointillés, et les lignes entre eux marquent où les thèmes se touchent — tracées à travers l’espace, pas le long d’un bord.',
    exactDetails: 'Détails exacts de la relation',
    outerPositions: 'Positions de l’anneau extérieur',
    contactOrbs: 'Orbes des contacts',
  },
  it: {
    caption: 'Ruota interna: {a}. Anello esterno: {b}. Le linee tra i due indicano dove i temi entrano in contatto.',
    swap: 'Metti {name} all’interno',
    tapHint: 'Tocca una linea di collegamento — o una riga qui sotto — per leggere quel contatto. Tocca un pianeta sull’anello esterno per vederne la posizione.',
    ringLabel: 'Tema di {name}, sull’anello esterno',
    tally: 'aspetti tra i temi',
    easeful: 'armoniosi',
    charged: 'tesi',
    loudest: 'I contatti più marcati:',
    views: 'Viste della relazione',
    wheel: 'Ruota',
    grid: 'Griglia',
    composite: 'Composito',
    depth: 'In 3D',
    depthCaption: 'I due temi su una sola sfera: {a} a tratto pieno, {b} tratteggiato, e le linee fra loro segnano dove i temi si toccano — tracciate nello spazio, non lungo un bordo.',
    exactDetails: 'Dettagli esatti della relazione',
    outerPositions: 'Posizioni dell’anello esterno',
    contactOrbs: 'Orbi dei contatti',
  },
  ru: {
    caption: 'Внутренняя карта: {a}. Внешнее кольцо: {b}. Линии между ними показывают, где карты соприкасаются.',
    swap: 'Поместить {name} внутрь',
    tapHint: 'Коснитесь соединительной линии или строки ниже, чтобы прочитать контакт. Коснитесь планеты на внешнем кольце, чтобы увидеть её положение.',
    ringLabel: 'Карта {name} на внешнем кольце',
    tally: 'межкартных аспектов',
    easeful: 'плавных',
    charged: 'напряжённых',
    loudest: 'Самые заметные контакты:',
    views: 'Виды карты отношений',
    wheel: 'Колесо',
    grid: 'Сетка',
    composite: 'Композит',
    depth: 'В 3D',
    depthCaption: 'Обе карты на одной сфере: {a} — сплошной линией, {b} — пунктиром, а линии между ними показывают, где карты соприкасаются. Подписи к сфере пока по-английски.',
    exactDetails: 'Точные данные отношений',
    outerPositions: 'Положения внешнего кольца',
    contactOrbs: 'Орбисы контактов',
  },
} as const;

const TAB_ORDER = ['wheel', 'grid', 'composite', 'depth'] as const;
type RelationshipTab = typeof TAB_ORDER[number];

/** South Node stays off drawn wheels — the sitewide convention. */
const drawable = (person: WheelPerson) => person.bodies.filter((point) => point.body !== 'South Node');
type CommunicationBody = 'Mercury' | 'Moon' | 'Mars';
type CommunicationContact = InterAspect & { a: CommunicationBody; b: CommunicationBody };
const communicationBodies = new Set<CommunicationBody>(['Mercury', 'Moon', 'Mars']);
const isCommunicationBody = (name: string): name is CommunicationBody => communicationBodies.has(name as CommunicationBody);

function isCommunicationContact(contact: InterAspect): contact is CommunicationContact {
  return isCommunicationBody(contact.a)
    && isCommunicationBody(contact.b)
    && (contact.a === 'Mercury' || contact.b === 'Mercury');
}

function track(name: 'grid_select' | 'composite_view'): void {
  const analytics = (globalThis as typeof globalThis & {
    zodiacsAnalytics?: { track?: (event: string, props: Record<string, never>) => void };
  }).zodiacsAnalytics;
  analytics?.track?.(name, {});
}

function contactReading(
  aLabel: string,
  bLabel: string,
  contact: Pick<InterAspect, 'a' | 'b' | 'type'>,
): { text: string; curated: boolean } {
  const curated = synastryCorpusLine(contact.a, contact.b, contact.type);
  return {
    text: curated ?? synastryLine(aLabel, contact.a, bLabel, contact.b, contact.type),
    curated: curated !== null,
  };
}

export default function RelationshipWheel({ locale, a, b, summary }: RelationshipWheelProps) {
  const c = COPY[locale];
  const [tab, setTab] = useState<RelationshipTab>('wheel');
  const [sphereMod, setSphereMod] = useState<typeof import('../chart3d/EclipticView') | null>(null);
  const [sphereError, setSphereError] = useState('');
  const [sphereRetry, setSphereRetry] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // Canonical focus ids are always chart-A-first and live above every tab.
  const [sel, setSel] = useState<string | null>(null);
  const [compositeFocus, setCompositeFocus] = useState<{ source: string; id: string } | null>(null);
  const compositeTracked = useRef(false);

  useEffect(() => {
    if (tab !== 'depth' || sphereMod) return;
    let active = true;
    setSphereError('');
    void loadModule(() => import('../chart3d/EclipticView'))
      .then((module) => { if (active) setSphereMod(module); })
      .catch((cause) => {
        if (active) setSphereError(calculationError(cause, locale, t(locale, 'compareError')));
      });
    return () => { active = false; };
  }, [tab, sphereMod, sphereRetry, locale]);

  const inner = flipped ? b : a;
  const outer = flipped ? a : b;
  const canonicalId = (aspect: InterAspect) => `${aspect.a}-${aspect.type}-${aspect.b}`;
  const grid = useMemo(() => buildRelationshipGrid(a, b), [a, b]);
  const composite = useMemo(() => buildCompositeTabData(a.bodies, b.bodies, {
    aTimeKnown: a.timeKnown, bTimeKnown: b.timeKnown,
  }), [a.bodies, b.bodies, a.timeKnown, b.timeKnown]);
  const compositeSource = JSON.stringify([a.label, a.bodies, a.timeKnown, b.label, b.bodies, b.timeKnown, compositeDataKey(composite)]);
  useEffect(() => setCompositeFocus(null), [compositeSource]);
  const compositeSelected = compositeFocus?.source === compositeSource
    && compositeSelection(composite, compositeFocus.id) ? compositeFocus.id : null;
  const mercuryA = a.bodies.find((point) => point.body === 'Mercury');
  const mercuryB = b.bodies.find((point) => point.body === 'Mercury');
  const mercurySignA = mercuryA ? signForLongitude(mercuryA.lon) : null;
  const mercurySignB = mercuryB ? signForLongitude(mercuryB.lon) : null;
  const mercuryPairKey = mercurySignA && mercurySignB
    ? mercuryElementPairKey(mercurySignA.element, mercurySignB.element)
    : null;
  const communicationContacts = summary.aspects.filter(isCommunicationContact);

  // The overlay wants aspects oriented outer-first; summary aspects are
  // chart-A-first. Reorient while remembering each chord's canonical id.
  const { overlayBase, chordToCanonical } = useMemo(() => {
    const map = new Map<string, string>();
    const oriented: InterAspect[] = summary.aspects.map((aspect) => {
      const reoriented: InterAspect = flipped
        ? aspect
        : {
          a: aspect.b,
          aLon: aspect.bLon,
          b: aspect.a,
          bLon: aspect.aLon,
          type: aspect.type,
          orb: aspect.orb,
        };
      map.set(`${reoriented.a}-${reoriented.type}-${reoriented.b}`, canonicalId(aspect));
      return reoriented;
    });
    return {
      overlayBase: buildTransitOverlay(
        formatRelationshipCopy(c.ringLabel, { name: outer.label }),
        drawable(outer),
        oriented,
        null,
      ),
      chordToCanonical: map,
    };
    // A compare remounts the module; labels and orientation are the only
    // live values this ring calculation needs after that boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, flipped, outer.label]);

  const overlayFocusId = sel
    ? [...chordToCanonical.entries()].find(([, canonical]) => canonical === sel)?.[0] ?? null
    : null;
  const overlay = overlayFocusId ? { ...overlayBase, focus: overlayFocusId } : overlayBase;
  const innerBodies = useMemo(() => drawable(inner), [inner]);
  const innerDraw = useMemo(() => collisionNudge(innerBodies), [innerBodies]);
  const selectedContact = sel
    ? grid.contacts.find((contact) => relationshipContactId(contact) === sel) ?? null
    : null;
  const selectedBody = sel?.startsWith('transit:')
    ? overlay.bodies.find((point) => overlayBodyId(point.body) === sel) ?? null
    : null;

  function onRingSelect(id: string | null) {
    if (id === null) {
      setSel(null);
      return;
    }
    setSel((previous) => {
      const canonical = chordToCanonical.get(id) ?? id;
      return previous === canonical ? null : canonical;
    });
  }

  function activateTab(next: RelationshipTab) {
    setTab(next);
    if (next === 'composite' && !compositeTracked.current) {
      compositeTracked.current = true;
      track('composite_view');
    }
  }

  /** Sphere bodies: real latitudes where the engine gave them, band otherwise. */
  const sphereBodies = (person: WheelPerson) =>
    person.depth ?? person.bodies.map(({ body, lon, retrograde }) => ({ body, lon, lat: 0, retrograde }));

  function onTabKeyDown(event: KeyboardEvent) {
    const current = TAB_ORDER.indexOf(tab);
    let next = current;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % TAB_ORDER.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TAB_ORDER.length - 1;
    else return;
    event.preventDefault();
    const nextTab = TAB_ORDER[next];
    activateTab(nextTab);
    requestAnimationFrame(() => document.getElementById(`relationship-tab-${nextTab}`)?.focus());
  }

  function onGridSelect(contact: RelationshipContact) {
    setSel(relationshipContactId(contact));
    track('grid_select');
  }

  const focusedReading = selectedContact
    ? contactReading(a.label, b.label, selectedContact)
    : null;

  return (
    <div class="rwheel">
      <div class="rwheel__tabs" role="tablist" aria-label={c.views} onKeyDown={onTabKeyDown}>
        {TAB_ORDER.map((name) => (
          <button
            key={name}
            id={`relationship-tab-${name}`}
            type="button"
            role="tab"
            class="rwheel__tab"
            aria-selected={tab === name}
            aria-controls={`relationship-panel-${name}`}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => activateTab(name)}
            data-relationship-tab={name}
          >
            {c[name]}
          </button>
        ))}
      </div>

      {tab === 'wheel' && (
        <section
          id="relationship-panel-wheel"
          role="tabpanel"
          aria-labelledby="relationship-tab-wheel"
          class="rwheel__panel"
          data-relationship-panel="wheel"
        >
          <p class="tring__caption mono">{formatRelationshipCopy(c.caption, { a: inner.label, b: outer.label })}</p>

          <div class="tring__wheelbox">
            <Wheel
              bodies={innerBodies}
              asc={inner.asc}
              mc={inner.mc}
              cusps={inner.cusps}
              aspects={[]}
              renderOverlay={(geometry) => (
                <>
                  {renderTransitOverlay(
                    overlay,
                    (name) => innerDraw.get(name) ?? null,
                    onRingSelect,
                    geometry,
                    { dashedMarkers: false },
                  )}
                  {renderRelationshipAngleContact(
                    selectedContact,
                    flipped,
                    (name) => innerDraw.get(name) ?? null,
                    (name) => overlayBase.bodies.find((point) => point.body === name)?.drawLon ?? null,
                    geometry,
                  )}
                </>
              )}
            />
          </div>

          <div class="rwheel__controls">
            <button
              class="btn btn--glass tring__step"
              type="button"
              onClick={() => { setFlipped((value) => !value); setSel(null); }}
              data-swap
            >
              <span>{formatRelationshipCopy(c.swap, { name: outer.label })}</span>
              <span class="orb">⇄</span>
            </button>
          </div>
          <p class="field__help rwheel__hint">{c.tapHint}</p>

          {(selectedContact || selectedBody) && (
            <div class="tring__focus" role="status">
              {selectedContact && focusedReading && (
                <>
                  {locale === 'en' && (
                    <p
                      class="tring__focus-read"
                      data-curated-line={focusedReading.curated ? '' : undefined}
                      data-fallback-line={focusedReading.curated ? undefined : ''}
                    >
                      {focusedReading.text}
                    </p>
                  )}
                  <span class="tring__focus-name">
                    {a.label}: <RelationshipContactPoint locale={locale} name={selectedContact.a} />
                    {' '}<AspectGlyph type={selectedContact.type} size={13} class="pg-inline" /> {aspectLabel(locale, selectedContact.type)}
                    {' '}{b.label}: <RelationshipContactPoint locale={locale} name={selectedContact.b} />
                  </span>
                </>
              )}
              {!selectedContact && selectedBody && (
                <span class="tring__focus-name">
                  {outer.label}: <PlanetGlyph body={selectedBody.body} size={13} class="pg-inline" /> {planetLabel(locale, selectedBody.body)}
                  {' · '}{formatLongitude(selectedBody.lon, locale)}{selectedBody.retrograde ? ' ℞' : ''}
                </span>
              )}
            </div>
          )}

          <span class="mono--label">{c.loudest}</span>
          <div class="syn__aspects">
            {summary.top.map((aspect) => {
              const id = canonicalId(aspect);
              const reading = contactReading(a.label, b.label, aspect);
              return (
                <button
                  class={`syn__aspect tring__row${sel === id ? ' is-focus' : ''}`}
                  type="button"
                  key={id}
                  onClick={() => setSel((previous) => (previous === id ? null : id))}
                >
                  {locale === 'en' && (
                    <span
                      class="syn__aspect-read"
                      data-curated-line={reading.curated ? '' : undefined}
                      data-fallback-line={reading.curated ? undefined : ''}
                    >
                      {reading.text}
                    </span>
                  )}
                  <span class="syn__aspect-name">
                    <PlanetGlyph body={aspect.a} size={13} class="pg-inline" /> {a.label}: {planetLabel(locale, aspect.a)} <AspectGlyph type={aspect.type} size={13} class="pg-inline" /> {aspectLabel(locale, aspect.type)} <PlanetGlyph body={aspect.b} size={13} class="pg-inline" /> {b.label}: {planetLabel(locale, aspect.b)}
                  </span>
                </button>
              );
            })}
          </div>

          <p class="syn__tally mono">
            {locale === 'ru'
              ? tp('ru', 'aspects', summary.aspects.length, russianRuntime().plurals)
              : `${summary.aspects.length} ${c.tally}`} ·
            {' '}{summary.easeful} {c.easeful} ({aspectLabel(locale, 'trine')}/{aspectLabel(locale, 'sextile')}) ·
            {' '}{summary.charged} {c.charged} ({aspectLabel(locale, 'square')}/{aspectLabel(locale, 'opposition')})
          </p>

          {mercurySignA && mercurySignB && mercuryPairKey && (
            <div
              class="rcomm syn__aspect"
              data-communication-read
              data-mercury-elements={mercuryPairKey}
            >
              {locale === 'en' && (
                <>
                  <h3 class="rcomm__title">How you two communicate</h3>
                  <p class="rcomm__intro syn__aspect-read">Mercury against Mercury is the shape of your conversations; Mercury against Moon and Mars is whether talking feels like comfort or combat.</p>
                </>
              )}
              {locale === 'en' && (
                <>
                  <p class="rcomm__framing syn__aspect-read">{MERCURY_ELEMENT_PAIRS[mercuryPairKey]}</p>
                  {communicationContacts.length > 0 ? (
                    <div class="rcomm__contacts syn__aspects" role="list">
                      {communicationContacts.map((contact) => {
                        const reading = synastryCorpusLine(contact.a, contact.b, contact.type);
                        if (!reading) return null;
                        return (
                          <div class="rcomm__contact syn__aspect" role="listitem" data-communication-contact key={canonicalId(contact)}>
                            <span class="rcomm__contact-read syn__aspect-read" data-curated-line>{reading}</span>
                            <span class="syn__aspect-name">
                              {a.label}: <RelationshipContactPoint locale={locale} name={contact.a} />
                              {' '}<AspectGlyph type={contact.type} size={13} class="pg-inline" /> {aspectLabel(locale, contact.type)}
                              {' '}{b.label}: <RelationshipContactPoint locale={locale} name={contact.b} />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p class="rcomm__fallback syn__aspect-read" data-communication-no-contact>{NO_CONTACT}</p>
                  )}
                </>
              )}
              <p class="rcomm__receipt syn__aspect-receipt mono">
                {planetLabel(locale, 'Mercury')}: {signName(mercurySignA, locale)}
                {' · '}
                {planetLabel(locale, 'Mercury')}: {signName(mercurySignB, locale)}
              </p>
            </div>
          )}

          <EvidenceDisclosure label={c.exactDetails} className="rwheel__details">
            <h3>{c.contactOrbs}</h3>
            <div class="tring__exact-contacts">
              {summary.aspects.map((aspect) => (
                <span class="syn__aspect-receipt mono" key={`exact-${canonicalId(aspect)}`}>
                  {a.label}: <PlanetGlyph body={aspect.a} size={13} class="pg-inline" /> {planetLabel(locale, aspect.a)}
                  {' '}<AspectGlyph type={aspect.type} size={13} class="pg-inline" /> {aspectLabel(locale, aspect.type)}
                  {' '}{b.label}: <PlanetGlyph body={aspect.b} size={13} class="pg-inline" /> {planetLabel(locale, aspect.b)}
                  {' · '}{t(locale, 'orb')} {aspect.orb.toFixed(1)}°
                </span>
              ))}
            </div>
            <h3>{c.outerPositions}</h3>
            <div class="trans__sky">
              {overlay.bodies.map((point) => (
                <span class="trans__pos mono" key={`outer-${point.body}`}>
                  <PlanetGlyph body={point.body} size={13} class="pg-inline" /> {planetLabel(locale, point.body)} · {formatLongitude(point.lon, locale)}{point.retrograde ? ' ℞' : ''}
                </span>
              ))}
            </div>
          </EvidenceDisclosure>

          <div class="syn__balances">
            {[{ person: a, balance: summary.elements.a }, { person: b, balance: summary.elements.b }].map(({ person, balance }) => (
              <div class="syn__balance" key={person.label}>
                <span class="syn__balance-name">{person.label}</span>
                {(['fire', 'earth', 'air', 'water'] as const).map((element) => (
                  <div class="syn__bar" key={element}>
                    <span class="syn__bar-label mono--label">{elementLabel(element, locale)}</span>
                    <span class="syn__bar-track"><span class="syn__bar-fill" style={`width:${balance[element] * 10}%`} /></span>
                    <span class="syn__bar-n mono">{balance[element]}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'grid' && (
        <section
          id="relationship-panel-grid"
          role="tabpanel"
          aria-labelledby="relationship-tab-grid"
          class="rwheel__panel"
          data-relationship-panel="grid"
        >
          <AspectGrid
            locale={locale}
            aLabel={a.label}
            bLabel={b.label}
            grid={grid}
            selectedId={sel}
            onSelect={onGridSelect}
          />
        </section>
      )}

      {tab === 'composite' && (
        <section
          id="relationship-panel-composite"
          role="tabpanel"
          aria-labelledby="relationship-tab-composite"
          class="rwheel__panel"
          data-relationship-panel="composite"
        >
          <CompositePanel locale={locale} data={composite} sourceKey={compositeSource}
            people={{
              a: { bodies: a.bodies, timeKnown: a.timeKnown, utc: a.utc, untimedDate: a.untimedDate },
              b: { bodies: b.bodies, timeKnown: b.timeKnown, utc: b.utc, untimedDate: b.untimedDate },
            }}
            sourceTimesKnown={a.timeKnown && b.timeKnown}
            selectedId={compositeSelected}
            onSelect={(id) => setCompositeFocus(id ? { source: compositeSource, id } : null)} />
        </section>
      )}

      {tab === 'depth' && (
        <section
          id="relationship-panel-depth"
          role="tabpanel"
          aria-labelledby="relationship-tab-depth"
          class="rwheel__panel"
          data-relationship-panel="depth"
        >
          <p class="tring__caption mono">{formatRelationshipCopy(c.depthCaption, { a: a.label, b: b.label })}</p>
          {sphereMod ? (
            <sphereMod.default
              bodies={sphereBodies(a)}
              partner={{ label: b.label, bodies: sphereBodies(b) }}
              interAspects={summary.top}
              asc={a.asc}
              locale={locale}
              size={460}
            />
          ) : sphereError ? (
            <div>
              <p class="field__error" role="alert">{sphereError}</p>
              <button class="btn btn--glass" type="button" onClick={() => setSphereRetry((value) => value + 1)}>{t(locale, 'calculationRetry')}</button>
              <CalculationReload error={sphereError} locale={locale} />
            </div>
          ) : (
            <p class="field__help rwheel__hint" aria-live="polite">…</p>
          )}
        </section>
      )}
    </div>
  );
}
