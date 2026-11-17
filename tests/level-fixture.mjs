/**
 * Reader levels (docs/LEVELS.md) open /birth-chart/ at Beginner for a first
 * visit, which hides houses, aspect lines, the entity picker, lenses, the 3D
 * view and the details table. Browser drives written for the full chart
 * explorer call withFullLevel() so every page they open starts at Advanced,
 * where the page shows everything, as it did before levels existed. The first
 * visit (Beginner and its question) is covered by the consumer experience
 * drive, the visual baselines and Lighthouse, which never call this.
 *
 * The seed runs again on every page load, so a drive that switches level and
 * then reloads comes back at Advanced. Such a drive should not use this.
 */
export const LEVEL_STORAGE_KEY = 'zodiacs-level';
export const LEVEL_ASKED_KEY = 'zodiacs-level-asked';

export function seedFullLevel() {
  try {
    window.localStorage.setItem('zodiacs-level', 'advanced');
    window.localStorage.setItem('zodiacs-level-asked', '1');
  } catch {
    // Storage blocked: the page falls back to Beginner, as for a reader.
  }
}

/** Seed Advanced in one context or persistent context. */
export async function withFullLevelContext(context) {
  await context.addInitScript(seedFullLevel);
  return context;
}

/** Seed Advanced in every page and context this browser opens from now on. */
export function withFullLevel(browser) {
  const newContext = browser.newContext.bind(browser);
  const newPage = browser.newPage.bind(browser);
  browser.newContext = async (...args) => withFullLevelContext(await newContext(...args));
  browser.newPage = async (...args) => {
    const page = await newPage(...args);
    await page.addInitScript(seedFullLevel);
    return page;
  };
  return browser;
}
