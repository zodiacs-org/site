import type { Aspect, BodyPosition } from '../../lib/engine/types';
import { signForLongitude } from '../../lib/signs';

const RETURN_ROLE: Record<string, string> = {
  Sun: 'your sense of direction',
  Mercury: 'your thinking and decisions',
  Venus: 'your values and relationships',
  Mars: 'your effort and initiative',
  Jupiter: 'growth and opportunity',
  Saturn: 'your standards and commitments',
  Uranus: 'freedom and change',
  Neptune: 'your imagination and ideals',
  Pluto: 'power and renewal',
};

const JUPITER_FOCUS: Record<string, string> = {
  aries: 'decisive experiments and the courage to begin',
  taurus: 'patient building and resources that last',
  gemini: 'learning, exchange, and better questions',
  cancer: 'care, belonging, and stronger foundations',
  leo: 'creative visibility and wholehearted expression',
  virgo: 'useful skills, healthier systems, and steady practice',
  libra: 'collaboration, negotiation, and fairer agreements',
  scorpio: 'honest renewal and the wise use of shared resources',
  sagittarius: 'study, travel, and beliefs tested in experience',
  capricorn: 'disciplined ambition and work that compounds',
  aquarius: 'alliances, original ideas, and a more useful future',
  pisces: 'imagination, compassion, and restorative space',
};

export interface PlanetsOnlyReturnReading {
  text: string;
  receipt: string;
}

export function planetsOnlyReturnReading(
  bodies: ReadonlyArray<Pick<BodyPosition, 'body' | 'lon'>>,
  aspects: ReadonlyArray<Pick<Aspect, 'a' | 'b' | 'type' | 'orb'>>,
): PlanetsOnlyReturnReading {
  const strongest = [...aspects]
    .filter((aspect) => ![aspect.a, aspect.b].some((body) => body === 'Moon' || body.includes('Node')))
    .sort((left, right) => left.orb - right.orb)[0];

  if (strongest) {
    const left = RETURN_ROLE[strongest.a] ?? strongest.a.toLowerCase();
    const right = RETURN_ROLE[strongest.b] ?? strongest.b.toLowerCase();
    const supportive = strongest.type === 'trine' || strongest.type === 'sextile';
    const concentrated = strongest.type === 'conjunction';
    const text = supportive
      ? `This year opens a useful channel between ${left} and ${right}. What comes easily still needs to be noticed and used.`
      : concentrated
        ? `This year concentrates ${left} and ${right} into one agenda. Give that combination a deliberate outlet instead of letting it run on instinct.`
        : `This year asks you to negotiate between ${left} and ${right}. Progress comes from giving both pressures a job instead of declaring one the winner.`;
    return {
      text,
      receipt: `${strongest.a} ${strongest.type} ${strongest.b} · ${strongest.orb.toFixed(1)}° orb`,
    };
  }

  const jupiter = bodies.find((body) => body.body === 'Jupiter');
  if (jupiter) {
    const sign = signForLongitude(jupiter.lon);
    return {
      text: `Growth this year favors ${JUPITER_FOCUS[sign.slug]}. Choose the opportunity that makes this quality more usable in ordinary life.`,
      receipt: `Jupiter in ${sign.name}`,
    };
  }

  return {
    text: 'Use this planets-only return as a broad annual reset: choose one priority to renew, give it a repeatable practice, and watch what gathers momentum after your birthday.',
    receipt: 'Planets-only solar return · houses and angles unavailable',
  };
}

export const SR_COPY = {
  noon: 'Computed from the sky at 12:00 UTC on your birth date — the return instant can shift by up to about a day with your exact birth time, and houses need it.',
  noPlace: 'This saved chart has no stored birthplace, so the return is shown planets-only.',
  asc: {
    aries: "The year leads with ignition — you'll be handed situations that reward starting before you feel ready. Momentum is this year's currency.",
    taurus: 'The year leads with consolidation — building, furnishing, and letting good things get boring in the best way. Slow is the strategy, not the setback.',
    gemini: "The year leads with traffic — conversations, short trips, twice the usual inbox. Your calendar becomes the chart's main character.",
    cancer: 'The year leads with home in the load-bearing sense: where you live, who counts as family, what safety costs. Tend the base and the rest follows.',
    leo: 'The year leads with visibility — you get seen more, on purpose and not. Decide early what you want the audience to find.',
    virgo: "The year leads with maintenance — health, systems, the backlog you've been stepping over. Unglamorous fixes pay this year's best dividends.",
    libra: 'The year leads with other people — partnerships tighten, negotiations multiply, and "we" outvotes "I" more than usual. Choose counterparts carefully.',
    scorpio: 'The year leads with depth — shared resources, real intimacy, and at least one honest reckoning. What survives this year was built to.',
    sagittarius: 'The year leads with range — travel, study, or a belief that needs field-testing. The far option is usually the right one this year.',
    capricorn: "The year leads with the ledger — career, reputation, and the long game asking for its installment. Effort placed now compounds unusually well.",
    aquarius: "The year leads with the network — allies, groups, and the future you're actually building versus the one you inherited. Find your people; the plan follows.",
    pisces: 'The year leads with the tide — rest, imagination, and endings that make room. Not every year is for output; this one profits from margin.',
  },
  sunHouse: {
    1: "The Sun returns in the return-chart's first house: a self-definition year. How you show up gets renovated, visibly.",
    2: "A resources year — money, skills, and what your work is actually worth in practical terms. Value gets counted, then corrected upward or down.",
    3: 'A local year — words, siblings, neighborhoods, the daily loop. Small communications carry outsized freight.',
    4: 'A foundations year — housing, family, the private floor under the public life. Expect the center of gravity to move homeward.',
    5: 'An expression year — romance, play, children, work signed with your own name. What you make for joy matters more than usual.',
    6: "A working year — routines, health, the craft of the everyday. The body keeps this year's minutes; read them.",
    7: 'A partnership year — one relationship, personal or professional, becomes the plot. Contracts in every sense.',
    8: 'A depths year — shared money, inheritance in the broad sense, intimacy with stakes. Some doors close so others can pressurize.',
    9: "A horizon year — study, travel, publishing, belief under revision. Distance clarifies what proximity couldn't.",
    10: 'A summit year — career, standing, the public ledger. Work done in previous years gets graded now.',
    11: 'An alliance year — groups, friendships, the long-term project that needs more hands than yours. The future arrives by committee.',
    12: 'A closing year — rest, retreat, the compost cycle before the next twelve. Endings here are preparation wearing a disguise.',
  } as Record<number, string>,
} as const;
