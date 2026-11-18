import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import history from '../../../../../data/accuracy/history.json';
import type { ReceiptHistory } from '../../../../../accuracy/receipt';

const root = resolve('src/data/accuracy/raw');

export const getStaticPaths = (async () => {
  const dates = new Set((history as ReceiptHistory[]).map(({ date }) => date));
  return (await Promise.all([...dates].map(async (date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new Error(`Invalid accuracy receipt date: ${date}`);
    const directory = resolve(root, date);
    const manifest = await readFile(resolve(directory, 'SHA256SUMS'));
    const files = await Promise.all(manifest.toString().trimEnd().split('\n').map(async (line) => {
      const match = /^([a-f0-9]{64})  ([\w.-]+\.txt)$/u.exec(line);
      if (!match) throw new Error(`Invalid accuracy checksum for ${date}`);
      const [, expected, file] = match;
      const bytes = await readFile(resolve(directory, file));
      if (createHash('sha256').update(bytes).digest('hex') !== expected) {
        throw new Error(`Accuracy SHA-256 mismatch for ${file}`);
      }
      return { params: { date, file }, props: { bytes } };
    }));
    return [...files, { params: { date, file: 'SHA256SUMS' }, props: { bytes: manifest } }];
  }))).flat();
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => new Response(new Uint8Array(props.bytes), {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});
