// These observers run in the real page. A downloaded link alone does not prove
// that the canonical stylesheet has applied to the footer being photographed.
export function observeFooterStyles({ readyOnly = false } = {}) {
  const link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((node) => {
    const url = new URL(node.href, location.href);
    return url.origin === location.origin && url.pathname === '/assets/site-footer.css';
  });
  const footer = document.querySelector('.zfooter');
  const directory = document.querySelector('.zfooter__directory');
  const style = footer ? getComputedStyle(footer) : null;
  const state = {
    path: location.pathname,
    documentReadyState: document.readyState,
    linkPresent: Boolean(link),
    sheetLoaded: Boolean(link?.sheet),
    disabled: Boolean(link?.disabled),
    directoryDisplay: directory ? getComputedStyle(directory).display : null,
    backgroundToken: style?.getPropertyValue('--zf-bg').trim() ?? null,
    background: style?.backgroundColor ?? null,
  };
  state.ready = state.sheetLoaded && !state.disabled && state.directoryDisplay === 'grid'
    && state.backgroundToken === '#0a0c11' && state.background === 'rgb(10, 12, 17)';
  return readyOnly ? state.ready : state;
}

export function observeViewportRegions(selectors) {
  const nav = document.querySelector('.nav-wrap');
  const navBottom = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
  return {
    width: innerWidth, height: innerHeight, navBottom,
    regions: selectors.map((selector) => {
      const node = document.querySelector(selector);
      if (!node) return { selector, missing: true };
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { selector, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
          && style.display !== 'none' && Number(style.opacity) > 0 };
    }),
  };
}

export function viewportRegionFailures(state) {
  return state.regions.flatMap((region) => {
    if (region.missing || !region.visible) return [`${region.selector}: missing or hidden`];
    return [
      region.top >= state.navBottom + 8 || `${region.selector}: heading/content behind navigation`,
      region.bottom <= state.height - 8 || `${region.selector}: content clipped below viewport`,
      region.left >= 0 && region.right <= state.width || `${region.selector}: content clipped horizontally`,
    ].filter((entry) => entry !== true);
  });
}

// Keep every real line box, including wrapped labels. The menu may scroll
// vertically; a label must still fit its own row and the horizontal viewport.
export function observeMobileToolMenu() {
  const bounds = (node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      width: rect.width, height: rect.height };
  };
  const menu = document.querySelector('[data-mobile-menu]');
  const guide = document.querySelector('[data-guide-launcher]');
  const guideStyle = guide ? getComputedStyle(guide) : null;
  const navBottom = document.querySelector('.nav-wrap')?.getBoundingClientRect().bottom ?? 0;
  return {
    width: innerWidth, height: innerHeight, navBottom,
    open: Boolean(menu && !menu.hidden),
    expanded: document.querySelector('[data-menu-toggle]')?.getAttribute('aria-expanded'),
    guide: guideStyle ? { visibility: guideStyle.visibility, pointerEvents: guideStyle.pointerEvents,
      opacity: Number(guideStyle.opacity) } : null,
    // Birth chart and compatibility are promoted into the primary group.
    // Keep verifying all nine destinations, including their real hit targets.
    rows: [...(menu?.querySelectorAll('.mobile-menu__tool, .mobile-menu__link[href$="/birth-chart/"], .mobile-menu__link[href$="/compatibility/"]') ?? [])].map((node) => {
      const rect = bounds(node);
      const style = getComputedStyle(node);
      const textRects = [];
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (!text.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(text);
        for (const line of range.getClientRects()) {
          if (line.width > 0) textRects.push({ left: line.left, right: line.right, top: line.top, bottom: line.bottom });
        }
      }
      const fullyInView = rect.top >= navBottom && rect.bottom <= innerHeight;
      const hitPoints = [];
      if (node.getAttribute('href') === '/birthday/' && fullyInView) {
        hitPoints.push({ x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 });
        for (const line of textRects) {
          for (const x of [line.left + 1, (line.left + line.right) / 2, line.right - 1]) {
            hitPoints.push({ x, y: (line.top + line.bottom) / 2 });
          }
        }
      }
      return { href: node.getAttribute('href'), text: node.textContent.trim(), ariaLabel: node.getAttribute('aria-label'),
        hreflang: node.getAttribute('hreflang'), title: node.getAttribute('title'), ...rect,
        visible: style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0,
        scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, textRects, fullyInView,
        focused: document.activeElement === node,
        hits: hitPoints.map((point) => {
          const hit = document.elementFromPoint(point.x, point.y);
          return { ...point, ownTarget: hit?.closest('.mobile-menu__tool') === node,
            hit: hit ? `${hit.tagName}.${hit.className}` : null };
        }) };
    }),
  };
}

export function mobileToolMenuFailures(state, { requireBirthdayFocus = false } = {}) {
  const failures = [
    state.open && state.expanded === 'true' || 'mobile menu is not open',
    state.guide?.visibility === 'hidden' && state.guide.pointerEvents === 'none' || 'Guide remains available over the menu',
    state.rows.length === 9 || 'missing mobile tool rows',
  ].filter((entry) => entry !== true);
  for (const row of state.rows) {
    if (!row.visible || !row.textRects.length) failures.push(`${row.href}: missing or hidden text`);
    if (row.height < 44 || row.width < 44) failures.push(`${row.href}: target smaller than 44px`);
    if (row.left < 0 || row.right > state.width || row.scrollWidth > row.clientWidth + 1
      || row.textRects.some((line) => line.left < Math.max(0, row.left) || line.right > Math.min(state.width, row.right))) {
      failures.push(`${row.href}: text clipped horizontally`);
    }
  }
  if (requireBirthdayFocus) {
    const birthday = state.rows.find((row) => row.href === '/birthday/');
    if (!birthday?.focused) failures.push('Birthday is not reachable by native Tab');
    if (!birthday?.fullyInView) failures.push('Birthday is not fully visible after native focus');
    if (!birthday?.hits.length || birthday.hits.some((hit) => !hit.ownTarget)) failures.push('Birthday text or target is obstructed');
  }
  return failures;
}
