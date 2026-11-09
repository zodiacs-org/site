/**
 * The goals the good day finder searches for, and the traditional electional
 * rules it reads each one by. Electional astrology is the old practice of
 * choosing a day for a beginning from the sky; these tables are its common
 * rules, kept small and stated plainly so every reason a day gets can be
 * traced to one line here.
 *
 * A day's rating is astrology's traditional reading of it, stated plainly:
 * money, career, wellbeing and legal themes are read as the tradition reads
 * them. It never makes a price or market call, gives a buy or sell signal,
 * times or diagnoses anything medical, predicts a death, or says who will win
 * or lose a legal matter. There is no procedure goal: medical timing is the
 * clinician's, and a goal that asks for it gets NO_MEDICAL_TIMING.
 */

export const GOOD_DAY_GOALS = ['launch', 'contract', 'move', 'relationship', 'travel', 'job', 'wedding'] as const;
export type GoodDayGoal = (typeof GOOD_DAY_GOALS)[number];

/** The planets whose retrograde periods and station days a goal is read against. */
export type Significator = 'Mercury' | 'Venus' | 'Mars';
/** The planets a Moon aspect to which reads as support. */
export type Helper = 'Sun' | 'Mercury' | 'Venus' | 'Jupiter';

export interface GoalRule {
  /** The picker's label. */
  label: string;
  /** The goal inside a sentence: "for signing a contract". */
  forWhat: string;
  /** The Moon phase tradition prefers for it. */
  phase: 'waxing' | 'waning';
  /** Moon signs tradition favours for it, beyond the Moon's own dignity. */
  moonGood: readonly string[];
  /** Moon signs tradition sets aside for it. */
  moonPoor: readonly string[];
  /** Retrograde planets that count against it, with how much. */
  retrograde: Readonly<Partial<Record<Significator, number>>>;
  /** Moon aspects to these planets read as support. */
  helpers: readonly Helper[];
  /** Why the favoured Moon signs suit it, as a clause after "the sign". */
  moonWhy: string;
  /** A full Moon: points for (a celebration) or against (a procedure), 0 for neither. */
  fullMoon: number;
  /** The goal's own reminder of what the reading is not. */
  care: string;
}

/** Said with every answer: how the days were read. */
export const GOOD_DAYS_NOTE = 'Days read by the traditional rules of electional astrology: the Moon, the void-of-course Moon, retrogrades, eclipses and the Moon\'s aspects that day.';
/** The answer to a goal that asks for medical timing, which Zodiacs does not give. */
export const NO_MEDICAL_TIMING = 'Zodiacs gives no timing for surgery, medical procedures or treatment: that date is for you and your clinician. It finds good days to launch, sign a contract, move, start a relationship, travel, start a job or marry.';
/**
 * Goals an assistant may send for medical timing, compared lower-cased without accents, spaces or punctuation.
 * They get NO_MEDICAL_TIMING rather than the list of goals, so the request is not carried over to another goal.
 */
export const MEDICAL_GOAL_WORDS: readonly string[] = ['procedure', 'medical', 'medicalprocedure', 'surgery', 'operation', 'treatment', 'dental', 'dentist', 'doctor', 'hospital', 'birth', 'csection', 'ivf', 'vaccine', 'vaccination', 'cosmetic', 'cosmeticsurgery', 'therapy', 'health'];
export const isMedicalGoal = (value: unknown): boolean => typeof value === 'string'
  && MEDICAL_GOAL_WORDS.includes(value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/gu, ''));

export const GOAL_RULES: Readonly<Record<GoodDayGoal, GoalRule>> = {
  launch: {
    label: 'Launch something new',
    forWhat: 'for a launch',
    phase: 'waxing',
    moonGood: ['aries', 'taurus', 'cancer', 'leo', 'sagittarius'],
    moonPoor: ['scorpio', 'capricorn'],
    retrograde: { Mercury: -14, Mars: -8 },
    helpers: ['Sun', 'Mercury', 'Jupiter'],
    moonWhy: 'tradition reads as bold and lasting for a start',
    fullMoon: 0,
    care: 'Tradition reads a waxing Moon and a forward-moving Mercury as the strongest start for a venture, and the days around them as a good window for first sales and announcements.',
  },
  contract: {
    label: 'Sign a contract',
    forWhat: 'for signing a contract',
    phase: 'waxing',
    moonGood: ['taurus', 'leo', 'libra', 'aquarius'],
    moonPoor: ['scorpio', 'capricorn', 'pisces'],
    retrograde: { Mercury: -16 },
    helpers: ['Mercury', 'Venus', 'Jupiter'],
    moonWhy: 'tradition reads as steady for an agreement meant to hold',
    fullMoon: 0,
    care: 'Tradition reads these as good windows to sign contracts, with Mercury moving forward. The reading is about the day, not the terms: read them fully, and take legal advice where you need it.',
  },
  move: {
    label: 'Move home',
    forWhat: 'for moving home',
    phase: 'waxing',
    moonGood: ['taurus', 'cancer', 'leo', 'libra'],
    moonPoor: ['scorpio', 'capricorn', 'aries', 'sagittarius'],
    retrograde: { Mercury: -10 },
    helpers: ['Venus', 'Jupiter'],
    moonWhy: 'tradition reads as settled, a sign for staying put',
    fullMoon: 0,
    care: 'Tradition reads a settled Moon as a home that holds. Practical things, such as the keys, the van and the people helping, still come first.',
  },
  relationship: {
    label: 'Start a relationship',
    forWhat: 'for starting a relationship',
    phase: 'waxing',
    moonGood: ['taurus', 'cancer', 'leo', 'libra', 'pisces'],
    moonPoor: ['scorpio', 'capricorn', 'aries'],
    retrograde: { Venus: -16, Mercury: -5 },
    helpers: ['Venus', 'Jupiter', 'Sun'],
    moonWhy: 'tradition reads as warm and easy for two people',
    fullMoon: 2,
    care: 'Tradition reads Venus moving forward and a warm Moon as an easy start for two people; how they get on is theirs to find out.',
  },
  travel: {
    label: 'Travel',
    forWhat: 'for setting out on a journey',
    phase: 'waxing',
    moonGood: ['aries', 'gemini', 'cancer', 'libra', 'sagittarius'],
    moonPoor: ['scorpio', 'capricorn', 'taurus'],
    retrograde: { Mercury: -14 },
    helpers: ['Mercury', 'Jupiter', 'Venus'],
    moonWhy: 'tradition reads as quick and willing to move',
    fullMoon: 0,
    care: 'Tradition reads a quick Moon and a forward-moving Mercury as smooth going. Check travel advice, bookings and the weather as you would on any day.',
  },
  job: {
    label: 'Start a new job',
    forWhat: 'for starting a new job',
    phase: 'waxing',
    moonGood: ['taurus', 'virgo', 'leo', 'libra'],
    moonPoor: ['scorpio', 'capricorn', 'pisces'],
    retrograde: { Mercury: -10, Mars: -4 },
    helpers: ['Sun', 'Mercury', 'Jupiter'],
    moonWhy: 'tradition reads as steady and willing to work',
    fullMoon: 0,
    care: 'Tradition reads these as strong days to start work and build a reputation, and a good window to settle pay and terms. The start date you agree with the employer comes first.',
  },
  wedding: {
    label: 'Wedding',
    forWhat: 'for a wedding',
    phase: 'waxing',
    moonGood: ['taurus', 'cancer', 'leo', 'libra', 'pisces'],
    moonPoor: ['scorpio', 'capricorn', 'aries'],
    retrograde: { Venus: -18, Mercury: -6 },
    helpers: ['Venus', 'Jupiter', 'Sun'],
    moonWhy: 'tradition reads as tender and celebratory',
    fullMoon: 3,
    care: 'Tradition reads Venus moving forward and a waxing Moon as the classic wedding sky. The best day is still the one that works for the people you want there.',
  },
};

/** The goals whose readings concern romance or partnership: no reading from a birth date under 18. */
export const PARTNERSHIP_GOALS: ReadonlySet<GoodDayGoal> = new Set(['relationship', 'wedding']);
