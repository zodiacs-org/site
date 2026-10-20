// Inline on static reference pages. Completion lives in reference-completion.ts.
// One same-tab marker, no personal details, no URL storage, thirty-minute expiry.
(() => {
  const key = 'zodiacs:reference-task';
  const pages = ['hub', 'sun-moon', 'moon-venus', 'moon-mars'];
  const props = (page) => ({ topic: 'synastry', page, locale: 'en', task: 'comparison', destination: 'compatibility' });
  const send = (name, page) => window.zodiacsAnalytics?.track?.(name, props(page));
  const init = () => {
    const page = document.querySelector('[data-reference-page]')?.getAttribute('data-reference-page');
    if (!pages.includes(page)) return;
    send('reference_opened', page);
    for (const link of document.querySelectorAll('a[data-reference-task]')) {
      link.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
        send('reference_cta_clicked', page);
        try { sessionStorage.setItem(key, JSON.stringify({ page, expires: Date.now() + 30 * 60 * 1000 })); } catch { /* No attribution when storage is unavailable. */ }
      });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
