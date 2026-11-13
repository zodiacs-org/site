import { describe, expect, it } from 'vitest';
import { SIGN_SLUGS } from './signs';
import { signInRu } from './sign-ru';

describe('signInRu', () => {
  it('puts во before Льве and в before every other sign', () => {
    expect(signInRu('leo')).toBe('во Льве');
    expect(signInRu('aries')).toBe('в Овне');
    expect(signInRu('gemini')).toBe('в Близнецах');
    for (const slug of SIGN_SLUGS.filter((sign) => sign !== 'leo')) expect(signInRu(slug)).toMatch(/^в [А-Я]/u);
  });
});
