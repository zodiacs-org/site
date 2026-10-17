import type { AspectType, BodyName, Chart } from './engine/types';
import { MOON } from './interpretations';
import { moonIsUncertain, moonLabel } from './moon-certainty';

export type CommunicationSign = keyof typeof MERCURY_SIGN;
export type CommunicationAspectTarget = keyof typeof MERCURY_ASPECT;

export interface CommunicationAspect {
  target: CommunicationAspectTarget;
  type: AspectType;
  orb: number;
  text: string;
}

export interface CommunicationRead {
  mercury: string;
  mercurySign: CommunicationSign | null;
  mercuryAddendum: string | null;
  aspects: CommunicationAspect[];
  moon: string;
  moonSign: CommunicationSign | null;
  mars: string;
  marsSign: CommunicationSign | null;
}

export const COMMUNICATION_COPY = {
  title: 'How you communicate',
  intro: 'Three placements do most of the talking: Mercury is how you think and phrase things, the Moon is what you need a conversation to feel like, and Mars is how you handle friction.',
} as const;

export const MERCURY_SIGN = {
  aries: 'You think out loud and fast. The first draft arrives already spoken. Your best ideas come mid-sentence; your apologies, occasionally, come right after.',
  taurus: "You think slowly and mean it permanently. Words get weighed before they're spent. People learn that when you finally say a thing, it was true last month and will be true next month.",
  gemini: 'Language is your native element: you think by talking, learn by asking, and can argue either side for sport. The skill to guard is finishing one thread before opening four.',
  cancer: 'You remember tone longer than content. How a thing was said IS what was said, in your ledger. It makes you a careful speaker and an unusually good listener, with a long memory for both.',
  leo: 'You communicate like a performance with an audience of one: warm, committed, a story where a sentence would do. It works because you mean it; flattery without conviction reads as static to you.',
  virgo: 'Precision is how you show respect: the right word, the actual number, the caveat that keeps it honest. The edit is love; not everyone reads it that way, so say the warm part out loud too.',
  libra: 'You phrase things so the other person can hear them, softening, balancing, finding the version that lands. The cost is that people sometimes get the diplomatic draft when they needed the real one.',
  scorpio: "You say less than you know, always. Conversations with you have a floor most people never see, and when you do open it, the other person understands it's a vault door, not small talk.",
  sagittarius: 'You aim for the big true thing and skip the paperwork: blunt, funny, allergic to euphemism. The occasional casualty is nuance; the reliable gift is that nobody wonders what you meant.',
  capricorn: 'You speak in conclusions: brief, structured, already three steps into the plan. Small talk feels like overhead, but your dry aside at minute forty is usually the best line in the meeting.',
  aquarius: 'You argue from orbit: principles first, particulars later, feelings filed under "data, interesting." People come to you for the take nobody else will say; warmth arrives once the idea is settled.',
  pisces: 'You communicate in impressions: metaphor, tone, the thing adjacent to the thing. It makes you a natural translator of feelings, and occasionally a mystery to people who wanted a bullet list.',
} as const;

export const MARS_SIGN = {
  aries: 'Conflict arrives fast and leaves fast. You flare, say it, and genuinely forget it by dinner. The people who love you learn the storm is weather, not climate.',
  taurus: "You don't argue so much as outlast. Provocation bounces off for months, until the line gets crossed, and then the answer is final and the door is heavy.",
  gemini: 'You argue with words, quickly and well, sometimes too well. Winning the exchange can cost the point. A pause before the clever reply is your highest-return habit.',
  cancer: "Friction goes inward first: you retreat, tend the bruise, and come back sideways. Naming the hurt directly, earlier than feels safe, shortens every conflict you'll ever have.",
  leo: "What angers you is rarely the issue; it's the disrespect wrapped around it. Restore the dignity and the argument mostly resolves itself.",
  virgo: 'Your anger comes out as critique: smaller, sharper, more frequent than a fight. The upgrade is asking for the change you want instead of auditing the failure you got.',
  libra: "You'll bend a long way to avoid the fight, then argue the principle instead of the grievance. The fair fight you keep postponing is almost always smaller than the resentment that replaces it.",
  scorpio: "You run cold, not hot. Anger becomes strategy, patience, and a perfect memory. Mercy to yourself: not every slight deserves the full institution you're capable of building around it.",
  sagittarius: "You fight honest and loud, and you're over it before the other person has finished being shocked. The bluntness heals fast for you; check that it does for them.",
  capricorn: 'Anger gets processed like everything else: privately, on a schedule, converted into distance or doubled workload. The people close to you would rather have the sentence than the silence.',
  aquarius: 'You go cool and reasonable precisely when things get hot, infuriatingly calm, genuinely fair. Just remember the other person may need their feelings acknowledged before your excellent framework.',
  pisces: 'You absorb friction until you evaporate, agreeable in the room, gone in the follow-through. A small early "no" is kinder than a vanished "yes."',
} as const;

export const MERCURY_ADDENDA = {
  retrograde: 'Mercury was retrograde when you were born. The tradition reads this as thinking that runs inward before it runs outward: you draft internally, and your second telling of an idea is always better than your first.',
  domicile: 'Mercury is in its own sign here, which the tradition reads as language operating at full strength. This placement speaks with the grain.',
  detriment: "Mercury is in its detriment here, the tradition's word for a style that works against the sign's grain. Read it as texture, not deficiency: the friction is where the originality comes from.",
  exaltation: "Mercury is exalted in Virgo, the tradition's highest rating for this placement. Precision this natural is rare; trust it.",
  fall: "Mercury is in its fall here, the tradition's way of saying the sign asks language to do what language does worst. That's exactly why this placement produces poets.",
} as const;

export const MERCURY_ASPECT = {
  Moon: {
    soft: "Head and heart share a desk. You can usually say what you feel while you're still feeling it.",
    hard: 'The thought and the feeling file separate reports; give yourself a beat to reconcile them before the important conversations.',
  },
  Mars: {
    soft: 'Your words carry natural torque: direct, energizing, built for the honest version. People know where they stand with you.',
    hard: 'The sentence leaves before the edit arrives. Your directness is an asset with a safety off; the pause is the safety.',
  },
  Saturn: {
    soft: "You speak with a builder's economy: measured, reliable, quoted back at you years later.",
    hard: 'An inner editor grades everything before you say it, which makes you precise, and sometimes slower to speak than you deserve to be. The words that survive the editor are worth the wait.',
  },
  Jupiter: {
    soft: 'You make ideas bigger and rooms more optimistic just by talking, a genuine gift for teaching and framing.',
    hard: 'The story improves in the telling. Watch the exchange rate between enthusiasm and accuracy.',
  },
  Uranus: {
    soft: 'Your mind takes the exit nobody saw: quick, lateral, allergic to the obvious. Meetings need you at minute five, not minute fifty.',
    hard: "The insight arrives as interruption. It's usually right and always early; the timing, not the thought, is the work.",
  },
  Neptune: {
    soft: "You hear what people mean under what they say, a translator's ear for subtext and mood.",
    hard: "Meaning blurs at the edges. You're easy to misquote and easy to over-read. Writing things down is your friend.",
  },
  Pluto: {
    soft: 'Your words go deeper than their size. People leave conversations with you having said more than they planned.',
    hard: "You can't do shallow. Every real conversation tilts toward the root system. Powerful; ration it in company that came for the weather.",
  },
} as const;

type AspectTone = keyof (typeof MERCURY_ASPECT)[CommunicationAspectTarget];

const SIGNS = Object.keys(MERCURY_SIGN) as CommunicationSign[];
const ASPECT_TARGETS = new Set<BodyName>(Object.keys(MERCURY_ASPECT) as CommunicationAspectTarget[]);

function signForLongitude(longitude: number): CommunicationSign {
  const normalized = ((longitude % 360) + 360) % 360;
  return SIGNS[Math.floor(normalized / 30)];
}

function mercuryAddendum(sign: CommunicationSign, retrograde: boolean): string | null {
  const lines: string[] = [];
  if (sign === 'virgo') lines.push(MERCURY_ADDENDA.exaltation);
  else if (sign === 'gemini') lines.push(MERCURY_ADDENDA.domicile);
  else if (sign === 'pisces') lines.push(MERCURY_ADDENDA.fall);
  else if (sign === 'sagittarius') lines.push(MERCURY_ADDENDA.detriment);
  if (retrograde) lines.push(MERCURY_ADDENDA.retrograde);
  return lines.length > 0 ? lines.join(' ') : null;
}

function aspectTone(type: AspectType): AspectTone {
  return type === 'square' || type === 'opposition' ? 'hard' : 'soft';
}

export function communicationRead(chart: Chart): CommunicationRead {
  const mercury = chart.bodies.find((body) => body.body === 'Mercury');
  const moon = chart.bodies.find((body) => body.body === 'Moon');
  const mars = chart.bodies.find((body) => body.body === 'Mars');
  const mercurySign = mercury ? signForLongitude(mercury.lon) : null;
  const uncertainMoon = moonIsUncertain(chart);
  const moonSign = moon && !uncertainMoon ? signForLongitude(moon.lon) : null;
  const marsSign = mars ? signForLongitude(mars.lon) : null;
  const aspects = mercury
    ? chart.aspects
      .map((aspect) => {
        const target = aspect.a === 'Mercury'
          ? aspect.b
          : aspect.b === 'Mercury' ? aspect.a : null;
        return target && !(target === 'Moon' && uncertainMoon) && ASPECT_TARGETS.has(target)
          ? { ...aspect, target: target as CommunicationAspectTarget }
          : null;
      })
      .filter((aspect): aspect is NonNullable<typeof aspect> => aspect !== null)
      .sort((a, b) => a.orb - b.orb)
      .slice(0, 3)
      .map((aspect) => ({
        target: aspect.target,
        type: aspect.type,
        orb: aspect.orb,
        text: MERCURY_ASPECT[aspect.target][aspectTone(aspect.type)],
      }))
    : [];

  return {
    mercury: mercurySign ? MERCURY_SIGN[mercurySign] : '',
    mercurySign,
    mercuryAddendum: mercurySign && mercury
      ? mercuryAddendum(mercurySign, mercury.retrograde)
      : null,
    aspects,
    moon: moonSign ? MOON[moonSign] : moon ? `${moonLabel(chart)} · A birth time is needed to settle the Moon reading.` : '',
    moonSign,
    mars: marsSign ? MARS_SIGN[marsSign] : '',
    marsSign,
  };
}
