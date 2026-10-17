import { describe, expect, it } from 'vitest';
import examples from './compute-api/examples.json';
import { COMPUTE_ENDPOINTS, MAX_BODY_BYTES } from './compute-api/constants';
import { REFUSAL_EXAMPLES, SUCCESS_EXAMPLES } from './compute-api/examples';
import { receiptDigest } from '../lib/receipt-digest';
import {
  LANGUAGES,
  canonicalJson,
  citationDigest,
  citesItsReceipt,
  codeSamples,
  differences,
  fromBase64Url,
  readLink,
  shareLink,
  toBase64Url,
  verdict,
} from './developer-playground';
import { bodyRefusals, playgroundExamples } from './developer-playground-examples';

describe('the playground\'s examples', () => {
  it('offers every documented request with its documented answer, and the refusals a body provokes', () => {
    const offered = playgroundExamples();
    const documented = Object.entries(SUCCESS_EXAMPLES).flatMap(([endpoint, set]) => Object.keys(set).map((name) => `${endpoint}.${name}`));
    expect(offered.examples.map(({ id }) => id)).toEqual(documented);
    expect(new Set(offered.examples.map(({ endpoint }) => endpoint))).toEqual(new Set(COMPUTE_ENDPOINTS));
    for (const example of offered.examples) {
      const [endpoint, name] = example.id.split('.');
      expect(example.answer).toEqual((examples.success as any)[endpoint][name]);
      expect(example.body).toEqual((SUCCESS_EXAMPLES as any)[endpoint][name].body);
    }
    expect(offered.refusals.map(({ name }) => name).sort()).toEqual(['budget-exhausted', 'invalid-json', 'invalid-request']);
    expect(bodyRefusals().map(([name]) => name).sort()).toEqual(offered.refusals.map(({ name }) => name).sort());
    for (const refusal of offered.refusals) {
      expect(refusal.answer).toEqual((examples.refusals as any)[refusal.name].response);
      expect(refusal.status).toBe((examples.refusals as any)[refusal.name].status);
      expect(refusal.body).toEqual(REFUSAL_EXAMPLES[refusal.name].body);
    }
  });
});

describe('the code the playground shows', () => {
  it('sends the request in five languages, each to the endpoint with the text as it stands', () => {
    const body = JSON.stringify(SUCCESS_EXAMPLES.chart.utc.body, null, 2);
    const samples = codeSamples('chart', body);
    expect(Object.keys(samples)).toEqual([...LANGUAGES]);
    for (const language of LANGUAGES) {
      expect(samples[language], language).toContain('https://zodiacs.org/api/v1/chart');
    }
    expect(samples.curl).toContain(`--data-raw '${body}'`);
    expect(samples.javascript).toContain(`body: ${JSON.stringify(body)},`);
    expect(samples.python).toContain(`body = ${JSON.stringify(body)}`);
    expect(samples.swift).toContain(`Data(#"${body.replaceAll('\n', '\\#n')}"#.utf8)`);
    expect(samples.ruby).toContain(`body = '${body}'`);
  });

  it('keeps the whitespace that takes a body past the size the API measures before it reads one', () => {
    const padded = `${JSON.stringify(SUCCESS_EXAMPLES.chart.utc.body)}${' '.repeat(MAX_BODY_BYTES)}`;
    expect(codeSamples('chart', padded).curl).toContain(`--data-raw '${padded}'`);
  });

  it('quotes a body that holds the quoting characters of each language', () => {
    const awkward = JSON.stringify({ note: "it's \"quoted\" \\ and \"#raw" });
    const samples = codeSamples('time', awkward, 'http://127.0.0.1:1');
    expect(samples.curl).toContain(`--data-raw '${awkward.replaceAll("'", "'\\''")}'`);
    expect(samples.swift).toContain(`Data(##"${awkward}"##.utf8)`);
    expect(samples.ruby).toContain(`body = '${awkward.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`);
    // JSON text that is not valid JSON is sent as it is.
    expect(codeSamples('chart', '{"utc": ').curl).toContain(`--data-raw '{"utc": '`);
    // cURL's --data would upload the file a text starting with @ names.
    expect(codeSamples('chart', '@/etc/hosts').curl).toContain(`--data-raw '@/etc/hosts'`);
  });

  it('keeps a Swift raw string from reading the text as an escape, an interpolation or a line break', () => {
    const swift = codeSamples('chart', 'not JSON: \\#(1 + 1) and \\##n\nnext', 'http://127.0.0.1:1').swift;
    expect(swift).toContain('Data(###"not JSON: \\#(1 + 1) and \\##n\\###nnext"###.utf8)');
  });
});

describe('a playground link', () => {
  it('names the example, or the endpoint, and carries the request only when asked, after the #', () => {
    const text = JSON.stringify({ utc: '1990-01-01T00:00:00Z', latitude: 10, longitude: 20 });
    expect(shareLink({ endpoint: 'chart', example: 'chart.utc', text }, false)).toBe('https://zodiacs.org/developers/playground/?example=chart.utc');
    expect(shareLink({ endpoint: 'chart', example: null, text }, false)).toBe('https://zodiacs.org/developers/playground/?endpoint=chart');
    const carrying = shareLink({ endpoint: 'chart', example: null, text }, true);
    const url = new URL(carrying);
    expect(url.search).toBe('?endpoint=chart');
    expect(url.search).not.toContain('1990');
    expect(url.hash.startsWith('#request=')).toBe(true);
    expect(readLink(carrying, COMPUTE_ENDPOINTS)).toEqual({ example: null, endpoint: 'chart', text });
    expect(readLink('https://zodiacs.org/developers/playground/?example=chart.utc', COMPUTE_ENDPOINTS)).toEqual({ example: 'chart.utc', endpoint: null, text: null });
    // Anything else in a link is ignored.
    expect(readLink('/developers/playground/?example=../x&endpoint=delete#request=%%%', COMPUTE_ENDPOINTS)).toEqual({ example: null, endpoint: null, text: null });
  });

  it('encodes any text, unicode included, as base64url and back', () => {
    for (const text of ['', '{}', '{"zone":"América/São_Paulo","note":"✶"}', '\u{1F311}'.repeat(40)]) {
      const encoded = toBase64Url(text);
      expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/u);
      expect(fromBase64Url(encoded)).toBe(text);
    }
    expect(fromBase64Url('/+==')).toBeNull();
    expect(fromBase64Url('wA')).toBeNull();
  });
});

describe('a citation check', () => {
  it('computes the digest of each documented receipt as the API does', async () => {
    for (const [endpoint, set] of Object.entries(examples.success)) {
      for (const [name, answer] of Object.entries<any>(set)) {
        expect(canonicalJson(answer.receipt), `${endpoint} ${name}`).toBe(canonicalJson(JSON.parse(JSON.stringify(answer.receipt))));
        expect(await citationDigest(answer.receipt), `${endpoint} ${name}`).toBe(receiptDigest(answer.receipt));
        expect(await citesItsReceipt(answer)).toEqual({ cited: answer.cite.receipt, computed: answer.cite.receipt, matches: true });
      }
    }
    const tampered = structuredClone(examples.success.chart.utc) as any;
    tampered.receipt.coordinates.latitude = 51.5;
    expect((await citesItsReceipt(tampered))?.matches).toBe(false);
    expect(await citesItsReceipt({ error: { code: 'invalid-json' } })).toBeNull();
  });
});

describe('a comparison of two answers', () => {
  it('names each difference for its cause and gives one verdict', () => {
    const documented = examples.success.time.pinned as any;
    expect(verdict(differences(documented, structuredClone(documented)))).toBe('same');
    const browser = structuredClone(documented);
    browser.receipt.timeResolution.runtimeTzdb = null;
    browser.cite.receipt = 'sha256:0';
    const found = differences(documented, browser);
    expect(found.map(({ path, kind }) => [path, kind])).toEqual([
      ['/receipt/timeResolution/runtimeTzdb', 'runtime'],
      ['/cite/receipt', 'citation'],
    ]);
    expect(verdict(found)).toBe('runtime');
    const nodal = structuredClone(examples.success.chart.utc) as any;
    nodal.result.bodies[10].speed += 5e-9;
    expect(verdict(differences(examples.success.chart.utc, nodal))).toBe('rounding');
    const moved = structuredClone(examples.success.chart.utc) as any;
    moved.result.bodies[0].lon += 0.001;
    expect(verdict(differences(examples.success.chart.utc, moved))).toBe('different');
    // A digest that differs while the receipts agree is a difference in its own right.
    const forged = structuredClone(examples.success.chart.utc) as any;
    forged.cite.receipt = 'sha256:0';
    expect(differences(examples.success.chart.utc, forged)).toEqual([
      { path: '/cite/receipt', kind: 'value', left: examples.success.chart.utc.cite.receipt, right: 'sha256:0' },
    ]);
  });
});
