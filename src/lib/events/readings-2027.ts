/**
 * The 2027 event readings written to the reading style guide (Linear ZOD-46,
 * ZOD-211): one for each 2027 full moon, eclipse, Mercury or Mars retrograde
 * and slow-planet sign change that has a page of its own.
 *
 * The guide's shape, in its order:
 *   hook      one sentence of advice, with no sky detail before it
 *   why       what the sky is doing and what astrologers read in it, each sky
 *             term explained in everyday words the first time it appears
 *   tryIt     one small, concrete action
 *   comeBack  one line about what is next in the real sky
 *
 * `next` names the event the last line points to. The page links it, and
 * readings-2027.test.ts holds every date written here to the sky data: the
 * event's own day, its end, and the day of the event named last. Write dates
 * as UTC days, the way the page's dateline prints them.
 */

export interface StyleGuideReading {
  hook: string;
  why: string;
  tryIt: string;
  comeBack: string;
  /** The event the last line points to. */
  next: string;
}

/** The day these readings were written; the pages print it as "Updated". */
export const EVENT_READINGS_2027_UPDATED = '2026-11-14';

export const EVENT_READINGS_2027: Readonly<Record<string, StyleGuideReading>> = {
  // Full moons
  'full-moon-2027-01-22': {
    hook: 'Let someone see the thing you are proud of this week.',
    why: 'On January 22 the Moon is full: it sits opposite the Sun, so its whole face is lit. Astrologers read a full moon as the point where something that has been building comes into view. This one is in Leo, the sign they link with pride, play and being seen.',
    tryIt: 'Show one person something you made or did. Leave out the apology that usually goes with it.',
    comeBack: 'On February 6 the Moon passes in front of the Sun, a solar eclipse. Come back for it.',
    next: 'eclipse-2027-02-06',
  },
  'full-moon-2027-02-20': {
    hook: 'Fix one small thing that has been bugging you every day.',
    why: 'On February 20 the Moon is full, opposite the Sun with its whole face lit. Astrologers read that as a moment when things come to a head. It is in Virgo, the sign they link with daily habits and useful detail. The Moon also brushes the faint outer part of Earth’s shadow that night, an eclipse so slight that most people will not notice it.',
    tryIt: 'Pick the drawer, the inbox or the habit that slows you down most. Give it fifteen minutes.',
    comeBack: 'Mercury, the planet astrologers link with talking and planning, has seemed to move backward since February 9 and turns forward again on March 3. Come back then.',
    next: 'mercury-retrograde-2027-02-09',
  },
  'full-moon-2027-03-22': {
    hook: 'Ask what the other person needs before you say what you want.',
    why: 'On March 22 the Moon is full, opposite the Sun with its whole face lit. Astrologers read a full moon as a time when something comes into the open. This one is in Libra, the sign they link with fairness and partners. The Sun is across the sky in Aries, the sign of going first, so they read this night as “me” set beside “us”.',
    tryIt: 'In one conversation today, ask a question and let the other person finish the answer.',
    comeBack: 'Mars, the planet astrologers link with drive, has seemed to move backward since January 10 and turns forward again on April 1. Come back then.',
    next: 'mars-retrograde-2027-01-10',
  },
  'full-moon-2027-04-20': {
    hook: 'Say the true thing you have been holding back, and say it kindly.',
    why: 'On April 20 the Moon is full: it sits opposite the Sun and its whole face is lit. Astrologers read a full moon as a time when what was hidden shows. The Moon has just crossed into Scorpio, the sign they link with trust and with what lies under the surface.',
    tryIt: 'Tell one person you trust one thing you have kept to yourself.',
    comeBack: 'The next full moon, on May 20, is in Scorpio too, which does not happen every year. Come back to see how this one ends.',
    next: 'full-moon-2027-05-20',
  },
  'full-moon-2027-05-20': {
    hook: 'Finish one thing today, and let it stay finished.',
    why: 'On May 20 the Moon is full, opposite the Sun with its whole face lit. It is the second full moon in a row in Scorpio, the sign astrologers link with trust, depth and letting go. The first was on April 20. They read the second as the close of what the first one opened.',
    tryIt: 'Close one loop: send the reply, return the borrowed thing, or delete the old draft.',
    comeBack: 'On June 10 Mercury, the planet astrologers link with talking and planning, starts to look as if it is moving backward. Come back before it does.',
    next: 'mercury-retrograde-2027-06-10',
  },
  'full-moon-2027-06-19': {
    hook: 'Check one big belief against something you have seen for yourself.',
    why: 'On June 19 the Moon is full, opposite the Sun with its whole face lit. Astrologers read a full moon as a time when things come into view. This one is in Sagittarius, the sign they link with big ideas, travel and belief. Mercury, the planet they link with talking and planning, seems to be moving backward this month, which they read as a call to look twice.',
    tryIt: 'Write down one thing you are sure of. Next to it, write how you know.',
    comeBack: 'Mercury turns forward again on July 4. Come back then.',
    next: 'mercury-retrograde-2027-06-10',
  },
  'full-moon-2027-07-18': {
    hook: 'Look at what you carry for other people, and hand one piece back.',
    why: 'On July 18 the Moon is full, opposite the Sun with its whole face lit. Astrologers read a full moon as a time when a load you have been carrying shows its weight. This one is in Capricorn, the sign they link with duty, work and long plans. The Moon also grazes the very edge of Earth’s shadow, an eclipse so slight that nobody will see it.',
    tryIt: 'Pick one task that is not really yours. Ask its owner to take it back.',
    comeBack: 'On August 2 the Moon covers the Sun completely, a total solar eclipse. Come back for it.',
    next: 'eclipse-2027-08-02',
  },
  'full-moon-2027-08-17': {
    hook: 'Reach out to the friend or the group you have drifted away from.',
    why: 'On August 17 the Moon is full, opposite the Sun with its whole face lit. Astrologers read a full moon as a time when something comes into the open. This one is in Aquarius, the sign they link with friends, groups and the future. The Moon also passes through the faint outer part of Earth’s shadow, a slight eclipse that most people will not notice.',
    tryIt: 'Send one message to a friend you miss. One line is enough.',
    comeBack: 'On August 31 the Moon goes dark and a new cycle begins, a new moon. Come back for it.',
    next: 'new-moon-2027-08-31',
  },
  'full-moon-2027-09-15': {
    hook: 'Let one worry wait until morning.',
    why: 'On September 15 the Moon is full: it sits opposite the Sun and its whole face is lit. Astrologers read a full moon as a time when feelings run closer to the surface. This one is in Pisces, the sign they link with rest, imagination and letting go.',
    tryIt: 'Before bed, write the worry on paper and leave the paper in another room.',
    comeBack: 'On October 7 Mercury, the planet astrologers link with talking and planning, starts to look as if it is moving backward. Come back before it does.',
    next: 'mercury-retrograde-2027-10-07',
  },
  'full-moon-2027-10-15': {
    hook: 'Make the first move on the thing you keep waiting for permission to do.',
    why: 'On October 15 the Moon is full, opposite the Sun with its whole face lit. Astrologers read a full moon as a time when a wish gets hard to ignore. This one is in Aries, the sign they link with courage and beginnings. Mercury, the planet they link with talking and planning, seems to be moving backward this month, so they would add: start small and check the details twice.',
    tryIt: 'Do the first five minutes of it today. Reread any message before you send it.',
    comeBack: 'Mercury turns forward again on October 28. Come back then.',
    next: 'mercury-retrograde-2027-10-07',
  },
  'full-moon-2027-11-14': {
    hook: 'Slow down and enjoy something simple that you already have.',
    why: 'On November 14 the Moon is full: it sits opposite the Sun and its whole face is lit. Astrologers read a full moon as a time to notice what has grown. This one is in Taurus, the sign they link with comfort, steadiness and the things you value.',
    tryIt: 'Cook, eat or walk once today without your phone.',
    comeBack: 'On November 28 the Moon goes dark and a new cycle begins, a new moon. Come back for it.',
    next: 'new-moon-2027-11-28',
  },
  'full-moon-2027-12-13': {
    hook: 'Ask the question you have been pretending you already know the answer to.',
    why: 'On December 13 the Moon is full, opposite the Sun with its whole face lit. Astrologers read a full moon as a time when something comes into the open. This one is in Gemini, the sign they link with talking, learning and curiosity. It is the last full moon of 2027.',
    tryIt: 'Ask one person one honest question today, and listen to the whole answer.',
    comeBack: 'The next full moon, on January 12, 2028, passes through part of Earth’s shadow, a partial eclipse of the Moon. Come back for it.',
    next: 'full-moon-2028-01-12',
  },

  // Eclipses
  'eclipse-2027-02-06': {
    hook: 'Start one thing with other people instead of on your own.',
    why: 'On February 6 the Moon passes in front of the Sun, a solar eclipse. The Moon is a little too far from Earth to cover the Sun completely, so a bright ring stays around its edge. Astrologers read a solar eclipse as a strong fresh start. This one is in Aquarius, the sign they link with friends, groups and the future.',
    tryIt: 'Invite one person into a plan you were going to carry out alone.',
    comeBack: 'Two weeks later, on February 20, the full Moon brushes the edge of Earth’s shadow. Come back for that one.',
    next: 'eclipse-2027-02-20',
  },
  'eclipse-2027-02-20': {
    hook: 'Notice one habit that has quietly stopped helping you.',
    why: 'On February 20 the full Moon passes through the faint outer part of Earth’s shadow. That is a penumbral lunar eclipse: the Moon dims a little, and most people will not notice. Astrologers read a lunar eclipse as a time to let something go. This one is in Virgo, the sign they link with daily habits and useful detail.',
    tryIt: 'Drop the habit for one day and see what you miss.',
    comeBack: 'Mercury, the planet astrologers link with talking and planning, has seemed to move backward since February 9 and turns forward again on March 3. Come back then.',
    next: 'mercury-retrograde-2027-02-09',
  },
  'eclipse-2027-07-18': {
    hook: 'Loosen one rule you made for yourself that no longer fits.',
    why: 'On July 18 the full Moon grazes the very edge of Earth’s faint outer shadow. It is the slightest kind of lunar eclipse, and no eye or camera will see it. Astrologers still mark a lunar eclipse as a time to let something go. This one is in Capricorn, the sign they link with duty, work and long plans.',
    tryIt: 'Write the rule down. Cross out the part you keep only out of habit.',
    comeBack: 'On August 2 the Moon covers the Sun completely, a total solar eclipse. Come back for it.',
    next: 'eclipse-2027-08-02',
  },
  'eclipse-2027-08-02': {
    hook: 'Begin the thing you would be proud to put your name on.',
    why: 'On August 2 the Moon covers the Sun completely, a total solar eclipse. Along a narrow path from southern Spain across North Africa to Arabia, day turns to dusk for a few minutes. Astrologers read a solar eclipse as a strong fresh start. This one is in Leo, the sign they link with pride, play and being seen.',
    tryIt: 'Write the first line, make the first call, or book the first hour.',
    comeBack: 'On August 17 the full Moon brushes Earth’s shadow, the last eclipse of 2027. Come back for it.',
    next: 'eclipse-2027-08-17',
  },
  'eclipse-2027-08-17': {
    hook: 'Step back from one group or plan that takes more than it gives.',
    why: 'On August 17 the full Moon passes through the faint outer part of Earth’s shadow. That is a penumbral lunar eclipse: the Moon dims a little, and most people will not notice. Astrologers read a lunar eclipse as a time to let something go. This one is in Aquarius, the sign they link with friends, groups and the future.',
    tryIt: 'Mute one group chat for a day and notice how the day feels.',
    comeBack: 'What comes next is quieter: on August 31 the Moon goes dark and a new cycle begins, a new moon. Come back for it.',
    next: 'new-moon-2027-08-31',
  },

  // Retrogrades
  'mars-retrograde-2027-01-10': {
    hook: 'Ease off one thing you have been pushing hard, and check your aim.',
    why: 'From January 10 to April 1, Mars seems to drift backward across the sky. It is a trick of the view: Earth is passing Mars on the inside lane. Mars is the planet astrologers link with drive and effort, and they read these weeks as a time to rework a plan instead of forcing it. Mars backs out of Virgo, the sign of careful work, into Leo, the sign of pride.',
    tryIt: 'Pick one project. Before the next push, write down what “done” looks like.',
    comeBack: 'On January 22 the Moon is full in Leo, the sign Mars is backing toward. Come back for it.',
    next: 'full-moon-2027-01-22',
  },
  'mercury-retrograde-2027-02-09': {
    hook: 'Read it once more before you send it.',
    why: 'From February 9 to March 3, Mercury seems to move backward across the sky. Nothing changes in its orbit: Mercury is passing Earth on the inside lane, and from here that looks like a reversal. Mercury is the planet astrologers link with talking and planning, so they read these weeks as a time to review. It starts in Pisces, the sign of imagination, and backs into Aquarius, the sign of friends and groups.',
    tryIt: 'Confirm one time, place or detail today that you have only been assuming.',
    comeBack: 'On February 20 the full Moon brushes the edge of Earth’s shadow, a faint eclipse. Come back for it.',
    next: 'eclipse-2027-02-20',
  },
  'mercury-retrograde-2027-06-10': {
    hook: 'Call instead of texting when the message matters.',
    why: 'From June 10 to July 4, Mercury seems to move backward across the sky. Nothing changes in its orbit: Mercury is passing Earth on the inside lane, and from here that looks like a reversal. Mercury is the planet astrologers link with talking and planning, so they read these weeks as a time to check and repeat. It starts in Cancer, the sign of home and family, and backs into Gemini, the sign of talking and learning.',
    tryIt: 'Check one plan with the people you live with: who, when and where.',
    comeBack: 'On June 19 the Moon is full, its whole face lit, right in the middle of these weeks. Come back for it.',
    next: 'full-moon-2027-06-19',
  },
  'mercury-retrograde-2027-10-07': {
    hook: 'Go back to one talk that ended badly, and try again gently.',
    why: 'From October 7 to October 28, Mercury seems to move backward across the sky. Nothing changes in its orbit: Mercury is passing Earth on the inside lane, and from here that looks like a reversal. Mercury is the planet astrologers link with talking and planning, so they read these weeks as a time for second tries. It starts in Scorpio, the sign of trust and hard truths, and backs into Libra, the sign of fairness and partners.',
    tryIt: 'Open with one line: “I have been thinking about what you said.”',
    comeBack: 'On October 15 the Moon is full, its whole face lit, in the middle of these weeks. Come back for it.',
    next: 'full-moon-2027-10-15',
  },

  // Sign changes
  'jupiter-enters-virgo-2027-07-26': {
    hook: 'Pick one skill and get a little better at it each day.',
    why: 'On July 26 Jupiter leaves Leo and moves into Virgo. Jupiter is the largest planet, and astrologers link it with growth. It spends about a year in each sign, one of the twelve equal parts of its path around the sky. In Virgo, the sign of craft and daily habits, they read growth as coming from small, steady practice.',
    tryIt: 'Choose the skill today and practice it for ten minutes.',
    comeBack: 'On August 2 the Moon covers the Sun completely, a total solar eclipse. Come back for it.',
    next: 'eclipse-2027-08-02',
  },
};

/** The ids of the pages written to the style guide. */
export const STYLE_GUIDE_READING_IDS = Object.freeze(Object.keys(EVENT_READINGS_2027));
