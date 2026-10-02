import { McpServer } from '@modelcontextprotocol/server';
import { AI_TOOL_NAMES, AI_VERSION, INPUT_SCHEMAS, OUTPUT_SCHEMAS, READ_ONLY, TOOL_DESCRIPTIONS, WIDGET_URI } from './contracts';
import { executeAiTool, type AiDependencies } from './tools';
import { WIDGET_HTML } from './widget';

/** A fresh SDK server per HTTP request or local stdio connection. */
export function createAiServer(dependencies: AiDependencies) {
  const server = new McpServer({ name: 'zodiacs', version: AI_VERSION }, {
    capabilities: { tools: {}, resources: {} },
    instructions: 'Zodiacs computes astronomical facts with versioned receipts. Explain astrology as interpretation separately. Preserve depends/refused answers, explicit timezone, search completeness and source limits. Do not claim that a local server makes a cloud conversation local. Return complete useful answers; site links offer optional visualization or method inspection.',
  });
  server.registerResource('sky-events', WIDGET_URI, {
    title: 'Zodiacs sky events', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetDescription': 'An accessible list of computed sky events with local times, coverage and optional method links.' },
  }, () => ({ contents: [{ uri: WIDGET_URI, mimeType: 'text/html;profile=mcp-app', text: WIDGET_HTML,
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetCSP': { connect_domains: [], resource_domains: [] }, 'openai/widgetPrefersBorder': true, 'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'inline' } },
  }] }));
  for (const tool of AI_TOOL_NAMES) {
    server.registerTool(tool, {
      title: tool === 'get_upcoming_events' ? 'Sky calendar' : tool.replaceAll('_', ' '), description: TOOL_DESCRIPTIONS[tool],
      ...(tool === 'get_upcoming_events' ? { icons: [{ src: 'https://zodiacs.org/assets/ai/sky-calendar.svg', mimeType: 'image/svg+xml', sizes: ['20x20'] }] } : {}),
      inputSchema: INPUT_SCHEMAS[tool], outputSchema: OUTPUT_SCHEMAS[tool],
      annotations: { ...READ_ONLY, idempotentHint: tool !== 'get_sky' && tool !== 'get_upcoming_events' },
      _meta: { securitySchemes: [{ type: 'noauth' }], ...(tool === 'get_upcoming_events' ? { ui: { resourceUri: WIDGET_URI, visibility: ['model', 'app'] }, 'openai/outputTemplate': WIDGET_URI, 'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] } } : {}) },
    }, async (args: unknown) => {
      const result = await executeAiTool(tool, args, dependencies);
      return { isError: !result.ok, content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
    });
  }
  return server;
}
