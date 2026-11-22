import type { ClientDirective } from 'astro';
import interaction from './interaction';

/** Keep the usual intent/load timing, but only fetch a greeting that can be seen. */
const homeReturning: ClientDirective = (load, options, element) => {
  function arm() {
    if (!document.documentElement.hasAttribute('data-home-returning')) return;
    window.removeEventListener('zodiacs:profile', arm);
    window.removeEventListener('zodiacs:profile-access', arm);
    void interaction(load, options, element);
  }
  window.addEventListener('zodiacs:profile', arm);
  window.addEventListener('zodiacs:profile-access', arm);
  arm();
};

export default homeReturning;
