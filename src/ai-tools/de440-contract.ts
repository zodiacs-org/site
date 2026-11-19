import { COMPUTE_SCHEMAS } from '../lib/compute-api/openapi';

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
