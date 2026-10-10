import { McpServer } from '@modelcontextprotocol/server';
import { AI_VERSION, HOROSCOPE_URI, INPUT_SCHEMAS, OUTPUT_SCHEMAS, READ_ONLY, TOOL_DESCRIPTIONS, TOOL_TITLES, WIDGET_URI, STUDIO_URI, LEGACY_STUDIO_URI, type AiToolName } from './contracts';
import { executeAiTool, offeredTools, type AiCallContext, type AiDependencies } from './tools';
import { STUDIO_HTML } from '../../integrations/generated/chart-studio.mjs';
import { HOROSCOPES_HTML } from '../../integrations/generated/horoscopes.mjs';
import { WIDGET_HTML } from './widget';
import { registerSkyWatch, type SkyWatch } from './watch/service';
import type { Principal } from './watch/contracts';
import { WATCH_SCOPES } from './watch/oauth';

const INSTRUCTIONS = 'Zodiacs calculates the sky and publishes dated Sun-sign horoscopes. Answer in plain words first. Keep calculated facts separate from what they mean in astrology, and say when an answer depends on the time zone. Mention calculation details such as versions, receipts or UTC only if the person asks how something was calculated. Never guess a birth time or a sign. Zodiacs does not schedule anything, pick investments, or promise how a relationship, health or money will turn out; do not call its tools for those requests, and say plainly that it cannot.';

const PANELS: Partial<Record<AiToolName, { uri: string; icon: string }>> = {
  get_upcoming_events: { uri: WIDGET_URI, icon: 'sky-calendar' },
  open_chart_studio: { uri: STUDIO_URI, icon: 'chart-studio' },
  get_horoscope: { uri: HOROSCOPE_URI, icon: 'horoscopes' },
};

const panelMeta = (preferredDisplayMode: 'inline' | 'fullscreen') => ({ ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetCSP': { connect_domains: [], resource_domains: [] }, 'openai/widgetPrefersBorder': true, 'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode } });

/** The time zone ChatGPT shares with a tool call, if any (a coarse location hint, never stored). */
export function hostZoneFrom(meta: unknown): string | undefined {
  const location = (meta as Record<string, unknown> | undefined)?.['openai/userLocation'] as Record<string, unknown> | undefined;
  return typeof location?.timezone === 'string' && location.timezone.length <= 64 ? location.timezone : undefined;
}

/** A fresh SDK server per HTTP request or local stdio connection. */
export function createAiServer(dependencies: AiDependencies, watch?: { service: SkyWatch; owner: Principal }) {
  const server = new McpServer({ name: 'zodiacs', version: AI_VERSION }, {
    capabilities: { tools: {}, resources: {}, ...(watch ? { events: {} } : {}) },
    instructions: INSTRUCTIONS,
  });
  server.registerResource('sky-events', WIDGET_URI, {
    title: 'Zodiacs sky calendar', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetDescription': 'A list of what changes in the sky, with times on your clock.' },
  }, () => ({ contents: [{ uri: WIDGET_URI, mimeType: 'text/html;profile=mcp-app', text: WIDGET_HTML, _meta: panelMeta('inline') }] }));
  for (const uri of [STUDIO_URI, LEGACY_STUDIO_URI]) server.registerResource(uri === STUDIO_URI ? 'chart-studio' : 'chart-studio-legacy', uri, {
    title: 'Zodiacs Chart Studio', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetDescription': 'An interactive birth chart the person fills in themselves, calculated inside the panel. Only parts they choose to share reach the conversation.' },
  }, () => ({ contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: STUDIO_HTML, _meta: panelMeta('fullscreen') }] }));
  const tools = offeredTools(dependencies);
  if (tools.includes('get_horoscope')) server.registerResource('horoscopes', HOROSCOPE_URI, {
    title: 'Zodiacs horoscopes', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetDescription': "A Sun-sign horoscope for the person's own day or week, with the sky facts behind it." },
  }, () => ({ contents: [{ uri: HOROSCOPE_URI, mimeType: 'text/html;profile=mcp-app', text: HOROSCOPES_HTML, _meta: panelMeta('inline') }] }));
  for (const tool of tools) {
    const panel = PANELS[tool];
    server.registerTool(tool, {
      title: TOOL_TITLES[tool], description: TOOL_DESCRIPTIONS[tool],
      ...(panel ? { icons: [{ src: `https://zodiacs.org/assets/ai/${panel.icon}.svg`, mimeType: 'image/svg+xml', sizes: ['20x20'] }] } : {}),
      inputSchema: INPUT_SCHEMAS[tool], outputSchema: OUTPUT_SCHEMAS[tool],
      annotations: { ...READ_ONLY, title: TOOL_TITLES[tool], idempotentHint: tool !== 'get_sky' && tool !== 'get_upcoming_events' && tool !== 'get_horoscope' },
      _meta: { ...(!watch ? { securitySchemes: [{ type: 'noauth' }] } : watch.service.oauth ? { securitySchemes: [{ type: 'oauth2', scopes: WATCH_SCOPES }] } : {}), ...(panel ? { ui: { resourceUri: panel.uri, visibility: ['model', 'app'] }, 'openai/outputTemplate': panel.uri, 'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] }, ...(tool === 'get_horoscope' ? { 'openai/widgetAccessible': true } : {}) } : {}) },
    }, async (args: unknown, ctx?: { mcpReq?: { _meta?: unknown } }) => {
      const context: AiCallContext = { hostZone: hostZoneFrom(ctx?.mcpReq?._meta) };
      const result = await executeAiTool(tool, args, { ...dependencies, skyWatch: !!watch }, context);
      return {
        isError: !result.ok, content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result,
        ...(context.horoscopePanel ? { _meta: { 'zodiacs/horoscope': context.horoscopePanel } } : {}),
      };
    });
  }
  if (watch) registerSkyWatch(server, watch.service, watch.owner);
  return server;
}
