import crypto from 'crypto';
import { logger } from './logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const ENCRYPTED_PREFIX = 'enc:v1:';

/**
 * Derives a 32-byte (256-bit) encryption key from the environment.
 */
function getEncryptionKey(): Buffer {
  const customKey = process.env.MESSAGE_ENCRYPTION_KEY;
  if (customKey && customKey.trim().length > 0) {
    return crypto.createHash('sha256').update(customKey.trim()).digest();
  }

  // Secure fallback derived from application database URL or default secret
  const fallbackSecret = process.env.DATABASE_URL || process.env.FIREBASE_PRIVATE_KEY || 'velvet-hearts-default-message-secret';
  return crypto.createHash('sha256').update(fallbackSecret).digest();
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
    // If encryption fails, fallback safely rather than losing message data
    return plaintext;
  }
}

/**
 * Decrypts an AES-256-GCM encrypted message string.
 * If the input is unencrypted (legacy plaintext), it is returned as-is.
 */
export function decryptMessage(cipherOrPlain: string | null | undefined): string | null | undefined {
  if (cipherOrPlain === null || cipherOrPlain === undefined || typeof cipherOrPlain !== 'string') {
    return cipherOrPlain;
  }

  // If not encrypted with our prefix, return as legacy plaintext
  if (!isEncryptedMessage(cipherOrPlain)) {
    return cipherOrPlain;
  }

  try {
    const key = getEncryptionKey();
    const payload = cipherOrPlain.slice(ENCRYPTED_PREFIX.length);
    const parts = payload.split(':');

    if (parts.length !== 3) {
      logger.warn('Malformed encrypted message payload format, returning raw string');
      return cipherOrPlain;
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    logger.error('Failed to decrypt message text:', error);
    // Return original cipher/text on failure without crashing the API
    return cipherOrPlain;
  }
}
