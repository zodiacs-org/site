import { describe, expect, it } from 'vitest';
import { cleanProfilePhoto, PHOTO_LIMIT } from './photo';
import { parseMe } from './me';

describe('profile photo storage', () => {
  it('keeps only a bounded, local JPEG and strips unrecognized fields', () => {
    const photo = 'data:image/jpeg;base64,/9j/AA==';
    expect(parseMe(JSON.stringify({ version: 1, photo, remoteUrl: 'https://example.com' })).photo).toBe(photo);
    expect(cleanProfilePhoto('https://example.com/a.jpg')).toBeNull();
    expect(cleanProfilePhoto('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(cleanProfilePhoto(`data:image/jpeg;base64,/9j/${'A'.repeat(PHOTO_LIMIT)}`)).toBeNull();
  });
});
