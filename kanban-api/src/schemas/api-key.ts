import { z } from 'zod';

export const apiKeySchema = z.object({
  id: z.string(),
  accountId: z.number(),
  prefix: z.string(),
  createdAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
});

export const createApiKeyResponseSchema = z.object({
  id: z.string(),
  raw_key: z.string(),
  prefix: z.string(),
});

export type ApiKey = z.infer<typeof apiKeySchema>;
export type CreateApiKeyResponse = z.infer<typeof createApiKeyResponseSchema>;
