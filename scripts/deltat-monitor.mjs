/*
 * The weekly ΔT monitor, as preregistered in
 * docs/platform/evidence/deltat-2026-09-25/README.md §6.
 *
 *   node scripts/deltat-monitor.mjs [--date YYYY-MM-DD] [--finals <file>]...
 *     [--summary <file>] [--issue-body <file>] [--tz-issue-body <file>]
 *     [--github-output <file>]
 *
 * Each engine release freezes its ΔT table (model zodiacs-deltat/1). Once a
 * week this compares that table with IERS's finals2000A.all and says when a
 * refresh is due. It commits nothing: a refresh is an engine release, which
 * the site takes through a normal pull request.
 *
 * It fetches the file from both mirrors, three tries each, and validates it:
 * every row parses, the days run on without a gap, the rows flagged I (observed)
 * are followed once by rows flagged P (predicted), the last I row is at most
 * 14 days old, and at least 300 days are predicted. When both mirrors answer,
 * their I rows must agree to 0.1 ms. At t₀, the run date at 0h UTC, it fires
 * when either holds:
 *
 * - value: |ΔT_model(t₀) − ΔT_IERS(t₀)| > max(0.1 s, σ_model(t₀));
 * - window: the table's last prediction knot is fewer than 90 days after t₀.
 *
 * ΔT_IERS = 32.184 + (TAI − UTC) − (UT1 − UTC), from the file's row for that
 * day. TAI − UTC comes from the same file. Each leap second listed below must
 * show as a one-second step in UT1 − UTC on its day, and any later step
 * counts as a new leap second. The report also gives the largest
 * |model − IERS| over the file's predicted days.
 *
 * Status: "quiet", "fired", or "failed" when no mirror gave a valid file.
 * .github/workflows/deltat-monitor.yml opens or comments on the issue
 * "ΔT table needs a refresh" whenever the status is not quiet.
 * The span rule also fires on a UT1 disagreement above 0.1 s where both
 * IERS and the engine are predicting. The tzdb rule reports newer IANA
 * releases through its own status and issue body. See the same README, §11.
 */
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { DELTA_T_MODEL, DELTA_T_TABLE, deltaTAt } from '@zodiacs/engine/deltat';
import { TZDB } from '@zodiacs/engine/geo';
import { timeBasis } from '@zodiacs/engine/time';

export const MIRRORS = Object.freeze([
  'https://maia.usno.navy.mil/ser7/finals2000A.all',
  'https://datacenter.iers.org/data/9/finals2000A.all',
]);
export const ISSUE_TITLE = 'ΔT table needs a refresh';
export const TZ_ISSUE_TITLE = 'Time zone data needs a refresh';

const DAY_MS = 86_400_000;
const MJD_EPOCH_MS = Date.UTC(1858, 10, 17);
/** astronomy-engine's ut counts days from 2000-01-01T12:00Z, MJD 51544.5. */
const MJD_J2000 = 51_544.5;
const TT_MINUS_TAI = 32.184;
const VALUE_FLOOR_SECONDS = 0.1;
const WINDOW_DAYS = 90;
const MAX_OBSERVED_AGE_DAYS = 14;
const MIN_PREDICTED_DAYS = 300;
const MIRROR_TOLERANCE_SECONDS = 0.0001;
const SPAN_THRESHOLD_SECONDS = 0.1;
const TRIES = 3;
const TZDB_URL = 'https://data.iana.org/time-zones/tzdb';
const TZDB_TIMEOUT_MS = 10_000;

/**
 * TAI − UTC from each leap second IERS has announced (Bulletin C), as the
 * date it took effect. None has been announced since 2017-01-01.
 */
export const LEAP_SECONDS = Object.freeze([
  ['1972-01-01', 10], ['1972-07-01', 11], ['1973-01-01', 12], ['1974-01-01', 13],
  ['1975-01-01', 14], ['1976-01-01', 15], ['1977-01-01', 16], ['1978-01-01', 17],
  ['1979-01-01', 18], ['1980-01-01', 19], ['1981-07-01', 20], ['1982-07-01', 21],
  ['1983-07-01', 22], ['1985-07-01', 23], ['1988-01-01', 24], ['1990-01-01', 25],
  ['1991-01-01', 26], ['1992-07-01', 27], ['1993-07-01', 28], ['1994-07-01', 29],
  ['1996-01-01', 30], ['1997-07-01', 31], ['1999-01-01', 32], ['2006-01-01', 33],
  ['2009-01-01', 34], ['2012-07-01', 35], ['2015-07-01', 36], ['2017-01-01', 37],
].map(([date, seconds]) => Object.freeze({ mjd: mjdOfDate(date), seconds })));

export function mjdOfDate(date) {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || Number.isNaN(ms)) throw new Error(`not a date: ${date}`);
  return (ms - MJD_EPOCH_MS) / DAY_MS;
}

export function dateOfMjd(mjd) {
  return new Date(MJD_EPOCH_MS + mjd * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The rows of finals2000A.all that carry a UT1 − UTC value, in file order.
 * Columns as in IERS's readme.finals2000A: MJD in 8–15, the UT1 flag in 58
 * (I or P) and UT1 − UTC in seconds in 59–68. Rows past the predictions
 * carry neither and are dropped, but they must still be daily and contiguous.
 */
export function parseFinals(text) {
  const rows = [];
  let previousMjd = null;
  let tail = false;
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (line.trim() === '') continue;
    const where = `line ${index + 1}`;
    const mjd = Number(line.slice(7, 15));
    if (!Number.isInteger(mjd)) throw new Error(`${where}: no whole MJD in columns 8–15`);
    if (previousMjd !== null && mjd !== previousMjd + 1) {
      throw new Error(`${where}: MJD ${mjd} follows ${previousMjd}; the rows are not daily and contiguous`);
    }
    previousMjd = mjd;
    const flag = line.charAt(57);
    if (flag === ' ' || flag === '') {
      tail = true;
      continue;
    }
    if (flag !== 'I' && flag !== 'P') throw new Error(`${where}: UT1 flag ${JSON.stringify(flag)} is neither I nor P`);
    if (tail) throw new Error(`${where}: a UT1 value follows rows without one`);
    const field = line.slice(58, 68);
    const ut1MinusUtc = Number(field);
    if (field.trim() === '' || !Number.isFinite(ut1MinusUtc)) throw new Error(`${where}: no UT1 − UTC in columns 59–68`);
    rows.push({ mjd, flag, ut1MinusUtc });
  }
  if (rows.length === 0) throw new Error('the file has no UT1 − UTC rows');
  return rows;
}

/** A step of UT1 − UTC between consecutive days larger than half a second is a leap second. */
function leapSteps(rows) {
  const steps = [];
  for (let index = 1; index < rows.length; index += 1) {
    const change = rows[index].ut1MinusUtc - rows[index - 1].ut1MinusUtc;
    if (Math.abs(change) > 0.5) steps.push({ mjd: rows[index].mjd, sign: Math.sign(change), change });
  }
  return steps;
}

/**
 * Checks everything but the mirrors' agreement and returns what the rest of
 * the monitor needs: the rows, TAI − UTC by MJD, and the observed and
 * predicted spans.
 */
export function validateFinals(rows, todayMjd) {
  const firstP = rows.findIndex((row) => row.flag === 'P');
  if (firstP <= 0) throw new Error('the file needs observed (I) rows followed by predicted (P) rows');
  if (rows.slice(firstP).some((row) => row.flag !== 'P')) {
    throw new Error('the file switches between I and P rows more than once');
  }
  const lastObserved = rows[firstP - 1].mjd;
  const predictedDays = rows.length - firstP;
  if (todayMjd - lastObserved > MAX_OBSERVED_AGE_DAYS) {
    throw new Error(`the last observed day, ${dateOfMjd(lastObserved)}, is more than ${MAX_OBSERVED_AGE_DAYS} days before ${dateOfMjd(todayMjd)}`);
  }
  if (predictedDays < MIN_PREDICTED_DAYS) {
    throw new Error(`the file predicts ${predictedDays} days; the monitor needs at least ${MIN_PREDICTED_DAYS}`);
  }

  const first = rows[0].mjd;
  const last = rows.at(-1).mjd;
  const known = LEAP_SECONDS.filter((leap) => leap.mjd <= first).at(-1);
  if (!known) throw new Error(`the file starts on ${dateOfMjd(first)}, before TAI − UTC was a whole number of seconds`);
  const steps = leapSteps(rows);
  const lastListed = LEAP_SECONDS.at(-1).mjd;
  for (const leap of LEAP_SECONDS.filter((entry) => entry.mjd > first && entry.mjd <= last)) {
    if (!steps.some((step) => step.mjd === leap.mjd && step.sign === 1 && step.change < 1.5)) {
      throw new Error(`UT1 − UTC has no one-second step on ${dateOfMjd(leap.mjd)}, when TAI − UTC became ${leap.seconds} s`);
    }
  }
  const stray = steps.find((step) => step.mjd <= lastListed && !LEAP_SECONDS.some((leap) => leap.mjd === step.mjd));
  if (stray) throw new Error(`UT1 − UTC steps by ${stray.change.toFixed(4)} s on ${dateOfMjd(stray.mjd)}, which is not a leap second`);

  const taiMinusUtc = new Map();
  let seconds = known.seconds;
  let stepIndex = 0;
  for (const row of rows) {
    while (stepIndex < steps.length && steps[stepIndex].mjd <= row.mjd) seconds += steps[stepIndex++].sign;
    taiMinusUtc.set(row.mjd, seconds);
  }
  if (!taiMinusUtc.has(todayMjd)) throw new Error(`the file has no UT1 − UTC for ${dateOfMjd(todayMjd)}`);
  return {
    rows,
    taiMinusUtc,
    observed: { from: dateOfMjd(first), to: dateOfMjd(lastObserved) },
    predicted: { from: dateOfMjd(rows[firstP].mjd), to: dateOfMjd(last), days: predictedDays },
    newLeapSeconds: steps.filter((step) => step.mjd > lastListed).map((step) => dateOfMjd(step.mjd)),
  };
}

/** Largest disagreement between two mirrors' observed rows, over the days both have. */
export function mirrorDisagreement(a, b) {
  const observed = new Map(a.rows.filter((row) => row.flag === 'I').map((row) => [row.mjd, row.ut1MinusUtc]));
  let largest = { seconds: 0, mjd: null };
  for (const row of b.rows) {
    if (row.flag !== 'I' || !observed.has(row.mjd)) continue;
    const seconds = Math.abs(observed.get(row.mjd) - row.ut1MinusUtc);
    if (seconds > largest.seconds) largest = { seconds, mjd: row.mjd };
  }
  return largest;
}

function iersDeltaT(file, mjd) {
  const row = file.rows.find((entry) => entry.mjd === mjd);
  return TT_MINUS_TAI + file.taiMinusUtc.get(mjd) - row.ut1MinusUtc;
}

/** The monitor's verdict for one validated file at t₀. */
export function evaluate(file, todayMjd, { table = DELTA_T_TABLE, model = deltaTAt } = {}) {
  const at = model(todayMjd - MJD_J2000);
  const iers = iersDeltaT(file, todayMjd);
  const difference = at.seconds - iers;
  const threshold = Math.max(VALUE_FLOOR_SECONDS, at.sigma);
  const daysToLastPredictionKnot = table.predictedTo - todayMjd;
  const valueFires = Math.abs(difference) > threshold;
  const windowFires = daysToLastPredictionKnot < WINDOW_DAYS;

  let worst = { seconds: -1, mjd: null };
  for (const row of file.rows) {
    if (row.flag !== 'P') continue;
    const seconds = Math.abs(model(row.mjd - MJD_J2000).seconds - iersDeltaT(file, row.mjd));
    if (seconds > worst.seconds) worst = { seconds, mjd: row.mjd };
  }

  return {
    status: valueFires || windowFires ? 'fired' : 'quiet',
    date: dateOfMjd(todayMjd),
    table: {
      model: DELTA_T_MODEL,
      version: table.version,
      digest: table.digest,
      observedTo: dateOfMjd(table.observedTo),
      predictedTo: dateOfMjd(table.predictedTo),
    },
    model: { seconds: at.seconds, sigma: at.sigma, segment: at.segment },
    iers: { seconds: iers, taiMinusUtc: file.taiMinusUtc.get(todayMjd) },
    difference,
    threshold,
    valueFires,
    daysToLastPredictionKnot,
    windowFires,
    predictionWindow: {
      from: file.predicted.from,
      to: file.predicted.to,
      largestDifference: worst.seconds,
      on: dateOfMjd(worst.mjd),
    },
    observed: file.observed,
    newLeapSeconds: file.newLeapSeconds,
  };
}

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function fetchText(url, { fetchImpl, tries, pause, timeoutMs = 120_000 }) {
  const errors = [];
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { url, text: await response.text() };
    } catch (error) {
      errors.push(`try ${attempt}: ${error?.message ?? error}`);
      if (attempt < tries) await pause(attempt * 10_000);
    }
  }
  return { url, error: errors.join('; ') };
}

/** Compare the days where both IERS and the engine predict UT1. */
export function evaluateSpan(rows, basis = timeBasis) {
  let days = 0;
  let worst = null;
  for (const row of rows) {
    if (row.flag !== 'P') continue;
    // For UTC input the engine reports a predicted source only inside its table.
    const ut1 = basis(MJD_EPOCH_MS + row.mjd * DAY_MS).timeScale.ut1MinusUtc;
    if (ut1?.source !== 'predicted') continue;
    days += 1;
    const difference = Math.abs(row.ut1MinusUtc - ut1.seconds);
    if (!worst || difference > worst.difference) {
      worst = { difference, on: dateOfMjd(row.mjd), sigma: ut1.sigma };
    }
  }
  return { days, worst, fires: worst !== null && worst.difference > SPAN_THRESHOLD_SECONDS };
}

/**
 * Fetches (or reads) the file, validates each copy, and evaluates the freshest
 * valid one. Never throws for a mirror's failure; returns status "failed" with
 * the reasons when no copy is usable or the copies disagree.
 */
export async function runMonitor({
  today = new Date(),
  sources = null,
  fetchImpl = fetch,
  mirrors = MIRRORS,
  tries = TRIES,
  pause = wait,
  table = DELTA_T_TABLE,
  model = deltaTAt,
} = {}) {
  const todayMjd = Math.floor((today.getTime() - MJD_EPOCH_MS) / DAY_MS);
  const copies = sources ?? await Promise.all(mirrors.map((url) => fetchText(url, { fetchImpl, tries, pause })));
  const valid = [];
  const problems = [];
  for (const copy of copies) {
    if (copy.error) {
      problems.push(`${copy.url}: ${copy.error}`);
      continue;
    }
    try {
      valid.push({ url: copy.url, ...validateFinals(parseFinals(copy.text), todayMjd) });
    } catch (error) {
      problems.push(`${copy.url}: ${error.message}`);
    }
  }
  const date = dateOfMjd(todayMjd);
  if (valid.length === 0) return { status: 'failed', date, problems };
  if (valid.length > 1) {
    const disagreement = mirrorDisagreement(valid[0], valid[1]);
    if (disagreement.seconds > MIRROR_TOLERANCE_SECONDS) {
      return {
        status: 'failed',
        date,
        problems: [...problems, `the mirrors' observed UT1 − UTC differ by ${(disagreement.seconds * 1000).toFixed(3)} ms on ${dateOfMjd(disagreement.mjd)}`],
      };
    }
  }
  const freshest = valid.reduce((best, copy) => (copy.observed.to > best.observed.to ? copy : best));
  const result = evaluate(freshest, todayMjd, { table, model });
  const span = evaluateSpan(freshest.rows);
  return {
    ...result,
    status: span.fires ? 'fired' : result.status,
    span,
    source: freshest.url,
    mirrorsValid: valid.length,
    problems,
  };
}

const TZDB_RELEASE = /^\d{4}[a-z]+$/u;
const TZDB_NEWS_SECTIONS = new Set(['Briefly:', 'Changes to past timestamps', 'Changes to future timestamps']);

function isLaterRelease(candidate, installed) {
  const year = Number(candidate.slice(0, 4));
  const installedYear = Number(installed.slice(0, 4));
  return year > installedYear || (year === installedYear && candidate.slice(4) > installed.slice(4));
}

function newsForNewReleases(news, installed, latest) {
  const releases = new Map();
  let lines;
  let keep = false;
  for (const line of news.split(/\r?\n/u)) {
    const release = /^Release (\d{4}[a-z]+)(?:\s|$)/u.exec(line)?.[1];
    if (release) {
      lines = undefined;
      keep = false;
      if (isLaterRelease(release, installed) && !isLaterRelease(release, latest)) {
        lines = [`### ${release}`, ''];
        releases.set(release, lines);
      }
    } else if (lines) {
      if (/^ {2}\S/u.test(line)) {
        keep = TZDB_NEWS_SECTIONS.has(line.trimEnd().slice(2));
        if (keep) lines.push('', `#### ${line.trim()}`, '');
      } else if (keep) {
        lines.push(line.trim());
      }
    }
  }
  return releases;
}

export async function runTzdbMonitor({ installed = TZDB.version, fetchImpl = fetch, pause = wait } = {}) {
  const options = { fetchImpl, tries: TRIES, pause, timeoutMs: TZDB_TIMEOUT_MS };
  const version = await fetchText(`${TZDB_URL}/version`, options);
  if (version.error) return { status: 'failed', problem: `${version.url}: ${version.error}` };
  const latest = version.text.trim();
  if (!TZDB_RELEASE.test(latest)) return { status: 'failed', problem: `${version.url}: invalid release version` };
  if (!isLaterRelease(latest, installed)) return { status: 'quiet', installed, latest };

  const news = await fetchText(`${TZDB_URL}/NEWS`, options);
  if (news.error) return { status: 'failed', problem: `${news.url}: ${news.error}` };
  const releases = newsForNewReleases(news.text, installed, latest);
  if (!releases.has(latest)) return { status: 'failed', problem: `${news.url}: release ${latest} is missing` };
  const notes = [...releases.values()].map((lines) => lines.join('\n').trimEnd()).join('\n\n');
  return { status: 'fired', installed, latest, notes };
}

const seconds = (value, digits = 4) => `${value.toFixed(digits)} s`;

export function renderReport(result) {
  if (result.status === 'failed') {
    return [
      `## ΔT monitor, ${result.date}: IERS could not be read`,
      '',
      'No mirror gave a valid finals2000A.all, so the table was not checked this week.',
      '',
      ...result.problems.map((problem) => `- ${problem}`),
      '',
    ].join('\n');
  }
  const verdict = result.status === 'fired' ? 'the table needs a refresh' : 'no refresh needed';
  const lines = [
    `## ΔT monitor, ${result.date}: ${verdict}`,
    '',
    `Table ${result.table.version} (${result.table.model}, digest ${result.table.digest}), last prediction knot ${result.table.predictedTo}. IERS file from ${result.source}: observed to ${result.observed.to}, predicted to ${result.predictionWindow.to}.`,
    '',
    '| Check | Value | Fires when | Fires |',
    '| --- | --- | --- | --- |',
    `| Model − IERS at ${result.date} | ${seconds(result.model.seconds)} − ${seconds(result.iers.seconds)} = ${result.difference >= 0 ? '+' : '−'}${seconds(Math.abs(result.difference))} | above ${seconds(result.threshold)} (the larger of 0.1 s and σ) | ${result.valueFires ? 'yes' : 'no'} |`,
    `| Days to the last prediction knot | ${result.daysToLastPredictionKnot} | fewer than ${WINDOW_DAYS} | ${result.windowFires ? 'yes' : 'no'} |`,
    '',
    `Largest |model − IERS| over IERS's predictions (${result.predictionWindow.from} to ${result.predictionWindow.to}): ${seconds(result.predictionWindow.largestDifference)}, on ${result.predictionWindow.on}.`,
  ];
  if (result.newLeapSeconds.length > 0) {
    lines.push('', `IERS's predictions include a leap second not in the monitor's list: ${result.newLeapSeconds.join(', ')}.`);
  }
  if (result.problems.length > 0) {
    lines.push('', 'Mirror problems this run:', '', ...result.problems.map((problem) => `- ${problem}`));
  }
  if (result.span) {
    const { days, worst, fires } = result.span;
    const peak = worst ? `Largest absolute difference: ${seconds(worst.difference)} on ${worst.on} (engine σ ${seconds(worst.sigma)}).` : 'No overlapping predictions.';
    lines.push('', `UT1 span: ${days} days compared. ${peak} Fires above ${seconds(SPAN_THRESHOLD_SECONDS, 1)}: ${fires ? 'yes' : 'no'}.`);
  }
  if (result.status === 'fired') {
    lines.push('', 'A refresh is an engine release with a new table (docs/platform/evidence/deltat-2026-09-25/README.md §6), taken into the site through a normal pull request.');
  }
  lines.push('');
  return lines.join('\n');
}

function renderTzdbReport(result) {
  const heading = result.status === 'fired' ? `## ${TZ_ISSUE_TITLE}` : '## Time zone data monitor';
  if (result.status === 'failed') return `${heading}\n\nIANA data could not be read. ${result.problem}\n`;
  const versions = `The engine ships ${result.installed}. IANA reports ${result.latest}.`;
  if (result.status === 'quiet') return `${heading}\n\n${versions} No newer release.\n`;
  return `${heading}\n\n${versions}\n\n${result.notes}\n\nSource: ${TZDB_URL}/NEWS\n`;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
}

async function main() {
  const date = argument('--date');
  const finals = process.argv.flatMap((value, index) => (process.argv[index - 1] === '--finals' ? [value] : []));
  const summary = argument('--summary') ?? process.env.GITHUB_STEP_SUMMARY ?? null;
  const issueBody = argument('--issue-body');
  const tzIssueBody = argument('--tz-issue-body');
  const githubOutput = argument('--github-output') ?? process.env.GITHUB_OUTPUT ?? null;
  const sources = finals.length > 0
    ? await Promise.all(finals.map(async (path) => ({ url: path, text: await readFile(path, 'utf8') })))
    : null;
  const [result, tz] = await Promise.all([
    runMonitor({ today: date ? new Date(`${date}T00:00:00Z`) : new Date(), sources }),
    runTzdbMonitor(),
  ]);
  const report = renderReport(result);
  const tzReport = renderTzdbReport(tz);
  const fullReport = `${report}\n${tzReport}`;
  process.stdout.write(fullReport);
  if (summary) await appendFile(summary, fullReport);
  if (issueBody && result.status !== 'quiet') await writeFile(issueBody, report);
  if (tzIssueBody && tz.status === 'fired') await writeFile(tzIssueBody, tzReport);
  if (githubOutput) await appendFile(githubOutput, `status=${result.status}\ntz_status=${tz.status}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
