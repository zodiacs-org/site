/**
 * Hero poster-motion and deferred-video gates against the production build.
 *
 *   npm run build
 *   OUT_DIR=/tmp/hero-video node tests/hero-video-drive.mjs
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const OUT = process.env.OUT_DIR ?? null;
const cases = [
  {
    name: 'mobile-normal',
    viewport: { width: 390, height: 844 },
    effectiveType: '4g',
    saveData: false,
    reducedMotion: 'no-preference',
    drifts: true,
    attachesAfterInteraction: true,
  },
  {
    name: 'mobile-2g',
    viewport: { width: 390, height: 844 },
    effectiveType: '2g',
    saveData: false,
    reducedMotion: 'no-preference',
    drifts: true,
    attachesAfterInteraction: false,
  },
  {
    name: 'mobile-save-data',
    viewport: { width: 390, height: 844 },
    effectiveType: '4g',
    saveData: true,
    reducedMotion: 'no-preference',
    drifts: true,
    attachesAfterInteraction: false,
  },
  {
    name: 'mobile-reduced-motion',
    viewport: { width: 390, height: 844 },
    effectiveType: '4g',
    saveData: false,
    reducedMotion: 'reduce',
    drifts: false,
    attachesAfterInteraction: false,
  },
  {
    name: 'desktop-normal',
    viewport: { width: 1440, height: 1000 },
    effectiveType: '4g',
    saveData: false,
    reducedMotion: 'no-preference',
    drifts: false,
    attachesInitially: true,
    attachesAfterInteraction: true,
  },
  {
    name: 'mobile-play-failure',
    viewport: { width: 390, height: 844 },
    effectiveType: '4g',
    saveData: false,
    reducedMotion: 'no-preference',
    drifts: true,
    attachesAfterInteraction: false,
    playRejects: true,
  },
  {
    name: 'mobile-interrupted-start',
    viewport: { width: 390, height: 844 },
    effectiveType: '4g',
    saveData: false,
    reducedMotion: 'no-preference',
    drifts: true,
    attachesAfterInteraction: true,
    interruptedStart: true,
  },
];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

if (OUT) await mkdir(OUT, { recursive: true });

await withPreview({ port: 4402 }, async (baseURL) => {
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    args: STABLE_CHROMIUM_ARGS,
  });

  try {
    for (const testCase of cases) {
      const page = await browser.newPage({ viewport: testCase.viewport });
      await page.emulateMedia({ reducedMotion: testCase.reducedMotion });
      await page.addInitScript(({ effectiveType, saveData, playRejects, interruptedStart }) => {
        Object.defineProperty(navigator, 'connection', {
          configurable: true,
          value: Object.freeze({ effectiveType, saveData }),
        });
        window.__heroLoadCount = 0;
        window.__heroPlayCount = 0;
        window.__heroPauseCount = 0;
        window.__heroPendingPlayReject = null;
        HTMLMediaElement.prototype.load = function trackedHeroLoad() {
          window.__heroLoadCount += 1;
        };
        HTMLMediaElement.prototype.play = function trackedHeroPlay() {
          window.__heroPlayCount += 1;
          if (interruptedStart && window.__heroPlayCount === 1) {
            return new Promise((_resolve, reject) => {
              window.__heroPendingPlayReject = reject;
            });
          }
          return playRejects
            ? Promise.reject(new DOMException('Synthetic play failure', 'NotAllowedError'))
            : Promise.resolve();
        };
        HTMLMediaElement.prototype.pause = function trackedHeroPause() {
          window.__heroPauseCount += 1;
          if (window.__heroPendingPlayReject) {
            const reject = window.__heroPendingPlayReject;
            window.__heroPendingPlayReject = null;
            queueMicrotask(() => reject(new DOMException('Playback interrupted by pause', 'AbortError')));
          }
        };
      }, {
        effectiveType: testCase.effectiveType,
        saveData: testCase.saveData,
        playRejects: Boolean(testCase.playRejects),
        interruptedStart: Boolean(testCase.interruptedStart),
      });

      await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
      const video = page.locator('[data-hero-video]');
      await video.waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelector('[data-hero-video]')?.dataset.heroVisible === 'true');
      if (testCase.attachesInitially) {
        await page.waitForFunction(() => document.querySelector('[data-hero-video]')?.dataset.heroPlayback === 'playing');
      }

      const before = await video.evaluate((element) => {
        const poster = document.querySelector('[data-hero-poster]');
        return {
          attached: element.dataset.sourcesAttached === 'true',
          playback: element.dataset.heroPlayback,
          poster: poster?.currentSrc ?? null,
          sources: [...element.querySelectorAll('source')].map((source) => source.getAttribute('src')),
          animation: poster?.getAnimations().find((item) => item.animationName === 'hero-poster-drift')?.playState ?? null,
          width: poster?.getBoundingClientRect().width ?? 0,
          height: poster?.getBoundingClientRect().height ?? 0,
        };
      });
      check(
        `${testCase.name}: initial source gate matches its viewport`,
        testCase.attachesInitially
          ? before.attached && before.sources.every(Boolean) && before.playback === 'playing'
          : !before.attached && before.sources.every((source) => source === null),
        `${before.playback} · ${JSON.stringify(before.sources)}`,
      );
      check(`${testCase.name}: poster remains the LCP surface`, /\/assets\/hero\/zodiacs-hero-poster(?:-mobile)?\.avif$/.test(before.poster ?? '') && before.width > 0 && before.height > 0, `${before.poster} · ${before.width.toFixed(0)}×${before.height.toFixed(0)}`);
      check(
        `${testCase.name}: ambient motion matches preference and viewport`,
        testCase.drifts ? before.animation === 'running' : before.animation === null,
        String(before.animation),
      );

      await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown')));
      if (testCase.interruptedStart) {
        await page.waitForFunction(() => document.querySelector('[data-hero-video]')?.dataset.heroPlayback === 'loading');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForFunction(() => document.querySelector('[data-hero-video]')?.dataset.heroVisible === 'false');
        await page.waitForFunction(() => document.querySelector('[data-hero-video]')?.dataset.heroPlayback === 'paused');
        const interrupted = await video.evaluate((element) => ({
          attached: element.dataset.sourcesAttached === 'true',
          playback: element.dataset.heroPlayback,
        }));
        check(
          'mobile-interrupted-start: intentional AbortError stays retryable',
          interrupted.attached && interrupted.playback === 'paused',
          JSON.stringify(interrupted),
        );
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForFunction(() => document.querySelector('[data-hero-video]')?.dataset.heroVisible === 'true');
        await page.waitForFunction(() => document.querySelector('[data-hero-video]')?.dataset.heroPlayback === 'playing');
        check('mobile-interrupted-start: playback resumes after returning onscreen', await page.evaluate(() => window.__heroPlayCount >= 2));
      } else if (testCase.playRejects) {
        await page.waitForFunction(() => document.querySelector('[data-hero-video]')?.dataset.heroPlayback === 'poster-fallback');
      } else if (testCase.attachesAfterInteraction) {
        await page.waitForFunction(() => document.querySelector('[data-hero-video]')?.dataset.heroPlayback === 'playing');
      } else {
        await page.waitForTimeout(120);
      }

      const after = await video.evaluate((element) => ({
        attached: element.dataset.sourcesAttached === 'true',
        interacted: element.dataset.heroInteracted === 'true',
        playback: element.dataset.heroPlayback,
        sources: [...element.querySelectorAll('source')].map((source) => source.getAttribute('src')),
      }));
      check(`${testCase.name}: interaction is recorded`, after.interacted, after.playback);
      check(
        `${testCase.name}: source gate after interaction`,
        after.attached === testCase.attachesAfterInteraction,
        `${after.playback} · ${JSON.stringify(after.sources)}`,
      );
      check(
        `${testCase.name}: source attributes follow the gate`,
        testCase.attachesAfterInteraction ? after.sources.every(Boolean) : after.sources.every((source) => source === null),
        JSON.stringify(after.sources),
      );

      if (testCase.name === 'mobile-normal') {
        const countsBeforeScroll = await page.evaluate(() => ({ play: window.__heroPlayCount, pause: window.__heroPauseCount }));
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForFunction(() => document.querySelector('[data-hero-video]')?.dataset.heroVisible === 'false');
        const offscreen = await video.evaluate((element) => ({
          playback: element.dataset.heroPlayback,
          animation: document.querySelector('[data-hero-poster]')?.getAnimations()
            .find((item) => item.animationName === 'hero-poster-drift')?.playState ?? null,
        }));
        const countsOffscreen = await page.evaluate(() => ({ play: window.__heroPlayCount, pause: window.__heroPauseCount }));
        check('mobile-normal: video pauses offscreen', countsOffscreen.pause > countsBeforeScroll.pause && offscreen.playback === 'paused', `${countsBeforeScroll.pause} → ${countsOffscreen.pause}`);
        check('mobile-normal: poster motion pauses offscreen', offscreen.animation === 'paused', String(offscreen.animation));

        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForFunction(() => document.querySelector('[data-hero-video]')?.dataset.heroVisible === 'true');
        await page.waitForFunction((previous) => window.__heroPlayCount > previous, countsOffscreen.play);
        const onscreenAnimation = await page.evaluate(() => document.querySelector('[data-hero-poster]')?.getAnimations().find((item) => item.animationName === 'hero-poster-drift')?.playState ?? null);
        check('mobile-normal: video resumes on return', true, `${countsOffscreen.play} → ${await page.evaluate(() => window.__heroPlayCount)}`);
        check('mobile-normal: poster motion resumes on return', onscreenAnimation === 'running', String(onscreenAnimation));

        const beforeRetry = await page.evaluate(() => window.__heroLoadCount);
        await video.dispatchEvent('error');
        await page.waitForFunction(() => {
          const element = document.querySelector('[data-hero-video]');
          return element?.dataset.sourceRetry === 'true'
            && element.dataset.heroPlayback === 'playing'
            && [...element.querySelectorAll('source')].every((source) => source.hasAttribute('src'));
        });
        const afterRetry = await page.evaluate(() => window.__heroLoadCount);
        await video.dispatchEvent('error');
        await page.waitForFunction(() => document.querySelector('[data-hero-video]')?.dataset.heroPlayback === 'poster-fallback');
        const afterSecondError = await page.evaluate(() => window.__heroLoadCount);
        check('mobile-normal: media error retries sources once', afterRetry >= beforeRetry + 2, `${beforeRetry} → ${afterRetry}`);
        check('mobile-normal: a second media error returns to the moving poster', afterSecondError === afterRetry + 1, `${afterRetry} → ${afterSecondError}`);
      }

      if (testCase.playRejects) {
        const fallback = await video.evaluate((element) => ({
          playback: element.dataset.heroPlayback,
          animation: document.querySelector('[data-hero-poster]')?.getAnimations()
            .find((item) => item.animationName === 'hero-poster-drift')?.playState ?? null,
        }));
        check(`${testCase.name}: rejected playback keeps the poster drifting`, fallback.playback === 'poster-fallback' && fallback.animation === 'running', `${fallback.playback} · ${fallback.animation}`);
      }

      if (testCase.name === 'desktop-normal') {
        const pause = page.locator('[data-hero-motion-toggle]');
        await pause.click();
        const stopped = await video.evaluate((element) => ({ paused: element.paused, state: element.dataset.heroPlayback, posterMotion: document.querySelector('[data-hero-poster]')?.dataset.heroMotion }));
        check('manual pause stops film and poster', stopped.paused && stopped.state === 'paused' && stopped.posterMotion === 'static', JSON.stringify(stopped));
        await page.reload({ waitUntil: 'networkidle' });
        check('manual pause survives navigation in this tab', await pause.getAttribute('aria-pressed') === 'true' && await video.evaluate((element) => !element.dataset.sourcesAttached && element.dataset.heroMotion === 'static'));
        await pause.click();
        await page.waitForFunction(() => document.querySelector('[data-hero-video]')?.dataset.heroPlayback === 'playing');
        check('manual resume restores eligible playback', await pause.getAttribute('aria-pressed') === 'false');
      }

      if (OUT) await page.locator('.hero__frame').screenshot({ path: `${OUT}/hero-${testCase.name}.png` });
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

let failed = 0;
for (const result of results) {
  if (!result.ok) failed += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` · ${result.detail}` : ''}`);
}
console.log(failed ? `\n${failed} FAILURE${failed === 1 ? '' : 'S'}` : `\nALL ${results.length} CHECKS PASS`);
process.exit(failed ? 1 : 0);
