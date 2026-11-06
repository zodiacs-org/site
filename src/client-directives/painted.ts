import type { ClientDirective } from 'astro';

/**
 * client:painted hydrates an island in the first idle period after the page's
 * first contentful paint. It is client:idle for islands below the first
 * screen: on a phone the first paint usually comes before the island's script
 * runs, so the two behave alike, but where the page loads before it paints,
 * the island's scripts no longer share the window in which the hero is drawn.
 * Browsers without paint timing hydrate when idle, as client:idle does.
 */
const paintedDirective: ClientDirective = (load) => {
  let started = false;
  const hydrate = async () => {
    const run = await load();
    await run();
  };
  const start = () => {
    if (started) return;
    started = true;
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => void hydrate());
    else setTimeout(() => void hydrate(), 200);
  };

  try {
    if (!PerformanceObserver.supportedEntryTypes?.includes('paint')) {
      start();
      return;
    }
    const observer = new PerformanceObserver((list, self) => {
      if (list.getEntriesByName('first-contentful-paint').length === 0) return;
      self.disconnect();
      start();
    });
    observer.observe({ type: 'paint', buffered: true });
  } catch {
    start();
  }
};

export default paintedDirective;
