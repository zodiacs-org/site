/**
 * Bind GET response examples to the exact static payloads emitted by this build.
 * Path parameter values come from the operation's published coverage enum.
 */
type Parameter = {
  name: string;
  in: string;
  schema: { enum?: unknown[] };
  example?: unknown;
};
type JsonMedia = { schema: unknown; examples?: Record<string, unknown> };
type Operation = {
  parameters?: Parameter[];
  responses: Record<string, { content?: Record<string, JsonMedia> }>;
};
type Document = { paths: Record<string, { get?: Operation }> };

export function withStaticExamples(
  openapi: Record<string, unknown>,
  payloads: ReadonlyMap<string, Record<string, unknown>>,
): Record<string, unknown> {
  const document = openapi as unknown as Document;
  for (const [template, item] of Object.entries(document.paths)) {
    if (!item.get) continue;
    let path = template;
    for (const parameter of item.get.parameters ?? []) {
      if (parameter.in !== 'path') continue;
      const value = parameter.schema.enum?.[0];
      if (typeof value !== 'string' && typeof value !== 'number') {
        throw new Error('Static OpenAPI example needs a covered path value: ' + template);
      }
      parameter.example = value;
      path = path.replace('{' + parameter.name + '}', String(value));
    }
    if (!path.startsWith('/api/v1/') || /[{}]/.test(path)) {
      throw new Error('Unresolved static OpenAPI example path: ' + template);
    }
    const relativePath = path.slice('/api/v1/'.length);
    const payload = payloads.get(relativePath);
    const media = item.get.responses['200']?.content?.['application/json'];
    if (!payload || !media) {
      throw new Error('Missing static OpenAPI example payload or response: ' + path);
    }
    media.examples = {
      generated: { summary: 'Generated payload: ' + path, value: payload },
    };
  }
  return openapi;
}
