import { CheckOurMath } from '../ChartTrust';
/**
 * The Transit Ring — the animated bi-wheel. The natal chart is the fixed
 * inner wheel (the Wheel's pinned static path); the transiting sky is an
 * outer ring that moves as you scrub time. Lazy-loaded by TransitTracker
 * after the first compute, so /transits/ pays for the wheel + engine only
 * when a chart exists to draw.
 *
 * One compute path: the scrubber sets a day-offset from now; a memo turns
 * that instant into the outer ring via the (already-loaded) engine. Dragging
 * moves the planets continuously; the steppers and "Now" glide by tweening
 * the offset (instant under reduced motion). The active-transit list under
 * the wheel is the accessible, reduced-motion-safe structure and updates
 * with the scrub; a live region announces the date.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Wheel from '../../lib/wheel/Wheel';

/** Reuse the already-lazy static wheel boundary in other calculation results. */
export const StaticWheel = Wheel;
import PlanetGlyph from '../../components/PlanetGlyph';
import AspectGlyph from '../../components/AspectGlyph';
import { findInterAspects } from '../../lib/engine/synastry';
import type { MinimalBody } from '../../lib/engine/synastry';
import type { TransitContact } from '../../lib/engine/transit-scan';
import type { BodyName } from '../../lib/engine/types';
import { separation } from '../../lib/engine/aspects';
import { buildTransitOverlay } from '../../lib/scene/overlay';
import { collisionNudge } from '../../lib/scene/layout';
import { overlayAspectId, overlayBodyId } from '../../lib/scene/types';
import { renderTransitOverlay } from './renderTransitOverlay';
import { transitLine, TRANSIT_ORB } from '../../lib/transits';
import { formatLongitude } from '../../lib/signs';
import { formatDate, formatDateTime } from '../../lib/i18n/dates';
import { aspectLabel, planetLabel } from '../../lib/i18n/astrology';
import { showsEnglishOnlyInterpretation, t, tp, type CatalogLocale as Locale } from '../../lib/i18n';
import { russianRuntime } from '../../lib/i18n/ru-runtime';
import CalendarSubscribe, { type CalendarPositionsSource } from '../CalendarSubscribe';
import EvidenceDisclosure from '../EvidenceDisclosure';
import CalculationReload, { calculationLoadMessage } from '../CalculationReload';
import { startSlowTransitScan, type SlowTransitScan } from './slow-transit-scan';

export interface TransitSky {
  body: string;
  lon: number;
  retrograde: boolean;
}

export interface TransitRingProps {
  locale: Locale;
  natal: {
    bodies: { body: string; lon: number; retrograde?: boolean }[];
    asc: number | null;
    mc: number | null;
    cusps: number[] | null;
    minimal: MinimalBody[];
    timeKnown: boolean;
    calendarPositions: CalendarPositionsSource | null;
  };
  /** Positions of the transiting bodies at a UTC instant (engine-bound). */
  computeSky: (when: Date) => TransitSky[];
  /** Baseline "now" in epoch ms (captured once at compute). */
  nowMs: number;
  /** Exact-date request emitted by the separately lazy transit search. */
  focusRequest?: { contact: TransitContact } | null;
  eventDate?: { active: boolean; onSelect: () => void; onNow: () => void };
}

const DAY = 86_400_000;
const WINDOW_DAYS = 365; // scrub one year either side — enough for the slow transits
const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - ((-2 * k + 2) ** 3) / 2);
const ASPECT_ANGLE = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
} as const;

// Ring-specific copy, module-local (EN + ES) — the lazy chunk keeps it out of
// the /transits/ static closure. General labels reuse the shared dictionary.
const COPY = {
  en: {
    skyRingLabel: 'the transiting sky',
    scrubLabel: 'Move the date',
    scrubHint: 'Drag to move the sky forward or back; the outer ring is where the planets are then.',
    now: 'Now',
    eventDate: 'Event date',
    back1m: '−1 month',
    fwd1m: '+1 month',
    outerRing: 'Outer ring: the sky then. Inner wheel: your birth chart.',
    tapHint: 'Tap a moving planet or a connecting line to read it.',
    moonOmitted: 'the Moon moves too fast to list, but you can watch it circle',
    announce: 'Sky for',
    scanning: 'Computing the exact dates of the slow transits…',
    scanError: 'The exact dates could not be calculated. The sky ring is still available.',
    retry: 'Try again',
    marksLabel: 'Exact slow-transit dates in this window',
    nextUp: 'Next to go exact:',
    noSlowExact: 'No slow transits go exact in this window.',
    activeOne: 'active transit',
    activeMany: 'active transits',
    noActive: 'No active planet-to-planet transits at this moment.',
    exactDetails: 'Exact sky and contacts',
    skyPositions: 'Sky positions',
    contactOrbs: 'Contact orbs',
  },
  es: {
    skyRingLabel: 'el cielo en tránsito',
    scrubLabel: 'Mueve la fecha',
    scrubHint: 'Arrastra para mover el cielo hacia adelante o atrás; el anillo exterior muestra dónde están los planetas en ese momento.',
    now: 'Ahora',
    eventDate: 'Fecha del evento',
    back1m: '−1 mes',
    fwd1m: '+1 mes',
    outerRing: 'Anillo exterior: el cielo de entonces. Rueda interior: tu carta natal.',
    tapHint: 'Toca un planeta en movimiento o una línea de conexión para leer ese tránsito.',
    moonOmitted: 'la Luna se mueve demasiado rápido para aparecer en la lista, pero puedes verla girar',
    announce: 'Cielo del',
    scanning: 'Calculando las fechas exactas de los tránsitos lentos…',
    scanError: 'No se pudieron calcular las fechas exactas. El anillo del cielo sigue disponible.',
    retry: 'Intentar de nuevo',
    marksLabel: 'Fechas exactas de tránsitos lentos en esta ventana',
    nextUp: 'Próximos en alcanzar la exactitud:',
    noSlowExact: 'Ningún tránsito lento alcanza la exactitud en esta ventana.',
    activeOne: 'tránsito activo',
    activeMany: 'tránsitos activos',
    noActive: 'No hay tránsitos activos entre planetas en este momento.',
    exactDetails: 'Cielo y contactos exactos',
    skyPositions: 'Posiciones del cielo',
    contactOrbs: 'Orbes de los contactos',
  },
  pt: {
    skyRingLabel: 'o céu em trânsito',
    scrubLabel: 'Mova a data',
    scrubHint: 'Arraste para mover o céu para a frente ou para trás; o anel externo mostra onde os planetas estão nesse momento.',
    now: 'Agora',
    eventDate: 'Data do evento',
    back1m: '−1 mês',
    fwd1m: '+1 mês',
    outerRing: 'Anel externo: o céu desse momento. Roda interna: seu mapa astral.',
    tapHint: 'Toque em um planeta em movimento ou em uma linha de conexão para ler esse trânsito.',
    moonOmitted: 'a Lua se move rápido demais para aparecer na lista, mas você pode acompanhá-la na roda',
    announce: 'Céu de',
    scanning: 'Calculando as datas exatas dos trânsitos lentos…',
    scanError: 'Não foi possível calcular as datas exatas. O anel do céu continua disponível.',
    retry: 'Tentar novamente',
    marksLabel: 'Datas exatas dos trânsitos lentos nesta janela',
    nextUp: 'Próximos a chegar ao ponto exato:',
    noSlowExact: 'Nenhum trânsito lento chega ao ponto exato nesta janela.',
    activeOne: 'trânsito ativo',
    activeMany: 'trânsitos ativos',
    noActive: 'Não há trânsitos ativos entre planetas neste momento.',
    exactDetails: 'Céu e contatos exatos',
    skyPositions: 'Posições do céu',
    contactOrbs: 'Orbes dos contatos',
  },
  fr: {
    skyRingLabel: 'le ciel en transit',
    scrubLabel: 'Déplacer la date',
    scrubHint: 'Fais glisser pour avancer ou reculer dans le ciel ; l’anneau extérieur montre la position des planètes à cet instant.',
    now: 'Maintenant',
    eventDate: 'Date de l’événement',
    back1m: '−1 mois',
    fwd1m: '+1 mois',
    outerRing: 'Anneau extérieur : le ciel à cette date. Roue intérieure : ton thème natal.',
    tapHint: 'Touche une planète en mouvement ou une ligne de liaison pour lire ce transit.',
    moonOmitted: 'la Lune va trop vite pour figurer dans la liste, mais tu peux la suivre sur la roue',
    announce: 'Ciel du',
    scanning: 'Calcul des dates exactes des transits lents…',
    scanError: 'Les dates exactes n’ont pas pu être calculées. L’anneau du ciel reste disponible.',
    retry: 'Réessayer',
    marksLabel: 'Dates exactes des transits lents dans cette période',
    nextUp: 'Prochains passages exacts :',
    noSlowExact: 'Aucun transit lent ne devient exact dans cette période.',
    activeOne: 'transit actif',
    activeMany: 'transits actifs',
    noActive: 'Aucun transit actif entre planètes en ce moment.',
    exactDetails: 'Ciel et contacts exacts',
    skyPositions: 'Positions du ciel',
    contactOrbs: 'Orbes des contacts',
  },
  it: {
    skyRingLabel: 'il cielo in transito',
    scrubLabel: 'Sposta la data',
    scrubHint: 'Trascina per spostare il cielo avanti o indietro; l’anello esterno mostra dove si trovano i pianeti in quel momento.',
    now: 'Ora',
    eventDate: 'Data dell’evento',
    back1m: '−1 mese',
    fwd1m: '+1 mese',
    outerRing: 'Anello esterno: il cielo in quel momento. Ruota interna: il tuo tema natale.',
    tapHint: 'Tocca un pianeta in movimento o una linea di collegamento per leggere quel transito.',
    moonOmitted: 'la Luna si muove troppo in fretta per comparire nell’elenco, ma puoi seguirla sulla ruota',
    announce: 'Cielo del',
    scanning: 'Calcolo delle date esatte dei transiti lenti…',
    scanError: 'Non è stato possibile calcolare le date esatte. L’anello del cielo è ancora disponibile.',
    retry: 'Riprova',
    marksLabel: 'Date esatte dei transiti lenti in questo intervallo',
    nextUp: 'Prossimi passaggi esatti:',
    noSlowExact: 'Nessun transito lento diventa esatto in questo intervallo.',
    activeOne: 'transito attivo',
    activeMany: 'transiti attivi',
    noActive: 'Nessun transito attivo tra pianeti in questo momento.',
    exactDetails: 'Cielo e contatti esatti',
    skyPositions: 'Posizioni del cielo',
    contactOrbs: 'Orbi dei contatti',
  },
  ru: {
    skyRingLabel: 'транзитное небо',
    scrubLabel: 'Сдвинуть дату',
    scrubHint: 'Перетаскивайте, чтобы двигать небо вперёд или назад; внешнее кольцо показывает положения планет в выбранный момент.',
    now: 'Сейчас',
    eventDate: 'Дата события',
    back1m: '−1 месяц',
    fwd1m: '+1 месяц',
    outerRing: 'Внешнее кольцо — небо тогда. Внутреннее колесо — ваша натальная карта.',
    tapHint: 'Коснитесь движущейся планеты или соединительной линии, чтобы прочитать данные.',
    moonOmitted: 'Луна движется слишком быстро для списка, но её путь виден на колесе',
    announce: 'Небо на',
    scanning: 'Считаем точные даты медленных транзитов…',
    scanError: 'Не удалось рассчитать точные даты. Кольцо неба по-прежнему доступно.',
    retry: 'Попробовать снова',
    marksLabel: 'Точные даты медленных транзитов в этом окне',
    nextUp: 'Ближайшие точные аспекты:',
    noSlowExact: 'В этом окне нет точных медленных транзитов.',
    activeOne: 'активный транзит',
    activeMany: 'активных транзитов',
    noActive: 'Сейчас нет активных транзитов между планетами.',
    exactDetails: 'Точные положения неба и контакты',
    skyPositions: 'Положения на небе',
    contactOrbs: 'Орбисы контактов',
  },
} as const;

const FRENCH_FEMININE_NATAL = new Set(['Moon', 'Venus']);
const RUSSIAN_FEMININE_NATAL = new Set(['Moon', 'Venus']);
const POSTPOSITIVE_NATAL_LOCALES = new Set<Locale>(['fr', 'it']);
const isAngle = (point: string) => point === 'ASC' || point === 'MC';
const natalQualifier = (locale: Locale, point: string) => (
  locale === 'it'
    ? 'natale'
    : locale === 'fr'
      ? (FRENCH_FEMININE_NATAL.has(point) ? 'natale' : 'natal')
      : locale === 'ru'
        ? (RUSSIAN_FEMININE_NATAL.has(point) ? 'натальная' : 'натальный')
        : t(locale, 'natal')
);
const natalPointName = (locale: Locale, point: string) => (
  isAngle(point) ? point : planetLabel(locale, point)
);
export const natalPointText = (locale: Locale, point: string) => (
  POSTPOSITIVE_NATAL_LOCALES.has(locale)
    ? `${natalPointName(locale, point)} ${natalQualifier(locale, point)}`
    : `${natalQualifier(locale, point)} ${natalPointName(locale, point)}`
);

function NatalPointLabel({ locale, point }: { locale: Locale; point: string }) {
  return (
    <>
      {!POSTPOSITIVE_NATAL_LOCALES.has(locale) && <>{natalQualifier(locale, point)}{' '}</>}
      {!isAngle(point) && <><PlanetGlyph body={point} size={13} class="pg-inline" />{' '}</>}
      {natalPointName(locale, point)}
      {POSTPOSITIVE_NATAL_LOCALES.has(locale) && <>{' '}{natalQualifier(locale, point)}</>}
    </>
  );
}

export default function TransitRing({ locale, natal, computeSky, nowMs, focusRequest = null, eventDate }: TransitRingProps) {
  const c = COPY[locale];
  const showInterpretation = showsEnglishOnlyInterpretation(locale);
  const [offset, setOffset] = useState(0);          // days from now (may be fractional mid-tween)
  const [sel, setSel] = useState<string | null>(null);
  const [searchPointFocus, setSearchPointFocus] = useState<TransitContact | null>(null);
  const rafRef = useRef<number | null>(null);
  const scrubRef = useRef<HTMLInputElement>(null);

  const when = useMemo(() => new Date(nowMs + offset * DAY), [nowMs, offset]);

  // The outer ring: compute the sky at `when`, aspect it to the natal chart.
  // Focus is applied OUTSIDE the memo — a focus tap must not re-run the
  // ephemeris, and a focused contact that has drifted out of orb at the
  // scrubbed date must dissolve instead of dimming the whole ring against
  // a highlight that no longer exists.
  const overlayBase = useMemo(() => {
    const sky = computeSky(when);
    const transiting = sky.filter((b) => b.body !== 'Moon').map(({ body, lon }) => ({ body, lon }));
    const hits = findInterAspects(transiting, natal.minimal).filter((h) => h.orb <= TRANSIT_ORB);
    return buildTransitOverlay(c.skyRingLabel, sky, hits, null);
  }, [when, natal.minimal, computeSky, c.skyRingLabel]);
  const focus = sel && sel.includes('-') // aspect ids carry dashes; body ids don't
    && overlayBase.aspects.some((a) => overlayAspectId(a) === sel) ? sel : null;
  const overlay = focus ? { ...overlayBase, focus } : overlayBase;

  // The natal wheel fans crowded bodies outward; contact chords must end on
  // the fanned marker, not the true longitude, or a stellium's chord points
  // at the neighbouring planet. Same algorithm and input as the Wheel's own
  // layout, so the endpoints land exactly on the drawn marks.
  const natalDraw = useMemo(() => collisionNudge(natal.bodies), [natal.bodies]);
  const focusedPoint = useMemo(() => {
    if (!searchPointFocus) return null;
    const isAngle = searchPointFocus.natalPoint === 'ASC' || searchPointFocus.natalPoint === 'MC';
    const natalLon = searchPointFocus.natalPoint === 'ASC'
      ? natal.asc
      : searchPointFocus.natalPoint === 'MC'
        ? natal.mc
        : natal.minimal.find((candidate) => candidate.body === searchPointFocus.natalPoint)?.lon ?? null;
    const body = overlayBase.bodies.find((candidate) => candidate.body === searchPointFocus.transitBody);
    if (natalLon == null || !body) return null;
    const orb = Math.abs(separation(body.lon, natalLon) - ASPECT_ANGLE[searchPointFocus.aspect]);
    return orb <= TRANSIT_ORB ? {
      transitBody: searchPointFocus.transitBody,
      natalPoint: searchPointFocus.natalPoint,
      // Planet chords end on the collision-fanned marker; angle chords end
      // on the angle's true longitude.
      natalLon: isAngle ? natalLon : (natalDraw.get(searchPointFocus.natalPoint) ?? natalLon),
      aspect: searchPointFocus.aspect,
      orb,
    } : null;
  }, [searchPointFocus, natal.asc, natal.mc, natal.minimal, natalDraw, overlayBase.bodies]);

  // ── Exact dates: the slow transits (Jupiter–Pluto) across the window. ──
  // The scanner is engine-bound and ~100 ms per body, so it loads lazily and
  // runs one body at a time with a breath between each — the ring stays
  // responsive while the timeline fills in. Never treat a failed scan as an
  // empty sky, or show a previous chart's dates while a new scan starts.
  const [scanAttempt, setScanAttempt] = useState(0);
  const scanInput = useMemo(() => ({
    nowMs,
    attempt: scanAttempt,
    chart: {
      bodies: natal.minimal.map((b) => ({ body: b.body as BodyName, lon: b.lon })),
      angles: natal.asc != null && natal.mc != null ? { asc: natal.asc, mc: natal.mc } : null,
    },
  }), [nowMs, natal.minimal, natal.asc, natal.mc, scanAttempt]);
  const [scanResult, setScanResult] = useState<{ input: typeof scanInput; value: SlowTransitScan } | null>(null);
  const scanState: SlowTransitScan = scanResult?.input === scanInput ? scanResult.value : { status: 'loading' };
  const events = scanState.status === 'ready' ? scanState.events : null;
  useEffect(() => {
    return startSlowTransitScan(
      scanInput.chart,
      new Date(scanInput.nowMs - WINDOW_DAYS * DAY),
      new Date(scanInput.nowMs + WINDOW_DAYS * DAY),
      (value) => setScanResult({ input: scanInput, value }),
    );
  }, [scanInput]);
  const scanError = scanState.status === 'error'
    ? scanState.moduleFailed ? calculationLoadMessage(locale) : c.scanError
    : '';

  /** Days from now to a contact's exact instant (fractional). */
  const eventOffset = (e: TransitContact) => (Date.parse(e.exactUtc) - nowMs) / DAY;
  const eventLabel = (e: TransitContact) => {
    return `${planetLabel(locale, e.transitBody)} ${aspectLabel(locale, e.aspect)} ${natalPointText(locale, e.natalPoint)}`;
  };
  const nextUp = events?.filter((e) => Date.parse(e.exactUtc) > when.getTime()).slice(0, 3) ?? [];

  /** Jump the sky to a contact's exact date and focus its chord on arrival. */
  function goToEvent(e: TransitContact) {
    glideTo(eventOffset(e), true);
    // ASC/MC are outside InterAspect; Moon is intentionally omitted from the
    // standing transit list. Both use one search-local chord instead.
    if (e.natalPoint === 'ASC' || e.natalPoint === 'MC' || e.transitBody === 'Moon') {
      setSel(null);
      setSearchPointFocus(e);
    } else {
      setSearchPointFocus(null);
      setSel(`${e.transitBody}-${e.aspect}-${e.natalPoint}`);
    }
  }

  useEffect(() => {
    if (focusRequest) goToEvent(focusRequest.contact);
  }, [focusRequest]);

  const whenLabel = formatDateTime(locale, when, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC', hour12: false,
  }) + ' UTC';

  const cancelTween = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };
  useEffect(() => cancelTween, []);

  /** Glide the offset from its current value to a target (instant if reduced).
   * Targets clamp to the scrub window. Controls land on whole days; exact
   * transit requests preserve their fractional-day UTC instant. */
  function glideTo(rawTarget: number, preserveFraction = false) {
    const unclamped = preserveFraction ? rawTarget : Math.round(rawTarget);
    const target = Math.max(-WINDOW_DAYS, Math.min(WINDOW_DAYS, unclamped));
    cancelTween();
    if (reducedMotion()) { setOffset(target); return; }
    const from = offset;
    const start = performance.now();
    const dur = Math.min(700, 200 + Math.abs(target - from) * 4);
    const step = (nowT: number) => {
      const k = Math.min(1, (nowT - start) / dur);
      setOffset(from + (target - from) * easeInOutCubic(k));
      if (k < 1) rafRef.current = requestAnimationFrame(step);
      else { rafRef.current = null; setOffset(target); }
    };
    rafRef.current = requestAnimationFrame(step);
  }

  // Announce the scrubbed instant only once it settles — updating the live
  // region on every frame of a drag or glide chatters in screen readers.
  const [announced, setAnnounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setAnnounced(`${c.announce} ${whenLabel}`), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whenLabel]);

  // The selected transit's sentence (a chord, or a body's tightest contact).
  const selectedAspect = sel
    ? overlay.aspects.find((a) => overlayAspectId(a) === sel)
      ?? overlay.aspects.find((a) => overlayBodyId(a.outer) === sel)
    : null;

  const selectedBody = sel && !sel.includes('-')
    ? overlay.bodies.find((b) => overlayBodyId(b.body) === sel) ?? null
    : null;

  return (
    <div class="tring">
      <CheckOurMath locale={locale} utc={when} />
      <p class="tring__caption mono">{c.outerRing}</p>

      <div class="tring__wheelbox">
        <Wheel
          bodies={natal.bodies}
          asc={natal.asc}
          mc={natal.mc}
          cusps={natal.cusps}
          aspects={[]}
          renderOverlay={(geo) => renderTransitOverlay(
            overlay,
            (name) => natalDraw.get(name) ?? null,
            (id) => {
              setSearchPointFocus(null);
              setSel((prev) => (prev === id ? null : id));
            },
            geo,
            { focusedPoint },
          )}
        />
      </div>

      {/* The scrubber. */}
      <div class="tring__scrub">
        <div class="tring__scrub-head">
          <label class="field__label" for="tring-date">{c.scrubLabel}</label>
          <output class="tring__date mono" for="tring-date" data-ring-instant={when.toISOString()}>{whenLabel}</output>
        </div>
        <input
          id="tring-date"
          ref={scrubRef}
          class="tring__range"
          type="range"
          min={-WINDOW_DAYS}
          max={WINDOW_DAYS}
          step={1}
          value={Math.round(offset)}
          onInput={(e) => { cancelTween(); setOffset(Number((e.target as HTMLInputElement).value)); }}
          aria-valuetext={whenLabel}
        />
        {/* Exact slow-transit dates as jump markers along the same timeline. */}
        {scanState.status === 'loading' && <p class="tring__scan mono" role="status">{c.scanning}</p>}
        {scanState.status === 'error' && (
          <div class="tring__scan">
            <p role="alert">{scanError}</p>
            <button class="btn btn--glass" type="button" onClick={() => {
              scrubRef.current?.focus();
              setScanAttempt((attempt) => attempt + 1);
            }}>{c.retry}</button>
            <CalculationReload error={scanError} locale={locale} />
          </div>
        )}
        {events !== null && events.length > 0 && (
          <div class="tring__marks" role="group" aria-label={c.marksLabel}>
            {events.map((e) => {
              const d = eventOffset(e);
              const dateLabel = formatDate(locale, new Date(Date.parse(e.exactUtc)), {
                year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
              });
              return (
                <button
                  key={`${e.exactUtc}-${e.transitBody}-${e.aspect}-${e.natalPoint}`}
                  class="tring__mark"
                  type="button"
                  style={`left:${(((d + WINDOW_DAYS) / (WINDOW_DAYS * 2)) * 100).toFixed(2)}%`}
                  aria-label={`${eventLabel(e)} — ${dateLabel}`}
                  title={`${eventLabel(e)} — ${dateLabel}`}
                  onClick={() => goToEvent(e)}
                  data-transit-mark
                />
              );
            })}
          </div>
        )}
        {events !== null && events.length === 0 && (
          <p class="tring__scan mono">{c.noSlowExact}</p>
        )}
        {nextUp.length > 0 && (
          <p class="tring__next mono">
            <span class="mono--label">{c.nextUp}</span>{' '}
            {nextUp.map((e, i) => (
              <button class="tring__next-link" type="button" key={e.exactUtc + e.transitBody} onClick={() => goToEvent(e)}>
                {eventLabel(e)} · {formatDate(locale, new Date(Date.parse(e.exactUtc)), { month: 'short', day: 'numeric', timeZone: 'UTC' })}{i < nextUp.length - 1 ? ',' : ''}
              </button>
            ))}
          </p>
        )}
        <div class="tring__steps">
          <button class="btn btn--glass tring__step" type="button" onClick={() => glideTo(offset - 30)}>
            <span>{c.back1m}</span>
          </button>
          {eventDate && <button class="btn btn--glass tring__step" type="button" onClick={eventDate.onSelect} disabled={eventDate.active && offset === 0}>
            <span>{c.eventDate}</span>
          </button>}
          <button class="btn btn--glass tring__step" type="button" onClick={() => eventDate ? eventDate.onNow() : glideTo(0)} disabled={!eventDate?.active && offset === 0}>
            <span>{c.now}</span>
          </button>
          <button class="btn btn--glass tring__step" type="button" onClick={() => glideTo(offset + 30)}>
            <span>{c.fwd1m}</span>
          </button>
        </div>
        <p class="field__help">{c.scrubHint} {c.tapHint}</p>
      </div>

      {/* Live announcement of the scrubbed instant, once it settles. */}
      <p class="sr-only" role="status">{announced}</p>

      {natal.calendarPositions && (
        <CalendarSubscribe locale={locale} positions={natal.calendarPositions} contacts={events ?? undefined} />
      )}

      {/* The selected transit, foregrounded. */}
      {(selectedAspect || selectedBody || focusedPoint) && (
        <div class="tring__focus" role="status">
          {focusedPoint && (
            <>
              {showInterpretation && (
                <p class="tring__focus-read">{transitLine(focusedPoint.transitBody, focusedPoint.aspect, focusedPoint.natalPoint)}</p>
              )}
              <span
                class="tring__focus-name"
                data-transit-search-focus
                data-transit-angle-focus={focusedPoint.natalPoint === 'ASC' || focusedPoint.natalPoint === 'MC' ? '' : undefined}
              >
                <PlanetGlyph body={focusedPoint.transitBody} size={13} class="pg-inline" /> {planetLabel(locale, focusedPoint.transitBody)}
                {' '}<AspectGlyph type={focusedPoint.aspect} size={13} class="pg-inline" /> {aspectLabel(locale, focusedPoint.aspect)}
                {' '}<NatalPointLabel locale={locale} point={focusedPoint.natalPoint} />
              </span>
            </>
          )}
          {selectedAspect && (
            <>
              {showInterpretation && (
                <p class="tring__focus-read">{transitLine(selectedAspect.outer, selectedAspect.type, selectedAspect.inner)}</p>
              )}
              <span class="tring__focus-name">
                <PlanetGlyph body={selectedAspect.outer} size={13} class="pg-inline" /> {planetLabel(locale, selectedAspect.outer)}
                {' '}<AspectGlyph type={selectedAspect.type} size={13} class="pg-inline" /> {aspectLabel(locale, selectedAspect.type)}
                {' '}<NatalPointLabel locale={locale} point={selectedAspect.inner} />
              </span>
            </>
          )}
          {!focusedPoint && !selectedAspect && selectedBody && (
            <span class="tring__focus-name">
              <PlanetGlyph body={selectedBody.body} size={13} class="pg-inline" /> {planetLabel(locale, selectedBody.body)}
              {' · '}{formatLongitude(selectedBody.lon, locale)}{selectedBody.retrograde ? ' ℞' : ''}
            </span>
          )}
        </div>
      )}

      {/* The active transits at `when` — the accessible, reduced-motion view. */}
      <p class="syn__tally mono">
        {overlay.aspects.length === 0
          ? c.noActive
          : locale === 'ru'
            ? tp('ru', 'activeTransits', overlay.aspects.length, russianRuntime().plurals)
            : `${overlay.aspects.length} ${overlay.aspects.length === 1 ? c.activeOne : c.activeMany}`}
      </p>

      <div class="syn__aspects">
        {overlay.aspects.map((a) => {
          const id = overlayAspectId(a);
          return (
            <button
              class={`syn__aspect tring__row${sel === id ? ' is-focus' : ''}`}
              type="button"
              key={id}
              onClick={() => {
                setSearchPointFocus(null);
                setSel((prev) => (prev === id ? null : id));
              }}
            >
              {showInterpretation && (
                <span class="syn__aspect-read">{transitLine(a.outer, a.type, a.inner)}</span>
              )}
              <span class="syn__aspect-name">
                <PlanetGlyph body={a.outer} size={13} class="pg-inline" /> {planetLabel(locale, a.outer)} <AspectGlyph type={a.type} size={13} class="pg-inline" /> {aspectLabel(locale, a.type)} <NatalPointLabel locale={locale} point={a.inner} />
              </span>
            </button>
          );
        })}
      </div>

      <EvidenceDisclosure label={c.exactDetails} className="tring__details">
        <h3>{c.skyPositions}</h3>
        <div class="trans__sky">
          {overlay.bodies.map((b) => (
            <span class="trans__pos mono" key={b.body}>
              <PlanetGlyph body={b.body} size={13} class="pg-inline" /> {planetLabel(locale, b.body)} · {formatLongitude(b.lon, locale)}{b.retrograde ? ' ℞' : ''}
            </span>
          ))}
        </div>
        {overlay.aspects.length > 0 && (
          <>
            <h3>{c.contactOrbs}</h3>
            <div class="tring__exact-contacts">
              {overlay.aspects.map((a) => (
                <span class="syn__aspect-receipt mono" key={overlayAspectId(a)}>
                  <PlanetGlyph body={a.outer} size={13} class="pg-inline" /> {planetLabel(locale, a.outer)} <AspectGlyph type={a.type} size={13} class="pg-inline" /> {aspectLabel(locale, a.type)} <NatalPointLabel locale={locale} point={a.inner} /> · {t(locale, 'orb')} {a.orb.toFixed(1)}°
                </span>
              ))}
            </div>
          </>
        )}
        <p class="field__help">{c.moonOmitted}.</p>
      </EvidenceDisclosure>
    </div>
  );
}
