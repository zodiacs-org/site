/**
 * Authored interpretation for event pages — written editorial copy, keyed
 * by event ID. Every factual claim in these passages must agree with the
 * committed catalogs; interpretations.test.ts pins the ones that name
 * signs, dates, or degrees. Events without an entry render facts, context,
 * and navigation only, and stay ineligible for indexing.
 *
 * Register: plain, warm, specific, calm. Astrology is a tradition being
 * read, not a mechanism being claimed. No predictions about health, money,
 * relationships, or outcomes — territories and questions, not verdicts.
 */
import sky from '../../data/sky.json';
import eclipsesData from '../../data/eclipses.json';
import ingressesData from '../../data/ingresses.json';
import { bodyLongitude } from '../engine/full';
import type { BodyName } from '../engine/types';
import { degreeInSign, signForLongitude } from '../signs';
import {
  aspectId, aspectPath, eclipseId, eclipsePath, eventDay,
  ingressId, ingressPath, isoDay, lunationId, lunationPath, moonNameForDate,
  retrogradeId, retrogradePath, signNameFor,
} from './format';
import type { EventFacts, EventInterpretation } from './types';
import { REVISED_EVENT_READINGS } from './revised-readings';

const INTERPRETATIONS: Record<string, EventInterpretation> = {
  'full-moon-2026-07-29': {
    lead: 'The Buck Moon peaks in Aquarius on July 29 while the Sun runs hot through Leo, the year\'s clearest look at the line between what you love doing and who it is actually for. Full moons bring things to light; this one lights the room, not the stage.',
    body: [
      'The Leo-Aquarius axis is personal warmth against the wider circle: your name on the work versus the group that makes the work possible. With the Moon at 6° Aquarius, the tradition reads a culmination in the collective part of life (friendships, teams, audiences, the future you are pointing at) while the Leo Sun keeps the question personal. Something you have been building since the quiet Cancer new moon of July 14 is now visible to other people, and their reaction is information.',
      'The timing has texture. Mercury finished its retrograde on July 23, so conversations that stalled through mid-July have started moving again; Saturn turned retrograde in Aries on July 26, opening a slower, half-year review of commitments made since February. A full moon three days into that turn tends to feel like a checkpoint rather than a finale. See what is finished, and let what is not finished be openly unfinished.',
    ],
    reflections: [
      'Name one thing that became public this month: a project, a decision, a change of company. Is it landing the way you intended?',
      'Where does the group need more of you, and where has the group been getting the part of you that your own work needed?',
    ],
    signNotes: [
      { sign: 'aries', house: 11, note: 'Something a group has been building (a team, a cause, a circle of friends) reaches its visible moment. Your part in it is the thing to name.' },
      { sign: 'taurus', house: 10, note: 'Work done in private shows up on the public ledger. A title, a review, a reputation question comes to a head.' },
      { sign: 'gemini', house: 9, note: 'A long-distance thread (study, travel, a belief you have been testing) asks for a verdict rather than more research.' },
      { sign: 'cancer', house: 8, note: 'A shared account comes due: a debt, a deposit, something merged. The clean number matters more than the story around it.' },
      { sign: 'leo', house: 7, note: 'The other person\'s turn. A partnership, romantic or working, shows you exactly where it stands.' },
      { sign: 'virgo', house: 6, note: 'The routine you have been running shows its results, in the body and the calendar alike. Adjust the load, not the goal.' },
      { sign: 'libra', house: 5, note: 'Something made for joy (a project, a romance, time with a child) reaches full size. Enjoy it in company.' },
      { sign: 'scorpio', house: 4, note: 'Home gets loud for a night: family news, a housing question, the private floor of your life lit up.' },
      { sign: 'sagittarius', house: 3, note: 'A message lands. Paperwork, a sibling, a neighborhood matter: the small print of the week peaks now.' },
      { sign: 'capricorn', house: 2, note: 'A money question rounds toward its answer: what something is worth, what you are owed, what steadies you.' },
      { sign: 'aquarius', house: 1, note: 'This one is yours. The Moon peaks in your own sign, and how you have been coming across gets mirrored back plainly.' },
      { sign: 'pisces', house: 12, note: 'The quietest version: something running under the surface (rest, a private worry, an ending) asks to be seen and set down.' },
    ],
  },

  'new-moon-2026-08-12': {
    lead: 'The Leo new moon of August 12 is not an ordinary monthly reset. It is a total solar eclipse, the Moon crossing the Sun\'s face at 20° Leo. The tradition treats an eclipsed new moon as a beginning with unusual reach: less a fresh page, more a new chapter heading.',
    body: [
      'Ordinary new moons are for quiet starts; astrologers tend to read eclipse new moons as doors that open on their own schedule. At 20° Leo the register is creative and personal: authorship, romance, performance, the parts of life where you are most yourself in public. Whatever begins near this date, the tradition suggests holding plans loosely: eclipse beginnings often look different a season later.',
      'This is also the middle of an eclipse pair. A partial lunar eclipse follows at the Pisces full moon on August 28, closing the season two weeks later. Reading the two dates as one story (a Leo opening, a Pisces release) is the older way to work with them.',
    ],
    reflections: [
      'If a door opened for you this week without your pushing on it, what would you want to be true about how you walk through it?',
      'What Leo-flavored thing (creative, romantic, personal) have you been postponing for a more sensible season?',
    ],
    limitations: [
      'Whether the eclipse itself is visible from your location depends on geography this page does not compute; the eclipse page carries the timing details.',
    ],
  },

  'eclipse-2026-08-12': {
    lead: 'On August 12, 2026 the Moon covers the Sun completely, a total solar eclipse at 20° Leo, peaking at 17:45 universal time. Along the narrow track where totality falls, day turns briefly to dusk; everywhere else, and in the astrology, it is the year\'s most emphatic new moon.',
    body: [
      'A solar eclipse is a new moon with exact aim: the Moon always passes between Earth and Sun at a new moon, but only when the line-up crosses the Moon\'s orbital nodes does it actually block the light. The tradition has read these interruptions for millennia as markers, endings and beginnings compressed into a single afternoon. Modern astrologers keep the reading but soften the fatalism: an eclipse in Leo asks where your creative and personal authority is headed, and tends to answer the question faster than you would have.',
      'Eclipses arrive in pairs. This one opens the season; the partial lunar eclipse at the Pisces full moon on August 28 closes it. The two weeks between them have a reputation for being eventful, a reputation worth neither fearing nor engineering. The practical advice the tradition gives is old and simple: watch what leaves, welcome what arrives, and avoid forcing major launches onto the exact day.',
    ],
    reflections: [
      'What role have you outgrown that an outside event would mercifully end?',
      'If the next six months rearranged themselves around one Leo theme (being seen, making something, leading), which would you want it to be?',
    ],
    limitations: [
      'Totality is visible only along a narrow ground track, and this page does not compute where that track falls. The peak time and zodiac position above are geometry, true from everywhere; the view from your location is not.',
    ],
  },

  'mercury-retrograde-2026-06-29': {
    lead: 'Mercury is retrograde from June 29 to July 23, 2026, backing from 26° to 16° of Cancer, the whole cycle inside one sign. Three or four times a year the messenger planet appears to reverse; this is the summer edition, and it runs entirely through the sign of home and family.',
    body: [
      'Retrograde motion is perspective, not reversal (Earth overtaking a slower line of sight), but the tradition\'s advice for these three weeks has stayed consistent for centuries: review instead of launch. Reread before sending. Confirm the booking. Expect the person from earlier in the summer to resurface. With the whole retrograde in Cancer, the classic themes tilt homeward: plans involving family, houses, and who-hosts-what are the likeliest places to find a crossed wire.',
      'The turnaround days deserve the most patience. Mercury stationed retrograde on June 29 and stations direct on July 23, and the standstill days on either end are when devices, schedules, and inboxes have their folklore moments. By the July 29 full moon the fog has usually burned off.',
    ],
    reflections: [
      'What summer plan deserves one confirming message rather than one more assumption?',
      'Something from June is likely to come back around: a person, an offer, an unfinished conversation. What would you do with it on a second pass?',
    ],
  },

  'saturn-enters-aries-2026-02-14': {
    lead: 'On February 14, 2026, Saturn leaves Pisces and enters Aries, where it stays through the years ahead, the planet of structure moving into the sign of the first move. Saturn changes sign roughly every two and a half years, and each shift moves its slow work to a new part of everyone\'s chart.',
    body: [
      'Saturn in Aries is discipline applied to beginnings: the tradition reads it as a multi-year test of initiative, where starting things, and owning what you start, carries more weight and more scrutiny. What was diffuse during the Pisces years gets asked for its concrete form. The classic caution is impatience wearing the costume of decisiveness; the classic reward is self-reliance that has actually been earned.',
      'Saturn does not arrive alone. Neptune crossed into Aries three weeks earlier, on January 26, which is why astrologers talk about early 2026 as a genuine change of scenery: two of the slowest-moving planets stepping onto the zodiac\'s starting line within a month of each other. Saturn will spend late July to mid-December retrograde in Aries, the first review period of the new chapter.',
    ],
    reflections: [
      'What have you been meaning to start that would survive being taken seriously?',
      'Where in your life does "first" (going first, deciding first, being first) cost you the most, and what would structure change about that?',
    ],
  },

  'uranus-trine-pluto-2026-07-18': {
    lead: 'On July 18, 2026, Uranus in Gemini and Pluto in Aquarius reach an exact trine at 4° of the air signs, two of the slowest planets in the sky agreeing with each other. Aspects like this one are measured in generations, not weeks; the exact date is simply when the agreement is sharpest.',
    body: [
      'Uranus is the tradition\'s circuit breaker, Pluto its deep renovation, and a trine is the easy angle: 120°, signs of the same element, effort flowing rather than grinding. In air signs the shared project is ideas, language, networks, and how people organize themselves. Read collectively, it describes a stretch when structural change and technical change stop fighting each other. Read personally, it rewards whichever experiment you have been running quietly since the decade turned.',
      'The date sits inside a remarkable week: within seven days the sky also produces Jupiter\'s exact opposition to Pluto and its trine to Neptune, all near the same early degrees. Mid-July 2026 is the kind of sky astrologers mark years in advance, not because a single day changes anything, but because so many slow cycles pass their exact marks at once. Pluto is retrograde through it all, which the tradition reads as the renovation running on its internal schedule.',
    ],
    reflections: [
      'What small experiment in how you work, learn, or connect deserves to be made permanent?',
      'If the way your field organizes itself is genuinely changing, what position do you want to be standing in when it settles?',
    ],
  },

  'jupiter-trine-saturn-2026-08-31': {
    lead: 'On August 31, 2026, Jupiter in Leo and Saturn in Aries form an exact trine at 13° of the fire signs: growth and structure, for once, pulling in the same direction. The tradition reads the fire-sign version of this pairing as expansion that is willing to do the reps.',
    body: [
      'Jupiter is appetite and reach; Saturn is limit and load-bearing wall. Square or opposed, they argue. In trine, the argument becomes a division of labor: ambition gets a schedule, and discipline gets a reason. With Jupiter in Leo the growth is creative and personal (visibility, authorship, heart) while Saturn in Aries supplies the independent spine. Plans made near this date tend to be the durable kind, sized to what you can actually build.',
      'Saturn is retrograde at the exactitude, mid-way through its first Aries review, which softens the moment from a green light into an honest drafting table: the trine favors committing to the structure of the thing rather than its launch party. The angle stays within a workable orb for weeks on either side of the exact hit.',
    ],
    reflections: [
      'What ambition of yours deserves a load-bearing plan instead of another surge of enthusiasm?',
      'Which limit in your life is actually infrastructure, and which one is just a habit wearing a hard hat?',
    ],
  },
};

interface SignGuide {
  terrain: string;
  strength: string;
  tension: string;
  practice: string;
}

const SIGN_GUIDES: Record<string, SignGuide> = {
  aries: {
    terrain: 'initiative, courage, and the right to begin',
    strength: 'Aries can turn a vague wish into a clean first move',
    tension: 'speed can get ahead of consent, preparation, or a clear reason',
    practice: 'choose the beginning that still makes sense after the first rush passes',
  },
  taurus: {
    terrain: 'stability, resources, and a pace you can sustain',
    strength: 'Taurus notices what is worth tending long enough to become dependable',
    tension: 'steadiness can harden into staying with something simply because it is familiar',
    practice: 'keep what has real value and loosen one habit that only preserves the old arrangement',
  },
  gemini: {
    terrain: 'conversation, curiosity, and the stories moving between people',
    strength: 'Gemini makes room for another question and a more useful exchange',
    tension: 'too many open threads can scatter attention before anything becomes clear',
    practice: 'follow the liveliest question, then give its answer somewhere concrete to land',
  },
  cancer: {
    terrain: 'belonging, memory, and the conditions that make care possible',
    strength: 'Cancer recognizes which people and places deserve protection',
    tension: 'protectiveness can keep an outdated pattern alive after it stops feeling like home',
    practice: 'make one boundary or gesture of care specific enough to be felt',
  },
  leo: {
    terrain: 'authorship, visibility, and the pleasure of making something your own',
    strength: 'Leo brings warmth and personal conviction to what might otherwise stay anonymous',
    tension: 'the wish to be seen can drown out the quieter question of what is worth showing',
    practice: 'put your name behind the work that feels generous as well as personally true',
  },
  virgo: {
    terrain: 'craft, routine, and the useful detail that changes the whole result',
    strength: 'Virgo can improve a system by noticing where daily reality catches',
    tension: 'discernment can become an endless revision that never lets the work leave the desk',
    practice: 'repair the part that matters, define what is good enough, and let the next step happen',
  },
  libra: {
    terrain: 'reciprocity, proportion, and the terms that let two sides meet',
    strength: 'Libra can find a fairer arrangement without erasing difference',
    tension: 'keeping the peace can postpone the honest preference that a decision needs',
    practice: 'state what balance would require from each side, including your own',
  },
  scorpio: {
    terrain: 'trust, power, and what becomes possible when the surface answer is not enough',
    strength: 'Scorpio stays with a difficult truth long enough for it to become usable',
    tension: 'intensity can turn privacy into control or make every question feel all-or-nothing',
    practice: 'name the real stake without demanding that everything be settled at once',
  },
  sagittarius: {
    terrain: 'meaning, range, and the beliefs that give a journey its direction',
    strength: 'Sagittarius restores perspective when the immediate problem has become too small a room',
    tension: 'a compelling big picture can skip the evidence or obligation close at hand',
    practice: 'test the larger story against one direct experience before committing to it',
  },
  capricorn: {
    terrain: 'responsibility, structure, and the long game behind a visible result',
    strength: 'Capricorn gives ambition a sequence, a standard, and somewhere to stand',
    tension: 'competence can become a reason to carry a role that should be shared or redesigned',
    practice: 'define the responsibility that is truly yours and build around that',
  },
  aquarius: {
    terrain: 'friendship, systems, and the future a group is trying to make',
    strength: 'Aquarius sees how a personal choice connects to a wider pattern',
    tension: 'distance can make an elegant principle easier to serve than the people living with it',
    practice: 'bring the larger idea back to the group, person, or practical change it is meant to help',
  },
  pisces: {
    terrain: 'imagination, compassion, and the endings that need room rather than force',
    strength: 'Pisces can sense what a literal answer misses and let a softer truth emerge',
    tension: 'porous boundaries can blur intuition with assumption or care with overextension',
    practice: 'leave space for feeling while giving one promise, limit, or ending a clear shape',
  },
};

interface PlanetGuide {
  terrain: string;
  gift: string;
  caution: string;
  practice: string;
}

const PLANET_GUIDES: Record<string, PlanetGuide> = {
  Mercury: {
    terrain: 'messages, decisions, routes, and the way an idea is understood',
    gift: 'comparison, revision, and a better question',
    caution: 'speed, assumption, and words doing more work than the agreement can support',
    practice: 'reread the terms and confirm what each person means',
  },
  Venus: {
    terrain: 'affection, taste, reciprocity, and what you choose to value',
    gift: 'recognition of what feels proportionate and worth tending',
    caution: 'pleasing the moment while avoiding the preference underneath it',
    practice: 'name what you value before negotiating how to share it',
  },
  Mars: {
    terrain: 'desire, effort, assertion, and the use of available energy',
    gift: 'decisive action and honest contact with what you want',
    caution: 'reactivity, needless contests, and motion without a useful target',
    practice: 'choose a clear aim before spending force on it',
  },
  Jupiter: {
    terrain: 'growth, conviction, opportunity, and the scale of an undertaking',
    gift: 'perspective, confidence, and permission to think beyond the current limit',
    caution: 'excess, inflated promises, or treating enthusiasm as proof',
    practice: 'give the larger possibility a proportionate next step',
  },
  Saturn: {
    terrain: 'responsibility, boundaries, time, and what must hold under pressure',
    gift: 'patience, definition, and a structure that can carry real weight',
    caution: 'rigidity, scarcity thinking, or mistaking difficulty for moral worth',
    practice: 'make the commitment specific enough to keep and revise',
  },
  Uranus: {
    terrain: 'independence, disruption, invention, and the pattern ready to change',
    gift: 'experimentation and an angle the established method could not see',
    caution: 'novelty pursued for its own sake or freedom defined only as escape',
    practice: 'test the change at a scale where its consequences can still teach you',
  },
  Neptune: {
    terrain: 'imagination, ideals, surrender, and the boundaries between one thing and another',
    gift: 'symbolic vision, empathy, and contact with what cannot be reduced to a checklist',
    caution: 'projection, vagueness, or an ideal that asks facts to disappear',
    practice: 'give the vision one boundary that helps it remain trustworthy',
  },
  Pluto: {
    terrain: 'power, compulsion, elimination, and change that reaches the root',
    gift: 'the courage to confront what has been organizing a situation from underneath',
    caution: 'control, secrecy, or treating every shift as a test of dominance',
    practice: 'identify what truly needs to end before deciding what should replace it',
  },
  Sun: {
    terrain: 'purpose, visibility, and the organizing center of a choice',
    gift: 'clarity about what deserves wholehearted attention',
    caution: 'making personal recognition the only measure of value',
    practice: 'choose the role that lets purpose and participation support each other',
  },
  Moon: {
    terrain: 'response, habit, memory, and the need for safety and belonging',
    gift: 'attention to timing, feeling, and the conditions underneath a reaction',
    caution: 'treating a passing mood as a final instruction',
    practice: 'notice the feeling, then decide what care it actually asks for',
  },
};

interface AspectGuide {
  dynamic: string;
  use: string;
  watch: string;
}

const ASPECT_GUIDES: Record<string, AspectGuide> = {
  conjunction: {
    dynamic: 'concentrates two planetary agendas in the same part of the conversation',
    use: 'treat the blend as a new starting condition and decide what should lead',
    watch: 'one theme can become so loud that the other loses its necessary distinction',
  },
  sextile: {
    dynamic: 'opens a cooperative route that becomes useful when someone acts on it',
    use: 'make the available connection practical rather than waiting for momentum to arrive by itself',
    watch: 'an easy opening can remain only potential if nobody gives it a form',
  },
  square: {
    dynamic: 'creates friction between two valid demands that cannot both keep their old shape',
    use: 'let the pressure reveal which method, boundary, or expectation needs revision',
    watch: 'urgency can turn a workable tension into a contest with a false winner',
  },
  trine: {
    dynamic: 'lets two planetary agendas reinforce each other with relatively little resistance',
    use: 'give the easier current a purpose, a schedule, and a real recipient',
    watch: 'what flows naturally can be taken for granted or left underused',
  },
  opposition: {
    dynamic: 'places two planetary agendas across the table where each clarifies the other',
    use: 'look for a proportion that keeps both truths visible instead of choosing a caricature of either',
    watch: 'projection can make the other side carry a conflict that belongs to the whole arrangement',
  },
};

const FALLBACK_SIGN = SIGN_GUIDES.aries;
const FALLBACK_PLANET = PLANET_GUIDES.Sun;
const FALLBACK_ASPECT = ASPECT_GUIDES.conjunction;

function variant<T>(id: string, salt: number, options: readonly T[]): T {
  let hash = 2_166_136_261 ^ salt;
  for (const char of id) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return options[(hash >>> 0) % options.length];
}

function anchorIso(facts: EventFacts): string {
  return facts.at ?? facts.start ?? '';
}

function joinNames(values: string[]): string {
  if (values.length < 2) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function lunationInterpretation(facts: EventFacts): EventInterpretation {
  const sign = signNameFor(facts.signs[0]);
  const guide = SIGN_GUIDES[facts.signs[0]] ?? FALLBACK_SIGN;
  const date = eventDay(facts.at!);
  const full = facts.subtype === 'full';
  const phase = full ? 'full moon' : 'new moon';
  const display = full && facts.moonName ? `${facts.moonName} Moon` : phase;
  const phaseMeaning = full
    ? 'a moment for noticing what has reached visibility, maturity, or a useful point of decision'
    : 'a quiet point for choosing what deserves attention before results are visible';
  const phasePractice = full
    ? 'separate what is genuinely complete from what simply needs to be acknowledged'
    : 'begin at a scale small enough to learn from before making the intention public';

  const lead = variant(facts.id, 1, [
    `A story about ${guide.terrain} comes into clearer focus at the ${display} in ${sign} on ${date}. Astrology reads this ${phase} as ${phaseMeaning}, not as a verdict about what happens next.`,
    `The useful question around ${date} is how ${guide.terrain} deserves to change. That day’s ${display} in ${sign} marks ${phaseMeaning}, with room for your response to remain your own.`,
    `Attention gathers around ${guide.terrain} on ${date}, when the ${display} arrives in ${sign}. In the astrological tradition, this is ${phaseMeaning} rather than a command to force an outcome.`,
    `The ${display} in ${sign} on ${date} puts ${guide.terrain} at the center of the month. Its symbolic value lies in taking an honest reading of the moment while leaving the future open.`,
  ]);

  const bodyOpening = variant(facts.id, 2, [
    `A ${phase} describes a relationship between the Sun and Moon, but its human scale is a rhythm of attention: what is ready to be noticed, released, or begun. On ${date}, ${sign} gives that rhythm its subject. ${guide.strength}.`,
    `Astrologers use the ${phase} relationship between the Sun and Moon as a checkpoint in the monthly cycle. The ${date} emphasis falls in ${sign}, so the reading turns toward ${guide.terrain}. ${guide.strength}.`,
    `The value of the ${date} relationship between the Sun and Moon is not that it decides anything for you. This ${phase} supplies a pause with a particular vocabulary, and ${sign} makes that vocabulary ${guide.terrain}. ${guide.strength}.`,
  ]);
  const bodyPractice = variant(facts.id, 3, [
    `The pressure point is that ${guide.tension}. Around ${date}, ${guide.practice}; then ${phasePractice}. This keeps the symbolism close to a choice you can actually observe.`,
    `Every sign has an overreach, and here ${guide.tension}. Use ${date} to ${guide.practice}. For this ${phase}, it is enough to ${phasePractice}.`,
    `What deserves care is the point where ${guide.tension}. A grounded way to meet the ${date} lunation is to ${guide.practice}, and then to ${phasePractice}.`,
  ]);

  return {
    lead,
    body: [bodyOpening, bodyPractice],
    reflections: [
      `Where is ${guide.terrain} asking for a more honest answer around ${date}?`,
      `What would it mean to ${guide.practice}, without treating this ${phase} as a deadline?`,
    ],
  };
}

function eclipseInterpretation(facts: EventFacts): EventInterpretation {
  const sign = signNameFor(facts.signs[0]);
  const guide = SIGN_GUIDES[facts.signs[0]] ?? FALLBACK_SIGN;
  const date = eventDay(facts.at!);
  const kind = facts.eclipseKind ?? 'partial';
  const solar = facts.subtype === 'solar';
  const eclipse = `${kind} ${solar ? 'solar' : 'lunar'} eclipse`;
  const astronomy = solar
    ? 'A solar eclipse is also a new moon: the Moon passes between Earth and Sun and covers some or all of the Sun from particular locations.'
    : 'A lunar eclipse is also a full moon: opposite the Sun, the Moon passes through Earth’s shadow and darkens from the viewpoint of the night side of Earth.';
  const tradition = solar
    ? 'a beginning whose full shape may take time to understand'
    : 'a culmination, disclosure, or release that deserves space before interpretation hardens';

  const lead = variant(facts.id, 4, [
    `A turning point around ${guide.terrain} may feel louder near the ${eclipse} in ${sign} on ${date}. Astrology treats eclipses as amplified markers; the useful stance is attention rather than alarm.`,
    `The ${date} ${eclipse} in ${sign} brings unusual emphasis to ${guide.terrain}. Its traditional reading is a threshold, not a forecast, so notice what changes without rushing to name the whole story.`,
    `Eclipse symbolism concentrates attention, and on ${date} that attention falls on ${guide.terrain}. The ${eclipse} occurs in ${sign}; it can be read seriously without treating it as fate.`,
  ]);

  return {
    lead,
    body: [
      `${astronomy} The geometry is exact on ${date}; its symbolic meaning remains interpretive. For this ${eclipse}, the tradition emphasizes ${tradition}.`,
      `${sign} supplies the subject: ${guide.strength}. The caution is that ${guide.tension}. Around the ${date} eclipse, ${guide.practice}. Allow later events to add information before drawing a final conclusion.`,
    ],
    reflections: [
      `What is changing around ${guide.terrain}, even if you do not yet know what the change will become after ${date}?`,
      `Where could you ${guide.practice} while leaving room for the eclipse story to unfold at its own pace?`,
    ],
    limitations: [
      `${solar ? 'Visibility, the depth of coverage, and local duration' : 'Visibility and the appearance of Earth’s shadow'} vary by location; the universal peak does not describe every local view.`,
    ],
  };
}

function retrogradeInterpretation(facts: EventFacts): EventInterpretation {
  const planet = facts.bodies[0];
  const guide = PLANET_GUIDES[planet] ?? FALLBACK_PLANET;
  const start = eventDay(facts.start!);
  const end = facts.end ? eventDay(facts.end) : undefined;
  const signs = facts.signs.map(signNameFor);
  const signGuides = facts.signs.map((sign) => SIGN_GUIDES[sign] ?? FALLBACK_SIGN);
  const window = end ? `${start} to ${end}` : `from ${start}`;
  const movement = signs.length > 1 ? `through ${joinNames(signs)}` : `in ${signs[0]}`;

  const lead = variant(facts.id, 5, [
    `The useful word for ${planet} retrograde is revision, not disaster. From ${window}, the planet appears to retrace its path ${movement}, bringing ${guide.terrain} back for a more deliberate look.`,
    `${planet} retrograde from ${window} makes room to reconsider ${guide.terrain}. The apparent reversal ${movement} describes a review period in astrology, not a promise that ordinary plans will fail.`,
    `A second pass can be more valuable than a fast answer during ${planet} retrograde, which runs ${window} ${movement}. Its symbolic territory is ${guide.terrain}, with choice still firmly in your hands.`,
  ]);

  const signThread = signGuides.length > 1
    ? `${signs[0]} begins with ${signGuides[0].terrain}; ${signs[1]} shifts the emphasis toward ${signGuides[1].terrain}`
    : `${signs[0]} directs the review toward ${signGuides[0].terrain}`;

  return {
    lead,
    body: [
      `Retrograde motion is an effect of perspective as planets move at different speeds, while the astrological tradition uses the interval for return and revision. In the ${window} cycle, ${signThread}. The advantage is ${guide.gift}.`,
      `The caution for this ${planet} cycle is ${guide.caution}. Between ${start}${end ? ` and ${end}` : ''}, ${guide.practice}; use a second pass to improve a choice rather than assuming every delay carries a message.`,
    ],
    reflections: [
      `Which part of ${guide.terrain} would benefit from a thoughtful second pass during this ${planet} cycle?`,
      `What could you ${guide.practice} before calling the matter settled${end ? ` on ${end}` : ''}?`,
    ],
    ...(!end ? {
      limitations: ['The closing station is not included in the dated interval above, so read this as an open period rather than assuming a finish date.'],
    } : {}),
  };
}

function ingressInterpretation(facts: EventFacts): EventInterpretation {
  const planet = facts.bodies[0];
  const planetGuide = PLANET_GUIDES[planet] ?? FALLBACK_PLANET;
  const sign = signNameFor(facts.signs[0]);
  const signGuide = SIGN_GUIDES[facts.signs[0]] ?? FALLBACK_SIGN;
  const date = eventDay(facts.at!);
  const returning = facts.subtype === 'retrograde-re-entry';
  const origin = facts.fromSign ? signNameFor(facts.fromSign) : undefined;
  const movement = returning ? `returns to ${sign}` : `enters ${sign}`;

  const lead = variant(facts.id, 6, [
    `${planet} ${movement} on ${date}, changing the style of ${planetGuide.terrain}. In ${sign}, the longer story turns toward ${signGuide.terrain}; this is a shift of emphasis, not a promise of events.`,
    `A new chapter in ${planetGuide.terrain} begins when ${planet} ${movement} on ${date}. ${sign} asks that chapter to take ${signGuide.terrain} seriously while leaving its real-world expression open.`,
    `When ${planet} ${movement} on ${date}, ${planetGuide.terrain} meets ${signGuide.terrain}. Astrology reads the ingress as a change in tone that becomes clearer through observation, not a verdict delivered on one day.`,
  ]);

  return {
    lead,
    body: [
      `${planet} is associated with ${planetGuide.terrain}; ${sign} contributes a method and mood. ${signGuide.strength}. The ${date} ingress therefore favors ${planetGuide.gift}, expressed through the sign’s particular way of paying attention.${origin ? ` Leaving ${origin} changes the vocabulary, but it does not erase the work of the previous sign.` : ''}`,
      `${returning ? 'Because this is a retrograde return, an earlier version of the theme may deserve reconsideration.' : 'Because an ingress starts a longer passage, the first day is an opening scene rather than the entire plot.'} The tension is that ${signGuide.tension}, alongside ${planetGuide.caution}. After ${date}, ${signGuide.practice}; then ${planetGuide.practice}.`,
    ],
    reflections: [
      `Where is ${planetGuide.terrain} already taking on the language of ${signGuide.terrain} after ${date}?`,
      `What would it look like to ${planetGuide.practice} while also trying to ${signGuide.practice}?`,
    ],
  };
}

function aspectInterpretation(facts: EventFacts): EventInterpretation {
  const [first, second] = facts.bodies;
  const firstGuide = PLANET_GUIDES[first] ?? FALLBACK_PLANET;
  const secondGuide = PLANET_GUIDES[second] ?? FALLBACK_PLANET;
  const aspect = facts.aspectType ?? facts.subtype;
  const aspectGuide = ASPECT_GUIDES[aspect] ?? FALLBACK_ASPECT;
  const date = eventDay(facts.at!);
  const signs = facts.signs.map(signNameFor);
  const signPhrase = signs.length > 1 ? `${signs[0]} and ${signs[1]}` : signs[0];

  const lead = variant(facts.id, 7, [
    `${first} ${aspect} ${second} on ${date}, linking ${firstGuide.terrain} with ${secondGuide.terrain}. The aspect ${aspectGuide.dynamic}; what you do with that relationship matters more than treating the date as a forecast.`,
    `Two slower stories meet exactly on ${date}: ${first} forms a ${aspect} to ${second}. In astrology this ${aspectGuide.dynamic}, bringing ${firstGuide.terrain} into direct conversation with ${secondGuide.terrain}.`,
    `The ${date} ${aspect} between ${first} and ${second} frames a conversation between ${firstGuide.terrain} and ${secondGuide.terrain}. Its value is symbolic and strategic: it shows a relationship to work with, not an outcome already chosen.`,
  ]);

  return {
    lead,
    body: [
      `${first} contributes ${firstGuide.gift}; ${second} contributes ${secondGuide.gift}. At the exact ${aspect} on ${date}, the symbolic task is to ${aspectGuide.use}. The planetary positions in ${signPhrase} give that work a specific style rather than changing the aspect’s basic geometry.`,
      `The tension to watch is that ${aspectGuide.watch}. ${first} can overreach through ${firstGuide.caution}, while ${second} can overreach through ${secondGuide.caution}. Use the ${date} alignment to ${firstGuide.practice}, then ${secondGuide.practice}.`,
    ],
    reflections: [
      `Where do ${firstGuide.terrain} and ${secondGuide.terrain} already need a clearer relationship around ${date}?`,
      `How could you ${aspectGuide.use} without assuming the ${aspect} will do that work for you?`,
    ],
  };
}

function generatedInterpretation(facts: EventFacts): EventInterpretation | undefined {
  const year = anchorIso(facts).slice(0, 4);
  if (year !== '2026' && year !== '2027') return undefined;
  switch (facts.family) {
    case 'lunation': return lunationInterpretation(facts);
    case 'eclipse': return eclipseInterpretation(facts);
    case 'retrograde': return retrogradeInterpretation(facts);
    case 'ingress': return ingressInterpretation(facts);
    case 'aspect': return aspectInterpretation(facts);
    case 'station': return undefined;
  }
}

interface TransitMonth {
  month: string;
  lunations: { type: 'full' | 'new'; at: string; sign: string; degree: number }[];
  aspects: {
    a: string; b: string; type: string; orb: number; at: string;
    aSign: string; aDegree: number; bSign: string; bDegree: number;
  }[];
}

const transitMonths: TransitMonth[] = Object.entries(
  import.meta.glob('../../data/transits-*.json', { eager: true }),
)
  .map(([, module]) => (module as { default: TransitMonth }).default ?? (module as unknown as TransitMonth))
  .filter((month) => Boolean(month?.month))
  .sort((a, b) => a.month.localeCompare(b.month));

const SLOW_BODIES = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
const RETRO_PAGE_PLANETS = new Set(['Mercury', 'Venus', 'Mars']);

/**
 * Build the editorial lookup from the same committed records used by the
 * presentation catalog. Keeping this adapter local lets the catalog retain
 * its stable `interpretationFor(id)` boundary while copy is composed from
 * actual signs, bodies, dates, and event kinds.
 */
function editorialFactsById(): Map<string, EventFacts> {
  const facts = new Map<string, EventFacts>();
  const keep = (item: EventFacts) => {
    const year = anchorIso(item).slice(0, 4);
    if (year === '2026' || year === '2027') facts.set(item.id, item);
  };
  const sourceFor = (month: string) => `transits-${month}.json` as const;

  const monthlyLunations = new Map<string, { month: string; item: TransitMonth['lunations'][number] }>();
  for (const month of transitMonths) {
    for (const item of month.lunations ?? []) {
      monthlyLunations.set(`${item.type}:${isoDay(item.at)}`, { month: month.month, item });
    }
  }

  const seenFullMonths = new Set<string>();
  for (const moon of sky.moons as { type: 'full' | 'new'; at: string }[]) {
    const monthly = monthlyLunations.get(`${moon.type}:${isoDay(moon.at)}`);
    const at = monthly?.item.at ?? moon.at;
    const longitude = bodyLongitude('Moon', new Date(at));
    const sign = monthly?.item.sign ?? signForLongitude(longitude).slug;
    let moonName: string | undefined;
    if (moon.type === 'full') {
      const month = isoDay(at).slice(0, 7);
      moonName = moonNameForDate(at, seenFullMonths.has(month));
      seenFullMonths.add(month);
    }
    const id = lunationId(moon.type, at);
    keep({
      id,
      family: 'lunation',
      subtype: moon.type,
      path: lunationPath(moon.type, at),
      title: id,
      at,
      bodies: ['Moon', 'Sun'],
      signs: [sign],
      degree: monthly?.item.degree ?? degreeInSign(longitude),
      longitude,
      moonName,
      provenance: monthly
        ? { source: sourceFor(monthly.month) }
        : { source: 'sky.json', generatedAt: sky.generatedAt },
    });
  }

  for (const eclipse of eclipsesData.eclipses as {
    type: 'solar' | 'lunar'; kind: EventFacts['eclipseKind']; peak: string;
    sign: string; lon: number; degree: number; obscuration: number; totalMinutes?: number;
  }[]) {
    const id = eclipseId(eclipse.peak);
    keep({
      id,
      family: 'eclipse',
      subtype: eclipse.type,
      path: eclipsePath(eclipse.peak),
      title: id,
      at: eclipse.peak,
      bodies: ['Moon', 'Sun'],
      signs: [eclipse.sign],
      degree: eclipse.degree,
      longitude: eclipse.lon,
      eclipseKind: eclipse.kind,
      obscuration: eclipse.obscuration,
      totalMinutes: eclipse.totalMinutes,
      provenance: { source: 'eclipses.json', generatedAt: eclipsesData.generatedAt },
    });
  }

  const retrogrades = sky.retrogrades as { planet: string; from: string; to: string | null }[];
  for (const window of retrogrades) {
    if (!RETRO_PAGE_PLANETS.has(window.planet)) continue;
    const startLongitude = bodyLongitude(window.planet as BodyName, new Date(window.from));
    const endLongitude = window.to
      ? bodyLongitude(window.planet as BodyName, new Date(window.to))
      : undefined;
    const signs = [...new Set([
      signForLongitude(startLongitude).slug,
      ...(endLongitude === undefined ? [] : [signForLongitude(endLongitude).slug]),
    ])].reverse();
    const id = retrogradeId(window.planet, window.from);
    keep({
      id,
      family: 'retrograde',
      subtype: 'cycle',
      path: retrogradePath(window.planet, window.from),
      title: id,
      start: window.from,
      end: window.to,
      clamped: window.from === sky.from,
      bodies: [window.planet],
      signs,
      degree: window.from === sky.from ? undefined : degreeInSign(startLongitude),
      longitude: window.from === sky.from ? undefined : startLongitude,
      provenance: { source: 'sky.json', generatedAt: sky.generatedAt },
    });
  }

  const horizonFrom = new Date(sky.from).getTime();
  const horizonTo = new Date(sky.to).getTime();
  const ingressWindows = ingressesData.windows as { planet: string; sign: string; from: string; to: string }[];
  for (const planet of SLOW_BODIES) {
    const occupancy = ingressWindows
      .filter((window) => window.planet === planet)
      .sort((left, right) => left.from.localeCompare(right.from));
    occupancy.forEach((window, index) => {
      const instant = new Date(window.from).getTime();
      if (instant < horizonFrom || instant >= horizonTo) return;
      const retrograde = retrogrades.some((cycle) => cycle.planet === planet
        && new Date(cycle.from).getTime() <= instant
        && (cycle.to === null || instant <= new Date(cycle.to).getTime()));
      const id = ingressId(planet, window.sign, window.from);
      keep({
        id,
        family: 'ingress',
        subtype: retrograde ? 'retrograde-re-entry' : 'ingress',
        path: ingressPath(planet, window.sign, window.from),
        title: id,
        at: window.from,
        bodies: [planet],
        signs: [window.sign],
        fromSign: occupancy[index - 1]?.sign,
        provenance: { source: 'ingresses.json', generatedAt: ingressesData.generatedAt },
      });
    });
  }

  for (const month of transitMonths) {
    for (const item of month.aspects ?? []) {
      if (!SLOW_BODIES.has(item.a) || !SLOW_BODIES.has(item.b) || item.orb !== 0) continue;
      const id = aspectId(item.a, item.type, item.b, item.at);
      keep({
        id,
        family: 'aspect',
        subtype: item.type,
        path: aspectPath(item.a, item.type, item.b, item.at),
        title: id,
        at: item.at,
        bodies: [item.a, item.b],
        signs: [item.aSign, item.bSign],
        degree: item.aDegree,
        aspectType: item.type,
        orb: 0,
        provenance: { source: sourceFor(month.month) },
      });
    }
  }

  return facts;
}

const EDITORIAL_FACTS = editorialFactsById();

/** Authored interpretation for an event, when one exists. */
export function interpretationFor(idOrFacts: string | EventFacts): EventInterpretation | undefined {
  const id = typeof idOrFacts === 'string' ? idOrFacts : idOrFacts.id;
  const bespoke = INTERPRETATIONS[id];
  if (bespoke) return bespoke;
  const revised = REVISED_EVENT_READINGS[id];
  if (revised) return revised;
  const facts = typeof idOrFacts === 'string' ? EDITORIAL_FACTS.get(id) : idOrFacts;
  return facts ? generatedInterpretation(facts) : undefined;
}

/** The seven original hand-authored readings, kept as editorial anchors. */
export const BESPOKE_INTERPRETED_IDS = Object.freeze(Object.keys(INTERPRETATIONS));

/** Every standalone 2026–2027 event with an editorial reading. */
export const INTERPRETED_IDS = Object.freeze([...new Set([
  ...BESPOKE_INTERPRETED_IDS,
  ...EDITORIAL_FACTS.keys(),
])].sort());
