/**
 * Runs every documented example through the real handler. The generator
 * writes the result to src/lib/compute-api/examples.json; the tests run it
 * again and compare.
 */
import { ENGINE_VERSION } from '@zodiacs/engine';
import { createComputeApiHandler } from '../../src/lib/compute-api/handler';
import { REFUSAL_EXAMPLES, SUCCESS_EXAMPLES } from '../../src/lib/compute-api/examples';
import type { LocalTimeModule } from '../../src/lib/compute-api/local-time';
import * as sourceLocalTime from '../../src/lib/compute-api/local-time-source';
import { run } from './compute-api-harness';

export const EXAMPLES_PATH = 'src/lib/compute-api/examples.json';

/** A resolver that fails the way a broken deployment would, for the calculation-failed example. */
export const FAILING_LOCAL_TIME: LocalTimeModule = {
  ...sourceLocalTime,
  prepareLocalTime: async () => {
    throw new Error('synthetic resolver failure');
  },
};

export interface ExampleSet {
  generatedBy: string;
  engine: string;
  success: Record<string, Record<string, unknown>>;
  refusals: Record<string, { status: number; headers: Record<string, string>; response: unknown }>;
}

export async function computeExamples(localTime: LocalTimeModule = sourceLocalTime): Promise<ExampleSet> {
  const handler = createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' });
  const success: ExampleSet['success'] = {};
  for (const [endpoint, examples] of Object.entries(SUCCESS_EXAMPLES)) {
    success[endpoint] = {};
    for (const [name, example] of Object.entries(examples)) {
      const response = await run(handler, { endpoint: endpoint as never, body: example.body });
      if (response.status !== 200) {
        throw new Error(`example ${endpoint}.${name} answered ${response.status}: ${response.text}`);
      }
      success[endpoint][name] = response.json;
    }
  }
  const refusals: ExampleSet['refusals'] = {};
  for (const [name, example] of Object.entries(REFUSAL_EXAMPLES)) {
    const refusing = createComputeApiHandler({
      localTime: example.code === 'calculation-failed' ? FAILING_LOCAL_TIME : localTime,
      env: example.env ?? {},
      rateLimit: async () => example.rateLimit ?? 'allowed',
    });
    const response = await run(refusing, {
      endpoint: example.endpoint,
      method: example.method,
      contentType: example.contentType,
      body: example.body,
      ...(example.contentLength === undefined ? {} : { contentLength: example.contentLength }),
    });
    if (response.json?.error?.code !== example.code) {
      throw new Error(`refusal example ${name} answered ${response.status}: ${response.text}`);
    }
    const headers: Record<string, string> = {};
    for (const key of ['allow', 'retry-after']) {
      const value = response.headers.get(key);
      if (value !== undefined) headers[key] = value;
    }
    refusals[name] = { status: response.status, headers, response: response.json };
  }
  return {
    generatedBy: 'scripts/build-compute-examples.mjs',
    engine: `@zodiacs/engine ${ENGINE_VERSION}`,
    success,
    refusals,
  };
}

export function serializeExamples(set: ExampleSet): string {
  return `${JSON.stringify(set, null, 2)}\n`;
}
