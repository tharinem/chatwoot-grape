import { z } from 'zod';

/**
 * Chatwoot webhook events we accept. Chatwoot sends `event` in the top-level
 * payload; we dispatch on that string.
 *
 * - `conversation_created` / `conversation_updated`: card create/update
 * - `contact_updated`: refresh mirror fields (name, channel, custom attrs)
 * - `contact_deleted` / `conversation_deleted`: orphan the card (soft-mark)
 * - `conversation_status_changed`: dashboard's hard-delete surfaces here with
 *   status === 'deleted' (Chatwoot doesn't expose a real `conversation_deleted`
 *   event in the webhook picker)
 * - `message_created`: used to mirror private notes back to the matching card
 */
export const webhookEventSchema = z.enum([
  'conversation_created',
  'conversation_updated',
  'conversation_deleted',
  'conversation_status_changed',
  'contact_updated',
  'contact_deleted',
  'message_created',
]);

/**
 * Permissive payload schema. Chatwoot's webhook bodies vary a lot across
 * versions and event types, so we pick out only what we need and pass
 * everything else through.
 *
 * Important: Chatwoot frequently sends `null` for absent fields (instead of
 * omitting them), so optional-but-nullable fields use `.nullish()` (== nullable
 * + optional). Using plain `.optional()` was making the schema reject real
 * payloads like `meta.sender.email: null` with a Zod 400, which is why no
 * card was being created from any conversation.
 */
const nullishString = z.string().nullish();
const nullishPositiveInt = z.number().int().positive().nullish();
const nullishRecord = z.record(z.unknown()).nullish();

export const webhookPayloadSchema = z.object({
  event: webhookEventSchema,

  // Conversation fields
  conversation_id: nullishPositiveInt,
  conversation: z.object({
    id: z.number().int().positive(),
    status: nullishString,
    channel: nullishString,
    custom_attributes: nullishRecord,
    additional_attributes: nullishRecord,
    assignee: z.object({
      id: nullishPositiveInt,
      name: nullishString,
      avatar_url: nullishString,
    }).nullish(),
    meta: z.object({
      assignee: z.object({
        id: nullishPositiveInt,
        name: nullishString,
        avatar_url: nullishString,
      }).nullish(),
      sender: z.object({
        id: nullishPositiveInt,
        name: nullishString,
        phone_number: nullishString,
        email: nullishString,
      }).nullish(),
    }).nullish(),
  }).nullish(),

  // Contact fields
  contact: z.object({
    id: z.number().int().positive(),
    name: nullishString,
    email: nullishString,
    phone_number: nullishString,
    thumbnail: nullishString,
    custom_attributes: nullishRecord,
    additional_attributes: nullishRecord,
  }).nullish(),

  // Legacy flat fields retained for backward compatibility with the old webhook format
  contact_name: z.string().max(255).nullish(),
  channel_type: z.string().max(50).nullish(),
  assignee_id: nullishPositiveInt,
  phone: z.string().max(50).nullish(),
  email: nullishString,
  conversation_url: nullishString,

  // Message-level fields (for message_created event mirroring private notes)
  id: nullishPositiveInt,
  content: nullishString,
  message_type: z.union([z.string(), z.number()]).nullish(),
  private: z.boolean().nullish(),
  content_attributes: nullishRecord,
}).passthrough();

export const webhookResponseSchema = z.object({
  status: z.string(),
  action: z.string().optional(),
  card_id: z.string().optional(),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
export type WebhookResponse = z.infer<typeof webhookResponseSchema>;
