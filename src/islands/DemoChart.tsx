/**
 * The capability demo: a real, precomputed chart (Frida Kahlo, public
 * birth data, Rodden AA) with build-time captions. The component is
 * server-rendered; its tiny classic script only toggles existing DOM.
 *
 * Layout: the wheel (with the full-size selector for every mark beneath
 * it) beside her big three as three rows, one "What it means" note that
 * the rows and the wheel both update, and the call to action. The page
 * sets the section heading, and `.demo` uses display: contents so the
 * wheel and the guide sit in the page's own grid.
 */
import Wheel from '../lib/wheel/Wheel';
import { degreeInSign, formatLongitude, SIGNS, signEssence, signForLongitude, signName } from '../lib/signs';
import { signTagline } from '../lib/sign-display';
import { localizePath, t, type CatalogLocale } from '../lib/i18n';
import { aspectLabel, planetLabel } from '../lib/i18n/astrology';
import { intlLocale } from '../lib/i18n/dates';
import { DEMO_CHART_COPY } from '../lib/demo-chart-copy';
import { matchAspect } from '../lib/engine/aspects';
import { houseOf, norm } from '../lib/engine/houses';
import { natalAspectLine, planetInHouseLine } from '../lib/natal';
import { collisionNudge } from '../lib/scene/layout';
import demo from '../data/demo-chart-frida.json';

const SIZE = 430;
const PAD = SIZE * 0.05;
const FRAME = SIZE + PAD * 2;
const R_BODIES = SIZE * 0.31;
const R_ASPECTS = SIZE * 0.235;
const R_HOUSE_LABELS = (R_ASPECTS + R_BODIES) / 2 - SIZE * 0.02;
const R_HOUSE_INNER = R_ASPECTS + SIZE * 0.012;
const R_HOUSE_OUTER = SIZE * 0.395 - SIZE * 0.012;
const R_SIGNS = SIZE * ((0.475 + 0.395) / 2);
const R_SIGN_FOCUS_INNER = SIZE * 0.397;
const R_SIGN_FOCUS_OUTER = SIZE * 0.473;
type Point = { x: number; y: number };

function point(lon: number, radius: number) {
  const phi = ((180 + (lon - demo.angles.asc)) * Math.PI) / 180;
  return {
    x: ((SIZE / 2 + radius * Math.cos(phi) + PAD) / FRAME) * 100,
    y: ((SIZE / 2 - radius * Math.sin(phi) + PAD) / FRAME) * 100,
  };
}

const position = ({ x, y }: Point, sign?: string, hit?: number) =>
  `--x:${x.toFixed(3)};--y:${y.toFixed(3)}${sign ? `;--sign:${sign}` : ''}${hit ? `;--hit:${hit.toFixed(3)}` : ''}`;

const aspectHue: Record<string, string> = {
  conjunction: 'rgba(238,241,247,0.96)',
  sextile: 'rgba(169,212,196,0.96)',
  trine: 'rgba(182,212,228,0.96)',
  square: 'rgba(222,142,121,0.96)',
  opposition: 'rgba(224,169,180,0.96)',
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** 103.3755 → "13°22′", the degree within the sign. */
function degreeLabel(lon: number) {
  const deg = degreeInSign(lon);
  const d = Math.floor(deg);
  return `${d}°${String(Math.floor((deg - d) * 60)).padStart(2, '0')}′`;
}

function annularSectorPath(from: number, span: number, inner: number, outer: number) {
  const safeSpan = Math.max(0.1, Math.min(359.9, span));
  const outerA = point(from, outer);
  const outerB = point(from + safeSpan, outer);
  const innerB = point(from + safeSpan, inner);
  const innerA = point(from, inner);
  const outerRadius = (outer / FRAME) * 100;
  const innerRadius = (inner / FRAME) * 100;
  const large = safeSpan > 180 ? 1 : 0;
  return [
    `M ${outerA.x.toFixed(3)} ${outerA.y.toFixed(3)}`,
    `A ${outerRadius.toFixed(3)} ${outerRadius.toFixed(3)} 0 ${large} 0 ${outerB.x.toFixed(3)} ${outerB.y.toFixed(3)}`,
    `L ${innerB.x.toFixed(3)} ${innerB.y.toFixed(3)}`,
    `A ${innerRadius.toFixed(3)} ${innerRadius.toFixed(3)} 0 ${large} 1 ${innerA.x.toFixed(3)} ${innerA.y.toFixed(3)}`,
    'Z',
  ].join(' ');
}

/** Keep the natal register's wording, changing only its point of view. */
const aboutHer = (line: string) => line
  .replace(/\bYour\b/g, 'Her')
  .replace(/\byour\b/g, 'her')
  .replace(/\byou arrive\b/g, 'she arrives')
  .replace(/\byou point\b/g, 'she points')
  .replace(/\byou seat\b/g, 'she seats')
  .replace(/\byou remember\b/g, 'she remembers')
  .replace(/\byou\b/g, 'she');

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function collisionAwareHit(points: Point[], index: number, maximum: number) {
  const neighbours = points.filter((_, other) => other !== index);
  if (neighbours.length === 0) return maximum;
  const nearest = Math.min(...neighbours.map((other) => distance(points[index], other)));
  // Keep every target inside its nearest-neighbour gap. The labeled
  // selector beside the wheel exposes every mark as a full-size control.
  return Math.min(maximum, nearest * 0.82);
}

function naturalList(items: string[]) {
  if (items.length < 2) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function signOccupantLine(occupants: string[]) {
  if (occupants.length === 0) return 'No placement uses this style in this chart.';
  if (occupants.length === 1) return `Her ${occupants[0]} uses this style in this chart.`;
  return `Her ${naturalList(occupants)} use this style in this chart.`;
}

/** "13°22′"-style orb, as the receipt and the wheel print degrees. */
function orbLabel(orb: number) {
  const d = Math.floor(orb);
  return `${d}°${String(Math.floor((orb - d) * 60)).padStart(2, '0')}′`;
}

/**
 * English renders exactly as it always has. Another catalogue locale swaps
 * in DEMO_CHART_COPY and its own names, essences and links.
 */
export default function DemoChart({ locale = 'en' }: { locale?: CatalogLocale }) {
  const l10n = locale === 'en' ? null : DEMO_CHART_COPY[locale];
  const lower = (value: string) => value.charAt(0).toLocaleLowerCase(intlLocale(locale)) + value.slice(1);
  const list = (items: string[]) => new Intl.ListFormat(intlLocale(locale), { type: 'conjunction' }).format(items);
  const houseWord = t(locale, 'house').toLocaleLowerCase(intlLocale(locale));
  const bodies = demo.bodies.filter((b) => b.body !== 'South Node');
  const planets = bodies.filter((b) => !b.body.includes('Node'));
  const sun = demo.bodies.find((b) => b.body === 'Sun')!;
  const moon = demo.bodies.find((b) => b.body === 'Moon')!;
  const asc = demo.angles.asc;

  // Her big three. Each row selects its own mark: the Sun, the Moon, and
  // the first house, which begins at the rising degree.
  const placedTitle = (body: string, lon: number) => {
    const sign = signForLongitude(lon);
    return l10n!.placed(planetLabel(locale, body), sign, signName(sign, locale));
  };
  const bigThree = l10n ? [
    { id: 'body:Sun', title: placedTitle('Sun', sun.lon), lon: sun.lon, copy: l10n.bigThree[0] },
    { id: 'body:Moon', title: placedTitle('Moon', moon.lon), lon: moon.lon, copy: l10n.bigThree[1] },
    { id: 'house:1', title: l10n.rising(signForLongitude(asc), signName(signForLongitude(asc), locale)), lon: asc, copy: l10n.bigThree[2] },
  ] : [
    { id: 'body:Sun', title: `Sun in ${signForLongitude(sun.lon).name}`, lon: sun.lon, copy: 'Identity, purpose, and the direction she grows into.' },
    { id: 'body:Moon', title: `Moon in ${signForLongitude(moon.lon).name}`, lon: moon.lon, copy: 'Emotional needs, instinct, and what helps her feel steady.' },
    { id: 'house:1', title: `${signForLongitude(asc).name} rising`, lon: asc, copy: 'First impression, approach, and how other people meet her.' },
  ];
  /** A placement as a computed fact, then the essence of the sign it uses. */
  const placementCaption = (lon: number, house: number) => {
    const sign = signForLongitude(lon);
    return `${formatLongitude(lon, locale)}, ${houseWord} ${house}. ${signName(sign, locale)}${l10n!.colon}${lower(signEssence(sign, locale))}`;
  };
  const aspects = planets.flatMap((a, index) => planets.slice(index + 1).flatMap((b) => {
    const match = matchAspect(a.body, a.lon, b.body, b.lon);
    return match ? [{ a: a.body, b: b.body, type: match.def.type, orb: match.orb }] : [];
  })).sort((a, b) => a.orb - b.orb).slice(0, 6);
  const drawLongitude = collisionNudge(bodies);
  const markerPoints = bodies.map((body) => ({
    body,
    drawLon: drawLongitude.get(body.body) ?? body.lon,
    point: point(drawLongitude.get(body.body) ?? body.lon, R_BODIES),
  }));
  const rawPlanetTargets = markerPoints.map(({ body, drawLon, point: markerPoint }) => {
    const house = houseOf(body.lon, demo.houses.cusps);
    const sign = signForLongitude(body.lon);
    return {
      id: `body:${body.body}`,
      key: body.body,
      label: l10n ? `${planetLabel(locale, body.body)}, ${houseWord} ${house}` : `${body.body}, house ${house}`,
      kind: l10n ? l10n.kinds.planet : 'Planet',
      title: l10n ? placedTitle(body.body, body.lon) : `${body.body} in ${sign.name}`,
      caption: l10n ? placementCaption(body.lon, house) : aboutHer(planetInHouseLine(body.body, house)),
      drawLon,
      point: markerPoint,
      hue: sign.hue,
    };
  });
  const signTargets = SIGNS.map((sign, index) => {
    const occupants = bodies
      .filter((body) => signForLongitude(body.lon).slug === sign.slug)
      .map((body) => body.body);
    return {
      id: `sign:${sign.slug}`,
      key: sign.slug,
      label: l10n ? signName(sign, locale) : `${sign.name} sign`,
      kind: l10n ? l10n.kinds.sign : 'Sign',
      title: l10n ? signName(sign, locale) : sign.name,
      caption: l10n
        ? `${signEssence(sign, locale)} ${occupants.length ? l10n.occupants(list(occupants.map((body) => planetLabel(locale, body)))) : l10n.noOccupants}`
        : `${signTagline(sign)} ${signOccupantLine(occupants)}`,
      hue: sign.hue,
      point: point(index * 30 + 15, R_SIGNS),
      path: annularSectorPath(index * 30 + 1.5, 27, R_SIGN_FOCUS_INNER, R_SIGN_FOCUS_OUTER),
    };
  });
  const housePoints = demo.houses.cusps.map((cusp) => point(norm(cusp + 15), R_HOUSE_LABELS));
  const rawHouseTargets = demo.houses.cusps.map((cusp, index) => {
    const house = index + 1;
    const occupant = planets.find((body) => houseOf(body.lon, demo.houses.cusps) === house);
    const occupants = planets.filter((body) => houseOf(body.lon, demo.houses.cusps) === house);
    return {
      id: `house:${house}`,
      key: house,
      label: l10n ? `${t(locale, 'house')} ${house}` : `House ${house}`,
      kind: l10n ? l10n.kinds.house : 'Life area',
      title: l10n ? `${t(locale, 'house')} ${house}` : `House ${house}`,
      caption: l10n
        ? `${l10n.houseSign(signName(signForLongitude(cusp + 1), locale))} ${occupants.length
          ? l10n.houseOccupants(list(occupants.map((body) => planetLabel(locale, body.body))))
          : t(locale, 'emptyHouseNote')}`
        : occupant
        ? aboutHer(planetInHouseLine(occupant.body, house))
        : t('en', 'emptyHouseNote'),
      point: housePoints[index],
      path: annularSectorPath(cusp + 0.6, 28.8, R_HOUSE_INNER, R_HOUSE_OUTER),
    };
  });
  const rawAspectTargets = aspects.map((aspect, index) => {
    const a = planets.find((body) => body.body === aspect.a)!;
    const b = planets.find((body) => body.body === aspect.b)!;
    const p1 = point(a.lon, R_ASPECTS);
    const p2 = point(b.lon, R_ASPECTS);
    const along = 0.34 + (index % 3) * 0.16;
    const localTitle = l10n
      ? l10n.aspect(planetLabel(locale, aspect.a), aspect.type, aspectLabel(locale, aspect.type), planetLabel(locale, aspect.b))
      : '';
    return {
      ...aspect,
      id: `aspect:${aspect.a}-${aspect.type}-${aspect.b}`,
      label: l10n ? localTitle : `${aspect.a} ${aspect.type} ${aspect.b}`,
      kind: l10n ? l10n.kinds.aspect : 'Connection',
      title: l10n ? localTitle : `${aspect.a} ${titleCase(aspect.type)} ${aspect.b}`,
      caption: l10n
        ? `${l10n.aspectGloss[aspect.type] ?? ''} ${l10n.orb(orbLabel(aspect.orb))}`.trim()
        : aboutHer(natalAspectLine(aspect.a, aspect.type, aspect.b)),
      point: { x: p1.x + (p2.x - p1.x) * along, y: p1.y + (p2.y - p1.y) * along },
      p1,
      p2,
      hue: aspectHue[aspect.type] ?? 'rgba(238,241,247,0.9)',
    };
  });
  const interactivePoints = [...rawPlanetTargets, ...rawHouseTargets, ...rawAspectTargets]
    .map(({ point: targetPoint }) => targetPoint);
  const planetTargets = rawPlanetTargets.map((target, index) => ({
    ...target,
    hit: collisionAwareHit(interactivePoints, index, 6.4),
  }));
  const houseOffset = rawPlanetTargets.length;
  const houseTargets = rawHouseTargets.map((target, index) => ({
    ...target,
    hit: collisionAwareHit(interactivePoints, houseOffset + index, 5.8),
  }));
  const aspectOffset = houseOffset + rawHouseTargets.length;
  const aspectTargets = rawAspectTargets.map((target, index) => ({
    ...target,
    hit: collisionAwareHit(interactivePoints, aspectOffset + index, 5.4),
  }));
  const sunTarget = planetTargets.find((target) => target.key === 'Sun')!;
  const defaultCaption = sunTarget.caption;

  return (
    <div
      class="demo"
      data-demo-preview
      data-active-layer="planets"
      data-active-id={sunTarget.id}
      data-demo-motion="instant"
    >
      <div class="demo__wheel">
        {/* Outside the stage: the stage's overlays must cover the wheel alone. */}
        <span class="demo__sample-badge">{l10n ? l10n.badge : 'Sample chart · Frida Kahlo'}</span>
        <div class="demo__wheel-stage">
          <Wheel
            bodies={bodies}
            asc={asc}
            mc={demo.angles.mc}
            cusps={demo.houses?.cusps ?? null}
            aspects={aspects}
            size={SIZE}
            preview
            deferIcons
            ariaLabel={l10n?.wheel}
          />
          <svg class="demo__focus-layer" viewBox="0 0 100 100" aria-hidden="true">
            {signTargets.map((target) => (
              <path
                key={`focus-${target.id}`}
                d={target.path}
                class="demo__focus-sign"
                data-demo-highlight={target.id}
                data-demo-highlight-kind="sign"
                data-active="false"
                style={`--focus:${target.hue}`}
              />
            ))}
            {planetTargets.map((target) => (
              <g
                key={`focus-${target.id}`}
                data-demo-highlight={target.id}
                data-demo-highlight-kind="planet"
                data-active={target.id === sunTarget.id ? 'true' : 'false'}
                style={`--focus:${target.hue}`}
              >
                <circle class="demo__focus-disc" cx={target.point.x} cy={target.point.y} r="3.9" />
                <circle class="demo__focus-ring" cx={target.point.x} cy={target.point.y} r="3.25" />
              </g>
            ))}
            {houseTargets.map((target) => (
              <path
                key={`focus-${target.id}`}
                d={target.path}
                class="demo__focus-house"
                data-demo-highlight={target.id}
                data-demo-highlight-kind="house"
                data-active="false"
              />
            ))}
            {aspectTargets.map((target) => (
              <g
                key={`focus-${target.id}`}
                data-demo-highlight={target.id}
                data-demo-highlight-kind="aspect"
                data-active="false"
                style={`--focus:${target.hue}`}
              >
                <line class="demo__focus-aspect" x1={target.p1.x} y1={target.p1.y} x2={target.p2.x} y2={target.p2.y} />
                <circle class="demo__focus-node" cx={target.p1.x} cy={target.p1.y} r="1.45" />
                <circle class="demo__focus-node" cx={target.p2.x} cy={target.p2.y} r="1.45" />
              </g>
            ))}
          </svg>
          <div class="demo__targets">
            {signTargets.map((target) => (
              <button
                type="button"
                class="demo__target demo__target--sign"
                style={position(target.point, target.hue)}
                aria-label={target.label}
                aria-pressed="false"
                data-demo-target
                data-demo-id={target.id}
                data-demo-layer="signs"
                data-demo-kind={target.kind}
                data-demo-title={target.title}
                data-demo-sign={target.key}
                data-demo-copy={target.caption}
              />
            ))}
            {planetTargets.map((target) => (
              <span
                class="demo__target demo__target--planet"
                style={position(target.point, target.hue, target.hit)}
                aria-hidden="true"
                data-selected={target.id === sunTarget.id ? 'true' : 'false'}
                data-demo-target
                data-demo-id={target.id}
                data-demo-layer="planets"
                data-demo-kind={target.kind}
                data-demo-title={target.title}
                data-demo-body={target.key}
                data-demo-draw-lon={target.drawLon.toFixed(6)}
                data-demo-copy={target.caption}
              />
            ))}
            {houseTargets.map((target) => (
              <span
                class="demo__target demo__target--house"
                style={position(target.point, undefined, target.hit)}
                aria-hidden="true"
                data-selected="false"
                data-demo-target
                data-demo-id={target.id}
                data-demo-layer="houses"
                data-demo-kind={target.kind}
                data-demo-title={target.title}
                data-demo-copy={target.caption}
              />
            ))}
            {aspectTargets.map((target) => (
              <span
                class="demo__target demo__target--aspect"
                style={position(target.point, undefined, target.hit)}
                aria-hidden="true"
                data-selected="false"
                data-demo-target
                data-demo-id={target.id}
                data-demo-layer="aspects"
                data-demo-kind={target.kind}
                data-demo-title={target.title}
                data-demo-copy={target.caption}
              />
            ))}
          </div>
        </div>
        <div class="demo__explore">
          <p class="demo__preview-hint">{l10n ? l10n.hint : 'Select a mark on the wheel, or choose any part of the chart here.'}</p>
          <label class="demo__selector">
            <span>{l10n ? l10n.explore : 'Explore the chart'}</span>
            <select aria-label={l10n ? l10n.explore : 'Explore the chart'} data-demo-select defaultValue={sunTarget.id}>
              <optgroup label={l10n ? l10n.groups[0] : 'Planets'}>
                {planetTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
              </optgroup>
              <optgroup label={l10n ? l10n.groups[1] : 'Signs'}>
                {signTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
              </optgroup>
              <optgroup label={l10n ? l10n.groups[2] : 'Life areas'}>
                {houseTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
              </optgroup>
              <optgroup label={l10n ? l10n.groups[3] : 'Connections'}>
                {aspectTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
              </optgroup>
            </select>
          </label>
        </div>
      </div>

      <div class="demo__guide">
        <div class="demo__jumps" role="group" aria-label={l10n ? l10n.bigThreeLabel : 'Frida Kahlo’s big three'}>
          {bigThree.map((row, index) => {
            const s = signForLongitude(row.lon);
            return (
              <button
                type="button"
                class="demo__jump"
                style={`--sign:${s.hue}`}
                aria-pressed={index === 0 ? 'true' : 'false'}
                data-demo-jump={row.id}
                key={row.id}
              >
                <img class="demo__jump-disc" data-src={`/assets/zodiac-icons/128/${s.slug}.webp`} width="44" height="44" alt="" decoding="async" />
                <span class="demo__jump-text">
                  <strong>{row.title}</strong>
                  <span class="demo__jump-copy">{row.copy}</span>
                </span>
                <span class="demo__jump-degree">{degreeLabel(row.lon)}</span>
              </button>
            );
          })}
        </div>

        <article class="demo__insight" aria-live="polite" aria-atomic="true">
          <p class="demo__insight-head">
            <span class="kicker">{l10n ? l10n.meaning : 'What it means'}</span>
            <span class="demo__insight-kind" data-demo-kind-output>{sunTarget.kind}</span>
          </p>
          <h3 data-demo-title-output>{sunTarget.title}</h3>
          <p data-demo-caption>{defaultCaption}</p>
        </article>

        <div class="demo__actions">
          <a class="btn btn--primary demo__cta" href={l10n ? localizePath(locale, '/birth-chart/') : '/birth-chart/'}>
            <span>{l10n ? l10n.cta : 'See my birth chart'}</span><span class="orb">↗</span>
          </a>
          <a class="textlink" href={l10n ? localizePath(locale, '/methodology/') : '/methodology/'} data-check-our-math>{t(locale, 'trustMath')} <span class="arr" aria-hidden="true">→</span></a>
        </div>

        {l10n ? (
          <p class="demo__receipt">
            {l10n.birth} · {l10n.instant(demo.utc.replace('T', ' ').slice(0, 19))} ·{' '}
            <a href="https://www.astro.com/astro-databank/Kahlo%2C_Frida" target="_blank" rel="noopener noreferrer">
              {l10n.source}
            </a>
          </p>
        ) : (
          <p class="demo__receipt">
            {demo.birth} · computed as {demo.utc.replace('T', ' ').slice(0, 19)} UTC ·{' '}
            <a href="https://www.astro.com/astro-databank/Kahlo%2C_Frida" target="_blank" rel="noopener noreferrer">
              published time source
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
