/**
 * The Exchange terminal: one selected sign at a time, its chart, its tape,
 * its depth ladder, and the same trade panel the catalogue pages carry.
 *
 * The division of labour is the ratified one. Identity comes from the live
 * registry answer — no mint is baked into this bundle or the page. Prices
 * and history come from indexes (Dex Screener, GeckoTerminal), read-only and
 * keyless. Executable quotes and the trade itself belong to Jupiter, the
 * independent venue, through the existing trade bundle; the ladder's quotes
 * are taker-less, because an address leaves the browser only on an explicit
 * trade action, never to show a price.
 *
 * Two markets are deliberately kept apart on this page and labelled so: the
 * chart and tape describe the sign's canonical pool (the reference market),
 * while the panel's indicative quote is Jupiter's aggregate and may route
 * beyond that pool. A trade is quoted again before wallet review.
 */

import { EXCHANGE_SIGNS } from './signs.mjs';
import { resolvePool } from './pools.mjs';
import {
  GECKO_SITE_URL,
  TIMEFRAMES,
  createCoolOff,
  createRateBudget,
  fetchOhlcv,
  fetchTrades,
} from './gecko.mjs';
import { fetchBatchStats } from './stats.mjs';
import { LADDER_QUOTE_SPACING_MS, fetchLadder } from './depth.mjs';
import { createChart } from './chart.mjs';
import { createTape } from './tape.mjs';
import { formatPrice, formatUsd } from './chart-model.mjs';
import { trackExchangeEvent } from './analytics.mjs';

const REGISTRY_URL = '/registry/zodiacs.registry.json';
const REGISTRY_DEADLINE = 12_000;
const STATS_DEADLINE_MS = 10_000;
const STATS_EVERY_MS = 60_000;
const CHART_EVERY_MS = 60_000;
const TAPE_EVERY_MS = 20_000;
const LADDER_COOLDOWN_MS = 30_000;
const BUDGET_RETRY_MS = 8_000;
export const POLL_JITTER_RATIO = 0.12;

export function jitteredPollDelay(baseMs, random = Math.random) {
  const unit = Math.min(1, Math.max(0, Number(random()) || 0));
  const factor = 1 - POLL_JITTER_RATIO + unit * POLL_JITTER_RATIO * 2;
  return Math.round(baseMs * factor);
}

export function requestMayStart(activeKey, nextKey) {
  return activeKey !== nextKey;
}

export function beginLatestRequest(current, key, parentSignal) {
  if (!current?.controller.signal.aborted
    && !requestMayStart(current?.key ?? null, key)) return null;
  current?.controller.abort();
  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  if (parentSignal.aborted) controller.abort();
  else parentSignal.addEventListener('abort', relayAbort, { once: true });
  return {
    key,
    controller,
    detach() { parentSignal.removeEventListener('abort', relayAbort); },
  };
}

export function latestRequestIsCurrent(active, candidate) {
  return active === candidate && !candidate.controller.signal.aborted;
}

export function panelLocksSelection(candidate) {
  return candidate?.controller?.state?.state === 'signing';
}

/**
 * The one sentence the ladder is not allowed to lose. Pinned by test in this
 * source and in the built bundle.
 */
export const LADDER_CAPTION = 'These pools have no order book. Each rung is an indicative Jupiter quote '
  + 'at the time requested; price comes from the returned atomic amounts and “vs best” compares '
  + 'the smallest rung. Sell sizes are estimates from the indexed mid. Quotes with unreadable '
  + 'fee or impact fields, or a fee above 0.10%, are refused. A trade is quoted again before wallet review.';

/** The reference-vs-execution boundary, also pinned by test. */
export const CHART_SCOPE = 'Reference market — the sign’s canonical pool. '
  + 'Orders execute through Jupiter and may route beyond it.';
export const PANEL_SCOPE = 'Indicative aggregate quote — Jupiter may route across several pools; '
  + 'a trade is quoted again before wallet review.';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function stateNode(message) {
  return el('p', 'zme__state', message);
}

function fetchWithin(url, deadline) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadline);
  return fetch(url, { cache: 'no-store', signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

/**
 * The registry is the one answer to what a sign's mint is. No verified
 * record, no panel and no ladder — the chart and tape stay index-only.
 */
async function readRegistry() {
  const response = await fetchWithin(REGISTRY_URL, REGISTRY_DEADLINE);
  if (!response.ok) throw new Error(`registry ${response.status}`);
  const payload = await response.json();
  const records = new Map();
  for (const asset of payload?.assets ?? []) {
    const native = asset?.native;
    if (native?.chain !== 'solana' || !native?.address) continue;
    records.set(asset.sign, { mint: native.address, symbol: native.symbol ?? '' });
  }
  if (records.size !== EXCHANGE_SIGNS.length) throw new Error('registry: incomplete');
  return records;
}

/** The trade panel's runtime, fetched at most once and only when wanted. */
let tradeBundleReady = null;
function loadTradeBundle() {
  if (tradeBundleReady) return tradeBundleReady;
  tradeBundleReady = new Promise((resolve) => {
    if (window.zodiacsTrade) { resolve(window.zodiacsTrade); return; }
    const script = document.createElement('script');
    script.src = '/assets/trade.js';
    script.defer = true;
    script.addEventListener('load', () => resolve(window.zodiacsTrade ?? null), { once: true });
    script.addEventListener('error', () => resolve(null), { once: true });
    document.body.appendChild(script);
  });
  return tradeBundleReady;
}

const HASH_SLUGS = new Set(EXCHANGE_SIGNS.map((sign) => sign.slug));

/** #taurus opens the room on Taurus; anything else opens on the first lot. */
function initialSlug() {
  const hash = (window.location.hash || '').replace(/^#/, '');
  return HASH_SLUGS.has(hash) ? hash : 'aries';
}

export function createTerminal({ host }) {
  let sharedBudgetStorage = null;
  try {
    sharedBudgetStorage = window.localStorage;
  } catch {
    // Storage can be disabled. The in-memory budget remains conservative.
  }
  const budget = createRateBudget({ storage: sharedBudgetStorage });
  const coolOff = createCoolOff({ storage: sharedBudgetStorage });
  const reportedStates = new Map();

  function reportState(surface, outcome) {
    if (reportedStates.get(surface) === outcome) return;
    reportedStates.set(surface, outcome);
    trackExchangeEvent('exchange_market_state', { surface, outcome });
  }

  // ── skeleton ────────────────────────────────────────────────────────────
  const mobileHeader = el('div', 'zme-mobile-market');
  const marketButton = el('button', 'zme-mobile-market__button');
  marketButton.type = 'button';
  marketButton.setAttribute('aria-haspopup', 'dialog');
  marketButton.setAttribute('aria-expanded', 'false');
  marketButton.setAttribute('aria-controls', 'zme-market-sheet');
  const marketPicture = document.createElement('picture');
  const marketSource = document.createElement('source');
  marketSource.type = 'image/avif';
  const marketIcon = document.createElement('img');
  marketIcon.className = 'zme-mobile-market__disc';
  marketIcon.width = 38;
  marketIcon.height = 38;
  marketIcon.alt = '';
  marketPicture.append(marketSource, marketIcon);
  const marketIdentity = el('span', 'zme-mobile-market__identity');
  const marketName = el('span', 'zme-mobile-market__name', '—');
  const marketPair = el('span', 'zme-mobile-market__pair', '— / USDC');
  marketIdentity.append(marketName, marketPair);
  const marketChevron = el('span', 'zme-mobile-market__chevron', '⌄');
  marketChevron.setAttribute('aria-hidden', 'true');
  marketButton.append(marketPicture, marketIdentity, marketChevron);

  const mobileSummary = el('div', 'zme-mobile-summary');
  const mobilePrice = el('span', 'zme-mobile-summary__price', '—');
  const mobileChange = el('span', 'zme-mobile-summary__change', '—');
  const mobileLiquidity = el('span', 'zme-mobile-summary__liquidity', 'Liquidity —');
  mobileSummary.append(mobilePrice, mobileChange, mobileLiquidity);
  mobileHeader.append(marketButton, mobileSummary);

  const mobileTabs = el('div', 'zme-mobile-tabs');
  mobileTabs.setAttribute('role', 'tablist');
  mobileTabs.setAttribute('aria-label', 'Market view');
  const chartTab = el('button', 'zme-mobile-tabs__tab', 'Chart');
  const tradeTab = el('button', 'zme-mobile-tabs__tab', 'Trade');
  for (const [button, id, panelId] of [
    [chartTab, 'zme-chart-tab', 'zme-chart-panel'],
    [tradeTab, 'zme-trade-tab', 'zme-trade-panel'],
  ]) {
    button.type = 'button';
    button.id = id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panelId);
  }
  mobileTabs.append(chartTab, tradeTab);

  const grid = el('div', 'zme__grid');
  grid.dataset.mobileTab = 'chart';

  const rail = el('section', 'zme__card zme__rail');
  rail.id = 'zme-market-sheet';
  rail.setAttribute('aria-label', 'The twelve records');
  const railHead = el('div', 'zme__sheet-head');
  const railTitle = el('h2', 'zme__sheet-title', 'Choose a market');
  railTitle.id = 'zme-market-sheet-title';
  const railClose = el('button', 'zme__sheet-close', 'Close');
  railClose.type = 'button';
  railHead.append(railTitle, railClose);
  const railList = el('ul', 'zme__rail-list');
  rail.append(railHead, railList);

  const sheetBackdrop = el('button', 'zme__sheet-backdrop');
  sheetBackdrop.type = 'button';
  sheetBackdrop.tabIndex = -1;
  sheetBackdrop.setAttribute('aria-label', 'Close market selector');

  const center = el('div', 'zme__center');
  center.id = 'zme-chart-panel';

  const chartCard = el('section', 'zme__card');
  const chartHead = el('div', 'zme__card-head');
  const chartTitle = el('h2', 'zme__card-title', '—');
  const frames = el('div', 'zme__frames');
  frames.setAttribute('role', 'group');
  frames.setAttribute('aria-label', 'Chart timeframe');
  chartHead.append(chartTitle, frames);
  const chartScope = el('p', 'zme__scope', CHART_SCOPE);
  const readout = el('p', 'zme__readout');
  readout.id = 'zme-chart-readout';
  const canvasBox = el('div', 'zme__canvas-box');
  const canvas = el('canvas', 'zme__canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Candlestick chart of recent prices in the canonical pool');
  canvas.setAttribute('aria-describedby', 'zme-chart-readout');
  canvasBox.append(canvas);
  const chartState = stateNode('');
  chartState.hidden = true;
  const chartFoot = el('div', 'zme__chart-foot');
  const chartNote = el('span', null, 'Independent third-party data, not a valuation or recommendation.');
  const attribution = el('a', null, 'Chart data by GeckoTerminal');
  attribution.href = GECKO_SITE_URL;
  attribution.target = '_blank';
  attribution.rel = 'noopener noreferrer external nofollow';
  chartFoot.append(chartNote, attribution);
  chartCard.append(chartHead, chartScope, readout, canvasBox, chartState, chartFoot);

  const tapeCard = el('section', 'zme__card');
  const tapeHead = el('div', 'zme__card-head');
  tapeHead.append(
    el('h2', 'zme__card-title', 'Recent trades'),
    el('span', 'zme__card-note', 'canonical pool · newest first'),
  );
  const tapeScroll = el('div', 'zme-tape__scroll');
  tapeScroll.tabIndex = 0;
  tapeScroll.setAttribute('role', 'region');
  tapeScroll.setAttribute('aria-label', 'Recent canonical-pool trades');
  const tapeState = stateNode('');
  tapeState.hidden = true;
  tapeCard.append(tapeHead, tapeScroll, tapeState);

  center.append(chartCard, tapeCard);

  const desk = el('div', 'zme__desk');
  desk.id = 'zme-trade-panel';
  const panelCard = el('section', 'zme__card');
  const panelScope = el('p', 'zme__scope', PANEL_SCOPE);
  const panelHost = el('div', 'zme__panel-host');
  panelCard.append(panelScope, panelHost);

  const ladderCard = el('section', 'zme__card');
  const ladderHead = el('div', 'zme__card-head');
  const ladderTitle = el('h2', 'zme__card-title', 'Depth');
  const ladderRefresh = el('button', 'zme__ladder-refresh', 'Load depth');
  ladderRefresh.type = 'button';
  ladderHead.append(ladderTitle, ladderRefresh);
  const ladderNote = el('span', 'zme__card-note', '10 taker-less quotes · about 20 seconds');
  const ladderTable = el('table', 'zme__ladder-table');
  const ladderTableHead = el('thead');
  const ladderHeadRow = el('tr');
  const sideTh = el('th', 'zme__ladder-side', 'Side');
  for (const label of [null, 'Size', 'Price', 'vs best']) {
    ladderHeadRow.append(label === null ? sideTh : el('th', null, label));
  }
  ladderTableHead.append(ladderHeadRow);
  const ladderBody = el('tbody');
  ladderTable.append(ladderTableHead, ladderBody);
  const ladderState = stateNode('Load depth to request ten taker-less venue quotes.');
  const ladderCaption = el('p', 'zme__ladder-caption', LADDER_CAPTION);
  ladderCard.append(ladderHead, ladderNote, ladderTable, ladderState, ladderCaption);

  const statsCard = el('section', 'zme__card');
  const statsHead = el('div', 'zme__card-head');
  statsHead.append(
    el('h2', 'zme__card-title', 'Market'),
    el('span', 'zme__card-note', 'Dex Screener · indexed'),
  );
  const statsGrid = el('div', 'zme__stats');
  const stat = (label) => {
    const box = el('div', 'zme__stat');
    const value = el('span', 'zme__stat-value', '—');
    box.append(el('span', 'zme__stat-label', label), value);
    statsGrid.append(box);
    return value;
  };
  const statPrice = stat('Price');
  const statChange = stat('24h');
  const statLiquidity = stat('Indexed liquidity');
  statsCard.append(statsHead, statsGrid);

  desk.append(panelCard, ladderCard, statsCard);
  const stickyBuy = el('button', 'zme-mobile-buy', 'Buy');
  stickyBuy.type = 'button';

  grid.append(rail, center, desk);
  host.append(mobileHeader, mobileTabs, sheetBackdrop, grid, stickyBuy);

  // ── state ───────────────────────────────────────────────────────────────
  let records = null;           // Map slug → { mint, symbol }
  let registryFailed = false;
  let booting = false;
  let pendingSlug = null;       // a rail click made before the registry answered
  let batchRows = [];
  let stats = {};
  let selected = null;
  let timeframe = '1h';
  let selectionAbort = null;
  let panel = null;
  let panelAttempt = 0;
  let chartTimer = null;
  let tapeTimer = null;
  let statsTimer = null;
  let chartRetryTimer = null;
  let tapeRetryTimer = null;
  let chartRequest = null;
  let tapeRequest = null;
  let statsRequest = null;
  let ladderEnableTimer = null;
  let ladderBusyUntil = 0;
  let destroyed = false;
  let mobileTab = 'chart';
  let sheetOpen = false;
  let focusBeforeSheet = null;
  let bodyOverflowBeforeSheet = '';

  const mobileMedia = window.matchMedia('(max-width: 800px)');
  const terminalObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(([entry]) => {
      host.dataset.stickyVisible = String(entry.isIntersecting);
    }, { threshold: 0.02 })
    : null;
  host.dataset.stickyVisible = 'true';
  terminalObserver?.observe(host);

  const chart = createChart({ canvas, readout });
  const tape = createTape({ host: tapeScroll });

  const railRows = new Map();
  for (const sign of EXCHANGE_SIGNS) {
    const item = el('li');
    const button = el('button', 'zme__rail-item');
    button.type = 'button';
    button.style.setProperty('--sign', sign.hue);
    button.setAttribute('aria-pressed', 'false');
    const picture = document.createElement('picture');
    const source = document.createElement('source');
    source.srcset = `/assets/zodiac-icons/128/${sign.slug}.avif`;
    source.type = 'image/avif';
    const img = document.createElement('img');
    img.className = 'zme__rail-disc';
    img.src = `/assets/zodiac-icons/128/${sign.slug}.webp`;
    img.width = 30;
    img.height = 30;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    picture.append(source, img);
    const name = el('span', 'zme__rail-name', sign.name);
    const quote = el('span', 'zme__rail-quote');
    const price = el('span', 'zme__rail-price', '—');
    const change = el('span', 'zme__rail-change', '');
    quote.append(price, change);
    button.append(picture, name, quote);
    button.addEventListener('click', () => {
      const changed = select(sign.slug);
      if (mobileMedia.matches && changed !== false) closeMarketSheet();
    });
    item.append(button);
    railList.append(item);
    railRows.set(sign.slug, { button, price, change });
  }

  const frameButtons = new Map();
  for (const key of Object.keys(TIMEFRAMES)) {
    const button = el('button', 'zme__frame', key);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(key === timeframe));
    button.addEventListener('click', () => {
      if (key === timeframe) return;
      timeframe = key;
      for (const [frameKey, frameButton] of frameButtons) {
        frameButton.setAttribute('aria-pressed', String(frameKey === timeframe));
      }
      restartChart();
    });
    frames.append(button);
    frameButtons.set(key, button);
  }

  // ── helpers ─────────────────────────────────────────────────────────────
  const signFor = (slug) => EXCHANGE_SIGNS.find((sign) => sign.slug === slug) ?? null;
  const recordFor = (slug) => records?.get(slug) ?? null;
  const statsFor = (slug) => {
    const record = recordFor(slug);
    return record ? stats[record.mint] ?? null : null;
  };

  function setMobileTab(next, { focus = false } = {}) {
    if (next !== 'chart' && next !== 'trade') return;
    mobileTab = next;
    grid.dataset.mobileTab = next;
    for (const [button, key] of [[chartTab, 'chart'], [tradeTab, 'trade']]) {
      const active = key === next;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (focus && active) button.focus();
    }
    if (mobileMedia.matches) {
      center.setAttribute('aria-hidden', String(next !== 'chart'));
      desk.setAttribute('aria-hidden', String(next !== 'trade'));
    }
  }

  function focusTradeAmount(attempt = 0) {
    if (!mobileMedia.matches || mobileTab !== 'trade') return;
    const input = panelHost.querySelector('.tp .pay__input');
    if (input) {
      input.focus({ preventScroll: true });
      input.scrollIntoView({ block: 'center', behavior: 'auto' });
      return;
    }
    if (attempt < 20) setTimeout(() => focusTradeAmount(attempt + 1), 50);
  }

  function closeMarketSheet({ restoreFocus = true } = {}) {
    if (!sheetOpen) return;
    sheetOpen = false;
    rail.dataset.open = 'false';
    sheetBackdrop.dataset.open = 'false';
    marketButton.setAttribute('aria-expanded', 'false');
    if (mobileMedia.matches) {
      rail.setAttribute('aria-hidden', 'true');
      rail.inert = true;
    }
    document.body.style.overflow = bodyOverflowBeforeSheet;
    if (restoreFocus && focusBeforeSheet?.isConnected) focusBeforeSheet.focus();
    focusBeforeSheet = null;
  }

  function openMarketSheet() {
    if (!mobileMedia.matches || marketButton.disabled || sheetOpen) return;
    sheetOpen = true;
    focusBeforeSheet = document.activeElement;
    bodyOverflowBeforeSheet = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    rail.inert = false;
    rail.dataset.open = 'true';
    sheetBackdrop.dataset.open = 'true';
    rail.setAttribute('aria-hidden', 'false');
    marketButton.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      const active = rail.querySelector('[aria-pressed="true"]');
      (active || railClose).focus();
    });
  }

  function updateResponsivePresentation() {
    if (mobileMedia.matches) {
      rail.setAttribute('role', 'dialog');
      rail.setAttribute('aria-modal', 'true');
      rail.setAttribute('aria-labelledby', railTitle.id);
      center.setAttribute('role', 'tabpanel');
      center.setAttribute('aria-labelledby', chartTab.id);
      desk.setAttribute('role', 'tabpanel');
      desk.setAttribute('aria-labelledby', tradeTab.id);
      if (!sheetOpen) {
        rail.setAttribute('aria-hidden', 'true');
        rail.inert = true;
      }
      setMobileTab(mobileTab);
      return;
    }
    closeMarketSheet({ restoreFocus: false });
    rail.removeAttribute('role');
    rail.removeAttribute('aria-modal');
    rail.removeAttribute('aria-hidden');
    rail.removeAttribute('aria-labelledby');
    rail.inert = false;
    center.removeAttribute('role');
    center.removeAttribute('aria-labelledby');
    center.removeAttribute('aria-hidden');
    desk.removeAttribute('role');
    desk.removeAttribute('aria-labelledby');
    desk.removeAttribute('aria-hidden');
  }

  function onTerminalKeydown(event) {
    if (sheetOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMarketSheet();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = [...rail.querySelectorAll('button:not(:disabled)')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (!mobileTabs.contains(event.target)) return;
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'ArrowLeft' || event.key === 'Home' ? 'chart' : 'trade';
    setMobileTab(next, { focus: true });
  }

  marketButton.addEventListener('click', openMarketSheet);
  railClose.addEventListener('click', () => closeMarketSheet());
  sheetBackdrop.addEventListener('click', () => closeMarketSheet());
  chartTab.addEventListener('click', () => setMobileTab('chart'));
  tradeTab.addEventListener('click', () => setMobileTab('trade'));
  stickyBuy.addEventListener('click', () => {
    setMobileTab('trade');
    focusTradeAmount();
  });
  document.addEventListener('keydown', onTerminalKeydown);
  mobileMedia.addEventListener('change', updateResponsivePresentation);
  updateResponsivePresentation();

  function showState(node, message) {
    node.textContent = message;
    node.hidden = !message;
  }

  /** The visible half of a selection: hue, pressed row, title. */
  function paintSelection(slug) {
    const sign = signFor(slug);
    grid.style.setProperty('--sign', sign?.hue ?? '#C6CCDA');
    for (const [rowSlug, row] of railRows) {
      row.button.setAttribute('aria-pressed', String(rowSlug === slug));
    }
    const record = recordFor(slug);
    chartTitle.textContent = record?.symbol ? `${record.symbol} / USD` : sign?.name ?? '—';
    marketName.textContent = sign?.name ?? '—';
    marketPair.textContent = `${record?.symbol || sign?.name || '—'} / USDC`;
    marketSource.srcset = sign ? `/assets/zodiac-icons/128/${sign.slug}.avif` : '';
    marketIcon.src = sign ? `/assets/zodiac-icons/128/${sign.slug}.webp` : '';
    stickyBuy.textContent = `Buy ${sign?.name ?? ''}`.trim();
  }

  function setRailLocked(locked) {
    for (const { button } of railRows.values()) {
      button.disabled = locked;
      if (locked) button.title = 'Finish or dismiss the wallet review before changing signs.';
      else button.removeAttribute('title');
    }
    marketButton.disabled = locked;
    stickyBuy.disabled = locked;
  }

  function registryFailureNode() {
    const box = el('div');
    box.append(stateNode('The registry could not be read, so there is nothing to trade against.'));
    const retry = el('button', 'zme__ladder-refresh', 'Try again');
    retry.type = 'button';
    retry.style.display = 'block';
    retry.style.margin = '0 auto 10px';
    retry.addEventListener('click', () => bootRegistry());
    box.append(retry);
    return box;
  }

  function fillRail() {
    for (const sign of EXCHANGE_SIGNS) {
      const row = railRows.get(sign.slug);
      const quote = statsFor(sign.slug);
      if (!quote?.priceUsd) {
        row.price.textContent = '—';
        row.change.textContent = '';
        continue;
      }
      row.price.textContent = formatPrice(quote.priceUsd);
      if (quote.change24hPct === null) {
        row.change.textContent = '';
      } else {
        const up = quote.change24hPct > 0;
        row.change.textContent = `${up ? '+' : ''}${quote.change24hPct.toFixed(2)}%`;
        row.change.classList.toggle('zme__rail-change--up', up);
        row.change.classList.toggle('zme__rail-change--down', quote.change24hPct < 0);
      }
    }
  }

  function fillStats() {
    const quote = selected ? statsFor(selected) : null;
    const priceText = quote?.priceUsd ? formatPrice(quote.priceUsd) : '—';
    const changeText = quote?.change24hPct === null || quote?.change24hPct === undefined
      ? '—'
      : `${quote.change24hPct > 0 ? '+' : ''}${quote.change24hPct.toFixed(2)}%`;
    const liquidityText = quote?.liquidityUsd ? formatUsd(quote.liquidityUsd) : '—';
    statPrice.textContent = priceText;
    statChange.textContent = changeText;
    statChange.classList.toggle('is-positive', Boolean(quote?.change24hPct > 0));
    statChange.classList.toggle('is-negative', Boolean(quote?.change24hPct < 0));
    statLiquidity.textContent = liquidityText;
    mobilePrice.textContent = priceText;
    mobileChange.textContent = changeText;
    mobileChange.classList.toggle('is-positive', Boolean(quote?.change24hPct > 0));
    mobileChange.classList.toggle('is-negative', Boolean(quote?.change24hPct < 0));
    mobileLiquidity.textContent = `Liquidity ${liquidityText}`;
  }

  async function refreshStats() {
    if (!records) return;
    if (statsRequest) return statsRequest;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), STATS_DEADLINE_MS);
    const request = (async () => {
      try {
        const mints = [...records.values()].map((record) => record.mint);
        const result = await fetchBatchStats({ mints, signal: controller.signal });
        stats = result.stats;
        batchRows = result.rows;
        fillRail();
        fillStats();
      } catch {
        // The rail keeps its last numbers; the panel and ladder are unaffected.
      } finally {
        clearTimeout(deadline);
      }
    })();
    statsRequest = request;
    try {
      return await request;
    } finally {
      if (statsRequest === request) statsRequest = null;
    }
  }

  function poolForSelection() {
    const record = recordFor(selected);
    if (!record) return null;
    return resolvePool({ slug: selected, mint: record.mint, rows: batchRows });
  }

  // ── chart + tape ────────────────────────────────────────────────────────
  // Each loader guards its own answer: a response landing after an abort, a
  // sign switch, or a timeframe switch is dropped rather than drawn.

  function scheduleChartRetry(signal, delayMs) {
    clearTimeout(chartRetryTimer);
    chartRetryTimer = setTimeout(() => {
      if (!signal.aborted && document.visibilityState === 'visible') loadChart(signal);
    }, delayMs);
  }

  function scheduleTapeRetry(signal, delayMs) {
    clearTimeout(tapeRetryTimer);
    tapeRetryTimer = setTimeout(() => {
      if (!signal.aborted && document.visibilityState === 'visible') loadTape(signal);
    }, delayMs);
  }

  async function loadChart(signal) {
    const requestKey = `${selected}:${timeframe}`;
    const request = beginLatestRequest(chartRequest, requestKey, signal);
    if (!request) return;
    chartRequest = request;
    try {
    const sign = signFor(selected);
    const tf = timeframe;
    const slug = selected;
    const fresh = () => latestRequestIsCurrent(chartRequest, request)
      && tf === timeframe
      && slug === selected;
    const pool = poolForSelection();
    if (!pool) {
      chart.clear();
      showState(chartState, 'No indexed pool to chart. The trade panel still quotes the venue directly.');
      reportState('chart', 'not_indexed');
      return;
    }
    if (coolOff.active()) {
      showState(chartState, 'The chart service asked for a pause. Retrying shortly.');
      scheduleChartRetry(signal, coolOff.remainingMs() + 250);
      return;
    }
    if (!budget.take()) {
      showState(chartState, 'Waiting for the chart service — retrying shortly.');
      scheduleChartRetry(signal, BUDGET_RETRY_MS);
      return;
    }
    try {
      const coolOffToken = coolOff.token();
      const candles = await fetchOhlcv({ pool, timeframe: tf, signal: request.controller.signal });
      if (!fresh()) return;
      coolOff.ok(coolOffToken);
      if (!candles.length) {
        chart.clear();
        showState(chartState, 'No trades in this window yet.');
        reportState('chart', 'empty');
        return;
      }
      showState(chartState, '');
      chart.set({ candles, timeframe: tf, hue: sign?.hue });
      reportState('chart', 'ready');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (error?.code === 'rate_limited') {
        coolOff.fail(error.retryAfterMs);
        if (!fresh()) return;
        chart.clear();
        showState(chartState, 'The chart service asked for a pause. Retrying shortly.');
        reportState('chart', 'rate_limited');
        scheduleChartRetry(signal, coolOff.remainingMs() + 250);
        return;
      }
      if (!fresh()) return;
      chart.clear();
      showState(chartState, 'Chart unavailable. The trade panel still quotes the venue directly.');
      reportState('chart', error?.code === 'not_indexed' ? 'not_indexed' : 'unavailable');
    }
    } finally {
      request.detach();
      if (chartRequest === request) chartRequest = null;
    }
  }

  async function loadTape(signal) {
    const requestKey = selected;
    const request = beginLatestRequest(tapeRequest, requestKey, signal);
    if (!request) return;
    tapeRequest = request;
    try {
    const record = recordFor(selected);
    const slug = selected;
    const fresh = () => latestRequestIsCurrent(tapeRequest, request)
      && slug === selected;
    const pool = poolForSelection();
    if (!record || !pool) {
      tape.clear();
      showState(tapeState, 'No indexed pool to read trades from.');
      reportState('tape', 'not_indexed');
      return;
    }
    if (coolOff.active()) {
      showState(tapeState, 'The trade feed asked for a pause. Retrying shortly.');
      scheduleTapeRetry(signal, coolOff.remainingMs() + 250);
      return;
    }
    if (!budget.take()) {
      showState(tapeState, 'Waiting for the trade feed — retrying shortly.');
      scheduleTapeRetry(signal, BUDGET_RETRY_MS);
      return;
    }
    try {
      const coolOffToken = coolOff.token();
      const trades = await fetchTrades({
        pool,
        mint: record.mint,
        signal: request.controller.signal,
      });
      if (!fresh()) return;
      coolOff.ok(coolOffToken);
      if (!trades.length) {
        tape.clear();
        showState(tapeState, 'No recent trades in this pool.');
        reportState('tape', 'empty');
        return;
      }
      showState(tapeState, '');
      tape.set(trades, { symbol: record.symbol });
      reportState('tape', 'ready');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (error?.code === 'rate_limited') {
        coolOff.fail(error.retryAfterMs);
        if (!fresh()) return;
        tape.clear();
        showState(tapeState, 'The trade feed asked for a pause. Retrying shortly.');
        reportState('tape', 'rate_limited');
        scheduleTapeRetry(signal, coolOff.remainingMs() + 250);
        return;
      }
      if (!fresh()) return;
      tape.clear();
      showState(tapeState, 'Trade feed unavailable.');
      reportState('tape', error?.code === 'not_indexed' ? 'not_indexed' : 'unavailable');
    }
    } finally {
      request.detach();
      if (tapeRequest === request) tapeRequest = null;
    }
  }

  function stopTimers() {
    clearTimeout(chartTimer);
    clearTimeout(tapeTimer);
    clearTimeout(chartRetryTimer);
    clearTimeout(tapeRetryTimer);
    chartTimer = null;
    tapeTimer = null;
  }

  function startTimers() {
    stopTimers();
    if (!selectionAbort) return;
    const { signal } = selectionAbort;
    const scheduleChart = () => {
      chartTimer = setTimeout(async () => {
        if (!signal.aborted && document.visibilityState !== 'hidden') await loadChart(signal);
        if (!signal.aborted) scheduleChart();
      }, jitteredPollDelay(CHART_EVERY_MS));
    };
    const scheduleTape = () => {
      tapeTimer = setTimeout(async () => {
        if (!signal.aborted && document.visibilityState !== 'hidden') await loadTape(signal);
        if (!signal.aborted) scheduleTape();
      }, jitteredPollDelay(TAPE_EVERY_MS));
    };
    scheduleChart();
    scheduleTape();
  }

  function restartChart() {
    if (!selectionAbort) return;
    clearTimeout(chartRetryTimer);
    chartRetryTimer = null;
    showState(chartState, '');
    loadChart(selectionAbort.signal);
  }

  // ── ladder ──────────────────────────────────────────────────────────────
  function renderLadder(sides) {
    ladderBody.replaceChildren();
    for (const { side, rungs } of sides) {
      for (const rung of rungs) {
        const row = el('tr', side === 'buy' ? 'zme__ladder-row--buy' : 'zme__ladder-row--sell');
        const cells = [
          el('td', 'zme__ladder-side', side === 'buy' ? 'Buy' : 'Sell'),
          el('td', null, `${side === 'sell' ? '≈' : ''}$${rung.notional}`),
        ];
        if (rung.error || !rung.priceScaled) {
          const message = rung.error === 'no_route' ? 'no route' : 'unavailable';
          const spanned = el('td', null, message);
          spanned.colSpan = 2;
          cells.push(spanned);
        } else {
          cells.push(
            el('td', null, formatPrice(rung.price)),
            el('td', null, rung.impactBps === null ? '—' : `${(rung.impactBps / 100).toFixed(2)}%`),
          );
        }
        row.append(...cells);
        ladderBody.append(row);
      }
    }
  }

  async function refreshLadder() {
    const record = recordFor(selected);
    if (!record || !selectionAbort) return;
    const requestSelection = selected;
    const now = Date.now();
    if (now < ladderBusyUntil) return;
    ladderBusyUntil = now + LADDER_COOLDOWN_MS;
    ladderRefresh.disabled = true;
    ladderRefresh.textContent = 'Reading…';
    const { signal } = selectionAbort;
    showState(ladderState, 'Reading buy quotes from the venue…');
    try {
      const quote = statsFor(selected);
      const buys = await fetchLadder({ mint: record.mint, side: 'buy', signal });
      if (signal.aborted) return;
      renderLadder([buys]);
      if (buys.halted === 'rate_limited') {
        ladderBusyUntil = Math.max(
          ladderBusyUntil,
          Date.now() + Math.max(LADDER_COOLDOWN_MS, Number(buys.retryAfterMs) || 0),
        );
        showState(ladderState, 'The venue asked for a pause. Try depth again later.');
        reportState('ladder', 'rate_limited');
        return;
      }
      showState(ladderState, 'Reading sell quotes from the venue…');
      await new Promise((resolve) => { setTimeout(resolve, LADDER_QUOTE_SPACING_MS); });
      if (signal.aborted) return;
      const sells = await fetchLadder({
        mint: record.mint,
        side: 'sell',
        midPriceUsd: quote?.priceUsd ?? null,
        signal,
      });
      if (signal.aborted) return;
      renderLadder([buys, sells]);
      if (sells.halted === 'rate_limited') {
        ladderBusyUntil = Math.max(
          ladderBusyUntil,
          Date.now() + Math.max(LADDER_COOLDOWN_MS, Number(sells.retryAfterMs) || 0),
        );
        showState(ladderState, 'The venue asked for a pause. Partial depth is shown.');
        reportState('ladder', 'rate_limited');
        return;
      }
      const rungs = [...buys.rungs, ...sells.rungs];
      const failures = rungs.filter((rung) => rung.error || !rung.priceScaled).length;
      reportState('ladder', failures === 0 ? 'ready' : failures === rungs.length ? 'unavailable' : 'partial');
      showState(ladderState, failures === 0 ? '' : 'Some venue quotes were unavailable.');
    } catch (error) {
      if (error?.name !== 'AbortError' && !signal.aborted) {
        ladderBody.replaceChildren();
        showState(ladderState, 'Venue quotes unavailable just now.');
        reportState('ladder', 'unavailable');
      }
    } finally {
      clearTimeout(ladderEnableTimer);
      ladderEnableTimer = setTimeout(() => {
        if (!destroyed && requestSelection === selected) {
          ladderRefresh.disabled = false;
          ladderRefresh.textContent = 'Refresh';
        }
      }, Math.max(0, ladderBusyUntil - Date.now()));
    }
  }
  ladderRefresh.addEventListener('click', () => refreshLadder());

  // ── the trade panel ─────────────────────────────────────────────────────
  function mountPanel() {
    const sign = signFor(selected);
    const record = recordFor(selected);
    const attempt = ++panelAttempt;
    panel?.destroy?.();
    panel = null;
    setRailLocked(false);
    panelHost.replaceChildren();
    if (!sign || !record) {
      panelHost.append(registryFailed
        ? registryFailureNode()
        : stateNode('Reading the registry…'));
      return;
    }
    loadTradeBundle().then((trade) => {
      if (destroyed || attempt !== panelAttempt) return;
      if (!trade) {
        panelHost.append(stateNode('The trade panel could not load. The record page lists the venue route directly.'));
        reportState('panel', 'unavailable');
        return;
      }
      panel = trade.mount(panelHost, {
        name: sign.name,
        slug: sign.slug,
        mint: record.mint,
        hue: sign.hue,
        iconUrl: `/assets/zodiac-icons/128/${sign.slug}.webp`,
      }, {
        onStateChange: (_view, state) => {
          setRailLocked(state.state === 'signing');
          if (state.state === 'ready') reportState('panel', 'ready');
          if (state.state === 'error') {
            reportState('panel', state.error === 'rate_limited' ? 'rate_limited' : 'unavailable');
          }
        },
      });
      if (!panel) reportState('panel', 'unavailable');
    });
  }

  // ── selection ───────────────────────────────────────────────────────────
  function select(slug) {
    if (slug !== selected && panelLocksSelection(panel)) return false;
    // Before the registry answers, a click only chooses; the room opens on
    // that choice the moment the answer arrives.
    if (!records) {
      pendingSlug = slug;
      paintSelection(slug);
      if (registryFailed) {
        showState(chartState, 'The registry could not be read. Nothing verified, nothing shown.');
      } else {
        showState(chartState, 'Reading the registry…');
      }
      return;
    }
    if (slug === selected) return;
    selected = slug;
    selectionAbort?.abort();
    selectionAbort = new AbortController();
    clearTimeout(ladderEnableTimer);
    ladderBusyUntil = 0;
    ladderRefresh.disabled = false;
    ladderRefresh.textContent = 'Load depth';
    ladderBody.replaceChildren();
    showState(ladderState, 'Load depth to request ten taker-less venue quotes.');

    paintSelection(slug);
    try {
      window.history.replaceState(null, '', `#${slug}`);
    } catch {
      // Sandboxed contexts may refuse; the room works without the deep link.
    }

    chart.clear();
    tape.clear();
    showState(chartState, 'Reading the chart…');
    showState(tapeState, 'Reading recent trades…');
    fillStats();
    mountPanel();

    const { signal } = selectionAbort;
    startTimers();
    loadChart(signal);
    loadTape(signal);
  }

  function onVisibility() {
    if (document.visibilityState !== 'visible' || !selectionAbort) return;
    const { signal } = selectionAbort;
    loadChart(signal);
    loadTape(signal);
    refreshStats();
  }
  document.addEventListener('visibilitychange', onVisibility);

  // ── boot ────────────────────────────────────────────────────────────────
  // Order matters: the registry names the mints, the first stats answer
  // gives the ladder's sell side its mid price, and only then does the room
  // open — on whichever sign was clicked while it was loading, or the hash,
  // or the first lot.
  function bootRegistry() {
    if (booting || destroyed) return;
    booting = true;
    registryFailed = false;
    showState(chartState, 'Reading the registry…');
    showState(tapeState, '');
    panelHost.replaceChildren(stateNode('Reading the registry…'));
    readRegistry()
      .then(async (result) => {
        if (destroyed) return;
        records = result;
        await refreshStats();
        if (destroyed) return;
        clearInterval(statsTimer);
        statsTimer = setInterval(() => {
          if (document.visibilityState === 'hidden') return;
          refreshStats();
        }, STATS_EVERY_MS);
        const target = pendingSlug ?? initialSlug();
        pendingSlug = null;
        select(target);
      })
      .catch(() => {
        if (destroyed) return;
        registryFailed = true;
        showState(chartState, 'The registry could not be read. Nothing verified, nothing shown.');
        panelHost.replaceChildren(registryFailureNode());
      })
      .finally(() => {
        booting = false;
      });
  }
  bootRegistry();

  return {
    select,
    destroy() {
      destroyed = true;
      closeMarketSheet({ restoreFocus: false });
      selectionAbort?.abort();
      stopTimers();
      clearInterval(statsTimer);
      clearTimeout(ladderEnableTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('keydown', onTerminalKeydown);
      mobileMedia.removeEventListener('change', updateResponsivePresentation);
      terminalObserver?.disconnect();
      panel?.destroy?.();
      chart.destroy();
      tape.destroy();
      grid.remove();
    },
  };
}
