/* Generated from src/exchange/ by scripts/build-exchange.mjs — do not edit directly. */
"use strict";(()=>{var Ht=`
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
`;var me=[{slug:"aries",name:"Aries",glyph:"♈",hue:"#DE8E79"},{slug:"taurus",name:"Taurus",glyph:"♉",hue:"#B9D4BE"},{slug:"gemini",name:"Gemini",glyph:"♊",hue:"#B29DD0"},{slug:"cancer",name:"Cancer",glyph:"♋",hue:"#B6D4E4"},{slug:"leo",name:"Leo",glyph:"♌",hue:"#E0A9B4"},{slug:"virgo",name:"Virgo",glyph:"♍",hue:"#B7D9B0"},{slug:"libra",name:"Libra",glyph:"♎",hue:"#D3A9DE"},{slug:"scorpio",name:"Scorpio",glyph:"♏",hue:"#B9DCE8"},{slug:"sagittarius",name:"Sagittarius",glyph:"♐",hue:"#E0B080"},{slug:"capricorn",name:"Capricorn",glyph:"♑",hue:"#C0DEA8"},{slug:"aquarius",name:"Aquarius",glyph:"♒",hue:"#AE8FC9"},{slug:"pisces",name:"Pisces",glyph:"♓",hue:"#A9D4C4"}];var Gr={aries:"HRn98YLGigP475eS1GaQYRMbqk1V4dkV6tdKyLhVh2iS",taurus:"2GNtxia4fLW3URj5MLqVfgoKrAgDpphtAVazK41eTPfu",gemini:"HxhdKrB1UpSwfuMoZMVzPVELzbPWHdyN6PHU9CBFium9",cancer:"DaTEcH6da4i1evZU37F9ibQirYXhLKZpKDzDno346nSW",leo:"48ErBGMqiZekyLoCcebd7cS5KNQPzqr7QQAK9mzAPQGQ",virgo:"5WcVjf8fzPkHaZqTSZDdbDFL6p2bLbAgEigxpevNrcRh",libra:"DTXPQjK4ae4h2Wc7D5Rpij8YmSQxqLuTcNKrpBCjcAN9",scorpio:"3d2KYuMgj2yotNC6SKX4HNoeSWp4n8zqZSQ9kFH81Yta",sagittarius:"7mP6WeVYBNt3eao5szsMPmuHughHjNRx26TcrgJXZRky",capricorn:"549aknNCvxbiqmikS6sAnY6Dbg37MeENWn6ZFBfc7sin",aquarius:"BygCEAhCNyWC8Co9yPa4K84NGkgkgMWdib2FG5hhuiUv",pisces:"Fzz8QrSV8sPKsTtHocwYARE8Zo6Rd4Wv2Ee4JtCuiDko"};function Hr(e,r){if(!Array.isArray(e)||!r)return null;let t=null,n=-1;for(let i of e){if(i?.chainId!=="solana"||!i?.pairAddress||i?.baseToken?.address!==r)continue;let a=Number(i?.liquidity?.usd);!Number.isFinite(a)||a<=0||a>n&&(n=a,t=String(i.pairAddress))}return t}function Vt({slug:e,mint:r,rows:t}){return Gr[e]??Hr(t,r)}var Kt="https://api.geckoterminal.com/api/v2",Jt="https://www.geckoterminal.com/";var Vr="zodiacs.exchange.gecko-budget.v1",Kr="zodiacs.exchange.gecko-cooloff.v1",Hn=Object.freeze(["network","rate_limited","unavailable","not_indexed"]),ot=class extends Error{constructor(r,t,{cause:n,retryAfterMs:i=null}={}){super(t,n?{cause:n}:void 0),this.name="ExchangeDataError",this.code=r,this.retryAfterMs=Number.isFinite(i)&&i>=0?i:null}};function H(e,r,t){throw new ot(e,r,t)}var it=Object.freeze({"15m":{path:"minute",aggregate:15,limit:192},"1h":{path:"hour",aggregate:1,limit:168},"4h":{path:"hour",aggregate:4,limit:180},"1d":{path:"day",aggregate:1,limit:180}});function Jr({pool:e,timeframe:r,baseUrl:t=Kt}){let n=it[r];n||H("unavailable",`Unknown timeframe: ${r}`);let i=new URL(`${t}/networks/solana/pools/${encodeURIComponent(e)}/ohlcv/${n.path}`);return i.searchParams.set("aggregate",String(n.aggregate)),i.searchParams.set("limit",String(n.limit)),i.toString()}function Yr({pool:e,baseUrl:r=Kt}){return new URL(`${r}/networks/solana/pools/${encodeURIComponent(e)}/trades`).toString()}function Wr(e){(!e?.data||typeof e.data!="object")&&H("unavailable","The chart data was not readable.");let r=e.data.attributes?.ohlcv_list;if(r===void 0)return[];Array.isArray(r)||H("unavailable","The chart data was not readable.");let t=[];for(let n of r){if(!Array.isArray(n)||n.length<6)continue;let[i,a,c,d,p,u]=n.map(Number);[i,a,c,d,p,u].every(Number.isFinite)&&(i<=0||a<=0||c<=0||d<=0||p<=0||u<0||t.push({ts:i,o:a,h:c,l:d,c:p,v:u}))}return t.sort((n,i)=>n.ts-i.ts),t}function Qr(e,r){let t=e?.data;Array.isArray(t)||H("unavailable","The trade data was not readable.");let n=[];for(let i of t){let a=i?.attributes;if(!a)continue;let c=Date.parse(a.block_timestamp??"");if(!Number.isFinite(c))continue;let d,p;if(a.to_token_address===r)d=Number(a.to_token_amount),p=Number(a.price_to_in_usd);else if(a.from_token_address===r)d=Number(a.from_token_amount),p=Number(a.price_from_in_usd);else continue;let u=a.kind==="buy"||a.kind==="sell"?a.kind:null,_=Number(a.volume_in_usd);!u||!Number.isFinite(d)||d<=0||!Number.isFinite(p)||p<=0||n.push({id:String(i.id??`${a.tx_hash}-${c}`),ts:c,side:u,tokenAmount:d,priceUsd:p,volumeUsd:Number.isFinite(_)?_:null,tx:typeof a.tx_hash=="string"?a.tx_hash:null})}return n.sort((i,a)=>a.ts-i.ts),n}function Yt({limit:e=12,windowMs:r=6e4,now:t=()=>Date.now(),storage:n=null,storageKey:i=Vr}={}){let a=[],c=!!n;function d(){if(!c)return a;try{let u=JSON.parse(n.getItem(i)??"[]");if(Array.isArray(u))return u.filter(Number.isFinite)}catch{c=!1}return a}function p(u){if(a=u,!!c)try{n.setItem(i,JSON.stringify(u))}catch{c=!1}}return{take(){let u=t(),_=u-r,g=d().filter(x=>x>_&&x<=u);return g.length>=e?(p(g),!1):(g.push(u),p(g),!0)}}}function Zr(e,{now:r=()=>Date.now(),maxMs:t=12e4}={}){if(typeof e!="string"||!e.trim())return null;let n=e.trim(),i=Number(n);if(Number.isFinite(i)&&i>=0)return Math.min(Math.ceil(i*1e3),t);let a=Date.parse(n);return Number.isFinite(a)?Math.min(Math.max(0,a-r()),t):null}async function Wt(e,{fetchImpl:r=globalThis.fetch,signal:t,deadlineMs:n=12e3}={}){let i=new AbortController,a=!1,c=()=>i.abort();t?.aborted?c():t?.addEventListener("abort",c,{once:!0});let d=setTimeout(()=>{a=!0,i.abort()},n);try{let p;try{p=await r(e,{method:"GET",signal:i.signal,headers:{accept:"application/json"}})}catch(u){if(t?.aborted||(a&&H("network","The chart service timed out.",{cause:u}),u?.name==="AbortError"))throw u;H("network","The chart service could not be reached just now.",{cause:u})}p.status===429&&H("rate_limited","The chart service is rate limiting requests.",{retryAfterMs:Zr(p.headers?.get?.("retry-after")??null)}),p.status===404&&H("not_indexed","This pool is not indexed by the chart service."),p.ok||H("unavailable","The chart service did not answer.");try{return await p.json()}catch(u){if(t?.aborted||(a&&H("network","The chart service timed out.",{cause:u}),u?.name==="AbortError"))throw u;H("unavailable","The chart service did not return a readable answer.",{cause:u})}}finally{clearTimeout(d),t?.removeEventListener("abort",c)}}function Qt({baseMs:e=1e4,maxMs:r=12e4,now:t=()=>Date.now(),storage:n=null,storageKey:i=Kr}={}){let a={until:0,step:0,revision:0},c=!!n;function d(){if(!c)return a;try{let u=JSON.parse(n.getItem(i)??"null");u&&[u.until,u.step,u.revision].every(Number.isFinite)&&(a=u)}catch{c=!1}return a}function p(u){if(a=u,!!c)try{n.setItem(i,JSON.stringify(u))}catch{c=!1}}return{active(){return t()<d().until},remainingMs(){return Math.max(0,d().until-t())},token(){return d().revision},fail(u=null){let _=d(),g=Math.min(e*2**_.step,r),x=Number.isFinite(u)?Math.min(Math.max(0,u),r):0,m=t()+Math.max(g,x);p({until:Math.max(_.until,m),step:_.step+1,revision:_.revision+1})},ok(u=null){let _=d();return u!==null&&u!==_.revision?!1:(p({until:0,step:0,revision:_.revision+1}),!0)}}}async function Zt({pool:e,timeframe:r,baseUrl:t,fetchImpl:n,signal:i,deadlineMs:a}){let c=await Wt(Jr({pool:e,timeframe:r,baseUrl:t}),{fetchImpl:n,signal:i,deadlineMs:a});return Wr(c)}async function Xt({pool:e,mint:r,baseUrl:t,fetchImpl:n,signal:i,deadlineMs:a}){let c=await Wt(Yr({pool:e,baseUrl:t}),{fetchImpl:n,signal:i,deadlineMs:a});return Qr(c,r)}function er(e,r){let t=String(r||"");if(!t||!Array.isArray(e))return null;let n=new Set,i=0;for(let a of e){if(a?.chainId!=="solana"||a?.baseToken?.address!==t)continue;let c=String(a?.pairAddress||"");if(!c||n.has(c))continue;let d=Number(a?.liquidity?.usd);!Number.isFinite(d)||d<=0||(n.add(c),i+=d)}return i>0?i:null}var tr="https://api.dexscreener.com/tokens/v1/solana";function Xr(e,r=tr){return`${r}/${e.map(t=>encodeURIComponent(t)).join(",")}`}function en(e,r){let t={};if(!Array.isArray(e))return t;for(let n of r){let i=null,a=-1;for(let p of e){if(p?.chainId!=="solana"||!p?.pairAddress||p?.baseToken?.address!==n)continue;let u=Number(p?.liquidity?.usd)||0;u>a&&(a=u,i=p)}if(!i)continue;let c=Number(i.priceUsd),d=Number(i.priceChange?.h24);t[n]={priceUsd:Number.isFinite(c)&&c>0?c:null,change24hPct:Number.isFinite(d)?d:null,liquidityUsd:er(e,n)}}return t}async function rr({mints:e,baseUrl:r=tr,fetchImpl:t=globalThis.fetch,signal:n}={}){if(!Array.isArray(e)||e.length===0)return{stats:{},rows:[]};let i=await t(Xr(e,r),{method:"GET",headers:{accept:"application/json"},signal:n});if(!i.ok)throw new Error(`stats ${i.status}`);let a=await i.json();return{stats:en(a,e),rows:Array.isArray(a)?a:[]}}var tn="https://api.jup.ag";var Wn=Object.freeze(["invalid_amount","no_route","unavailable","rate_limited","order_mismatch","unexpected_fee","network","execute_unconfirmed","execute_failed"]),Oe=class extends Error{constructor(r,t,{cause:n,retryAfterMs:i=null}={}){super(t,n?{cause:n}:void 0),this.name="TradeError",this.code=r,this.retryAfterMs=i}};function S(e,r,t){throw new Oe(e,r,t)}var at=Object.freeze({background:0,quote:1,trade:2}),st=Symbol.for("zodiacs.registry.jupiter-request-gate");function lt(){return Object.assign(new Error("The request was cancelled."),{name:"AbortError"})}function rn({spacingMs:e=2100,now:r=Date.now,setTimeout:t=setTimeout,clearTimeout:n=clearTimeout}={}){let i=0,a=!1,c=null,d=Number.NEGATIVE_INFINITY,p=[];function u(m){let b=p.indexOf(m);b>=0&&p.splice(b,1),m.signal?.removeEventListener?.("abort",m.onAbort)}function _(){let m=0;for(let b=1;b<p.length;b+=1){let v=p[b],C=p[m],L=at[v.requestClass],U=at[C.requestClass];(L>U||L===U&&v.sequence<C.sequence)&&(m=b)}return p.splice(m,1)[0]}function g(){if(a||c)return;for(let v=p.length-1;v>=0;v-=1){if(!p[v].signal?.aborted)continue;let C=p[v];u(C),C.reject(lt())}if(!p.length)return;let m=Math.max(0,d+e-r());if(m>0){c=t(()=>{c=null,g()},m);return}let b=_();b.started=!0,b.signal?.removeEventListener?.("abort",b.onAbort),a=!0,d=r(),Promise.resolve().then(()=>b.task()).then(b.resolve,b.reject).finally(()=>{a=!1,g()})}function x(m,{requestClass:b="quote",signal:v}={}){return v?.aborted?Promise.reject(lt()):new Promise((C,L)=>{let U={task:m,requestClass:Object.prototype.hasOwnProperty.call(at,b)?b:"quote",signal:v,sequence:i+=1,started:!1,resolve:C,reject:L,onAbort:null};U.onAbort=()=>{U.started||(u(U),L(lt()),!p.length&&c&&(n(c),c=null),g())},v?.addEventListener?.("abort",U.onAbort,{once:!0}),p.push(U),g()})}return Object.freeze({schedule:x})}function nn(){return typeof window>"u"?null:(globalThis[st]||(globalThis[st]=rn()),globalThis[st])}function on(e,r){let t=nn();return t?t.schedule(e,r):e()}function an(e,r){let t=new AbortController,n=!1,i=()=>t.abort();e?.aborted?t.abort():e?.addEventListener?.("abort",i,{once:!0});let a=setTimeout(()=>{n=!0,t.abort()},r);return{signal:t.signal,timedOut:()=>n,cleanup(){clearTimeout(a),e?.removeEventListener?.("abort",i)}}}function sn(e,r=Date.now()){let t=e?.headers?.get?.("retry-after");if(!t)return null;let n=Number(t),i=Number.isFinite(n)?n*1e3:Date.parse(t)-r;return!Number.isFinite(i)||i<0?null:Math.min(12e4,Math.round(i))}function ct(e,r){let t=String(e??"").trim();/^\d+(?:\.\d+)?$|^\.\d+$|^\d+\.$/.test(t)||S("invalid_amount","Enter an amount using digits and a single decimal point.");let[n="",i=""]=t.split(".");i.length>r&&S("invalid_amount",`That amount is finer than this token's ${r} decimals.`);let a=BigInt((n||"0")+i.padEnd(r,"0"));return a<=0n&&S("invalid_amount","Enter an amount greater than zero."),a}function ut(e,r,{maxFractionDigits:t=r}={}){let n=BigInt(e),i=n<0n,a=(i?-n:n).toString().padStart(r+1,"0"),c=a.slice(0,a.length-r),d=r>0?a.slice(a.length-r):"";return t<d.length&&(d=d.slice(0,t)),d=d.replace(/0+$/,""),`${i?"-":""}${c}${d?`.${d}`:""}`}function ln(e,r){let t=new URL("/swap/v2/order",e);for(let[n,i]of Object.entries(r))i!=null&&i!==""&&t.searchParams.set(n,String(i));return t.toString()}async function cn(e){try{return await e.json()}catch(r){if(r?.name==="AbortError")throw r;S("unavailable","The venue did not return a readable answer.",{cause:r})}}async function nr({inputMint:e,outputMint:r,amount:t,taker:n,baseUrl:i=tn,fetchImpl:a=globalThis.fetch,signal:c,requestClass:d=n?"trade":"quote",deadlineMs:p=12e3}){let u=ln(i,{inputMint:e,outputMint:r,amount:String(t),taker:n}),_=null;try{let g;try{g=await on(()=>(_=an(c,p),a(u,{method:"GET",signal:_.signal,headers:{accept:"application/json"}})),{requestClass:d,signal:c})}catch(m){if(m?.name==="AbortError"&&!_?.timedOut())throw m;S("network","The price could not be reached just now.",{cause:m})}g.status===429&&S("rate_limited","The venue is rate limiting requests. Try again shortly.",{retryAfterMs:sn(g)}),g.status>=500&&S("unavailable","The venue did not answer.");let x;try{x=await cn(g)}catch(m){throw m?.name==="AbortError"&&_?.timedOut()&&S("network","The price could not be reached just now.",{cause:m}),m}if(x?.error||!g.ok){let m=typeof x?.error=="string"?x.error:"no route";/quote|route|liquidity/i.test(m)&&S("no_route","No route is available for that amount right now."),S("unavailable","The venue could not price that trade.")}return un(x)}catch(g){if(g instanceof Oe||g?.name==="AbortError")throw g;S("network","The price could not be reached just now.",{cause:g})}finally{_?.cleanup()}}function un(e){(!e||typeof e!="object")&&S("unavailable","The venue returned no order.");let{inputMint:r,outputMint:t,inAmount:n,outAmount:i,requestId:a}=e;(!r||!t||!n||!i)&&S("unavailable","The venue returned an incomplete order.");let c,d;try{c=BigInt(n),d=BigInt(i)}catch(b){S("unavailable","The venue returned unreadable amounts.",{cause:b})}let p=e.platformFee?.feeBps??e.feeBps,u=typeof p=="number"||typeof p=="string"&&p.trim()!=="",_=Number(p);(!u||!Number.isInteger(_)||_<0||_>10)&&S("unexpected_fee","The venue quoted an unexpected fee, so nothing was sent to your wallet.");let g=e.priceImpactPct,x=typeof g=="number"||typeof g=="string"&&g.trim()!=="",m=Number(g);return(!x||!Number.isFinite(m))&&S("unavailable","The venue returned no readable price impact."),{inputMint:r,outputMint:t,inAmount:c,outAmount:d,priceImpactPct:m,feeBps:_,routeLabels:Array.isArray(e.routePlan)?e.routePlan.map(b=>b?.swapInfo?.label).filter(Boolean):[],requestId:a??null,transaction:e.transaction??null,inUsdValue:Number(e.inUsdValue??0),outUsdValue:Number(e.outUsdValue??0)}}function or(e,r){return(e.inputMint!==r.inputMint||e.outputMint!==r.outputMint)&&S("order_mismatch","The venue answered for a different token than the one shown."),e.inAmount!==BigInt(r.amount)&&S("order_mismatch","The venue answered for a different amount than the one entered."),e.outAmount<=0n&&S("order_mismatch","The venue returned an empty amount."),(!Number.isInteger(e.feeBps)||e.feeBps<0||e.feeBps>10)&&S("unexpected_fee","The venue quoted an unexpected fee, so nothing was sent to your wallet."),e}var eo=Object.freeze(["card","usdc"]),to=Object.freeze(["idle","quoting","ready","signing","done","error"]),dt="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",ir=6;var ro=Object.freeze(["25","50","100","250"]),no=Object.freeze([{name:"Coinbase",mark:"coinbase",href:"https://www.coinbase.com/",note:"Fund a wallet with USDC."},{name:"fomo",mark:"fomo",href:"https://fomo.family/",applePay:!0,note:"Fund in-app; verify the mint."},{name:"MoonPay",mark:"moonpay",href:"https://www.moonpay.com/",note:"Buy USDC by card or bank."},{name:"Ramp Network",mark:"ramp",href:"https://rampnetwork.com/",note:"Buy USDC with mobile pay."}]);var sr=6,mn=Object.freeze(["25","100","250","500","1000"]),lr=12,pn=10n**BigInt(lr),mt=2100;function ar(e,r){let t=BigInt(e),n=BigInt(r);return t<=0n||n<=0n?null:t*pn/n}function fn(e){return e==null?null:ut(e,lr)}function hn(e,r,t){if(!e||!r||r<=0n)return null;let i=(t==="sell"?r-e:e-r)*10000n/r;return i<0n?0:Number(i)}function bn(e,r){let t=Number(e),n=Number(r);if(!Number.isFinite(t)||t<=0||!Number.isFinite(n)||n<=0)return null;let i=t/n;return!Number.isFinite(i)||i<=0?null:i.toFixed(sr)}var gn=e=>new Promise(r=>{setTimeout(r,e)});async function pt({mint:e,side:r,notionals:t=mn,midPriceUsd:n=null,fetchImpl:i,signal:a,spacingMs:c=mt,sleep:d=gn,deadlineMs:p}){let u=[],_=null;for(let g=0;g<t.length;g+=1){let x=t[g];if(a?.aborted||(g>0&&c>0&&await d(c),a?.aborted))break;try{let m;if(r==="sell"){let C=bn(x,n);if(!C){u.push({notional:x,error:"unavailable"});continue}m={inputMint:e,outputMint:dt,amount:ct(C,sr)}}else m={inputMint:dt,outputMint:e,amount:ct(x,ir)};let b=await nr({...m,fetchImpl:i,signal:a,requestClass:"background",deadlineMs:p});or(b,m);let v=r==="sell"?ar(b.outAmount,b.inAmount):ar(b.inAmount,b.outAmount);if(!v){u.push({notional:x,error:"unavailable"});continue}g===0&&(_=v),u.push({notional:x,priceScaled:v,price:fn(v),impactBps:hn(v,_,r),priceImpactPct:b.priceImpactPct})}catch(m){if(m?.name==="AbortError")throw m;if(m?.code==="rate_limited")return{side:r,rungs:u,halted:"rate_limited",retryAfterMs:m.retryAfterMs};u.push({notional:x,error:m?.code??"unavailable"})}}return{side:r,rungs:u}}function ur(e){let r=1/0,t=-1/0;for(let i of e)i.l<r&&(r=i.l),i.h>t&&(t=i.h);if(!Number.isFinite(r)||!Number.isFinite(t))return null;if(r===t){let i=r===0?1:Math.abs(r)*.05;return{min:r-i,max:t+i}}let n=(t-r)*.08;return{min:Math.max(0,r-n),max:t+n}}function dr(e){let r=0;for(let t of e)t.v>r&&(r=t.v);return r}function mr(e,r,t=4){if(!(r>e)||t<1)return[];let n=r-e,i=10**Math.floor(Math.log10(n/(t+1))),a=i*10;for(let d of[1,2,5,10])if(n/(i*d)<=t+1){a=i*d;break}let c=[];for(let d=Math.ceil(e/a)*a;d<=r;d+=a)c.push(d);return c}function pr(e,r){if(e<=0||r<=0)return{step:0,bodyWidth:0,centers:[]};let t=r/e,n=Math.max(1,Math.min(t*.68,13)),i=[];for(let a=0;a<e;a+=1)i.push(t*a+t/2);return{step:t,bodyWidth:n,centers:i}}function pe(e,r,t){let n=r.max-r.min;return n<=0?t/2:t-(e-r.min)/n*t}function fr(e,r,t){if(r<=0||t<=0||e<0||e>=t)return null;let n=Math.floor(e/t*r);return n>=0&&n<r?n:null}function hr(e,r,t=6){if(!e.length)return[];let n=[],i=Math.max(1,Math.ceil(e.length/t));for(let a=0;a<e.length;a+=i)n.push(a);return n}function P(e){let r=Number(e);if(!Number.isFinite(r))return"—";if(r===0)return"0";let t=Math.max(0,3-Math.floor(Math.log10(Math.abs(r))));return r.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:Math.min(t,12)})}function Fe(e){let r=Number(e);return Number.isFinite(r)?Math.abs(r)>=1e3?`$${r.toLocaleString("en-US",{maximumFractionDigits:0})}`:`$${r.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"—"}function br(e){let r=Number(e);return Number.isFinite(r)?r>=1e3?r.toLocaleString("en-US",{maximumFractionDigits:0}):r.toLocaleString("en-US",{maximumFractionDigits:2}):"—"}var cr=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];function ft(e,r){let t=new Date(e*1e3);if(Number.isNaN(t.getTime()))return"—";if(r==="1d")return`${t.getUTCDate()} ${cr[t.getUTCMonth()]}`;let n=String(t.getUTCHours()).padStart(2,"0"),i=String(t.getUTCMinutes()).padStart(2,"0");return`${t.getUTCDate()} ${cr[t.getUTCMonth()]} ${n}:${i}`}function gr(e,r){let t=Math.max(0,Math.round((r-e)/1e3));if(t<60)return`${t}s ago`;let n=Math.floor(t/60);if(n<60)return`${n}m ago`;let i=Math.floor(n/60);return i<24?`${i}h ago`:`${Math.floor(i/24)}d ago`}var _r=74,xr=22,_n=.16;var Pe="#8E96AB",xn="rgba(198,204,218,0.10)",yn="rgba(198,204,218,0.22)",vn="11px 'JetBrains Mono', ui-monospace, monospace";function yr({canvas:e,readout:r}){let t=e.getContext("2d"),n=[],i="1h",a=Pe,c=null;function d(){let m=e.getBoundingClientRect();return{width:m.width,height:m.height}}function p(){let{width:m,height:b}=d();if(m<=0||b<=0)return;let v=window.devicePixelRatio||1;if((e.width!==Math.round(m*v)||e.height!==Math.round(b*v))&&(e.width=Math.round(m*v),e.height=Math.round(b*v)),t.setTransform(v,0,0,v,0,0),t.clearRect(0,0,m,b),!n.length)return;let C=m-_r,L=b-xr,U=Math.round(L*_n),$=L-U-6,O=ur(n);if(!O)return;let{bodyWidth:q,centers:j}=pr(n.length,C),E=dr(n);t.font=vn,t.textBaseline="middle";for(let A of mr(O.min,O.max)){let k=pe(A,O,$);t.strokeStyle=xn,t.beginPath(),t.moveTo(0,k+.5),t.lineTo(C,k+.5),t.stroke(),t.fillStyle=Pe,t.textAlign="left",t.fillText(P(A),C+8,k)}if(E>0)for(let A=0;A<n.length;A+=1){let k=n[A],N=Math.max(1,k.v/E*U);t.fillStyle=k.c>=k.o?`${a}55`:"rgba(142,150,171,0.30)",t.fillRect(j[A]-q/2,L-N,q,N)}for(let A=0;A<n.length;A+=1){let k=n[A],N=j[A],F=k.c>=k.o,ee=F?a:Pe,Se=pe(k.h,O,$),Ce=pe(k.l,O,$),te=pe(k.o,O,$),Ne=pe(k.c,O,$);t.strokeStyle=ee,t.lineWidth=1,t.beginPath(),t.moveTo(N+.5,Se),t.lineTo(N+.5,Ce),t.stroke();let se=Math.min(te,Ne),be=Math.max(1,Math.abs(Ne-te));F?(t.fillStyle=ee,t.fillRect(N-q/2,se,q,be)):t.strokeRect(N-q/2+.5,se+.5,q-1,Math.max(1,be-1))}t.fillStyle=Pe,t.textAlign="center";let fe=window.matchMedia("(max-width: 800px)").matches,he=fe?m<=340?2:3:6;for(let A of hr(n,i,he)){let k=ft(n[A].ts,i),N=k.split(" "),F=fe&&i!=="1d"?N[N.length-1]:k,ee=Math.min(Math.max(j[A],24),C-24);t.fillText(F,ee,b-xr/2)}if(c!==null&&n[c]){let A=j[c];t.strokeStyle=yn,t.setLineDash([3,3]),t.beginPath(),t.moveTo(A+.5,0),t.lineTo(A+.5,L),t.stroke(),t.setLineDash([])}}function u(){if(!r)return;let m=c!==null?n[c]:n[n.length-1];if(!m){r.textContent="";return}r.textContent=[ft(m.ts,i),`O ${P(m.o)}`,`H ${P(m.h)}`,`L ${P(m.l)}`,`C ${P(m.c)}`,`Vol $${P(m.v)}`].join("  ")}function _(m){let b=e.getBoundingClientRect(),v=fr(m.clientX-b.left,n.length,b.width-_r);v!==c&&(c=v,p(),u())}function g(){c=null,p(),u()}e.addEventListener("pointermove",_),e.addEventListener("pointerleave",g);let x=typeof ResizeObserver=="function"?new ResizeObserver(()=>p()):null;return x?.observe(e),{set({candles:m,timeframe:b,hue:v}){n=Array.isArray(m)?m:[],b&&(i=b),v&&(a=v),c=null,p(),u()},clear(){n=[],c=null,p(),u()},destroy(){x?.disconnect(),e.removeEventListener("pointermove",_),e.removeEventListener("pointerleave",g)}}}var zn=40;function V(e,r,t){let n=document.createElement(e);return r&&(n.className=r),t!=null&&(n.textContent=t),n}function vr({host:e,now:r=()=>Date.now()}){let t=V("table","zme-tape__table"),n=V("thead"),i=V("tr");for(let d of["Age","Side","Amount","Price","Value"])i.append(V("th",null,d));n.append(i);let a=V("tbody");t.append(n,a),e.append(t);let c=null;return{set(d,{symbol:p}={}){let u=d.slice(0,zn),_=r(),g=c;a.replaceChildren(...u.map(x=>{let m=V("tr",x.side==="buy"?"zme-tape__row--buy":"zme-tape__row--sell");return g&&!g.has(x.id)&&m.classList.add("is-fresh"),m.append(V("td",null,gr(x.ts,_)),V("td","zme-tape__side",x.side==="buy"?"Buy":"Sell"),V("td",null,`${br(x.tokenAmount)}${p?` ${p}`:""}`),V("td",null,P(x.priceUsd)),V("td",null,x.volumeUsd===null?"—":Fe(x.volumeUsd))),m})),c=new Set(u.map(x=>x.id))},clear(){a.replaceChildren(),c=null},destroy(){t.remove()}}}var wn=Object.freeze({exchange_room_mount:Object.freeze({}),exchange_market_state:Object.freeze({surface:Object.freeze(["chart","tape","ladder","panel"]),outcome:Object.freeze(["ready","empty","partial","not_indexed","rate_limited","unavailable"])})});function En(e,r={}){let t=wn[e];if(!t)return null;let n={};for(let[i,a]of Object.entries(t)){let c=r[i];if(typeof c!="string"||!a.includes(c))return null;n[i]=c}return n}function qe(e,r={},t=globalThis.window?.plausible){let n=En(e,r);if(!n||typeof t!="function")return!1;try{return t(e,{props:n}),!0}catch{return!1}}var An="/registry/zodiacs.registry.json",Tn=12e3,kn=1e4,Sn=6e4,Cn=6e4,Nn=2e4,ht=3e4,zr=8e3,wr=.12;function Er(e,r=Math.random){let t=Math.min(1,Math.max(0,Number(r())||0)),n=1-wr+t*wr*2;return Math.round(e*n)}function Mn(e,r){return e!==r}function Ar(e,r,t){if(!e?.controller.signal.aborted&&!Mn(e?.key??null,r))return null;e?.controller.abort();let n=new AbortController,i=()=>n.abort();return t.aborted?n.abort():t.addEventListener("abort",i,{once:!0}),{key:r,controller:n,detach(){t.removeEventListener("abort",i)}}}function Tr(e,r){return e===r&&!r.controller.signal.aborted}function Dn(e){return e?.controller?.state?.state==="signing"}var Ln="These pools have no order book. Each rung is an indicative Jupiter quote at the time requested; price comes from the returned atomic amounts and “vs best” compares the smallest rung. Sell sizes are estimates from the indexed mid. Quotes with unreadable fee or impact fields, or a fee above 0.10%, are refused. A trade is quoted again before wallet review.",Rn="Reference market — the sign’s canonical pool. Orders execute through Jupiter and may route beyond it.",In="Indicative aggregate quote — Jupiter may route across several pools; a trade is quoted again before wallet review.";function l(e,r,t){let n=document.createElement(e);return r&&(n.className=r),t!=null&&(n.textContent=t),n}function ae(e){return l("p","zme__state",e)}function Un(e,r){let t=new AbortController,n=setTimeout(()=>t.abort(),r);return fetch(e,{cache:"no-store",signal:t.signal}).finally(()=>clearTimeout(n))}async function On(){let e=await Un(An,Tn);if(!e.ok)throw new Error(`registry ${e.status}`);let r=await e.json(),t=new Map;for(let n of r?.assets??[]){let i=n?.native;i?.chain!=="solana"||!i?.address||t.set(n.sign,{mint:i.address,symbol:i.symbol??""})}if(t.size!==me.length)throw new Error("registry: incomplete");return t}var Be=null;function Fn(){return Be||(Be=new Promise(e=>{if(window.zodiacsTrade){e(window.zodiacsTrade);return}let r=document.createElement("script");r.src="/assets/trade.js",r.defer=!0,r.addEventListener("load",()=>e(window.zodiacsTrade??null),{once:!0}),r.addEventListener("error",()=>e(null),{once:!0}),document.body.appendChild(r)}),Be)}var Pn=new Set(me.map(e=>e.slug));function qn(){let e=(window.location.hash||"").replace(/^#/,"");return Pn.has(e)?e:"aries"}function kr({host:e}){let r=null;try{r=window.localStorage}catch{}let t=Yt({storage:r}),n=Qt({storage:r}),i=new Map;function a(o,s){i.get(o)!==s&&(i.set(o,s),qe("exchange_market_state",{surface:o,outcome:s}))}let c=l("div","zme-mobile-market"),d=l("button","zme-mobile-market__button");d.type="button",d.setAttribute("aria-haspopup","dialog"),d.setAttribute("aria-expanded","false"),d.setAttribute("aria-controls","zme-market-sheet");let p=document.createElement("picture"),u=document.createElement("source");u.type="image/avif";let _=document.createElement("img");_.className="zme-mobile-market__disc",_.width=38,_.height=38,_.alt="",p.append(u,_);let g=l("span","zme-mobile-market__identity"),x=l("span","zme-mobile-market__name","—"),m=l("span","zme-mobile-market__pair","— / USDC");g.append(x,m);let b=l("span","zme-mobile-market__chevron","⌄");b.setAttribute("aria-hidden","true"),d.append(p,g,b);let v=l("div","zme-mobile-summary"),C=l("span","zme-mobile-summary__price","—"),L=l("span","zme-mobile-summary__change","—"),U=l("span","zme-mobile-summary__liquidity","Liquidity —");v.append(C,L,U),c.append(d,v);let $=l("div","zme-mobile-tabs");$.setAttribute("role","tablist"),$.setAttribute("aria-label","Market view");let O=l("button","zme-mobile-tabs__tab","Chart"),q=l("button","zme-mobile-tabs__tab","Trade");for(let[o,s,f]of[[O,"zme-chart-tab","zme-chart-panel"],[q,"zme-trade-tab","zme-trade-panel"]])o.type="button",o.id=s,o.setAttribute("role","tab"),o.setAttribute("aria-controls",f);$.append(O,q);let j=l("div","zme__grid");j.dataset.mobileTab="chart";let E=l("section","zme__card zme__rail");E.id="zme-market-sheet",E.setAttribute("aria-label","The twelve records");let fe=l("div","zme__sheet-head"),he=l("h2","zme__sheet-title","Choose a market");he.id="zme-market-sheet-title";let A=l("button","zme__sheet-close","Close");A.type="button",fe.append(he,A);let k=l("ul","zme__rail-list");E.append(fe,k);let N=l("button","zme__sheet-backdrop");N.type="button",N.tabIndex=-1,N.setAttribute("aria-label","Close market selector");let F=l("div","zme__center");F.id="zme-chart-panel";let ee=l("section","zme__card"),Se=l("div","zme__card-head"),Ce=l("h2","zme__card-title","—"),te=l("div","zme__frames");te.setAttribute("role","group"),te.setAttribute("aria-label","Chart timeframe"),Se.append(Ce,te);let Ne=l("p","zme__scope",Rn),se=l("p","zme__readout");se.id="zme-chart-readout";let be=l("div","zme__canvas-box"),ge=l("canvas","zme__canvas");ge.setAttribute("role","img"),ge.setAttribute("aria-label","Candlestick chart of recent prices in the canonical pool"),ge.setAttribute("aria-describedby","zme-chart-readout"),be.append(ge);let R=ae("");R.hidden=!0;let bt=l("div","zme__chart-foot"),Cr=l("span",null,"Independent third-party data, not a valuation or recommendation."),Me=l("a",null,"Chart data by GeckoTerminal");Me.href=Jt,Me.target="_blank",Me.rel="noopener noreferrer external nofollow",bt.append(Cr,Me),ee.append(Se,Ne,se,be,R,bt);let gt=l("section","zme__card"),_t=l("div","zme__card-head");_t.append(l("h2","zme__card-title","Recent trades"),l("span","zme__card-note","canonical pool · newest first"));let _e=l("div","zme-tape__scroll");_e.tabIndex=0,_e.setAttribute("role","region"),_e.setAttribute("aria-label","Recent canonical-pool trades");let G=ae("");G.hidden=!0,gt.append(_t,_e,G),F.append(ee,gt);let J=l("div","zme__desk");J.id="zme-trade-panel";let xt=l("section","zme__card"),Nr=l("p","zme__scope",In),W=l("div","zme__panel-host");xt.append(Nr,W);let yt=l("section","zme__card"),vt=l("div","zme__card-head"),Mr=l("h2","zme__card-title","Depth"),Y=l("button","zme__ladder-refresh","Load depth");Y.type="button",vt.append(Mr,Y);let Dr=l("span","zme__card-note","10 taker-less quotes · about 20 seconds"),zt=l("table","zme__ladder-table"),wt=l("thead"),Et=l("tr"),Lr=l("th","zme__ladder-side","Side");for(let o of[null,"Size","Price","vs best"])Et.append(o===null?Lr:l("th",null,o));wt.append(Et);let xe=l("tbody");zt.append(wt,xe);let Q=ae("Load depth to request ten taker-less venue quotes."),Rr=l("p","zme__ladder-caption",Ln);yt.append(vt,Dr,zt,Q,Rr);let At=l("section","zme__card"),Tt=l("div","zme__card-head");Tt.append(l("h2","zme__card-title","Market"),l("span","zme__card-note","Dex Screener · indexed"));let kt=l("div","zme__stats"),$e=o=>{let s=l("div","zme__stat"),f=l("span","zme__stat-value","—");return s.append(l("span","zme__stat-label",o),f),kt.append(s),f},Ir=$e("Price"),je=$e("24h"),Ur=$e("Indexed liquidity");At.append(Tt,kt),J.append(xt,yt,At);let ye=l("button","zme-mobile-buy","Buy");ye.type="button",j.append(E,F,J),e.append(c,$,N,j,ye);let ve=null,De=!1,Ge=!1,He=null,St=[],Ct={},T=null,re="1h",B=null,le=null,Nt=0,Ve=null,Ke=null,Je=null,ze=null,Ye=null,we=null,Ee=null,Ae=null,Le=null,Z=0,ne=!1,We="chart",ce=!1,Re=null,Mt="",X=window.matchMedia("(max-width: 800px)"),Dt="IntersectionObserver"in window?new IntersectionObserver(([o])=>{e.dataset.stickyVisible=String(o.isIntersecting)},{threshold:.02}):null;e.dataset.stickyVisible="true",Dt?.observe(e);let oe=yr({canvas:ge,readout:se}),ie=vr({host:_e}),Ie=new Map;for(let o of me){let s=l("li"),f=l("button","zme__rail-item");f.type="button",f.style.setProperty("--sign",o.hue),f.setAttribute("aria-pressed","false");let h=document.createElement("picture"),w=document.createElement("source");w.srcset=`/assets/zodiac-icons/128/${o.slug}.avif`,w.type="image/avif";let y=document.createElement("img");y.className="zme__rail-disc",y.src=`/assets/zodiac-icons/128/${o.slug}.webp`,y.width=30,y.height=30,y.alt="",y.loading="lazy",y.decoding="async",h.append(w,y);let I=l("span","zme__rail-name",o.name),M=l("span","zme__rail-quote"),D=l("span","zme__rail-price","—"),K=l("span","zme__rail-change","");M.append(D,K),f.append(h,I,M),f.addEventListener("click",()=>{let jr=nt(o.slug);X.matches&&jr!==!1&&de()}),s.append(f),k.append(s),Ie.set(o.slug,{button:f,price:D,change:K})}let Lt=new Map;for(let o of Object.keys(it)){let s=l("button","zme__frame",o);s.type="button",s.setAttribute("aria-pressed",String(o===re)),s.addEventListener("click",()=>{if(o!==re){re=o;for(let[f,h]of Lt)h.setAttribute("aria-pressed",String(f===re));qr()}}),te.append(s),Lt.set(o,s)}let Qe=o=>me.find(s=>s.slug===o)??null,ue=o=>ve?.get(o)??null,Ze=o=>{let s=ue(o);return s?Ct[s.mint]??null:null};function Te(o,{focus:s=!1}={}){if(!(o!=="chart"&&o!=="trade")){We=o,j.dataset.mobileTab=o;for(let[f,h]of[[O,"chart"],[q,"trade"]]){let w=h===o;f.setAttribute("aria-selected",String(w)),f.tabIndex=w?0:-1,s&&w&&f.focus()}X.matches&&(F.setAttribute("aria-hidden",String(o!=="chart")),J.setAttribute("aria-hidden",String(o!=="trade")))}}function Rt(o=0){if(!X.matches||We!=="trade")return;let s=W.querySelector(".tp .pay__input");if(s){s.focus({preventScroll:!0}),s.scrollIntoView({block:"center",behavior:"auto"});return}o<20&&setTimeout(()=>Rt(o+1),50)}function de({restoreFocus:o=!0}={}){ce&&(ce=!1,E.dataset.open="false",N.dataset.open="false",d.setAttribute("aria-expanded","false"),X.matches&&(E.setAttribute("aria-hidden","true"),E.inert=!0),document.body.style.overflow=Mt,o&&Re?.isConnected&&Re.focus(),Re=null)}function Or(){!X.matches||d.disabled||ce||(ce=!0,Re=document.activeElement,Mt=document.body.style.overflow,document.body.style.overflow="hidden",E.inert=!1,E.dataset.open="true",N.dataset.open="true",E.setAttribute("aria-hidden","false"),d.setAttribute("aria-expanded","true"),requestAnimationFrame(()=>{(E.querySelector('[aria-pressed="true"]')||A).focus()}))}function Xe(){if(X.matches){E.setAttribute("role","dialog"),E.setAttribute("aria-modal","true"),E.setAttribute("aria-labelledby",he.id),F.setAttribute("role","tabpanel"),F.setAttribute("aria-labelledby",O.id),J.setAttribute("role","tabpanel"),J.setAttribute("aria-labelledby",q.id),ce||(E.setAttribute("aria-hidden","true"),E.inert=!0),Te(We);return}de({restoreFocus:!1}),E.removeAttribute("role"),E.removeAttribute("aria-modal"),E.removeAttribute("aria-hidden"),E.removeAttribute("aria-labelledby"),E.inert=!1,F.removeAttribute("role"),F.removeAttribute("aria-labelledby"),F.removeAttribute("aria-hidden"),J.removeAttribute("role"),J.removeAttribute("aria-labelledby"),J.removeAttribute("aria-hidden")}function It(o){if(ce){if(o.key==="Escape"){o.preventDefault(),de();return}if(o.key==="Tab"){let h=[...E.querySelectorAll("button:not(:disabled)")];if(!h.length)return;let w=h[0],y=h[h.length-1];o.shiftKey&&document.activeElement===w?(o.preventDefault(),y.focus()):!o.shiftKey&&document.activeElement===y&&(o.preventDefault(),w.focus())}return}if(!$.contains(o.target)||!["ArrowLeft","ArrowRight","Home","End"].includes(o.key))return;o.preventDefault();let f=o.key==="ArrowLeft"||o.key==="Home"?"chart":"trade";Te(f,{focus:!0})}d.addEventListener("click",Or),A.addEventListener("click",()=>de()),N.addEventListener("click",()=>de()),O.addEventListener("click",()=>Te("chart")),q.addEventListener("click",()=>Te("trade")),ye.addEventListener("click",()=>{Te("trade"),Rt()}),document.addEventListener("keydown",It),X.addEventListener("change",Xe),Xe();function z(o,s){o.textContent=s,o.hidden=!s}function Ut(o){let s=Qe(o);j.style.setProperty("--sign",s?.hue??"#C6CCDA");for(let[h,w]of Ie)w.button.setAttribute("aria-pressed",String(h===o));let f=ue(o);Ce.textContent=f?.symbol?`${f.symbol} / USD`:s?.name??"—",x.textContent=s?.name??"—",m.textContent=`${f?.symbol||s?.name||"—"} / USDC`,u.srcset=s?`/assets/zodiac-icons/128/${s.slug}.avif`:"",_.src=s?`/assets/zodiac-icons/128/${s.slug}.webp`:"",ye.textContent=`Buy ${s?.name??""}`.trim()}function Ot(o){for(let{button:s}of Ie.values())s.disabled=o,o?s.title="Finish or dismiss the wallet review before changing signs.":s.removeAttribute("title");d.disabled=o,ye.disabled=o}function Ft(){let o=l("div");o.append(ae("The registry could not be read, so there is nothing to trade against."));let s=l("button","zme__ladder-refresh","Try again");return s.type="button",s.style.display="block",s.style.margin="0 auto 10px",s.addEventListener("click",()=>Gt()),o.append(s),o}function Fr(){for(let o of me){let s=Ie.get(o.slug),f=Ze(o.slug);if(!f?.priceUsd){s.price.textContent="—",s.change.textContent="";continue}if(s.price.textContent=P(f.priceUsd),f.change24hPct===null)s.change.textContent="";else{let h=f.change24hPct>0;s.change.textContent=`${h?"+":""}${f.change24hPct.toFixed(2)}%`,s.change.classList.toggle("zme__rail-change--up",h),s.change.classList.toggle("zme__rail-change--down",f.change24hPct<0)}}}function Pt(){let o=T?Ze(T):null,s=o?.priceUsd?P(o.priceUsd):"—",f=o?.change24hPct===null||o?.change24hPct===void 0?"—":`${o.change24hPct>0?"+":""}${o.change24hPct.toFixed(2)}%`,h=o?.liquidityUsd?Fe(o.liquidityUsd):"—";Ir.textContent=s,je.textContent=f,je.classList.toggle("is-positive",o?.change24hPct>0),je.classList.toggle("is-negative",o?.change24hPct<0),Ur.textContent=h,C.textContent=s,L.textContent=f,L.classList.toggle("is-positive",o?.change24hPct>0),L.classList.toggle("is-negative",o?.change24hPct<0),U.textContent=`Liquidity ${h}`}async function et(){if(!ve)return;if(Ae)return Ae;let o=new AbortController,s=setTimeout(()=>o.abort(),kn),f=(async()=>{try{let h=[...ve.values()].map(y=>y.mint),w=await rr({mints:h,signal:o.signal});Ct=w.stats,St=w.rows,Fr(),Pt()}catch{}finally{clearTimeout(s)}})();Ae=f;try{return await f}finally{Ae===f&&(Ae=null)}}function qt(){let o=ue(T);return o?Vt({slug:T,mint:o.mint,rows:St}):null}function tt(o,s){clearTimeout(ze),ze=setTimeout(()=>{!o.aborted&&document.visibilityState==="visible"&&ke(o)},s)}function rt(o,s){clearTimeout(Ye),Ye=setTimeout(()=>{!o.aborted&&document.visibilityState==="visible"&&Ue(o)},s)}async function ke(o){let s=`${T}:${re}`,f=Ar(we,s,o);if(f){we=f;try{let h=Qe(T),w=re,y=T,I=()=>Tr(we,f)&&w===re&&y===T,M=qt();if(!M){oe.clear(),z(R,"No indexed pool to chart. The trade panel still quotes the venue directly."),a("chart","not_indexed");return}if(n.active()){z(R,"The chart service asked for a pause. Retrying shortly."),tt(o,n.remainingMs()+250);return}if(!t.take()){z(R,"Waiting for the chart service — retrying shortly."),tt(o,zr);return}try{let D=n.token(),K=await Zt({pool:M,timeframe:w,signal:f.controller.signal});if(!I())return;if(n.ok(D),!K.length){oe.clear(),z(R,"No trades in this window yet."),a("chart","empty");return}z(R,""),oe.set({candles:K,timeframe:w,hue:h?.hue}),a("chart","ready")}catch(D){if(D?.name==="AbortError")return;if(D?.code==="rate_limited"){if(n.fail(D.retryAfterMs),!I())return;oe.clear(),z(R,"The chart service asked for a pause. Retrying shortly."),a("chart","rate_limited"),tt(o,n.remainingMs()+250);return}if(!I())return;oe.clear(),z(R,"Chart unavailable. The trade panel still quotes the venue directly."),a("chart",D?.code==="not_indexed"?"not_indexed":"unavailable")}}finally{f.detach(),we===f&&(we=null)}}}async function Ue(o){let f=Ar(Ee,T,o);if(f){Ee=f;try{let h=ue(T),w=T,y=()=>Tr(Ee,f)&&w===T,I=qt();if(!h||!I){ie.clear(),z(G,"No indexed pool to read trades from."),a("tape","not_indexed");return}if(n.active()){z(G,"The trade feed asked for a pause. Retrying shortly."),rt(o,n.remainingMs()+250);return}if(!t.take()){z(G,"Waiting for the trade feed — retrying shortly."),rt(o,zr);return}try{let M=n.token(),D=await Xt({pool:I,mint:h.mint,signal:f.controller.signal});if(!y())return;if(n.ok(M),!D.length){ie.clear(),z(G,"No recent trades in this pool."),a("tape","empty");return}z(G,""),ie.set(D,{symbol:h.symbol}),a("tape","ready")}catch(M){if(M?.name==="AbortError")return;if(M?.code==="rate_limited"){if(n.fail(M.retryAfterMs),!y())return;ie.clear(),z(G,"The trade feed asked for a pause. Retrying shortly."),a("tape","rate_limited"),rt(o,n.remainingMs()+250);return}if(!y())return;ie.clear(),z(G,"Trade feed unavailable."),a("tape",M?.code==="not_indexed"?"not_indexed":"unavailable")}}finally{f.detach(),Ee===f&&(Ee=null)}}}function Bt(){clearTimeout(Ve),clearTimeout(Ke),clearTimeout(ze),clearTimeout(Ye),Ve=null,Ke=null}function Pr(){if(Bt(),!B)return;let{signal:o}=B,s=()=>{Ve=setTimeout(async()=>{!o.aborted&&document.visibilityState!=="hidden"&&await ke(o),o.aborted||s()},Er(Cn))},f=()=>{Ke=setTimeout(async()=>{!o.aborted&&document.visibilityState!=="hidden"&&await Ue(o),o.aborted||f()},Er(Nn))};s(),f()}function qr(){B&&(clearTimeout(ze),ze=null,z(R,""),ke(B.signal))}function $t(o){xe.replaceChildren();for(let{side:s,rungs:f}of o)for(let h of f){let w=l("tr",s==="buy"?"zme__ladder-row--buy":"zme__ladder-row--sell"),y=[l("td","zme__ladder-side",s==="buy"?"Buy":"Sell"),l("td",null,`${s==="sell"?"≈":""}$${h.notional}`)];if(h.error||!h.priceScaled){let I=h.error==="no_route"?"no route":"unavailable",M=l("td",null,I);M.colSpan=2,y.push(M)}else y.push(l("td",null,P(h.price)),l("td",null,h.impactBps===null?"—":`${(h.impactBps/100).toFixed(2)}%`));w.append(...y),xe.append(w)}}async function Br(){let o=ue(T);if(!o||!B)return;let s=T,f=Date.now();if(f<Z)return;Z=f+ht,Y.disabled=!0,Y.textContent="Reading…";let{signal:h}=B;z(Q,"Reading buy quotes from the venue…");try{let w=Ze(T),y=await pt({mint:o.mint,side:"buy",signal:h});if(h.aborted)return;if($t([y]),y.halted==="rate_limited"){Z=Math.max(Z,Date.now()+Math.max(ht,Number(y.retryAfterMs)||0)),z(Q,"The venue asked for a pause. Try depth again later."),a("ladder","rate_limited");return}if(z(Q,"Reading sell quotes from the venue…"),await new Promise(K=>{setTimeout(K,mt)}),h.aborted)return;let I=await pt({mint:o.mint,side:"sell",midPriceUsd:w?.priceUsd??null,signal:h});if(h.aborted)return;if($t([y,I]),I.halted==="rate_limited"){Z=Math.max(Z,Date.now()+Math.max(ht,Number(I.retryAfterMs)||0)),z(Q,"The venue asked for a pause. Partial depth is shown."),a("ladder","rate_limited");return}let M=[...y.rungs,...I.rungs],D=M.filter(K=>K.error||!K.priceScaled).length;a("ladder",D===0?"ready":D===M.length?"unavailable":"partial"),z(Q,D===0?"":"Some venue quotes were unavailable.")}catch(w){w?.name!=="AbortError"&&!h.aborted&&(xe.replaceChildren(),z(Q,"Venue quotes unavailable just now."),a("ladder","unavailable"))}finally{clearTimeout(Le),Le=setTimeout(()=>{!ne&&s===T&&(Y.disabled=!1,Y.textContent="Refresh")},Math.max(0,Z-Date.now()))}}Y.addEventListener("click",()=>Br());function $r(){let o=Qe(T),s=ue(T),f=++Nt;if(le?.destroy?.(),le=null,Ot(!1),W.replaceChildren(),!o||!s){W.append(De?Ft():ae("Reading the registry…"));return}Fn().then(h=>{if(!(ne||f!==Nt)){if(!h){W.append(ae("The trade panel could not load. The record page lists the venue route directly.")),a("panel","unavailable");return}le=h.mount(W,{name:o.name,slug:o.slug,mint:s.mint,hue:o.hue,iconUrl:`/assets/zodiac-icons/128/${o.slug}.webp`},{onStateChange:(w,y)=>{Ot(y.state==="signing"),y.state==="ready"&&a("panel","ready"),y.state==="error"&&a("panel",y.error==="rate_limited"?"rate_limited":"unavailable")}}),le||a("panel","unavailable")}})}function nt(o){if(o!==T&&Dn(le))return!1;if(!ve){He=o,Ut(o),De?z(R,"The registry could not be read. Nothing verified, nothing shown."):z(R,"Reading the registry…");return}if(o===T)return;T=o,B?.abort(),B=new AbortController,clearTimeout(Le),Z=0,Y.disabled=!1,Y.textContent="Load depth",xe.replaceChildren(),z(Q,"Load depth to request ten taker-less venue quotes."),Ut(o);try{window.history.replaceState(null,"",`#${o}`)}catch{}oe.clear(),ie.clear(),z(R,"Reading the chart…"),z(G,"Reading recent trades…"),Pt(),$r();let{signal:s}=B;Pr(),ke(s),Ue(s)}function jt(){if(document.visibilityState!=="visible"||!B)return;let{signal:o}=B;ke(o),Ue(o),et()}document.addEventListener("visibilitychange",jt);function Gt(){Ge||ne||(Ge=!0,De=!1,z(R,"Reading the registry…"),z(G,""),W.replaceChildren(ae("Reading the registry…")),On().then(async o=>{if(ne||(ve=o,await et(),ne))return;clearInterval(Je),Je=setInterval(()=>{document.visibilityState!=="hidden"&&et()},Sn);let s=He??qn();He=null,nt(s)}).catch(()=>{ne||(De=!0,z(R,"The registry could not be read. Nothing verified, nothing shown."),W.replaceChildren(Ft()))}).finally(()=>{Ge=!1}))}return Gt(),{select:nt,destroy(){ne=!0,de({restoreFocus:!1}),B?.abort(),Bt(),clearInterval(Je),clearTimeout(Le),document.removeEventListener("visibilitychange",jt),document.removeEventListener("keydown",It),X.removeEventListener("change",Xe),Dt?.disconnect(),le?.destroy?.(),oe.destroy(),ie.destroy(),j.remove()}}}function Bn(){if(document.querySelector("style[data-zme-styles]"))return;let e=document.createElement("style");e.setAttribute("data-zme-styles",""),e.textContent=Ht,document.head.appendChild(e)}function Sr(){let e=document.querySelector("[data-zme-terminal]");!e||e.dataset.zmeMounted||(e.dataset.zmeMounted="1",Bn(),kr({host:e}),qe("exchange_room_mount"))}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",Sr,{once:!0}):Sr();})();
