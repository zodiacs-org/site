import { it, expect } from 'vitest';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { packInto } from './pack-mcp-server.mjs';

it('packs the complete npm file selection identically from private and Git checkout permissions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcp-permissions-'));
  try {
    const archives = [];
    for (const mode of [0o600, 0o644]) {
      const source = join(root, String(mode));
      const output = join(source, 'output');
      await mkdir(output, { recursive: true });
      for (const [name, text] of Object.entries({
        'package.json': JSON.stringify({ name: 'mcp-pack-permission-fixture', version: '1.0.0', files: ['server.mjs'] }),
        'server.mjs': 'export const fixture = true;\n',
        // npm includes this even though it is absent from `files`.
        'README.md': 'Archive permission regression fixture.\n',
      })) {
        const file = join(source, name);
        await writeFile(file, text);
        await chmod(file, mode);
      }
      archives.push((await packInto(output, source)).bytes);
      expect((await stat(join(source, 'server.mjs'))).mode & 0o777).toBe(mode);
      expect(await readFile(join(source, 'README.md'), 'utf8')).toContain('regression fixture');
    }
    expect(archives[0].equals(archives[1])).toBe(true);
    const tar = gunzipSync(archives[0]);
    const members = [];
    for (let offset = 0; offset < tar.length && tar[offset] !== 0;) {
      const name = tar.subarray(offset, offset + 100).toString().replace(/\0.*$/s, '');
      const mode = parseInt(tar.subarray(offset + 100, offset + 108).toString(), 8);
      const size = parseInt(tar.subarray(offset + 124, offset + 136).toString(), 8);
      members.push(name);
      expect(mode).toBe(0o600);
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    expect(members.sort()).toEqual(['package/README.md', 'package/package.json', 'package/server.mjs']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
