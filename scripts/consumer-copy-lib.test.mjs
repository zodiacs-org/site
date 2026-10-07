import { describe, expect, it } from 'vitest';
import { backstageCopyMatches, consumerFacingText } from './consumer-copy-lib.mjs';

describe('consumer copy guard', () => {
  it('flags backstage language in visible reader copy and metadata', () => {
    const html = `<!doctype html><html><head><meta name="description" content="A deterministic renderer"></head><body><main><p>This is AI-operated.</p></main></body></html>`;
    expect(backstageCopyMatches(html, '/about/')).toEqual([
      'AI-operated',
      'deterministic publishing language',
    ]);
  });

  it('allows the same language inside an intentional closed disclosure', () => {
    const html = `<html><body><p>Your reading comes first.</p><details><summary>How it works</summary><p>Generation mode and source hashes.</p></details></body></html>`;
    expect(consumerFacingText(html)).toContain('Your reading comes first.');
    expect(consumerFacingText(html)).not.toContain('Generation mode');
    expect(backstageCopyMatches(html, '/today/')).toEqual([]);
  });

  it('keeps nested disclosures out of the default-visible copy', () => {
    const html = `<html><body><p>Your reading comes first.</p><details><summary>Evidence</summary><p>Generation mode.</p><details open><summary>Receipt</summary><p>Source hash.</p></details><p>Fail-closed.</p></details><p>Your next step.</p></body></html>`;
    const text = consumerFacingText(html);
    expect(text).toContain('Your reading comes first.');
    expect(text).toContain('Your next step.');
    expect(text).not.toContain('Generation mode');
    expect(text).not.toContain('Source hash');
    expect(text).not.toContain('Fail-closed');
  });

  it('still checks details that are open by default', () => {
    const html = `<html><body><details open><summary>Notes</summary><p>Versioned templates.</p></details></body></html>`;
    expect(backstageCopyMatches(html, '/today/')).toEqual(['versioned templates']);
  });

  it('exempts intentional method-first destinations without weakening consumer pages', () => {
    const html = `<html><body><p>AI-operated with a fail-closed gate.</p></body></html>`;
    expect(backstageCopyMatches(html, '/methodology/')).toEqual([]);
    expect(backstageCopyMatches(html, '/developers/engine/reference/interfaces/receipt.NatalEnvelope.html')).toEqual([]);
    expect(backstageCopyMatches(html, '/developers/engine/')).toEqual(['AI-operated', 'fail-closed']);
    expect(backstageCopyMatches(html, '/developers/engine/reference-other/')).toEqual(['AI-operated', 'fail-closed']);
    expect(backstageCopyMatches(html, '/horoscopes/aries/')).toEqual(['AI-operated', 'fail-closed']);
  });

  it('does not reject exact timing when exact timing is the answer', () => {
    const html = `<html><body><p>Mercury stations direct at 14:32 UTC on July 19.</p></body></html>`;
    expect(backstageCopyMatches(html, '/transits/search/')).toEqual([]);
  });
});
