import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeFooterStyles, observeViewportRegions, viewportRegionFailures,
  mobileToolMenuFailures } from './locale-capture-readiness.mjs';

afterEach(() => vi.unstubAllGlobals());

function footerPage({ links = [{ href: 'https://zodiacs.org/assets/site-footer.css', sheet: {} }],
  display = 'grid', token = '#0a0c11', background = 'rgb(10, 12, 17)' } = {}) {
  const footer = {};
  const directory = {};
  vi.stubGlobal('location', { href: 'https://zodiacs.org/es/horoscopes/capricorn/', origin: 'https://zodiacs.org', pathname: '/es/horoscopes/capricorn/' });
  vi.stubGlobal('document', { readyState: 'complete', querySelectorAll: () => links,
    querySelector: (selector) => selector === '.zfooter' ? footer : directory });
  vi.stubGlobal('getComputedStyle', (node) => node === directory ? { display }
    : { getPropertyValue: () => token, backgroundColor: background });
}

describe('real footer paint readiness', () => {
  it('does not mistake document completion or an inserted link for applied CSS', () => {
    footerPage({ links: [{ href: 'https://zodiacs.org/assets/site-footer.css', sheet: null }] });
    expect(observeFooterStyles()).toMatchObject({ documentReadyState: 'complete', linkPresent: true, sheetLoaded: false, ready: false });
    expect(observeFooterStyles({ readyOnly: true })).toBe(false);
  });

  it.each([
    { display: 'block' }, { token: '' }, { background: 'rgba(0, 0, 0, 0)' },
  ])('rejects a loaded stylesheet that has not applied its layout or colors: %j', (state) => {
    footerPage(state);
    expect(observeFooterStyles({ readyOnly: true })).toBe(false);
  });

  it.each([
    { links: [] },
    { links: [{ href: 'https://elsewhere.example/assets/site-footer.css', sheet: {} }] },
    { links: [{ href: 'https://zodiacs.org/assets/site-footer.css', sheet: {}, disabled: true }] },
  ])('rejects absent, foreign-origin or disabled stylesheet evidence: %j', (state) => {
    footerPage(state);
    expect(observeFooterStyles({ readyOnly: true })).toBe(false);
  });

  it('accepts the canonical stylesheet only after its real layout and colors apply', () => {
    footerPage();
    expect(observeFooterStyles({ readyOnly: true })).toBe(true);
    expect(observeFooterStyles()).toMatchObject({ path: '/es/horoscopes/capricorn/', directoryDisplay: 'grid', backgroundToken: '#0a0c11' });
  });
});

describe('selected-reading viewport evidence', () => {
  const state = () => ({ width: 390, height: 844, navBottom: 90,
    regions: [{ selector: '.tbs__head', visible: true, top: 106, bottom: 152, left: 20, right: 370 }] });

  it('accepts an entire region visibly below navigation', () => {
    expect(viewportRegionFailures(state())).toEqual([]);
  });

  it('rejects the old crop state even though the heading intersects the viewport', () => {
    const observed = state();
    observed.regions[0].top = 40;
    expect(viewportRegionFailures(observed)).toContain('.tbs__head: heading/content behind navigation');
  });

  it('rejects a tall reading that loses its lower content or spills horizontally', () => {
    const observed = state();
    Object.assign(observed.regions[0], { selector: '.tbs__read', bottom: 910, right: 405 });
    expect(viewportRegionFailures(observed)).toEqual([
      '.tbs__read: content clipped below viewport', '.tbs__read: content clipped horizontally',
    ]);
  });

  it('observes actual navigation and missing/hidden regions rather than assuming visibility', () => {
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal('innerHeight', 844);
    const nav = { getBoundingClientRect: () => ({ bottom: 104 }) };
    const hidden = { getBoundingClientRect: () => ({ top: 120, bottom: 170, left: 20, right: 370, width: 350, height: 50 }) };
    vi.stubGlobal('document', { querySelector: (selector) => ({ '.nav-wrap': nav, '.hidden': hidden })[selector] });
    vi.stubGlobal('getComputedStyle', () => ({ display: 'block', visibility: 'hidden', opacity: '1' }));
    const observed = observeViewportRegions(['.missing', '.hidden']);
    expect(observed.navBottom).toBe(104);
    expect(viewportRegionFailures(observed)).toEqual(['.missing: missing or hidden', '.hidden: missing or hidden']);
  });
});

describe('native mobile tool menu evidence', () => {
  const state = () => ({ width: 390, height: 844, navBottom: 90, open: true, expanded: 'true',
    guide: { visibility: 'hidden', pointerEvents: 'none', opacity: 1 },
    rows: Array.from({ length: 7 }, (_, index) => ({ href: index === 5 ? '/birthday/' : `/tool-${index}/`,
      visible: true, left: 24, right: 366, width: 342, height: 44, scrollWidth: 342, clientWidth: 342,
      // Rows below the viewport may be reached by the menu's native scrolling.
      top: 452 + index * 44, bottom: 496 + index * 44,
      textRects: [{ left: 24, right: 235, top: 468 + index * 44, bottom: 490 + index * 44 }],
      focused: index === 5, fullyInView: index === 5,
      hits: index === 5 ? [{ ownTarget: true, x: 220, y: 800 }] : [],
    })) });

  it('allows natural wrapped lines and vertical menu scrolling without horizontal clipping', () => {
    const observed = state();
    observed.rows[0].height = 64;
    observed.rows[0].textRects.push({ left: 24, right: 162, top: 490, bottom: 512 });
    expect(mobileToolMenuFailures(observed, { requireBirthdayFocus: true })).toEqual([]);
  });

  it('rejects the original 43.475px target without rounding it up to 44px', () => {
    const observed = state();
    observed.rows[5].height = 43.475;
    expect(mobileToolMenuFailures(observed)).toContain('/birthday/: target smaller than 44px');
  });

  it('rejects text Range overflow even when scrollWidth and the anchor itself fit', () => {
    const observed = state();
    observed.rows[5].textRects[0].right = 370;
    expect(mobileToolMenuFailures(observed)).toContain('/birthday/: text clipped horizontally');
  });

  it('rejects hidden or missing rows and actual horizontal scroll overflow', () => {
    const observed = state();
    observed.rows.pop();
    observed.rows[0].visible = false;
    observed.rows[1].scrollWidth = 400;
    expect(mobileToolMenuFailures(observed)).toEqual([
      'missing mobile tool rows', '/tool-0/: missing or hidden text', '/tool-1/: text clipped horizontally',
    ]);
  });

  it('rejects a visible Guide and a Guide hit over otherwise visible Birthday text', () => {
    const observed = state();
    observed.guide = { visibility: 'visible', pointerEvents: 'auto', opacity: 1 };
    observed.rows[5].hits.push({ ownTarget: false, hit: 'BUTTON.zguide-launcher' });
    expect(mobileToolMenuFailures(observed, { requireBirthdayFocus: true })).toEqual([
      'Guide remains available over the menu', 'Birthday text or target is obstructed',
    ]);
  });

  it('requires actual native focus, full target visibility and hit observations', () => {
    const observed = state();
    Object.assign(observed.rows[5], { focused: false, fullyInView: false, hits: [] });
    expect(mobileToolMenuFailures(observed, { requireBirthdayFocus: true })).toEqual([
      'Birthday is not reachable by native Tab', 'Birthday is not fully visible after native focus',
      'Birthday text or target is obstructed',
    ]);
  });

  it('does not count an absent launcher or a closed menu as clearance evidence', () => {
    const observed = state();
    observed.guide = null;
    observed.open = false;
    expect(mobileToolMenuFailures(observed)).toEqual(['mobile menu is not open', 'Guide remains available over the menu']);
  });
});
