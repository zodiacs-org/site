// Read the actual postbuild declaration. Vite can rename a shared CSS chunk
// when its owning component changes without changing deferred delivery.
export function russianDeferredStyleURLs(html, baseURL) {
  const templates = [...html.matchAll(/<template\b[^>]*\bdata-zdx-deferred-style(?=[\s=>])[^>]*>[\s\S]*?<\/template>/gu)];
  if (templates.length !== 3) {
    throw new Error(`Russian calculator must declare three deferred stylesheets; found ${templates.length}`);
  }
  const urls = templates.map(([template]) => {
    const href = template.match(/<link\s+rel="stylesheet"\s+href="(\/_astro\/[^"<>]+\.css)"\s*\/?\s*>/u)?.[1];
    if (!href || (template.match(/<link\b/gu) ?? []).length !== 1) {
      throw new Error('Russian calculator deferred template must contain one local stylesheet');
    }
    return new URL(href, baseURL).href;
  });
  if (new Set(urls).size !== 3) {
    throw new Error('Russian calculator must declare three distinct deferred stylesheets');
  }
  return urls;
}

// This self-contained observer is also passed directly to Playwright.
export function russianDeferredStylesReady(expectedURLs) {
  const loaded = new Set(Array.from(document.styleSheets, (sheet) => sheet.href));
  return expectedURLs.length === 3 && new Set(expectedURLs).size === 3
    && expectedURLs.every((url) => loaded.has(url));
}
