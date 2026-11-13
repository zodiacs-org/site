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
 * ZOD-58 (a draft, waiting for the owner's approval) rewrites all thirteen descriptions, after a review of the
 * connector against the directory's guidance found sentences that told the assistant how to behave: an offer of a
 * daily horoscope by schedule, "share plainly", "lead with", "pass the time zone" and "give them the returned
 * shareUrl exactly". Each of the thirteen now says only what the tool does, what it fits and its limits, in the
 * wording of the ZOD-108 draft (docs/platform/evidence/letters-and-copy-20261112/05-tool-descriptions.md), with the
 * under-18 love sentence that ZOD-58's love reading fix makes true. Only the description field changes
 * (PLAIN_DESCRIPTIONS below holds the whole of each, as pinned text); every name, title, schema, annotation and
 * _meta stays as published.
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

/** ZOD-58: the thirteen published descriptions as plain descriptions, whole. Awaiting the owner's approval. */
export const PLAIN_DESCRIPTIONS: Record<string, string> = {
  get_capabilities: "Returns a list of what Zodiacs can do, its limits and how it handles privacy. It takes no input and needs no sign-in or birth details. It fits a question about what Zodiacs can do, or about its limits. It describes the service and calculates nothing. Zodiacs does not schedule anything, pick stocks or investments, make health predictions or guarantee outcomes.",
  get_sky: "Returns where the Sun, the Moon and the planets are now or at a given moment, with the Moon's phase. It fits a question about the sky at one moment, with no person's chart involved. It is astronomy only and makes no personal prediction. Moments run from 1800 to 2199. It takes an optional time zone; without one its times are in UTC. It gives positions for a moment, with no houses or rising sign.",
  get_upcoming_events: "Lists changes in the sky over a window of up to 92 days: planets changing sign, planets turning retrograde or direct, and new and full Moons. With no input it covers the next seven days. It fits a question about what is coming up in the sky over the next days or weeks. It does not list eclipses or every aspect. The window is at most 92 days, within 1800 to 2199. Without a time zone its times are in UTC. Its times for a slow planet's sign change come from the engine and can differ from NASA JPL Horizons by hours: for Neptune entering Aries on 26 January 2026 it gives 14:31:41 UTC, where Horizons gives 17:35 UTC.",
  check_sky_fact: "Checks one claim about the sky and answers yes, no, or that it depends on the time zone when the answer changes during that day. It checks four kinds of claim: a body's sign, whether a planet is retrograde, a sign change on a date, and a Moon phase on a date. It fits a question such as 'Is Mercury retrograde today?' or 'Did the Sun enter Libra on 23 September?'. It is astronomy only and cannot check a prediction. Dates run from 1800 to 2199. Its times for a slow planet's sign change carry the same limit as get_upcoming_events: it gives 14:31:41 UTC for Neptune entering Aries on 26 January 2026, where NASA JPL Horizons gives 17:35 UTC. API documentation: https://zodiacs.org/developers/compute/.",
  get_horoscope: "Returns the Sun-sign horoscope Zodiacs publishes for a date: general, love or career for a day, or general for the week. With a birth date it adds a personal forecast for the week from that person's own chart, in dated lines. Each reading is dated and carries a \"Reading confidence NN%\" label that says how specific the details were, not the odds of an event. shareUrl is the link for sharing the reading. It fits a request for a daily or weekly horoscope or a reflective reading for a sign. Daily readings exist for the day before, the day of and the day after the current edition. Limits: no betting tips, sports picks, stock picks, investment timing, financial forecasts, election forecasts, health predictions or guaranteed outcomes, including when such a request mentions a horoscope. For a birth date under 18 there is no love or romance reading: the general reading stands in, with a note that says so. With no birth date it has no way to know the reader's age. It refuses a birth date less than 13 years ago. Birth details are used for this answer only: never stored, logged or put in a link. Zodiacs sends no notifications and schedules nothing. Its results include a link to the sign-up page for the daily email.",
  open_chart_studio: "Opens Chart Studio, an interactive birth chart that the person fills in themselves with a birth date, a place and, if known, a time. The chart is calculated inside the panel. It takes no input. It fits someone who wants to explore their own chart, or who has not given birth details in the conversation. The assistant sees only the parts of the chart the person chooses to share.",
  get_occasion_sky: "Describes the sky on a day that matters to someone: the Sun and Moon signs, the Moon's phase and any retrograde planets, with a card title and short lines. With a place it adds sunset, golden hour, dusk, the Moon and the planets visible that evening. It rates the date from 0 to 100 with a verdict, the astrological reasons (Venus, the Moon's phase and sign, retrograde planets) and a \"Reading confidence NN%\" label that says how specific the details were, not the odds of an event. Given a window of up to 92 days as searchFrom and searchTo it rates every day and returns the three best-rated days. It rates one date per call. cardUrl is the complete link to the printable card, including every field after #; when cardUrl is null, the returned page link takes its place. shareUrl is the link for sharing the rating. It fits a wedding, an anniversary, the day two people met, a birthday, a pet, a new home, a job, a graduation, a retirement or a gathering. The rating is astrology's traditional reading; it never guarantees how the day will go. A birthday card for a day in the last 13 years is refused. A card's link carries the occasion's own day, time, zone and rounded coordinates, and no name. The place name and first names are printed on the card only and are not used in the calculation.",
  get_life_milestones: "Lists astrology's life milestones from a birth date: each Jupiter return (about every 12 years), the Saturn returns (around 29, 58 and 88) and the Uranus opposition (early forties), with dates, ages and every pass of a retrograde loop, the next one coming, and counts of the full Moons and Mercury retrogrades since birth. It fits a question about a Saturn return or another lifetime return, from a known birth date. It makes no prediction. A birth date is enough; a birth time needs the birthplace's time zone. It refuses a birth date less than 13 years ago. Its share link shows the milestone and the age at it, never the birth date.",
  get_compatibility: "Compares two birth charts: the two people's Sun, Moon and rising signs, the closest contacts between their planets with what each traditionally means, and how their elements balance. It returns a score out of 100, scores for attraction, communication and long-term stability, a verdict, a headline and a \"Reading confidence NN%\" label that says how specific the details were, not the odds of an event. One side can be a famous person whose chart Zodiacs publishes. shareUrl is the link for sharing the score. It fits a question about compatibility between two adults, or between a person and a published famous person. The score is astrology's reading of two charts, not a guarantee of how a relationship will go. Limits: it compares two adults, so when either birth date is under 18 there is no love or romance reading and no score. It refuses a birth date less than 13 years ago. Each person needs a birth date; without a birth time and place there is no rising sign. A famous person's chart is for noon on their birth date, with no Moon or rising sign, and an unknown name returns found: false. Birth details are used for this answer only: never stored, logged or put in a link. Its results include a link inviting a partner to compare charts on the site.",
  find_chart_twins: "Finds famous people, among those Zodiacs publishes charts for, whose Sun sign, Moon sign or both match the person's, with a link to each chart. It fits a question about which famous people share someone's sign or chart. A birth date alone compares the Sun only; the Moon needs the birth time and time zone. It searches only the people Zodiacs publishes. It refuses a birth date less than 13 years ago. Its share link carries the signs and never the birth date.",
  get_famous_chart: "Looks up the birth chart of a famous person Zodiacs publishes: Sun and Moon signs and the planets' signs for their birth date, a short introduction and a link to their page. It fits a question about a well-known person's chart or sign. It covers only the people Zodiacs publishes. For anyone else it says it has no chart (found: false) and returns none.",
  get_birthday: "Describes the sky on a birthday: the Sun's sign for the date, its traditional meaning, the decan, and whether the date is on a cusp where the sign depends on the year or time. With a full birth date it resolves a cusp date's sign for that year, or calculates a solar return, the moment the Sun comes back to its birth position. It links to the date's birthday page and names the published famous people born that day. It fits a question about one birthday. It makes no prediction. A month and day is enough for general facts; the full birth date is needed only for a cusp or a solar return. The longitude field is for historical dates when a birthplace kept local mean time, and has no use for a modern birthday. Solar return years run from 1801 to 2199. It refuses a birth date less than 13 years ago. Its share link carries the month and day, never the year.",
  get_sky_calendar: "Returns the link for subscribing to Zodiacs' sky calendar in Google Calendar, Apple Calendar or Outlook, with how to add it and the next few events. The calendar holds new and full Moons, eclipses and retrograde periods and updates itself. It fits someone who wants these events in their own calendar. Event titles come in English, Spanish, Portuguese, French, Italian or Russian. It returns a subscription link; it adds nothing to anyone's calendar itself and schedules nothing.",
};

/** A 0.6.5 entry with its ZOD-58 description, and the paths that changed. */
export function asPlainDescription(tool: Record<string, unknown>): { tool: Record<string, unknown>; changed: string[] } {
  const description = PLAIN_DESCRIPTIONS[String(tool.name)];
  if (description === undefined || description === tool.description) return { tool, changed: [] };
  return { tool: { ...tool, description }, changed: [`${String(tool.name)}.description`] };
}

/** The thirteen as this release lists them. */
export const PUBLISHED_TOOLS = LIVE_TOOLS.map((tool) => asPlainDescription(as065(tool).tool).tool);
