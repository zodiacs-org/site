/**
 * Phrasing for reading a natal chart in order: what each planet does
 * from the house it occupies, which aspects carry the chart, and the
 * overall weather of the whole thing. Engine-free — pure text over
 * Chart data. BODY_ROLE is shared with the other registers, but the
 * verbs are this module's own: a planet that lives somewhere needs
 * different grammar than one passing through (transits.ts) or meeting
 * another person's (compat.ts).
 */
import { BODY_ROLE } from './compat';
import { elementBalance, modalityBalance, type MinimalBody } from './engine/synastry';
import type { Aspect } from './engine/types';
import type { Element, Modality } from './signs';

const ORDINAL = [
  '',
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
];

/**
 * Natal house territories. daily.ts keeps its own solar-house list in
 * the "today" voice; these are worded for something permanent.
 */
export const NATAL_HOUSE_THEME: Record<number, string> = {
  1: 'first impressions, instinct, and the way you arrive',
  2: 'earning, owning, and what security is made of',
  3: 'language, siblings, short trips, and the everyday mind',
  4: 'home, roots, family, and where you go to be unobserved',
  5: 'pleasure, romance, children, and what you make for its own sake',
  6: 'routines, health, craft, and the daily load',
  7: 'partnership, the people you meet as equals',
  8: 'shared resources, intimacy, and what gets merged',
  9: 'travel, study, belief, and the long view',
  10: 'career, reputation, and the public record',
  11: 'friends, groups, allies, and the future you point at',
  12: 'solitude, rest, and what runs beneath awareness',
};

/** How each planet inhabits a house — permanent tense, no "today". */
const PLACED: Record<string, string> = {
  Sun: 'centers itself in',
  Moon: 'keeps its tides in',
  Mercury: 'does its thinking in',
  Venus: 'looks for beauty in',
  Mars: 'spends its heat in',
  Jupiter: 'wants more room in',
  Saturn: 'keeps its ledger in',
  Uranus: 'refuses to settle in',
  Neptune: 'softens the walls of',
  Pluto: 'digs deepest in',
};

const NATAL_ASPECT: Record<string, { verb: string; gloss: string }> = {
  conjunction: {
    verb: 'is fused to',
    gloss: 'run as one instrument, hard to play separately',
  },
  sextile: {
    verb: 'has an open line to',
    gloss: 'cooperate whenever you remember to ask',
  },
  square: {
    verb: 'grinds against',
    gloss: 'pull in directions ninety degrees apart: permanent friction, and the strength that comes from working against it',
  },
  trine: {
    verb: 'runs downhill into',
    gloss: 'help each other so smoothly the gift is easy to miss',
  },
  opposition: {
    verb: 'faces off with',
    gloss: 'hold opposite ends of one axis, taking turns unless you seat them both',
  },
};

/**
 * Hand-tuned lines for combinations where the composed sentence reads
 * canned. House keys are `${body}:${house}`.
 */
const CURATED: Record<string, string> = {
  'Sun:1': 'Your Sun sits in the first house. The self and the surface are the same layer, and people meet most of who you are in the first minute.',
  'Moon:4': 'Your Moon keeps its tides in the fourth house, home terrain for it; feelings need a private floor, and given one, they steady the whole chart.',
  'Saturn:12': 'Your Saturn keeps its ledger in the twelfth house. The accounting happens out of sight, and the discipline that costs you most is the kind nobody watches you practice.',
  'Pluto:1': 'Your Pluto digs deepest in the first house. Intensity arrives before your name does, and people tend to react to you before you have done anything.',
  'Neptune:10': 'Your Neptune softens the walls of the tenth house. The career refuses to stay literal; the public role works best when it carries some of the dream with it.',
  'Mars:7': 'Your Mars spends its heat in the seventh house. You meet your own drive most clearly in other people, which makes partners both the spark and the sparring ring.',
  'Venus:2': 'Your Venus looks for beauty in the second house. Taste and security share a wallet, and what you own has to please you, not just hold value.',
  'Mercury:3': 'Your Mercury does its thinking in the third house, its home terrain; the everyday mind runs fast, in words, and mostly out loud.',
};

/** Authored natal readings. Pair order follows the ten planets below. */
export const NATAL_ASPECT_LINES: Readonly<Record<string, string>> = {
  'Sun:conjunction:Moon': 'Your Sun is fused to your Moon. You were born near a new moon, and what you want and what you need mostly agree; the risk is not noticing there are two of them.',
  'Sun:opposition:Moon': 'Your Sun faces off with your Moon, a full-moon birth; wanting and needing sit at opposite ends of one axis, and the life work is refusing to pick a permanent side.',
  'Sun:square:Moon': 'Your Sun grinds against your Moon. What you are building and what would feel like home pull at right angles, and every big decision has to answer to both.',
  'Venus:conjunction:Mars': 'Your Venus is fused to your Mars. Wanting and pursuing fire together; the charm has momentum, and the appetite has taste.',
  'Moon:square:Saturn': 'Your Moon grinds against your Saturn. Feelings meet a strict doorman, and the early lesson that comfort must be earned takes deliberate unlearning.',
  'Sun:conjunction:Mercury': 'Your Sun is fused to your Mercury. The self and its narrator share a desk, which makes the account vivid and the distance between you and your own opinions small.',
  'Sun:sextile:Mars': 'Your Sun has an open line to your Mars. A clear purpose can give you the push to begin. Choose a first step small enough to take while the intention is fresh.',
  'Sun:square:Neptune': 'Your Sun grinds against your Neptune. An imagined version of yourself can compete with the life you are living. Try an idea in ordinary conditions before treating it as your calling.',
  'Sun:trine:Jupiter': 'Your Sun runs downhill into your Jupiter. Confidence can grow through learning, travel, or a wider view. Give that optimism a specific question to explore.',
  'Sun:conjunction:Venus': 'Your Sun is fused to your Venus. What you value can be closely tied to how you see yourself. Notice which preferences remain yours when nobody else is there to approve them.',
  'Sun:trine:Pluto': 'Your Sun runs downhill into your Pluto. Sustained attention can help you remake something that no longer fits. Choose what deserves that depth, and leave room for what can stay simple.',
  'Sun:sextile:Pluto': 'Your Sun has an open line to your Pluto. An honest look beneath the surface can clarify your next direction. Start with one pattern you have the power to change.',
  'Sun:square:Mars': 'Your Sun grinds against your Mars. The urge to act can outrun the purpose behind it. Before taking on a challenge, ask whether winning it would move you toward what matters.',
  'Sun:sextile:Uranus': 'Your Sun has an open line to your Uranus. Trying a different route can reveal a direction that feels more your own. A small experiment gives you room to change without overturning everything.',
  'Sun:sextile:Saturn': 'Your Sun has an open line to your Saturn. A manageable commitment can turn intention into something lasting. Pick a rhythm you can keep, then let the repeated effort count.',
  'Sun:square:Saturn': 'Your Sun grinds against your Saturn. High standards can make each choice feel like a test of your worth. Define what is enough for this task before asking yourself for more.',
  'Mars:sextile:Uranus': 'Your Mars has an open line to your Uranus. A change of method can restore momentum when effort stalls. Test a different tool or approach before simply pushing harder.',
  'Sun:sextile:Neptune': 'Your Sun has an open line to your Neptune. Imagination can suggest a direction that a practical plan has missed. Give the idea a small, tangible form and see what it teaches you.',
  'Sun:square:Pluto': 'Your Sun grinds against your Pluto. Holding to your direction can become tangled with holding control. Notice where a firm choice would serve you better than a struggle for the last word.',
  'Sun:conjunction:Jupiter': 'Your Sun is fused to your Jupiter. Growth can feel central to who you are, making the next possibility hard to pass up. Choose which opportunity deserves your full attention.',
  'Sun:square:Jupiter': 'Your Sun grinds against your Jupiter. Enthusiasm can stretch a promise beyond the time or energy available. Check the size of the commitment while there is still room to adjust it.',
  'Sun:conjunction:Mars': 'Your Sun is fused to your Mars. Acting on a desire can feel like declaring who you are. Leave yourself a pause in which changing your approach is allowed to count as strength.',
  'Sun:trine:Mars': 'Your Sun runs downhill into your Mars. Purpose and action can reinforce each other with little persuasion. Use that ease on a chosen goal, and check whether the goal still fits as you go.',
  'Mercury:trine:Saturn': 'Your Mercury runs downhill into your Saturn. Patient thinking can turn a complicated idea into a clear structure. Use an outline or a careful question, while leaving space for evidence that changes the plan.',
  'Sun:trine:Neptune': 'Your Sun runs downhill into your Neptune. Imagination and empathy can become natural ways of expressing yourself. Give them a medium, and keep time for your own wishes alongside what you absorb from others.',
  'Mars:trine:Neptune': 'Your Mars runs downhill into your Neptune. An image, cause, or creative practice can draw effort from you without much forcing. Notice which inspiration still supports action after the first rush fades.',
  'Sun:opposition:Mars': 'Your Sun faces off with your Mars. Pursuing your direction and answering a challenge can pull you into different positions. Decide what you want before letting a contest set the terms.',
  'Sun:conjunction:Neptune': 'Your Sun is fused to your Neptune. Imagination can be woven into your sense of self, making possibilities feel personal. Let a vision guide an experiment without requiring it to explain your whole life.',
  'Venus:conjunction:Pluto': 'Your Venus is fused to your Pluto. Affection and taste can invite deep investment. Make room to name what you want and to hear a different answer without turning closeness into a test.',
  'Mars:opposition:Neptune': 'Your Mars faces off with your Neptune. Direct action and an ideal can pull apart when the next step is unclear. Name what is yours to do, then choose a step whose result you can observe.',
  'Venus:conjunction:Jupiter': 'Your Venus is fused to your Jupiter. Enjoyment and generosity can grow together, making a good experience easy to extend. Choose what you want to share and how much room you have for it.',
  'Sun:sextile:Moon': 'Your Sun has an open line to your Moon. Checking what you need can help you choose a direction. Make that check part of a decision, instead of waiting for discomfort to interrupt it.',
  'Sun:trine:Moon': 'Your Sun runs downhill into your Moon. Your direction and your need for comfort can support each other easily. Notice when familiar choices nourish you and when you are ready to try something else.',
  'Moon:conjunction:Mercury': 'Your Moon is fused to your Mercury. Feelings can quickly become words, and words can change how you feel. Leave room to describe an emotion before deciding what it means.',
  'Moon:square:Mercury': 'Your Moon grinds against your Mercury. The explanation that makes sense may not match the feeling underneath it. Give each a separate sentence before asking them to agree.',
  'Moon:trine:Venus': 'Your Moon runs downhill into your Venus. Comfort and affection can meet in small gestures, familiar pleasures, or a welcoming space. Ask which gesture would feel caring to the person receiving it.',
};

const NATAL_PLANET_ORDER = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
];

function aspectKey(a: string, type: string, b: string): string {
  const first = NATAL_PLANET_ORDER.indexOf(a);
  const second = NATAL_PLANET_ORDER.indexOf(b);
  return first >= 0 && second >= 0 && first > second
    ? `${b}:${type}:${a}`
    : `${a}:${type}:${b}`;
}

/**
 * One sentence for a planet living in a house. House must be 1–12;
 * callers with no birth time have no houses and skip this entirely.
 * Pass `withTheme: false` for repeat mentions of a house so a shared
 * house doesn't restate its territory line after line.
 */
export function planetInHouseLine(
  body: string,
  house: number,
  opts: { withTheme?: boolean } = {},
): string {
  const curated = CURATED[`${body}:${house}`];
  if (curated) return curated;
  const verb = PLACED[body];
  const theme = NATAL_HOUSE_THEME[house];
  if (!verb || !theme) return `Your ${body} occupies the ${ORDINAL[house] ?? `${house}th`} house.`;
  if (opts.withTheme === false) return `Your ${body} ${verb} the ${ORDINAL[house]} house too.`;
  return `Your ${body} ${verb} the ${ORDINAL[house]} house: ${theme}.`;
}

/**
 * One sentence for a natal aspect between two of your own planets.
 * "Your Mars grinds against your Moon — your drive and your emotional
 * life pull in directions ninety degrees apart…"
 */
export function natalAspectLine(a: string, type: string, b: string): string {
  const curated = NATAL_ASPECT_LINES[aspectKey(a, type, b)];
  if (curated) return curated;
  const roleA = BODY_ROLE[a] ?? a.toLowerCase();
  const roleB = BODY_ROLE[b] ?? b.toLowerCase();
  const phrase = NATAL_ASPECT[type];
  if (!phrase) return `Your ${a} aspects your ${b}.`;
  return `Your ${a} ${phrase.verb} your ${b}. Your ${roleA} and your ${roleB} ${phrase.gloss}.`;
}

/**
 * The aspects worth reading first: tightest orbs, with a thumb on the
 * scale for the luminaries (an exact-ish Sun or Moon contact organizes
 * more of a life than a tighter Jupiter–Neptune one).
 */
export function topAspects(aspects: Aspect[], n = 4): Aspect[] {
  const score = (x: Aspect) =>
    x.orb - (x.a === 'Sun' || x.a === 'Moon' || x.b === 'Sun' || x.b === 'Moon' ? 1.5 : 0);
  return [...aspects].sort((x, y) => score(x) - score(y)).slice(0, n);
}

const ELEMENT_ABSENCE: Record<Element, string> = {
  fire: 'no planet in fire. Initiative is a practice here, not a reflex',
  earth: 'no planet in earth. The practical layer has to be built by hand',
  air: 'no planet in air. Distance from a question takes deliberate effort',
  water: 'no planet in water. Feelings arrive on a delay, through the body or in private',
};

const ELEMENT_DOMINANT: Record<Element, string> = {
  fire: 'the chart runs hot: initiative first, reflection after',
  earth: 'the chart is load-bearing: real things, on real timelines',
  air: 'the chart lives in language: patterns first, then feelings',
  water: 'the chart reads the room before the memo: feeling is the first sense',
};

const MODALITY_DOMINANT: Record<Modality, string> = {
  cardinal: 'heavy on cardinal signs, better at starting than sustaining',
  fixed: 'heavy on fixed signs, slow to commit, nearly impossible to move after',
  mutable: 'heavy on mutable signs, built to adapt, tempted to drift',
};

export interface ChartWeather {
  lines: string[];
  elements: Record<Element, number>;
  modalities: Record<Modality, number>;
}

/**
 * The whole-chart summary block: element and modality weather,
 * retrograde count, stelliums by sign (and by house when houses are
 * known). `bodies` should be the ten planets; `houseOfBody` maps a
 * body name to its house (or undefined when no birth time).
 */
export function chartWeather(
  bodies: (MinimalBody & { retrograde?: boolean; sign?: string })[],
  houseOfBody?: (body: string) => number | null,
): ChartWeather {
  const lines: string[] = [];
  const elements = elementBalance(bodies);
  const modalities = modalityBalance(bodies);

  const elEntries = (Object.entries(elements) as [Element, number][]).sort((a, b) => b[1] - a[1]);
  const [topEl, topElCount] = elEntries[0];
  const missing = elEntries.filter(([, c]) => c === 0).map(([e]) => e);
  if (topElCount >= 4) {
    lines.push(`${cap(topEl)} carries ${topElCount} of the ten planets. ${cap(ELEMENT_DOMINANT[topEl])}.`);
  } else {
    lines.push('The elements sit in rough balance. No single temperament runs the show.');
  }
  for (const el of missing) lines.push(`There is ${ELEMENT_ABSENCE[el]}.`);

  const modEntries = (Object.entries(modalities) as [Modality, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  const [topMod, topModCount] = modEntries[0];
  if (topModCount >= 5) lines.push(`${cap(String(topMod))} count ${topModCount} of ten: ${MODALITY_DOMINANT[topMod]}.`);

  const rx = bodies.filter((b) => b.retrograde).length;
  if (rx >= 3) {
    lines.push(
      `${rx} planets were retrograde when you were born, a chart that does much of its work on the second pass.`,
    );
  }

  // Stelliums: three or more planets sharing a sign (or a house).
  const bySign = new Map<string, string[]>();
  for (const b of bodies) {
    if (!b.sign) continue;
    bySign.set(b.sign, [...(bySign.get(b.sign) ?? []), b.body]);
  }
  for (const [sign, members] of bySign) {
    if (members.length >= 3) {
      lines.push(
        `${members.join(', ')} all sit in ${cap(sign)}, a stellium; that sign's agenda gets ${members.length} votes.`,
      );
    }
  }
  if (houseOfBody) {
    const byHouse = new Map<number, string[]>();
    for (const b of bodies) {
      const h = houseOfBody(b.body);
      if (!h) continue;
      byHouse.set(h, [...(byHouse.get(h) ?? []), b.body]);
    }
    for (const [house, members] of byHouse) {
      if (members.length >= 3) {
        lines.push(
          `${members.join(', ')} share your ${ORDINAL[house]} house. ${cap(NATAL_HOUSE_THEME[house])} takes outsized weight.`,
        );
      }
    }
  }

  return { lines, elements, modalities };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
