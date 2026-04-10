import type { PrismaClient } from '@prisma/client';
import { generateApiKey } from '../lib/api-key.js';

export async function seedApiKey(
  prisma: PrismaClient,
  accountId: number
): Promise<string | null> {
  const existing = await prisma.apiKey.findFirst({
    where: { accountId, revokedAt: null },
  });

  if (existing) return null;

  const { raw, prefix, hash, salt } = generateApiKey();

  await prisma.apiKey.create({
    data: { accountId, keyHash: hash, salt, prefix },
  });

  return raw;
}
