/**
 * Phase 5A pilot copy composition and content-depth measurement.
 *
 * Every reader-facing sentence about a person is composed here from that
 * person's computed chart facts. Nothing is copied from Wikipedia; no
 * biography, achievement, or private-life material enters the copy; no
 * placement is said to have caused anything. Third-person pronouns for
 * the subject are avoided entirely — the name or "the chart" carries the
 * sentence, so no page ever guesses a living person's pronouns.
 *
 * House practice: this is the same deterministic composition-from-a-
 * curated-phrase-library the daily engine uses (PLAN.md, Phase 1). The
 * variety between pages comes from the facts, not from paraphrase.
 *
 *   node docs/phase5/people-pilot/tools/compose-copy.mjs
 *   node docs/phase5/people-pilot/tools/compose-copy.mjs --migrate-articles
 *   node docs/phase5/people-pilot/tools/compose-copy.mjs --migrate-identities
 *   node docs/phase5/people-pilot/tools/compose-copy.mjs --check
 *   node docs/phase5/people-pilot/tools/compose-copy.mjs --slug=sun-yat-sen
 *
 * Released copy is deliberately frozen. --migrate-articles applies the one
 * approved corpus-wide grammar migration; --check verifies that migration is
 * complete and that the derived depth report still matches the frozen copy.
 * --migrate-identities changes only the reviewed identity labels in the closed
 * PRINCIPAL_IDENTITIES list (audit A20 and the 2026-10-15 directory review);
 * all readings, source facts, dates and measurements remain frozen.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { reviewedEvidence, sourceReviews } from './source-reviews.mjs';
import { dirname, join } from 'node:path';
import { PRINCIPAL_IDENTITIES, reviewedIdentity } from './principal-identities.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PILOT = join(HERE, '..');

const FUNCTION = {
  Sun: 'identity and vitality',
  Moon: 'feeling and rhythm',
  Mercury: 'thinking and speech',
  Venus: 'attraction and taste',
  Mars: 'drive and appetite',
  Jupiter: 'expansion and meaning',
  Saturn: 'limit and structure',
  Uranus: 'disruption',
  Neptune: 'imagination',
  Pluto: 'depth and power',
};
const SHORT_FUNCTION = {
  Sun: 'identity', Moon: 'feeling', Mercury: 'thinking', Venus: 'taste',
  Mars: 'drive', Jupiter: 'expansion', Saturn: 'structure', Uranus: 'disruption',
  Neptune: 'imagination', Pluto: 'depth',
};
const ASPECT_GEOMETRY = {
  conjunction: 'in the same degree of the zodiac',
  opposition: 'directly across the wheel',
  square: 'at right angles',
  trine: 'a third of the circle apart',
  sextile: 'a sixth of the circle apart',
};
const ASPECT_SENSE = {
  conjunction: [
    'When two functions occupy one degree, the tradition reads a fusion: neither can act without committing the other.',
    'A conjunction concentrates rather than balances — the pair burns one fuel line.',
    'The tradition stops reading a conjunction as two things. It is one appetite with two names, and it moves together or not at all.',
    'Two bodies in the same degree are not read as neighbours but as a merger: whatever one wants, the other is already funding.',
    'A conjunction is the least negotiable aspect in the scheme — no distance to argue across, so the pair arrives as a single instinct.',
  ],
  opposition: [
    'The scheme reads an opposition as an axis to walk, not a fight to win: the chart keeps both ends lit.',
    'Oppositions are read as full-moon geometry — maximum visibility between two needs that share one spine.',
    'An opposition is the tradition’s tug of war. Both ends are real, and the work is holding them at once rather than picking a winner.',
    'Across the wheel, each body sees the other in full. The old reading is not conflict so much as permanent mutual visibility.',
    'An opposition puts two needs on opposite shores of the same water. Neither drowns; neither gets the whole beach.',
  ],
  square: [
    'A square is the tradition’s engine room: two drives at cross purposes, and the friction is the horsepower.',
    'Nothing in a square flows; everything in it works. The old texts kept squares for the charts they respected.',
    'A square is friction that produces motion — the aspect the tradition credits with building capability precisely by refusing to be comfortable.',
    'Right angles are where the scheme puts its grit. A square asks two functions to work in a mode neither would have chosen.',
    'The old texts treat a square as the aspect you feel earliest and thank latest: obstruction first, competence afterwards.',
  ],
  trine: [
    'A trine runs downhill — the talent that never announces itself because it never had to.',
    'The scheme reads trines as water finding its level: effortless, and invisible to the person living it.',
    'A trine is an open channel. The two cooperate without being asked, which is exactly why it is easy to spend and easy to take for granted.',
    'A third of the circle is the tradition’s friendliest distance — same element, shared assumptions, no translation required.',
    'Trines are read as inheritance rather than achievement: the ease is genuine, and nothing about it was earned.',
  ],
  sextile: [
    'Sextiles are read as standing invitations — productive exactly as often as they are accepted.',
    'A sextile pays out only on effort; the scheme calls it opportunity rather than gift.',
    'A sextile is an offer rather than a given: available when it is reached for, quiet when it is not.',
    'The scheme reads a sextile as a door left unlocked. Useful, and entirely dependent on someone walking through it.',
    'A sixth of the circle is close enough for cooperation and far enough that it stays optional.',
  ],
};
const aspectWithArticle = (type) => `${type === 'opposition' ? 'an' : 'a'} ${type}`;
const DIGNITY_GLOSS = {
  domicile: 'the planet in its own sign, running on home rules',
  exaltation: 'the tradition’s honoured-guest placement, working at its best',
  detriment: 'the planet opposite its home, working against the grain',
  fall: 'the tradition’s uphill placement, strength earned rather than given',
};
const ELEMENT_SENSE = {
  fire: [
    'Fire leads with ignition: the first move made early, and certainty arriving ahead of the evidence.',
    'A fire-weighted chart runs hot at the start line — initiative is its native language.',
    'Fire weights a chart toward initiative — starting, asserting, spending energy to find out what happens.',
    'A fire emphasis is read as appetite for the first move, with information gathered by doing rather than before doing.',
    'Fire signs carry the scheme’s forward pressure: heat applied early, patience treated as a later skill.',
  ],
  earth: [
    'Earth counts what remains: the built, the kept, the finished. Promise weighs less than delivery.',
    'An earth emphasis reads as patience with material reality — slow hands, durable results.',
    'Earth weights a chart toward the material and the durable — what can be built, kept, and relied on.',
    'An earth emphasis reads as trust in the tangible: the plan matters less than whether the thing stands up.',
    'Earth signs hold the scheme’s slow end, where results are measured in what survives rather than what starts.',
  ],
  air: [
    'Air runs on comparison and connection — the pattern noticed first, the feeling filed second.',
    'An air-weighted chart thinks in through-lines; the sentence is how it takes hold of the world.',
    'Air weights a chart toward language and pattern — the impulse to name a thing before deciding how to feel about it.',
    'An air emphasis is read as distance for the sake of clarity: the idea gets examined before it gets adopted.',
    'Air signs carry exchange in the scheme — comparison, argument, the sentence that makes the situation legible.',
  ],
  water: [
    'Water reads the room before the room speaks — atmosphere first, analysis later.',
    'A water emphasis keeps long books: little is forgotten, and nothing is felt only once.',
    'Water weights a chart toward the felt and the remembered — information that arrives as atmosphere before it arrives as words.',
    'A water emphasis reads as porousness: the room is registered whole, long before it is analysed in parts.',
    'Water signs hold memory in the scheme, where nothing is quite finished and little is genuinely forgotten.',
  ],
};
const MODALITY_SENSE = {
  cardinal: [
    'Cardinal weight opens doors — the chart of first movers and season starters.',
    'The cardinal signs begin things; a chart weighted there treats every stall as a starting gun.',
    'Cardinal signs open the seasons, and a cardinal-heavy chart is read as one that starts things.',
    'The four cardinal signs sit at the solstices and equinoxes — the scheme’s ignition points, and this chart is weighted to them.',
    'Cardinal weight is read as initiative: the instinct to be the reason something began.',
  ],
  fixed: [
    'Fixed weight is the scheme’s deep keel: slow to turn, near-impossible to capsize.',
    'The fixed signs hold what the cardinal signs start; a chart weighted there finishes its sentences.',
    'Fixed signs hold the middle of their seasons, and a fixed-heavy chart is read as one that consolidates and does not easily let go.',
    'The fixed signs are the scheme’s ballast — mid-season, fully committed, expensive to turn.',
    'Fixed weight is read as endurance, with the same machinery producing both loyalty and stubbornness.',
  ],
  mutable: [
    'Mutable weight bends without breaking — the chart of translators, editors, and second drafts.',
    'The mutable signs hand one season to the next; a chart weighted there is built for transitions.',
    'Mutable signs end their seasons, and a mutable-heavy chart is read as one built for adaptation and hand-off rather than for standing still.',
    'The mutable signs sit where one season is already becoming the next — the scheme’s translators.',
    'Mutable weight is read as flexibility, and the old texts are frank that its cost is scatter.',
  ],
};
const SIGN_NAMES = {
  aries: 'Aries', taurus: 'Taurus', gemini: 'Gemini', cancer: 'Cancer',
  leo: 'Leo', virgo: 'Virgo', libra: 'Libra', scorpio: 'Scorpio',
  sagittarius: 'Sagittarius', capricorn: 'Capricorn', aquarius: 'Aquarius', pisces: 'Pisces',
};
const ELEMENT = {
  aries: 'fire', leo: 'fire', sagittarius: 'fire',
  taurus: 'earth', virgo: 'earth', capricorn: 'earth',
  gemini: 'air', libra: 'air', aquarius: 'air',
  cancer: 'water', scorpio: 'water', pisces: 'water',
};
const elementWithArticle = (element) => `${/^[aeiou]/u.test(element) ? 'an' : 'a'} ${element}`;
const MODALITY = {
  aries: 'cardinal', cancer: 'cardinal', libra: 'cardinal', capricorn: 'cardinal',
  taurus: 'fixed', leo: 'fixed', scorpio: 'fixed', aquarius: 'fixed',
  gemini: 'mutable', virgo: 'mutable', sagittarius: 'mutable', pisces: 'mutable',
};
/** Triplicity decans with traditional rulers — the rule src/lib/birthdays.ts uses. */
const ELEMENT_ORDER = {
  fire: ['aries', 'leo', 'sagittarius'],
  earth: ['taurus', 'virgo', 'capricorn'],
  air: ['gemini', 'libra', 'aquarius'],
  water: ['cancer', 'scorpio', 'pisces'],
};
const CLASSIC_RULER = {
  aries: 'Mars', taurus: 'Venus', gemini: 'Mercury', cancer: 'the Moon',
  leo: 'the Sun', virgo: 'Mercury', libra: 'Venus', scorpio: 'Mars',
  sagittarius: 'Jupiter', capricorn: 'Saturn', aquarius: 'Saturn', pisces: 'Jupiter',
};
const PLANET_ELEMENT_CLAUSE = {
  Mercury: {
    fire: ['a mind that decides at speaking speed', 'thought that arrives already in motion'],
    earth: ['a mind that trusts the measured and the checked', 'thought with its feet on the ground'],
    air: ['a mind at home in argument and pattern', 'thought that travels by comparison'],
    water: ['a mind that absorbs before it argues', 'thought steeped in tone and memory'],
  },
  Venus: {
    fire: ['taste that runs toward the vivid and the immediate', 'attraction declared rather than implied'],
    earth: ['taste for the substantial and the lasting', 'attraction that grows by reliability'],
    air: ['taste led by wit and proportion', 'attraction that begins as conversation'],
    water: ['taste tuned to mood and undertow', 'attraction that works by atmosphere'],
  },
  Mars: {
    fire: ['drive that ignites on contact', 'effort spent in bursts and openings'],
    earth: ['drive that grinds rather than flares', 'effort banked steadily until it tells'],
    air: ['drive that argues its way forward', 'effort aimed through strategy and words'],
    water: ['drive that moves on certainty and current', 'effort that surges when it matters'],
  },
};
const PERSONAL_FRAMES = [
  (rows) => `The personal planets sit ${rows.map((row) => `${row.name} at ${row.deg} ${row.sign}`).join(', ')}. ${rows.map((row) => `${row.name} in ${elementWithArticle(row.element)} sign reads as ${row.clause}`).join('; ')}.`,
  (rows) => `Closer in, ${rows.map((row) => `${row.name} stands at ${row.deg} ${row.sign}`).join('; ')}. The tradition reads ${rows.map((row) => `${row.clause} from ${row.name}`).join(', ')}.`,
  (rows) => `${rows.map((row) => `${row.name} holds ${row.deg} ${row.sign}`).join(', ')} — in the old shorthand, ${rows.map((row) => row.clause).join('; ')}.`,
  (rows) => `Day to day the chart speaks through ${rows.map((row) => `${row.name} in ${row.sign} (${row.deg})`).join(', ')}: ${rows.map((row) => row.clause).join(', ')}.`,
  (rows) => `For the fast movers, ${rows.map((row) => `${row.name} was at ${row.deg} ${row.sign}`).join(', ')}. Read together: ${rows.map((row) => row.clause).join('; ')}.`,
];
const FIGURE_SENSE = {
  'grand-trine': [
    'Three trines close into a circuit the tradition calls a grand trine — ease so complete it can idle unnoticed for years.',
    'A grand trine is read as self-sufficiency in one element: the current circulates whether or not anything is asked of it.',
    'The closed triangle is the scheme’s picture of flow — and its warning that flow, unspent, stays private.',
  ],
  't-square': [
    'Two squares braced against one opposition make a t-square — the chart’s working end, where pressure keeps finding the same outlet.',
    'A t-square aims the whole axis at its apex planet; the tradition reads it as the chart’s standing assignment.',
    'The t-square is the figure the old texts trusted for output: friction with a fixed address.',
  ],
  'grand-cross': [
    'Four squares and two oppositions lock into a grand cross — tension distributed so evenly that nothing in it ever fully rests.',
    'A grand cross is the scheme’s picture of load-bearing structure: four demands, one frame, no slack.',
  ],
  unaspected: [
    'stands apart from every major angle the day held — the tradition reads an unaspected planet as a voice that speaks on its own schedule, unmodulated by the rest of the chart',
    'makes no major aspect that survives the day; the old reading gives such a planet autonomy — it acts alone, sometimes loudly',
  ],
  none: [
    'No closed figure — no grand trine, t-square, or grand cross — holds among the day-stable angles. The chart distributes its tension pair by pair rather than through one standing structure.',
    'The day-stable angles form no closed figure. Nothing funnels; each aspect is its own negotiation, which the tradition reads as a chart of separate treaties rather than one campaign.',
  ],
};
const ORDINAL = ['first', 'second', 'third'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function decanOf(signSlug, degree) {
  const index = Math.min(2, Math.floor(degree / 10));
  const sequence = ELEMENT_ORDER[ELEMENT[signSlug]];
  const position = sequence.indexOf(signSlug);
  return {
    ordinal: ORDINAL[index],
    span: `${index * 10}°–${(index + 1) * 10}°`,
    ruler: CLASSIC_RULER[sequence[(position + index) % 3]],
  };
}

/**
 * Deterministic per-page selector. Each call site passes its own salt, so
 * two pages that happen to share one fact still differ everywhere else —
 * the frames are decorrelated rather than moving together.
 */
function pick(list, slug, salt) {
  let hash = 2166136261;
  for (const character of `${slug}:${salt}`) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return list[hash % list.length];
}

const deg = (value) => `${value.toFixed(1)}°`;
const bodyLabel = (name) => (name === 'Sun' || name === 'Moon' ? `the ${name}` : name);
const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const WORD_NUMBER = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const spell = (value) => WORD_NUMBER[value] ?? String(value);

function identityLine(evidence, record, candidate) {
  // Disciplines are an editorial selection *from* this person's sourced
  // P106 claims — never invented. validate-pilot.mjs re-checks each one
  // against the evidence record.
  const disciplines = candidate.disciplines ?? evidence.occupations.slice(0, 1).map((item) => item.label);
  const country = evidence.birthPlace?.country?.label ?? null;
  const born = record.gregorianDate.slice(0, 4);
  const died = sourceReviews.people[candidate.slug]?.deathYearLabel ?? evidence.death?.time?.slice(1, 5) ?? null;
  const years = died ? `${born}–${died}` : `born ${born}`;
  const label = disciplines.length > 1
    ? `${capitalise(disciplines[0])} and ${disciplines.slice(1).join(' and ')}`
    : capitalise(disciplines[0]);
  return [label, country, years]
    .filter(Boolean)
    .join(' · ');
}

/* ── The lede: one leading fact, chosen by a fixed priority ────────── */
function lede(record, slug) {
  const { patterns, placements, aspectsStableAcrossCivilDay: aspects } = record;
  const settledPlacements = placements.filter((placement) => placement.stableAcrossDay);
  const settledCount = patterns.settledBodyCount;
  const settledScope = `${spell(settledCount)} placements whose signs are settled`;
  const stellium = patterns.stelliums.sort((a, b) => b.count - a.count)[0];
  const luminaryDignity = placements.find((placement) => (
    (placement.body === 'Sun' || placement.body === 'Moon')
    && (placement.dignity === 'domicile' || placement.dignity === 'exaltation')
    && placement.stableAcrossDay
  ));
  const tight = aspects.find((aspect) => aspect.orb < 1
    && ['Sun', 'Mercury', 'Venus', 'Mars'].includes(aspect.a)
    && aspect.b !== 'Moon');
  const dominantElement = Object.entries(patterns.elements).sort((a, b) => b[1] - a[1])[0];
  const dominantModality = Object.entries(patterns.modalities).sort((a, b) => b[1] - a[1])[0];

  if (stellium && stellium.count >= 4) {
    const bodies = settledPlacements.filter((placement) => placement.sign === stellium.sign)
      .map((placement) => bodyLabel(placement.body));
    return {
      fact: `stellium:${stellium.sign}:${stellium.count}`,
      text: `${capitalise(spell(stellium.count))} of the ${settledScope} stand in ${SIGN_NAMES[stellium.sign]} — ${bodies.slice(0, -1).join(', ')} and ${bodies.at(-1)}. The placements whose signs could change with an unknown hour are not counted. A cluster that size becomes the section the rest of the chart plays around.`,
    };
  }
  if (luminaryDignity) {
    return {
      fact: `dignity:${luminaryDignity.body}:${luminaryDignity.dignity}`,
      text: `${capitalise(bodyLabel(luminaryDignity.body))} stands at ${deg(luminaryDignity.degree)} ${luminaryDignity.signName}, in ${luminaryDignity.dignity} — ${DIGNITY_GLOSS[luminaryDignity.dignity]}. Of everything the chart can be read for without a birth time, that is the loudest single fact in it.`,
    };
  }
  if (tight) {
    return {
      fact: `aspect:${tight.a}:${tight.b}:${tight.type}`,
      text: `${pick([
        `${capitalise(bodyLabel(tight.a))} and ${bodyLabel(tight.b)} sit ${deg(tight.orb)} from an exact ${tight.type} — near enough that the tradition reads ${SHORT_FUNCTION[tight.a]} and ${SHORT_FUNCTION[tight.b]} as a single working part.`,
        `${deg(tight.orb)} separates ${bodyLabel(tight.a)} and ${bodyLabel(tight.b)} from an exact ${tight.type}; at that range ${SHORT_FUNCTION[tight.a]} and ${SHORT_FUNCTION[tight.b]} read as one mechanism.`,
        `The chart's headline is ${aspectWithArticle(tight.type)}: ${bodyLabel(tight.a)} and ${bodyLabel(tight.b)} within ${deg(tight.orb)}, ${SHORT_FUNCTION[tight.a]} wired to ${SHORT_FUNCTION[tight.b]}.`,
        `Tightest of all, ${bodyLabel(tight.a)} holds ${aspectWithArticle(tight.type)} to ${bodyLabel(tight.b)} at ${deg(tight.orb)} — close enough to weld ${SHORT_FUNCTION[tight.a]} to ${SHORT_FUNCTION[tight.b]}.`,
      ], slug, 'lede-aspect-lead')} ${pick(ASPECT_SENSE[tight.type], slug, 'lede-aspect')}`,
    };
  }
  if (dominantElement[1] >= Math.ceil(settledCount / 2)) {
    return {
      fact: `element:${dominantElement[0]}:${dominantElement[1]}`,
      text: `${pick([
        `${capitalise(spell(dominantElement[1]))} of the ${settledScope} fall in ${dominantElement[0]} signs — at least half of what the unknown hour leaves certain.`,
        `${dominantElement[0][0].toUpperCase()}${dominantElement[0].slice(1)} dominates the certain ground here, taking ${spell(dominantElement[1])} of the ${settledScope}.`,
        `Count only what the day settles, and ${dominantElement[0]} still carries ${spell(dominantElement[1])} of the ${settledScope}.`,
      ], slug, 'lede-element-lead')} ${pick(ELEMENT_SENSE[dominantElement[0]], slug, 'lede-element')}`,
    };
  }
  return {
    fact: `modality:${dominantModality[0]}:${dominantModality[1]}`,
    text: `${pick([
      `${capitalise(spell(dominantModality[1]))} of the ${settledScope} fall in ${dominantModality[0]} signs, the widest weighting the unknown hour leaves certain.`,
      `${dominantModality[0][0].toUpperCase()}${dominantModality[0].slice(1)} signs carry ${spell(dominantModality[1])} of the ${settledScope} — the broadest certain weighting in the chart.`,
      `Across the ${settledScope}, ${dominantModality[0]} leads with ${spell(dominantModality[1])}.`,
    ], slug, 'lede-modality-lead')} ${pick(MODALITY_SENSE[dominantModality[0]], slug, 'lede-modality')}`,
  };
}

/* ── Sun block ─────────────────────────────────────────────────────── */
function sunBlock(record, slug) {
  const sun = record.placements.find((placement) => placement.body === 'Sun');
  const decan = decanOf(sun.sign, sun.degree);
  const element = ELEMENT[sun.sign];
  const modality = MODALITY[sun.sign];
  const frames = [
    `The Sun sits at ${deg(sun.degree)} ${sun.signName} — the ${decan.ordinal} decan, ${decan.span}, which the tradition sub-rules by ${decan.ruler}. Degrees matter more than the sign label here: two people born a fortnight apart share ${sun.signName} and share almost nothing else about where the Sun actually stood.`,
    `At noon on that date the Sun stood at ${deg(sun.degree)} ${sun.signName}, inside the ${decan.ordinal} decan (${decan.span}), whose traditional sub-ruler is ${decan.ruler}. The decan is the older, finer division — it is what the sign looks like once you stop rounding it to thirty degrees.`,
    `The Sun's exact place is ${deg(sun.degree)} ${sun.signName}. That falls in the ${decan.ordinal} decan, ${decan.span}, sub-ruled by ${decan.ruler} in the classical scheme — ${elementWithArticle(element)} sign read through a ${modality} season.`,
      `${deg(sun.degree)} of ${sun.signName} is the Sun's exact seat — ${decan.ordinal} decan, ${decan.span}, sub-ruled by ${decan.ruler} in the old triplicity scheme. The degree is the address; the sign is only the street.`,
    `Measured rather than labelled, the Sun holds ${deg(sun.degree)} ${sun.signName}: the ${decan.ordinal} decan, whose classical sub-ruler is ${decan.ruler}. ${elementWithArticle(element).replace(/^./u, (character) => character.toUpperCase())} sign, read here in its ${decan.ordinal} face.`,
    `The Sun's position resolves to ${deg(sun.degree)} ${sun.signName} — deep enough in the ${decan.ordinal} decan (${decan.span}) that ${decan.ruler}, its traditional sub-ruler, colours the reading.`,
    `${sun.signName}, but precisely: ${deg(sun.degree)}, ${decan.ordinal} decan, ${decan.span}, under ${decan.ruler} in the triplicity scheme. The tradition kept these divisions because thirty degrees is a long street.`,
    `At the noon reference the Sun sits ${deg(sun.degree)} into ${sun.signName} — the ${decan.ordinal} decan, which the old scheme hands to ${decan.ruler}. Same sign, different decan, different chart.`,
];
  return {
    key: 'sun',
    title: 'Where the Sun actually stood',
    facts: [`sun-degree:${sun.degree.toFixed(2)}`, `decan:${sun.sign}:${decan.ordinal}`],
    text: pick(frames, slug, 'sun'),
  };
}

/* ── Geometry block: the two or three tightest stable aspects ──────── */
function geometryBlock(record, slug) {
  const aspects = record.aspectsStableAcrossCivilDay
    .filter((aspect) => aspect.a !== 'Moon' && aspect.b !== 'Moon')
    .slice(0, 3);
  if (aspects.length === 0) return null;
  const [first, ...rest] = aspects;
  const opening = pick([
    `The tightest geometry in the chart puts ${bodyLabel(first.a)} ${ASPECT_GEOMETRY[first.type]} from ${bodyLabel(first.b)}, ${deg(first.orb)} off exact.`,
    `${capitalise(bodyLabel(first.a))} and ${bodyLabel(first.b)} hold the closest angle here — ${aspectWithArticle(first.type)}, ${deg(first.orb)} wide.`,
    `Closest first: ${bodyLabel(first.a)} to ${bodyLabel(first.b)}, ${aspectWithArticle(first.type)} with ${deg(first.orb)} of slack.`,
      `The day's firmest angle joins ${bodyLabel(first.a)} and ${bodyLabel(first.b)} — ${aspectWithArticle(first.type)} holding at ${deg(first.orb)}.`,
    `Nothing in the geometry sits closer than ${bodyLabel(first.a)} and ${bodyLabel(first.b)}: ${deg(first.orb)} from an exact ${first.type}.`,
    `Start where the chart is tightest — ${bodyLabel(first.a)} ${first.type} ${bodyLabel(first.b)}, ${deg(first.orb)} of separation.`,
    `${capitalise(bodyLabel(first.a))} to ${bodyLabel(first.b)} is the closest call of the day, ${aspectWithArticle(first.type)} within ${deg(first.orb)}.`,
], slug, 'geometry-open');
  const tail = rest.length > 0
    ? ` Behind it, ${rest.map((aspect) => `${bodyLabel(aspect.a)} ${aspect.type} ${bodyLabel(aspect.b)} at ${deg(aspect.orb)}`).join(', and ')} — both still well inside the orbs this site uses.`
    : '';
  return {
    key: 'geometry',
    title: 'The angles that hold',
    facts: aspects.map((aspect) => `aspect:${aspect.a}:${aspect.b}:${aspect.type}:${aspect.orb}`),
    text: `${opening} ${pick(ASPECT_SENSE[first.type], slug, 'geometry-sense')}${tail} ${pick([
      'Every angle named here holds for the whole of that day at the birthplace, so an unknown hour cannot take it away.',
      'These angles were checked through every hour of that civil day and survive throughout, which is why an unrecorded hour does not disturb them.',
      'All of it stands whatever the hour was: each angle was tested from midnight to midnight before it was written down.',
          'Each angle here was measured at every hour of the civil day and held; whatever the missing clock said, this geometry was in it.',
      'The unknown hour cannot unmake any of this: every aspect named survived all twenty-five samples of the day.',
      'These are the day-proof angles — present at midnight, present at noon, present at the next midnight.',
], slug, 'geometry-tail')}`,
  };
}

/* ── Dignity block ─────────────────────────────────────────────────── */
function dignityBlock(record, slug) {
  const dignified = record.placements.filter((placement) => placement.dignity && placement.stableAcrossDay);
  if (dignified.length === 0) {
    return {
      key: 'dignity',
      title: 'The classical map',
      facts: ['dignity:none'],
      text: pick([
        'None of the seven classical planets falls in a sign the old scheme marks as strong or stretched. Worth saying plainly rather than leaving out: there is no ready-made verdict from the dignity table here, and the chart’s weight sits in its angles instead.',
        'The dignity table has nothing to say about this chart. All seven classical planets sit in signs it treats as neutral, so the reading rests entirely on placement and angle.',
        'No planet here is at home, exalted, in detriment, or in fall. That silence from the oldest layer of the scheme is itself a result, and it moves the weight of the reading onto the geometry.',
      ], slug, 'dignity-none'),
    };
  }
  // A condition is glossed on first mention only; repeating the same
  // clause four times is how a template announces itself as a template.
  const glossed = new Set();
  const lines = dignified.map((placement) => {
    const first = !glossed.has(placement.dignity);
    glossed.add(placement.dignity);
    return `${bodyLabel(placement.body)} in ${placement.signName} at ${deg(placement.degree)} is in ${placement.dignity}${first ? ` — ${DIGNITY_GLOSS[placement.dignity]}` : ''}`;
  });
  return {
    key: 'dignity',
    title: 'The classical map',
    facts: dignified.map((placement) => `dignity:${placement.body}:${placement.dignity}`),
    text: `${pick([
      `The dignity table, which predates the outer planets and only ever spoke for seven, marks ${dignified.length === 1 ? 'one placement' : `${spell(dignified.length)} placements`} here.`,
      `Of the seven planets the classical scheme judges, ${dignified.length === 1 ? 'one sits' : `${spell(dignified.length)} sit`} in a sign it has an opinion about.`,
      `The oldest layer of the scheme — seven planets, four conditions — flags ${dignified.length === 1 ? 'a single placement' : `${spell(dignified.length)} placements`} in this chart.`,
          `The classical table has ${dignified.length === 1 ? 'one entry' : `${spell(dignified.length)} entries`} for this chart.`,
      `Read against the old dignities, ${dignified.length === 1 ? 'one placement stands out' : `${spell(dignified.length)} placements stand out`}.`,
      `${dignified.length === 1 ? 'One planet here sits' : `${capitalise(spell(dignified.length))} planets here sit`} in a sign the classical scheme scores.`,
], slug, 'dignity-open')} ${capitalise(lines.join('; '))}. ${pick([
      'Dignity is a statement about conditions, not about worth.',
      'None of these labels is a verdict on a person; they describe how a function is situated, nothing more.',
      'The table describes circumstance rather than quality — a planet in detriment is inconvenienced, not diminished.',
          'The old table grades terrain, not talent — a placement in fall works uphill, nothing more.',
      'None of this ranks anyone; dignity describes footing, and footing can be worked with.',
      'Condition, not character: that is all the dignity table ever measured.',
], slug, 'dignity-close')}`,
  };
}

/* ── Shape block ───────────────────────────────────────────────────── */
function shapeBlock(record, slug) {
  const {
    elements, modalities, retrograde, directionUncertain, settledBodyCount,
  } = record.patterns;
  const orderedElements = Object.entries(elements).sort((a, b) => b[1] - a[1]);
  const orderedModalities = Object.entries(modalities).sort((a, b) => b[1] - a[1]);
  const missing = ['fire', 'earth', 'air', 'water'].filter((element) => !elements[element]);
  const stableDirectionLine = retrograde.length === 0
    ? ` ${pick([
      'Nothing was retrograde that day, which is less common than it sounds.',
      'Every body was moving forward that day — no apparent reversals anywhere in the chart.',
      'Not one planet was retrograde, so the whole chart reads in direct motion.',
          'Nothing here ran retrograde — all ten in direct motion that day.',
      'The day carried no retrograde motion at all; everything moved forward as seen from here.',
], slug, 'retro-none')}`
    : ` ${retrograde.length === 1 ? `${bodyLabel(retrograde[0])} was` : `${retrograde.map(bodyLabel).slice(0, -1).join(', ')} and ${bodyLabel(retrograde.at(-1))} were`} retrograde — ${pick([
      'apparent backward motion from where the Earth sits, which the tradition reads as a function turned inward before it is turned out.',
      'the backward drift a body appears to make as the Earth overtakes it, read in the scheme as a function that reviews before it releases.',
      'motion that reverses only from this vantage point, and which the old reading treats as delay used for revision.',
          'the optical reversal the tradition reads as review — energy turned over before it is turned out.',
      'apparent retreat against the stars, which the old reading takes as a function working from the inside first.',
], slug, 'retro-some')}`;
  const retroLine = directionUncertain.length === 0
    ? stableDirectionLine
    : ` ${retrograde.length > 0
      ? `${retrograde.length === 1 ? `${bodyLabel(retrograde[0])} was` : `${retrograde.map(bodyLabel).slice(0, -1).join(', ')} and ${bodyLabel(retrograde.at(-1))} were`} retrograde.`
      : 'Every other body stayed direct.'} ${directionUncertain.length === 1
      ? `${bodyLabel(directionUncertain[0])} changed direction during the day, so its motion is left open.`
      : `${directionUncertain.map(bodyLabel).slice(0, -1).join(', ')} and ${bodyLabel(directionUncertain.at(-1))} changed direction during the day, so their motion is left open.`}`;
  const missingLine = missing.length > 0
    ? ` No settled placement falls in ${missing.join(' or ')} — an absence the tradition treats as information, not as a defect.`
    : '';
  const settledScope = `${settledBodyCount} placements whose signs hold for the whole day`;
  const signTransitions = (record.signUncertainTransitions ?? [])
    .filter((transition) => transition.body !== 'Moon');
  const signTransitionFacts = signTransitions.map((transition) => (
    `sign-uncertain:${transition.body}:${transition.signAtCivilDayStart}:${transition.signAtCivilDayEnd}`
  ));
  const signTransitionLine = signTransitions.length === 0
    ? ''
    : ` ${signTransitions.map((transition) => (
      `${bodyLabel(transition.body)} crossed from ${SIGN_NAMES[transition.signAtCivilDayStart]} `
      + `into ${SIGN_NAMES[transition.signAtCivilDayEnd]} during that day, so its sign is left open.`
    )).join(' ')}`;
  const frames = [
    `Among the ${settledScope}, the elements divide ${orderedElements.map(([name, count]) => `${count} ${name}`).join(', ')}; by modality, ${orderedModalities.map(([name, count]) => `${count} ${name}`).join(', ')}.`,
    `The honest balance sheet uses the ${settledScope}: ${orderedElements.map(([name, count]) => `${name} ${count}`).join(', ')} across the elements, and ${orderedModalities.map(([name, count]) => `${name} ${count}`).join(', ')} across the modalities.`,
    `Counting only the ${settledScope}, the chart runs ${orderedElements.map(([name, count]) => `${count} ${name}`).join(', ')} by element and ${orderedModalities.map(([name, count]) => `${count} ${name}`).join(', ')} by modality.`,
      `Of the ${settledScope}: ${orderedElements.map(([name, count]) => `${count} in ${name}`).join(', ')} by element, ${orderedModalities.map(([name, count]) => `${count} ${name}`).join(', ')} by modality.`,
    `Tallied where the signs are certain — ${settledScope} — the chart gives ${orderedElements.map(([name, count]) => `${name} ${count}`).join(', ')}, and ${orderedModalities.map(([name, count]) => `${name} ${count}`).join(', ')} across the modes.`,
    `The certain ground: ${settledScope}, dividing ${orderedElements.map(([name, count]) => `${count} ${name}`).join(', ')} by element and ${orderedModalities.map(([name, count]) => `${count} ${name}`).join(', ')} by mode.`,
    `Balance, counted honestly across the ${settledScope}: elements ${orderedElements.map(([name, count]) => `${name} ${count}`).join(', ')}; modalities ${orderedModalities.map(([name, count]) => `${name} ${count}`).join(', ')}.`,
];
  return {
    key: 'shape',
    title: 'The shape of the whole',
    facts: [
      `elements:${orderedElements.map(([name, count]) => `${name}${count}`).join('-')}`,
      `modalities:${orderedModalities.map(([name, count]) => `${name}${count}`).join('-')}`,
      `settled-signs:${settledBodyCount}`,
      `retrograde:${retrograde.length}`,
      ...signTransitionFacts,
    ],
    text: `${pick(frames, slug, 'shape')}${pick([true, true, false], slug, 'shape-gloss') ? ` ${pick(ELEMENT_SENSE[orderedElements[0][0]], slug, 'shape-element')}` : ''}${signTransitionLine}${missingLine}${retroLine}`,
  };
}

/* ── Moon block: stable, or the uncertain-Moon state ───────────────── */
function moonBlock(record, slug) {
  const moon = record.placements.find((placement) => placement.body === 'Moon');
  const band = record.unknownTimeErrorBandDegrees.Moon;
  if (record.moon.uncertain) {
    return {
      key: 'moon',
      title: 'The Moon is genuinely open',
      facts: [`moon-uncertain:${record.moon.signAtCivilDayStart}:${record.moon.signAtCivilDayEnd}`],
      uncertain: true,
      text: `The Moon crossed from ${SIGN_NAMES[record.moon.signAtCivilDayStart]} into ${SIGN_NAMES[record.moon.signAtCivilDayEnd]} during that day at the birthplace, travelling ${deg(band)} between one midnight and the next. ${pick([
        'Without a recorded hour there is no honest way to say which side it was on, so this reading does not say. The Moon sign is a real question here, not a rounding error, and it needs a birth time nobody has published.',
        'Which of the two it was depends entirely on the hour, and the hour is not recorded. Rather than pick the likelier half, the reading leaves the Moon open.',
        'A birth time would settle it in a second; there isn’t one. So the Moon stays unnamed here — the alternative is a guess wearing the clothes of a fact.',
              'The hour would decide it; no hour was recorded. The reading keeps the question open rather than flipping a coin dressed as astrology.',
        'Half the day belongs to each sign, and the split falls at an unrecorded hour — so this page holds the Moon as a genuine unknown.',
], slug, 'moon-uncertain')}`,
    };
  }
  return {
    key: 'moon',
    title: 'The Moon, and how far it can move',
    facts: [`moon-sign:${moon.sign}`, `moon-band:${band.toFixed(1)}`],
    uncertain: false,
    text: `The Moon stayed in ${moon.signName} for the whole of that day at the birthplace, covering ${deg(band)} between midnight and midnight. ${pick([
      'Fast enough that its degree is approximate, slow enough that its sign is not in doubt.',
      'That is quick enough to make the exact degree a neighbourhood rather than an address, and slow enough to leave the sign settled.',
      'The sign survives the missing hour; the degree does not, and is given as a reference rather than a fact.',
          'Whatever the unrecorded hour was, it happened inside one Moon sign — the degree floats, the sign holds.',
      'The missing clock moves the Moon by half a sign at most here, and the boundary was never close.',
], slug, 'moon-stable')} At the noon reference it stands at ${deg(moon.degree)}.`,
  };
}

function personalBlock(record, slug) {
  const rows = record.placements
    .filter((placement) => ['Mercury', 'Venus', 'Mars'].includes(placement.body) && placement.stableAcrossDay)
    .map((placement) => ({
      name: placement.body,
      deg: deg(placement.degree),
      sign: placement.signName,
      element: ELEMENT[placement.sign],
      clause: pick(PLANET_ELEMENT_CLAUSE[placement.body][ELEMENT[placement.sign]], slug, `personal-${placement.body}`),
    }));
  if (rows.length < 2) return null;
  return {
    key: 'personal',
    title: pick(['The fast planets', 'Closer to the ground', 'The personal registers'], slug, 'personal-title'),
    facts: rows.map((row) => `personal:${row.name}:${row.sign}:${row.deg}`),
    text: pick(PERSONAL_FRAMES, slug, 'personal-frame')(rows),
  };
}

function figuresBlock(record, slug) {
  const aspects = record.aspectsStableAcrossCivilDay;
  const has = (a, b, type) => aspects.some((aspect) => aspect.type === type
    && ((aspect.a === a && aspect.b === b) || (aspect.a === b && aspect.b === a)));
  const bodies = [...new Set(record.placements.map((placement) => placement.body))];
  const figures = [];
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      for (let k = j + 1; k < bodies.length; k += 1) {
        const [a, b, c] = [bodies[i], bodies[j], bodies[k]];
        if (has(a, b, 'trine') && has(b, c, 'trine') && has(a, c, 'trine')) {
          figures.push({ kind: 'grand-trine', members: [a, b, c] });
        }
        if (has(a, b, 'opposition') && has(a, c, 'square') && has(b, c, 'square')) {
          figures.push({ kind: 't-square', members: [a, b], apex: c });
        }
        if (has(a, c, 'opposition') && has(a, b, 'square') && has(c, b, 'square')) {
          figures.push({ kind: 't-square', members: [a, c], apex: b });
        }
        if (has(b, c, 'opposition') && has(b, a, 'square') && has(c, a, 'square')) {
          figures.push({ kind: 't-square', members: [b, c], apex: a });
        }
      }
    }
  }
  const aspected = new Set(aspects.flatMap((aspect) => [aspect.a, aspect.b]));
  const unaspected = bodies.filter((body) => !aspected.has(body));
  const trine = figures.find((figure) => figure.kind === 'grand-trine');
  const tsq = figures.find((figure) => figure.kind === 't-square'
    && !(trine && figure.members.every((member) => trine.members.includes(member))));
  const parts = [];
  const facts = [];
  if (trine) {
    parts.push(`${trine.members.map(bodyLabel).join(', ')} close a triangle of trines. ${pick(FIGURE_SENSE['grand-trine'], slug, 'fig-gt')}`);
    facts.push(`figure:grand-trine:${trine.members.join('-')}`);
  }
  if (tsq) {
    parts.push(`${capitalise(bodyLabel(tsq.members[0]))} opposes ${bodyLabel(tsq.members[1])} while both square ${bodyLabel(tsq.apex)}. ${pick(FIGURE_SENSE['t-square'], slug, 'fig-ts')}`);
    facts.push(`figure:t-square:${tsq.members.join('-')}:apex-${tsq.apex}`);
  }
  if (unaspected.length > 0 && parts.length < 2) {
    parts.push(`${capitalise(bodyLabel(unaspected[0]))} ${pick(FIGURE_SENSE.unaspected, slug, 'fig-un')}.`);
    facts.push(`figure:unaspected:${unaspected[0]}`);
  }
  if (parts.length === 0) {
    parts.push(pick(FIGURE_SENSE.none, slug, 'fig-none'));
    facts.push('figure:none');
  }
  return {
    key: 'figures',
    title: pick(['What the angles build', 'The standing structure', 'Figures in the geometry'], slug, 'figures-title'),
    facts,
    text: parts.join(' '),
  };
}

/* ── Assembly ──────────────────────────────────────────────────────── */
/**
 * FREEZE_EXISTING=1 composes only people with no committed copy file —
 * the released pilot pages stay byte-frozen — while the similarity
 * measurement at the end always runs across every copy file, old and new.
 */
const FREEZE = process.env.FREEZE_EXISTING === '1';
const CHECK = process.argv.includes('--check');
const MIGRATE_ARTICLES = process.argv.includes('--migrate-articles');
const MIGRATE_IDENTITIES = process.argv.includes('--migrate-identities');
const MIGRATION = MIGRATE_ARTICLES || MIGRATE_IDENTITIES;
// A reviewed factual correction recomposes only its named records. The
// complete corpus still participates in the unchanged depth/similarity gate.
const correctedSlugs = new Set(process.argv
  .filter((argument) => argument.startsWith('--slug='))
  .flatMap((argument) => argument.slice('--slug='.length).split(','))
  .map((slug) => slug.trim()).filter(Boolean));
if (correctedSlugs.size && (CHECK || MIGRATION || FREEZE)) {
  throw new Error('--slug cannot be combined with check, migration, or freeze modes');
}
let migratedIdentities = 0;
if ([CHECK, MIGRATE_ARTICLES, MIGRATE_IDENTITIES].filter(Boolean).length > 1 || ((CHECK || MIGRATION) && FREEZE)) {
  throw new Error('Choose one of --check, --migrate-articles, --migrate-identities, or FREEZE_EXISTING=1');
}
/* Deterministic similarity repair: reseeds.json maps slug → round.
   A bumped round changes every pooled pick on that one page. */
let reseeds = {};
try { reseeds = JSON.parse(await readFile(join(PILOT, 'reseeds.json'), 'utf8')); } catch {}
const policy = JSON.parse(await readFile(join(PILOT, 'index-policy.json'), 'utf8'));
const withdrawnSlugs = new Set((policy.withdrawn ?? []).map((entry) => entry.slug));
const candidates = JSON.parse(await readFile(join(PILOT, 'candidates.json'), 'utf8'))
  .filter((candidate) => candidate.role === 'pilot' && !withdrawnSlugs.has(candidate.slug));
if (!CHECK) await mkdir(join(PILOT, 'copy'), { recursive: true });
const existingCopy = new Set((await readdir(join(PILOT, 'copy')))
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/u, '')));
const candidateSlugs = new Set(candidates.map((candidate) => candidate.slug));
for (const slug of correctedSlugs) {
  if (!candidateSlugs.has(slug)) throw new Error(`Unknown People correction slug: ${slug}`);
}
const candidatesBySlug = new Map(candidates.map((candidate) => [candidate.slug, candidate]));
const orphanCopy = [...existingCopy].filter((slug) => !candidateSlugs.has(slug)).sort();
if (orphanCopy.length > 0) {
  throw new Error(`Generated copy has orphan file(s): ${orphanCopy.join(', ')}`);
}
const migrateArticles = (source) => source
  .replaceAll('a axis', 'an axis')
  .replaceAll('a opposition', 'an opposition')
  .replaceAll('a air', 'an air')
  .replaceAll('a earth', 'an earth')
  .replaceAll('A air', 'An air')
  .replaceAll('A earth', 'An earth');
if (CHECK || MIGRATE_ARTICLES) {
  for (const slug of existingCopy) {
    const copyPath = join(PILOT, 'copy', `${slug}.json`);
    const existing = await readFile(copyPath, 'utf8');
    const migrated = migrateArticles(existing);
    if (CHECK && migrated !== existing) {
      throw new Error(`${slug}: generated article grammar drift; run compose-copy.mjs --migrate-articles`);
    }
    if (MIGRATE_ARTICLES && migrated !== existing) {
      await writeFile(copyPath, migrated, 'utf8');
    }
  }
}
if (CHECK || MIGRATE_IDENTITIES) {
  for (const slug of Object.keys(PRINCIPAL_IDENTITIES)) {
    const candidate = candidatesBySlug.get(slug);
    if (!candidate || !existingCopy.has(slug)) throw new Error(`${slug}: reviewed identity source is missing`);
    const copyPath = join(PILOT, 'copy', `${slug}.json`);
    const existing = JSON.parse(await readFile(copyPath, 'utf8'));
    const evidence = JSON.parse(await readFile(join(PILOT, 'evidence', `${slug}.json`), 'utf8'));
    const identity = reviewedIdentity(candidate, evidence, existing.identity);
    if (CHECK && existing.identity !== identity) {
      throw new Error(`${slug}: identity drift; run compose-copy.mjs --migrate-identities`);
    }
    if (MIGRATE_IDENTITIES && existing.identity !== identity) {
      await writeFile(copyPath, `${JSON.stringify({ ...existing, identity }, null, 2)}\n`, 'utf8');
      migratedIdentities += 1;
    }
  }
}

const pages = [];
const bySign = {};
for (const candidate of candidates) {
  if (CHECK || MIGRATION) {
    if (!existingCopy.has(candidate.slug)) throw new Error(`${candidate.slug}: generated copy is missing`);
    continue;
  }
  const record = JSON.parse(await readFile(join(PILOT, 'computed', `${candidate.slug}.json`), 'utf8'));
  bySign[record.sun.sign] = bySign[record.sun.sign] ?? [];
  bySign[record.sun.sign].push(candidate.slug);
}

let composed = 0;
for (const candidate of candidates) {
  if (CHECK || MIGRATION) continue;
  if (correctedSlugs.size && !correctedSlugs.has(candidate.slug)) continue;
  const seedRound = reseeds[candidate.slug] ?? 0;
  if (FREEZE && existingCopy.has(candidate.slug)) {
    const existing = JSON.parse(await readFile(join(PILOT, 'copy', `${candidate.slug}.json`), 'utf8'));
    if ((existing.seedRound ?? 0) === seedRound) continue;
  }
  const seedSlug = seedRound === 0 ? candidate.slug : `${candidate.slug}#${seedRound}`;
  const record = JSON.parse(await readFile(join(PILOT, 'computed', `${candidate.slug}.json`), 'utf8'));
  const evidence = reviewedEvidence(JSON.parse(await readFile(join(PILOT, 'evidence', `${candidate.slug}.json`), 'utf8')), candidate.slug);
  const opening = lede(record, seedSlug);
  const blocks = [
    sunBlock(record, seedSlug),
    personalBlock(record, seedSlug),
    geometryBlock(record, seedSlug),
    figuresBlock(record, seedSlug),
    dignityBlock(record, seedSlug),
    shapeBlock(record, seedSlug),
    moonBlock(record, seedSlug),
  ].filter(Boolean);
  if (sourceReviews.people[candidate.slug]?.status === 'reference-location') {
    for (const block of blocks) block.text = block.text.replace(/at the birthplace/gu, 'at the calculation reference location');
  }
  composed += 1;

  const month = Number(record.gregorianDate.slice(5, 7));
  const day = Number(record.gregorianDate.slice(8, 10));
  const page = {
    schema: 'zodiacs.phase5.copy.v1',
    slug: candidate.slug,
    seedRound,
    qid: record.qid,
    displayName: record.displayName,
    identity: identityLine(evidence, record, candidate),
    title: `${record.displayName}'s birth chart`,
    metaDescription: `${record.displayName}'s chart, computed from ${sourceReviews.people[candidate.slug]?.status === 'adopted-date' ? 'an adopted, uncertain birth date' : 'a sourced birth date'}: Sun at ${deg(record.sun.degree)} ${record.sun.signName}. Birth time unknown, so no houses or rising sign.`,
    lede: opening.text,
    ledeFact: opening.fact,
    blocks,
    birthdayLink: {
      href: `/birthday/${MONTHS[month - 1]}-${day}/`,
      label: `Everyone born on ${MONTH_NAMES[month - 1]} ${day}`,
    },
    signLink: { href: `/${record.sun.sign}/`, label: `The ${record.sun.signName} guide` },
    substantiveFacts: [opening.fact, ...blocks.flatMap((block) => block.facts)],
  };
  const original = [page.lede, ...blocks.map((block) => block.text)].join('\n\n');
  page.measurements = {
    originalWords: original.trim().split(/\s+/u).length,
    substantiveStatements: new Set(page.substantiveFacts).size,
    blocks: blocks.length,
  };
  const copyPath = join(PILOT, 'copy', `${candidate.slug}.json`);
  const serializedPage = migrateArticles(`${JSON.stringify(page, null, 2)}\n`);
  await writeFile(copyPath, serializedPage, 'utf8');
  pages.push(page);
}

/* ── Cross-page similarity, using the repository's own metric ──────── */
function normalisedWords(source) {
  return source.replace(/[^a-z0-9\s]/gi, ' ').toLowerCase().split(/\s+/u).filter((word) => word.length > 2);
}
function shingles(source, width = 5) {
  const words = normalisedWords(source);
  return new Set(words.slice(0, Math.max(0, words.length - width + 1))
    .map((_, index) => words.slice(index, index + width).join(' ')));
}
function jaccard(left, right) {
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

const allCopyFiles = (await readdir(join(PILOT, 'copy'))).filter((file) => file.endsWith('.json'));
const allPages = [];
for (const file of allCopyFiles) {
  const page = JSON.parse(await readFile(join(PILOT, 'copy', file), 'utf8'));
  allPages.push(page);
}
const grams = allPages.map((page) => ({
  slug: page.slug,
  set: shingles([page.lede, ...page.blocks.map((block) => block.text)].join(' ')),
}));
let highest = { similarity: 0, pair: [] };
const matrix = [];
const perSlugMax = {};
for (let i = 0; i < grams.length; i += 1) {
  for (let j = i + 1; j < grams.length; j += 1) {
    const similarity = jaccard(grams[i].set, grams[j].set);
    if (similarity > 0.15) matrix.push({ a: grams[i].slug, b: grams[j].slug, similarity: Number(similarity.toFixed(4)) });
    if (similarity > (perSlugMax[grams[i].slug] ?? 0)) perSlugMax[grams[i].slug] = Number(similarity.toFixed(4));
    if (similarity > (perSlugMax[grams[j].slug] ?? 0)) perSlugMax[grams[j].slug] = Number(similarity.toFixed(4));
    if (similarity > highest.similarity) highest = { similarity, pair: [grams[i].slug, grams[j].slug] };
  }
}
matrix.sort((a, b) => b.similarity - a.similarity);

const words = allPages.map((page) => (page.measurements ?? page.contentDepth ?? {}).originalWords ?? page.measurements.originalWords);
const statements = allPages.map((page) => page.measurements.substantiveStatements);
const report = {
  schema: 'zodiacs.phase5.depth-report.v1',
  metric: '5-word shingle Jaccard similarity, the metric scripts/check-programmatic-uniqueness.mjs already applies to the 78 compatibility pages',
  pages: allPages.length,
  originalWords: { min: Math.min(...words), max: Math.max(...words), median: words.sort((a, b) => a - b)[Math.floor(words.length / 2)] },
  substantiveStatements: { min: Math.min(...statements), max: Math.max(...statements) },
  highestSimilarity: { pair: highest.pair, similarity: Number(highest.similarity.toFixed(4)) },
  topPairs: matrix.slice(0, 10),
  perSlugMax,
};
const reportPath = join(PILOT, 'depth-report.json');
const serializedReport = `${JSON.stringify(report, null, 1)}\n`;
if (CHECK) {
  const existing = await readFile(reportPath, 'utf8').catch(() => '');
  if (existing !== serializedReport) {
    throw new Error('People depth report drifted; run node docs/phase5/people-pilot/tools/compose-copy.mjs');
  }
} else {
  await writeFile(reportPath, serializedReport, 'utf8');
}

console.log(`${CHECK ? 'Checked' : MIGRATION ? 'Migrated' : 'Composed'} ${MIGRATE_IDENTITIES ? migratedIdentities : CHECK || MIGRATION ? allPages.length : FREEZE ? composed : pages.length} pages; measured ${allPages.length} total.`);
console.log(`Original words: min ${report.originalWords.min}, median ${report.originalWords.median}, max ${report.originalWords.max}`);
console.log(`Substantive statements: min ${report.substantiveStatements.min}, max ${report.substantiveStatements.max}`);
console.log(`Highest cross-page similarity: ${report.highestSimilarity.similarity} (${report.highestSimilarity.pair.join(' <> ')})`);
console.table(report.topPairs.slice(0, 5));
