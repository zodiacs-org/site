/**
 * The occasions panel's seven cards, each built from the shared card kit:
 * a day that matters, life milestones, two charts compared, chart twins, a
 * famous chart, a birthday and the sky calendar.
 */
import type { ComponentChildren, CSSProperties } from 'preact';
import { OCCASION_LABELS, type OccasionKind } from '../../lib/occasions/kinds';
import { MILESTONE_WORDS } from '../../lib/occasions/milestone-words';
import { Actions, artOf, Card, Chips, Data, Facts, FinePrint, Head, Hero, More, NumberRing, Reasons, ScoreRing, Section, SignDisc, Tiles, type Fact } from '../card-kit/parts';
import { hueOf } from '../card-kit/hue';
import { capital, dateRange, fullDate, list, longDate, plain, shortDate, signName } from '../card-kit/words';
import type { CompatibilityData, CompatibilityNotFound } from '../features/compatibility';
import type { ChartTwinsData, FamousChartData } from '../features/people';
import type { BirthdayData, SkyCalendarData } from '../features/birthday';

declare const OCCASIONS_ICONS: Record<string, string>;
const icon = (slug: string | null | undefined) => (slug ? OCCASIONS_ICONS[slug] : undefined);
/** A link as people read it: the address without its scheme or query. */
const bare = (url: string) => url.replace(/^https:\/\//u, '').replace(/[?#].*$/u, '');

// ── A day that matters ───────────────────────────────────────────────

interface ClockTime { utc: string; local: string }
export interface OccasionSky {
  occasion: OccasionKind; date: string; time: string | null; zone: string | null; place: string | null; names: string | null;
  card: { title: string; interpretation: string; closing: string };
  instant: ClockTime; instantIs: 'given-time' | 'local-noon' | 'utc-noon';
  sky: { bodies: { body: string; sign: string; degree: number; retrograde: boolean }[]; moon: { phase: string; illuminationPercent: number; waxing: boolean }; retrograde: string[] };
  moonSignChange: { from: string; to: string } | null;
  evening: {
    sunrise: ClockTime | null; sunset: ClockTime | null; goldenHour: { start: ClockTime; end: ClockTime } | null; civilDusk: ClockTime | null;
    moonrise: ClockTime | null; moonset: ClockTime | null; moonHighest: { at: ClockTime; altitude: number } | null;
    planetsAfterDusk: string[]; flags: string[];
  } | null;
  rating: { score: number; verdict: string; reasons: string[] };
  bestDays: { from: string; to: string; days: number; best: { date: string; score: number; verdict: string; reasons: string[] }[] } | null;
  cardUrl: string | null; shareUrl?: string | null; note: string;
}

/** Occasions whose hero is the wedding piece; the others show the Sun sign's panel. */
const WEDDING_ART: readonly OccasionKind[] = ['wedding', 'anniversary'];
/** "20:57" from "Sat 12 Jun 2027, 20:57" (or "…, 20:57 UTC"), as the tool gives it. */
const clock = (time: ClockTime | null | undefined) => (time ? time.local.split(', ').pop() ?? time.local : '');
/** A best day's strongest reason that the other listed days do not all share, so the rows say what sets each apart. */
const gist = (reason: string) => reason.replace(/\s*\([^)]*\)/gu, '');
const telling = (reasons: string[], rows: { reasons: string[] }[]) => reasons.find((reason) => !rows.every((row) => row.reasons.some((other) => gist(other) === gist(reason)))) ?? reasons[0] ?? '';

export function Occasion({ data }: { data: OccasionSky }) {
  const sun = data.sky.bodies.find((body) => body.body === 'Sun');
  const moon = data.sky.bodies.find((body) => body.body === 'Moon');
  const evening = data.evening;
  const names = data.names?.trim() || null;
  const label = OCCASION_LABELS[data.occasion].replace(/ \(.*\)$/u, '');
  const date = longDate(data.date);
  const at = data.instantIs === 'given-time' ? clock(data.instant) : null;
  const noonLine = data.instantIs === 'given-time' ? ''
    : data.instantIs === 'local-noon' ? 'No time given, so the sky is read at noon there.'
    // A place name alone (no zone or coordinates) is shown, but the sky is still read at noon UTC.
    : data.place ? 'No time given, so the sky is read at noon UTC.' : 'No time or place given, so the sky is read at noon UTC.';
  const whenText = `${date}${at ? ` at ${at}` : ''}${data.place ? ` in ${data.place}` : ''}`;
  const moonLine = data.moonSignChange ? `${signName(data.moonSignChange.from)} to ${signName(data.moonSignChange.to)} Moon` : moon ? `${signName(moon.sign)} Moon` : '';
  const rows: [string, ComponentChildren, string][] = [];
  if (evening?.goldenHour) rows.push(['Golden hour', <><Data>{clock(evening.goldenHour.start)}</Data> to <Data>{clock(evening.goldenHour.end)}</Data></>, `${clock(evening.goldenHour.start)} to ${clock(evening.goldenHour.end)}`]);
  if (evening?.sunset) rows.push(['Sunset', <Data>{clock(evening.sunset)}</Data>, clock(evening.sunset)]);
  if (evening?.civilDusk) rows.push(['Dusk', <Data>{clock(evening.civilDusk)}</Data>, clock(evening.civilDusk)]);
  if (evening?.moonHighest && evening.moonHighest.altitude > 0) rows.push(['Moon at its highest', <><Data>{clock(evening.moonHighest.at)}</Data>, <Data>{evening.moonHighest.altitude}°</Data> up</>, `${clock(evening.moonHighest.at)}, ${evening.moonHighest.altitude}° up`]);
  if (evening && evening.planetsAfterDusk.length > 0) rows.push(['Bright after dark', list(evening.planetsAfterDusk), list(evening.planetsAfterDusk)]);
  if (evening?.flags.includes('sun-never-sets')) rows.push(['The Sun', 'does not set that day', 'does not set that day']);
  if (evening?.flags.includes('sun-never-rises')) rows.push(['The Sun', 'does not rise that day', 'does not rise that day']);
  if (data.sky.retrograde.length > 0) rows.push(['Also that day', `${list(data.sky.retrograde)} retrograde`, `${list(data.sky.retrograde)} retrograde`]);
  const best = data.bestDays;
  const bestTitle = best ? `The best days ${dateRange(best.from, best.to)}` : '';
  const text = [names, ...(best ? [bestTitle, ...best.best.map((row) => `${longDate(row.date)}: ${row.score}/100, ${row.verdict}`), ''] : []), data.card.title, whenText, noonLine,
    `${data.rating.score}/100: ${data.rating.verdict}`, sun ? `${signName(sun.sign)} Sun, ${moonLine}` : '', ...data.rating.reasons.map(plain), ...rows.map(([name, , value]) => `${name}: ${value}`),
    plain(`${data.card.interpretation} ${data.card.closing}`), plain(data.note), 'zodiacs.org/occasions']
    .filter(Boolean).join('\n');
  return <Card hue={hueOf(sun?.sign)} hue2={hueOf(moon?.sign)}>
    <Head kicker={names ? data.card.title : label} title={names ?? data.card.title} art={[{ src: artOf(WEDDING_ART.includes(data.occasion) ? 'wedding-hero' : sun?.sign) }]}
      meta={<><span class="when">{date}{at && <> at <strong>{at}</strong></>}{data.place && <> in <strong>{data.place}</strong></>}</span>{noonLine && <><br/>{noonLine}</>}</>}/>
    {best && <Section title={bestTitle}>
      <ol class="best-days">{best.best.map((row) => <li key={row.date}>
        <div class="ring ring-small" role="img" aria-label={`${row.score} out of 100`} style={{ '--score': String(row.score) } as CSSProperties}><span class="ring-number" aria-hidden="true">{row.score}</span></div>
        <span class="best-day-words"><strong>{longDate(row.date)}</strong><span class="quiet">{row.verdict}. {telling(row.reasons, best.best)}</span></span>
      </li>)}</ol>
      <p class="quiet">Every day was rated at {data.time ?? (data.zone ? 'noon' : 'noon UTC')}. The card below is for {data.date === best.best[0]?.date ? 'the best day' : longDate(data.date)}.</p>
    </Section>}
    <Hero figure={<ScoreRing score={data.rating.score}/>} verdict={data.rating.verdict} summary={plain(data.card.interpretation)}/>
    {sun && moon && <Chips chips={[
      { icon: icon(sun.sign), name: `${signName(sun.sign)} Sun`, detail: <Data>{sun.degree.toFixed(1)}°</Data> },
      { icon: icon(moon.sign), name: moonLine, detail: `${data.sky.moon.phase.toLowerCase()}, ${data.sky.moon.illuminationPercent}% lit` },
    ]}/>}
    {data.rating.reasons.length > 0 && <Reasons items={data.rating.reasons.map(plain)}/>}
    {rows.length > 0 && <Facts rows={rows.map(([name, value]) => [name, value] as Fact)}/>}
    <p class="insight insight-close">{plain(data.card.closing)}</p>
    {data.moonSignChange && data.instantIs !== 'given-time' && <p class="quiet">The Moon changes sign that day. Add the time to pin it down.</p>}
    <Actions copyText={text} links={[data.shareUrl && { label: 'Share the reading', href: data.shareUrl }, data.cardUrl && { label: 'Open printable card', href: data.cardUrl }]}/>
    <FinePrint>{plain(data.note)}</FinePrint>
  </Card>;
}

// ── Life milestones ──────────────────────────────────────────────────

type MilestoneKind = keyof typeof MILESTONE_WORDS;
interface Milestone { kind: MilestoneKind; name: string; index: number; age: number; first: string; last: string; passes: { at: string; retrograde: boolean }[] }
export interface LifeMilestones {
  birthDate: string; timeKnown: boolean; asOf: string; milestones: Milestone[]; next: Milestone | null;
  numbers: { fullMoons: number; mercuryRetrogrades: number; jupiterReturns: number };
  cardUrl: string | null; note: string;
}
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const milestoneName = (milestone: Milestone) => (milestone.kind === 'uranus-opposition' ? 'Uranus opposition' : `${ORDINALS[milestone.index - 1] ?? `${milestone.index}th`} ${MILESTONE_WORDS[milestone.kind].name}`);
/** Each milestone wears the hue of the sign its planet rules. */
const MILESTONE_SIGN: Record<MilestoneKind, string> = { 'saturn-return': 'capricorn', 'jupiter-return': 'sagittarius', 'uranus-opposition': 'aquarius' };
/** How many milestones show before the later ones fold away. */
const SHOWN_MILESTONES = 6;

export function Milestones({ data }: { data: LifeMilestones }) {
  const next = data.next;
  const now = Date.parse(data.asOf);
  const passLabel = (milestone: Milestone, index: number, pass: { retrograde: boolean }) => (index === 0
    ? (milestone.kind === 'uranus-opposition' ? 'Uranus reaches the point opposite its place at your birth' : `${milestone.kind === 'jupiter-return' ? 'Jupiter' : 'Saturn'} reaches its place at your birth`)
    : pass.retrograde ? 'Passes back over it, retrograde' : index === milestone.passes.length - 1 ? 'Crosses it for the last time' : 'Crosses it again');
  const span = (milestone: Milestone) => `${shortDate(milestone.first)}${milestone.passes.length > 1 ? ` to ${shortDate(milestone.last)}` : ''}`;
  const lead = next ? `${Date.parse(next.first) <= now ? 'Now' : 'Next'}: your ${milestoneName(next)}, at ${next.age}` : '';
  const born = `Born ${fullDate(data.birthDate)}`;
  const milestoneRow = (milestone: Milestone): Fact => [`${capital(milestoneName(milestone))}, age ${milestone.age}`, span(milestone)];
  const tiles: [string, string][] = [['Full moons lived through', data.numbers.fullMoons.toLocaleString('en-GB')], ['Mercury retrogrades', String(data.numbers.mercuryRetrogrades)], ['Jupiter returns', String(data.numbers.jupiterReturns)]];
  const text = [born, 'Your sky milestones', lead, ...data.milestones.map((milestone) => `${capital(milestoneName(milestone))}, age ${milestone.age}: ${span(milestone)}`),
    `${tiles[0][1]} full moons, ${tiles[1][1]} Mercury retrogrades and ${tiles[2][1]} Jupiter returns lived through, as of ${shortDate(data.asOf)}`, plain(data.note), 'zodiacs.org/occasions/milestones']
    .filter(Boolean).join('\n');
  return <Card hue={hueOf(MILESTONE_SIGN[(next ?? data.milestones[0])?.kind ?? 'saturn-return'])}>
    <Head kicker="Life milestones" title="Your sky milestones" meta={<>{born}{data.timeKnown ? '' : ', no birth time given'}</>} art={[{ src: artOf('milestones-hero') }]}/>
    {next && <Hero figure={<NumberRing value={next.age} caption="your age"/>} verdict={lead} summary={MILESTONE_WORDS[next.kind].about}/>}
    {next && <Facts rows={next.passes.map((pass, index) => [passLabel(next, index, pass), <strong>{shortDate(pass.at)}</strong>] as Fact)}/>}
    <Tiles label="Lived through so far" tiles={tiles}/>
    <Section title="Every milestone">
      <Facts rows={data.milestones.slice(0, SHOWN_MILESTONES).map(milestoneRow)}/>
      {data.milestones.length > SHOWN_MILESTONES && <More label={`${data.milestones.length - SHOWN_MILESTONES} later milestones`}><Facts rows={data.milestones.slice(SHOWN_MILESTONES).map(milestoneRow)}/></More>}
    </Section>
    {!data.timeKnown && <p class="quiet">Without a birth time, a date can be a day off.</p>}
    <Actions copyText={text} links={[data.cardUrl && { label: 'Open printable card', href: data.cardUrl }]}/>
    <FinePrint>{plain(data.note)}</FinePrint>
  </Card>;
}

// ── Two charts compared ──────────────────────────────────────────────

const placementLine = (who: CompatibilityData['a']) => [who.sun && `${signName(who.sun)} Sun`, who.moon && `${signName(who.moon)} Moon`, who.rising && `${signName(who.rising)} rising`].filter(Boolean).join(', ') || 'Sun sign unsettled that day';
const basis = (who: CompatibilityData['a']) => (who.famous ? 'their published noon chart' : who.timeKnown && who.placed ? 'birth date, time and place' : who.timeKnown ? 'birth date and time' : 'birth date only');
/** How many contacts show before the rest fold away. */
const SHOWN_CONTACTS = 4;

export function Compatibility({ data: result }: { data: CompatibilityData | CompatibilityNotFound }) {
  if ('found' in result) return <Card hue={null}>
    <Head kicker="Two charts compared" title={`${result.query} is not one Zodiacs publishes`}/>
    <p class="insight">{plain(result.note)}</p>
    <Actions copyText={plain(result.note)} links={[{ label: 'See the people Zodiacs publishes', href: result.directoryUrl }]}/>
  </Card>;
  const data = result;
  const title = `${data.a.label} and ${data.b.label}`;
  const famous = [data.a, data.b].filter((who) => who.famous && who.url);
  const meta = famous.length > 0
    ? famous.map((who) => <span key={who.label}>{who.label}, born {fullDate(who.birthDate)}{who.place && <> in <strong>{who.place}</strong></>}. </span>)
    : basis(data.a) === basis(data.b) ? `Both charts from ${basis(data.a)}.` : `${data.a.label} from ${basis(data.a)}, ${data.b.label} from ${basis(data.b)}.`;
  const contact = (item: CompatibilityData['contacts'][number]) => <>
    <span class="reason-head">{item.aBody} {item.aspect} {item.bBody} <Data>{item.orb}°</Data></span>
    <span>{plain(item.line)}</span>
  </>;
  const text = [title, `${data.score.overall}/100: ${data.score.verdict}`, data.score.headline, `Attraction ${data.score.areas.attraction}, communication ${data.score.areas.communication}, long-term stability ${data.score.areas.stability}`,
    `${data.a.label}: ${placementLine(data.a)}`, `${data.b.label}: ${placementLine(data.b)}`,
    data.signPair ? `${data.signPair.element.label}. ${data.signPair.modality.label}.` : '',
    ...data.contacts.map((item) => `${item.aBody} ${item.aspect} ${item.bBody} (${item.orb}°): ${plain(item.line)}`),
    plain(data.note), data.pageUrl ? bare(data.pageUrl) : 'zodiacs.org/compatibility'].filter(Boolean).join('\n');
  return <Card hue={hueOf(data.a.sun)} hue2={hueOf(data.b.sun)}>
    <Head kicker="Two charts compared" title={title} meta={meta} art={[{ src: artOf(data.a.sun), flip: true }, { src: artOf(data.b.sun) }]}/>
    <Hero figure={<ScoreRing score={data.score.overall}/>} verdict={data.score.verdict} summary={plain(data.score.headline)}/>
    <Chips chips={[data.a, data.b].map((who) => ({ icon: icon(who.sun), name: who.label, detail: placementLine(who) }))}/>
    <Tiles label="The score's three parts" tiles={[['Attraction', data.score.areas.attraction], ['Communication', data.score.areas.communication], ['Long-term stability', data.score.areas.stability]]}/>
    {data.signPair && <p class="insight">{plain(`${data.signPair.element.note} ${data.signPair.modality.note}`)}</p>}
    {data.contacts.length > 0 && <Section title="The closest contacts">
      <Reasons items={data.contacts.slice(0, SHOWN_CONTACTS).map(contact)}/>
      {data.contacts.length > SHOWN_CONTACTS && <More label={`${data.contacts.length - SHOWN_CONTACTS} more ${data.contacts.length - SHOWN_CONTACTS === 1 ? 'contact' : 'contacts'}`}>
        <Reasons items={data.contacts.slice(SHOWN_CONTACTS).map(contact)}/>
      </More>}
    </Section>}
    {data.notes.map((note) => <p class="quiet" key={note}>{plain(note)}</p>)}
    <Actions copyText={text} links={[
      data.shareUrl && { label: 'Share the reading', href: data.shareUrl },
      (data.cardUrl ?? data.pageUrl) && { label: data.cardUrl ? 'Open both charts' : 'Read this pair', href: (data.cardUrl ?? data.pageUrl)! },
      ...famous.map((who) => ({ label: `${who.label}’s chart`, href: who.url! })),
    ]}/>
    <FinePrint>{plain(data.note)}</FinePrint>
  </Card>;
}

// ── Chart twins ──────────────────────────────────────────────────────

const SHARES: Record<string, string> = { 'sun-and-moon': 'Sun and Moon', sun: 'Sun', moon: 'Moon' };
const SHOWN_TWINS = 6;

export function ChartTwins({ data }: { data: ChartTwinsData }) {
  const yours = [data.you.sun && `${signName(data.you.sun)} Sun`, data.you.moon && `${signName(data.you.moon)} Moon`].filter(Boolean).join(', ');
  const sharedSign = (shares: string) => (shares === 'moon' ? data.you.moon : data.you.sun);
  const person = (twin: ChartTwinsData['twins'][number]) => <li key={twin.slug}>
    <SignDisc src={icon(sharedSign(twin.shares))} size="row"/>
    <span class="person-words">
      <a href={twin.url} target="_blank" rel="noreferrer">{twin.name}</a>
      <span class="quiet">{plain(twin.shortDescription)}. Born {shortDate(twin.born)}, shares your {SHARES[twin.shares]}.</span>
    </span>
  </li>;
  const text = ['Your chart twins', yours, ...data.twins.map((twin) => `${twin.name} (${SHARES[twin.shares]}): ${bare(twin.url)}`), ...data.notes.map(plain), 'zodiacs.org/chart-twins'].filter(Boolean).join('\n');
  const signs = data.you.moon ? 'Sun or Moon' : 'Sun';
  const count = data.total === 0 ? 'No one Zodiacs publishes shares these signs yet'
    : data.total === 1 ? `One famous person shares your ${signs}` : `${data.total} famous people share your ${signs}`;
  return <Card hue={hueOf(data.you.sun)} hue2={hueOf(data.you.moon)}>
    <Head kicker="Chart twins" title="Your chart twins" meta={<>Born {fullDate(data.birthDate)}{yours && <>: <strong>{yours}</strong></>}</>} art={[{ src: artOf('twins-hero') }]}/>
    <Hero verdict={count} summary={data.notes[0] && plain(data.notes[0])}/>
    {data.twins.length > 0 && <ul class="people">{data.twins.slice(0, SHOWN_TWINS).map(person)}</ul>}
    {data.twins.length > SHOWN_TWINS && <More label={`${data.twins.length - SHOWN_TWINS} more`}><ul class="people">{data.twins.slice(SHOWN_TWINS).map(person)}</ul></More>}
    {data.total > data.twins.length && <p class="quiet">{data.total} people in all; the page lists every one.</p>}
    {data.notes.slice(1).map((note) => <p class="quiet" key={note}>{plain(note)}</p>)}
    <Actions copyText={text} copyLabel="Copy the list" links={[{ label: 'Find more chart twins', href: data.pageUrl }]}/>
  </Card>;
}

// ── A famous chart ───────────────────────────────────────────────────

export function FamousChart({ data }: { data: FamousChartData }) {
  if (!data.found) return <Card hue={null}>
    <Head kicker="A famous birth chart" title="Not one Zodiacs publishes"/>
    <p class="insight">{plain(data.note)}</p>
    <Actions copyText={plain(data.note)} links={[{ label: 'See the people Zodiacs publishes', href: data.directoryUrl }]}/>
  </Card>;
  const person = data.person;
  const others = person.placements.filter((placement) => placement.body !== 'Sun' && placement.body !== 'Moon');
  const moonLine = person.moon.sign ? `${signName(person.moon.sign)} Moon at ${person.moon.degree!.toFixed(1)}°` : 'The Moon changes sign that day, so its sign is uncertain.';
  const text = [person.name, plain(person.shortDescription), `Born ${fullDate(person.born)} in ${person.birthplace}`, `${signName(person.sun.sign)} Sun${person.moon.sign ? `, ${signName(person.moon.sign)} Moon` : ''}`,
    ...person.placements.map((placement) => `${placement.body}: ${signName(placement.sign)} ${placement.degree.toFixed(1)}°`), plain(person.lede), plain(data.note), bare(person.url)].join('\n');
  return <Card hue={hueOf(person.sun.sign)} hue2={hueOf(person.moon.sign)}>
    <Head kicker="A famous birth chart" title={person.name} art={[{ src: artOf(person.sun.sign) }]}
      meta={<>{plain(person.shortDescription)}<br/>Born {fullDate(person.born)} in <strong>{person.birthplace}</strong></>}/>
    <Hero verdict={`${signName(person.sun.sign)} Sun at ${person.sun.degree.toFixed(1)}°`} summary={moonLine}/>
    <p class="insight">{plain(person.lede)}</p>
    <Section title="The other planets">
      <Facts rows={others.map((placement) => [placement.body, <span class="sign-value"><SignDisc src={icon(placement.sign)} size="row"/>{signName(placement.sign)} <Data>{placement.degree.toFixed(1)}°</Data>{placement.settled ? '' : ' (sign changes that day)'}</span>] as Fact)}/>
    </Section>
    {data.alsoMatched.length > 0 && <p class="quiet">Also: {data.alsoMatched.map((other, index) => <>{index > 0 && ', '}<a href={other.url} target="_blank" rel="noreferrer">{other.name}</a></>)}</p>}
    <Actions copyText={text} links={[{ label: `Open ${person.name}’s chart`, href: person.url }]}/>
    <FinePrint>{plain(data.note)}</FinePrint>
  </Card>;
}

// ── A birthday ───────────────────────────────────────────────────────

export function Birthday({ data }: { data: BirthdayData }) {
  const rows: Fact[] = [];
  if (data.decan) rows.push(['Decan', plain(data.decan.text)]);
  if (data.solarReturn) rows.push([`Solar return ${data.solarReturn.year}`, <strong>{data.solarReturn.instant.local.replace(/^[A-Z][a-z]{2} /u, '').replace(', ', ' at ')}</strong>]);
  const sign = data.sign;
  const about = sign ? `${capital(sign.element)}, ${sign.modality}, ruled by ${sign.ruler}. ${plain(sign.dates)}.` : undefined;
  const text = [`${data.label} birthdays`, sign ? `${sign.name} Sun` : '', about ?? '', plain(data.sunSpan.text), plain(data.cusp?.reading?.text ?? data.cusp?.summary ?? ''),
    ...(data.decan ? [`Decan: ${plain(data.decan.text)}`] : []), ...(data.solarReturn ? [`Solar return ${data.solarReturn.year}: ${data.solarReturn.instant.local}`] : []),
    plain(sign?.meaning ?? ''), plain(data.note), bare(data.pageUrl)].filter(Boolean).join('\n');
  return <Card hue={hueOf(sign?.slug)}>
    <Head kicker="Your birthday" title={`${data.label} birthdays`} meta={plain(data.sunSpan.text)}
      art={sign ? [{ src: artOf(sign.slug) }] : data.cusp ? [{ src: artOf(data.cusp.signs[0]), flip: true }, { src: artOf(data.cusp.signs[1]) }] : undefined}/>
    <Hero verdict={sign ? `${sign.name} Sun` : 'On the cusp'} summary={about ?? (data.cusp ? plain(data.cusp.summary) : undefined)}/>
    {data.cusp && <p class="insight">{plain(data.cusp.reading?.text ?? data.cusp.summary)}</p>}
    {rows.length > 0 && <Facts rows={rows}/>}
    {sign && <p class="insight">{plain(sign.meaning)}</p>}
    {data.solarReturn && <p class="quiet">{plain(data.solarReturn.note)}</p>}
    <Actions copyText={text} links={[{ label: `Open the ${data.label} page`, href: data.pageUrl }]}/>
    <FinePrint>{plain(data.note)}</FinePrint>
  </Card>;
}

// ── The sky calendar ─────────────────────────────────────────────────

export function SkyCalendar({ data }: { data: SkyCalendarData }) {
  const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso));
  const span = (event: SkyCalendarData['next'][number]) => (event.end ? `${when(event.start)} to ${when(event.end)}` : when(event.start));
  return <Card hue={hueOf('scorpio')} hue2={hueOf('cancer')}>
    <Head kicker="Sky calendar" title="The sky in your calendar" meta="New and full Moons, eclipses and retrogrades, kept up to date in your calendar app." art={[{ src: artOf('sky-calendar-hero') }]}/>
    <div class="actions"><a class="primary" href={data.subscribeUrl} target="_blank" rel="noreferrer">Subscribe in your calendar app</a></div>
    {data.next.length > 0 && <Section title="Coming up">
      <Facts rows={data.next.map((event) => [event.title, span(event)] as Fact)}/>
    </Section>}
    <Section title="Add it by hand">
      <Facts stacked rows={[['Google Calendar', data.howTo.google], ['Apple Calendar', data.howTo.apple], ['Outlook', data.howTo.outlook]]}/>
      <p class="quiet">Feed address: <code>{data.feedUrl}</code></p>
    </Section>
    <Actions copyText={`Zodiacs sky calendar: ${data.feedUrl}`} copyLabel="Copy the feed address" links={[{ label: 'Open the sky calendar page', href: data.pageUrl }]}/>
    <FinePrint>{plain(data.note)}</FinePrint>
  </Card>;
}
