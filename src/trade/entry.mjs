/**
 * Stamping for the sign pages' trade region.
 *
 * The committed HTML is always flag-off. A production build with
 * PUBLIC_REGISTRY_TRADE_ENABLED=1 stamps the panel in; running the stamper
 * again without the flag restores the committed bytes exactly, so the CI drift
 * gate — which regenerates with no env and diffs — stays quiet.
 *
 * Follows the pattern of registry-aura-entry.mjs: marked region, meta marker,
 * idempotent, reversible.
 */

export const REGISTRY_TRADE_FLAG = 'PUBLIC_REGISTRY_TRADE_ENABLED';
export const REGISTRY_TRADE_META = 'zodiacs-registry-trade-enabled';

const START = '<!-- registry-trade:start -->';
const END = '<!-- registry-trade:end -->';
const SLOT = /<!-- registry-trade:slot (\{.*?\}) -->/;

/**
 * Pinned off (owner decision, 12 November 2026, with the Registry Research
 * pause in src/data/registry-research/pause.json): the sign-page trade panel
 * stays off even when PUBLIC_REGISTRY_TRADE_ENABLED=1 is set. To lift the pin,
 * set this to false and the flag decides again. Lifting it only stamps the
 * flag marker: the panel markup and scripts/configure-registry-trade.mjs were
 * retired in #628 and would have to be restored by a reviewed change.
 */
export const REGISTRY_TRADE_PINNED_OFF = true;

export function registryTradeEnabled(env = {}) {
  if (REGISTRY_TRADE_PINNED_OFF) return false;
  return env?.[REGISTRY_TRADE_FLAG] === '1';
}

/** The comment the generator emits, carrying everything the stamper needs. */
export function tradeSlotComment({ sign, name, mint, hue }) {
  return `<!-- registry-trade:slot ${JSON.stringify({ sign, name, mint, hue })} -->`;
}

/**
 * Flag-off renders nothing at all — not a hidden container, not a placeholder.
 * A visitor with the flag off gets the page exactly as it is committed.
 */
export function renderTradeRegion({ sign, name, mint, hue, enabled }) {
  const slot = tradeSlotComment({ sign, name, mint, hue });
  return `${START}\n      ${slot}\n      ${END}`;

}

function metaFor(enabled) {
  return `<meta name="${REGISTRY_TRADE_META}" content="${enabled ? '1' : '0'}" />`;
}

/**
 * Re-render the region for the current flag state. Idempotent, and
 * byte-reversible: inject(inject(html, on), off) === html.
 */
export function injectRegistryTrade(html, env = {}) {
  const enabled = registryTradeEnabled(env);
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start === -1 || end === -1) {
    throw new Error('registry-trade: page is missing its trade region markers');
  }
  const region = html.slice(start, end + END.length);
  const slot = region.match(SLOT);
  if (!slot) throw new Error('registry-trade: region is missing its slot payload');

  const { sign, name, mint, hue } = JSON.parse(slot[1]);
  const next = renderTradeRegion({ sign, name, mint, hue, enabled });
  const output = html.slice(0, start) + next + html.slice(end + END.length);

  const meta = new RegExp(`<meta name="${REGISTRY_TRADE_META}" content="[01]" />`);
  if (!meta.test(output)) throw new Error('registry-trade: page is missing its flag marker');
  return { output: output.replace(meta, metaFor(enabled)), enabled };
}

/**
 * The Registry landing carries the panel too, but the shell holds no markup
 * for it: the explorer is React, and the panel is mounted into the chosen
 * sign's card at runtime. So the flag is the only thing to stamp here — which
 * makes reversibility a property of the shape rather than a promise.
 */
export function injectRegistryTradeLanding(html, env = {}) {
  const enabled = registryTradeEnabled(env);
  const meta = new RegExp(`<meta name="${REGISTRY_TRADE_META}" content="[01]" />`);
  if (!meta.test(html)) throw new Error('registry-trade: hub is missing its flag marker');
  return { output: html.replace(meta, metaFor(enabled)), enabled };
}
