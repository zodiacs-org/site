/**
 * The capability demo: a real, precomputed chart (Frida Kahlo, public
 * birth data, Rodden AA) with build-time captions. The component is
 * server-rendered; its tiny classic script only toggles existing DOM.
 */
import Wheel from '../lib/wheel/Wheel';
import { formatLongitude, SIGNS, signForLongitude } from '../lib/signs';
import { t } from '../lib/i18n';
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

export default function DemoChart() {
  const bodies = demo.bodies.filter((b) => b.body !== 'South Node');
  const planets = bodies.filter((b) => !b.body.includes('Node'));
  const sun = demo.bodies.find((b) => b.body === 'Sun')!;
  const moon = demo.bodies.find((b) => b.body === 'Moon')!;
  const asc = demo.angles.asc;

  const callouts = [
    { label: 'Sun', lon: sun.lon, copy: 'Identity, purpose, and the direction she grows into.' },
    { label: 'Moon', lon: moon.lon, copy: 'Emotional needs, instinct, and what helps her feel steady.' },
    { label: 'Rising', lon: asc, copy: 'First impression, approach, and how other people meet her.' },
  ];
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
      label: `${body.body}, house ${house}`,
      kind: 'Planet',
      title: `${body.body} in ${sign.name}`,
      caption: aboutHer(planetInHouseLine(body.body, house)),
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
      label: `${sign.name} sign`,
      kind: 'Sign',
      title: sign.name,
      caption: `${sign.essence} ${signOccupantLine(occupants)}`,
      hue: sign.hue,
      point: point(index * 30 + 15, R_SIGNS),
      path: annularSectorPath(index * 30 + 1.5, 27, R_SIGN_FOCUS_INNER, R_SIGN_FOCUS_OUTER),
    };
  });
  const housePoints = demo.houses.cusps.map((cusp) => point(norm(cusp + 15), R_HOUSE_LABELS));
  const rawHouseTargets = demo.houses.cusps.map((cusp, index) => {
    const house = index + 1;
    const occupant = planets.find((body) => houseOf(body.lon, demo.houses.cusps) === house);
    return {
      id: `house:${house}`,
      key: house,
      label: `House ${house}`,
      kind: 'Life area',
      title: `House ${house}`,
      caption: occupant
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
    return {
      ...aspect,
      id: `aspect:${aspect.a}-${aspect.type}-${aspect.b}`,
      label: `${aspect.a} ${aspect.type} ${aspect.b}`,
      kind: 'Connection',
      title: `${aspect.a} ${titleCase(aspect.type)} ${aspect.b}`,
      caption: aboutHer(natalAspectLine(aspect.a, aspect.type, aspect.b)),
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
  const sunHouse = houseOf(sun.lon, demo.houses.cusps);
  const housePreview = houseTargets[sunHouse - 1];
  const aspectPreview = aspectTargets[0];
  const previewSteps = [
    { id: sunTarget.id, kind: sunTarget.kind, label: 'Her Sun', title: sunTarget.title },
    { id: housePreview.id, kind: housePreview.kind, label: `House ${sunHouse}`, title: housePreview.title },
    ...(aspectPreview ? [{
      id: aspectPreview.id,
      kind: aspectPreview.kind,
      label: 'Tight aspect',
      title: aspectPreview.title,
    }] : []),
  ];
  const defaultCaption = sunTarget.caption;

  return (
    <div
      class="demo"
      data-demo-preview
      data-active-layer="planets"
      data-active-id={sunTarget.id}
      data-demo-motion="instant"
    >
        <div class="demo__jumps" role="group" aria-label="Preview chart features">
          {previewSteps.map((step, index) => (
            <button
              type="button"
              class="demo__jump"
              aria-pressed={index === 0 ? 'true' : 'false'}
              data-demo-jump={step.id}
              key={step.id}
            >
              <span class="mono--label">{step.kind}</span>
              <strong>{step.label}</strong>
            </button>
          ))}
        </div>

      <div class="demo__wheel shell">
        <div class="core demo__wheel-core">
          <div class="demo__wheel-stage">
            <span class="demo__sample-badge mono">Sample chart · Frida Kahlo</span>
            <Wheel
              bodies={bodies}
              asc={asc}
              mc={demo.angles.mc}
              cusps={demo.houses?.cusps ?? null}
              aspects={aspects}
              size={SIZE}
              preview
              deferIcons
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
          <p class="demo__preview-hint mono">Select a mark on the wheel—or choose a starting point.</p>
          <p class="demo__receipt mono">
            {demo.name} · {demo.birth} · computed as {demo.utc.replace('T', ' ').slice(0, 19)} UTC ·{' '}
            <a href="https://www.astro.com/astro-databank/Kahlo%2C_Frida" target="_blank" rel="noopener noreferrer">
              published time source
            </a>
          </p>
        </div>
      </div>

      <div class="demo__guide">
        <div class="demo__guide-head">
          <em class="kicker">Try the preview</em>
          <h3>Three ways into a chart</h3>
          <p>Choose a starting point below, or select any symbol on the wheel.</p>
        </div>

        <label class="demo__selector">
          Explore the chart
          <select aria-label="Explore the chart" data-demo-select defaultValue={sunTarget.id}>
            <optgroup label="Planets">
              {planetTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
            </optgroup>
            <optgroup label="Signs">
              {signTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
            </optgroup>
            <optgroup label="Life areas">
              {houseTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
            </optgroup>
            <optgroup label="Connections">
              {aspectTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
            </optgroup>
          </select>
        </label>

        <article class="demo__insight" aria-live="polite" aria-atomic="true">
          <span class="mono--label" data-demo-kind-output>{sunTarget.kind}</span>
          <h3 data-demo-title-output>{sunTarget.title}</h3>
          <p data-demo-caption>{defaultCaption}</p>
          <a class="btn btn--primary demo__cta" href="/birth-chart/">
            <span>See my birth chart</span><span class="orb">↗</span>
          </a>
        </article>

        <div class="demo__big-three" aria-label="Frida Kahlo's big three">
          {callouts.map((c) => {
            const s = signForLongitude(c.lon);
            return (
              <div class="demo__callout" style={`--sign:${s.hue}`} key={c.label}>
                <span class="mono--label">{c.label} · {formatLongitude(c.lon)}</span>
                <strong>{s.name}</strong>
                <p>{c.copy}</p>
              </div>
            );
          })}
        </div>

        <p class="demo__cta-line">
          A real chart, calculated from the 1907 sky. <strong>Your preview takes about twenty seconds.</strong>
        </p>
      </div>
    </div>
  );
}
