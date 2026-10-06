import { McpServer } from '@modelcontextprotocol/server';
import { AI_TOOL_NAMES, AI_VERSION, INPUT_SCHEMAS, OUTPUT_SCHEMAS, READ_ONLY, TOOL_DESCRIPTIONS, WIDGET_URI, STUDIO_URI } from './contracts';
import { executeAiTool, type AiDependencies } from './tools';
import { STUDIO_HTML } from '../../integrations/generated/chart-studio.mjs';
import { WIDGET_HTML } from './widget';
import { registerSkyWatch, type SkyWatch } from './watch/service';
import type { Principal } from './watch/contracts';
import { WATCH_SCOPES } from './watch/oauth';

/** A fresh SDK server per HTTP request or local stdio connection. */
export function createAiServer(dependencies: AiDependencies, watch?: { service: SkyWatch; owner: Principal }) {
  const server = new McpServer({ name: 'zodiacs', version: AI_VERSION }, {
    capabilities: { tools: {}, resources: {}, ...(watch ? { events: {} } : {}) },
    instructions: 'Zodiacs computes astronomical facts with versioned receipts. Explain astrology as interpretation separately. Preserve depends/refused answers, explicit timezone, search completeness and source limits. Do not claim that a local server makes a cloud conversation local. Return complete useful answers; site links offer optional visualization or method inspection.',
  });
  server.registerResource('sky-events', WIDGET_URI, {
    title: 'Zodiacs sky events', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetDescription': 'An accessible list of computed sky events with local times, coverage and optional method links.' },
  }, () => ({ contents: [{ uri: WIDGET_URI, mimeType: 'text/html;profile=mcp-app', text: WIDGET_HTML,
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetCSP': { connect_domains: [], resource_domains: [] }, 'openai/widgetPrefersBorder': true, 'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'inline' } },
  }] }));
  server.registerResource('chart-studio', STUDIO_URI, {
    title: 'Zodiacs Chart Studio', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetDescription': 'Interactive charts calculated in the browser, with time exploration, birth-time windows, calculation-record inspection, house comparison and user-reviewed context sharing.' },
  }, () => ({ contents: [{ uri: STUDIO_URI, mimeType: 'text/html;profile=mcp-app', text: STUDIO_HTML,
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetCSP': { connect_domains: [], resource_domains: [] }, 'openai/widgetPrefersBorder': true, 'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'fullscreen' } },
  }] }));
  for (const tool of AI_TOOL_NAMES) {
    const resourceUri = tool === 'get_upcoming_events' ? WIDGET_URI : tool === 'open_chart_studio' ? STUDIO_URI : null;
    server.registerTool(tool, {
      title: tool === 'open_chart_studio' ? 'Chart Studio' : tool === 'get_upcoming_events' ? 'Sky calendar' : tool.replaceAll('_', ' '), description: TOOL_DESCRIPTIONS[tool],
      ...(resourceUri ? { icons: [{ src: `https://zodiacs.org/assets/ai/${tool === 'open_chart_studio' ? 'chart-studio' : 'sky-calendar'}.svg`, mimeType: 'image/svg+xml', sizes: ['20x20'] }] } : {}),
      inputSchema: INPUT_SCHEMAS[tool], outputSchema: OUTPUT_SCHEMAS[tool],
      annotations: { ...READ_ONLY, idempotentHint: tool !== 'get_sky' && tool !== 'get_upcoming_events' },
      _meta: { ...(!watch ? { securitySchemes: [{ type: 'noauth' }] } : watch.service.oauth ? { securitySchemes: [{ type: 'oauth2', scopes: WATCH_SCOPES }] } : {}), ...(resourceUri ? { ui: { resourceUri, visibility: ['model', 'app'] }, 'openai/outputTemplate': resourceUri, 'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] } } : {}) },
    }, async (args: unknown) => {
      const result = await executeAiTool(tool, args, { ...dependencies, skyWatch: !!watch });
      return { isError: !result.ok, content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
    });
  }
  if (watch) registerSkyWatch(server, watch.service, watch.owner);
  return server;
}
