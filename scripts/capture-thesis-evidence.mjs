/**
 * Capture the raw public data behind the /thesis/ evidence refresh (Linear
 * ZOD-33) into docs/thesis-evidence/<YYYY-MM-DD>/, so a stranger can see what
 * the maintainer saw. It writes captures only; turning them into the page's
 * evidence files is a maintainer-reviewed step, never part of a build.
 *
 *   node scripts/capture-thesis-evidence.mjs --probe     print the first public
 *        Solana RPC endpoint that answers getTokenLargestAccounts (or nothing)
 *   node scripts/capture-thesis-evidence.mjs [--date YYYY-MM-DD]
 *
 * Captures: per canonical mint, getTokenSupply / getAccountInfo /
 * getTokenLargestAccounts and the owner of each of the ten largest accounts
 * (to tell the trading pool apart); Dexscreener's token endpoint per mint; the
 * newest swap through each sign's reviewed pool (signatures and the logs that
 * show the swap); npm downloads for @zodiacs/sdk; the Wayback CDX query for
 * zodiacs.org. RPC_URL picks the endpoint; otherwise each candidate is tried.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const RPC_CANDIDATES = [
  process.env.RPC_URL,
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://solana.drpc.org',
  'https://endpoints.omniatech.io/v1/sol/mainnet/public',
  'https://solana.api.onfinality.io/public',
  'https://rpc.ankr.com/solana',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpcAt(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`${method}: HTTP ${res.status} ${text.slice(0, 120)}`); }
  if (!res.ok || json.error) throw new Error(`${method}: HTTP ${res.status} ${json.error?.message ?? ''}`.trim());
  return json.result;
}

export async function probe(mint) {
  const tried = [];
  for (const url of RPC_CANDIDATES) {
    try {
      await rpcAt(url, 'getTokenLargestAccounts', [mint, { commitment: 'finalized' }]);
      return { url, tried };
    } catch (error) {
      tried.push({ url, error: error.message });
    }
  }
  return { url: null, tried };
}

function makeRpc(url) {
  return async (method, params) => {
    let last;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt) await sleep(1500 * attempt);
      try {
        const result = await rpcAt(url, method, params);
        await sleep(250);
        return { ok: true, result };
      } catch (error) {
        last = error.message;
      }
    }
    return { ok: false, error: last };
  };
}

async function getJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'zodiacs.org thesis evidence capture' }, signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 2000); }
    return { url, status: res.status, fetchedAt: new Date().toISOString(), body };
  } catch (error) {
    return { url, status: null, fetchedAt: new Date().toISOString(), error: error.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const registry = JSON.parse(await readFile(resolve(root, 'public/registry/zodiacs.registry.json'), 'utf8'));
  const disclosure = JSON.parse(await readFile(resolve(root, 'public/thesis/thesis-disclosure.json'), 'utf8'));
  const signs = Object.keys(disclosure.signs);
  const mints = Object.fromEntries(registry.assets.map((asset) => [asset.sign, asset.native.address]));
  const pools = Object.fromEntries(signs.map((sign) => [sign, disclosure.signs[sign].liquidity.verifyUrl.split('/').pop()]));

  if (args.includes('--probe')) {
    const result = await probe(mints.leo);
    console.error(JSON.stringify(result.tried));
    if (result.url) console.log(result.url);
    return;
  }

  const di = args.indexOf('--date');
  const date = di >= 0 ? args[di + 1] : new Date().toISOString().slice(0, 10);
  const dir = resolve(root, 'docs/thesis-evidence', date);
  await mkdir(dir, { recursive: true });
  const save = (name, value) => writeFile(resolve(dir, name), `${JSON.stringify(value, null, 2)}\n`);

  const probed = await probe(mints.leo);
  await save('rpc-endpoint-probe.json', { capturedAt: new Date().toISOString(), chosen: probed.url, tried: probed.tried });
  const rpc = probed.url ? makeRpc(probed.url) : null;

  const chain = { capturedAt: new Date().toISOString(), endpoint: probed.url, signs: {} };
  const trades = { capturedAt: new Date().toISOString(), endpoint: probed.url, windowDays: 30, signs: {} };
  if (rpc) {
    for (const sign of signs) {
      const mint = mints[sign];
      const supply = await rpc('getTokenSupply', [mint, { commitment: 'finalized' }]);
      const accountInfo = await rpc('getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'finalized' }]);
      const largest = await rpc('getTokenLargestAccounts', [mint, { commitment: 'finalized' }]);
      const owners = {};
      if (largest.ok) {
        for (const row of largest.result.value.slice(0, 10)) {
          const info = await rpc('getAccountInfo', [row.address, { encoding: 'jsonParsed', commitment: 'finalized' }]);
          owners[row.address] = info.ok ? info.result?.value?.data?.parsed?.info?.owner ?? null : { error: info.error };
        }
      }
      chain.signs[sign] = { mint, pool: pools[sign], supply, accountInfo, largest, topTenOwners: owners };

      const signatures = await rpc('getSignaturesForAddress', [pools[sign], { limit: 25 }]);
      let latestSwap = null;
      const inspected = [];
      if (signatures.ok) {
        for (const entry of signatures.result) {
          if (entry.err || !entry.blockTime) continue;
          const tx = await rpc('getTransaction', [entry.signature, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'finalized' }]);
          const logs = tx.ok ? tx.result?.meta?.logMessages ?? [] : [];
          const swap = logs.some((line) => /Instruction: Swap/i.test(line));
          inspected.push({ signature: entry.signature, blockTime: entry.blockTime, swap, swapLogs: logs.filter((l) => /Instruction:/i.test(l)).slice(0, 6), error: tx.ok ? undefined : tx.error });
          if (swap) { latestSwap = { signature: entry.signature, date: new Date(entry.blockTime * 1000).toISOString() }; break; }
        }
      }
      trades.signs[sign] = { pool: pools[sign], latestSwap, signatures: signatures.ok ? signatures.result.slice(0, 25) : { error: signatures.error }, inspected };
      console.log(`${sign}: largest ${largest.ok ? 'ok' : largest.error}; latest swap ${latestSwap?.date ?? 'none found'}`);
    }
  }
  await save('solana-rpc.json', chain);
  await save('pool-trades.json', trades);

  const dex = { capturedAt: new Date().toISOString(), signs: {} };
  for (const sign of signs) {
    dex.signs[sign] = await getJson(`https://api.dexscreener.com/latest/dex/tokens/${mints[sign]}`);
    await sleep(400);
  }
  await save('dexscreener.json', dex);
  await save('npm-downloads.json', {
    lastMonth: await getJson('https://api.npmjs.org/downloads/point/last-month/@zodiacs/sdk'),
    registry: await getJson('https://registry.npmjs.org/@zodiacs/sdk'),
  });
  await save('wayback-cdx.json', await getJson('https://web.archive.org/cdx/search/cdx?url=zodiacs.org&output=json&fl=timestamp,statuscode&filter=statuscode:200&collapse=timestamp:8&from=20240101'));
  console.log(`captured into ${dir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
