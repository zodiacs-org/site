/**
 * The parts every assistant card is made of, so the eight cards read as one
 * family. Since the owner's 2026-10-18 picks every card is a keepsake: the
 * nameplate, the hero art large across the top with the sign discs on its
 * lower edge, the kicker, title and meta line centred under it, a compact
 * hero row (a score ring beside the verdict), then one disclosure, "More
 * from this reading", that holds the rest (sign chips, number tiles,
 * reasons, facts and a copy of the card), the card's two actions and the
 * fine print.
 */
import type { ComponentChildren, CSSProperties } from 'preact';
import { useState } from 'preact/hooks';
import { TiltedRing } from './mark';
import { hueVars } from './hue';
import './card.css';

/**
 * The nameplate: the brand lockup, owner-chosen 2026-10-19 for everything the
 * site makes: the tilted twelve-dot mark and ZODIACS · ORG in the site's nav
 * serif, set in capitals, the dot muted and ORG a step dimmer. The words are
 * written "Zodiacs·org" and capitalised by the stylesheet, as in the nav, and
 * the link's name is "Zodiacs.org".
 */
export function Nameplate({ href = 'https://zodiacs.org/', front = null }: { href?: string; front?: string | null }) {
  return <a class="nameplate" href={href} target="_blank" rel="noreferrer" aria-label="Zodiacs.org">
    <TiltedRing width={34} front={front}/>
    <span class="nameplate-name" aria-hidden="true">Zodiacs<span class="nameplate-sep">·</span><span class="nameplate-tld">org</span></span>
  </a>;
}

/**
 * A card. `front` is the Sun sign of the one person a card is made for, the
 * one its chart settles, and turns the nameplate's ring to it.
 */
export function Card({ hue, hue2, label, front = null, children }: { hue: string | null; hue2?: string | null; label?: string; front?: string | null; children: ComponentChildren }) {
  return <article class="card" style={hueVars(hue, hue2) as CSSProperties} aria-label={label}>
    <Nameplate front={front}/>
    {children}
  </article>;
}

declare const CARD_ART: Record<string, string>;
/** A piece of hero art in its two twins: the dark one for the dark host theme and its daylight twin for the light theme. */
export interface ArtSource { dark: string; light?: string }
/**
 * A card's hero art: a sign panel (by slug) or one of the cards' own pieces
 * (by name), inlined at build time, with its light twin under "<key>-light".
 */
export const artOf = (key: string | null | undefined): ArtSource | undefined => {
  const name = key && (CARD_ART[key] ? key : key.toLowerCase());
  return name && CARD_ART[name] ? { dark: CARD_ART[name], light: CARD_ART[`${name}-light`] } : undefined;
};

export interface ArtPanel { src: ArtSource | undefined; flip?: boolean; focus?: string }
/**
 * The hero art: one 3:2 panel, or two panels facing each other. Each panel
 * carries both twins and the stylesheet shows the one for the host theme, so
 * nothing swaps after paint; the other is never decoded. The panel fades into
 * the card on every side, with no frame. Decorative, so hidden from assistive
 * technology; the words around it say what it shows. No text is set over it.
 */
export function Art({ panels }: { panels: ArtPanel[] }) {
  const shown = panels.filter((panel) => panel.src);
  if (shown.length === 0) return null;
  return <div class={`art art-${shown.length}`} aria-hidden="true">{shown.map((panel, index) => <figure key={index} class={`art-frame${panel.flip ? ' art-flip' : ''}${panel.src!.light ? ' art-twins' : ''}`} style={panel.focus ? { '--focus': panel.focus } as CSSProperties : undefined}>
    <img class="art-dark" src={panel.src!.dark} alt="" width="480" height="320" decoding="async" loading="lazy"/>
    {panel.src!.light && <img class="art-light" src={panel.src!.light} alt="" width="480" height="320" decoding="async" loading="lazy"/>}
  </figure>)}</div>;
}

/** A head without art, for the panel's own states (a name Zodiacs does not publish, the sign picker). */
export function Head({ kicker, title, meta, aside, art }: { kicker: ComponentChildren; title: ComponentChildren; meta?: ComponentChildren; aside?: ComponentChildren; art?: ArtPanel[] }) {
  const plate = art ? <Art panels={art}/> : null;
  return <header class={`card-head${plate && art!.some((panel) => panel.src) ? ' has-art' : ''}`}>
    <div class="card-head-text">
      <p class="kicker">{kicker}</p>
      <h1>{title}</h1>
      {meta && <p class="meta">{meta}</p>}
    </div>
    {aside}
    {plate}
  </header>;
}

/** Title lengths past which a keepsake's title steps down: every title the cards set themselves is shorter, so only long names do. */
const TITLE_LONG = 26;
const TITLE_LONGER = 40;

/**
 * The keepsake head: the hero art large across the top, the pastel sign
 * discs (one per sign the card is about, no outline) set on its lower edge,
 * and the kicker, title and meta line centred under them.
 */
export function Keepsake({ kicker, title, meta, art, signs = [] }: { kicker: ComponentChildren; title: ComponentChildren; meta?: ComponentChildren; art?: ArtPanel[]; signs?: (string | undefined)[] }) {
  const discs = [...new Set(signs.filter((src): src is string => !!src))];
  const hasArt = !!art && art.some((panel) => panel.src);
  // Long names step the title down, as the share pictures fit theirs, so the card's main action stays on its first screen.
  const length = typeof title === 'string' ? title.length : 0;
  const fit = length > TITLE_LONGER ? 'title-longer' : length > TITLE_LONG ? 'title-long' : undefined;
  return <header class={`keepsake${hasArt ? ' has-art' : ''}${discs.length > 0 ? ' has-discs' : ''}`}>
    {hasArt && <Art panels={art!}/>}
    {discs.length > 0 && <div class="keepsake-discs" aria-hidden="true">{discs.map((src) => <SignDisc key={src} src={src} size="mark"/>)}</div>}
    <div class="keepsake-text">
      <p class="kicker">{kicker}</p>
      <h1 class={fit}>{title}</h1>
      {meta && <p class="meta">{meta}</p>}
    </div>
  </header>;
}

/** A score out of 100: a ring filled to the score, drawn from one hue to the other. */
export function ScoreRing({ score }: { score: number }) {
  return <div class="ring" role="img" aria-label={`${score} out of 100`} style={{ '--score': String(score) } as CSSProperties}>
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

export function SignDisc({ src, size }: { src: string | undefined; size: 'hero' | 'head' | 'mark' | 'chip' | 'row' }) {
  return src ? <img class={`disc disc-${size}`} src={src} alt=""/> : <span class={`disc disc-${size} disc-empty`} aria-hidden="true"/>;
}

/**
 * The hero row: a figure (score ring or number ring), when the card has one,
 * beside the verdict, and one line about it centred under them.
 */
export function Hero({ figure, verdict, summary }: { figure?: ComponentChildren; verdict: ComponentChildren; summary?: ComponentChildren }) {
  return <section class={`hero${figure ? '' : ' hero-words-only'}`}>
    <div class="hero-row">
      {figure && <div class="hero-figure">{figure}</div>}
      <p class="verdict">{verdict}</p>
    </div>
    {summary && <p class="summary">{summary}</p>}
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

/**
 * Everything past the first screen, behind one disclosure between
 * hairlines: the label, a muted line saying what it holds, and a plus that
 * turns into a minus when it is open.
 */
export function Fold({ hint, children, label = 'More from this reading' }: { hint?: ComponentChildren; children: ComponentChildren; label?: string }) {
  return <details class="fold">
    <summary>
      <span class="fold-words"><span class="fold-label">{label}</span>{hint && <span class="fold-hint">{hint}</span>}</span>
      <span class="fold-sign" aria-hidden="true"/>
    </summary>
    <div class="fold-body">{children}</div>
  </details>;
}

const ARROW_OUT = 'M5 11 11 5M6 5h5v5';
const ARROW_ON = 'M2 8h11M9 4l4 4-4 4';
const Arrow = ({ path }: { path: string }) => <svg class="arrow" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={path}/></svg>;

export interface Action { label: string; href: string }
/**
 * The card's two visible actions, never more: the main one as a pill (it
 * opens on zodiacs.org), and a second as an underlined link.
 */
export function Actions({ primary, secondary }: { primary?: Action | null | false | ''; secondary?: Action | null | false | '' }) {
  if (!primary && !secondary) return null;
  return <div class="actions">
    {primary && <a class="primary" href={primary.href} target="_blank" rel="noreferrer">{primary.label}<span class="orb" aria-hidden="true"><Arrow path={ARROW_OUT}/></span></a>}
    {secondary && <a class="secondary" href={secondary.href} target="_blank" rel="noreferrer">{secondary.label}<Arrow path={ARROW_ON}/></a>}
  </div>;
}

/** Underlined text links inside the fold, such as a famous person's page. */
export function Links({ links }: { links: (Action | null | false | undefined | '')[] }) {
  const shown = links.filter((link): link is Action => !!link);
  return shown.length > 0 ? <p class="links">{shown.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>)}</p> : null;
}

/** A button that gives the card as plain text, and the line that says whether it worked. */
export function CopyCard({ text, label = 'Copy the card' }: { text: string; label?: string }) {
  const [status, setStatus] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(text); setStatus('Copied.'); }
    catch { setStatus('Copying isn’t allowed here. Select the text to copy it.'); }
  }
  return <div class="copy-block">
    <button type="button" class="copy" onClick={copy}>{label}</button>
    <p role="status" class="status">{status}</p>
  </div>;
}

export const FinePrint = ({ children }: { children: ComponentChildren }) => <p class="fine">{children}</p>;

export function PanelFooter({ children }: { children: ComponentChildren }) {
  return <footer class="panel-foot"><p>{children}</p><a href="https://zodiacs.org/privacy/" target="_blank" rel="noreferrer">Privacy</a></footer>;
}
