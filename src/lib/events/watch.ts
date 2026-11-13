/**
 * The "watch it together" band on the event pages: the exact moment to count
 * down to, what is happening in plain astronomy, what can be seen in the real
 * sky (and, for an eclipse, roughly where), and a few questions to open Guide
 * with. Pure functions over EventFacts; nothing here reads a reader's chart,
 * place or clock. The countdown itself runs in the browser from the instants
 * this module returns (src/lib/events/countdown.ts).
 *
 * Register: plain, specific, calm. Astronomy is stated as fact; astrology is
 * left to the authored reading above it, which carries the confidence label.
 */
import { readingConfidenceLabel } from '../../ai-tools/reading-confidence';
import { formatDate } from '../i18n/dates';
import { signBySlug } from '../signs';
import { isInvisiblePenumbral, penumbralMagnitude } from '../nasa-lunar-eclipses';
import type { CountdownMoment } from './countdown';
import type { EventFacts } from './types';

/** The families that carry the band: lunations, eclipses and retrogrades. */
export const WATCH_FAMILIES = ['lunation', 'eclipse', 'retrograde'] as const;

/**
 * The page's reading uses the sky alone, with at most a Sun sign for the
 * sign-by-sign notes, so it carries the sign-level label (40%) from the one
 * rule every forecast on the site follows.
 */
export const EVENT_READING_CONFIDENCE = readingConfidenceLabel('sign');

export interface WatchPlan {
  /** Moments to count down to, in time order. */
  moments: CountdownMoment[];
  /** What is happening, in plain astronomy. */
  astronomy: string[];
  /** What to look for in the real sky, if anything. */
  lookFor: string[];
  /** Roughly where an eclipse can be seen. Eclipses only. */
  visibility?: string;
  /** Short questions that open Guide with a draft. */
  questions: string[];
}

/** 'November 24': the UTC day without a year, for Guide questions. */
function shortDay(iso: string): string {
  return formatDate('en', new Date(iso), { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

const signName = (slug: string | undefined) => (slug ? signBySlug(slug).name : '');

/**
 * Where published eclipse maps put each solar eclipse in the catalog window
 * (NASA's Five Millennium Canon paths, summarized by country). A solar
 * eclipse is seen only from a track on the ground, so it cannot be described
 * from the peak instant alone. Keyed by the eclipse's UTC peak day.
 */
/** Checked against NASA, ESA and IGN path summaries on 2026-11-05. */
export const SOLAR_ECLIPSE_VISIBILITY: Readonly<Record<string, string>> = Object.freeze({
  '2026-02-17': 'The ring of the annular phase is seen only over Antarctica. Southern Africa and the far south of South America see the Sun partly covered.',
  '2026-08-12': 'Totality crosses Greenland, western Iceland and northern Spain. Most of Europe, North Africa and the far northeast of North America see a partial eclipse.',
  '2027-02-06': 'The ring of the annular phase crosses Chile, Argentina and Uruguay, then the South Atlantic to the coast of West Africa. Most of South America and much of Africa see a partial eclipse.',
  '2027-08-02': 'Totality crosses southern Spain, Gibraltar, Morocco, Algeria, Tunisia, Libya, Egypt, Saudi Arabia, Yemen and Somalia, and lasts over six minutes near Luxor. Europe, Africa, the Middle East and South Asia see a partial eclipse.',
  '2028-01-26': 'The ring of the annular phase crosses the Galápagos, Ecuador, Peru, northern Brazil, Suriname and French Guiana, then ends near sunset over Portugal and Spain. Much of South America, western Europe and West Africa see a partial eclipse.',
  '2028-07-22': 'Totality crosses Australia, including Sydney, and the south of New Zealand. Southeast Asia, Australia and New Zealand see a partial eclipse.',
});

/** Broad regions and a representative longitude for each (degrees east). */
const LUNAR_REGIONS: readonly (readonly [string, number])[] = [
  ['western North America', -120],
  ['eastern North America', -75],
  ['South America', -60],
  ['Europe', 10],
  ['Africa', 15],
  ['the Middle East', 45],
  ['South Asia', 78],
  ['East Asia', 115],
  ['Australia', 135],
  ['New Zealand', 174],
  ['Hawaii and the central Pacific', -157],
];

/** How far from the point under the Moon a region still sees it well up. */
const LUNAR_REACH_DEGREES = 80;

/**
 * Equation of time in minutes (sundial minus clock), the usual short
 * approximation; within about a minute, which is a quarter of a degree here.
 */
function equationOfTimeMinutes(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = (date.getTime() - start) / 86_400_000;
  const b = (2 * Math.PI * (dayOfYear - 81)) / 364;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

/**
 * The longitude where the Moon stands overhead at a full moon: opposite the
 * point under the Sun. Degrees east, in [-180, 180).
 */
export function antisolarLongitude(iso: string): number {
  const date = new Date(iso);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const subsolar = (12 - utcHours - equationOfTimeMinutes(date) / 60) * 15;
  const antisolar = subsolar + 180;
  return ((((antisolar + 180) % 360) + 360) % 360) - 180;
}

function angularGap(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
}

/** The broad regions with the Moon well above the horizon at a lunar eclipse's peak. */
export function lunarEclipseRegions(iso: string): string[] {
  const centre = antisolarLongitude(iso);
  return LUNAR_REGIONS
    .filter(([, longitude]) => angularGap(longitude, centre) <= LUNAR_REACH_DEGREES)
    .sort((a, b) => angularGap(a[1], centre) - angularGap(b[1], centre))
    .map(([name]) => name);
}

function joinList(values: readonly string[]): string {
  if (values.length < 2) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

function lunationPlan(facts: EventFacts): WatchPlan {
  const sign = signName(facts.signs[0]);
  const day = shortDay(facts.at!);
  if (facts.subtype === 'full') {
    return {
      moments: [{ label: 'Full moon, exact', at: facts.at! }],
      astronomy: [
        'The Moon is opposite the Sun, so the whole face turned toward Earth is lit. The exact moment is an instant; to the eye the Moon looks full for about a night either side of it.',
      ],
      lookFor: [
        'It rises in the east around sunset, is highest around midnight and sets in the west near sunrise. Wherever you are, the night closest to the exact moment is the one to watch.',
        'Moonrise is the easiest moment to share: low on the horizon the Moon often looks large and orange.',
        'Its light washes out faint stars, so this is a poor night for the Milky Way and a good one for walking without a torch.',
      ],
      questions: [
        `What does a full moon in ${sign} mean?`,
        `How does the ${day} full moon fall in my chart?`,
        'Why does the full moon look bigger near the horizon?',
      ],
    };
  }
  return {
    moments: [{ label: 'New moon, exact', at: facts.at! }],
    astronomy: [
      'The Moon lies between Earth and the Sun, so its lit half faces away from us. It usually passes a little above or below the Sun, which is why most new moons are not eclipses.',
    ],
    lookFor: [
      'There is nothing to see at the moment itself: the Moon is up in daytime, lost in the Sun’s glare.',
      'One or two evenings later, look low in the west just after sunset for the first thin crescent.',
      'The nights around a new moon are the darkest of the month, the best time to look for faint stars and meteors.',
    ],
    questions: [
      `What does a new moon in ${sign} mean?`,
      `How does the ${day} new moon fall in my chart?`,
      'When can I first see the crescent after a new moon?',
    ],
  };
}

function eclipsePlan(facts: EventFacts): WatchPlan {
  const sign = signName(facts.signs[0]);
  const day = shortDay(facts.at!);
  const kind = facts.eclipseKind ?? 'partial';
  if (facts.subtype === 'solar') {
    const visibility = SOLAR_ECLIPSE_VISIBILITY[facts.at!.slice(0, 10)];
    const looking: Record<string, string> = {
      total: 'Inside the path of totality the sky darkens to deep dusk for a few minutes and the Sun’s outer atmosphere shows as a pale crown. Only during those minutes of totality is it safe to look without protection.',
      annular: 'The Moon is too far from Earth to cover the Sun completely, so a bright ring stays visible at the peak. Eye protection is needed the whole time, ring included.',
      partial: 'The Moon takes a bite out of the Sun. Eye protection is needed the whole time.',
    };
    return {
      moments: [{ label: 'Eclipse peak', at: facts.at! }],
      astronomy: [
        `A solar eclipse is a new moon that lines up exactly: the Moon passes in front of the Sun and its shadow falls on part of Earth. This one is ${kind}, with the Sun and Moon in ${sign}.`,
      ],
      lookFor: [
        looking[kind] ?? looking.partial,
        'Never look at the Sun directly, even when most of it is covered. Use eclipse glasses made to the ISO 12312-2 standard, or a pinhole projector: a small hole in card throws an image of the Sun onto a surface below it.',
        'Local times differ from the peak: the eclipse starts earlier in some places and later in others, and lasts a couple of hours from first contact to last.',
      ],
      ...(visibility ? { visibility } : {}),
      questions: [
        `What does a solar eclipse in ${sign} mean in astrology?`,
        `How does the ${day} eclipse fall in my chart?`,
        'How do I watch a solar eclipse safely?',
      ],
    };
  }

  const regions = lunarEclipseRegions(facts.at!);
  const looking: Record<string, string> = {
    total: `During totality${facts.totalMinutes ? `, about ${facts.totalMinutes} minutes,` : ''} the Moon turns a dull red or copper, lit only by sunlight bent through Earth’s atmosphere.`,
    partial: 'Part of the Moon goes dark, as if something had bitten into it: that is the edge of Earth’s shadow.',
    penumbral: 'Only Earth’s faint outer shadow touches the Moon. Most people will not notice any change; at best one side looks slightly dusky near the peak.',

  };
  const unseen = kind === 'penumbral' && isInvisiblePenumbral(facts.at!, 'penumbral');
  if (unseen) {
    looking.penumbral = `The Moon only grazes the edge of Earth’s faint outer shadow: NASA gives a penumbral magnitude of ${penumbralMagnitude(facts.at!)}. That is so slight that no eye or camera will see it; the full Moon looks as it does on any other night.`;
  }
  return {
    moments: [{ label: 'Eclipse peak', at: facts.at! }],
    astronomy: [
      `A lunar eclipse is a full moon that lines up exactly: the Moon passes through Earth’s shadow. This one is ${kind}, with the Moon in ${sign}.`,
    ],
    lookFor: [
      looking[kind] ?? looking.partial,
      ...(unseen ? [] : ['It is safe to watch with bare eyes. Binoculars help, and so does a spot away from street lights.']),
    ],
    visibility: unseen
      ? 'No one will see it. The Moon is up for half the world at the peak, but the shading is too slight to show.'
      : regions.length > 0
      ? `Anyone with the Moon above the horizon at the peak can see it. Roughly, that is ${joinList(regions)}; places at the edges see it with the Moon low, near moonrise or moonset.`
      : 'Anyone with the Moon above the horizon at the peak can see it.',
    questions: [
      `What does a lunar eclipse in ${sign} mean in astrology?`,
      `How does the ${day} eclipse fall in my chart?`,
      kind === 'penumbral' ? 'What is a penumbral eclipse?' : 'Why does the Moon turn red in a lunar eclipse?',
    ],
  };
}

const RETROGRADE_SKY: Record<string, string> = {
  Mercury: 'Mercury stays close to the Sun and is hard to see for most of a retrograde. In the evenings before it turns, it can sometimes be found low in the west after sunset; it passes between Earth and the Sun in the middle of the cycle and comes back low in the east before sunrise.',
  Venus: 'Venus is the brightest point in the sky after the Moon. When it turns retrograde it is the evening star, low in the west after sunset; it passes between Earth and the Sun in the middle of the cycle and returns as the morning star in the east before dawn.',
  Mars: 'Mars is near its closest and brightest during a retrograde, a steady orange point that does not twinkle. In the middle of the cycle it rises around sunset and is up all night. Noting its place against nearby stars every week or so shows the backward loop.',
};

function retrogradePlan(facts: EventFacts): WatchPlan {
  const planet = facts.bodies[0];
  const sign = signName(facts.signs[0]);
  const moments: CountdownMoment[] = [];
  if (facts.start && !facts.clamped) moments.push({ label: `${planet} turns retrograde`, at: facts.start });
  if (facts.end) moments.push({ label: `${planet} turns direct`, at: facts.end });
  const relation = planet === 'Mars'
    ? 'Earth, on the faster inside track, overtakes Mars'
    : `${planet}, on a faster inside track, overtakes Earth`;
  return {
    moments,
    astronomy: [
      `From Earth, ${planet} seems to slow down, stop and drift backward against the stars for a few weeks. Nothing about its orbit changes: ${relation}, and the view from a moving planet makes it look like a reversal.`,
      'The start and the end are stations, the days the planet seems to stand still before it turns. Those are the moments counted down here.',
    ],
    lookFor: [RETROGRADE_SKY[planet] ?? `${planet}'s backward drift shows only over weeks, against the background stars.`],
    questions: [
      `What does ${planet} retrograde in ${sign} mean?`,
      `Which part of my chart does this ${planet} retrograde cross?`,
      'Why do planets look like they move backward?',
    ],
  };
}

/** The band for an event, or null for the families that do not carry one. */
export function watchPlan(facts: EventFacts): WatchPlan | null {
  switch (facts.family) {
    case 'lunation': return lunationPlan(facts);
    case 'eclipse': return eclipsePlan(facts);
    case 'retrograde': return retrogradePlan(facts);
    default: return null;
  }
}

/** Every string the band can print, for copy checks. */
export function watchPlanCopy(plan: WatchPlan): string[] {
  return [
    ...plan.moments.map((moment) => moment.label),
    ...plan.astronomy,
    ...plan.lookFor,
    ...(plan.visibility ? [plan.visibility] : []),
    ...plan.questions,
  ];
}
