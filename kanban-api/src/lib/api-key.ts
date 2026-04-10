import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

interface GeneratedKey {
  raw: string;
  prefix: string;
  hash: string;
  salt: string;
}

interface ApiKeyRecord {
  id: string;
  accountId: number;
  keyHash: string;
  salt: string;
  prefix: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export function generateApiKey(): GeneratedKey {
  const raw = crypto.randomBytes(32).toString('hex');
  const prefix = raw.slice(0, 8);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + raw).digest('hex');
  return { raw, prefix, hash, salt };
}

export function hashApiKey(key: string, salt: string): string {
  return crypto.createHash('sha256').update(salt + key).digest('hex');
}

export async function verifyApiKey(
  prisma: PrismaClient,
  rawKey: string
): Promise<ApiKeyRecord | null> {
  const prefix = rawKey.slice(0, 8);

  const record = await prisma.apiKey.findFirst({
    where: { prefix, revokedAt: null },
  });

  if (!record) return null;

  const candidateHash = hashApiKey(rawKey, record.salt);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(record.keyHash, 'hex');

  if (a.length !== b.length) return null;

  if (!crypto.timingSafeEqual(a, b)) return null;

  return record;
}
