/**
 * Short big-three readings — Sun / Moon / Rising × 12. These are the
 * calculator's first-touch interpretations: two sentences, plain and
 * specific, each linking deeper via the sign guide. Written in the
 * house voice; keep them tight and non-generic.
 */

type Table = Record<string, string>;

export const SUN: Table = {
  aries: 'Your core engine is ignition. You feel most yourself starting things, leading from the front, and finding out by doing. The lifelong lesson: endurance is also a way to win.',
  taurus: 'You are built for consistency: slow to start, nearly impossible to stop, with an unteachable instinct for what feels good and lasts. Change is fine, as long as it was your idea and arrived on schedule.',
  gemini: 'Your identity runs on curiosity and exchange. You think by talking, learn by skimming everything, and stay young by staying interested. Depth is a choice you make on purpose, not a default.',
  cancer: 'You lead with care whether you meant to or not: reading rooms, remembering details, building safety for your people. The work is letting others see the operator behind the shell.',
  leo: 'You metabolize attention into warmth and warmth into loyalty. When you are genuinely seen, everyone around you gets a better version of you. Pride is the tax; generosity is the dividend.',
  virgo: 'You notice what others miss and quietly fix it before anyone asks. Usefulness is how you love; the growth edge is accepting that unpolished still counts as done.',
  libra: 'You instinctively balance every room you enter. The missing perspective is the one you voice. Deciding what *you* want, out loud, is the brave move.',
  scorpio: 'You run deep and you know it: all-or-nothing attention, a long memory, and zero interest in small talk. Trust is your real currency, spent slowly and repaid completely.',
  sagittarius: 'You are aimed at the horizon: meaning, motion, and the honest version of every answer. Commitment stops feeling like a cage once it comes with a window.',
  capricorn: 'You play the long game by nature: quiet ambition, dry wit, and receipts. The mountain is real, but so is the view. Remember to look at it occasionally.',
  aquarius: 'You think from orbit: patterns first, people as systems, loyalty expressed through ideas and independence. The warmth is real; it just arrives on a delay.',
  pisces: 'Your edges are porous: you absorb moods, read subtext, and imagine your way into other lives without trying. Boundaries are not a betrayal of that gift. They are its maintenance.',
};

export const MOON: Table = {
  aries: 'Feelings arrive as action impulses: anger before sadness, movement before words. You process by doing; hard conversations land better after a run.',
  taurus: 'You settle yourself through the senses: food, comfort, routine, one unhurried evening. Emotional safety means knowing nothing important will change without warning.',
  gemini: 'You metabolize feelings by naming them: talking, texting, journaling them into shape. Restlessness is usually a signal you need new input, not a new life.',
  cancer: 'The Moon rules Cancer, and it shows: tidal moods, elephant memory, fierce protectiveness. Home is not a place so much as a feeling you can carry and recreate.',
  leo: 'You need to be someone’s favorite, not everyone’s, someone’s. Appreciation is oxygen; give it as freely as you need it and your relationships thrive.',
  virgo: 'In this tradition, worry is how your care sounds from the inside. You soothe yourself by making order (lists, plans, a clean kitchen) and love others through useful details.',
  libra: 'Conflict sits in your body like static; you feel best when things are fair and aesthetically calm. The practice: disagreeing early, before the resentment invoices arrive.',
  scorpio: 'You feel everything at full depth and show almost none of it on purpose. Intimacy for you is letting one person watch the water level change.',
  sagittarius: 'Your moods need mileage, literal or intellectual. When feelings close in, you widen the frame: the joke, the trip, the bigger picture that makes it survivable.',
  capricorn: 'You were the emotionally competent one early, and it stuck. Feelings get processed privately, on a schedule. Letting someone witness the process is the intimacy upgrade.',
  aquarius: 'You observe your own emotions from a small distance before joining them. That delay is not coldness. It is analysis. Naming it out loud keeps loved ones from guessing.',
  pisces: 'You are the room’s emotional weather station, receiving everything, including what nobody said. Solitude is not withdrawal. It is how you find out which feelings were yours.',
};

export const RISING: Table = {
  aries: 'People meet your momentum before they meet you: decisive, direct, already halfway out the door. Rooms hand you the lead whether you asked or not.',
  taurus: 'You read as calm, solid, and unhurried, the person who will obviously still be here next year. It buys trust on sight; use it.',
  gemini: 'First impression: quick, verbal, visibly curious. Strangers tell you things in checkout lines. You seem younger than your age for most of your life.',
  cancer: 'You come across softer than you are: approachable, receptive, a safe place to land. People confide fast; your boundaries decide what happens next.',
  leo: 'You register as warm and slightly luminous; people assume confidence even on your worst day. The entrance is noticed. So is the exit.',
  virgo: 'You present as composed, precise, quietly evaluating, the competent one. People bring you their broken things: plans, sentences, occasionally lives.',
  libra: 'You arrive agreeable, polished, easy to seat next to anyone. The diplomacy is real, but so is the steel it gracefully upholsters.',
  scorpio: 'You read as private and magnetic. People feel watched, in a way most of them like. You get told "I thought you were intimidating" for life.',
  sagittarius: 'You come across open, funny, and about to suggest something. Strangers assume you know the good spots. You usually do.',
  capricorn: 'You present older than your years early on, then apparently stop aging out of spite. First impression: serious, capable, dry, the one who read the contract.',
  aquarius: 'You register as interesting before friendly: original angle, unbothered air, allergic to the expected. People remember what you said.',
  pisces: 'You arrive gentle and a little unplaceable; people project freely onto the soft focus. Your attention feels like empathy because it is.',
};

/**
 * Natal-Saturn readings for the return calculator: what the audit tends
 * to examine, by the sign Saturn held at birth. Same register as above.
 */
export const SATURN_RETURN: Table = {
  aries: 'Saturn in Aries spent your twenties teaching you to act under restraint. Every impulsive start that collapsed was tuition. The return audits independence: which of the things you started are actually yours, built to your specifications, and which were just fast exits.',
  taurus: 'You have been building security the slow way, and mistrusting anything you didn’t earn brick by brick. The return audits ownership: what you keep because it holds you up, and what you keep because letting go feels like losing.',
  gemini: 'Saturn here disciplines a quick mind: the scattered interests, the unfinished courses, the ideas explained brilliantly and shipped never. The return audits your words: which conversations became craft, which promises became a body of work.',
  cancer: 'Saturn in Cancer builds walls around soft things and calls it responsibility. The return audits home: the family you came from, the one you are making, and the difference between protecting people and managing them.',
  leo: 'You have been earning the spotlight the hard way, suspicious of applause you didn’t work for. The return audits recognition: the difference between attention and respect, and whether the performance still has you in it.',
  virgo: 'Saturn in Virgo doubles the standards and triples the checklist. The return audits rigor itself: where precision genuinely serves the work, and where it became fear wearing a lab coat.',
  libra: 'Saturn does some of its best work in Libra. Commitments here are chosen slowly and honored long. The return audits your contracts: which relationships are load-bearing, which are decorative, and what fairness actually costs.',
  scorpio: 'You hold things (feelings, information, grudges, people) with a grip that took decades to learn. The return audits control: what loosens when you finally let it, and what was never yours to carry.',
  sagittarius: 'Saturn in Sagittarius tests belief against experience, one disillusionment at a time. The return audits conviction: which of your twenties’ certainties survived contact with the world, and what you actually stand on now.',
  capricorn: 'Saturn is home in Capricorn, and the climb has been the plan since before you could name it. The return audits the ladder: whether it leans against the right wall, and who you were becoming while you climbed.',
  aquarius: 'Saturn ruled Aquarius long before Uranus arrived, and it shows: your structures serve systems, groups, the long future. The return audits allegiance: which communities deserve your architecture, and where detachment became absence.',
  pisces: 'Saturn in Pisces builds levees in open water, boundaries around a compassion that would otherwise take everything on. The return audits the flood line: where softness is your actual strength, and where it became leakage nobody thanked you for.',
};

export function bigThree(kind: 'sun' | 'moon' | 'rising', slug: string): string {
  const table = kind === 'sun' ? SUN : kind === 'moon' ? MOON : RISING;
  return table[slug] ?? '';
}
