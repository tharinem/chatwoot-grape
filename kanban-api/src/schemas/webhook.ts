import { z } from 'zod';

/**
 * Chatwoot webhook events we accept. Chatwoot sends `event` in the top-level
 * payload; we dispatch on that string.
 *
 * - `conversation_created` / `conversation_updated`: card create/update
 * - `contact_updated`: refresh mirror fields (name, channel, custom attrs)
 * - `contact_deleted` / `conversation_deleted`: orphan the card (soft-mark)
 */
export const webhookEventSchema = z.enum([
  'conversation_created',
  'conversation_updated',
  'conversation_deleted',
  'contact_updated',
  'contact_deleted',
  'message_created',
]);

/**
 * Permissive payload schema. Chatwoot's webhook bodies vary a lot across
 * versions and event types, so we pick out only what we need and pass
 * everything else through. Most fields are optional.
 */
export const webhookPayloadSchema = z.object({
  event: webhookEventSchema,

  // Conversation fields
  conversation_id: z.number().int().positive().optional(),
  conversation: z.object({
    id: z.number().int().positive(),
    status: z.string().optional(),
    channel: z.string().optional(),
    custom_attributes: z.record(z.unknown()).optional(),
    additional_attributes: z.record(z.unknown()).optional(),
    assignee: z.object({
      id: z.number().int().positive().optional(),
      name: z.string().optional(),
      avatar_url: z.string().optional(),
    }).optional(),
    meta: z.object({
      assignee: z.object({
        id: z.number().int().positive().optional(),
        name: z.string().optional(),
        avatar_url: z.string().optional(),
      }).optional(),
      sender: z.object({
        id: z.number().int().positive().optional(),
        name: z.string().optional(),
        phone_number: z.string().optional(),
        email: z.string().optional(),
      }).optional(),
    }).optional(),
  }).optional(),

  // Contact fields
  contact: z.object({
    id: z.number().int().positive(),
    name: z.string().optional(),
    email: z.string().optional(),
    phone_number: z.string().optional(),
    thumbnail: z.string().optional(),
    custom_attributes: z.record(z.unknown()).optional(),
    additional_attributes: z.record(z.unknown()).optional(),
  }).optional(),

  // Legacy flat fields retained for backward compatibility with the old webhook format
  contact_name: z.string().max(255).optional(),
  channel_type: z.string().max(50).optional(),
  assignee_id: z.number().int().positive().optional(),
  phone: z.string().max(50).optional(),
  email: z.string().optional(),
  conversation_url: z.string().optional(),

  // Message-level fields (for message_created event mirroring private notes)
  id: z.number().int().positive().optional(),
  content: z.string().optional(),
  message_type: z.union([z.string(), z.number()]).optional(),
  private: z.boolean().optional(),
  content_attributes: z.record(z.unknown()).optional(),
}).passthrough();

export const webhookResponseSchema = z.object({
  status: z.string(),
  action: z.string().optional(),
  card_id: z.string().optional(),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
export type WebhookResponse = z.infer<typeof webhookResponseSchema>;
