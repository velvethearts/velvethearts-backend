import crypto from 'crypto';
import { logger } from './logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const ENCRYPTED_PREFIX = 'enc:v1:';

const STABLE_DEFAULT_SECRET = 'velvet-hearts-secret-encryption-key-v1-2026';

/**
 * Derives a 32-byte (256-bit) encryption key from the environment.
 */
function getEncryptionKey(): Buffer {
  const customKey = process.env.MESSAGE_ENCRYPTION_KEY;
  if (customKey && customKey.trim().length > 0) {
    return crypto.createHash('sha256').update(customKey.trim()).digest();
  }

  // Stable canonical secret for consistent encryption across all environments
  return crypto.createHash('sha256').update(STABLE_DEFAULT_SECRET).digest();
}

// Historical 32-byte key digests used across previous deployments to ensure backward-compatible decryption
const HISTORICAL_KEY_DIGESTS = [
  '1da70fecdb3d8e27dac09e89d34e1421ca66a981a7ac79849cfe5d5e63139b16',
  '2a7c7d1caf8f13c8058ada55fbb30890054602c266b7b2413e023e7af5a4b21f',
  '076d02548fb26a3d596322fd76aba57244f7bf17ef0e0eca35dac4531cc8abdb',
  '759a1255f88f4504ac964d9588a9cf5e7857a4254b7c3b1372c1b5b18a7b8e3f',
  '7a5a30fef8233585a2c2e5be5eded04341315de07d76cb29e18c7f56f50c6f69',
  'b7633d84f5ed20539720654545dee9d4f73dcaf5a7e406e48488046ad3e26d19',
];

/**
 * Returns all possible candidate keys used historically or across different server environments.
 */
function getCandidateKeys(): Buffer[] {
  const secrets = [
    process.env.MESSAGE_ENCRYPTION_KEY,
    STABLE_DEFAULT_SECRET,
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    process.env.FIREBASE_PRIVATE_KEY,
    'velvet-hearts-default-message-secret',
  ].filter(Boolean) as string[];

  const keyMap = new Map<string, Buffer>();
  for (const s of secrets) {
    const key = crypto.createHash('sha256').update(s.trim()).digest();
    keyMap.set(key.toString('hex'), key);
  }

  for (const hexDigest of HISTORICAL_KEY_DIGESTS) {
    if (!keyMap.has(hexDigest)) {
      keyMap.set(hexDigest, Buffer.from(hexDigest, 'hex'));
    }
  }

  return Array.from(keyMap.values());
}

/**
 * Checks whether a given string is already encrypted in the `enc:v1:` format.
 */
export function isEncryptedMessage(text: string | null | undefined): boolean {
  if (typeof text !== 'string') return false;
  return text.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Encrypts a plaintext message string using AES-256-GCM.
 * Output format: `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */
export function encryptMessage(plaintext: string | null | undefined): string | null | undefined {
  if (plaintext === null || plaintext === undefined || typeof plaintext !== 'string') {
    return plaintext;
  }

  if (plaintext.trim().length === 0) {
    return plaintext;
  }

  // Prevent double-encryption
  if (isEncryptedMessage(plaintext)) {
    return plaintext;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (error) {
    logger.error('Failed to encrypt message text:', error);
    return plaintext;
  }
}

/**
 * Decrypts an AES-256-GCM encrypted message string.
 * If the input is unencrypted (legacy plaintext), it is returned as-is.
 * Supports fallback across all candidate keys to ensure seamless decryption across environments.
 */
export function decryptMessage(cipherOrPlain: string | null | undefined): string | null | undefined {
  if (cipherOrPlain === null || cipherOrPlain === undefined || typeof cipherOrPlain !== 'string') {
    return cipherOrPlain;
  }

  // If not encrypted with our prefix, return as legacy plaintext
  if (!isEncryptedMessage(cipherOrPlain)) {
    return cipherOrPlain;
  }

  const payload = cipherOrPlain.slice(ENCRYPTED_PREFIX.length);
  const parts = payload.split(':');

  if (parts.length !== 3) {
    logger.warn('Malformed encrypted message payload format, returning raw string');
    return cipherOrPlain;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  let iv: Buffer, authTag: Buffer, encrypted: Buffer;
  try {
    iv = Buffer.from(ivHex, 'hex');
    authTag = Buffer.from(authTagHex, 'hex');
    encrypted = Buffer.from(encryptedHex, 'hex');
  } catch {
    return cipherOrPlain;
  }

  const candidateKeys = getCandidateKeys();
  for (const key of candidateKeys) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      // Try next candidate key
    }
  }

  logger.warn('Could not decrypt message with any known encryption key, returning original text');
  return cipherOrPlain;
}
