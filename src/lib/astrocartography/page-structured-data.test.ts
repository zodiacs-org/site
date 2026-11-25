import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../pages/astrocartography/index.astro', import.meta.url), 'utf8');

describe('the /astrocartography/ page structured data', () => {
  it('describes free access with isAccessibleForFree, and publishes no price or offer', () => {
    const line = source.split('\n').find((text) => text.includes("'@type': 'WebApplication'"));
    expect(line).toBeDefined();
    const application = new Function(`return ${line!.trim().replace(/,$/u, '')};`)() as Record<string, unknown>;
    expect(application).toMatchObject({ '@type': 'WebApplication', url: 'https://zodiacs.org/astrocartography/', isAccessibleForFree: true });
    expect(application).not.toHaveProperty('offers');
    expect(source).not.toMatch(/priceCurrency|'Offer'|price:/u);
  });
});
