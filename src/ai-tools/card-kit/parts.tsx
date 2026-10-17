/**
 * The parts every assistant card is made of, so the eight cards read as one
 * family: the nameplate, a head (kicker, title, meta), a hero row between
 * hairlines (a score ring or a sign disc beside a verdict), sign chips,
 * number tiles, reasons, facts, text actions and the fine print.
 */
import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { BrandRing } from '../panel-brand';
import { hueVars } from './hue';
import './card.css';

/** The site's nameplate: the twelve-dot ring, "Zodiacs" in the masthead serif and a small ".org". */
export function Nameplate({ href = 'https://zodiacs.org/' }: { href?: string }) {
  return <a class="nameplate" href={href} target="_blank" rel="noreferrer">
    <BrandRing size={22}/>
    <span class="nameplate-name">Zodiacs<span class="nameplate-tld">.org</span></span>
  </a>;
}

export function Card({ hue, hue2, label, children }: { hue: string | null; hue2?: string | null; label?: string; children: ComponentChildren }) {
  return <article class="card" style={hueVars(hue, hue2) as JSX.CSSProperties} aria-label={label}>
    <Nameplate/>
    {children}
  </article>;
}

export function Head({ kicker, title, meta, aside }: { kicker: ComponentChildren; title: ComponentChildren; meta?: ComponentChildren; aside?: ComponentChildren }) {
  return <header class="card-head">
    <div class="card-head-text">
      <p class="kicker">{kicker}</p>
      <h1>{title}</h1>
      {meta && <p class="meta">{meta}</p>}
    </div>
    {aside}
  </header>;
}

/** A score out of 100: a ring filled to the score, drawn from one hue to the other. */
export function ScoreRing({ score }: { score: number }) {
  return <div class="ring" role="img" aria-label={`${score} out of 100`} style={{ '--score': String(score) } as JSX.CSSProperties}>
    <span class="ring-number" aria-hidden="true">{score}</span>
    <span class="ring-out" aria-hidden="true">out of 100</span>
  </div>;
}

/** A number that is not a score, such as an age, inside a plain ring in the card's hue. */
export function NumberRing({ value, caption }: { value: string | number; caption: string }) {
  return <div class="ring ring-plain">
    <span class="ring-number">{value}</span>
    <span class="ring-out">{caption}</span>
  </div>;
}

export function SignDisc({ src, size }: { src: string | undefined; size: 'hero' | 'head' | 'chip' | 'row' }) {
  return src ? <img class={`disc disc-${size}`} src={src} alt=""/> : <span class={`disc disc-${size} disc-empty`} aria-hidden="true"/>;
}

/** The hero row: a figure (score ring, number ring or sign disc) beside the verdict and one line about it. */
export function Hero({ figure, verdict, summary }: { figure: ComponentChildren; verdict: ComponentChildren; summary?: ComponentChildren }) {
  return <section class="hero">
    <div class="hero-figure">{figure}</div>
    <div class="hero-words">
      <p class="verdict">{verdict}</p>
      {summary && <p class="summary">{summary}</p>}
    </div>
  </section>;
}

export interface Chip { icon: string | undefined; name: ComponentChildren; detail?: ComponentChildren }
export function Chips({ chips }: { chips: Chip[] }) {
  return <ul class={`chips${chips.length === 1 ? ' chips-one' : ''}`}>{chips.map((chip, index) => <li key={index}>
    <SignDisc src={chip.icon} size="chip"/>
    <span class="chip-words"><strong>{chip.name}</strong>{chip.detail && <span>{chip.detail}</span>}</span>
  </li>)}</ul>;
}

export function Tiles({ tiles, label }: { tiles: [string, string | number][]; label: string }) {
  return <dl class="tiles" aria-label={label}>{tiles.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
}

export function Reasons({ items }: { items: ComponentChildren[] }) {
  return <ul class="reasons">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
}

export type Fact = [string, ComponentChildren];
export function Facts({ rows, stacked = false }: { rows: Fact[]; stacked?: boolean }) {
  return <dl class={`facts${stacked ? ' facts-stacked' : ''}`}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

/** Clock times and degrees are computed data, set in the data face. */
export const Data = ({ children }: { children: ComponentChildren }) => <span class="data">{children}</span>;

export function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return <section class="card-section"><h2>{title}</h2>{children}</section>;
}

/** Extra rows behind a disclosure, so a long list keeps the card short. */
export function More({ label, children }: { label: string; children: ComponentChildren }) {
  return <details class="more"><summary>{label}</summary>{children}</details>;
}

export interface Action { label: string; href: string }
/** Underlined text actions: links that open on zodiacs.org, and a copy button that gives the card as text. */
export function Actions({ links, copyText, copyLabel = 'Copy the card' }: { links: (Action | null | false | undefined)[]; copyText: string; copyLabel?: string }) {
  const [status, setStatus] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(copyText); setStatus('Copied.'); }
    catch { setStatus('Copying isn’t allowed here. Select the text to copy it.'); }
  }
  return <div class="actions-block">
    <div class="actions">
      {links.filter((link): link is Action => !!link).map((link) => <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>)}
      <button type="button" onClick={copy}>{copyLabel}</button>
    </div>
    <p role="status" class="status">{status}</p>
  </div>;
}

export const FinePrint = ({ children }: { children: ComponentChildren }) => <p class="fine">{children}</p>;

export function PanelFooter({ children }: { children: ComponentChildren }) {
  return <footer class="panel-foot"><p>{children}</p><a href="https://zodiacs.org/privacy/" target="_blank" rel="noreferrer">Privacy</a></footer>;
}
