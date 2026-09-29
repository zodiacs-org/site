/**
 * The chart as an armillary sphere, with the observer in it.
 *
 * The flat wheel draws ecliptic longitude and drops everything else. This
 * view puts the rest back, mounted in the instrument the chart has always
 * described: a wireframe globe carrying four circles.
 *
 *   the ecliptic    the Sun's path, and the zodiac band the chart sits on
 *   the equator     tilted 23.44° to it, crossing at the equinoxes
 *   the Moon's road tilted 5.15°, crossing at the nodes
 *   the horizon     the reader's own — meeting the zodiac at the ascendant
 *
 * The first three are true of every chart ever cast. The horizon is not:
 * it depends on a minute and a place, which is why it is the circle that
 * makes a chart somebody's. Two more things follow from it for free —
 * whether the Sun was up at birth, and what the sky looked like an hour
 * either side, which the scrub shows by turning the horizon while the
 * planets stay put.
 *
 * Bodies also carry declination, measured from the equator rather than the
 * ecliptic. Past ±23.44° — further north or south than the Sun itself ever
 * goes — a body is out of bounds, and here that is something you can see
 * rather than look up. Two bodies riding the same declination circle are
 * parallel, and mirrored across the equator contraparallel: a whole aspect
 * family that the flat wheel, measuring a different angle, cannot draw at
 * all. The sphere draws the ring they share.
 *
 * And the horizon's other consequence has a name. A chart with the Sun
 * above it belongs to the day, one with the Sun below it to the night, and
 * the tradition sorts the planets by the same halves.
 *
 * Its own lazy chunk: nothing here loads until the reader asks for it.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  altitudeOf,
  declinationCircle,
  declinationOf,
  eclipseProximity,
  eclipticToVec,
  horizonCircle,
  inclinedCircle,
  julianCenturies,
  MOON_INCLINATION,
  norm360,
  OBLIQUITY,
  orient,
  splitByDepth,
  type EclipticPoint,
  type Projected,
} from '../../lib/wheel/ecliptic3d';
import { meanObliquity } from '../../lib/engine/houses';
import { findDeclinationAspects, type DeclinationAspect } from '../../lib/declination';
import { sectOf } from '../../lib/sect';
import type { HouseSystem } from '../../lib/engine/types';
import type { EntityRef } from '../../lib/scene/types';
import { SIGNS, formatLongitude } from '../../lib/signs';
import { signIcon } from '../../lib/sign-icon';
import { aspectLabel, planetLabel } from '../../lib/i18n/astrology';
import { collisionNudge } from '../../lib/scene/layout';
import { turnFrame, bodyLonAt, type TurnFrame } from './turning';
import { depthCopyFor, fill } from './copy';
import type { CatalogLocale } from '../../lib/i18n/core';

interface Body {
  body: string;
  lon: number;
  lat: number;
  retrograde?: boolean;
  speed?: number;
}
interface AspectLink { a: string; b: string; type: string }
interface InterLink { a: string; b: string; type: string; orb: number }

interface Props {
  bodies: Body[];
  aspects?: AspectLink[];
  /** A second chart on the same sphere — synastry mode. */
  partner?: { label: string; bodies: Body[] } | null;
  /** Cross-chart contacts, tightest first; drawn as chords through space. */
  interAspects?: InterLink[];
  cusps?: number[] | null;
  asc?: number | null;
  mc?: number | null;
  dsc?: number | null;
  ic?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  utcMs?: number | null;
  houseSystem?: HouseSystem;
  polarFallback?: boolean;
  /** Local clock reading at birth, "HH:MM", for the scrub readout. */
  birthClock?: string | null;
  locale?: CatalogLocale;
  selection?: EntityRef | null;
  onSelect?: (ref: EntityRef | null) => void;
  size?: number;
  label?: string;
}

const VB = 400;
const CX = VB / 2;
const CY = VB / 2;

const R_SPHERE = 150;
const R_BAND_IN = 128;
const R_ICON = 139;
const R_BODY = 150;
/** The flat wheel's aspect hub, in this frame: 0.235 × 400. */
const R_HUB = 94;

const RESTING_TILT = 62;
const SCRUB_LIMIT = 720;

const GLYPH: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
};

const ASPECT_COLOR: Record<string, string> = {
  conjunction: 'rgba(238,241,247,0.55)',
  sextile: 'rgba(169,212,196,0.66)',
  trine: 'rgba(182,212,228,0.72)',
  square: 'rgba(222,142,121,0.72)',
  opposition: 'rgba(224,169,180,0.72)',
};

function reduced(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** One decimal, in the reader's own notation. */
const deg1 = (v: number, locale: string) =>
  v.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const deg2 = (v: number, locale: string) =>
  v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function EclipticView({
  bodies, aspects = [], partner = null, interAspects = [], cusps = null,
  asc = null, mc = null, dsc = null, ic = null,
  latitude = null, longitude = null, utcMs = null,
  houseSystem = 'whole', polarFallback = false, birthClock = null,
  locale = 'en', selection = null, onSelect,
  size = 460, label,
}: Props) {
  const copy = depthCopyFor(locale);
  /**
   * Russian reads the English copy, so everything this view composes —
   * body names, degrees, sign names — follows the copy rather than the
   * page, or a Russian planet lands mid-English-sentence.
   */
  const textLocale = locale === 'ru' ? 'en' : locale;

  const [tilt, setTilt] = useState(reduced() ? RESTING_TILT : 0);
  const [spin, setSpin] = useState(0);
  const [scrub, setScrub] = useState(0);

  const intro = useRef<number>();
  const physics = useRef<number>();
  const idle = useRef<ReturnType<typeof setTimeout>>();
  const drag = useRef<
    { x: number; y: number; tilt: number; spin: number; moved: number; vx: number; vy: number } | null
  >(null);

  /** Any deliberate input stops whatever the sphere was doing on its own. */
  const halt = () => {
    if (intro.current) cancelAnimationFrame(intro.current);
    if (physics.current) cancelAnimationFrame(physics.current);
    if (idle.current) clearTimeout(idle.current);
    intro.current = undefined;
    physics.current = undefined;
  };

  /** A slow drift after a while untouched, so the thing reads as an object. */
  const armIdle = () => {
    if (reduced()) return;
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => {
      let last = performance.now();
      const run = (now: number) => {
        const dt = Math.min(64, now - last);
        last = now;
        setSpin((s) => s + 1.1 * (dt / 1000));
        physics.current = requestAnimationFrame(run);
      };
      physics.current = requestAnimationFrame(run);
    }, 6000);
  };

  useEffect(() => {
    if (reduced()) return undefined;
    const start = performance.now();
    const run = (now: number) => {
      const p = Math.min(1, (now - start) / 1500);
      setTilt(RESTING_TILT * (1 - Math.pow(1 - p, 3)));
      if (p < 1) intro.current = requestAnimationFrame(run);
      else { intro.current = undefined; armIdle(); }
    };
    intro.current = requestAnimationFrame(run);
    return () => { halt(); };
  }, []);

  /** Anchored like the flat wheel: the ascendant sits on the left at rest. */
  const anchor = asc ?? 0;
  const at = (lon: number, lat: number, r: number): Projected => {
    const v = orient(eclipticToVec(180 + (lon - anchor), lat), spin, tilt);
    return { x: CX + r * v.x, y: CY - r * v.y, depth: v.z };
  };
  const poly = (pts: Projected[]) => pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const curve = (pts: EclipticPoint[], r: number) =>
    splitByDepth(pts.map((p) => at(p.lon, p.lat, r)));

  /** The globe only materialises as the chart opens; flat, it stays a wheel. */
  const solidity = clamp01((tilt - 6) / 34);
  /** The house floor is flat-chart structure; it hands over to the sphere. */
  const floorFade = clamp01(1 - (tilt - 30) / 40);

  /** The horizon needs a minute and a place. Without them, no observer. */
  const sited = asc !== null && mc !== null
    && latitude !== null && longitude !== null && utcMs !== null;

  /** A second chart present: single-chart readouts stand down. */
  const duo = partner !== null && partner.bodies.some((b) => GLYPH[b.body] !== undefined);

  const obliquity = useMemo(
    () => (utcMs === null ? OBLIQUITY : meanObliquity(julianCenturies(utcMs))),
    [utcMs],
  );

  /** The observer's chart at the scrubbed minute. */
  const frame: TurnFrame | null = useMemo(() => {
    if (!sited) return null;
    return turnFrame({
      utcMs: utcMs!,
      latitude: latitude!,
      longitude: longitude!,
      baseline: { asc: asc!, mc: mc!, dsc: dsc ?? norm360(asc! + 180), ic: ic ?? norm360(mc! + 180) },
      baselineCusps: cusps,
      houseSystem,
      polarFallback,
    }, scrub);
  }, [sited, utcMs, latitude, longitude, asc, mc, dsc, ic, cusps, houseSystem, polarFallback, scrub]);

  /** Bodies advance along the zodiac only; their tilt off the plane is held. */
  const shown = useMemo(() => bodies.map((b) => (
    scrub === 0 ? b : { ...b, lon: bodyLonAt(b.lon, b.speed ?? 0, scrub) }
  )), [bodies, scrub]);

  const node = shown.find((b) => b.body === 'North Node');
  const sun = shown.find((b) => b.body === 'Sun');
  const nodeLon = node ? node.lon : null;

  const eclipse = useMemo(
    () => (!duo && sun && nodeLon !== null ? eclipseProximity(sun.lon, nodeLon) : null),
    [duo, sun?.lon, nodeLon],
  );

  /** Meridians through the ecliptic poles, and parallels of latitude. */
  const wire = useMemo(() => {
    const runs: { front: boolean; d: string }[] = [];
    for (let lon = 0; lon < 180; lon += 30) {
      const pts: Projected[] = [];
      for (let lat = -90; lat <= 90; lat += 5) pts.push(at(lon, lat, R_SPHERE));
      for (let lat = 90; lat >= -90; lat -= 5) pts.push(at(lon + 180, lat, R_SPHERE));
      splitByDepth(pts).forEach((r) => runs.push({ front: r.front, d: poly(r.points) }));
    }
    for (const lat of [-60, -30, 30, 60]) {
      const pts: Projected[] = [];
      for (let lon = 0; lon <= 360; lon += 5) pts.push(at(lon, lat, R_SPHERE));
      splitByDepth(pts).forEach((r) => runs.push({ front: r.front, d: poly(r.points) }));
    }
    return runs;
  }, [spin, tilt, anchor]);

  const equator = useMemo(
    () => curve(inclinedCircle(0, OBLIQUITY, 3), R_SPHERE),
    [spin, tilt, anchor],
  );

  const moonRoad = useMemo(
    () => (nodeLon === null ? [] : curve(inclinedCircle(nodeLon, MOON_INCLINATION, 3), R_SPHERE)),
    [nodeLon, spin, tilt, anchor],
  );

  const horizon = useMemo(
    () => (frame ? curve(horizonCircle(frame.zenith, 3), R_SPHERE) : []),
    [frame, spin, tilt, anchor],
  );

  /** The bounds the Sun itself never passes. */
  const bounds = useMemo(() => [obliquity, -obliquity].map(
    (dec) => curve(declinationCircle(dec, obliquity, 4), R_SPHERE),
  ), [obliquity, spin, tilt, anchor]);

  const declAspects = useMemo(() => findDeclinationAspects(
    shown.filter((b) => GLYPH[b.body]).map((b) => ({ body: b.body, lon: b.lon, lat: b.lat })),
    obliquity,
  ), [shown, obliquity]);

  /**
   * One pair gets the ring and the caption, and which one is worth the
   * space is a question about the wheel rather than about the orb. A pair
   * the wheel already joins proves nothing, and neither does a pair sitting
   * in the same few degrees of zodiac — the wheel shows those together
   * anyway. What it cannot show is a tie across an arc, so the tightest
   * pair the wheel both misses and scatters leads, with the tightest it
   * merely misses behind it.
   */
  const declHeadline: DeclinationAspect | null = useMemo(() => {
    if (duo) return null;
    const key = (a: string, b: string) => [a, b].sort().join('|');
    const drawn = new Set(aspects.map((a) => key(a.a, a.b)));
    const missed = declAspects.filter((d) => !drawn.has(key(d.a, d.b)));
    return missed.find((d) => d.separation >= 30) ?? missed[0] ?? declAspects[0] ?? null;
  }, [duo, declAspects, aspects]);

  /**
   * The ring the pair shares. A parallel rides one circle, so the two
   * declinations collapse to their mean rather than drawing twice at a
   * degree's separation; a contraparallel gets both, which is the mirror.
   */
  const declRings = useMemo(() => {
    if (!declHeadline) return [];
    const decs = declHeadline.type === 'parallel'
      ? [(declHeadline.decA + declHeadline.decB) / 2]
      : [declHeadline.decA, declHeadline.decB];
    return decs.map((dec) => curve(declinationCircle(dec, obliquity, 4), R_SPHERE));
  }, [declHeadline, obliquity, spin, tilt, anchor]);

  /** The zodiac band: twelve tinted ribbons lying in the ecliptic plane. */
  const sectors = useMemo(() => SIGNS.map((sign, i) => {
    const outer: Projected[] = [];
    const inner: Projected[] = [];
    for (let d = 0; d <= 30; d += 2.5) {
      outer.push(at(i * 30 + d, 0, R_SPHERE));
      inner.unshift(at(i * 30 + d, 0, R_BAND_IN));
    }
    const mid = at(i * 30 + 15, 0, R_BAND_IN);
    return { sign, points: poly([...outer, ...inner]), depth: mid.depth };
  }).sort((a, z) => a.depth - z.depth), [spin, tilt, anchor]);

  /** The pastel discs themselves — the site's icons, not redrawn glyphs. */
  const icons = useMemo(() => SIGNS.map((sign, i) => ({
    sign, p: at(i * 30 + 15, 0, R_ICON),
  })).sort((a, z) => a.p.depth - z.p.depth), [spin, tilt, anchor]);

  const houses = useMemo(() => {
    const live = frame?.cusps ?? cusps;
    if (!live || live.length !== 12) return null;
    return live.map((lon, i) => {
      const span = norm360(live[(i + 1) % 12] - lon) || 30;
      return { i, p: at(lon, 0, R_BAND_IN), num: at(lon + span / 2, 0, 54) };
    });
  }, [frame, cusps, spin, tilt, anchor]);

  const centre = useMemo(() => at(0, 90, 0), [spin, tilt, anchor]);

  /** Where the horizon meets the zodiac, and where the Moon's road does. */
  const angleMarks = useMemo(() => {
    if (!frame) return [];
    return [
      { key: 'asc', lon: frame.angles.asc, text: 'ASC' },
      { key: 'dsc', lon: frame.angles.dsc, text: 'DSC' },
      { key: 'mc', lon: frame.angles.mc, text: 'MC' },
      { key: 'ic', lon: frame.angles.ic, text: 'IC' },
    ].map((a) => ({ ...a, p: at(a.lon, 0, R_SPHERE) }));
  }, [frame, spin, tilt, anchor]);

  const nodeMarks = useMemo(() => (nodeLon === null ? [] : [
    { lon: nodeLon, glyph: '☊' },
    { lon: norm360(nodeLon + 180), glyph: '☋' },
  ].map((n) => ({ ...n, p: at(n.lon, 0, R_SPHERE) }))), [nodeLon, spin, tilt, anchor]);

  const equinoxes = useMemo(
    () => [0, 180].map((lon) => ({ lon, p: at(lon, 0, R_SPHERE) })),
    [spin, tilt, anchor],
  );

  /**
   * Crowded bodies fan apart on the flat wheel, where they would otherwise
   * stack. Open the sphere and the fan relaxes back to true longitude,
   * because the separation is the reader's to judge by then.
   */
  const drawLon = useMemo(
    () => collisionNudge(shown.filter((b) => GLYPH[b.body])),
    [shown],
  );

  const marks = useMemo(() => shown
    .filter((b) => GLYPH[b.body])
    .map((b) => {
      const fanned = drawLon.get(b.body) ?? b.lon;
      const lonAt = b.lon + (fanned - b.lon) * (1 - solidity);
      const dec = declinationOf(b.lon, b.lat, obliquity);
      return {
        ...b,
        partner: false,
        lonAt,
        dec,
        outOfBounds: Math.abs(dec) > obliquity,
        up: frame ? altitudeOf(b.lon, b.lat, frame.zenith) > 0 : true,
        p: at(lonAt, b.lat, R_BODY),
        foot: at(lonAt, 0, R_BODY),
        hub: at(lonAt, b.lat, R_HUB + (R_BODY - R_HUB) * solidity),
      };
    })
    .sort((a, z) => a.p.depth - z.p.depth), [shown, drawLon, solidity, obliquity, frame, spin, tilt, anchor]);

  /** The second chart's bodies, dashed, at their own true positions. */
  const partnerMarks = useMemo(() => (partner?.bodies ?? [])
    .filter((b) => GLYPH[b.body])
    .map((b) => {
      const dec = declinationOf(b.lon, b.lat, obliquity);
      return {
        ...b,
        partner: true,
        lonAt: b.lon,
        dec,
        outOfBounds: Math.abs(dec) > obliquity,
        up: true,
        p: at(b.lon, b.lat, R_BODY),
        foot: at(b.lon, 0, R_BODY),
        hub: at(b.lon, b.lat, R_BODY),
      };
    })
    .sort((a, z) => a.p.depth - z.p.depth), [partner, obliquity, spin, tilt, anchor]);

  /** A longitude-only side has every latitude at exactly zero. */
  const flatSide = duo && partnerMarks.length > 0 && (
    partnerMarks.every((m) => m.lat === 0)
    || marks.filter((m) => m.body !== 'Sun').every((m) => m.lat === 0)
  );

  /** Cross-chart contacts as chords between the two bodies' real positions. */
  const interChords = useMemo(() => {
    if (!duo) return [];
    const mine = new Map(marks.map((m) => [m.body, m.p]));
    const theirs = new Map(partnerMarks.map((m) => [m.body, m.p]));
    return interAspects
      .map((link) => {
        const p1 = mine.get(link.a);
        const p2 = theirs.get(link.b);
        return p1 && p2 ? { ...link, p1, p2, depth: (p1.depth + p2.depth) / 2 } : null;
      })
      .filter(Boolean) as (InterLink & { p1: Projected; p2: Projected; depth: number })[];
  }, [duo, interAspects, marks, partnerMarks]);

  const web = useMemo(() => {
    const pos = new Map<string, Projected>();
    for (const m of marks) pos.set(m.body, m.hub);
    return aspects
      .map((a) => {
        const p1 = pos.get(a.a);
        const p2 = pos.get(a.b);
        return p1 && p2 ? { ...a, p1, p2, depth: (p1.depth + p2.depth) / 2 } : null;
      })
      .filter(Boolean)
      .sort((a, z) => a!.depth - z!.depth) as
        { type: string; p1: Projected; p2: Projected; depth: number }[];
  }, [aspects, marks]);

  // ── Interaction ───────────────────────────────────────────────────
  const onDown = (e: PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tilt, spin, moved: 0, vx: 0, vy: 0 };
    halt();
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.moved = Math.max(d.moved, Math.hypot(dx, dy));
    d.vx = dx * 0.4 - (spin - d.spin);
    d.vy = dy * 0.4 - (tilt - d.tilt);
    setTilt(Math.max(0, Math.min(90, d.tilt + dy * 0.4)));
    setSpin(d.spin + dx * 0.4);
  };
  const onUp = (e: PointerEvent) => {
    const d = drag.current;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
    if (!d) return;
    if (!reduced() && d.moved > 4) {
      // Let the sphere coast, the way a mounted globe would.
      let vx = Math.max(-14, Math.min(14, d.vx));
      let vy = Math.max(-14, Math.min(14, d.vy));
      const run = () => {
        vx *= 0.94;
        vy *= 0.94;
        if (Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) { physics.current = undefined; armIdle(); return; }
        setSpin((s) => s + vx);
        setTilt((t) => Math.max(0, Math.min(90, t + vy)));
        physics.current = requestAnimationFrame(run);
      };
      physics.current = requestAnimationFrame(run);
    } else armIdle();
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 3;
    let used = true;
    if (e.key === 'ArrowUp') setTilt((t) => Math.max(0, t - step));
    else if (e.key === 'ArrowDown') setTilt((t) => Math.min(90, t + step));
    else if (e.key === 'ArrowLeft') setSpin((s) => s - step);
    else if (e.key === 'ArrowRight') setSpin((s) => s + step);
    else if (e.key === 'Escape' && selection) onSelect?.(null);
    else used = false;
    if (used) { e.preventDefault(); halt(); armIdle(); }
  };

  const pick = (ref: EntityRef) => (e: Event) => {
    e.stopPropagation();
    if ((drag.current?.moved ?? 0) > 4) return;
    onSelect?.(ref);
  };

  const resetView = () => {
    halt();
    setTilt(RESTING_TILT);
    setSpin(0);
    setScrub(0);
    armIdle();
  };

  // ── Readouts ──────────────────────────────────────────────────────
  const cue = (d: number) => 0.4 + 0.6 * ((d + 1) / 2);

  const offPlane = shown
    .filter((b) => GLYPH[b.body] && b.body !== 'Sun')
    .sort((a, z) => Math.abs(z.lat) - Math.abs(a.lat))[0];

  const strayest = marks
    .filter((m) => m.outOfBounds)
    .sort((a, z) => Math.abs(z.dec) - Math.abs(a.dec))[0];

  const sunAltitude = frame && sun ? altitudeOf(sun.lon, sun.lat, frame.zenith) : null;
  const daylight = sunAltitude === null ? null
    : Math.abs(sunAltitude) < 0.5 ? copy.sectLevel
      : fill(sunAltitude > 0 ? copy.sectDay : copy.sectNight, {
        deg: deg1(Math.abs(sunAltitude), textLocale),
        // Scrub far enough and a day chart becomes a night one, so the
        // line has to stop claiming this is the birth minute.
        when: scrub === 0 ? copy.atBirth : copy.atMoment,
      });

  /** Which half of the sky the chart belongs to, and who keeps it. */
  const sect = useMemo(() => {
    if (sunAltitude === null || !sun) return null;
    const mercury = shown.find((b) => b.body === 'Mercury');
    return sectOf({ sunAltitude, sunLon: sun.lon, mercuryLon: mercury?.lon ?? null });
  }, [sunAltitude, sun?.lon, shown]);

  const names = (bodies: readonly string[]) =>
    bodies.map((body) => planetLabel(textLocale, body)).join(', ');

  /** The pair, drawn where they actually stand rather than through the hub. */
  const declChord = useMemo(() => {
    if (!declHeadline) return null;
    const one = marks.find((m) => m.body === declHeadline.a);
    const other = marks.find((m) => m.body === declHeadline.b);
    return one && other ? { p1: one.p, p2: other.p } : null;
  }, [declHeadline, marks]);

  const declText = declHeadline && fill(copy.declLine, {
    a: planetLabel(textLocale, declHeadline.a),
    degA: deg1(Math.abs(declHeadline.decA), textLocale),
    dirA: declHeadline.decA >= 0 ? copy.north : copy.south,
    b: planetLabel(textLocale, declHeadline.b),
    degB: deg1(Math.abs(declHeadline.decB), textLocale),
    dirB: declHeadline.decB >= 0 ? copy.north : copy.south,
    rel: declHeadline.type === 'parallel' ? copy.declParallel : copy.declContra,
    orb: deg2(declHeadline.orb, textLocale),
    sep: deg1(declHeadline.separation, textLocale),
  });

  const picked = selection?.kind === 'body'
    ? marks.find((m) => m.body === selection.body) : undefined;

  /**
   * The rest of the declination aspects are reachable rather than merely
   * counted: tap a body and its own ties come with its readout.
   */
  const pickedDecl = !picked ? [] : declAspects
    .filter((d) => d.a === picked.body || d.b === picked.body)
    .slice(0, 2)
    .map((d) => fill(copy.declPicked, {
      rel: d.type === 'parallel' ? copy.declParallel : copy.declContra,
      body: planetLabel(textLocale, d.a === picked.body ? d.b : d.a),
      orb: deg2(d.orb, textLocale),
    }));

  /** Birth clock plus the offset. Zone rules inside the window aren't modelled. */
  const scrubClock = useMemo(() => {
    if (!birthClock) return null;
    const [h, m] = birthClock.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const total = ((h * 60 + m + scrub) % 1440 + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }, [birthClock, scrub]);

  const scrubLabel = useMemo(() => {
    const sign = scrub < 0 ? '−' : '+';
    const abs = Math.abs(scrub);
    const hm = `${Math.floor(abs / 60)}h ${String(abs % 60).padStart(2, '0')}m`;
    // formatLongitude already reads "3°27′ Leo" — sign included.
    const ascText = frame ? `ASC ${formatLongitude(frame.angles.asc, textLocale)}` : '';
    return { offset: scrub === 0 ? '0h 00m' : `${sign}${hm}`, ascText };
  }, [scrub, frame, textLocale]);

  const backWire = wire.filter((w) => !w.front);
  const frontWire = wire.filter((w) => w.front);
  const drawnBodies = duo
    ? [...marks, ...partnerMarks].sort((a, z) => a.p.depth - z.p.depth)
    : marks;
  const backBodies = drawnBodies.filter((m) => m.p.depth < 0);
  const frontBodies = drawnBodies.filter((m) => m.p.depth >= 0);

  const bodyGroup = (m: (typeof marks[number]) | (typeof partnerMarks[number])) => {
    const dim = m.up ? 1 : 0.45;
    const o = cue(m.p.depth) * dim;
    const r = 8 + 2.4 * ((m.p.depth + 1) / 2);
    const hue = SIGNS[Math.floor(norm360(m.lon) / 30)].hue;
    const isPicked = !m.partner && selection?.kind === 'body' && selection.body === m.body;
    return (
      <g
        class={`ev-body${m.body === 'Sun' ? ' is-sun' : ''}${isPicked ? ' is-picked' : ''}${m.partner ? ' is-partner' : ''}`}
        style={`--hue:${hue};opacity:${o.toFixed(3)}`}
        onPointerUp={onSelect && !m.partner ? pick({ kind: 'body', body: m.body as never }) : undefined}
      >
        <line class="ev-stem" x1={m.foot.x.toFixed(2)} y1={m.foot.y.toFixed(2)} x2={m.p.x.toFixed(2)} y2={m.p.y.toFixed(2)} />
        <circle class="ev-foot" cx={m.foot.x.toFixed(2)} cy={m.foot.y.toFixed(2)} r="1.7" />
        {isPicked && <circle class="ev-halo" cx={m.p.x.toFixed(2)} cy={m.p.y.toFixed(2)} r={(r + 4).toFixed(2)} />}
        {!m.partner && sect?.light === m.body && (
          <circle class="ev-sectring" cx={m.p.x.toFixed(2)} cy={m.p.y.toFixed(2)} r={(r + 3).toFixed(2)} />
        )}
        <circle class="ev-disc" cx={m.p.x.toFixed(2)} cy={m.p.y.toFixed(2)} r={r.toFixed(2)} />
        <text class="ev-glyph" x={m.p.x.toFixed(2)} y={m.p.y.toFixed(2)} text-anchor="middle" dominant-baseline="central">
          {GLYPH[m.body]}
        </text>
        {m.retrograde && (
          <text class="ev-rx" x={(m.p.x + r + 2).toFixed(2)} y={(m.p.y + r + 1).toFixed(2)}>Rx</text>
        )}
        {m.outOfBounds && (
          <text class="ev-oob" x={(m.p.x + r + 2).toFixed(2)} y={(m.p.y - r + 1).toFixed(2)}>OOB</text>
        )}
      </g>
    );
  };

  return (
    <figure class="ev" style={`--ev-size:${size}px`}>
      <svg
        viewBox="0 0 400 400"
        class="ev-stage"
        role="img"
        tabIndex={0}
        aria-label={label ?? copy.figureLabel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <circle class="ev-globe" cx={CX} cy={CY} r={R_SPHERE} style={`opacity:${solidity.toFixed(3)}`} />

        <g class="ev-wire is-back" style={`opacity:${(solidity * 0.45).toFixed(3)}`}>
          {backWire.map((w) => <polyline points={w.d} />)}
        </g>
        <g class="ev-ring is-back" style={`opacity:${solidity.toFixed(3)}`}>
          {equator.filter((r) => !r.front).map((r) => <polyline class="ev-equator" points={poly(r.points)} />)}
          {moonRoad.filter((r) => !r.front).map((r) => <polyline class="ev-moonroad" points={poly(r.points)} />)}
          {horizon.filter((r) => !r.front).map((r) => <polyline class="ev-horizon" points={poly(r.points)} />)}
          {bounds.map((b) => b.filter((r) => !r.front).map((r) => (
            <polyline class="ev-bound" points={poly(r.points)} />
          )))}
          {declRings.map((ring) => ring.filter((r) => !r.front).map((r) => (
            <polyline class="ev-declring" points={poly(r.points)} />
          )))}
        </g>

        {backBodies.map(bodyGroup)}

        <g class="ev-band">
          {sectors.map(({ sign, points }) => (
            <polygon class="ev-sector" points={points} style={`--hue:${sign.hue}`} />
          ))}
        </g>

        {houses && floorFade > 0.01 && (
          <g class="ev-houses" style={`opacity:${floorFade.toFixed(3)}`}>
            {houses.map((h) => (
              <line class="ev-cusp"
                    x1={centre.x.toFixed(2)} y1={centre.y.toFixed(2)}
                    x2={h.p.x.toFixed(2)} y2={h.p.y.toFixed(2)} />
            ))}
            {houses.map((h) => (
              <text class="ev-housenum" x={h.num.x.toFixed(2)} y={h.num.y.toFixed(2)}
                    text-anchor="middle" dominant-baseline="central">{h.i + 1}</text>
            ))}
          </g>
        )}

        {icons.map(({ sign, p }) => (
          <image
            class="ev-signicon"
            href={signIcon(48, sign.slug)}
            x={(p.x - 11).toFixed(2)} y={(p.y - 11).toFixed(2)}
            width="22" height="22"
            style={`opacity:${cue(p.depth).toFixed(3)}`}
          />
        ))}

        <g class="ev-web">
          {web.map((w) => (
            <line x1={w.p1.x.toFixed(2)} y1={w.p1.y.toFixed(2)} x2={w.p2.x.toFixed(2)} y2={w.p2.y.toFixed(2)}
                  stroke={ASPECT_COLOR[w.type] ?? 'rgba(198,204,218,0.5)'}
                  style={`opacity:${(0.6 + 0.4 * ((w.depth + 1) / 2)).toFixed(3)}`} />
          ))}
        </g>

        {interChords.length > 0 && (
          <g class="ev-inter">
            {interChords.map((w) => (
              <line x1={w.p1.x.toFixed(2)} y1={w.p1.y.toFixed(2)} x2={w.p2.x.toFixed(2)} y2={w.p2.y.toFixed(2)}
                    stroke={ASPECT_COLOR[w.type] ?? 'rgba(198,204,218,0.5)'}
                    style={`opacity:${(0.55 + 0.45 * ((w.depth + 1) / 2)).toFixed(3)}`} />
            ))}
          </g>
        )}

        {declChord && (
          <line class="ev-declchord"
                x1={declChord.p1.x.toFixed(2)} y1={declChord.p1.y.toFixed(2)}
                x2={declChord.p2.x.toFixed(2)} y2={declChord.p2.y.toFixed(2)} />
        )}

        <g class="ev-ring" style={`opacity:${solidity.toFixed(3)}`}>
          {equator.filter((r) => r.front).map((r) => <polyline class="ev-equator" points={poly(r.points)} />)}
          {moonRoad.filter((r) => r.front).map((r) => <polyline class="ev-moonroad" points={poly(r.points)} />)}
          {horizon.filter((r) => r.front).map((r) => <polyline class="ev-horizon" points={poly(r.points)} />)}
          {bounds.map((b) => b.filter((r) => r.front).map((r) => (
            <polyline class="ev-bound" points={poly(r.points)} />
          )))}
          {declRings.map((ring) => ring.filter((r) => r.front).map((r) => (
            <polyline class="ev-declring" points={poly(r.points)} />
          )))}
        </g>
        <g class="ev-wire" style={`opacity:${(solidity * 0.85).toFixed(3)}`}>
          {frontWire.map((w) => <polyline points={w.d} />)}
        </g>

        <g class="ev-crossings" style={`opacity:${solidity.toFixed(3)}`}>
          {equinoxes.map((e) => (
            <circle class="ev-equinox" cx={e.p.x.toFixed(2)} cy={e.p.y.toFixed(2)} r="2.6" />
          ))}
          {nodeMarks.map((n) => (
            <g class="ev-node">
              <circle cx={n.p.x.toFixed(2)} cy={n.p.y.toFixed(2)} r="3.2" />
              <text x={n.p.x.toFixed(2)} y={(n.p.y - 9).toFixed(2)} text-anchor="middle">{n.glyph}</text>
            </g>
          ))}
        </g>

        {angleMarks.map((a) => (
          <g class={`ev-angle${a.key === 'asc' ? ' is-asc' : ''}`}>
            <circle cx={a.p.x.toFixed(2)} cy={a.p.y.toFixed(2)} r={a.key === 'asc' ? 3.6 : 2.6} />
            <text x={a.p.x.toFixed(2)} y={(a.p.y - 8).toFixed(2)} text-anchor="middle">{a.text}</text>
          </g>
        ))}

        {frontBodies.map(bodyGroup)}
      </svg>

      <div class="ev-controls">
        <label class="ev-slider">
          <span>{copy.tiltLabel}</span>
          <input type="range" min="0" max="90" step="1" value={Math.round(tilt)}
                 aria-label={copy.tiltAria}
                 onInput={(e) => { halt(); setTilt(Number((e.target as HTMLInputElement).value)); armIdle(); }} />
          <span class="mono">{Math.round(tilt)}°</span>
        </label>

        {sited && (
          <label class="ev-slider ev-slider--scrub">
            <span>{copy.timeLabel}</span>
            <input type="range" min={-SCRUB_LIMIT} max={SCRUB_LIMIT} step="5" value={scrub}
                   aria-label={copy.timeAria}
                   aria-valuetext={`${scrubLabel.offset} — ${scrubLabel.ascText}`}
                   onInput={(e) => { halt(); setScrub(Number((e.target as HTMLInputElement).value)); armIdle(); }} />
            <span class="mono">{scrubLabel.offset}</span>
          </label>
        )}

        <div class="ev-actions">
          <button type="button" class="ev-reset" onClick={resetView} aria-label={copy.resetAria}>
            {copy.reset}
          </button>
          {sited && (
            <p class="mono ev-clock" aria-live="polite">
              {scrubClock ? `${scrubClock} · ` : ''}{scrubLabel.ascText}
            </p>
          )}
        </div>

        <ul class="ev-key">
          <li>
            <i class="ev-key-band" aria-hidden="true">
              {SIGNS.slice(0, 4).map((s) => <b style={`background:${s.hue}`} />)}
            </i>
            {copy.keyEcliptic}
          </li>
          <li><i class="ev-key-line ev-key-equator" />{copy.keyEquator}</li>
          <li><i class="ev-key-line ev-key-moon" />{copy.keyMoon}</li>
          {sited && <li><i class="ev-key-line ev-key-horizon" />{copy.keyHorizon}</li>}
          <li><i class="ev-key-line ev-key-bounds" />{copy.keyBounds}</li>
          {declHeadline && <li><i class="ev-key-line ev-key-decl" />{copy.keyDecl}</li>}
          {duo && <li><i class="ev-key-line ev-key-yours" />{copy.keyYours}</li>}
          {duo && <li><i class="ev-key-line ev-key-theirs" />{copy.keyTheirs}</li>}
        </ul>
      </div>

      <figcaption class="ev-caption">
        <p>{copy.dragHint}</p>

        {picked && (
          <p class="mono ev-picked">
            {planetLabel(textLocale, picked.body)} {formatLongitude(picked.lon, textLocale)} ·{' '}
            {copy.latitudeShort} {picked.lat >= 0 ? '+' : '−'}{deg2(Math.abs(picked.lat), textLocale)}° ·{' '}
            {copy.declinationShort} {picked.dec >= 0 ? '+' : '−'}{deg2(Math.abs(picked.dec), textLocale)}°
            {frame ? ` · ${picked.up ? copy.above : copy.below}` : ''}
            {pickedDecl.map((line) => ` · ${line}`)}
          </p>
        )}

        {!duo && offPlane && !picked && (
          <p class="mono ev-readout">
            {fill(copy.offPlane, {
              body: planetLabel(textLocale, offPlane.body),
              dir: offPlane.lat >= 0 ? copy.north : copy.south,
              deg: deg1(Math.abs(offPlane.lat), textLocale),
            })} · {copy.sunDefines}
          </p>
        )}

        {duo && interChords[0] && (
          <p class="mono ev-readout">
            {fill(copy.interLine, {
              a: planetLabel(textLocale, interChords[0].a),
              rel: aspectLabel(textLocale, interChords[0].type as never),
              b: planetLabel(textLocale, interChords[0].b),
              orb: deg2(interChords[0].orb, textLocale),
            })}
          </p>
        )}
        {duo && interChords.length > 1 && (
          <p class="ev-note ev-fine">{fill(copy.interMore, { n: String(interChords.length) })}</p>
        )}
        {flatSide && <p class="ev-note ev-fine">{copy.flatSide}</p>}

        {daylight && <p class="ev-note">{daylight}</p>}

        {sect && (
          <p class="mono ev-readout">
            {fill(copy.sectLine, {
              light: planetLabel(textLocale, sect.light),
              inSect: names(sect.inSect),
              outSect: names(sect.outOfSect),
            })}
            {' · '}
            <a class="ev-link" href="/learn/glossary/#sect">{copy.sectLink}</a>
          </p>
        )}

        {declText && (
          <p class="mono ev-readout">
            {declText}
            {' · '}
            <a class="ev-link" href="/learn/glossary/#parallel">{copy.declLink}</a>
          </p>
        )}

        {!duo && declAspects.length > 1 && (
          <p class="ev-note ev-fine">
            {fill(copy.declMore, { n: String(declAspects.length) })}
          </p>
        )}

        {!duo && strayest && (
          <p class="ev-note">
            {fill(copy.outOfBounds, {
              body: planetLabel(textLocale, strayest.body),
              deg: deg1(Math.abs(strayest.dec), textLocale),
              limit: deg1(obliquity, textLocale),
            })}
          </p>
        )}

        {eclipse && (
          <p class="ev-note">
            {fill(eclipse.possible ? copy.eclipseInside : copy.eclipseOutside,
              { deg: eclipse.degrees.toFixed(0) })}
          </p>
        )}

        {!duo && nodeLon !== null && <p class="ev-note ev-fine">{copy.moonMean}</p>}
        {scrub !== 0 && <p class="ev-note ev-fine">{copy.scrubNote}</p>}
        {!duo && !sited && <p class="ev-note">{copy.noAngles}</p>}
        {copy.englishNote && <p class="ev-note ev-note--marker">{copy.englishNote}</p>}
      </figcaption>
    </figure>
  );
}
