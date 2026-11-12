import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { effectiveHeaders } from './lib/vercel-source-pattern.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('embed widget delivery headers', () => {
  it('lets every /embed/ route be framed by any host while the rest of the site stays unframeable', async () => {
    const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
    const globalPolicy = effectiveHeaders(config, '/').get('content-security-policy');
    expect(globalPolicy).toMatch(/frame-ancestors 'none'/);

    for (const path of ['/embed/sky/', '/embed/sky/light/', '/embed/moon/', '/embed/chart/']) {
      const headers = effectiveHeaders(config, path);
      // `ALLOWALL` is not an X-Frame-Options value; browsers ignore it, and
      // DENY would block the frame, so embeds send no X-Frame-Options and
      // CSP frame-ancestors decides (security-headers audit, F3).
      expect(headers.has('x-frame-options'), path).toBe(false);
      // The site-wide policy with only frame-ancestors opened: an embed keeps
      // default-src, script-src, connect-src, form-action and the rest.
      expect(headers.get('content-security-policy'), path).toBe(
        globalPolicy.replace("frame-ancestors 'none'", 'frame-ancestors *'),
      );
    }

    for (const path of ['/', '/embed', '/birth-chart/', '/horoscopes/aries/', '/widgets/', '/x/embed/']) {
      const headers = effectiveHeaders(config, path);
      expect(headers.get('x-frame-options'), path).toBe('DENY');
      expect(headers.get('content-security-policy'), path).toMatch(/frame-ancestors 'none'/);
    }
  });
});
