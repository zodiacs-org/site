import { parseWalletAddress } from '../../lib/wallet/address';

export const REGISTRY_SOURCE_URL = '/registry/zodiacs.registry.json';
export const NETWORKS = Object.freeze([
  { value: 'solana', label: 'Solana mainnet', representation: 'Native SPL' },
  { value: 'base', label: 'Base mainnet · 8453', representation: 'Bridged ERC-20' },
] as const);
export const BASE_COMPARISON_NOTE = 'Base addresses are compared by their hexadecimal bytes. Mixed-case checksum validation is not performed.';
export const NORMALIZATION_NOTE = 'Surrounding ASCII whitespace is ignored. Solana addresses are case-sensitive. Unicode characters are rejected.';

export type VerificationNetwork = 'solana' | 'base';
export interface RegistryRepresentation {
  sign: string;
  chain: VerificationNetwork;
  chainId?: number;
  kind: 'native' | 'bridged';
  tokenStandard: 'SPL' | 'ERC20';
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  isCanonicalOrigin: boolean;
  isOfficialRepresentation: true;
  originChain?: string;
  originAddress?: string;
  bridge?: { status: string; protocol: string; sourceChain: string; destinationChain: string };
}
export interface RegistryAsset {
  sign: string;
  displayName: string;
  native: RegistryRepresentation;
  representations: RegistryRepresentation[];
}
export interface RegistryDocument {
  name: string;
  source: string;
  version: string;
  nativeChain: 'solana';
  supportedChains: Array<{ chain: VerificationNetwork; kind: string; tokenStandard: string; chainId?: number }>;
  assets: RegistryAsset[];
}
export type RegistryValidation = { ok: true; registry: RegistryDocument } | { ok: false; reason: string };

const object = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);
const publicText = (value: unknown): value is string => (
  typeof value === 'string' && value.length > 0 && value.length <= 160 && !/[\u0000-\u001f]/u.test(value)
);
const sameAddress = (a: RegistryRepresentation, b: RegistryRepresentation) => (
  a.chain === b.chain && (a.chain === 'base' ? a.address.toLowerCase() === b.address.toLowerCase() : a.address === b.address)
);

/** A local compatibility check, not a second registry authority or chain audit. */
export function validateRegistry(input: unknown): RegistryValidation {
  const invalid = (reason: string): RegistryValidation => ({ ok: false, reason });
  if (!object(input) || input.name !== 'Zodiacs Official Registry' || input.source !== 'https://zodiacs.org'
    || typeof input.version !== 'string' || !/^\d+\.\d+\.\d+$/u.test(input.version)
    || input.nativeChain !== 'solana' || !Array.isArray(input.supportedChains)
    || input.supportedChains.length !== 2 || !Array.isArray(input.assets) || input.assets.length !== 12) {
    return invalid('The Registry document is missing its supported collection metadata.');
  }
  for (const chain of ['solana', 'base']) {
    const entries = input.supportedChains.filter((entry: unknown) => object(entry) && entry.chain === chain);
    if (entries.length !== 1) return invalid('The Registry network declarations are ambiguous.');
    const entry = entries[0];
    if (entry.kind !== (chain === 'solana' ? 'native' : 'bridged')
      || entry.tokenStandard !== (chain === 'solana' ? 'SPL' : 'ERC20')
      || (chain === 'base' && entry.chainId !== 8453)) {
      return invalid('The Registry network or representation declarations are incompatible.');
    }
  }
  const signs = new Set<string>();
  const addresses = new Set<string>();
  for (const asset of input.assets) {
    if (!object(asset) || typeof asset.sign !== 'string' || !/^[a-z]+$/u.test(asset.sign)
      || signs.has(asset.sign) || !publicText(asset.displayName)
      || !object(asset.native) || !Array.isArray(asset.representations) || asset.representations.length !== 2) {
      return invalid('The Registry assets are incomplete or duplicated.');
    }
    signs.add(asset.sign);
    const chains = new Set<string>();
    for (const representation of asset.representations) {
      if (!object(representation) || representation.sign !== asset.sign
        || typeof representation.address !== 'string' || /[^\x00-\x7f]/u.test(representation.address)
        || representation.address.trim() !== representation.address
        || !publicText(representation.symbol) || !publicText(representation.name)
        || !Number.isInteger(representation.decimals) || Number(representation.decimals) < 0 || Number(representation.decimals) > 255
        || representation.isOfficialRepresentation !== true) {
        return invalid('An official representation is incomplete or malformed.');
      }
      const parsed = parseWalletAddress(representation.address);
      if (!parsed || parsed.chain !== representation.chain || chains.has(parsed.chain)) {
        return invalid('A representation address is invalid for its declared network.');
      }
      chains.add(parsed.chain);
      const key = `${parsed.chain}:${parsed.address}`;
      if (addresses.has(key)) return invalid('An identifier is assigned to more than one Registry record.');
      addresses.add(key);
      if (parsed.chain === 'solana') {
        if (representation.kind !== 'native' || representation.tokenStandard !== 'SPL'
          || representation.isCanonicalOrigin !== true) return invalid('The native representation declaration is incompatible.');
      } else if (representation.kind !== 'bridged' || representation.tokenStandard !== 'ERC20'
        || representation.chainId !== 8453 || representation.isCanonicalOrigin !== false
        || representation.originChain !== 'solana' || representation.originAddress !== asset.native.address
        || !object(representation.bridge) || representation.bridge.status !== 'official-bridged'
        || representation.bridge.protocol !== 'wormhole' || representation.bridge.sourceChain !== 'solana'
        || representation.bridge.destinationChain !== 'base') {
        return invalid('The bridged representation declaration is incompatible.');
      }
    }
    const native = asset.representations.find((item) => item.chain === 'solana');
    const declaredNative = asset.native;
    if (!native || Object.entries(native).some(([key, value]) => declaredNative[key] !== value)) {
      return invalid('The native identity and its representation contradict each other.');
    }
  }
  return { ok: true, registry: input as unknown as RegistryDocument };
}

export type ComparisonResult = {
  status: 'malformed' | 'wrong-network' | 'unsupported-network' | 'not-found' | 'match' | 'source-error';
  message: string;
  network: string;
  registryVersion?: string;
  record?: { sign: string; displayName: string; representation: RegistryRepresentation };
};

/** Classifies a supplied public identifier only. It makes no request or persistence operation. */
export function compareIdentifier(input: unknown, network: string, registry: unknown): ComparisonResult {
  if (network !== 'solana' && network !== 'base') {
    return { status: 'unsupported-network', network, message: 'This checker supports Solana mainnet and Base mainnet (8453) only. No match was established.' };
  }
  if (typeof input !== 'string' || /[^\x00-\x7f]/u.test(input)) {
    return { status: 'malformed', network, message: 'Enter a complete public token identifier using ASCII characters. No match was established.' };
  }
  const parsed = parseWalletAddress(input);
  if (!parsed) return { status: 'malformed', network, message: 'This is not a complete supported token identifier. No match was established.' };
  if (parsed.chain !== network) {
    return { status: 'wrong-network', network, message: 'This identifier format does not fit the selected network. Check the network as well as the complete identifier.' };
  }
  const validated = validateRegistry(registry);
  if (!validated.ok) return { status: 'source-error', network, message: 'The Registry source could not be validated. No match was established.' };
  for (const asset of validated.registry.assets) {
    const representation = asset.representations.find((item) => item.chain === network);
    if (representation && sameAddress(representation, { ...representation, address: parsed.address })) {
      return {
        status: 'match', network, registryVersion: validated.registry.version,
        message: `${asset.displayName}: this identifier matches the selected network and representation in the published Registry.`,
        record: { sign: asset.sign, displayName: asset.displayName, representation },
      };
    }
  }
  return {
    status: 'not-found', network, registryVersion: validated.registry.version,
    message: 'Not found in the official Zodiacs.org registry for the selected network. This does not establish fraud or impersonation.',
  };
}

export type RegistryLoadResult = {
  status: 'ready'; registry: RegistryDocument; registrySha256: string; checkedAt: string;
} | { status: 'source-error' | 'source-changed'; message: string };

/** Every call makes a new, address-free request; a failure never falls back to a positive snapshot. */
export async function loadRegistry({
  expectedSha256, fetcher = globalThis.fetch, timeoutMs = 8_000, signal,
}: {
  expectedSha256: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<RegistryLoadResult> {
  const failure: RegistryLoadResult = {
    status: 'source-error',
    message: 'The Registry source could not be checked. No match was established. Try again when the source is available.',
  };
  if (!/^[0-9a-f]{64}$/u.test(expectedSha256) || signal?.aborted || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return failure;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectDeadline: (() => void) | undefined;
  const abort = () => { controller.abort(); rejectDeadline?.(); };
  const deadline = new Promise<never>((_resolve, reject) => {
    rejectDeadline = () => reject(new Error('Registry request ended'));
    timer = setTimeout(abort, timeoutMs);
  });
  signal?.addEventListener('abort', abort, { once: true });
  try {
    return await Promise.race([deadline, (async (): Promise<RegistryLoadResult> => {
      const response = await fetcher(REGISTRY_SOURCE_URL, {
        // Deployment protection may require its same-origin authentication cookie.
        // The request URL and body never contain the pasted identifier.
        cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: controller.signal,
      });
      if (!response.ok || response.redirected) return failure;
      const contentType = response.headers.get('content-type') ?? '';
      if (!/^application\/json(?:\s*;|$)/iu.test(contentType)) return failure;
      const limit = 256 * 1024;
      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > limit) return failure;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > limit || controller.signal.aborted) return failure;
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      const registrySha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
      if (registrySha256 !== expectedSha256) {
        return { status: 'source-changed', message: 'The Registry bytes differ from the source reviewed for this page. Refresh the page before checking again. No match was established.' };
      }
      const validated = validateRegistry(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
      if (!validated.ok || controller.signal.aborted) return failure;
      return { status: 'ready', registry: validated.registry, registrySha256, checkedAt: new Date().toISOString() };
    })()]);
  } catch {
    return failure;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
