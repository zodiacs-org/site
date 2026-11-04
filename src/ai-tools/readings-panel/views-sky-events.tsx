/**
 * The readings panel as it is offered while ZODIACS_SKY_EVENTS_ENABLED=1
 * (READINGS_SKY_EVENTS_URI): the same five cards, but a birth chart that
 * lists the lunar nodes get_natal_chart then returns, beside the planets, each
 * body with the site's own glyph (src/lib/glyphs/paths.ts).
 *
 * scripts/build-readings-panel.mjs builds this panel from app.tsx with this
 * module in place of ./views, so the panel the directories reviewed
 * (READINGS_URI) is built from unchanged sources and keeps its bytes.
 */
import type { ComponentChildren } from 'preact';
import { Actions, artOf, Card, Chips, CopyCard, Data, FinePrint, Fold, Hero, Keepsake, Section, SignDisc } from '../card-kit/parts';
import { hueOf } from '../card-kit/hue';
import { capital, list, plain, signName } from '../card-kit/words';
import { PLANET_GLYPH } from '../../lib/glyphs/paths';
import type { NatalChartData, NatalChartDataWithNodes } from '../features/natal-chart';

export { ChineseZodiac, Explainer, HoroscopePeriod, PersonalTransits } from './views';

declare const READINGS_ICONS: Record<string, string>;
const icon = (slug: string | null | undefined) => (slug ? READINGS_ICONS[slug] : undefined);
const holds = (parts: (string | false | null | undefined | '')[]) => capital(list(parts.filter((part): part is string => !!part)));

function chip(slug: string | null, name: string, detail?: string) {
  return { icon: icon(slug), name: slug ? `${signName(slug)} ${name}` : name, detail };
}

/** A body's glyph, drawn as the site draws it (PlanetGlyph): line art in the text's colour. */
function Glyph({ body }: { body: string }) {
  const markup = PLANET_GLYPH[body];
  return markup ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" style="flex:none;margin-right:7px;vertical-align:-3px" dangerouslySetInnerHTML={{ __html: markup }}/> : null;
}

interface Placement { sign: string | null; possibleSigns: string[]; position: string | null; house: number | null }

/** A body's sign, degree and house, or the signs it could be in that day. */
function placed(row: Placement): ComponentChildren {
  return <span class="sign-value">{row.sign
    ? <><SignDisc src={icon(row.sign)} size="row"/>{signName(row.sign)} {row.position && <Data>{row.position}</Data>}{row.house ? `, house ${row.house}` : ''}</>
    : row.possibleSigns.map(signName).join(' or ')}</span>;
}

/** The facts rows, as the card kit sets them, with each body's glyph before its name. */
function BodyFacts({ rows }: { rows: { body: string; value: ComponentChildren }[] }) {
  return <dl class="facts">{rows.map(({ body, value }) => <div key={body}><dt><Glyph body={body}/>{body}</dt><dd>{value}</dd></div>)}</dl>;
}

const hasNodes = (data: NatalChartData | NatalChartDataWithNodes): data is NatalChartDataWithNodes => 'nodes' in data && !!data.nodes;

export function NatalChart({ data }: { data: NatalChartData | NatalChartDataWithNodes }) {
  const sun = data.sun.sign;
  const moon = data.moon.sign;
  const rising = data.rising.sign;
  const title = sun ? `${signName(sun)} Sun` : 'Birth chart';
  const planets = data.planets.filter((row) => row.body !== 'Sun' && row.body !== 'Moon');
  const nodes = hasNodes(data) ? [{ body: 'North Node', ...data.nodes.north }, { body: 'South Node', ...data.nodes.south }] : [];
  const nodeText = nodes.map((node) => `${node.body}: ${node.sign ? `${signName(node.sign)}${node.position ? ` ${node.position}` : ''}` : node.possibleSigns.map(signName).join(' or ')}`);
  const text = [title, data.moon.sign ? `${signName(data.moon.sign)} Moon` : '', rising ? `${signName(rising)} rising` : '', ...nodeText, ...data.unknown, ...data.aspects.map((aspect) => plain(aspect.line)), data.note, 'zodiacs.org/birth-chart'].filter(Boolean).join('\n');
  return <Card hue={hueOf(sun)} hue2={hueOf(moon)} front={sun}>
    <Keepsake kicker="Birth chart" title={title} art={[{ src: artOf(sun ?? 'milestones-hero') }, { src: artOf(moon), flip: true }]}
      signs={[icon(sun), icon(moon), icon(rising)]}
      meta={<>{data.timeKnown ? 'Birth time given' : 'No birth time'}{data.placed ? ', place given' : ''}</>}/>
    <Hero verdict={rising ? `${signName(rising)} rising` : 'Rising sign unknown'} summary={data.sun.meaning ? plain(data.sun.meaning) : data.unknown[0]}/>
    <Fold hint={holds(['the big three', 'the planets', nodes.length > 0 && 'the lunar nodes', data.aspects.length > 0 && 'the closest aspects', 'the balance'])}>
      <Chips chips={[
        chip(sun, 'Sun', data.planets[0]?.position ?? undefined),
        chip(moon, 'Moon', data.moon.possibleSigns.length > 1 ? data.moon.possibleSigns.map(signName).join(' or ') : data.planets[1]?.position ?? undefined),
        chip(rising, 'rising'),
      ]}/>
      {data.unknown.length > 0 && data.unknown.map((line) => <p class="quiet" key={line}>{line}</p>)}
      {data.timeNote && <p class="quiet">{data.timeNote.text}</p>}
      <Section title="The planets">
        <BodyFacts rows={planets.map((row) => ({ body: row.body, value: placed(row) }))}/>
      </Section>
      {hasNodes(data) && <Section title="The lunar nodes">
        <BodyFacts rows={nodes.map((node) => ({ body: node.body, value: placed(node) }))}/>
        <p class="quiet">{data.nodes.about}</p>
      </Section>}
      {data.aspects.length > 0 && <Section title="The closest aspects"><ul class="reading-list">{data.aspects.map((aspect) => <li key={`${aspect.a}-${aspect.b}`}>{plain(aspect.line)}</li>)}</ul></Section>}
      {data.balance.lines.length > 0 && <Section title="Balance"><ul class="reading-list">{data.balance.lines.map((line) => <li key={line}>{plain(line)}</li>)}</ul></Section>}
      <CopyCard text={text} label="Copy the reading"/>
    </Fold>
    <Actions primary={{ label: 'Open the chart page', href: data.chartUrl }}/>
    <FinePrint>{plain(data.note)}</FinePrint>
  </Card>;
}
