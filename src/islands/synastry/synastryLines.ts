import type { AspectType } from '../../lib/engine/types';
import type { Element } from '../../lib/signs';

interface SynastryPairLines {
  conj?: string;
  soft: string;
  hard: string;
}

export type MercuryElementPairKey =
  | 'fire-fire'
  | 'fire-earth'
  | 'fire-air'
  | 'fire-water'
  | 'earth-earth'
  | 'earth-air'
  | 'earth-water'
  | 'air-air'
  | 'air-water'
  | 'water-water';

/** Fable-authored Corpus B. Keep every value byte-identical to its source. */
export const MERCURY_ELEMENT_PAIRS: Record<MercuryElementPairKey, string> = {
  'fire-fire': `Two minds that think at speaking speed. Conversation as sparring, fast and warm. Nobody finishes their sentences here; nobody minds.`,
  'fire-earth': `One of you talks toward the idea, the other from the plan. The fire mind supplies the spark, the earth mind the load-bearing question: "how?"`,
  'fire-air': `Kindling and wind. Ideas escalate delightfully and land somewhere neither of you started. Keep one notepad between you for what was actually decided.`,
  'fire-water': `One speaks in headlines, the other in tides. The fire mind must learn that silence isn't agreement; the water mind, that bluntness isn't attack.`,
  'earth-earth': `Conversation as craftsmanship: concrete, unhurried, allergic to hypotheticals. You two can sit in a comfortable quiet that would alarm other pairs.`,
  'earth-air': `The theorist and the surveyor. One loves the model, the other checks the ground. Together you're a full feasibility study; apart, a lecture and a spreadsheet.`,
  'earth-water': `Words are practical on one side and tidal on the other, and both of you distrust noise. This pair often communicates best while doing something. The talk rides the task.`,
  'air-air': `A conversation that never actually ends, just pauses: references, tangents, callbacks to a joke from years ago. The risk is analyzing a feeling instead of having it.`,
  'air-water': `One narrates the feeling, the other feels the narration. Translation is the work: the air mind names, the water mind confirms the name actually fits.`,
  'water-water': `You two talk under the words: tone, timing, what wasn't said. Beautiful and hermetic; the discipline is saying the important things out loud anyway, for the record.`,
};

export const NO_CONTACT = `Your Mercuries make no major contact. The tradition reads that as neutral, not bad: your minds neither collide nor complete each other by default, so your conversational style is built, not given. The sign pairing above is the material you're building with.`;

const ELEMENT_ORDER: readonly Element[] = ['fire', 'earth', 'air', 'water'];

export function mercuryElementPairKey(a: Element, b: Element): MercuryElementPairKey {
  return (ELEMENT_ORDER.indexOf(a) <= ELEMENT_ORDER.indexOf(b) ? `${a}-${b}` : `${b}-${a}`) as MercuryElementPairKey;
}

/** Fable-authored Corpus 1. Keep every value byte-identical to its source. */
export const SYNASTRY_LINES: Record<string, SynastryPairLines> = {
  'Sun-Moon': {
    soft: `One of you runs on purpose, the other on feeling, and here they agree. What one wants to do is what the other wants to come home to. This is the classic ease that makes a relationship feel inevitable in retrospect.`,
    hard: `What one of you wants and what the other needs pull in different directions, and neither is wrong. The work is scheduling both instead of alternating resentments.`,
  },
  'Sun-Sun': {
    soft: `Your core engines run on compatible fuel. The same things feel like living to both of you. Watch only that two similar wills still take turns.`,
    hard: `Two clear identities at cross purposes: what lights one of you up can read as noise to the other. Respect here is built, not assumed, and it holds once it's built.`,
  },
  'Sun-ASC': {
    soft: `One of you is, at first glance, what the other actually is. Instant recognition, low explanation costs. First impressions here age well.`,
    hard: `The way one of you enters a room sits at an angle to who the other is at core. Give the first impression time to be revised; the second draft is better.`,
  },
  'Sun-Saturn': {
    soft: `The Saturn side lends structure and the Sun side lends warmth, and both feel steadier for it. This is the aspect of things that last because someone maintained them.`,
    hard: `The Saturn side's caution can land on the Sun side as judgment, and the Sun side's shine can read as recklessness. Name the fear under the criticism and this gets much lighter.`,
  },
  'Sun-Jupiter': {
    soft: `One of you makes the other feel like more is possible. More room, more nerve, more future. Guard only against promising it all in the first month.`,
    hard: `Encouragement here can tip into inflation: plans outrun budgets, praise outruns evidence. Keep the optimism and add arithmetic.`,
  },
  'Sun-Pluto': {
    soft: `The attention between you has unusual depth. Being seen this thoroughly is either magnetic or alarming, usually both. Handled honestly, it remakes both of you a little.`,
    hard: `Fascination with a control current under it. The test is whether influence stays mutual; the fix, when it doesn't, is saying so out loud early.`,
  },
  'Moon-Moon': {
    soft: `Your emotional weather systems sync. What soothes one genuinely soothes the other, and silence together is comfortable. Homes are easy to share on this aspect.`,
    hard: `You process feelings on different clocks. One needs to talk tonight, the other needs until Thursday. Neither pace is a character flaw; the calendar is the compromise.`,
  },
  'Moon-Mercury': {
    soft: `One of you can say what the other is feeling, often before they can. Conversation doubles as comfort here.`,
    hard: `Analysis meets emotion mid-sentence: one wants the feeling named precisely, the other wants it felt first. Ask "solve or listen?" and this aspect behaves.`,
  },
  'Moon-Venus': {
    soft: `Tenderness comes easy. What one needs and what the other enjoys giving overlap generously. This is one of the sweetest aspects two charts can exchange.`,
    hard: `Different dialects of affection: care arrives in a form the other doesn't immediately recognize as care. Translate once and it counts double.`,
  },
  'Moon-Mars': {
    soft: `Desire and comfort feed each other here. Protectiveness with heat in it. Arguments, when they come, clear like summer storms.`,
    hard: `The Mars side moves fast enough to bruise without meaning to; the Moon side's hurt can arrive as cold instead of words. Slow the first five minutes of any conflict and the rest resolves.`,
  },
  'Moon-Saturn': {
    soft: `The Saturn side is a wall the Moon side can actually lean on. Less fireworks, more foundation. This aspect is why you're still together in year ten.`,
    hard: `The Moon side can feel graded; the Saturn side can feel needed only as furniture. The repair is unglamorous: reliability offered warmly, need stated plainly.`,
  },
  'Moon-Jupiter': {
    soft: `One of you makes the other's feelings feel survivable, even interesting. Emotional generosity is the default setting here.`,
    hard: `Comfort by expansion (the bigger trip, the better dinner) can skip the actual feeling. Sit with it first; celebrate after.`,
  },
  'Moon-Pluto': {
    soft: `Emotional x-ray vision, mutual. Intimacy here goes deeper than either of you planned, and the trust it builds is not casual.`,
    hard: `Feelings become leverage if either of you lets them. The silent treatment, the well-placed sore spot. Depth without fair play is just excavation; keep the play fair.`,
  },
  'Mercury-Mercury': {
    soft: `Your minds are running compatible operating systems. Shorthand develops fast, and it lasts. You will never run out of conversation, only of evening.`,
    hard: `You think in different formats: one narrates, one concludes; one browses, one files. Neither is the smart one. Repeat that as needed.`,
  },
  'Mercury-Mars': {
    soft: `Conversation with torque. Debate as sport, ideas that become plans by Friday. Just remember the audience isn't keeping score.`,
    hard: `Words acquire edges here: one of you debates to think, the other hears a challenge. Drop the volume, keep the content, and this becomes your best tool.`,
  },
  'Mercury-Saturn': {
    soft: `One of you edits the other kindly. Thoughts leave this pairing sturdier than they arrived. Excellent for building anything that needs a plan.`,
    hard: `The Saturn side's realism can land as a red pen on everything the Mercury side says. Ration the critique; a plan survives more enthusiasm than you'd think.`,
  },
  'Venus-Venus': {
    soft: `You want the same kind of beauty. Shared taste in people, rooms, evenings. Agreement on what's lovely is rarer than it sounds and worth more.`,
    hard: `Different pleasures, different price tags. Alternate curators rather than merging the museum.`,
  },
  'Venus-Mars': {
    conj: `The classic attraction aspect at full strength. What one radiates is exactly what the other pursues. Everything else about the relationship still has to be built, but this part came assembled.`,
    soft: `Attraction with easy rhythm: initiative and response trade places without negotiation. Chemistry here is a renewable resource.`,
    hard: `The pull is real and so is the friction. Timing, tempo, and appetite misalign just enough to spark. Handled with humor, the spark is the feature.`,
  },
  'Venus-Saturn': {
    soft: `Affection with a spine: this pairing keeps its promises. The romance is quieter than the movies and outlasts them.`,
    hard: `The Venus side wants warmth shown; the Saturn side shows it by showing up, invoiced and on time. Both are love. Say so across the gap, regularly.`,
  },
  'Venus-Jupiter': {
    soft: `Generosity compounds between you. Pleasure, patience, and benefit of the doubt all arrive oversized. Delightful, and occasionally expensive.`,
    hard: `More isn't always the answer, and this aspect will suggest it anyway. Enjoy the abundance; audit it quarterly.`,
  },
  'Venus-Pluto': {
    soft: `Attraction with undertow. This pairing doesn't do casual well, and doesn't want to. What it offers instead is transformation with a witness.`,
    hard: `Desire and possession share a border here, and it needs patrolling. Jealousy named early is information; named late, it's damage.`,
  },
  'Venus-ASC': {
    soft: `One of you finds the other easy to look at and easier to like. The packaging and the preference match. Charm costs nothing in this pairing.`,
    hard: `Taste and presentation snag on each other in small, stylistic ways. It's decor, not structure; treat it that lightly.`,
  },
  'Mars-Mars': {
    soft: `Your drives point the same direction. Shared projects move at double speed, and so do shared workouts. Competition stays friendly because it's genuinely fun.`,
    hard: `Two accelerators, no shared brake: conflicts escalate fast and physically want an outlet. Build the ritual (the run, the game, the garage) where the heat goes.`,
  },
  'Mars-Saturn': {
    soft: `Drive meets discipline and both improve: the Mars side finishes more, the Saturn side starts more. This is the aspect of things actually shipped.`,
    hard: `One of you hits the gas while the other rides the brake, and both feel judged for it. Agree on the destination first; argue speed second.`,
  },
  'Mars-ASC': {
    soft: `One of you activates the other on sight. Energy, nerve, a bit of swagger. Good for adventures; check in before committing the weekend.`,
    hard: `The Mars side's directness can hit the other's front door harder than intended. Knock first; the door opens fine.`,
  },
  'Saturn-ASC': {
    soft: `One of you steadies how the other faces the world, a quiet vote of confidence that compounds. Slow-building, long-holding.`,
    hard: `The Saturn side can read as a bouncer at the other's door, scrutiny before welcome. Warmth declared early disarms it almost completely.`,
  },
};

const CANONICAL_ORDER = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'ASC',
] as const;
const CANONICAL_RANK = new Map<string, number>(CANONICAL_ORDER.map((name, index) => [name, index]));

export function canonicalSynastryPair(a: string, b: string): string {
  const rankA = CANONICAL_RANK.get(a);
  const rankB = CANONICAL_RANK.get(b);
  if (rankA !== undefined && rankB !== undefined) return rankA <= rankB ? `${a}-${b}` : `${b}-${a}`;
  if (rankA !== undefined) return `${a}-${b}`;
  if (rankB !== undefined) return `${b}-${a}`;
  return a.localeCompare(b, 'en') <= 0 ? `${a}-${b}` : `${b}-${a}`;
}

export function synastryCorpusLine(a: string, b: string, aspect: AspectType): string | null {
  const lines = SYNASTRY_LINES[canonicalSynastryPair(a, b)];
  if (!lines) return null;
  if (aspect === 'conjunction') return lines.conj ?? lines.soft;
  if (aspect === 'trine' || aspect === 'sextile') return lines.soft;
  return lines.hard;
}
