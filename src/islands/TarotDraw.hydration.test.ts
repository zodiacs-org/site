import type { VNode } from 'preact';
import { describe, expect, it, vi } from 'vitest';

/**
 * Hydration delayed: the visitor picks the Celtic Cross and turns reversals off in the server-rendered form before
 * the island runs. Preact keeps the native checked state and nothing replays its change event, so the state still
 * says three cards. A small hook harness (no DOM) runs the island as hydration would.
 */
const harness = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, pending: [] as Array<() => void>, ran: new Set<number>(), effect: 0 }));
vi.mock('preact/hooks', () => ({
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = initial;
    return [harness.slots[slot], (value: unknown) => { harness.slots[slot] = typeof value === 'function' ? (value as (old: unknown) => unknown)(harness.slots[slot]) : value; }];
  },
  useRef: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = { current: initial };
    return harness.slots[slot];
  },
  useEffect: (effect: () => void, dependencies: unknown[]) => {
    const index = harness.effect++;
    // Mount effects ([]) run once; the focus effect is left alone.
    if (dependencies.length === 0 && !harness.ran.has(index)) { harness.ran.add(index); harness.pending.push(effect); }
  },
}));

import TarotDraw from './TarotDraw';

const CHOSEN = {
  querySelector(selector: string) {
    if (selector === 'input[name="tarot-spread"]:checked') return { value: 'celtic-cross' };
    if (selector === 'input[name="tarot-reversals"]') return { checked: false };
    return null;
  },
  focus() {},
};
const run = () => { harness.cursor = 0; harness.effect = 0; return TarotDraw() as unknown as VNode<{ children: VNode[] }>; };
const find = (node: unknown, test: (vnode: VNode<Record<string, unknown>>) => boolean): VNode<Record<string, unknown>> | null => {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const child of node) { const hit = find(child, test); if (hit) return hit; } return null; }
  const vnode = node as VNode<Record<string, unknown>>;
  if (test(vnode)) return vnode;
  return find(vnode.props?.children, test);
};

describe('the tarot draw with hydration delayed', () => {
  it('draws the Celtic Cross, upright, when that was chosen before the island ran', () => {
    run();
    // The form's ref points at the server-rendered form the visitor already changed.
    for (const slot of harness.slots) if (slot && typeof slot === 'object' && 'current' in slot) (slot as { current: unknown }).current = CHOSEN;
    harness.pending.splice(0).forEach((effect) => effect());
    const view = run();
    const button = find(view, (vnode) => vnode.type === 'button' && vnode.props.type === 'submit');
    expect(button!.props.disabled).toBe(false);
    const formNode = find(view, (vnode) => vnode.type === 'form');
    (formNode!.props.onSubmit as (event: unknown) => void)({ preventDefault() {}, currentTarget: CHOSEN });
    const drawn = harness.slots.find((slot) => Array.isArray(slot)) as { orientation: string }[];
    expect(drawn).toHaveLength(10);
    expect(drawn.every((reading) => reading.orientation === 'upright')).toBe(true);
    expect(harness.slots).toContain('celtic-cross');
  });

  it('draws what the controls hold at submit even if the state never heard of it', () => {
    harness.slots = []; harness.ran.clear(); harness.pending = [];
    const view = run();
    const formNode = find(view, (vnode) => vnode.type === 'form');
    (formNode!.props.onSubmit as (event: unknown) => void)({ preventDefault() {}, currentTarget: CHOSEN });
    const drawn = harness.slots.find((slot) => Array.isArray(slot)) as unknown[];
    expect(drawn).toHaveLength(10);
  });
});
