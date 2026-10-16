/**
 * The learn hub's library topics: each cluster or long read /learn/ indexes,
 * with the one-line description the hub prints for it. The hub renders them
 * (src/pages/learn/index.astro) and the assistant's site guide lists them
 * (scripts/build-assistant-context.mjs), so the two always say the same.
 */
export interface LearnTopic {
  route: string;
  title: string;
  description: string;
}

export const LEARN_TOPICS = [
  {
    route: '/learn/how-to-read-a-birth-chart/',
    title: 'How to read a chart',
    description: 'The four-step method: big three, planets by house, aspects, then the weather.',
  },
  {
    route: '/learn/communication/',
    title: 'Communication',
    description: 'How you think, what a conversation needs to feel like, and how you handle friction, read from Mercury, the Moon, and Mars in your birth chart.',
  },
  {
    route: '/learn/planets/',
    title: 'The planets',
    description: 'Ten planets, ten jobs, from the Sun’s identity to Pluto’s slow excavations.',
  },
  {
    route: '/learn/houses/',
    title: 'The houses',
    description: 'Life’s floor plan: money, home, work, partnership, reputation, solitude.',
  },
  {
    route: '/learn/aspects/',
    title: 'The aspects',
    description: 'The angles between planets, the chart’s wiring, friendly and otherwise.',
  },
  {
    route: '/learn/placements/',
    title: 'The placements',
    description: 'Every planet in every sign, how each combination actually behaves.',
  },
  {
    route: '/learn/zodiac-dates/',
    title: 'The living correspondence chart',
    description: 'All twelve signs, exact longitude boundaries, and year-exact Sun ingress instants.',
  },
  {
    route: '/learn/glossary/',
    title: 'The astrology glossary',
    description: 'The words used across the site, defined against the chart and timing calculations.',
  },
] as const satisfies readonly LearnTopic[];

export function learnTopic(route: (typeof LEARN_TOPICS)[number]['route']): LearnTopic {
  const topic = LEARN_TOPICS.find((entry) => entry.route === route);
  if (!topic) throw new Error(`No learn topic for ${route}`);
  return topic;
}
