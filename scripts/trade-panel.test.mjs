import { describe, expect, it, vi } from 'vitest';
import { createTradePanel } from '../src/trade/panel.mjs';
describe('retired transaction controller', () => {
  it('cannot quote, connect, sign or submit even through a stale consumer', async () => {
    const fetchOrder = vi.fn(), executeOrder = vi.fn(), connect = vi.fn(), signTransaction = vi.fn();
    const panel = createTradePanel({ sign: { mint: 'synthetic' }, deps: { fetchOrder, executeOrder, wallet: { connect, signTransaction } } });
    panel.setAmount('25'); panel.setPayMethod('wallet'); panel.refreshQuote();
    expect(await panel.submit()).toBe(false); expect(panel.state.signature).toBeNull();
    for (const fn of [fetchOrder, executeOrder, connect, signTransaction]) expect(fn).not.toHaveBeenCalled();
    panel.destroy(); expect(await panel.submit()).toBe(false);
  });
});
