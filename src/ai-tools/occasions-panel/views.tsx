import { BrandRing } from '../panel-brand';
import { useState } from 'preact/hooks';
import type { CompatibilityData } from '../features/compatibility';
import type { ChartTwinsData, FamousChartData } from '../features/people';
import type { BirthdayData, SkyCalendarData } from '../features/birthday';

declare const OCCASIONS_ICONS: Record<string, string>;

export const signName = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1);
const day = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
const ASPECT_SIGNS: Record<string, string> = { conjunction: '☌', sextile: '⚹', square: '□', trine: '△', opposition: '☍' };

/** Every card ends with the same mark, so a screenshot still says where it came from. */
export function Signature() {
  return <p class="signature" aria-label="zodiacs.org">
    <BrandRing size={28}/>
    <span>zodiacs.org</span>
  </p>;
}

/** The big shareable number: a score out of 100 and its one-line verdict. */
export function Score({ score, verdict, parts }: { score: number; verdict: string; parts?: [string, number][] }) {
  return <div class="score">
    <p class="score-main"><strong>{score}</strong><span>/100</span></p>
    <p class="score-verdict">{verdict}</p>
    {parts && <div class="numbers">{parts.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>}
  </div>;
}

export function Actions({ text, cardUrl, cardLabel, copyLabel = 'Copy the card' }: { text: string; cardUrl: string | null; cardLabel: string; copyLabel?: string }) {
  const [status, setStatus] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(text); setStatus('Copied.'); }
    catch { setStatus('Copying isn’t allowed here. Select the text to copy it.'); }
  }
  return <>
    <div class="actions">
      <button onClick={copy}>{copyLabel}</button>
      {cardUrl && <a href={cardUrl} target="_blank" rel="noreferrer">{cardLabel} ↗</a>}
    </div>
    <p role="status" class="quiet">{status}</p>
  </>;
}

function Disc({ sign, label, detail }: { sign: string | null; label: string; detail?: string }) {
  return <div class="disc">
    {sign ? <img src={OCCASIONS_ICONS[sign]} alt="" width="48" height="48"/> : <span class="disc-empty" aria-hidden="true"/>}
    <div><strong>{label}</strong>{detail && <span class="quiet">{detail}</span>}</div>
  </div>;
}

const placementLine = (who: CompatibilityData['a']) => [who.sun && `${signName(who.sun)} Sun`, who.moon && `${signName(who.moon)} Moon`, who.rising && `${signName(who.rising)} rising`].filter(Boolean).join(' · ') || 'Sun sign unsettled that day';

export function Compatibility({ data }: { data: CompatibilityData }) {
  const title = `${data.a.label} and ${data.b.label}`;
  const text = [title, `${data.score.overall}/100 · ${data.score.verdict}`, data.score.headline, `${data.a.label}: ${placementLine(data.a)}`, `${data.b.label}: ${placementLine(data.b)}`,
    data.signPair ? `${data.signPair.element.label}. ${data.signPair.modality.label}.` : '',
    ...data.contacts.map((contact) => `${contact.aBody} ${contact.aspect} ${contact.bBody} (${contact.orb}°): ${contact.line}`),
    data.note, data.pageUrl ? data.pageUrl.replace(/^https:\/\//u, '').replace(/\?.*$/u, '') : 'zodiacs.org/compatibility'].filter(Boolean).join('\n');
  return <article class="card">
    <p class="kicker">Two charts compared</p>
    <h1>{title}</h1>
    <div class="discs">
      <Disc sign={data.a.sun} label={data.a.label} detail={placementLine(data.a)}/>
      <Disc sign={data.b.sun} label={data.b.label} detail={placementLine(data.b)}/>
    </div>
    <Score score={data.score.overall} verdict={data.score.verdict} parts={[['attraction', data.score.areas.attraction], ['communication', data.score.areas.communication], ['long-term stability', data.score.areas.stability]]}/>
    <p class="words">{data.score.headline}</p>
    {data.signPair && <p class="words">{data.signPair.element.note} {data.signPair.modality.note}</p>}
    {data.contacts.length > 0 && <>
      <h2>The closest contacts</h2>
      <ul class="contacts">{data.contacts.map((contact) => <li key={`${contact.aBody}-${contact.aspect}-${contact.bBody}`}>
        <span class="contact-head">{contact.aBody} <span aria-label={contact.aspect}>{ASPECT_SIGNS[contact.aspect] ?? contact.aspect}</span> {contact.bBody} <span class="quiet">{contact.orb}°</span></span>
        <span>{contact.line}</span>
      </li>)}</ul>
    </>}
    {data.notes.map((note) => <p class="quiet" key={note}>{note}</p>)}
    <Actions text={text} cardUrl={data.cardUrl ?? data.pageUrl} cardLabel={data.cardUrl ? 'Open both charts on zodiacs.org' : 'Read this pair on zodiacs.org'}/>
    <p class="disclosure">{data.note}</p>
    <Signature/>
  </article>;
}

const SHARES: Record<string, string> = { 'sun-and-moon': 'Sun and Moon', sun: 'Sun', moon: 'Moon' };

export function ChartTwins({ data }: { data: ChartTwinsData }) {
  const yours = [data.you.sun && `${signName(data.you.sun)} Sun`, data.you.moon && `${signName(data.you.moon)} Moon`].filter(Boolean).join(' · ');
  const text = ['Your chart twins', yours, ...data.twins.map((twin) => `${twin.name} (${SHARES[twin.shares]}): ${twin.url.replace(/\?.*$/u, '')}`), ...data.notes, 'zodiacs.org/chart-twins'].filter(Boolean).join('\n');
  return <article class="card">
    <p class="kicker">Born {day(data.birthDate)}{yours ? ` · ${yours}` : ''}</p>
    <h1>Your chart twins</h1>
    {data.twins.length > 0
      ? <ul class="people">{data.twins.map((twin) => <li key={twin.slug}>
        <a href={twin.url} target="_blank" rel="noreferrer">{twin.name}</a>
        <span class="quiet">{twin.shortDescription} · born {day(twin.born)} · shares your {SHARES[twin.shares]}</span>
      </li>)}</ul>
      : <p class="words">No one in the people Zodiacs publishes shares these signs.</p>}
    {data.total > data.twins.length && <p class="quiet">{data.total} people in all; the page lists every one.</p>}
    {data.notes.map((note) => <p class="quiet" key={note}>{note}</p>)}
    <Actions text={text} cardUrl={data.pageUrl} cardLabel="Find more chart twins" copyLabel="Copy the list"/>
    <Signature/>
  </article>;
}

export function FamousChart({ data }: { data: FamousChartData }) {
  if (!data.found) return <article class="card">
    <p class="kicker">Famous birth charts</p>
    <h1>Not one Zodiacs publishes</h1>
    <p class="words">{data.note}</p>
    <Actions text={data.note} cardUrl={data.directoryUrl} cardLabel="See the people Zodiacs publishes"/>
    <Signature/>
  </article>;
  const person = data.person;
  const text = [person.name, person.shortDescription, `Born ${day(person.born)}`, `${signName(person.sun.sign)} Sun${person.moon.sign ? ` · ${signName(person.moon.sign)} Moon` : ''}`,
    ...person.placements.map((placement) => `${placement.body}: ${signName(placement.sign)} ${placement.degree.toFixed(1)}°`), person.lede, data.note, person.url.replace(/\?.*$/u, '').replace(/^https:\/\//u, '')].join('\n');
  return <article class="card">
    <p class="kicker">{person.shortDescription} · born {day(person.born)}</p>
    <h1>{person.name}</h1>
    <div class="discs">
      <Disc sign={person.sun.sign} label={`${signName(person.sun.sign)} Sun`} detail={`${person.sun.degree.toFixed(1)}°`}/>
      <Disc sign={person.moon.sign} label={person.moon.sign ? `${signName(person.moon.sign)} Moon` : 'Moon sign uncertain'} detail={person.moon.degree === null ? 'it changes sign that day' : `${person.moon.degree.toFixed(1)}°`}/>
    </div>
    <p class="words">{person.lede}</p>
    <dl class="rows">{person.placements.filter((placement) => placement.body !== 'Sun' && placement.body !== 'Moon').map((placement) => <div key={placement.body}>
      <dt>{placement.body}</dt><dd>{signName(placement.sign)} {placement.degree.toFixed(1)}°{placement.settled ? '' : ' (sign changes that day)'}</dd>
    </div>)}</dl>
    {data.alsoMatched.length > 0 && <p class="quiet">Also: {data.alsoMatched.map((other, index) => <>{index > 0 && ', '}<a href={other.url} target="_blank" rel="noreferrer">{other.name}</a></>)}</p>}
    <Actions text={text} cardUrl={person.url} cardLabel={`${person.name}'s chart on zodiacs.org`}/>
    <p class="disclosure">{data.note}</p>
    <Signature/>
  </article>;
}

export function Birthday({ data }: { data: BirthdayData }) {
  const rows: [string, string][] = [];
  if (data.sign) rows.push(['Element and mode', `${data.sign.element}, ${data.sign.modality}`], ['Ruler', data.sign.ruler]);
  if (data.decan) rows.push(['Decan', data.decan.text]);
  if (data.solarReturn) rows.push([`Solar return ${data.solarReturn.year}`, data.solarReturn.instant.local]);
  const text = [`${data.label} birthdays`, data.sign ? `${data.sign.name} Sun` : '', data.cusp?.reading?.text ?? data.cusp?.summary ?? '', ...rows.map(([label, value]) => `${label}: ${value}`),
    data.sign?.meaning ?? '', data.note, data.pageUrl.replace(/\?.*$/u, '').replace(/^https:\/\//u, '')].filter(Boolean).join('\n');
  return <article class="card">
    <p class="kicker">{data.sunSpan.text}</p>
    <h1>{data.label} birthdays</h1>
    {data.sign && <div class="discs"><Disc sign={data.sign.slug} label={`${data.sign.name} Sun`} detail={data.sign.dates}/></div>}
    {data.cusp && <p class="words">{data.cusp.reading?.text ?? data.cusp.summary}</p>}
    {rows.length > 0 && <dl class="rows">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {data.sign && <p class="words">{data.sign.meaning}</p>}
    {data.solarReturn && <p class="quiet">{data.solarReturn.note}</p>}
    <Actions text={text} cardUrl={data.pageUrl} cardLabel={`${data.label} on zodiacs.org`}/>
    <p class="disclosure">{data.note}</p>
    <Signature/>
  </article>;
}

export function SkyCalendar({ data }: { data: SkyCalendarData }) {
  const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso));
  return <article class="card">
    <p class="kicker">New and full Moons, eclipses and retrogrades</p>
    <h1>The sky in your calendar</h1>
    <div class="actions">
      <a class="primary" href={data.subscribeUrl} target="_blank" rel="noreferrer">Subscribe in your calendar app</a>
    </div>
    <dl class="rows">
      <div><dt>Google Calendar</dt><dd>{data.howTo.google}</dd></div>
      <div><dt>Apple Calendar</dt><dd>{data.howTo.apple}</dd></div>
      <div><dt>Outlook</dt><dd>{data.howTo.outlook}</dd></div>
    </dl>
    <p class="quiet">Feed address: <code>{data.feedUrl}</code></p>
    {data.next.length > 0 && <>
      <h2>Coming up</h2>
      <dl class="rows">{data.next.map((event) => <div key={event.start}><dt>{event.title}</dt><dd>{when(event.start)}</dd></div>)}</dl>
    </>}
    <Actions text={`Zodiacs sky calendar: ${data.feedUrl}`} cardUrl={data.pageUrl} cardLabel="The sky calendar on zodiacs.org" copyLabel="Copy the feed address"/>
    <p class="disclosure">{data.note}</p>
    <Signature/>
  </article>;
}
