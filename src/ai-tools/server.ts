import { McpServer } from '@modelcontextprotocol/server';
import { AI_RESULT_SCHEMA, AI_VERSION, HOROSCOPE_URI, OCCASIONS_URI, READINGS_SKY_EVENTS_URI, READINGS_URI, READ_ONLY, TOOL_TITLES, WIDGET_URI, STUDIO_URI, LEGACY_HOROSCOPE_URIS, LEGACY_OCCASIONS_URIS, LEGACY_STUDIO_URIS, LEGACY_WIDGET_URIS, descriptionFor, inputSchemaFor, outputSchemaFor, type AiToolName } from './contracts';
import { SAVED_PAGE_EXCEPTION, childBirthDateRefusal, executeAiTool, offeredTools, skyEventsOn, yearScorePeopleOn, type AiCallContext, type AiDependencies } from './tools';
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
 * What every assistant reads first: what the server does, what its results hold and its limits, stated as facts
 * about Zodiacs rather than as orders to the assistant (ZOD-58). With saving switched on, the privacy sentences name the one exception, the
 * person's own saved page. With the birth-date tools offered, it says that Zodiacs is not for children under 13,
 * so a child's details are not sent at all; the tools refuse them anyway (childBirthDateRefusal).
 */
export const UNDER_13_INSTRUCTION = 'Zodiacs is not directed at children under 13, so do not send a child\'s name, birth date or birthplace to its tools; they refuse a birth date less than 13 years ago.';
/**
 * ZOD-207 (a draft, waiting for the owner's approval): what the tryouts showed assistants getting wrong, said as
 * facts about Zodiacs. Without the first, an assistant fetched a horoscope or a retrograde check as a first step
 * toward a stock pick, a lottery number or a guarantee. Without the second, it asked for a sign or for birth details
 * where a tool opens without them, answered a date's sign from memory, and sent two friends' birth dates to the
 * Sun-sign explainer. docs/platform/evidence/assistant-tryouts-20261113/ has the runs.
 */
export const OUTSIDE_ZODIACS = 'A request for one of those is outside Zodiacs even when it names a sign, a planet, a retrograde, a birth date or a horoscope: a stock, crypto or lottery pick, a bet, an election or a medical outcome, a guarantee, a reminder or anything scheduled. No Zodiacs tool is for such a request, not even as a first step; the answer is that Zodiacs does not do this, with no tool call.';
export const WHICH_TOOL = 'Which tool: a horoscope goes to get_horoscope even with no sign given, since the person picks the sign in its panel; a birth chart, rising sign or Moon sign asked for with no birth date in the conversation goes to open_chart_studio, which opens with no details and takes them from the person there, and to get_natal_chart once a birth date is given; two people with birth dates go to get_compatibility, as partners, friends, family or colleagues, and two Sun signs alone go to explain_astrology; the sign, decan or cusp of a calendar date goes to get_birthday; what Zodiacs can do, what can be asked of it and how it handles privacy goes to get_capabilities. Signs, dates and positions come from the tools, the well-known ones too, not from memory.';
function instructions(accounts: boolean, occasions: boolean, coverage: boolean): string {
  return 'Zodiacs calculates the sky and publishes dated Sun-sign horoscopes. Its results keep calculated facts separate from what they mean in astrology, and say when an answer depends on the time zone. Calculation details such as versions, receipts and UTC are there for questions about how something was calculated. A URL in a result is complete as returned, including the query and the whole fragment after #, and a card link works only unchanged; where no card URL is returned, the returned page link takes its place. No Zodiacs link holds a birth date, birth time, birthplace, coordinates or place name. A birth time and a sign are taken as the person gives them, never guessed, and someone else\'s birth details are meant to be given with that person\'s agreement; the person asking answers for that, and the tools take the details as given. Zodiacs never stores or logs birth details. Links never carry a birth year, a birth time, a birthplace or the names you give; a birthday link carries only the month and day.' + (accounts ? ` ${SAVED_PAGE_EXCEPTION}` : '') + (occasions ? ` ${UNDER_13_INSTRUCTION}` : '') + ' If a person or a birth date is under 18, Zodiacs gives no reading framed as romance, attraction or a sexual relationship. Scores, ratings and astrological forecasts are astrology\'s reading, and each comes with a "Reading confidence NN%" label: it says how specific the details were, never the odds that an event happens. Zodiacs gives no betting tips, sports picks, investment timing, election forecasts or health predictions, and guarantees no outcome. It does not schedule anything, pick investments or give financial or medical advice. ' + OUTSIDE_ZODIACS + (occasions && coverage ? ` ${WHICH_TOOL}` : '');
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

/** Tools whose answer moves with the server's clock (today, this week, the current year), so a repeat call can differ. */
const CLOCK_DEPENDENT: ReadonlySet<AiToolName> = new Set(['get_sky', 'get_upcoming_events', 'get_horoscope', 'get_life_milestones', 'get_birthday', 'get_sky_calendar', 'get_horoscope_period', 'get_chinese_zodiac', 'get_personal_transits', 'find_birthplace', 'search_sky_events', 'get_year_score', 'get_solar_return']);

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
    instructions: instructions(!!account && !!dependencies.occasions, !!dependencies.occasions, !!dependencies.coverage),
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
  // get_year_score's definition takes a public figure only with its people switch.
  const switches = { yearScorePeople: yearScorePeopleOn(dependencies) };
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
      title: TOOL_TITLES[tool], description: descriptionFor(tool, skyEvents, switches),
      ...(panel ? { icons: [{ src: `https://zodiacs.org/assets/ai/${panel.icon}.svg`, mimeType: 'image/svg+xml', sizes: ['20x20'] }] } : {}),
      inputSchema: inputSchemaFor(tool, skyEvents, switches), outputSchema: outputSchemaFor(tool, skyEvents),
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
