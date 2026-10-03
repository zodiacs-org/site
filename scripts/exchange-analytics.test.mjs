import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  EXCHANGE_ANALYTICS_CONTRACT,
  sanitizeExchangeEvent,
  trackExchangeEvent,
} from '../src/exchange/analytics.mjs';
import {
  beginLatestRequest,
  jitteredPollDelay,
  latestRequestIsCurrent,
  panelLocksSelection,
  requestMayStart,
} from '../src/exchange/terminal.mjs';

describe('Exchange operating analytics', () => {
  it('has no field capable of carrying trade or visitor data', () => {
    const contract = JSON.stringify(EXCHANGE_ANALYTICS_CONTRACT);
    expect(contract).not.toMatch(/address|wallet|amount|mint|transaction|signature|request|url|referrer|query/i);
  });

  it('accepts only closed operational dimensions', () => {
    expect(sanitizeExchangeEvent('exchange_market_state', {
      surface: 'chart',
      outcome: 'rate_limited',
      wallet: 'must-not-leave',
    })).toEqual({ surface: 'chart', outcome: 'rate_limited' });
    expect(sanitizeExchangeEvent('exchange_market_state', {
      surface: 'something-new', outcome: 'ready',
    })).toBeNull();
    expect(sanitizeExchangeEvent('unknown', {})).toBeNull();
  });

  it('sends only the sanitized payload and quietly no-ops without Plausible', () => {
    const track = vi.fn();
    expect(trackExchangeEvent('exchange_market_state', {
      surface: 'panel', outcome: 'ready', amount: 25,
    }, track)).toBe(true);
    expect(track).toHaveBeenCalledWith('exchange_market_state', {
      props: { surface: 'panel', outcome: 'ready' },
    });
    expect(trackExchangeEvent('exchange_room_mount', {}, null)).toBe(false);
    expect(trackExchangeEvent('exchange_room_mount', {}, () => { throw new Error('blocked'); }))
      .toBe(false);
  });

  it('does not load or operate a transaction panel', async () => {
    const source = await readFile(new URL('../src/exchange/terminal.mjs', import.meta.url), 'utf8');
    expect(source).not.toMatch(/loadTradeBundle|trade\.mount|state\.state === 'signing'/);
    expect(source).toContain('link.href = `/registry/${selected}/`');
  });

  it('arms regular polling before an immediate load can schedule a provider retry', async () => {
    const terminal = await import('node:fs/promises')
      .then(({ readFile }) => readFile(new URL('../src/exchange/terminal.mjs', import.meta.url), 'utf8'));
    const selection = terminal.slice(terminal.indexOf('function select(slug)'), terminal.indexOf('function onVisibility()'));
    expect(selection.indexOf('startTimers();')).toBeLessThan(selection.indexOf('loadChart(signal);'));
    expect(selection.indexOf('startTimers();')).toBeLessThan(selection.indexOf('loadTape(signal);'));
  });

  it('keeps sign selection locked while wallet review is unresolved', async () => {
    expect(panelLocksSelection({ controller: { state: { state: 'signing' } } })).toBe(true);
    expect(panelLocksSelection({ controller: { state: { state: 'ready' } } })).toBe(false);
    const terminal = await import('node:fs/promises')
      .then(({ readFile }) => readFile(new URL('../src/exchange/terminal.mjs', import.meta.url), 'utf8'));
    const selection = terminal.slice(terminal.indexOf('function select(slug)'), terminal.indexOf('function onVisibility()'));
    expect(selection.indexOf('panelLocksSelection(panel)')).toBeLessThan(selection.indexOf('selected = slug'));
  });
});

describe('Exchange polling cadence', () => {
  it('jitters recurring polls inside a narrow, deterministic band', () => {
    expect(jitteredPollDelay(1000, () => 0)).toBe(880);
    expect(jitteredPollDelay(1000, () => 0.5)).toBe(1000);
    expect(jitteredPollDelay(1000, () => 1)).toBe(1120);
  });

  it('blocks overlap for one selection but lets a switched selection load immediately', () => {
    expect(requestMayStart('aries:1h', 'aries:1h')).toBe(false);
    expect(requestMayStart('aries:1h', 'taurus:1h')).toBe(true);
    expect(requestMayStart('aries:1h', 'aries:4h')).toBe(true);
  });

  it('uses request identity to close an A → B → A stale-response race', () => {
    const parent = new AbortController();
    const firstA = beginLatestRequest(null, 'aries:1h', parent.signal);
    const b = beginLatestRequest(firstA, 'aries:4h', parent.signal);
    const finalA = beginLatestRequest(b, 'aries:1h', parent.signal);
    expect(firstA.controller.signal.aborted).toBe(true);
    expect(b.controller.signal.aborted).toBe(true);
    expect(latestRequestIsCurrent(finalA, firstA)).toBe(false);
    expect(latestRequestIsCurrent(finalA, finalA)).toBe(true);
    finalA.detach();
  });
});
