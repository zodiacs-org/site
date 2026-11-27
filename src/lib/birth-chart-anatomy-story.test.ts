import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import Wheel from './wheel/Wheel';
import { SAMPLE_WHEEL } from './sample-chart';
import {
  ARC,
  CUSP,
  FRAME,
  PAD,
  R_ASPECTS,
  R_SIGNS,
  R_SIGNS_IN,
  STORY,
  STORY_END,
  WHEEL_SIZE,
  anatomyMarks,
  at,
  bodyAt,
  bodyOrder,
  chords,
  circle,
  houseAt,
  markAt,
  ringAt,
  storyStyles,
} from './birth-chart-anatomy-story';

// The birth chart page's anatomy story (src/pages/birth-chart/index.astro)
// reaches the shared Wheel's parts only by position: `svg>g:nth-of-type(n)`,
// `svg>line:nth-of-type(n)`, `svg>circle:nth-of-type(n)`, `svg>text` and
// `.wheel__body`, and it mirrors Wheel's frame to time and measure them.
// Wheel.tsx is built into a hash-pinned bundle and is not edited for the
// story, so this test renders the same static wheel the page renders and
// reads that structure and frame back from it. If Wheel's markup moves, the
// story's selectors would silently reach the wrong parts; this fails first.

type Node = { tag: string; attrs: Record<string, string>; children: Node[]; text: string };

/** A small XML reader for preact-render-to-string's SVG output. */
function parse(markup: string): Node {
  const root: Node = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const tag = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/gu;
  for (const match of markup.matchAll(tag)) {
    const [, close, name, rawAttrs, selfClose, text] = match;
    const top = stack[stack.length - 1];
    if (text !== undefined) { top.text += text; continue; }
    if (close) {
      expect(top.tag, 'balanced markup').toBe(name);
      stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const [, key, value] of (rawAttrs ?? '').matchAll(/([\w:-]+)(?:="([^"]*)")?/gu)) attrs[key] = value ?? '';
    const node: Node = { tag: name, attrs, children: [], text: '' };
    top.children.push(node);
    if (!selfClose) stack.push(node);
  }
  expect(stack).toHaveLength(1);
  return root;
}

const num = (node: Node, key: string) => Number(node.attrs[key]);
const ofType = (nodes: Node[], tag: string) => nodes.filter((node) => node.tag === tag);
const lineLength = (line: Node) => Math.hypot(num(line, 'x2') - num(line, 'x1'), num(line, 'y2') - num(line, 'y1'));
/** The highest n the story's CSS addresses as `svg>{tag}:nth-of-type(n)`. */
const highestNth = (tag: string) => Math.max(...[...storyStyles.matchAll(new RegExp(`svg>${tag}:nth-of-type\\((\\d+)\\)`, 'gu'))].map((m) => Number(m[1])));

const svg = parse(render(h(Wheel, { ...SAMPLE_WHEEL, size: WHEEL_SIZE, deferIcons: true, ariaLabel: 'Sample birth chart wheel, with its four parts numbered' }))).children[0];
const kids = svg.children;
const aspectLines = SAMPLE_WHEEL.aspects.filter((a) => SAMPLE_WHEEL.bodies.some((b) => b.body === a.a) && SAMPLE_WHEEL.bodies.some((b) => b.body === a.b));
const cx = WHEEL_SIZE / 2;
const cy = WHEEL_SIZE / 2;

describe('birth chart anatomy story', () => {
  it('renders the same wheel the page renders', () => {
    const page = readFileSync(new URL('../pages/birth-chart/index.astro', import.meta.url), 'utf8');
    const block = page.slice(page.indexOf('<div class="bc-anat__wheel'), page.indexOf('<div class="bc-pos-head">'));
    // In this order: the story's styles, its one mark, the wheel with these
    // props, then the numbered marks (spans 2 to 5 of the block, after the mark).
    const order = [
      '<style is:inline set:html={storyStyles}></style>',
      '<span class="bca-go" data-enter="draw" aria-hidden="true"></span>',
      '<Wheel {...SAMPLE_WHEEL} size={WHEEL_SIZE} deferIcons ariaLabel="Sample birth chart wheel, with its four parts numbered" />',
      '{anatomyMarks.map((mark) => (',
      '<span class="bc-anat__mark"',
    ].map((piece) => block.indexOf(piece));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(block.match(/<span/gu)).toHaveLength(2);
    expect(anatomyMarks).toHaveLength(4);
    expect(markAt).toHaveLength(4);
    expect(highestNth('g') > 0 && storyStyles.includes('.bc-anat__mark:nth-of-type(5)')).toBe(true);
    expect(storyStyles).not.toContain('.bc-anat__mark:nth-of-type(6)');
  });

  it('keeps the child order and counts the story addresses by position', () => {
    expect(svg.tag).toBe('svg');
    const bodies = SAMPLE_WHEEL.bodies.length;
    const expected = [
      ...Array(3).fill('circle'),
      ...Array(12).fill('g'), // the sign groups
      ...Array(12).fill('line'), // the sign boundaries
      ...Array(12).fill('g'), // the house groups
      'text', 'text', // ASC, MC
      ...Array(aspectLines.length).fill('line'),
      ...Array(bodies).fill('g'), // .wheel__body
    ];
    expect(kids.map((k) => k.tag)).toEqual(expected);
    expect(ofType(kids, 'text').map((t) => t.text)).toEqual(['ASC', 'MC']);

    const groups = ofType(kids, 'g');
    // Sign groups: no class, a band path, the outer arc path, the disc image.
    groups.slice(0, 12).forEach((g) => {
      expect(g.attrs.class).toBeUndefined();
      expect(g.children.map((c) => c.tag)).toEqual(['path', 'path', 'image']);
      expect(g.children[2].attrs['data-href']).toMatch(/^\/assets\/zodiac-icons\/128\/[a-z]+\.webp$/u);
    });
    // House groups: one cusp line and one number.
    groups.slice(12, 24).forEach((g, i) => {
      expect(g.attrs.class).toBeUndefined();
      expect(g.children.map((c) => c.tag)).toEqual(['line', 'text']);
      expect(g.children[1].text).toBe(String(i + 1));
    });
    // Planet groups, from g 25 on, in SAMPLE_WHEEL.bodies order, each with
    // its marker circle as a direct child.
    groups.slice(24).forEach((g, i) => {
      expect(g.attrs.class).toBe('wheel__body');
      expect(ofType(g.children, 'circle')).toHaveLength(1);
      // The first child is the body's tick on the inner ring, at its own
      // longitude: this is SAMPLE_WHEEL.bodies[i], the body the CSS times.
      const tick = g.children[0];
      expect(tick.tag).toBe('line');
      const p = at(SAMPLE_WHEEL.bodies[i].lon, 0.395);
      expect(((num(tick, 'x1') + PAD) / FRAME) * 100, SAMPLE_WHEEL.bodies[i].body).toBeCloseTo(p.x, 6);
      expect(((num(tick, 'y1') + PAD) / FRAME) * 100, SAMPLE_WHEEL.bodies[i].body).toBeCloseTo(p.y, 6);
    });
    expect(groups.slice(24)).toHaveLength(bodies);
    expect(kids.filter((k) => k.attrs.class === 'wheel__body')).toHaveLength(bodies);
  });

  it('times exactly the aspect lines and planets the wheel draws', () => {
    expect(chords).toHaveLength(aspectLines.length);
    expect(highestNth('line')).toBe(12 + aspectLines.length);
    expect(highestNth('g')).toBe(24 + SAMPLE_WHEEL.bodies.length);
    expect(storyStyles).toContain('svg>circle:nth-of-type(3)');
    expect(highestNth('circle')).toBe(3);
    expect([...bodyOrder].sort()).toEqual(SAMPLE_WHEEL.bodies.map((b) => b.body).sort());
  });

  it('mirrors the frame Wheel draws', () => {
    expect(svg.attrs.viewBox).toBe(`${-PAD} ${-PAD} ${FRAME} ${FRAME}`);
    const [outer, inner, hub] = ofType(kids, 'circle');
    for (const ring of [outer, inner, hub]) {
      expect(num(ring, 'cx')).toBe(cx);
      expect(num(ring, 'cy')).toBe(cy);
    }
    expect(num(outer, 'r')).toBeCloseTo(R_SIGNS, 9);
    expect(num(inner, 'r')).toBeCloseTo(R_SIGNS_IN, 9);
    expect(num(hub, 'r')).toBeCloseTo(R_ASPECTS, 9);
    // The ring circles' dash covers each whole circumference.
    expect(Number(circle(num(outer, 'r')))).toBeGreaterThan(2 * Math.PI * num(outer, 'r'));
    expect(storyStyles).toContain(`stroke-dasharray:${circle(num(outer, 'r'))} ${circle(num(outer, 'r'))}`);
    expect(storyStyles).toContain(`stroke-dasharray:${circle(num(inner, 'r'))} ${circle(num(inner, 'r'))}`);

    // Each sign group's second path is the outer arc: 2px wide, on radius
    // R_SIGNS - 1, 27 degrees long, which is what ARC measures.
    ofType(kids, 'g').slice(0, 12).forEach((g) => {
      const [band, arc] = g.children;
      expect(num(band, 'stroke-width')).toBeGreaterThan(2);
      expect(arc.attrs['stroke-width']).toBe('2');
      const [x1, y1, r, , , , , x2, y2] = arc.attrs.d.replace(/[MA]/gu, ' ').trim().split(/\s+/u).map(Number);
      expect(r).toBeCloseTo(R_SIGNS - 1, 9);
      const swept = 2 * Math.asin(Math.hypot(x2 - x1, y2 - y1) / (2 * r));
      expect(swept * r + 1).toBeCloseTo(Number(ARC), 1);
    });

    // The boundaries start each sign where `at` and `ringAt` put it.
    ofType(kids, 'line').slice(0, 12).forEach((line, i) => {
      const p = at(i * 30, 0.475);
      expect(((num(line, 'x2') + PAD) / FRAME) * 100).toBeCloseTo(p.x, 6);
      expect(((num(line, 'y2') + PAD) / FRAME) * 100).toBeCloseTo(p.y, 6);
      expect(Math.hypot(num(line, 'x1') - cx, num(line, 'y1') - cy)).toBeCloseTo(R_SIGNS_IN, 6);
    });
    // The ASC label sits at nine o'clock, where the ring starts.
    expect(num(ofType(kids, 'text')[0], 'y')).toBeCloseTo(cy, 6);
    expect(ringAt(SAMPLE_WHEEL.asc)).toBe(0);

    // Each house cusp runs from the hub to the inner ring: CUSP long.
    ofType(kids, 'g').slice(12, 24).forEach((g) => {
      expect(lineLength(g.children[0]) + 1).toBeCloseTo(Number(CUSP), 1);
    });

    // Each chord's dash is the rendered chord's own length.
    ofType(kids, 'line').slice(12).forEach((line, j) => {
      expect(lineLength(line) + 1).toBeCloseTo(Number(chords[j].length), 1);
    });
  });

  it('plays every piece inside the runtime, the last chord closing', () => {
    expect(Math.max(...Array.from({ length: 12 }, (_, i) => ringAt(i * 30 + 15)))).toBeLessThanOrEqual(STORY.ring);
    expect(Math.max(...Array.from({ length: 12 }, (_, i) => houseAt(i))) + 260).toBeLessThanOrEqual(STORY_END);
    expect(Math.max(...SAMPLE_WHEEL.bodies.map((b) => bodyAt(b.body))) + 340).toBeLessThanOrEqual(STORY_END);
    expect(Math.max(...markAt) + 380).toBeLessThanOrEqual(STORY_END);
    expect(Math.max(...chords.map((c) => c.t)) + 380).toBeLessThanOrEqual(STORY_END);
    expect(STORY_END).toBeLessThanOrEqual(2500);
    // A chord starts only once both of its planets have arrived.
    aspectLines.forEach((aspect, j) => {
      expect(chords[j].t).toBeGreaterThanOrEqual(Math.min(Math.max(bodyAt(aspect.a), bodyAt(aspect.b)) + 200, STORY_END - 380));
    });
  });
});
