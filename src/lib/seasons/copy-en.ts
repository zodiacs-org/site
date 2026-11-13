/**
 * English copy for the sign-season pages (/seasons/ and /seasons/{sign}/).
 *
 * Other locales follow the same shape: a SeasonCopy for each of the twelve
 * signs and a SeasonUi of chrome strings, registered in copy.ts. Nothing here
 * carries a date: dates and times come from the ingress table at build time
 * and from the visitor's clock on the page.
 *
 * `asks` runs round the zodiac from the season's own sign: asks[0] is for
 * the season's sign (its first solar house), asks[1] for the sign after it
 * (for whom the season is the twelfth house, the month before their own),
 * and so on to asks[11], the sign before it (the second house). copy.ts's
 * seasonAsk picks a reader's line. Each line is a Sun-sign reading, shown
 * with its reading confidence.
 *
 * Voice: plain, warm, specific. No dashes, no health, money or betting
 * predictions, no guarantees.
 */
export interface SeasonCopy {
  /** One sentence: the season in brief, used on the hub, the card and the description. */
  theme: string;
  /** What the season is about, in a few short paragraphs. */
  about: readonly string[];
  /** What the season asks of each sign, from the season's own sign round the zodiac. */
  asks: readonly string[];
  /** The question the Guide button drafts. */
  guidePrompt: string;
}

import type { Element, Modality } from '../signs';

/** What a season page's head and FAQ are written from. */
export interface SeasonFacts {
  /** The season's title, ui.title(sign). */
  title: string;
  /** The sign's name in the page's language. */
  sign: string;
  /** Whether the season shown is under way or next; null when no dates are published. */
  phase: 'under-way' | 'upcoming' | null;
  /** When the Sun enters and leaves, written as a UTC date and time. */
  start: string;
  end: string;
  days: number;
  /** The reading-confidence label and its value. */
  confidence: string;
  value: number;
}

export interface SeasonUi {
  /** BCP 47 tag the pages write dates in. */
  dateLocale: string;
  hubMetaTitle: string;
  /** The hub's description: with the season under way and its last day, or without. */
  hubDescription: (title: string | null, until: string) => string;
  hubFeatureLabel: string;
  hubAllHeading: string;
  hubNote: string;
  hubImageAlt: string;
  /** A date range: "November 22 to December 21, 2026". */
  range: (from: string, to: string) => string;
  /** The season page's document title, before " | Zodiacs.org". */
  metaTitle: (title: string, year: string | null) => string;
  description: (facts: SeasonFacts) => string;
  faq: (facts: SeasonFacts) => { q: string; a: string }[];
  /** "Mutable fire". */
  quality: (modality: Modality, element: Element) => string;
  /** "Ruled by Jupiter"; the ruler is the English planet key. */
  ruledBy: (ruler: string) => string;
  aboutDays: (days: number) => string;
  imageAlt: (sign: string) => string;
  eventName: (title: string, year: string) => string;
  eventDescription: (sign: string, start: string, end: string) => string;
  /** The heading over one sign's line on the story card. */
  forSign: (sign: string) => string;
  /** "Reading confidence NN%", in the page's language. */
  confidence: (value: number) => string;
  hubTitle: string;
  hubLede: string;
  hubNow: string;
  hubNext: string;
  kicker: (sign: string) => string;
  title: (sign: string) => string;
  enters: string;
  leaves: string;
  localNote: string;
  startsIn: string;
  endsIn: string;
  upcoming: (date: string) => string;
  underWay: (date: string) => string;
  noWindow: string;
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  aboutHeading: string;
  asksHeading: string;
  asksLede: string;
  houseLine: (house: string) => string;
  ownSeason: string;
  readHoroscope: string;
  cardHeading: string;
  cardLede: string;
  cardSign: string;
  cardNoSign: string;
  cardMake: string;
  cardShare: string;
  cardDownload: string;
  cardPreparing: string;
  cardError: string;
  cardPrivacy: string;
  datesHeading: string;
  datesLede: string;
  datesSeason: string;
  datesEnters: string;
  datesLeaves: string;
  datesDays: string;
  moreHeading: string;
  signGuide: (sign: string) => string;
  horoscope: (sign: string) => string;
  allSeasons: string;
  birthChart: string;
  guideLead: string;
  guideLabel: string;
  faqHeading: string;
}

export const SEASON_HOUSE_ORDINALS_EN = [
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
  'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
] as const;

export const SEASON_UI_EN: SeasonUi = {
  dateLocale: 'en-US',
  hubMetaTitle: 'Sign Seasons: When Each Zodiac Season Starts and Ends',
  hubDescription: (title, until) => (title
    ? `It is ${title} until ${until}. When each of the twelve sign seasons starts and ends, and what each one asks of every sign.`
    : 'When each of the twelve sign seasons starts and ends, and what each one asks of every sign.'),
  hubFeatureLabel: 'Now and next',
  hubAllHeading: 'All twelve, in the order the Sun reaches them',
  hubNote: 'Dates are in UTC. Each season’s page gives the exact times in your own time zone, with a countdown.',
  hubImageAlt: 'Sign seasons, Zodiacs.org',
  range: (from, to) => `${from} to ${to}`,
  metaTitle: (title, year) => `${title} ${year ? `${year}: ` : ''}Dates, Countdown and What It Asks`,
  description: ({ title, sign, phase, start, end }) => (phase
    ? `${title} ${phase === 'under-way' ? 'is under way' : 'starts'}: the Sun enters ${sign} on ${start} and leaves on ${end}. What the season asks of all twelve signs.`
    : `${title}: when the Sun enters and leaves ${sign}, and what the season asks of all twelve signs.`),
  faq: ({ sign, phase, start, end, days, confidence, value }) => [
    ...(phase ? [{
      q: `When does ${sign} season ${phase === 'under-way' ? 'end' : 'start'}?`,
      a: `The Sun enters ${sign} on ${start} and leaves on ${end}, about ${days} days later. The page shows both moments in your own time zone.`,
    }] : []),
    {
      q: `Why do the ${sign} dates change from year to year?`,
      a: `The usual ${sign} dates are an average. The calendar year is not a whole number of days long, so the moment the Sun crosses into ${sign} drifts by some hours each year and can land on a neighbouring date, depending on your time zone as well.`,
    },
    {
      q: `What if I was born on the first or last day of ${sign} season?`,
      a: 'Your Sun sign depends on the exact moment of your birth, not on the average dates. A birth chart with your birth time settles it.',
    },
    {
      q: `What does “${confidence}” mean?`,
      a: `It says how specific a reading is. A line written for a Sun sign alone, with no date or birth time, carries ${value}%. It is not the chance that something happens.`,
    },
  ],
  quality: (modality, element) => `${modality.charAt(0).toUpperCase() + modality.slice(1)} ${element}`,
  ruledBy: (ruler) => `Ruled by ${ruler}`,
  aboutDays: (days) => `About ${days} days`,
  imageAlt: (sign) => `${sign}, Zodiacs.org`,
  eventName: (title, year) => `${title} ${year}`,
  eventDescription: (sign, start, end) => `The Sun is in ${sign} from ${start} to ${end}.`,
  forSign: (sign) => `For ${sign}`,
  confidence: (value) => `Reading confidence ${value}%`,
  hubTitle: 'Sign seasons',
  hubLede: 'The Sun spends about a month in each sign. Each season has its own pace, and each asks something different of every sign. Here is when each one starts and ends.',
  hubNow: 'Now',
  hubNext: 'Next',
  kicker: (sign) => `The Sun in ${sign}`,
  title: (sign) => `${sign} season`,
  enters: 'The Sun enters',
  leaves: 'The Sun leaves',
  localNote: 'Times are shown in your time zone. The table below gives them in UTC.',
  startsIn: 'Starts in',
  endsIn: 'Ends in',
  upcoming: (date) => `Starts ${date}`,
  underWay: (date) => `Under way until ${date}`,
  noWindow: 'The next dates for this season are not published yet.',
  days: 'days',
  hours: 'hours',
  minutes: 'min',
  seconds: 'sec',
  aboutHeading: 'What the season is about',
  asksHeading: 'What it asks of each sign',
  asksLede: 'Read your Sun sign, and your rising sign too if you know it. Each line follows the part of your chart the season passes through.',
  houseLine: (house) => `Your ${house} house`,
  ownSeason: 'Your own season',
  readHoroscope: 'Today’s horoscope',
  cardHeading: 'Share the season',
  cardLede: 'A story image, 1080 by 1920, made on your device. Add a sign if you like: the card shows the sign and nothing about you.',
  cardSign: 'Add a sign',
  cardNoSign: 'No sign, just the season',
  cardMake: 'Make the story card',
  cardShare: 'Share story',
  cardDownload: 'Download',
  cardPreparing: 'Making the image…',
  cardError: 'This browser could not draw the image.',
  cardPrivacy: 'Nothing is sent anywhere until you share it.',
  datesHeading: 'Year by year',
  datesLede: 'The exact instants the Sun enters and leaves the sign, in UTC. The sign dates you see quoted are averages; the real crossing moves by up to a day from year to year.',
  datesSeason: 'Season',
  datesEnters: 'Enters (UTC)',
  datesLeaves: 'Leaves (UTC)',
  datesDays: 'Days',
  moreHeading: 'Read further',
  signGuide: (sign) => `The ${sign} guide`,
  horoscope: (sign) => `${sign} horoscope`,
  allSeasons: 'All twelve seasons',
  birthChart: 'Your birth chart',
  guideLead: 'Want to know what the season means for your own chart?',
  guideLabel: 'Ask Guide about this season',
  faqHeading: 'Questions, answered',
};

export const SEASON_COPY_EN: Readonly<Record<string, SeasonCopy>> = {
  aries: {
    theme: 'The Sun starts the zodiac again: a month for beginnings, nerve and making the first move.',
    about: [
      'Aries season starts at the March equinox, when the Sun reaches 0 degrees Aries and the zodiac begins again. Astrology treats it as the real new year. Aries is a cardinal fire sign ruled by Mars, and everything about it points at first moves.',
      'In plain terms it is a month for starting. Ideas that sat through the winter want a first draft, a first call, a first step. Energy runs high and patience runs short.',
      'The risk is impatience. Give new plans a few weeks before you judge them, and finish one thing for every two you start.',
    ],
    asks: [
      'It is your season, and your year turns over. Start the thing you have been circling, and let people see you start it.',
      'Your own season is next, so this is the quiet month before it. Rest, finish what is half done, and let a few things go before you begin again.',
      'Friends and groups get busy. Join the thing, start the group chat, and say out loud what you are hoping for this year.',
      'Your work is on show. Pitch, apply, or put your name on something; effort made in public counts double this month.',
      'The horizon pulls. Book the trip, sign up for the course, or argue for the idea you actually believe in.',
      'Something shared asks to be settled: a promise, a favour owed, a question of trust. Bring it into the open and deal with it cleanly.',
      'Other people make the first move. Let a partner or close collaborator lead for once, and answer them plainly.',
      'Your days want a new routine. Pick one habit and begin it on a Monday, without announcing a whole new life.',
      'Play gets bolder. Ask the person out, start the creative project before you feel ready, and enjoy being a beginner.',
      'The new energy starts at home. Fix the thing that annoys you every morning, and have the family conversation you have been saving.',
      'Messages move fast. Say the direct thing early, answer what is waiting, and take the short trip you keep putting off.',
      'The fresh push lands on what you own and value. Clear out what you no longer use and put your effort behind what you would miss.',
    ],
    guidePrompt: 'What does Aries season ask of my sign this year?',
  },
  taurus: {
    theme: 'The Sun slows down in Taurus: a month for patience, comfort and building something that lasts.',
    about: [
      'Taurus season follows the rush of Aries with a fixed earth sign ruled by Venus. The Sun spends about a month here, from late April into May.',
      'It is a month for sticking with things. Keep going with what started in spring, enjoy what is in front of you, and notice what you value enough to look after.',
      'The risk is stubbornness. Steady is good; stuck is not, so stay open to small changes.',
    ],
    asks: [
      'It is your season. Take your time, make your surroundings comfortable, and decide what you want to build over the year ahead.',
      'Your own season is next, so this month is for rest. Sleep in, stay home a little more, and let one stubborn worry go.',
      'Friendships want time more than plans. Have a long dinner with your people, and turn one shared hope into a concrete plan.',
      'Your work rewards consistency. Keep doing the thing you are good at, visibly and on schedule, rather than reaching for a dramatic change.',
      'Plans for travel or study want a practical shape. Pick a date, set aside the time, and take a first step you can manage this week.',
      'Shared matters ask for patience. Trust built slowly is the kind that holds, so do not rush anyone into telling you more than they want to.',
      'A partner or close friend wants steadiness from you. Show up when you said you would, and let small reliable gestures do the talking.',
      'Routines settle in. Build one steady daily habit and protect it, and let the work in front of you be done well rather than fast.',
      'Pleasure is the point this month. Enjoy good food, good company and a hobby with your hands, and let romance move at its own pace.',
      'Home wants attention, and the attention can be pleasant. Cook, rearrange, plant something, and keep close the people who make it feel like home.',
      'Conversations slow down and get practical. Say less and mean it, and keep your promises to neighbours and siblings.',
      'The steady mood lands on what you keep and value. Look after your things, mend before you replace, and notice what makes a day good.',
    ],
    guidePrompt: 'What does Taurus season ask of my sign this year?',
  },
  gemini: {
    theme: 'The Sun moves into Gemini: a month for conversation, curiosity and keeping several threads going.',
    about: [
      'Gemini season is a mutable air sign ruled by Mercury. It runs from late May to the June solstice.',
      'It is a month for talk and learning. Messages multiply, plans change quickly, and curiosity is the best guide you have.',
      'The risk is scattering yourself thin. Pick the two or three threads that matter and let the rest wait.',
    ],
    asks: [
      'It is your season. Talk to new people, follow your curiosity, and let your year begin with a few good conversations.',
      'Your own season is next, so this is the quiet month before it. Write things down, keep a few thoughts to yourself, and give your mind a rest.',
      'Your social calendar fills. Say yes to the group plan, meet friends of friends, and share the idea you have been turning over.',
      'Work runs on communication. Send the proposal, update your profile, and make sure the people who decide know what you are doing.',
      'Your curiosity goes long distance. Read the book, take the course, plan the trip, and talk to someone who sees the world differently.',
      'Questions about trust want asking out loud. Have the honest conversation about what you share, and read the small print before you sign.',
      'Conversations with partners matter more than usual. Listen for what is actually being asked, and say clearly what you need in return.',
      'Your to do list grows in every direction. Group the small tasks, answer messages in batches, and leave gaps between them.',
      'Flirting, games and wordplay come easily. Write something for fun, ask a lot of questions on a date, and keep things light.',
      'Home gets noisy in a good way. Talk with family, sort the drawers and the paperwork, and invite people over.',
      'Messages pile up, and that suits you this month. Reply, call, write, and say yes to the short trip or the class down the road.',
      'Ideas land on how you spend your time and what you value. Learn a skill that makes your days easier, and swap what you know with people around you.',
    ],
    guidePrompt: 'What does Gemini season ask of my sign this year?',
  },
  cancer: {
    theme: 'The Sun enters Cancer at the June solstice: a month for home, care and the people who feel like family.',
    about: [
      'Cancer season begins at the June solstice, when the Sun reaches 0 degrees Cancer. It is a cardinal water sign ruled by the Moon.',
      'It is a month for looking after people and places. Home, family, memory and feeling come forward, and small kindnesses go a long way.',
      'The risk is retreating too far into your shell. Keep one door open.',
    ],
    asks: [
      'It is your season, and a time to look after yourself first. Decide what home and belonging should look like this year, and start there.',
      'Your own season is next, so this month is for withdrawing a little. Let old feelings surface and pass, and come back rested.',
      'Friends become family this month. Host, check on the friend who has gone quiet, and put effort into the group that holds you.',
      'Your public life asks for a caring touch. Look after your team, mentor someone, and let people see the side of you that cares.',
      'The pull is toward places and ideas that feel like home. Visit somewhere you belong, or learn the history of where you come from.',
      'Deep feelings come up around what you share with others. Be honest about what you need to feel safe, and ask the same of them.',
      'Partners need care and want to give it. Make room for a quiet evening together, and let yourself be looked after too.',
      'Your daily rhythm asks for gentleness. Build small routines that look after you, and keep work from spilling into every evening.',
      'Affection comes easily. Make something with love, spend unhurried time with the people you dote on, and let romance be cosy.',
      'This is the month for home. Spend time with family or the people who feel like family, and make one room a better place to be.',
      'Words carry more feeling now. Check in with a sibling or a neighbour, and say the kind thing instead of assuming it is known.',
      'Care turns to what you keep. Make your space and your routines feel safe, and hold on to what has real meaning for you.',
    ],
    guidePrompt: 'What does Cancer season ask of my sign this year?',
  },
  leo: {
    theme: 'The Sun is at home in Leo: a month for warmth, creative work and letting yourself be seen.',
    about: [
      'Leo season is a fixed fire sign ruled by the Sun itself, which is why astrologers call it the Sun’s own sign. It runs from late July to late August.',
      'It is a month for generosity and play. Make something, celebrate someone, and take the stage when it is offered.',
      'The risk is pride. Share the spotlight and it stays warm for everyone.',
    ],
    asks: [
      'It is your season. Be seen, celebrate yourself without apology, and start your year with something that shows who you are.',
      'Your own season is next, so step out of the spotlight for a while. Rest, and get ready quietly for your turn.',
      'Friends rally around you, and you around them. Throw the party, cheer on the group, and share your plans for the year.',
      'Your work is in the spotlight. Lead the project, take the credit you earned, and step up when someone asks who will.',
      'Big adventures call. Travel somewhere vivid, teach what you know, and follow an idea that makes you feel bigger.',
      'Generosity tests trust. Share with an open hand where it is safe to, and be honest about what you want in return.',
      'Partners want to be celebrated, and so do you. Make a fuss of the people you love, and let them make one of you.',
      'Pride in good work is the theme. Do the daily tasks with some flair, and let colleagues see you shine at the ordinary things.',
      'This is your playground month. Create, flirt, perform, and say yes to anything that makes you laugh.',
      'Home becomes a place for warmth. Host a gathering, celebrate someone in the family, and make the place feel bright.',
      'You speak with more confidence this month. Tell the story, give the toast, and send the message that makes someone’s day.',
      'Warmth meets your sense of your own worth. Back yourself, value your work out loud, and give your time to what brings you joy.',
    ],
    guidePrompt: 'What does Leo season ask of my sign this year?',
  },
  virgo: {
    theme: 'The Sun moves into Virgo: a month for sorting, skill and getting useful things done.',
    about: [
      'Virgo season is a mutable earth sign ruled by Mercury. It runs from late August to the September equinox.',
      'It is a month for craft and order. Routines get rebuilt, details get checked, and small improvements add up to a better autumn.',
      'The risk is fussing over everything. Decide which details matter and let the rest be good enough.',
    ],
    asks: [
      'It is your season. Tidy up the year ahead: decide what matters, drop what does not, and get very good at one thing.',
      'Your own season is next. Clear the backlog quietly, rest your mind, and let go of the need to get everything right.',
      'Friends can use your help, and groups your sense of order. Offer the skill you have, and help a group plan get done.',
      'Your work is noticed for its quality. Polish what you deliver, fix the process that wastes everyone’s time, and let your competence speak.',
      'Study rewards you. Take the course, plan the journey in detail, and read up on something you have always believed without checking.',
      'Shared matters want careful attention. Go through what you owe and are owed, in favours and on paper, and settle what you can.',
      'Partners appreciate practical help. Do the useful thing without being asked, and talk through how you share the load.',
      'This is the month for routines. Plan your weeks, streamline the work, and build a daily rhythm you can keep.',
      'Fun gets a craft. Practise a hobby until you are good at it, and show affection through small useful favours.',
      'Home wants sorting. Clear the cupboard, fix what is broken, and set the household up to run with less effort.',
      'Details matter in every message. Read it twice, follow up, and learn a new skill in small daily steps.',
      'Practical sense lands on what you own and value. Sort, repair and organise, and keep what is genuinely useful.',
    ],
    guidePrompt: 'What does Virgo season ask of my sign this year?',
  },
  libra: {
    theme: 'The Sun enters Libra at the September equinox: a month for balance, fairness and the people you pair up with.',
    about: [
      'Libra season begins at the September equinox, when day and night are close to equal everywhere on Earth. It is a cardinal air sign ruled by Venus.',
      'It is a month for relationships and fairness. Partnerships, agreements and shared decisions come forward, and beauty matters more than usual.',
      'The risk is putting off decisions to keep everyone happy. Choose, and choose kindly.',
    ],
    asks: [
      'It is your season. Rebalance your life for the year ahead, and put time into the relationships that make you more yourself.',
      'Your own season is next, so rest from other people’s needs for a while, and find your own balance in private.',
      'Friendships want evening out. Reach out to the friend who always reaches out to you, and help a group come to a fair decision.',
      'Your work runs on relationships now. Collaborate, make the introduction, and be the person who keeps the peace in the room.',
      'Other points of view are the adventure. Travel with someone, study with a partner, and argue in good faith about something that matters.',
      'Fairness in what you share is the question. Raise an imbalance calmly, and agree on terms both of you can keep.',
      'This is the partnership month. Commit, negotiate, or talk honestly about what each of you needs, face to face.',
      'Your days want balance. Even out the workload, share tasks fairly, and stop saying yes to everything.',
      'Romance and art both flourish. Go on dates, go to galleries, and make something simply because it is beautiful.',
      'Home wants harmony. Settle a household disagreement fairly, and make one corner of the place calm and lovely.',
      'Diplomacy comes easily. Smooth over a misunderstanding, and hear both sides before you say your piece.',
      'Balance turns to what you value. Weigh what you give against what you get, and make your surroundings a little more beautiful.',
    ],
    guidePrompt: 'What does Libra season ask of my sign this year?',
  },
  scorpio: {
    theme: 'The Sun goes deep in Scorpio: a month for honesty, trust and letting go of what is finished.',
    about: [
      'Scorpio season is a fixed water sign, ruled by Pluto in modern astrology and by Mars in the older tradition. It runs from late October to late November.',
      'It is a month for depth. Conversations get real, loyalty is tested, and things that have run their course can end without a fuss.',
      'The risk is secrecy for its own sake. Trust the people who have earned it.',
    ],
    asks: [
      'It is your season. Decide what you will commit to fully this year, and let go of what you only half want.',
      'Your own season is next. Spend time alone, let something end gracefully, and come out of the month lighter.',
      'Friendships are tested and come out stronger. Keep the friends you trust close, and let a group that no longer fits fade.',
      'Your work benefits from quiet strategy. Plan the move, keep your cards close, and show results rather than intentions.',
      'You want answers, not small talk. Study what fascinates you, travel somewhere with history, and question a belief you inherited.',
      'A strong month for trust. Share what you have been holding back with someone who has earned it, and settle what is unfinished between you.',
      'Partners ask for loyalty and honesty. Say what you feel, and let a relationship go deeper or change shape.',
      'Your work goes deep. Take one task at a time, get to the root of the problem, and drop the routines that drain you.',
      'Passion runs high. Let romance get serious, and throw yourself into a creative project that means something to you.',
      'Old family matters may surface. Deal with them honestly and privately, and clear out the room that holds the past.',
      'Conversations get searching. Ask the question you have been avoiding, and listen for what is not being said.',
      'Intensity lands on what you value. Hold on to what is truly yours, and let go of what you keep only out of habit.',
    ],
    guidePrompt: 'What does Scorpio season ask of my sign this year?',
  },
  sagittarius: {
    theme: 'The Sun reaches Sagittarius: a month for horizons, honest talk and the big picture before the year turns.',
    about: [
      'Sagittarius season starts when the Sun reaches 0 degrees Sagittarius in late November, and it runs to the December solstice, when the Sun moves on into Capricorn. It is a mutable fire sign ruled by Jupiter, and the last stretch of the calendar year sits inside it.',
      'It is a month for widening your view. Travel, study, belief and humour come forward, and so does saying plainly what you think. After the intensity of Scorpio season it usually feels lighter, and a little restless.',
      'Sagittarius is pictured as an archer, and the season works the same way: choose a target that is far off, then aim. The risk is promising more than fits in the weeks before the holidays, so pick the one adventure that matters and leave room for the rest.',
    ],
    asks: [
      'It is your season, and your year starts here. Say yes to the trip, the class or the big question you have been carrying, and be honest about what you want next.',
      'Your own season is next, so this is the quiet month before it. Rest, look back over the year, and let go of one belief that no longer fits you.',
      'Friends widen your world. Meet people from other places, join a group that shares your interests, and say your hopes for next year out loud.',
      'Your work wants a bigger vision. Share the long plan, aim higher than last year, and let your enthusiasm show to the people who decide.',
      'This is your month for the horizon. Travel, study, publish, or read about the place you want to see, and follow the idea that excites you most.',
      'Big questions about trust and what you share come up. Talk about them openly and with good humour, and agree on what each of you can promise.',
      'Partners bring the adventure. Plan a trip together, listen to how they see the world, and say plainly where you stand.',
      'Your routines want more room to move. Take the walk outside, learn something on your lunch break, and keep your to do list honest about what fits in a day.',
      'Fun gets adventurous. Go somewhere new on a date, laugh more than you planned to, and start a creative project with no clear end in sight.',
      'Home opens its doors. Welcome guests, talk about family history over a long meal, and make room for someone visiting from far away.',
      'You say what you think this month, and people listen. Keep it kind as well as honest, and take the short trip that turns into a story.',
      'Optimism lands on what you value. Give your time to what you believe in, be generous where it counts, and keep a sense of humour about what you cannot control.',
    ],
    guidePrompt: 'What does Sagittarius season ask of my sign this year?',
  },
  capricorn: {
    theme: 'The Sun enters Capricorn at the December solstice: a month for structure, long goals and work that lasts.',
    about: [
      'Capricorn season begins at the December solstice and carries the calendar into the new year. It is a cardinal earth sign ruled by Saturn.',
      'It is a month for plans you mean to keep. Goals get set, responsibilities get sorted, and patience pays off in ways you can see.',
      'The risk is all work and no warmth. Make time for the people the work is for.',
    ],
    asks: [
      'It is your season. Set the goals for your year, plan the steps, and take your ambitions seriously without apologising for them.',
      'Your own season is next. Rest from your responsibilities, review the past year honestly, and lighten your load.',
      'Friendships and groups ask for long term thinking. Make time for the people who stay, and give a group plan some structure.',
      'This is the month for your work. Take on responsibility, aim for the long goal, and let your effort be seen by the people who matter.',
      'Learning turns serious. Commit to a course, plan a journey with care, and build your expertise one step at a time.',
      'Shared responsibilities need sorting. Look at what you carry for others and what they carry for you, and make the arrangement fair and clear.',
      'Partners want commitment and clear terms. Talk about the future together, and be someone they can rely on.',
      'Routines become the foundation. Set a schedule you can keep, and build habits for the long run rather than quick wins.',
      'Play gets purposeful. Practise the creative skill you want to master, and let romance be steady rather than dramatic.',
      'Home wants structure. Fix what needs fixing, make the long term decision about where you live, and keep the family traditions you value.',
      'Words carry weight this month. Say less, mean it, and keep your commitments to the people around you.',
      'Structure lands on what you own and value. Make a plan for the things that matter to you, and put your effort into what lasts.',
    ],
    guidePrompt: 'What does Capricorn season ask of my sign this year?',
  },
  aquarius: {
    theme: 'The Sun moves into Aquarius: a month for friends, fresh ideas and doing things your own way.',
    about: [
      'Aquarius season is a fixed air sign, ruled by Uranus in modern astrology and by Saturn in the older tradition. It runs from late January to mid February.',
      'It is a month for community and independence at once. Groups, friendships and causes come forward, along with ideas that break from habit.',
      'The risk is keeping people at arm’s length. Let your friends in.',
    ],
    asks: [
      'It is your season. Do things your own way, try a new idea on for size, and spend the year with people who let you be yourself.',
      'Your own season is next. Step back from the crowd, rest, and dream quietly about what comes next.',
      'This is the month for friends and community. Gather your people, join a cause, and share your hopes for the future.',
      'Your work benefits from fresh thinking. Propose the new idea, work as a team, and take the path that feels most like yours.',
      'Ideas travel far this month. Study something new, connect with people far away, and let your views update.',
      'What you share with others wants a fresh look. Rethink an arrangement that no longer works, and be honest about your need for independence.',
      'Partners need freedom as well as closeness. Give each other space, and talk about the future you want together.',
      'Your daily routine is ready for an update. Try a new tool or a new way of working, and make your days fit you rather than the other way round.',
      'Fun gets unusual. Try a hobby you would never have picked, flirt with someone unexpected, and make something experimental.',
      'Home wants a change of layout or of routine. Try a new arrangement, and give everyone at home more room to be themselves.',
      'Your messages carry original ideas. Share them, join a conversation in your neighbourhood or online, and learn something new.',
      'Fresh ideas land on what you value. Rethink how you use your time, and keep what fits the person you are becoming.',
    ],
    guidePrompt: 'What does Aquarius season ask of my sign this year?',
  },
  pisces: {
    theme: 'The Sun ends its circuit in Pisces: a month for imagination, rest and letting the old year go.',
    about: [
      'Pisces season is the last of the twelve, a mutable water sign ruled by Neptune in modern astrology and by Jupiter in the older tradition. It runs from mid February to the March equinox, when Aries season starts the zodiac again.',
      'It is a month for softness and imagination. Art, music, compassion and rest come forward, and endings come more easily than usual.',
      'The risk is drifting. Give your daydreams one practical step.',
    ],
    asks: [
      'It is your season. Follow your imagination, be gentle with yourself, and start your year with something creative.',
      'Your own season is next, and the zodiac’s year is ending. Rest, let the year’s leftovers go, and get ready for a fresh start.',
      'Friends offer comfort. Spend time with the people who understand you, and help a group with a quiet kindness.',
      'Your work benefits from imagination. Bring a creative idea to the table, and let compassion guide how you lead.',
      'Your mind wanders far. Read poetry, explore an idea that moves you, or travel somewhere near water.',
      'Feelings run deep in what you share. Trust your instinct about who to open up to, and let go of an old hurt.',
      'Partners need understanding. Listen with patience, forgive a small slight, and share your dreams with each other.',
      'Your routines want softness. Add rest to your days, and help someone at work without keeping score.',
      'Romance and art turn dreamy. Create without judging, enjoy the music and the films, and let a crush stay a little mysterious.',
      'Home becomes a refuge. Make it peaceful, spend quiet time with family, and let old memories surface gently.',
      'Words come with feeling. Write, draw or talk about what moves you, and be kind in your messages.',
      'Compassion lands on what you value. Give where it means something, and hold on to the things that inspire you.',
    ],
    guidePrompt: 'What does Pisces season ask of my sign this year?',
  },
};
