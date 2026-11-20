/**
 * Reader levels (docs/LEVELS.md): the level switch's wiring. LevelSwitch.astro
 * loads this on idle or on the reader's first touch of the switch, so it stays
 * out of the page's first-load scripts. The level itself is already applied
 * before paint by the switch's inline script.
 */
import { DEFAULT_LEVEL, LEVEL_ASKED_KEY, LEVEL_EVENT, LEVEL_STORAGE_KEY, isLevel, pageLevel, type Level } from './level';

const STATUS: Record<Level, string> = {
  beginner: 'Showing plain words and the key parts first.',
  intermediate: 'Showing houses, aspects and transits too.',
  advanced: 'Showing everything, down to exact positions.',
};
const MARKED = '[data-depth], [data-depth-only]';

const store = {
  set(key: string, value: string): void { try { window.localStorage.setItem(key, value); } catch { /* private window */ } },
};
const shown = (el: Element) => el.getClientRects().length > 0;

// Only a reader's own change comes here: the level the page opened at is
// never saved, announced or animated, and the status line stays empty until
// the reader switches, so nothing on the page moves after first paint.
function apply(level: Level) {
  const root = document.documentElement;
  const marked = Array.from(document.querySelectorAll<HTMLElement>(MARKED));
  const before = new Map<Element, boolean>(marked.map((el) => [el, shown(el)]));
  root.setAttribute('data-level', level);
  store.set(LEVEL_STORAGE_KEY, level);
  document.querySelectorAll<HTMLButtonElement>('[data-level-set]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.levelSet === level));
  });
  window.dispatchEvent(new CustomEvent(LEVEL_EVENT, { detail: { level } }));
  document.querySelectorAll('[data-level-status]').forEach((s) => { s.textContent = STATUS[level]; });
  // Depth that just opened fades in once, outermost blocks only, in reading
  // order. It fades without rising, because readings inside stay still
  // (docs/MOTION.md). Motion is off for reduced motion (html[data-entrance]).
  if (root.getAttribute('data-entrance') !== 'on') return;
  let step = 0;
  marked.forEach((el) => {
    if (before.get(el) || !shown(el)) return;
    const parent = el.parentElement?.closest(MARKED);
    if (parent && !before.get(parent)) return;
    el.classList.remove('level-open');
    void el.offsetWidth;
    el.style.setProperty('--level-i', String(Math.min(step++, 8)));
    el.classList.add('level-open');
    const done = (event: AnimationEvent) => {
      if (event.target !== el) return;
      el.classList.remove('level-open');
      el.removeEventListener('animationend', done);
    };
    el.addEventListener('animationend', done);
  });
}

export function wireLevelSwitch(): void {
  // Closing the question hides the button that has focus, so focus moves to
  // the switch button for the level now shown.
  const closeAsk = () => {
    const root = document.documentElement;
    if (!root.hasAttribute('data-level-ask')) return;
    const inside = document.activeElement?.closest('[data-level-ask]');
    store.set(LEVEL_ASKED_KEY, '1');
    root.removeAttribute('data-level-ask');
    if (inside) {
      document.querySelector<HTMLButtonElement>(`[data-level-set="${pageLevel() ?? DEFAULT_LEVEL}"]`)?.focus();
    }
  };
  document.querySelectorAll<HTMLButtonElement>('[data-level-set]').forEach((b) => {
    b.addEventListener('click', () => {
      if (isLevel(b.dataset.levelSet)) { closeAsk(); apply(b.dataset.levelSet); }
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-level-pick]').forEach((b) => {
    b.addEventListener('click', () => {
      if (isLevel(b.dataset.levelPick)) { apply(b.dataset.levelPick); closeAsk(); }
    });
  });
  document.querySelector('[data-level-skip]')?.addEventListener('click', closeAsk);
}
