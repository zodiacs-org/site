/**
 * The terminal's stylesheet, as a string the bundle injects once.
 *
 * Token VALUES rather than var() references: the terminal mounts on a wing
 * page, which is plain HTML and cannot link the hashed Astro bundle that
 * defines the custom properties. The values below are the Cosmic Void ramp,
 * copied — not invented. `--zx-sign` is set per selection and is the only
 * chroma in here. No external origin appears in any url().
 */

export const ZX_CSS = `
.zme {
  --zx-ink: #EEF1F7;
  --zx-ink-2: #C6CCDA;
  --zx-dim: #8E96AB;
  --zx-hair: rgba(198,204,218,.10);
  --zx-hair-2: rgba(198,204,218,.22);
  --zx-surface: rgba(13,16,25,.94);
  display: block;
  margin: 34px 0 0;
  color: var(--zx-ink-2);
  font-family: 'Instrument Sans', ui-sans-serif, system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}
.zme *, .zme *::before, .zme *::after { box-sizing: border-box; }
.zme__noscript { color: var(--zx-dim); }
.zme a { color: var(--zx-ink); }

.zme__grid {
  display: grid;
  grid-template-columns: 218px minmax(0, 1fr) 340px;
  gap: 14px;
  align-items: start;
}
@media (max-width: 1180px) {
  .zme__grid { grid-template-columns: minmax(0, 1fr) 340px; }
  .zme__rail { grid-column: 1 / -1; }
}
.zme-mobile-market,
.zme-mobile-tabs,
.zme-mobile-buy,
.zme__sheet-head,
.zme__sheet-backdrop { display: none; }

.zme__card {
  border: 1px solid var(--zx-hair);
  border-radius: 18px;
  background: var(--zx-surface);
  padding: 16px;
  min-width: 0;
}
.zme__card-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  margin: 0 0 12px; padding: 0 0 10px;
  border-bottom: 1px solid var(--zx-hair);
}
.zme__card-title {
  margin: 0;
  color: var(--zx-ink);
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 0.01em;
}
.zme__card-note {
  color: var(--zx-dim);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.05em;
}
.zme__center { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.zme__scope {
  margin: -4px 0 10px;
  color: var(--zx-dim);
  font-size: 11.5px;
  line-height: 1.5;
}

/* ── the rail ─────────────────────────────────────────────────────────── */
.zme__rail { padding: 8px; }
.zme__rail-list { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
@media (max-width: 1180px) {
  .zme__rail-list { flex-direction: row; overflow-x: auto; padding-bottom: 4px; }
}
.zme__rail-item {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: var(--zx-ink-2);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 200ms cubic-bezier(0.4,0,0.2,1);
}
@media (max-width: 1180px) {
  .zme__rail-item { width: auto; min-width: 168px; flex: 0 0 auto; }
}
.zme__rail-item:hover { background: color-mix(in srgb, var(--sign, #C6CCDA) 10%, transparent); }
.zme__rail-item:disabled { cursor: wait; opacity: 0.58; }
.zme__rail-item[aria-pressed='true'] {
  background: color-mix(in srgb, var(--sign, #C6CCDA) 15%, transparent);
  color: var(--zx-ink);
}
.zme__rail-disc { width: 30px; height: 30px; border-radius: 50%; display: block; }
.zme__rail-name { font-weight: 550; font-size: 13.5px; line-height: 1.2; }
.zme__rail-quote {
  display: flex; flex-direction: column; align-items: flex-end;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px; line-height: 1.35;
}
.zme__rail-price { color: var(--zx-ink); }
.zme__rail-change { color: var(--zx-dim); }
.zme__rail-change--up, .zme__stat-value.is-positive, .zme-mobile-summary__change.is-positive { color: #8dd9ad; }
.zme__rail-change--down, .zme__stat-value.is-negative, .zme-mobile-summary__change.is-negative { color: #f28e87; }

/* ── chart ────────────────────────────────────────────────────────────── */
.zme__frames { display: inline-flex; gap: 2px; }
.zme__frame {
  padding: 4px 9px;
  border: 0; border-radius: 8px;
  background: none;
  color: var(--zx-dim);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px;
  cursor: pointer;
}
.zme__frame:hover { color: var(--zx-ink); }
.zme__frame[aria-pressed='true'] { background: var(--zx-hair); color: var(--zx-ink); }
.zme__readout {
  min-height: 16px;
  margin: 0 0 6px;
  color: var(--zx-dim);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px;
  letter-spacing: 0.02em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.zme__canvas-box { position: relative; height: 320px; }
.zme__canvas { display: block; width: 100%; height: 100%; }
.zme__chart-foot {
  display: flex; justify-content: space-between; gap: 10px;
  margin-top: 8px;
  color: var(--zx-dim);
  font-size: 11.5px;
}
.zme__chart-foot a { color: var(--zx-dim); }
.zme__chart-foot a:hover { color: var(--zx-ink); }

/* ── tape ─────────────────────────────────────────────────────────────── */
.zme-tape__scroll { overflow-x: auto; }
.zme-tape__table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
}
.zme-tape__table th {
  padding: 4px 8px;
  border-bottom: 1px solid var(--zx-hair);
  color: var(--zx-dim);
  font-weight: 400;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-align: right;
}
.zme-tape__table th:first-child, .zme-tape__table td:first-child { text-align: left; }
.zme-tape__table td { padding: 4px 8px; border-bottom: 1px solid var(--zx-hair); text-align: right; white-space: nowrap; }
.zme-tape__table td:first-child { color: var(--zx-dim); }
.zme-tape__row--buy .zme-tape__side { color: color-mix(in srgb, var(--sign, #C6CCDA) 82%, #EEF1F7); }
.zme-tape__row--sell .zme-tape__side { color: var(--zx-dim); }
.zme-tape__table tr.is-fresh td { background: color-mix(in srgb, var(--sign, #C6CCDA) 6%, transparent); }

/* ── desk column ──────────────────────────────────────────────────────── */
.zme__desk { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.zme__panel-host { min-height: 120px; }

.zme__ladder-refresh {
  padding: 4px 10px;
  border: 1px solid var(--zx-hair-2);
  border-radius: 999px;
  background: none;
  color: var(--zx-ink-2);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  cursor: pointer;
}
.zme__ladder-refresh:hover { color: var(--zx-ink); }
.zme__ladder-refresh[disabled] { color: var(--zx-dim); cursor: default; }
.zme__ladder-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
}
.zme__ladder-table th {
  padding: 4px 8px;
  border-bottom: 1px solid var(--zx-hair);
  color: var(--zx-dim);
  font-weight: 400;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-align: right;
}
.zme__ladder-table td { padding: 4px 8px; text-align: right; white-space: nowrap; }
.zme__ladder-table .zme__ladder-side { text-align: left; color: var(--zx-dim); }
.zme__ladder-row--buy .zme__ladder-side { color: color-mix(in srgb, var(--sign, #C6CCDA) 82%, #EEF1F7); }
.zme__ladder-caption {
  margin: 10px 0 0;
  color: var(--zx-dim);
  font-size: 11.5px;
  line-height: 1.55;
}

.zme__stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.zme__stat { display: flex; flex-direction: column; gap: 3px; }
.zme__stat-label {
  color: var(--zx-dim);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.zme__stat-value {
  color: var(--zx-ink);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12.5px;
}

.zme__state {
  padding: 26px 10px;
  color: var(--zx-dim);
  font-size: 12.5px;
  text-align: center;
}

/* ── mobile terminal ─────────────────────────────────────────────────── */
@media (max-width: 800px) {
  .zme {
    margin: 12px -10px 0;
    font-size: 13px;
  }
  .zme-mobile-market {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--zx-hair);
  }
  .zme-mobile-market__button {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 10px;
    padding: 4px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--zx-ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 160ms cubic-bezier(.23,1,.32,1), transform 140ms cubic-bezier(.23,1,.32,1);
  }
  .zme-mobile-market__button:active { transform: scale(.985); }
  .zme-mobile-market__button:hover { background: color-mix(in srgb, var(--sign, #C6CCDA) 8%, transparent); }
  .zme-mobile-market__button:disabled { opacity: .55; cursor: wait; }
  .zme-mobile-market__disc {
    display: block;
    width: 38px;
    height: 38px;
    flex: none;
    border-radius: 50%;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sign, #C6CCDA) 22%, transparent);
  }
  .zme-mobile-market__identity { display: flex; flex-direction: column; min-width: 0; }
  .zme-mobile-market__name { font-size: 15px; font-weight: 600; line-height: 1.2; }
  .zme-mobile-market__pair {
    overflow: hidden;
    color: var(--zx-dim);
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 9.5px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .zme-mobile-market__chevron { margin-left: auto; color: var(--zx-dim); font-size: 18px; }
  .zme-mobile-summary {
    display: grid;
    grid-template-columns: auto auto;
    align-items: baseline;
    justify-items: end;
    column-gap: 8px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }
  .zme-mobile-summary__price { color: var(--zx-ink); font-size: 18px; font-weight: 550; }
  .zme-mobile-summary__change { color: var(--zx-dim); font-size: 10px; }
  .zme-mobile-summary__change.is-positive { color: #8dd9ad; }
  .zme-mobile-summary__liquidity {
    grid-column: 1 / -1;
    color: var(--zx-dim);
    font-size: 8.5px;
    letter-spacing: .02em;
  }
  .zme-mobile-tabs {
    position: relative;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-top: 1px solid var(--zx-hair);
    border-bottom: 1px solid var(--zx-hair);
  }
  .zme-mobile-tabs__tab {
    position: relative;
    min-height: 46px;
    padding: 0 14px;
    border: 0;
    background: transparent;
    color: var(--zx-dim);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .zme-mobile-tabs__tab::after {
    content: '';
    position: absolute;
    right: 16px;
    bottom: -1px;
    left: 16px;
    height: 2px;
    background: var(--sign, #C6CCDA);
    transform: scaleX(0);
    transform-origin: center;
    transition: transform 200ms cubic-bezier(.23,1,.32,1);
  }
  .zme-mobile-tabs__tab[aria-selected='true'] { color: var(--zx-ink); }
  .zme-mobile-tabs__tab[aria-selected='true']::after { transform: scaleX(1); }

  .zme__grid { display: block; min-width: 0; }
  .zme__grid[data-mobile-tab='chart'] .zme__desk,
  .zme__grid[data-mobile-tab='trade'] .zme__center { display: none; }
  .zme__center, .zme__desk { gap: 0; }
  .zme__card {
    border-width: 0 0 1px;
    border-radius: 0;
    background: transparent;
    padding: 14px 12px;
  }
  .zme__center > .zme__card:first-child { padding-top: 12px; }
  .zme__card-head { margin-bottom: 8px; padding-bottom: 8px; }
  .zme__card-title { font-size: 15px; }
  .zme__scope { margin-bottom: 7px; font-size: 10.5px; }
  .zme__frames { gap: 4px; }
  .zme__frame { min-height: 36px; padding: 0 10px; }
  .zme__canvas-box { height: clamp(280px, 86vw, 370px); }
  .zme__chart-foot { flex-direction: column; gap: 2px; font-size: 10px; }
  .zme-tape__scroll {
    max-height: 184px;
    overflow: auto;
    overscroll-behavior: contain;
  }
  .zme-tape__table { min-width: 430px; }

  .zme__sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 119;
    display: block;
    border: 0;
    background: rgba(6,7,9,.72);
    opacity: 0;
    pointer-events: none;
    transition: opacity 210ms cubic-bezier(.23,1,.32,1);
  }
  .zme__sheet-backdrop[data-open='true'] { opacity: 1; pointer-events: auto; }
  .zme__rail {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 120;
    max-height: min(78vh, 680px);
    padding: 8px 12px calc(14px + env(safe-area-inset-bottom));
    border: 1px solid var(--zx-hair-2);
    border-width: 1px 0 0;
    border-radius: 22px 22px 0 0;
    background: rgb(6,7,9);
    box-shadow: 0 -24px 70px rgba(0,0,0,.54);
    overflow: auto;
    opacity: 0;
    pointer-events: none;
    transform: translateY(102%);
    transition: transform 210ms cubic-bezier(.23,1,.32,1), opacity 160ms cubic-bezier(.23,1,.32,1);
  }
  .zme__rail[data-open='true'] { opacity: 1; pointer-events: auto; transform: translateY(0); }
  .zme__sheet-head {
    position: sticky;
    top: -8px;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 4px 10px;
    background: rgb(6,7,9);
  }
  .zme__sheet-title { margin: 0; color: var(--zx-ink); font-size: 17px; font-weight: 600; }
  .zme__sheet-close {
    min-height: 38px;
    padding: 0 12px;
    border: 1px solid var(--zx-hair-2);
    border-radius: 999px;
    background: transparent;
    color: var(--zx-ink-2);
    font: inherit;
    cursor: pointer;
  }
  .zme__rail-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
  .zme__rail-item { width: 100%; min-width: 0; padding: 9px 8px; }

  .zme .tp {
    --tp-red: var(--zx-dim);
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  .zme .tp__venue,
  .zme .tp__complete-kicker,
  .zme .tp__step-number { color: color-mix(in srgb, var(--tp-sign, #C6CCDA) 78%, #EEF1F7); }
  .zme .tp__venue,
  .zme .tp__asset-note,
  .zme .tp__step-number,
  .zme .tp .review-notice { border-color: color-mix(in srgb, var(--tp-sign, #C6CCDA) 28%, transparent); }
  .zme .tp__asset-note,
  .zme .tp .review-notice {
    background: color-mix(in srgb, var(--tp-sign, #C6CCDA) 6%, transparent);
  }
  .zme .tp .detail a { text-decoration-color: color-mix(in srgb, var(--tp-sign, #C6CCDA) 34%, transparent); }
  .zme .tp__go {
    border-color: color-mix(in srgb, var(--tp-sign, #C6CCDA) 62%, transparent);
    background: var(--tp-sign, #C6CCDA);
  }
  .zme-mobile-buy {
    position: fixed;
    right: 12px;
    bottom: calc(10px + env(safe-area-inset-bottom));
    left: 12px;
    z-index: 55;
    min-height: 54px;
    padding: 0 22px;
    border: 1px solid color-mix(in srgb, var(--sign, #C6CCDA) 70%, #EEF1F7);
    border-radius: 999px;
    background: var(--sign, #C6CCDA);
    box-shadow: 0 12px 36px rgba(0,0,0,.46);
    color: rgb(6,7,9);
    font: inherit;
    font-size: 15px;
    font-weight: 650;
    cursor: pointer;
    transform: translateY(0);
    transition: transform 140ms cubic-bezier(.23,1,.32,1), opacity 160ms cubic-bezier(.23,1,.32,1);
  }
  .zme[data-sticky-visible='true'] .zme__grid[data-mobile-tab='chart'] + .zme-mobile-buy { display: block; }
  .zme-mobile-buy:active { transform: scale(.985); }
  .zme-mobile-buy:disabled { opacity: .5; cursor: wait; }
  .zme__grid[data-mobile-tab='chart'] .zme__center { padding-bottom: calc(66px + env(safe-area-inset-bottom)); }

  .zme button:focus-visible,
  .zme [role='tab']:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--sign, #C6CCDA) 76%, #EEF1F7);
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .zme__rail-item,
  .zme__frame,
  .zme-mobile-market__button,
  .zme-mobile-tabs__tab::after,
  .zme__sheet-backdrop,
  .zme__rail,
  .zme-mobile-buy { transition: none; }
}
`;
