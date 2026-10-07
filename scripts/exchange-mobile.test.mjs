import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { ZX_CSS } from '../src/exchange/styles.mjs';

const terminal = await readFile(new URL('../src/exchange/terminal.mjs', import.meta.url), 'utf8');
const chart = await readFile(new URL('../src/exchange/chart.mjs', import.meta.url), 'utf8');
const page = await readFile(new URL('../public/terminal/markets/index.html', import.meta.url), 'utf8');

describe('Terminal venue-route mobile contract', () => {
  it('keeps the redesign inside the mobile breakpoint', () => {
    expect(ZX_CSS).toContain('@media (max-width: 800px)');
    expect(ZX_CSS).toContain(".zme__grid[data-mobile-tab='chart'] .zme__desk");
    expect(ZX_CSS).toContain(".zme__grid[data-mobile-tab='trade'] .zme__center");
    expect(ZX_CSS).toContain('.zme .tp');
    expect(ZX_CSS).toContain('.zme .tp__step-number');
    expect(page).toContain('@media (max-width: 800px)');
  });

  it('uses semantic tabs without destroying either mounted panel', () => {
    expect(terminal).toContain("mobileTabs.setAttribute('role', 'tablist')");
    expect(terminal).toContain("button.setAttribute('role', 'tab')");
    expect(terminal).toContain("center.setAttribute('role', 'tabpanel')");
    expect(terminal).toContain("desk.setAttribute('role', 'tabpanel')");
    expect(terminal).not.toMatch(/center\.remove\(\)|desk\.remove\(\)|replaceChildren\(center|replaceChildren\(desk/u);
  });

  it('keeps the selector modal, signing lock, and focus boundaries explicit', () => {
    expect(terminal).toContain("rail.setAttribute('aria-modal', 'true')");
    expect(terminal).toContain("event.key === 'Escape'");
    expect(terminal).toContain("event.key === 'Tab'");
    expect(terminal).toContain("document.body.style.overflow = 'hidden'");
    expect(terminal).toContain('focusBeforeSheet.focus()');
    expect(terminal).toContain('marketButton.disabled = locked');
    expect(terminal).toContain('button.disabled = locked');
  });

  it('offers one public Registry action and no transaction controls', () => {
    expect(terminal).toContain("el('button', 'zme-mobile-buy', 'Registry')");
    expect(terminal).toContain("panelHost.querySelector('a')");
    expect(terminal).not.toMatch(/zme-mobile-(?:sell|limit|tp|sl)/iu);
    expect(ZX_CSS).not.toMatch(/zme-mobile-(?:sell|limit|tp|sl)/iu);
  });

  it('pins safe-area spacing, bounded tape, and reduced motion', () => {
    expect(ZX_CSS).toContain('env(safe-area-inset-bottom)');
    expect(ZX_CSS).toContain('max-height: 184px');
    expect(ZX_CSS).toContain('@media (prefers-reduced-motion: reduce)');
    expect(terminal).toContain("tapeScroll.setAttribute('role', 'region')");
    expect(terminal).toContain("tapeScroll.setAttribute('aria-label', 'Recent canonical-pool trades')");
    expect(chart).toContain("window.matchMedia('(max-width: 800px)').matches");
    expect(chart).toContain("width <= 340 ? 2 : 3");
    expect(chart).toContain("mobileChart && timeframe !== '1d'");
  });
});
