import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

// Execute the real inline owner, so a source marker alone cannot bless a
// broken visibility trigger or a fallback lost during observer setup.
const base = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
const source = base.match(/<script is:inline>\s*(\(function loadFooterStyles\(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/)?.[1];
if (!source) throw new Error('The actual inline footer stylesheet loader was not found');

function run({ top = 1800, readyState = 'loading', io = 'normal', hasFooter = true } = {}) {
  const links = [];
  const listeners = new Map();
  const timers = [];
  const observations = [];
  const footer = hasFooter ? { getBoundingClientRect: () => ({ top }) } : null;
  const window = {
    innerHeight: 1000,
    addEventListener: (type, callback, options) => listeners.set(type, { callback, options }),
    setTimeout: (callback, delay) => timers.push({ callback, delay }),
  };
  const document = {
    readyState,
    querySelector: (selector) => selector === '.zfooter' ? footer : null,
    createElement: (tag) => ({ tag }),
    head: { appendChild: (link) => links.push(link) },
  };
  if (io !== 'absent') {
    window.IntersectionObserver = class {
      constructor(callback, options) {
        if (io === 'constructor-error') throw new Error('Observer unavailable');
        this.callback = callback;
        this.options = options;
        this.disconnected = false;
        observations.push(this);
      }
      observe(target) {
        if (io === 'observe-error') throw new Error('Observer refused target');
        this.target = target;
      }
      disconnect() { this.disconnected = true; }
    };
  }
  runInNewContext(source, { window, document, IntersectionObserver: window.IntersectionObserver });
  return {
    links, listeners, timers, observations, footer,
    load() { listeners.get('load')?.callback(); },
    advance() { for (const timer of timers.splice(0)) timer.callback(); },
    approach(intersects = true) { observations[0].callback([{ isIntersecting: intersects }]); },
  };
}

const expectOneStylesheet = (state) => expect(state.links).toEqual([
  { tag: 'link', rel: 'stylesheet', href: '/assets/site-footer.css?v=20261003' },
]);

describe('actual footer stylesheet loader', () => {
  it('revalidates the mutable footer stylesheet instead of freezing future repairs', () => {
    const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const header = config.headers.find(rule => rule.source === '/assets/site-footer.css')
      ?.headers.find(header => header.key.toLowerCase() === 'cache-control');
    expect(header?.value).toBe('public, max-age=0, must-revalidate');
  });

  it('requests an initially visible/near footer immediately before window load', () => {
    for (const top of [200, 1200]) {
      const state = run({ top });
      expectOneStylesheet(state);
      expect(state.observations).toHaveLength(0);
      expect(state.timers).toHaveLength(0);
    }
  });

  it('keeps a distant footer deferred and observes exactly the existing 200px approach boundary', () => {
    const state = run({ top: 1201 });
    expect(state.links).toHaveLength(0);
    expect(state.observations).toHaveLength(1);
    expect(state.observations[0].target).toBe(state.footer);
    expect(state.observations[0].options).toEqual({ threshold: 0, rootMargin: '0px 0px 200px 0px' });
    state.approach(false);
    expect(state.links).toHaveLength(0);
    state.approach();
    expectOneStylesheet(state);
    expect(state.observations[0].disconnected).toBe(true);
  });

  it('approach, repeated observer entries and the later load timer create only one request', () => {
    const state = run();
    state.approach(); state.approach(); state.load();
    expect(state.timers[0].delay).toBe(250);
    state.advance();
    expectOneStylesheet(state);
  });

  it('post-load fallback works without scrolling and disconnects the observer', () => {
    const state = run();
    expect(state.listeners.get('load').options).toEqual({ once: true });
    state.load();
    expect(state.links).toHaveLength(0);
    expect(state.timers[0].delay).toBe(250);
    state.advance(); state.approach();
    expectOneStylesheet(state);
    expect(state.observations[0].disconnected).toBe(true);
  });

  it('retains the complete-document 250ms fallback with no future load event required', () => {
    const state = run({ readyState: 'complete' });
    expect(state.listeners.has('load')).toBe(false);
    expect(state.timers[0].delay).toBe(250);
    expect(state.links).toHaveLength(0);
    state.advance();
    expectOneStylesheet(state);
  });

  it.each(['absent', 'constructor-error', 'observe-error'])('retains fallback when IntersectionObserver is %s', (io) => {
    const state = run({ io });
    expect(state.links).toHaveLength(0);
    state.load(); state.advance();
    expectOneStylesheet(state);
  });

  it('retains the old post-load behavior if the footer is absent', () => {
    const state = run({ hasFooter: false });
    expect(state.observations).toHaveLength(0);
    state.load(); state.advance();
    expectOneStylesheet(state);
  });
});
