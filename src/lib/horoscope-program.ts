/**
 * Deterministic build-time horoscope program.
 *
 * This module never computes astronomy and never invents a missing transit.
 * It accepts validated daily snapshots and a normalized 2027 event catalog,
 * maps those facts through whole-sign solar houses, and composes curated copy.
 * Missing periods return an explicit `insufficient-evidence` reading so a page
 * generator can hold publication instead of filling the gap with vague prose.
 */
import {
  HOUSE_THEME,
  dailyBodyFactId,
  dailyEventFactId,
  dailyHouseFactId,
  solarHouse,
  type Daily,
  type DailyBody,
  type DailyEvent,
} from './daily';
import { validateDailyFacts } from './daily-publication';
import { SIGN_SLUGS } from './signs';
import type {
  BuildHoroscopeProgramInput,
  HoroscopeEvidenceReceipt,
  HoroscopePassage,
  HoroscopeProgram,
  HoroscopeProgramEvent,
  HoroscopeProgramViolation,
  HoroscopeReading,
  HoroscopeSign,
  HoroscopeSignProgram,
  HoroscopeSurface,
} from './horoscope-program-types';

export type {
  BuildHoroscopeProgramInput,
  HoroscopeEvidenceReceipt,
  HoroscopePassage,
  HoroscopeProgram,
  HoroscopeProgramEvent,
  HoroscopeProgramViolation,
  HoroscopeReading,
  HoroscopeSign,
  HoroscopeSignProgram,
  HoroscopeSurface,
} from './horoscope-program-types';

export const HOROSCOPE_PROGRAM_SCHEMA = 'zodiacs.horoscope-program.v1' as const;
export const HOROSCOPE_PROGRAM_RENDERER = 'zodiacs.horoscope-program-renderer.v9' as const;

export const HOROSCOPE_WORD_BOUNDS: Record<HoroscopeSurface, { min: number; max: number }> = {
  today: { min: 90, max: 140 },
  tomorrow: { min: 90, max: 140 },
  weekly: { min: 200, max: 300 },
  love: { min: 60, max: 100 },
  career: { min: 60, max: 100 },
  'yearly-2027': { min: 1_200, max: 1_800 },
};

export const HOROSCOPE_DISTINCTNESS_LIMITS: Record<HoroscopeSurface, number> = {
  today: 0.4,
  tomorrow: 0.4,
  weekly: 0.55,
  love: 0.55,
  career: 0.55,
  'yearly-2027': 0.72,
};

const MASTER_BRIEF_BANNED = [
  /\bdelve\b/iu,
  /\bunlock\b/iu,
  /\bembark\b/iu,
  /\btapestr(?:y|ies)\b/iu,
  /\bvibrant\b/iu,
  /\belevat(?:e|es|ed|ing|ion)\b/iu,
  /\bempower(?:s|ed|ing|ment)?\b/iu,
  /\bharness(?:es|ed|ing)?\b/iu,
  /\bin today[’']s world\b/iu,
] as const;

const UNSAFE_CLAIMS = [
  /\b(?:guaranteed|destined|inevitable|will definitely|certain to)\b/iu,
  /\b(?:diagnos(?:e|is)|cure|medication|pregnan(?:t|cy)|fertility)\b/iu,
  /\b(?:buy|sell|trade|invest(?:ment|ing)?)\b/iu,
  /\b(?:lawsuit|legal outcome|guilty|innocent)\b/iu,
] as const;

const BACKSTAGE_COPY = /\b(?:deterministic|noon[- ]UTC snapshot|verified position|source receipts?|proportionate to the evidence|supplied (?:day|week|position|snapshot)|event catalog|solar-house method)\b/iu;
const KITCHEN_FIRST_OPENING = /^(?:the\s+)?(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|new moon|full moon|solar eclipse|lunar eclipse)\b|(?:\bUTC\b|\d+(?:\.\d+)?°|\bsolar house\b)/iu;

const CANONICAL_SIGNS = new Set<string>(SIGN_SLUGS);
const CANONICAL_EVENT_KINDS = new Set(['ingress', 'lunation', 'station', 'aspect', 'eclipse']);
const SURFACES: readonly HoroscopeSurface[] = [
  'today', 'tomorrow', 'weekly', 'love', 'career', 'yearly-2027',
];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

interface SignRegister {
  daily: string;
  weekly: string;
  love: string;
  career: string;
  year: string;
  test: string;
}

const SIGN_REGISTER: Record<HoroscopeSign, SignRegister> = {
  aries: {
    daily: 'a clean first move matters more than a dramatic sprint',
    weekly: 'sequence the week before charging at its loudest moment',
    love: 'directness works when it also leaves room for an answer',
    career: 'initiative is useful once the target is specific',
    year: 'momentum needs a destination, not simply more speed',
    test: 'name the first workable move and leave the grand gesture alone',
  },
  taurus: {
    daily: 'steady attention can reveal which pressure is real and which can wait',
    weekly: 'protect the useful rhythm while making one deliberate adjustment',
    love: 'reliability says more than a perfectly staged reassurance',
    career: 'durable progress begins with the resource already in hand',
    year: 'change becomes usable when it has a stable place to land',
    test: 'keep what is sound and alter only the part that has stopped working',
  },
  gemini: {
    daily: 'the sharp question is more valuable than another quick answer',
    weekly: 'sort the useful signal from the week’s competing messages',
    love: 'curiosity helps when the conversation is allowed to finish',
    career: 'a precise brief will carry farther than scattered cleverness',
    year: 'information becomes direction only after it is edited',
    test: 'write the question down before collecting another opinion',
  },
  cancer: {
    daily: 'care works best when it includes a boundary around your own time',
    weekly: 'let private priorities set the pace before outside demands arrive',
    love: 'tenderness is clearer when the need beneath it is named',
    career: 'quiet preparation can support a more public decision',
    year: 'security grows through choices that can hold both memory and change',
    test: 'separate what needs protection from what simply feels familiar',
  },
  leo: {
    daily: 'presence is strongest when the point is clearer than the performance',
    weekly: 'give the week a center without making every moment orbit it',
    love: 'warmth lands best when admiration travels in both directions',
    career: 'visibility helps when the work underneath it is ready',
    year: 'creative authority deepens when attention serves a real purpose',
    test: 'choose the contribution you would still value without applause',
  },
  virgo: {
    daily: 'one useful correction is enough; the whole system does not need rebuilding',
    weekly: 'edit the process where friction repeats, then let the revision run',
    love: 'care is easier to feel when it is not disguised as a critique',
    career: 'a small operational fix may matter more than a larger announcement',
    year: 'discernment is most powerful when it leaves room for the unfinished',
    test: 'fix the repeatable error and stop before precision turns punitive',
  },
  libra: {
    daily: 'balance comes from a clear choice, not from extending every negotiation',
    weekly: 'notice where agreement is useful and where it only postpones the decision',
    love: 'fairness includes saying what you want before reading the room',
    career: 'good collaboration needs terms that everyone can actually see',
    year: 'reciprocity becomes real through decisions, limits, and follow-through',
    test: 'make the fair offer once, then allow the response to carry information',
  },
  scorpio: {
    daily: 'depth is useful when it produces a fact, a boundary, or a decision',
    weekly: 'follow the consequential thread without turning every silence into evidence',
    love: 'trust grows through measured disclosure rather than a hidden test',
    career: 'concentrated effort works better than trying to control every variable',
    year: 'transformation has weight when it changes an actual arrangement',
    test: 'ask what is known before assigning meaning to what is concealed',
  },
  sagittarius: {
    daily: 'the wider view helps once today’s practical detail has a place in it',
    weekly: 'keep the horizon visible while checking the route beneath your feet',
    love: 'honesty is kindest when timing and tone are part of the truth',
    career: 'a promising direction still needs a defined next checkpoint',
    year: 'freedom expands through commitments chosen with open eyes',
    test: 'connect the large idea to one appointment, draft, or measurable step',
  },
  capricorn: {
    daily: 'responsibility is clearer when you distinguish the essential from the inherited',
    weekly: 'build around the obligation that still matters, not every old expectation',
    love: 'commitment feels warmer when effort and affection are both visible',
    career: 'authority grows through a standard you can maintain',
    year: 'ambition becomes sustainable when the structure includes recovery',
    test: 'define the minimum sound structure before adding another duty',
  },
  aquarius: {
    daily: 'the original move is the one that improves the system, not merely surprises it',
    weekly: 'test the new idea against the people and conditions it is meant to serve',
    love: 'independence and closeness can coexist when expectations are explicit',
    career: 'innovation is credible when someone else can understand and use it',
    year: 'the future gets practical through alliances, prototypes, and revision',
    test: 'explain the experiment in terms another person could repeat',
  },
  pisces: {
    daily: 'intuition becomes useful after it is given a boundary and a concrete question',
    weekly: 'make enough quiet to hear the signal, then give it a practical form',
    love: 'empathy needs a clear edge so that closeness does not become guesswork',
    career: 'imagination carries farther when the handoff and deadline are visible',
    year: 'sensitivity becomes strength through form, timing, and selective attention',
    test: 'translate the feeling into one request, sketch, boundary, or pause',
  },
};

const HOUSE_ACTION: Record<number, string> = {
  1: 'make your own position visible before reacting to the room',
  2: 'check the budget of time, attention, and material resources',
  3: 'clarify the message, route, or conversation closest to hand',
  4: 'protect the conditions that make home and private life workable',
  5: 'give play, romance, or creative work a defined place',
  6: 'choose one change that would make your daily work easier',
  7: 'put the agreement or disagreement directly on the table',
  8: 'name what is shared, owed, private, or difficult to divide',
  9: 'test the larger belief against study, distance, or direct experience',
  10: 'choose what should be visible in your work and public role',
  11: 'ask which friendship, group, or future plan still has momentum',
  12: 'leave time for rest and finishing something privately',
};

const LOVE_ACTION: Record<number, string> = {
  1: 'state your preference without turning it into a demand',
  2: 'notice whether care is supported by consistent values and effort',
  3: 'let a specific conversation replace assumptions',
  4: 'make emotional safety tangible in the shared environment',
  5: 'allow pleasure and affection to be direct rather than overmanaged',
  6: 'look at the small routines through which care is actually delivered',
  7: 'treat reciprocity as an observable practice',
  8: 'approach trust, intimacy, and shared resources with explicit terms',
  9: 'make room for different beliefs without abandoning your own',
  10: 'consider how private bonds and public obligations affect each other',
  11: 'let friendship and a shared future carry part of the relationship',
  12: 'pause before confusing empathy with responsibility for another person',
};

const CAREER_ACTION: Record<number, string> = {
  1: 'define how you want to enter the room and begin',
  2: 'review compensation, capacity, and the resources behind the plan',
  3: 'tighten the brief, message, or nearby exchange',
  4: 'stabilize the private base that supports public work',
  5: 'give authorship and creative risk an appropriate share of the schedule',
  6: 'repair the workflow before asking effort alone to solve it',
  7: 'make roles and terms clear with partners or clients',
  8: 'review shared costs, obligations, access, and accountability',
  9: 'connect the task to training, publishing, travel, or a wider field',
  10: 'put the strongest finished work where decision-makers can see it',
  11: 'use the network as a place for contribution, not only exposure',
  12: 'finish background work and protect concentration from unnecessary display',
};

const DAILY_CHECKPOINT: Record<number, Record<'today' | 'tomorrow', string>> = {
  1: {
    today: 'Choose one visible first move and make it before asking the room for permission',
    tomorrow: 'Write down the first move tonight so tomorrow begins with your own position',
  },
  2: {
    today: 'Put a number beside the cost and decide what you will not spend to force the result',
    tomorrow: 'Set tomorrow’s spending limit in time, money, or attention before the request arrives',
  },
  3: {
    today: 'Put the message in writing, then choose the smallest first move that matches it',
    tomorrow: 'Draft the question tonight and leave tomorrow enough room for a real answer',
  },
  4: {
    today: 'Name the condition home needs and protect it before volunteering more of your day',
    tomorrow: 'Clear one domestic obligation tonight so tomorrow has a usable private base',
  },
  5: {
    today: 'Reserve a real block for the person, pleasure, or draft before it becomes optional',
    tomorrow: 'Choose tomorrow’s creative or affectionate invitation and give it an actual time',
  },
  6: {
    today: 'Remove one repeated snag from the routine before adding another task',
    tomorrow: 'Prepare the tool, boundary, or handoff that will make tomorrow’s workload lighter',
  },
  7: {
    today: 'State the unsettled term plainly and leave enough silence for the other side to answer',
    tomorrow: 'Decide which agreement needs a direct question before tomorrow fills with assumptions',
  },
  8: {
    today: 'List what is shared, owed, and private before making the next commitment',
    tomorrow: 'Separate your obligation from someone else’s before tomorrow’s joint decision',
  },
  9: {
    today: 'Test the larger idea against one source, journey, class, or lived example',
    tomorrow: 'Choose the question tomorrow’s study or conversation must answer in practice',
  },
  10: {
    today: 'Finish the work you are prepared to make visible and name the standard it meets',
    tomorrow: 'Pick the result you can show tomorrow and close the gap that still weakens it',
  },
  11: {
    today: 'Ask which invitation has a real next step and decline the one that only creates motion',
    tomorrow: 'Confirm one future plan with a time, owner, or next step before tomorrow begins',
  },
  12: {
    today: 'Close one open loop and protect a quiet block from new demands',
    tomorrow: 'Leave one unfinished matter off tomorrow’s public agenda so it can settle in private',
  },
};

const DAILY_SAME_HOUSE_FOLLOW_UP: Record<number, string> = {
  1: 'After making the first move, check whether it made your position clearer before adding another',
  2: 'After setting the limit, compare the actual cost with the capacity you meant to protect',
  3: 'Once the message is sent, use the reply to decide which question still needs an answer',
  4: 'Once the home condition is named, notice whether the boundary changes the demand placed on it',
  5: 'After reserving the time, decide what would make the invitation or draft worth continuing',
  6: 'After fixing the snag, watch whether the routine becomes easier before adding more work',
  7: 'Once the unsettled term is stated, let the answer determine whether the agreement can proceed',
  8: 'After separating the obligations, decide which commitment is actually yours to make',
  9: 'Once the practical question is chosen, let the answer revise the larger idea if necessary',
  10: 'After closing the visible gap, ask whether the result is ready for the standard it will face',
  11: 'Once the next step has an owner and time, judge the future plan by whether it moves',
  12: 'After closing the open loop, notice whether the quiet restores capacity or reveals another ending',
};

const TOMORROW_MOON_ACTION: Record<number, string> = {
  1: 'Set out the first move you want to make before outside reactions set the tone',
  2: 'Decide tonight what tomorrow can cost in money, time, and attention',
  3: 'Draft the message or question now, then read it once for what is still unclear',
  4: 'Restore one part of the private base so tomorrow does not begin in borrowed urgency',
  5: 'Give tomorrow’s pleasure, affection, or creative work a protected time',
  6: 'Prepare the routine, tool, or handoff that will remove friction from the next workday',
  7: 'Identify the agreement that needs a direct answer before the day gathers speed',
  8: 'Separate the shared obligation from the part that remains yours alone',
  9: 'Choose the source, class, journey, or conversation that can test the larger idea',
  10: 'Finish one visible result tonight so tomorrow can begin with a real standard',
  11: 'Confirm which invitation or future plan has an owner and an actual next step',
  12: 'Clear space for one private conclusion before new demands enter the day',
};

const TOMORROW_DECISION: Record<number, string> = {
  1: 'Leave room to revise the opening move once new information arrives',
  2: 'Choose the resource limit the plan must respect before it can proceed',
  3: 'Name who needs the message, what they need to know, and when they need it',
  4: 'Decide which home condition is essential and which preference can remain flexible',
  5: 'Pick the invitation, person, or draft you will meet with full attention',
  6: 'Define the smallest workflow change you can observe over a complete day',
  7: 'Choose the term you will ask the other side to confirm or revise',
  8: 'Write down what is owed, what is shared, and what requires consent',
  9: 'Turn the larger belief into one question tomorrow can answer through experience',
  10: 'Select the finished work or responsibility you are willing to stand behind publicly',
  11: 'Give the group plan a next action, an owner, and a time for review',
  12: 'Protect a quiet interval long enough to distinguish recovery from avoidance',
};

const WEEKLY_CHECKPOINT: Record<number, string> = {
  1: 'At the exact contact, compare the move you intended with the one you are actually making',
  2: 'At the exact contact, compare the available resources with what the plan now costs',
  3: 'At the exact contact, reread the message and correct the instruction or assumption that changed',
  4: 'At the exact contact, check whether the private conditions still support the week outside them',
  5: 'At the exact contact, notice whether pleasure or creative work received time rather than good intentions',
  6: 'At the exact contact, inspect the recurring snag instead of treating effort as the only variable',
  7: 'At the exact contact, compare the spoken agreement with what each person is actually doing',
  8: 'At the exact contact, reconcile what is shared, owed, private, and still unresolved',
  9: 'At the exact contact, test the larger claim against a source or experience that could revise it',
  10: 'At the exact contact, judge the visible work by the standard you said it would meet',
  11: 'At the exact contact, ask whether the group or future plan has acquired a real next step',
  12: 'At the exact contact, notice what quiet resolved and what still needs a deliberate ending',
};

const LOVE_RESPONSE: Record<number, string> = {
  1: 'Say what you prefer once, then notice whether the response leaves room for both people',
  2: 'Judge the response by consistent effort and shared values, not by reassurance alone',
  3: 'Ask the specific question and let the answer replace the version you rehearsed in advance',
  4: 'Notice whether the response makes the shared space safer and more workable',
  5: 'Offer the affection or invitation directly, then let the response set the next pace',
  6: 'Watch what the response changes in the small routines through which care is delivered',
  7: 'Compare what was offered with what was returned instead of translating the response into a hidden riddle',
  8: 'Let the response clarify what can be shared, what stays private, and what needs a firmer term',
  9: 'Listen for the belief behind the response without abandoning the position you actually hold',
  10: 'Notice whether the response can coexist with the public obligations already on the table',
  11: 'Ask whether the response supports both the friendship and the future being discussed',
  12: 'Let the response belong to the other person instead of turning empathy into responsibility for it',
};

const CAREER_REVIEW: Record<number, string> = {
  1: 'Make the opening move revisitable by naming what would justify the next one',
  2: 'Keep the choice revisitable by recording its real cost in money, time, and capacity',
  3: 'Put the choice in a brief another person can question before the message hardens into policy',
  4: 'Choose a work rhythm you can revise without destabilizing the private base beneath it',
  5: 'Give the draft a review point before visibility turns an experiment into a fixed promise',
  6: 'Change one part of the workflow and watch the repeatable result before scaling it',
  7: 'Write the role, term, and review date so the agreement can change through evidence',
  8: 'Record shared costs and ownership now so revision does not become a dispute later',
  9: 'Define which new evidence from training, travel, or a wider field would change the choice',
  10: 'Set a visible review standard before treating this professional direction as permanent',
  11: 'Give the collaboration an owner and next checkpoint so the network can improve it',
  12: 'Protect a private review interval before unfinished work is made public',
};

const HOUSE_SECTION: Record<number, string> = {
  1: 'identity and first moves',
  2: 'money and self-worth',
  3: 'messages and learning',
  4: 'home and family',
  5: 'creativity, pleasure, and romance',
  6: 'routines and workload',
  7: 'partnerships and agreements',
  8: 'shared commitments and intimacy',
  9: 'study and wider horizons',
  10: 'career and visibility',
  11: 'friends and future plans',
  12: 'rest and closure',
};

const HOUSE_DECISION: Record<number, string> = {
  1: 'Decide what you want to begin, and what you are willing to be known for beginning.',
  2: 'Put a number beside the cost, the available capacity, and the value you expect in return.',
  3: 'Write the message plainly, confirm the route, and ask the question that would prevent avoidable confusion.',
  4: 'Before agreeing to another plan, check what you need at home and make time for it.',
  5: 'Reserve time for the person, pleasure, or creative draft before the calendar treats it as optional.',
  6: 'Remove one repeated snag from the routine before adding another promise to the week.',
  7: 'State the term that is still vague and give the other person a real chance to answer it.',
  8: 'List what is shared, what is owed, and what must remain private before making the next commitment.',
  9: 'Choose the course, journey, publication, or conversation that could test the larger idea in real life.',
  10: 'Choose the finished work, standard, or responsibility you are prepared to make visible.',
  11: 'Choose one friendship or group plan to follow up on, and agree on a time for the next step.',
  12: 'Close one open loop, protect a quiet block, and let unfinished background work stay out of public view.',
};

interface YearEditorialProfile {
  opening: string;
  pacing: string;
  relationships: string;
  work: string;
  privateLife: string;
  close: string;
}

const YEAR_EDITORIAL: Record<HoroscopeSign, YearEditorialProfile> = {
  aries: {
    opening: 'This is not a year for proving how quickly you can move. It is a year for deciding which direction deserves your force, then building enough support to stay with it.',
    pacing: 'Move in defined rounds: act, check the result, and adjust before the next push.',
    relationships: 'Directness is one of your strengths, but speed can turn a conversation into a conclusion before the other person has entered it.',
    work: 'Initiative matters most when the target, authority, and finish line are visible to everyone involved.',
    privateLife: 'Recovery is part of the structure, especially when urgency makes every request sound equally important.',
    close: 'End the year with fewer active fronts and a clearer reason for each one that remains.',
  },
  taurus: {
    opening: 'Your 2027 is less about defending the familiar than deciding what is genuinely worth keeping. Stability becomes useful when it can absorb one deliberate change without losing its center.',
    pacing: 'Give each adjustment a place to land before deciding whether the next one is necessary.',
    relationships: 'Consistency still matters, but it needs to include honest updates when a need, limit, or shared value has changed.',
    work: 'Durable progress comes from knowing what the plan consumes as well as what it promises to produce.',
    privateLife: 'Comfort should restore you, not quietly preserve an arrangement that asks too much.',
    close: 'Finish with a smaller set of commitments that feel solid because they have been tested, not merely repeated.',
  },
  gemini: {
    opening: 'The volume of information is not the story of your year. The story is what happens when you edit the noise into a question, a decision, and language another person can use.',
    pacing: 'Collect less indiscriminately and leave time to compare what the evidence is actually saying.',
    relationships: 'Curiosity creates closeness when it is followed by listening rather than a quick change of subject.',
    work: 'Your best idea needs a brief, an owner, and a handoff before its cleverness becomes useful to a team.',
    privateLife: 'A quieter base will help you tell the difference between genuine interest and nervous motion.',
    close: 'Keep the conversations that changed your mind and release the ones that only kept you busy.',
  },
  cancer: {
    opening: '2027 asks you to define security in present-tense terms. Memory can inform the choice, but the home, bond, or responsibility must also support the life you are living now.',
    pacing: 'Let private priorities set the pace, then make outside commitments from the capacity that remains.',
    relationships: 'Care becomes clearer when you name the need underneath it and stop asking another person to infer the boundary.',
    work: 'Preparation is valuable, but there comes a point when the finished work needs a public place and a direct ask.',
    privateLife: 'Protecting your inner life does not require preserving every family role or emotional habit unchanged.',
    close: 'Carry forward the forms of belonging that can hold both tenderness and an honest limit.',
  },
  leo: {
    opening: 'The question in 2027 is not whether you can command attention. It is what your attention is in service of, and whether the work underneath the presentation deserves a longer life.',
    pacing: 'Choose a center for each season and allow supporting work to remain supporting work.',
    relationships: 'Warmth lands differently when admiration travels both ways and neither person has to perform for reassurance.',
    work: 'Visibility helps when it reveals authorship, preparation, and a standard you can continue to meet after the first response.',
    privateLife: 'Not every meaningful act needs an audience; private creative time may protect the quality of what you later share.',
    close: 'Measure the year by the contribution you would still value if the applause arrived late or not at all.',
  },
  virgo: {
    opening: 'Your 2027 does not need a total overhaul. It needs precise edits where the same friction keeps returning, followed by enough patience to see whether the new process can live outside the notebook.',
    pacing: 'Make one useful correction at a time and resist turning every unfinished edge into an emergency.',
    relationships: 'Care is easier to receive when help is offered as help, not hidden inside an unsolicited review.',
    work: 'The strongest operational improvement is the one another person can understand, repeat, and maintain without you standing over it.',
    privateLife: 'Leave some room unoptimized so rest, affection, and ordinary mess can exist without becoming another assignment.',
    close: 'Keep the systems that made life kinder and retire the ones that merely made you more vigilant.',
  },
  libra: {
    opening: 'Balance in 2027 will come from decisions, not from keeping every option in negotiation. The year rewards agreements whose terms are visible enough to test in ordinary life.',
    pacing: 'Make the fair offer once, notice the response, and let that information shape the next move.',
    relationships: 'Reciprocity becomes real when your own preference is on the table before you begin accommodating someone else’s.',
    work: 'Collaboration improves when credit, responsibility, timing, and the right to revise are named early.',
    privateLife: 'Peace at home cannot depend on your ability to absorb every tension before anyone else notices it.',
    close: 'End the year with agreements that can survive clarity and with fewer negotiations that exist only to postpone a choice.',
  },
  scorpio: {
    opening: '2027 favors depth that changes an actual arrangement. Insight matters, but the decisive step is a fact confirmed, a boundary stated, a responsibility reassigned, or trust rebuilt through visible behavior.',
    pacing: 'Follow the consequential thread and leave the surrounding silences alone until they produce real information.',
    relationships: 'Measured disclosure will tell you more than a hidden test, especially when intimacy and shared resources overlap.',
    work: 'Concentrated effort has more leverage than trying to anticipate and control every variable around the work.',
    privateLife: 'Privacy should protect restoration and discernment, not become a place where an avoidable decision waits indefinitely.',
    close: 'Keep what became more honest under examination and stop feeding mysteries that never became facts.',
  },
  sagittarius: {
    opening: 'The horizon matters in 2027, but the route deserves equal attention. A belief becomes useful when it can survive contact with a deadline, a budget, a journey, or another person’s informed question.',
    pacing: 'Pair every large direction with a checkpoint close enough to change the route while it still matters.',
    relationships: 'Honesty works best when timing and tone are treated as part of the truth rather than optional packaging.',
    work: 'A promising direction needs a defined audience, practical sequence, and measure of progress before expansion helps.',
    privateLife: 'Freedom may require a quieter place to think and a few chosen commitments that reduce needless improvisation.',
    close: 'Take forward the commitments that widened your life in practice, not only the ideas that sounded expansive.',
  },
  capricorn: {
    opening: 'The strongest structure in 2027 is not the one carrying the most weight. It is the one that makes the essential work repeatable, exposes an outdated duty, and includes recovery before exhaustion writes the schedule.',
    pacing: 'Build the minimum sound structure first, then add only what proves it belongs there.',
    relationships: 'Commitment feels warmer when effort and affection are both visible, rather than one being used as evidence for the other.',
    work: 'Authority grows through a standard you can maintain and delegate, not through becoming the permanent exception to every limit.',
    privateLife: 'A private counterweight is practical infrastructure; home, sleep, and unclaimed time keep ambition from becoming brittle.',
    close: 'Finish with a structure that can hold your ambition without requiring you to disappear inside its maintenance.',
  },
  aquarius: {
    opening: 'Originality is not the finish line of your 2027. The useful future is the one that survives a prototype, serves real people, and becomes clear enough for someone else to question or repeat.',
    pacing: 'Test the new idea in public-sized pieces, then revise from observed use rather than theory alone.',
    relationships: 'Independence and closeness can coexist when expectations are explicit and neither person must guess what distance means.',
    work: 'Innovation earns trust through legible choices, useful documentation, and room for collaborators to improve the design.',
    privateLife: 'Solitude should restore your capacity to participate, not become an automatic answer to every difficult exchange.',
    close: 'Keep the alliances and experiments that became more useful through contact with reality.',
  },
  pisces: {
    opening: 'Sensitivity becomes directional in 2027 when it has a form. A feeling, image, or intuition needs a boundary, a concrete question, and a place in the day before it can guide a choice.',
    pacing: 'Make enough quiet to hear the signal, then translate it into one request, draft, boundary, or pause.',
    relationships: 'Empathy supports connection when it does not require you to become responsible for what another person will not name.',
    work: 'Imagination travels farther when the scope, deadline, and handoff are clear enough to protect the original idea.',
    privateLife: 'Rest needs an edge around it so that retreat restores you instead of dissolving the distinction between your needs and everyone else’s.',
    close: 'Carry forward the forms that gave your sensitivity somewhere honest and useful to go.',
  },
};

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function uncap(value: string): string {
  return value.charAt(0).toLocaleLowerCase('en') + value.slice(1);
}

function readerList(values: readonly string[]): string {
  const unique = [...new Set(values)];
  if (unique.length <= 1) return unique[0] ?? '';
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(', ')}, and ${unique.at(-1)}`;
}

export function horoscopeWordCount(text: string): number {
  return text.normalize('NFKC').match(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function tokens(text: string): string[] {
  return text.normalize('NFKC').toLocaleLowerCase('en')
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function horoscopeShingleJaccard(leftText: string, rightText: string, width = 3): number {
  const make = (text: string): Set<string> => {
    const values = tokens(text);
    if (values.length < width) return new Set(values.length ? [values.join(' ')] : []);
    return new Set(values.slice(0, values.length - width + 1).map((_, index) => (
      values.slice(index, index + width).join(' ')
    )));
  };
  const left = make(leftText);
  const right = make(rightText);
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function isoWeek(date: string): { from: string; through: string; dates: string[] } {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const mondayOffset = (parsed.getUTCDay() + 6) % 7;
  const from = addDays(date, -mondayOffset);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(from, index));
  return { from, through: dates[6], dates };
}

function dateLabel(dateOrInstant: string): string {
  const parsed = new Date(dateOrInstant.length === 10 ? `${dateOrInstant}T00:00:00.000Z` : dateOrInstant);
  return `${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCDate()}, ${parsed.getUTCFullYear()}`;
}

function timeLabel(at: string): string {
  return `${at.slice(11, 16)} UTC`;
}

function factToken(value: string): string {
  return value.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function violation(ruleId: string, path: string, message: string): HoroscopeProgramViolation {
  return { ruleId, path, message };
}

export function validateHoroscopeProgramInput(
  input: BuildHoroscopeProgramInput,
): HoroscopeProgramViolation[] {
  const failures: HoroscopeProgramViolation[] = [];
  if (!isDate(input.anchorDate)) {
    failures.push(violation('INPUT-DATE', 'input.anchorDate', 'anchorDate must be a real YYYY-MM-DD UTC date'));
  }
  if (!Array.isArray(input.dailySnapshots)) {
    failures.push(violation('INPUT-SNAPSHOTS', 'input.dailySnapshots', 'dailySnapshots must be an array'));
  } else {
    const dates = new Set<string>();
    input.dailySnapshots.forEach((daily, index) => {
      const path = `input.dailySnapshots[${index}]`;
      if (dates.has(daily?.date)) {
        failures.push(violation('INPUT-DUPLICATE-DATE', `${path}.date`, `duplicate daily snapshot ${daily.date}`));
      }
      dates.add(daily?.date);
      for (const failure of validateDailyFacts(daily)) {
        failures.push(violation(`INPUT-${failure.ruleId}`, `${path}.${failure.path}`, failure.message));
      }
    });
  }

  if (input.yearlyEvents !== undefined && !Array.isArray(input.yearlyEvents)) {
    failures.push(violation('INPUT-YEAR-EVENTS', 'input.yearlyEvents', 'yearlyEvents must be an array when supplied'));
  } else {
    const identities = new Set<string>();
    (input.yearlyEvents ?? []).forEach((event, index) => {
      const path = `input.yearlyEvents[${index}]`;
      if (!CANONICAL_EVENT_KINDS.has(event.kind)) {
        failures.push(violation('INPUT-EVENT-KIND', `${path}.kind`, `unsupported event kind ${String(event.kind)}`));
      }
      const isYearInstant = isInstant(event.at) && event.at.slice(0, 4) === '2027';
      const isAdjacentStationBoundary = event.kind === 'station'
        && isInstant(event.at)
        && (event.at.slice(0, 4) === '2026' || event.at.slice(0, 4) === '2028');
      if (!isYearInstant && !isAdjacentStationBoundary) {
        failures.push(violation(
          'INPUT-EVENT-INSTANT',
          `${path}.at`,
          'yearly event must use a canonical 2027 instant; station boundaries may use adjacent 2026/2028 instants',
        ));
      }
      for (const [key, value] of [['sign', event.sign], ['aSign', event.aSign], ['bSign', event.bSign]] as const) {
        if (value !== undefined && !CANONICAL_SIGNS.has(value)) {
          failures.push(violation('INPUT-EVENT-SIGN', `${path}.${key}`, `unsupported sign ${value}`));
        }
      }
      if (['ingress', 'lunation', 'station', 'eclipse'].includes(event.kind) && !event.sign) {
        failures.push(violation('INPUT-EVENT-SIGN', `${path}.sign`, `${event.kind} requires a sign`));
      }
      if (event.kind === 'ingress' && !event.planet) {
        failures.push(violation('INPUT-EVENT-BODY', `${path}.planet`, 'ingress requires a planet'));
      }
      if (event.kind === 'station' && (!event.planet || !['retrograde', 'direct'].includes(event.type ?? ''))) {
        failures.push(violation('INPUT-EVENT-STATION', path, 'station requires a planet and retrograde/direct type'));
      }
      if (event.kind === 'lunation' && !['new', 'full'].includes(event.type ?? '')) {
        failures.push(violation('INPUT-EVENT-LUNATION', `${path}.type`, 'lunation requires new/full type'));
      }
      if (event.kind === 'eclipse' && !['solar', 'lunar'].includes(event.type ?? '')) {
        failures.push(violation('INPUT-EVENT-ECLIPSE', `${path}.type`, 'eclipse requires solar/lunar type'));
      }
      if (event.kind === 'aspect' && (!event.a || !event.b || !event.type || !event.aSign || !event.bSign)) {
        failures.push(violation('INPUT-EVENT-ASPECT', path, 'aspect requires both bodies, type, and both signs'));
      }
      if (event.kind === 'aspect' && event.orb !== 0) {
        failures.push(violation(
          'INPUT-EVENT-ASPECT-ORB',
          `${path}.orb`,
          'exact aspect must explicitly use a zero-degree orb',
        ));
      }
      for (const [key, value] of [['degree', event.degree], ['aDegree', event.aDegree], ['bDegree', event.bDegree]] as const) {
        if (value !== undefined && (!Number.isFinite(value) || value < 0 || value >= 30)) {
          failures.push(violation('INPUT-EVENT-DEGREE', `${path}.${key}`, 'degree must be finite and in [0, 30)'));
        }
      }
      const identity = JSON.stringify(event);
      if (identities.has(identity)) failures.push(violation('INPUT-EVENT-DUPLICATE', path, 'duplicate yearly event'));
      identities.add(identity);
    });
  }
  return failures;
}

class EvidenceCatalog {
  private readonly receipts = new Map<string, HoroscopeEvidenceReceipt>();

  position(daily: Daily, body: DailyBody, sunSign: HoroscopeSign): string[] {
    const sourceId = dailyBodyFactId(daily.date, body);
    this.receipts.set(sourceId, {
      id: sourceId,
      kind: 'body-position',
      sourceId: `daily-snapshot:${daily.date}:1200z`,
      label: `${body.body} ${body.degree.toFixed(1)}° ${cap(body.sign)}${body.retrograde ? ', retrograde' : ''} at 12:00 UTC`,
      at: daily.snapshotAt ?? `${daily.date}T12:00:00.000Z`,
      body: body.body,
      sign: body.sign,
      degree: body.degree,
      moonPhase: body.body === 'Moon' ? daily.moon.phase : undefined,
      retrograde: body.retrograde,
    });
    const house = solarHouse(body.sign, sunSign);
    const houseId = dailyHouseFactId(daily.date, sunSign, sourceId, house);
    this.receipts.set(houseId, {
      id: houseId,
      kind: 'solar-house',
      sourceId,
      sourceFactId: sourceId,
      label: `${body.body} in ${cap(body.sign)} maps to ${cap(sunSign)} solar house ${house}`,
      at: daily.snapshotAt ?? `${daily.date}T12:00:00.000Z`,
      body: body.body,
      sign: body.sign,
      sunSign,
      house,
    });
    return [sourceId, houseId];
  }

  event(
    event: HoroscopeProgramEvent,
    sunSign: HoroscopeSign,
    source: { date?: string; sourceId: string },
  ): string[] {
    const eventId = source.date
      ? dailyEventFactId(source.date, event as DailyEvent)
      : `fact:2027:event:${event.kind}:${event.at}:${factToken(eventIdentity(event))}`;
    const label = eventLabel(event);
    this.receipts.set(eventId, {
      id: eventId,
      kind: 'sky-event',
      sourceId: event.sourceId ?? source.sourceId,
      label,
      at: event.at,
      body: event.planet ?? event.a ?? (event.kind === 'eclipse' || event.kind === 'lunation' ? 'Moon' : undefined),
      eventKind: event.kind,
      eventType: event.type,
      a: event.a,
      b: event.b,
      sign: event.sign,
      degree: event.degree,
      orb: event.orb,
      retrograde: event.retrograde,
    });
    const refs = [eventId];
    const signs = event.sign
      ? [{ sign: event.sign, body: event.planet ?? (event.kind === 'lunation' || event.kind === 'eclipse' ? 'Moon' : undefined) }]
      : [
          ...(event.aSign ? [{ sign: event.aSign, body: event.a }] : []),
          ...(event.bSign ? [{ sign: event.bSign, body: event.b }] : []),
        ];
    for (const placement of signs) {
      const house = solarHouse(placement.sign, sunSign);
      const houseId = `derived:${event.at.slice(0, 10)}:solar-house:${sunSign}:h${house}:${factToken(eventId)}:${placement.body ?? 'event'}`;
      this.receipts.set(houseId, {
        id: houseId,
        kind: 'solar-house',
        sourceId: eventId,
        sourceFactId: eventId,
        label: `${placement.body ?? cap(event.kind)} in ${cap(placement.sign)} maps to ${cap(sunSign)} solar house ${house}`,
        at: event.at,
        body: placement.body,
        eventKind: event.kind,
        sign: placement.sign,
        orb: event.orb,
        sunSign,
        house,
      });
      refs.push(houseId);
    }
    return refs;
  }

  values(): HoroscopeEvidenceReceipt[] {
    return [...this.receipts.values()].sort((left, right) => left.id.localeCompare(right.id));
  }
}

function eventIdentity(event: HoroscopeProgramEvent): string {
  if (event.kind === 'aspect') return `${event.a}-${event.type}-${event.b}`;
  return `${event.planet ?? event.type ?? 'moon'}-${event.sign ?? 'unknown'}`;
}

function eventLabel(event: HoroscopeProgramEvent): string {
  const degree = event.degree === undefined ? '' : ` at ${event.degree.toFixed(1)}°`;
  if (event.kind === 'ingress') return `${event.planet} enters ${cap(event.sign ?? '')} on ${dateLabel(event.at)} at ${timeLabel(event.at)}`;
  if (event.kind === 'station') return `${event.planet} stations ${event.type} in ${cap(event.sign ?? '')}${degree} on ${dateLabel(event.at)} at ${timeLabel(event.at)}`;
  if (event.kind === 'lunation') return `${event.type === 'new' ? 'New Moon' : 'Full Moon'} in ${cap(event.sign ?? '')}${degree} on ${dateLabel(event.at)} at ${timeLabel(event.at)}`;
  if (event.kind === 'eclipse') return `${cap(event.type ?? '')} eclipse in ${cap(event.sign ?? '')}${degree} on ${dateLabel(event.at)} at ${timeLabel(event.at)}`;
  return `${event.a} ${event.type} ${event.b} on ${dateLabel(event.at)} at ${timeLabel(event.at)}`;
}

function eventHouses(event: HoroscopeProgramEvent, sign: HoroscopeSign): number[] {
  const signs = event.sign ? [event.sign] : [event.aSign, event.bSign].filter(Boolean) as string[];
  return [...new Set(signs.map((eventSign) => solarHouse(eventSign, sign)))];
}

function body(daily: Daily, name: string): DailyBody {
  const found = daily.bodies.find((candidate) => candidate.body === name);
  if (!found) throw new Error(`Validated ${daily.date} snapshot has no ${name}`);
  return found;
}

function eventName(event: HoroscopeProgramEvent): string {
  if (event.kind === 'ingress') return `${event.planet} entering ${cap(event.sign ?? '')}`;
  if (event.kind === 'station') return `${event.planet} stationing ${event.type} in ${cap(event.sign ?? '')}`;
  if (event.kind === 'lunation') return `${event.type === 'new' ? 'the New Moon' : 'the Full Moon'} in ${cap(event.sign ?? '')}`;
  if (event.kind === 'eclipse') return `${event.type === 'solar' ? 'the solar eclipse' : 'the lunar eclipse'} in ${cap(event.sign ?? '')}`;
  return `${event.a} ${event.type} ${event.b}`;
}

function eventSentence(event: HoroscopeProgramEvent, sign: HoroscopeSign): string {
  const houses = eventHouses(event, sign);
  if (houses.length === 2) {
    return `${eventName(event)} connects ${HOUSE_THEME[houses[0]]} with ${HOUSE_THEME[houses[1]]}.`;
  }
  const house = houses[0];
  return `${eventName(event)} brings ${HOUSE_THEME[house]} into focus.`;
}

/** The same event and houses as eventSentence, in the alternate daily frame. */
function alternateEventSentence(event: HoroscopeProgramEvent, sign: HoroscopeSign): string {
  const houses = eventHouses(event, sign);
  if (houses.length === 2) {
    return `${cap(eventName(event))} ties ${HOUSE_THEME[houses[0]]} to ${HOUSE_THEME[houses[1]]}.`;
  }
  return `${cap(eventName(event))} gives ${HOUSE_THEME[houses[0]]} extra weight.`;
}

/** "new moon", "full moon", or "waxing crescent Moon", without "new moon Moon". */
function moonPhaseLabel(phase: string): string {
  const lower = phase.toLocaleLowerCase('en');
  return lower.endsWith(' moon') ? lower : `${lower} Moon`;
}

function passage(text: string, evidenceRefs: string[], heading?: string): HoroscopePassage {
  return {
    ...(heading ? { heading } : {}),
    text: text.replace(/\s+/g, ' ').trim(),
    evidenceRefs: [...new Set(evidenceRefs)],
  };
}

function reading(
  surface: HoroscopeSurface,
  sign: HoroscopeSign,
  period: { from: string; through: string },
  title: string,
  passages: HoroscopePassage[],
): HoroscopeReading {
  const padded = padReading(surface, sign, passages);
  const text = padded.map((item) => item.text).join('\n\n');
  return {
    surface,
    sign,
    period: { ...period, utcBasis: true },
    title,
    status: 'publishable',
    passages: padded,
    text,
    wordCount: horoscopeWordCount(text),
  };
}

function fallbackReading(
  surface: HoroscopeSurface,
  sign: HoroscopeSign,
  period: { from: string; through: string },
  reason: string,
): HoroscopeReading {
  const text = `${cap(sign)} ${surface.replace('yearly-2027', '2027')} is being held because ${reason}. Zodiacs.org does not replace missing sky data with generic predictions.`;
  return {
    surface,
    sign,
    period: { ...period, utcBasis: true },
    title: `${cap(sign)} ${surface === 'yearly-2027' ? '2027 horoscope' : `${cap(surface)} horoscope`}`,
    status: 'insufficient-evidence',
    fallbackReason: reason,
    passages: [{ text, evidenceRefs: [] }],
    text,
    wordCount: horoscopeWordCount(text),
  };
}

function padReading(
  surface: HoroscopeSurface,
  sign: HoroscopeSign,
  original: HoroscopePassage[],
): HoroscopePassage[] {
  const passages = original.map((item) => ({ ...item, evidenceRefs: [...item.evidenceRefs] }));
  const { min, max } = HOROSCOPE_WORD_BOUNDS[surface];
  const profile = SIGN_REGISTER[sign];
  const sources = passages.flatMap((item) => item.evidenceRefs);
  const additions = [
    `For ${cap(sign)}, the useful test is to ${profile.test}.`,
    `Let this be the thread to follow: ${profile.daily}.`,
    `Treat the timing as an invitation to notice what is ready for attention, never as a promise.`,
    `If a theme does not match your circumstances, let it pass instead of bending the day to fit it.`,
    `Bring the symbolism down to one honest question you can act on.`,
  ];
  const initialCount = horoscopeWordCount(passages.map((item) => item.text).join(' '));
  if (surface === 'yearly-2027' && initialCount < min) {
    throw new Error(`Yearly renderer produced ${initialCount} words; editorial copy may not be padded with generic filler`);
  }
  let index = 0;
  while (horoscopeWordCount(passages.map((item) => item.text).join(' ')) < min) {
    const target = passages[index % Math.max(passages.length, 1)];
    if (!target) {
      passages.push(passage(additions[index % additions.length], sources));
    } else {
      target.text = `${target.text} ${additions[index % additions.length]}`;
    }
    index += 1;
    if (index > 80) throw new Error(`Unable to reach ${surface} minimum word count`);
  }
  const count = horoscopeWordCount(passages.map((item) => item.text).join(' '));
  if (count > max) throw new Error(`${surface} renderer produced ${count} words; maximum is ${max}`);
  return passages;
}

/**
 * `alternate` frames the same facts, house advice, and evidence in different
 * sentences. buildHoroscopeProgram asks for it only through
 * separateSimilarDailyReadings, never for an edition that is already distinct.
 */
function dailySurface(
  surface: 'today' | 'tomorrow',
  sign: HoroscopeSign,
  daily: Daily,
  catalog: EvidenceCatalog,
  alternate = false,
): HoroscopeReading {
  const profile = SIGN_REGISTER[sign];
  const moon = body(daily, 'Moon');
  const signIndex = SIGN_SLUGS.indexOf(sign);
  const secondaryName = ['Mercury', 'Venus', 'Mars', 'Saturn'][signIndex % 4];
  const secondary = body(daily, secondaryName);
  const moonHouse = solarHouse(moon.sign, sign);
  const secondaryHouse = solarHouse(secondary.sign, sign);
  const dayWord = surface === 'today' ? 'Today' : 'Tomorrow';
  const exact = daily.events[0] as HoroscopeProgramEvent | undefined;
  const period = { from: daily.date, through: daily.date };
  const title = `${cap(sign)} horoscope for ${surface === 'today' ? dateLabel(daily.date) : `tomorrow, ${dateLabel(daily.date)}`}`;
  if (alternate) {
    return reading(surface, sign, period, title, alternateDailyPassages(
      surface, sign, daily, catalog, { moon, secondary, moonHouse, secondaryHouse, exact },
    ));
  }
  const tomorrowOpening = exact
    ? `${TOMORROW_MOON_ACTION[moonHouse]}. Use the lead time to ${profile.test}.`
    : `${TOMORROW_MOON_ACTION[moonHouse]}, using the lead time to prepare the conditions around the decision before tomorrow begins.`;
  const passages = surface === 'today'
    ? [
        passage(
          `${dayWord}, ${HOUSE_ACTION[moonHouse]}. For ${cap(sign)}, ${profile.daily}. The ${daily.moon.phase.toLocaleLowerCase('en')} Moon puts ${HOUSE_THEME[moonHouse]} on the day’s agenda.`,
          catalog.position(daily, moon, sign),
        ),
        passage(
          `${HOUSE_DECISION[secondaryHouse]} In this reading, ${secondary.body}${secondary.retrograde ? ' retrograde' : ''} in ${cap(secondary.sign)} brings attention to ${HOUSE_THEME[secondaryHouse]}.`,
          catalog.position(daily, secondary, sign),
        ),
      ]
    : [
        passage(
          `${tomorrowOpening} As the ${daily.moon.phase.toLocaleLowerCase('en')} Moon develops, tomorrow’s foreground shifts toward ${HOUSE_THEME[moonHouse]}.`,
          catalog.position(daily, moon, sign),
        ),
        passage(
          `${TOMORROW_DECISION[secondaryHouse]}; ${secondary.body}${secondary.retrograde ? ' retrograde' : ''} in ${cap(secondary.sign)} is one of the conditions shaping ${HOUSE_THEME[secondaryHouse]}.`,
          catalog.position(daily, secondary, sign),
        ),
      ];
  if (exact) {
    const exactHouse = eventHouses(exact, sign)[0];
    const checkpoint = exactHouse === secondaryHouse
      ? DAILY_SAME_HOUSE_FOLLOW_UP[exactHouse]
      : DAILY_CHECKPOINT[exactHouse][surface];
    passages.push(passage(
      `${checkpoint}. ${eventSentence(exact, sign)}`,
      catalog.event(exact, sign, { date: daily.date, sourceId: daily.eventsSource ?? `daily-snapshot:${daily.date}` }),
    ));
  } else {
    const quietFocus = moonHouse === secondaryHouse
      ? `Keep ${HOUSE_THEME[moonHouse]} centered in the choice`
      : `Connect ${HOUSE_THEME[moonHouse]} with ${HOUSE_THEME[secondaryHouse]}`;
    passages.push(passage(
      `${quietFocus}; ${profile.test}.`,
      [...catalog.position(daily, moon, sign), ...catalog.position(daily, secondary, sign)],
    ));
  }
  return reading(surface, sign, period, title, passages);
}

function alternateDailyPassages(
  surface: 'today' | 'tomorrow',
  sign: HoroscopeSign,
  daily: Daily,
  catalog: EvidenceCatalog,
  facts: {
    moon: DailyBody;
    secondary: DailyBody;
    moonHouse: number;
    secondaryHouse: number;
    exact: HoroscopeProgramEvent | undefined;
  },
): HoroscopePassage[] {
  const { moon, secondary, moonHouse, secondaryHouse, exact } = facts;
  const profile = SIGN_REGISTER[sign];
  const phase = moonPhaseLabel(daily.moon.phase);
  const placement = `${secondary.body}${secondary.retrograde ? ' retrograde' : ''} in ${cap(secondary.sign)}`;
  const tomorrowOpening = exact
    ? `${TOMORROW_MOON_ACTION[moonHouse]}. As part of that preparation, ${profile.test}.`
    : `${TOMORROW_MOON_ACTION[moonHouse]}; preparing ahead keeps the decision from being made in a rush.`;
  const passages = surface === 'today'
    ? [
        passage(
          `First, ${HOUSE_ACTION[moonHouse]}. For ${cap(sign)}, ${profile.daily}. Under the ${phase}, today’s agenda starts with ${HOUSE_THEME[moonHouse]}.`,
          catalog.position(daily, moon, sign),
        ),
        passage(
          `${HOUSE_DECISION[secondaryHouse]} ${placement} keeps ${HOUSE_THEME[secondaryHouse]} in view through the day.`,
          catalog.position(daily, secondary, sign),
        ),
      ]
    : [
        passage(
          `${tomorrowOpening} Tomorrow, the ${phase} brings ${HOUSE_THEME[moonHouse]} to the front of the day.`,
          catalog.position(daily, moon, sign),
        ),
        passage(
          `${TOMORROW_DECISION[secondaryHouse]}. ${placement} adds ${HOUSE_THEME[secondaryHouse]} to the conditions around that choice.`,
          catalog.position(daily, secondary, sign),
        ),
      ];
  if (exact) {
    const exactHouse = eventHouses(exact, sign)[0];
    const checkpoint = exactHouse === secondaryHouse
      ? DAILY_SAME_HOUSE_FOLLOW_UP[exactHouse]
      : DAILY_CHECKPOINT[exactHouse][surface];
    passages.push(passage(
      `${checkpoint}. ${alternateEventSentence(exact, sign)}`,
      catalog.event(exact, sign, { date: daily.date, sourceId: daily.eventsSource ?? `daily-snapshot:${daily.date}` }),
    ));
  } else {
    const quietFocus = moonHouse === secondaryHouse
      ? `Let ${HOUSE_THEME[moonHouse]} set the terms of the choice`
      : `Weigh ${HOUSE_THEME[moonHouse]} against ${HOUSE_THEME[secondaryHouse]}`;
    passages.push(passage(
      `${quietFocus}, then ${profile.test}.`,
      [...catalog.position(daily, moon, sign), ...catalog.position(daily, secondary, sign)],
    ));
  }
  return passages;
}

/**
 * Two signs can get the same house advice on the same day. On 9 October 2026,
 * Mars in Leo and Venus in Scorpio both fall in the third solar house for
 * Gemini and Virgo, so their shared sentence frames pushed the pair past the
 * tomorrow limit and would have blocked publication. Only when a reading is
 * too similar to an earlier sign's (canonical order), re-render it with the
 * alternate frames: the facts, advice, and evidence stay the same. Editions
 * that are already distinct stay byte-identical, and a pair the alternate
 * cannot separate is left for the validator to refuse.
 */
function separateSimilarDailyReadings(
  surface: 'today' | 'tomorrow',
  signs: HoroscopeSignProgram[],
  daily: Daily,
  catalog: EvidenceCatalog,
): void {
  const limit = HOROSCOPE_DISTINCTNESS_LIMITS[surface];
  signs.forEach((entry, index) => {
    const tooSimilar = (candidate: HoroscopeReading): boolean => signs.slice(0, index).some((earlier) => (
      horoscopeShingleJaccard(earlier.readings[surface].text, candidate.text, 3) > limit
    ));
    if (!tooSimilar(entry.readings[surface])) return;
    const alternate = dailySurface(surface, entry.sign, daily, catalog, true);
    if (!tooSimilar(alternate)) entry.readings[surface] = alternate;
  });
}

function loveSurface(sign: HoroscopeSign, daily: Daily, catalog: EvidenceCatalog): HoroscopeReading {
  const venus = body(daily, 'Venus');
  const moon = body(daily, 'Moon');
  const venusHouse = solarHouse(venus.sign, sign);
  const moonHouse = solarHouse(moon.sign, sign);
  const moonPassage = moonHouse === venusHouse
    ? `In the same relationship area, ${uncap(LOVE_RESPONSE[moonHouse])}. The Moon keeps ${HOUSE_THEME[moonHouse]} active in the emotional weather.`
    : `${cap(LOVE_ACTION[moonHouse])}. ${LOVE_RESPONSE[moonHouse]}. The Moon shifts the emotional weather toward ${HOUSE_THEME[moonHouse]}.`;
  return reading('love', sign, { from: daily.date, through: daily.date }, `${cap(sign)} love horoscope for ${dateLabel(daily.date)}`, [
    passage(
      `${cap(LOVE_ACTION[venusHouse])}. For ${cap(sign)}, ${SIGN_REGISTER[sign].love}. Venus brings ${HOUSE_THEME[venusHouse]} into the relationship foreground.`,
      catalog.position(daily, venus, sign),
    ),
    passage(
      moonPassage,
      catalog.position(daily, moon, sign),
    ),
  ]);
}

function careerSurface(sign: HoroscopeSign, daily: Daily, catalog: EvidenceCatalog): HoroscopeReading {
  const signIndex = SIGN_SLUGS.indexOf(sign);
  const primary = body(daily, ['Mercury', 'Saturn', 'Mars'][signIndex % 3]);
  const sun = body(daily, 'Sun');
  const primaryHouse = solarHouse(primary.sign, sign);
  const sunHouse = solarHouse(sun.sign, sign);
  const sunLead = sunHouse === primaryHouse
    ? `Keep ${HOUSE_SECTION[sunHouse]} anchored to one observable result.`
    : `${cap(CAREER_ACTION[sunHouse])}.`;
  return reading('career', sign, { from: daily.date, through: daily.date }, `${cap(sign)} career horoscope for ${dateLabel(daily.date)}`, [
    passage(
      `${cap(CAREER_ACTION[primaryHouse])}. For ${cap(sign)}, ${SIGN_REGISTER[sign].career}. ${primary.body}${primary.retrograde ? ' retrograde' : ''} brings ${HOUSE_THEME[primaryHouse]} into the work picture.`,
      catalog.position(daily, primary, sign),
    ),
    passage(
      `${sunLead} ${CAREER_REVIEW[sunHouse]}. The Sun widens the frame to ${HOUSE_THEME[sunHouse]}.`,
      catalog.position(daily, sun, sign),
    ),
  ]);
}

function uniqueWeekEvents(days: Daily[]): Array<{ event: HoroscopeProgramEvent; daily: Daily }> {
  const seen = new Set<string>();
  const result: Array<{ event: HoroscopeProgramEvent; daily: Daily }> = [];
  for (const daily of days) for (const event of daily.events) {
    const identity = JSON.stringify(event);
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push({ event, daily });
  }
  return result.sort((left, right) => left.event.at.localeCompare(right.event.at));
}

function weeklySurface(sign: HoroscopeSign, days: Daily[], catalog: EvidenceCatalog): HoroscopeReading {
  const start = days[0];
  const middle = days[3];
  const end = days[6];
  const startMoon = body(start, 'Moon');
  const middleMoon = body(middle, 'Moon');
  const endMoon = body(end, 'Moon');
  const startHouse = solarHouse(startMoon.sign, sign);
  const middleHouse = solarHouse(middleMoon.sign, sign);
  const endHouse = solarHouse(endMoon.sign, sign);
  const passages = [
    passage(
      `${cap(SIGN_REGISTER[sign].weekly)}. The week opens with ${HOUSE_THEME[startHouse]}, moves through ${HOUSE_THEME[middleHouse]} by Thursday, and closes on ${HOUSE_THEME[endHouse]}. Give ${HOUSE_SECTION[startHouse]} the first concrete move instead of asking one choice to settle all three areas at once.`,
      [
        ...catalog.position(start, startMoon, sign),
        ...catalog.position(middle, middleMoon, sign),
        ...catalog.position(end, endMoon, sign),
      ],
    ),
    passage(
      `Early in the week, turn toward ${HOUSE_THEME[startHouse]}: ${HOUSE_ACTION[startHouse]}, then ${uncap(HOUSE_DECISION[startHouse]).replace(/[.]$/u, '')}. Keep the ${HOUSE_SECTION[startHouse]} adjustment small enough to see what it changes before adding another.`,
      catalog.position(start, startMoon, sign),
    ),
    passage(
      `By midweek, attention shifts to ${HOUSE_THEME[middleHouse]}: ${HOUSE_ACTION[middleHouse]}, then ${uncap(HOUSE_DECISION[middleHouse]).replace(/[.]$/u, '')}.`,
      catalog.position(middle, middleMoon, sign),
    ),
  ];
  const exact = uniqueWeekEvents(days)[0];
  if (exact) {
    const exactHouses = eventHouses(exact.event, sign);
    const exactContext = eventSentence(exact.event, sign).replace(/[.]$/u, '');
    passages.push(passage(
      `${WEEKLY_CHECKPOINT[exactHouses[0]]}. ${exactContext}.`,
      catalog.event(exact.event, sign, { date: exact.daily.date, sourceId: exact.daily.eventsSource ?? `daily-snapshot:${exact.daily.date}` }),
    ));
  } else {
    const mercury = body(middle, 'Mercury');
    const mercuryHouse = solarHouse(mercury.sign, sign);
    passages.push(passage(
      `By midweek, ${HOUSE_ACTION[mercuryHouse]}. Mercury adds emphasis to ${HOUSE_THEME[mercuryHouse]}.`,
      catalog.position(middle, mercury, sign),
    ));
  }
  passages.push(passage(
    `The week closes with ${HOUSE_THEME[endHouse]}: ${HOUSE_ACTION[endHouse]}, then ${uncap(HOUSE_DECISION[endHouse]).replace(/[.]$/u, '')}. For ${cap(sign)}, the final review is to ${SIGN_REGISTER[sign].test}.`,
    catalog.position(end, endMoon, sign),
  ));
  return reading('weekly', sign, { from: start.date, through: end.date }, `${cap(sign)} weekly horoscope, ${dateLabel(start.date)}–${dateLabel(end.date)}`, passages);
}

function hasYearCoverage(events: readonly HoroscopeProgramEvent[]): boolean {
  const inYear = events.filter((event) => event.at.startsWith('2027-'));
  const kinds = new Set(inYear.map((event) => event.kind));
  const stationTypes = new Set(
    events.filter((event) => event.kind === 'station').map((event) => event.type),
  );
  return inYear.length >= 6
    && kinds.has('ingress')
    && kinds.has('eclipse')
    && kinds.has('station')
    && stationTypes.has('retrograde')
    && stationTypes.has('direct');
}

function chooseEvents(
  events: readonly HoroscopeProgramEvent[],
  sign: HoroscopeSign,
  preferredHouses: readonly number[],
  limit: number,
  offset: number,
): HoroscopeProgramEvent[] {
  const preferred = events.filter((event) => eventHouses(event, sign).some((house) => preferredHouses.includes(house)));
  const candidates = preferred.length >= limit ? preferred : [...preferred, ...events.filter((event) => !preferred.includes(event))];
  const rotated = candidates.map((_, index) => candidates[(offset + index) % candidates.length]);
  const selected: HoroscopeProgramEvent[] = [];
  const selectedHouses = new Set<number>();
  for (const event of rotated) {
    const primaryHouse = eventHouses(event, sign)[0];
    if (selectedHouses.has(primaryHouse)) continue;
    selected.push(event);
    selectedHouses.add(primaryHouse);
    if (selected.length === Math.min(limit, candidates.length)) {
      return selected.sort((left, right) => left.at.localeCompare(right.at));
    }
  }
  for (const event of rotated) {
    if (!selected.includes(event)) selected.push(event);
    if (selected.length === Math.min(limit, candidates.length)) break;
  }
  return selected.sort((left, right) => left.at.localeCompare(right.at));
}

function dominantYearHouses(
  events: readonly HoroscopeProgramEvent[],
  sign: HoroscopeSign,
): number[] {
  const counts = new Map<number, number>();
  for (const event of events) for (const house of eventHouses(event, sign)) {
    counts.set(house, (counts.get(house) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])
    .map(([house]) => house);
}

function shortDateLabel(at: string): string {
  const parsed = new Date(at);
  return `${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCDate()}`;
}

function yearEventBeat(
  event: HoroscopeProgramEvent,
  sign: HoroscopeSign,
  slot: number,
): string {
  const houses = eventHouses(event, sign);
  const primary = houses[0];
  const theme = houses.length > 1
    ? `${HOUSE_THEME[primary]} and ${HOUSE_THEME[houses[1]]}`
    : HOUSE_THEME[primary];
  const date = dateLabel(event.at);
  const actionSource = slot % 2 === 0 ? HOUSE_ACTION[primary] : HOUSE_DECISION[primary];
  const action = actionSource.charAt(0).toLocaleLowerCase('en')
    + actionSource.slice(1).replace(/[.]$/u, '');
  if (event.kind === 'eclipse') {
    const noun = event.type === 'solar' ? 'a beginning worth defining' : 'a result or limit worth naming';
    return slot % 2 === 0
      ? `Use ${eventName(event)} on ${date} as a checkpoint for ${theme}: look for ${noun}, then ${action}.`
      : `Mark ${date} for a review of ${theme} with ${eventName(event)}; identify ${noun} and ${action}.`;
  }
  if (event.kind === 'ingress') {
    return slot % 2 === 0
      ? `A longer chapter starts on ${date} as ${event.planet} enters ${cap(event.sign ?? '')}, shifting the plan around ${theme}; ${action}.`
      : `From ${date}, ${event.planet} enters ${cap(event.sign ?? '')} and keeps ${theme} in the longer-range plan, so ${action}.`;
  }
  if (event.kind === 'station') {
    const station = `${event.planet} stations ${event.type} in ${cap(event.sign ?? '')}`;
    if (event.type === 'retrograde') {
      const variants = [
        `${date} begins a review of ${theme} as ${station}; ${action}.`,
        `Circle ${date} for a second look at ${theme}: ${station}, so ${action}.`,
        `A slower pass through ${theme} starts on ${date}, when ${station}; ${action}.`,
      ];
      return variants[slot % variants.length];
    }
    const variants = [
      `Use ${date} to decide what can resume around ${theme}: ${station}, so ${action}.`,
      `A progress check for ${theme} arrives on ${date}, when ${station}; ${action}.`,
      `By ${date}, movement around ${theme} deserves a second look as ${station}; ${action}.`,
    ];
    return variants[slot % variants.length];
  }
  if (event.kind === 'lunation') {
    return `${cap(theme)} gets a short review window on ${date} with ${eventName(event)}; ${action}.`;
  }
  return `${date} links ${theme} through ${eventName(event)}; compare what changes in both areas, then ${action}.`;
}

const YEAR_PHASES = [
  { fromMonth: 0, throughMonth: 2, label: 'January–March' },
  { fromMonth: 3, throughMonth: 5, label: 'April–June' },
  { fromMonth: 6, throughMonth: 8, label: 'July–September' },
  { fromMonth: 9, throughMonth: 11, label: 'October–December' },
] as const;

function yearPhasePassage(
  sign: HoroscopeSign,
  events: readonly HoroscopeProgramEvent[],
  phaseIndex: number,
  catalog: EvidenceCatalog,
): HoroscopePassage {
  const houses = dominantYearHouses(events, sign);
  const primary = houses[0];
  const secondary = houses[1] ?? primary;
  const profile = YEAR_EDITORIAL[sign];
  const singleTheme = secondary === primary;
  const leads = singleTheme ? [
    `The first quarter is for sorting the competing priorities inside ${HOUSE_SECTION[primary]} instead of letting the loudest one set the whole pace. ${profile.pacing}`,
    `Spring tests what can move in ${HOUSE_SECTION[primary]} without weakening the structure around it; make one decision concrete enough to revisit.`,
    `The third quarter puts several close-set checkpoints inside ${HOUSE_SECTION[primary]}; give that area first claim on your attention and keep it in one coherent plan.`,
    `The final quarter consolidates what you have learned about ${HOUSE_SECTION[primary]}; keep only the response you can maintain instead of staging a last-minute reinvention.`,
  ] : [
    `The first quarter is for sorting ${HOUSE_SECTION[primary]} from ${HOUSE_SECTION[secondary]} instead of letting whichever feels urgent set the whole pace. ${profile.pacing}`,
    `Spring tests how ${HOUSE_SECTION[primary]} can move without weakening ${HOUSE_SECTION[secondary]}; make one decision concrete enough to revisit.`,
    `The third quarter puts several close-set checkpoints between ${HOUSE_SECTION[primary]} and ${HOUSE_SECTION[secondary]}; give the first area priority without losing sight of the second.`,
    `The final quarter consolidates what you have learned about ${HOUSE_SECTION[primary]} in relation to ${HOUSE_SECTION[secondary]}; keep only the response you can maintain instead of staging a last-minute reinvention.`,
  ];
  const refs = events.flatMap((event) => (
    catalog.event(event, sign, { sourceId: event.sourceId ?? 'input:yearlyEvents' })
  ));
  const beats = events.map((event, index) => yearEventBeat(event, sign, phaseIndex * 7 + index));
  return passage(
    `${leads[phaseIndex]} ${beats.join(' ')}`,
    refs,
    `${YEAR_PHASES[phaseIndex].label} · ${cap(HOUSE_SECTION[primary])}`,
  );
}

function yearThemePassage(
  sign: HoroscopeSign,
  heading: string,
  profileLead: string,
  events: readonly HoroscopeProgramEvent[],
  action: Readonly<Record<number, string>>,
  variant: number,
  catalog: EvidenceCatalog,
): HoroscopePassage {
  const [first, second = first] = events;
  const firstHouse = eventHouses(first, sign)[0];
  const secondHouse = eventHouses(second, sign)[0];
  const refs = [...events.flatMap((event) => (
    catalog.event(event, sign, { sourceId: event.sourceId ?? 'input:yearlyEvents' })
  ))];
  const firstAction = variant % 2 === 0
    ? (action[firstHouse] ?? HOUSE_ACTION[firstHouse])
    : HOUSE_DECISION[firstHouse].replace(/[.]$/u, '');
  const secondAction = variant % 2 === 0
    ? HOUSE_DECISION[secondHouse].replace(/[.]$/u, '')
    : (action[secondHouse] ?? HOUSE_ACTION[secondHouse]);
  const observableLead = [
    `For ${HOUSE_SECTION[firstHouse]}, start with what can be observed: a request, changed term, protected time, or respected limit.`,
    `Measure the capacity, ownership, deadline, and finished handoff attached to ${HOUSE_SECTION[firstHouse]}.`,
    `While handling ${HOUSE_SECTION[firstHouse]}, protect the private base through sleep, usable rooms, shared obligations, and unclaimed quiet.`,
    `Treat ${HOUSE_SECTION[firstHouse]} as personal practice by choosing one behavior you can try more than once.`,
  ][variant % 4];
  const interval = [
    `Between the dates, note what was asked, agreed, and done around ${HOUSE_SECTION[secondHouse]}; do not score the relationship by one intense day.`,
    `Between them, record what ${HOUSE_SECTION[secondHouse]} consumed, who could repeat the work, and whether the priority survived the calendar.`,
    `Between them, notice what restores capacity around ${HOUSE_SECTION[secondHouse]} and what only postpones a harder conversation.`,
    `After each marker, compare the ${HOUSE_SECTION[secondHouse]} choice with real circumstances, including a quiet or delayed result.`,
  ][variant % 4];
  const standard = [
    `For ${cap(sign)}, judge reciprocity by follow-through, not by the charge of a single day.`,
    `For ${cap(sign)}, a plan is sustainable only while capacity and ownership stay visible.`,
    `For ${cap(sign)}, a sound private structure leaves you more available to your life.`,
    `For ${cap(sign)}, keep the experiment only if it works under ordinary conditions.`,
  ][variant % 4];
  const contextualLead = `${profileLead.replace(/[.]$/u, '')}—${uncap(observableLead)}`;
  const firstCheckpoint = `The first checkpoint arrives on ${dateLabel(first.at)} with ${eventName(first)}, mapped to ${HOUSE_THEME[firstHouse]}; ${uncap(firstAction).replace(/[.]$/u, '')}.`;
  const secondCheckpoint = second === first
    ? ''
    : `A second checkpoint arrives on ${dateLabel(second.at)} with ${eventName(second)}, mapped to ${HOUSE_THEME[secondHouse]}; ${uncap(secondAction).replace(/[.]$/u, '')}.`;
  const contextualInterval = `${interval.replace(/[.]$/u, '')}—${uncap(standard)}`;
  return passage(
    `${contextualLead} ${firstCheckpoint} ${secondCheckpoint} ${contextualInterval}`,
    refs,
    heading,
  );
}

function yearlySurface(
  sign: HoroscopeSign,
  events: readonly HoroscopeProgramEvent[],
  catalog: EvidenceCatalog,
): HoroscopeReading {
  // Adjacent-year station boundaries keep overlapping retrograde periods
  // complete in the fact catalog. Reader copy remains a 2027 edition.
  const ordered = events
    .filter((event) => event.at.startsWith('2027-'))
    .sort((left, right) => left.at.localeCompare(right.at));
  const passages: HoroscopePassage[] = [];
  // Register the complete catalog, including 2026/2028 station boundaries,
  // even though only in-year events are narrated below.
  for (const event of events) {
    catalog.event(event, sign, { sourceId: event.sourceId ?? 'input:yearlyEvents' });
  }
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const ingress = ordered.find((event) => event.kind === 'ingress') ?? ordered[Math.floor(ordered.length / 2)];
  const openingRefs = [
    ...catalog.event(first, sign, { sourceId: first.sourceId ?? 'input:yearlyEvents' }),
    ...catalog.event(ingress, sign, { sourceId: ingress.sourceId ?? 'input:yearlyEvents' }),
    ...catalog.event(last, sign, { sourceId: last.sourceId ?? 'input:yearlyEvents' }),
  ];
  const firstHouse = eventHouses(first, sign)[0];
  const ingressHouse = eventHouses(ingress, sign)[0];
  const lastHouse = eventHouses(last, sign)[0];
  const openingAreas = readerList([
    HOUSE_SECTION[firstHouse],
    HOUSE_SECTION[ingressHouse],
    HOUSE_SECTION[lastHouse],
  ]);
  passages.push(passage(
    `${YEAR_EDITORIAL[sign].opening} The practical through-line is simple: ${SIGN_REGISTER[sign].year}. Your first dated checkpoint for ${HOUSE_SECTION[firstHouse]} is ${eventName(first)} on ${shortDateLabel(first.at)}. ${eventName(ingress)} on ${shortDateLabel(ingress.at)} changes the longer-range emphasis around ${HOUSE_SECTION[ingressHouse]}, while ${eventName(last)} on ${shortDateLabel(last.at)} gives ${HOUSE_SECTION[lastHouse]} a final review point. None of those dates assigns an outcome; compare ${openingAreas} with what is actually happening, then keep the choice that fits your circumstances.`,
    openingRefs,
    `The shape of ${cap(sign)}’s 2027`,
  ));

  for (const [phaseIndex, phase] of YEAR_PHASES.entries()) {
    const phaseEvents = ordered.filter((event) => {
      const month = new Date(event.at).getUTCMonth();
      return month >= phase.fromMonth && month <= phase.throughMonth;
    });
    if (phaseEvents.length) passages.push(yearPhasePassage(sign, phaseEvents, phaseIndex, catalog));
  }

  const signOffset = SIGN_SLUGS.indexOf(sign);
  passages.push(yearThemePassage(
    sign,
    'Love, friendship, and clear terms',
    YEAR_EDITORIAL[sign].relationships,
    chooseEvents(ordered, sign, [5, 7, 8, 11], 2, signOffset),
    LOVE_ACTION,
    0,
    catalog,
  ));
  passages.push(yearThemePassage(
    sign,
    'Work, money, and sustainable authority',
    YEAR_EDITORIAL[sign].work,
    chooseEvents(ordered, sign, [2, 6, 10, 11], 2, signOffset + 2),
    CAREER_ACTION,
    1,
    catalog,
  ));
  passages.push(yearThemePassage(
    sign,
    'Home, rest, and the private load',
    YEAR_EDITORIAL[sign].privateLife,
    chooseEvents(ordered, sign, [1, 4, 12], 2, signOffset + 4),
    HOUSE_ACTION,
    2,
    catalog,
  ));
  passages.push(yearThemePassage(
    sign,
    'Your own direction',
    `Personal growth is most useful when it changes a choice you can see; for ${cap(sign)}, ${SIGN_REGISTER[sign].daily}.`,
    chooseEvents(ordered, sign, [1, 5, 9], 2, signOffset + 6),
    HOUSE_ACTION,
    3,
    catalog,
  ));

  passages.push(passage(
    `${YEAR_EDITORIAL[sign].close} Put three events in your calendar now—${eventName(first)} on ${shortDateLabel(first.at)}, ${eventName(ingress)} on ${shortDateLabel(ingress.at)}, and ${eventName(last)} on ${shortDateLabel(last.at)}—as a working plan for this principle: ${SIGN_REGISTER[sign].year}. At each one, write what changed, what did not, and what you will do next; for ${cap(sign)}, the year’s practice is to ${SIGN_REGISTER[sign].test}, with the dates providing structure while your decisions and circumstances remain the substance.`,
    openingRefs,
    'A three-date plan for the year',
  ));

  return reading('yearly-2027', sign, { from: '2027-01-01', through: '2027-12-31' }, `${cap(sign)} 2027 horoscope`, passages);
}

export class HoroscopeProgramInputError extends Error {
  constructor(readonly violations: HoroscopeProgramViolation[]) {
    super(`Invalid horoscope program input:\n${violations.map((failure) => `- ${failure.path}: ${failure.message}`).join('\n')}`);
    this.name = 'HoroscopeProgramInputError';
  }
}

/** Build all six Phase-1 surfaces for all twelve signs. */
export function buildHoroscopeProgram(input: BuildHoroscopeProgramInput): HoroscopeProgram {
  const inputFailures = validateHoroscopeProgramInput(input);
  if (inputFailures.length) throw new HoroscopeProgramInputError(inputFailures);

  const snapshots = new Map(input.dailySnapshots.map((daily) => [daily.date, daily]));
  const today = snapshots.get(input.anchorDate);
  const tomorrowDate = addDays(input.anchorDate, 1);
  const tomorrow = snapshots.get(tomorrowDate);
  const week = isoWeek(input.anchorDate);
  const weekDays = week.dates.map((date) => snapshots.get(date)).filter((value): value is Daily => Boolean(value));
  const yearlyEvents = input.yearlyEvents ?? [];
  const yearComplete = hasYearCoverage(yearlyEvents);
  const catalog = new EvidenceCatalog();

  const signs: HoroscopeSignProgram[] = SIGN_SLUGS.map((sign) => {
    const todayReading = today
      ? dailySurface('today', sign, today, catalog)
      : fallbackReading('today', sign, { from: input.anchorDate, through: input.anchorDate }, `the ${input.anchorDate} noon UTC snapshot was not supplied`);
    const tomorrowReading = tomorrow
      ? dailySurface('tomorrow', sign, tomorrow, catalog)
      : fallbackReading('tomorrow', sign, { from: tomorrowDate, through: tomorrowDate }, `the ${tomorrowDate} noon UTC snapshot was not supplied`);
    const loveReading = today
      ? loveSurface(sign, today, catalog)
      : fallbackReading('love', sign, { from: input.anchorDate, through: input.anchorDate }, `the ${input.anchorDate} noon UTC snapshot was not supplied`);
    const careerReading = today
      ? careerSurface(sign, today, catalog)
      : fallbackReading('career', sign, { from: input.anchorDate, through: input.anchorDate }, `the ${input.anchorDate} noon UTC snapshot was not supplied`);
    const weeklyReading = weekDays.length === 7
      ? weeklySurface(sign, weekDays, catalog)
      : fallbackReading('weekly', sign, { from: week.from, through: week.through }, `only ${weekDays.length} of 7 ISO-week snapshots were supplied`);
    const yearlyReading = yearComplete
      ? yearlySurface(sign, yearlyEvents, catalog)
      : fallbackReading('yearly-2027', sign, { from: '2027-01-01', through: '2027-12-31' }, 'the 2027 catalog does not yet include at least six major events with ingress, eclipse, and retrograde/direct station coverage');
    return {
      sign,
      readings: {
        today: todayReading,
        tomorrow: tomorrowReading,
        weekly: weeklyReading,
        love: loveReading,
        career: careerReading,
        'yearly-2027': yearlyReading,
      },
    };
  });
  if (today) separateSimilarDailyReadings('today', signs, today, catalog);
  if (tomorrow) separateSimilarDailyReadings('tomorrow', signs, tomorrow, catalog);

  return {
    schema: HOROSCOPE_PROGRAM_SCHEMA,
    anchorDate: input.anchorDate,
    locale: 'en',
    policy: {
      id: 'org.zodiacs.horoscope-program.en',
      version: '1.0.0',
      rendererVersion: HOROSCOPE_PROGRAM_RENDERER,
      mode: 'deterministic-template',
      model: null,
    },
    coverage: {
      today: today ? 'complete' : 'unavailable',
      tomorrow: tomorrow ? 'complete' : 'unavailable',
      isoWeek: weekDays.length === 7 ? 'complete' : weekDays.length ? 'partial' : 'unavailable',
      yearly2027: yearComplete ? 'complete' : 'insufficient',
    },
    evidence: catalog.values(),
    signs,
  };
}

function voiceViolations(text: string, path: string): HoroscopeProgramViolation[] {
  const failures: HoroscopeProgramViolation[] = [];
  if (text.includes('!')) failures.push(violation('VOICE-EXCLAMATION', path, 'exclamation marks are not allowed'));
  if (/<[^>]+>/.test(text)) failures.push(violation('VOICE-MARKUP', path, 'reading copy must be plain text'));
  for (const pattern of MASTER_BRIEF_BANNED) {
    if (pattern.test(text)) failures.push(violation('VOICE-BANNED', path, `copy matches ${pattern.source}`));
  }
  for (const pattern of UNSAFE_CLAIMS) {
    if (pattern.test(text)) failures.push(violation('VOICE-UNSAFE', path, `copy matches ${pattern.source}`));
  }
  return failures;
}

/** Structural, editorial, evidence, and distinctness gate for serialized output. */
export function validateHoroscopeProgram(program: HoroscopeProgram): HoroscopeProgramViolation[] {
  const failures: HoroscopeProgramViolation[] = [];
  if (program.schema !== HOROSCOPE_PROGRAM_SCHEMA) {
    failures.push(violation('STRUCT-SCHEMA', 'program.schema', `expected ${HOROSCOPE_PROGRAM_SCHEMA}`));
  }
  if (!isDate(program.anchorDate)) failures.push(violation('STRUCT-DATE', 'program.anchorDate', 'invalid anchor date'));
  if (program.policy.mode !== 'deterministic-template' || program.policy.model !== null
    || program.policy.rendererVersion !== HOROSCOPE_PROGRAM_RENDERER) {
    failures.push(violation('PROV-GENERATION', 'program.policy', 'program must identify the deterministic renderer and no model'));
  }
  if (program.signs.length !== 12
    || program.signs.some((entry, index) => entry.sign !== SIGN_SLUGS[index])) {
    failures.push(violation('STRUCT-SIGNS', 'program.signs', 'all twelve signs must appear in canonical order'));
  }
  const evidenceIds = new Set(program.evidence.map((receipt) => receipt.id));
  if (evidenceIds.size !== program.evidence.length) {
    failures.push(violation('EVIDENCE-DUPLICATE', 'program.evidence', 'evidence IDs must be unique'));
  }
  for (const [index, receipt] of program.evidence.entries()) {
    if (!receipt.id || !receipt.sourceId || !receipt.label || !isInstant(receipt.at)) {
      failures.push(violation('EVIDENCE-SHAPE', `program.evidence[${index}]`, 'receipt requires id, sourceId, label, and canonical instant'));
    }
    if (receipt.kind === 'solar-house'
      && (!receipt.sourceFactId || !evidenceIds.has(receipt.sourceFactId)
        || !receipt.sunSign || !receipt.house || receipt.house < 1 || receipt.house > 12)) {
      failures.push(violation('EVIDENCE-DERIVATION', `program.evidence[${index}]`, 'solar-house receipt must link a known fact, sign, and house'));
    }
    if (receipt.eventKind === 'aspect' && receipt.orb !== 0) {
      failures.push(violation(
        'EVIDENCE-ASPECT-ORB',
        `program.evidence[${index}].orb`,
        'exact aspect receipt must explicitly expose a zero-degree orb',
      ));
    }
    if (receipt.kind === 'body-position' && receipt.body === 'Moon' && !receipt.moonPhase) {
      failures.push(violation(
        'EVIDENCE-MOON-PHASE',
        `program.evidence[${index}].moonPhase`,
        'Moon position receipt must expose its edition phase',
      ));
    }
    if (receipt.kind === 'sky-event' && receipt.eventKind === 'aspect'
      && (!receipt.a || !receipt.b || !receipt.eventType)) {
      failures.push(violation(
        'EVIDENCE-ASPECT-SHAPE',
        `program.evidence[${index}]`,
        'aspect receipt must expose both bodies and aspect type',
      ));
    }
  }
  const yearlyEventIds = new Set(program.evidence
    // Daily receipts in a 2027 edition also have 2027 instants, but they are
    // deliberately scoped to that day/week. Only IDs minted by the yearly
    // catalog belong to the all-events yearly coverage contract.
    .filter((receipt) => receipt.kind === 'sky-event'
      && receipt.id.startsWith('fact:2027:event:')
      && receipt.at.startsWith('2027-'))
    .map((receipt) => receipt.id));

  for (const [signIndex, signProgram] of program.signs.entries()) {
    for (const surface of SURFACES) {
      const path = `program.signs[${signIndex}].readings.${surface}`;
      const item = signProgram.readings[surface];
      if (!item || item.surface !== surface || item.sign !== signProgram.sign) {
        failures.push(violation('STRUCT-READING', path, 'reading surface/sign is missing or inconsistent'));
        continue;
      }
      if (item.text !== item.passages.map((entry) => entry.text).join('\n\n')
        || item.wordCount !== horoscopeWordCount(item.text)) {
        failures.push(violation('STRUCT-TEXT', path, 'text and word count must exactly match passages'));
      }
      failures.push(...voiceViolations(item.text, `${path}.text`));
      if (item.status === 'publishable') {
        const bounds = HOROSCOPE_WORD_BOUNDS[surface];
        if (item.wordCount < bounds.min || item.wordCount > bounds.max) {
          failures.push(violation('VOICE-WORDS', `${path}.wordCount`, `${item.wordCount} is outside ${bounds.min}-${bounds.max}`));
        }
        if (!item.passages.length || item.passages.some((entry) => (
          !entry.evidenceRefs.length || entry.evidenceRefs.some((id) => !evidenceIds.has(id))
        ))) {
          failures.push(violation('EVIDENCE-MISSING', `${path}.passages`, 'every publishable passage must cite known evidence'));
        }
        if (BACKSTAGE_COPY.test(item.text)) {
          failures.push(violation('VOICE-BACKSTAGE', `${path}.text`, 'reader copy must not expose publishing or verification plumbing'));
        }
        item.passages.forEach((entry, passageIndex) => {
          if (entry.heading !== undefined) {
            if (!entry.heading.trim()) {
              failures.push(violation(
                'STRUCT-HEADING',
                `${path}.passages[${passageIndex}].heading`,
                'section heading may not be empty',
              ));
            }
            failures.push(...voiceViolations(entry.heading, `${path}.passages[${passageIndex}].heading`));
          }
          const firstSentence = entry.text.split(/(?<=[.!?])\s/u, 1)[0] ?? entry.text;
          if (KITCHEN_FIRST_OPENING.test(firstSentence)) {
            failures.push(violation(
              'VOICE-KITCHEN-FIRST',
              `${path}.passages[${passageIndex}].text`,
              'each passage must open with meaning or useful action before astrological mechanics',
            ));
          }
        });
        if (surface === 'yearly-2027') {
          const headings = item.passages.map((entry) => entry.heading?.trim()).filter(Boolean) as string[];
          if (headings.length !== item.passages.length || new Set(headings).size !== headings.length
            || item.passages.length < 8) {
            failures.push(violation(
              'STRUCT-YEAR-SECTIONS',
              `${path}.passages`,
              'yearly reading requires at least eight uniquely headed editorial sections',
            ));
          }
          const referenced = new Set(item.passages.flatMap((entry) => entry.evidenceRefs));
          const missingEvents = [...yearlyEventIds].filter((id) => !referenced.has(id));
          if (missingEvents.length) {
            failures.push(violation(
              'EVIDENCE-YEAR-COVERAGE',
              `${path}.passages`,
              `${missingEvents.length} catalog event(s) are not cited by the yearly reading`,
            ));
          }
        }
      } else if (!item.fallbackReason || item.passages.some((entry) => entry.evidenceRefs.length)) {
        failures.push(violation('FALLBACK-SHAPE', path, 'insufficient readings need a reason and may not imply evidence'));
      }
    }
  }

  for (const surface of SURFACES) {
    const candidates = program.signs
      .map((entry) => entry.readings[surface])
      .filter((item) => item?.status === 'publishable');
    for (let left = 0; left < candidates.length; left += 1) for (let right = left + 1; right < candidates.length; right += 1) {
      const similarity = horoscopeShingleJaccard(candidates[left].text, candidates[right].text, 3);
      if (similarity > HOROSCOPE_DISTINCTNESS_LIMITS[surface]) {
        failures.push(violation(
          'DIST-SIMILARITY',
          `program.signs.${candidates[left].sign}/${candidates[right].sign}.readings.${surface}`,
          `trigram Jaccard ${similarity.toFixed(3)} exceeds ${HOROSCOPE_DISTINCTNESS_LIMITS[surface]}`,
        ));
      }
    }
  }
  return failures;
}

/** Deterministic replay gate: structure plus exact regeneration from inputs. */
export function validateHoroscopeProgramAgainstInput(
  input: BuildHoroscopeProgramInput,
  program: HoroscopeProgram,
): HoroscopeProgramViolation[] {
  const failures = validateHoroscopeProgram(program);
  const inputFailures = validateHoroscopeProgramInput(input);
  if (inputFailures.length) return [...inputFailures, ...failures];
  if (JSON.stringify(buildHoroscopeProgram(input)) !== JSON.stringify(program)) {
    failures.push(violation('PROV-REPLAY', 'program', 'serialized program differs from deterministic regeneration'));
  }
  return failures;
}
