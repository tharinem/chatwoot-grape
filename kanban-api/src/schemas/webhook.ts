import { z } from 'zod';

export const webhookPayloadSchema = z.object({
  contact_name: z.string().min(1).max(255),
  conversation_id: z.number().int().positive(),
  channel_type: z.string().max(50).optional(),
  assignee_id: z.number().int().positive().optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  conversation_url: z.string().url().optional(),
});

export const webhookResponseSchema = z.object({
  status: z.string(),
  job_id: z.string(),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
export type WebhookResponse = z.infer<typeof webhookResponseSchema>;
