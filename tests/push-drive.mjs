/**
 * Flags-on Sky Alerts browser acceptance.
 *
 * Build with both push flags and a fixture-safe public VAPID key first:
 *
 *   PUBLIC_WEB_PUSH_ENABLED=1 PUSH_ENABLED=1 PUBLIC_VAPID_KEY=AQIDBA npm run build
 *   node tests/push-drive.mjs
 *
 * The worker, PushManager, permission prompt, and API are all intercepted.
 * This drive never creates a real browser subscription or sends a push.
 *
 * It also drives the Moon journal's reminder control, which shares the same
 * browser subscription under its own topic, and checks that Sky Alerts and
 * the journal reminder never switch each other off.
 */
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';


const profile = {
  version: 1,
  settings: { houseSystem: 'whole' },
  charts: [{
    id: 'push-drive',
    name: 'Fixture chart',
    relationship: 'self',
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
    birth: { date: '1990-01-01', time: null, timeKnown: false, place: null },
    summary: {
      engineVersion: 'fixture',
      utcISO: '1990-01-01T12:00:00.000Z',
      houseSystem: 'whole',
      bodies: [{ body: 'Sun', lon: 20.2, retrograde: false }],
      angles: null,
      flags: [],
    },
  }],
};

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

async function openFixture(browser, baseURL, {
  returning = false,
  permission = 'default',
  permissionResult = 'denied',
  ios = false,
  standalone = false,
  preSubscribed = false,
  path = '/today/',
  postStatus = 200,
  deleteStatus = 200,
  unsubscribeResult = true,
  apiRequests = [],
  statusRequests = [],
  statusTopics = null,
  deleteRemaining = undefined,
} = {}) {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    userAgent: ios
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
      : undefined,
  });

  await context.route('**/api/push/subscribe', async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    // Status reads carry only the endpoint; they are recorded apart so the
    // enrollment and revocation counts below stay exact. Without
    // statusTopics the answer has no topics, as a server from before them.
    if (request.method() === 'POST' && body?.action === 'status') {
      statusRequests.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(statusTopics ? { ok: true, topics: statusTopics } : { ok: true }),
      });
      return;
    }
    apiRequests.push({
      method: request.method(),
      body,
    });
    await route.fulfill({
      status: request.method() === 'DELETE' ? deleteStatus : postStatus,
      contentType: 'application/json',
      body: JSON.stringify(request.method() === 'DELETE' && deleteRemaining !== undefined
        ? { ok: true, remaining: deleteRemaining }
        : { ok: true }),
    });
  });

  await context.addInitScript(({
    savedProfile,
    hasReturned,
    initialPermission,
    requestedPermission,
    installed,
    startsSubscribed,
    browserUnsubscribeResult,
  }) => {
    localStorage.clear();
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify(savedProfile));
    if (startsSubscribed) localStorage.setItem('zodiacs.push.v1', 'subscribed');
    if (hasReturned) {
      localStorage.setItem('zodiacs.today.v1', JSON.stringify({
        version: 1,
        count: 2,
        lastOpenedUtcDay: '2026-07-12',
      }));
    }

    const state = {
      permissionCalls: 0,
      registrationCalls: 0,
      getRegistrationCalls: 0,
      getSubscriptionCalls: 0,
      subscribeCalls: 0,
      unsubscribeCalls: 0,
      applicationServerKeyBytes: 0,
    };
    window.__pushDrive = state;
    window.__pushDriveLayoutShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__pushDriveLayoutShifts.push(entry.value);
      }
    }).observe({ type: 'layout-shift', buffered: true });

    const subscription = {
      endpoint: 'https://push.fixture.test/subscription/sky-alerts',
      expirationTime: null,
      toJSON: () => ({
        endpoint: 'https://push.fixture.test/subscription/sky-alerts',
        expirationTime: null,
        keys: {
          p256dh: 'fixture-p256dh',
          auth: 'fixture-auth',
        },
      }),
      unsubscribe: async () => {
        state.unsubscribeCalls += 1;
        if (browserUnsubscribeResult) activeSubscription = null;
        return browserUnsubscribeResult;
      },
    };
    let activeSubscription = startsSubscribed ? subscription : null;
    const registration = {
      pushManager: {
        getSubscription: async () => {
          state.getSubscriptionCalls += 1;
          return activeSubscription;
        },
        subscribe: async (options) => {
          state.subscribeCalls += 1;
          state.applicationServerKeyBytes = options?.applicationServerKey?.byteLength ?? 0;
          activeSubscription = subscription;
          return subscription;
        },
      },
    };

    const notification = {
      permission: initialPermission,
      requestPermission: async () => {
        state.permissionCalls += 1;
        notification.permission = requestedPermission;
        return requestedPermission;
      },
    };
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: notification,
    });
    Object.defineProperty(window, 'PushManager', {
      configurable: true,
      value: function PushManager() {},
    });
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: installed,
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: async () => {
          state.getRegistrationCalls += 1;
          return registration;
        },
        register: async () => {
          state.registrationCalls += 1;
          return registration;
        },
      },
    });
  }, {
    savedProfile: profile,
    hasReturned: returning,
    initialPermission: permission,
    requestedPermission: permissionResult,
    installed: standalone,
    startsSubscribed: preSubscribed,
    browserUnsubscribeResult: unsubscribeResult,
  });

  const page = await context.newPage();
  await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
  if (path === '/today/') await page.waitForSelector('[data-today-state="chart"]');
  if (path === '/moon-journal/') await page.waitForSelector('[data-moon-journal][data-ready="true"]');
  return { context, page };
}

await withPreview({ port: Number(process.env.PUSH_DRIVE_PORT ?? 4399) }, async (baseURL) => {
  const workerResponse = await fetch(`${baseURL}/sw.js`);
  const worker = await workerResponse.text();
  check('generated service worker is present and push-enabled',
    workerResponse.ok
      && /const PUSH_ENABLED = true; \/\/ @build push-enabled/.test(worker)
      && worker.includes("self.addEventListener('push'"),
    `status=${workerResponse.status}`);

  const browser = await chromium.launch({
    executablePath: await findChromium(),
    args: STABLE_CHROMIUM_ARGS,
  });

  try {
    const first = await openFixture(browser, baseURL);
    check('first /today/ visit does not show the push affordance',
      await first.page.locator('[data-push-optin]').count() === 0);
    const firstCalls = await first.page.evaluate(() => window.__pushDrive);
    check('first visit makes no permission or push-subscription call',
      firstCalls.permissionCalls === 0 && firstCalls.subscribeCalls === 0,
      JSON.stringify(firstCalls));
    await first.context.close();

    const denied = await openFixture(browser, baseURL, { returning: true });
    await denied.page.waitForSelector('[data-push-optin][data-push-context="today-return"]');
    await denied.page.waitForTimeout(2_100);
    check('returning Today stays free of proactive Guide popovers',
      await denied.page.locator('.zguide-invite').count() === 0);
    await denied.page.evaluate(() => new Promise((resolvePaint) => {
      requestAnimationFrame(() => requestAnimationFrame(resolvePaint));
    }));
    const returningLayout = await denied.page.evaluate(() => {
      const prompt = document.querySelector('[data-push-optin][data-push-context="today-return"]');
      const reading = document.querySelector('.today-reading--resolved');
      const details = reading?.querySelector('.today-method-details');
      const rect = prompt?.getBoundingClientRect();
      return {
        cls: window.__pushDriveLayoutShifts.reduce((sum, value) => sum + value, 0),
        position: prompt ? getComputedStyle(prompt).position : null,
        promptTop: rect?.top ?? null,
        promptRight: rect?.right ?? null,
        promptBottom: rect?.bottom ?? null,
        promptLeft: rect?.left ?? null,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        pageWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        readingBottomGap: reading && details
          ? reading.getBoundingClientRect().bottom - details.getBoundingClientRect().bottom
          : null,
      };
    });
    check('returning Today offer is stable and fully contained',
      returningLayout.cls === 0
        && returningLayout.position === 'fixed'
        && returningLayout.readingBottomGap !== null
        && Math.abs(returningLayout.readingBottomGap) <= 1
        && returningLayout.pageWidth <= returningLayout.viewportWidth
        && returningLayout.promptTop !== null
        && returningLayout.promptTop >= 0
        && returningLayout.promptRight <= returningLayout.viewportWidth
        && returningLayout.promptBottom <= returningLayout.viewportHeight
        && returningLayout.promptLeft >= 0,
      JSON.stringify(returningLayout));
    check('returning visit shows the event-only sky-alert affordance',
      await denied.page.getByText('Sky alerts, when they’re earned?').isVisible()
        && await denied.page.getByText('Most days, nothing.', { exact: false }).isVisible()
        && await denied.page.getByText('Never more than one a day, or two a week.').isVisible());
    const beforeAccept = await denied.page.evaluate(() => window.__pushDrive);
    check('native permission is not requested on page load',
      beforeAccept.permissionCalls === 0 && beforeAccept.subscribeCalls === 0,
      JSON.stringify(beforeAccept));
    await denied.page.getByRole('button', { name: 'Turn on sky alerts' }).click();
    await denied.page.getByText(
      'Notifications are blocked in this browser, so sky alerts can’t reach you.',
      { exact: false },
    ).waitFor();
    const afterAccept = await denied.page.evaluate(() => window.__pushDrive);
    check('denied permission adds no opt-in registration, subscription, or API enrollment',
      afterAccept.permissionCalls === 1
        && afterAccept.registrationCalls === 1
        && afterAccept.subscribeCalls === 0,
      JSON.stringify(afterAccept));
    await denied.context.close();

    const existing = await openFixture(browser, baseURL, {
      returning: true,
      permission: 'granted',
      preSubscribed: true,
    });
    await existing.page.waitForFunction(() => window.__pushDrive.getSubscriptionCalls > 0);
    check('an existing subscriber gets no returning-visit acquisition card',
      await existing.page.locator('[data-push-optin]').count() === 0);
    const existingCalls = await existing.page.evaluate(() => window.__pushDrive);
    check('existing-subscriber silence makes no permission or enrollment request',
      existingCalls.permissionCalls === 0
        && existingCalls.subscribeCalls === 0
        && existingCalls.getSubscriptionCalls === 1,
      JSON.stringify(existingCalls));
    await existing.context.close();

    const profileRequests = [];
    const profileSettings = await openFixture(browser, baseURL, {
      permission: 'granted',
      preSubscribed: true,
      path: '/profile/',
      apiRequests: profileRequests,
    });
    await profileSettings.page.waitForSelector('[data-push-optin][data-push-context="profile"]');
    check('Profile exposes the exact active Sky Alerts status row',
      await profileSettings.page.getByText(
        'Sky alerts · On. The dates that matter, by notification.',
        { exact: true },
      ).isVisible()
        && await profileSettings.page.getByRole('button', { name: 'Turn off' }).isVisible());
    await profileSettings.page.getByRole('button', { name: 'Turn off' }).click();
    await profileSettings.page.getByText(
      'Sky alerts · Off. The dates that matter, by notification.',
      { exact: true },
    ).waitFor();
    const profileOff = await profileSettings.page.evaluate(() => ({
      calls: window.__pushDrive,
      preference: localStorage.getItem('zodiacs.push.v1'),
    }));
    check('Profile revokes browser and server consent while keeping the Off row reachable',
      profileOff.calls.unsubscribeCalls === 1
        && profileOff.preference === 'dismissed'
        && profileRequests.length === 1
        && profileRequests[0].method === 'DELETE'
        && profileRequests[0].body?.endpoint === 'https://push.fixture.test/subscription/sky-alerts'
        && await profileSettings.page.getByRole('button', { name: 'Turn on sky alerts' }).isVisible(),
      JSON.stringify({ profileOff, profileRequests }));
    check('Profile status and reversal never trigger native permission by themselves',
      profileOff.calls.permissionCalls === 0 && profileOff.calls.subscribeCalls === 0,
      JSON.stringify(profileOff.calls));
    await profileSettings.context.close();

    const serverFailureRequests = [];
    const serverFailure = await openFixture(browser, baseURL, {
      permission: 'granted',
      preSubscribed: true,
      path: '/profile/',
      deleteStatus: 503,
      apiRequests: serverFailureRequests,
    });
    await serverFailure.page.waitForSelector('[data-push-optin][data-push-context="profile"]');
    await serverFailure.page.getByRole('button', { name: 'Turn off' }).click();
    await serverFailure.page.getByText('Sky alerts are unavailable right now.', { exact: false }).waitFor();
    const serverFailureState = await serverFailure.page.evaluate(() => ({
      calls: window.__pushDrive,
      preference: localStorage.getItem('zodiacs.push.v1'),
    }));
    check('Profile never reports Off when server revocation fails',
      await serverFailure.page.getByText(
        'Sky alerts · On. The dates that matter, by notification.',
        { exact: true },
      ).isVisible()
        && await serverFailure.page.getByRole('button', { name: 'Turn off' }).isVisible()
        && serverFailureState.preference === 'subscribed'
        && serverFailureState.calls.unsubscribeCalls === 0
        && serverFailureRequests.length === 1,
      JSON.stringify({ serverFailureState, serverFailureRequests }));
    await serverFailure.context.close();

    const browserFailureRequests = [];
    const browserFailure = await openFixture(browser, baseURL, {
      permission: 'granted',
      preSubscribed: true,
      path: '/profile/',
      unsubscribeResult: false,
      apiRequests: browserFailureRequests,
    });
    await browserFailure.page.waitForSelector('[data-push-optin][data-push-context="profile"]');
    await browserFailure.page.getByRole('button', { name: 'Turn off' }).click();
    await browserFailure.page.getByText('Sky alerts are unavailable right now.', { exact: false }).waitFor();
    const browserFailureState = await browserFailure.page.evaluate(() => ({
      calls: window.__pushDrive,
      preference: localStorage.getItem('zodiacs.push.v1'),
    }));
    check('Profile never reports Off when browser revocation fails',
      await browserFailure.page.getByText(
        'Sky alerts · On. The dates that matter, by notification.',
        { exact: true },
      ).isVisible()
        && await browserFailure.page.getByRole('button', { name: 'Turn off' }).isVisible()
        && browserFailureState.preference === 'subscribed'
        && browserFailureState.calls.unsubscribeCalls === 1
        && browserFailureRequests.length === 1,
      JSON.stringify({ browserFailureState, browserFailureRequests }));
    await browserFailure.context.close();

    const enrollmentRollbackRequests = [];
    const enrollmentRollback = await openFixture(browser, baseURL, {
      permissionResult: 'granted',
      path: '/profile/',
      postStatus: 503,
      apiRequests: enrollmentRollbackRequests,
    });
    await enrollmentRollback.page.waitForSelector('[data-push-optin][data-push-context="profile"]');
    await enrollmentRollback.page.getByRole('button', { name: 'Turn on sky alerts' }).click();
    await enrollmentRollback.page.getByText('Sky alerts are unavailable right now.', { exact: false }).waitFor();
    const enrollmentRollbackState = await enrollmentRollback.page.evaluate(() => ({
      calls: window.__pushDrive,
      preference: localStorage.getItem('zodiacs.push.v1'),
    }));
    check('Profile reports Off with a retry when failed enrollment rolls back cleanly',
      await enrollmentRollback.page.getByText(
        'Sky alerts · Off. The dates that matter, by notification.',
        { exact: true },
      ).isVisible()
        && await enrollmentRollback.page.getByRole('button', { name: 'Turn on sky alerts' }).isVisible()
        && enrollmentRollbackState.preference === 'dismissed'
        && enrollmentRollbackState.calls.subscribeCalls === 1
        && enrollmentRollbackState.calls.unsubscribeCalls === 1
        && enrollmentRollbackRequests.length === 1
        && enrollmentRollbackRequests[0].method === 'POST',
      JSON.stringify({ enrollmentRollbackState, enrollmentRollbackRequests }));
    await enrollmentRollback.context.close();

    const enrollmentRollbackFailureRequests = [];
    const enrollmentRollbackFailure = await openFixture(browser, baseURL, {
      permissionResult: 'granted',
      path: '/profile/',
      postStatus: 503,
      unsubscribeResult: false,
      apiRequests: enrollmentRollbackFailureRequests,
    });
    await enrollmentRollbackFailure.page.waitForSelector('[data-push-optin][data-push-context="profile"]');
    await enrollmentRollbackFailure.page.getByRole('button', { name: 'Turn on sky alerts' }).click();
    await enrollmentRollbackFailure.page.getByText('Sky alerts are unavailable right now.', { exact: false }).waitFor();
    const enrollmentRollbackFailureState = await enrollmentRollbackFailure.page.evaluate(() => ({
      calls: window.__pushDrive,
      preference: localStorage.getItem('zodiacs.push.v1'),
    }));
    check('Profile reports On when failed enrollment leaves the browser subscription active',
      await enrollmentRollbackFailure.page.getByText(
        'Sky alerts · On. The dates that matter, by notification.',
        { exact: true },
      ).isVisible()
        && await enrollmentRollbackFailure.page.getByRole('button', { name: 'Turn off' }).isVisible()
        && enrollmentRollbackFailureState.preference === 'subscribed'
        && enrollmentRollbackFailureState.calls.subscribeCalls === 1
        && enrollmentRollbackFailureState.calls.unsubscribeCalls === 1
        && enrollmentRollbackFailureRequests.length === 1
        && enrollmentRollbackFailureRequests[0].method === 'POST',
      JSON.stringify({ enrollmentRollbackFailureState, enrollmentRollbackFailureRequests }));
    await enrollmentRollbackFailure.context.close();

    const ios = await openFixture(browser, baseURL, { returning: true, ios: true });
    await ios.page.waitForSelector('[data-push-optin]');
    check('non-installed iOS explains Home Screen installation before push',
      await ios.page.getByText(
        'alerts work only after you add Zodiacs to your Home Screen',
        { exact: false },
      ).isVisible()
        && await ios.page.getByRole('button', { name: 'Turn on sky alerts' }).count() === 0);
    const iosCalls = await ios.page.evaluate(() => window.__pushDrive);
    check('non-installed iOS makes no permission or subscription request',
      iosCalls.permissionCalls === 0 && iosCalls.subscribeCalls === 0,
      JSON.stringify(iosCalls));
    await ios.context.close();

    const installedIos = await openFixture(browser, baseURL, {
      returning: true,
      ios: true,
      standalone: true,
    });
    await installedIos.page.waitForSelector('[data-push-optin]');
    check('installed iOS is eligible for the ordinary explicit opt-in',
      await installedIos.page.getByRole('button', { name: 'Turn on sky alerts' }).isVisible()
        && await installedIos.page.getByText(
          'alerts work only after you add Zodiacs to your Home Screen',
          { exact: false },
        ).count() === 0);
    const installedIosCalls = await installedIos.page.evaluate(() => window.__pushDrive);
    check('installed-iOS eligibility remains passive before acceptance',
      installedIosCalls.permissionCalls === 0 && installedIosCalls.subscribeCalls === 0,
      JSON.stringify(installedIosCalls));
    await installedIos.context.close();

    const apiRequests = [];
    const success = await openFixture(browser, baseURL, {
      returning: true,
      permissionResult: 'granted',
      apiRequests,
    });
    await success.page.waitForSelector('[data-push-optin]');
    await success.page.getByRole('button', { name: 'Turn on sky alerts' }).click();
    await success.page.getByText('Sky alerts are on', { exact: false }).waitFor();
    const subscribed = await success.page.evaluate(() => ({
      calls: window.__pushDrive,
      preference: localStorage.getItem('zodiacs.push.v1'),
    }));
    check('explicit acceptance creates one mocked browser subscription',
      subscribed.calls.permissionCalls === 1
        && subscribed.calls.subscribeCalls === 1
        && subscribed.calls.applicationServerKeyBytes > 0
        && subscribed.preference === 'subscribed',
      JSON.stringify(subscribed));
    check('successful enrollment posts only the mocked endpoint and keys',
      apiRequests.length === 1
        && apiRequests[0].method === 'POST'
        && apiRequests[0].body?.endpoint === 'https://push.fixture.test/subscription/sky-alerts'
        && apiRequests[0].body?.keys?.p256dh === 'fixture-p256dh'
        && apiRequests[0].body?.keys?.auth === 'fixture-auth'
        && apiRequests[0].body?.lang === 'en',
      JSON.stringify(apiRequests));

    await success.page.getByRole('button', { name: 'Turn off' }).click();
    await success.page.locator('[data-push-optin]').waitFor({ state: 'detached' });
    const unsubscribed = await success.page.evaluate(() => ({
      calls: window.__pushDrive,
      preference: localStorage.getItem('zodiacs.push.v1'),
    }));
    check('turn off removes the mocked browser subscription and hides the affordance',
      unsubscribed.calls.unsubscribeCalls === 1
        && unsubscribed.preference === 'dismissed'
        && await success.page.locator('[data-push-optin]').count() === 0,
      JSON.stringify(unsubscribed));
    check('turn off deletes the same mocked endpoint from the API',
      apiRequests.length === 2
        && apiRequests[1].method === 'DELETE'
        && apiRequests[1].body?.endpoint === 'https://push.fixture.test/subscription/sky-alerts',
      JSON.stringify(apiRequests));
    await success.context.close();

    // A browser subscribed only for Moon journal reminders is not a Sky
    // Alerts subscriber: Profile says Off and offers them.
    const journalOnlyStatus = [];
    const journalOnlyProfile = await openFixture(browser, baseURL, {
      permission: 'granted',
      preSubscribed: true,
      path: '/profile/',
      statusTopics: { sky: false, lunation: true },
      statusRequests: journalOnlyStatus,
    });
    await journalOnlyProfile.page.waitForSelector('[data-push-optin][data-push-context="profile"]');
    await journalOnlyProfile.page.getByText(
      'Sky alerts · Off. The dates that matter, by notification.',
      { exact: true },
    ).waitFor();
    check('Profile reads Sky Alerts from the server, not from a subscription the journal made',
      await journalOnlyProfile.page.getByRole('button', { name: 'Turn on sky alerts' }).isVisible()
        && journalOnlyStatus.length === 1
        && journalOnlyStatus[0].endpoint === 'https://push.fixture.test/subscription/sky-alerts'
        && Object.keys(journalOnlyStatus[0]).sort().join(',') === 'action,endpoint',
      JSON.stringify(journalOnlyStatus));
    await journalOnlyProfile.context.close();

    // Turning Sky Alerts off keeps a browser subscription the journal uses.
    const sharedSkyRequests = [];
    const sharedSky = await openFixture(browser, baseURL, {
      permission: 'granted',
      preSubscribed: true,
      path: '/profile/',
      statusTopics: { sky: true, lunation: true },
      deleteRemaining: true,
      apiRequests: sharedSkyRequests,
    });
    await sharedSky.page.waitForSelector('[data-push-optin][data-push-context="profile"]');
    await sharedSky.page.getByRole('button', { name: 'Turn off' }).click();
    await sharedSky.page.getByText(
      'Sky alerts · Off. The dates that matter, by notification.',
      { exact: true },
    ).waitFor();
    const sharedSkyCalls = await sharedSky.page.evaluate(() => window.__pushDrive);
    check('turning Sky Alerts off leaves the Moon journal reminder its subscription',
      sharedSkyCalls.unsubscribeCalls === 0
        && sharedSkyRequests.length === 1
        && sharedSkyRequests[0].method === 'DELETE'
        && sharedSkyRequests[0].body?.topic === 'sky',
      JSON.stringify({ sharedSkyCalls, sharedSkyRequests }));
    await sharedSky.context.close();

    // The Moon journal: opt in, then one tap to turn off.
    const journalRequests = [];
    const journal = await openFixture(browser, baseURL, {
      permissionResult: 'granted',
      path: '/moon-journal/',
      apiRequests: journalRequests,
    });
    await journal.page.waitForSelector('[data-mj-remind="off"]');
    const journalBefore = await journal.page.evaluate(() => window.__pushDrive);
    check('journal shows the reminder offer without asking for permission on load',
      await journal.page.getByRole('button', { name: 'Remind me at each new and full Moon' }).isEnabled()
        && journalBefore.permissionCalls === 0
        && journalBefore.subscribeCalls === 0
        && journalRequests.length === 0,
      JSON.stringify(journalBefore));
    await journal.page.locator('[data-mj-draft]').fill('A private line that must stay on this device.');
    await journal.page.locator('[data-mj-save]').click();
    await journal.page.locator('[data-mj-remind]').scrollIntoViewIfNeeded();
    if (process.env.PUSH_DRIVE_SHOTS) {
      await journal.page.screenshot({ path: `${process.env.PUSH_DRIVE_SHOTS}/journal-reminder-offer.png` });
    }
    await journal.page.getByRole('button', { name: 'Remind me at each new and full Moon' }).click();
    await journal.page.waitForSelector('[data-mj-remind="on"]');
    const journalOn = await journal.page.evaluate(() => window.__pushDrive);
    check('journal reminder enrollment posts only the mocked endpoint, keys and topic',
      journalOn.permissionCalls === 1
        && journalOn.subscribeCalls === 1
        && journalRequests.length === 1
        && journalRequests[0].method === 'POST'
        && journalRequests[0].body?.endpoint === 'https://push.fixture.test/subscription/sky-alerts'
        && journalRequests[0].body?.keys?.p256dh === 'fixture-p256dh'
        && journalRequests[0].body?.topic === 'lunation'
        && journalRequests[0].body?.lang === 'en'
        && Object.keys(journalRequests[0].body).sort().join(',') === 'endpoint,expirationTime,keys,lang,topic'
        && !JSON.stringify(journalRequests).includes('private line'),
      JSON.stringify(journalRequests));
    check('journal confirms reminders are on and offers one-tap turn off',
      await journal.page.getByText('Reminders are on for this browser.', { exact: true }).isVisible()
        && await journal.page.getByRole('button', { name: 'Turn off reminders' }).isVisible());
    if (process.env.PUSH_DRIVE_SHOTS) {
      await journal.page.screenshot({ path: `${process.env.PUSH_DRIVE_SHOTS}/journal-reminder-on.png` });
    }
    await journal.page.getByRole('button', { name: 'Turn off reminders' }).click();
    await journal.page.waitForSelector('[data-mj-remind="off"]');
    const journalOff = await journal.page.evaluate(() => window.__pushDrive);
    check('one tap turns journal reminders off on the server and in the browser',
      journalOff.unsubscribeCalls === 1
        && journalRequests.length === 2
        && journalRequests[1].method === 'DELETE'
        && journalRequests[1].body?.endpoint === 'https://push.fixture.test/subscription/sky-alerts'
        && journalRequests[1].body?.topic === 'lunation',
      JSON.stringify({ journalOff, journalRequests }));
    await journal.context.close();

    // A browser that already has Sky Alerts: the journal reads its own flag,
    // and turning reminders off keeps the subscription Sky Alerts use.
    const sharedJournalRequests = [];
    const sharedJournal = await openFixture(browser, baseURL, {
      permission: 'granted',
      preSubscribed: true,
      path: '/moon-journal/',
      statusTopics: { sky: true, lunation: true },
      deleteRemaining: true,
      apiRequests: sharedJournalRequests,
    });
    await sharedJournal.page.waitForSelector('[data-mj-remind="on"]');
    await sharedJournal.page.getByRole('button', { name: 'Turn off reminders' }).click();
    await sharedJournal.page.waitForSelector('[data-mj-remind="off"]');
    const sharedJournalCalls = await sharedJournal.page.evaluate(() => window.__pushDrive);
    check('turning journal reminders off leaves Sky Alerts their subscription',
      sharedJournalCalls.unsubscribeCalls === 0
        && sharedJournalCalls.permissionCalls === 0
        && sharedJournalRequests.length === 1
        && sharedJournalRequests[0].body?.topic === 'lunation',
      JSON.stringify({ sharedJournalCalls, sharedJournalRequests }));
    await sharedJournal.context.close();

    const failedLeaveRequests = [];
    const failedLeave = await openFixture(browser, baseURL, {
      permission: 'granted',
      preSubscribed: true,
      path: '/moon-journal/',
      statusTopics: { sky: false, lunation: true },
      deleteStatus: 503,
      apiRequests: failedLeaveRequests,
    });
    await failedLeave.page.waitForSelector('[data-mj-remind="on"]');
    await failedLeave.page.getByRole('button', { name: 'Turn off reminders' }).click();
    await failedLeave.page.getByText('Reminders are unavailable right now.', { exact: false }).waitFor();
    const failedLeaveCalls = await failedLeave.page.evaluate(() => window.__pushDrive);
    check('journal never reports Off when the server keeps the reminder',
      await failedLeave.page.locator('[data-mj-remind="on"]').count() === 1
        && await failedLeave.page.getByRole('button', { name: 'Turn off reminders' }).isEnabled()
        && failedLeaveCalls.unsubscribeCalls === 0,
      JSON.stringify(failedLeaveCalls));
    await failedLeave.context.close();
  } finally {
    await browser.close();
  }
});

let failures = 0;
for (const result of results) {
  if (!result.ok) failures += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` · ${result.detail}` : ''}`);
}
console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
process.exit(failures ? 1 : 0);
