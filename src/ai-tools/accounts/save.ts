import { createHash } from 'node:crypto';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { zoneAt } from '../../lib/compute-api/validate';
import { ComputeApiError } from '../../lib/compute-api/errors';
import type { LocalTimeModule } from '../../lib/compute-api/local-time';
import { SIGNS } from '../../lib/signs';
import { AI_RESULT_SCHEMA, ORIGIN } from '../contracts';
import { executeAiTool, refUrl } from '../tools';
import { compatibilityMissing, computePersonChart, type CompatibilityData } from '../features/compatibility';
import { personalWeek } from '../features/personal-week';
import { dateInZone } from '../horoscope/reading';
import { encodeChartLink } from '../../lib/share';
import {
  MAX_SAVED_RECORD_BYTES, MAX_SAVED_STRING, PLAIN_TEXT, PROFILE_URL, SAVE_NOTE, SAVE_OUTPUT_SCHEMA, SAVE_TOOL_NAME,
  SAVED_RECORD_SCHEMA, saveInput, type SaveInput, type SaveKind, type SaveResult,
} from './contracts';

/** What is stored for one saved item: only what a Zodiacs tool worked out, as plain text. */
export interface SavedRecord {
  schema: typeof SAVED_RECORD_SCHEMA;
  kind: SaveKind;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  links: { title: string; url: string }[];
  /**
   * The same-site link the profile lists it as (public.saved_pages.href): the
   * page that reopens it where one exists, with the result's digest after the #
   * where the page cannot carry the details. Not part of the digest.
   */
  href: string;
}

/** saved_pages' kinds and where each may link, as its check constraint has them. */
export const PAGE_KINDS = { chart: 'chart', comparison: 'compatibility', occasion: 'occasion', week: 'week' } as const;
const PAGE_PATHS: Record<SaveKind, RegExp> = {
  chart: /^\/(?:birth-chart|people)\//u, comparison: /^\/(?:[a-z]{2}\/)?compatibility\//u, occasion: /^\/occasions\//u, week: /^\/horoscopes\//u,
};
const sitePath = (url: string) => (url.startsWith(`${ORIGIN}/`) ? url.slice(ORIGIN.length) : url);

/** The signed-in person a save belongs to, as the live authorization check returned it. */
export interface AccountPrincipal { user: string; session: string; client: string }

/** The database's answer to one save. */
export interface StoredSave { id: string; saved_at: string; created: boolean }
export type SaveStore = (principal: AccountPrincipal, record: SavedRecord) => Promise<StoredSave | 'full' | null>;

export interface SaveDependencies { localTime?: LocalTimeModule; now?: () => Date }

const signName = (slug: string | null | undefined) => (slug ? SIGNS.find((sign) => sign.slug === slug)?.name ?? null : null);
const OCCASION_NAMES: Record<string, string> = {
  wedding: 'Wedding', anniversary: 'Anniversary', met: 'The day you met', birthday: 'Birthday', baby: 'A baby’s arrival', pet: 'A new pet',
  home: 'A new home', job: 'A new job', graduation: 'Graduation', retirement: 'Retirement', 'coming-of-age': 'Coming of age', gathering: 'A gathering',
};

function chartLine(row: CompatibilityData['a']): string {
  const parts = [signName(row.sun) && `Sun in ${signName(row.sun)}`, signName(row.moon) && `Moon in ${signName(row.moon)}`, signName(row.rising) && `${signName(row.rising)} rising`].filter(Boolean);
  return parts.length ? parts.join(', ') : 'The Sun changed sign that day, so the sign depends on the birth time.';
}

/**
 * Every string is plain text of bounded length, every page link is a
 * zodiacs.org page, and the whole record fits the stored bound. The tools
 * already produce such records; this refuses anything that is not.
 */
export function recordProblem(record: SavedRecord): string | null {
  let problem: string | null = null;
  const walk = (value: unknown, key: string): void => {
    if (problem) return;
    if (typeof value === 'string') {
      if (value.length > MAX_SAVED_STRING) problem = 'too-long';
      else if (value.length && !PLAIN_TEXT.test(value) && !/(^url|Url)$/u.test(key)) problem = 'not-plain-text';
      else if (/(^url|Url)$/u.test(key) && !value.startsWith(`${ORIGIN}/`)) problem = 'foreign-link';
    } else if (Array.isArray(value)) value.forEach((item) => walk(item, key));
    else if (value && typeof value === 'object') for (const [name, item] of Object.entries(value)) walk(item, name);
    else if (!(value === null || typeof value === 'number' || typeof value === 'boolean')) problem = 'unsupported-value';
  };
  const { href, ...stored } = record;
  walk(stored, '');
  if (!problem && (href.length > 2048 || !PAGE_PATHS[record.kind].test(href) || href.startsWith('//') || /[\s\p{Cc}\\]/u.test(href))) problem = 'bad-link';
  if (!problem && Buffer.byteLength(JSON.stringify(record)) > MAX_SAVED_RECORD_BYTES) problem = 'too-large';
  return problem;
}

/** The same item saved again is the same row: the digest covers what was worked out, not the label. */
export function recordDigest(record: Omit<SavedRecord, 'href'>): string {
  return createHash('sha256').update(JSON.stringify([record.schema, record.kind, record.data])).digest('hex');
}

/**
 * Works the result out again with the tool that produced it, and keeps the
 * parts worth keeping. Nothing the assistant writes is stored except the
 * optional plain-text label. Returns a plain refusal for details the tool
 * itself would refuse.
 */
export async function buildSavedRecord(input: SaveInput, dependencies: SaveDependencies = {}): Promise<SavedRecord | { failure: string }> {
  // The link carries the result's digest after the # where the page cannot carry its details.
  const linked = (record: Omit<SavedRecord, 'href'>, href: (saved: string) => string): SavedRecord => ({ ...record, href: href(recordDigest(record).slice(0, 16)) });
  let owned: ReturnType<typeof createLocalTimeModule> | undefined;
  const localTime = () => dependencies.localTime ?? (owned ??= createLocalTimeModule());
  const now = dependencies.now?.() ?? new Date();
  const tools = { occasions: true, localTime: localTime(), now: () => now };
  const label = input.label;
  try {
    switch (input.kind) {
      case 'chart': {
        const person = input.chart!;
        if (person.famous !== undefined && compatibilityMissing({ a: person, b: person })) return { failure: 'Zodiacs has no chart for that name in its famous-people directory.' };
        const zone = person.zone ? await zoneAt(person.zone, '/chart/zone', (name) => localTime().canonicalZoneName(name)) : undefined;
        const row = await computePersonChart(zone ? { ...person, zone } : person, localTime());
        const chartLink = !row.famous && zone && person.latitude !== undefined && person.longitude !== undefined
          ? `/birth-chart/#c=${encodeChartLink({ date: row.birthDate, time: person.time ?? null, timeKnown: person.time !== undefined, lat: person.latitude, lon: person.longitude, tz: zone,
            ...(person.name ? { name: person.name } : {}), ...(person.place ? { place: person.place } : {}), houseSystem: 'whole' })}`
          : null;
        return linked({
          schema: SAVED_RECORD_SCHEMA, kind: 'chart',
          title: label ?? (row.famous ? `${row.name}'s chart` : row.name ? `${row.name}'s birth chart` : `Birth chart, ${row.birthDate}`),
          summary: chartLine(row),
          data: { ...row, ...(person.time && !row.famous ? { time: person.time } : {}), ...(zone && !row.famous ? { zone } : {}) },
          links: row.url ? [{ title: `${row.name}'s chart on Zodiacs`, url: row.url }] : [{ title: 'Your birth chart on Zodiacs', url: `${ORIGIN}/birth-chart/` }],
        }, (saved) => (row.url ? sitePath(row.url) : chartLink ?? `/birth-chart/#saved=${saved}`));
      }
      case 'comparison': {
        const result = await executeAiTool('get_compatibility', input.comparison, tools);
        if (!result.ok) return { failure: result.error.message };
        if (result.tool !== 'get_compatibility' || 'found' in result.data) return { failure: 'Zodiacs has no chart for that name in its famous-people directory.' };
        const data = result.data;
        return linked({
          schema: SAVED_RECORD_SCHEMA, kind: 'comparison',
          title: label ?? `${data.a.label} and ${data.b.label}: ${data.score.overall} out of 100`,
          summary: `${data.score.verdict}. ${data.score.headline}`,
          data: { a: data.a, b: data.b, score: data.score, signPair: data.signPair?.slug ?? null, contacts: data.contacts.map((contact) => contact.line),
            pageUrl: data.pageUrl, cardUrl: data.cardUrl, notes: data.notes, note: data.note },
          links: [...(data.cardUrl ? [{ title: 'Open the comparison', url: data.cardUrl }] : []), ...(data.pageUrl ? [{ title: 'The sign pair on Zodiacs', url: data.pageUrl }] : [])],
        }, (saved) => (data.cardUrl ? sitePath(data.cardUrl) : `${data.pageUrl ? sitePath(data.pageUrl) : '/compatibility/'}#saved=${saved}`));
      }
      case 'occasion': {
        const result = await executeAiTool('get_occasion_sky', input.occasion, tools);
        if (!result.ok) return { failure: result.error.message };
        if (result.tool !== 'get_occasion_sky') return { failure: 'Zodiacs could not work that out again.' };
        const data = result.data;
        const sign = (body: string) => data.sky.bodies.find((row) => row.body === body)?.sign ?? null;
        // Without coordinates the card page cannot take the zone, so the link reopens the day's card as the page draws it.
        const fallback = new URLSearchParams({ o: data.occasion, d: data.date, ...(data.names ? { n: data.names } : {}) });
        return linked({
          schema: SAVED_RECORD_SCHEMA, kind: 'occasion',
          title: label ?? `${OCCASION_NAMES[data.occasion] ?? 'Occasion'}, ${data.date}: ${data.rating.score} out of 100`,
          summary: `${data.rating.verdict}. ${data.card.title}`,
          data: { occasion: data.occasion, date: data.date, time: data.time, zone: data.zone, place: data.place, names: data.names, card: data.card,
            rating: data.rating, sky: { sun: sign('Sun'), moon: sign('Moon'), moonPhase: data.sky.moon.phase, retrograde: data.sky.retrograde },
            bestDays: data.bestDays ? { from: data.bestDays.from, to: data.bestDays.to, best: data.bestDays.best.map(({ date, score, verdict }) => ({ date, score, verdict })) } : null,
            cardUrl: data.cardUrl, note: data.note },
          links: data.cardUrl ? [{ title: 'Open the printable card', url: data.cardUrl }] : [{ title: 'Occasion cards on Zodiacs', url: `${ORIGIN}/occasions/` }],
        }, () => (data.cardUrl ? sitePath(data.cardUrl) : `/occasions/#${fallback.toString()}`));
      }
      case 'week': {
        const args = input.week!;
        const resolve = (name: string) => localTime().canonicalZoneName(name);
        const zone = args.zone ? await zoneAt(args.zone, '/week/zone', resolve) : 'UTC';
        const birthZone = args.birthZone ? await zoneAt(args.birthZone, '/week/birthZone', resolve) : undefined;
        const week = await personalWeek({ birthDate: args.birthDate, ...(args.birthTime ? { birthTime: args.birthTime } : {}), ...(birthZone ? { birthZone } : {}) }, now, localTime(), zone);
        const from = dateInZone(now, zone);
        return linked({
          schema: SAVED_RECORD_SCHEMA, kind: 'week',
          title: label ?? `Your week from ${from}`,
          summary: week.items[0] ? `${week.items[0].title}. ${week.items[0].when}` : 'No close contacts to your chart this week.',
          data: { from, zone, birthDate: args.birthDate, timeKnown: week.timeKnown, items: week.items, note: week.note },
          links: [{ title: 'Horoscopes on Zodiacs', url: `${ORIGIN}/horoscopes/` }],
        }, (saved) => `/horoscopes/#week=${from}&saved=${saved}`);
      }
    }
    return { failure: 'Zodiacs cannot save that kind of result.' };
  } catch (error) {
    if (error instanceof RangeError) return { failure: error.message };
    // A zone the resolver does not know is refused as the tools refuse it.
    if (error instanceof ComputeApiError) return { failure: "Zodiacs doesn't recognise that time zone. Use a name such as Europe/London." };
    throw error;
  } finally { owned?.dispose(); }
}

function failure(code: string, message: string): SaveResult {
  return { schema: AI_RESULT_SCHEMA, ok: false, tool: SAVE_TOOL_NAME, error: { code, message } };
}

/** One save for one signed-in person. Never logs the request or the record. */
export async function saveToZodiacs(raw: unknown, principal: AccountPrincipal, store: SaveStore, dependencies: SaveDependencies = {}, ref?: 'chatgpt' | 'assistant'): Promise<SaveResult> {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success) return failure('invalid-request', 'Zodiacs could not use those details. Pass kind and exactly the arguments the earlier tool was given.');
  let record: SavedRecord | { failure: string };
  try { record = await buildSavedRecord(parsed.data, dependencies); }
  catch { return failure('calculation-failed', 'Zodiacs could not work that out again. Nothing was saved; try again.'); }
  if ('failure' in record) return failure('invalid-request', record.failure);
  if (recordProblem(record)) return failure('invalid-request', 'Zodiacs can save only plain-text results it worked out, up to 8 KB. Nothing was saved.');
  let stored: StoredSave | 'full' | null;
  try { stored = await store(principal, record); }
  catch { return failure('save-unavailable', 'Your Zodiacs account could not be reached. Nothing was saved; try again in a minute.'); }
  if (stored === 'full') return failure('account-full', 'Your Zodiacs account already holds the most saved items it can. Delete some on your profile, then try again.');
  if (!stored) return failure('authentication-required', 'Sign in to your Zodiacs account again to save this.');
  const profileUrl = ref ? refUrl(PROFILE_URL, ref) : PROFILE_URL;
  return SAVE_OUTPUT_SCHEMA.parse({
    schema: AI_RESULT_SCHEMA, ok: true, tool: SAVE_TOOL_NAME,
    data: { saved: true, id: stored.id, kind: record.kind, title: record.title, summary: record.summary, savedAt: stored.saved_at,
      alreadySaved: !stored.created, profileUrl, note: SAVE_NOTE },
    links: [{ title: 'Your Zodiacs profile', url: profileUrl }],
  });
}
