import { describe, expect, it, vi } from 'vitest';
import { createWallet } from '../src/trade/wallet.mjs';
describe('retired wallet API', () => {
  it('refuses connections and signatures without discovery or provider calls', async () => {
    const target = { dispatchEvent: vi.fn(), addEventListener: vi.fn() };
    const choose = vi.fn(); const wallet = createWallet({ target, choose });
    expect(wallet.getAddress()).toBeNull();
    await expect(wallet.connect()).rejects.toThrow('wallet_connection_disabled');
    await expect(wallet.signTransaction('synthetic')).rejects.toThrow('transaction_signing_disabled');
    wallet.destroy(); expect(target.dispatchEvent).not.toHaveBeenCalled(); expect(target.addEventListener).not.toHaveBeenCalled(); expect(choose).not.toHaveBeenCalled();
  });
});
