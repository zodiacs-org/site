import type { ClientDirective } from 'astro';

/** All greeting actions are native links. Hydrate on intent or after the poster loads. */
const homeReturning: ClientDirective = (load, _options, element) => {
  const intents = ['pointerover', 'pointerdown', 'focusin', 'keydown'];
  const returning = () => document.documentElement.hasAttribute('data-home-returning');
  let loading = false;
  let timer: number | undefined;

  async function start() {
    if (loading || !returning()) return;
    loading = true;
    try {
      const hydrate = await load();
      await hydrate();
    } catch {
      loading = false;
      return;
    }
    for (const event of intents) element.removeEventListener(event, start, true);
    window.removeEventListener('load', schedule);
    window.removeEventListener('zodiacs:profile', arm);
    window.removeEventListener('zodiacs:profile-access', arm);
    window.clearTimeout(timer);
  }

  function schedule() {
    if (timer !== undefined) return;
    timer = window.setTimeout(() => {
      timer = undefined;
      void start();
    }, 600);
  }

  function arm() {
    if (!returning()) return;
    for (const event of intents) element.addEventListener(event, start, true);
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
  }

  window.addEventListener('zodiacs:profile', arm);
  window.addEventListener('zodiacs:profile-access', arm);
  arm();
};

export default homeReturning;
