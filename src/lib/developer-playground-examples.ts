/**
 * The documented requests the developer playground offers, with the answers
 * the API documents for them, served at /developers/playground/examples.json
 * for the page and for agents, and listed in the page's Markdown twin.
 *
 * The requests are the operations' documented request examples
 * (src/lib/compute-api/examples.ts) and the documented refusals that a JSON
 * body alone provokes. The answers are the handler's own
 * (src/lib/compute-api/examples.json). A refusal tied to how a request is
 * framed (its method, media type or declared length), to the server's state
 * (its rate limit, its switch, an engine failure) or to an address that names
 * no endpoint is documented at /developers/compute/#errors and is not a body
 * the playground sends.
 */
import examples from './compute-api/examples.json';
import { REFUSAL_EXAMPLES, SUCCESS_EXAMPLES } from './compute-api/examples';
import { COMPUTE_ORIGIN, type ComputeEndpoint } from './compute-api/constants';
import { PLAYGROUND_EXAMPLES_SCHEMA, PLAYGROUND_PATH, type PlaygroundExample } from './developer-playground';

export interface PlaygroundExamples {
  schema: typeof PLAYGROUND_EXAMPLES_SCHEMA;
  engine: string;
  api: string;
  playground: string;
  examples: PlaygroundExample[];
  refusals: PlaygroundExample[];
}

/** The refusals a JSON body provokes: sent with POST as application/json, under the live rate limit and switch. */
export function bodyRefusals(): Array<[string, (typeof REFUSAL_EXAMPLES)[string]]> {
  return Object.entries(REFUSAL_EXAMPLES).filter(([, example]) => example.endpoint !== null
    && example.method === 'POST'
    && example.contentType === 'application/json'
    && example.contentLength === undefined
    && example.rateLimit === undefined
    && example.env === undefined
    && example.code !== 'calculation-failed');
}

export function playgroundExamples(): PlaygroundExamples {
  const success = examples.success as Record<string, Record<string, unknown>>;
  const refusals = examples.refusals as Record<string, { status: number; response: unknown }>;
  return {
    schema: PLAYGROUND_EXAMPLES_SCHEMA,
    engine: examples.engine,
    api: `${COMPUTE_ORIGIN}/api/v1/`,
    playground: `${COMPUTE_ORIGIN}${PLAYGROUND_PATH}`,
    examples: Object.entries(SUCCESS_EXAMPLES).flatMap(([endpoint, set]) => Object.entries(set).map(([name, example]) => ({
      id: `${endpoint}.${name}`,
      endpoint: endpoint as ComputeEndpoint,
      name,
      summary: example.summary,
      body: example.body,
      status: 200,
      answer: success[endpoint][name],
    }))),
    refusals: bodyRefusals().map(([name, example]) => ({
      id: `${example.endpoint}.${name}`,
      endpoint: example.endpoint as ComputeEndpoint,
      name,
      summary: `Refused: ${example.summary.charAt(0).toLowerCase()}${example.summary.slice(1)}`,
      body: example.body,
      status: refusals[name].status,
      answer: refusals[name].response,
    })),
  };
}
