/**
 * Generates the tiny inline loader shared by Astro and the static legacy
 * wings. It makes Guide available immediately on an explicit CTA click, but
 * otherwise waits until 500 ms after `load` before fetching the public shell.
 * That keeps the shell, drawer, and portrait outside the page's LCP window.
 */
export const GUIDE_POST_LOAD_DELAY_MS = 500;
export const GUIDE_LOADER_MARKER = 'zodiacs-guide-loader-v1';
export const GUIDE_SHELL_URL = '/assets/assistant-ui.js?v=icon-guide-5';
export const GUIDE_PRIVATE_SESSION_KEY = 'zodiacs.guide.private-session.v1';
export const GUIDE_OPEN_PENDING_KEY = 'zodiacs.guide.open-pending.v1';
/**
 * The question an opener carried (a quick-prompt chip's site-written
 * question, or what the visitor typed into site search), kept in this tab's
 * sessionStorage across the private reload so the reopened drawer can still
 * offer it as an editable draft. Nothing is sent until the visitor sends it.
 */
export const GUIDE_OPEN_PROMPT_KEY = 'zodiacs.guide.open-prompt.v1';

export function guideLoaderSource(locale = 'en') {
  const serializedLocale = JSON.stringify(String(locale));
  return `(function () {
    var modulePromise;
    var timer = 0;
    var intentPending = false;
    var defaultLocale = ${serializedLocale};
    var privateSessionKey = '${GUIDE_PRIVATE_SESSION_KEY}';
    var openPendingKey = '${GUIDE_OPEN_PENDING_KEY}';
    var openPromptKey = '${GUIDE_OPEN_PROMPT_KEY}';
    function safeSessionGet(key) {
      try { return sessionStorage.getItem(key); } catch (error) { return null; }
    }
    function consumePendingOpen() {
      if (safeSessionGet(openPendingKey) === '1') {
        try { sessionStorage.removeItem(openPendingKey); } catch (error) {}
        return true;
      }
      if (location.pathname === '/ask/' && location.hash === '#guide') {
        try { history.replaceState(null, '', '/ask/'); } catch (error) {}
        return true;
      }
      return false;
    }
    function pendingOpener() {
      var prompt = safeSessionGet(openPromptKey);
      try { sessionStorage.removeItem(openPromptKey); } catch (error) {}
      if (!prompt) return null;
      var openers = document.querySelectorAll('[data-assistant-open][data-assistant-prompt]');
      for (var i = 0; i < openers.length; i += 1) {
        if (openers[i].getAttribute('data-assistant-prompt') === prompt) return openers[i];
      }
      var holder = document.createElement('span');
      holder.hidden = true;
      holder.setAttribute('data-assistant-prompt', prompt.slice(0, 280));
      document.body.appendChild(holder);
      return holder;
    }
    function beginPrivateTransition(from) {
      if (!document.documentElement.hasAttribute('data-guide-analytics-boundary')) return false;
      if (safeSessionGet(privateSessionKey) === '1') return false;
      try {
        sessionStorage.setItem(privateSessionKey, '1');
        sessionStorage.setItem(openPendingKey, '1');
        var prompt = from && from.getAttribute('data-assistant-prompt');
        if (prompt) sessionStorage.setItem(openPromptKey, prompt);
        location.reload();
      } catch (error) {
        location.assign('/ask/#guide');
      }
      return true;
    }
    function loadGuide() {
      if (!modulePromise) {
        modulePromise = import('${GUIDE_SHELL_URL}').catch(function (error) {
          modulePromise = null;
          throw error;
        });
      }
      return modulePromise;
    }
    function stopIntentListener() {
      document.removeEventListener('click', onGuideIntent, true);
    }
    function stopScheduledMount() {
      window.clearTimeout(timer);
      window.removeEventListener('load', scheduleGuide);
    }
    function mountGuide() {
      loadGuide().then(function (mod) {
        if (consumePendingOpen()) return mod.openAssistant(defaultLocale, pendingOpener());
        return mod.bootstrapGuide(defaultLocale).then(stopIntentListener);
      }).catch(function () {});
    }
    function scheduleGuide() {
      timer = window.setTimeout(mountGuide, ${GUIDE_POST_LOAD_DELAY_MS});
    }
    function onGuideIntent(event) {
      var target = event.target && event.target.closest
        ? event.target.closest('[data-assistant-open]')
        : null;
      if (!target) return;
      if (intentPending) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      intentPending = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      stopScheduledMount();
      if (beginPrivateTransition(target)) return;
      loadGuide().then(function (mod) {
        return mod.openAssistant(
          target.getAttribute('data-assistant-locale') || defaultLocale,
          target
        ).then(stopIntentListener);
      }).catch(function () { intentPending = false; });
    }
    document.addEventListener('click', onGuideIntent, true);
    if (document.readyState === 'complete') scheduleGuide();
    else window.addEventListener('load', scheduleGuide, { once: true });
  })();`;
}
