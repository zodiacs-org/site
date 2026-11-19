/**
 * The L1 arbiter's Horizons request at engine commit 709bc81:
 * format=text, COMMAND=NAIF target, OBJ_DATA=NO, MAKE_EPHEM=YES, EPHEM_TYPE=OBSERVER, CENTER=500@399,
 * QUANTITIES=31, APPARENT=AIRLESS, TIME_TYPE=TT, TLIST_TYPE=JD,
 * TLIST=space separated jd_tt values to 8 decimal places,
 * ANG_FORMAT=DEG, EXTRA_PREC=YES, CSV_FORMAT=YES.
 * The Sun, Moon, Mercury and Venus are targets 10, 301, 199, 299.
 * Mars through Pluto use their DE441 system barycentres, targets 4 to 9.
 * See conformance/arbiters/l1/build.py at the pinned commit in suite/source.json.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = fileURLToPath(new URL('../src/data/accuracy/', import.meta.url));
export const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const USER_AGENT = 'zodiacs.org accuracy receipt (admin@zodiacs.org)';
export const BODIES = [
  ['Sun', 10, 'Sun'], ['Moon', 301, 'Moon'], ['Mercury', 199, 'Mercury'],
  ['Venus', 299, 'Venus'], ['Mars', 4, 'MarsBary'], ['Jupiter', 5, 'JupiterBary'],
  ['Saturn', 6, 'SaturnBary'], ['Uranus', 7, 'UranusBary'], ['Neptune', 8, 'NeptuneBary'],
  ['Pluto', 9, 'PlutoBary'],
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DATE_LABEL = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'long', timeZone: 'UTC',
});
const UNIX_EPOCH_JD = 2440587.5;
const DAY_MS = 86400000;
const CUTOFF = '2026-09-22';
const LIMIT = 1;
const MAX_REQUESTS = 40;
const SUITE_CHECKSUMS = 'SHA256SUMS';
const ROLLING_CHECKSUMS = 'SHA256SUMS.txt';
const AUDIT_ROOT = join(process.env.RUNNER_TEMP ?? tmpdir(), 'zodiacs-accuracy-audit');
const SOURCES = join(ROOT, 'suite');
const CHECKSUM_LINE = /^([a-f0-9]{64})  ([\w.-]+\.txt)$/u;

const dateOfJd = (jd) => new Date(Math.round((jd - UNIX_EPOCH_JD) * DAY_MS));
const jdOfDate = (date) => Number(date) / DAY_MS + UNIX_EPOCH_JD;
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function maybeRead(path, reader = readFile) {
  try {
    return await reader(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return null;
  }
}

async function writeAtomic(path, contents) {
  const temp = `${path}.tmp`;
  await writeFile(temp, contents);
  await rename(temp, path);
}

export function horizonsUrl(naif, instants) {
  const url = new URL(HORIZONS);
  url.searchParams.set('format', 'text');
  for (const [key, value] of Object.entries({
    COMMAND: naif, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'OBSERVER', CENTER: '500@399', QUANTITIES: '31',
    APPARENT: 'AIRLESS', TIME_TYPE: 'TT', TLIST_TYPE: 'JD',
    TLIST: instants.map(({ jdTt }) => jdTt.toFixed(8)).join(' '),
    ANG_FORMAT: 'DEG', EXTRA_PREC: 'YES', CSV_FORMAT: 'YES',
  })) {
    url.searchParams.set(key, `'${value}'`);
  }
  return url;
}

function instant(jdTt) {
  const date = dateOfJd(jdTt);
  return {
    jdTt,
    date: date.toISOString().slice(0, 10),
    label: `${DATE_LABEL.format(date)}, ${date.toISOString().slice(11, 23)} TT`,
  };
}

export function rollingInstants(date) {
  return Array.from({ length: 12 }, (_, index) => instant(jdOfDate(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + index + 1, 1)),
  )));
}

export function parseHorizons(text, naif, instants) {
  assert(/^API SOURCE:\s*NASA\/JPL Horizons API\s*$/mu.test(text), 'Missing NASA JPL Horizons banner');
  assert(new RegExp(`^Target body name:\\s*[^\\n]+\\(${naif}\\)\\s*\\{source: DE441\\}\\s*$`, 'mu').test(text),
    `Expected Horizons target ${naif} from DE441`);
  assert(/^Center body name:\s*Earth \(399\)\s*\{source: DE441\}\s*$/mu.test(text)
    && /^Center-site name:\s*GEOCENTRIC\s*$/mu.test(text)
    && /^Atmos refraction:\s*NO \(AIRLESS\)\s*$/mu.test(text), 'Expected airless geocentric Horizons positions');
  assert(/^\s*Date__\(TT\)__HR:MN:SC\.fff,\s*,\s*,\s*ObsEcLon,\s*ObsEcLat,\s*$/mu.test(text),
    'Expected the TT CSV table for Horizons quantity 31');
  assert(text.includes('IAU76/80'), 'Expected the Horizons IAU76/80 frame');
  const block = /^\$\$SOE\r?\n([\s\S]*?)^\$\$EOE\s*$/mu.exec(text);
  assert(block, 'Missing Horizons position rows');
  const rows = block[1].trim().split(/\r?\n/u);
  assert(rows.length === instants.length, `Expected ${instants.length} Horizons rows, got ${rows.length}`);
  return rows.map((row, index) => {
    const [when, , , longitude, latitude, end, ...extra] = row.split(',').map((part) => part.trim());
    const parts = /^(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}:\d{2}:\d{2}\.\d{3})$/u.exec(when);
    assert(parts && end === '' && extra.length === 0 && longitude && latitude, `Invalid Horizons row: ${row}`);
    const [, year, month, day, clock] = parts;
    const iso = `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, '0')}-${day}T${clock}Z`;
    const requestedMs = (Number(instants[index].jdTt.toFixed(8)) - UNIX_EPOCH_JD) * DAY_MS;
    assert(Math.abs(Date.parse(iso) - requestedMs) <= 0.6, `Unexpected Horizons TT: ${when}`);
    const lon = Number(longitude);
    const lat = Number(latitude);
    assert(lon >= 0 && lon < 360 && Math.abs(lat) <= 90, `Invalid Horizons angles: ${row}`);
    return { lon, lat };
  });
}

export function difference(engine, horizons) {
  let lon = engine.lon - horizons.lon;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return { lon: lon * 3600, lat: (engine.lat - horizons.lat) * 3600 };
}

function magnitude({ lon, lat }) {
  return Math.max(Math.abs(lon), Math.abs(lat));
}

function position(body, at, engine, horizons) {
  assert(engine?.lon >= 0 && engine.lon < 360 && Math.abs(engine.lat) <= 90, `Invalid engine position for ${body} at ${at.label}`);
  const delta = difference(engine, horizons);
  const stored = { lon: Number(delta.lon.toFixed(10)), lat: Number(delta.lat.toFixed(10)) };
  return { body, ...at, engine, horizons, difference: stored };
}

async function readPinnedSource() {
  const source = await readJson(join(SOURCES, 'source.json'));
  const offsets = await readFile(join(SOURCES, 'frame-offsets.json'));
  assert(sha256(offsets) === source.files['frame-offsets.json'], 'Suite SHA-256 mismatch: frame-offsets.json');
  return { source, offsets };
}

async function loadPinnedSuite(audit) {
  const directory = join(audit, 'inputs');
  await mkdir(directory);
  try {
    const { source, offsets } = await readPinnedSource();
    const base = `${source.repository.replace('https://github.com/', 'https://raw.githubusercontent.com/')}/${source.commit}/conformance`;
    await writeFile(join(directory, 'source.json'), json(source));
    await writeFile(join(directory, 'frame-offsets.json'), offsets);
    for (const [file, hash] of Object.entries(source.files)) {
      if (file === 'frame-offsets.json') continue;
      const path = file === 'L1-positions.json' ? 'vectors/0.2.0' : 'sources/horizons-24';
      const url = `${base}/${path}/${file}`;
      const response = await fetch(url, { cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(60000) });
      assert(response.ok, `Suite source returned HTTP ${response.status}: ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert(sha256(bytes) === hash, `Suite SHA-256 mismatch: ${file}`);
      await writeFile(join(directory, file), bytes);
    }
    return await loadSuite(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

// The pinned inputs use a clock the site removed from the tree. The site
// receipt identifies those cases by date and id. The audit keeps exact TT.
function suiteDate({ id, date }) {
  return { id, date, label: DATE_LABEL.format(new Date(date)) };
}

export async function loadSuite(directory) {
  const source = await readJson(join(directory, 'source.json'));
  const document = await readJson(join(directory, 'L1-positions.json'));
  const arbiter = document.arbiters['horizons-de441-iau2006'];
  const expectedInputs = new Map(arbiter.inputs.map(({ path, sha256: hash }) => [path.split('/').at(-1), hash]));
  assert(Object.keys(source.files).length === expectedInputs.size + 1, 'Incomplete suite hash manifest');
  const files = new Map();
  for (const [file, hash] of Object.entries(source.files)) {
    const bytes = await readFile(join(directory, file));
    assert(sha256(bytes) === hash && (file === 'L1-positions.json' || expectedInputs.get(file) === hash),
      `Suite SHA-256 mismatch: ${file}`);
    files.set(file, bytes.toString());
  }
  const instants = JSON.parse(files.get('corpus-tt.json')).cases.map(({ id, jdTt }) => ({ id, ...instant(jdTt) }));
  const offsets = JSON.parse(files.get('frame-offsets.json')).instants;
  const recorded = new Map(BODIES.map(([body, naif, file]) => [
    body, parseHorizons(files.get(`${file}.txt`), naif, instants),
  ]));
  assert(instants.length === 24 && document.vectors.length === instants.length * BODIES.length
    && offsets.length === instants.length && offsets.every(({ id }, index) => id === instants[index].id),
  'Suite vectors, dates and frame offsets disagree');
  const vectors = document.vectors.map(({ input, expected }, index) => {
    const at = instants[Math.floor(index / BODIES.length)];
    assert(at.jdTt === input.jd_tt && BODIES[index % BODIES.length][0] === input.body, 'Suite vector order changed');
    return { body: input.body, at, expected };
  });
  return { source, instants, offsets, recorded, vectors, files };
}

export function selfCheck(suite, fresh) {
  const historical = { through: CUTOFF, tolerance: 0.001, total: 0, largest: 0 };
  const later = { after: CUTOFF, tolerance: 0.01, total: 0, largest: 0 };
  for (const [body, recorded] of suite.recorded) {
    const rows = fresh.get(body);
    assert(rows?.length === recorded.length, `Missing NASA self check for ${body}`);
    recorded.forEach((value, index) => {
      const { date, label } = suite.instants[index];
      const group = date <= CUTOFF ? historical : later;
      const delta = magnitude(difference(rows[index], value));
      assert(Number.isFinite(delta) && delta <= group.tolerance,
        `NASA self check failed for ${body}, ${label}: ${delta}″ exceeds ${group.tolerance}″`);
      group.total++;
      group.largest = Math.max(group.largest, delta);
    });
  }
  return { total: historical.total + later.total, historical, later };
}

export function summarize(positions, threshold) {
  return {
    total: positions.length,
    within: positions.filter((row) => magnitude(row.difference) <= threshold).length,
    largest: Math.max(...positions.map((row) => magnitude(row.difference))),
  };
}

export function buildReceipt({ suite, rolling, answers, nasaCheck, date, engine, raw, auditUrl }) {
  const charts = new Map();
  const ephemerides = new Map();
  function enginePosition(body, at) {
    if (!charts.has(at.jdTt)) {
      const chart = engine.natalChart({ utc: dateOfJd(at.jdTt), timeScale: 'tt', timeKnown: false });
      const ephemeris = chart.ephemeris ?? engine.EPHEMERIS;
      assert(ephemeris?.name && ephemeris.version, 'Missing engine ephemeris metadata');
      ephemerides.set(JSON.stringify(ephemeris), ephemeris);
      charts.set(at.jdTt, chart.bodies);
    }
    const { lon, lat } = charts.get(at.jdTt).find((row) => row.body === body) ?? {};
    return { lon, lat };
  }
  const suitePositions = suite.vectors.map(({ body, at, expected }) =>
    position(body, suiteDate(at), enginePosition(body, at), expected));
  const rollingPositions = rolling.flatMap((at, index) => BODIES.map(([body]) =>
    position(body, at, enginePosition(body, at), answers.get(body)[index])));
  const today = jdOfDate(date);
  const nearest = suite.instants.reduce((best, at, index) =>
    Math.abs(at.jdTt - today) < Math.abs(suite.instants[best].jdTt - today) ? index : best, 0);
  return {
    date: date.toISOString().slice(0, 10),
    label: DATE_LABEL.format(date),
    checkedAt: date.toISOString(),
    ...(auditUrl ? { auditUrl } : {}),
    source: { repository: suite.source.repository, commit: suite.source.commit, horizons: HORIZONS, ephemeris: 'DE441' },
    engine: { version: engine.ENGINE_VERSION, ephemerides: [...ephemerides.values()] },
    threshold: LIMIT,
    checksumAlgorithm: 'SHA256',
    frames: { suite: 'IAU 2006/2000A', rolling: 'IAU 1976/1980' },
    frameDifference: { ...suiteDate(suite.instants[nearest]), arcsec: suite.offsets[nearest].frameTermMeanArcsec },
    nasaCheck,
    sets: {
      suite: { ...summarize(suitePositions, LIMIT), positions: suitePositions },
      rolling: { ...summarize(rollingPositions, LIMIT), positions: rollingPositions },
    },
    bodies: BODIES.map(([body]) => ({
      body,
      suite: summarize(suitePositions.filter((row) => row.body === body), LIMIT),
      rolling: summarize(rollingPositions.filter((row) => row.body === body), LIMIT),
    })),
    raw,
  };
}

function historyRow({ date, label, checkedAt, engine, sets }) {
  const { positions: suitePositions, ...suite } = sets.suite;
  const { positions: rollingPositions, ...rolling } = sets.rolling;
  return { date, label, checkedAt, engine, suite, rolling };
}

function checkHistory(latest, history) {
  assert(Array.isArray(history) && (latest ? json(history.at(-1)) === json(historyRow(latest)) : !history.length),
    'Accuracy latest.json and history.json do not agree');
}

async function readChecksums(directory, checksumFile) {
  const manifest = await maybeRead(join(directory, checksumFile));
  const entries = new Map();
  for (const line of (manifest?.toString().trimEnd() ?? '').split('\n').filter(Boolean)) {
    const match = CHECKSUM_LINE.exec(line);
    assert(match && !entries.has(match[2]), `Invalid ${checksumFile} in ${directory}`);
    entries.set(match[2], match[1]);
  }
  const files = (await readdir(directory)).filter((file) => file !== checksumFile);
  assert(files.length === entries.size, `Unlisted raw files in ${directory}`);
  for (const file of files) {
    assert(sha256(await readFile(join(directory, file))) === entries.get(file), `Raw SHA-256 mismatch: ${file}`);
  }
  return entries;
}

export async function verifyRaw(root, latest, history = []) {
  const directories = await maybeRead(join(root, 'raw'), readdir) ?? [];
  const manifests = new Map();
  for (const date of directories) {
    assert(/^\d{4}-\d{2}-\d{2}$/u.test(date), `Invalid raw directory: ${date}`);
    manifests.set(date, await readChecksums(join(root, 'raw', date), ROLLING_CHECKSUMS));
  }
  for (const { date } of history) {
    assert(manifests.get(date)?.size, `Missing raw responses for ${date}`);
  }
  for (const { file, sha256: hash } of latest?.raw.filter(({ set }) => set === 'rolling') ?? []) {
    assert(manifests.get(latest.date)?.get(file) === hash, `Receipt SHA-256 mismatch: ${file}`);
  }
}

function verifyPositions(receipt) {
  for (const { positions, ...summary } of Object.values(receipt.sets)) {
    for (const row of positions) {
      const expected = difference(row.engine, row.horizons);
      assert(Math.abs(expected.lon - row.difference.lon) <= 1e-9
        && Math.abs(expected.lat - row.difference.lat) <= 1e-9, `Invalid stored difference for ${row.body} at ${row.label}`);
    }
    assert(json(summarize(positions, receipt.threshold)) === json(summary), 'Invalid stored receipt summary');
  }
}

async function snapshot(root, latest, history) {
  checkHistory(latest, history);
  const pending = join(root, '.pending.json');
  await writeAtomic(pending, json({ latest, history }));
  await finishSnapshot(root, pending, { latest, history });
}

async function finishSnapshot(root, pending, { latest, history }) {
  checkHistory(latest, history);
  verifyPositions(latest);
  await verifyRaw(root, latest, history);
  await writeAtomic(join(root, 'history.json'), json(history));
  await writeAtomic(join(root, 'latest.json'), json(latest));
  await rm(pending);
}

function printReport(receipt) {
  const { total, historical, later } = receipt.nasaCheck;
  process.stdout.write(
    `NASA self check: ${total} of ${total} positions within tolerance.\n\n`
    + `Through ${historical.through}: ${historical.total} positions, largest difference ${historical.largest}″, tolerance ${historical.tolerance}″.\n\n`
    + `After ${later.after}: ${later.total} positions, largest difference ${later.largest}″, tolerance ${later.tolerance}″.\n\n`
    + `Engine ${receipt.engine.version}.\n\n`
    + Object.entries(receipt.sets).map(([name, { within, total, largest }]) =>
      `${name}: ${within} of ${total} positions within ${receipt.threshold}″, largest difference ${largest}″.\n`).join('\n'),
  );
}

export async function collectReceipt({
  root = ROOT, engine, date = new Date(), fetchAnswer = fetch, wait = delay,
  suite, auditRoot = AUDIT_ROOT, auditUrl,
}) {
  const lock = join(root, '.receipt.lock');
  await mkdir(lock);
  try {
    const pending = join(root, '.pending.json');
    const interrupted = await maybeRead(pending, readJson);
    if (interrupted) await finishSnapshot(root, pending, interrupted);
    const latest = await readJson(join(root, 'latest.json'));
    const history = await readJson(join(root, 'history.json'));
    checkHistory(latest, history);
    await verifyRaw(root, latest, history);
    const day = date.toISOString().slice(0, 10);
    await mkdir(auditRoot, { recursive: true });
    const audit = await mkdtemp(join(auditRoot, 'run-'));
    suite ??= await loadPinnedSuite(audit);
    const rolling = rollingInstants(date);
    const suiteRaw = join(audit, 'suite-responses', day);
    const rollingRaw = join(root, 'raw', day);
    const raw = [];
    const prefix = `${date.toISOString().replace(/[^0-9]/gu, '')}-${randomUUID().slice(0, 8)}`;
    let requests = 0;

    async function batch(name, instants, directory, checksumFile) {
      await mkdir(directory, { recursive: true });
      const sums = await readChecksums(directory, checksumFile);
      const result = new Map();
      for (const [body, naif] of BODIES) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          assert(requests < MAX_REQUESTS, `Horizons request limit reached (${MAX_REQUESTS})`);
          requests++;
          let response;
          let bytes;
          let failure;
          try {
            response = await fetchAnswer(horizonsUrl(naif, instants), {
              headers: { 'User-Agent': USER_AGENT },
              cache: 'no-store',
              redirect: 'manual',
              signal: AbortSignal.timeout(60000),
            });
            bytes = Buffer.from(await response.arrayBuffer());
          } catch (error) {
            failure = error.message;
          }
          if (bytes) {
            const file = `${prefix}-${name}-${body}-${attempt}.txt`;
            const hash = sha256(bytes);
            await writeFile(join(directory, file), bytes, { flag: 'wx' });
            sums.set(file, hash);
            await writeAtomic(join(directory, checksumFile),
              [...sums].map(([path, digest]) => `${digest}  ${path}\n`).join(''));
            raw.push({ file, sha256: hash, set: name, body, attempt, status: response.status });
            try {
              assert(response.ok, `HTTP ${response.status}`);
              result.set(body, parseHorizons(bytes.toString(), naif, instants));
              break;
            } catch (error) {
              failure = error.message;
            }
          }
          console.error(`Horizons ${name} ${body}, attempt ${attempt}: ${failure}`);
          assert(attempt < 3, `Horizons ${name} ${body} failed after three attempts: ${failure}`);
          if (requests < MAX_REQUESTS) await wait(30000);
        }
      }
      return result;
    }

    const fresh = await batch('suite', suite.instants, suiteRaw, SUITE_CHECKSUMS);
    const nasaCheck = selfCheck(suite, fresh);
    await readChecksums(suiteRaw, SUITE_CHECKSUMS);
    const answers = await batch('rolling', rolling, rollingRaw, ROLLING_CHECKSUMS);
    const receipt = buildReceipt({ suite, rolling, answers, nasaCheck, date, engine, raw, auditUrl });
    await snapshot(root, receipt, [...history, historyRow(receipt)]);
    return receipt;
  } finally {
    await rm(lock, { recursive: true });
  }
}

async function main([mode]) {
  if (mode === '--verify') {
    await readPinnedSource();
    const latest = await readJson(join(ROOT, 'latest.json'));
    const history = await readJson(join(ROOT, 'history.json'));
    checkHistory(latest, history);
    if (latest) verifyPositions(latest);
    await verifyRaw(ROOT, latest, history);
    console.log('Accuracy source, snapshot and raw hash checks passed.');
  } else if (mode === '--report') {
    const latest = await readJson(join(ROOT, 'latest.json'));
    assert(latest, 'No live accuracy receipt');
    printReport(latest);
  } else {
    assert(!mode, 'Usage: node scripts/accuracy-receipt.mjs [--verify | --report]');
    printReport(await collectReceipt({
      engine: await import('@zodiacs/engine'),
      auditUrl: process.env.ACCURACY_AUDIT_URL,
    }));
    console.log(`Suite responses and hashes: ${AUDIT_ROOT}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
