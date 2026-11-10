/** One Node runtime's rows: node node-run.mjs BUNDLE PACK DIGEST INSTANTS.json > rows.json */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [bundle, pack, digest, instantsFile] = process.argv.slice(2);
const { de440Rows } = await import(pathToFileURL(bundle).href);
const rows = await de440Rows(new Uint8Array(readFileSync(pack)), digest, JSON.parse(readFileSync(instantsFile, 'utf8')));
process.stdout.write(JSON.stringify({ runtime: `node ${process.version}`, rows }));
