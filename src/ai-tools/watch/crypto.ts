import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import type { Destination } from './contracts';

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function signingKey(secret: string): Buffer {
  if (!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)) throw new Error('invalid-signing-key');
  const key = Buffer.from(secret.slice(6), 'base64');
  if (key.length < 24 || key.length > 64 || key.toString('base64') !== secret.slice(6)) throw new Error('invalid-signing-key');
  return key;
}
export function signature(secret: string, id: string, seconds: number, body: string) {
  return `v1,${createHmac('sha256', signingKey(secret)).update(`${id}.${seconds}.${body}`).digest('base64')}`;
}
/** AES-256-GCM; the subscription identity prevents swapping encrypted destinations. */
export function destinationVault(encodedKey: string) {
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encodedKey) throw new Error('invalid-encryption-key');
  return {
    seal(value: Destination, identity: string) {
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, nonce);
      cipher.setAAD(Buffer.from(identity));
      const bytes = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
      return ['v1', nonce.toString('base64'), cipher.getAuthTag().toString('base64'), bytes.toString('base64')].join('.');
    },
    open(value: string, identity: string): Destination {
      const [version, nonce, tag, ciphertext, extra] = value.split('.');
      if (version !== 'v1' || !nonce || !tag || !ciphertext || extra) throw new Error('invalid-ciphertext');
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'base64'));
      decipher.setAAD(Buffer.from(identity)); decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8'));
    },
  };
}
