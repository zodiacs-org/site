/**
 * The birth chart page's anatomy wheel: its four numbered marks and its story
 * (docs/MOTION.md, "Stories"). The page (src/pages/birth-chart/index.astro)
 * renders the shared Wheel with SAMPLE_WHEEL at WHEEL_SIZE and lays these
 * over it; the pure parts live here so birth-chart-anatomy-story.test.ts can
 * hold them to the wheel Wheel actually draws.
 */
import { SAMPLE_PLACEMENTS, SAMPLE_WHEEL } from './sample-chart';

const sun = SAMPLE_PLACEMENTS.find((p) => p.body === 'Sun')!;
const moon = SAMPLE_PLACEMENTS.find((p) => p.body === 'Moon')!;

/* The four numbered parts of the anatomy wheel, placed with the Wheel's own
   geometry: its viewBox pads the drawing by 5% on every side, and longitude
   runs counterclockwise from the rising degree at nine o'clock. */
export const WHEEL_SIZE = 430;
export const PAD = WHEEL_SIZE * 0.05;
export const FRAME = WHEEL_SIZE + PAD * 2;
export const at = (lon: number, radius: number) => {
  const phi = ((180 + (lon - SAMPLE_WHEEL.asc)) * Math.PI) / 180;
  return {
    x: ((WHEEL_SIZE / 2 + radius * WHEEL_SIZE * Math.cos(phi) + PAD) / FRAME) * 100,
    y: ((WHEEL_SIZE / 2 - radius * WHEEL_SIZE * Math.sin(phi) + PAD) / FRAME) * 100,
  };
};
const boundaryNear = (lon: number) => Math.round(lon / 30) * 30;
export const anatomyMarks = [
  { n: 1, ...at(boundaryNear(SAMPLE_WHEEL.asc - 125), 0.435) },
  { n: 2, ...at(boundaryNear(SAMPLE_WHEEL.asc + 185), 0.255) },
  { n: 3, ...at(moon.lon + 9, 0.31) },
  { n: 4, ...at(sun.lon, 0.02) },
];

/* The anatomy wheel's story (docs/MOTION.md), played once by the shared
   entrance runtime when the wheel's middle comes into view, then still. It
   follows the four numbered notes:
     1. the signs: the ring draws round from the rising degree in zodiac order
        (counter-clockwise), each sign arriving as the ring passes its middle;
     2. the houses: each cusp draws out from the hub, from the first house on;
     3. the planets: each one at its place, in zodiac order from the rising;
     4. the aspects: each chord draws from one planet to the other, once both
        are there. The last chord is the closing beat.
   Each numbered mark arrives with the part it labels. The markup is the
   finished picture: the wheel is the shared Wheel, untouched, and the story
   reaches its parts only through the structure Wheel already draws (its ring
   circles, its twelve sign groups and boundary lines, its twelve house groups,
   its ASC and MC labels, its aspect lines and .wheel__body groups, in that
   order). Wheel's frame is mirrored here (as in src/lib/horoscope-wheel.ts)
   to time and measure them, and birth-chart-anatomy-story.test.ts reads that
   structure and frame back from the rendered wheel. The styles travel in the
   body, just before the wheel, so the page's head and the SVG's sitemap
   fingerprint stay as they were. Every transition ends by STORY_END, inside
   the runtime's 2.6 s. */
export const STORY = { ring: 900, houses: 800, houseStep: 35, planets: 1150, planetStep: 45, aspects: 1700, aspectStep: 50 };
export const STORY_END = 2480;
export const R_SIGNS = WHEEL_SIZE * 0.475;
export const R_SIGNS_IN = WHEEL_SIZE * 0.395;
export const R_ASPECTS = WHEEL_SIZE * 0.235;
const fromAsc = (lon: number) => (((lon - SAMPLE_WHEEL.asc) % 360) + 360) % 360;
export const ringAt = (lon: number) => Math.round((fromAsc(lon) / 360) * STORY.ring);
export const houseOf = (lon: number) => Math.floor((((lon - SAMPLE_WHEEL.cusps[0]) % 360) + 360) % 360 / 30);
export const houseAt = (house: number) => STORY.houses + house * STORY.houseStep;
export const bodyOrder: string[] = [...SAMPLE_WHEEL.bodies].sort((a, b) => fromAsc(a.lon) - fromAsc(b.lon)).map((body) => body.body);
export const bodyAt = (body: string) => STORY.planets + bodyOrder.indexOf(body) * STORY.planetStep;
const lonOf = (body: string) => SAMPLE_WHEEL.bodies.find((x) => x.body === body)?.lon;
export const chords = SAMPLE_WHEEL.aspects.filter((aspect) => lonOf(aspect.a) !== undefined && lonOf(aspect.b) !== undefined).map((aspect, j) => {
  const span = Math.abs(lonOf(aspect.a)! - lonOf(aspect.b)!) % 360;
  const length = 2 * R_ASPECTS * Math.sin(((Math.min(span, 360 - span) / 2) * Math.PI) / 180);
  const t = Math.max(STORY.aspects + j * STORY.aspectStep, Math.max(bodyAt(aspect.a), bodyAt(aspect.b)) + 200);
  return { length: (length + 1).toFixed(1), t: Math.min(t, STORY_END - 380) };
});
export const circle = (r: number) => (2 * Math.PI * r + 1).toFixed(1);
export const ARC = ((R_SIGNS - 1) * (27 * Math.PI) / 180 + 1).toFixed(1);
export const CUSP = (R_SIGNS_IN - R_ASPECTS + 1).toFixed(1);
/* Each numbered mark with its part: 1 as the ring passes it, 2 with its
   house, 3 with the Moon it sits beside, 4 with the first chord. */
export const markAt = [
  ringAt(boundaryNear(SAMPLE_WHEEL.asc - 125)),
  houseAt(houseOf(boundaryNear(SAMPLE_WHEEL.asc + 185))),
  bodyAt('Moon'),
  chords[0]?.t ?? STORY.aspects,
];
const W = `html[data-entrance='on'] .bca-go`;
const waiting = `${W}:not(.is-in)~`;
const playing = `${W}.is-in:not(.is-done)~`;
const going = `${W}:not(.is-done)~`;
export const storyStyles = `
.bca-go{position:absolute;left:0;top:50%;width:100%;height:1px;pointer-events:none}
@media screen and (prefers-reduced-motion:no-preference){
${Array.from({ length: 12 }, (_, i) => `.bca-go~svg>g:nth-of-type(${i + 1}){--t:${Math.max(0, ringAt(i * 30 + 15) - 40)}ms}.bca-go~svg>line:nth-of-type(${i + 1}){--t:${ringAt(i * 30)}ms}.bca-go~svg>g:nth-of-type(${i + 13}){--t:${houseAt(i)}ms}`).join('\n')}
${SAMPLE_WHEEL.bodies.map((body, i) => `.bca-go~svg>g:nth-of-type(${i + 25}){--t:${bodyAt(body.body)}ms}`).join('')}
${chords.map((chord, j) => `.bca-go~svg>line:nth-of-type(${j + 13}){--t:${chord.t}ms;--l:${chord.length}}`).join('')}
.bca-go~svg>text:nth-of-type(1){--t:${houseAt(0)}ms}.bca-go~svg>text:nth-of-type(2){--t:${houseAt(houseOf(SAMPLE_WHEEL.mc ?? SAMPLE_WHEEL.asc))}ms}
${markAt.map((t, i) => `.bca-go~.bc-anat__mark:nth-of-type(${i + 2}){--t:${t}ms}`).join('')}
${going}svg>circle:nth-of-type(1){stroke-dasharray:${circle(R_SIGNS)} ${circle(R_SIGNS)}}
${going}svg>circle:nth-of-type(2){stroke-dasharray:${circle(R_SIGNS_IN)} ${circle(R_SIGNS_IN)}}
${going}svg>circle:nth-of-type(-n+2){transform:scaleX(-1);transform-box:fill-box;transform-origin:center}
${going}svg>g:nth-of-type(-n+12)>path:nth-of-type(2){stroke-dasharray:${ARC} ${ARC}}
${going}svg>g:nth-of-type(n+13)>line{stroke-dasharray:${CUSP} ${CUSP}}
${going}svg>line:nth-of-type(n+13){stroke-dasharray:var(--l) var(--l)}
${going}svg>.wheel__body>circle{transform-box:fill-box;transform-origin:center}
${waiting}svg>circle:nth-of-type(1){stroke-dashoffset:${circle(R_SIGNS)}}
${waiting}svg>circle:nth-of-type(2){stroke-dashoffset:${circle(R_SIGNS_IN)}}
${waiting}svg>circle:nth-of-type(3),${waiting}svg>g:nth-of-type(-n+12),${waiting}svg>line:nth-of-type(-n+12),${waiting}svg>g:nth-of-type(n+13)>text,${waiting}svg>text,${waiting}svg>.wheel__body{opacity:0}
${waiting}svg>g:nth-of-type(-n+12)>path:nth-of-type(2){stroke-dashoffset:${ARC}}
${waiting}svg>g:nth-of-type(n+13)>line{stroke-dashoffset:${CUSP}}
${waiting}svg>line:nth-of-type(n+13){stroke-dashoffset:var(--l)}
${waiting}svg>.wheel__body>circle{transform:scale(.6)}
${waiting}.bc-anat__mark{opacity:0;transform:scale(.6)}
${playing}svg>circle:nth-of-type(-n+2){transition:stroke-dashoffset ${STORY.ring}ms linear}
${playing}svg>circle:nth-of-type(3){transition:opacity 300ms ease ${STORY.houses}ms}
${playing}svg>g:nth-of-type(-n+12){transition:opacity 280ms ease var(--t)}
${playing}svg>g:nth-of-type(-n+12)>path:nth-of-type(2){transition:stroke-dashoffset 280ms ease-out var(--t)}
${playing}svg>line:nth-of-type(-n+12),${playing}svg>g:nth-of-type(n+13)>text,${playing}svg>text{transition:opacity 260ms ease var(--t)}
${playing}svg>g:nth-of-type(n+13)>line{transition:stroke-dashoffset 260ms ease-out var(--t)}
${playing}svg>.wheel__body{transition:opacity 340ms var(--motion-ease) var(--t)}
${playing}svg>.wheel__body>circle{transition:transform 340ms var(--motion-ease) var(--t)}
${playing}svg>line:nth-of-type(n+13){transition:stroke-dashoffset 380ms cubic-bezier(.45,0,.55,1) var(--t)}
${playing}.bc-anat__mark{transition:opacity 380ms var(--motion-ease) var(--t),transform 380ms var(--motion-ease) var(--t)}
}`;
