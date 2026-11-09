/**
 * What each core number reads as in each of the four name and date positions
 * get_numerology returns: Life Path, Expression, Soul Urge and Personality.
 *
 * Written for Zodiacs, in the register of numerology-meanings.ts: what the
 * tradition associates with a number in that position, as a prompt for
 * the tradition's reading. Numerology is a separate tradition from astrology.
 * Work, money and wellbeing appear where the tradition reads them; there are no
 * price or investment calls, diagnoses, death predictions or legal verdicts,
 * and no dashes (src/ai-tools/features/numerology.test.ts).
 */
import type { CoreNumber } from './numerology-meanings';

export type ReadingPosition = 'lifePath' | 'expression' | 'soulUrge' | 'personality';

export const POSITION_READINGS: Readonly<Record<ReadingPosition, Readonly<Record<CoreNumber, string>>>> = Object.freeze({
  lifePath: Object.freeze({
    1: 'As a Life Path, 1 reads as a road walked on your own terms: starting things, deciding without a committee, and often running your own work. The lesson is knowing when going first helps and when it only leaves you on your own.',
    2: 'As a Life Path, 2 reads as a road of partnership. The work is in cooperation, timing and tact, and the lesson that keeps returning is that keeping the peace should never cost you your own voice.',
    3: 'As a Life Path, 3 reads as a road of expression: finding the words, the craft or the stage that suits you, and learning to carry an idea past its bright first draft.',
    4: 'As a Life Path, 4 reads as a road of building: steady work, sound systems and promises kept. The recurring lesson is flexibility, letting a good plan change when the ground under it does.',
    5: 'As a Life Path, 5 reads as a road of movement and variety. Change teaches you more than routine does, and the lesson is choosing your commitments freely rather than escaping them.',
    6: 'As a Life Path, 6 reads as a road of responsibility: home, community and the people who rely on you. The lesson that keeps returning is care without control, and taking your own rest and wellbeing as seriously as everyone else\'s.',
    7: 'As a Life Path, 7 reads as a road of study and questions. You trust what you have examined for yourself, and the lesson is letting that understanding take in people as well as ideas.',
    8: 'As a Life Path, 8 reads as a road of authority and results: organising, leading, and a strong head for money and business. The tradition counts it among the best numbers for earning and building, and the recurring lesson is judging a life by more than what it earned.',
    9: 'As a Life Path, 9 reads as a road toward the wide view: generosity, causes and finishing things well. The lesson is letting go gracefully, and giving to the people nearest you as well as to the many.',
    11: 'As a Life Path, 11 reads as a road of insight. You pick up what others miss and are drawn to inspire them; the tradition says the work is grounding that sensitivity in plain, everyday steps. On ordinary days it lives as a 2.',
    22: 'As a Life Path, 22 reads as a road of large, practical vision: turning a big idea into something that lasts and that other people can use. The tradition says it asks for patience with scale. On ordinary days it lives as a 4.',
    33: 'As a Life Path, 33 reads as a road of teaching and service, guiding and looking after others with a steady hand. The tradition says the work is keeping that care sustainable. On ordinary days it lives as a 6.',
  }),
  expression: Object.freeze({
    1: 'As an Expression number, 1 points to a gift for initiative. You tend to work best when you can set the direction, and careers where you lead or work for yourself suit it well.',
    2: 'As an Expression number, 2 points to a gift for collaboration: mediating, refining an idea someone else started, and noticing the detail that makes a joint effort hold together.',
    3: 'As an Expression number, 3 points to a gift for communication: writing, speaking, performing or teaching, anything that turns an idea into something people enjoy hearing.',
    4: 'As an Expression number, 4 points to a gift for method: organising, building and finishing. You tend to be the one who turns a rough plan into a schedule that works, and the tradition reads it as a steady earner in any trade.',
    5: 'As an Expression number, 5 points to a gift for adaptability: learning quickly, persuading, and handling the unexpected well. Variety in the work tends to bring out your best.',
    6: 'As an Expression number, 6 points to a gift for care and fairness: teaching, hosting, advising, and making a place feel looked after.',
    7: 'As an Expression number, 7 points to a gift for analysis: research, close reading, and solving the problem other people stopped looking at.',
    8: 'As an Expression number, 8 points to a gift for organisation at scale: running people, projects and budgets, and seeing a plan through to its end. The tradition ties it to business, management and handling money well.',
    9: 'As an Expression number, 9 points to a gift for the broad view: understanding many kinds of people, and work that serves a purpose larger than yourself.',
    11: "As an Expression number, 11 points to a gift for inspiration: ideas that arrive whole, and a way of explaining them that moves people. It carries the 2's tact as well.",
    22: "As an Expression number, 22 points to a gift for building on a large scale, pairing a wide vision with the patience to organise the details. It carries the 4's method as well.",
    33: "As an Expression number, 33 points to a gift for guidance: teaching, mentoring, and making difficult things feel possible for others. It carries the 6's sense of care as well.",
  }),
  soulUrge: Object.freeze({
    1: 'As a Soul Urge, 1 reads as a private wish for independence: to be trusted with your own choices, and to make something that is recognisably yours.',
    2: 'As a Soul Urge, 2 reads as a private wish for closeness and calm, a partnership where you are understood without having to explain everything.',
    3: 'As a Soul Urge, 3 reads as a private wish to be heard and to create: room to play, to make things, and to share what delights you.',
    4: 'As a Soul Urge, 4 reads as a private wish for steadiness: a settled home, a routine you like, savings you can count on, and work you can trust to hold.',
    5: 'As a Soul Urge, 5 reads as a private wish for freedom: new experiences, room to move, and a life that does not repeat itself.',
    6: 'As a Soul Urge, 6 reads as a private wish to be needed and to make a warm place for other people. Harmony at home matters a great deal.',
    7: 'As a Soul Urge, 7 reads as a private wish for understanding: quiet, time to think, and answers that hold up when you look at them closely.',
    8: 'As a Soul Urge, 8 reads as a private wish for capability and respect: to steer your own course, and to see effort turn into results.',
    9: 'As a Soul Urge, 9 reads as a private wish to make a difference: to help, to give, and to leave things better than you found them.',
    11: 'As a Soul Urge, 11 reads as a private wish for meaning: to follow an inner sense of what is right, and to share it in a way that lifts other people.',
    22: 'As a Soul Urge, 22 reads as a private wish to build something that outlasts you, a lasting structure that many people can use.',
    33: 'As a Soul Urge, 33 reads as a private wish to teach and to care, and to watch the people you guide grow past what they thought they could do.',
  }),
  personality: Object.freeze({
    1: 'As a Personality number, 1 suggests people first see someone self-assured and direct, who looks ready to take the lead.',
    2: 'As a Personality number, 2 suggests people first see someone gentle and approachable, a good listener who puts others at ease.',
    3: 'As a Personality number, 3 suggests people first see someone lively and friendly, quick with a story and easy to talk to.',
    4: 'As a Personality number, 4 suggests people first see someone dependable and composed, who looks as if they have things in hand.',
    5: 'As a Personality number, 5 suggests people first see someone energetic and curious, up for something new.',
    6: 'As a Personality number, 6 suggests people first see someone warm and responsible, the person others go to for advice.',
    7: 'As a Personality number, 7 suggests people first see someone reserved and thoughtful, harder to read than most.',
    8: 'As a Personality number, 8 suggests people first see someone capable and confident, with a natural air of authority.',
    9: 'As a Personality number, 9 suggests people first see someone kind and open-minded, with a generous, wide outlook.',
    11: 'As a Personality number, 11 suggests people first see someone striking and sensitive, who seems to notice more than they say.',
    22: 'As a Personality number, 22 suggests people first see someone solid and purposeful, who looks able to carry a large responsibility.',
    33: 'As a Personality number, 33 suggests people first see someone caring and wise, whom others trust readily.',
  }),
});
