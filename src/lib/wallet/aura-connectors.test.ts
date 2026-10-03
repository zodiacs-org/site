import { describe, expect, it, vi } from 'vitest';
import { connectEip6963Provider, connectSolanaWallet, watchEip6963Providers, watchSolanaWallets } from './aura-connectors';
describe('address-only lookup boundary', () => {
  it('does not even discover providers or dispatch wallet events', () => {
    const target = { addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() };
    const sol = vi.fn(), evm = vi.fn();
    watchSolanaWallets(sol, target)(); watchEip6963Providers(evm, target)();
    expect(sol).toHaveBeenCalledWith([]); expect(evm).toHaveBeenCalledWith([]);
    expect(target.addEventListener).not.toHaveBeenCalled(); expect(target.dispatchEvent).not.toHaveBeenCalled();
  });
  it('rejects stale connection callers without invoking providers', async () => {
    const connect = vi.fn(), request = vi.fn(), changed = vi.fn();
    await expect(connectSolanaWallet({ name: 'Synthetic', features: { 'standard:connect': { connect } } }, changed)).rejects.toThrow('wallet_connection_disabled');
    await expect(connectEip6963Provider({ info: { uuid: 'synthetic', name: 'Synthetic' }, provider: { request } }, changed)).rejects.toThrow('wallet_connection_disabled');
    expect(connect).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
  });
});
