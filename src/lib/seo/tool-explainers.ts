/**
 * English explainer text for the tool pages that otherwise serve little more
 * than a form to a crawler or a reader without JavaScript. Each entry gives
 * the page a search title, a description and a few plain answers, rendered
 * in the server HTML and mirrored as FAQPage structured data.
 *
 * English only: the localized routes keep their own copy until each locale
 * has these answers written by a person, never machine translated.
 * No dashes, no predictions, and every answer must describe what the tool
 * actually does (see the tests beside this file).
 */
export type ToolExplainerKind = 'twins' | 'group' | 'wrapped' | 'day';

export interface ToolExplainer {
  title: string;
  description: string;
  faq: readonly { q: string; a: string }[];
}

export const TOOL_EXPLAINERS: Readonly<Record<ToolExplainerKind, ToolExplainer>> = Object.freeze({
  twins: {
    title: 'Chart Twins: Famous People With Your Sun and Moon | Zodiacs.org',
    description: 'Find public figures born with your Sun and Moon signs. Every birth date in the directory is sourced, and your chart is calculated in your browser.',
    faq: [
      { q: 'What is a chart twin?', a: 'Someone born with the Sun and the Moon in the same signs as you. This page looks for them among the public figures in the Zodiacs.org people directory, where every birth date comes with a published source you can open and check.' },
      { q: 'Which signs does it compare?', a: 'Your Sun sign and your Moon sign. People who match both are listed first, then people who share one of the two. Rising signs are not compared: the directory holds birth dates without birth times, and the rising sign changes roughly every two hours.' },
      { q: 'Do I need my birth time?', a: 'No, but it helps. Without a time we compare your Sun sign only, because the Moon can change sign during a day, and if you were born within about a degree of a Sun sign boundary we ask for the time before comparing anything. With a time, plus the birthplace the form always asks for, we compare your Moon sign too. When someone in the directory was born on a day the Moon changed sign, their Moon is left out rather than guessed.' },
      { q: 'Does sharing signs mean we are alike?', a: 'No. Two people with the same Sun and Moon still have different charts, different lives and different choices. A match is a conversation starter and a reason to read about someone, not a verdict on either of you.' },
      { q: 'Is my birth data stored?', a: 'No. Your chart is calculated in your browser and compared with a list of names and signs the page already holds. Your birth details are not sent to our servers, and you do not need an account.' },
    ],
  },
  group: {
    title: 'Group Chart Reading: The Spark, the Anchor and the Glue | Zodiacs.org',
    description: 'Add three to eight people and see what each might bring to the group: the spark, the anchor, the connector or the glue. Free, calculated in your browser.',
    faq: [
      { q: 'How does the group reading work?', a: 'Add three to eight people. For each one we cast a birth chart in your browser and count the elements of a few placements: the Sun, Mercury, Venus and Mars, plus the Moon and the rising sign when the birth time is known. The element with the most placements gives that person a role in the group.' },
      { q: 'What do the four roles mean?', a: 'Fire is the spark, who gets things started. Earth is the anchor, who keeps plans practical. Air is the connector, who brings ideas and conversation. Water is the glue, who notices how everyone feels. When two or more elements tie, the reading calls it a blend instead of picking one.' },
      { q: 'What if I do not know someone’s birth time?', a: 'Mark the time as unknown. We then leave out the Moon and the rising sign, and any planet so close to a sign boundary that the date alone cannot settle it. The result shows how many placements were counted for each person.' },
      { q: 'Is this a personality test?', a: 'No. The roles are symbolic prompts for noticing what each person brings, not a measure of personality or of how well people get along. To look at two people in depth, the compatibility calculator compares both full charts.' },
      { q: 'Do I need permission to add someone?', a: 'Please ask first. Everything is calculated in your browser and nothing is uploaded, and the shareable card shows only the names or nicknames you typed (or Person 1, Person 2 when you leave a name out), each role, and a note when a birth time is unknown, never birth details or degrees. A birthday still belongs to the person it describes.' },
    ],
  },
  wrapped: {
    title: 'Your Year in Astrology: Jupiter and Saturn Transits | Zodiacs.org',
    description: 'See when Jupiter and Saturn met your Sun, Moon and rising sign in a year you pick, then make a card to share. Free, and calculated in your browser.',
    faq: [
      { q: 'What does Your sky, wrapped show?', a: 'The dates in a calendar year when Jupiter or Saturn made an exact conjunction, square or opposition to your Sun, Moon or rising sign. You get a timeline of those contacts and a card to share.' },
      { q: 'Why only Jupiter and Saturn?', a: 'Faster planets touch your chart every few weeks, and Uranus, Neptune and Pluto move so slowly that one contact can fill several years. Jupiter takes about twelve years to go round the zodiac and Saturn about twenty nine, so their contacts are rare enough to stand out in a year.' },
      { q: 'Why does one contact appear more than once?', a: 'When a planet turns retrograde it can cross the same point again, back and forth, before moving on. Each exact pass is listed on its own date and counted separately.' },
      { q: 'What if I do not know my birth time?', a: 'We show contacts to your Sun only, with approximate dates, and leave out the Moon and the rising sign, which need a birth time to place.' },
      { q: 'What goes on the share card?', a: 'A 1080 by 1920 image showing the year and how many times Jupiter and Saturn met your chart. It carries no name, no birth details, no natal degrees and no individual contact dates. The chart is calculated in your browser and your birth details are not sent to our servers.' },
    ],
  },
  day: {
    title: 'Chart of the Day: The Sky When Someone in the News Was Born | Zodiacs.org',
    description: 'A public figure in the news, their birth chart, and a clear account of where the birth date comes from and how far it can be trusted.',
    faq: [
      { q: 'How is the chart of the day chosen?', a: 'We pick a public figure who was in the news that week and whose birth date is published by a source we can name. Each edition links the news story and the birth record, says how reliable that record is, and is approved by a person before it goes up.' },
      { q: 'Why is there no rising sign?', a: 'Published birth times for public figures are often missing, rounded or reconstructed after the fact, so we do not use them. Without a time the chart shows where the planets were on the birth date, with no rising sign and no houses.' },
      { q: 'Is this a reading of the person?', a: 'No. A public chart is a way to explore astrology, not a claim about someone’s private life, health or future. It shows the sky on their birth date, with the sources beside it so you can check each fact.' },
      { q: 'Where can I find more charts like this?', a: 'The people directory lists public figures whose birth dates we have sourced, each with their birth record. On the chart twins page you can compare your own Sun and Moon signs with the people in the directory.' },
    ],
  },
});

/** FAQPage structured data for an explainer, matching the visible answers word for word. */
export function explainerFaqJsonLd(kind: ToolExplainerKind) {
  return {
    '@type': 'FAQPage',
    mainEntity: TOOL_EXPLAINERS[kind].faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}
