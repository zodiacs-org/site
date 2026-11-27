import { ENGINE_VERSION } from '@zodiacs/engine';
import { COMPUTE_SCHEMAS } from '../lib/compute-api/openapi';
import { AI_VERSION } from './contracts';

/**
 * How /mcp/de440 names itself in initialize. /mcp, the directory's frozen server, keeps
 * { name: 'zodiacs', version } as published. This route serves the same tools on JPL DE440, so it keeps the
 * name clients know the connector by, and says which route and engine it is in its title and in the version's
 * build metadata, which semver leaves out when it orders versions.
 */
export function de440ServerInfo() {
  return { name: 'zodiacs', title: `Zodiacs (JPL DE440, engine ${ENGINE_VERSION})`, version: `${AI_VERSION}+de440.${ENGINE_VERSION}` };
}

/** The route's status reply, which names its service and engine; /mcp keeps its published reply. */
export function de440Health() {
  return { service: 'zodiacs-mcp-de440', version: AI_VERSION, engine: ENGINE_VERSION, transport: 'stateless-streamable-http', ready: true };
}

/** Use the compute API backend wherever a DE440 tool advertises a calculation. */
export function de440OutputSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(de440OutputSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const node = schema as Record<string, unknown>;
  const properties = node.properties as { name?: { const?: string }; ephemeris?: object } | undefined;
  if (properties?.name?.const === '@zodiacs/engine' && properties.ephemeris) {
    return COMPUTE_SCHEMAS.Backend;
  }
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, de440OutputSchema(value)]));
}

export function describeDe440Tools(result: { tools?: unknown } | undefined) {
  if (!Array.isArray(result?.tools)) return;
  for (const tool of result.tools) {
    if (tool.outputSchema) tool.outputSchema = de440OutputSchema(tool.outputSchema);
    if (typeof tool.description !== 'string') continue;
    // This route publishes the corrected calculation. The existing route keeps its original wording.
    tool.description = tool.description.replace(/ Its times for a slow planet's sign change [^.]+\./u, ' Sign change times use DE440.');
  }
}
