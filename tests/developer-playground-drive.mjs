/**
 * Browser acceptance for the compute API playground at /developers/playground/.
 *
 *   node tests/developer-playground-drive.mjs                                 # this build, the API answered by its function bundle
 *   node tests/developer-playground-drive.mjs --base-url https://zodiacs.org  # production and its API
 *
 * For every request the playground offers (its examples.json), a person's path
 * and an agent's:
 * - in Chromium, it opens the request's link, sends it to the API, runs it in
 *   the browser, and reads back the statuses, each citation check and the
 *   comparisons: the API with the browser, and each with the documented answer;
 * - without a browser, it sends the body the Markdown twin gives to the API
 *   and compares the answer with the documented one.
 * Then the controls: an answer that differs and a citation that does not match
 * must be named as such, the link must carry the request only when asked, and
 * nothing may be sent before Send is pressed.
 *
 * On a local build there is no API, so the drive answers /api/v1/* with the
 * function's own bundle, api/_compute/compute.mjs, as production runs it. The
 * results are written to the file named by --out, if any.
 */
import { writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { chromium } from 'playwright-core';
import { createComputeApiHandler } from '../api/_compute/compute.mjs';
import { createLocalTimeModule } from '../api/_compute/local-time.mjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const BASE_URL = option('--base-url');
const OUT = option('--out');
// The API is rate limited per address: a production run spaces its requests.
const PAUSE_MS = BASE_URL ? 1500 : 0;

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined || ok ? '' : ` · ${JSON.stringify(detail).slice(0, 400)}`}`);
};
const pause = () => new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
const REPRODUCED = new Set(['same', 'runtime', 'rounding']);

/** The compute API's answer to one request, from the function's bundle, with a fresh resolver as the function has. */
async function localAnswer(endpoint, body, headers) {
  const localTime = createLocalTimeModule();
  try {
    const req = Readable.from(body ? [Buffer.from(body, 'utf8')] : []);
    req.method = 'POST';
    req.url = `/api/compatibility?__zodiacs_compute=${endpoint}`;
    req.query = { __zodiacs_compute: endpoint };
    req.headers = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
    const sent = { status: 0, headers: {}, body: '' };
    const res = {
      set statusCode(value) { sent.status = value; },
      get statusCode() { return sent.status; },
      setHeader(name, value) { sent.headers[name.toLowerCase()] = String(value); },
      end(text) { sent.body = text ?? ''; },
    };
    await createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' })(req, res);
    return sent;
  } finally {
    localTime.dispose();
  }
}

/** The documented answer and another, compared as the page compares them, without the runtime's names. */
function reproduces(documented, answer) {
  const strip = (value) => {
    const copy = JSON.parse(JSON.stringify(value));
    if (copy?.receipt?.provenance?.runtime) copy.receipt.provenance.runtime = '<runtime>';
    if (copy?.receipt?.timeResolution && 'runtimeTzdb' in copy.receipt.timeResolution) copy.receipt.timeResolution.runtimeTzdb = '<runtime>';
    if (copy?.cite?.receipt) copy.cite.receipt = '<digest>';
    return copy;
  };
  const left = JSON.stringify(strip(documented), (key, value) => (typeof value === 'number' ? Math.round(value * 1e7) / 1e7 : value));
  const right = JSON.stringify(strip(answer), (key, value) => (typeof value === 'number' ? Math.round(value * 1e7) / 1e7 : value));
  return left === right;
}

async function readPage(page) {
  return page.evaluate(() => {
    const panel = (side) => document.querySelector(`[data-answer="${side}"]`);
    const comparison = document.querySelector('[data-comparison]');
    return {
      hosted: panel('hosted')?.querySelector('[data-status]')?.getAttribute('data-status') ?? null,
      here: panel('here')?.querySelector('[data-status]')?.getAttribute('data-status') ?? null,
      hostedCitation: panel('hosted')?.querySelector('[data-citation]')?.getAttribute('data-citation') ?? null,
      hereCitation: panel('here')?.querySelector('[data-citation]')?.getAttribute('data-citation') ?? null,
      between: comparison?.querySelector(':scope > [data-verdict]')?.getAttribute('data-verdict') ?? null,
      documentedHosted: comparison?.querySelector('[data-documented="hosted"]')?.getAttribute('data-documented-verdict') ?? null,
      documentedHere: comparison?.querySelector('[data-documented="here"]')?.getAttribute('data-documented-verdict') ?? null,
      body: document.querySelector('[data-request-body]')?.value ?? null,
      example: document.querySelector('[data-example-select]')?.value ?? null,
      link: document.querySelector('[data-link]')?.textContent ?? null,
      problems: [...document.querySelectorAll('.pg__error')].map((node) => node.textContent),
    };
  });
}

async function openRequest(page, baseURL, query) {
  await page.goto(`${baseURL}/developers/playground/${query}`, { waitUntil: 'load' });
  await page.locator('[data-example-select]:not([disabled])').waitFor({ timeout: 20_000 });
  await page.waitForFunction(() => (document.querySelector('[data-request-body]')?.value ?? '') !== '');
}

async function sendAndRun(page) {
  await page.locator('[data-send]').click();
  await page.locator('[data-answer="hosted"] [data-status], [data-answer="hosted"] .pg__error').first().waitFor({ timeout: 30_000 });
  await page.locator('[data-run-here]').click();
  await page.locator('[data-answer="here"] [data-status], [data-answer="here"] .pg__error').first().waitFor({ timeout: 60_000 });
}

async function drive(baseURL) {
  const document = await (await fetch(`${baseURL}/developers/playground/examples.json`)).json();
  const twin = await (await fetch(`${baseURL}/developers/playground.md`)).text();
  const offered = [...document.examples, ...document.refusals];
  check('examples.json offers the documented requests and the refusals a body provokes', document.schema === 'zodiacs.playground-examples.v1' && document.examples.length === 14 && document.refusals.length === 3, { examples: document.examples.length, refusals: document.refusals.length });

  // An agent's path: the Markdown twin's request, sent without a browser.
  for (const example of offered) {
    const listed = twin.includes(`### ${example.id}: `) && twin.includes(`?example=${example.id}`);
    const text = typeof example.body === 'string' ? example.body : JSON.stringify(example.body);
    const curl = twin.includes(`--data-raw '${text.replaceAll("'", "'\\''")}'`);
    let answer;
    if (BASE_URL) {
      await pause();
      const response = await fetch(`${BASE_URL}/api/v1/${example.endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text });
      answer = { status: response.status, body: await response.text() };
    } else {
      answer = await localAnswer(example.endpoint, text, { 'content-type': 'application/json' });
    }
    const parsed = JSON.parse(answer.body);
    check(`agent: ${example.id} is in the twin with its request, and the API's answer reproduces the documented one`, listed && curl && answer.status === example.status && reproduces(example.answer, parsed), { listed, curl, status: answer.status });
  }

  const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const apiRequests = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1/')) apiRequests.push(request.url());
    });
    if (!BASE_URL) {
      await page.route('**/api/v1/*', async (route) => {
        const request = route.request();
        const endpoint = new URL(request.url()).pathname.split('/').pop();
        const answer = await localAnswer(endpoint, request.postData() ?? '', request.headers());
        await route.fulfill({ status: answer.status, headers: answer.headers, body: answer.body });
      });
    }

    // A person's path: every request, by its link.
    for (const example of offered) {
      await openRequest(page, baseURL, `?example=${example.id}`);
      const loaded = await readPage(page);
      const sentBefore = apiRequests.length;
      await pause();
      await sendAndRun(page);
      const read = await readPage(page);
      const status = String(example.status);
      const citations = example.status === 200 ? read.hostedCitation === 'matches' && read.hereCitation === 'matches' : true;
      check(
        `person: ${example.id} opens by its link, and the API, the browser and the documentation agree`,
        loaded.example === example.id && read.hosted === status && read.here === status && citations
          && REPRODUCED.has(read.between) && REPRODUCED.has(read.documentedHosted) && REPRODUCED.has(read.documentedHere)
          && apiRequests.length === sentBefore + 1 && read.problems.length === 0,
        read,
      );
    }

    // Controls: an answer that differs, and a citation that does not match its receipt, are named as such.
    const chart = document.examples.find((example) => example.id === 'chart.utc');
    await openRequest(page, baseURL, '?example=chart.utc');
    const moved = structuredClone(chart.answer);
    moved.result.bodies[0].lon += 0.001;
    await page.route('**/api/v1/chart', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(moved) }), { times: 1 });
    await sendAndRun(page);
    let read = await readPage(page);
    check('control: an API answer with the Sun moved 0.001° is called different from the browser\'s and the documented one', read.between === 'different' && read.documentedHosted === 'different' && read.documentedHere !== 'different', read);
    const forged = structuredClone(chart.answer);
    forged.cite.receipt = `sha256:${'0'.repeat(64)}`;
    await page.route('**/api/v1/chart', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(forged) }), { times: 1 });
    await page.locator('[data-send]').click();
    await page.waitForFunction(() => document.querySelector('[data-answer="hosted"] [data-citation]')?.getAttribute('data-citation') === 'differs');
    read = await readPage(page);
    check('control: a citation that is not its receipt\'s digest is called out', read.hostedCitation === 'differs' && read.hereCitation === 'matches', read);

    // An edited request: no documented answer applies, and nothing is sent until Send.
    await openRequest(page, baseURL, '?example=chart.utc');
    const edited = JSON.stringify({ ...chart.body, latitude: 40.4168, longitude: -3.7038 }, null, 2);
    const before = apiRequests.length;
    await page.locator('[data-request-body]').fill(edited);
    await page.locator('[data-run-here]').click();
    await page.locator('[data-answer="here"] [data-status]').waitFor({ timeout: 60_000 });
    read = await readPage(page);
    check('an edited request runs in the browser without a request to the API, and no documented answer is applied to it', apiRequests.length === before && read.here === '200' && read.documentedHere === null && !read.link.includes('example='), { ...read, sent: apiRequests.length - before });

    // The link carries the request only when asked, after the #.
    const plain = new URL(read.link);
    await page.locator('[data-include-request]').check();
    const carrying = new URL((await readPage(page)).link);
    check('the link names the endpoint only, until the box is ticked; then the request goes after the #', plain.search === '?endpoint=chart' && plain.hash === '' && carrying.search === '?endpoint=chart' && carrying.hash.startsWith('#request='), { plain: plain.href, carrying: carrying.href });
    const reopened = await context.newPage();
    await reopened.goto(carrying.href.replace(carrying.origin, baseURL), { waitUntil: 'load' });
    await reopened.locator('[data-example-select]:not([disabled])').waitFor({ timeout: 20_000 });
    const reopenedRead = await readPage(reopened);
    check('a link with the request reopens that request, as the user\'s own', JSON.parse(reopenedRead.body).latitude === 40.4168 && reopenedRead.example === '', { example: reopenedRead.example });
    await reopened.close();

    // The code tabs show the request in each language.
    const languages = {};
    for (const language of ['curl', 'javascript', 'python', 'swift', 'ruby']) {
      await page.locator(`[data-language="${language}"]`).click();
      languages[language] = await page.locator(`[data-code="${language}"]`).textContent();
    }
    check('the code shows the request in cURL, JavaScript, Python, Swift and Ruby', Object.values(languages).every((code) => code.includes('/api/v1/chart') && code.includes('40.4168')), Object.keys(languages));

    // A copy button says so only while the page still shows what it copied (Codex's second finding on #767). The
    // clipboard is a stand-in whose writes finish when the drive says, so a copy can finish after the page changed.
    await openRequest(page, baseURL, '?example=chart.utc');
    await page.evaluate(() => {
      window.copies = [];
      window.copyDelay = 0;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (text) => new Promise((resolve) => {
            setTimeout(() => {
              window.copies.push(text);
              resolve();
            }, window.copyDelay);
          }),
        },
      });
    });
    const settle = async (count) => {
      await page.waitForFunction((n) => window.copies.length === n, count, { timeout: 10_000 });
      await page.waitForTimeout(200);
    };
    const codeButton = () => page.locator('[data-copy-code]').innerText();
    const linkButton = () => page.locator('.pg__link [data-details-link]').innerText();
    const withLatitude = (latitude) => JSON.stringify({ ...chart.body, latitude }, null, 2);

    await page.locator('[data-copy-code]').click();
    await settle(1);
    const copiedCode = {
      button: await codeButton(),
      same: (await page.evaluate(() => window.copies[0])) === (await page.locator('[data-code]').textContent()),
    };
    await page.locator('[data-request-body]').fill(withLatitude(12));
    const afterEdit = await codeButton();
    check('after the code is copied, changing the request takes "Copied" away', copiedCode.button === 'Copied' && copiedCode.same && afterEdit === 'Copy the code', { copiedCode, afterEdit });

    await page.evaluate(() => {
      window.copyDelay = 1500;
    });
    await page.locator('[data-copy-code]').click();
    await page.locator('[data-request-body]').fill(withLatitude(13));
    await settle(2);
    const lateRequest = await codeButton();
    check('a code copy that finishes after the request changed is not shown as done', lateRequest === 'Copy the code', { lateRequest });

    await page.locator('[data-copy-code]').click();
    await page.locator('[data-language="python"]').click();
    await settle(3);
    const lateLanguage = await codeButton();
    check('a code copy that finishes after the language changed is not shown as done', lateLanguage === 'Copy the code', { lateLanguage });

    await page.locator('[data-include-request]').check();
    await page.locator('.pg__link [data-details-link]').click();
    await page.locator('[data-request-body]').fill(withLatitude(14));
    await settle(4);
    const lateLink = await linkButton();
    check('a link copy that finishes after the request in the link changed is not shown as done', lateLink.includes('Copy the link'), { lateLink });

    await page.locator('.pg__link [data-details-link]').click();
    await page.locator('[data-include-request]').uncheck();
    await settle(5);
    const lateBox = await linkButton();
    check('a link copy that finishes after the box changed the link is not shown as done', lateBox.includes('Copy the link'), { lateBox });

    // A receipt computed in this browser names the browser as its runtime, and no tzdb release (Codex's third review).
    const local = document.examples.find((example) => example.id === 'chart.local');
    const provenance = await page.evaluate(async ([path, body]) => {
      const engine = await import(path);
      const answer = await engine.answerHere('chart', body);
      return answer.body?.receipt?.provenance ?? null;
    }, ['/developers/playground/engine.mjs', JSON.stringify(local.body)]);
    check('a receipt computed in this browser names the browser as its runtime, with no tzdb release', JSON.stringify(provenance?.runtime) === '{"name":"browser"}', { provenance });

    // Until the examples load, the request can be neither edited nor sent, so the request the page opens with never
    // replaces one someone has started (Codex's third review).
    const controls = () => page.evaluate(() => ['[data-endpoint-select]', '[data-request-body]', '[data-send]', '[data-run-here]']
      .map((selector) => document.querySelector(selector)?.disabled ?? null));
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    await page.route('**/developers/playground/examples.json', async (route) => {
      await held;
      await route.continue();
    }, { times: 1 });
    await page.goto(`${baseURL}/developers/playground/?example=chart.utc`, { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const whileLoading = await controls();
    release();
    await page.locator('[data-example-select]:not([disabled])').waitFor({ timeout: 20_000 });
    const afterLoading = await controls();
    const opened = await readPage(page);
    check('until the examples load, the request can be neither edited nor sent; then it is the example the link names', whileLoading.every((disabled) => disabled === true) && afterLoading.every((disabled) => disabled === false) && opened.example === 'chart.utc', { whileLoading, afterLoading, example: opened.example });

    // If the examples do not load, a link that carries its request still opens it, ready to send.
    await page.route('**/developers/playground/examples.json', (route) => route.abort(), { times: 1 });
    await page.goto(carrying.href.replace(carrying.origin, baseURL), { waitUntil: 'load' });
    await page.locator('.pg__error').first().waitFor({ timeout: 20_000 });
    const failed = await readPage(page);
    const usable = await controls();
    const latitude = (() => {
      try {
        return JSON.parse(failed.body).latitude;
      } catch {
        return null;
      }
    })();
    check('when the examples do not load, a link that carries its request still opens it, ready to send', latitude === 40.4168 && usable.every((disabled) => disabled === false), { body: failed.body, usable });

    // The code and the documented answer follow the request as it stands: an example padded past the size the API
    // measures before it reads a body is refused as sent, the code sends the padding too, and no documented answer
    // applies (Codex's fourth review).
    await openRequest(page, baseURL, '?example=chart.utc');
    const paddedText = `${JSON.stringify(chart.body)}${' '.repeat(16_384)}`;
    await page.locator('[data-request-body]').fill(paddedText);
    await pause();
    await page.locator('[data-send]').click();
    await page.locator('[data-answer="hosted"] [data-status]').waitFor({ timeout: 30_000 });
    const padded = await readPage(page);
    await page.locator('[data-language="curl"]').click();
    const paddedCode = (await page.locator('[data-code="curl"]').textContent()).includes(paddedText);
    check('an example padded past the size limit is refused as sent, its code sends the padding too, and no documented answer applies', padded.hosted === '413' && padded.documentedHosted === null && paddedCode && !padded.link.includes('example='), { hosted: padded.hosted, documentedHosted: padded.documentedHosted, paddedCode, link: padded.link });

    // An answer is shown only beside the request that produced it (Codex's first finding on #767).
    await openRequest(page, baseURL, '?example=chart.utc');
    let lateAnswered = false;
    await page.route('**/api/v1/chart', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (BASE_URL) {
        await route.continue();
      } else {
        const answer = await localAnswer('chart', route.request().postData() ?? '', route.request().headers());
        await route.fulfill({ status: answer.status, headers: answer.headers, body: answer.body });
      }
      lateAnswered = true;
    }, { times: 1 });
    await pause();
    await page.locator('[data-send]').click();
    await page.locator('[data-request-body]').fill(JSON.stringify({ ...chart.body, latitude: 10 }, null, 2));
    await page.waitForTimeout(4500);
    read = await readPage(page);
    check('an answer that arrives after its request was edited is not shown, and nothing is compared', lateAnswered && read.hosted === null && read.here === null && read.between === null && read.problems.length === 0, { ...read, lateAnswered });

    // A phone's width, with both answers and their comparison on the page: nothing scrolls sideways.
    await pause();
    await sendAndRun(page);
    const answered = await readPage(page);
    await page.setViewportSize({ width: 375, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('at 375 px the page does not scroll sideways', overflow <= 0 && answered.between !== null, { overflow, between: answered.between });

    // Changing the request takes both answers and their comparison away.
    await page.locator('[data-request-body]').fill(JSON.stringify({ ...chart.body, latitude: 11 }, null, 2));
    read = await readPage(page);
    check('changing the request clears both answers and the comparison', answered.hosted === '200' && answered.here === '200' && read.hosted === null && read.here === null && read.between === null, { answered, read });
    await context.close();
  } finally {
    await browser.close();
  }
}

if (BASE_URL) await drive(BASE_URL.replace(/\/$/u, ''));
else await withPreview({ port: 4347 }, (baseURL) => drive(baseURL));

const failed = results.filter(({ ok }) => !ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed${BASE_URL ? ` against ${BASE_URL}` : ' on this build'}.`);
if (OUT) await writeFile(OUT, `${JSON.stringify({ baseUrl: BASE_URL ?? 'local build', checkedAt: new Date().toISOString(), results }, null, 2)}\n`);
process.exit(failed.length ? 1 : 0);
