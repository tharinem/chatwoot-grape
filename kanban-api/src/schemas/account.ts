import { z } from 'zod';

export const accountResponseSchema = z.object({
  id: z.number().int(),
  chatwoot_base_url: z.string(),
  /// True if an API token is stored; false if not. We never return the token itself.
  has_api_token: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const updateAccountConfigSchema = z.object({
  chatwoot_base_url: z.string().url().optional(),
  /// null/empty string clears the stored token; omitting the field keeps it.
  chatwoot_api_token: z.string().nullable().optional(),
});

export const validateTokenResponseSchema = z.object({
  ok: z.boolean(),
  detail: z.string().optional(),
});

export type AccountResponse = z.infer<typeof accountResponseSchema>;
export type UpdateAccountConfig = z.infer<typeof updateAccountConfigSchema>;
