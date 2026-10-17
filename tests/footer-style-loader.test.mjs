import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

// Execute the real inline owner, so a source marker alone cannot bless a
// broken visibility trigger or a fallback lost during observer setup.
const base = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
const source = base.match(/<script is:inline>\s*(\(function loadFooterStyles\(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/)?.[1];
if (!source) throw new Error('The actual inline footer stylesheet loader was not found');
const holdSource = "document.documentElement.setAttribute('data-footer-styles-pending', '');";

/** The document's root element, with just the attribute calls the scripts make. */
function rootElement(attributes = []) {
  const names = new Set(attributes);
  return {
    names,
    hasAttribute: (name) => names.has(name),
    setAttribute: (name) => names.add(name),
    removeAttribute: (name) => names.delete(name),
  };
}

// The head holds the footer before the loader runs (see the last block).
function run({ top = 1800, readyState = 'loading', io = 'normal', hasFooter = true } = {}) {
  const links = [];
  const root = rootElement(['data-footer-styles-pending']);
  const listeners = new Map();
  const timers = [];
  const observations = [];
  const linkEvents = new Map();
  const reads = { count: 0 };
  const footer = hasFooter ? { getBoundingClientRect: () => { reads.count += 1; return { top }; } } : null;
  const window = {
    innerHeight: 1000,
    addEventListener: (type, callback, options) => listeners.set(type, { callback, options }),
    setTimeout: (callback, delay) => timers.push({ callback, delay }),
  };
  const document = {
    documentElement: root,
    readyState,
    querySelector: (selector) => selector === '.zfooter' ? footer : null,
    createElement: (tag) => {
      // Listeners stay off the element's own keys, so a link still equals
      // exactly what the loader set on it.
      const element = { tag };
      Object.defineProperty(element, 'addEventListener', {
        value: (type, callback) => linkEvents.set(type, callback),
      });
      return element;
    },
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
  // A browser's observer reports once right after the first layout; that
  // first report is where the loader learns whether the footer starts near
  // the screen (the 200px margin below the viewport).
  const observing = observations[0];
  if (observing?.target && !observing.disconnected) {
    observing.callback([{ isIntersecting: top <= window.innerHeight + 200 }]);
  }
  return {
    links, listeners, timers, observations, footer, linkEvents, root, reads,
    load() { listeners.get('load')?.callback(); },
    advance() { for (const timer of timers.splice(0)) timer.callback(); },
    approach(intersects = true) { observations[0].callback([{ isIntersecting: intersects }]); },
  };
}

const expectOneStylesheet = (state) => expect(state.links).toEqual([
  { tag: 'link', rel: 'stylesheet', href: '/assets/site-footer.css?v=20261006' },
]);

describe('actual footer stylesheet loader', () => {
  it('revalidates the mutable footer stylesheet instead of freezing future repairs', () => {
    const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const header = config.headers.find(rule => rule.source === '/assets/site-footer.css')
      ?.headers.find(header => header.key.toLowerCase() === 'cache-control');
    expect(header?.value).toBe('public, max-age=0, must-revalidate');
  });

  it('requests an initially visible/near footer on the first report, before window load', () => {
    for (const top of [200, 1200]) {
      const state = run({ top });
      expectOneStylesheet(state);
      expect(state.observations).toHaveLength(1);
      expect(state.observations[0].disconnected).toBe(true);
      expect(state.listeners.has('load')).toBe(false);
      expect(state.timers.map((timer) => timer.delay)).toEqual([3000]);
    }
  });

  it('reads no layout while the page parses when an observer can report it', () => {
    for (const top of [200, 1800]) expect(run({ top }).reads.count).toBe(0);
    for (const io of ['absent', 'constructor-error', 'observe-error']) {
      const fallback = run({ io, top: 200 });
      expect(fallback.reads.count).toBe(1);
      expectOneStylesheet(fallback);
    }
  });

  // A footer in the first viewport would paint unstyled, then move and
  // reflow when its stylesheet lands: a layout shift on any page short
  // enough to show it (F-87). Held from the head, it stays hidden until its
  // styles apply; the loader drops the hold once they load, fail or stall.
  it('keeps a near footer held until its styles load or fail, or for 3 s', () => {
    for (const settle of ['load', 'error']) {
      const state = run({ top: 200 });
      expect(state.root.names.has('data-footer-styles-pending')).toBe(true);
      state.linkEvents.get(settle)();
      expect(state.root.names.has('data-footer-styles-pending')).toBe(false);
    }
    const stalled = run({ top: 1200 });
    stalled.advance();
    expect(stalled.root.names.has('data-footer-styles-pending')).toBe(false);
  });

  it('shows a distant or missing footer at once, whenever its styles are requested', () => {
    const approached = run();
    expect(approached.root.names.size).toBe(0);
    approached.approach();
    const afterLoad = run();
    afterLoad.load(); afterLoad.advance();
    const missing = run({ hasFooter: false });
    expect(missing.root.names.size).toBe(0);
    for (const state of [approached, afterLoad]) {
      expectOneStylesheet(state);
      expect(state.linkEvents.size).toBe(0);
      expect(state.root.names.size).toBe(0);
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

describe('footer hold set in the head', () => {
  it('holds the footer before the body is parsed, so no paint can show it unstyled', () => {
    const head = base.slice(0, base.indexOf('<body'));
    expect(head).toContain(holdSource);
    const root = rootElement();
    runInNewContext(holdSource, { document: { documentElement: root } });
    expect(root.names.has('data-footer-styles-pending')).toBe(true);
  });
});
