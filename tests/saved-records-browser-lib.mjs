/**
 * Shared page helpers for the saved calculation records browser drives. Every
 * selector is a stable data hook of the calculator or the records panel; the
 * helpers wait for real state changes rather than fixed delays.
 */
import { readFile } from 'node:fs/promises';

export const KEEP_OUTCOMES = ['kept', 'uncertain', 'changed', 'failed', 'full', 'unavailable', 'locked', 'read-only', 'pending', 'stale'];

export function recordHelpers(base) {
  async function gotoChart(page) {
    await page.goto(`${base}/birth-chart/`);
    await page.waitForSelector('astro-island[component-url*="ChartCalculator"]:not([ssr])');
    await page.waitForSelector('.calc__form[aria-busy="false"]');
  }

  async function computeKnownTime(page, { date = '1990-06-15', time = '14:30', place = 'London', timeKnown = true, expectKeep = true } = {}) {
    await gotoChart(page);
    await page.fill('#birth-date', date);
    if (timeKnown) await page.fill('#birth-time', time);
    else {
      await page.check('.calc__form .field__toggle input[type="checkbox"]');
      await page.waitForSelector('#birth-time[disabled]');
    }
    await page.fill('#place', place);
    await page.waitForSelector('#place-opt-0');
    await page.press('#place', 'Enter');
    await page.waitForSelector('.place--selected');
    await page.click('.calc__submit');
    await page.waitForSelector('.calc__three');
    // The receipt and keep actions sit inside the collapsed "More ways" disclosure.
    await page.waitForSelector('details[data-chart-more]');
    await page.evaluate(() => { document.querySelector('details[data-chart-more]').open = true; });
    await page.waitForSelector('[data-download-calculation-receipt]:not([disabled])');
    // A build without the record feature offers no keep affordance at all.
    if (expectKeep) await page.waitForSelector('[data-keep-calculation-record]');
  }

  async function keepState(page) {
    return page.getAttribute('[data-record-keep]', 'data-record-keep-state');
  }

  async function waitKeepState(page, states, options = {}) {
    const wanted = [].concat(states);
    // The state that satisfied the wait, not a second read: a re-open can move
    // the state on between the two.
    const matched = await page.waitForFunction((list) => {
      const state = document.querySelector('[data-record-keep]')?.getAttribute('data-record-keep-state');
      return list.includes(state) ? state : null;
    }, wanted, options);
    return matched.jsonValue();
  }

  async function keep(page) {
    for (let attempt = 0; ; attempt++) {
      await page.waitForFunction(() => !document.querySelector('[data-keep-calculation-record]')?.disabled
        || document.querySelector('[data-record-keep-message]'));
      // Record whether this click reaches the button at all.
      await page.evaluate(() => {
        window.__recordKeepClicked = false;
        if (window.__recordKeepProbe) return;
        window.__recordKeepProbe = true;
        document.addEventListener('click', (event) => {
          if (event.target instanceof Element && event.target.closest('[data-keep-calculation-record]')) window.__recordKeepClicked = true;
        }, true);
      });
      await page.click('[data-keep-calculation-record]');
      // A click that reached the button ran a keep: report its stated outcome
      // and never click again on the visitor's behalf, because a second click
      // is a second keep.
      if (await page.evaluate(() => window.__recordKeepClicked)) return waitKeepState(page, KEEP_OUTCOMES, { timeout: 30_000 });
      // A click can land in the instant a concurrent re-open (another tab
      // changed the records) disables the button. A disabled button receives
      // no click, nothing ran, and a person clicks again.
      if (attempt >= 2) throw new Error('The keep button never received the click.');
    }
  }

  async function downloadBytes(page, selector) {
    const [download] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
    return { name: download.suggestedFilename(), bytes: await readFile(await download.path()) };
  }

  async function waitRecordsSettled(page) {
    await page.waitForSelector('[data-saved-records]');
    await page.waitForFunction(() => {
      const state = document.querySelector('[data-saved-records]')?.getAttribute('data-saved-records-state');
      return state && state !== 'loading';
    });
    return page.getAttribute('[data-saved-records]', 'data-saved-records-state');
  }

  async function gotoProfile(page) {
    await page.goto(`${base}/profile/`);
    return waitRecordsSettled(page);
  }

  async function recordCount(page) {
    const empty = await page.$('[data-records-empty]');
    if (empty) return 0;
    return Number(await page.getAttribute('[data-records-count]', 'data-records-count'));
  }

  async function removeRecord(page, index = 0) {
    const buttons = await page.$$('[data-record-remove]');
    await buttons[index].click();
    await buttons[index].click();
    await page.waitForFunction((expected) => {
      const count = document.querySelector('[data-records-count]')?.getAttribute('data-records-count');
      return document.querySelector('[data-records-empty]') !== null || Number(count) === expected;
    }, (await page.$$('[data-record-remove]')).length - 1);
  }

  /** Raw, content-free view of the durable rows; never creates the database. */
  const durableRows = (page) => page.evaluate(async () => {
    const present = (await indexedDB.databases()).some((entry) => entry.name === 'zodiacs-saved-natal-v1');
    if (!present) return { present: false, records: [], admissions: [] };
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('zodiacs-saved-natal-v1');
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['records', 'admissions'], 'readonly');
        const records = transaction.objectStore('records').getAll();
        const admissions = transaction.objectStore('admissions').getAll();
        transaction.oncomplete = () => {
          database.close();
          resolve({ present: true,
            records: records.result.map((row) => ({ ownerKey: row.ownerKey, id: row.id })),
            admissions: admissions.result.map((row) => ({ target: row.target, generation: row.generation, status: row.status })) });
        };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
      };
      request.onerror = () => reject(request.error);
    });
  });

  return { gotoChart, computeKnownTime, keepState, waitKeepState, keep, downloadBytes, waitRecordsSettled, gotoProfile, recordCount, removeRecord, durableRows };
}
