import type { FastifyInstance } from 'fastify';
import type { JwtPayload } from '../../middleware/tenant.js';
import {
  createCardSchema,
  updateCardSchema,
  cardQuerySchema,
  cardSchema,
  paginatedCardsSchema,
  stageIdParamsSchema,
  cardIdParamsSchema,
} from '../../schemas/card.js';
import { problemResponse } from '../../lib/errors.js';
import prisma from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

export default async function cardRoutes(fastify: FastifyInstance) {
  // GET /stages/:stageId/cards — list cards with cursor pagination (D-10)
  fastify.get('/stages/:stageId/cards', {
    onRequest: [fastify.authenticate],
    schema: {
      params: stageIdParamsSchema,
      querystring: cardQuerySchema,
      response: { 200: paginatedCardsSchema },
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
      response: { 201: cardSchema },
    },
  }, async (request, reply) => {
    const { account_id } = request.user as JwtPayload;
    const { stageId } = request.params as { stageId: string };
    const body = request.body as {
      contact_name: string;
      conversation_id?: number;
      channel_type?: string;
      assignee_id?: number;
      custom_fields?: Record<string, unknown>;
    };

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
        customFields: (body.custom_fields ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        position: nextPos,
      },
    });

    return reply.code(201).send(card);
  });

  // PATCH /cards/:id — update card (including stage move)
  fastify.patch('/cards/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: cardIdParamsSchema,
      body: updateCardSchema,
      response: { 200: cardSchema },
    },
  }, async (request, reply) => {
    const { account_id } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = request.body as {
      contact_name?: string;
      stage_id?: string;
      conversation_id?: number | null;
      channel_type?: string | null;
      assignee_id?: number | null;
      position?: number;
      custom_fields?: Record<string, unknown> | null;
    };

    // Find card (tenant-scoped + soft delete filter)
    const card = await prisma.card.findFirst({
      where: { id, accountId: account_id, deletedAt: null },
    });
    if (!card) {
      return problemResponse(reply, 404, 'Not Found', 'Card not found');
    }

    // If moving to a different stage, verify target stage belongs to same account
    if (body.stage_id !== undefined) {
      const targetStage = await prisma.stage.findFirst({
        where: { id: body.stage_id, accountId: account_id },
      });
      if (!targetStage) {
        return problemResponse(reply, 404, 'Not Found', 'Target stage not found');
      }
    }

    // Build update data — map snake_case to camelCase
    const updateData: Record<string, unknown> = {};
    if (body.contact_name !== undefined) updateData.contactName = body.contact_name;
    if (body.stage_id !== undefined) updateData.stageId = body.stage_id;
    if (body.conversation_id !== undefined) updateData.conversationId = body.conversation_id;
    if (body.channel_type !== undefined) updateData.channelType = body.channel_type;
    if (body.assignee_id !== undefined) updateData.assigneeId = body.assignee_id;
    if (body.position !== undefined) updateData.position = body.position;
    if (body.custom_fields !== undefined) updateData.customFields = (body.custom_fields === null ? Prisma.JsonNull : body.custom_fields) as Prisma.InputJsonValue;

    const updated = await prisma.card.update({
      where: { id },
      data: updateData,
    });

    return updated;
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
