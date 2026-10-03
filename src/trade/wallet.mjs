/** Compatibility seam only. Never discovers or calls a wallet provider. */
export function createWallet() {
  return {
    getAddress: () => null,
    async connect() { throw new Error('wallet_connection_disabled'); },
    async signTransaction() { throw new Error('transaction_signing_disabled'); },
    destroy() {},
  };
}
