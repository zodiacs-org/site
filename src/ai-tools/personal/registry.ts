/**
 * The personal tools, in tools/list order. Each is offered only while
 * ZODIACS_PERSONAL_TOOLS_ENABLED=1 joins the occasion and coverage switches,
 * after every other tool, so with the switch off every tools/list entry keeps
 * its place and its bytes (src/ai-tools/personal-tools.test.ts).
 *
 * A tool is added by appending its definition here; contracts.ts, tools.ts,
 * server.ts and http.ts read this list and need no change of their own.
 */
import type { PersonalToolDefinition } from './shared';
import { vedicSignsTool } from './vedic-signs';

export const PERSONAL_TOOLS = [vedicSignsTool] as const satisfies readonly PersonalToolDefinition[];

export type PersonalToolName = typeof PERSONAL_TOOLS[number]['name'];
/** The same list, read as definitions (an empty registry's element type is never). */
const DEFINITIONS: readonly PersonalToolDefinition[] = PERSONAL_TOOLS;
export const PERSONAL_TOOL_NAMES = DEFINITIONS.map((tool) => tool.name) as readonly string[] as readonly PersonalToolName[];

export const isPersonalTool = (tool: string): tool is PersonalToolName => (PERSONAL_TOOL_NAMES as readonly string[]).includes(tool);
export const personalTool = (tool: PersonalToolName): PersonalToolDefinition<PersonalToolName> => DEFINITIONS.find((entry) => entry.name === tool)! as PersonalToolDefinition<PersonalToolName>;
/** One record keyed by the personal tools' names, for the contracts' tables. */
export function personalRecord<T>(pick: (tool: PersonalToolDefinition) => T): Record<PersonalToolName, T> {
  return Object.fromEntries(DEFINITIONS.map((tool) => [tool.name, pick(tool)])) as Record<PersonalToolName, T>;
}
