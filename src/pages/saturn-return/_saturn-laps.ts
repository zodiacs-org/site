/**
 * The Saturn return page's figures and the story plate drawn from them
 * (_SaturnLapsPlate.astro): a life as a line from birth, with one arc above
 * it for each of Saturn's laps of the zodiac, and a return where each lap
 * ends. The page prints these numbers in its own words (the hero, "What the
 * return actually is" and the first question), so the page and the picture
 * read them from here and never retype them.
 *
 * It lives beside the page, not in src/components or src/lib, so the page's
 * story leaves the Phase 1 screenshot receipt
 * (tests/visual/phase1-evidence-contract.mjs) as it is. The leading
 * underscore keeps Astro from building it as a route.
 *
 * A general illustration: it takes no birth data and marks no one's age.
 */

/** Saturn's lap of the zodiac, in years, as the page states it. */
export const SATURN_LAP_YEARS = 29.4;

/** The returns the page names, by the whole year of age each falls in: 29, 58 and 88. */
export const SATURN_RETURN_AGES: readonly number[] = [1, 2, 3].map((lap) => Math.floor(lap * SATURN_LAP_YEARS));

/** One drawing of the plate, in viewBox units (about CSS pixels at the widths it is shown). */
export interface LapsLayout {
  w: number;
  h: number;
  /** Where birth and the last return sit on the line. */
  x0: number;
  x1: number;
  axisY: number;
  /** The arcs' height above the line. */
  ry: number;
  /** The ages (mono) and the words under them (sans). */
  ageY: number;
  wordY: number;
  ageFont: number;
  wordFont: number;
  /** The lap's length, inside the first arc. */
  lapFont: number;
  dot: number;
  /** The closing ring round the first return. */
  ring: number;
}

export const WIDE: LapsLayout = {
  w: 640, h: 156, x0: 30, x1: 586, axisY: 92, ry: 80,
  ageY: 122, wordY: 143, ageFont: 15, wordFont: 13, lapFont: 13, dot: 4.6, ring: 10.5,
};

export const NARROW: LapsLayout = {
  w: 340, h: 116, x0: 20, x1: 298, axisY: 64, ry: 56,
  ageY: 88, wordY: 106, ageFont: 14, wordFont: 11.5, lapFont: 11.5, dot: 4.2, ring: 9.5,
};

/** The story's clock (docs/MOTION.md, Stories): the line takes LAP_MS per lap at one speed in time. */
export const STORY = {
  /** One lap of the line. Each lap is the same number of years, so each takes the same time. */
  lap: 600,
  /** The closing beat after the line: the ring round the first return. */
  ringAfter: 120,
  ringDur: 480,
  /** The longest transition on any arriving piece (the return discs). */
  piece: 440,
  /** Everything is still by this moment; the entrance runtime settles at 2600 ms. */
  end: 2500,
} as const;

export interface LapsPlot {
  layout: LapsLayout;
  /** The life line, from birth to the right edge. */
  axis: string;
  /** One arc per lap, left to right, each with the moment it starts drawing. */
  arcs: { d: string; t: number }[];
  birth: { x: number; y: number };
  returns: { x: number; y: number; age: number; t: number }[];
  /** The lap's length, inside the first arc, and the moment the line reaches the arc's top. */
  lap: { x: number; y: number; t: number };
  ring: { x: number; y: number; r: number; t: number; dur: number };
}

const r1 = (value: number) => Math.round(value * 10) / 10;

/** The plate's geometry and timing for one drawing. */
export function lapsPlot(layout: LapsLayout, laps = SATURN_RETURN_AGES.length): LapsPlot {
  const years = laps * SATURN_LAP_YEARS;
  const x = (age: number) => layout.x0 + (age / years) * (layout.x1 - layout.x0);
  const rx = (x(SATURN_LAP_YEARS) - x(0)) / 2;
  const arcs = Array.from({ length: laps }, (_, i) => {
    const a = x(i * SATURN_LAP_YEARS);
    const b = x((i + 1) * SATURN_LAP_YEARS);
    return {
      d: `M${r1(a)} ${layout.axisY}A${r1(rx)} ${layout.ry} 0 0 1 ${r1(b)} ${layout.axisY}`,
      t: i * STORY.lap,
    };
  });
  const returns = Array.from({ length: laps }, (_, i) => ({
    x: r1(x((i + 1) * SATURN_LAP_YEARS)),
    y: layout.axisY,
    age: SATURN_RETURN_AGES[i],
    // The line reaches the return as its lap ends.
    t: (i + 1) * STORY.lap,
  }));
  const line = laps * STORY.lap;
  const first = returns[0];
  return {
    layout,
    axis: `M${r1(x(0))} ${layout.axisY}H${layout.w - 2}`,
    arcs,
    birth: { x: r1(x(0)), y: layout.axisY },
    returns,
    // Inside the first arc, low enough that the arc is wider than the words.
    lap: { x: r1(x(SATURN_LAP_YEARS / 2)), y: r1(layout.axisY - layout.ry * 0.36), t: STORY.lap / 2 },
    ring: { x: first.x, y: first.y, r: layout.ring, t: line + STORY.ringAfter, dur: STORY.ringDur },
  };
}

/** The words a plate prints, given by the page so a translated page can pass its own. */
export interface LapsWords {
  /** The lap's length, e.g. "29.4 years". */
  lap: string;
  birth: string;
  /** One per return, in order. */
  returns: readonly string[];
  /** The text alternative for the drawing. */
  alt: string;
  /** The visible caption under it. */
  caption: string;
}

/** The English words, built from the page's own figures. */
export function englishLapsWords(): LapsWords {
  const [a, b, c] = SATURN_RETURN_AGES;
  const lap = `${SATURN_LAP_YEARS} years`;
  return {
    lap,
    birth: 'Birth',
    returns: ['First return', 'Second return', 'Third return'],
    alt: `A life drawn as a line from birth, with an arc above it for each of Saturn’s laps of the zodiac, ${lap} each. The first Saturn return falls near age ${a}, the second near ${b} and the third near ${c}.`,
    caption: `Each arc is one of Saturn’s laps of the zodiac, ${lap} long. A return falls where one lap ends and the next begins: near age ${a}, ${b} and ${c}.`,
  };
}
