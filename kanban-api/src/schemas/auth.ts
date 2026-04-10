import { z } from 'zod';

export const chatwootTokenSchema = z.object({
  chatwoot_token: z.string().min(1),
  account_id: z.number().int().positive(),
});

export const tokenResponseSchema = z.object({
  token: z.string(),
  api_key: z.string().optional(),
});

export type ChatwootTokenInput = z.infer<typeof chatwootTokenSchema>;
