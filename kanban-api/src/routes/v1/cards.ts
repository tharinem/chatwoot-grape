import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { JwtPayload } from '../../middleware/tenant.js';
import {
  createCardSchema,
  updateCardSchema,
  cardQuerySchema,
  stageIdParamsSchema,
  cardIdParamsSchema,
} from '../../schemas/card.js';
import { problemResponse } from '../../lib/errors.js';
import prisma from '../../lib/prisma.js';
import { createPrivateNote } from '../../services/chatwoot-client.js';
import { tryDecryptSecret } from '../../services/crypto.js';

export default async function cardRoutes(fastify: FastifyInstance) {
  // GET /cards — all cards for the account (D-09)
  fastify.get('/cards', {
    onRequest: [fastify.authenticate],
    schema: {},
  }, async (request) => {
    const { account_id } = request.user as JwtPayload;
    const cards = await prisma.card.findMany({
      where: { accountId: account_id, deletedAt: null },
      orderBy: { position: 'asc' },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' } },
      },
    });
    return cards;
  });

  // GET /stages/:stageId/cards — list cards with cursor pagination (D-10)
  fastify.get('/stages/:stageId/cards', {
    onRequest: [fastify.authenticate],
    schema: {
      params: stageIdParamsSchema,
      querystring: cardQuerySchema,
    },
  }, async (request, reply) => {
    const { account_id } = request.user as JwtPayload;
    const { stageId } = request.params as { stageId: string };
    const { cursor, limit } = request.query as { cursor?: string; limit: number };

    // Verify stage belongs to this account
    const stage = await prisma.stage.findFirst({
      where: { id: stageId, accountId: account_id },
    });
    if (!stage) {
      return problemResponse(reply, 404, 'Not Found', 'Stage not found');
    }

    const cards = await prisma.card.findMany({
      where: { accountId: account_id, stageId, deletedAt: null },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { position: 'asc' },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' } },
      },
    });

    const hasMore = cards.length > limit;
    const data = hasMore ? cards.slice(0, -1) : cards;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, nextCursor, hasMore };
  });

  // POST /stages/:stageId/cards — create card (D-02: only contact_name required)
  fastify.post('/stages/:stageId/cards', {
    onRequest: [fastify.authenticate],
    schema: {
      params: stageIdParamsSchema,
      body: createCardSchema,
    },
  }, async (request, reply) => {
    const { account_id } = request.user as JwtPayload;
    const { stageId } = request.params as { stageId: string };
    const body = request.body as any;

    // Verify stage belongs to this account
    const stage = await prisma.stage.findFirst({
      where: { id: stageId, accountId: account_id },
    });
    if (!stage) {
      return problemResponse(reply, 404, 'Not Found', 'Stage not found');
    }

    // Determine next position
    const agg = await prisma.card.aggregate({
      where: { accountId: account_id, stageId, deletedAt: null },
      _max: { position: true },
    });
    const nextPos = (agg._max.position ?? 0) + 1;

    const card = await prisma.card.create({
      data: {
        accountId: account_id,
        stageId,
        contactName: body.contact_name,
        conversationId: body.conversation_id ?? null,
        channelType: body.channel_type ?? null,
        assigneeId: body.assignee_id ?? null,
        dealValue: body.deal_value ?? null,
        priority: body.priority ?? null,
        nextFollowUp: body.next_follow_up ? new Date(body.next_follow_up) : null,
        agentName: body.agent_name ?? null,
        agentAvatar: body.agent_avatar ?? null,
        customFields: body.custom_fields ? JSON.stringify(body.custom_fields) : null,
        position: nextPos,
        activities: {
          create: {
            action: `Criado em ${stage.name}`,
          }
        }
      },
      include: { notes: true, activities: true }
    });

    return reply.code(201).send(card);
  });

  // PATCH /cards/:id — update card (including stage move)
  fastify.patch('/cards/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: cardIdParamsSchema,
      body: updateCardSchema,
    },
  }, async (request, reply) => {
    const { account_id } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = request.body as any;

    // Find card (tenant-scoped + soft delete filter)
    const card = await prisma.card.findFirst({
      where: { id, accountId: account_id, deletedAt: null },
      include: { stage: true }
    });
    if (!card) {
      return problemResponse(reply, 404, 'Not Found', 'Card not found');
    }

    // Process stage move and activity logging
    let targetStageName = '';
    if (body.stage_id !== undefined && body.stage_id !== card.stageId) {
      const targetStage = await prisma.stage.findFirst({
        where: { id: body.stage_id, accountId: account_id },
      });
      if (!targetStage) {
        return problemResponse(reply, 404, 'Not Found', 'Target stage not found');
      }
      targetStageName = targetStage.name;
    }

    // Build update data — map snake_case to camelCase
    const updateData: any = {};
    if (body.contact_name !== undefined) updateData.contactName = body.contact_name;
    if (body.stage_id !== undefined) updateData.stageId = body.stage_id;
    if (body.conversation_id !== undefined) updateData.conversationId = body.conversation_id;
    if (body.channel_type !== undefined) updateData.channelType = body.channel_type;
    if (body.assignee_id !== undefined) updateData.assigneeId = body.assignee_id;
    if (body.position !== undefined) updateData.position = body.position;
    if (body.deal_value !== undefined) updateData.dealValue = body.deal_value;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.next_follow_up !== undefined) updateData.nextFollowUp = body.next_follow_up ? new Date(body.next_follow_up) : null;
    if (body.agent_name !== undefined) updateData.agentName = body.agent_name;
    if (body.agent_avatar !== undefined) updateData.agentAvatar = body.agent_avatar;
    if (body.custom_fields !== undefined) updateData.customFields = body.custom_fields === null ? null : JSON.stringify(body.custom_fields);

    // If moved, record activity
    if (targetStageName) {
      updateData.activities = {
        create: {
          action: `Movido de ${card.stage.name} → ${targetStageName}`,
          fromStage: card.stage.name,
          toStage: targetStageName,
        }
      };
    }

    const updated = await prisma.card.update({
      where: { id },
      data: updateData,
      include: { notes: true, activities: true }
    });

    return updated;
  });

  // POST /cards/:id/notes — add note
  fastify.post('/cards/:id/notes', {
    onRequest: [fastify.authenticate],
    schema: {
      params: cardIdParamsSchema,
      body: z.object({ content: z.string() }),
    },
  }, async (request, reply) => {
    const { account_id } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };

    const card = await prisma.card.findFirst({
      where: { id, accountId: account_id, deletedAt: null },
    });
    if (!card) {
      return problemResponse(reply, 404, 'Not Found', 'Card not found');
    }

    const note = await prisma.note.create({
      data: {
        cardId: id,
        content,
      },
    });

    // Best-effort mirror to Chatwoot as a private note. Failures don't break
    // the response — the local note is the source of truth.
    if (card.conversationId) {
      const account = await prisma.account.findUnique({ where: { id: account_id } });
      const apiToken = account ? tryDecryptSecret(account.chatwootApiToken) : null;
      if (account && apiToken) {
        createPrivateNote(card.conversationId, content, {
          baseUrl: account.chatwootBaseUrl,
          accountId: account_id,
          apiToken,
        }).catch(() => {
          // swallow — Chatwoot might be offline; local note already saved
        });
      }
    }

    return reply.code(201).send(note);
  });

  // DELETE /cards/:id — soft delete (D-01: set deletedAt)
  fastify.delete('/cards/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: cardIdParamsSchema,
    },
  }, async (request, reply) => {
    const { account_id } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    // Find card (tenant-scoped + soft delete filter)
    const card = await prisma.card.findFirst({
      where: { id, accountId: account_id, deletedAt: null },
    });
    if (!card) {
      return problemResponse(reply, 404, 'Not Found', 'Card not found');
    }

    await prisma.card.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return reply.code(204).send();
  });
}
