/**
 * Tap-to-explain behaviour for a static chart wheel, in plain DOM code.
 *
 * The markup (WheelExplain.astro) carries everything: one real <button> per
 * planet, sign or house number, each with its finished explanation in data
 * attributes, and a panel whose space is reserved from the first paint.
 * Without JavaScript the buttons stay hidden and the panel is collapsed by a
 * <noscript> rule, so the wheel reads exactly as before.
 *
 * With it: one tab stop for the whole set (roving tabindex, arrow keys,
 * Home and End), Enter or Space or a tap opens a spot's explanation in the
 * aria-live panel, the same spot or Escape or the close button closes it,
 * and closing returns focus to the spot that opened it. A tap resolves to
 * the nearest mark rather than whichever large hit area happens to be on
 * top, because neighbouring planets sit closer than any honest touch target.
 */

export interface Point { x: number; y: number }

/** Index of the point nearest (x, y), or -1 for an empty list. */
export function nearestIndex(points: readonly Point[], x: number, y: number): number {
  let best = -1;
  let bestDistance = Infinity;
  points.forEach((point, index) => {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/** The spot a roving-focus key moves to, or null when the key is not one of them. */
export function rovingTarget(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export interface ExplainState {
  /** Index of the spot whose explanation is showing, or null. */
  open: number | null;
}

export type ExplainAction =
  | { type: 'activate'; index: number }
  | { type: 'close' }
  | { type: 'escape' };

export interface ExplainStep {
  state: ExplainState;
  /** Spot to move focus to after the step, or null to leave focus alone. */
  focus: number | null;
  /** Whether the action did anything (an unhandled Escape keeps its default). */
  handled: boolean;
}

export function reduceExplain(state: ExplainState, action: ExplainAction): ExplainStep {
  switch (action.type) {
    case 'activate':
      return state.open === action.index
        ? { state: { open: null }, focus: action.index, handled: true }
        : { state: { open: action.index }, focus: action.index, handled: true };
    case 'close':
    case 'escape':
      return state.open === null
        ? { state, focus: null, handled: false }
        : { state: { open: null }, focus: state.open, handled: true };
  }
}

/** The DOM surface the controller touches; a real HTMLElement satisfies it. */
export interface ExplainElement {
  hidden: boolean;
  textContent: string | null;
  dataset: DOMStringMap;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  querySelector(selector: string): ExplainElement | null;
  querySelectorAll(selector: string): ArrayLike<ExplainElement>;
  addEventListener(type: string, listener: (event: any) => void): void;
  focus(options?: FocusOptions): void;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
}

export interface ExplainHandle {
  readonly state: ExplainState;
  activate(index: number): void;
  close(): void;
}

/** Wires one `[data-wheel-explain]` block. Returns null when its markup is incomplete. */
export function mountWheelExplain(root: ExplainElement): ExplainHandle | null {
  const box = root.querySelector('[data-wx-spots]');
  const spots = Array.from(root.querySelectorAll('[data-wx-spot]'));
  const titleOut = root.querySelector('[data-wx-out-title]');
  const textOut = root.querySelector('[data-wx-out-text]');
  const closeButton = root.querySelector('[data-wx-close]');
  if (!box || !spots.length || !titleOut || !textOut || !closeButton) return null;
  const title: ExplainElement = titleOut;
  const text: ExplainElement = textOut;
  const close: ExplainElement = closeButton;
  if (root.dataset.wxReady !== undefined) return null;

  const idle = { title: title.textContent ?? '', text: text.textContent ?? '' };
  const points = spots.map((spot) => ({ x: Number(spot.dataset.wxX), y: Number(spot.dataset.wxY) }));
  let state: ExplainState = { open: null };
  let current = 0;

  function rove(index: number) {
    spots[current].setAttribute('tabindex', '-1');
    current = index;
    spots[current].setAttribute('tabindex', '0');
  }

  function render() {
    spots.forEach((spot, index) => spot.setAttribute('aria-expanded', String(index === state.open)));
    const open = state.open === null ? null : spots[state.open];
    title.textContent = open ? open.dataset.wxTitle ?? '' : idle.title;
    text.textContent = open ? open.dataset.wxText ?? '' : idle.text;
    close.hidden = !open;
    if (open) root.setAttribute('data-wx-open', open.dataset.wxId ?? '');
    else root.removeAttribute('data-wx-open');
  }

  function dispatch(action: ExplainAction): boolean {
    const step = reduceExplain(state, action);
    state = step.state;
    render();
    if (step.focus !== null) {
      rove(step.focus);
      spots[step.focus].focus({ preventScroll: true });
    }
    return step.handled;
  }

  box.addEventListener('click', (event: MouseEvent) => {
    const target = (event.target as Element | null)?.closest?.('[data-wx-spot]');
    let index = spots.indexOf(target as unknown as ExplainElement);
    if (index === -1) return;
    // A pointer tap (detail > 0) goes to the nearest mark; Enter and Space
    // fire a click with detail 0 and keep the focused button.
    if (event.detail > 0) {
      const rect = box.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        index = nearestIndex(
          points,
          ((event.clientX - rect.left) / rect.width) * 100,
          ((event.clientY - rect.top) / rect.height) * 100,
        );
      }
    }
    dispatch({ type: 'activate', index });
  });

  box.addEventListener('keydown', (event: KeyboardEvent) => {
    const from = spots.indexOf(event.target as unknown as ExplainElement);
    if (from === -1) return;
    const to = rovingTarget(event.key, from, spots.length);
    if (to === null) return;
    event.preventDefault();
    rove(to);
    spots[to].focus();
  });

  root.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (dispatch({ type: 'escape' })) event.preventDefault();
  });

  close.addEventListener('click', () => {
    dispatch({ type: 'close' });
  });

  spots.forEach((spot, index) => spot.setAttribute('tabindex', index === 0 ? '0' : '-1'));
  box.hidden = false;
  root.setAttribute('data-wx-ready', '');

  return {
    get state() { return state; },
    activate(index: number) { dispatch({ type: 'activate', index }); },
    close() { dispatch({ type: 'close' }); },
  };
}

/** Wires every explain block in a document; safe to call more than once. */
export function mountAllWheelExplain(doc: { querySelectorAll(selector: string): ArrayLike<unknown> }) {
  return Array.from(doc.querySelectorAll('[data-wheel-explain]'), (root) => mountWheelExplain(root as ExplainElement));
}
