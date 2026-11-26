import type { VNode } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** The share button, run without a DOM: its hooks are stubbed so the click handler can be called directly. */
vi.mock('preact/hooks', () => ({
  useState: (initial: unknown) => [initial, () => {}],
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: () => {},
  useMemo: (make: () => unknown) => make(),
  useCallback: (callback: unknown) => callback,
}));

const { ShareButton } = await import('./RetrogradeForYou');

const QUERY = 'p=mercury&s=2026-10-24&sun=taurus';

function shareHandler(): () => void {
  const find = (node: unknown): VNode | null => {
    if (!node || typeof node !== 'object') return null;
    const vnode = node as VNode<Record<string, unknown>>;
    if (vnode.props && 'data-retrograde-share' in vnode.props) return vnode;
    const children = vnode.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  };
  const button = find(ShareButton({ query: QUERY, planet: 'Mercury' })) as VNode<{ onClick: () => void }> | null;
  if (!button) throw new Error('no share button');
  return button.props.onClick;
}

describe('the retrograde share button', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it.each([
    'https://zodiacs.org',
    'https://site-git-claude-retrograde-zodiacsofficial.vercel.app',
    'http://localhost:4321',
  ])('shares the card on the site the page was opened on (%s)', async (origin) => {
    const shared: unknown[] = [];
    const copied: string[] = [];
    vi.stubGlobal('window', { location: { origin } });
    vi.stubGlobal('navigator', { share: async (data: unknown) => { shared.push(data); } });
    shareHandler()();
    await vi.waitFor(() => expect(shared).toHaveLength(1));
    expect(shared[0]).toEqual({ title: 'Mercury retrograde in my chart', url: `${origin}/share/retrograde-for-you/?${QUERY}` });

    vi.stubGlobal('navigator', { clipboard: { writeText: async (text: string) => { copied.push(text); } } });
    shareHandler()();
    await vi.waitFor(() => expect(copied).toHaveLength(1));
    expect(copied[0]).toBe(`${origin}/share/retrograde-for-you/?${QUERY}`);
  });
});
