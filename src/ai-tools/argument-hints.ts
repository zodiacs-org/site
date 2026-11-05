import type { z } from 'zod';
import { AI_RESULT_SCHEMA, INPUT_SCHEMAS } from './contracts';

/**
 * Builds a structured refusal for tool arguments that fail the input schema, naming
 * the field so an assistant can correct its call. Every word comes from the schema
 * itself (field names, enum options, descriptions, fixed refinement sentences),
 * never from the request: an unknown property is reported without its name.
 */
type Shape = Record<string, z.ZodType>;
const shapeOf = (schema: any): Shape | undefined => schema?.shape ?? schema?._zod?.def?.shape ?? (schema?._zod?.def?.innerType ? shapeOf(schema._zod.def.innerType) : schema?._zod?.def?.in ? shapeOf(schema._zod.def.in) : undefined);
const unwrap = (schema: any): any => { let s = schema; for (let i = 0; i < 6 && s?._zod?.def?.innerType; i++) s = s._zod.def.innerType; return s; };
const ISO_HINT = ' Use an ISO 8601 time with Z or an offset, such as 2026-10-08T09:00:00+07:00, not a plain date.';

function fieldAt(schema: any, path: readonly PropertyKey[]): { name: string; field: any } | undefined {
  let current = schema; const names: string[] = [];
  for (const key of path) {
    if (typeof key === 'number') { const inner = unwrap(current)?._zod?.def?.element; if (!inner) return undefined; current = inner; names.push(`[${key}]`); continue; }
    const shape = shapeOf(unwrap(current));
    if (typeof key !== 'string' || !shape || !Object.prototype.hasOwnProperty.call(shape, key)) return undefined;
    current = shape[key]; names.push(names.length ? `.${key}` : key);
  }
  return names.length ? { name: names.join(''), field: current } : undefined;
}

function sentence(issue: z.core.$ZodIssue, schema: any): string {
  if (issue.code === 'custom') return issue.message;
  if (issue.code === 'unrecognized_keys') return 'The arguments include a field this tool does not accept; call tools/list for its fields.';
  const located = fieldAt(schema, issue.path);
  if (!located) return 'The arguments do not match the input schema; call tools/list for its fields.';
  const { name, field } = located;
  const inner = unwrap(field); const description: string | undefined = field?.description ?? inner?.description;
  if (issue.code === 'invalid_type' && (issue as any).input === undefined) return `${name} is required.`;
  if (issue.code === 'invalid_value' && Array.isArray((issue as any).values)) return `${name} must be one of: ${(issue as any).values.join(', ')}.`;
  const iso = /ISO 8601 time with Z or an offset/.test(description ?? '');
  return `${name} is not in the accepted form.${iso ? ISO_HINT : description ? ` ${description}` : ''}`;
}

/** `inputSchema` is the tool's schema in effect when it is not the published one (the sky events switch's wider forms). */
export function argumentRefusal(tool: string, args: unknown, inputSchema?: z.ZodType) {
  const schema = inputSchema ?? (INPUT_SCHEMAS as Record<string, z.ZodType>)[tool];
  if (!schema) return undefined;
  const parsed = schema.safeParse(args ?? {});
  if (parsed.success) return undefined;
  const message = [...new Set(parsed.error.issues.slice(0, 4).map(issue => sentence(issue, schema)))].join(' ');
  return { schema: AI_RESULT_SCHEMA, ok: false as const, tool, error: { code: 'invalid-arguments', message } };
}
