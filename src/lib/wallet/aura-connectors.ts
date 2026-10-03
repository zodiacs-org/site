import type { WalletChain } from './types';

interface BrowserEventTarget {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  dispatchEvent(event: Event): boolean;
}

interface StandardAccount {
  address: string;
  chains?: readonly string[];
}

interface StandardConnectFeature {
  connect(): Promise<{ accounts?: readonly StandardAccount[] }>;
}

interface StandardDisconnectFeature {
  disconnect(): Promise<void>;
}

interface StandardEventsFeature {
  on(event: 'change', listener: (change: { accounts?: readonly StandardAccount[] }) => void): () => void;
}

export interface StandardWallet {
  name: string;
  /** Wallet Standard self-announced icon (a data URI per the spec). */
  icon?: string;
  accounts?: readonly StandardAccount[];
  features: Record<string, unknown> & {
    'standard:connect'?: StandardConnectFeature;
    'standard:disconnect'?: StandardDisconnectFeature;
    'standard:events'?: StandardEventsFeature;
  };
}

export interface Eip1193Provider {
  request(input: { method: 'eth_requestAccounts' }): Promise<unknown>;
  on?(event: 'accountsChanged' | 'disconnect', listener: (value?: unknown) => void): void;
  removeListener?(event: 'accountsChanged' | 'disconnect', listener: (value?: unknown) => void): void;
  off?(event: 'accountsChanged' | 'disconnect', listener: (value?: unknown) => void): void;
}

export interface Eip6963ProviderDetail {
  info: {
    uuid: string;
    name: string;
    icon?: string;
    rdns?: string;
  };
  provider: Eip1193Provider;
}

export interface ConnectedWalletSession {
  chain: WalletChain;
  address: string;
  walletName: string;
  disconnect(): Promise<void>;
  dispose(): void;
}

export type AccountChangeHandler = (address: string | null) => void;

/** Retained type/API seam for older imports. Address-only sites never discover providers. */
export function watchSolanaWallets(onWallets: (wallets: readonly StandardWallet[]) => void, _target?: BrowserEventTarget): () => void {
  onWallets([]);
  return () => {};
}
export function watchEip6963Providers(onProviders: (providers: readonly Eip6963ProviderDetail[]) => void, _target?: BrowserEventTarget): () => void {
  onProviders([]);
  return () => {};
}
export async function connectSolanaWallet(_wallet: StandardWallet, _onAccountChange: AccountChangeHandler): Promise<ConnectedWalletSession> {
  throw new Error('wallet_connection_disabled');
}
export async function connectEip6963Provider(_detail: Eip6963ProviderDetail, _onAccountChange: AccountChangeHandler): Promise<ConnectedWalletSession> {
  throw new Error('wallet_connection_disabled');
}
