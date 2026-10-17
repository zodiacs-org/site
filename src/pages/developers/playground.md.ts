import type { APIRoute } from 'astro';
import { computePath } from '../../lib/compute-api/constants';
import { codeSamples } from '../../lib/developer-playground';
import { playgroundExamples } from '../../lib/developer-playground-examples';

export const prerender = true;

/**
 * The playground's Markdown twin, for agents: every documented request, how to
 * send it, and how to tell that the answer reproduces the documented one.
 */
export const GET: APIRoute = () => {
  const document = playgroundExamples();
  const lines = [
    '# Compute API playground',
    '',
    'https://zodiacs.org/developers/playground/ sends a documented request to the hosted compute API, runs the same request with the API\'s own code in the browser, and compares both answers with the documented one. This twin lists every request it offers and how to reproduce each without a browser.',
    '',
    `Engine: ${document.engine}. API: ${document.api}`,
    `Every request with its documented answer, as JSON: https://zodiacs.org/developers/playground/examples.json (schema ${document.schema}).`,
    '',
    '## Reproducing an answer',
    '',
    '- Send the body with POST and `Content-Type: application/json` to the endpoint. No key is needed; requests from one address are rate limited.',
    '- An answer reproduces the documented one when the two are equal as JSON. A receipt that names the runtime\'s tzdb (`receipt.timeResolution.runtimeTzdb`, `receipt.provenance.runtime`) follows the server\'s runtime, and so does the digest that cites it.',
    '- Check a citation by recomputing it: `cite.receipt` is `sha256:` and the hex SHA-256 of the receipt\'s RFC 8785 canonical JSON.',
    '- To open a request in the playground, use its link below. A link carries a request only when someone chose to put it in, after the `#`.',
    '',
  ];
  for (const [title, set] of [['Documented requests', document.examples], ['Refusals a body provokes', document.refusals]] as const) {
    lines.push(`## ${title}`, '');
    for (const example of set) {
      const body = typeof example.body === 'string' ? example.body : JSON.stringify(example.body);
      lines.push(
        `### ${example.id}: ${example.summary}`,
        '',
        `POST ${computePath(example.endpoint)}, documented status ${example.status}. Open it: https://zodiacs.org/developers/playground/?example=${example.id}`,
        '',
        '~~~sh',
        codeSamples(example.endpoint, body).curl,
        '~~~',
        '',
      );
      const cite = (example.answer as { cite?: { receipt?: string } }).cite?.receipt;
      if (cite) lines.push(`Documented citation digest: \`${cite}\`.`, '');
    }
  }
  return new Response(`${lines.join('\n').trimEnd()}\n`, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
