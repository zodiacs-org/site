import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { Buffer } from 'node:buffer';
import { normalizeEmail } from '../email/input.js';

type Environment = Record<string, unknown>;

const AES_KEY_BYTES = 32;
const GCM_NONCE_BYTES = 12;
const GCM_TAG_BYTES = 16;
const MAX_KEYS = 16;
const MAX_KEYRING_BYTES = 4 * 1024;
const MAX_KEY_VERSION = 1_000_000;
const MAX_PLAINTEXT_BYTES = 16 * 1024;
const MAX_PROVIDER_PLAINTEXT_BYTES = 512;
const WRAPPED_KEY_MAGIC = Buffer.from('ZK01', 'ascii');
const WRAPPED_KEY_BYTES = WRAPPED_KEY_MAGIC.byteLength
  + 4
  + GCM_NONCE_BYTES
  + AES_KEY_BYTES
  + GCM_TAG_BYTES;

export const ACCOUNT_SYNC_V2_ENCRYPTION_KEYS_ENV = 'ACCOUNT_SYNC_V2_ENCRYPTION_KEYS';
export const ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION_ENV = 'ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION';
export const ACCOUNT_SYNC_V2_ENCRYPTION_FORMAT = 'opaque_v1' as const;
export const ACCOUNT_SYNC_V2_KEY_SCOPE = 'service' as const;

export interface AccountEncryptionContext {
  userId: string;
  chartId: string;
  revision: number;
}

export interface AccountDailySunAliasContext {
  userId: string;
  recipientHash: string;
}

export interface AccountDeletionProviderContext {
  requestId: string;
  recipientHash: string;
}

export interface AccountEncryptedEnvelope {
  ciphertext: Buffer;
  nonce: Buffer;
  format: typeof ACCOUNT_SYNC_V2_ENCRYPTION_FORMAT;
  keyScope: typeof ACCOUNT_SYNC_V2_KEY_SCOPE;
  keyVersion: number;
  wrappedKey: Buffer;
}

export class AccountEncryptionFailure extends Error {
  constructor() {
    super('Account encryption is unavailable.');
    this.name = 'AccountEncryptionFailure';
  }
}

interface Keyring {
  activeVersion: number;
  keys: Map<number, Buffer>;
}

function envValue(env: Environment, name: string): string {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function positiveVersion(input: unknown): number | null {
  if (typeof input !== 'string' || !/^[1-9][0-9]{0,6}$/u.test(input)) return null;
  const parsed = Number(input);
  return Number.isSafeInteger(parsed) && parsed <= MAX_KEY_VERSION ? parsed : null;
}

function canonicalBase64Key(input: unknown): Buffer | null {
  if (typeof input !== 'string' || input.length !== 44 || !/^[A-Za-z0-9+/]{43}=$/u.test(input)) {
    return null;
  }
  const decoded = Buffer.from(input, 'base64');
  return decoded.byteLength === AES_KEY_BYTES && decoded.toString('base64') === input
    ? decoded
    : null;
}

function parseKeyring(env: Environment): Keyring {
  const raw = envValue(env, ACCOUNT_SYNC_V2_ENCRYPTION_KEYS_ENV);
  const activeVersion = positiveVersion(envValue(env, ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION_ENV));
  if (!raw || Buffer.byteLength(raw, 'utf8') > MAX_KEYRING_BYTES || activeVersion === null) {
    throw new AccountEncryptionFailure();
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw) as unknown;
  } catch {
    throw new AccountEncryptionFailure();
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new AccountEncryptionFailure();
  }

  const entries = Object.entries(candidate as Record<string, unknown>);
  if (entries.length < 1 || entries.length > MAX_KEYS) throw new AccountEncryptionFailure();
  const keys = new Map<number, Buffer>();
  for (const [rawVersion, rawKey] of entries) {
    const version = positiveVersion(rawVersion);
    const key = canonicalBase64Key(rawKey);
    if (version === null || !key || keys.has(version)) throw new AccountEncryptionFailure();
    keys.set(version, key);
  }
  if (!keys.has(activeVersion)) throw new AccountEncryptionFailure();
  return { activeVersion, keys };
}

function validContext(context: AccountEncryptionContext): boolean {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
  return uuid.test(context.userId)
    && uuid.test(context.chartId)
    && Number.isSafeInteger(context.revision)
    && context.revision >= 1;
}

const ACCOUNT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RECIPIENT_HASH = /^[0-9a-f]{64}$/u;

function validAliasContext(context: AccountDailySunAliasContext): boolean {
  return ACCOUNT_UUID.test(context.userId) && RECIPIENT_HASH.test(context.recipientHash);
}

function validDeletionProviderContext(context: AccountDeletionProviderContext): boolean {
  return ACCOUNT_UUID.test(context.requestId) && RECIPIENT_HASH.test(context.recipientHash);
}

function aad(
  purpose: 'private-chart' | 'data-key-wrap',
  context: AccountEncryptionContext,
  keyVersion?: number,
): Buffer {
  if (!validContext(context)) throw new AccountEncryptionFailure();
  const fields = [
    'zodiacs.account-sync-v2.aead.v1',
    `purpose=${purpose}`,
    `user_id=${context.userId.toLowerCase()}`,
    `chart_id=${context.chartId.toLowerCase()}`,
    `revision=${context.revision}`,
  ];
  if (keyVersion !== undefined) fields.push(`key_version=${keyVersion}`);
  return Buffer.from(fields.join('\n'), 'utf8');
}

function providerAad(
  purpose:
    | 'daily-sun-alias'
    | 'daily-sun-alias-key-wrap'
    | 'deletion-provider'
    | 'deletion-provider-key-wrap',
  context: AccountDailySunAliasContext | AccountDeletionProviderContext,
  keyVersion?: number,
): Buffer {
  const fields = [
    'zodiacs.account-sync-v2.aead.v1',
    `purpose=${purpose}`,
  ];
  if ('userId' in context) {
    if (!validAliasContext(context)) throw new AccountEncryptionFailure();
    fields.push(`user_id=${context.userId.toLowerCase()}`);
  } else {
    if (!validDeletionProviderContext(context)) throw new AccountEncryptionFailure();
    fields.push(`request_id=${context.requestId.toLowerCase()}`);
  }
  fields.push(`recipient_hash=${context.recipientHash}`);
  if (keyVersion !== undefined) fields.push(`key_version=${keyVersion}`);
  return Buffer.from(fields.join('\n'), 'utf8');
}

function encryptGcm(plaintext: Buffer, key: Buffer, nonce: Buffer, associatedData: Buffer): Buffer {
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: GCM_TAG_BYTES });
  cipher.setAAD(associatedData, { plaintextLength: plaintext.byteLength });
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([encrypted, cipher.getAuthTag()]);
}

function decryptGcm(ciphertext: Buffer, key: Buffer, nonce: Buffer, associatedData: Buffer): Buffer {
  if (ciphertext.byteLength <= GCM_TAG_BYTES || nonce.byteLength !== GCM_NONCE_BYTES) {
    throw new AccountEncryptionFailure();
  }
  const encrypted = ciphertext.subarray(0, ciphertext.byteLength - GCM_TAG_BYTES);
  const tag = ciphertext.subarray(ciphertext.byteLength - GCM_TAG_BYTES);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: GCM_TAG_BYTES });
    decipher.setAAD(associatedData, { plaintextLength: encrypted.byteLength });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    throw new AccountEncryptionFailure();
  }
}

function wrapDataKey(
  dataKey: Buffer,
  wrappingKey: Buffer,
  keyVersion: number,
  associatedData: Buffer,
): Buffer {
  const nonce = randomBytes(GCM_NONCE_BYTES);
  const encrypted = encryptGcm(dataKey, wrappingKey, nonce, associatedData);
  const header = Buffer.alloc(WRAPPED_KEY_MAGIC.byteLength + 4);
  WRAPPED_KEY_MAGIC.copy(header, 0);
  header.writeUInt32BE(keyVersion, WRAPPED_KEY_MAGIC.byteLength);
  return Buffer.concat([header, nonce, encrypted]);
}

function unwrapDataKey(
  wrappedKey: Buffer,
  wrappingKey: Buffer,
  expectedKeyVersion: number,
  associatedData: Buffer,
): Buffer {
  if (wrappedKey.byteLength !== WRAPPED_KEY_BYTES
    || !wrappedKey.subarray(0, WRAPPED_KEY_MAGIC.byteLength).equals(WRAPPED_KEY_MAGIC)
    || wrappedKey.readUInt32BE(WRAPPED_KEY_MAGIC.byteLength) !== expectedKeyVersion) {
    throw new AccountEncryptionFailure();
  }
  const nonceStart = WRAPPED_KEY_MAGIC.byteLength + 4;
  const nonce = wrappedKey.subarray(nonceStart, nonceStart + GCM_NONCE_BYTES);
  const encrypted = wrappedKey.subarray(nonceStart + GCM_NONCE_BYTES);
  const dataKey = decryptGcm(
    encrypted,
    wrappingKey,
    nonce,
    associatedData,
  );
  if (dataKey.byteLength !== AES_KEY_BYTES) {
    dataKey.fill(0);
    throw new AccountEncryptionFailure();
  }
  return dataKey;
}

export function encryptAccountPrivatePayload(
  plaintext: string,
  context: AccountEncryptionContext,
  env: Environment = process.env,
): AccountEncryptedEnvelope {
  const plainBytes = Buffer.from(plaintext, 'utf8');
  if (plainBytes.byteLength < 2 || plainBytes.byteLength > MAX_PLAINTEXT_BYTES || !validContext(context)) {
    throw new AccountEncryptionFailure();
  }
  const keyring = parseKeyring(env);
  const wrappingKey = keyring.keys.get(keyring.activeVersion);
  if (!wrappingKey) throw new AccountEncryptionFailure();

  const dataKey = randomBytes(AES_KEY_BYTES);
  try {
    const nonce = randomBytes(GCM_NONCE_BYTES);
    const ciphertext = encryptGcm(plainBytes, dataKey, nonce, aad('private-chart', context));
    const wrappedKey = wrapDataKey(
      dataKey,
      wrappingKey,
      keyring.activeVersion,
      aad('data-key-wrap', context, keyring.activeVersion),
    );
    return {
      ciphertext,
      nonce,
      format: ACCOUNT_SYNC_V2_ENCRYPTION_FORMAT,
      keyScope: ACCOUNT_SYNC_V2_KEY_SCOPE,
      keyVersion: keyring.activeVersion,
      wrappedKey,
    };
  } finally {
    dataKey.fill(0);
    plainBytes.fill(0);
  }
}

export function decryptAccountPrivatePayload(
  envelope: AccountEncryptedEnvelope,
  context: AccountEncryptionContext,
  env: Environment = process.env,
): string {
  if (envelope.format !== ACCOUNT_SYNC_V2_ENCRYPTION_FORMAT
    || envelope.keyScope !== ACCOUNT_SYNC_V2_KEY_SCOPE
    || !Number.isSafeInteger(envelope.keyVersion)
    || envelope.keyVersion < 1
    || envelope.keyVersion > MAX_KEY_VERSION
    || envelope.nonce.byteLength !== GCM_NONCE_BYTES
    || envelope.ciphertext.byteLength <= GCM_TAG_BYTES
    || envelope.ciphertext.byteLength > MAX_PLAINTEXT_BYTES + GCM_TAG_BYTES
    || envelope.wrappedKey.byteLength !== WRAPPED_KEY_BYTES
    || !validContext(context)) {
    throw new AccountEncryptionFailure();
  }
  const keyring = parseKeyring(env);
  const wrappingKey = keyring.keys.get(envelope.keyVersion);
  if (!wrappingKey) throw new AccountEncryptionFailure();

  const dataKey = unwrapDataKey(
    envelope.wrappedKey,
    wrappingKey,
    envelope.keyVersion,
    aad('data-key-wrap', context, envelope.keyVersion),
  );
  let plaintext: Buffer | undefined;
  try {
    plaintext = decryptGcm(envelope.ciphertext, dataKey, envelope.nonce, aad('private-chart', context));
    if (plaintext.byteLength < 2 || plaintext.byteLength > MAX_PLAINTEXT_BYTES) {
      throw new AccountEncryptionFailure();
    }
    return plaintext.toString('utf8');
  } finally {
    dataKey.fill(0);
    plaintext?.fill(0);
  }
}

/**
 * Key rotation. The payload AEAD does not bind the key version; only the data
 * key wrap does. Re-wrapping therefore unwraps the data key with the version it
 * names and wraps it again under the active version, leaving ciphertext and
 * nonce as they are. No payload is decrypted. Returns the new key version and
 * wrapped key, or throws AccountEncryptionFailure (also when the wrapped key is
 * already under the active version, so a caller cannot mistake a no-op).
 */
export interface AccountRewrappedKey {
  keyVersion: number;
  wrappedKey: Buffer;
}

function rewrapDataKey(
  wrappedKey: Buffer,
  keyVersion: number,
  wrapAad: (version: number) => Buffer,
  env: Environment,
): AccountRewrappedKey {
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1 || keyVersion > MAX_KEY_VERSION
    || wrappedKey.byteLength !== WRAPPED_KEY_BYTES) {
    throw new AccountEncryptionFailure();
  }
  const keyring = parseKeyring(env);
  const oldKey = keyring.keys.get(keyVersion);
  const activeKey = keyring.keys.get(keyring.activeVersion);
  if (!oldKey || !activeKey || keyVersion === keyring.activeVersion) {
    throw new AccountEncryptionFailure();
  }
  const dataKey = unwrapDataKey(wrappedKey, oldKey, keyVersion, wrapAad(keyVersion));
  try {
    return {
      keyVersion: keyring.activeVersion,
      wrappedKey: wrapDataKey(
        dataKey,
        activeKey,
        keyring.activeVersion,
        wrapAad(keyring.activeVersion),
      ),
    };
  } finally {
    dataKey.fill(0);
  }
}

export function rewrapAccountPrivatePayloadKey(
  wrappedKey: Buffer,
  keyVersion: number,
  context: AccountEncryptionContext,
  env: Environment = process.env,
): AccountRewrappedKey {
  if (!validContext(context)) throw new AccountEncryptionFailure();
  return rewrapDataKey(wrappedKey, keyVersion, (version) => aad('data-key-wrap', context, version), env);
}

export function rewrapAccountDailySunAliasLocatorKey(
  wrappedKey: Buffer,
  keyVersion: number,
  context: AccountDailySunAliasContext,
  env: Environment = process.env,
): AccountRewrappedKey {
  if (!validAliasContext(context)) throw new AccountEncryptionFailure();
  return rewrapDataKey(
    wrappedKey,
    keyVersion,
    (version) => providerAad('daily-sun-alias-key-wrap', context, version),
    env,
  );
}

export function rewrapAccountDeletionProviderPayloadKey(
  wrappedKey: Buffer,
  keyVersion: number,
  context: AccountDeletionProviderContext,
  env: Environment = process.env,
): AccountRewrappedKey {
  if (!validDeletionProviderContext(context)) throw new AccountEncryptionFailure();
  return rewrapDataKey(
    wrappedKey,
    keyVersion,
    (version) => providerAad('deletion-provider-key-wrap', context, version),
    env,
  );
}

function canonicalProviderPayload(email: string): string {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized !== email) {
    throw new AccountEncryptionFailure();
  }
  return JSON.stringify({ email: normalized });
}

function parseProviderPayload(plaintext: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext) as unknown;
  } catch {
    throw new AccountEncryptionFailure();
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AccountEncryptionFailure();
  }
  const candidate = parsed as Record<string, unknown>;
  if (Object.keys(candidate).length !== 1 || typeof candidate.email !== 'string') {
    throw new AccountEncryptionFailure();
  }
  const canonical = canonicalProviderPayload(candidate.email);
  if (canonical !== plaintext) throw new AccountEncryptionFailure();
  return candidate.email;
}

function encryptProviderPayload(
  email: string,
  payloadAad: Buffer,
  wrapAad: (keyVersion: number) => Buffer,
  env: Environment,
): AccountEncryptedEnvelope {
  const plainBytes = Buffer.from(canonicalProviderPayload(email), 'utf8');
  if (plainBytes.byteLength > MAX_PROVIDER_PLAINTEXT_BYTES) throw new AccountEncryptionFailure();
  const keyring = parseKeyring(env);
  const wrappingKey = keyring.keys.get(keyring.activeVersion);
  if (!wrappingKey) throw new AccountEncryptionFailure();
  const dataKey = randomBytes(AES_KEY_BYTES);
  try {
    const nonce = randomBytes(GCM_NONCE_BYTES);
    return {
      ciphertext: encryptGcm(plainBytes, dataKey, nonce, payloadAad),
      nonce,
      format: ACCOUNT_SYNC_V2_ENCRYPTION_FORMAT,
      keyScope: ACCOUNT_SYNC_V2_KEY_SCOPE,
      keyVersion: keyring.activeVersion,
      wrappedKey: wrapDataKey(dataKey, wrappingKey, keyring.activeVersion, wrapAad(keyring.activeVersion)),
    };
  } finally {
    dataKey.fill(0);
    plainBytes.fill(0);
  }
}

function decryptProviderPayload(
  envelope: AccountEncryptedEnvelope,
  payloadAad: Buffer,
  wrapAad: (keyVersion: number) => Buffer,
  env: Environment,
): string {
  if (envelope.format !== ACCOUNT_SYNC_V2_ENCRYPTION_FORMAT
    || envelope.keyScope !== ACCOUNT_SYNC_V2_KEY_SCOPE
    || !Number.isSafeInteger(envelope.keyVersion)
    || envelope.keyVersion < 1
    || envelope.keyVersion > MAX_KEY_VERSION
    || envelope.nonce.byteLength !== GCM_NONCE_BYTES
    || envelope.ciphertext.byteLength <= GCM_TAG_BYTES
    || envelope.ciphertext.byteLength > MAX_PROVIDER_PLAINTEXT_BYTES + GCM_TAG_BYTES
    || envelope.wrappedKey.byteLength !== WRAPPED_KEY_BYTES) {
    throw new AccountEncryptionFailure();
  }
  const keyring = parseKeyring(env);
  const wrappingKey = keyring.keys.get(envelope.keyVersion);
  if (!wrappingKey) throw new AccountEncryptionFailure();
  const dataKey = unwrapDataKey(
    envelope.wrappedKey,
    wrappingKey,
    envelope.keyVersion,
    wrapAad(envelope.keyVersion),
  );
  let plaintext: Buffer | undefined;
  try {
    plaintext = decryptGcm(envelope.ciphertext, dataKey, envelope.nonce, payloadAad);
    if (plaintext.byteLength < 2 || plaintext.byteLength > MAX_PROVIDER_PLAINTEXT_BYTES) {
      throw new AccountEncryptionFailure();
    }
    return parseProviderPayload(plaintext.toString('utf8'));
  } finally {
    dataKey.fill(0);
    plaintext?.fill(0);
  }
}

export function encryptAccountDailySunAliasLocator(
  email: string,
  context: AccountDailySunAliasContext,
  env: Environment = process.env,
): AccountEncryptedEnvelope {
  if (!validAliasContext(context)) throw new AccountEncryptionFailure();
  return encryptProviderPayload(
    email,
    providerAad('daily-sun-alias', context),
    (version) => providerAad('daily-sun-alias-key-wrap', context, version),
    env,
  );
}

export function decryptAccountDailySunAliasLocator(
  envelope: AccountEncryptedEnvelope,
  context: AccountDailySunAliasContext,
  env: Environment = process.env,
): string {
  if (!validAliasContext(context)) throw new AccountEncryptionFailure();
  return decryptProviderPayload(
    envelope,
    providerAad('daily-sun-alias', context),
    (version) => providerAad('daily-sun-alias-key-wrap', context, version),
    env,
  );
}

export function encryptAccountDeletionProviderPayload(
  email: string,
  context: AccountDeletionProviderContext,
  env: Environment = process.env,
): AccountEncryptedEnvelope {
  if (!validDeletionProviderContext(context)) throw new AccountEncryptionFailure();
  return encryptProviderPayload(
    email,
    providerAad('deletion-provider', context),
    (version) => providerAad('deletion-provider-key-wrap', context, version),
    env,
  );
}

export function decryptAccountDeletionProviderPayload(
  envelope: AccountEncryptedEnvelope,
  context: AccountDeletionProviderContext,
  env: Environment = process.env,
): string {
  if (!validDeletionProviderContext(context)) throw new AccountEncryptionFailure();
  return decryptProviderPayload(
    envelope,
    providerAad('deletion-provider', context),
    (version) => providerAad('deletion-provider-key-wrap', context, version),
    env,
  );
}
