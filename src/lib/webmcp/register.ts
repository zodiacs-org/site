import { calculatorToolForPath, CALCULATOR_RUNTIME_URL, type CalculatorToolDescriptor } from './calculator-tools';
import { executeWebMcpSearch, SEARCH_INPUT_SCHEMA, SEARCH_TOOL_NAME } from './search';

interface ModelContextLike {
  registerTool(
    tool: WebMcpToolDescriptor,
    options?: { signal?: AbortSignal },
  ): void | Promise<void>;
}

export interface WebMcpToolDescriptor {
  name: string;
  title?: string;
  description: string;
  inputSchema: Readonly<Record<string, unknown>>;
  annotations: { readOnlyHint: true };
  execute(input: unknown): Promise<unknown>;
}

interface LifecycleTarget {
  addEventListener(type: 'pagehide', listener: EventListener): void;
  removeEventListener(type: 'pagehide', listener: EventListener): void;
}

interface RegistrationState {
  promise: Promise<void>;
  controller: AbortController;
}

export const WEBMCP_SEARCH_TOOL: WebMcpToolDescriptor = Object.freeze({
  name: SEARCH_TOOL_NAME,
  description: 'Search English astrology tools and reference pages on zodiacs.org.',
  inputSchema: SEARCH_INPUT_SCHEMA,
  annotations: Object.freeze({ readOnlyHint: true as const }),
  execute: executeWebMcpSearch,
});

type RuntimeModule = { runCalculatorTool(name: string, input: unknown): Promise<unknown> };

/** The calculations load from their own bundle the first time an agent calls a calculator tool. */
const loadCalculatorRuntime = (): Promise<RuntimeModule> => import(/* @vite-ignore */ CALCULATOR_RUNTIME_URL);

/** A calculator page's tool: its descriptor, with the calculation behind it. */
export function calculatorTool(
  descriptor: CalculatorToolDescriptor,
  load: () => Promise<RuntimeModule> = loadCalculatorRuntime,
): WebMcpToolDescriptor {
  return Object.freeze({
    name: descriptor.name,
    title: descriptor.title,
    description: descriptor.description,
    inputSchema: descriptor.inputSchema,
    annotations: Object.freeze({ readOnlyHint: true as const }),
    execute: (input: unknown) => load().then((runtime) => runtime.runCalculatorTool(descriptor.name, input)),
  });
}

/**
 * Registers a document's tools once per model context: they stay through the back-forward cache and are withdrawn
 * when the page is really unloaded. A rejected registration can be retried.
 */
export function createWebMcpRegistrar() {
  const registrations = new WeakMap<ModelContextLike, RegistrationState>();

  return function registerWebMcpTools(
    modelContext: ModelContextLike,
    tools: readonly WebMcpToolDescriptor[],
    lifecycle: LifecycleTarget = window,
  ): Promise<void> {
    const existing = registrations.get(modelContext);
    if (existing) return existing.promise;

    const controller = new AbortController();
    const onPageHide: EventListener = (event) => {
      if ((event as PageTransitionEvent).persisted) return;
      controller.abort();
      lifecycle.removeEventListener('pagehide', onPageHide);
    };
    lifecycle.addEventListener('pagehide', onPageHide);

    const promise = Promise.resolve()
      .then(() => Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))))
      .then(() => undefined)
      .catch((error) => {
        controller.abort();
        lifecycle.removeEventListener('pagehide', onPageHide);
        registrations.delete(modelContext);
        throw error;
      });
    registrations.set(modelContext, { promise, controller });
    return promise;
  };
}

export function createWebMcpSearchRegistrar() {
  const register = createWebMcpRegistrar();
  return (modelContext: ModelContextLike, lifecycle: LifecycleTarget = window): Promise<void> => (
    register(modelContext, [WEBMCP_SEARCH_TOOL], lifecycle)
  );
}

export const registerWebMcpSearch = createWebMcpSearchRegistrar();

/** The tools a page registers: search on English pages, and the page's calculator tool in every locale. */
export function webMcpToolsForPage({ path, search }: { path: string; search: boolean }): WebMcpToolDescriptor[] {
  const calculator = calculatorToolForPath(path);
  return [
    ...(search ? [WEBMCP_SEARCH_TOOL] : []),
    ...(calculator ? [calculatorTool(calculator)] : []),
  ];
}

const registerPageTools = createWebMcpRegistrar();

/** What Base.astro calls when the browser or an extension provides modelContext. */
export function registerWebMcpPage(
  modelContext: ModelContextLike,
  page: { path: string; search: boolean },
  lifecycle: LifecycleTarget = window,
): Promise<void> {
  return registerPageTools(modelContext, webMcpToolsForPage(page), lifecycle);
}

export { executeWebMcpSearch } from './search';
