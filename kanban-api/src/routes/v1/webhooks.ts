import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { tryDecryptSecret } from '../../services/crypto.js';
import { fetchContact, fetchConversation, KANBAN_NOTE_SOURCE } from '../../services/chatwoot-client.js';
import {
  webhookPayloadSchema,
  webhookResponseSchema,
  type WebhookPayload,
} from '../../schemas/webhook.js';

/**
 * Synchronous webhook handler. Creates/updates/orphans cards directly against
 * the DB (no queue). Redis/BullMQ are intentionally not used here — the volume
 * is low and latency is not critical. If we ever need to scale, reintroduce a
 * queue by having this handler enqueue instead of touching the DB.
 *
 * All mutations are wrapped in findFirst + create-or-update paths keyed by
 * (accountId, conversationId) since that's the unique index on `cards`.
 *
 * If the account has a `chatwootApiToken` configured, we hydrate the card
 * with fresh custom_attributes. If not, we use only what Chatwoot sent in the
 * webhook payload.
 */

interface EnrichedData {
  contactName: string | null;
  contactId: number | null;
  channelType: string | null;
  assigneeId: number | null;
  agentName: string | null;
  agentAvatar: string | null;
  customFields: {
    contact?: Record<string, unknown>;
    conversation?: Record<string, unknown>;
  };
}

function safeValue<T>(val: T | undefined | null): T | null {
  return val ?? null;
}

async function enrichFromChatwoot(
  accountId: number,
  payload: WebhookPayload,
): Promise<EnrichedData> {
  // Start with whatever came in the webhook payload (payload-only mode).
  const payloadContactId = payload.contact?.id ?? null;
  const payloadConversationId = payload.conversation?.id ?? payload.conversation_id ?? null;

  const enriched: EnrichedData = {
    contactName: payload.contact?.name ?? payload.contact_name ?? null,
    contactId: payloadContactId,
    channelType: payload.conversation?.channel ?? payload.channel_type ?? null,
    assigneeId:
      payload.conversation?.assignee?.id ??
      payload.conversation?.meta?.assignee?.id ??
      payload.assignee_id ??
      null,
    agentName:
      payload.conversation?.assignee?.name ??
      payload.conversation?.meta?.assignee?.name ??
      null,
    agentAvatar:
      payload.conversation?.assignee?.avatar_url ??
      payload.conversation?.meta?.assignee?.avatar_url ??
      null,
    customFields: {
      ...(payload.contact?.custom_attributes
        ? { contact: payload.contact.custom_attributes }
        : {}),
      ...(payload.conversation?.custom_attributes
        ? { conversation: payload.conversation.custom_attributes }
        : {}),
    },
  };

  // If account has a token, do a live fetch to pick up attributes that
  // might not have been included in the webhook body.
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || !account.chatwootApiToken) return enriched;

  const token = tryDecryptSecret(account.chatwootApiToken);
  if (!token) return enriched;

  const fetchOpts = {
    baseUrl: account.chatwootBaseUrl,
    accountId: account.id,
    apiToken: token,
  };

  if (payloadContactId) {
    const contact = await fetchContact(payloadContactId, fetchOpts);
    if (contact) {
      enriched.contactName = contact.name ?? enriched.contactName;
      enriched.contactId = contact.id;
      if (contact.custom_attributes) {
        enriched.customFields.contact = contact.custom_attributes;
      }
    }
  }

  if (payloadConversationId) {
    const conv = await fetchConversation(payloadConversationId, fetchOpts);
    if (conv) {
      enriched.channelType = conv.channel ?? enriched.channelType;
      enriched.assigneeId = conv.assignee_id ?? enriched.assigneeId;
      if (conv.custom_attributes) {
        enriched.customFields.conversation = conv.custom_attributes;
      }
    }
  }

  return enriched;
}

function serializeCustomFields(cf: EnrichedData['customFields']): string | null {
  if (!cf.contact && !cf.conversation) return null;
  return JSON.stringify(cf);
}

async function firstStageId(accountId: number): Promise<string | null> {
  const stage = await prisma.stage.findFirst({
    where: { accountId },
    orderBy: { position: 'asc' },
    select: { id: true },
  });
  return stage?.id ?? null;
}

async function upsertCardFromWebhook(
  accountId: number,
  conversationId: number,
  enriched: EnrichedData,
): Promise<string | null> {
  const existing = await prisma.card.findUnique({
    where: { accountId_conversationId: { accountId, conversationId } },
  });

  const customFieldsString = serializeCustomFields(enriched.customFields);

  if (existing) {
    // Update only mirror fields; never overwrite pipeline fields
    // (stageId, dealValue, priority, nextFollowUp) the agent may have edited.
    const data: Prisma.CardUpdateInput = {
      contactName: enriched.contactName ?? existing.contactName,
      contactId: safeValue(enriched.contactId ?? existing.contactId),
      channelType: safeValue(enriched.channelType ?? existing.channelType),
      assigneeId: safeValue(enriched.assigneeId ?? existing.assigneeId),
      agentName: safeValue(enriched.agentName ?? existing.agentName),
      agentAvatar: safeValue(enriched.agentAvatar ?? existing.agentAvatar),
      customFields: customFieldsString ?? existing.customFields,
      isOrphan: false, // reappeared from upstream → no longer orphan
      deletedAt: null, // undelete if it was soft-deleted
    };
    const updated = await prisma.card.update({
      where: { id: existing.id },
      data,
    });
    return updated.id;
  }

  // New card — needs a stage. Use the leftmost stage of this account.
  const stageId = await firstStageId(accountId);
  if (!stageId) return null; // no stages configured yet; drop gracefully

  // Compute position = 0 and shift others down by 1 via a transaction.
  const created = await prisma.$transaction(async (tx) => {
    await tx.card.updateMany({
      where: { accountId, stageId, deletedAt: null },
      data: { position: { increment: 1 } },
    });
    return tx.card.create({
      data: {
        accountId,
        stageId,
        contactName: enriched.contactName ?? 'Lead sem nome',
        conversationId,
        contactId: enriched.contactId,
        channelType: enriched.channelType,
        assigneeId: enriched.assigneeId,
        agentName: enriched.agentName,
        agentAvatar: enriched.agentAvatar,
        customFields: customFieldsString,
        position: 0,
        isOrphan: false,
      },
    });
  });
  return created.id;
}

async function markOrphan(accountId: number, conversationId: number): Promise<string | null> {
  const card = await prisma.card.findUnique({
    where: { accountId_conversationId: { accountId, conversationId } },
  });
  if (!card) return null;
  await prisma.card.update({
    where: { id: card.id },
    data: { isOrphan: true },
  });
  return card.id;
}

async function markOrphanByContact(accountId: number, contactId: number): Promise<string[]> {
  const cards = await prisma.card.findMany({
    where: { accountId, contactId },
    select: { id: true },
  });
  if (cards.length === 0) return [];
  await prisma.card.updateMany({
    where: { accountId, contactId },
    data: { isOrphan: true },
  });
  return cards.map((c) => c.id);
}

async function send<T>(reply: FastifyReply, status: number, body: T) {
  return reply.code(status).send(body);
}

export default async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/webhooks/chatwoot', {
    onRequest: [fastify.authenticateApiKey],
    schema: {
      body: webhookPayloadSchema,
      response: { 202: webhookResponseSchema, 200: webhookResponseSchema },
    },
  }, async (request, reply) => {
    const { account_id } = request.apiKeyAccount!;
    const payload = request.body as WebhookPayload;
    const event = payload.event;

    // Resolve conversation id up front — many events share the same key.
    // Chatwoot sends conversation-level events (conversation_created/updated/
    // status_changed) with the conversation attributes at the TOP LEVEL of the
    // payload (`conversation.webhook_data.merge(event:)`), so `payload.id` IS
    // the conversation id there. Message-level events nest `conversation` and
    // use top-level `id` for the message — never fall back for those.
    const conversationId =
      payload.conversation?.id ??
      payload.conversation_id ??
      (event.startsWith('conversation_') ? payload.id ?? undefined : undefined);

    try {
      switch (event) {
        case 'conversation_created':
        case 'conversation_updated': {
          if (!conversationId) {
            return send(reply, 200, { status: 'ignored', action: `${event}:no-conversation-id` });
          }
          const enriched = await enrichFromChatwoot(account_id, payload);
          const cardId = await upsertCardFromWebhook(account_id, conversationId, enriched);
          return send(reply, 202, {
            status: 'accepted',
            action: cardId ? `${event}:upserted` : `${event}:no-stage-available`,
            card_id: cardId ?? undefined,
          });
        }

        case 'contact_updated': {
          if (!payload.contact?.id) {
            return send(reply, 200, { status: 'ignored', action: 'contact_updated:no-contact-id' });
          }
          // Mirror all cards that point to this contact. Reuse enrichment
          // to centralize the Chatwoot fetch logic.
          const enriched = await enrichFromChatwoot(account_id, payload);
          const cards = await prisma.card.findMany({
            where: { accountId: account_id, contactId: payload.contact.id },
            select: { id: true },
          });
          for (const c of cards) {
            await prisma.card.update({
              where: { id: c.id },
              data: {
                contactName: enriched.contactName ?? undefined,
                channelType: enriched.channelType,
                assigneeId: enriched.assigneeId,
                agentName: enriched.agentName,
                agentAvatar: enriched.agentAvatar,
                customFields: serializeCustomFields(enriched.customFields) ?? undefined,
                isOrphan: false,
              },
            });
          }
          return send(reply, 202, {
            status: 'accepted',
            action: `contact_updated:${cards.length}-cards`,
          });
        }

        case 'contact_deleted': {
          if (!payload.contact?.id) {
            return send(reply, 200, { status: 'ignored', action: 'contact_deleted:no-contact-id' });
          }
          const affected = await markOrphanByContact(account_id, payload.contact.id);
          return send(reply, 202, {
            status: 'accepted',
            action: `contact_deleted:${affected.length}-orphaned`,
          });
        }

        case 'conversation_deleted': {
          if (!conversationId) {
            return send(reply, 200, { status: 'ignored', action: 'conversation_deleted:no-id' });
          }
          const cardId = await markOrphan(account_id, conversationId);
          return send(reply, 202, {
            status: 'accepted',
            action: cardId ? 'conversation_deleted:orphaned' : 'conversation_deleted:not-found',
            card_id: cardId ?? undefined,
          });
        }

        case 'conversation_status_changed': {
          // Chatwoot doesn't expose a dedicated `conversation_deleted` event in
          // the dashboard webhook picker — a hard delete shows up here with
          // status === 'deleted'. We mirror that into our orphan-marker flow
          // so the card disappears from the board.
          if (!conversationId) {
            return send(reply, 200, { status: 'ignored', action: 'conversation_status_changed:no-id' });
          }
          const newStatus = payload.conversation?.status;
          if (newStatus !== 'deleted') {
            return send(reply, 200, {
              status: 'ignored',
              action: `conversation_status_changed:${newStatus ?? 'unknown'}-not-deleted`,
            });
          }
          const cardId = await markOrphan(account_id, conversationId);
          return send(reply, 202, {
            status: 'accepted',
            action: cardId ? 'conversation_status_changed:orphaned' : 'conversation_status_changed:not-found',
            card_id: cardId ?? undefined,
          });
        }

        case 'message_created': {
          // Mirror Chatwoot private notes back to the corresponding card.
          // Skip if not private, no content, or the message originated from
          // the Kanban side (loop prevention via content_attributes.source).
          if (!payload.private) {
            return send(reply, 200, { status: 'ignored', action: 'message_created:not-private' });
          }
          const sourceMarker = (payload.content_attributes as { source?: string } | undefined)?.source;
          if (sourceMarker === KANBAN_NOTE_SOURCE) {
            return send(reply, 200, { status: 'ignored', action: 'message_created:kanban-origin' });
          }
          if (!conversationId || !payload.content) {
            return send(reply, 200, { status: 'ignored', action: 'message_created:incomplete' });
          }
          const card = await prisma.card.findFirst({
            where: { accountId: account_id, conversationId, deletedAt: null },
            select: { id: true },
          });
          if (!card) {
            return send(reply, 200, { status: 'ignored', action: 'message_created:no-card' });
          }
          await prisma.note.create({
            data: { cardId: card.id, content: payload.content },
          });
          return send(reply, 202, {
            status: 'accepted',
            action: 'message_created:note-mirrored',
            card_id: card.id,
          });
        }
      }
    } catch (err) {
      request.log.error({ err }, 'webhook handler failed');
      return send(reply, 500, { status: 'error', action: `${event}:server-error` });
    }

    return send(reply, 200, { status: 'ignored', action: `unknown-event` });
  });
}
