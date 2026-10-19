// Read the actual postbuild declaration. Vite can rename a shared CSS chunk
// when its owning component changes without changing deferred delivery.
export function russianDeferredStyleURLs(html, baseURL) {
  const templates = [...html.matchAll(/<template\b[^>]*\bdata-zdx-deferred-style(?=[\s=>])[^>]*>[\s\S]*?<\/template>/gu)];
  if (templates.length < 3 || templates.length > 4) {
    throw new Error(`Russian calculator must declare three core deferred stylesheets and at most one account stylesheet; found ${templates.length}`);
  }
  const links = [];
  const urls = templates.map(([template]) => {
    const link = template.replace(/^<template\b[^>]*>/u, '').replace(/<\/template>$/u, '').trim();
    const href = link.match(/^<link\s+rel="stylesheet"\s+href="(\/_astro\/[^"<>]+\.css)"\s*\/?\s*>$/u)?.[1];
    if (!href) {
      throw new Error('Russian calculator deferred template must contain one local stylesheet');
    }
    links.push(link);
    return new URL(href, baseURL).href;
  });
  if (new Set(urls).size !== urls.length) {
    throw new Error('Russian calculator must declare distinct deferred stylesheets');
  }
  const identities = urls.map((url) => new URL(url).pathname.match(/^\/_astro\/(calculator|explorer|ChartActionDock|account)\.[A-Za-z0-9_-]+\.css$/u)?.[1]);
  if (identities.includes(undefined) || identities.filter((name) => name === 'account').length > 1
    || identities.filter((name) => name !== 'account').join(',') !== 'calculator,explorer,ChartActionDock') {
    throw new Error('Russian calculator must preserve calculator, explorer, ChartActionDock order with at most one optional account stylesheet');
  }
  for (const [index, match] of templates.entries()) {
    const fallback = html.slice(match.index + match[0].length).match(/^\s*<noscript>([\s\S]*?)<\/noscript>/u)?.[1].trim();
    if (fallback !== links[index]) throw new Error('Russian calculator deferred stylesheet must retain its identical adjacent noscript fallback');
  }
  const allLinks = [...html.matchAll(/<link\b[^>]*>/giu)].map(([tag]) => tag)
    .filter((tag) => /\brel=["']stylesheet["']/iu.test(tag));
  const expectedLinks = links.flatMap((link) => [link, link]);
  if (allLinks.length !== expectedLinks.length || allLinks.some((tag, index) => tag !== expectedLinks[index])) {
    throw new Error('Russian calculator must contain only the ordered deferred stylesheets and their noscript fallbacks');
  }
  return urls;
}

// This self-contained observer is also passed directly to Playwright.
export function russianDeferredStylesReady(expectedURLs) {
  const identities = expectedURLs.map((url) => {
    try { return new URL(url).pathname.match(/^\/_astro\/(calculator|explorer|ChartActionDock|account)\.[A-Za-z0-9_-]+\.css$/u)?.[1]; }
    catch { return undefined; }
  });
  const loaded = new Set(Array.from(document.styleSheets, (sheet) => sheet.href));
  return expectedURLs.length >= 3 && expectedURLs.length <= 4 && new Set(expectedURLs).size === expectedURLs.length
    && !identities.includes(undefined) && identities.filter((name) => name === 'account').length <= 1
    && identities.filter((name) => name !== 'account').join(',') === 'calculator,explorer,ChartActionDock'
    && expectedURLs.every((url) => loaded.has(url));
}
