import { McpServer } from '@modelcontextprotocol/server';
import { AI_RESULT_SCHEMA, AI_VERSION, HOROSCOPE_URI, OCCASIONS_URI, INPUT_SCHEMAS, OUTPUT_SCHEMAS, READ_ONLY, TOOL_DESCRIPTIONS, TOOL_TITLES, WIDGET_URI, STUDIO_URI, LEGACY_HOROSCOPE_URIS, LEGACY_OCCASIONS_URIS, LEGACY_STUDIO_URIS, LEGACY_WIDGET_URIS, type AiToolName } from './contracts';
import { executeAiTool, offeredTools, type AiCallContext, type AiDependencies } from './tools';
import { STUDIO_HTML } from '../../integrations/generated/chart-studio.mjs';
import { HOROSCOPES_HTML } from '../../integrations/generated/horoscopes.mjs';
import { OCCASIONS_HTML } from '../../integrations/generated/occasions.mjs';
import { WIDGET_HTML } from '../../integrations/generated/sky-calendar.mjs';
import { registerSkyWatch, type SkyWatch } from './watch/service';
import type { Principal } from './watch/contracts';
import { WATCH_SCOPES } from './watch/oauth';
import { ACCOUNT_SCOPES, SAVE_DESCRIPTION, SAVE_OUTPUT_SCHEMA, SAVE_TITLE, SAVE_TOOL_NAME, saveInput } from './accounts/contracts';
import { saveToZodiacs, type AccountPrincipal } from './accounts/save';
import { signInChallenge, type AccountsService } from './accounts/service';

const INSTRUCTIONS = 'Zodiacs calculates the sky and publishes dated Sun-sign horoscopes. Answer in plain words first. Keep calculated facts separate from what they mean in astrology, and say when an answer depends on the time zone. Mention calculation details such as versions, receipts or UTC only if the person asks how something was calculated. Use URLs returned by the tools exactly, including the query and the complete fragment after #. Never rebuild, shorten or change a card link; if no card URL is returned, use a returned page link. Never guess a birth time or a sign. Share the scores, ratings and astrological forecasts plainly and confidently, as astrology’s reading. Zodiacs does not schedule anything, pick investments, make health predictions or guarantee how anything will turn out; do not call its tools for those requests, and say plainly that it cannot.';

const PANELS: Partial<Record<AiToolName, { uri: string; icon: string }>> = {
  get_upcoming_events: { uri: WIDGET_URI, icon: 'sky-calendar' },
  open_chart_studio: { uri: STUDIO_URI, icon: 'chart-studio' },
  get_horoscope: { uri: HOROSCOPE_URI, icon: 'horoscopes' },
  get_occasion_sky: { uri: OCCASIONS_URI, icon: 'occasions' },
  get_life_milestones: { uri: OCCASIONS_URI, icon: 'occasions' },
  get_compatibility: { uri: OCCASIONS_URI, icon: 'occasions' },
  find_chart_twins: { uri: OCCASIONS_URI, icon: 'occasions' },
  get_famous_chart: { uri: OCCASIONS_URI, icon: 'occasions' },
  get_birthday: { uri: OCCASIONS_URI, icon: 'occasions' },
  get_sky_calendar: { uri: OCCASIONS_URI, icon: 'occasions' },
};

const artResourceDomains = ['https://zodiacs.org'];
const panelMeta = (preferredDisplayMode: 'inline' | 'fullscreen', art = false) => ({ ui: { csp: { connectDomains: [], resourceDomains: art ? artResourceDomains : [] }, prefersBorder: true }, 'openai/widgetCSP': { connect_domains: [], resource_domains: art ? artResourceDomains : [] }, 'openai/widgetPrefersBorder': true, 'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode } });

/** The time zone ChatGPT shares with a tool call, if any (a coarse location hint, never stored). */
export function hostZoneFrom(meta: unknown): string | undefined {
  const location = (meta as Record<string, unknown> | undefined)?.['openai/userLocation'] as Record<string, unknown> | undefined;
  return typeof location?.timezone === 'string' && location.timezone.length <= 64 ? location.timezone : undefined;
}

/** ChatGPT marks its calls with openai/ metadata; any other host is counted as an assistant. */
export function refFrom(meta: unknown): 'chatgpt' | 'assistant' {
  return meta && typeof meta === 'object' && Object.keys(meta).some((key) => key.startsWith('openai/')) ? 'chatgpt' : 'assistant';
}

/** The signed-in person behind a request to a server offering accounts, or null for an anonymous request. */
export interface AccountContext { service: AccountsService; principal: AccountPrincipal | null }

/** A fresh SDK server per HTTP request or local stdio connection. */
export function createAiServer(dependencies: AiDependencies, watch?: { service: SkyWatch; owner: Principal }, account?: AccountContext) {
  const server = new McpServer({ name: 'zodiacs', version: AI_VERSION }, {
    capabilities: { tools: {}, resources: {}, ...(watch ? { events: {} } : {}) },
    instructions: INSTRUCTIONS,
  });
  // The current URI first; each earlier one is registered under its own name and serves the same panel.
  const versions = (name: string, uris: readonly string[]) => uris.map((uri, index) => ({ uri, name: index === 0 ? name : `${name}-legacy${uris.length > 2 ? `-${uri.match(/-v(\d+)\.html$/u)?.[1]}` : ''}` }));
  for (const { uri, name } of versions('sky-events', [WIDGET_URI, ...LEGACY_WIDGET_URIS])) server.registerResource(name, uri, {
    title: 'Zodiacs sky calendar', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetDescription': 'A list of what changes in the sky, with times on your clock.' },
  }, () => ({ contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: WIDGET_HTML, _meta: panelMeta('inline') }] }));
  for (const { uri, name } of versions('chart-studio', [STUDIO_URI, ...LEGACY_STUDIO_URIS])) server.registerResource(name, uri, {
    title: 'Zodiacs Chart Studio', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetDescription': 'An interactive birth chart the person fills in themselves, calculated inside the panel. Only parts they choose to share reach the conversation.' },
  }, () => ({ contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: STUDIO_HTML, _meta: panelMeta('fullscreen') }] }));
  const tools = offeredTools(dependencies);
  if (tools.includes('get_horoscope')) for (const { uri, name } of versions('horoscopes', [HOROSCOPE_URI, ...LEGACY_HOROSCOPE_URIS])) server.registerResource(name, uri, {
    title: 'Zodiacs horoscopes', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: artResourceDomains }, prefersBorder: true }, 'openai/widgetDescription': "A Sun-sign horoscope for the person's own day or week, with the sky facts behind it." },
  }, () => ({ contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: HOROSCOPES_HTML, _meta: panelMeta('inline', true) }] }));
  if (tools.some((tool) => PANELS[tool]?.uri === OCCASIONS_URI)) for (const { uri, name } of versions('occasions', [OCCASIONS_URI, ...LEGACY_OCCASIONS_URIS])) server.registerResource(name, uri, {
    title: 'Zodiacs occasions', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: artResourceDomains }, prefersBorder: true }, 'openai/widgetDescription': 'A card from what the assistant worked out: a day that matters, life milestones, two charts compared, chart twins, a famous chart, a birthday or the sky calendar.' },
  }, () => ({ contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: OCCASIONS_HTML, _meta: panelMeta('inline', true) }] }));
  for (const tool of tools) {
    const panel = PANELS[tool];
    server.registerTool(tool, {
      title: TOOL_TITLES[tool], description: TOOL_DESCRIPTIONS[tool],
      ...(panel ? { icons: [{ src: `https://zodiacs.org/assets/ai/${panel.icon}.svg`, mimeType: 'image/svg+xml', sizes: ['20x20'] }] } : {}),
      inputSchema: INPUT_SCHEMAS[tool], outputSchema: OUTPUT_SCHEMAS[tool],
      annotations: { ...READ_ONLY, title: TOOL_TITLES[tool], idempotentHint: tool !== 'get_sky' && tool !== 'get_upcoming_events' && tool !== 'get_horoscope' && tool !== 'get_life_milestones' && tool !== 'get_birthday' && tool !== 'get_sky_calendar' },
      _meta: { ...(!watch ? { securitySchemes: [{ type: 'noauth' }] } : watch.service.oauth ? { securitySchemes: [{ type: 'oauth2', scopes: WATCH_SCOPES }] } : {}), ...(panel ? { ui: { resourceUri: panel.uri, visibility: ['model', 'app'] }, 'openai/outputTemplate': panel.uri, 'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] }, ...(tool === 'get_horoscope' ? { 'openai/widgetAccessible': true } : {}) } : {}) },
    }, async (args: unknown, ctx?: { mcpReq?: { _meta?: unknown } }) => {
      const context: AiCallContext = { hostZone: hostZoneFrom(ctx?.mcpReq?._meta), ref: refFrom(ctx?.mcpReq?._meta) };
      const result = await executeAiTool(tool, args, { ...dependencies, skyWatch: !!watch }, context);
      return {
        isError: !result.ok, content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result,
        ...(context.horoscopePanel ? { _meta: { 'zodiacs/horoscope': context.horoscopePanel } } : {}),
      };
    });
  }
  // Mixed authentication: every tool above stays anonymous; saving needs the person's own account.
  if (account && dependencies.occasions) registerSaveTool(server, dependencies, account);
  if (watch) registerSkyWatch(server, watch.service, watch.owner);
  return server;
}

function registerSaveTool(server: McpServer, dependencies: AiDependencies, account: AccountContext) {
  server.registerTool(SAVE_TOOL_NAME, {
    title: SAVE_TITLE, description: SAVE_DESCRIPTION, inputSchema: saveInput, outputSchema: SAVE_OUTPUT_SCHEMA,
    // It writes only to the signed-in person's own account, and saving the same item again keeps one copy.
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true, title: SAVE_TITLE },
    _meta: { securitySchemes: [{ type: 'oauth2', scopes: [...ACCOUNT_SCOPES] }] },
  }, async (args: unknown, ctx?: { mcpReq?: { _meta?: unknown } }) => {
    if (!account.principal) {
      const refusal = { schema: AI_RESULT_SCHEMA, ok: false as const, tool: SAVE_TOOL_NAME, error: { code: 'authentication-required', message: 'Sign in to your Zodiacs account to save this. Nothing was saved.' } };
      // The Apps SDK convention: ChatGPT reads this challenge and shows its sign-in prompt.
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify(refusal) }], structuredContent: refusal,
        _meta: { 'mcp/www_authenticate': [signInChallenge(account.service.oauth)] } };
    }
    const result = await saveToZodiacs(args, account.principal, account.service.save, { ...(dependencies.localTime ? { localTime: dependencies.localTime } : {}), ...(dependencies.now ? { now: dependencies.now } : {}) }, refFrom(ctx?.mcpReq?._meta));
    return { isError: !result.ok, content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
  });
}
