import type { McpServer } from '@modelcontextprotocol/server';
import { getHoroscope, horoscopeInput, HOROSCOPE_URI } from './reading';
import { HOROSCOPE_HTML } from '../../../integrations/generated/horoscope-preview.mjs';
export function registerHoroscopePreview(server: McpServer, now = () => new Date()) {
  server.registerResource('horoscopes-preview', HOROSCOPE_URI, { title: 'Zodiacs Horoscopes', mimeType: 'text/html;profile=mcp-app' }, () => ({ contents: [{ uri: HOROSCOPE_URI, mimeType: 'text/html;profile=mcp-app', text: HOROSCOPE_HTML, _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetCSP': { connect_domains: [], resource_domains: [] }, 'openai/widgetDescription': 'Choose a Sun sign, date, daily or weekly period and focus. Read a dated horoscope and inspect the sky facts and interpretive choices behind it.', 'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'] } } }] }));
  server.registerTool('get_horoscope', {
    title: 'Horoscopes',
    description: 'Read a dated Zodiacs Sun-sign horoscope or open the sign picker with {}. Supports daily general, love or career and general weekly readings when included in the edition. No birth data or signup. Preserve explicit period dates, edition date, original wording and unavailable coverage; never call a stale edition current. Sky facts and solar-house interpretation are separate; this is not a personal natal forecast, prediction guarantee, or medical/financial/legal advice. Default timezone is America/New_York. Changing a timezone only selects the local calendar date and formats fact times, not the horoscope method.',
    inputSchema: horoscopeInput,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: false },
    _meta: { securitySchemes: [{ type: 'noauth' }], ui: { resourceUri: HOROSCOPE_URI, visibility: ['model','app'] }, 'openai/outputTemplate': HOROSCOPE_URI },
  }, (args: unknown) => { const result = getHoroscope(args, now()); return { isError: !result.ok, content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result }; });
}
