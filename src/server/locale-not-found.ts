import { requestOrigin } from './chart-preview.js';

/**
 * Unknown paths under a locale prefix (/es/, /pt/, /fr/, /it/, /ru/) get that
 * locale's own 404 page with a real 404 status.
 *
 * vercel.json's last rewrite sends them here, after the filesystem, so every
 * built page still wins. A rewrite straight to /es/404/ would answer 200,
 * because a rewrite keeps the destination's status and the locale 404 pages
 * are ordinary built pages: every miss under the prefix would become a soft
 * 404. This handler fetches the built page from the same deployment and sends
 * it with status 404. If that page cannot be read, the answer is still 404.
 */
export const LOCALE_NOT_FOUND_ROUTE_KEY = '__zodiacs_not_found';
export const NOT_FOUND_LOCALES = ['es', 'fr', 'it', 'pt', 'ru'] as const;
export type NotFoundLocale = typeof NOT_FOUND_LOCALES[number];

/** Marks the handler's own fetch, so a missing locale 404 page cannot loop back here. */
export const NOT_FOUND_FETCH_HEADER = 'x-zodiacs-not-found';

const pages = new Map<string, Promise<string | null>>();

export function notFoundLocale(value: unknown): NotFoundLocale | null {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    if (NOT_FOUND_LOCALES.includes(candidate as NotFoundLocale)) return candidate as NotFoundLocale;
  }
  return null;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { [NOT_FOUND_FETCH_HEADER]: '1', accept: 'text/html' },
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    if (response.status !== 200) return null;
    const html = await response.text();
    return /<html\b/iu.test(html) ? html : null;
  } catch {
    return null;
  }
}

function localePage(origin: string, locale: NotFoundLocale): Promise<string | null> {
  const url = `${origin}/${locale}/404/`;
  let pending = pages.get(url);
  if (!pending) {
    pending = fetchPage(url).then((html) => {
      // Keep only a page that loaded; a failed read is tried again next time.
      if (html === null) pages.delete(url);
      return html;
    });
    pages.set(url, pending);
  }
  return pending;
}

export function clearLocaleNotFoundCache(): void {
  pages.clear();
}

export async function handleLocaleNotFound(req: any, res: any): Promise<void> {
  const locale = notFoundLocale(req.query?.[LOCALE_NOT_FOUND_ROUTE_KEY]);
  const looped = req.headers?.[NOT_FOUND_FETCH_HEADER] !== undefined;
  const html = locale && !looped ? await localePage(requestOrigin(req), locale) : null;

  res.statusCode = 404;
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('X-Robots-Tag', 'noindex, follow');
  if (html === null) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(req.method === 'HEAD' ? undefined : 'Not found\n');
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(req.method === 'HEAD' ? undefined : html);
}
