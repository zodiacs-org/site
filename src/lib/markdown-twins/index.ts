import { markdownHeaders, renderTwin, type TwinSlug } from './model';
import { buildTwin } from './pages';

export * from './model';
export { buildTwin } from './pages';

/** A prerendered route's handler: the twin's Markdown, with its page named as canonical. */
export const twinRoute = (slug: TwinSlug) => () =>
  new Response(renderTwin(buildTwin(slug)), { headers: markdownHeaders(slug) });
