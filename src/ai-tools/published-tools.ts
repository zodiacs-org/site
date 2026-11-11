import { readFileSync } from 'node:fs';

/**
 * The thirteen tool definitions the directories reviewed, as the live server published them on 1 November 2026
 * (docs/platform/zodiacs-ai/evidence/0.6.0/), and as this release must answer them. For the release tests only.
 *
 * 0.6.5 takes a baby's arrival and a coming of age out of get_occasion_sky, after OpenAI's review found that the
 * baby occasion, with names, a place and coordinates, could collect identifying or locating details about a child
 * under 13. That changes four places, all in get_occasion_sky: its description, its occasion field's description
 * and the occasion enum in its input and output schemas. Every other byte of the thirteen stays as published.
 *
 * ZOD-58 (a draft, waiting for the owner's approval; not released, and the reported version is not changed by it)
 * rewrites ten of the thirteen descriptions, after a review of the connector against the directory's guidance
 * found sentences that told the assistant how to behave: an offer of a daily horoscope by schedule, "share
 * plainly", "lead with" and "give them the returned shareUrl exactly". Each of the ten now says what the tool
 * does, when to use it, what it returns and its limits. Only the description field of those ten changes
 * (PLAIN_DESCRIPTIONS below holds the whole of each, as pinned text); every name, title, schema, annotation and
 * _meta stays as published, and get_sky, get_upcoming_events and check_sky_fact are untouched.
 */
export const LIVE_TOOLS = JSON.parse(readFileSync(new URL('../../docs/platform/zodiacs-ai/evidence/0.6.0/tools-list.live-2026-11-01.json', import.meta.url), 'utf8')).result.tools as Record<string, unknown>[];

const DROPPED_OCCASIONS = ['baby', 'coming-of-age'];
const PUBLISHED_OCCASIONS = ['wedding', 'anniversary', 'met', 'birthday', 'baby', 'pet', 'home', 'job', 'graduation', 'retirement', 'coming-of-age', 'gathering'];
const TEXT_065: [string, string][] = [
  ['a wedding, anniversary, birthday, the day a baby arrived, a new home or another occasion', 'a wedding, anniversary, birthday, a new home or another occasion'],
  ['What the day is: wedding, anniversary, met (the day they met), birthday, baby (the day a baby arrived), pet, home, job, graduation, retirement, coming-of-age or gathering.',
    'What the day is: wedding, anniversary, met (the day they met), birthday, pet, home, job, graduation, retirement or gathering.'],
];

/** A published entry as 0.6.5 answers it, and the paths that changed. */
export function as065(tool: Record<string, unknown>): { tool: Record<string, unknown>; changed: string[] } {
  const changed: string[] = [];
  const walk = (value: unknown, path: string): unknown => {
    if (Array.isArray(value)) {
      if (JSON.stringify(value) === JSON.stringify(PUBLISHED_OCCASIONS)) {
        changed.push(path);
        return value.filter((kind) => !DROPPED_OCCASIONS.includes(kind));
      }
      return value.map((item, index) => walk(item, `${path}[${index}]`));
    }
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item, `${path}.${key}`)]));
    if (typeof value === 'string') {
      const next = TEXT_065.reduce((text, [before, after]) => text.replace(before, after), value);
      if (next !== value) changed.push(path);
      return next;
    }
    return value;
  };
  return { tool: walk(tool, String(tool.name)) as Record<string, unknown>, changed };
}

/** ZOD-58: the ten published descriptions as plain descriptions, whole. Awaiting the owner's approval. */
export const PLAIN_DESCRIPTIONS: Record<string, string> = {
  open_chart_studio: 'Opens Chart Studio, an interactive birth chart the person fills in themselves: birth date, place, and time if they know it. It takes no arguments, so no birth details are needed before it opens. The chart is calculated inside the panel; only the parts the person chooses to share reach the conversation.',
  get_capabilities: 'Lists what Zodiacs can do, its limits and how it handles privacy. Use it when the person asks what Zodiacs can do, or when those details are needed before choosing another tool. Zodiacs does not schedule anything, pick stocks or investments, make health predictions or guarantee outcomes, and this tool adds nothing to a request for one of those. No sign-in or birth details needed.',
  get_horoscope: "Shows a Sun-sign horoscope: general, love or career for today, or general for this week, written for the person's own date. Use it for a horoscope or a reflective reading. It takes a sign, a focus, a period and the person's time zone; without a sign the person chooses one in the panel, and a sign is never inferred. With a birth date (and a birth time and birthplace zone when known) the result adds a personal forecast for the week from the person's own chart, in dated lines. Each reading is dated and carries a \"Reading confidence NN%\" label that says how specific the details were, not the odds of an event. shareUrl is the link for sharing the reading. Limits: no betting tips, sports picks, stock picks, investment timing, financial forecasts, election forecasts, health predictions or guaranteed outcomes, including when such a request mentions a horoscope. For a birth date under 18 there is no love or romance reading. It refuses a birth date less than 13 years ago. Birth details are used for this answer only: never stored, logged or put in a link. Zodiacs sends no notifications and schedules nothing.",
  get_occasion_sky: "Shows the sky on a day that matters to the person: a wedding, anniversary, birthday, a new home or another occasion. It gives the Sun and Moon signs, the Moon's phase, any retrograde planets, a card title and short lines they can use, and, with a place, sunset, golden hour, dusk, the Moon and the planets visible that evening. It needs the date; add the local time, the place's time zone and its coordinates if the person gives them. It also rates the date from 0 to 100 with a verdict, the astrological reasons (Venus, the Moon's phase and sign, retrograde planets) and a \"Reading confidence NN%\" label that says how specific the details were, not the odds of an event. For the best days for an occasion it takes a window as searchFrom and searchTo (up to 92 days, such as a whole month), rates every day in it and returns the three best-rated days with their reasons, and the card for the best one unless a date is also given. It rates one date per call, so comparing a few named dates takes one call for each. It never guarantees how the day will go. cardUrl is the complete link to the printable card, including every field after #; when cardUrl is null, the returned page link takes its place. shareUrl is the link for sharing the rating. For a birthday it refuses a date less than 13 years ago.",
  get_life_milestones: "Lists astrology's life milestones from a birth date: each Jupiter return (about every 12 years), the Saturn returns (around 29, 58 and 88) and the Uranus opposition (early forties), with dates, ages and every pass of a retrograde loop, the next one coming, and how many full Moons and Mercury retrogrades the person has lived through. A birth date is enough; add the birth time and time zone if known. It makes no prediction. shareUrl is the link for sharing it; it shows the milestone the card leads with, never the birth date. It refuses a birth date less than 13 years ago.",
  get_compatibility: "Compares two people's birth charts: their Sun, Moon and rising signs, the closest contacts between their planets with what each traditionally means, and how their elements balance. Use it when someone asks about compatibility with a partner, friend or family member, or with a famous person. Each person needs a birth date; add a birth time, time zone and birthplace coordinates when known, and first names if they want them shown. A famous person Zodiacs publishes is given as { famous: \"<name>\" } instead: that side uses their published chart for noon on their birth date, without a Moon or rising sign, and links to their page. When Zodiacs has no chart for that name the result says so (found: false) and gives no chart. It returns a compatibility score out of 100 with scores for attraction, communication and long-term stability, a verdict, a headline and a \"Reading confidence NN%\" label that says how specific the details were, not the odds of an event. The score is astrology's reading, not a guarantee of how the relationship will turn out. shareUrl is the link for sharing the score. Limits: it compares two adults, so when either birth date is under 18 there is no love or romance reading and no score. It refuses a birth date less than 13 years ago. Birth details are used for this answer only: never stored, logged or put in a link.",
  find_chart_twins: "Finds famous people whose birth charts share the person's Sun sign, Moon sign or both, from the people Zodiacs publishes charts for, with a link to each person's chart. A birth date is enough for the Sun; the Moon needs the birth time and time zone. Use it when someone asks which famous people share their sign or chart. shareUrl is the link for sharing it; it carries their signs, never the birth date. It refuses a birth date less than 13 years ago.",
  get_famous_chart: "Looks up the birth chart of a famous person Zodiacs publishes: Sun and Moon signs and the planets' signs for their birth date, a short introduction and a link to their page. Use it when someone asks about a well-known person's chart or sign. When Zodiacs has no chart for that person the result says so and gives no chart. shareUrl is the link for sharing the chart.",
  get_birthday: "Describes the sky on a birthday: the Sun's sign for that date, its traditional meaning, the decan, and whether the date falls on a cusp where the sign depends on the year or time. A month and day (05-03) is enough for general birthday facts. A full birth date is needed only to resolve a cusp date's sign in that birth year or to calculate a solar return, the moment the Sun comes back to its birth position, with a time and time zone if known. Longitude is only for historical local mean time; modern birthdays need no coordinates. It links to the date's birthday page and names the famous people Zodiacs publishes who were born on that day, as the page does. It makes no prediction. shareUrl is the link for sharing it; it carries the month and day, never the year. It refuses a full birth date less than 13 years ago.",
  get_sky_calendar: "Gives the link to subscribe to Zodiacs' sky calendar in Google Calendar, Apple Calendar or Outlook: new and full Moons, eclipses and retrograde periods, updated automatically, with how to add it and the next few events. Use it when someone wants these in their own calendar. Available in English, Spanish, Portuguese, French, Italian and Russian. shareUrl is the link for sharing the calendar; it shows the next event.",
};

/** A 0.6.5 entry with its ZOD-58 description, and the paths that changed. */
export function asPlainDescription(tool: Record<string, unknown>): { tool: Record<string, unknown>; changed: string[] } {
  const description = PLAIN_DESCRIPTIONS[String(tool.name)];
  if (description === undefined || description === tool.description) return { tool, changed: [] };
  return { tool: { ...tool, description }, changed: [`${String(tool.name)}.description`] };
}

/** The thirteen as this release lists them. */
export const PUBLISHED_TOOLS = LIVE_TOOLS.map((tool) => asPlainDescription(as065(tool).tool).tool);
