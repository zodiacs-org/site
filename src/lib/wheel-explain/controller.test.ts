import { describe, expect, it } from 'vitest';
import {
  mountAllWheelExplain,
  mountWheelExplain,
  nearestIndex,
  reduceExplain,
  rovingTarget,
  type ExplainElement,
} from './controller';

describe('nearestIndex', () => {
  it('picks the closest point, first one on a tie, and -1 for none', () => {
    const points = [{ x: 10, y: 10 }, { x: 50, y: 50 }, { x: 52, y: 50 }];
    expect(nearestIndex(points, 49, 50)).toBe(1);
    expect(nearestIndex(points, 51.5, 50)).toBe(2);
    expect(nearestIndex(points, 51, 50)).toBe(1);
    expect(nearestIndex(points, 0, 0)).toBe(0);
    expect(nearestIndex([], 1, 1)).toBe(-1);
  });
});

describe('rovingTarget', () => {
  it('moves with the arrows, wraps at both ends, and jumps with Home and End', () => {
    expect(rovingTarget('ArrowRight', 0, 3)).toBe(1);
    expect(rovingTarget('ArrowDown', 2, 3)).toBe(0);
    expect(rovingTarget('ArrowLeft', 0, 3)).toBe(2);
    expect(rovingTarget('ArrowUp', 2, 3)).toBe(1);
    expect(rovingTarget('Home', 2, 3)).toBe(0);
    expect(rovingTarget('End', 0, 3)).toBe(2);
    expect(rovingTarget('Tab', 0, 3)).toBeNull();
    expect(rovingTarget('Enter', 0, 3)).toBeNull();
    expect(rovingTarget('ArrowRight', 0, 0)).toBeNull();
  });
});

describe('reduceExplain', () => {
  it('opens, switches and toggles closed by activating', () => {
    let step = reduceExplain({ open: null }, { type: 'activate', index: 2 });
    expect(step).toEqual({ state: { open: 2 }, focus: 2, handled: true });
    step = reduceExplain(step.state, { type: 'activate', index: 4 });
    expect(step.state).toEqual({ open: 4 });
    step = reduceExplain(step.state, { type: 'activate', index: 4 });
    expect(step).toEqual({ state: { open: null }, focus: 4, handled: true });
  });

  it('closes on Escape or the close button and sends focus back to the spot that opened it', () => {
    expect(reduceExplain({ open: 3 }, { type: 'escape' })).toEqual({ state: { open: null }, focus: 3, handled: true });
    expect(reduceExplain({ open: 1 }, { type: 'close' })).toEqual({ state: { open: null }, focus: 1, handled: true });
  });

  it('leaves an Escape with nothing open unhandled, so it keeps its default', () => {
    expect(reduceExplain({ open: null }, { type: 'escape' })).toEqual({ state: { open: null }, focus: null, handled: false });
  });
});

/* A small stand-in for the DOM: just the surface the controller uses. */
type Listener = (event: any) => void;
let focused: FakeElement | null = null;

class FakeElement implements ExplainElement {
  hidden = false;
  textContent: string | null = '';
  children: FakeElement[] = [];
  attrs = new Map<string, string>();
  listeners = new Map<string, Listener[]>();
  rect = { left: 0, top: 0, width: 0, height: 0 };
  parent: FakeElement | null = null;

  constructor(attrs: Record<string, string> = {}, text = '') {
    for (const [name, value] of Object.entries(attrs)) this.attrs.set(name, value);
    this.textContent = text;
  }
  get dataset(): DOMStringMap {
    const out: DOMStringMap = {};
    for (const [name, value] of this.attrs) {
      if (name.startsWith('data-')) out[name.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
    }
    return out;
  }
  append(...kids: FakeElement[]) { for (const kid of kids) { kid.parent = this; this.children.push(kid); } return this; }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  removeAttribute(name: string) { this.attrs.delete(name); }
  private all(): FakeElement[] { return this.children.flatMap((kid) => [kid, ...kid.all()]); }
  private matches(selector: string) { return this.attrs.has(selector.slice(1, -1)); }
  querySelector(selector: string) { return this.all().find((el) => el.matches(selector)) ?? null; }
  querySelectorAll(selector: string) { return this.all().filter((el) => el.matches(selector)); }
  closest(selector: string): FakeElement | null {
    let node: FakeElement | null = this;
    while (node && !node.matches(selector)) node = node.parent;
    return node;
  }
  addEventListener(type: string, listener: Listener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  focus() { focused = this; }
  getBoundingClientRect() { return this.rect; }
  /** Dispatches to this element and its ancestors, like a bubbling event. */
  fire(type: string, init: Record<string, unknown> = {}) {
    const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...init };
    for (let node: FakeElement | null = this; node; node = node.parent) {
      for (const listener of node.listeners.get(type) ?? []) listener(event);
    }
    return event;
  }
}

const SPOTS = [
  { id: 'body:Sun', x: 20, y: 50, title: 'Sun in Libra', text: 'The Sun is your core self.' },
  { id: 'body:Moon', x: 24, y: 52, title: 'Moon in Aries', text: 'The Moon is your emotional side.' },
  { id: 'house:10', x: 50, y: 10, title: '10th house', text: 'The 10th house is about work.' },
];

function build() {
  const root = new FakeElement({ 'data-wheel-explain': '' });
  const box = new FakeElement({ 'data-wx-spots': '' });
  box.hidden = true;
  box.rect = { left: 100, top: 200, width: 400, height: 400 };
  const spots = SPOTS.map((s, i) => new FakeElement({
    'data-wx-spot': '',
    'data-wx-id': s.id,
    'data-wx-x': String(s.x),
    'data-wx-y': String(s.y),
    'data-wx-title': s.title,
    'data-wx-text': s.text,
    'aria-expanded': 'false',
    tabindex: i === 0 ? '0' : '-1',
  }));
  box.append(...spots);
  const title = new FakeElement({ 'data-wx-out-title': '' }, 'Explore the wheel');
  const text = new FakeElement({ 'data-wx-out-text': '' }, 'Tap a planet.');
  const close = new FakeElement({ 'data-wx-close': '' });
  close.hidden = true;
  const panel = new FakeElement({ 'data-wx-panel': '' }).append(new FakeElement({ 'aria-live': 'polite' }).append(title, text), close);
  root.append(box, panel);
  focused = null;
  return { root, box, spots, title, text, close };
}

const expanded = (spots: FakeElement[]) => spots.map((s) => s.getAttribute('aria-expanded'));
const tabStops = (spots: FakeElement[]) => spots.map((s) => s.getAttribute('tabindex'));

describe('mountWheelExplain', () => {
  it('reveals the spots only once wired, and wires a block only once', () => {
    const dom = build();
    expect(dom.box.hidden).toBe(true);
    expect(mountWheelExplain(dom.root)).not.toBeNull();
    expect(dom.box.hidden).toBe(false);
    expect(dom.root.getAttribute('data-wx-ready')).toBe('');
    expect(mountWheelExplain(dom.root)).toBeNull();
  });

  it('does nothing to incomplete markup', () => {
    const root = new FakeElement({ 'data-wheel-explain': '' });
    const box = new FakeElement({ 'data-wx-spots': '' });
    box.hidden = true;
    root.append(box);
    expect(mountWheelExplain(root)).toBeNull();
    expect(box.hidden).toBe(true);
  });

  it('opens an explanation with Enter or Space (a click with detail 0) on the focused spot', () => {
    const dom = build();
    const handle = mountWheelExplain(dom.root)!;
    dom.spots[1].fire('click', { detail: 0, clientX: 0, clientY: 0 });
    expect(handle.state).toEqual({ open: 1 });
    expect(dom.title.textContent).toBe('Moon in Aries');
    expect(dom.text.textContent).toBe('The Moon is your emotional side.');
    expect(expanded(dom.spots)).toEqual(['false', 'true', 'false']);
    expect(dom.close.hidden).toBe(false);
    expect(dom.root.getAttribute('data-wx-open')).toBe('body:Moon');
    expect(tabStops(dom.spots)).toEqual(['-1', '0', '-1']);
    expect(focused).toBe(dom.spots[1]);
  });

  it('resolves a tap to the nearest mark, not the button on top', () => {
    const dom = build();
    const handle = mountWheelExplain(dom.root)!;
    // The tap lands on the Moon's button but nearer the Sun (x 20.5%, y 50%).
    dom.spots[1].fire('click', { detail: 1, clientX: 100 + 0.205 * 400, clientY: 200 + 0.5 * 400 });
    expect(handle.state).toEqual({ open: 0 });
    expect(dom.title.textContent).toBe('Sun in Libra');
    expect(focused).toBe(dom.spots[0]);
  });

  it('toggles closed when the open spot is tapped again, restoring the idle hint', () => {
    const dom = build();
    const handle = mountWheelExplain(dom.root)!;
    dom.spots[2].fire('click', { detail: 0 });
    dom.spots[2].fire('click', { detail: 0 });
    expect(handle.state).toEqual({ open: null });
    expect(dom.title.textContent).toBe('Explore the wheel');
    expect(dom.text.textContent).toBe('Tap a planet.');
    expect(dom.close.hidden).toBe(true);
    expect(dom.root.getAttribute('data-wx-open')).toBeNull();
    expect(expanded(dom.spots)).toEqual(['false', 'false', 'false']);
  });

  it('closes on Escape from the close button and returns focus to the spot', () => {
    const dom = build();
    mountWheelExplain(dom.root);
    dom.spots[2].fire('click', { detail: 0 });
    dom.close.focus();
    const escape = dom.close.fire('keydown', { key: 'Escape' });
    expect(escape.defaultPrevented).toBe(true);
    expect(dom.close.hidden).toBe(true);
    expect(focused).toBe(dom.spots[2]);
    // A second Escape has nothing to close and is left alone.
    expect(dom.spots[2].fire('keydown', { key: 'Escape' }).defaultPrevented).toBe(false);
  });

  it('closes with the close button and returns focus to the spot', () => {
    const dom = build();
    const handle = mountWheelExplain(dom.root)!;
    dom.spots[0].fire('click', { detail: 0 });
    dom.close.fire('click', { detail: 1 });
    expect(handle.state).toEqual({ open: null });
    expect(focused).toBe(dom.spots[0]);
  });

  it('keeps one tab stop and moves it with the arrow keys without opening anything', () => {
    const dom = build();
    const handle = mountWheelExplain(dom.root)!;
    expect(tabStops(dom.spots)).toEqual(['0', '-1', '-1']);
    const right = dom.spots[0].fire('keydown', { key: 'ArrowRight' });
    expect(right.defaultPrevented).toBe(true);
    expect(tabStops(dom.spots)).toEqual(['-1', '0', '-1']);
    expect(focused).toBe(dom.spots[1]);
    dom.spots[1].fire('keydown', { key: 'End' });
    expect(focused).toBe(dom.spots[2]);
    dom.spots[2].fire('keydown', { key: 'ArrowRight' });
    expect(focused).toBe(dom.spots[0]);
    expect(dom.spots[0].fire('keydown', { key: 'Tab' }).defaultPrevented).toBe(false);
    expect(handle.state).toEqual({ open: null });
  });

  it('ignores clicks that miss every spot', () => {
    const dom = build();
    const handle = mountWheelExplain(dom.root)!;
    dom.box.fire('click', { detail: 1, clientX: 300, clientY: 400 });
    expect(handle.state).toEqual({ open: null });
  });

  it('wires every block on the page', () => {
    const first = build();
    const second = build();
    const doc = { querySelectorAll: () => [first.root, second.root] };
    const handles = mountAllWheelExplain(doc);
    expect(handles.every(Boolean)).toBe(true);
    expect(first.box.hidden).toBe(false);
    expect(second.box.hidden).toBe(false);
  });
});
