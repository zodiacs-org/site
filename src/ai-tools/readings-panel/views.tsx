/**
 * The readings panel's five cards: a birth chart, a period horoscope, the
 * Chinese zodiac, personal transits and an explainer. The art is chosen
 * here. No link is labelled Share, and chartUrl does not carry birth details.
 */
import { Actions, artOf, Card, Chips, CopyCard, Data, Facts, FinePrint, Fold, Head, Hero, Keepsake, Section, SignDisc, type Fact } from '../card-kit/parts';
import { hueOf } from '../card-kit/hue';
import { capital, list, plain, signName } from '../card-kit/words';
import type { NatalChartData } from '../features/natal-chart';
import type { HoroscopePeriodData } from '../features/horoscope-period';
import type { ChineseZodiacData } from '../features/chinese-zodiac';
import type { PersonalTransitsData } from '../features/personal-transits';
import type { ExplainData } from '../features/explain';
import './style.css';

declare const READINGS_ICONS: Record<string, string>;
const icon = (slug: string | null | undefined) => (slug ? READINGS_ICONS[slug] : undefined);
const holds = (parts: (string | false | null | undefined | '')[]) => capital(list(parts.filter((part): part is string => !!part)));

function chip(slug: string | null, name: string, detail?: string) {
  return { icon: icon(slug), name: slug ? `${signName(slug)} ${name}` : name, detail };
}

export function NatalChart({ data }: { data: NatalChartData }) {
  const sun = data.sun.sign;
  const moon = data.moon.sign;
  const rising = data.rising.sign;
  const title = sun ? `${signName(sun)} Sun` : 'Birth chart';
  const planets = data.planets.filter((row) => row.body !== 'Sun' && row.body !== 'Moon');
  const text = [title, data.moon.sign ? `${signName(data.moon.sign)} Moon` : '', rising ? `${signName(rising)} rising` : '', ...data.unknown, ...data.aspects.map((aspect) => plain(aspect.line)), data.note, 'zodiacs.org/birth-chart'].filter(Boolean).join('\n');
  return <Card hue={hueOf(sun)} hue2={hueOf(moon)} front={sun}>
    <Keepsake kicker="Birth chart" title={title} art={[{ src: artOf(sun ?? 'milestones-hero') }, { src: artOf(moon), flip: true }]}
      signs={[icon(sun), icon(moon), icon(rising)]}
      meta={<>{data.timeKnown ? 'Birth time given' : 'No birth time'}{data.placed ? ', place given' : ''}</>}/>
    <Hero verdict={rising ? `${signName(rising)} rising` : 'Rising sign unknown'} summary={data.sun.meaning ? plain(data.sun.meaning) : data.unknown[0]}/>
    <Fold hint={holds(['the big three', 'the planets', data.aspects.length > 0 && 'the closest aspects', 'the balance'])}>
      <Chips chips={[
        chip(sun, 'Sun', data.planets[0]?.position ?? undefined),
        chip(moon, 'Moon', data.moon.possibleSigns.length > 1 ? data.moon.possibleSigns.map(signName).join(' or ') : data.planets[1]?.position ?? undefined),
        chip(rising, 'rising'),
      ]}/>
      {data.unknown.length > 0 && data.unknown.map((line) => <p class="quiet" key={line}>{line}</p>)}
      {data.timeNote && <p class="quiet">{data.timeNote.text}</p>}
      {data.placeNote && <p class="quiet">{data.placeNote}</p>}
      <Section title="The planets">
        <Facts rows={planets.map((row) => [row.body, <span class="sign-value">{row.sign ? <><SignDisc src={icon(row.sign)} size="row"/>{signName(row.sign)} {row.position && <Data>{row.position}</Data>}{row.house ? `, house ${row.house}` : ''}</> : row.possibleSigns.map(signName).join(' or ')}</span>] as Fact)}/>
      </Section>
      {data.aspects.length > 0 && <Section title="The closest aspects"><ul class="reading-list">{data.aspects.map((aspect) => <li key={`${aspect.a}-${aspect.b}`}>{plain(aspect.line)}</li>)}</ul></Section>}
      {data.balance.lines.length > 0 && <Section title="Balance"><ul class="reading-list">{data.balance.lines.map((line) => <li key={line}>{plain(line)}</li>)}</ul></Section>}
      <CopyCard text={text} label="Copy the reading"/>
    </Fold>
    <Actions primary={{ label: 'Open the chart page', href: data.chartUrl }}/>
    <FinePrint>{plain(data.note)}</FinePrint>
  </Card>;
}

export function HoroscopePeriod({ data }: { data: HoroscopePeriodData }) {
  const reading = data.reading?.paragraphs.map((paragraph) => paragraph.text).join(' ') ?? data.message ?? 'No reading is published for this period. The sky is below.';
  const text = [data.signName, data.label, reading, ...data.sky.map((event) => plain(event.line)), data.pageUrl].join('\n');
  return <Card hue={hueOf(data.sign)} front={data.sign}>
    <Keepsake kicker={capital(data.period)} title={`${data.signName}`} art={[{ src: artOf(data.sign) }]} signs={[icon(data.sign)]}
      meta={<>{data.label}{data.reading ? <>, reading confidence <strong>{data.reading.confidence}%</strong></> : ''}</>}/>
    <Hero verdict={data.status === 'available' ? 'Published reading' : 'Sky only'} summary={plain(data.reading?.paragraphs[0]?.text ?? data.message ?? '')}/>
    <Fold hint={holds([data.reading && 'the reading', data.sky.length > 0 && 'the sky', 'the page'])}>
      {data.reading?.paragraphs.map((paragraph, index) => <p class="insight" key={index}>{paragraph.heading ? <strong>{paragraph.heading}. </strong> : null}{plain(paragraph.text)}</p>)}
      {data.message && <p class="quiet">{data.message}</p>}
      {data.focusReadings.length > 0 && <Section title="This week's days"><ul class="reading-list">{data.focusReadings.map((day) => <li key={day.date}><strong>{day.date}</strong> {plain(day.paragraphs[0]?.text ?? '')} Reading confidence {day.confidence}%.</li>)}</ul></Section>}
      {data.sky.length > 0 && <Section title="The sky"><ul class="reading-list">{data.sky.map((event) => <li key={event.utc}>{plain(event.line)}</li>)}</ul></Section>}
      <CopyCard text={text} label="Copy the reading"/>
    </Fold>
    <Actions primary={{ label: 'Open the horoscope', href: data.pageUrl }}/>
    <FinePrint>{plain(data.disclosure)}</FinePrint>
  </Card>;
}

export function ChineseZodiac({ data }: { data: ChineseZodiacData }) {
  const animal = data.person?.animal ?? data.current.animal;
  const year = data.person ?? data.current;
  return <Card hue={null}>
    <Keepsake kicker="Chinese zodiac" title={year.label} art={[{ src: artOf(`chinese-${animal.slug}`) }]}
      meta={<>{year.starts} to {year.ends}</>}/>
    <Hero verdict={animal.name} summary={data.boundary?.text ?? data.person?.association}/>
    <Fold hint={holds(['the pairings', 'this year', 'the guide'])}>
      {data.person && <p class="insight">{data.person.association} {data.person.context}</p>}
      {data.person && <p class="quiet">{data.person.pairings.text}</p>}
      {data.zoneNote && <p class="quiet">{data.zoneNote}</p>}
      <p class="quiet">This year: {data.current.label}.</p>
      <CopyCard text={[year.label, data.boundary?.text ?? '', data.person?.pairings.text ?? '', data.guideUrl].filter(Boolean).join('\n')} label="Copy the reading"/>
    </Fold>
    <Actions primary={{ label: data.person ? `Open the ${animal.name}` : 'Open the guide', href: data.person?.animal.pageUrl ?? data.guideUrl }} secondary={data.person ? { label: 'All twelve animals', href: data.guideUrl } : false}/>
    <FinePrint>{plain(data.note)}</FinePrint>
  </Card>;
}

export function PersonalTransits({ data }: { data: PersonalTransitsData }) {
  const rows = data.mode === 'year-ahead' ? data.highlights.map((item) => ({ key: `${item.kind}-${item.date}-${item.planet}`, date: item.date, line: item.line, confidence: item.confidence })) : data.contacts.map((item) => ({ key: item.exactUtc, date: item.date, line: item.line, confidence: item.confidence }));
  return <Card hue={hueOf(data.sun)} front={data.sun}>
    <Keepsake kicker={data.mode === 'year-ahead' ? 'Year ahead' : 'Transits'} title={data.sun ? `${signName(data.sun)} Sun` : 'Your transits'} art={[{ src: artOf(data.sun ?? 'milestones-hero') }]} signs={[icon(data.sun)]}
      meta={<>{data.from} to {data.to}, {data.zone}</>}/>
    <Hero verdict={rows[0] ? `Reading confidence ${rows[0].confidence}%` : 'Nothing in this window'} summary={rows[0] ? plain(rows[0].line) : data.limits[0]}/>
    <Fold hint={holds([rows.length > 0 && 'the dates', 'what was left out'])}>
      {rows.length > 0 && <ul class="reading-list">{rows.map((row) => <li key={row.key}><strong>{row.date}</strong> {plain(row.line)}</li>)}</ul>}
      {data.limits.map((line) => <p class="quiet" key={line}>{line}</p>)}
      {data.placeNote && <p class="quiet">{data.placeNote}</p>}
      <CopyCard text={[`${data.from} to ${data.to}`, ...rows.map((row) => `${row.date}: ${plain(row.line)}`), data.pageUrl].join('\n')} label="Copy the reading"/>
    </Fold>
    <Actions primary={{ label: 'Open transits', href: data.pageUrl }}/>
    <FinePrint>{plain(data.note)}</FinePrint>
  </Card>;
}

export function Explainer({ data }: { data: ExplainData }) {
  const sign = data.topic && hueOf(data.topic) ? data.topic : null;
  if (!data.found) return <Card hue={null}>
    <Head kicker="Astrology explained" title="Not a topic Zodiacs explains" art={[{ src: artOf('milestones-hero') }]}/>
    <p class="insight">{data.message}</p>
    <Fold hint="The topics Zodiacs does explain">
      <ul class="reading-list">{data.topics.map((topic) => <li key={topic}>{topic}</li>)}</ul>
    </Fold>
    <FinePrint>{plain(data.note)}</FinePrint>
  </Card>;
  const page = data.pages[0];
  return <Card hue={hueOf(sign)} front={sign}>
    <Keepsake kicker="Astrology explained" title={data.title ?? 'Explained'} art={[{ src: artOf(sign ?? 'milestones-hero') }]} signs={[icon(sign)]}/>
    <Hero verdict={data.title ?? ''} summary={plain(data.paragraphs[0] ?? '')}/>
    <Fold hint={holds(['the rest', data.terms.length > 0 && 'terms', page && 'the page'])}>
      {data.paragraphs.slice(1).map((paragraph, index) => <p class="insight" key={index}>{plain(paragraph)}</p>)}
      {data.message && <p class="quiet">{data.message}</p>}
      {data.terms.length > 0 && <Facts rows={data.terms.map((term) => [term.term, plain(term.definition)] as Fact)}/>}
      <CopyCard text={[data.title ?? '', ...data.paragraphs.map(plain), page?.url ?? ''].filter(Boolean).join('\n')} label="Copy the explainer"/>
    </Fold>
    {page && <Actions primary={{ label: 'Open the page', href: page.url }}/>}
    <FinePrint>{plain(data.note)}</FinePrint>
  </Card>;
}
