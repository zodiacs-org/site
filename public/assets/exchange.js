/* Generated from src/exchange/ by scripts/build-exchange.mjs — do not edit directly. */
"use strict";(()=>{var qt=`
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
`;var ue=[{slug:"aries",name:"Aries",glyph:"♈",hue:"#DE8E79"},{slug:"taurus",name:"Taurus",glyph:"♉",hue:"#B9D4BE"},{slug:"gemini",name:"Gemini",glyph:"♊",hue:"#B29DD0"},{slug:"cancer",name:"Cancer",glyph:"♋",hue:"#B6D4E4"},{slug:"leo",name:"Leo",glyph:"♌",hue:"#E0A9B4"},{slug:"virgo",name:"Virgo",glyph:"♍",hue:"#B7D9B0"},{slug:"libra",name:"Libra",glyph:"♎",hue:"#D3A9DE"},{slug:"scorpio",name:"Scorpio",glyph:"♏",hue:"#B9DCE8"},{slug:"sagittarius",name:"Sagittarius",glyph:"♐",hue:"#E0B080"},{slug:"capricorn",name:"Capricorn",glyph:"♑",hue:"#C0DEA8"},{slug:"aquarius",name:"Aquarius",glyph:"♒",hue:"#AE8FC9"},{slug:"pisces",name:"Pisces",glyph:"♓",hue:"#A9D4C4"}];var Br={aries:"HRn98YLGigP475eS1GaQYRMbqk1V4dkV6tdKyLhVh2iS",taurus:"2GNtxia4fLW3URj5MLqVfgoKrAgDpphtAVazK41eTPfu",gemini:"HxhdKrB1UpSwfuMoZMVzPVELzbPWHdyN6PHU9CBFium9",cancer:"DaTEcH6da4i1evZU37F9ibQirYXhLKZpKDzDno346nSW",leo:"48ErBGMqiZekyLoCcebd7cS5KNQPzqr7QQAK9mzAPQGQ",virgo:"5WcVjf8fzPkHaZqTSZDdbDFL6p2bLbAgEigxpevNrcRh",libra:"DTXPQjK4ae4h2Wc7D5Rpij8YmSQxqLuTcNKrpBCjcAN9",scorpio:"3d2KYuMgj2yotNC6SKX4HNoeSWp4n8zqZSQ9kFH81Yta",sagittarius:"7mP6WeVYBNt3eao5szsMPmuHughHjNRx26TcrgJXZRky",capricorn:"549aknNCvxbiqmikS6sAnY6Dbg37MeENWn6ZFBfc7sin",aquarius:"BygCEAhCNyWC8Co9yPa4K84NGkgkgMWdib2FG5hhuiUv",pisces:"Fzz8QrSV8sPKsTtHocwYARE8Zo6Rd4Wv2Ee4JtCuiDko"};function $r(e,r){if(!Array.isArray(e)||!r)return null;let t=null,n=-1;for(let i of e){if(i?.chainId!=="solana"||!i?.pairAddress||i?.baseToken?.address!==r)continue;let a=Number(i?.liquidity?.usd);!Number.isFinite(a)||a<=0||a>n&&(n=a,t=String(i.pairAddress))}return t}function Bt({slug:e,mint:r,rows:t}){return Br[e]??$r(t,r)}var $t="https://api.geckoterminal.com/api/v2",jt="https://www.geckoterminal.com/";var jr="zodiacs.exchange.gecko-budget.v1",Gr="zodiacs.exchange.gecko-cooloff.v1",jn=Object.freeze(["network","rate_limited","unavailable","not_indexed"]),tt=class extends Error{constructor(r,t,{cause:n,retryAfterMs:i=null}={}){super(t,n?{cause:n}:void 0),this.name="ExchangeDataError",this.code=r,this.retryAfterMs=Number.isFinite(i)&&i>=0?i:null}};function H(e,r,t){throw new tt(e,r,t)}var rt=Object.freeze({"15m":{path:"minute",aggregate:15,limit:192},"1h":{path:"hour",aggregate:1,limit:168},"4h":{path:"hour",aggregate:4,limit:180},"1d":{path:"day",aggregate:1,limit:180}});function Hr({pool:e,timeframe:r,baseUrl:t=$t}){let n=rt[r];n||H("unavailable",`Unknown timeframe: ${r}`);let i=new URL(`${t}/networks/solana/pools/${encodeURIComponent(e)}/ohlcv/${n.path}`);return i.searchParams.set("aggregate",String(n.aggregate)),i.searchParams.set("limit",String(n.limit)),i.toString()}function Vr({pool:e,baseUrl:r=$t}){return new URL(`${r}/networks/solana/pools/${encodeURIComponent(e)}/trades`).toString()}function Kr(e){(!e?.data||typeof e.data!="object")&&H("unavailable","The chart data was not readable.");let r=e.data.attributes?.ohlcv_list;if(r===void 0)return[];Array.isArray(r)||H("unavailable","The chart data was not readable.");let t=[];for(let n of r){if(!Array.isArray(n)||n.length<6)continue;let[i,a,c,d,p,u]=n.map(Number);[i,a,c,d,p,u].every(Number.isFinite)&&(i<=0||a<=0||c<=0||d<=0||p<=0||u<0||t.push({ts:i,o:a,h:c,l:d,c:p,v:u}))}return t.sort((n,i)=>n.ts-i.ts),t}function Yr(e,r){let t=e?.data;Array.isArray(t)||H("unavailable","The trade data was not readable.");let n=[];for(let i of t){let a=i?.attributes;if(!a)continue;let c=Date.parse(a.block_timestamp??"");if(!Number.isFinite(c))continue;let d,p;if(a.to_token_address===r)d=Number(a.to_token_amount),p=Number(a.price_to_in_usd);else if(a.from_token_address===r)d=Number(a.from_token_amount),p=Number(a.price_from_in_usd);else continue;let u=a.kind==="buy"||a.kind==="sell"?a.kind:null,_=Number(a.volume_in_usd);!u||!Number.isFinite(d)||d<=0||!Number.isFinite(p)||p<=0||n.push({id:String(i.id??`${a.tx_hash}-${c}`),ts:c,side:u,tokenAmount:d,priceUsd:p,volumeUsd:Number.isFinite(_)?_:null,tx:typeof a.tx_hash=="string"?a.tx_hash:null})}return n.sort((i,a)=>a.ts-i.ts),n}function Gt({limit:e=12,windowMs:r=6e4,now:t=()=>Date.now(),storage:n=null,storageKey:i=jr}={}){let a=[],c=!!n;function d(){if(!c)return a;try{let u=JSON.parse(n.getItem(i)??"[]");if(Array.isArray(u))return u.filter(Number.isFinite)}catch{c=!1}return a}function p(u){if(a=u,!!c)try{n.setItem(i,JSON.stringify(u))}catch{c=!1}}return{take(){let u=t(),_=u-r,b=d().filter(x=>x>_&&x<=u);return b.length>=e?(p(b),!1):(b.push(u),p(b),!0)}}}function Jr(e,{now:r=()=>Date.now(),maxMs:t=12e4}={}){if(typeof e!="string"||!e.trim())return null;let n=e.trim(),i=Number(n);if(Number.isFinite(i)&&i>=0)return Math.min(Math.ceil(i*1e3),t);let a=Date.parse(n);return Number.isFinite(a)?Math.min(Math.max(0,a-r()),t):null}async function Ht(e,{fetchImpl:r=globalThis.fetch,signal:t,deadlineMs:n=12e3}={}){let i=new AbortController,a=!1,c=()=>i.abort();t?.aborted?c():t?.addEventListener("abort",c,{once:!0});let d=setTimeout(()=>{a=!0,i.abort()},n);try{let p;try{p=await r(e,{method:"GET",signal:i.signal,headers:{accept:"application/json"}})}catch(u){if(t?.aborted||(a&&H("network","The chart service timed out.",{cause:u}),u?.name==="AbortError"))throw u;H("network","The chart service could not be reached just now.",{cause:u})}p.status===429&&H("rate_limited","The chart service is rate limiting requests.",{retryAfterMs:Jr(p.headers?.get?.("retry-after")??null)}),p.status===404&&H("not_indexed","This pool is not indexed by the chart service."),p.ok||H("unavailable","The chart service did not answer.");try{return await p.json()}catch(u){if(t?.aborted||(a&&H("network","The chart service timed out.",{cause:u}),u?.name==="AbortError"))throw u;H("unavailable","The chart service did not return a readable answer.",{cause:u})}}finally{clearTimeout(d),t?.removeEventListener("abort",c)}}function Vt({baseMs:e=1e4,maxMs:r=12e4,now:t=()=>Date.now(),storage:n=null,storageKey:i=Gr}={}){let a={until:0,step:0,revision:0},c=!!n;function d(){if(!c)return a;try{let u=JSON.parse(n.getItem(i)??"null");u&&[u.until,u.step,u.revision].every(Number.isFinite)&&(a=u)}catch{c=!1}return a}function p(u){if(a=u,!!c)try{n.setItem(i,JSON.stringify(u))}catch{c=!1}}return{active(){return t()<d().until},remainingMs(){return Math.max(0,d().until-t())},token(){return d().revision},fail(u=null){let _=d(),b=Math.min(e*2**_.step,r),x=Number.isFinite(u)?Math.min(Math.max(0,u),r):0,m=t()+Math.max(b,x);p({until:Math.max(_.until,m),step:_.step+1,revision:_.revision+1})},ok(u=null){let _=d();return u!==null&&u!==_.revision?!1:(p({until:0,step:0,revision:_.revision+1}),!0)}}}async function Kt({pool:e,timeframe:r,baseUrl:t,fetchImpl:n,signal:i,deadlineMs:a}){let c=await Ht(Hr({pool:e,timeframe:r,baseUrl:t}),{fetchImpl:n,signal:i,deadlineMs:a});return Kr(c)}async function Yt({pool:e,mint:r,baseUrl:t,fetchImpl:n,signal:i,deadlineMs:a}){let c=await Ht(Vr({pool:e,baseUrl:t}),{fetchImpl:n,signal:i,deadlineMs:a});return Yr(c,r)}function Jt(e,r){let t=String(r||"");if(!t||!Array.isArray(e))return null;let n=new Set,i=0;for(let a of e){if(a?.chainId!=="solana"||a?.baseToken?.address!==t)continue;let c=String(a?.pairAddress||"");if(!c||n.has(c))continue;let d=Number(a?.liquidity?.usd);!Number.isFinite(d)||d<=0||(n.add(c),i+=d)}return i>0?i:null}var Wt="https://api.dexscreener.com/tokens/v1/solana";function Wr(e,r=Wt){return`${r}/${e.map(t=>encodeURIComponent(t)).join(",")}`}function Zr(e,r){let t={};if(!Array.isArray(e))return t;for(let n of r){let i=null,a=-1;for(let p of e){if(p?.chainId!=="solana"||!p?.pairAddress||p?.baseToken?.address!==n)continue;let u=Number(p?.liquidity?.usd)||0;u>a&&(a=u,i=p)}if(!i)continue;let c=Number(i.priceUsd),d=Number(i.priceChange?.h24);t[n]={priceUsd:Number.isFinite(c)&&c>0?c:null,change24hPct:Number.isFinite(d)?d:null,liquidityUsd:Jt(e,n)}}return t}async function Zt({mints:e,baseUrl:r=Wt,fetchImpl:t=globalThis.fetch,signal:n}={}){if(!Array.isArray(e)||e.length===0)return{stats:{},rows:[]};let i=await t(Wr(e,r),{method:"GET",headers:{accept:"application/json"},signal:n});if(!i.ok)throw new Error(`stats ${i.status}`);let a=await i.json();return{stats:Zr(a,e),rows:Array.isArray(a)?a:[]}}var Qr="https://api.jup.ag";var Yn=Object.freeze(["invalid_amount","no_route","unavailable","rate_limited","order_mismatch","unexpected_fee","network","execute_unconfirmed","execute_failed"]),Ie=class extends Error{constructor(r,t,{cause:n,retryAfterMs:i=null}={}){super(t,n?{cause:n}:void 0),this.name="TradeError",this.code=r,this.retryAfterMs=i}};function C(e,r,t){throw new Ie(e,r,t)}var nt=Object.freeze({background:0,quote:1,trade:2}),ot=Symbol.for("zodiacs.registry.jupiter-request-gate");function it(){return Object.assign(new Error("The request was cancelled."),{name:"AbortError"})}function Xr({spacingMs:e=2100,now:r=Date.now,setTimeout:t=setTimeout,clearTimeout:n=clearTimeout}={}){let i=0,a=!1,c=null,d=Number.NEGATIVE_INFINITY,p=[];function u(m){let h=p.indexOf(m);h>=0&&p.splice(h,1),m.signal?.removeEventListener?.("abort",m.onAbort)}function _(){let m=0;for(let h=1;h<p.length;h+=1){let y=p[h],T=p[m],R=nt[y.requestClass],U=nt[T.requestClass];(R>U||R===U&&y.sequence<T.sequence)&&(m=h)}return p.splice(m,1)[0]}function b(){if(a||c)return;for(let y=p.length-1;y>=0;y-=1){if(!p[y].signal?.aborted)continue;let T=p[y];u(T),T.reject(it())}if(!p.length)return;let m=Math.max(0,d+e-r());if(m>0){c=t(()=>{c=null,b()},m);return}let h=_();h.started=!0,h.signal?.removeEventListener?.("abort",h.onAbort),a=!0,d=r(),Promise.resolve().then(()=>h.task()).then(h.resolve,h.reject).finally(()=>{a=!1,b()})}function x(m,{requestClass:h="quote",signal:y}={}){return y?.aborted?Promise.reject(it()):new Promise((T,R)=>{let U={task:m,requestClass:Object.prototype.hasOwnProperty.call(nt,h)?h:"quote",signal:y,sequence:i+=1,started:!1,resolve:T,reject:R,onAbort:null};U.onAbort=()=>{U.started||(u(U),R(it()),!p.length&&c&&(n(c),c=null),b())},y?.addEventListener?.("abort",U.onAbort,{once:!0}),p.push(U),b()})}return Object.freeze({schedule:x})}function en(){return typeof window>"u"?null:(globalThis[ot]||(globalThis[ot]=Xr()),globalThis[ot])}function tn(e,r){let t=en();return t?t.schedule(e,r):e()}function rn(e,r){let t=new AbortController,n=!1,i=()=>t.abort();e?.aborted?t.abort():e?.addEventListener?.("abort",i,{once:!0});let a=setTimeout(()=>{n=!0,t.abort()},r);return{signal:t.signal,timedOut:()=>n,cleanup(){clearTimeout(a),e?.removeEventListener?.("abort",i)}}}function nn(e,r=Date.now()){let t=e?.headers?.get?.("retry-after");if(!t)return null;let n=Number(t),i=Number.isFinite(n)?n*1e3:Date.parse(t)-r;return!Number.isFinite(i)||i<0?null:Math.min(12e4,Math.round(i))}function at(e,r){let t=String(e??"").trim();/^\d+(?:\.\d+)?$|^\.\d+$|^\d+\.$/.test(t)||C("invalid_amount","Enter an amount using digits and a single decimal point.");let[n="",i=""]=t.split(".");i.length>r&&C("invalid_amount",`That amount is finer than this token's ${r} decimals.`);let a=BigInt((n||"0")+i.padEnd(r,"0"));return a<=0n&&C("invalid_amount","Enter an amount greater than zero."),a}function st(e,r,{maxFractionDigits:t=r}={}){let n=BigInt(e),i=n<0n,a=(i?-n:n).toString().padStart(r+1,"0"),c=a.slice(0,a.length-r),d=r>0?a.slice(a.length-r):"";return t<d.length&&(d=d.slice(0,t)),d=d.replace(/0+$/,""),`${i?"-":""}${c}${d?`.${d}`:""}`}function on(e,r){let t=new URL("/swap/v2/order",e);for(let[n,i]of Object.entries(r))i!=null&&i!==""&&t.searchParams.set(n,String(i));return t.toString()}async function an(e){try{return await e.json()}catch(r){if(r?.name==="AbortError")throw r;C("unavailable","The venue did not return a readable answer.",{cause:r})}}async function Qt({inputMint:e,outputMint:r,amount:t,taker:n,baseUrl:i=Qr,fetchImpl:a=globalThis.fetch,signal:c,requestClass:d=n?"trade":"quote",deadlineMs:p=12e3}){let u=on(i,{inputMint:e,outputMint:r,amount:String(t),taker:n}),_=null;try{let b;try{b=await tn(()=>(_=rn(c,p),a(u,{method:"GET",signal:_.signal,headers:{accept:"application/json"}})),{requestClass:d,signal:c})}catch(m){if(m?.name==="AbortError"&&!_?.timedOut())throw m;C("network","The price could not be reached just now.",{cause:m})}b.status===429&&C("rate_limited","The venue is rate limiting requests. Try again shortly.",{retryAfterMs:nn(b)}),b.status>=500&&C("unavailable","The venue did not answer.");let x;try{x=await an(b)}catch(m){throw m?.name==="AbortError"&&_?.timedOut()&&C("network","The price could not be reached just now.",{cause:m}),m}if(x?.error||!b.ok){let m=typeof x?.error=="string"?x.error:"no route";/quote|route|liquidity/i.test(m)&&C("no_route","No route is available for that amount right now."),C("unavailable","The venue could not price that trade.")}return sn(x)}catch(b){if(b instanceof Ie||b?.name==="AbortError")throw b;C("network","The price could not be reached just now.",{cause:b})}finally{_?.cleanup()}}function sn(e){(!e||typeof e!="object")&&C("unavailable","The venue returned no order.");let{inputMint:r,outputMint:t,inAmount:n,outAmount:i,requestId:a}=e;(!r||!t||!n||!i)&&C("unavailable","The venue returned an incomplete order.");let c,d;try{c=BigInt(n),d=BigInt(i)}catch(h){C("unavailable","The venue returned unreadable amounts.",{cause:h})}let p=e.platformFee?.feeBps??e.feeBps,u=typeof p=="number"||typeof p=="string"&&p.trim()!=="",_=Number(p);(!u||!Number.isInteger(_)||_<0||_>10)&&C("unexpected_fee","The venue quoted an unexpected fee, so nothing was sent to your wallet.");let b=e.priceImpactPct,x=typeof b=="number"||typeof b=="string"&&b.trim()!=="",m=Number(b);return(!x||!Number.isFinite(m))&&C("unavailable","The venue returned no readable price impact."),{inputMint:r,outputMint:t,inAmount:c,outAmount:d,priceImpactPct:m,feeBps:_,routeLabels:Array.isArray(e.routePlan)?e.routePlan.map(h=>h?.swapInfo?.label).filter(Boolean):[],requestId:a??null,transaction:e.transaction??null,inUsdValue:Number(e.inUsdValue??0),outUsdValue:Number(e.outUsdValue??0)}}function Xt(e,r){return(e.inputMint!==r.inputMint||e.outputMint!==r.outputMint)&&C("order_mismatch","The venue answered for a different token than the one shown."),e.inAmount!==BigInt(r.amount)&&C("order_mismatch","The venue answered for a different amount than the one entered."),e.outAmount<=0n&&C("order_mismatch","The venue returned an empty amount."),(!Number.isInteger(e.feeBps)||e.feeBps<0||e.feeBps>10)&&C("unexpected_fee","The venue quoted an unexpected fee, so nothing was sent to your wallet."),e}var Qn=Object.freeze(["card","usdc"]),Xn=Object.freeze(["idle","quoting","ready","signing","done","error"]),lt="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",er=6;var eo=Object.freeze(["25","50","100","250"]),to=Object.freeze([{name:"Coinbase",mark:"coinbase",href:"https://www.coinbase.com/",note:"Fund a wallet with USDC."},{name:"fomo",mark:"fomo",href:"https://fomo.family/",applePay:!0,note:"Fund in-app; verify the mint."},{name:"MoonPay",mark:"moonpay",href:"https://www.moonpay.com/",note:"Buy USDC by card or bank."},{name:"Ramp Network",mark:"ramp",href:"https://rampnetwork.com/",note:"Buy USDC with mobile pay."}]);var rr=6,cn=Object.freeze(["25","100","250","500","1000"]),nr=12,un=10n**BigInt(nr),ct=2100;function tr(e,r){let t=BigInt(e),n=BigInt(r);return t<=0n||n<=0n?null:t*un/n}function dn(e){return e==null?null:st(e,nr)}function mn(e,r,t){if(!e||!r||r<=0n)return null;let i=(t==="sell"?r-e:e-r)*10000n/r;return i<0n?0:Number(i)}function pn(e,r){let t=Number(e),n=Number(r);if(!Number.isFinite(t)||t<=0||!Number.isFinite(n)||n<=0)return null;let i=t/n;return!Number.isFinite(i)||i<=0?null:i.toFixed(rr)}var fn=e=>new Promise(r=>{setTimeout(r,e)});async function ut({mint:e,side:r,notionals:t=cn,midPriceUsd:n=null,fetchImpl:i,signal:a,spacingMs:c=ct,sleep:d=fn,deadlineMs:p}){let u=[],_=null;for(let b=0;b<t.length;b+=1){let x=t[b];if(a?.aborted||(b>0&&c>0&&await d(c),a?.aborted))break;try{let m;if(r==="sell"){let T=pn(x,n);if(!T){u.push({notional:x,error:"unavailable"});continue}m={inputMint:e,outputMint:lt,amount:at(T,rr)}}else m={inputMint:lt,outputMint:e,amount:at(x,er)};let h=await Qt({...m,fetchImpl:i,signal:a,requestClass:"background",deadlineMs:p});Xt(h,m);let y=r==="sell"?tr(h.outAmount,h.inAmount):tr(h.inAmount,h.outAmount);if(!y){u.push({notional:x,error:"unavailable"});continue}b===0&&(_=y),u.push({notional:x,priceScaled:y,price:dn(y),impactBps:mn(y,_,r),priceImpactPct:h.priceImpactPct})}catch(m){if(m?.name==="AbortError")throw m;if(m?.code==="rate_limited")return{side:r,rungs:u,halted:"rate_limited",retryAfterMs:m.retryAfterMs};u.push({notional:x,error:m?.code??"unavailable"})}}return{side:r,rungs:u}}function ir(e){let r=1/0,t=-1/0;for(let i of e)i.l<r&&(r=i.l),i.h>t&&(t=i.h);if(!Number.isFinite(r)||!Number.isFinite(t))return null;if(r===t){let i=r===0?1:Math.abs(r)*.05;return{min:r-i,max:t+i}}let n=(t-r)*.08;return{min:Math.max(0,r-n),max:t+n}}function ar(e){let r=0;for(let t of e)t.v>r&&(r=t.v);return r}function sr(e,r,t=4){if(!(r>e)||t<1)return[];let n=r-e,i=10**Math.floor(Math.log10(n/(t+1))),a=i*10;for(let d of[1,2,5,10])if(n/(i*d)<=t+1){a=i*d;break}let c=[];for(let d=Math.ceil(e/a)*a;d<=r;d+=a)c.push(d);return c}function lr(e,r){if(e<=0||r<=0)return{step:0,bodyWidth:0,centers:[]};let t=r/e,n=Math.max(1,Math.min(t*.68,13)),i=[];for(let a=0;a<e;a+=1)i.push(t*a+t/2);return{step:t,bodyWidth:n,centers:i}}function de(e,r,t){let n=r.max-r.min;return n<=0?t/2:t-(e-r.min)/n*t}function cr(e,r,t){if(r<=0||t<=0||e<0||e>=t)return null;let n=Math.floor(e/t*r);return n>=0&&n<r?n:null}function ur(e,r,t=6){if(!e.length)return[];let n=[],i=Math.max(1,Math.ceil(e.length/t));for(let a=0;a<e.length;a+=i)n.push(a);return n}function O(e){let r=Number(e);if(!Number.isFinite(r))return"—";if(r===0)return"0";let t=Math.max(0,3-Math.floor(Math.log10(Math.abs(r))));return r.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:Math.min(t,12)})}function Ue(e){let r=Number(e);return Number.isFinite(r)?Math.abs(r)>=1e3?`$${r.toLocaleString("en-US",{maximumFractionDigits:0})}`:`$${r.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"—"}function dr(e){let r=Number(e);return Number.isFinite(r)?r>=1e3?r.toLocaleString("en-US",{maximumFractionDigits:0}):r.toLocaleString("en-US",{maximumFractionDigits:2}):"—"}var or=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];function dt(e,r){let t=new Date(e*1e3);if(Number.isNaN(t.getTime()))return"—";if(r==="1d")return`${t.getUTCDate()} ${or[t.getUTCMonth()]}`;let n=String(t.getUTCHours()).padStart(2,"0"),i=String(t.getUTCMinutes()).padStart(2,"0");return`${t.getUTCDate()} ${or[t.getUTCMonth()]} ${n}:${i}`}function mr(e,r){let t=Math.max(0,Math.round((r-e)/1e3));if(t<60)return`${t}s ago`;let n=Math.floor(t/60);if(n<60)return`${n}m ago`;let i=Math.floor(n/60);return i<24?`${i}h ago`:`${Math.floor(i/24)}d ago`}var pr=74,fr=22,hn=.16;var Pe="#8E96AB",bn="rgba(198,204,218,0.10)",gn="rgba(198,204,218,0.22)",_n="11px 'JetBrains Mono', ui-monospace, monospace";function hr({canvas:e,readout:r}){let t=e.getContext("2d"),n=[],i="1h",a=Pe,c=null;function d(){let m=e.getBoundingClientRect();return{width:m.width,height:m.height}}function p(){let{width:m,height:h}=d();if(m<=0||h<=0)return;let y=window.devicePixelRatio||1;if((e.width!==Math.round(m*y)||e.height!==Math.round(h*y))&&(e.width=Math.round(m*y),e.height=Math.round(h*y)),t.setTransform(y,0,0,y,0,0),t.clearRect(0,0,m,h),!n.length)return;let T=m-pr,R=h-fr,U=Math.round(R*hn),$=R-U-6,P=ir(n);if(!P)return;let{bodyWidth:q,centers:j}=lr(n.length,T),E=ar(n);t.font=_n,t.textBaseline="middle";for(let k of sr(P.min,P.max)){let S=de(k,P,$);t.strokeStyle=bn,t.beginPath(),t.moveTo(0,S+.5),t.lineTo(T,S+.5),t.stroke(),t.fillStyle=Pe,t.textAlign="left",t.fillText(O(k),T+8,S)}if(E>0)for(let k=0;k<n.length;k+=1){let S=n[k],N=Math.max(1,S.v/E*U);t.fillStyle=S.c>=S.o?`${a}55`:"rgba(142,150,171,0.30)",t.fillRect(j[k]-q/2,R-N,q,N)}for(let k=0;k<n.length;k+=1){let S=n[k],N=j[k],F=S.c>=S.o,X=F?a:Pe,Se=de(S.h,P,$),Ce=de(S.l,P,$),ee=de(S.o,P,$),Te=de(S.c,P,$);t.strokeStyle=X,t.lineWidth=1,t.beginPath(),t.moveTo(N+.5,Se),t.lineTo(N+.5,Ce),t.stroke();let oe=Math.min(ee,Te),fe=Math.max(1,Math.abs(Te-ee));F?(t.fillStyle=X,t.fillRect(N-q/2,oe,q,fe)):t.strokeRect(N-q/2+.5,oe+.5,q-1,Math.max(1,fe-1))}t.fillStyle=Pe,t.textAlign="center";let me=window.matchMedia("(max-width: 800px)").matches,pe=me?m<=340?2:3:6;for(let k of ur(n,i,pe)){let S=dt(n[k].ts,i),N=S.split(" "),F=me&&i!=="1d"?N[N.length-1]:S,X=Math.min(Math.max(j[k],24),T-24);t.fillText(F,X,h-fr/2)}if(c!==null&&n[c]){let k=j[c];t.strokeStyle=gn,t.setLineDash([3,3]),t.beginPath(),t.moveTo(k+.5,0),t.lineTo(k+.5,R),t.stroke(),t.setLineDash([])}}function u(){if(!r)return;let m=c!==null?n[c]:n[n.length-1];if(!m){r.textContent="";return}r.textContent=[dt(m.ts,i),`O ${O(m.o)}`,`H ${O(m.h)}`,`L ${O(m.l)}`,`C ${O(m.c)}`,`Vol $${O(m.v)}`].join("  ")}function _(m){let h=e.getBoundingClientRect(),y=cr(m.clientX-h.left,n.length,h.width-pr);y!==c&&(c=y,p(),u())}function b(){c=null,p(),u()}e.addEventListener("pointermove",_),e.addEventListener("pointerleave",b);let x=typeof ResizeObserver=="function"?new ResizeObserver(()=>p()):null;return x?.observe(e),{set({candles:m,timeframe:h,hue:y}){n=Array.isArray(m)?m:[],h&&(i=h),y&&(a=y),c=null,p(),u()},clear(){n=[],c=null,p(),u()},destroy(){x?.disconnect(),e.removeEventListener("pointermove",_),e.removeEventListener("pointerleave",b)}}}var xn=40;function V(e,r,t){let n=document.createElement(e);return r&&(n.className=r),t!=null&&(n.textContent=t),n}function br({host:e,now:r=()=>Date.now()}){let t=V("table","zme-tape__table"),n=V("thead"),i=V("tr");for(let d of["Age","Side","Amount","Price","Value"])i.append(V("th",null,d));n.append(i);let a=V("tbody");t.append(n,a),e.append(t);let c=null;return{set(d,{symbol:p}={}){let u=d.slice(0,xn),_=r(),b=c;a.replaceChildren(...u.map(x=>{let m=V("tr",x.side==="buy"?"zme-tape__row--buy":"zme-tape__row--sell");return b&&!b.has(x.id)&&m.classList.add("is-fresh"),m.append(V("td",null,mr(x.ts,_)),V("td","zme-tape__side",x.side==="buy"?"Buy":"Sell"),V("td",null,`${dr(x.tokenAmount)}${p?` ${p}`:""}`),V("td",null,O(x.priceUsd)),V("td",null,x.volumeUsd===null?"—":Ue(x.volumeUsd))),m})),c=new Set(u.map(x=>x.id))},clear(){a.replaceChildren(),c=null},destroy(){t.remove()}}}var yn=Object.freeze({exchange_room_mount:Object.freeze({}),exchange_market_state:Object.freeze({surface:Object.freeze(["chart","tape","ladder","panel"]),outcome:Object.freeze(["ready","empty","partial","not_indexed","rate_limited","unavailable"])})});function vn(e,r={}){let t=yn[e];if(!t)return null;let n={};for(let[i,a]of Object.entries(t)){let c=r[i];if(typeof c!="string"||!a.includes(c))return null;n[i]=c}return n}function Fe(e,r={},t=globalThis.window?.plausible){let n=vn(e,r);if(!n||typeof t!="function")return!1;try{return t(e,{props:n}),!0}catch{return!1}}var zn="/registry/zodiacs.registry.json",wn=12e3,En=1e4,kn=6e4,An=6e4,Sn=2e4,mt=3e4,gr=8e3,_r=.12;function xr(e,r=Math.random){let t=Math.min(1,Math.max(0,Number(r())||0)),n=1-_r+t*_r*2;return Math.round(e*n)}function Cn(e,r){return e!==r}function yr(e,r,t){if(!e?.controller.signal.aborted&&!Cn(e?.key??null,r))return null;e?.controller.abort();let n=new AbortController,i=()=>n.abort();return t.aborted?n.abort():t.addEventListener("abort",i,{once:!0}),{key:r,controller:n,detach(){t.removeEventListener("abort",i)}}}function vr(e,r){return e===r&&!r.controller.signal.aborted}function Tn(e){return e?.controller?.state?.state==="signing"}var Nn="These pools have no order book. Each rung is an indicative Jupiter quote at the time requested; price comes from the returned atomic amounts and “vs best” compares the smallest rung. Sell sizes are estimates from the indexed mid. Quotes with unreadable fee or impact fields, or a fee above 0.10%, are refused. Zodiacs.org does not connect wallets, request signatures, or submit transactions.",Mn="Reference market — the sign’s canonical pool. Public address lookups use an address you paste.",Dn="Indicative aggregate quote — Jupiter may route across several pools; Zodiacs.org does not connect wallets, request signatures, or submit transactions.";function l(e,r,t){let n=document.createElement(e);return r&&(n.className=r),t!=null&&(n.textContent=t),n}function Ae(e){return l("p","zme__state",e)}function Rn(e,r){let t=new AbortController,n=setTimeout(()=>t.abort(),r);return fetch(e,{cache:"no-store",signal:t.signal}).finally(()=>clearTimeout(n))}async function Ln(){let e=await Rn(zn,wn);if(!e.ok)throw new Error(`registry ${e.status}`);let r=await e.json(),t=new Map;for(let n of r?.assets??[]){let i=n?.native;i?.chain!=="solana"||!i?.address||t.set(n.sign,{mint:i.address,symbol:i.symbol??""})}if(t.size!==ue.length)throw new Error("registry: incomplete");return t}var In=new Set(ue.map(e=>e.slug));function Un(){let e=(window.location.hash||"").replace(/^#/,"");return In.has(e)?e:"aries"}function zr({host:e}){let r=null;try{r=window.localStorage}catch{}let t=Gt({storage:r}),n=Vt({storage:r}),i=new Map;function a(o,s){i.get(o)!==s&&(i.set(o,s),Fe("exchange_market_state",{surface:o,outcome:s}))}let c=l("div","zme-mobile-market"),d=l("button","zme-mobile-market__button");d.type="button",d.setAttribute("aria-haspopup","dialog"),d.setAttribute("aria-expanded","false"),d.setAttribute("aria-controls","zme-market-sheet");let p=document.createElement("picture"),u=document.createElement("source");u.type="image/avif";let _=document.createElement("img");_.className="zme-mobile-market__disc",_.width=38,_.height=38,_.alt="",p.append(u,_);let b=l("span","zme-mobile-market__identity"),x=l("span","zme-mobile-market__name","—"),m=l("span","zme-mobile-market__pair","— / USDC");b.append(x,m);let h=l("span","zme-mobile-market__chevron","⌄");h.setAttribute("aria-hidden","true"),d.append(p,b,h);let y=l("div","zme-mobile-summary"),T=l("span","zme-mobile-summary__price","—"),R=l("span","zme-mobile-summary__change","—"),U=l("span","zme-mobile-summary__liquidity","Liquidity —");y.append(T,R,U),c.append(d,y);let $=l("div","zme-mobile-tabs");$.setAttribute("role","tablist"),$.setAttribute("aria-label","Market view");let P=l("button","zme-mobile-tabs__tab","Chart"),q=l("button","zme-mobile-tabs__tab","Registry");for(let[o,s,f]of[[P,"zme-chart-tab","zme-chart-panel"],[q,"zme-trade-tab","zme-trade-panel"]])o.type="button",o.id=s,o.setAttribute("role","tab"),o.setAttribute("aria-controls",f);$.append(P,q);let j=l("div","zme__grid");j.dataset.mobileTab="chart";let E=l("section","zme__card zme__rail");E.id="zme-market-sheet",E.setAttribute("aria-label","The twelve records");let me=l("div","zme__sheet-head"),pe=l("h2","zme__sheet-title","Choose a market");pe.id="zme-market-sheet-title";let k=l("button","zme__sheet-close","Close");k.type="button",me.append(pe,k);let S=l("ul","zme__rail-list");E.append(me,S);let N=l("button","zme__sheet-backdrop");N.type="button",N.tabIndex=-1,N.setAttribute("aria-label","Close market selector");let F=l("div","zme__center");F.id="zme-chart-panel";let X=l("section","zme__card"),Se=l("div","zme__card-head"),Ce=l("h2","zme__card-title","—"),ee=l("div","zme__frames");ee.setAttribute("role","group"),ee.setAttribute("aria-label","Chart timeframe"),Se.append(Ce,ee);let Te=l("p","zme__scope",Mn),oe=l("p","zme__readout");oe.id="zme-chart-readout";let fe=l("div","zme__canvas-box"),he=l("canvas","zme__canvas");he.setAttribute("role","img"),he.setAttribute("aria-label","Candlestick chart of recent prices in the canonical pool"),he.setAttribute("aria-describedby","zme-chart-readout"),fe.append(he);let L=Ae("");L.hidden=!0;let pt=l("div","zme__chart-foot"),Er=l("span",null,"Independent third-party data, not a valuation or recommendation."),Ne=l("a",null,"Chart data by GeckoTerminal");Ne.href=jt,Ne.target="_blank",Ne.rel="noopener noreferrer external nofollow",pt.append(Er,Ne),X.append(Se,Te,oe,fe,L,pt);let ft=l("section","zme__card"),ht=l("div","zme__card-head");ht.append(l("h2","zme__card-title","Recent trades"),l("span","zme__card-note","canonical pool · newest first"));let be=l("div","zme-tape__scroll");be.tabIndex=0,be.setAttribute("role","region"),be.setAttribute("aria-label","Recent canonical-pool trades");let G=Ae("");G.hidden=!0,ft.append(ht,be,G),F.append(X,ft);let Y=l("div","zme__desk");Y.id="zme-trade-panel";let bt=l("section","zme__card"),kr=l("p","zme__scope",Dn),ie=l("div","zme__panel-host");bt.append(kr,ie);let gt=l("section","zme__card"),_t=l("div","zme__card-head"),Ar=l("h2","zme__card-title","Depth"),J=l("button","zme__ladder-refresh","Load depth");J.type="button",_t.append(Ar,J);let Sr=l("span","zme__card-note","10 taker-less quotes · about 20 seconds"),xt=l("table","zme__ladder-table"),yt=l("thead"),vt=l("tr"),Cr=l("th","zme__ladder-side","Side");for(let o of[null,"Size","Price","vs best"])vt.append(o===null?Cr:l("th",null,o));yt.append(vt);let ge=l("tbody");xt.append(yt,ge);let W=Ae("Load depth to request ten taker-less venue quotes."),Tr=l("p","zme__ladder-caption",Nn);gt.append(_t,Sr,xt,W,Tr);let zt=l("section","zme__card"),wt=l("div","zme__card-head");wt.append(l("h2","zme__card-title","Market"),l("span","zme__card-note","Dex Screener · indexed"));let Et=l("div","zme__stats"),Oe=o=>{let s=l("div","zme__stat"),f=l("span","zme__stat-value","—");return s.append(l("span","zme__stat-label",o),f),Et.append(s),f},Nr=Oe("Price"),qe=Oe("24h"),Mr=Oe("Indexed liquidity");zt.append(wt,Et),Y.append(bt,gt,zt);let _e=l("button","zme-mobile-buy","Registry");_e.type="button",j.append(E,F,Y),e.append(c,$,N,j,_e);let xe=null,Be=!1,$e=!1,je=null,kt=[],At={},A=null,te="1h",B=null,St=null,Fn=0,Ge=null,He=null,Ve=null,ye=null,Ke=null,ve=null,ze=null,we=null,Me=null,Z=0,ae=!1,Ye="chart",se=!1,De=null,Ct="",Q=window.matchMedia("(max-width: 800px)"),Tt="IntersectionObserver"in window?new IntersectionObserver(([o])=>{e.dataset.stickyVisible=String(o.isIntersecting)},{threshold:.02}):null;e.dataset.stickyVisible="true",Tt?.observe(e);let re=hr({canvas:he,readout:oe}),ne=br({host:be}),Re=new Map;for(let o of ue){let s=l("li"),f=l("button","zme__rail-item");f.type="button",f.style.setProperty("--sign",o.hue),f.setAttribute("aria-pressed","false");let g=document.createElement("picture"),w=document.createElement("source");w.srcset=`/assets/zodiac-icons/128/${o.slug}.avif`,w.type="image/avif";let z=document.createElement("img");z.className="zme__rail-disc",z.src=`/assets/zodiac-icons/128/${o.slug}.webp`,z.width=30,z.height=30,z.alt="",z.loading="lazy",z.decoding="async",g.append(w,z);let I=l("span","zme__rail-name",o.name),M=l("span","zme__rail-quote"),D=l("span","zme__rail-price","—"),K=l("span","zme__rail-change","");M.append(D,K),f.append(g,I,M),f.addEventListener("click",()=>{let qr=et(o.slug);Q.matches&&qr!==!1&&ce()}),s.append(f),S.append(s),Re.set(o.slug,{button:f,price:D,change:K})}let Nt=new Map;for(let o of Object.keys(rt)){let s=l("button","zme__frame",o);s.type="button",s.setAttribute("aria-pressed",String(o===te)),s.addEventListener("click",()=>{if(o!==te){te=o;for(let[f,g]of Nt)g.setAttribute("aria-pressed",String(f===te));Pr()}}),ee.append(s),Nt.set(o,s)}let Mt=o=>ue.find(s=>s.slug===o)??null,le=o=>xe?.get(o)??null,Je=o=>{let s=le(o);return s?At[s.mint]??null:null};function Ee(o,{focus:s=!1}={}){if(!(o!=="chart"&&o!=="trade")){Ye=o,j.dataset.mobileTab=o;for(let[f,g]of[[P,"chart"],[q,"trade"]]){let w=g===o;f.setAttribute("aria-selected",String(w)),f.tabIndex=w?0:-1,s&&w&&f.focus()}Q.matches&&(F.setAttribute("aria-hidden",String(o!=="chart")),Y.setAttribute("aria-hidden",String(o!=="trade")))}}function Dr(){!Q.matches||Ye!=="trade"||ie.querySelector("a")?.focus({preventScroll:!0})}function ce({restoreFocus:o=!0}={}){se&&(se=!1,E.dataset.open="false",N.dataset.open="false",d.setAttribute("aria-expanded","false"),Q.matches&&(E.setAttribute("aria-hidden","true"),E.inert=!0),document.body.style.overflow=Ct,o&&De?.isConnected&&De.focus(),De=null)}function Rr(){!Q.matches||d.disabled||se||(se=!0,De=document.activeElement,Ct=document.body.style.overflow,document.body.style.overflow="hidden",E.inert=!1,E.dataset.open="true",N.dataset.open="true",E.setAttribute("aria-hidden","false"),d.setAttribute("aria-expanded","true"),requestAnimationFrame(()=>{(E.querySelector('[aria-pressed="true"]')||k).focus()}))}function We(){if(Q.matches){E.setAttribute("role","dialog"),E.setAttribute("aria-modal","true"),E.setAttribute("aria-labelledby",pe.id),F.setAttribute("role","tabpanel"),F.setAttribute("aria-labelledby",P.id),Y.setAttribute("role","tabpanel"),Y.setAttribute("aria-labelledby",q.id),se||(E.setAttribute("aria-hidden","true"),E.inert=!0),Ee(Ye);return}ce({restoreFocus:!1}),E.removeAttribute("role"),E.removeAttribute("aria-modal"),E.removeAttribute("aria-hidden"),E.removeAttribute("aria-labelledby"),E.inert=!1,F.removeAttribute("role"),F.removeAttribute("aria-labelledby"),F.removeAttribute("aria-hidden"),Y.removeAttribute("role"),Y.removeAttribute("aria-labelledby"),Y.removeAttribute("aria-hidden")}function Dt(o){if(se){if(o.key==="Escape"){o.preventDefault(),ce();return}if(o.key==="Tab"){let g=[...E.querySelectorAll("button:not(:disabled)")];if(!g.length)return;let w=g[0],z=g[g.length-1];o.shiftKey&&document.activeElement===w?(o.preventDefault(),z.focus()):!o.shiftKey&&document.activeElement===z&&(o.preventDefault(),w.focus())}return}if(!$.contains(o.target)||!["ArrowLeft","ArrowRight","Home","End"].includes(o.key))return;o.preventDefault();let f=o.key==="ArrowLeft"||o.key==="Home"?"chart":"trade";Ee(f,{focus:!0})}d.addEventListener("click",Rr),k.addEventListener("click",()=>ce()),N.addEventListener("click",()=>ce()),P.addEventListener("click",()=>Ee("chart")),q.addEventListener("click",()=>Ee("trade")),_e.addEventListener("click",()=>{Ee("trade"),Dr()}),document.addEventListener("keydown",Dt),Q.addEventListener("change",We),We();function v(o,s){o.textContent=s,o.hidden=!s}function Rt(o){let s=Mt(o);j.style.setProperty("--sign",s?.hue??"#C6CCDA");for(let[g,w]of Re)w.button.setAttribute("aria-pressed",String(g===o));let f=le(o);Ce.textContent=f?.symbol?`${f.symbol} / USD`:s?.name??"—",x.textContent=s?.name??"—",m.textContent=`${f?.symbol||s?.name||"—"} / USDC`,u.srcset=s?`/assets/zodiac-icons/128/${s.slug}.avif`:"",_.src=s?`/assets/zodiac-icons/128/${s.slug}.webp`:"",_e.textContent=`Registry · ${s?.name??""}`.trim()}function On(o){for(let{button:s}of Re.values())s.disabled=o,o?s.title="Finish or dismiss the wallet review before changing signs.":s.removeAttribute("title");d.disabled=o,_e.disabled=o}function Lr(){let o=l("div");o.append(Ae("The registry could not be read, so there is nothing to trade against."));let s=l("button","zme__ladder-refresh","Try again");return s.type="button",s.style.display="block",s.style.margin="0 auto 10px",s.addEventListener("click",()=>Ot()),o.append(s),o}function Ir(){for(let o of ue){let s=Re.get(o.slug),f=Je(o.slug);if(!f?.priceUsd){s.price.textContent="—",s.change.textContent="";continue}if(s.price.textContent=O(f.priceUsd),f.change24hPct===null)s.change.textContent="";else{let g=f.change24hPct>0;s.change.textContent=`${g?"+":""}${f.change24hPct.toFixed(2)}%`,s.change.classList.toggle("zme__rail-change--up",g),s.change.classList.toggle("zme__rail-change--down",f.change24hPct<0)}}}function Lt(){let o=A?Je(A):null,s=o?.priceUsd?O(o.priceUsd):"—",f=o?.change24hPct===null||o?.change24hPct===void 0?"—":`${o.change24hPct>0?"+":""}${o.change24hPct.toFixed(2)}%`,g=o?.liquidityUsd?Ue(o.liquidityUsd):"—";Nr.textContent=s,qe.textContent=f,qe.classList.toggle("is-positive",o?.change24hPct>0),qe.classList.toggle("is-negative",o?.change24hPct<0),Mr.textContent=g,T.textContent=s,R.textContent=f,R.classList.toggle("is-positive",o?.change24hPct>0),R.classList.toggle("is-negative",o?.change24hPct<0),U.textContent=`Liquidity ${g}`}async function Ze(){if(!xe)return;if(we)return we;let o=new AbortController,s=setTimeout(()=>o.abort(),En),f=(async()=>{try{let g=[...xe.values()].map(z=>z.mint),w=await Zt({mints:g,signal:o.signal});At=w.stats,kt=w.rows,Ir(),Lt()}catch{}finally{clearTimeout(s)}})();we=f;try{return await f}finally{we===f&&(we=null)}}function It(){let o=le(A);return o?Bt({slug:A,mint:o.mint,rows:kt}):null}function Qe(o,s){clearTimeout(ye),ye=setTimeout(()=>{!o.aborted&&document.visibilityState==="visible"&&ke(o)},s)}function Xe(o,s){clearTimeout(Ke),Ke=setTimeout(()=>{!o.aborted&&document.visibilityState==="visible"&&Le(o)},s)}async function ke(o){let s=`${A}:${te}`,f=yr(ve,s,o);if(f){ve=f;try{let g=Mt(A),w=te,z=A,I=()=>vr(ve,f)&&w===te&&z===A,M=It();if(!M){re.clear(),v(L,"No indexed pool to chart. Public market data is unavailable."),a("chart","not_indexed");return}if(n.active()){v(L,"The chart service asked for a pause. Retrying shortly."),Qe(o,n.remainingMs()+250);return}if(!t.take()){v(L,"Waiting for the chart service — retrying shortly."),Qe(o,gr);return}try{let D=n.token(),K=await Kt({pool:M,timeframe:w,signal:f.controller.signal});if(!I())return;if(n.ok(D),!K.length){re.clear(),v(L,"No trades in this window yet."),a("chart","empty");return}v(L,""),re.set({candles:K,timeframe:w,hue:g?.hue}),a("chart","ready")}catch(D){if(D?.name==="AbortError")return;if(D?.code==="rate_limited"){if(n.fail(D.retryAfterMs),!I())return;re.clear(),v(L,"The chart service asked for a pause. Retrying shortly."),a("chart","rate_limited"),Qe(o,n.remainingMs()+250);return}if(!I())return;re.clear(),v(L,"Chart unavailable. Public market data is unavailable."),a("chart",D?.code==="not_indexed"?"not_indexed":"unavailable")}}finally{f.detach(),ve===f&&(ve=null)}}}async function Le(o){let f=yr(ze,A,o);if(f){ze=f;try{let g=le(A),w=A,z=()=>vr(ze,f)&&w===A,I=It();if(!g||!I){ne.clear(),v(G,"No indexed pool to read trades from."),a("tape","not_indexed");return}if(n.active()){v(G,"The trade feed asked for a pause. Retrying shortly."),Xe(o,n.remainingMs()+250);return}if(!t.take()){v(G,"Waiting for the trade feed — retrying shortly."),Xe(o,gr);return}try{let M=n.token(),D=await Yt({pool:I,mint:g.mint,signal:f.controller.signal});if(!z())return;if(n.ok(M),!D.length){ne.clear(),v(G,"No recent trades in this pool."),a("tape","empty");return}v(G,""),ne.set(D,{symbol:g.symbol}),a("tape","ready")}catch(M){if(M?.name==="AbortError")return;if(M?.code==="rate_limited"){if(n.fail(M.retryAfterMs),!z())return;ne.clear(),v(G,"The trade feed asked for a pause. Retrying shortly."),a("tape","rate_limited"),Xe(o,n.remainingMs()+250);return}if(!z())return;ne.clear(),v(G,"Trade feed unavailable."),a("tape",M?.code==="not_indexed"?"not_indexed":"unavailable")}}finally{f.detach(),ze===f&&(ze=null)}}}function Ut(){clearTimeout(Ge),clearTimeout(He),clearTimeout(ye),clearTimeout(Ke),Ge=null,He=null}function Ur(){if(Ut(),!B)return;let{signal:o}=B,s=()=>{Ge=setTimeout(async()=>{!o.aborted&&document.visibilityState!=="hidden"&&await ke(o),o.aborted||s()},xr(An))},f=()=>{He=setTimeout(async()=>{!o.aborted&&document.visibilityState!=="hidden"&&await Le(o),o.aborted||f()},xr(Sn))};s(),f()}function Pr(){B&&(clearTimeout(ye),ye=null,v(L,""),ke(B.signal))}function Pt(o){ge.replaceChildren();for(let{side:s,rungs:f}of o)for(let g of f){let w=l("tr",s==="buy"?"zme__ladder-row--buy":"zme__ladder-row--sell"),z=[l("td","zme__ladder-side",s==="buy"?"Buy":"Sell"),l("td",null,`${s==="sell"?"≈":""}$${g.notional}`)];if(g.error||!g.priceScaled){let I=g.error==="no_route"?"no route":"unavailable",M=l("td",null,I);M.colSpan=2,z.push(M)}else z.push(l("td",null,O(g.price)),l("td",null,g.impactBps===null?"—":`${(g.impactBps/100).toFixed(2)}%`));w.append(...z),ge.append(w)}}async function Fr(){let o=le(A);if(!o||!B)return;let s=A,f=Date.now();if(f<Z)return;Z=f+mt,J.disabled=!0,J.textContent="Reading…";let{signal:g}=B;v(W,"Reading buy quotes from the venue…");try{let w=Je(A),z=await ut({mint:o.mint,side:"buy",signal:g});if(g.aborted)return;if(Pt([z]),z.halted==="rate_limited"){Z=Math.max(Z,Date.now()+Math.max(mt,Number(z.retryAfterMs)||0)),v(W,"The venue asked for a pause. Try depth again later."),a("ladder","rate_limited");return}if(v(W,"Reading sell quotes from the venue…"),await new Promise(K=>{setTimeout(K,ct)}),g.aborted)return;let I=await ut({mint:o.mint,side:"sell",midPriceUsd:w?.priceUsd??null,signal:g});if(g.aborted)return;if(Pt([z,I]),I.halted==="rate_limited"){Z=Math.max(Z,Date.now()+Math.max(mt,Number(I.retryAfterMs)||0)),v(W,"The venue asked for a pause. Partial depth is shown."),a("ladder","rate_limited");return}let M=[...z.rungs,...I.rungs],D=M.filter(K=>K.error||!K.priceScaled).length;a("ladder",D===0?"ready":D===M.length?"unavailable":"partial"),v(W,D===0?"":"Some venue quotes were unavailable.")}catch(w){w?.name!=="AbortError"&&!g.aborted&&(ge.replaceChildren(),v(W,"Venue quotes unavailable just now."),a("ladder","unavailable"))}finally{clearTimeout(Me),Me=setTimeout(()=>{!ae&&s===A&&(J.disabled=!1,J.textContent="Refresh")},Math.max(0,Z-Date.now()))}}J.addEventListener("click",()=>Fr());function Or(){if(ie.replaceChildren(),!le(A))return;let s=l("a","","Registry");s.href=`/registry/${A}/`,ie.append(s)}function et(o){if(o!==A&&Tn(St))return!1;if(!xe){je=o,Rt(o),Be?v(L,"The registry could not be read. Nothing verified, nothing shown."):v(L,"Reading the registry…");return}if(o===A)return;A=o,B?.abort(),B=new AbortController,clearTimeout(Me),Z=0,J.disabled=!1,J.textContent="Load depth",ge.replaceChildren(),v(W,"Load depth to request ten taker-less venue quotes."),Rt(o);try{window.history.replaceState(null,"",`#${o}`)}catch{}re.clear(),ne.clear(),v(L,"Reading the chart…"),v(G,"Reading recent trades…"),Lt(),Or();let{signal:s}=B;Ur(),ke(s),Le(s)}function Ft(){if(document.visibilityState!=="visible"||!B)return;let{signal:o}=B;ke(o),Le(o),Ze()}document.addEventListener("visibilitychange",Ft);function Ot(){$e||ae||($e=!0,Be=!1,v(L,"Reading the registry…"),v(G,""),ie.replaceChildren(Ae("Reading the registry…")),Ln().then(async o=>{if(ae||(xe=o,await Ze(),ae))return;clearInterval(Ve),Ve=setInterval(()=>{document.visibilityState!=="hidden"&&Ze()},kn);let s=je??Un();je=null,et(s)}).catch(()=>{ae||(Be=!0,v(L,"The registry could not be read. Nothing verified, nothing shown."),ie.replaceChildren(Lr()))}).finally(()=>{$e=!1}))}return Ot(),{select:et,destroy(){ae=!0,ce({restoreFocus:!1}),B?.abort(),Ut(),clearInterval(Ve),clearTimeout(Me),document.removeEventListener("visibilitychange",Ft),document.removeEventListener("keydown",Dt),Q.removeEventListener("change",We),Tt?.disconnect(),St?.destroy?.(),re.destroy(),ne.destroy(),j.remove()}}}function Pn(){if(document.querySelector("style[data-zme-styles]"))return;let e=document.createElement("style");e.setAttribute("data-zme-styles",""),e.textContent=qt,document.head.appendChild(e)}function wr(){let e=document.querySelector("[data-zme-terminal]");!e||e.dataset.zmeMounted||(e.dataset.zmeMounted="1",Pn(),zr({host:e}),Fe("exchange_room_mount"))}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",wr,{once:!0}):wr();})();
