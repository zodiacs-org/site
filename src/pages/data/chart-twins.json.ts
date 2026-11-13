import { TWIN_DIRECTORY } from '../../lib/sharing/twin-directory';

export const prerender = true;

/** The directory /chart-twins/ matches against, for the page's WebMCP tool (src/lib/webmcp/calculator-runtime.ts). */
export function GET() {
  return new Response(`${JSON.stringify({ schema: 'zodiacs.chart-twins.v1', people: TWIN_DIRECTORY })}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, must-revalidate',
    },
  });
}
