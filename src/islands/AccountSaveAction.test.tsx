import { describe, expect, it } from 'vitest';
import { render } from 'preact-render-to-string';
import AccountSaveAction from './AccountSaveAction';
import OAuthButtons from './OAuthButtons';

const draft = { kind: 'occasion' as const, title: 'The sky on your wedding day', href: '/occasions/#d=2027-06-12' };

describe('OAuthButtons', () => {
  it('renders nothing when no provider is switched on', () => {
    expect(render(<OAuthButtons providers={[]} />)).toBe('');
  });

  it('uses each provider’s wording, an inline mark and no external resource', () => {
    const html = render(<OAuthButtons providers={['google', 'apple']} />);
    expect(html).toContain('Continue with Google');
    expect(html).toContain('Continue with Apple');
    expect(html.match(/<svg/g)).toHaveLength(2);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain('or use your email');
  });

  it('shows only the providers asked for, in order', () => {
    const html = render(<OAuthButtons providers={['apple']} />);
    expect(html).toContain('Continue with Apple');
    expect(html).not.toContain('Google');
  });
});

describe('AccountSaveAction', () => {
  // Server render: no stored session, so the signed-out line shows.
  it('offers a quiet sign-in link to a signed-out reader', () => {
    const html = render(<AccountSaveAction kind="page" noun="card" draft={draft} />);
    expect(html).toContain('Sign in to save');
    expect(html).toContain('this card to your profile');
    expect(html).toContain('href="/profile/#profile-sync"');
    expect(html).not.toMatch(/dialog|modal/i);
  });

  it('renders nothing without a link to save', () => {
    expect(render(<AccountSaveAction kind="page" noun="reading" draft={null} />)).toBe('');
  });

  it('tells a signed-out chart reader that sign-in keeps saved charts on every device', () => {
    const html = render(<AccountSaveAction kind="chart" />);
    expect(html).toContain('Saved charts stay in this browser until you sign in');
    expect(html).toContain('Sign in to save');
  });
});
