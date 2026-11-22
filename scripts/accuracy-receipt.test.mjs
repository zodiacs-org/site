import { transform as compileAstro } from '@astrojs/compiler-rs';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { transform as compileTs } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as vendor from '@zodiacs/engine';
import { ACCURACY_PATH, accuracyPagePaths, accuracyPublished, accuracyRobots } from '../src/accuracy/publication.mjs';
import { getStaticPaths as rawPaths } from '../src/pages/developers/accuracy/raw/[date]/[file].ts';
import { GET as builtRobots } from '../src/pages/robots.txt.ts';
import { robotsGroupBlockFailures, robotsRules } from './indexing-consistency.mjs';
import {
  BODIES, buildReceipt, collectReceipt, difference, horizonsUrl, loadSuite, rollingInstants, selfCheck, verifyRaw,
} from './accuracy-receipt.mjs';
import evidence from './fixtures/accuracy-replay.json';

const date = new Date(evidence.replayedAt);
let replay;
const scratch = [];
let suite;

beforeAll(async () => {
  suite = await fixtureSuite();
  const rolling = suite.instants.slice(0, 12);
  const answers = new Map([...suite.recorded].map(([body, rows]) => [body, rows.slice(0, rolling.length)]));
  const raw = BODIES.flatMap(([body, , file]) => ['suite', 'rolling'].map((set) => ({
    file: `${file}.txt`, body, set, sha256: suite.source.files[`${file}.txt`], attempt: 1, status: 200,
  })));
  const base = previewEngine();
  const receipt = JSON.parse(JSON.stringify(buildReceipt({
    suite, rolling, answers, raw, engine: base, date, nasaCheck: selfCheck(suite, suite.recorded),
  })));
  const { positions: suitePositions, ...suiteSummary } = receipt.sets.suite;
  const { positions: rollingPositions, ...rollingSummary } = receipt.sets.rolling;
  replay = { receipt, history: [{
    date: receipt.date, label: receipt.label, checkedAt: receipt.checkedAt, engine: receipt.engine,
    suite: suiteSummary, rolling: rollingSummary,
  }] };
});
afterEach(async () => {
  await Promise.all(scratch.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  vi.restoreAllMocks();
});

async function fixtureSuite() {
  const directory = await mkdtemp(join(tmpdir(), 'accuracy-suite-'));
  try {
    const calendar = Array.from({ length: 24 }, (_, index) => new Date(Date.UTC(2026, index, 1)));
    const cases = calendar.map((instant, index) => ({ id: `case${index}`, jdTt: Number(instant) / 86400000 + 2440587.5 }));
    const rows = cases.flatMap((at, index) => BODIES.map(([body], bodyIndex) => ({
      input: { jd_tt: at.jdTt, body },
      expected: { lon: bodyIndex * 23 + index / 10, lat: bodyIndex / 100 },
    })));
    const files = {
      'corpus-tt.json': JSON.stringify({ cases }),
      'frame-offsets.json': JSON.stringify({ instants: cases.map(({ id }) => ({ id, frameTermMeanArcsec: 0.04 })) }),
    };
    const month = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' });
    for (const [body, target, file] of BODIES) {
      const positions = rows.filter(({ input }) => input.body === body);
      const table = calendar.map((instant, index) => {
        const { lon, lat } = positions[index].expected;
        return `${instant.getUTCFullYear()}-${month.format(instant)}-01 00:00:00.000, , , ${lon}, ${lat},`;
      });
      files[`${file}.txt`] = [
        'API SOURCE: NASA/JPL Horizons API',
        `Target body name: ${body} (${target}) {source: DE441}`,
        'Center body name: Earth (399) {source: DE441}',
        'Center-site name: GEOCENTRIC',
        'Atmos refraction: NO (AIRLESS)',
        'Date__(TT)__HR:MN:SC.fff, , , ObsEcLon, ObsEcLat,',
        '$$SOE', ...table, '$$EOE', 'IAU76/80',
      ].join('\n');
    }
    const hash = (text) => createHash('sha256').update(text).digest('hex');
    const inputs = Object.entries(files).map(([path, text]) => ({ path, sha256: hash(text) }));
    files['L1-positions.json'] = JSON.stringify({ arbiters: { 'horizons-de441-iau2006': { inputs } }, vectors: rows });
    const source = {
      repository: 'https://github.com/zodiacs-org/engine',
      commit: evidence.suiteCommit,
      files: Object.fromEntries(Object.entries(files).map(([file, text]) => [file, hash(text)])),
    };
    await Promise.all(Object.entries({ ...files, 'source.json': JSON.stringify(source) })
      .map(([file, text]) => writeFile(join(directory, file), text)));
    return await loadSuite(directory);
  } finally {
    await rm(directory, { recursive: true });
  }
}

function previewEngine(mutate = (value) => value) {
  return {
    ENGINE_VERSION: evidence.engine.version,
    natalChart({ utc, timeScale }) {
      expect(timeScale).toBe('tt');
      const at = suite.instants.find(({ jdTt }) => Math.round((jdTt - 2440587.5) * 86400000) === Number(utc));
      return {
        ephemeris: evidence.engine.ephemerides[0],
        bodies: suite.vectors.filter(({ at: { id } }) => id === at.id)
          .map(({ body, expected }) => mutate({ body, ...expected }, at.id)),
      };
    },
  };
}

async function renderReceipt(receipt, history = replay.history) {
  const file = 'src/accuracy/AccuracyReceipt.astro';
  const dir = await mkdtemp('node_modules/.accuracy-test-');
  scratch.push(dir);
  const { code } = await compileAstro(await readFile(file, 'utf8'), {
    filename: file, internalURL: 'astro/compiler-runtime', resolvePath: (target) => target,
  });
  // The container renders the template. Its stylesheet has no bearing on the
  // text assertions and the normal site build exercises the stylesheet.
  const path = join(dir, 'receipt.mjs');
  const compiled = await compileTs(code.replace(/^import ".*[?]astro&type=style.*";$/mu, ''), {
    loader: 'ts', format: 'esm',
  });
  await writeFile(path, compiled.code);
  const { default: component } = await import(pathToFileURL(join(process.cwd(), path)).href);
  return (await AstroContainer.create()).renderToString(component, { props: { receipt, history } });
}

async function dataDirectory() {
  const root = await mkdtemp(join(tmpdir(), 'accuracy-test-'));
  scratch.push(root);
  await writeFile(join(root, 'latest.json'), 'null\n');
  await writeFile(join(root, 'history.json'), '[]\n');
  return { root, auditRoot: join(root, 'audit') };
}

function recordedAnswer(url) {
  const params = url.searchParams;
  const body = replay.receipt.raw.find(({ file }) => {
    const banner = suite.files.get(file).split('\n').find((line) => line.startsWith('Target body name:'));
    return banner.includes(`(${params.get('COMMAND').slice(1, -1)})`);
  });
  const original = suite.files.get(body.file);
  const rolling = rollingInstants(date);
  if (params.get('TLIST').split(' ').length !== rolling.length) return original;
  // Exercise the request, parser and storage at the requested monthly dates.
  // The test values are copied from the recorded fixture, with synthetic dates.
  const month = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' });
  return original.replace(/^(\$\$SOE\n)([\s\S]*?)(\$\$EOE)$/mu, (_, start, bodyRows, end) => {
    const rows = bodyRows.trim().split('\n').slice(0, rolling.length).map((row, i) => {
      const when = new Date(`${rolling[i].date}T00:00:00Z`);
      return ` ${when.getUTCFullYear()}-${month.format(when)}-01 00:00:00.000${row.slice(row.indexOf(','))}`;
    });
    return start + rows.join('\n') + '\n' + end;
  });
}

describe('NASA accuracy receipts', () => {
  it('keeps the receipt and downloads hidden with engine 1.1.0 and the owner switch off', async () => {
    expect(vendor.ENGINE_VERSION).toBe('1.1.0');
    expect(accuracyPublished).toBe(false);
    expect(accuracyPagePaths()).toEqual([]);
    expect(await rawPaths()).toEqual([]);
    const robots = robotsRules(await builtRobots().text());
    expect(robots.groups.some(({ agents }) => agents.includes('*'))).toBe(true);
    expect(robotsGroupBlockFailures(robots, [
      ACCURACY_PATH.slice(0, -1), ACCURACY_PATH, `${ACCURACY_PATH}raw/`,
    ])).toEqual([]);
  });

  it('blocks the withheld receipt for every crawler group', async () => {
    const rules = await readFile('src/robots.txt', 'utf8');
    expect(accuracyRobots(rules, true)).toBe(rules);
    const crawlerGroups = accuracyRobots(rules, false).split('\n\n').filter((group) => group.startsWith('User-agent:'));
    expect(crawlerGroups).not.toHaveLength(0);
    for (const group of crawlerGroups) {
      expect(group.split('\n')).toEqual(expect.arrayContaining([
        `Disallow: ${ACCURACY_PATH.slice(0, -1)}$`,
        `Disallow: ${ACCURACY_PATH}`,
      ]));
    }
  });

  it('renders fixture values directly and shows the same headline for a failure', async () => {
    const { receipt } = replay;
    const html = await renderReceipt(receipt);
    const text = html.replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ');
    const numbers = (value) => value.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gu) ?? [];
    const values = new Set(numbers(JSON.stringify([receipt, replay.history])));
    expect(numbers(text).length).toBeGreaterThan(2000);
    expect(numbers(text).filter((number) => !values.has(number))).toEqual([]);
    expect(text).toContain(`Checked against NASA on ${receipt.label}: 240 of 240 positions within 1″`);
    expect(html).toContain(receipt.raw[0].sha256);
    const inlineText = html.replace(/<[^>]+>/gu, '').replace(/\s+/gu, ' ');
    expect(inlineText).toContain(`read ${receipt.engine.ephemerides[0].name}`);
    expect(inlineText).toContain(`in its ${receipt.frames.rolling} frame`);
    expect(inlineText).toContain(`tolerance for ${receipt.nasaCheck.total} positions`);

    const first = receipt.sets.suite.positions[0];
    const engine = previewEngine((value, id) => value.body === first.body && id === first.id
      ? { ...value, lon: value.lon + 2 / 3600 }
      : value);
    const rolling = suite.instants.slice(0, 12);
    const answers = new Map([...suite.recorded].map(([body, rows]) => [body, rows.slice(0, rolling.length)]));
    const mutated = buildReceipt({ suite, rolling, answers, engine, date, raw: receipt.raw, nasaCheck: receipt.nasaCheck });
    expect(mutated.sets.suite.within).toBe(239);
    expect(mutated.sets.suite.positions[0].difference.lon - first.difference.lon).toBeCloseTo(2, 9);
    expect(await renderReceipt(mutated)).toMatch(/<h1[^>]*>\s*Checked against NASA on .*239 of 240 positions within 1″\s*<span[^>]*>Positions outside the limit<\/span>/u);

    const rollingFailure = structuredClone(receipt);
    rollingFailure.sets.rolling.within--;
    expect(await renderReceipt(rollingFailure)).toMatch(/<h1[^>]*>\s*Checked against NASA on .*119 of 120 positions within 1″\s*<span[^>]*>Positions outside the limit<\/span>/u);
    expect(await renderReceipt(null, [])).toContain('Waiting for the first NASA accuracy receipt');
  });

  it('checks both NASA groups, rejecting a recorded historical value shifted by 0.002 arcsec', () => {
    expect(selfCheck(suite, suite.recorded)).toEqual(replay.receipt.nasaCheck);
    const recorded = structuredClone(suite.recorded);
    recorded.get('Sun')[0].lon += 0.002 / 3600;
    expect(() => selfCheck({ ...suite, recorded }, suite.recorded)).toThrow(/NASA self check failed for Sun.*exceeds 0\.001″/u);
    const later = structuredClone(suite.recorded);
    later.get('Sun').at(-1).lon += 0.002 / 3600;
    expect(selfCheck(suite, later).later.largest).toBeCloseTo(0.002, 8);
  });

  it('sends the exact request, saves sequential batches and checks every stored difference and raw hash', async () => {
    const options = await dataDirectory();
    const { root } = options;
    const fetchAnswer = vi.fn(async (url, options) => {
      expect(options.headers['User-Agent']).toBe('zodiacs.org accuracy receipt (admin@zodiacs.org)');
      expect(options.cache).toBe('no-store');
      return new Response(recordedAnswer(url));
    });
    const receipt = await collectReceipt({ ...options, suite, engine: vendor, date, fetchAnswer });
    expect(fetchAnswer).toHaveBeenCalledTimes(20);
    expect(Object.fromEntries(horizonsUrl(10, suite.instants).searchParams)).toEqual({
      format: 'text', COMMAND: "'10'", OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'",
      CENTER: "'500@399'", QUANTITIES: "'31'", APPARENT: "'AIRLESS'", TIME_TYPE: "'TT'", TLIST_TYPE: "'JD'",
      TLIST: `'${suite.instants.map(({ jdTt }) => jdTt.toFixed(8)).join(' ')}'`,
      ANG_FORMAT: "'DEG'", EXTRA_PREC: "'YES'", CSV_FORMAT: "'YES'",
    });
    expect(receipt.nasaCheck.total).toBe(240);
    expect(receipt.frameDifference).toEqual(replay.receipt.frameDifference);
    expect(new Set(receipt.sets.rolling.positions.map(({ date }) => date))).toEqual(new Set([
      '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01', '2027-05-01',
      '2027-06-01', '2027-07-01', '2027-08-01', '2027-09-01', '2027-10-01', '2027-11-01',
    ]));
    const latest = JSON.parse(await readFile(join(root, 'latest.json'), 'utf8'));
    expect(latest).toEqual(JSON.parse(JSON.stringify(receipt)));
    for (const { positions } of [...Object.values(latest.sets), ...Object.values(replay.receipt.sets)]) {
      for (const { engine, horizons, difference: stored } of positions) {
        const lon = ((engine.lon - horizons.lon + 540) % 360 - 180) * 3600;
        const lat = (engine.lat - horizons.lat) * 3600;
        expect(Math.abs(stored.lon - lon)).toBeLessThanOrEqual(1e-9);
        expect(Math.abs(stored.lat - lat)).toBeLessThanOrEqual(1e-9);
      }
    }
    expect(difference({ lon: 0, lat: 0 }, { lon: 359.5, lat: 0 }).lon).toBe(1800);
    expect(JSON.parse(await readFile(join(root, 'history.json'), 'utf8'))).toHaveLength(1);
    await verifyRaw(root, latest);
    await writeFile(join(root, 'raw', receipt.date, receipt.raw.find(({ set }) => set === 'rolling').file), 'corrupt');
    await expect(verifyRaw(root, latest)).rejects.toThrow(/Raw SHA-256 mismatch/u);
  });

  it('can append a second receipt on the same date without replacing the first answers', async () => {
    const options = await dataDirectory();
    const { root } = options;
    const fetchAnswer = async (url) => new Response(recordedAnswer(url));
    const first = await collectReceipt({ ...options, suite, engine: vendor, date, fetchAnswer });
    const second = await collectReceipt({ ...options, suite, engine: vendor, date, fetchAnswer });
    expect(new Set([...first.raw, ...second.raw].map(({ file }) => file)).size).toBe(40);
    const history = JSON.parse(await readFile(join(root, 'history.json'), 'utf8'));
    expect(history).toHaveLength(2);
    await verifyRaw(root, second, history);
  });

  it('saves and hashes failed responses while leaving both snapshot files alone', async () => {
    const options = await dataDirectory();
    const { root } = options;
    const fetchAnswer = vi.fn(async () => new Response('unavailable', { status: 503 }));
    const wait = vi.fn(async () => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(collectReceipt({ ...options, suite, engine: vendor, date, fetchAnswer, wait })).rejects.toThrow(/failed after three attempts/u);
    expect(wait.mock.calls).toEqual([[30000], [30000]]);
    expect(fetchAnswer).toHaveBeenCalledTimes(3);
    await verifyRaw(root, null);
    const [run] = await readdir(options.auditRoot);
    const directory = join(options.auditRoot, run, 'suite-responses', replay.receipt.date);
    expect((await readFile(join(directory, 'SHA256SUMS'), 'utf8')).trim().split('\n')).toHaveLength(3);
    expect(await readFile(join(root, 'latest.json'), 'utf8')).toBe('null\n');
    expect(await readFile(join(root, 'history.json'), 'utf8')).toBe('[]\n');
  });
});
