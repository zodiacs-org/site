/**
 * Fuller readings for the event pages of the twelve months from 14 November
 * 2026 that the 2027 style-guide readings (ZOD-211) do not cover: the two
 * full moons left in 2026, the twelve new moons to 29 October 2027 and the
 * nine slow-planet alignments in that window (Linear ZOD-221, decision J).
 *
 * Each follows the reading style guide's order:
 *   hook      one sentence of advice, with no sky detail before it
 *   why       what the sky is doing and what astrologers read in it, each sky
 *             term explained in everyday words
 *   tryIt     one small, concrete action
 *   sky       what is particular to this date: the planets sharing the sign,
 *             the Moon's distance, the other dates of the same alignment
 *   who       the Sun signs astrologers would name first, and for a slow
 *             alignment how long each planet stays in its sign
 *   comeBack  one line about what is next in the real sky
 *
 * The page then reads the exact instant on five clocks (UTC, New York,
 * London, Kolkata, Sydney), computed here from the instant the page prints.
 *
 * Every date, sign, placement and distance written here is held to the sky
 * data by window-readings.test.ts. Write dates as UTC days, the way the
 * page's dateline prints them, and write a placement as "Mercury in Virgo".
 *
 * These readings reach the page through page-event.ts, not through
 * interpretationFor: the committed events publication and the AI tools keep
 * the readings they were built with.
 */
import { worldTimesSentence } from '../../world-times/world-times';
import type { EventFacts, EventInterpretation } from './types';

export interface WindowReading {
  hook: string;
  why: string;
  tryIt: string;
  sky: string;
  /** Whose Sun sign it touches first, and how long the planets stay where they are. */
  who: string;
  /** Two questions to carry, printed after the reading. */
  questions: readonly [string, string];
  comeBack: string;
  /** The event the last line points to. */
  next: string;
}

/** The day these readings were written; the sitemap dates their pages from it. */
export const WINDOW_READINGS_UPDATED = '2026-11-14';

export const WINDOW_READINGS: Readonly<Record<string, WindowReading>> = {
  'full-moon-2026-11-24': {
    hook: 'Ask the question you have been answering for yourself.',
    why: 'On November 24 the Moon is full: it sits opposite the Sun, so its whole face is lit. Astrologers read a full moon as the point where something that has been building comes into view. This one is in Gemini, the sign they link with talk, questions and quick learning. The Sun is across the sky in Sagittarius, the sign of big answers, so they read this night as a question set beside a belief.',
    tryIt: 'Ask one person a real question today, and let them finish the answer.',
    sky: 'This is the Beaver Moon, the traditional name for November’s full moon, and it is a close one. At the exact moment the Moon is 360,764 km from Earth, about a day before it reaches its nearest point of the month at 359,345 km. By the rule this site uses, that makes it a supermoon, the first of four in a row. Uranus in Gemini is beside the Moon tonight, and astrologers link Uranus with surprise.',
    who: 'Astrologers would say people with the Sun in Gemini or Sagittarius notice this full moon first, since it falls across their two signs. Libra and Aquarius, the other signs of Gemini’s element, air, come next.',
    questions: ['Which question have you stopped asking because you think you know the answer?', 'Who would tell you something useful if you asked them directly?'],
    comeBack: 'On November 29 Uranus and Pluto line up for the second time in 2026. Come back for it.',
    next: 'uranus-trine-pluto-2026-11-29',
  },
  'uranus-trine-pluto-2026-11-29': {
    hook: 'Update one thing you have done the same way for years.',
    why: 'On November 29 Uranus and Pluto form a trine, which is what astrologers call two planets a third of the circle apart. They link Uranus with sudden change and Pluto with slow, deep change, and they read a trine as the two working together easily. Uranus is in Gemini, the sign of ideas and talk, and Pluto is in Aquarius, the sign of groups and the future.',
    tryIt: 'Pick one tool, route or routine you never question. Try a different one for a week.',
    sky: 'Both planets move slowly, so this alignment repeats. It was exact on July 18, is exact again today, and returns on June 15, 2027, then twice more in 2028. Uranus seems to be moving backward now, which is how it comes round to meet Pluto again. Pluto is moving forward. At the exact moment the Sun is in Sagittarius and the Moon is in Leo.',
    who: 'Uranus stays in Gemini until 2032 and Pluto stays in Aquarius until 2043, so astrologers treat this easy link as the background of these years and not as a one-day event. They would say it speaks most directly to people with the Sun in Gemini, Aquarius or Libra, the three air signs. Where it lands for you depends on where the start of Gemini and the start of Aquarius fall in your own chart.',
    questions: ['Which routine do you keep only because it is familiar?', 'What would you change first if it were easy?'],
    comeBack: 'On December 9 the Moon goes dark and a new cycle begins, a new moon in Sagittarius. Come back for it.',
    next: 'new-moon-2026-12-09',
  },
  'new-moon-2026-12-09': {
    hook: 'Choose one thing you want to learn, and book the first lesson.',
    why: 'On December 9 the Moon passes between Earth and the Sun and cannot be seen, which is a new moon. Astrologers read it as the quiet start of a month-long cycle, a good time to begin small. This one is in Sagittarius, the sign they link with travel, study and big ideas.',
    tryIt: 'Sign up for one class, borrow one book or plan one short trip.',
    sky: 'Mercury in Sagittarius is with the Sun and Moon, and astrologers link Mercury with talking and planning, so they would add: say the plan out loud. The Moon is far from Earth at this new moon, 404,688 km away, about two days before its farthest point of the month. It is the last new moon of 2026.',
    who: 'Astrologers would say a new moon speaks first to people born under its sign, here Sagittarius. Aries and Leo, the other two fire signs, are next in line.',
    questions: ['What have you wanted to learn for more than a year?', 'What is the smallest first step that would count?'],
    comeBack: 'On December 24 the Moon is full in Cancer, and it is the closest full moon of 2026. Come back for it.',
    next: 'full-moon-2026-12-24',
  },
  'full-moon-2026-12-24': {
    hook: 'Tell the people at home what you need from them this week.',
    why: 'On December 24 the Moon is full, lit from edge to edge because it stands opposite the Sun. Astrologers read a full moon as a peak, the night a feeling is hardest to ignore. This one is in Cancer, the sign they link with home, family and care. The Sun is opposite in Capricorn, the sign of duty, so they read it as home set beside work.',
    tryIt: 'Ask for one thing plainly today. Offer one thing back.',
    sky: 'This is the Cold Moon, the traditional name for December’s full moon. The Moon is 356,739 km away at the exact moment and reaches its nearest point of the month, 356,650 km, about seven hours later. By the rule this site uses, that makes it a supermoon, the second of four in a row and the closest of them. The first was on November 24.',
    who: 'Astrologers would say people with the Sun in Cancer or Capricorn feel this full moon most, because it lies across their two signs. Scorpio and Pisces share Cancer’s element, water, and come next.',
    questions: ['What do you need at home that you have not asked for?', 'What could you offer the people you live with or lean on?'],
    comeBack: 'On January 7 the Moon goes dark again, a new moon in Capricorn and the first of 2027. Come back for it.',
    next: 'new-moon-2027-01-07',
  },
  'new-moon-2027-01-07': {
    hook: 'Set one goal for the year small enough to start this week.',
    why: 'On January 7 the Moon passes between Earth and the Sun, and its lit side faces away from us. That is a new moon, and astrologers read it as a starting line. This one is in Capricorn, the sign they link with work, duty and long plans.',
    tryIt: 'Write the goal down, then write the first step and a date for it.',
    sky: 'It is the first new moon of 2027. Mercury in Capricorn is close by, and astrologers link Mercury with talking and planning, so they read this as a good night for a written plan. The Moon is also about as far from Earth as it gets: 406,525 km at the exact moment, about twelve hours after its farthest point of the month.',
    who: 'For people with the Sun in Capricorn, astrologers read this as the new moon of their own year. Taurus and Virgo, the other earth signs, share in it.',
    questions: ['What would you like to have finished by this time next year?', 'What is the first step, and when will you take it?'],
    comeBack: 'On January 10 Mars, the planet astrologers link with drive, starts to look as if it is moving backward. Come back before it does.',
    next: 'mars-retrograde-2027-01-10',
  },
  'uranus-sextile-neptune-2027-01-15': {
    hook: 'Give one daydream a small practical test this week.',
    why: 'On January 15 Uranus and Neptune form a sextile, which is what astrologers call two planets a sixth of the circle apart. They link Uranus with invention and Neptune with dreams, and they read a sextile as a mild, helpful link that rewards effort. Uranus is in Gemini, the sign of ideas, and Neptune is in Aries, the sign of beginnings.',
    tryIt: 'Take one idea you only ever imagine. Spend twenty minutes making a rough first version.',
    sky: 'The two were also exact on July 15, 2026, and they meet once more on June 6. Uranus seems to be moving backward this month, while Neptune is moving forward. Mars in Virgo also seems to be moving backward, since January 10, which astrologers read as a reason to test an idea before betting on it. The Sun is in Capricorn and the Moon is in Aries when the two line up.',
    who: 'Uranus stays in Gemini until 2032 and Neptune stays in Aries until 2038, but Uranus moves faster, so the exact meetings between them fall within a single year. Astrologers would say people with the Sun in Gemini or Aries are the first to notice. Slow alignments like this describe a period more than a day, so there is no need to act on the exact date.',
    questions: ['Which idea do you return to when your mind wanders?', 'What would a rough first version of it look like?'],
    comeBack: 'On January 22 the Moon is full in Leo. Come back for it.',
    next: 'full-moon-2027-01-22',
  },
  'new-moon-2027-02-06': {
    hook: 'Tell a friend about the plan you have kept to yourself.',
    why: 'On February 6 the Moon passes between Earth and the Sun, a new moon. Astrologers read a new moon as the start of a cycle. This one is in Aquarius, the sign they link with friends, groups and the future. This time the Moon lines up so exactly that it crosses the Sun’s face, a solar eclipse, and they read an eclipse as a new moon with more weight.',
    tryIt: 'Share one plan with one person who would tell you the truth about it.',
    sky: 'The Moon is 402,711 km away, about three days past its farthest point of the month, so it looks a little too small to cover the Sun. That is why this eclipse is annular: where it is central, a ring of sunlight stays around the Moon. Pluto in Aquarius shares the sign with the Sun and Moon.',
    who: 'Astrologers would say people with the Sun in Aquarius are the ones this new moon and eclipse speak to first. Gemini and Libra, the other air signs, follow.',
    questions: ['Which plan would get better if one more person knew about it?', 'Whose honest opinion do you trust?'],
    comeBack: 'The eclipse has a page of its own. On February 9 Mercury starts to look as if it is moving backward. Come back before it does.',
    next: 'mercury-retrograde-2027-02-09',
  },
  'new-moon-2027-03-08': {
    hook: 'Leave one evening this week with nothing planned.',
    why: 'On March 8 the Moon passes between Earth and the Sun and goes dark, a new moon. Astrologers read it as a reset, the low-lit start of the next month’s cycle. This one is in Pisces, the sign they link with rest, imagination and letting go. Pisces is the last of the twelve signs, so they also read this new moon as a time to finish and clear.',
    tryIt: 'Cross one thing off your list by deciding not to do it.',
    sky: 'Mercury turned forward again on March 3, after three weeks in which it seemed to go the other way. Mars in Leo and Jupiter in Leo both seem to be moving backward at this new moon, which astrologers read as a reason not to rush. The next new moon, on April 6, is in Aries, the first sign.',
    who: 'People with the Sun in Pisces get the new moon of their own sign, which astrologers read as a personal new year. Cancer and Scorpio, the other water signs, are close to it.',
    questions: ['What on your list are you keeping out of habit?', 'What would you do with one free evening?'],
    comeBack: 'On March 22 the Moon is full in Libra. Come back for it.',
    next: 'full-moon-2027-03-22',
  },
  'jupiter-trine-saturn-2027-04-03': {
    hook: 'Match one big hope with a plan you can actually keep.',
    why: 'On April 3 Jupiter and Saturn form a trine, which is what astrologers call two planets a third of the circle apart. They link Jupiter with growth and Saturn with limits and structure, and they read a trine as the two helping each other. Jupiter is in Leo, the sign of confidence, and Saturn is in Aries, the sign of beginnings.',
    tryIt: 'Choose one ambition. Give it a weekly hour and put that hour in your calendar.',
    sky: 'The two were exact on August 31, 2026, are exact again today, and meet once more on July 11. Jupiter seems to be moving backward until April 13, which is how it comes to meet Saturn a second time. Mars in Leo turned forward two days ago, on April 1. When the alignment is exact, the Sun is in Aries, the same sign as Saturn, and the Moon is in Pisces.',
    who: 'Jupiter has been in Leo since 2026 and Saturn stays in Aries until 2028. Both are fire signs, so astrologers would say people with the Sun in Aries, Leo or Sagittarius get the most from this one. For everyone else it is a general tailwind, and your own chart shows which part of life it touches.',
    questions: ['Which hope of yours has no plan behind it yet?', 'What is one hour a week worth to it?'],
    comeBack: 'On April 6 the Moon goes dark in Aries, a new moon. Come back for it.',
    next: 'new-moon-2027-04-06',
  },
  'new-moon-2027-04-06': {
    hook: 'Start the thing you have been getting ready to start.',
    why: 'On April 6 the Moon passes between Earth and the Sun, a new moon. Astrologers read each new moon as a beginning, and this one doubly so. It is in Aries, the first of the twelve signs, which they link with courage and first moves.',
    tryIt: 'Do the first ten minutes today, before you feel ready.',
    sky: 'Saturn in Aries is almost exactly where the Sun and Moon meet. Astrologers link Saturn with patience and limits, so they read this start as one to pace, not to sprint. Neptune in Aries is in the same sign too. Three days earlier, on April 3, Jupiter and Saturn lined up, which is part of the same sky.',
    who: 'For people with the Sun in Aries this is the new moon of their own sign, and astrologers read it as their start to the year. Leo and Sagittarius, the other fire signs, share the push.',
    questions: ['What have you prepared for long enough?', 'What would the first ten minutes look like?'],
    comeBack: 'On April 20 the Moon is full in Scorpio. Come back for it.',
    next: 'full-moon-2027-04-20',
  },
  'new-moon-2027-05-06': {
    hook: 'Slow one daily thing down until you enjoy it again.',
    why: 'On May 6 the Moon slips between Earth and the Sun and its face goes dark, a new moon. Astrologers read it as a seed moment: small starts made now have a month to grow. This one is in Taurus, the sign they link with comfort, steadiness and the things you value.',
    tryIt: 'Eat one meal today with no screen. Notice what you would like more of.',
    sky: 'Mercury in Taurus shares the sign, and astrologers link Mercury with talking and planning, so plain words suit this one. For a short stretch no planet seems to be moving backward: Jupiter turned forward on April 13 and Pluto does not turn until May 8. Astrologers read that as a clear road.',
    who: 'Astrologers would say people with the Sun in Taurus feel this new moon most directly. Virgo and Capricorn, the other two earth signs, come close behind.',
    questions: ['Which part of your day do you rush without needing to?', 'What do you already have that you rarely enjoy?'],
    comeBack: 'On May 20 the Moon is full in Scorpio, the second full moon in a row in that sign. Come back for it.',
    next: 'full-moon-2027-05-20',
  },
  'new-moon-2027-06-04': {
    hook: 'Send the message you have been drafting in your head.',
    why: 'On June 4 the Moon passes between Earth and the Sun, a new moon. Astrologers read it as a fresh page. This one is in Gemini, the sign they link with talk, questions and quick learning, so they read it as a good time to open a conversation.',
    tryIt: 'Write the first two lines and send them. The rest can follow.',
    sky: 'Uranus in Gemini is in the same sign as the Sun and Moon, and astrologers link Uranus with surprise, so they read this as a month for new ideas. Two days later, on June 6, Uranus and Neptune line up. Mercury is still moving forward, for six more days.',
    who: 'People with the Sun in Gemini have this new moon in their own sign, which astrologers read as a fresh start that is theirs first. Libra and Aquarius, the other air signs, are next.',
    questions: ['Who are you waiting to hear from, when you could write first?', 'What would you say in two lines?'],
    comeBack: 'On June 10 Mercury, the planet astrologers link with talking, starts to look as if it is moving backward. Come back before it does.',
    next: 'mercury-retrograde-2027-06-10',
  },
  'uranus-sextile-neptune-2027-06-06': {
    hook: 'Turn one hunch into something you can show another person.',
    why: 'On June 6 Uranus and Neptune form a sextile, the word astrologers use for two planets a sixth of the circle apart. They link Uranus with new ideas and Neptune with imagination, and they read a sextile as a quiet opening that needs a push from you. Uranus is in Gemini, the sign of talk, and Neptune is in Aries, the sign of first moves.',
    tryIt: 'Sketch it, record it or write one page. Show one person by the weekend.',
    sky: 'The two were exact on July 15, 2026 and on January 15, and after today they drift apart. Both are moving forward this time. Pluto in Aquarius sits at almost the same point of its own sign, so three slow planets line up this month: Uranus and Pluto on June 15, then Neptune and Pluto on June 28. The Sun is in Gemini that day, the same sign as Uranus, and the Moon is in Cancer.',
    who: 'Uranus has been in Gemini since 2026 and Neptune has been in Aries since 2026, and both stay for years. Astrologers would say this last meeting matters most to people with the Sun in Gemini or Aries. Because it is the last pass, astrologers treat it as the moment to use what the earlier two stirred up.',
    questions: ['Which hunch have you never shown anyone?', 'Who would give it a fair look?'],
    comeBack: 'On June 15 Uranus and Pluto line up. Come back for it.',
    next: 'uranus-trine-pluto-2027-06-15',
  },
  'uranus-trine-pluto-2027-06-15': {
    hook: 'Let one long-held opinion be tested by someone who disagrees.',
    why: 'On June 15 Uranus and Pluto form a trine: they stand a third of the circle apart. Astrologers link Uranus with breaks from routine and Pluto with power and deep change, and they read a trine between them as change that comes without a fight. Uranus is in Gemini, the sign of ideas, and Pluto is in Aquarius, the sign of groups and the future.',
    tryIt: 'Ask one person who sees it differently to explain why. Listen all the way through.',
    sky: 'The same two planets were exact on July 18 and November 29, 2026, and meet twice more in 2028. Pluto seems to be moving backward now, and Uranus is moving forward. Mercury in Cancer also seems to be moving backward, since June 10, so astrologers would say to check the details before acting on a new idea. The Sun is in Gemini, the same sign as Uranus, and the Moon is in Scorpio at the exact moment.',
    who: 'Pluto has been in Aquarius since 2024 and Uranus has been in Gemini since 2026. Both are air signs, and astrologers would say people with the Sun in Gemini, Libra or Aquarius are the ones who notice this alignment in their own lives. A slow alignment is the same for everyone on Earth, so the personal part comes from your own chart.',
    questions: ['Which opinion have you held longest without testing it?', 'Who disagrees with you in a way you respect?'],
    comeBack: 'On June 19 the Moon is full in Sagittarius. Come back for it.',
    next: 'full-moon-2027-06-19',
  },
  'neptune-sextile-pluto-2027-06-28': {
    hook: 'Bring one other person into a plan you have kept to yourself.',
    why: 'On June 28 Neptune and Pluto form a sextile, two planets a sixth of the circle apart. Astrologers link Neptune with ideals and Pluto with deep, slow change, and they read a sextile as a gentle link that helps when you act on it. Neptune is in Aries, the sign of going first, and Pluto is in Aquarius, the sign of groups.',
    tryIt: 'Invite one person in. Ask what they would change about the plan.',
    sky: 'These are the two slowest planets astrologers use, and this link between them is a long one. It was exact twice in 2026, is exact today and again on October 16, and returns each year through 2030. Pluto seems to be moving backward now. This is the third slow alignment of the month, after Uranus and Neptune on June 6 and Uranus and Pluto on June 15. At the exact moment the Sun is in Cancer and the Moon is in Aries, the same sign as Neptune.',
    who: 'Neptune stays in Aries until 2038 and Pluto stays in Aquarius until 2043, which is why this link keeps coming back. Astrologers would say it speaks to people with the Sun in Aries or Aquarius before anyone else. The exact date is a marker in a long story, and nothing about it needs to be done that day.',
    questions: ['Which plan of yours needs more than one person?', 'Who would you want beside you on it?'],
    comeBack: 'On July 4 the Moon goes dark in Cancer, a new moon, and Mercury turns forward the same day. Come back for it.',
    next: 'new-moon-2027-07-04',
  },
  'new-moon-2027-07-04': {
    hook: 'Make one corner of your home a little kinder to be in.',
    why: 'On July 4 the Moon passes between Earth and the Sun and cannot be seen, a new moon. Astrologers read it as the start of a new monthly round. This one is in Cancer, the sign they link with home, family and care, so they read it as a time to tend what shelters you.',
    tryIt: 'Clear one shelf, fix one lamp or change the sheets. Stop there.',
    sky: 'Venus in Cancer shares the sign, and astrologers link Venus with affection and comfort. Mercury turns forward later the same day, after appearing to go the other way since June 10. The Moon is close to Earth, 358,803 km away, about eighteen hours before its nearest point of the month.',
    who: 'Astrologers would say this new moon belongs first to people with the Sun in Cancer. Scorpio and Pisces, the other water signs, feel it nearby.',
    questions: ['Which corner of your home do you avoid?', 'What would make it easier to be there?'],
    comeBack: 'On July 18 the Moon is full in Capricorn. Come back for it.',
    next: 'full-moon-2027-07-18',
  },
  'jupiter-trine-saturn-2027-07-11': {
    hook: 'Finish one plan you started this year before you add another.',
    why: 'On July 11 Jupiter and Saturn form a trine, a third of the circle apart. Astrologers link Jupiter with growth and Saturn with structure and limits, and they read a trine as the two pulling the same way. Jupiter is in Leo, the sign of pride and play, and Saturn is in Aries, the sign of courage.',
    tryIt: 'List what is still open on it. Do the smallest item today.',
    sky: 'This follows the exact meetings of August 31, 2026 and April 3, and it is the last of them. Both planets are moving forward this time. The window is short: Jupiter leaves Leo for Virgo on July 26, and the two drift apart after that. The Sun is in Cancer and the Moon is in Scorpio when the alignment is exact.',
    who: 'Saturn stays in Aries until 2028, but Jupiter has only two weeks left in Leo. Astrologers would say people with the Sun in Leo or Aries should use this one, and Sagittarius, the third fire sign, shares in it. The effect astrologers describe is gradual, a matter of weeks around the date and not of hours.',
    questions: ['Which plan from this year is closest to done?', 'What is the one thing still open on it?'],
    comeBack: 'On July 26 Jupiter moves into Virgo. Come back for it.',
    next: 'jupiter-enters-virgo-2027-07-26',
  },
  'new-moon-2027-08-02': {
    hook: 'Let yourself be seen doing the thing you love.',
    why: 'On August 2 the Moon passes between Earth and the Sun, a new moon. Astrologers read a new moon as a beginning. This one is in Leo, the sign they link with pride, play and being seen. It also lines up so exactly that the Moon covers the Sun, a total solar eclipse, and they read an eclipse as a new moon that carries further.',
    tryIt: 'Share one thing you made this year with one person today.',
    sky: 'The Moon reached its nearest point of the month less than four hours before this new moon and is 357,384 km away, so it looks large enough to cover the whole Sun. That is why this eclipse is total where it is central. Venus in Leo is close to the Sun and Moon, and astrologers link Venus with affection and pleasure.',
    who: 'For people with the Sun in Leo, this new moon and eclipse fall in their own sign, and astrologers read that as a marker for their year. Aries and Sagittarius, the other fire signs, are the next to notice.',
    questions: ['What do you love doing that few people have seen you do?', 'Who would be glad to see it?'],
    comeBack: 'The eclipse has a page of its own. On August 17 the Moon is full in Aquarius. Come back for it.',
    next: 'full-moon-2027-08-17',
  },
  'new-moon-2027-08-31': {
    hook: 'Fix the small daily snag you keep stepping around.',
    why: 'On August 31 the Moon passes between Earth and the Sun and goes dark, a new moon. Astrologers read it as a clean start for the month ahead. This one is in Virgo, the sign they link with daily habits, care and useful detail.',
    tryIt: 'Pick one snag. Spend fifteen minutes on it and stop when the timer does.',
    sky: 'Virgo is crowded at this new moon. Jupiter in Virgo sits almost exactly where the Sun and Moon meet, and Mercury in Virgo and Venus in Virgo are there too. Astrologers link Jupiter with growth, so they read this as a small fix that can go a long way. Jupiter arrived in Virgo on July 26.',
    who: 'People with the Sun in Virgo have five bodies in their sign at this new moon: the Sun, the Moon, Mercury, Venus and Jupiter. Astrologers read a gathering like that as a busy, useful month for them. Taurus and Capricorn, the other earth signs, share some of it.',
    questions: ['Which small snag costs you a minute every day?', 'What would fixing it take?'],
    comeBack: 'On September 10 Jupiter and Uranus pull against each other. Come back for it.',
    next: 'jupiter-square-uranus-2027-09-10',
  },
  'jupiter-square-uranus-2027-09-10': {
    hook: 'Leave room in this week’s plan for one surprise.',
    why: 'On September 10 Jupiter and Uranus form a square, which is what astrologers call two planets a quarter of the circle apart. They link Jupiter with growth and Uranus with sudden change, and they read a square as friction that asks for an adjustment. Jupiter is in Virgo, the sign of careful method, and Uranus is in Gemini, the sign of quick ideas.',
    tryIt: 'Look at one fixed plan. Loosen one part of it on purpose.',
    sky: 'Unlike the other slow alignments of 2027, this one is exact only once: it is the only exact square between these two through 2030. Both planets are moving forward today. Uranus turns the other way five days later, on September 15, while Jupiter keeps going. The Sun is in Virgo, the same sign as Jupiter, and the Moon is in Capricorn.',
    who: 'Jupiter stays in Virgo until 2028 and Uranus stays in Gemini until 2032. Astrologers would say people with the Sun in Virgo or Gemini meet this friction first, and that it is a reason to adjust a plan, not to drop it. It is exact once and passes quickly by slow-planet standards, which is why astrologers give it a date worth noting.',
    questions: ['Which plan of yours has no slack in it?', 'Where could you loosen it without losing the point?'],
    comeBack: 'On September 15 the Moon is full in Pisces. Come back for it.',
    next: 'full-moon-2027-09-15',
  },
  'new-moon-2027-09-30': {
    hook: 'Even out one arrangement that has tilted too far one way.',
    why: 'On September 30 the Moon passes between Earth and the Sun, a new moon. Astrologers read it as the first step of a new cycle. This one is in Libra, the sign they link with fairness, balance and partners.',
    tryIt: 'Name one chore, task or favor that runs one way. Offer a fairer split.',
    sky: 'Venus in Libra shares the sign, and astrologers treat Venus as the planet most at home there, which they read as extra ease in talks between two people. Saturn, Uranus, Neptune and Pluto all seem to be moving backward at this new moon. Astrologers read that as a time to revise an agreement more than to make a new one.',
    who: 'Astrologers would say people with the Sun in Libra have the most to start at this new moon. Gemini and Aquarius, the other air signs, are next.',
    questions: ['Which arrangement feels uneven to you right now?', 'What would a fair version look like to both sides?'],
    comeBack: 'On October 7 Mercury, the planet astrologers link with talking and planning, starts to look as if it is moving backward. Come back before it does.',
    next: 'mercury-retrograde-2027-10-07',
  },
  'neptune-sextile-pluto-2027-10-16': {
    hook: 'Go back to a shared project that stalled and take one step.',
    why: 'On October 16 Neptune and Pluto form a sextile: they stand a sixth of the circle apart. Astrologers link Neptune with dreams and Pluto with what changes slowly and for good, and they read a sextile as a small opening that rewards effort. Neptune is in Aries, the sign of beginnings, and Pluto is in Aquarius, the sign of friends and groups.',
    tryIt: 'Message one person from that project. Suggest a single next step.',
    sky: 'Neptune and Pluto both seem to be moving backward, so they meet a little earlier in their signs than they did on June 28. Pluto turns forward two days later, on October 18. The same link returns twice in 2028 and each year after that through 2030. At the exact moment the Sun is in Libra and the Moon is in Taurus.',
    who: 'Neptune has been in Aries since 2026 and Pluto has been in Aquarius since 2024, and neither leaves for more than ten years. Astrologers read a link this slow as a theme for a generation, and people with the Sun in Aries or Aquarius meet it first. For one person the question is narrower: which part of your own chart sits near the start of Aries or Aquarius.',
    questions: ['Which shared project do you still think about?', 'What single step would get it moving?'],
    comeBack: 'On October 28 Mercury turns forward again, and on October 29 the Moon goes dark in Scorpio. Come back for the new moon.',
    next: 'new-moon-2027-10-29',
  },
  'new-moon-2027-10-29': {
    hook: 'Decide what you are done carrying, and put one piece of it down.',
    why: 'On October 29 the Moon passes between Earth and the Sun and its face goes dark, a new moon. Astrologers read it as a quiet beginning. This one is in Scorpio, the sign they link with trust, depth and letting go, so they read it as a start that begins with an ending.',
    tryIt: 'Delete, return or throw out one thing you have kept out of guilt.',
    sky: 'Mercury turned forward the day before, on October 28, after three weeks in which it seemed to go the other way. Pluto turned forward on October 18. Venus in Scorpio shares the sign with the Sun and Moon, and astrologers link Venus with affection, so they read this as a good month for honest talk with someone close.',
    who: 'People with the Sun in Scorpio have this new moon in their own sign, and astrologers read it as their turn to begin again. Cancer and Pisces, the other water signs, are near it.',
    questions: ['What are you keeping only because letting go feels rude?', 'What would be lighter without it?'],
    comeBack: 'On November 14 the Moon is full in Taurus. Come back for it.',
    next: 'full-moon-2027-11-14',
  },
};

export const WINDOW_READING_IDS: readonly string[] = Object.freeze(Object.keys(WINDOW_READINGS));

/** "The exact moment is 14:53 UTC on November 24, which is 09:53 in New York, …" */
export function windowTimesLine(facts: EventFacts): string {
  const at = facts.at ?? facts.start;
  if (!at) throw new Error(`${facts.id}: no instant to read on five clocks`);
  return `The exact moment is ${worldTimesSentence(new Date(at))}.`;
}

/** The page's reading for an event in the window, in the guide's order. */
export function windowInterpretation(facts: EventFacts): EventInterpretation | undefined {
  const reading = WINDOW_READINGS[facts.id];
  if (!reading) return undefined;
  return {
    lead: reading.hook,
    body: [
      reading.why,
      `Try it: ${reading.tryIt}`,
      reading.sky,
      reading.who,
      windowTimesLine(facts),
      reading.comeBack,
    ],
    reflections: [...reading.questions],
  };
}
