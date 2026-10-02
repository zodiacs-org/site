/**
 * The tour controller — owns every piece of tour state and hands the
 * calculator nothing but render-only overrides. It never mutates the
 * chart, the form, or the selection:
 *
 *   - chapter lighting  → onVisual({ scene, cusps?, emphasis })
 *   - layer needs       → onEnsure({ houses, allAspects })  (expand-only,
 *                         so the calculator's auto-clear effects never fire)
 *   - the house morph   → recomputes the ALTERNATE house system through the
 *                         cached engine loader and previews it; runChart and
 *                         setHouseSystem are never called
 *   - announcements     → the calculator's one existing live region
 *
 * Mid-tour selection renders the normal Inspector with a "Back to the
 * tour" banner; the chapter index is preserved because this component
 * stays mounted for the whole tour.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import TourCard from './TourCard';
import { tourFormat, tourText, type TourKey } from './copy';
import {
  deriveChapters, deriveFirstReading, emphasisForChapter, flattenStops, interpolateCusps,
  lerpAngle, previewHouses, stepId,
  type ChapterDef, type TourVisual,
} from '../../../lib/scene/chapters';
import type { ChartSceneModel, EntityRef, SceneEmphasis } from '../../../lib/scene/types';
import type { Aspect, AspectType, Chart } from '../../../lib/engine/types';
import { formatLongitude, signForLongitude, signName } from '../../../lib/signs';
import { moonCandidates, moonIsUncertain, moonLabel } from '../../../lib/moon-certainty';
import { bigThree } from '../../../lib/interpretations';
import { aspectLabel, planetLabel } from '../../../lib/i18n/astrology';
import { englishOnlyCue, localizePath, t, type CatalogLocale as Locale } from '../../../lib/i18n';
import PlanetGlyph from '../../../components/PlanetGlyph';
import AspectGlyph from '../../../components/AspectGlyph';
import AstroTerm from '../../AstroTerm';

type EngineLoader = () => Promise<typeof import('../../../lib/engine/full')>;
export type TourVariant = 'quick' | 'full';

export interface ChartTourProps {
  scene: ChartSceneModel;
  chart: Chart;
  locale: Locale;
  variant: TourVariant;
  initialStep?: number;
  moonAmbiguous?: boolean;
  selection: EntityRef | null;
  loadEngine: EngineLoader;
  /**
   * Scene assembly, injected by the calculator. The tour chunk must not
   * import scene/build statically — that edge splits the module out of the
   * calculator's chunk and inflates the /birth-chart/ initial closure.
   */
  buildScene: (chart: Chart) => ChartSceneModel;
  /**
   * The standard Inspector, injected for the same bundling reason as
   * buildScene: the calculator renders it with the given scene (the house
   * preview may swap in the alternate scene) and banner content.
   */
  renderInspector: (scene: ChartSceneModel, banner: ComponentChildren) => ComponentChildren;
  /** natal.ts's loudest-aspect ranking, injected for the same bundling reason. */
  topAspects: (aspects: Aspect[], n?: number) => Aspect[];
  /** English authored reading, injected to keep natal.ts in the host chunk. */
  readAspect: (a: string, type: string, b: string) => string;
  /** English authored house reading, injected for the same bundling reason. */
  readHouse: (body: string, house: number) => string;
  onSelect: (e: EntityRef | null) => void;
  onAnnounce: (msg: string) => void;
  onVisual: (v: TourVisual | null) => void;
  onEnsure: (needs: { houses?: boolean; allAspects?: boolean }) => void;
  onTrack: (name: string, props: Record<string, string>) => void;
  onProgress?: (step: number, total: number) => void;
  onComplete?: () => void;
  onOpenForecast?: () => void;
  onSave: () => void;
  shareLabel: string;
  shareStatusLabel: string;
  shareDisabled: boolean;
  onShare: () => void;
  onExit: () => void;
  returnFocus: () => void;
}

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeInOutCubic = (k: number) =>
  (k < 0.5 ? 4 * k * k * k : 1 - ((-2 * k + 2) ** 3) / 2);

export default function ChartTour({
  scene, chart, locale, variant, initialStep = 0, moonAmbiguous = false, selection,
  loadEngine, buildScene, renderInspector, topAspects, readAspect, readHouse,
  onSelect, onAnnounce, onVisual, onEnsure, onTrack, onProgress, onComplete,
  onOpenForecast, onSave, shareLabel, shareStatusLabel, shareDisabled, onShare, onExit, returnFocus,
}: ChartTourProps) {
  const uncertainMoon = moonAmbiguous || moonIsUncertain(chart);
  const chapters = useMemo(
    () => (variant === 'quick' ? deriveFirstReading(uncertainMoon ? {
      ...scene, aspects: scene.aspects.filter((aspect) => aspect.a !== 'Moon' && aspect.b !== 'Moon'),
    } : scene) : deriveChapters(scene)),
    [scene, variant, uncertainMoon],
  );
  const stops = useMemo(() => flattenStops(chapters), [chapters]);

  const [at, setAt] = useState(Math.max(0, Math.min(stops.length - 1, initialStep)));
  const [ariesAnchor, setAriesAnchor] = useState(false);
  const [housePreview, setHousePreview] = useState(false);
  const [altScene, setAltScene] = useState<ChartSceneModel | null>(null);
  const [aspectFocus, setAspectFocus] = useState<AspectType | null>(null);

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const hasBirthTime = chart.input.timeKnown !== false && !chart.flags.includes('no-time');

  const stop = stops[Math.min(at, stops.length - 1)];
  const chapterDef: ChapterDef = chapters[stop.chapter];

  const cancelTween = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  /** Compose the resting visual for the current tour state. */
  function restingVisual(state: {
    aries: boolean; preview: boolean; alt: ChartSceneModel | null;
    chapterIndex: number; sub: number; focus: AspectType | null;
  }): TourVisual {
    const c = chapters[state.chapterIndex];
    const emphasis: SceneEmphasis = emphasisForChapter(scene, c, state.sub, { aspectFocus: state.focus });
    const base = state.preview && state.alt ? state.alt : scene;
    const anchored: ChartSceneModel = state.aries
      ? { ...base, anchor: { lon: 0, mode: 'aries' } }
      : { ...base, anchor: scene.anchor };
    return {
      scene: anchored,
      cusps: state.preview && state.alt && state.alt.houses
        ? state.alt.houses.map((h) => h.cuspLon)
        : undefined,
      emphasis,
    };
  }

  /** Animate one scalar 0→1 and emit a frame per step. */
  function tween(durationMs: number, frame: (k: number) => void, done: () => void) {
    cancelTween();
    if (reducedMotion()) { frame(1); done(); return; }
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / durationMs);
      frame(easeInOutCubic(k));
      if (k < 1) rafRef.current = requestAnimationFrame(step);
      else { rafRef.current = null; done(); }
    };
    rafRef.current = requestAnimationFrame(step);
  }

  /** The one navigation entry point. */
  function go(next: number, source: 'init' | 'button' | 'dot' | 'swipe') {
    const clamped = Math.max(0, Math.min(stops.length - 1, next));
    const target = stops[clamped];
    const targetChapter = chapters[target.chapter];
    const leavingChapter = stop.chapter !== target.chapter;

    cancelTween();
    // Per-chapter states revert on leave — chapters are value objects.
    const aries = leavingChapter ? false : ariesAnchor;
    const preview = leavingChapter ? false : housePreview;
    const focus = leavingChapter ? null : aspectFocus;
    if (leavingChapter) {
      setAriesAnchor(false);
      setHousePreview(false);
      setAspectFocus(null);
    }
    setAt(clamped);
    onEnsure(targetChapter.needs);
    onVisual(restingVisual({
      aries, preview, alt: altScene, chapterIndex: target.chapter, sub: target.sub, focus,
    }));

    const title = tourText(locale, targetChapter.titleKey as TourKey);
    const kicker = tourFormat(locale, variant === 'quick' ? 'quickKicker' : 'kicker', {
      n: target.chapter + 1,
      total: chapters.length,
    });
    onAnnounce(`${title}. ${kicker}`);
    if (variant === 'quick') {
      onProgress?.(clamped, stops.length);
    } else {
      onTrack('tour_step', { step: stepId(chapters, target) });
    }
    if (variant === 'full' && target.chapter === chapters.length - 1 && !completedRef.current) {
      completedRef.current = true;
      onTrack('tour_complete', { variant: 'v1' });
    }
    if (source === 'init' || source === 'dot' || source === 'swipe') {
      requestAnimationFrame(() => headingRef.current?.focus());
    }
  }

  // Mount: enter the first stop. Unmount: clean up every override.
  useEffect(() => {
    go(Math.max(0, Math.min(stops.length - 1, initialStep)), 'init');
    return () => {
      cancelTween();
      onVisual(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The chart was recomputed mid-tour: drop previews, clamp the stop into
  // the re-derived chapter list, re-emit the visual.
  const sceneRef = useRef(scene);
  useEffect(() => {
    if (sceneRef.current === scene) return;
    sceneRef.current = scene;
    cancelTween();
    setAriesAnchor(false);
    setHousePreview(false);
    setAltScene(null);
    setAspectFocus(null);
    const clamped = Math.min(at, stops.length - 1);
    setAt(clamped);
    const target = stops[clamped];
    onVisual(restingVisual({
      aries: false, preview: false, alt: null,
      chapterIndex: target.chapter, sub: target.sub, focus: null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  /** Chapter 2 (zodiac): rotate the wheel's reading anchor. */
  function toggleAnchor() {
    const toAries = !ariesAnchor;
    setAriesAnchor(toAries);
    const fromLon = toAries ? scene.anchor.lon : 0;
    const toLon = toAries ? 0 : scene.anchor.lon;
    const emphasis = emphasisForChapter(scene, chapterDef, stop.sub, { aspectFocus });
    tween(600, (k) => {
      onVisual({
        scene: { ...scene, anchor: { lon: lerpAngle(fromLon, toLon, k), mode: toAries ? 'aries' : 'asc' } },
        emphasis,
      });
    }, () => {
      onVisual(restingVisual({
        aries: toAries, preview: housePreview, alt: altScene,
        chapterIndex: stop.chapter, sub: stop.sub, focus: aspectFocus,
      }));
    });
  }

  /** Chapter houses: preview the other house system without touching state. */
  async function toggleHousePreview() {
    const toPreview = !housePreview;
    let alt = altScene;
    if (toPreview && !alt) {
      try {
        const engine = await loadEngine();
        const other = chart.houses?.system === 'whole' ? 'placidus' : 'whole';
        const recomputed = engine.computeChart({ ...chart.input, houseSystem: other });
        alt = buildScene(recomputed);
        setAltScene(alt);
      } catch {
        return; // engine unavailable — leave the preview untouched
      }
    }
    if (!scene.houses || !alt?.houses) return;
    setHousePreview(toPreview);
    const fromCusps = (toPreview ? scene : alt).houses!.map((h) => h.cuspLon);
    const toCusps = (toPreview ? alt : scene).houses!.map((h) => h.cuspLon);
    const emphasis = emphasisForChapter(scene, chapterDef, stop.sub, { aspectFocus });
    tween(450, (k) => {
      const cusps = interpolateCusps(fromCusps, toCusps, k);
      onVisual({
        scene: { ...scene, houses: previewHouses(cusps) },
        cusps,
        emphasis,
      });
    }, () => {
      onVisual(restingVisual({
        aries: ariesAnchor, preview: toPreview, alt,
        chapterIndex: stop.chapter, sub: stop.sub, focus: aspectFocus,
      }));
    });
  }

  function focusAspects(type: AspectType | null) {
    setAspectFocus(type);
    onVisual(restingVisual({
      aries: ariesAnchor, preview: housePreview, alt: altScene,
      chapterIndex: stop.chapter, sub: stop.sub, focus: type,
    }));
  }

  // ── Mid-tour selection: the normal inspector, plus the way back. ──
  if (selection) {
    const inspectorScene = housePreview && altScene ? altScene : scene;
    return (
      <>
        {renderInspector(
          inspectorScene,
          <button class="insp__return" type="button" onClick={() => onSelect(null)} data-tour-back>
            {tourText(locale, 'backToTour')}
          </button>,
        )}
      </>
    );
  }

  // ── Feature blocks ──
  let feature: ComponentChildren = null;
  switch (chapterDef.feature) {
    case 'receipt': {
      feature = (
        <p class="mono tour__receipt">
          {chart.input.utc.toISOString().replace('T', ' · ').slice(0, 21)} UTC
          {' · '}{t(locale, 'engine')}{chart.engineVersion}
        </p>
      );
      break;
    }
    case 'anchor-rotate': {
      feature = (
        <div class="tour__feature">
          <p class="insp__read tour__note">{tourText(locale, 'zodiacRotateNote')}</p>
          <button class="btn btn--glass tour__btn" type="button" onClick={toggleAnchor} data-tour-rotate aria-pressed={ariesAnchor}>
            <span>{tourText(locale, ariesAnchor ? 'rotateToAsc' : 'rotateToAries')}</span>
          </button>
        </div>
      );
      break;
    }
    case 'house-morph': {
      const diff: { body: string; from: number; to: number }[] = [];
      if (altScene) {
        for (const b of scene.bodies) {
          const other = altScene.bodies.find((x) => x.body === b.body);
          if (other && b.house != null && other.house != null && other.house !== b.house) {
            diff.push({ body: b.body, from: b.house, to: other.house });
          }
        }
      }
      const currentSystem = tourText(locale, chart.houses?.system === 'whole' ? 'wholeSign' : 'placidus');
      feature = (
        <div class="tour__feature">
          <button class="btn btn--glass tour__btn" type="button" onClick={toggleHousePreview} data-house-preview aria-pressed={housePreview}>
            <span>{tourText(locale, housePreview
              ? (chart.houses?.system === 'whole' ? 'morphToWhole' : 'morphToPlacidus')
              : (chart.houses?.system === 'whole' ? 'morphToPlacidus' : 'morphToWhole'))}</span>
          </button>
          {altScene && (
            <div class="tour__diff" data-tour-diff>
              <span class="mono--label">
                {diff.length === 0
                  ? tourText(locale, 'diffNone')
                  : diff.length === 1
                    ? tourText(locale, 'diffOne')
                    : tourFormat(locale, 'diffCount', { n: diff.length })}
              </span>
              {diff.map((d) => (
                <span class="mono tour__diff-row" key={d.body}>
                  <PlanetGlyph body={d.body} size={12} class="insp__pg" /> {planetLabel(locale, d.body)} · {d.from} → {d.to}
                </span>
              ))}
            </div>
          )}
          <p class="insp__read tour__note">
            {tourFormat(locale, 'previewNote', { system: currentSystem })}
          </p>
        </div>
      );
      break;
    }
    case 'aspect-focus': {
      const present = [...new Set(scene.aspects.map((a) => a.type))];
      const loudest = topAspects(
        scene.aspects.filter((a) => !uncertainMoon || (a.a !== 'Moon' && a.b !== 'Moon'))
          .map((a) => ({ a: a.a, b: a.b, type: a.type, orb: a.orb, applying: a.applying })),
        4,
      );
      feature = (
        <div class="tour__feature">
          <div class="tour__chips" role="group" aria-label={tourText(locale, 'aspectTypesLabel')}>
            <button class="xplr-chip" type="button" aria-pressed={aspectFocus === null} onClick={() => focusAspects(null)}>
              {tourText(locale, 'allTypes')}
            </button>
            {present.map((type) => (
              <button key={type} class="xplr-chip" type="button" aria-pressed={aspectFocus === type} onClick={() => focusAspects(type)}>
                <AspectGlyph type={type} size={11} class="xplr-chip__glyph" /> {aspectLabel(locale, type)}
              </button>
            ))}
          </div>
          <span class="mono--label">{tourText(locale, 'loudest')}</span>
          <ul class="tour__loudest">
            {loudest.map((a) => (
              <li key={`${a.a}${a.b}${a.type}`}>
                <button
                  class="insp__chip"
                  type="button"
                  onClick={() => onSelect({ kind: 'aspect', a: a.a, b: a.b, type: a.type })}
                >
                  {planetLabel(locale, a.a)} <AspectGlyph type={a.type} size={12} class="insp__pg" /> {planetLabel(locale, a.b)} · {a.orb.toFixed(1)}°
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
      break;
    }
    case 'first-big-three': {
      const sun = scene.bodies.find((body) => body.body === 'Sun');
      const moon = scene.bodies.find((body) => body.body === 'Moon');
      const entries = [
        sun ? {
          role: tourText(locale, 'quickRoleDrive'),
          label: planetLabel(locale, 'Sun'),
          lon: sun.lon,
        } : null,
        moon ? {
          role: tourText(locale, 'quickRoleNeed'),
          label: planetLabel(locale, 'Moon'),
          lon: moon.lon,
          uncertain: uncertainMoon,
        } : null,
        scene.angles ? {
          role: tourText(locale, 'quickRoleImpression'),
          label: t(locale, 'rising'),
          lon: scene.angles.asc,
        } : null,
      ];
      feature = (
        <div class="tour__feature">
          <ul class="tour__first-list">
            {entries.map((entry, index) => (
              <li key={index}>
                {entry ? (
                  <>
                    <span class="tour__first-role">{entry.role}</span>
                    <span class="tour__first-value">
                      <strong>{entry.uncertain ? moonLabel(chart, locale) : signName(signForLongitude(entry.lon), locale)}</strong>
                      <small>{entry.label}</small>
                    </span>
                  </>
                ) : (
                  <>
                    <span class="tour__first-role">{tourText(locale, 'quickRoleImpression')}</span>
                    <span class="tour__first-value">
                      <strong>{t(locale, 'needsBirthTime')}</strong>
                      <small>{t(locale, 'rising')}</small>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
          {uncertainMoon && <p class="tour__note">{moonCandidates(chart).length === 2
            ? t(locale, 'moonAmbiguousNotice') : `${t(locale, 'moon')} · ${t(locale, 'needsBirthTime')}`}</p>}
          <div class="tour__why">
            <span>{tourText(locale, 'quickWhyLabel')}</span>
            <p>{tourText(locale, 'quickBigThreeWhy')}</p>
          </div>
        </div>
      );
      break;
    }
    case 'first-sun': {
      const sun = scene.bodies.find((body) => body.body === 'Sun');
      if (!sun) break;
      const sign = signForLongitude(sun.lon);
      feature = (
        <div class="tour__feature">
          <p class="insp__read tour__personal-reading">
            {locale === 'en'
              ? bigThree('sun', sign.slug)
              : tourFormat(locale, 'quickSunPersonal', { sign: signName(sign, locale) })}
          </p>
          <p class="insp__read tour__life-area">
            {sun.house != null && locale === 'en'
              ? readHouse('Sun', sun.house)
              : sun.house != null
                ? tourFormat(locale, 'quickSunHouse', { n: sun.house })
                : tourText(locale, 'quickSunNoHouse')}
          </p>
          <p class="mono tour__first-receipt">
            {planetLabel(locale, 'Sun')} · {formatLongitude(sun.lon, locale)} · {signName(sign, locale)}
            {sun.house != null ? (
              <> · {locale === 'en'
                ? <AstroTerm term="house" label={`${t(locale, 'house')} ${sun.house}`} surface="first-reading" />
                : `${t(locale, 'house')} ${sun.house}`}</>
            ) : ''}
          </p>
          <div class="tour__why">
            <span>{tourText(locale, 'quickWhyLabel')}</span>
            <p>{tourText(locale, 'quickSunWhy')}</p>
          </div>
        </div>
      );
      break;
    }
    case 'first-aspect': {
      const ref = chapterDef.subs[0]?.entity;
      const aspect = ref?.kind === 'aspect'
        ? scene.aspects.find((candidate) => (
          candidate.a === ref.a && candidate.b === ref.b && candidate.type === ref.type
        ))
        : null;
      feature = aspect && ref?.kind === 'aspect' ? (
        <div class="tour__feature">
          <p class="insp__read tour__personal-reading">
            {locale === 'en'
              ? readAspect(ref.a, ref.type, ref.b)
              : tourFormat(locale, 'quickAspectPersonal', {
                a: planetLabel(locale, ref.a),
                b: planetLabel(locale, ref.b),
              })}
          </p>
          <p class="mono tour__first-receipt">
            {planetLabel(locale, ref.a)} <AspectGlyph type={ref.type} size={12} class="insp__pg" />{' '}
            {locale === 'en' ? (
              <AstroTerm
                term={ref.type}
                label={aspectLabel(locale, ref.type)}
                surface="first-reading"
              />
            ) : aspectLabel(locale, ref.type)}{' '}
            {planetLabel(locale, ref.b)} · {aspect.orb.toFixed(1)}°
          </p>
          <div class="tour__why">
            <span>{tourText(locale, 'quickWhyLabel')}</span>
            <p>{tourText(locale, 'quickAspectWhy')}</p>
          </div>
        </div>
      ) : (
        <div class="tour__feature">
          <div class="tour__why">
            <span>{tourText(locale, 'quickWhyLabel')}</span>
            <p>{tourText(locale, 'quickAspectEmpty')}</p>
          </div>
        </div>
      );
      break;
    }
    case 'first-next': {
      const sun = scene.bodies.find((body) => body.body === 'Sun');
      const sunSign = sun ? signForLongitude(sun.lon) : null;
      // The tour promises a monthly forecast; those editions are still English-only.
      const horoscopePath = sunSign ? `/horoscopes/${sunSign.slug}/monthly/` : '/horoscopes/';
      const horoscopeHref = localizePath(locale, horoscopePath);
      const englishOnly = horoscopeHref === horoscopePath ? englishOnlyCue(locale) : undefined;
      feature = (
        <div class="tour__feature">
          <div class="tour__future-grid">
            <button
              class="tour__future-card tour__future-card--personal tour__future-card--link"
              type="button"
              onClick={() => { onComplete?.(); onOpenForecast?.(); }}
            >
              <span>{tourText(locale, 'quickPersonalTimingLabel')}</span>
              <strong>{tourText(locale, hasBirthTime
                ? 'quickPersonalTimingTitle'
                : 'quickPersonalTimingNoTimeTitle')}</strong>
              <p>{tourText(locale, hasBirthTime
                ? 'quickPersonalTimingBody'
                : 'quickPersonalTimingNoTimeBody')}</p>
              <em>{tourText(locale, hasBirthTime ? 'quickFinish' : 'quickFinishNoTime')} →</em>
            </button>
            <a
              class="tour__future-card tour__future-card--link"
              href={horoscopeHref}
              hreflang={englishOnly ? 'en' : undefined}
              title={englishOnly?.aria}
              onClick={() => onComplete?.()}
            >
              <span>{tourText(locale, 'quickHoroscopeLabel')}</span>
              <strong>{sunSign ? signName(sunSign, locale) : tourText(locale, 'quickHoroscopeLabel')}</strong>
              <p>{tourText(locale, 'quickHoroscopeBody')}</p>
              <em>{sunSign
                ? tourFormat(locale, 'quickHoroscopeAction', { sign: signName(sunSign, locale) })
                : tourText(locale, 'quickHoroscopeLabel')} →</em>
              {englishOnly && <small>{tourText(locale, 'quickHoroscopeEnglishNote')}</small>}
            </a>
          </div>
          <div class="tour__why">
            <span>{tourText(locale, 'quickWhyLabel')}</span>
            <p>{tourText(locale, 'quickFutureWhy')}</p>
          </div>
        </div>
      );
      break;
    }
    case 'save-share': {
      feature = (
        <div class="tour__feature tour__ctas">
          <button class="btn btn--glass tour__btn" type="button" onClick={onSave}>
            <span>{t(locale, 'saveThisChart')}</span>
          </button>
        </div>
      );
      break;
    }
  }

  // Big-three sub-step content: the receipt + the existing reading line.
  const paragraphs: ComponentChildren[] = chapterDef.bodyKeys.map(
    (key) => tourText(locale, key as TourKey),
  );
  if (chapterDef.id === 'big-three') {
    const sub = chapterDef.subs[stop.sub];
    if (sub) {
      const lon = sub.entity.kind === 'body'
        ? scene.bodies.find((b) => sub.entity.kind === 'body' && b.body === sub.entity.body)?.lon ?? null
        : scene.angles?.asc ?? null;
      if (lon != null) {
        const sign = signForLongitude(lon);
        const kind = sub.id === 'asc' ? 'rising' : (sub.id as 'sun' | 'moon');
        const label = sub.entity.kind === 'body' ? planetLabel(locale, sub.entity.body) : 'ASC';
        const uncertain = kind === 'moon' && uncertainMoon;
        paragraphs.push(
          <>
            <span class="mono tour__sub-receipt">
              {label} · {uncertain
                ? `${moonLabel(chart, locale)} · ${t(locale, 'needsBirthTime')}`
                : `${formatLongitude(lon, locale)} · ${signName(sign, locale)}`}
            </span>
            {/* The reading sentence exists in English only (interpretations.ts
                has no ES tables — master-plan P10). The receipt above is fully
                localized; better no sentence than an English one mid-Spanish. */}
            {locale === 'en' && !uncertain ? <>{' '}{bigThree(kind, sign.slug)}</> : null}
          </>,
        );
      }
      feature = (
        <p class="mono--label tour__sub-progress">
          {chapterDef.subs.map((s, i) => (
            <span key={s.id} class={i === stop.sub ? 'tour__sub-on' : undefined}>
              {s.id === 'asc' ? t(locale, 'rising') : planetLabel(locale, s.id === 'sun' ? 'Sun' : 'Moon')}
              {i < chapterDef.subs.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </p>
      );
    }
  }

  return (
    <TourCard
      locale={locale}
      variant={variant}
      kicker={tourFormat(locale, variant === 'quick' ? 'quickKicker' : 'kicker', {
        n: stop.chapter + 1,
        total: chapters.length,
      })}
      title={tourText(locale, chapterDef.titleKey as TourKey)}
      dotsLabel={tourText(locale, variant === 'quick' ? 'quickDotsLabel' : 'dotsLabel')}
      exitLabel={tourText(locale, variant === 'quick' ? 'quickExitAria' : 'exitAria')}
      finishLabel={tourText(locale, variant === 'quick'
        ? 'quickSave'
        : 'finish')}
      nextLabel={variant === 'quick'
        ? tourText(locale, chapterDef.id === 'first-big-three'
          ? 'quickNextBigThree'
          : chapterDef.id === 'first-sun'
            ? 'quickNextSun'
            : 'quickNextAspect')
        : tourText(locale, 'next')}
      paragraphs={paragraphs}
      feature={feature}
      dots={chapters.map((c, i) => ({
        label: tourText(locale, c.titleKey as TourKey),
        active: i === stop.chapter,
        complete: i < stop.chapter,
      }))}
      onDot={(chapterIndex) => go(stops.findIndex((s) => s.chapter === chapterIndex && s.sub === 0), 'dot')}
      onPrev={() => go(at - 1, 'button')}
      onNext={() => go(at + 1, 'button')}
      onFinish={() => {
        cancelTween();
        onVisual(null);
        if (variant === 'quick') {
          onComplete?.();
          onSave();
        }
        else {
          onAnnounce(tourText(locale, 'ended'));
          onExit();
        }
        returnFocus();
      }}
      prevDisabled={at === 0}
      isLast={at === stops.length - 1}
      shareLabel={shareLabel}
      shareStatusLabel={shareStatusLabel}
      shareDisabled={shareDisabled}
      onShare={onShare}
      onExit={() => {
        cancelTween();
        onVisual(null);
        onAnnounce(tourText(locale, 'ended'));
        onExit();
        returnFocus();
      }}
      headingRef={headingRef}
    />
  );
}
