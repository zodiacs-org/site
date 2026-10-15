import { moonPhase } from '@zodiacs/engine';
import { createLocalTimeModule } from '../../api/_compute/local-time.mjs';
import { ComputeApiError } from '../lib/compute-api/errors';
import { BUDGETS, EPOCH, EVENT_KINDS } from '../lib/compute-api/constants';
import { computeEvents, computePositions, computeSkyFact } from '../lib/compute-api/endpoints';
import { BACKEND, engineStatements } from '../lib/compute-api/receipt';
import { parseEventsRequest, parsePositionsRequest, parseSkyFactRequest, zoneAt } from '../lib/compute-api/validate';
import type { LocalTimeModule } from '../lib/compute-api/local-time';
import { occasionCard } from '../lib/occasions/card';
import { MILESTONE_WORDS, milestoneCard } from '../lib/occasions/milestone-card';
import type { Milestone } from '../lib/occasions/milestones';
import { compatibilityMissing, computeCompatibility } from './features/compatibility';
import { findChartTwins, getFamousChart } from './features/people';
import { getBirthday, getSkyCalendar } from './features/birthday';
import { rateOccasionDate } from '../lib/occasions/date-score';
import { personalWeek } from './features/personal-week';
import { bestDays, type BestDays } from '../lib/occasions/best-dates';
import { occasionShareUrl } from '../lib/share-results';
import { AI_RESULT_SCHEMA, AI_TOOL_NAMES, AI_VERSION, INPUT_SCHEMAS, MAX_EVENT_DAYS, OCCASION_NOTE, OCCASION_TOOL_NAMES, ORIGIN, OUTPUT_SCHEMAS, type AiToolName } from './contracts';
import { dateInZone, horoscopePanel, resolveHoroscope, type HoroscopePanelData, type ZoneSource } from './horoscope/reading';
import type { HoroscopeWindow } from './horoscope/window';

export interface AiDependencies {
  /** Authenticated preview only; changes the declared privacy/limitations. */
  skyWatch?: boolean;
  localTime?: LocalTimeModule;
  now?: () => Date;
  /** The hosted boundary supplies both Firewall and atomic event admission. */
  allowEvents?: () => Promise<'allowed' | 'limited' | 'unavailable'>;
  /** The daily horoscope window; get_horoscope is offered only where it is supplied. */
  horoscopeWindow?: () => Promise<HoroscopeWindow>;
  /** The occasion tools (ZODIACS_OCCASIONS_ENABLED=1); off until their release. */
  occasions?: boolean;
}

/** Per-call facts from the host and results meant only for the panel. */
export interface AiCallContext {
  /** The time zone the assistant shares with the call, if any; validated before use. */
  hostZone?: string;
  /** Which assistant the call came through, added to zodiacs.org links as ?ref= so the site can count those visits. */
  ref?: 'chatgpt' | 'assistant';
  /** Set by get_horoscope: the selected sign's readings for the panel, never shown to the model. */
  horoscopePanel?: HoroscopePanelData;
}

const PRIVACY_WITH_BIRTH_TOOLS = 'Public-sky tools and Sun-sign horoscopes need no birth details. The compatibility, occasion, chart-twin, birthday and milestone tools, and a personal weekly forecast in get_horoscope, take the dates you give for that answer only and save none of them. The assistant provider can receive tool arguments and results. Hosted calculations run on Zodiacs infrastructure. Chart Studio calculates in the browser; only explicitly reviewed selections are sent to the assistant. Hosting-layer request metadata has a separate retention policy. Links to zodiacs.org end in ?ref=chatgpt or ?ref=assistant so the site can count those visits; the page removes it as it opens.';
const PRIVACY = 'Public-sky tools and horoscopes need no birth details and save no request or result. The assistant provider can receive tool arguments and results. Hosted calculations run on Zodiacs infrastructure; the local developer server runs on its own machine. Chart Studio calculates in the browser; only explicitly reviewed selections are sent to the assistant, and downloaded records contain personal chart data. Hosting-layer request metadata has a separate retention policy. Links to zodiacs.org end in ?ref=chatgpt or ?ref=assistant so the site can count those visits; the page removes it as it opens.';
const methodLink = { title: 'How we calculate', url: `${ORIGIN}/methodology/` };
const moonLink = { title: 'Explore Moon phases', url: `${ORIGIN}/moon-phase/` };
const LIMITS = { from: EPOCH.from, to: EPOCH.to, eventWindowDays: MAX_EVENT_DAYS, eventKinds: [...EVENT_KINDS], samples: BUDGETS['events.samples'], factSamples: BUDGETS['sky-fact.samples'] };

export function displayTime(utc: string, zone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' }).format(new Date(utc));
}

function failure(tool: AiToolName, code: string, message: string, retryAfterSeconds?: number) {
  return { schema: AI_RESULT_SCHEMA, ok: false as const, tool, error: { code, message, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) } };
}

/** The tools this server actually offers with these dependencies. */
export function offeredTools(dependencies: AiDependencies): AiToolName[] {
  const released: AiToolName[] = AI_TOOL_NAMES.filter((tool) => tool !== 'get_horoscope' || !!dependencies.horoscopeWindow);
  return dependencies.occasions ? [...released, ...OCCASION_TOOL_NAMES] : released;
}

/** A computed instant as UTC and as the place's clock reads it. */
function clockTime(utc: string, zone: string | null) {
  // Built from parts: runtimes disagree on the punctuation of the joined string.
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone ?? 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(utc)).map((part) => [part.type, part.value]));
  const local = `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
  return { utc, local: zone ? local : `${local} UTC` };
}
const optionalClock = (utc: string | null, zone: string | null) => (utc ? clockTime(utc, zone) : null);

/**
 * The card page with its details after the #, as the site's own Copy link makes it. The page reads a
 * zone only with the place's coordinates, so a zone without them gets no link rather than one that
 * opens on a different card.
 */
function occasionCardUrl(args: { occasion: string; date: string; time?: string; zone?: string; latitude?: number; longitude?: number; place?: string; names?: string }): string | null {
  if (args.zone && (args.latitude === undefined || args.longitude === undefined)) return null;
  const params = new URLSearchParams({ o: args.occasion, d: args.date });
  if (args.names) params.set('n', args.names);
  if (args.time) params.set('t', args.time);
  if (args.zone && args.latitude !== undefined && args.longitude !== undefined) {
    params.set('tz', args.zone);
    params.set('lat', args.latitude.toFixed(4));
    params.set('lon', args.longitude.toFixed(4));
    if (args.place) params.set('place', args.place);
  }
  return `${ORIGIN}/occasions/#${params.toString()}`;
}

function milestoneRow(milestone: Milestone) {
  return { kind: milestone.kind, name: MILESTONE_WORDS[milestone.kind].name, index: milestone.index, age: milestone.age, first: milestone.first, last: milestone.last, passes: milestone.passes };
}
const occasionsLink = { title: 'Occasion cards on Zodiacs', url: `${ORIGIN}/occasions/` };

/** A zodiacs.org page address with ?ref= added before any #, which the page reads and then removes. */
export function refUrl(url: string, ref: 'chatgpt' | 'assistant'): string {
  if (!url.startsWith(`${ORIGIN}/`)) return url;
  const hash = url.indexOf('#');
  const [base, fragment] = hash === -1 ? [url, ''] : [url.slice(0, hash), url.slice(hash)];
  return `${base}${base.includes('?') ? '&' : '?'}ref=${ref}${fragment}`;
}
/** Every page address in a result (fields named url or ending in Url, except feeds) with its ?ref= added. */
function withRef(value: unknown, ref: 'chatgpt' | 'assistant', key = ''): unknown {
  // A calendar feed is fetched by calendar apps, not visited, so its address stays as published.
  if (typeof value === 'string') return /(^url|Url)$/u.test(key) && key !== 'feedUrl' ? refUrl(value, ref) : value;
  if (Array.isArray(value)) return value.map((item) => withRef(item, ref));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, withRef(item, ref, name)]));
  return value;
}

/** A feature's answer, or the plain message of the RangeError it refused the details with. */
async function feature<T>(run: () => Promise<T>): Promise<T | { failure: string }> {
  try { return await run(); } catch (error) {
    if (error instanceof RangeError) return { failure: error.message };
    throw error;
  }
}

/** One typed operation per call. No network, persistence or logs; the horoscope window is read through its injected loader. */
export async function executeAiTool(tool: AiToolName, input: unknown, dependencies: AiDependencies, context: AiCallContext = {}) {
  let ownedLocalTime: ReturnType<typeof createLocalTimeModule> | undefined;
  const localTime = () => dependencies.localTime ?? (ownedLocalTime ??= createLocalTimeModule());
  const resolveZone = (name: string) => localTime().canonicalZoneName(name);
  try {
    if ((OCCASION_TOOL_NAMES as readonly string[]).includes(tool) && !dependencies.occasions) return failure(tool, 'unavailable', 'This tool is not offered here.');
    const parsed = INPUT_SCHEMAS[tool].safeParse(input);
    if (!parsed.success) return failure(tool, 'invalid-request', 'Zodiacs could not use those details. Check the sign, date or time zone and try again.');
    let data: unknown;
    let links: { title: string; url: string }[] = [methodLink];
    switch (tool) {
      case 'open_chart_studio': {
        data = { title: 'Chart Studio', calculation: 'browser-local', initialChart: 'birth-details', sharing: 'user-reviewed-selection-only' };
        links = [];
        break;
      }
      case 'get_capabilities': {
        const statements = engineStatements();
        data = { name: 'Zodiacs', version: AI_VERSION, engine: BACKEND, tools: offeredTools(dependencies), limits: LIMITS, conventions: statements.conventions, coverage: statements.coverage, privacy: dependencies.occasions ? PRIVACY_WITH_BIRTH_TOOLS : PRIVACY, limitations: ['Tropical geocentric positions; supported reference span is stated in each receipt.', 'Event completeness is tested, not proven. Budget exhaustion refuses the whole search.', 'No eclipse or aspect search, birth-time rectification, reminders or account access.', dependencies.occasions ? 'Horoscopes are dated Sun-sign readings for the day before, the day of and the day after the current edition; with a birth date, get_horoscope also gives a personal forecast for the week from the person’s own chart.' : 'Horoscopes are dated Sun-sign readings for the day before, the day of and the day after the current edition; they are not personal birth-chart forecasts.', 'Current means the server instant; daily sky files are separate noon-UTC snapshots.'] };
        if (dependencies.occasions) {
          const capabilities = data as { privacy: string; limitations: string[] };
          capabilities.privacy += ' The occasion, compatibility, chart-twin and birthday tools take dates, and birth dates with an optional time, time zone, place and first names, for one or two people; they calculate from them for that call and save none of it. The result, including any card link that carries the details after its #, goes to the assistant. The famous-chart and sky-calendar tools need no personal details.';
          capabilities.limitations.push('The occasion tools give the sky on a date, rate it from 0 to 100 by astrology\'s traditional reading, can rate every day in a window of up to 92 days and name the three best, and give the dates of astrology\'s life milestones; they do not guarantee how a day will go.');
          capabilities.limitations.push('Compatibility scores two charts by astrology\'s reading of their contacts; it does not guarantee how a relationship will go. Famous charts, alone or compared with someone\'s own, cover only the people Zodiacs publishes, cast for local noon because their birth times are not on record.');
        }
        if (dependencies.skyWatch) {
          const capabilities = data as { privacy: string; limitations: string[] };
          capabilities.privacy += ' Sky Watch preview saves public-sky filters, owner, expiration and encrypted callback credentials. Stopping or expiring a watch clears its credentials; subscription metadata is retained for up to 30 days afterward. Public event records and delivery status are retained for up to 30 days. No birth details are accepted.';
          capabilities.limitations[2] = 'Sky Watch delivers selected public-sky events through verified callbacks. Delivery can be delayed or repeated; no personal predictions, eclipses, aspect search or birth-time rectification.';
        }
        break;
      }
      case 'get_sky': {
        const args = INPUT_SCHEMAS.get_sky.parse(input);
        const zone = await zoneAt(args.zone ?? 'UTC', '/zone', resolveZone);
        const instant = args.instant ?? (dependencies.now?.() ?? new Date()).toISOString();
        const calculation = computePositions(parsePositionsRequest({ instants: [instant], ...(args.bodies ? { bodies: args.bodies } : {}) }));
        const utc = calculation.result.instants[0].instant;
        const phase = moonPhase(new Date(utc));
        data = { mode: args.instant ? 'requested-instant' : 'current-instant', time: { utc, zone, display: displayTime(utc, zone) }, calculation, moonPhase: { name: phase.name, angle: phase.angle, illumination: phase.illumination }, interpretation: 'Astronomical calculations; no personal prediction is supplied.' };
        links = [moonLink, methodLink];
        break;
      }
      case 'get_upcoming_events': {
        const args = INPUT_SCHEMAS.get_upcoming_events.parse(input);
        const { zone: requestedZone, ...explicitRequest } = args;
        const now = args.from ? undefined : (dependencies.now?.() ?? new Date());
        const request = now ? { from: now.toISOString(), to: new Date(now.getTime() + 7 * 86_400_000).toISOString() } : explicitRequest;
        const zone = await zoneAt(requestedZone ?? 'UTC', '/zone', resolveZone);
        const parsedRequest = parseEventsRequest(request);
        if (parsedRequest.to.getTime() - parsedRequest.from.getTime() > MAX_EVENT_DAYS * 86_400_000) return failure(tool, 'budget-exhausted', `An event window is at most ${MAX_EVENT_DAYS} days long.`);
        if (dependencies.allowEvents) {
          const verdict = await dependencies.allowEvents();
          if (verdict !== 'allowed') return failure(tool, verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable', 'Zodiacs is busy. Try again in a minute.', verdict === 'limited' ? 60 : 300);
        }
        const calculation = computeEvents(parsedRequest);
        data = { from: calculation.result.from, to: calculation.result.to, zone, events: calculation.result.events.map(event => ({ ...event, localAt: displayTime(event.at, zone) })), calculation, completeness: calculation.receipt.search!.completeness };
        links = [{ title: 'Explore the lunar calendar', url: `${ORIGIN}/full-moon-calendar/` }, { title: 'Explore retrogrades', url: `${ORIGIN}/retrogrades/` }, methodLink];
        break;
      }
      case 'check_sky_fact': {
        const parsedArgs = INPUT_SCHEMAS.check_sky_fact.parse(input);
        // An instant already fixes the moment, so a time zone sent with it ("right now, I'm in Bangkok")
        // changes nothing; drop it rather than refuse a request an assistant naturally makes.
        const { zone: _zone, ...withoutZone } = parsedArgs;
        const args = parsedArgs.instant ? withoutZone : parsedArgs;
        const request = await parseSkyFactRequest(args, resolveZone);
        // Date-based facts also run bounded searches; count them as events at the hosted boundary.
        if (args.date && dependencies.allowEvents) {
          const verdict = await dependencies.allowEvents();
          if (verdict !== 'allowed') return failure(tool, verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable', 'Zodiacs is busy. Try again in a minute.', verdict === 'limited' ? 60 : 300);
        }
        const calculation = await computeSkyFact(request, { localTime: localTime() });
        data = { answer: calculation.result.answer, calculation, interpretation: 'The verdict checks an astronomical proposition, not an astrological prediction.' };
        break;
      }
      case 'get_horoscope': {
        if (!dependencies.horoscopeWindow) return failure(tool, 'unavailable', 'Horoscopes are not offered here.');
        const args = INPUT_SCHEMAS.get_horoscope.parse(input);
        let zone = 'UTC';
        let zoneSource: ZoneSource = 'default';
        if (args.zone) {
          try { zone = await zoneAt(args.zone, '/zone', resolveZone); zoneSource = 'request'; }
          catch { return failure(tool, 'invalid-timezone', "Zodiacs doesn't recognise that time zone. Use a name such as Europe/London or Asia/Bangkok."); }
        } else if (context.hostZone) {
          // A hint the assistant shares; an unknown name falls back to UTC rather than failing.
          try { zone = await zoneAt(context.hostZone, '/zone', resolveZone); zoneSource = 'assistant'; } catch { /* keep UTC */ }
        }
        const window = await dependencies.horoscopeWindow();
        const localDate = dateInZone(dependencies.now?.() ?? new Date(), zone);
        const request = { period: args.period ?? 'day', focus: args.focus ?? 'general', ...(args.sign ? { sign: args.sign } : {}), ...(args.date ? { date: args.date } : {}) } as const;
        data = resolveHoroscope(window, request, zone, zoneSource, localDate);
        // A personal forecast takes a birth date, so it follows the same switch as the other birth-date tools.
        if (args.birthDate && dependencies.occasions) {
          let birthZone: string | undefined;
          if (args.birthZone) {
            try { birthZone = await zoneAt(args.birthZone, '/zone', resolveZone); }
            catch { return failure(tool, 'invalid-timezone', "Zodiacs doesn't recognise that birthplace time zone. Use a name such as Europe/London."); }
          }
          try {
            (data as { personal?: unknown }).personal = await personalWeek({ birthDate: args.birthDate, ...(args.birthTime ? { birthTime: args.birthTime } : {}), ...(birthZone ? { birthZone } : {}) }, dependencies.now?.() ?? new Date(), localTime(), zone);
          } catch (error) {
            if (error instanceof RangeError) return failure(tool, 'invalid-request', error.message);
            throw error;
          }
        }
        if (args.sign) context.horoscopePanel = horoscopePanel(window, args.sign, { period: request.period, focus: request.focus, ...(args.date ? { date: args.date } : {}), ...(zoneSource === 'default' ? {} : { zone }) });
        links = [...(args.sign ? [{ title: `${args.sign[0].toUpperCase()}${args.sign.slice(1)} on Zodiacs`, url: `${ORIGIN}/horoscopes/${args.sign}/` }] : []), methodLink];
        break;
      }
      case 'get_occasion_sky': {
        const args = INPUT_SCHEMAS.get_occasion_sky.parse(input);
        const zone = args.zone ? await zoneAt(args.zone, '/zone', resolveZone) : null;
        const hasPlace = args.latitude !== undefined && args.longitude !== undefined;
        let card;
        let best: BestDays | null = null;
        let date: string;
        try {
          // With a window, every day in it is rated at the same clock time and the three best come back.
          if (args.searchFrom !== undefined && args.searchTo !== undefined) {
            best = await bestDays({
              occasion: args.occasion, from: args.searchFrom, to: args.searchTo, time: args.time ?? null, timeZone: zone,
              longitude: hasPlace ? args.longitude! : null,
            }, localTime());
          }
          // The card is for the day asked about, else for the best day found.
          date = args.date ?? best!.best[0].date;
          card = await occasionCard({
            occasion: args.occasion, date, time: args.time ?? null, timeZone: zone,
            place: hasPlace ? { name: args.place ?? '', lat: args.latitude!, lon: args.longitude! } : null,
          }, localTime());
        } catch (error) {
          if (error instanceof RangeError) return failure(tool, 'invalid-request', error.message);
          throw error;
        }
        const evening = card.evening;
        const cardUrl = occasionCardUrl({ ...args, date, ...(zone ? { zone } : {}) });
        const rating = rateOccasionDate(args.occasion, card.sky);
        const signOf = (body: string) => card.sky.bodies.find((row) => row.body === body)?.sign ?? null;
        // The share link carries the names, the day, a place name, the Sun and Moon signs and the rating; no time or coordinates.
        const shareUrl = occasionShareUrl(ORIGIN, { occasion: args.occasion, date, names: args.names ?? null, place: args.place ?? null, sun: signOf('Sun'), moon: signOf('Moon'), score: rating.score });
        data = {
          occasion: args.occasion, date, time: args.time ?? null, zone, place: args.place ?? null, names: args.names ?? null,
          card: card.words,
          instant: clockTime(card.instant, zone), instantIs: args.time ? 'given-time' : zone ? 'local-noon' : 'utc-noon',
          sky: { bodies: card.sky.bodies, moon: card.sky.moon, retrograde: card.sky.retrograde },
          moonSignChange: card.moonSignChange,
          rating,
          bestDays: best,
          evening: evening ? {
            sunrise: optionalClock(evening.sunrise, zone), sunset: optionalClock(evening.sunset, zone),
            goldenHour: evening.goldenHour ? { start: clockTime(evening.goldenHour.start, zone), end: clockTime(evening.goldenHour.end, zone) } : null,
            civilDusk: optionalClock(evening.civilDusk, zone),
            moonrise: optionalClock(evening.moon.rise, zone), moonset: optionalClock(evening.moon.set, zone),
            moonHighest: evening.moon.highest ? { at: clockTime(evening.moon.highest.at, zone), altitude: evening.moon.highest.altitude } : null,
            planetsAfterDusk: evening.planetsAfterDusk, flags: evening.flags,
          } : null,
          cardUrl,
          shareUrl,
          note: OCCASION_NOTE,
        };
        links = [...(cardUrl ? [{ title: 'Open the printable card', url: cardUrl }] : []), occasionsLink, methodLink];
        break;
      }
      case 'get_life_milestones': {
        const args = INPUT_SCHEMAS.get_life_milestones.parse(input);
        const zone = args.zone ? await zoneAt(args.zone, '/zone', resolveZone) : null;
        let card;
        try {
          card = await milestoneCard({
            birthDate: args.birthDate, time: args.time ?? null, timeZone: zone,
            birthplace: args.longitude !== undefined ? { lon: args.longitude } : null,
          }, dependencies.now?.() ?? new Date(), localTime());
        } catch (error) {
          if (error instanceof RangeError) return failure(tool, 'invalid-request', error.message);
          throw error;
        }
        data = {
          birthDate: args.birthDate, timeKnown: card.timeKnown, asOf: card.asOf,
          milestones: card.milestones.map(milestoneRow), next: card.next ? milestoneRow(card.next) : null,
          numbers: card.numbers,
          // The page's link carries the birth date only, so it reproduces an untimed answer and no other.
          cardUrl: args.time === undefined && args.zone === undefined && args.longitude === undefined
            ? `${ORIGIN}/occasions/milestones/#${new URLSearchParams({ b: args.birthDate }).toString()}`
            : null,
          note: 'Dates of computed crossings and their traditional astrological names. Without a birth time, a pass can move by about a day.',
        };
        links = [{ title: 'Life milestones on Zodiacs', url: `${ORIGIN}/occasions/milestones/` }, methodLink];
        break;
      }
      case 'get_compatibility': {
        const args = INPUT_SCHEMAS.get_compatibility.parse(input);
        // Each zone is spelt as tzdb spells it first, as the other tools do.
        const person = async (who: typeof args.a, path: string) => (who.zone ? { ...who, zone: await zoneAt(who.zone, path, resolveZone) } : who);
        const pair = { a: await person(args.a, '/a/zone'), b: await person(args.b, '/b/zone') };
        // A famous name the directory does not have is answered as get_famous_chart answers it: plainly, with no chart.
        const missing = compatibilityMissing(pair);
        if (missing) {
          data = missing;
          links = [{ title: 'Famous birth charts on Zodiacs', url: missing.directoryUrl }];
          break;
        }
        const result = await feature(() => computeCompatibility(pair, localTime()));
        if ('failure' in result) return failure(tool, 'invalid-request', result.failure);
        ({ data, links } = result);
        break;
      }
      case 'find_chart_twins': {
        const result = await feature(() => findChartTwins(INPUT_SCHEMAS.find_chart_twins.parse(input), localTime()));
        if ('failure' in result) return failure(tool, 'invalid-request', result.failure);
        ({ data, links } = result);
        break;
      }
      case 'get_famous_chart': {
        ({ data, links } = getFamousChart(INPUT_SCHEMAS.get_famous_chart.parse(input)));
        break;
      }
      case 'get_birthday': {
        const result = await feature(() => getBirthday(INPUT_SCHEMAS.get_birthday.parse(input), localTime(), dependencies.now?.() ?? new Date()));
        if ('failure' in result) return failure(tool, 'invalid-request', result.failure);
        ({ data, links } = result);
        break;
      }
      case 'get_sky_calendar': {
        ({ data, links } = getSkyCalendar(INPUT_SCHEMAS.get_sky_calendar.parse(input), dependencies.now?.() ?? new Date()));
        break;
      }
    }
    if (context.ref) {
      data = withRef(data, context.ref);
      links = links.map((link) => ({ ...link, url: refUrl(link.url, context.ref!) }));
    }
    const result = { schema: AI_RESULT_SCHEMA, ok: true as const, tool, data, links };
    // Validate our own output so callers never receive a success outside its contract.
    return OUTPUT_SCHEMAS[tool].parse(result);
  } catch (error) {
    if (error instanceof ComputeApiError) return failure(tool, error.detail.code, error.detail.message, error.detail.retryAfterSeconds);
    return failure(tool, 'calculation-failed', 'Zodiacs could not complete this. Nothing partial is returned; try again.');
  } finally { ownedLocalTime?.dispose(); }
}
