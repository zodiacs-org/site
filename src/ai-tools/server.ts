import { McpServer } from '@modelcontextprotocol/server';
import { AI_RESULT_SCHEMA, AI_VERSION, HOROSCOPE_URI, OCCASIONS_URI, READINGS_SKY_EVENTS_URI, READINGS_URI, READ_ONLY, TOOL_TITLES, WIDGET_URI, STUDIO_URI, LEGACY_HOROSCOPE_URIS, LEGACY_OCCASIONS_URIS, LEGACY_STUDIO_URIS, LEGACY_WIDGET_URIS, descriptionFor, inputSchemaFor, outputSchemaFor, type AiToolName } from './contracts';
import { SAVED_PAGE_EXCEPTION, childBirthDateRefusal, executeAiTool, offeredTools, skyEventsOn, type AiCallContext, type AiDependencies } from './tools';
import { STUDIO_HTML } from '../../integrations/generated/chart-studio.mjs';
import { HOROSCOPES_HTML } from '../../integrations/generated/horoscopes.mjs';
import { OCCASIONS_HTML } from '../../integrations/generated/occasions.mjs';
import { READINGS_HTML } from '../../integrations/generated/readings.mjs';
import { READINGS_SKY_EVENTS_HTML } from '../../integrations/generated/readings-sky-events.mjs';
import { WIDGET_HTML } from '../../integrations/generated/sky-calendar.mjs';
import { registerSkyWatch, type SkyWatch } from './watch/service';
import type { Principal } from './watch/contracts';
import { WATCH_SCOPES } from './watch/oauth';
import { ACCOUNT_SCOPES, SAVE_DESCRIPTION, SAVE_OUTPUT_SCHEMA, SAVE_TITLE, SAVE_TOOL_NAME, saveInput } from './accounts/contracts';
import { saveToZodiacs, type AccountPrincipal } from './accounts/save';
import { signInChallenge, type AccountsService } from './accounts/service';

/**
 * What every assistant reads first. With saving switched on, the privacy sentences name the one exception, the
 * person's own saved page. With the birth-date tools offered, it says that Zodiacs is not for children under 13,
 * so a child's details are not sent at all; the tools refuse them anyway (childBirthDateRefusal).
 */
export const UNDER_13_INSTRUCTION = 'Zodiacs is not directed at children under 13, so do not send a child\'s name, birth date or birthplace to its tools; they refuse a birth date less than 13 years ago.';
function instructions(accounts: boolean, occasions: boolean): string {
  return 'Zodiacs calculates the sky and publishes dated Sun-sign horoscopes. Answer in plain words first. Keep calculated facts separate from what they mean in astrology, and say when an answer depends on the time zone. Mention calculation details such as versions, receipts or UTC only if the person asks how something was calculated. Use URLs returned by the tools exactly, including the query and the complete fragment after #. Never rebuild, shorten or change a card link; if no card URL is returned, use a returned page link. Never put a birth date, birth time, birthplace, coordinates or place name into a link you write. Never guess a birth time or a sign. Ask before using someone else\'s birth details. Zodiacs never stores or logs birth details. Links never carry a birth year, a birth time, a birthplace or the names you give; a birthday link carries only the month and day.' + (accounts ? ` ${SAVED_PAGE_EXCEPTION}` : '') + (occasions ? ` ${UNDER_13_INSTRUCTION}` : '') + ' If a person or a birth date is under 18, do not frame the reading as romance, attraction or a sexual relationship, and say that Zodiacs does not give that framing for anyone under 18. Share the scores, ratings and astrological forecasts plainly and confidently, as astrology’s reading, with each reading-confidence label a tool returns: it says how specific the details were, never the odds that an event happens. Zodiacs gives no betting tips, sports picks, investment timing, election forecasts or health predictions, and guarantees no outcome. It does not schedule anything, pick investments or give financial or medical advice; do not call its tools for any of these requests, and say plainly that it cannot.';
}

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
  get_natal_chart: { uri: READINGS_URI, icon: 'readings' },
  get_horoscope_period: { uri: READINGS_URI, icon: 'readings' },
  get_chinese_zodiac: { uri: READINGS_URI, icon: 'readings' },
  get_personal_transits: { uri: READINGS_URI, icon: 'readings' },
  explain_astrology: { uri: READINGS_URI, icon: 'readings' },
};

/** Tools whose answer moves with the server's clock (today, this week, the current year), or is drawn afresh each time (draw_tarot), so a repeat call can differ. */
const CLOCK_DEPENDENT: ReadonlySet<AiToolName> = new Set(['get_sky', 'get_upcoming_events', 'get_horoscope', 'get_life_milestones', 'get_birthday', 'get_sky_calendar', 'get_horoscope_period', 'get_chinese_zodiac', 'get_personal_transits', 'find_birthplace', 'search_sky_events', 'draw_tarot']);

const artResourceDomains = ['https://zodiacs.org'];
const panelMeta = (preferredDisplayMode: 'inline' | 'fullscreen', art = false) => ({ ui: { csp: { connectDomains: [], resourceDomains: art ? artResourceDomains : [] }, prefersBorder: true }, 'openai/widgetCSP': { connect_domains: [], resource_domains: art ? artResourceDomains : [] }, 'openai/widgetPrefersBorder': true, 'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode } });

// ChatGPT sends openai/userLocation.timezone on a tool call. Claude's MCP connector does not: its tool-call
// metadata has no documented user location, and an MCP Apps host time zone is delivered to the panel, not this
// server. Without a hint a tool that needs today's date assumes UTC and says so.
const HOST_ZONE_KEYS = ['openai/userLocation'] as const;

/** A time zone ChatGPT shares with a tool call, if any. A coarse location hint, never stored. */
export function hostZoneFrom(meta: unknown): string | undefined {
  const record = meta as Record<string, unknown> | undefined;
  if (!record) return undefined;
  for (const key of HOST_ZONE_KEYS) {
    const location = record[key] as Record<string, unknown> | undefined;
    const timezone = location?.timezone ?? location?.timeZone;
    if (typeof timezone === 'string' && timezone.length > 0 && timezone.length <= 64) return timezone;
  }
  return undefined;
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
    instructions: instructions(!!account && !!dependencies.occasions, !!dependencies.occasions),
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
  // With the sky events switch on, the natal chart and the explainer register their wider forms; off, every definition is the published one.
  const skyEvents = skyEventsOn(dependencies);
  // With it on, the natal chart's panel is the one that lists the lunar nodes; the other readings keep theirs.
  const panelFor = (tool: AiToolName) => (skyEvents && tool === 'get_natal_chart' ? { uri: READINGS_SKY_EVENTS_URI, icon: 'readings' } : PANELS[tool]);
  const readingsPanel = (uri: string) => uri === READINGS_URI || uri === READINGS_SKY_EVENTS_URI;
  if (tools.includes('get_horoscope')) for (const { uri, name } of versions('horoscopes', [HOROSCOPE_URI, ...LEGACY_HOROSCOPE_URIS])) server.registerResource(name, uri, {
    title: 'Zodiacs horoscopes', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: artResourceDomains }, prefersBorder: true }, 'openai/widgetDescription': "A Sun-sign horoscope for the person's own day or week, with the sky facts behind it." },
  }, () => ({ contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: HOROSCOPES_HTML, _meta: panelMeta('inline', true) }] }));
  // The coverage tools' panel: inline only, with no launcher of its own, and no earlier URI still served.
  if (tools.some((tool) => panelFor(tool)?.uri === READINGS_URI)) server.registerResource('readings', READINGS_URI, {
    title: 'Zodiacs readings', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: artResourceDomains }, prefersBorder: true }, 'openai/widgetDescription': 'A birth chart, a monthly, yearly or weekly horoscope, the Chinese zodiac, personal transits, or a short explainer. Inline only.' },
  }, () => ({ contents: [{ uri: READINGS_URI, mimeType: 'text/html;profile=mcp-app', text: READINGS_HTML, _meta: panelMeta('inline', true) }] }));
  if (tools.some((tool) => panelFor(tool)?.uri === READINGS_SKY_EVENTS_URI)) server.registerResource('readings-sky-events', READINGS_SKY_EVENTS_URI, {
    title: 'Zodiacs readings', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: artResourceDomains }, prefersBorder: true }, 'openai/widgetDescription': 'A birth chart with its lunar nodes, a monthly, yearly or weekly horoscope, the Chinese zodiac, personal transits, or a short explainer. Inline only.' },
  }, () => ({ contents: [{ uri: READINGS_SKY_EVENTS_URI, mimeType: 'text/html;profile=mcp-app', text: READINGS_SKY_EVENTS_HTML, _meta: panelMeta('inline', true) }] }));
  if (tools.some((tool) => PANELS[tool]?.uri === OCCASIONS_URI)) for (const { uri, name } of versions('occasions', [OCCASIONS_URI, ...LEGACY_OCCASIONS_URIS])) server.registerResource(name, uri, {
    title: 'Zodiacs occasions', mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: artResourceDomains }, prefersBorder: true }, 'openai/widgetDescription': 'A card from what the assistant worked out: a day that matters, life milestones, two charts compared, chart twins, a famous chart, a birthday or the sky calendar.' },
  }, () => ({ contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: OCCASIONS_HTML, _meta: panelMeta('inline', true) }] }));
  for (const tool of tools) {
    const panel = panelFor(tool);
    server.registerTool(tool, {
      title: TOOL_TITLES[tool], description: descriptionFor(tool, skyEvents),
      ...(panel ? { icons: [{ src: `https://zodiacs.org/assets/ai/${panel.icon}.svg`, mimeType: 'image/svg+xml', sizes: ['20x20'] }] } : {}),
      inputSchema: inputSchemaFor(tool, skyEvents), outputSchema: outputSchemaFor(tool, skyEvents),
      annotations: { ...READ_ONLY, title: TOOL_TITLES[tool], idempotentHint: !CLOCK_DEPENDENT.has(tool) },
      _meta: { ...(!watch ? { securitySchemes: [{ type: 'noauth' }] } : watch.service.oauth ? { securitySchemes: [{ type: 'oauth2', scopes: WATCH_SCOPES }] } : {}), ...(panel ? { ui: { resourceUri: panel.uri, visibility: ['model', 'app'] }, 'openai/outputTemplate': panel.uri, 'openai/ui': { entrypoints: readingsPanel(panel.uri) ? [{ type: 'thread' }] : [{ type: 'global' }, { type: 'thread' }] }, ...(tool === 'get_horoscope' ? { 'openai/widgetAccessible': true } : {}) } : {}) },
    }, async (args: unknown, ctx?: { mcpReq?: { _meta?: unknown } }) => {
      const context: AiCallContext = { hostZone: hostZoneFrom(ctx?.mcpReq?._meta), ref: refFrom(ctx?.mcpReq?._meta) };
      // A child's birth date gets the fixed refusal before anything is worked out.
      const result = childBirthDateRefusal(tool, args, dependencies.now?.() ?? new Date(), context.hostZone)
        ?? await executeAiTool(tool, args, { ...dependencies, skyWatch: !!watch }, context);
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
    const hostZone = hostZoneFrom(ctx?.mcpReq?._meta);
    const result = await saveToZodiacs(args, account.principal, account.service.save, { ...(dependencies.localTime ? { localTime: dependencies.localTime } : {}), ...(dependencies.now ? { now: dependencies.now } : {}), ...(hostZone ? { hostZone } : {}) }, refFrom(ctx?.mcpReq?._meta));
    return { isError: !result.ok, content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
  });
}
