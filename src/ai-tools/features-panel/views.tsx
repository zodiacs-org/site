/**
 * Branded inline cards for the seven Zodiacs feature funnels (eight tools:
 * astrocartography, Vedic signs, Year Ahead Score, solar return, good days,
 * retrogrades for you, Your Day, and Pythagorean numerology).
 *
 * Every card uses the shared Cosmic Void card kit (../card-kit/parts) and
 * carries the Zodiacs · org nameplate. No birth date, birth time, birthplace,
 * or full name is ever shown on a card or copied from one. Primary links keep
 * the ?ref=chatgpt / ?ref=assistant tag the server already added. Numerology
 * always states it is separate from astrology and never shows a reading
 * confidence label.
 */
import type { CSSProperties } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  Actions, artOf, Card, Chips, Data, Facts, FinePrint, Fold, Head, Hero, Keepsake, More, NumberRing, ScoreRing, Section, SignDisc, Tiles, type Action, type Fact,
} from '../card-kit/parts';
import { hueOf } from '../card-kit/hue';
import { capital, dateRange, list, longDate, plain, signName } from '../card-kit/words';
import { clockTime } from '../../lib/personal-day/clock';
import { GOAL_RULES } from '../../lib/good-days/goals';
import { rangeWorthShowing } from '../../lib/year-score/range';
import { readingConfidenceLabel, readingDetail } from '../reading-confidence';
import type { AstrocartographyData } from '../personal/astrocartography';
import type { VedicSignsData } from '../personal/vedic-signs';
import type { YearScoreData } from '../features/year-score';
import type { SolarReturnData } from '../features/solar-return';
import type { GoodDaysData } from '../features/good-days';
import type { RetrogradeForMeData } from '../personal/retrograde-for-me';
import type { PersonalDayData } from '../personal/personal-day';
import type { NumerologyData } from '../features/numerology';
import './style.css';

export interface ToolLink { title: string; url: string }

declare const FEATURES_ICONS: Record<string, string>;
const icon = (slug: string | null | undefined) => (slug ? FEATURES_ICONS[slug] : undefined);
const holds = (parts: (string | false | null | undefined | '')[]) => capital(list(parts.filter((part): part is string => !!part)));

function linkMatching(links: readonly ToolLink[], fragment: string): ToolLink | undefined {
  return links.find((item) => item.url.includes(fragment));
}

function firstAction(primaryUrl: string | null | undefined, primaryLabel: string, links: readonly ToolLink[], fallbackLabel?: string): Action | null {
  if (primaryUrl) return { label: primaryLabel, href: primaryUrl };
  const fallback = links[0];
  return fallback ? { label: fallbackLabel ?? fallback.title, href: fallback.url } : null;
}

/** DESIGN.md: a card with a share link leads with it as the primary action, with the page link as secondary; otherwise the page link leads. */
function cardActions(share: Action | null, page: Action | null): { primary: Action | null; secondary: Action | false } {
  return share
    ? { primary: share, secondary: page ?? false }
    : { primary: page, secondary: false };
}

/** Writes plain text via the Clipboard API; returns false when the host denies or omits clipboard access. */
export async function tryClipboardWrite(text: string, clipboard: { writeText?: (value: string) => Promise<void> } | undefined = typeof navigator !== 'undefined' ? navigator.clipboard : undefined): Promise<boolean> {
  if (!clipboard?.writeText) return false;
  try { await clipboard.writeText(text); return true; } catch { return false; }
}

/**
 * Copy action for feature cards: writes to the clipboard when allowed, and reveals a selectable read-only text box
 * holding the exact copy text whenever a sandboxed host denies clipboard access. Resets immediately when `text`
 * changes and ignores clipboard completions from earlier readings.
 */
export function FeatureCopyCard({ text, label = 'Copy the reading' }: { text: string; label?: string }) {
  const [state, setState] = useState<{ revision: number; status: string; showFallback: boolean }>({ revision: 0, status: '', showFallback: false });
  const activeRef = useRef({ text, revision: 0, attempt: 0 });
  if (activeRef.current.text !== text) {
    activeRef.current = { text, revision: activeRef.current.revision + 1, attempt: activeRef.current.attempt + 1 };
  }
  const revision = activeRef.current.revision;
  useEffect(() => {
    setState((prev) => (prev.revision === revision ? prev : { revision, status: '', showFallback: false }));
  }, [revision]);
  const current = state.revision === revision ? state : { revision, status: '', showFallback: false };
  async function copy() {
    const attempt = ++activeRef.current.attempt;
    const targetRevision = revision;
    const targetText = text;
    const ok = await tryClipboardWrite(targetText);
    if (activeRef.current.attempt !== attempt || activeRef.current.revision !== targetRevision) return;
    setState(ok
      ? { revision: targetRevision, status: 'Copied.', showFallback: false }
      : { revision: targetRevision, status: 'Copying is not allowed here. Select the text below to copy it.', showFallback: true });
  }
  return <div class="copy-block">
    <button type="button" class="copy" onClick={copy}>{label}</button>
    <p role="status" class="status">{current.status}</p>
    {current.showFallback && (
      <textarea
        class="copy-fallback"
        readOnly
        rows={Math.min(10, Math.max(3, text.split('\n').length))}
        value={text}
        aria-label="Reading text to copy"
        onFocus={(event) => (event.currentTarget as HTMLTextAreaElement).select()}
        onClick={(event) => (event.currentTarget as HTMLTextAreaElement).select()}
      />
    )}
  </div>;
}

/** A link as plain text for copied cards: strips scheme, ?ref= query, fragment, and trailing slash. */
function bareUrl(url: string | null | undefined): string {
  return url ? url.replace(/^https?:\/\//u, '').replace(/[?#].*$/u, '').replace(/\/$/u, '') : '';
}

/**
 * Normalizes punctuation (via plain()) and replaces money/health phrasing from shared site/tool copy with
 * card-safe wording (DESIGN.md: assistant cards carry nothing about money or health, while tool responses stay unchanged).
 */
export function cardWords(text: string): string {
  return plain(text)
    .replace(/\bshared money,\s*trust and/giu, 'shared commitments, trust and')
    .replace(/\bshared money,\s*inheritance in the broad sense/giu, 'shared commitments, deep ties')
    .replace(/\bmoney,\s*possessions and/giu, 'resources, possessions and')
    .replace(/\bmoney,\s*skills,/giu, 'craft, skills,')
    .replace(/\bhas to earn its applause\b/giu, 'has to prove its worth')
    .replace(/\bhealth,\s*systems,\s*the backlog/giu, 'daily routines, systems, the backlog')
    .replace(/\bpay this year's best dividends\b/giu, "bring this year's steadier results")
    .replace(/\bthis one profits from margin\b/giu, 'this one benefits from margin')
    .replace(/\bA working year:\s*routines,\s*health,\s*the craft of the everyday\.\s*The body keeps this year['’]s minutes;\s*read them\./giu, 'A working year: routines, daily work, and the craft of the everyday. Small habits carry the year forward.')
    .replace(/\broutines,\s*health,\s*the craft\b/giu, 'routines, daily work, the craft')
    .replace(/\bhealthier systems\b/giu, 'steadier systems')
    .replace(/\brelationships,\s*money and what you find beautiful\b/giu, 'relationships, priorities and what you find beautiful')
    .replace(/\bwhat you spend on and why\b/giu, 'where your effort goes and why')
    .replace(/\bwhat you spend on it\b/giu, 'what you put into it')
    .replace(/\bearning,\s*owning,\s*and what security is made of\b/giu, 'resources, ownership, and what stability is made of')
    .replace(/\bWork,\s*order,\s*health,/giu, 'Work, order, wellbeing,')
    .replace(/,\s*and a good window to settle pay and terms\b/giu, '')
    .replace(/\bfor first sales and announcements\b/giu, 'for first openings and announcements')
    .replace(/\bthe Ashvins,\s*the divine physicians\b/giu, 'the Ashvins, the swift twin horsemen')
    .replace(/\btraditionally linked with healing and with help that arrives fast\b/giu, 'traditionally linked with renewal and with help that arrives fast')
    .replace(/\bthe star of healers and researchers\b/giu, 'the star of quiet observers and researchers')
    .replace(/\bcreative,\s*healing or spiritual work\b/giu, 'creative, supportive or spiritual work')
    .replace(/\bwriting,\s*teaching,\s*media,\s*trade and\b/giu, 'writing, teaching, media, exchange and')
    .replace(/\btrading ideas\b/giu, 'exchanging ideas')
    .replace(/\bshared money\b/giu, 'shared resources')
    .replace(/\bmoney\b/giu, 'resources')
    .replace(/\bhealth\b/giu, 'wellbeing')
    .replace(/\bhealing\b/giu, 'restorative')
    .replace(/\bhealers?\b/giu, 'helpers')
    .replace(/\bphysicians?\b/giu, 'guides');
}

const UTC_ZONE_RE = /^(?:etc\/)?(?:utc|uct|gmt|gmt0|gmt[+-]0|greenwich|universal|zulu)$/iu;
const ETC_GMT_RE = /^etc\/gmt([+-])(\d{1,2})$/iu;
const NON_CITY_ZONE_RE = /^(?:US|Canada|Brazil|Mexico|Chile|Etc)\//u;
const ZONE_ALIAS_LABELS: Record<string, string> = {
  EST5EDT: 'Eastern Time',
  CST6CDT: 'Central Time',
  MST7MDT: 'Mountain Time',
  PST8PDT: 'Pacific Time',
  EST: 'Eastern Standard Time',
  MST: 'Mountain Standard Time',
  HST: 'Hawaii Standard Time',
  CET: 'Central European Time',
  EET: 'Eastern European Time',
  MET: 'Central European Time',
  WET: 'Western European Time',
};

/**
 * Turns a tzdb zone name into plain card copy without raw zone IDs: UTC aliases become "UTC", POSIX-inverted
 * Etc/GMT±N zones show their actual UTC offset (Etc/GMT+5 -> "UTC-05:00"), legacy/POSIX aliases (EST5EDT,
 * PST8PDT, US/Eastern, Australia/NSW) resolve to readable names, and city zones show "<City> time".
 */
export function clockLabelFor(zone: string): string {
  if (UTC_ZONE_RE.test(zone)) return 'UTC';
  const etcGmt = ETC_GMT_RE.exec(zone);
  if (etcGmt) {
    const hours = Number(etcGmt[2]);
    if (hours === 0) return 'UTC';
    const sign = etcGmt[1] === '+' ? '-' : '+';
    return `UTC${sign}${String(hours).padStart(2, '0')}:00`;
  }
  const alias = ZONE_ALIAS_LABELS[zone.toUpperCase()];
  const tail = zone.split('/').pop() ?? '';
  const isAliasOrRegion = !zone.includes('/') || NON_CITY_ZONE_RE.test(zone) || /^[A-Z0-9-]+$/u.test(tail);
  if (isAliasOrRegion) {
    try {
      const generic = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longGeneric' })
        .formatToParts(new Date('2026-01-15T12:00:00Z'))
        .find((part) => part.type === 'timeZoneName')?.value;
      if (generic) {
        if (/^GMT([+-]\d{2}:\d{2})?$/u.test(generic)) return alias ?? (generic === 'GMT' || generic === 'GMT+00:00' ? 'UTC' : generic.replace(/^GMT/u, 'UTC'));
        return generic;
      }
    } catch { /* fall back to explicit alias map or generic local time */ }
    return alias ?? 'local time';
  }
  const city = tail.replace(/_/gu, ' ');
  return city ? `${city} time` : 'local time';
}

/** True when a tool limit discloses that the display clock fell back to the birthplace's IANA time zone. */
const isBirthClockLimit = (line: string) => /on the birthplace clock\b/iu.test(line);

/** Keeps local times intact, labels fallback times as the birthplace clock, and avoids raw IANA zone IDs on cards. */
function cardClock(zone: string, limits: readonly string[]) {
  const fromBirth = limits.some(isBirthClockLimit);
  return {
    zoneLabel: fromBirth ? 'birthplace clock' : clockLabelFor(zone),
    limits: fromBirth
      ? limits.map((line) => (isBirthClockLimit(line) ? line.replace(/\s*\([^)]+\)/u, '') : line))
      : limits,
  };
}

/** Returns the UTC offset (e.g. "UTC-5") when `utc` falls inside a repeated DST rollback hour on `timeZone`, else null. */
export function repeatedClockOffset(utc: string, timeZone: string): string | null {
  try {
    const formatted = clockTime(new Date(utc), timeZone);
    return /\((UTC[^)]+)\)$/u.exec(formatted)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Formats a next-retrograde date range on the requested clock, explicitly labeling UTC when the browser lacks the zone. */
export function zoneRangeLabel(startUtc: string, endUtc: string, timeZone: string): string {
  const format = (utc: string, zone: string) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
        .formatToParts(new Date(utc))
        .map((part) => [part.type, part.value]),
    );
    return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
  };
  try {
    return `${format(startUtc, timeZone)} to ${format(endUtc, timeZone)}`;
  } catch {
    return `${format(startUtc, 'UTC')} to ${format(endUtc, 'UTC')} (UTC)`;
  }
}

// ── 1. Astrocartography ──────────────────────────────────────────────

const KEY_ACG_PLANETS = new Set(['Sun', 'Moon', 'Venus', 'Mars', 'Jupiter', 'Saturn']);
const SHOWN_ACG_LINES = 4;
const lonText = (lon: number) => `${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? 'E' : 'W'}`;
const renderAcgLine = (line: AstrocartographyData['cities'][number]['closest'][number]) => <li key={`${line.planet}-${line.angle}`}>
  <strong>{line.title}</strong>, <Data>{line.distanceKm} km</Data>{line.side ? ` ${line.side}` : ''} ({line.strength})
  <span class="reading-sub">{cardWords(line.line)}</span>
</li>;

export function AstrocartographyCard({ data, links = [] }: { data: AstrocartographyData; links?: readonly ToolLink[] }) {
  const firstCity = data.cities[0];
  const topLine = firstCity?.closest[0];
  const unresolved = [...data.ambiguous, ...data.didYouMean];
  const title = data.cities.length === 1
    ? firstCity.name
    : data.cities.length > 1
      ? `${data.cities.length} places checked`
      : unresolved.length > 0
        ? 'Choose a place'
        : 'Your planetary lines';
  const verdict = topLine
    ? `${topLine.title} (${topLine.distanceKm} km)`
    : unresolved.length > 0
      ? 'Pick a matching place'
      : data.unmatched.length > 0
        ? 'Place not found'
        : '40 planetary lines mapped';
  const summary = firstCity
    ? cardWords(firstCity.summary)
    : data.ambiguous.length > 0
      ? 'Several places share that name. Tell the assistant which one below you meant.'
      : data.didYouMean.length > 0
        ? 'No place matched that region. Tell the assistant if you meant one of the places below.'
        : data.unmatched.length > 0
          ? data.unmatched.length === 1
            ? 'That place was not found in the place index. Try a nearby city or include the country.'
            : `${data.unmatched.length} requested places were not found in the place index. Try nearby cities or include the country.`
          : data.pageUrl
            ? 'Explore all forty rising, setting, Midheaven and IC lines on an interactive world map at zodiacs.org.'
            : 'All forty rising, setting, Midheaven and IC lines for the moment of birth. Name any city to see which lines pass nearest to it.';
  const keyLines = data.lines.filter((row) => KEY_ACG_PLANETS.has(row.planet));
  const cardLimits = data.limits.filter((line) =>
    !line.startsWith('More than one town or city matches ')
    && !line.startsWith('No town or city in the index matches ')
    && !line.startsWith('Some names matched no town or city '));
  const shareUrl = topLine?.shareUrl ?? null;
  const pageAction = firstAction(data.pageUrl, 'Open interactive world map', links, 'Open birth chart on Zodiacs');
  const actions = cardActions(shareUrl ? { label: 'Share this line', href: shareUrl } : null, pageAction);
  const copyText = [
    'Astrocartography on Zodiacs',
    data.confidenceLabel,
    ...data.cities.flatMap((city) => [
      `${city.name}: ${cardWords(city.summary)}`,
      ...city.closest.map((line) => `  ${line.title}, ${line.distanceKm} km${line.side ? ` ${line.side}` : ''} (${line.strength}): ${cardWords(line.line)}`),
    ]),
    ...unresolved.map((entry) => `Places to clarify: ${entry.places.map((place) => place.label).join('; ')}`),
    ...(data.unmatched.length ? [data.unmatched.length === 1 ? 'One requested place was not found in the place index.' : `${data.unmatched.length} requested places were not found in the place index.`] : []),
    ...(!data.cities.length && !unresolved.length && !data.unmatched.length ? [summary] : []),
    ...cardLimits.map(cardWords),
    bareUrl(pageAction?.href),
  ].filter(Boolean).join('\n');

  return <Card hue={null}>
    <Keepsake
      kicker="Astrocartography"
      title={title}
      art={[{ src: artOf('milestones-hero') }]}
      meta={<strong>{data.confidenceLabel}</strong>}
    />
    <Hero verdict={verdict} summary={summary}/>
    {unresolved.length > 0 && <Section title="Places to clarify">
      <ul class="reading-list">
        {unresolved.map((entry, index) => <li key={`${index}-${entry.places.map((place) => place.label).join('|')}`}>
          {entry.places.map((place) => place.label).join('; ')}
        </li>)}
      </ul>
    </Section>}
    {data.unmatched.length > 0 && (data.cities.length > 0 || unresolved.length > 0) && (
      <p class="quiet">{data.unmatched.length === 1 ? 'One requested place was not found in the place index. Try a nearby city or include the country.' : `${data.unmatched.length} requested places were not found in the place index. Try nearby cities or include the country.`}</p>
    )}
    <Fold hint={holds([data.cities.length > 0 && 'closest lines by city', 'key planetary lines', cardLimits.length > 0 && 'notes', 'a copy of the card'])}>
      {data.cities.map((city) => {
        const extra = city.closest.slice(SHOWN_ACG_LINES);
        return <Section key={city.id} title={`${city.name}${city.country ? `, ${city.country}` : ''}`}>
          <ul class="reading-list">{city.closest.slice(0, SHOWN_ACG_LINES).map(renderAcgLine)}</ul>
          {extra.length > 0 && <More label={`${extra.length} more ${extra.length === 1 ? 'line' : 'lines'}`}>
            <ul class="reading-list">{extra.map(renderAcgLine)}</ul>
          </More>}
        </Section>;
      })}
      {keyLines.length > 0 && <Section title="Midheaven and IC longitudes">
        <p class="quiet">These longitudes can be used to work out your birth date and time. To share, use a single line&apos;s card instead.</p>
        <Facts rows={keyLines.map((row) => [row.planet, <><Data>MC {lonText(row.mcLongitude)}</Data>, <Data>IC {lonText(row.icLongitude)}</Data></>] as Fact)}/>
      </Section>}
      {cardLimits.map((line) => <p class="quiet" key={line}>{cardWords(line)}</p>)}
      <FeatureCopyCard text={copyText} label="Copy the reading"/>
    </Fold>
    <Actions primary={actions.primary} secondary={actions.secondary}/>
    <FinePrint>{data.pageUrl
      ? 'Planetary map lines at the moment of birth. Open the interactive world map at zodiacs.org.'
      : 'Planetary map lines at the moment of birth.'}</FinePrint>
  </Card>;
}

// ── 2. Vedic Signs ───────────────────────────────────────────────────

function boundaryPairFrom(limits: readonly string[], prefix: string): [string, string] | null {
  const match = limits.find((line) => line.startsWith(prefix))?.match(/between (.+) and (.+), so /u);
  return match ? [match[1], match[2]] : null;
}

function qualifyVedicLine(
  line: string,
  kind: 'moon' | 'nakshatra' | 'sun' | 'rising',
  pair: [string, string] | null,
  risingFlip: boolean,
): string {
  if (/^Provisional\b/u.test(line)) return line;
  const pairText = pair ? `${pair[0]} or ${pair[1]}` : null;
  const lead = kind === 'nakshatra'
    ? (pairText ? `Provisional, on the ${pairText} boundary: this calculation places the Moon in ` : 'Provisional, on a nakshatra boundary: this calculation places the Moon in ')
    : kind === 'moon'
      ? (pairText ? `Provisional, on the ${pairText} boundary: this calculation places the Moon sign (rashi) in ` : 'Provisional, on a sign boundary: this calculation places the Moon sign (rashi) in ')
      : kind === 'sun'
        ? (pairText ? `Provisional, on the ${pairText} boundary: this calculation places the Vedic Sun in ` : 'Provisional, on a sign boundary: this calculation places the Vedic Sun in ')
        : risingFlip
          ? 'Provisional, time-sensitive at this latitude: this calculation places the lagna (rising sign) in '
          : pairText
            ? `Provisional, on the ${pairText} boundary: this calculation places the lagna (rising sign) in `
            : 'Provisional, on a sign boundary: this calculation places the lagna (rising sign) in ';
  const replaced = line
    .replace(/^Your Moon was in /u, lead)
    .replace(/^Your Moon sign \(rashi\) is /u, lead)
    .replace(/^Your Vedic Sun is in /u, lead)
    .replace(/^Your lagna \(rising sign\) is /u, lead);
  return replaced === line ? `Provisional: ${line}` : replaced;
}

export function VedicSignsCard({ data, links = [] }: { data: VedicSignsData; links?: readonly ToolLink[] }) {
  const settledSun = data.sun && !data.sun.cusp ? data.sun.sign : null;
  const settledMoon = data.moon && !data.moon.cusp ? data.moon.sign : null;
  const leadSign = settledMoon ?? settledSun ?? null;
  const title = data.moon && !data.moon.cusp
    ? `${data.moon.rashi} Moon`
    : data.sun && !data.sun.cusp
      ? `${data.sun.rashi} Sun`
      : 'Sidereal signs';
  const nakPair = data.moonNakshatra?.cusp ? boundaryPairFrom(data.limits, 'The Moon sits right on the boundary between ') : null;
  const moonPair = data.moon?.cusp ? boundaryPairFrom(data.limits, 'The sidereal Moon sits right on the boundary between ') : null;
  const sunPair = data.sun?.cusp ? boundaryPairFrom(data.limits, 'The sidereal Sun sits right on the boundary between ') : null;
  const risingPair = data.rising?.cusp ? boundaryPairFrom(data.limits, 'The sidereal rising sign sits right on the boundary between ') : null;
  const verdict = data.moonNakshatra
    ? data.moonNakshatra.cusp
      ? nakPair
        ? `${nakPair[0]} or ${nakPair[1]} nakshatra`
        : `${data.moonNakshatra.name} nakshatra (on boundary)`
      : `${data.moonNakshatra.name} nakshatra${data.moonNakshatra.pada ? `, pada ${data.moonNakshatra.pada}` : ''}`
    : data.nakshatraCandidates.length > 0
      ? `${data.nakshatraCandidates.join(' or ')} nakshatra`
      : 'Vedic sidereal reading';
  const isRisingSensitive = (line: string) => line.includes('jumps abruptly near this birth time') || line.includes('moves rapidly across');
  const cuspLimits = data.limits.filter((line) => line.includes('sits right on the boundary') || isRisingSensitive(line));
  const otherLimits = data.limits.filter((line) => !line.includes('sits right on the boundary') && !isRisingSensitive(line));
  const orderedLimits = [...cuspLimits, ...otherLimits];
  const risingFlip = data.limits.some(isRisingSensitive);
  const moonLine = data.moon ? (data.moon.cusp ? qualifyVedicLine(data.moon.line, 'moon', moonPair, false) : data.moon.line) : null;
  const nakLine = data.moonNakshatra ? (data.moonNakshatra.cusp ? qualifyVedicLine(data.moonNakshatra.line, 'nakshatra', nakPair, false) : data.moonNakshatra.line) : null;
  const sunLine = data.sun ? (data.sun.cusp ? qualifyVedicLine(data.sun.line, 'sun', sunPair, false) : data.sun.line) : null;
  const risingLine = data.rising ? (data.rising.cusp ? qualifyVedicLine(data.rising.line, 'rising', risingPair, risingFlip) : data.rising.line) : null;
  const anyCusp = !!(data.moon?.cusp || data.moonNakshatra?.cusp || data.sun?.cusp || data.rising?.cusp);
  const summaryParts = [moonLine, nakLine, sunLine, risingLine].filter((line): line is string => !!line);
  const fullSummary = cardWords(anyCusp && summaryParts.length > 0 ? `${summaryParts.join(' ')} ${data.confidenceLabel}.` : data.summary);
  const readingLines = [moonLine, sunLine, risingLine].filter((line): line is string => !!line);
  const cuspLabels = [
    data.moon?.cusp ? 'Moon' : null,
    data.moonNakshatra?.cusp ? 'nakshatra' : null,
    data.sun?.cusp ? 'Sun' : null,
    data.rising?.cusp && !risingFlip ? 'rising' : null,
  ].filter((label): label is string => !!label);
  const heroPlacements = [
    data.moon ? `${data.moon.rashi} Moon` : data.moonCandidates.length ? `Moon in ${data.moonCandidates.join(' or ')}` : null,
    data.sun ? `${data.sun.rashi} Sun` : data.sunCandidates.length ? `Sun in ${data.sunCandidates.join(' or ')}` : null,
    data.rising ? `${data.rising.rashi} rising` : null,
  ].filter((part): part is string => !!part);
  const polarLimit = data.limits.find((line) => /geographic pole|no unique direction of east/iu.test(line));
  const missingRisingNote = data.rising
    ? '.'
    : polarLimit
      ? `. ${cardWords(polarLimit)}`
      : data.timeKnown && !data.placed
        ? '; add a birthplace for rising.'
        : !data.timeKnown && data.placed
          ? '; add a birth time for rising.'
          : !data.timeKnown && !data.placed
            ? '; add birth time and place for rising.'
            : '.';
  const heroSummary = cuspLabels.length > 0 && risingFlip
    ? `Provisional near a boundary (${cuspLabels.join(', ')}) and time-sensitive for rising at this latitude.`
    : risingFlip
      ? 'Provisional: the rising sign is highly sensitive to birth time at this latitude.'
      : cuspLabels.length > 0
        ? `Provisional near a boundary (${cuspLabels.join(', ')}): a small shift in birth time or ayanamsa can move it.`
        : cuspLimits.length > 0
          ? 'Provisional near a sign boundary: a small shift in birth time or ayanamsa can move it.'
          : heroPlacements.length > 0
            ? `${heroPlacements.join(', ')}${missingRisingNote}`
            : cardWords(data.summary);
  const chips = [
    {
      icon: icon(data.moon?.sign),
      name: data.moon ? `${data.moon.rashi} Moon` : 'Moon sign',
      detail: data.moon
        ? <>{signName(data.moon.sign)}{data.moon.degree !== null ? <> <Data>{data.moon.degree.toFixed(2)}°</Data></> : null}{data.moon.cusp ? ' (on boundary)' : ''}</>
        : data.moonCandidates.join(' or ') || 'Unsettled without birth time',
    },
    {
      icon: icon(data.sun?.sign),
      name: data.sun ? `${data.sun.rashi} Sun` : 'Sun sign',
      detail: data.sun
        ? <>{signName(data.sun.sign)}{data.sun.degree !== null ? <> <Data>{data.sun.degree.toFixed(2)}°</Data></> : null}{data.sun.cusp ? ' (on boundary)' : ''}</>
        : data.sunCandidates.join(' or ') || 'Unsettled without birth time',
    },
    ...(data.rising ? [{
      icon: icon(data.rising.sign),
      name: `${data.rising.rashi} rising`,
      detail: <>{signName(data.rising.sign)}{data.rising.degree !== null ? <> <Data>{data.rising.degree.toFixed(2)}°</Data></> : null}{data.rising.cusp ? (risingFlip ? ' (time-sensitive)' : ' (on boundary)') : ''}</>,
    }] : []),
  ];
  const pageAction = firstAction(data.pageUrl, 'Open Vedic signs', links, 'Open Western birth chart');
  const actions = cardActions(settledSun && data.shareUrl ? { label: 'Share your Vedic Sun', href: data.shareUrl } : null, pageAction);
  const copyText = [
    `Vedic signs (${data.ayanamsa.label}, ${data.ayanamsa.degrees.toFixed(2)} deg)`,
    data.moon
      ? data.moon.cusp
        ? `Moon: ${moonPair ? `${moonPair[0]} or ${moonPair[1]} (provisional, on boundary; computed ${data.moon.rashi})` : `${data.moon.rashi} (${signName(data.moon.sign)}, provisional, on boundary)`}`
        : `Moon: ${data.moon.rashi} (${signName(data.moon.sign)})`
      : data.moonCandidates.length ? `Moon candidates: ${data.moonCandidates.join(' or ')}` : '',
    data.moonNakshatra
      ? data.moonNakshatra.cusp
        ? `Nakshatra: ${nakPair ? `${nakPair[0]} or ${nakPair[1]}` : data.moonNakshatra.name} (provisional, on boundary; computed ${data.moonNakshatra.name})`
        : `Nakshatra: ${data.moonNakshatra.name}${data.moonNakshatra.pada ? ` pada ${data.moonNakshatra.pada}` : ''}`
      : data.nakshatraCandidates.length ? `Nakshatra candidates: ${data.nakshatraCandidates.join(' or ')}` : '',
    data.sun
      ? data.sun.cusp
        ? `Sun: ${sunPair ? `${sunPair[0]} or ${sunPair[1]} (provisional, on boundary; computed ${data.sun.rashi})` : `${data.sun.rashi} (${signName(data.sun.sign)}, provisional, on boundary)`}`
        : `Sun: ${data.sun.rashi} (${signName(data.sun.sign)})`
      : data.sunCandidates.length ? `Sun candidates: ${data.sunCandidates.join(' or ')}` : '',
    data.rising
      ? data.rising.cusp
        ? `Rising: ${risingFlip ? `${data.rising.rashi} (${signName(data.rising.sign)}, provisional, time-sensitive)` : risingPair ? `${risingPair[0]} or ${risingPair[1]} (provisional, on boundary; computed ${data.rising.rashi})` : `${data.rising.rashi} (${signName(data.rising.sign)}, provisional, on boundary)`}`
        : `Rising: ${data.rising.rashi} (${signName(data.rising.sign)})`
      : '',
    data.confidenceLabel,
    fullSummary,
    ...data.limits.map(cardWords),
    bareUrl(pageAction?.href),
  ].filter(Boolean).join('\n');

  return <Card hue={hueOf(leadSign)} hue2={hueOf(settledSun)} front={settledSun}>
    <Keepsake
      kicker="Vedic signs"
      title={title}
      art={[{ src: artOf(leadSign ?? 'milestones-hero') }]}
      signs={[icon(settledMoon), icon(settledSun), icon(data.rising && !data.rising.cusp ? data.rising.sign : null)]}
      meta={<>{data.ayanamsa.label}, <Data>{data.ayanamsa.degrees.toFixed(2)}°</Data><br/><strong>{data.confidenceLabel}</strong></>}
    />
    <Hero verdict={verdict} summary={heroSummary}/>
    <Fold hint={holds(['sidereal signs', (readingLines.length > 0 || !data.moonNakshatra) && 'full reading', data.moonNakshatra && 'nakshatra lore', orderedLimits.length > 0 && 'notes', 'a copy of the card'])}>
      <Chips chips={chips}/>
      {(readingLines.length > 0 || !data.moonNakshatra) && <Section title="Sidereal reading">
        {readingLines.length > 0
          ? readingLines.map((line) => <p class="insight" key={line}>{cardWords(line)}</p>)
          : <p class="insight">{fullSummary}</p>}
      </Section>}
      {data.moonNakshatra && <Section title={data.moonNakshatra.cusp ? `${data.moonNakshatra.name} (provisional, on boundary)` : data.moonNakshatra.name}>
        <Facts rows={[
          ['Ruling planet', data.moonNakshatra.lord],
          ['Deity', cardWords(data.moonNakshatra.deity)],
          ['Symbol', cardWords(data.moonNakshatra.symbol)],
          ...(data.moon?.tropicalSign ? [['Western Moon', signName(data.moon.tropicalSign)] as Fact] : []),
          ...(data.sun?.tropicalSign ? [['Western Sun', signName(data.sun.tropicalSign)] as Fact] : []),
        ]}/>
        <p class="insight">{cardWords(nakLine ?? data.moonNakshatra.line)}</p>
      </Section>}
      {orderedLimits.map((line) => <p class="quiet" key={line}>{cardWords(line)}</p>)}
      <FeatureCopyCard text={copyText} label="Copy the reading"/>
    </Fold>
    <Actions primary={actions.primary} secondary={actions.secondary}/>
    <FinePrint>{cardWords(data.note)}</FinePrint>
  </Card>;
}

// ── 3. Year Ahead Score ──────────────────────────────────────────────

export function YearScoreCard({ data, links = [] }: { data: YearScoreData; links?: readonly ToolLink[] }) {
  if (data.status === 'not-in-directory' || data.score === null) {
    const primary = firstAction(data.pageUrl, 'Score your own year', links, 'Open transits on Zodiacs');
    return <Card hue={null}>
      <Head kicker="Year Ahead Score" title="Not in the directory" art={[{ src: artOf('milestones-hero') }]}/>
      <p class="insight">{cardWords(data.limits[0] ?? 'That person is not in the Zodiacs Year Ahead directory.')}</p>
      <Actions primary={primary}/>
      <FinePrint>Year Ahead Score reads slow-planet transits over twelve months.</FinePrint>
    </Card>;
  }
  const sun = data.subject?.sun ?? null;
  const title = data.subject?.name ?? (sun ? `${signName(sun)} year ahead` : 'Your year ahead');
  const tiles: [string, string | number][] = [];
  if (data.best) tiles.push(['Best month', `${data.best.name} (${data.best.score.toFixed(1)})`]);
  if (data.hardest) tiles.push(['Hardest month', `${data.hardest.name} (${data.hardest.score.toFixed(1)})`]);
  if (rangeWorthShowing(data.scoreRange)) {
    tiles.push(['Birth-day range', `${data.scoreRange.low.toFixed(1)} to ${data.scoreRange.high.toFixed(1)}`]);
  }
  const pageAction = firstAction(data.pageUrl, 'Open Year Ahead Score', links, 'Open transits on Zodiacs');
  const actions = cardActions(data.shareUrl ? { label: 'Share your score', href: data.shareUrl } : null, pageAction);
  const yearLimits = data.limits.map((line) => (
    /\bsources disagree on the birthplace\b/iu.test(line)
      ? 'Sources disagree on the birthplace, though both share the same clock so the chart is unchanged.'
      : cardWords(line)
  ));
  const copyText = [
    `Year Ahead Score: ${data.score.toFixed(1)}/10 (${data.label ?? ''})`,
    data.from && data.to ? capital(dateRange(data.from, data.to)) : '',
    rangeWorthShowing(data.scoreRange) ? `Birth-day range: ${data.scoreRange.low.toFixed(1)} to ${data.scoreRange.high.toFixed(1)}` : '',
    data.confidenceLabel ?? '',
    data.summary ? cardWords(data.summary) : '',
    data.best ? `Best month: ${cardWords(data.best.line)}` : '',
    data.hardest ? `Hardest month: ${cardWords(data.hardest.line)}` : '',
    ...data.drivers.map((driver) => `${driver.title} (${driver.inOrb}): ${cardWords(driver.line)}`),
    ...yearLimits,
    bareUrl(pageAction?.href),
  ].filter(Boolean).join('\n');

  return <Card hue={hueOf(sun)} front={data.subject?.kind === 'self' ? sun : null}>
    <Keepsake
      kicker="Year Ahead Score"
      title={title}
      art={[{ src: artOf(sun ?? 'milestones-hero') }]}
      signs={[icon(sun)]}
      meta={<>{data.from && data.to ? dateRange(data.from, data.to) : ''}{data.confidenceLabel ? <><br/><strong>{data.confidenceLabel}</strong></> : null}</>}
    />
    <Hero figure={<NumberRing value={data.score.toFixed(1)} caption="out of 10"/>} verdict={data.label ?? 'Year ahead'} summary={cardWords(data.summary ?? '')}/>
    <Fold hint={holds([tiles.length > 0 && 'best and hardest months', data.drivers.length > 0 && 'main transits', yearLimits.length > 0 && 'notes', 'a copy of the card'])}>
      {tiles.length > 0 && <Tiles label="Year highlights" tiles={tiles}/>}
      {data.drivers.length > 0 && <Section title="Main transits">
        <ul class="reading-list">
          {data.drivers.map((driver) => <li key={`${driver.planet}-${driver.aspect}-${driver.point}`}>
            <strong>{driver.title}</strong>, <Data>{driver.inOrb}</Data>
            <span class="reading-sub">{cardWords(driver.line)}</span>
          </li>)}
        </ul>
      </Section>}
      {yearLimits.map((line) => <p class="quiet" key={line}>{line}</p>)}
      <FeatureCopyCard text={copyText} label="Copy the reading"/>
    </Fold>
    <Actions primary={actions.primary} secondary={actions.secondary}/>
    <FinePrint>Astrology's traditional reading of slow-planet transits across these twelve months.</FinePrint>
  </Card>;
}

// ── 4. Solar Return ──────────────────────────────────────────────────

export function SolarReturnCard({ data }: { data: SolarReturnData; links?: readonly ToolLink[] }) {
  const clock = cardClock(data.zone, data.limits);
  const returnSunSign = data.placements.find((row) => row.body === 'Sun')?.sign ?? null;
  // Without a birth time, the return is cast from 12:00 UTC, which can disagree with the settled natal sign or sit on an unsettled cusp day.
  const approximateSunUncertain = !data.timeKnown && (data.sun === null || (returnSunSign !== null && returnSunSign !== data.sun));
  const verdict = data.rising
    ? `${signName(data.rising)} rising this birthday year`
    : data.sun && !approximateSunUncertain
      ? `${signName(data.sun)} solar return`
      : 'Your birthday year';
  const placements = data.placements.filter((row) => ['Sun', 'Moon', 'Venus', 'Mars', 'Jupiter', 'Saturn'].includes(row.body));
  const pageAction: Action = { label: 'Open solar return', href: data.pageUrl };
  const actions = cardActions(!approximateSunUncertain && data.shareUrl ? { label: 'Share your return', href: data.shareUrl } : null, pageAction);
  const foldOffset = data.timeKnown ? repeatedClockOffset(data.instantUtc, data.zone) : null;
  const whenLine = data.timeKnown
    ? `${data.local} (${clock.zoneLabel}${foldOffset ? `, ${foldOffset}` : ''})`
    : `Around ${data.local} (${clock.zoneLabel}, within a day without birth time)`;
  const copyText = [
    `Your ${data.returnYear} solar return`,
    whenLine,
    data.confidenceLabel,
    ...data.themes.map((theme) => `${theme.title}: ${cardWords(theme.line)}`),
    ...clock.limits.map(cardWords),
    bareUrl(pageAction.href),
  ].filter(Boolean).join('\n');

  return <Card hue={hueOf(data.sun)} hue2={hueOf(data.rising)} front={data.sun}>
    <Keepsake
      kicker={data.which === 'current' ? 'Current solar return' : 'Next solar return'}
      title={`Your ${data.returnYear} solar return`}
      art={[{ src: artOf(data.sun ?? 'milestones-hero') }, { src: artOf(data.rising), flip: true }]}
      signs={[icon(data.sun), icon(data.rising)]}
      meta={<>{whenLine}<br/><strong>{data.confidenceLabel}</strong></>}
    />
    <Hero verdict={verdict} summary={cardWords(data.themes[0]?.line ?? '')}/>
    <Fold hint={holds([data.themes.length > 0 && 'the year themes', placements.length > 0 && 'return placements', clock.limits.length > 0 && 'notes', 'a copy of the card'])}>
      {data.themes.length > 0 && <Section title="Themes for the year">
        <ul class="reading-list">
          {data.themes.map((theme) => <li key={`${theme.kind}-${theme.title}`}>
            <strong>{theme.title}</strong>
            <span class="reading-sub">{cardWords(theme.line)}</span>
          </li>)}
        </ul>
      </Section>}
      {placements.length > 0 && <Section title="Key return placements">
        <Facts rows={placements.map((row) => [
          row.body,
          <span class="sign-value"><SignDisc src={icon(row.sign)} size="row"/>{signName(row.sign)} <Data>{row.degree.toFixed(1)}°</Data>{row.house ? `, house ${row.house}` : ''}{row.body === 'Sun' && approximateSunUncertain ? ' (12:00 UTC estimate)' : ''}</span>,
        ] as Fact)}/>
      </Section>}
      {clock.limits.map((line) => <p class="quiet" key={line}>{cardWords(line)}</p>)}
      <FeatureCopyCard text={copyText} label="Copy the reading"/>
    </Fold>
    <Actions primary={actions.primary} secondary={actions.secondary}/>
    <FinePrint>Cast for the moment the Sun returns to its natal longitude.</FinePrint>
  </Card>;
}

// ── 5. Find Good Days ────────────────────────────────────────────────

const NO_BEST_DAY_GUIDANCE = 'No day in this window met traditional electional criteria. Try a wider date range if your schedule allows.';
const voidOfCourseLine = (spans: readonly { from: string; to: string }[]) => (
  spans.length > 0 ? `Moon void of course: ${spans.map((span) => `${span.from} to ${span.to}`).join('; ')}.` : ''
);

export function GoodDaysCard({ data, links = [] }: { data: GoodDaysData; links?: readonly ToolLink[] }) {
  const top = data.best[0];
  const hasBest = data.best.length > 0;
  const zoneLabel = clockLabelFor(data.zone);
  const goalFor = GOAL_RULES[data.goal]?.forWhat ?? `for ${data.goalLabel.toLowerCase()}`;
  const windowLabel = data.from === data.to ? longDate(data.from) : dateRange(data.from, data.to);
  const primary = firstAction(data.pageUrl, 'Open good day finder', links, 'Void-of-course calendar');
  const vocLink = linkMatching(links, '/void-of-course-moon/');
  const secondaryLink = vocLink && vocLink.url !== primary?.href ? vocLink : linkMatching(links, '/retrogrades/');
  const topSummary = top
    ? [cardWords(top.reason), voidOfCourseLine(top.voidOfCourse)].filter(Boolean).join(' ')
    : cardWords(data.message ?? NO_BEST_DAY_GUIDANCE);
  const copyText = [
    `${hasBest ? 'Good days' : 'No qualifying days'} ${goalFor} (${windowLabel}, ${zoneLabel})`,
    data.confidenceLabel,
    ...data.best.map((day) => {
      const voc = voidOfCourseLine(day.voidOfCourse);
      return `${longDate(day.date)}: ${day.score}/100, ${cardWords(day.reason)}${voc ? ` ${voc}` : ''}`;
    }),
    ...(data.avoid.length ? ['Days to avoid:', ...data.avoid.map((day) => `${longDate(day.date)}: ${cardWords(day.reason)}`)] : []),
    hasBest ? cardWords(data.care) : '',
    data.message ? cardWords(data.message) : (!hasBest ? NO_BEST_DAY_GUIDANCE : ''),
    bareUrl(primary?.href),
  ].filter(Boolean).join('\n');

  return <Card hue={hueOf(data.personal?.sun)} front={data.personal?.sun ?? null}>
    <Keepsake
      kicker="Find good days"
      title={`${hasBest ? 'Best days' : 'No qualifying days'} ${goalFor}`}
      art={[{ src: artOf(data.personal?.sun ?? 'sky-calendar-hero') }]}
      signs={[icon(data.personal?.sun)]}
      meta={<>{windowLabel}, {zoneLabel}<br/><strong>{data.confidenceLabel}</strong></>}
    />
    {hasBest && <Section title={`The best days ${windowLabel}`}>
      <ol class="best-days">
        {data.best.map((day) => <li key={day.date}>
          <div class="ring ring-small" role="img" aria-label={`${day.score} out of 100`} style={{ '--score': String(day.score) } as CSSProperties}><span class="ring-number" aria-hidden="true">{day.score}</span></div>
          <span class="best-day-words">
            <strong>{longDate(day.date)}</strong>
            <span class="quiet">{day.verdict}. {cardWords(day.reason)}</span>
            {day.voidOfCourse.length > 0 && <span class="quiet">Moon void of course: <Data>{day.voidOfCourse.map((span) => `${span.from} to ${span.to}`).join('; ')}</Data>.</span>}
          </span>
        </li>)}
      </ol>
    </Section>}
    <Hero
      figure={top ? <ScoreRing score={top.score}/> : undefined}
      verdict={top ? `${longDate(top.date)}, ${top.verdict.toLowerCase()}` : 'No clear best day in this window'}
      summary={topSummary}
    />
    <Fold hint={holds([data.avoid.length > 0 && 'days to avoid', data.periods.length > 0 && 'sky periods', 'a copy of the card'])}>
      {data.avoid.length > 0 && <Section title="Days to avoid">
        <ul class="reading-list">
          {data.avoid.map((day) => <li key={day.date}>
            <strong>{longDate(day.date)}</strong>, <Data>{day.score}/100</Data>
            <span class="reading-sub">{cardWords(day.reason)}</span>
          </li>)}
        </ul>
      </Section>}
      {data.periods.length > 0 && <Section title="Retrogrades and eclipses">
        <ul class="reading-list">
          {data.periods.map((period) => <li key={`${period.kind}-${period.from}`}>
            <strong>{capital(dateRange(period.from, period.to))}</strong>
            <span class="reading-sub">{cardWords(period.line)}</span>
          </li>)}
        </ul>
      </Section>}
      {data.message && <p class="quiet">{cardWords(data.message)}</p>}
      <FeatureCopyCard text={copyText} label="Copy the reading"/>
    </Fold>
    <Actions
      primary={primary}
      secondary={secondaryLink && secondaryLink.url !== primary?.href
        ? { label: secondaryLink === vocLink ? 'Void-of-course calendar' : secondaryLink.title, href: secondaryLink.url }
        : false}
    />
    <FinePrint>{hasBest ? cardWords(data.care) : NO_BEST_DAY_GUIDANCE} {cardWords(data.note)}</FinePrint>
  </Card>;
}

// ── 6. Retrogrades for You ───────────────────────────────────────────

const STATUS_WORDS: Record<RetrogradeForMeData['periods'][number]['status'], string> = {
  retrograde: 'retrograde now',
  'pre-shadow': 'in pre-shadow',
  'post-shadow': 'in post-shadow',
  direct: 'moving direct',
};

export function RetrogradeCard({ data, links = [] }: { data: RetrogradeForMeData; links?: readonly ToolLink[] }) {
  const clock = cardClock(data.timeZone, data.limits);
  const earliest = (list: readonly RetrogradeForMeData['periods'][number][]) =>
    [...list].sort((a, b) => Date.parse(a.stationRetrograde.utc) - Date.parse(b.stationRetrograde.utc))[0];
  const lead = earliest(data.periods.filter((period) => period.retrogradeNow))
    ?? earliest(data.periods.filter((period) => period.status !== 'direct'))
    ?? earliest(data.periods);
  const leadSign = lead?.signs[0] ?? null;
  const title = lead?.retrogradeNow
    ? `${lead.planet} is retrograde`
    : lead?.status === 'post-shadow'
      ? `${lead.planet} post-shadow`
      : lead?.status === 'pre-shadow'
        ? `${lead.planet} pre-shadow`
        : lead
          ? `Next: ${lead.planet} retrograde`
          : 'Retrogrades for you';
  const verdict = lead ? `${lead.planet} is ${STATUS_WORDS[lead.status]}` : 'Retrograde tracker';
  const pageAction = firstAction(data.pageUrl, 'Open retrogrades for you', links, 'Open retrogrades guide');
  const shareUrl = lead?.shareUrl ?? null;
  const actions = cardActions(shareUrl ? { label: 'Share this retrograde', href: shareUrl } : null, pageAction);
  const copyText = [
    'Retrogrades for you',
    clock.zoneLabel,
    lead ? lead.confidenceLabel : '',
    cardWords(data.summary),
    ...data.periods.map((period) => {
      const nextPart = period.next
        ? ` Next retrograde: ${zoneRangeLabel(period.next.stationRetrograde, period.next.stationDirect, data.timeZone)}.`
        : '';
      return `${period.planet} (${STATUS_WORDS[period.status]}): ${period.stationRetrograde.label} to ${period.stationDirect.label}.${nextPart} ${cardWords(period.reading)}`;
    }),
    ...clock.limits.map(cardWords),
    bareUrl(pageAction?.href),
  ].filter(Boolean).join('\n');

  return <Card hue={hueOf(leadSign)}>
    <Keepsake
      kicker="Retrogrades for you"
      title={title}
      art={[{ src: artOf('sky-calendar-hero') }]}
      signs={[icon(leadSign)]}
      meta={<>{clock.zoneLabel}{lead ? <><br/><strong>{lead.confidenceLabel}</strong></> : null}</>}
    />
    <Hero verdict={verdict} summary={cardWords(data.summary)}/>
    <Fold hint={holds(['each planet loop', 'natal houses and contacts', clock.limits.length > 0 && 'notes', 'a copy of the card'])}>
      <Section title="Planetary loops">
        <ul class="reading-list">
          {data.periods.map((period) => <li key={period.planet}>
            <strong>{period.planet}</strong> ({STATUS_WORDS[period.status]}): <Data>{period.stationRetrograde.label} to {period.stationDirect.label}</Data>
            {period.next && <span class="reading-sub">Next retrograde: <Data>{zoneRangeLabel(period.next.stationRetrograde, period.next.stationDirect, data.timeZone)}</Data></span>}
            <span class="reading-sub">{cardWords(period.reading)}</span>
          </li>)}
        </ul>
      </Section>
      {clock.limits.map((line) => <p class="quiet" key={line}>{cardWords(line)}</p>)}
      <FeatureCopyCard text={copyText} label="Copy the reading"/>
    </Fold>
    <Actions primary={actions.primary} secondary={actions.secondary}/>
    <FinePrint>Stations and shadow dates on your clock.</FinePrint>
  </Card>;
}

// ── 7. Your Day (Personal Day) ───────────────────────────────────────

export function PersonalDayCard({ data, links = [] }: { data: PersonalDayData; links?: readonly ToolLink[] }) {
  const clock = cardClock(data.zone, data.limits);
  // Match readPersonalDay's lead selection: strongest daily ('today') contact when one exists, else strongest background.
  const dailyContacts = data.contacts.filter((contact) => contact.group === 'today');
  const backgroundContacts = data.contacts.filter((contact) => contact.group === 'background');
  const lead = dailyContacts[0] ?? backgroundContacts[0];
  const confidenceLabel = lead?.confidenceLabel
    ?? readingConfidenceLabel(readingDetail({ hasDate: true, hasTime: data.timeKnown, hasPlace: data.placed }));
  const pageAction = firstAction(data.pageUrl, 'Open Your Day', links, 'Open transits on Zodiacs');
  const actions = cardActions(data.shareUrl ? { label: 'Share your day', href: data.shareUrl } : null, pageAction);
  const formatContact = (contact: PersonalDayData['contacts'][number]) =>
    `${contact.title}${contact.exactLocal ? ` at ${contact.exactLocal}` : ` (${contact.orb.toFixed(1)} deg)`}: ${cardWords(contact.line)}`;
  const copyText = [
    `Your Day: ${data.dayLabel} (${clock.zoneLabel})`,
    confidenceLabel,
    cardWords(data.theme),
    cardWords(data.moon.line),
    ...(dailyContacts.length ? [`Contacts on ${data.dayLabel}:`, ...dailyContacts.map(formatContact)] : []),
    ...(backgroundContacts.length ? ['In the background:', ...backgroundContacts.map(formatContact)] : []),
    ...clock.limits.map(cardWords),
    bareUrl(pageAction?.href),
  ].filter(Boolean).join('\n');

  return <Card hue={hueOf(data.moon.sign)}>
    <Keepsake
      kicker="Your day"
      title={data.dayLabel}
      art={[{ src: artOf(data.moon.sign) }]}
      signs={[icon(data.moon.sign)]}
      meta={<>{clock.zoneLabel}<br/><strong>{confidenceLabel}</strong></>}
    />
    <Hero verdict={lead ? lead.title : `${signName(data.moon.sign)} Moon`} summary={cardWords(data.theme)}/>
    <Fold hint={holds(['the Moon', dailyContacts.length > 0 && 'daily contacts', backgroundContacts.length > 0 && 'background transits', clock.limits.length > 0 && 'notes', 'a copy of the card'])}>
      <Section title={`The Moon on ${data.dayLabel}`}>
        <p class="insight">{cardWords(data.moon.line)}</p>
      </Section>
      {dailyContacts.length > 0 && <Section title={`Contacts on ${data.dayLabel}`}>
        <ul class="reading-list">
          {dailyContacts.map((contact) => <li key={`${contact.rank}-${contact.title}-${contact.exactAt ?? ''}`}>
            <strong>{contact.title}</strong>, <Data>{contact.exactLocal ? `exact ${contact.exactLocal}` : `${contact.orb.toFixed(1)}° orb`}</Data>
            <span class="reading-sub">{cardWords(contact.line)}</span>
          </li>)}
        </ul>
      </Section>}
      {backgroundContacts.length > 0 && <Section title="In the background">
        <ul class="reading-list">
          {backgroundContacts.map((contact) => <li key={`${contact.rank}-${contact.title}-${contact.exactAt ?? ''}`}>
            <strong>{contact.title}</strong>, <Data>{contact.exactLocal ? `exact ${contact.exactLocal}` : `${contact.orb.toFixed(1)}° orb`}</Data>
            <span class="reading-sub">{cardWords(contact.line)}</span>
          </li>)}
        </ul>
      </Section>}
      {clock.limits.map((line) => <p class="quiet" key={line}>{cardWords(line)}</p>)}
      <FeatureCopyCard text={copyText} label="Copy the reading"/>
    </Fold>
    <Actions primary={actions.primary} secondary={actions.secondary}/>
    <FinePrint>Calculated for this day against your birth chart.</FinePrint>
  </Card>;
}

// ── 8. Numerology (Separate from Astrology) ──────────────────────────

const KARMIC_CARRIER_LABELS: Record<Exclude<NumerologyData['karmicDebts'][number]['carriedBy'][number], 'birthday'>, string> = {
  lifePath: 'Life Path',
  expression: 'Expression',
  soulUrge: 'Soul Urge',
  personality: 'Personality',
};

export function NumerologyCard({ data, links = [] }: { data: NumerologyData; links?: readonly ToolLink[] }) {
  const tiles: [string, string | number][] = [
    ['Life Path', data.lifePath.chain],
    [`Personal Year ${data.personalYear.year}`, data.personalYear.number],
  ];

  const nameRows: Fact[] = [];
  if (data.expression) nameRows.push([`Expression ${data.expression.number}`, <><Data>{data.expression.chain}</Data>. {data.expression.title}. {cardWords(data.expression.reading)}</>]);
  if (data.soulUrge) nameRows.push([`Soul Urge ${data.soulUrge.number}`, <><Data>{data.soulUrge.chain}</Data>. {data.soulUrge.title}. {cardWords(data.soulUrge.reading)}</>]);
  if (data.personality) nameRows.push([`Personality ${data.personality.number}`, <><Data>{data.personality.chain}</Data>. {data.personality.title}. {cardWords(data.personality.reading)}</>]);

  // Omit the `birthday` carrier because a 13/14/16/19 birthday debt equals the exact birth day of the month.
  const safeKarmicDebts = data.karmicDebts
    .map((debt) => ({
      ...debt,
      carriedBy: debt.carriedBy
        .filter((carrier): carrier is keyof typeof KARMIC_CARRIER_LABELS => carrier !== 'birthday')
        .map((carrier) => KARMIC_CARRIER_LABELS[carrier]),
    }))
    .filter((debt) => debt.carriedBy.length > 0);

  const calcLink = linkMatching(links, '/numerology/') ?? links[0];
  const lifePathLink = linkMatching(links, '/numerology/life-path/');
  const copyText = [
    'Numerology, separate from astrology',
    `Life Path ${data.lifePath.number} (${data.lifePath.chain}): ${data.lifePath.title}`,
    cardWords(data.lifePath.reading),
    `Personal Year ${data.personalYear.year}: ${data.personalYear.number} (${data.personalYear.chain})`,
    cardWords(data.personalYear.reading),
    ...(data.expression ? [`Expression ${data.expression.number} (${data.expression.chain}): ${cardWords(data.expression.reading)}`] : []),
    ...(data.soulUrge ? [`Soul Urge ${data.soulUrge.number} (${data.soulUrge.chain}): ${cardWords(data.soulUrge.reading)}`] : []),
    ...(data.personality ? [`Personality ${data.personality.number} (${data.personality.chain}): ${cardWords(data.personality.reading)}`] : []),
    cardWords(data.separateFromAstrology),
    bareUrl(calcLink?.url),
  ].filter(Boolean).join('\n');

  return <Card hue={null}>
    <Keepsake
      kicker="Numerology, separate from astrology"
      title={`Life Path ${data.lifePath.number}`}
      art={[{ src: artOf('milestones-hero') }]}
      meta={<>{data.lifePath.title}{data.lifePath.master ? ', Master number' : ''}</>}
    />
    <Hero figure={<NumberRing value={data.lifePath.number} caption="Life Path"/>} verdict={data.lifePath.title} summary={cardWords(data.lifePath.reading)}/>
    <Fold hint={holds(['your numbers', `Personal Year ${data.personalYear.year}`, nameRows.length > 0 && 'name numbers', safeKarmicDebts.length > 0 && 'karmic debt', 'a copy of the card'])}>
      <Tiles label="Core numbers" tiles={tiles}/>
      <Section title={`Personal Year ${data.personalYear.year}`}>
        <p class="insight"><strong>Personal Year {data.personalYear.number}</strong> (<Data>{data.personalYear.chain}</Data>). {cardWords(data.personalYear.reading)}</p>
      </Section>
      {nameRows.length > 0 && <Section title="Name numbers">
        <Facts rows={nameRows} stacked/>
      </Section>}
      {safeKarmicDebts.length > 0 && <Section title="Karmic debt">
        <ul class="reading-list">
          {safeKarmicDebts.map((debt) => <li key={debt.number}>
            <strong>Karmic debt {debt.number}</strong> ({debt.carriedBy.join(', ')})
            <span class="reading-sub">{cardWords(debt.reading)}</span>
          </li>)}
        </ul>
      </Section>}
      <FeatureCopyCard text={copyText} label="Copy the numbers"/>
    </Fold>
    <Actions
      primary={{ label: 'Open numerology calculator', href: calcLink?.url ?? 'https://zodiacs.org/numerology/' }}
      secondary={lifePathLink ? { label: lifePathLink.title, href: lifePathLink.url } : false}
    />
    <FinePrint>{cardWords(data.separateFromAstrology)} {cardWords(data.note)}</FinePrint>
  </Card>;
}
