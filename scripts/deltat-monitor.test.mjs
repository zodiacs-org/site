import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { DELTA_T_TABLE, deltaTAt } from '@zodiacs/engine/deltat';
import { timeBasis } from '@zodiacs/engine/time';
import { describe, expect, it, vi } from 'vitest';
import {
  ISSUE_TITLE,
  LEAP_SECONDS,
  dateOfMjd,
  evaluate,
  evaluateSpan,
  mjdOfDate,
  mirrorDisagreement,
  parseFinals,
  renderReport,
  runMonitor,
  runTzdbMonitor,
  validateFinals,
} from './deltat-monitor.mjs';

const root = resolve(import.meta.dirname, '..');
const MJD_J2000 = 51_544.5;

/** One finals2000A.all row: date in 1–6, MJD in 8–15, UT1 flag in 58, UT1 − UTC in 59–68. */
function finalsLine(mjd, flag = null, ut1MinusUtc = null) {
  const [year, month, day] = dateOfMjd(mjd).split('-');
  const head = `${year.slice(2)}${String(Number(month)).padStart(2)}${String(Number(day)).padStart(2)} ${mjd.toFixed(2).padStart(8)}`;
  if (flag === null) return head;
  return `${head.padEnd(57)}${flag}${ut1MinusUtc.toFixed(7).padStart(10)}${' '.repeat(10)}`;
}

/**
 * A file whose UT1 − UTC puts IERS's ΔT exactly on the model, plus `offset`
 * seconds, with TAI − UTC of 37 s and the leap seconds in `extraLeaps`.
 */
function syntheticFinals({ from, lastObserved, lastPredicted, tail = 30, offset = () => 0, extraLeaps = [] }) {
  const lines = [];
  for (let mjd = from; mjd <= lastPredicted + tail; mjd += 1) {
    if (mjd > lastPredicted) {
      lines.push(finalsLine(mjd));
      continue;
    }
    const taiMinusUtc = 37 + extraLeaps.filter((leap) => leap <= mjd).length;
    const iers = deltaTAt(mjd - MJD_J2000).seconds + offset(mjd);
    lines.push(finalsLine(mjd, mjd <= lastObserved ? 'I' : 'P', 32.184 + taiMinusUtc - iers));
  }
  return `${lines.join('\n')}\n`;
}

const today = mjdOfDate('2026-09-25');
const standard = { from: mjdOfDate('2026-01-01'), lastObserved: today - 1, lastPredicted: today + 372 };

describe('the weekly ΔT monitor', () => {
  it('reads the columns IERS documents and drops the rows past the predictions', () => {
    const rows = parseFinals(syntheticFinals(standard));
    expect(rows[0]).toMatchObject({ mjd: standard.from, flag: 'I' });
    expect(rows.at(-1)).toMatchObject({ mjd: standard.lastPredicted, flag: 'P' });
    expect(rows).toHaveLength(standard.lastPredicted - standard.from + 1);
  });

  it('lists each leap second on the day it took effect', () => {
    expect(LEAP_SECONDS).toHaveLength(28);
    expect(LEAP_SECONDS.at(-1)).toEqual({ mjd: 57_754, seconds: 37 });
    expect(dateOfMjd(LEAP_SECONDS[2].mjd)).toBe('1973-01-01');
    expect(LEAP_SECONDS.every((leap, index) => index === 0 || leap.seconds === LEAP_SECONDS[index - 1].seconds + 1)).toBe(true);
  });

  it('refuses a file that is not daily and contiguous, or has a value after the empty tail', () => {
    const lines = syntheticFinals(standard).trimEnd().split('\n');
    expect(() => parseFinals([...lines.slice(0, 10), ...lines.slice(11)].join('\n')))
      .toThrow(/not daily and contiguous/u);
    const tailStart = standard.lastPredicted - standard.from + 1;
    const reopened = [...lines];
    reopened[tailStart + 2] = finalsLine(standard.lastPredicted + 3, 'P', 0.1);
    expect(() => parseFinals(reopened.join('\n'))).toThrow(/follows rows without one/u);
  });

  it('refuses a second switch between I and P, stale observations and a short prediction', () => {
    const lines = syntheticFinals(standard).trimEnd().split('\n');
    const flipped = [...lines];
    const index = today + 10 - standard.from;
    flipped[index] = `${flipped[index].slice(0, 57)}I${flipped[index].slice(58)}`;
    expect(() => validateFinals(parseFinals(flipped.join('\n')), today)).toThrow(/more than once/u);

    const stale = parseFinals(syntheticFinals({ ...standard, lastObserved: today - 15 }));
    expect(() => validateFinals(stale, today)).toThrow(/more than 14 days/u);
    expect(() => validateFinals(parseFinals(syntheticFinals({ ...standard, lastObserved: today - 14 })), today))
      .not.toThrow();

    const short = parseFinals(syntheticFinals({ ...standard, lastPredicted: today + 298 }));
    expect(() => validateFinals(short, today)).toThrow(/predicts 299 days/u);
  });

  it('takes TAI − UTC from the file, and counts a leap second IERS has added since the list', () => {
    const leap = mjdOfDate('2027-01-01');
    const file = validateFinals(parseFinals(syntheticFinals({ ...standard, extraLeaps: [leap] })), today);
    expect(file.taiMinusUtc.get(leap - 1)).toBe(37);
    expect(file.taiMinusUtc.get(leap)).toBe(38);
    expect(file.newLeapSeconds).toEqual(['2027-01-01']);
    const result = evaluate(file, today);
    expect(result.predictionWindow.largestDifference).toBeLessThan(1e-6);
    expect(renderReport({ ...result, source: 'fixture', problems: [] })).toContain('leap second not in the monitor\'s list: 2027-01-01');
  });

  it('refuses a file whose steps do not match the listed leap seconds', () => {
    const from = mjdOfDate('2016-12-01');
    const steady = syntheticFinals({ ...standard, from }).trimEnd().split('\n');
    expect(() => validateFinals(parseFinals(steady.join('\n')), today)).toThrow(/no one-second step on 2017-01-01/u);

    const withLeap = steady.map((line) => {
      const mjd = Number(line.slice(7, 15));
      if (mjd >= mjdOfDate('2017-01-01') || line.charAt(57) === ' ') return line;
      return finalsLine(mjd, 'I', Number(line.slice(58, 68)) - 1);
    });
    const file = validateFinals(parseFinals(withLeap.join('\n')), today);
    expect(file.taiMinusUtc.get(mjdOfDate('2016-12-31'))).toBe(36);
    expect(file.taiMinusUtc.get(mjdOfDate('2017-01-01'))).toBe(37);

    const stray = withLeap.map((line) => {
      const mjd = Number(line.slice(7, 15));
      if (mjd < mjdOfDate('2016-12-10') || mjd >= mjdOfDate('2016-12-21')) return line;
      return finalsLine(mjd, 'I', Number(line.slice(58, 68)) + 1);
    });
    expect(() => validateFinals(parseFinals(stray.join('\n')), today)).toThrow(/2016-12-10, which is not a leap second/u);
  });

  it('stays quiet when IERS agrees with the model and the prediction window is long', () => {
    const result = evaluate(validateFinals(parseFinals(syntheticFinals(standard)), today), today);
    expect(result).toMatchObject({ status: 'quiet', valueFires: false, windowFires: false, date: '2026-09-25' });
    expect(Math.abs(result.difference)).toBeLessThan(1e-6);
    expect(result.threshold).toBe(Math.max(0.1, deltaTAt(today - MJD_J2000).sigma));
    expect(result.daysToLastPredictionKnot).toBe(DELTA_T_TABLE.predictedTo - today);
    expect(result.table).toMatchObject({ model: 'zodiacs-deltat/1', version: DELTA_T_TABLE.version, digest: DELTA_T_TABLE.digest });
  });

  it('fires on the value rule just above max(0.1 s, σ) and not at it', () => {
    const threshold = Math.max(0.1, deltaTAt(today - MJD_J2000).sigma);
    const above = evaluate(validateFinals(parseFinals(syntheticFinals({ ...standard, offset: () => -(threshold + 0.001) })), today), today);
    expect(above).toMatchObject({ status: 'fired', valueFires: true, windowFires: false });
    const at = evaluate(validateFinals(parseFinals(syntheticFinals({ ...standard, offset: () => -(threshold - 0.001) })), today), today);
    expect(at).toMatchObject({ status: 'quiet', valueFires: false });
  });

  it('fires on the window rule from 89 days before the last prediction knot', () => {
    const late = DELTA_T_TABLE.predictedTo - 89;
    const file = validateFinals(parseFinals(syntheticFinals({ from: late - 60, lastObserved: late - 1, lastPredicted: late + 365 })), late);
    expect(evaluate(file, late)).toMatchObject({ windowFires: true, status: 'fired', daysToLastPredictionKnot: 89 });
    const earlier = DELTA_T_TABLE.predictedTo - 90;
    const quietFile = validateFinals(parseFinals(syntheticFinals({ from: earlier - 60, lastObserved: earlier - 1, lastPredicted: earlier + 365 })), earlier);
    expect(evaluate(quietFile, earlier)).toMatchObject({ windowFires: false, daysToLastPredictionKnot: 90 });
  });

  it('reports the largest disagreement over the predicted days', () => {
    const peak = today + 200;
    const file = validateFinals(parseFinals(syntheticFinals({ ...standard, offset: (mjd) => (mjd === peak ? 0.05 : 0) })), today);
    const result = evaluate(file, today);
    expect(result.status).toBe('quiet');
    expect(result.predictionWindow.largestDifference).toBeCloseTo(0.05, 6);
    expect(result.predictionWindow.on).toBe(dateOfMjd(peak));
  });

  it('uses the other mirror when one fails, and fails when the mirrors disagree by more than 0.1 ms', async () => {
    const good = syntheticFinals(standard);
    const pauses = [];
    const fetchImpl = async (url) => (url.includes('maia')
      ? { ok: false, status: 503, text: async () => '' }
      : { ok: true, status: 200, text: async () => good });
    const oneMirror = await runMonitor({ today: new Date('2026-09-25T00:00:00Z'), fetchImpl, pause: async (ms) => { pauses.push(ms); } });
    expect(oneMirror).toMatchObject({ status: 'quiet', mirrorsValid: 1, source: 'https://datacenter.iers.org/data/9/finals2000A.all' });
    expect(oneMirror.problems).toEqual(['https://maia.usno.navy.mil/ser7/finals2000A.all: try 1: HTTP 503; try 2: HTTP 503; try 3: HTTP 503']);
    expect(pauses).toEqual([10_000, 20_000]);

    const shifted = syntheticFinals({ ...standard, offset: (mjd) => (mjd === today - 30 ? 0.0002 : 0) });
    const a = validateFinals(parseFinals(good), today);
    const b = validateFinals(parseFinals(shifted), today);
    expect(mirrorDisagreement(a, b).seconds).toBeCloseTo(0.0002, 7);
    const split = await runMonitor({
      today: new Date('2026-09-25T00:00:00Z'),
      sources: [{ url: 'a', text: good }, { url: 'b', text: shifted }],
    });
    expect(split.status).toBe('failed');
    expect(split.problems.at(-1)).toMatch(/differ by 0\.200 ms on 2026-08-26/u);
  });

  it('fails, and says why, when no mirror gives a valid file', async () => {
    const result = await runMonitor({
      today: new Date('2026-09-25T00:00:00Z'),
      sources: [{ url: 'a', error: 'try 1: timeout' }, { url: 'b', text: 'not a finals file' }],
    });
    expect(result.status).toBe('failed');
    expect(result.problems).toEqual(['a: try 1: timeout', 'b: line 1: no whole MJD in columns 8–15']);
    expect(renderReport(result)).toContain('IERS could not be read');
  });

  it('runs weekly, opens one issue at a time, and commits nothing', async () => {
    const workflow = await readFile(resolve(root, '.github/workflows/deltat-monitor.yml'), 'utf8');
    expect(workflow).toMatch(/cron: "\d+ \d+ \* \* 5"/u);
    expect(workflow).toContain('node scripts/deltat-monitor.mjs');
    expect(workflow).toContain(ISSUE_TITLE);
    expect(workflow).toMatch(/issues: write/u);
    expect(workflow).not.toMatch(/contents: write|git push|git commit/u);
  });
});

const replayDate = '2026-11-13';
const finalsPath = resolve(root, 'scripts/fixtures/finals2000A-20261112.txt');
const newsPath = resolve(root, 'scripts/fixtures/tzdb-NEWS-2026f.txt');
const tzdbUrl = 'https://data.iana.org/time-zones/tzdb';

async function recordedRows() {
  return parseFinals(await readFile(finalsPath, 'utf8'));
}

function shiftPredictions(rows, offset) {
  return rows.map((row) => row.flag === 'P' ? { ...row, ut1MinusUtc: row.ut1MinusUtc + offset } : row);
}

describe('the UT1 span rule', () => {
  it('finds the recorded peak across the whole overlap and reports its sigma and verdict', async () => {
    const result = await runMonitor({
      today: new Date(`${replayDate}T00:00:00Z`),
      sources: [{ url: 'recorded IERS file', text: await readFile(finalsPath, 'utf8') }],
    });
    expect(result).toMatchObject({
      status: 'quiet',
      span: { days: 324, fires: false, worst: { on: '2027-10-01' } },
    });
    expect(Math.abs(result.span.worst.difference - 0.077)).toBeLessThan(0.005);
    expect(result.span.worst.difference).toBeCloseTo(0.078009, 6);
    expect(result.span.worst.sigma).toBeCloseTo(0.026148, 6);
    expect(renderReport(result)).toContain('UT1 span: 324 days compared. Largest absolute difference: 0.0780 s on 2027-10-01 (engine σ 0.0261 s). Fires above 0.1 s: no.');
  });

  it('fires through the existing status when every IERS prediction moves by 0.2 s', async () => {
    const rows = shiftPredictions(await recordedRows(), 0.2);
    // Hold the existing value rule quiet so the status must come from the span.
    const todayRow = rows.find((row) => row.mjd === mjdOfDate(replayDate));
    const seconds = 32.184 + 37 - todayRow.ut1MinusUtc;
    const result = await runMonitor({
      today: new Date(`${replayDate}T00:00:00Z`),
      sources: [{ url: 'shifted IERS file', text: rows.map((row) => (
        finalsLine(row.mjd, row.flag, row.ut1MinusUtc)
      )).join('\n') }],
      model: () => ({ seconds, sigma: 0, segment: 'predicted' }),
    });
    expect(result).toMatchObject({
      status: 'fired', valueFires: false, windowFires: false,
      span: { days: 324, fires: true, worst: { on: '2026-11-13' } },
    });
    expect(renderReport(result)).toMatch(/0\.2067 s on 2026-11-13 .* Fires above 0\.1 s: yes/u);
  });

  it('fires exactly when the largest absolute shifted disagreement exceeds the threshold', async () => {
    const rows = await recordedRows();
    const first = mjdOfDate(replayDate);
    const last = mjdOfDate('2027-10-02');
    const differences = rows.filter(({ mjd }) => mjd >= first && mjd <= last).map((row) => {
      const ms = Date.parse(`${dateOfMjd(row.mjd)}T00:00:00Z`);
      return row.ut1MinusUtc - timeBasis(ms).timeScale.ut1MinusUtc.seconds;
    });
    for (let step = -30; step <= 30; step += 1) {
      const shift = step / 100;
      const max = Math.max(...differences.map((difference) => Math.abs(difference + shift)));
      const result = evaluateSpan(shiftPredictions(rows, shift));
      expect(result.worst.difference, `shift ${shift}`).toBeCloseTo(max, 12);
      expect(result.fires, `shift ${shift}`).toBe(max > 0.1);
    }
  });

  it('counts a shorter overlap and skips engine observations, model values and fallback', async () => {
    const rows = await recordedRows();
    const last = mjdOfDate('2027-09-10');
    const result = await runMonitor({
      today: new Date(`${replayDate}T00:00:00Z`),
      sources: [{ url: 'shorter IERS file', text: rows.filter((row) => row.mjd <= last).map((row) => (
        finalsLine(row.mjd, row.flag, row.ut1MinusUtc)
      )).join('\n') }],
    });
    expect(result.span.days).toBe(302);
    expect(renderReport(result)).toContain('UT1 span: 302 days compared.');

    const mjd = mjdOfDate(replayDate);
    const sources = ['predicted', 'predicted', 'observed', 'model', 'fallback', null];
    const basis = (ms) => {
      const source = sources[(ms - Date.parse(`${replayDate}T00:00:00Z`)) / 86_400_000];
      return { timeScale: { ut1MinusUtc: source && { source, seconds: 0, sigma: 0.02 } } };
    };
    const sample = sources.map((_, index) => ({
      mjd: mjd + index, flag: index === 0 ? 'I' : 'P', ut1MinusUtc: index === 1 ? -0.1 : -0.4,
    }));
    expect(evaluateSpan(sample, basis)).toEqual({
      days: 1, worst: { difference: 0.1, on: '2026-11-14', sigma: 0.02 }, fires: false,
    });
    expect(evaluateSpan(sample.slice(2), basis)).toEqual({ days: 0, worst: null, fires: false });
  });
});

describe('the time zone release rule', () => {
  const respond = (text) => ({ ok: true, text: async () => text });

  it('compares the year before the letter and reads NEWS only for a newer release', async () => {
    const fetchVersion = (version) => async (url) => {
      if (url === `${tzdbUrl}/version`) return respond(version);
      if (url === `${tzdbUrl}/NEWS`) return respond('Release 2027a\n\n  Briefly:\n    A change.\n');
      throw new Error(`unexpected URL ${url}`);
    };
    expect(await runTzdbMonitor({ installed: '2026f', fetchImpl: fetchVersion('2027a\r\n') }))
      .toMatchObject({ status: 'fired', latest: '2027a' });
    for (const [installed, version] of [['2026f', '2026f\n'], ['2025c', '2025c'], ['2026a', '2025z']]) {
      const urls = [];
      const fetchImpl = async (url) => {
        urls.push(url);
        return fetchVersion(version)(url);
      };
      expect(await runTzdbMonitor({ installed, fetchImpl })).toMatchObject({ status: 'quiet' });
      expect(urls).toEqual([`${tzdbUrl}/version`]);
    }
  });

  it.each(['version', 'NEWS'])('fails after three ten second attempts to read %s', async (endpoint) => {
    const attempts = [];
    const fetchImpl = async (url, { signal }) => {
      if (url === `${tzdbUrl}/${endpoint}`) {
        attempts.push(signal);
        return { ok: false, status: 503 };
      }
      if (url === `${tzdbUrl}/version`) return respond('2026f\n');
      throw new Error(`unexpected URL ${url}`);
    };
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      const result = await runTzdbMonitor({ installed: '2025c', fetchImpl, pause: async () => {} });
      expect(attempts).toHaveLength(3);
      expect(new Set(attempts).size).toBe(3);
      expect(timeout.mock.calls).toEqual(Array.from({ length: endpoint === 'NEWS' ? 4 : 3 }, () => [10_000]));
      expect(result).toMatchObject({ status: 'failed', problem: expect.stringContaining(`${tzdbUrl}/${endpoint}: try 1: HTTP 503; try 2: HTTP 503; try 3: HTTP 503`) });
    } finally {
      timeout.mockRestore();
    }
  });

  it('writes separate statuses and the recorded release notes through the CLI', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'weekly-data-monitor-'));
    try {
      const summary = resolve(directory, 'summary.md');
      const issue = resolve(directory, 'deltat.md');
      const tzIssue = resolve(directory, 'tzdb.md');
      const output = resolve(directory, 'output');
      const preload = `data:text/javascript,${encodeURIComponent(`
        import { readFile } from 'node:fs/promises';
        globalThis.fetch = async (url) => {
          if (url === '${tzdbUrl}/version') return new Response('2026f\\r\\n');
          if (url === '${tzdbUrl}/NEWS') return new Response(await readFile(${JSON.stringify(newsPath)}));
          throw new Error('unexpected URL ' + url);
        };
      `)}`;
      await promisify(execFile)(process.execPath, [
        '--import', preload, resolve(root, 'scripts/deltat-monitor.mjs'),
        '--date', replayDate, '--finals', finalsPath, '--summary', summary,
        '--issue-body', issue, '--tz-issue-body', tzIssue, '--github-output', output,
      ], { timeout: 4_000 });
      const body = await readFile(tzIssue, 'utf8');
      expect(body).toContain('The engine ships 2025c. IANA reports 2026f.');
      expect(body).toContain('In 1925 Ireland fell back on 09-20 not 10-04');
      expect(body).toContain('Cuba will not fall back');
      expect(body.match(/^### 2026[a-f]$/gmu)).toHaveLength(6);
      expect(body).not.toMatch(/### 2025c|Changes to code|Changes to commentary|Other data changes/u);
      expect(await readFile(summary, 'utf8')).toContain('UT1 span: 324 days compared.');
      await expect(readFile(issue, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readFile(output, 'utf8')).toBe('status=quiet\ntz_status=fired\n');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('routes a release and failed data reads through the same scheduled workflow', async () => {
    const workflow = await readFile(resolve(root, '.github/workflows/deltat-monitor.yml'), 'utf8');
    expect(workflow).toContain('--tz-issue-body "$RUNNER_TEMP/tzdb-issue.md"');
    expect(workflow).toContain("if: steps.monitor.outputs.tz_status == 'fired'");
    expect(workflow).toContain('TITLE="Time zone data needs a refresh"');
    expect(workflow).toContain("steps.monitor.outputs.status == 'failed' || steps.monitor.outputs.tz_status == 'failed'");
    expect(workflow).toContain('23 6 * * 5');
  });
});
