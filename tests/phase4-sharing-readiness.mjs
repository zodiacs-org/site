/** The existing 30-second form deadline also bounds profile hydration. */
export const COMPARISON_READY_TIMEOUT_MS = 30_000;

export async function waitForFeatureOffComparison(page, {
  timeout = COMPARISON_READY_TIMEOUT_MS,
  now = () => performance.now(),
} = {}) {
  const deadline = now() + timeout;
  await page.locator('.calc__form').waitFor({ state: 'visible', timeout });
  const remaining = deadline - now();
  if (remaining <= 0) return false;
  try {
    await page.waitForFunction(() => (
      document.querySelectorAll('#syn-a-source, #syn-b-source').length === 2
      && document.querySelectorAll('.calc__submit').length === 1
    ), null, { timeout: remaining });
    return true;
  } catch (error) {
    if (error?.name === 'TimeoutError') return false;
    throw error;
  }
}

export function featureOffComparisonState(page) {
  return page.evaluate(() => ({
    forms: document.querySelectorAll('.calc__form').length,
    sources: document.querySelectorAll('#syn-a-source, #syn-b-source').length,
    submits: document.querySelectorAll('.calc__submit').length,
  }));
}
