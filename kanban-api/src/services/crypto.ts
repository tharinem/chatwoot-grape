import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'node:crypto';

/**
 * AES-256-GCM symmetric encryption for per-tenant secrets.
 *
 * Key is derived from JWT_SECRET via HKDF-SHA256 with a dedicated "info" label,
 * so it's independent from any other key material that might be derived in the
 * future. If JWT_SECRET rotates, existing ciphertexts become unreadable — plan
 * a re-encryption migration before rotating.
 *
 * Ciphertext format (base64url):
 *   <iv(12B)>.<authTag(16B)>.<ciphertext(variable)>
 */

const ALGO = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;  // GCM standard
const TAG_LENGTH = 16;

function getDerivedKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set; cannot derive encryption key');
  }
  // HKDF: IKM=JWT_SECRET, salt=static, info="tenant-secret-encryption-v1"
  const derived = hkdfSync(
    'sha256',
    secret,
    Buffer.alloc(0),
    'grape-tenant-secret-v1',
    KEY_LENGTH,
  );
  return Buffer.from(derived);
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) throw new Error('encryptSecret: empty input');
  const key = getDerivedKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [b64url(iv), b64url(tag), b64url(ciphertext)].join('.');
}

export function decryptSecret(encoded: string): string {
  const parts = encoded.split('.');
  if (parts.length !== 3) {
    throw new Error('decryptSecret: malformed ciphertext');
  }
  const [ivB64, tagB64, ctB64] = parts as [string, string, string];
  const iv = fromB64url(ivB64);
  const tag = fromB64url(tagB64);
  const ciphertext = fromB64url(ctB64);
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('decryptSecret: invalid iv/tag length');
  }
  const key = getDerivedKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/** Safe helper: tries decrypt, returns null on any error (never throws). */
export function tryDecryptSecret(encoded: string | null | undefined): string | null {
  if (!encoded) return null;
  try {
    return decryptSecret(encoded);
  } catch {
    return null;
  }
}
