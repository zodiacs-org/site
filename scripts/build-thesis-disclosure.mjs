/**
 * Manually hydrate the mechanically readable fields in the /thesis disclosure.
 *
 * This tool is intentionally not part of the build: publishing fresh onchain
 * figures is a maintainer-reviewed action. It reads the twelve canonical native
 * Solana mints from the registry, applies the separately reviewed prose source,
 * preserves every mechanical field it cannot verify, and writes one reviewable
 * JSON diff.
 *
 * Use --reviewed-only to publish a reviewed prose correction without touching
 * the older on-chain snapshot fields or making RPC requests.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const DEFAULT_SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
export const DEFAULT_RPC_DELAY_MS = 300;
export const DEFAULT_RPC_RETRIES = 2;
export const DEFAULT_RPC_RETRY_DELAY_MS = 1_000;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = resolve(root, 'public/registry/zodiacs.registry.json');
const disclosurePath = resolve(root, 'public/thesis/thesis-disclosure.json');
const reviewedPath = resolve(root, 'scripts/thesis-disclosure-reviewed.json');
const MECHANICAL_FIELDS = [
  'supply', 'mintAuthority', 'freezeAuthority', 'topTenHolders',
];
const PROSE_FIELDS = ['liquidity', 'bridge', 'treasury', 'continuity'];

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function assertAsOf(asOf) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    throw new RangeError(`Invalid --as-of date: ${asOf}`);
  }
  const parsed = new Date(`${asOf}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== asOf) {
    throw new RangeError(`Invalid --as-of date: ${asOf}`);
  }
}

function nonnegativeBigInt(value, label) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new TypeError(`${label} must be a non-negative integer string`);
  }
  return BigInt(value);
}

function validDecimals(value, expected, label) {
  if (!Number.isInteger(value) || value < 0 || value !== expected) {
    throw new TypeError(`${label} decimals ${String(value)} do not match registry decimals ${expected}`);
  }
}

/** Add thousands separators without coercing a token amount to Number. */
export function formatUiAmountString(value) {
  if (typeof value !== 'string') throw new TypeError('uiAmountString must be a string');
  const match = value.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) throw new TypeError(`Invalid uiAmountString: ${value}`);
  const integer = match[1].replace(/^0+(?=\d)/, '');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return match[2] === undefined ? grouped : `${grouped}.${match[2]}`;
}

/** Render one raw integer amount at its declared precision. */
export function formatRawTokenAmount(amount, decimals) {
  if (typeof amount !== 'bigint' || amount < 0n) {
    throw new TypeError('Raw token amount must be a non-negative bigint');
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new TypeError('Token decimals must be a non-negative integer');
  }
  if (decimals === 0) return formatUiAmountString(amount.toString());

  const padded = amount.toString().padStart(decimals + 1, '0');
  const integer = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return formatUiAmountString(fraction ? `${integer}.${fraction}` : integer);
}

/** One-decimal percentage, rounded half-up with integer arithmetic. */
export function percentageTenths(part, total) {
  if (typeof part !== 'bigint' || typeof total !== 'bigint' || part < 0n || total <= 0n) {
    throw new TypeError('Percentage inputs must be non-negative bigint values with a positive total');
  }
  if (part > total) throw new RangeError('Percentage part cannot exceed total');
  return (part * 1000n + total / 2n) / total;
}

export function formatPercentageTenths(tenths) {
  if (typeof tenths !== 'bigint' || tenths < 0n) {
    throw new TypeError('Percentage tenths must be a non-negative bigint');
  }
  return `${tenths / 10n}.${tenths % 10n}%`;
}

/** Sum raw token amounts exactly, normalizing differing decimal scales. */
export function sumTokenAmounts(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RangeError('At least one token amount is required');
  }
  for (const value of values) {
    if (typeof value.amount !== 'bigint' || value.amount < 0n) {
      throw new TypeError('Token amount must be a non-negative bigint');
    }
    if (!Number.isInteger(value.decimals) || value.decimals < 0) {
      throw new TypeError('Token decimals must be non-negative integers');
    }
  }
  const decimals = Math.max(...values.map((value) => value.decimals));
  let amount = 0n;
  for (const value of values) {
    amount += value.amount * (10n ** BigInt(decimals - value.decimals));
  }
  return { amount, decimals };
}

export function canonicalNativeAssets(registry) {
  if (!Array.isArray(registry?.assets) || registry.assets.length !== 12) {
    throw new Error(`Registry must contain exactly 12 assets; found ${registry?.assets?.length ?? 0}`);
  }
  const signs = new Set();
  const mints = new Set();
  return registry.assets.map((asset) => {
    const sign = asset?.sign;
    const native = asset?.native;
    if (typeof sign !== 'string' || !sign) throw new Error('Registry asset is missing sign');
    if (signs.has(sign)) throw new Error(`Registry contains duplicate sign: ${sign}`);
    if (native?.chain !== 'solana' || native?.tokenStandard !== 'SPL') {
      throw new Error(`Registry native record is not a Solana SPL mint: ${sign}`);
    }
    if (typeof native.address !== 'string' || !native.address) {
      throw new Error(`Registry native mint is missing: ${sign}`);
    }
    if (!Number.isInteger(native.decimals) || native.decimals < 0) {
      throw new Error(`Registry native decimals are invalid: ${sign}`);
    }
    if (mints.has(native.address)) throw new Error(`Registry contains duplicate native mint: ${native.address}`);
    signs.add(sign);
    mints.add(native.address);
    return { sign, mint: native.address, decimals: native.decimals };
  });
}

function parseSupply(result, expectedDecimals) {
  const value = result?.value;
  validDecimals(value?.decimals, expectedDecimals, 'Supply');
  const amount = nonnegativeBigInt(value?.amount, 'Supply amount');
  const uiAmountString = formatUiAmountString(value?.uiAmountString);
  return { amount, decimals: expectedDecimals, value: `${uiAmountString} total` };
}

function parseMintInfo(result, expectedDecimals) {
  const parsed = result?.value?.data?.parsed;
  if (parsed?.type !== 'mint' || !parsed.info || typeof parsed.info !== 'object') {
    throw new TypeError('Account info is not a parsed mint');
  }
  validDecimals(parsed.info.decimals, expectedDecimals, 'Mint account');
  return parsed.info;
}

function parseAuthority(info, key) {
  if (!hasOwn(info, key)) throw new TypeError(`Mint account is missing ${key}`);
  const authority = info[key];
  if (authority === null) return { value: 'renounced', renounced: true };
  if (typeof authority === 'string' && authority) return { value: authority, renounced: false };
  throw new TypeError(`Mint account has invalid ${key}`);
}

function parseTopTen(result, supply, expectedDecimals) {
  const accounts = result?.value;
  if (!Array.isArray(accounts) || accounts.length < 10) {
    throw new TypeError(`Largest-accounts response has ${accounts?.length ?? 0} accounts; need 10`);
  }
  let sum = 0n;
  for (const [index, account] of accounts.slice(0, 10).entries()) {
    validDecimals(account?.decimals, expectedDecimals, `Largest account ${index + 1}`);
    sum += nonnegativeBigInt(account?.amount, `Largest account ${index + 1} amount`);
  }
  const tenths = percentageTenths(sum, supply.amount);
  return {
    tenths,
    value: `${formatPercentageTenths(tenths)} · top-10 token accounts`,
  };
}

function freshField(value, asOf, verifyUrl) {
  return { value, status: 'filled', asOf, verifyUrl };
}

function pendingField() {
  return { value: null, status: 'pending', asOf: null, verifyUrl: null };
}

function reviewedField(definition, fallbackAsOf, path) {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError(`Reviewed source is missing ${path}`);
  }
  if (typeof definition.value !== 'string' || !definition.value) {
    throw new TypeError(`Reviewed source ${path}.value must be a non-empty string`);
  }
  if (typeof definition.verifyUrl !== 'string' || !definition.verifyUrl) {
    throw new TypeError(`Reviewed source ${path}.verifyUrl must be a non-empty string`);
  }
  let url;
  try {
    url = new URL(definition.verifyUrl);
  } catch {
    throw new TypeError(`Reviewed source ${path}.verifyUrl must be an absolute URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TypeError(`Reviewed source ${path}.verifyUrl must use HTTP or HTTPS`);
  }
  const asOf = definition.asOf ?? fallbackAsOf;
  assertAsOf(asOf);
  return freshField(definition.value, asOf, definition.verifyUrl);
}

function validateDisclosure(disclosure, assets) {
  if (!disclosure?.signs || !disclosure?.aggregate) {
    throw new Error('Disclosure must contain signs and aggregate rows');
  }
  for (const { sign } of assets) {
    const row = disclosure.signs[sign];
    if (!row) throw new Error(`Disclosure is missing sign row: ${sign}`);
    for (const field of [...MECHANICAL_FIELDS, ...PROSE_FIELDS]) {
      if (!row[field] || typeof row[field] !== 'object') {
        throw new Error(`Disclosure is missing signs.${sign}.${field}`);
      }
    }
  }
  for (const field of [...MECHANICAL_FIELDS, ...PROSE_FIELDS]) {
    if (!disclosure.aggregate[field] || typeof disclosure.aggregate[field] !== 'object') {
      throw new Error(`Disclosure is missing aggregate.${field}`);
    }
  }
}

/**
 * Materialize the manually researched prose source into the disclosure contract.
 * Treasury may remain explicitly pending with a reviewed reason, or be filled
 * only when every sign and the aggregate have stranger-checkable definitions.
 */
export function hydrateReviewedProse(existing, assets, source) {
  assertAsOf(source?.asOf);
  if (!Array.isArray(assets) || assets.length === 0) {
    throw new RangeError('At least one asset is required');
  }
  validateDisclosure(existing, assets);
  const treasuryStatus = source?.treasury?.status;
  if (treasuryStatus === 'pending') {
    if (typeof source.treasury.reason !== 'string' || !source.treasury.reason) {
      throw new TypeError('Reviewed source pending treasury must record a non-empty reason');
    }
  } else if (treasuryStatus !== 'filled') {
    throw new TypeError('Reviewed source treasury.status must be pending or filled');
  }

  const disclosure = cloneJson(existing);
  const report = [];
  const fill = (path, row, field, definition) => {
    row[field] = reviewedField(definition, source.asOf, path);
    report.push({ path, status: 'filled', value: row[field].value });
  };
  const materializeTreasury = (path, row, definition, expectedVerifyUrl = null) => {
    if (treasuryStatus === 'filled') {
      if (expectedVerifyUrl !== null && definition?.verifyUrl !== expectedVerifyUrl) {
        throw new TypeError(
          `Reviewed source ${path}.verifyUrl must be the canonical Solscan mint holders URL`,
        );
      }
      fill(path, row, 'treasury', definition);
      return;
    }
    row.treasury = pendingField();
    report.push({ path, status: 'pending', reason: source.treasury.reason });
  };

  for (const { sign, mint } of assets) {
    const sourceRow = source.signs?.[sign];
    if (!sourceRow || typeof sourceRow !== 'object') {
      throw new TypeError(`Reviewed source is missing signs.${sign}`);
    }
    const row = disclosure.signs[sign];
    fill(`signs.${sign}.liquidity`, row, 'liquidity', sourceRow.liquidity);
    fill(`signs.${sign}.bridge`, row, 'bridge', sourceRow.bridge);
    materializeTreasury(
      `signs.${sign}.treasury`,
      row,
      source.treasury.signs?.[sign],
      `https://solscan.io/token/${mint}#holders`,
    );
    fill(`signs.${sign}.continuity`, row, 'continuity', source.continuity);
  }

  fill('aggregate.liquidity', disclosure.aggregate, 'liquidity', source.aggregate?.liquidity);
  fill('aggregate.bridge', disclosure.aggregate, 'bridge', source.aggregate?.bridge);
  materializeTreasury(
    'aggregate.treasury',
    disclosure.aggregate,
    source.treasury.aggregate,
  );
  fill('aggregate.continuity', disclosure.aggregate, 'continuity', source.continuity);

  return { disclosure, report };
}

/**
 * Pure merge from captured RPC payloads into the disclosure contract.
 * Missing or malformed inputs preserve the corresponding prior field object.
 */
export function hydrateDisclosure(existing, assets, outcomes, asOf) {
  assertAsOf(asOf);
  if (!Array.isArray(assets) || assets.length === 0) throw new RangeError('At least one asset is required');
  validateDisclosure(existing, assets);
  const disclosure = cloneJson(existing);
  const report = [];
  const fresh = {
    supply: new Map(),
    mintAuthority: new Map(),
    freezeAuthority: new Map(),
    topTenHolders: new Map(),
  };

  const fill = (path, row, field, value, verifyUrl) => {
    row[field] = freshField(value, asOf, verifyUrl);
    report.push({ path, status: 'filled', value });
  };
  const skip = (path, reason) => report.push({ path, status: 'skipped', reason });

  for (const asset of assets) {
    const row = disclosure.signs[asset.sign];
    const outcome = outcomes?.[asset.sign] ?? {};
    const verifyUrl = `https://solscan.io/token/${asset.mint}`;
    let parsedSupply;

    const supplyPath = `signs.${asset.sign}.supply`;
    if (outcome.supply?.ok) {
      try {
        parsedSupply = parseSupply(outcome.supply.result, asset.decimals);
        fill(supplyPath, row, 'supply', parsedSupply.value, verifyUrl);
        fresh.supply.set(asset.sign, parsedSupply);
      } catch (error) {
        skip(supplyPath, `invalid getTokenSupply payload: ${errorMessage(error)}`);
      }
    } else {
      skip(supplyPath, outcome.supply?.error ?? 'getTokenSupply did not return a result');
    }

    let mintInfo;
    let mintInfoError;
    if (outcome.accountInfo?.ok) {
      try {
        mintInfo = parseMintInfo(outcome.accountInfo.result, asset.decimals);
      } catch (error) {
        mintInfoError = `invalid getAccountInfo payload: ${errorMessage(error)}`;
      }
    } else {
      mintInfoError = outcome.accountInfo?.error ?? 'getAccountInfo did not return a result';
    }

    for (const [field, key] of [
      ['mintAuthority', 'mintAuthority'],
      ['freezeAuthority', 'freezeAuthority'],
    ]) {
      const path = `signs.${asset.sign}.${field}`;
      if (mintInfo) {
        try {
          const authority = parseAuthority(mintInfo, key);
          fill(path, row, field, authority.value, verifyUrl);
          fresh[field].set(asset.sign, authority);
        } catch (error) {
          skip(path, `invalid getAccountInfo payload: ${errorMessage(error)}`);
        }
      } else {
        skip(path, mintInfoError);
      }
    }

    const topTenPath = `signs.${asset.sign}.topTenHolders`;
    if (!parsedSupply) {
      skip(topTenPath, 'current getTokenSupply result is required');
    } else if (!outcome.largestAccounts?.ok) {
      skip(topTenPath, outcome.largestAccounts?.error ?? 'getTokenLargestAccounts did not return a result');
    } else {
      try {
        const topTen = parseTopTen(outcome.largestAccounts.result, parsedSupply, asset.decimals);
        fill(topTenPath, row, 'topTenHolders', topTen.value, verifyUrl);
        fresh.topTenHolders.set(asset.sign, topTen);
      } catch (error) {
        skip(topTenPath, `invalid getTokenLargestAccounts payload: ${errorMessage(error)}`);
      }
    }
  }

  const aggregate = disclosure.aggregate;
  const expected = assets.length;
  const aggregateFill = (field, value) => {
    aggregate[field] = freshField(value, asOf, null);
    report.push({ path: `aggregate.${field}`, status: 'filled', value });
  };
  const aggregateSkip = (field, count) => {
    report.push({
      path: `aggregate.${field}`,
      status: 'skipped',
      reason: `${count} of ${expected} current sign values available`,
    });
  };

  if (fresh.supply.size === expected) {
    const total = sumTokenAmounts(assets.map((asset) => fresh.supply.get(asset.sign)));
    aggregateFill('supply', `${formatRawTokenAmount(total.amount, total.decimals)} total`);
  } else aggregateSkip('supply', fresh.supply.size);

  for (const field of ['mintAuthority', 'freezeAuthority']) {
    if (fresh[field].size === expected) {
      const renounced = [...fresh[field].values()].filter((value) => value.renounced).length;
      aggregateFill(field, `${renounced} of ${expected} renounced`);
    } else aggregateSkip(field, fresh[field].size);
  }

  if (fresh.topTenHolders.size === expected) {
    const values = [...fresh.topTenHolders.values()].map((value) => value.tenths);
    const lowest = values.reduce((a, b) => a < b ? a : b);
    const highest = values.reduce((a, b) => a > b ? a : b);
    aggregateFill(
      'topTenHolders',
      `lowest ${formatPercentageTenths(lowest)} – highest ${formatPercentageTenths(highest)}`,
    );
  } else aggregateSkip('topTenHolders', fresh.topTenHolders.size);

  return { disclosure, report };
}

async function rpcRequest(url, method, params, id) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const wrapped = new Error(`${method}: ${errorMessage(error)}`, { cause: error });
    wrapped.retryable = true;
    throw wrapped;
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    const error = new Error(`${method}: HTTP ${response.status} returned invalid JSON`);
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`${method}: HTTP ${response.status}${payload?.error?.message ? ` — ${payload.error.message}` : ''}`);
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }
  if (payload?.error) {
    const error = new Error(`${method}: RPC ${payload.error.code ?? 'error'} — ${payload.error.message ?? 'unknown error'}`);
    error.retryable = Number(payload.error.code) <= -32000
      && Number(payload.error.code) >= -32099;
    throw error;
  }
  if (!hasOwn(payload ?? {}, 'result')) throw new Error(`${method}: response is missing result`);
  return payload.result;
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

export async function collectRpcOutcomes(
  assets,
  {
    url = DEFAULT_SOLANA_RPC_URL,
    delayMs = DEFAULT_RPC_DELAY_MS,
    retries = DEFAULT_RPC_RETRIES,
    retryDelayMs = DEFAULT_RPC_RETRY_DELAY_MS,
  } = {},
) {
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new RangeError('RPC delay must be non-negative');
  if (!Number.isInteger(retries) || retries < 0) throw new RangeError('RPC retries must be a non-negative integer');
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
    throw new RangeError('RPC retry delay must be non-negative');
  }
  const outcomes = {};
  let id = 0;
  let requests = 0;

  const capture = async (method, params) => {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (requests > 0 && delayMs > 0) await sleep(delayMs);
      if (attempt > 0 && retryDelayMs > 0) await sleep(retryDelayMs * attempt);
      requests += 1;
      try {
        id += 1;
        return { ok: true, result: await rpcRequest(url, method, params, id) };
      } catch (error) {
        const canRetry = error?.retryable === true && attempt < retries;
        if (!canRetry) return { ok: false, error: errorMessage(error) };
        console.warn(`retrying ${method} after attempt ${attempt + 1}: ${errorMessage(error)}`);
      }
    }
    throw new Error(`Unreachable retry state for ${method}`);
  };

  for (const asset of assets) {
    outcomes[asset.sign] = {
      supply: await capture('getTokenSupply', [asset.mint, { commitment: 'finalized' }]),
      accountInfo: await capture('getAccountInfo', [
        asset.mint,
        { encoding: 'jsonParsed', commitment: 'finalized' },
      ]),
      largestAccounts: await capture('getTokenLargestAccounts', [
        asset.mint,
        { commitment: 'finalized' },
      ]),
    };
  }
  return outcomes;
}

function printReport(report) {
  for (const entry of report) {
    if (entry.status === 'filled') console.log(`filled  ${entry.path}: ${entry.value}`);
    else if (entry.status === 'pending') console.warn(`pending ${entry.path}: ${entry.reason}`);
    else console.warn(`skipped ${entry.path}: ${entry.reason}`);
  }
  const filled = report.filter((entry) => entry.status === 'filled').length;
  const pending = report.filter((entry) => entry.status === 'pending').length;
  const skipped = report.filter((entry) => entry.status === 'skipped').length;
  console.log(`report: ${filled} filled, ${pending} pending, ${skipped} skipped`);
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'as-of': { type: 'string' },
      'reviewed-only': { type: 'boolean' },
    },
    strict: true,
  });
  const asOf = values['as-of'] ?? new Date().toISOString().slice(0, 10);
  assertAsOf(asOf);
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const existing = JSON.parse(await readFile(disclosurePath, 'utf8'));
  const reviewed = JSON.parse(await readFile(reviewedPath, 'utf8'));
  const assets = canonicalNativeAssets(registry);
  const reviewedResult = hydrateReviewedProse(existing, assets, reviewed);
  if (values['reviewed-only']) {
    await writeFile(
      disclosurePath,
      `${JSON.stringify(reviewedResult.disclosure, null, 2)}\n`,
      'utf8',
    );
    printReport(reviewedResult.report);
    return;
  }
  const outcomes = await collectRpcOutcomes(assets, {
    url: process.env.SOLANA_RPC_URL ?? DEFAULT_SOLANA_RPC_URL,
    // Public endpoints cap the heavier calls per method; the pacing is
    // tunable per run without changing the committed defaults.
    delayMs: process.env.SOLANA_RPC_DELAY_MS ? Number(process.env.SOLANA_RPC_DELAY_MS) : undefined,
    retries: process.env.SOLANA_RPC_RETRIES ? Number(process.env.SOLANA_RPC_RETRIES) : undefined,
    retryDelayMs: process.env.SOLANA_RPC_RETRY_DELAY_MS
      ? Number(process.env.SOLANA_RPC_RETRY_DELAY_MS)
      : undefined,
  });
  const { disclosure, report } = hydrateDisclosure(
    reviewedResult.disclosure,
    assets,
    outcomes,
    asOf,
  );
  await writeFile(disclosurePath, `${JSON.stringify(disclosure, null, 2)}\n`, 'utf8');
  printReport([...reviewedResult.report, ...report]);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await main();
