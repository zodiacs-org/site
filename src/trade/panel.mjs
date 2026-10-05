/** Retired transaction controller. No dependency (wallet or venue) is invoked. */
export const REVIEW_AGAIN_BPS = 100;
export const QUOTE_DEBOUNCE_MS = 350;
export function createTradePanel() {
  return Object.freeze({
    state: Object.freeze({ state: 'unavailable', signature: null }),
    view: () => ({ state: 'unavailable' }),
    setAmount() {}, setPayMethod() {}, refreshQuote() {}, refreshMarketContext() {},
    async submit() { return false; },
    destroy() {},
  });
}
